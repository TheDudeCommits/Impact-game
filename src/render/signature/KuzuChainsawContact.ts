/** What the engine asks of KuzuChainsaw.ts outside its effect layer (where a blow
 *  lands, engine/client/sockets.ts; whose fighter it is, render/CombatEffects.ts), moved out of it unchanged, so that the layer is
 *  fetched only with a room that has the fighter (CombatEffects' lazy layers). KuzuChainsaw.ts re-exports it. */
import * as THREE from 'three';
import type { Fighter } from '../Fighter';
export const isKuzuChainsaw = (id: string | undefined) => id === 'kuzu';
export type Blade = 'left' | 'right' | 'head';
export const BLADES:readonly Blade[]=['left','right','head'];
/** Kuzu's two saws on the body that ships (kuzu-tr1, the Tripo rig): it has no saw joints - each saw is mesh skinned to the
 *  forearm, the hand and the index finger, and every clip holds his wrists and fingers on their rest relation so the saws stay
 *  straight. So each saw is placed off the joints that carry it, fixed offsets measured at the bind pose in each joint's own
 *  frame (as Wataame's bokken and Amagoi's rod are): its root where the bar passes the wrist, in the hand's frame; its tip
 *  (the mean of its 12 outermost vertices), in the frame of the index joint those vertices are skinned to. Measured on the
 *  exported body (the file's own skinning, every frame of every clip at 60 a second): on the drawn saw's tip on every frame,
 *  to 0.00 cm. Saw joints such as LeftHand_Chainsaw belong to another skin: without them the contact would fall back and
 *  draw no teeth. The body has no head saw. */
type Point = { readonly joint: string; readonly at: readonly [number, number, number] };
const BLADE: Partial<Record<Blade, { readonly root: Point; readonly tip: Point }>> = {
  left: { root: { joint: 'LeftHand', at: [-.0037, .0016, .0095] }, tip: { joint: 'LeftHandIndex1', at: [-.0497, .3784, .1012] } },
  right: { root: { joint: 'RightHand', at: [-.0025, .001, -.0119] }, tip: { joint: 'RightHandIndex2', at: [.065, .2638, -.2325] } },
};
const sockets = new WeakMap<Fighter, Partial<Record<Blade, { root: THREE.Object3D; tip: THREE.Object3D }>>>();
export function kuzuBladeFrame(f: Fighter, blade: Blade, root: THREE.Vector3, tip: THREE.Vector3): boolean {
  let cached = sockets.get(f);
  if (!cached) {
    cached = {};
    for (const key of BLADES) {
      const saw = BLADE[key], a = saw && f.model?.getObjectByName(saw.root.joint), b = saw && f.model?.getObjectByName(saw.tip.joint);
      if (a && b) cached[key] = { root: a, tip: b };
    }
    sockets.set(f, cached);
  }
  const bones = cached[blade], saw = BLADE[blade]; if (!bones || !saw) return false;
  root.fromArray(saw.root.at).applyMatrix4(bones.root.matrixWorld);
  tip.fromArray(saw.tip.at).applyMatrix4(bones.tip.matrixWorld); return true;
}
const scratchRoot = new THREE.Vector3();
export function kuzuSawContact(f: Fighter, index: number, out: THREE.Vector3, clip = ''): boolean {
  if (!isKuzuChainsaw(f.state.fighter)) return false;
  const blade: Blade = f.state.action === 'ultimate' && !f.state.branch && index >= 3 ? 'head' :
    (f.state.action === 'ultimate' && index === 1 || clip === 'Saw Reverse Quill' || clip === 'Rush 1') ? 'left' : 'right';
  // Bonegrinder's last cut asks for the head saw; this body has none, and its clip makes that cut with the right saw
  // (2.2 s in: its tip 9.2 m/s ahead of him, the left saw still).
  return kuzuBladeFrame(f,blade,scratchRoot,out) || blade === 'head' && kuzuBladeFrame(f,'right',scratchRoot,out);
}
