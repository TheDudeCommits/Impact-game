import {SHOOT} from '../../game/ball/model';
import type {MoveDefinition} from '../../game/moves';
import type {PlayerState} from '../../game/types';

/** The charge you can see: the page's own fighter's swing as the page simulates it, for
 *  what is drawn of the page's own SHOOT - the aim line (aimLine.ts), the charge readout (ui/hud/BallHud.ts), the shot
 *  button's ring (input/touch.ts) and the quick strike's take (ballMoves.ts). main.ts hands it over once: online the
 *  prediction's own fighter (game/prediction.ts `local`) and its clock; offline the match in this browser's, read at
 *  the time the frame is drawn (the match runs up to four ticks ahead of it). Online the room's word on the swing is a
 *  round trip and the display delay old: read from the snapshot, a charge began filling as the ball was already on its
 *  way, and the quick strike was drawn as the fighter's own heavy until the room said 'tap'. Nothing here decides
 *  anything: the room strikes the ball. */
export interface OwnSwing {
  state: PlayerState;
  input: {yaw: number; moveX: number; moveZ: number};
  /** The aim and the stick the blow will be struck with (the kernel keeps them the held command's while SHOOT winds up:
   *  simulation.ts `heldPress`). */
  attackYaw?: number; attackMoveX?: number; attackMoveZ?: number;
  cast: {start: number; nextContact: number; airborne: boolean; sport?: 'tap' | 'charge'; letGo?: number; move: MoveDefinition} | null;
}
/** `read`: the swing; `clock`: the time (the room's clock) the page's own fighter is drawn at; `drawn`: whether that
 *  fighter is drawn from `read`'s state (online: the prediction's) rather than from the snapshot. */
export const ownShot: {read: () => OwnSwing | undefined; clock: () => number; drawn: () => boolean} = {read: () => undefined, clock: () => NaN, drawn: () => false};

/** The page's own SHOOT while it is wound up as a CHARGED shot (simulation.ts SportFeel.strike: the key still down at
 *  the split), until its blow, at the time drawn: how far it is charged (0-1, the share of the wind-up from the press
 *  the key has stayed down), the seconds left to the blow (it lands when the fighter's own heavy always did, whenever
 *  the key comes up), and whether the key is up already (the charge stops there). Undefined otherwise - a tap, no
 *  swing, the blow struck. */
export interface OwnCharge {charge: number; left: number; letGo: boolean; swing: OwnSwing}
/** Whether a charge is full as it shows: all of it, or the key still down in the last two frames before the blow (the
 *  share reaches 1 only on the blow's own tick, which the frames drawn at 60 Hz step over as often as not). */
export const chargeFull = (c: Pick<OwnCharge, 'charge' | 'left' | 'letGo'>) => c.charge >= .999 || (!c.letGo && c.left <= FULL_LEFT);
const FULL_LEFT = 1 / 30;
export function ownCharge(id?: string): OwnCharge | undefined {
  const a = ownShot.read(), c = a?.cast, now = ownShot.clock();
  if (!a || !c || c.sport !== 'charge' || (id !== undefined && a.state.id !== id) || !Number.isFinite(now)) return undefined;
  // (On the cast's own clock, from the press: kernel `SportStrike` - the split at SHOOT.hold, the blow at the move's.)
  // (Its blow struck: where the body is drawn from this swing the cast says so; offline, drawn behind the match, by the
  // clock drawn - the match strikes on the tick after its clock reaches the blow.)
  const since = now - c.start, blow = c.move.contacts[0] ?? 0;
  if (since < SHOOT.hold - 1e-6 || (ownShot.drawn() ? c.nextContact > 0 : since > blow + .5 / 60)) return undefined;
  const held = c.letGo !== undefined ? Math.min(c.letGo, since) : since;
  return {charge: Math.max(0, Math.min(1, held / Math.max(.05, blow))), left: Math.max(0, blow - since), letGo: c.letGo !== undefined && c.letGo <= since, swing: a};
}
/** What the page's own body is swinging, as the page simulates it: 'tap', 'charge' or undefined (nothing of SHOOT's),
 *  for the swing whose input edge is `seq` (PlayerState.actionSeq) - or undefined where that body is not drawn from it
 *  (offline the drawn body is the snapshot's, its own word; any other body). */
export function ownStrike(id: string, seq: number | undefined): 'tap' | 'charge' | undefined {
  const a = ownShot.read();
  if (!a || !ownShot.drawn() || a.state.id !== id || a.state.action !== 'heavy' || seq === undefined || a.state.actionSeq !== seq) return undefined;
  return a.state.strike;
}

// (A check on this machine reads it: `__ownShot()`, the page's own charge as the readout and the aim line see it.)
if (typeof window === 'object' && typeof location === 'object' && ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname))
  (window as unknown as {__ownShot: () => unknown}).__ownShot = () => { const c = ownCharge(); return c && {charge: c.charge, left: +c.left.toFixed(3), letGo: c.letGo}; };
