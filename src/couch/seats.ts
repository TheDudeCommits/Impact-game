import type { AttackSlot, PlayerInput } from '../game/types';
import { GamepadControls, type PadState, type UiAction } from '../input/gamepad';
import { getBindings, seatKeysTakeP } from '../input/bindings';

export type KeyLayout = 'full' | 'left' | 'right';
export type SeatDevice = { kind: 'keys'; layout: KeyLayout } | { kind: 'pad'; index: number };
export type SeatAction = 'forward' | 'backward' | 'left' | 'right' | 'jump' | 'dash' | 'guard' | 'target'
  | 'light' | 'heavy' | 'special' | 'ultimate' | 'area' | 'awaken';
export type SeatKeys = Record<SeatAction, readonly string[]>;

/** The keyboard's left half when two people share it: the movement keys and the left hand's row of the single player's
 *  layout, with LIGHT and HEAVY moved down to C and V (J and K are the right-hand player's). */
export const LEFT_KEYS: SeatKeys = {
  forward: ['KeyW'], backward: ['KeyS'], left: ['KeyA'], right: ['KeyD'], jump: ['Space'], dash: ['ShiftLeft'],
  guard: ['KeyF'], target: ['Tab'], light: ['KeyC'], heavy: ['KeyV'], special: ['KeyQ'], ultimate: ['KeyR'],
  area: ['KeyG'], awaken: ['KeyE'],
};
/** The keyboard's right half: the arrows to move and the right hand's home row to fight (J guard, K light, L heavy,
 *  ; special; I jump, ' dash, O ultimate, P area, [ awaken, U lock), or the numpad for those who have one. */
export const RIGHT_KEYS: SeatKeys = {
  forward: ['ArrowUp'], backward: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'],
  jump: ['KeyI', 'Numpad0'], dash: ['Quote', 'ShiftRight', 'NumpadDecimal'], guard: ['KeyJ', 'Numpad4'], target: ['KeyU', 'NumpadAdd'],
  light: ['KeyK', 'Numpad1'], heavy: ['KeyL', 'Numpad2'], special: ['Semicolon', 'Numpad3'], ultimate: ['KeyO', 'Numpad5'],
  area: ['KeyP', 'Numpad6'], awaken: ['BracketLeft', 'Numpad7'],
};
/** The whole keyboard for one seat: the player's own bindings (Settings → Controls), the arrows moving too, no mouse. */
export function fullKeys(): SeatKeys {
  const k = getBindings().keyboard, keys = (list: readonly string[]) => list.filter(code => !code.startsWith('Mouse'));
  return {
    forward: [...keys(k.forward), 'ArrowUp'], backward: [...keys(k.backward), 'ArrowDown'], left: [...keys(k.left), 'ArrowLeft'],
    right: [...keys(k.right), 'ArrowRight'], jump: keys(k.jump), dash: keys(k.dash), guard: keys(k.guard), target: keys(k.target),
    light: keys(k.light), heavy: keys(k.heavy), special: keys(k.special), ultimate: keys(k.ultimate), area: keys(k.area), awaken: keys(k.awaken),
  };
}
export const keysOf = (layout: KeyLayout): SeatKeys => layout === 'left' ? LEFT_KEYS : layout === 'right' ? RIGHT_KEYS : fullKeys();
/** The key that opens and closes a seat's own shop on a split screen (couch/CouchHud.ts): B, as the single player's is,
 *  for the left half or the whole keyboard; M, under the right half's fighting keys, for it (or the numpad's Enter). A
 *  pad's is its VIEW / SELECT button. */
export const SHOP_KEYS: Readonly<Record<KeyLayout, readonly string[]>> = { left: ['KeyB'], full: ['KeyB'], right: ['KeyM', 'NumpadEnter'] };
/** A seat's shop keys: the whole keyboard's B only while the player hasn't bound it to anything (as input.ts asks of the
 *  single player's), else M. */
export function shopKeysOf(layout: KeyLayout): readonly string[] {
  if (layout !== 'full') return SHOP_KEYS[layout];
  const bound = (code: string) => Object.values(fullKeys()).some(list => list.includes(code));
  return ['KeyB', 'KeyM'].filter(code => !bound(code)).slice(0, 1);
}
/** A key as a menu reads it while a seat's shop is open: the movement keys move its cursor, LIGHT or JUMP choose, GUARD
 *  or HEAVY go back. */
