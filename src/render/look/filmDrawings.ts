import type * as THREE from 'three';

/**
 * The film look's drawings (look/filmLook.ts): bodies posed twelve times a second, as cel anime is drawn on twos
 * (`?poses=12|24|0`), while the lens moves on every frame. Here for Impact's fighters, whatever posed them (clips, hands, feet, cloth): the bones of
 * every fighter on screen are taken as they stand on the first frame of each drawing, and every frame until the next
 * drawing shows that drawing again. A fighter's place on the ground still moves every frame. `?poses=24` draws on ones
 * at film speed, `?poses=0` a new pose every frame (Impact's own).
 */
const asked = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('poses');
export const drawings = { cadence: asked === '24' ? 24 : asked === '0' ? 0 : 12 };

/** Each body's bones and the pose held for them: walked and taken on a drawing's first frame (twelve times a second; a
 *  body can change form between drawings), only read back on the frames between - no walk of the body there. */
const rigs = new WeakMap<THREE.Object3D, { bones: THREE.Bone[]; pose: Float32Array }>();
let lastDrawing = -1, phase = 0, keyed = false;
/** A blow landed (main.ts, every hit event): the next frame is a new drawing and the grid starts again from it, so the
 *  contact is always drawn (an animator keys the drawings to a blow's contact too). */
export function freshDrawing() { keyed = true; }
/** Called with the frame's clock just before the frame is drawn (GameRenderer.render, and the probe's redraw). */
export function holdDrawings(scene: THREE.Scene, time: number) {
  const fps = drawings.cadence;
  if (!fps) return;
  if (keyed) { keyed = false; phase = time; lastDrawing = -1; }
  const drawing = Math.floor((time - phase) * fps + 1e-4), fresh = drawing !== lastDrawing;
  lastDrawing = drawing;
  for (const body of scene.children) {
    if (!body.visible || !body.name.startsWith('fighter-')) continue;
    let rig = rigs.get(body);
    if (fresh || !rig) {
      const bones = rig?.bones ?? [];
      bones.length = 0;
      body.traverse(node => { if ((node as THREE.Bone).isBone) bones.push(node as THREE.Bone); });
      let pose = rig?.pose;
      if (!pose || pose.length < bones.length * 10) pose = new Float32Array(bones.length * 10);
      for (let i = 0; i < bones.length; i++) { const b = bones[i], o = i * 10; b.quaternion.toArray(pose, o); b.position.toArray(pose, o + 4); b.scale.toArray(pose, o + 7); }
      if (rig) rig.pose = pose; else rigs.set(body, rig = { bones, pose });
    } else {
      const { bones, pose } = rig;
      for (let i = 0; i < bones.length; i++) { const b = bones[i], o = i * 10; b.quaternion.fromArray(pose, o); b.position.fromArray(pose, o + 4); b.scale.fromArray(pose, o + 7); }
    }
  }
}
