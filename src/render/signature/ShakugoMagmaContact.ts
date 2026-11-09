/** What the engine asks of ShakugoMagma.ts outside its effect layer (where a blow
 *  lands, engine/client/sockets.ts; whose fighter it is, render/CombatEffects.ts), moved out of it unchanged, so that the layer is
 *  fetched only with a room that has the fighter (CombatEffects' lazy layers). ShakugoMagma.ts re-exports it. */
import * as THREE from 'three';
import { shakugoArmVariants } from '../../game/fighters/shakugo';
import type { Fighter } from '../Fighter';
export const isShakugoMagma = (id: string | undefined) => id === 'shakugo';
export type Side = 'Left' | 'Right';
type Sockets = { model: THREE.Object3D | undefined; Left?: THREE.Object3D; Right?: THREE.Object3D; LeftFore?: THREE.Object3D; RightFore?: THREE.Object3D };
const sockets = new WeakMap<Fighter, Sockets>();
export function rigSockets(fighter: Fighter) {
  let found = sockets.get(fighter);
  if (!found || found.model !== fighter.model) {
    found = { model: fighter.model, Left: fighter.model?.getObjectByName('LArm_Upper_Palm_Magma_041'), Right: fighter.model?.getObjectByName('RArm_Upper_Palm_Magma_054'),
      LeftFore: fighter.model?.getObjectByName('LArm_Upper_Fore_Magma_038'), RightFore: fighter.model?.getObjectByName('RArm_Upper_Fore_Magma_051') };
    sockets.set(fighter, found);
  }
  return found;
}
export function normalVolleyHands(fighter: Fighter): boolean {
  const s = fighter.state;
  return s.action === 'ultimate' && shakugoArmVariants(s.action, s.actionTime * s.actionDuration, s.awakened)[0] === 'Normal';
}
/** Magma uses its articulated native arm chain, which can extend beyond the
 * ordinary hand. The source hound and plain jab are left-handed. */
export function shakugoMagmaSocket(fighter: Fighter, side: Side, out: THREE.Vector3): THREE.Vector3 {
  // Native skill_b stretches the hidden magma chain upward. Its projectiles
  // must leave the visible ordinary hands during the released-volley segment.
  const normal = fighter.joints?.get(side === 'Left' ? 'LeftHand' : 'RightHand');
  const node = normalVolleyHands(fighter) ? normal : rigSockets(fighter)[side] ?? normal;
  return node ? node.getWorldPosition(out) : out.copy(side === 'Left' ? fighter.handL : fighter.handR);
}
/** Root should pass the actual clip when available. The named native backfist,
 * uppercut and Rush 2 use the right magma chain, not the left jab chain. */
export function shakugoMagmaContact(fighter: Fighter, out: THREE.Vector3, clip?: string): boolean {
  if (!isShakugoMagma(fighter.state.fighter)) return false;
  const s = fighter.state;
  const right = clip === 'Rush 2' || clip === 'Cinder Backfist' || clip === 'Fissure Uppercut' ||
    s.branch === 'lh' || s.branch === 'llh' || s.action === 'light' && s.chain === 2;
  shakugoMagmaSocket(fighter, right ? 'Right' : 'Left', out); return true;
}
