import type { Fighter } from '../Fighter';
import { SIGNATURE } from './context';


/** A standing body's feet over the collision floor (the character controller's skin, game/rapierCollision.ts): what a
 *  mark laid at a standing body was always laid at, kept so that nothing moves on a level floor. */
const STAND = .01;
// The last answers, kept a second: a pool that lies still asks the room once a second, not sixty times.
const KEPT = 32, kx = new Float32Array(KEPT), ky = new Float32Array(KEPT), kz = new Float32Array(KEPT), kf = new Float32Array(KEPT), kt = new Float64Array(KEPT).fill(-Infinity);
let cursor = 0;

/** The room's floor under (x, z) near the height `y`, as a body standing on it has its feet; undefined where the room
 *  cannot say (no room loaded, a test, no floor in reach of `y`: main.ts looks from half a metre over it to six under). */
export function floorProbe(x: number, y: number, z: number): number | undefined {
  const ask = SIGNATURE.floor;
  if (!ask || !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return undefined;
  const now = performance.now();
  for (let i = 0; i < KEPT; i++) if (now - kt[i] < 1000 && Math.abs(kx[i] - x) < .02 && Math.abs(kz[i] - z) < .02 && Math.abs(ky[i] - y) < .02) return kf[i];
  const found = ask(x, y, z);
  if (found === undefined || !Number.isFinite(found)) return undefined;
  const i = cursor++ % KEPT; kx[i] = x; ky[i] = y; kz[i] = z; kf[i] = found + STAND; kt[i] = now;
  return kf[i];
}

/** `y` put right: the room's floor under the point where the room can say, else `y` as it was handed. */
export function floorUnder(x: number, y: number, z: number): number { return floorProbe(x, y, z) ?? y; }

/** The floor under a blow that has landed, for a module that lays marks of its own: the room's, under the struck body
 *  (else its thrower). Where the room cannot say: where a body that is standing stands, the struck one first, then its
 *  thrower; with both in the air, the lower of the two. */
export function blowFloor(actor: Fighter | undefined, target: Fighter | undefined, fallback: number): number {
  const believed = target && target.state.grounded !== false ? target.group.position.y
    : actor && actor.state.grounded !== false ? actor.group.position.y
    : Math.min(actor?.group.position.y ?? fallback, target?.group.position.y ?? fallback);
  const under = (target ?? actor)?.group.position;
  return under ? floorUnder(under.x, believed, under.z) : believed;
}