function menuOf(keys: SeatKeys, code: string): UiAction | undefined {
  const is = (action: SeatAction) => keys[action].includes(code);
  return is('forward') ? 'previous' : is('backward') ? 'next' : is('left') ? 'left' : is('right') ? 'right'
    : is('light') || is('jump') ? 'confirm' : is('guard') || is('heavy') ? 'back' : undefined;
}
/** The keys that say "this half wants the seat" on the join card: any of its fighting or moving keys. */
export function layoutOfKey(code: string): 'left' | 'right' | undefined {
  const has = (keys: SeatKeys) => Object.values(keys).some(list => list.includes(code));
  return has(LEFT_KEYS) ? 'left' : has(RIGHT_KEYS) ? 'right' : undefined;
}
/** What a seat's device is called on the join card and the fight's corner tag. */
export function deviceName(device: SeatDevice, pads?: readonly (PadState | null | undefined)[]): string {
  if (device.kind === 'pad') { const id = pads?.[device.index]?.id ?? ''; return /dualsense|dualshock|054c|playstation/i.test(id) ? `PLAYSTATION PAD ${device.index + 1}` : /xbox|045e|xinput/i.test(id) ? `XBOX PAD ${device.index + 1}` : `CONTROLLER ${device.index + 1}`; }
  return device.layout === 'left' ? 'KEYBOARD · LEFT' : device.layout === 'right' ? 'KEYBOARD · RIGHT' : 'KEYBOARD';
}
export const sameDevice = (a: SeatDevice, b: SeatDevice) => a.kind === 'pad' ? b.kind === 'pad' && a.index === b.index : b.kind === 'keys' && (a.layout === b.layout || a.layout === 'full' || b.layout === 'full');

/** How a pair of seats reads the screen: forward is away from the lens, right is the screen's right. */
export function screenMove(forward: number, right: number, viewYaw: number) {
  const magnitude = Math.max(1, Math.hypot(forward, right));
  return {
    moveX: (Math.sin(viewYaw) * forward - Math.cos(viewYaw) * right) / magnitude,
    moveZ: (Math.cos(viewYaw) * forward + Math.sin(viewYaw) * right) / magnitude,
  };
}

/** The movement keys a keyboard seat holds, as the follow camera's movement basis reads them (render/viewKeys.ts
 *  movementMask: forward 1, left 2, back 4, right 8); a pad's stick is no keys (0), and turns with the view. */
export function movementMaskOfSeat(seat: Seat, held: ReadonlySet<string>): number {
  if (seat.device.kind !== 'keys') return 0;
  const keys = keysOf(seat.device.layout), down = (action: SeatAction) => keys[action].some(code => held.has(code));
  return (down('forward') ? 1 : 0) | (down('left') ? 2 : 0) | (down('backward') ? 4 : 0) | (down('right') ? 8 : 0);
}

