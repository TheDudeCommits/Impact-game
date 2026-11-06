import * as THREE from 'three';

/**
 * A skeleton's bone matrices worked out once a drawn frame (couch play, 2 November 2026: "the couch co-op across all
 * modes needs more optimization").
 *
 * three keeps a skinned body's bones "once a frame" by the renderer's frame count, and that count moves on with every
 * render call - inside one call, too: its shadow pass is counted a frame after its colour draws. So each body drawn had
 * its bone matrices multiplied out and its bone texture sent to the GPU twice a frame, and four times on a split screen,
 * which draws the scene once for each half (GameRenderer renderHalves). The same numbers each time: by then the frame
 * is posed (the clips, the hands, the feet and the cloth all ran before the draw), and nothing in a draw moves a bone.
 *
 * While GameRenderer draws its frame (`drawing`), a skeleton already updated in that frame keeps what it has. Outside
 * it - a warm-up's draw, a body posed and sampled between frames - every update runs as three wrote it.
 */
const update = THREE.Skeleton.prototype.update;
const posed = new WeakMap<THREE.Skeleton, number>();
let frame = 0, drawing = false, installed = false;
/** Dev (GameRenderer's probe `tune`): off, every update runs as three wrote it, to cost what this saves. */
export const skeletonOnce = { on: true };

export function installSkeletonOnce() {
  if (installed) return;
  installed = true;
  THREE.Skeleton.prototype.update = function (this: THREE.Skeleton) {
    if (drawing && skeletonOnce.on) { if (posed.get(this) === frame) return; posed.set(this, frame); }
    update.call(this);
  };
}

/** GameRenderer's frame: on as its draws begin (a new frame), off once they are done. */
export function drawingFrame(on: boolean) {
  if (on) frame++;
  drawing = on;
}
