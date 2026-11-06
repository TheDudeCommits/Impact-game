import * as THREE from 'three';
import type { Fighter } from '../Fighter';

/** Where a fighter's body actually is, for effects that wrap it.
 *
 *  The group's position is the simulation's, and a clip with root motion or
 *  a replacement form can draw the body a metre away from it: measured, the
 *  NIGHTFALL form stands 1.1 m behind its group through the whole ultimate, so
 *  pressure placed round the group burned in the empty air between Nigo and
 *  his target. This finds the hips of whichever skeleton under the group is
 *  drawn - the fighter's own or the form's - and reads it. The bones are
 *  gathered once per fighter (again if none of them is visible, which is how
 *  a form attached later is picked up); the walk is a loop, no allocation. */
const HIPS = /^(mixamorig:?)?hips$|^(def)?pelvis$|^bip0?1[ _]pelvis$/i;
const bones = new WeakMap<Fighter, THREE.Bone[]>();
/** Calls since each fighter's bones were last gathered: a rig with no hips
 *  is walked again at most once a second, not every frame. */
const since = new WeakMap<Fighter, number>();
const shown = (o: THREE.Object3D) => { for (let p: THREE.Object3D | null = o; p; p = p.parent) if (!p.visible) return false; return true; };
function gather(f: Fighter) {
  const found: THREE.Bone[] = [];
  f.group.traverse(o => { if ((o as THREE.Bone).isBone && HIPS.test(o.name)) found.push(o as THREE.Bone); });
  bones.set(f, found); since.set(f, 0); return found;
}
export function bodyCenter(f: Fighter, out: THREE.Vector3) {
  let list = bones.get(f) ?? gather(f);
  for (let pass = 0; pass < 2; pass++) {
    for (const bone of list) if (shown(bone)) return bone.getWorldPosition(out);
    const calls = (since.get(f) ?? 0) + 1; since.set(f, calls);
    if (pass > 0 || calls < 60) break;
    list = gather(f);
  }
  return out.copy(f.group.position).setY(f.group.position.y + 1);
}
