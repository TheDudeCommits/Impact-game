/** What the engine asks of WataameSilverSoul.ts outside its effect layer (where a blow
 *  lands: engine/client/sockets.ts, render/Fighter.ts, render/AreaTelegraph.ts), moved out of it unchanged, so that the layer is
 *  fetched only with a room that has the fighter (RosterSignatureSet's lazy factories). WataameSilverSoul.ts re-exports it. */
import * as THREE from 'three';
import type { Fighter } from '../Fighter';
const TIP = new THREE.Vector3(0.8921814254969536, 0.07761142948204301, 0.36734193544408766), ROOT = new THREE.Vector3(0.08432913028509417, 0.0845028866437481, 0.04410362272019319);
/** Points measured from the exported wooden sword in the actual hand's frame (13 October 2026: the sword was turned end for end in
 *  the fist, scripts/night/ol1/wataame_bokken.py, which prints these two; the blade leaves the hand past the thumb now). */
export function wataameBokkenPoint(f: Pick<Fighter, 'joints'>, out: THREE.Vector3, tip = true): boolean {
  const hand = f.joints.get('RightHand'); if (!hand) return false;
  out.copy(tip ? TIP : ROOT).applyMatrix4(hand.matrixWorld); return true;
}