/** One person's seat: their device, their presses since the last tick, their own command sequence. */
export class Seat {
  private seq = 0;
  private attack?: AttackSlot;
  private jump = false;
  private dash = false;
  private awaken = false;
  private target = false;
  private padForward = 0;
  private padRight = 0;
  private padGuard = false;
  private padJumpHeld = false;
  private padHeavyHeld = false;
  /** The pad's right stick, this frame: a split screen's seat turns its own view with it (couch.ts `turn`). */
  lookX = 0;
  lookY = 0;
  private readonly pad = new GamepadControls();
  /** The menu button on this seat's pad went down: the couch pauses for everyone. */
  menu = false;
  /** Pressed anything this frame: the join card's "ready". */
  active = false;
  /** This seat's own shop is open on a split screen (couch/CouchHud.ts): its device works the shop's cursor, not the
   *  fighter (couch.ts command holds the fighter still), and its presses wait in `picks` until the HUD takes them. */
  menuOpen = false;
  readonly picks: UiAction[] = [];
  /** Its shop key went down (SHOP_KEYS, or the pad's VIEW): taken once by the HUD. */
  interact = false;
  private padView = false;
  constructor(readonly id: string, public device: SeatDevice) {}
  /** The seat moved to another device mid-fight (CouchSeats.poll's reseat): nothing it was pressing carries over. */
  use(device: SeatDevice) { this.device = device; this.clear(); this.picks.length = 0; this.interact = false; this.padView = false; }
  private keys(): SeatKeys { return this.device.kind === 'keys' ? keysOf(this.device.layout) : LEFT_KEYS; }
  /** A key went down (CouchSeats hears the keyboard once for both seats). True: it was this seat's. */
  press(code: string, repeat = false): boolean {
    if (this.device.kind !== 'keys') return false;
    const k = this.keys(), is = (action: SeatAction) => k[action].includes(code);
    if (shopKeysOf(this.device.layout).includes(code)) { if (!repeat) { if (this.menuOpen) this.picks.push('back'); else this.interact = true; } this.active = true; return true; }
    if (this.menuOpen) {
      // A held direction steps on (the key's own repeat); a choice is made once.
      const action = menuOf(k, code);
      if (action && (!repeat || action === 'previous' || action === 'next' || action === 'left' || action === 'right')) this.picks.push(action);
      this.active = true; return !!action || this.owns(code);
    }
    if (repeat) return this.owns(code);
    let mine = false;
    for (const slot of ['light', 'heavy', 'special', 'ultimate', 'area'] as const) if (is(slot)) { this.attack = slot; mine = true; }
    if (is('jump')) { this.jump = true; mine = true; }
    if (is('dash')) { this.dash = true; mine = true; }
    if (is('awaken')) { this.awaken = true; mine = true; }
    if (is('target')) { this.target = true; mine = true; }
    if (is('guard') || is('forward') || is('backward') || is('left') || is('right')) mine = true;
    if (mine) this.active = true;
    return mine;
  }
  owns(code: string) { if (this.device.kind !== 'keys') return false; const k = this.keys(); return Object.values(k).some(list => list.includes(code)) || shopKeysOf(this.device.layout).includes(code); }
  /** Reads this seat's pad, once a frame. */
  poll(pads: readonly (PadState | null | undefined)[], now: number) {
    this.menu = false;
    if (this.device.kind !== 'pad') return;
    const pad = pads[this.device.index] ?? undefined;
    const frame = this.pad.read(pad ?? undefined, !this.menuOpen, now);
    // VIEW / SELECT: the seat's shop, open or shut (read here, as a menu's pad leaves it out of its frame).
    const view = !!pad?.buttons?.[8]?.pressed, viewDown = view && !this.padView; this.padView = view;
    this.padForward = frame.forward; this.padRight = frame.right; this.padGuard = frame.guard; this.padJumpHeld = frame.jumpHeld; this.padHeavyHeld = !!frame.heavyHeld;
    this.lookX = frame.lookX; this.lookY = frame.lookY;
    if (this.menuOpen) { this.picks.push(...frame.ui); if (viewDown) this.picks.push('back'); this.picks.splice(0, Math.max(0, this.picks.length - 8)); this.menu = frame.menu; if (frame.active) this.active = true; return; }
    if (viewDown) this.interact = true;
    if (frame.attack) this.attack = frame.attack;
    // The area slot on a pad is aimed while held (Input.update); a seat casts it as it goes down, at whoever is held.
    if (frame.area === 'press') this.attack = 'area';
    this.jump ||= frame.jump; this.dash ||= frame.dash; this.awaken ||= frame.awaken; this.target ||= frame.target;
    this.menu = frame.menu; if (frame.active) this.active = true;
  }
  /** Whether the seat asked to cycle its lock this tick (taken once). */
  takeTarget() { const t = this.target; this.target = false; return t; }
  clear() { this.attack = undefined; this.jump = this.dash = this.awaken = this.target = false; this.padForward = this.padRight = this.lookX = this.lookY = 0; this.padGuard = this.padJumpHeld = this.padHeavyHeld = false; this.pad.reset(); }
  /** This tick's command: movement against the couch camera's heading, the aim at the seat's opponent. */
  command(held: ReadonlySet<string>, viewYaw: number, aimYaw: number, targetId: string | null): PlayerInput {
    const k = this.keys(), down = (action: SeatAction) => this.device.kind === 'keys' && k[action].some(code => held.has(code));
    const forward = Number(down('forward')) - Number(down('backward')) + this.padForward;
    const right = Number(down('right')) - Number(down('left')) + this.padRight;
    const { moveX, moveZ } = screenMove(forward, right, viewYaw);
    const command: PlayerInput = { seq: ++this.seq, moveX, moveZ, yaw: aimYaw, guard: down('guard') || this.padGuard, targetId, lock: !!targetId };
    if (this.attack) command.attack = this.attack;
    if (this.jump) command.jump = true;
    if (down('jump') || this.padJumpHeld) command.jumpHeld = true;
    // (The heavy held: the ball modes' SHOOT is charged by holding it - PlayerInput.heavyHeld.)
    if (down('heavy') || this.padHeavyHeld) command.heavyHeld = true;
    if (this.dash) command.dash = true;
    if (this.awaken) command.awaken = true;
    this.attack = undefined; this.jump = this.dash = this.awaken = false;
    return command;
  }
}

