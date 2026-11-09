/** What the engine asks of BunaOni.ts outside its effect layer (where a blow
 *  lands: engine/client/sockets.ts, render/Fighter.ts, render/AreaTelegraph.ts), moved out of it unchanged, so that the layer is
 *  fetched only with a room that has the fighter (RosterSignatureSet's lazy factories). BunaOni.ts re-exports it. */
import * as THREE from 'three';
import type { Fighter } from '../Fighter';
/** The native counter changes hands. Resolve the actual animated prop rather
 * than assuming its point stays fixed relative to RightHand throughout. */
export const mastBreakerPoints = new WeakMap<Fighter, { bone: THREE.Object3D; local: THREE.Vector3 }>();
export function bunaMastBreakerPoint(fighter: Fighter, out: THREE.Vector3): THREE.Vector3 {
  let held = mastBreakerPoints.get(fighter);
  if (!held) {
    const bone = fighter.model?.getObjectByName('weapon_club_R');
    const mesh = fighter.model?.getObjectByName('weapon_buna_right_hand') as THREE.SkinnedMesh | undefined;
    if (!bone || !mesh?.isSkinnedMesh) return out.copy(fighter.handR);
    const inverse = new THREE.Matrix4().copy(bone.matrixWorld).invert(), point = new THREE.Vector3(), local = new THREE.Vector3();
    let longest = -1;
    for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
      mesh.getVertexPosition(i, point).applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse);
      const length = point.lengthSq(); if (length > longest) { longest = length; local.copy(point); }
    }
    held = { bone, local }; mastBreakerPoints.set(fighter, held);
  }
  return out.copy(held.local).applyMatrix4(held.bone.matrixWorld);
}
