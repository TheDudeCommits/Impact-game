/** What the engine asks of KuzuChainsaw.ts outside its effect layer (where a blow
 *  lands, engine/client/sockets.ts; whose fighter it is, render/CombatEffects.ts), moved out of it unchanged, so that the layer is
 *  fetched only with a room that has the fighter (CombatEffects' lazy layers). KuzuChainsaw.ts re-exports it. */
import * as THREE from 'three';
import type { Fighter } from '../Fighter';
export const isKuzuChainsaw = (id: string | undefined) => id === 'kuzu';
export type Blade = 'left' | 'right' | 'head';
export const BLADES:readonly Blade[]=['left','right','head'];
/** Measured in each actual saw joint's bind frame. The uploaded skin has no
 * source animations; the authored clips preserve these attached blades. */
const BLADE = {
  left: { joint: 'LeftHand_Chainsaw', root: [0,.014,-.018], tip: [.418,.014,-.018] },
  right: { joint: 'RightHand_Chainsaw', root: [0,.014,-.018], tip: [-.418,.014,-.018] },
  head: { joint: 'Head_Chainsaw', root: [0,0,.075], tip: [0,0,.448] },
} as const;
const sockets = new WeakMap<Fighter, Partial<Record<Blade, THREE.Object3D>>>();
export function kuzuBladeFrame(f: Fighter, blade: Blade, root: THREE.Vector3, tip: THREE.Vector3): boolean {
  let cached = sockets.get(f);
  if (!cached) { cached = {}; for (const key of BLADES) cached[key] = f.model?.getObjectByName(BLADE[key].joint); sockets.set(f,cached); }
  const bone = cached[blade]; if (!bone) return false;
  root.fromArray(BLADE[blade].root).applyMatrix4(bone.matrixWorld);
  tip.fromArray(BLADE[blade].tip).applyMatrix4(bone.matrixWorld); return true;
}
const scratchRoot = new THREE.Vector3();
export function kuzuSawContact(f: Fighter, index: number, out: THREE.Vector3, clip = ''): boolean {
  if (!isKuzuChainsaw(f.state.fighter)) return false;
  const blade: Blade = f.state.action === 'ultimate' && !f.state.branch && index >= 3 ? 'head' :
    (f.state.action === 'ultimate' && index === 1 || clip === 'Saw Reverse Quill' || clip === 'Rush 1') ? 'left' : 'right';
  return kuzuBladeFrame(f,blade,scratchRoot,out);
}
