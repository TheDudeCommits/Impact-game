import { FIGHTERS } from '../config';
import type { FighterId, PlayerState } from '../game/types';
import { moveFor } from '../game/awakening';
import { brushStroke } from './inkSplat';
import './cutIn.css';

/** Whose ultimate it is: the player's own (it wipes in from the left), or an opponent's landing on the player (from
 *  the right). */
export type CutInSide = 'mine' | 'theirs';
/** The name card, start to finish (cutIn.css: the stroke in by .09 s, the name by .12 s, gone by .4 s). */
export const CUT_IN_SECONDS = .4;
/** A box on the screen the card keeps off, in CSS pixels (a fighter as drawn, a HUD panel). */
export interface ScreenBox { left: number; top: number; right: number; bottom: number }
/** Where the card may go, in the order it is tried: the lower left, above the cinema bars; the lower right, above the
 *  skill cards; the upper left and upper right, under the plates. An opponent's tries the right first. */
type Spot = 'll' | 'lr' | 'ul' | 'ur';
const ORDER: Record<CutInSide, readonly Spot[]> = { mine: ['ll', 'lr', 'ul', 'ur'], theirs: ['lr', 'll', 'ur', 'ul'] };
/** The card's distance in from the frame's edge (a share of its width) and above the bars (of its height); the gap
 *  kept round a box it avoids, in pixels. */
const EDGE = .032, LIFT = .075, GAP = 10;
/** One brush stroke per side, drawn once. */
const STROKE = brushStroke(11, .62);

/** Whether `p`'s ultimate gets the name card for the player `localId`, and from which side: the player's own at its
 *  cast - the card is small and in a corner, so it is the move's call rather than a curtain over it - and an
 *  opponent's only once it has confirmed on the player, inside a cinematic nobody can act in, so it never tells the
 *  player of a blow they could still dodge. Undefined: none (yet). */
export function cutInSide(p: Pick<PlayerState, 'id' | 'fighter' | 'action' | 'alive' | 'awakened' | 'confirmedAt' | 'target'> & { enemy?: unknown }, localId: string): CutInSide | undefined {
  if (p.action !== 'ultimate' || !p.alive || p.enemy) return undefined;
  if (p.id === localId) return 'mine';
  const confirm = !!moveFor(p.fighter, 'ultimate', !!p.awakened).confirm;
  return confirm && p.confirmedAt !== undefined && p.target === localId ? 'theirs' : undefined;
}
/** Whether `p` is the player `localId` going into their transformation: their own awakening gets the card too, with
 *  the form's name. An opponent's does not. */
export function awakeningCutIn(p: Pick<PlayerState, 'id' | 'action' | 'alive'> & { enemy?: unknown }, localId: string) {
  return p.id === localId && p.action === 'awaken' && p.alive && !p.enemy;
}
/** Which cast or transformation a card is for, so each gets one: an ultimate by its action sequence, a transformation
 *  by when it started (it is no attack, so it keeps the sequence of whatever came before - an ultimate's, which hid
 *  the card of a transformation straight after one). */
export function cutInKey(p: Pick<PlayerState, 'action' | 'actionSeq' | 'actionStarted'>) {
  return p.action === 'awaken' ? `a:${p.actionStarted}` : `u:${p.actionSeq ?? p.actionStarted}`;
}

/** Of `spots` (each the card's box where it would stand), the first clear of every box in `avoid`; failing that, the
 *  one that covers the least of them. */
export function chooseSpot<T extends string>(spots: readonly { spot: T; box: ScreenBox }[], avoid: readonly ScreenBox[]): T {
  let best = spots[0].spot, least = Infinity;
  for (const { spot, box } of spots) {
    let covered = 0;
    for (const a of avoid) {
      const w = Math.min(box.right, a.right + GAP) - Math.max(box.left, a.left - GAP), h = Math.min(box.bottom, a.bottom + GAP) - Math.max(box.top, a.top - GAP);
      if (w > 0 && h > 0) covered += w * h;
    }
    if (covered === 0) return spot;
    if (covered < least) { least = covered; best = spot; }
  }
  return best;
}

