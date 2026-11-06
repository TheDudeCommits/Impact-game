import { phone } from '../../input/device';
import { seatablePads } from '../../couch/seats';
import type { PadState } from '../../input/gamepad';
import { MODES, modeHere, type ModeId } from './catalogue';
import './couchPrompt.css';

/** A pad's key for "this pad, this session": its place and its name (a pad plugged out and back in keeps both). */
const padKey = (pad: Pick<PadState, 'index' | 'id'>) => `${pad.index}|${pad.id}`;
const SEEN = 'impact-couch-prompted';

/** Which pad is Player 2's, when there are two: the one the page's menus do not read (else the second). None: fewer than two. */
export function secondPad(pads: readonly (PadState | null | undefined)[], menuPad: number | null): PadState | undefined {
  const seatable = seatablePads(pads), list = pads.filter((p): p is PadState => !!p && seatable.includes(p.index));
  if (list.length < 2) return undefined;
  return list.find(p => p.index !== menuPad && p.index !== list[0].index) ?? list.find(p => p.index !== menuPad) ?? list[1];
}

export class CouchPrompt {
  readonly el = document.createElement('div');
  private shownFor?: string;
  private held = [true, true];
  private readonly seen: Set<string>;
  constructor(private readonly root: HTMLElement, private readonly selected: () => ModeId, private readonly open: (mode: ModeId) => void,
    private readonly sheetOpen: () => boolean, private readonly menuPad: () => number | null = () => null,
    private readonly pads: () => readonly (PadState | null | undefined)[] = () => (typeof navigator === 'object' && navigator.getGamepads ? [...navigator.getGamepads()] as unknown as PadState[] : [])) {
    let kept: string[] = [];
    try { kept = JSON.parse(sessionStorage.getItem(SEEN) ?? '[]') as string[]; } catch { /* a private window: this page's memory only */ }
    this.seen = new Set(Array.isArray(kept) ? kept.filter(each => typeof each === 'string') : []);
    this.el.className = 'couch-prompt'; this.el.hidden = true; this.el.setAttribute('role', 'dialog'); this.el.setAttribute('aria-label', 'Player 2 detected');
    this.el.innerHTML = '<strong>PLAYER 2 DETECTED</strong><span></span><button type="button" data-couch-go>COUCH →</button><button type="button" data-couch-close aria-label="Not now">✕</button>';
    this.el.addEventListener('click', event => {
      const target = event.target as HTMLElement;
      if (target.closest('[data-couch-go]')) this.go(); else if (target.closest('[data-couch-close]')) this.dismiss();
    });
    root.append(this.el);
    if (typeof window === 'object') { window.addEventListener('gamepadconnected', () => this.poll()); setInterval(() => this.poll(), 400); }
  }
  /** Once in a while (and as a pad arrives): shown, answered by Player 2's pad, or put away. */
  poll() {
    const home = this.root.querySelector('.lobby:not(.hidden)');
    const pad = !phone() && home && !this.sheetOpen() ? secondPad(this.pads(), this.menuPad()) : undefined;
    const key = pad && padKey(pad);
    if (!pad || !key || this.seen.has(key)) { this.hide(); return; }
    if (this.shownFor !== key) {
      this.shownFor = key; this.held = [true, true];   // a press that brought the pad in is not an answer
      const mode = this.mode();
      this.el.querySelector('span')!.textContent = `PLAY ${MODES[mode].name} ON THE COUCH · PLAYER 2 PRESS A`;
      this.el.hidden = false;
    }
    const a = !!pad.buttons[0]?.pressed, b = !!pad.buttons[1]?.pressed;
    if (a && !this.held[0]) this.go(); else if (b && !this.held[1]) this.dismiss();
    this.held = [a, b];
  }
  /** The selected mode, if it has a couch way here; else the Duel's. */
  private mode(): ModeId { const mode = this.selected(); return modeHere(mode).variants.couch ? mode : 'duel'; }
  private go() { const mode = this.mode(); this.remember(); this.hide(); this.open(mode); }
  private dismiss() { this.remember(); this.hide(); }
  private remember() {
    if (this.shownFor) this.seen.add(this.shownFor);
    try { sessionStorage.setItem(SEEN, JSON.stringify([...this.seen])); } catch { /* memory only */ }
  }
  private hide() { this.shownFor = undefined; if (!this.el.hidden) this.el.hidden = true; }
}
