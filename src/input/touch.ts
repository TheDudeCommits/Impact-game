import type { Input, TouchAction } from '../input';
import { pageHeight, pageWidth } from '../ui/viewport';
import type { PlayerState } from '../game/types';
import { phone, tablet } from './device';
import { coolSeconds, METER_HZ, spotStyle, TOUCH_LAYOUT, touchMeters, type ClusterButton } from './touchLayout';
import { TouchArt } from './touchArt';
import '../ui/handheld.css';

export type TouchButton = TouchAction | 'area' | 'guard' | 'pause' | 'emote';
/** The on-screen buttons and their labels (prompts.ts touchKey names them the same). */
export const TOUCH_BUTTONS: readonly [TouchButton, string][] = [
  ['light', 'LIGHT'], ['heavy', 'HEAVY'], ['special', 'SPECIAL'], ['ultimate', 'ULT'], ['area', 'AREA'], ['awaken', 'AWAKEN'],
  ['jump', 'JUMP'], ['dash', 'DASH'], ['guard', 'GUARD'], ['target', 'LOCK'], ['pause', '❚❚'], ['emote', '!?'],
];
/** The buttons' faces (handheld.css): line glyphs in the paper's colour, LIGHT's a fist; the skills show their move's
 *  art instead (touchArt.ts) and AWAKEN the fighter's face. 32-unit boxes. */
const GLYPHS: Partial<Record<TouchButton, string>> = {
  light: '<svg class="tc-glyph tc-fist" viewBox="0 0 32 32" aria-hidden="true"><rect x="7" y="12.5" width="18.6" height="13.5" rx="5"/><rect x="7.4" y="7.4" width="4.7" height="9.6" rx="2.35"/><rect x="12.1" y="6" width="4.7" height="11" rx="2.35"/><rect x="16.8" y="6.6" width="4.7" height="10.4" rx="2.35"/><rect x="21.5" y="8.4" width="4.4" height="8.6" rx="2.2"/><rect x="4.8" y="15.4" width="13.6" height="5.2" rx="2.6"/></svg>',
  dash: '<svg class="tc-glyph" viewBox="0 0 32 32" aria-hidden="true"><path d="M3 11h8M1.5 16h10M3 21h8"/><path d="M14 8.5l7.5 7.5-7.5 7.5M21 8.5l7.5 7.5-7.5 7.5"/></svg>',
  jump: '<svg class="tc-glyph" viewBox="0 0 32 32" aria-hidden="true"><path d="M8 16.5l8-7.5 8 7.5M8 24l8-7.5 8 7.5"/></svg>',
  guard: '<svg class="tc-glyph" viewBox="0 0 32 32" aria-hidden="true"><path d="M16 4.5l9.5 3.6v7.2c0 6-4 10.4-9.5 12.2-5.5-1.8-9.5-6.2-9.5-12.2V8.1z"/><path d="M16 9.5v13"/></svg>',
  target: '<svg class="tc-glyph" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="8.5"/><path d="M16 2.5v7M16 22.5v7M2.5 16h7M22.5 16h7"/></svg>',
  pause: '<svg class="tc-glyph" viewBox="0 0 32 32" aria-hidden="true"><path d="M12 9v14M20 9v14"/></svg>',
};
/** The skills: their move's art in a round window, a radial wipe and the seconds left while they cool. */
const SKILLS = new Set<TouchButton>(['heavy', 'special', 'ultimate', 'area']);
/** One button's markup: its face (art, a portrait or a glyph), what it shows over that (a cooldown's wipe and seconds, a
 *  charge ring, DASH's pips) and its label - the name prompts.ts touchKey prints, so a prompt points at it. */
