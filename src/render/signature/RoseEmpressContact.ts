/** What the engine asks of RoseEmpress.ts outside its effect layer (where a blow
 *  lands, engine/client/sockets.ts; whose fighter it is, render/CombatEffects.ts), moved out of it unchanged, so that the layer is
 *  fetched only with a room that has the fighter (CombatEffects' lazy layers). RoseEmpress.ts re-exports it. */
import * as THREE from 'three';
import type { Fighter } from '../Fighter';
export const isRoseEmpress = (id: string | undefined) => id === 'basilissa';
const handOrigin = new THREE.Vector3(), forearmOrigin = new THREE.Vector3();
/** The source rig has an open palm but no finger joints. Continue the actual
 * wrist/forearm direction by 10 cm instead of charging at the actor's centre.
 * CombatEffects' flight origin and this layer must use this same attachment. */
export function roseFingertip(fighter: Fighter, out: THREE.Vector3): THREE.Vector3 {
  const hand = fighter.joints?.get('RightHand');
  if (hand?.parent) {
    hand.getWorldPosition(handOrigin); hand.parent.getWorldPosition(forearmOrigin);
    out.copy(handOrigin).sub(forearmOrigin);
    if (out.lengthSq() > 1e-8) return out.normalize().multiplyScalar(.10).add(handOrigin);
    return out.copy(handOrigin);
  }
  return out.copy(fighter.handR);
}
/** Source skill_a uses the left heel for all three sweeps; skill_b's descending
 * finisher uses the right. The native source does not alternate kicking feet.
 * The air string's last take must be Crown Heel Drop, as in the handoff. */
export function roseHeelContact(fighter: Fighter, index: number, out: THREE.Vector3): boolean {
  if (!isRoseEmpress(fighter.state.fighter)) return false;
  const s = fighter.state;
  const drop = s.branch === 'lllh' || s.branch === 'airSpecial' ||
    s.action === 'ultimate' && index > 0 || s.action === 'light' && (s.chain ?? 0) >= (s.grounded ? 3 : 2);
  const foot = fighter.joints?.get(drop ? 'RightFoot' : 'LeftFoot');
  if (!foot) return false;
  foot.getWorldPosition(out); return true;
}
