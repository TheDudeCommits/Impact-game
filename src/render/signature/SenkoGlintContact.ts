/** What the engine asks of SenkoGlint.ts outside its effect layer (where a blow
 *  lands: engine/client/sockets.ts, render/Fighter.ts, render/AreaTelegraph.ts), moved out of it unchanged, so that the layer is
 *  fetched only with a room that has the fighter (RosterSignatureSet's lazy factories). SenkoGlint.ts re-exports it. */
import * as THREE from 'three';
import type { Fighter } from '../Fighter';
/** The point hand is a native rigid skinned mesh. Cache its fingertip vertex,
 * then sample that vertex after animation; the effect must leave the finger,
 * not a guessed offset in the fighter's forward direction. */
const fingerTips = new WeakMap<Fighter, { mesh: THREE.SkinnedMesh; vertex: number }>();
export function senkoFingerPoint(fighter: Fighter, out: THREE.Vector3): THREE.Vector3 {
  let tip = fingerTips.get(fighter);
  if (!tip) {
    const mesh = fighter.model?.getObjectByName('Senko_Hand_Right_Point') as THREE.SkinnedMesh | undefined;
    const hand = fighter.joints?.get('RightHand');
    if (!mesh?.isSkinnedMesh || !hand) return out.copy(fighter.handR);
    const wrist = hand.getWorldPosition(new THREE.Vector3()), sample = new THREE.Vector3();
    let vertex = 0, farthest = -1;
    for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
      mesh.getVertexPosition(i, sample).applyMatrix4(mesh.matrixWorld);
      const distance = sample.distanceToSquared(wrist);
      if (distance > farthest) { farthest = distance; vertex = i; }
    }
    tip = { mesh, vertex }; fingerTips.set(fighter, tip);
  }
  return tip.mesh.getVertexPosition(tip.vertex, out).applyMatrix4(tip.mesh.matrixWorld);
}