function buttonHtml(id: TouchButton, label: string) {
  const face = SKILLS.has(id) ? '<span class="tc-face"><span class="ik-art"></span></span>' : id === 'awaken' ? '<span class="tc-face tc-portrait"></span>'
    : GLYPHS[id] ? `<span class="tc-face">${GLYPHS[id]}</span>` : '';
  const over = (id === 'heavy' || id === 'special' || id === 'area' || id === 'light' ? '<i class="tc-wipe"></i><i class="tc-num"></i>' : '')
    + (id === 'ultimate' || id === 'awaken' ? '<i class="tc-ring"></i>' : '')
    + (id === 'dash' ? `<i class="tc-pips">${'<i hidden></i>'.repeat(5)}</i>` : '')
    + (id === 'area' ? '<i class="tc-aim" aria-hidden="true"><i class="tc-aim-dot"></i></i>' : '');
  const glyphOnly = id === 'pause';
  return `<button type="button" tabindex="-1" class="tc-btn tc-${id}${SKILLS.has(id) ? ' tc-skill' : ''}" data-tc="${id}" aria-label="${id === 'pause' ? 'PAUSE' : id === 'emote' ? 'EMOTE' : label}">${face}${over}<b${glyphOnly ? ' hidden' : ''}>${label}</b></button>`;
}
/** The stick's ring, at rest and under the thumb: a thin circle and a chevron at each of its four points. */
const STICK_RING = '<svg class="tc-ring-svg" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="48"/><path d="M44 13l6-6 6 6M44 87l6 6 6-6M13 44l-6 6 6 6M87 44l6 6-6 6"/></svg>';
/** The stick's reach from where the thumb landed, CSS pixels at a phone's size (a tablet's is larger: --tc-k). */
export const STICK_RADIUS = 58;
/** Shares of the reach: nothing inside the deadzone, full speed from `STICK_FULL` out. */
export const STICK_DEADZONE = .14, STICK_FULL = .8;
/** The stick takes touches that start on this share of the screen's width; the rest of it looks. */
export const STICK_SHARE = .42;
/** The HUD's pieces along the top (the plates, the middle's plaque or tools, the mode's top and side zones, a room's
 *  dock): PAUSE and the emote button go where none of them stands (TouchControls.placeTop). A drawn look's plate (Halo,
 *  hud/protos) counts by its painted parts - its whole box is mostly empty below its bars - and brings a clock. */
const TOP_PIECES = '#interface .combat-hud .fighter-meter,#interface .combat-hud .fighter-meter>.hd-skin>:not([data-hd-glow]),#interface .combat-hud .hd-clock,#interface .combat-hud .match-status,#interface .mode-hud>:is([data-zone="2"],[data-zone="2b"],[data-zone="3"],[data-zone="1b"],[data-zone="3b"])>*,#interface .waiting-dock,#interface .rift-scoreboard,.sv-hud>*';
/** The player's own plate: the inked container, or the drawn look's plate in it, whichever reaches further. */
const OWN_PLATE = '#interface .combat-hud .fighter-meter.own,#interface .combat-hud .fighter-meter.own>.hd-skin';
/** The first stretch at least `want` wide along [from, to] that none of `taken` ([left, right] pairs) covers, or
 *  undefined. */
export function firstGap(taken: readonly (readonly [number, number])[], from: number, to: number, want: number): number | undefined {
  let x = from;
  for (const [left, right] of [...taken].sort((a, b) => a[0] - b[0])) {
    if (right <= x) continue;
    if (left >= x + want) break;
    x = right;
  }
  return x + want <= to ? x : undefined;
}
/** The page's own controls under a finger keep the touch (a tap on them is a click). */
const KEEP = 'button,a[href],input,select,textarea,summary,label,details,dialog,[role="button"],[role="dialog"],[contenteditable]';

/** The stick's reading for a thumb `dx` right and `dy` down (CSS pixels) from where it landed: [forward, right] in
 *  -1..1, as the pad's left stick reads after its radial deadzone (gamepad.ts: forward is up, so -dy). Nothing within
 *  `deadzone` of the reach, full speed from `full` of it, a straight line between. */