/** The connected pads a seat can play on (a standard mapping), by index. */
export function seatablePads(pads: readonly (PadState | null | undefined)[]): number[] {
  return pads.filter((p): p is PadState => !!p?.connected && p.mapping === 'standard').map(p => p.index);
}
/** The keyboard shared out again: two seats on it split it (Player 1 the left half, Player 2 the right), one has it whole. */
function shareKeyboard(devices: SeatDevice[]): SeatDevice[] {
  const keys = devices.filter((d): d is Extract<SeatDevice, { kind: 'keys' }> => d.kind === 'keys');
  // Both already on a half each (SWAP P1 / P2 can give Player 1 the right one): kept.
  if (keys.length === 2 && keys[0].layout !== 'full' && keys[1].layout !== 'full' && keys[0].layout !== keys[1].layout) return devices;
  return devices.map((d, i) => d.kind === 'keys' ? { kind: 'keys', layout: keys.length > 1 ? (i === 0 ? 'left' : 'right') : 'full' } : d);
}
export function reseat(devices: readonly SeatDevice[], pads: readonly number[]): readonly SeatDevice[] {
  let next = devices.map(d => d.kind === 'pad' && !pads.includes(d.index) ? { kind: 'keys', layout: 'full' } as SeatDevice : d);
  const free = [...pads].sort((a, b) => a - b).filter(index => !next.some(d => d.kind === 'pad' && d.index === index));
  // Two pads at once for two people on the keyboard: in order, as a start seats them (suggestSeats).
  if (free.length >= 2 && next.length === 2 && next.every(d => d.kind === 'keys')) next = [{ kind: 'pad', index: free[0] }, { kind: 'pad', index: free[1] }];
  else for (const index of free) {
    const seat = next[1]?.kind === 'keys' ? 1 : next[0]?.kind === 'keys' ? 0 : -1;
    if (seat < 0) break;
    next = next.map((d, i) => i === seat ? { kind: 'pad', index } : d);
  }
  next = shareKeyboard(next);
  return next.every((d, i) => sameSeat(d, devices[i])) ? devices : next;
}
/** A seated pad missing from the browser's list for less than this long (milliseconds) still holds its seat: a wireless
 *  pad can drop out of the list for a moment, and a hiccup must not cost its player the seat (or swap the two players'
 *  devices as it comes back). */
export const UNPLUG_GRACE = 800;
/** The pads to seat against (reseat's `pads`): those connected now, and a seated one gone for less than UNPLUG_GRACE. */
export class PadPresence {
  private readonly missing = new Map<number, number>();
  present(connected: readonly number[], devices: readonly SeatDevice[], now: number): number[] {
    const out = [...connected], seated = devices.flatMap(d => d.kind === 'pad' ? [d.index] : []);
    for (const index of seated) {
      if (connected.includes(index)) { this.missing.delete(index); continue; }
      const since = this.missing.get(index) ?? now;
      this.missing.set(index, since);
      if (now - since < UNPLUG_GRACE) out.push(index);
    }
    for (const index of [...this.missing.keys()]) if (!seated.includes(index)) this.missing.delete(index);
    return out.sort((a, b) => a - b);
  }
}
const sameSeat = (a: SeatDevice, b: SeatDevice | undefined) => !!b && (a.kind === 'pad' ? b.kind === 'pad' && a.index === b.index : b.kind === 'keys' && a.layout === b.layout);
/** One seat's move to another device (CouchSeats.onReseat). */
export interface Reseat { seat: number; device: SeatDevice }

