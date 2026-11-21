import type * as THREE from 'three';
import { abOff } from './abSwitch';

/**
 * The film look's drawings (look/filmLook.ts): bodies posed twelve times a second, as cel anime is drawn on twos
 * (`?poses=12|24|0`), while the lens moves on every frame. Here for Impact's fighters, whatever posed them (clips, hands, feet, cloth): the bones of
 * every fighter on screen are taken as they stand on the first frame of each drawing, and every frame until the next
 * drawing shows that drawing again. A fighter's place on the ground still moves every frame. `?poses=24` draws on ones
 * at film speed, `?poses=0` a new pose every frame (Impact's own).
 *
 * Action on every frame (`onones`, look/abSwitch.ts): only a fighter in neutral - standing, running, walking, guarding,
 * dashing, jumping - is drawn on the grid. One in a move (its wind-up to the end of its recovery) or taking a blow (hit,
 * launched, down, splatted, stunned, getting up) is posed on every frame (Fighter tells this module which, `drawnOnOnes`),
 * as the fighting itself reads smoother drawn on ones. Back in neutral it waits for the
 * grid's next drawing and is held from there, so its pose never steps back to an older one. `?ab=onones`: every fighter
 * on the grid, as before.
 */
const asked = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('poses');
export const drawings = { cadence: asked === '24' ? 24 : asked === '0' ? 0 : 12 };

/** Each body's bones and the pose held for them: walked and taken on a drawing's first frame (twelve times a second; a
 *  body can change form between drawings), only read back on the frames between - no walk of the body there. `at` is
 *  the drawing the pose was taken on (`taken`), -1 once the body has been posed live since. */
const rigs = new WeakMap<THREE.Object3D, { bones: THREE.Bone[]; pose: Float32Array; at: number }>();
/** The bodies posed on every frame this frame (onones). */
const live = new WeakSet<THREE.Object3D>();
let lastDrawing = -1, phase = 0, keyed = false, taken = 0;
/** A blow landed (main.ts, every hit event): the next frame is a new drawing and the grid starts again from it, so the
 *  contact is always drawn (an animator keys the drawings to a blow's contact too). */
export function freshDrawing() { keyed = true; }
/** Fighter.update, every frame: whether `body` (its group) is in a move or a reaction, and so posed on every frame. */
export function drawnOnOnes(body: THREE.Object3D, on: boolean) { if (on) live.add(body); else live.delete(body); }
/** Called with the frame's clock just before the frame is drawn (GameRenderer.render, and the probe's redraw). */
export function holdDrawings(scene: THREE.Scene, time: number) {
  const fps = drawings.cadence;
  if (!fps) return;
  if (keyed) { keyed = false; phase = time; lastDrawing = -1; }
  const drawing = Math.floor((time - phase) * fps + 1e-4), fresh = drawing !== lastDrawing;
  lastDrawing = drawing;
  if (fresh) taken++;
  const ones = !abOff('onones');
  for (const body of scene.children) {
    if (!body.visible || !body.name.startsWith('fighter-')) continue;
    let rig = rigs.get(body);
    // In a move or a reaction: this frame's pose as it is, and none held for it until the grid's next drawing.
    if (ones && live.has(body)) { if (rig) rig.at = -1; else rigs.set(body, { bones: [], pose: new Float32Array(0), at: -1 }); continue; }
    if (fresh || !rig) {
      // (A body first seen, or on the grid's new drawing.)
      const bones = rig?.bones ?? [];
      bones.length = 0;
      body.traverse(node => { if ((node as THREE.Bone).isBone) bones.push(node as THREE.Bone); });
      let pose = rig?.pose;
      if (!pose || pose.length < bones.length * 10) pose = new Float32Array(bones.length * 10);
      for (let i = 0; i < bones.length; i++) { const b = bones[i], o = i * 10; b.quaternion.toArray(pose, o); b.position.toArray(pose, o + 4); b.scale.toArray(pose, o + 7); }
      if (rig) { rig.pose = pose; rig.at = taken; } else rigs.set(body, rig = { bones, pose, at: taken });
    } else if (rig.at === taken) {
      const { bones, pose } = rig;
      for (let i = 0; i < bones.length; i++) { const b = bones[i], o = i * 10; b.quaternion.fromArray(pose, o); b.position.fromArray(pose, o + 4); b.scale.fromArray(pose, o + 7); }
    }
    // (Back in neutral since the drawing began: posed as it stands until the next one, which it is held from.)
  }
}