export function stickVector(dx: number, dy: number, radius = STICK_RADIUS, deadzone = STICK_DEADZONE, full = STICK_FULL): [number, number] {
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || !(radius > 0)) return [0, 0];
  const length = Math.hypot(dx, dy) / radius;
  if (length <= deadzone) return [0, 0];
  const scale = Math.min(1, (length - deadzone) / (full - deadzone)) / length / radius;
  return [-dy * scale || 0, dx * scale || 0];
}
/** Where the stick's base sits once the thumb has gone `reach` past it: dragged along behind the thumb, so turning
 *  back never has to cross the whole base first. Answers the base's new centre. */
export function dragBase(baseX: number, baseY: number, x: number, y: number, reach: number): [number, number] {
  const dx = x - baseX, dy = y - baseY, length = Math.hypot(dx, dy);
  if (length <= reach || !(length > 0)) return [baseX, baseY];
  const k = (length - reach) / length;
  return [baseX + dx * k, baseY + dy * k];
}
export const AIM_RADIUS = 120;
/** How far a finger on AREA travels from where it landed before it aims: less is a tap, which casts at the aim's own
 *  start (the locked target, or ahead). */
export const AIM_SLOP = 10;
export type AimStep = { phase: 'move'; right: number; forward: number } | { phase: 'cancel' };
/** One finger on the AREA button, read against the button's centre (`cx`, `cy`) and radius (`button`). Once it has
 *  travelled AIM_SLOP from where it landed (`x0`, `y0`) it aims: `right` and `forward` are its offset from the centre as
 *  a share of `reach` (screen up is forward), never more than 1 long. A drag that has gone clear of the button and comes
 *  back onto it puts the aim away; that finger then does nothing more until it lifts. */
export class AreaDrag {
  private aiming = false;
  private out = false;
  private cancelled = false;
  constructor(readonly cx: number, readonly cy: number, readonly button: number, readonly reach = AIM_RADIUS, readonly x0 = cx, readonly y0 = cy) {}
  /** The finger is at (`x`, `y`): what Input.touchAim is told, if anything. */
  move(x: number, y: number): AimStep | undefined {
    if (this.cancelled || !Number.isFinite(x) || !Number.isFinite(y)) return undefined;
    const dx = x - this.cx, dy = y - this.cy, from = Math.hypot(dx, dy);
    // Clear of the button by the slop, so a thumb rolling on its rim never cancels.
    if (from > this.button + AIM_SLOP) this.out = true;
    else if (this.out && from <= this.button) { this.cancelled = true; return { phase: 'cancel' }; }
    if (!this.aiming && Math.hypot(x - this.x0, y - this.y0) < AIM_SLOP) return undefined;
    this.aiming = true;
    const k = 1 / Math.max(from, this.reach);
    return { phase: 'move', right: dx * k || 0, forward: -dy * k || 0 };
  }
  /** Whether lifting the finger casts (Input.touchAim 'end'): not once the drag has put the aim away. */
  get casts() { return !this.cancelled; }
}
/** How much of a cooldown is left, 0..1, from its seconds left and the most it has had since it started. */
export class CooldownLeft {
  private peak = 0;
  of(left: number) { if (left <= 0) { this.peak = 0; return 0; } if (left > this.peak) this.peak = left; return left / this.peak; }
}

type Finger = { role: 'stick' | 'look' | TouchButton; x: number; y: number };
/** The page's own box, CSS pixels: what the HUD and these controls are laid out in (innerWidth can be wider on a phone,
 *  see handheld.css). As of the last resize (ui/viewport.ts): read every frame, clientWidth laid the page out each time. */
const page = () => [pageWidth(), pageHeight()] as const;