export class CutIn {
  readonly element: HTMLElement;
  /** Heard as it wipes in (main.ts plays the sound). */
  onShow?: (side: CutInSide) => void;
  /** Which corner the last card took (for the evidence). */
  spot: Spot | '' = '';
  private timer = 0;
  constructor(parent: HTMLElement) {
    this.element = document.createElement('div');
    this.element.className = 'cutin';
    this.element.hidden = true;
    this.element.setAttribute('aria-hidden', 'true');
    parent.append(this.element);
  }
  get open() { return !this.element.hidden; }
  /** Show `move`'s card for `fighter`, keeping off the boxes in `avoid`. */
  show(fighter: FighterId, move: string, side: CutInSide, avoid: readonly ScreenBox[] = []) {
    clearTimeout(this.timer);
    const def = FIGHTERS[fighter];
    this.element.className = `cutin cutin-${side}`;
    this.element.style.setProperty('--cut-color', def.color);
    this.element.innerHTML = `<div class="cutin-card"><svg class="cutin-stroke" viewBox="0 0 1000 200" preserveAspectRatio="none" focusable="false"><path class="cutin-edge" d="${STROKE}"/><path class="cutin-ink" d="${STROKE}"/></svg><small></small><b></b></div>`;
    const card = this.element.querySelector<HTMLElement>('.cutin-card')!, name = card.querySelector('b')!;
    card.querySelector('small')!.textContent = def.name;
    name.textContent = move;
    this.element.hidden = false;
    // A long name ("Sanctum: Carrion Altar") is set smaller until it fits the card's widest.
    const room = card.clientWidth, need = name.scrollWidth;
    if (room > 0 && need > room) name.style.fontSize = `${Math.max(.6, room / need).toFixed(3)}em`;
    this.place(card, side, avoid);
    void this.element.offsetWidth;
    this.element.classList.add('cutin-go');
    this.onShow?.(side);
    this.timer = window.setTimeout(() => this.hide(), CUT_IN_SECONDS * 1000);
  }
  hide() {
    clearTimeout(this.timer);
    this.element.hidden = true; this.element.className = 'cutin'; this.element.innerHTML = '';
  }
  /** Stand the card in the first corner clear of `avoid` and of the HUD's own panels. */
  private place(card: HTMLElement, side: CutInSide, avoid: readonly ScreenBox[]) {
    const vw = innerWidth, vh = innerHeight, w = card.offsetWidth, h = card.offsetHeight;
    const edge = vw * EDGE, low = vh * LIFT;
    // Measured, not assumed: the plates' bottoms and the skill cards' top, where this page has them.
    const hud = (selector: string) => [...document.querySelectorAll<HTMLElement>(selector)].map(el => el.getBoundingClientRect()).filter(r => r.width > 0 && r.height > 0);
    const plates = hud('.combat-hud .fighter-meter'), cards = hud('.combat-hud .move-bar');
    const under = Math.max(vh * .14, ...plates.map(r => r.bottom)) + 12, above = Math.min(vh - low, ...cards.map(r => r.top)) - 12;
    const at = (left: number, top: number): ScreenBox => ({ left, top, right: left + w, bottom: top + h });
    const boxes: Record<Spot, ScreenBox> = {
      ll: at(edge, vh - low - h), lr: at(vw - edge - w, above - h),
      ul: at(edge, under), ur: at(vw - edge - w, under),
    };
    const panels = hud('#interface .mode-hud > [data-zone]:not([data-zone="8"]) > *');
    this.spot = chooseSpot(ORDER[side].map(spot => ({ spot, box: boxes[spot] })), [...avoid, ...plates, ...cards, ...panels]);
    const box = boxes[this.spot];
    Object.assign(card.style, { left: `${box.left.toFixed(1)}px`, top: `${box.top.toFixed(1)}px`, right: 'auto', bottom: 'auto' });
    card.dataset.spot = this.spot;
  }
}
