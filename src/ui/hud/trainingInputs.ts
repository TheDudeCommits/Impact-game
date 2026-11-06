import { ACTIONS, boundTo, keyName } from '../../input/bindings';
import type { PadFamily } from '../../input/gamepad';
import { padName, type PadControl } from '../../input/glyphs';
import { el, show } from './mainHudKit';

export const INPUT_SLOTS = 8;
const FACE = new Set<PadControl>(['south', 'east', 'west', 'north']);
/** The left stick's eight ways, from the right going clockwise on screen (up is forward). */
export const STICK_ARROWS = ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗'] as const;

/** The stick's sector (0-7, STICK_ARROWS) or -1 inside the dead zone. */
export function stickSector(x: number, y: number, dead = .5) {
  if (Math.hypot(x, y) < dead) return -1;
  const turn = Math.atan2(y, x) / (Math.PI / 4);
  return ((Math.round(turn) % 8) + 8) % 8;
}
/** Whether a key is one the input display shows: bound to an action of the fight. */
export const shownKey = (code: string) => ACTIONS.some(action => boundTo(action, code));

export class InputDisplay {
  readonly node = el('div', 'training-inputs');
  private readonly slots: HTMLElement[] = [];
  private filled = 0;
  private wanted = false;
  constructor(zone: HTMLElement) {
    this.node.hidden = true; this.node.setAttribute('aria-hidden', 'true');
    const row = el('span', 'training-input-keys');
    for (let i = 0; i < INPUT_SLOTS; i++) { const slot = el('kbd'); slot.hidden = true; row.append(slot); this.slots.push(slot); }
    this.node.append(el('b', '', 'INPUTS'), row);
    zone.append(this.node);
  }
  /** Up while toggled on, once there is a press to show (an empty strip reads as broken). */
  set visible(on: boolean) { this.wanted = on; show(this.node, on && this.filled > 0); }
  get visible() { return !this.node.hidden; }
  /** A keyboard key (or Mouse0..4) by its code. */
  key(code: string) { this.push(keyName(code), ''); }
  /** A pad control, in the pad's own glyph. */
  pad(control: PadControl, family: PadFamily) {
    this.push(padName(family, control), family === 'playstation' && FACE.has(control) ? `pad-key ps-face ps-${control}` : 'pad-key');
  }
  /** A stick direction. */
  stick(sector: number) { this.push(STICK_ARROWS[sector], 'pad-key stick'); }
  clear() { this.filled = 0; show(this.node, false); for (const slot of this.slots) { slot.hidden = true; slot.textContent = ''; } }
  private push(text: string, className: string) {
    // Everything moves one to the left; the newest takes the right-hand end.
    if (this.filled < INPUT_SLOTS) this.filled++;
    const first = INPUT_SLOTS - this.filled;
    for (let i = first; i < INPUT_SLOTS - 1; i++) {
      const from = this.slots[i + 1], to = this.slots[i];
      to.textContent = from.textContent; to.className = from.className; to.hidden = from.hidden;
    }
    const last = this.slots[INPUT_SLOTS - 1];
    last.textContent = text; last.className = className; last.hidden = false;
    for (let i = 0; i < first; i++) this.slots[i].hidden = true;
    last.classList.remove('fresh'); void last.offsetWidth; last.classList.add('fresh');
    if (this.wanted) show(this.node, true);
  }
}