export class TouchControls {
  readonly root = document.createElement('div');
  /** The phone held upright in a fight: turn it (and a local fight is paused while it is). */
  private readonly turn = document.createElement('div');
  private readonly fingers = new Map<number, Finger>();
  private readonly buttons = new Map<TouchButton, HTMLElement>();
  private readonly stickNode: HTMLElement;
  private readonly knob: HTMLElement;
  private readonly wheel: HTMLElement;
  private readonly cooldowns = { light: new CooldownLeft(), heavy: new CooldownLeft(), special: new CooldownLeft(), area: new CooldownLeft() };
  /** DASH's pips: the dashes in hand (touchLayout.ts touchMeters). */
  private readonly pips: HTMLElement[];
  /** The cooling buttons' seconds. */
  private readonly numbers = new Map<TouchButton, HTMLElement>();
  private readonly art: TouchArt;
  /** When the meters were last written (METER_HZ). */
  private metersAt = -Infinity;
  /** The finger aiming from AREA, and its drag. */
  private aiming?: { id: number; drag: AreaDrag };
  private readonly aimDot: HTMLElement;
  private base: [number, number] = [0, 0];
  private forward = 0;
  private right = 0;
  private shown = false;
  private playing = false;
  private upright = false;
  private pausedForTurn = false;
  private wheelUntil = 0;
  private placedAt = 0;
  /** A phone (input/device.ts), read again when the window changes. */
  private isPhone = phone();
  /** The emote wheel's slot (shop/boot.ts, as keys 1-4 do). */
  onEmote = (_slot: number) => {};

  constructor(private readonly input: Input, parent: HTMLElement = document.body) {
    this.root.className = 'touch-controls'; this.root.hidden = true; this.root.setAttribute('aria-hidden', 'true');
    this.root.innerHTML = `<i class="tc-safe"></i><div class="tc-stick"><i class="tc-base">${STICK_RING}</i><i class="tc-knob"></i></div><i class="tc-stick-home">${STICK_RING}<i class="tc-knob"></i></i>`
      + TOUCH_BUTTONS.map(([id, label]) => buttonHtml(id, label)).join('')
      + `<div class="tc-wheel" hidden>${[1, 2, 3, 4].map(n => `<button type="button" tabindex="-1" class="tc-btn tc-slot" data-tc-slot="${n - 1}"><b>${n}</b></button>`).join('')}</div>`;
    this.stickNode = this.root.querySelector('.tc-stick')!; this.knob = this.root.querySelector('.tc-stick .tc-knob')!; this.wheel = this.root.querySelector('.tc-wheel')!;
    this.aimDot = this.root.querySelector('.tc-aim-dot')!;
    for (const [id] of TOUCH_BUTTONS) this.buttons.set(id, this.root.querySelector<HTMLElement>(`[data-tc="${id}"]`)!);
    // The fan (touchLayout.ts), placed once: handheld.css scales it (--tc-k) and keeps it inside the safe area.
    for (const [id, spot] of Object.entries(TOUCH_LAYOUT) as [ClusterButton, typeof TOUCH_LAYOUT.light][]) {
      const node = this.buttons.get(id); if (!node) continue;
      for (const [name, value] of Object.entries(spotStyle(spot))) node.style.setProperty(name, value);
    }
    this.pips = [...this.root.querySelectorAll<HTMLElement>('.tc-pips>i')];
    for (const [id, node] of this.buttons) { const number = node.querySelector<HTMLElement>('.tc-num'); if (number) this.numbers.set(id, number); }
    this.art = new TouchArt(this.root, id => this.buttons.get(id as TouchButton), this.root.querySelector<HTMLElement>('.tc-awaken .tc-face') ?? undefined);
    this.turn.className = 'tc-turn'; this.turn.setAttribute('role', 'alert');
    this.turn.innerHTML = '<div><i aria-hidden="true">⟳</i><strong>TURN YOUR PHONE</strong><span>Fights play in landscape.</span></div>';
    parent.append(this.root, this.turn);
    const size = () => { this.isPhone = phone(); this.root.classList.toggle('tc-tablet', tablet()); };
    size(); window.addEventListener('resize', size);
    const options = { capture: true, passive: false } as const;
    window.addEventListener('touchstart', event => this.start(event), options);
    window.addEventListener('touchmove', event => this.move(event), options);
    window.addEventListener('touchend', event => this.end(event), options);
    window.addEventListener('touchcancel', event => this.end(event), options);
    // Safari's pinch, and its long-press menu on the arena.
    document.addEventListener('gesturestart', event => { if (this.shown) event.preventDefault(); });
    this.root.addEventListener('contextmenu', event => event.preventDefault());
    window.addEventListener('blur', () => this.release());
  }

