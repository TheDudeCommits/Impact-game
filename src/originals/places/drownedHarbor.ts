/** THE DROWNED HARBOR (`rift-harbor`, Arcade Survival): its lighthouse with no lamp room. The tower on its rock
 *  (src/render/rift/RiftStage.ts, prop-lighthouse.glb) ends at its gallery (no glass, mullions or cap on the model; the file
 *  keeps its name), and the light that calls the dead ships in is fire: a stone drum on the gallery's deck, the Rift's
 *  great iron fire basket on it (burningVillage.ts basket(), the watchtower's), its fire at 41 m (size 3.4), the harbour's
 *  landmark light. One hooked call in RiftStage.ts. */
import type { Sculpt } from '../../render/rift/sculpt';
import type { FireSpot } from '../../render/rift/fire';
import { basket } from './burningVillage';

/** prop-lighthouse.glb as RiftStage fits it: 50 m over its 49.391 units, from its rock's foot. */
const SCALE = 50 / 49.391, FOOT = -2.391;
/** The tower now, its lamp room off (the model 39.95 units tall to its gallery's rail, over its rock's foot), at the same scale. */
export const BEACON_TOWER_H = (39.95 - FOOT) * SCALE;
/** The gallery's deck (the shaft's top, 38.6 units) over the tower's base, which RiftStage sets at y -2.4. */
export const BEACON_DECK = -2.4 + (38.6 - FOOT) * SCALE;

/** The beacon on the gallery at (x, z): the drum, the basket, and the fire where the lamp burned. */
export function harborBeacon(k: Sculpt, fires: FireSpot[], x: number, z: number) {
  k.use('stone', 0x4a4844, .05).cylinder(x, BEACON_DECK, z, 2.1, .8, 12);
  basket(k, [], x, BEACON_DECK + .8, z, 2.6, 0, 0);
  fires.push({ x, y: 41, z, size: 3.4, smoke: .3, seed: 4 });
}
