/** What the engine asks of WataameSilverSoul.ts outside its effect layer (where a blow
 *  lands: engine/client/sockets.ts, render/Fighter.ts, render/AreaTelegraph.ts), moved out of it unchanged, so that the layer is
 *  fetched only with a room that has the fighter (RosterSignatureSet's lazy factories). WataameSilverSoul.ts re-exports it. */
import * as THREE from 'three';
import type { Fighter } from '../Fighter';
const TIP = new THREE.Vector3(0.654, 0.549, 0.025), ROOT = new THREE.Vector3(0.050, 0.121, 0.029);
/** Points measured from the exported wooden sword in the actual hand's frame: the bokken's tip and its guard, measured
 *  off the bokken as it is drawn now: seated under the guard in a closed fist, one mount in every clip of wataame-tr1.glb.
 *  Points taken at the bokken's rest mount lay 41 degrees off the drawn blade, and the hit landed 62 cm off its tip. */
export function wataameBokkenPoint(f: Pick<Fighter, 'joints'>, out: THREE.Vector3, tip = true): boolean {
  const hand = f.joints.get('RightHand'); if (!hand) return false;
  out.copy(tip ? TIP : ROOT).applyMatrix4(hand.matrixWorld); return true;
}