  /** Every frame: `playing` is whether the fight takes input now (Input.enabled), `inMatch` whether a fight is on (not a
   *  room's lobby: a friends room is read and shared upright). */
  update(playing: boolean, inMatch: boolean) {
    this.playing = playing;
    // A phone held upright in a match is asked to turn; a local fight is paused for it (the pause menu, as Escape).
    // The page's box is read only on a phone: clientWidth makes the browser style and lay the whole page out before it
    // answers, and this runs every frame - on a desktop that was a synchronous layout pass a frame for an answer that is
    // always no (measured: 3.5-4.5% of the main thread in a twelve-fighter match and in Training).
    let upright = false;
    if (inMatch && this.isPhone) { const [width, height] = page(); upright = height > width; }
    if (upright !== this.upright) { this.upright = upright; document.documentElement.classList.toggle('tc-upright', upright); if (!upright) this.pausedForTurn = false; }
    if (upright && playing && !this.pausedForTurn) { this.pausedForTurn = true; this.release(); this.input.onMenu('keyboard'); }
    const want = playing && !upright && this.input.mode === 'touch';
    if (want !== this.shown) this.show(want);
    if (!this.shown) return;
    let guard = false, jumpHeld = false;
    for (const finger of this.fingers.values()) { if (finger.role === 'guard') guard = true; else if (finger.role === 'jump') jumpHeld = true; }
    this.input.touchHold(this.forward, this.right, guard, jumpHeld);
    if (this.wheelUntil && performance.now() > this.wheelUntil) this.openWheel(false);
    // A mode's HUD mounts its pieces as the fight begins, and the plaque's text changes its width.
    if (performance.now() - this.placedAt > 500) this.placeTop();
  }
  /** PAUSE, then the emote button (its wheel under it), in the first place the HUD leaves, row by row down from the top:
   *  side by side where they fit (the top row right of the player's own plate), else PAUSE first and the emote in the
   *  next place free. Never over a plate's painted parts, the middle's plaque, Training's tools or a mode's pieces. */
  private placeTop() {
    this.placedAt = performance.now();
    const pause = this.buttons.get('pause')!, emote = this.buttons.get('emote')!, origin = this.root.getBoundingClientRect();
    // Inside the safe area (a notched phone on its side: handheld.css .tc-safe), 16 px from its sides and 10 from its top.
    const safe = this.root.querySelector<HTMLElement>('.tc-safe')?.getBoundingClientRect();
    const insetL = safe && safe.width > 0 ? Math.max(0, safe.left - origin.left) : 0, insetR = safe && safe.width > 0 ? Math.max(0, origin.right - safe.right) : 0;
    const size = pause.getBoundingClientRect().width || 44, gap = 8, top = 10 + (safe && safe.width > 0 ? Math.max(0, safe.top - origin.top) : 0), width = (origin.width || page()[0]) - insetR;
    const all = [...document.querySelectorAll<HTMLElement>(TOP_PIECES)].map(el => el.getBoundingClientRect())
      .filter(r => r.width > 0 && r.height > 0 && r.width < width * .6);
    // What stands in the row of buttons whose top is `y`, as [left, right] spans.
    const row = (y: number) => all.filter(r => r.top - origin.top < y + size + gap && r.bottom - origin.top > y - gap)
      .map(r => [r.left - origin.left - gap, r.right - origin.left + gap] as const);
    const own = [...document.querySelectorAll<HTMLElement>(OWN_PLATE)].map(el => el.getBoundingClientRect()).filter(r => r.width > 0)
      .reduce<DOMRect | undefined>((wide, r) => !wide || r.right > wide.right ? r : wide, undefined);
    const from = (y: number) => y === top && own && own.width > 0 ? own.right - origin.left + gap : 16 + insetL;
    const rows = [0, 1, 2, 3].map(i => top + i * (size + gap)), emoting = getComputedStyle(emote).display !== 'none';
    let px: number | undefined, py = top, ex: number | undefined, ey = top;
    for (const y of rows) {
      const x = firstGap(row(y), from(y), width - 16, emoting ? size * 2 + gap : size);
      if (x !== undefined) { px = x; py = y; ex = x + size + gap; ey = y; break; }
    }
    if (px === undefined) for (const y of rows) {
      const taken = px === undefined ? row(y) : [...row(y), ...(y === py ? [[px - gap, px + size + gap] as const] : [])];
      const x = firstGap(taken, from(y), width - 16, size);
      if (x === undefined) continue;
      if (px === undefined) { px = x; py = y; } else { ex = x; ey = y; break; }
    }
    // Nowhere free: under the player's own plate, at its right end.
    if (px === undefined) { px = Math.max(16 + insetL, (own ? own.right - origin.left : 16 + size) - size * 2 - gap); py = (own ? own.bottom - origin.top : top + size) + gap; }
    if (ex === undefined) { ex = px + size + gap; ey = py; }
    const set = (node: HTMLElement, left: number, at: number) => { const l = `${Math.round(left)}px`, t = `${Math.round(at)}px`; if (node.style.left !== l) node.style.left = l; if (node.style.top !== t) node.style.top = t; };
    const wheel = size * 4 + gap * 3;
    set(pause, px, py); set(emote, ex, ey); set(this.wheel, Math.max(16 + insetL, Math.min(ex, width - 16 - wheel)), ey + size + 10);
  }
  /** The meters the buttons show, from the player's own state (touchLayout.ts touchMeters): the ultimate's and the
   *  awakening's charge, the cooldowns' wipes and seconds, the dashes in hand, and the fighter's art. Called every frame;
   *  written METER_HZ times a second, each value only when it changed - custom properties and classes on the buttons
   *  themselves, never a layout read. */
  meters(self: PlayerState, serverTime: number) {
    if (!this.shown) return;
    const now = performance.now();
    if (now - this.metersAt < 1000 / METER_HZ) return;
    this.metersAt = now;
    const m = touchMeters(self, serverTime);
    this.meter('ultimate', '--charge', m.ultimate); this.flag('ultimate', 'ready', m.ultimate >= 1);
    this.meter('awaken', '--charge', m.awakening); this.flag('awaken', 'ready', !m.awake && m.awakening >= 1); this.flag('awaken', 'awake', m.awake);
    for (const slot of ['light', 'heavy', 'special', 'area'] as const) {
      const left = m.cool[slot], cooling = left > 0.05;
      this.meter(slot, '--cool', this.cooldowns[slot].of(left)); this.flag(slot, 'cooling', cooling); this.flag(slot, 'ready', !cooling && self.alive !== false);
      // LIGHT's recovery is a beat, not a wait: its wipe, no number.
      if (slot !== 'light') this.text(slot, coolSeconds(left));
    }
    for (let i = 0; i < this.pips.length; i++) { const pip = this.pips[i], on = i < m.dashes, shown = i < m.dashMax; if (pip.classList.contains('on') !== on) pip.classList.toggle('on', on); if (pip.hidden === shown) pip.hidden = !shown; }
    this.flag('dash', 'spent', m.dashes < 1);
    this.art.update(self);
  }
  private meter(id: TouchButton, name: string, value: number) { const node = this.buttons.get(id)!, text = value.toFixed(2); if (node.style.getPropertyValue(name) !== text) node.style.setProperty(name, text); }
  private flag(id: TouchButton, name: string, on: boolean) { const node = this.buttons.get(id)!; if (node.classList.contains(name) !== on) node.classList.toggle(name, on); }
  /** A cooling button's seconds (its .tc-num). */
  private text(id: TouchButton, value: string) { const node = this.numbers.get(id); if (node && node.textContent !== value) node.textContent = value; }