/** The two seats and the keyboard they share. `attach` while a couch fight (or its join card) is up; `detach` after. */
export class CouchSeats {
  readonly held = new Set<string>();
  readonly seats: Seat[] = [];
  private attached = false;
  /** Any key that is a seat's: the join card's "this half wants in". */
  onKey = (_code: string) => {};
  /** Seats moved to another device mid-fight (a pad came or went): couch.ts says so in each player's half. */
  onReseat = (_moves: readonly Reseat[], _pads: readonly (PadState | null | undefined)[]) => {};
  private readonly presence = new PadPresence();
  private readonly down = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement | null)?.matches?.('input,select,textarea')) return;
    const seat = this.seats.find(s => s.owns(e.code));
    if (seat || layoutOfKey(e.code)) { if (e.code !== 'Escape') e.preventDefault(); }
    this.onKey(e.code);
    if (!seat) return;
    this.held.add(e.code);
    seat.press(e.code, e.repeat);
  };
  private readonly up = (e: KeyboardEvent) => { this.held.delete(e.code); };
  private readonly blur = () => { this.held.clear(); for (const seat of this.seats) seat.clear(); };
  attach() {
    if (this.attached || typeof window !== 'object') return;
    this.attached = true;
    // Capture: the main Input's own listeners (input.ts) run after, and see the key as the single player's - which it
    // ignores while its fighting half is off.
    window.addEventListener('keydown', this.down, { capture: true });
    window.addEventListener('keyup', this.up, { capture: true });
    window.addEventListener('blur', this.blur);
    // P is the right half's AREA: while a seat's keys take it, the keyboard pauses with Esc (bindings.ts pauseKey).
    seatKeysTakeP(() => this.seats.some(seat => seat.owns('KeyP')));
  }
  detach() {
    if (!this.attached) return;
    this.attached = false;
    window.removeEventListener('keydown', this.down, { capture: true });
    window.removeEventListener('keyup', this.up, { capture: true });
    seatKeysTakeP(() => false);
    window.removeEventListener('blur', this.blur);
    this.held.clear(); for (const seat of this.seats) seat.clear();
  }
  get on() { return this.attached; }
  /** Seats for these devices, in order (P1, P2), under the ids their fighters have in the mode (`ids`: Player 1's is the
   *  page's own id there - 'you', or an operation's 'local-defender'). Two keyboard seats split the keyboard; one keeps
   *  it whole. */
  seat(devices: readonly SeatDevice[], ids: readonly string[] = ['you', 'p2']) {
    const keyboards = devices.filter(d => d.kind === 'keys').length;
    this.seats.length = 0;
    devices.forEach((device, i) => {
      const placed: SeatDevice = device.kind === 'keys' ? { kind: 'keys', layout: keyboards > 1 ? (device.layout === 'full' ? (i === 0 ? 'left' : 'right') : device.layout) : 'full' } : device;
      this.seats.push(new Seat(ids[i] ?? `p${i + 1}`, placed));
    });
  }
  pads(): readonly (PadState | null | undefined)[] {
    return typeof navigator === 'object' && typeof navigator.getGamepads === 'function' ? Array.from(navigator.getGamepads()) as unknown as PadState[] : [];
  }
  /** Once a frame: a pad that came or went moves the seats (reseat), then every pad seat reads its pad. True: a seat's pad
   *  asked for the pause menu. */
  poll(now = performance.now()) {
    const pads = this.pads();
    // (A hidden page's pads are not to be trusted: the browser may list none.)
    if (this.seats.length && !(typeof document === 'object' && document.hidden)) {
      const devices = this.seats.map(seat => seat.device), next = reseat(devices, this.presence.present(seatablePads(pads), devices, now));
      if (next !== devices) {
        const moves: Reseat[] = [];
        next.forEach((device, i) => { if (!sameSeat(device, devices[i])) { this.seats[i].use(device); moves.push({ seat: i, device }); } });
        // A key held as the keyboard changed hands is let go: the new owner presses it afresh.
        this.held.clear();
        this.onReseat(moves, pads);
      }
    }
    let menu = false;
    for (const seat of this.seats) { seat.poll(pads, now); menu ||= seat.menu; }
    return menu;
  }
}

/** The seats a couch start suggests, before anyone presses anything: controllers first (the first two connected), then
 *  the keyboard. With no controller, the keyboard's two halves; with one, the keyboard for P1 and the pad for P2 - unless
 *  P1 drove the menus with that pad, in which case it is theirs and the keyboard is P2's. */
export function suggestSeats(pads: readonly (PadState | null | undefined)[], firstOnPad: boolean): SeatDevice[] {
  const standard = pads.filter((p): p is PadState => !!p?.connected && p.mapping === 'standard').map(p => p.index);
  if (standard.length >= 2) return [{ kind: 'pad', index: standard[0] }, { kind: 'pad', index: standard[1] }];
  if (standard.length === 1) return firstOnPad ? [{ kind: 'pad', index: standard[0] }, { kind: 'keys', layout: 'full' }] : [{ kind: 'keys', layout: 'full' }, { kind: 'pad', index: standard[0] }];
  return [{ kind: 'keys', layout: 'left' }, { kind: 'keys', layout: 'right' }];
}