  private show(on: boolean) {
    this.shown = on; this.root.hidden = !on; this.placedAt = 0; this.metersAt = -Infinity;
    document.documentElement.classList.toggle('touch-play', on);
    if (!on) this.release();
  }
  /** Every finger let go: nothing held, the stick centred. */
  private release() {
    // An aim the controls let go of is put away, never cast (and Input's mode is left as it is: no touchAim here).
    if (this.aiming) { this.aiming = undefined; this.buttons.get('area')?.classList.remove('aiming', 'cancelled'); if (this.input.aim.view.source === 'touch') this.input.aim.cancel(); }
    this.fingers.clear(); this.forward = 0; this.right = 0; this.stickNode.classList.remove('on');
    for (const node of this.buttons.values()) node.classList.remove('down');
    this.input.touchHold(0, 0, false, false); this.openWheel(false);
  }
  private openWheel(open: boolean) { this.wheel.hidden = !open; this.wheelUntil = open ? performance.now() + 3000 : 0; this.buttons.get('emote')?.classList.toggle('down', open); }

  private start(event: TouchEvent) {
    // A touch anywhere says the screen is the controller now (the prompts follow it, Hud.setInputMode).
    this.input.useMode('touch');
    if (!this.playing || this.upright) return;
    if (!this.shown) this.show(true);
    let taken = false;
    for (const touch of Array.from(event.changedTouches)) {
      const target = touch.target instanceof Element ? touch.target : null;
      const slot = target?.closest<HTMLElement>('[data-tc-slot]');
      if (slot && this.root.contains(slot)) { taken = true; this.onEmote(Number(slot.dataset.tcSlot)); this.openWheel(false); continue; }
      const button = target?.closest<HTMLElement>('[data-tc]');
      if (button && this.root.contains(button)) { taken = true; this.press(touch.identifier, button.dataset.tc as TouchButton, touch); continue; }
      if (target?.closest(KEEP)) continue;
      taken = true;
      const stick = touch.clientX < page()[0] * STICK_SHARE && ![...this.fingers.values()].some(f => f.role === 'stick');
      this.fingers.set(touch.identifier, { role: stick ? 'stick' : 'look', x: touch.clientX, y: touch.clientY });
      if (stick) this.placeStick(touch.clientX, touch.clientY);
    }
    if (taken && event.cancelable) event.preventDefault();
  }
  private press(id: number, button: TouchButton, touch: Touch) {
    this.fingers.set(id, { role: button, x: touch.clientX, y: touch.clientY });
    this.buttons.get(button)?.classList.add('down');
    if (button === 'pause') { this.release(); this.input.onMenu('keyboard'); return; }
    if (button === 'emote') { this.openWheel(this.wheel.hasAttribute('hidden')); return; }
    if (button === 'guard') return;   // held: Input.touchHold
    if (button === 'area') { this.aimStart(id, touch); return; }
    this.input.touchPress(button);
  }
  private aimStart(id: number, touch: Touch) {
    if (this.aiming) return;
    const node = this.buttons.get('area')!, box = node.getBoundingClientRect(), reach = this.aimReach();
    this.aiming = { id, drag: new AreaDrag(box.left + box.width / 2, box.top + box.height / 2, box.width / 2, reach, touch.clientX, touch.clientY) };
    node.style.setProperty('--reach', `${reach}px`); this.placeDot(0, 0);
    node.classList.remove('cancelled'); node.classList.add('aiming');
    this.input.touchAim('start');
  }
  private aimMove(touch: Touch) {
    const aim = this.aiming; if (aim?.id !== touch.identifier) return;
    const step = aim.drag.move(touch.clientX, touch.clientY);
    if (step?.phase === 'move') { this.input.touchAim('move', step.right, step.forward); this.placeDot(step.right, step.forward); }
    else if (step?.phase === 'cancel') { this.input.touchAim('cancel'); const node = this.buttons.get('area')!; node.classList.remove('aiming'); node.classList.add('cancelled'); }
  }
  /** The AREA finger lifted: cast where it aimed (a tap: the aim's own start), unless it was put away; a touch the
   *  browser cancelled puts it away too. */
  private aimEnd(id: number, cancelled: boolean) {
    const aim = this.aiming; if (aim?.id !== id) return;
    this.aiming = undefined; this.buttons.get('area')!.classList.remove('aiming', 'cancelled');
    if (aim.drag.casts) this.input.touchAim(cancelled ? 'cancel' : 'end');
  }
  /** The dot on AREA's ring: where the aim sits, as a share of the reach. */
  private placeDot(right: number, forward: number) { const r = this.aimReach(); this.aimDot.style.transform = `translate(${(right * r).toFixed(1)}px,${(-forward * r).toFixed(1)}px)`; }
  private aimReach() { return AIM_RADIUS * (this.root.classList.contains('tc-tablet') ? 1.3 : 1); }
  private placeStick(x: number, y: number) {
    const r = this.reach(), margin = 10, [width, height] = page();
    // The whole base on the screen, however close to the edge the thumb landed.
    this.base = [Math.max(r + margin, Math.min(width - r - margin, x)), Math.max(r + margin, Math.min(height - r - margin, y))];
    this.stickNode.style.transform = `translate(${this.base[0]}px,${this.base[1]}px)`;
    this.stickNode.classList.add('on');
    this.moveStick(x, y);
  }
  private moveStick(x: number, y: number) {
    const r = this.reach();
    this.base = dragBase(this.base[0], this.base[1], x, y, r);
    this.stickNode.style.transform = `translate(${this.base[0]}px,${this.base[1]}px)`;
    const dx = x - this.base[0], dy = y - this.base[1];
    [this.forward, this.right] = stickVector(dx, dy, r);
    this.knob.style.transform = `translate(${dx}px,${dy}px)`;
  }
  /** The stick's reach on this screen (a tablet's controls are drawn larger: .tc-tablet). */
  private reach() { return STICK_RADIUS * (this.root.classList.contains('tc-tablet') ? 1.3 : 1); }
  private move(event: TouchEvent) {
    let taken = false;
    for (const touch of Array.from(event.changedTouches)) {
      const finger = this.fingers.get(touch.identifier);
      if (!finger) continue;
      taken = true;
      if (finger.role === 'stick') this.moveStick(touch.clientX, touch.clientY);
      else if (finger.role === 'look') this.input.touchLook(touch.clientX - finger.x, touch.clientY - finger.y);
      else if (finger.role === 'area') this.aimMove(touch);
      finger.x = touch.clientX; finger.y = touch.clientY;
    }
    if (taken && event.cancelable) event.preventDefault();
  }
  private end(event: TouchEvent) {
    let taken = false;
    for (const touch of Array.from(event.changedTouches)) {
      const finger = this.fingers.get(touch.identifier);
      if (!finger) continue;
      taken = true; this.fingers.delete(touch.identifier);
      if (finger.role === 'area') this.aimEnd(touch.identifier, event.type === 'touchcancel');
      if (finger.role === 'stick') { this.forward = 0; this.right = 0; this.stickNode.classList.remove('on'); }
      else if (finger.role !== 'look' && finger.role !== 'emote' && ![...this.fingers.values()].some(f => f.role === finger.role)) this.buttons.get(finger.role)?.classList.remove('down');
    }
    // No click after a touch the controls took (the browser's own would land on whatever is under the finger).
    if (taken && event.cancelable) event.preventDefault();
  }
}
