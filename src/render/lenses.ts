import * as THREE from 'three';

/**
 * The second lens of a split screen (couch/split.ts, main.ts beginSplit): Player 2's camera, drawn into its own half of
 * the frame after Player 1's. What leaves a body out of the frame by what one camera sees - the crowd's bodies, the
 * arcade's enemies, the Rift's buildings - asks here too, so a body only Player 2's half shows is still drawn there, and
 * its detail is set by whichever lens is nearer. Unset on one screen, where the frame's camera is the only lens.
 */
let lens: THREE.PerspectiveCamera | undefined;
const view = new THREE.Matrix4(), frustum = new THREE.Frustum();

export function setSecondLens(camera?: THREE.PerspectiveCamera) { lens = camera; }

/** The second lens's frustum as its camera stands now, or undefined on one screen. */
export function secondFrustum() {
  if (!lens) return undefined;
  lens.updateMatrixWorld();
  return frustum.setFromProjectionMatrix(view.multiplyMatrices(lens.projectionMatrix, lens.matrixWorldInverse));
}

/** How far `point` is from the nearer lens: `camera`'s, or the second's. */
export function nearestLens(camera: THREE.Camera, point: THREE.Vector3) {
  const one = camera.position.distanceTo(point);
  return lens ? Math.min(one, lens.position.distanceTo(point)) : one;
}

/** Which half of a split screen GameRenderer is drawing (renderHalves): 1 while Player 2's, else 0. What runs once a
 *  render of the scene - the ground's tick (ground/frame.ts) - runs again in the second half, for its lens only. */
let half: 0 | 1 = 0;
export function setDrawingHalf(drawing: 0 | 1) { half = drawing; }
export function drawingHalf() { return half; }

/**
 * What is turned to the lens on the CPU once a frame - a card turned to the eye, a ribbon laid across the view - turned
 * again for each half of a split screen as it is drawn (main.ts splitHalf calls `faceLens` with the half's lens; the
 * couch, 2 November 2026: "a few effects in Player 2's half still face Player 1's camera"). One screen never calls it,
 * so what it draws is as before. Effects whose cards face the camera in their shaders need nothing here.
 */
const facers = new Set<(camera: THREE.Camera) => void>();
export function onLens(face: (camera: THREE.Camera) => void) { facers.add(face); }
export function faceLens(camera: THREE.Camera) { for (const face of facers) face(camera); }

const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
/** An instanced batch's upright cards - turned only about the vertical, to the eye - turned to `eye` again, each keeping
 *  its place and size. A card turned any other way is not one of them, and is left as it is. */
export function faceUpright(mesh: THREE.InstancedMesh, eye: THREE.Vector3, count = mesh.count) {
  if (count <= 0) return;
  for (let i = 0; i < count; i++) {
    mesh.getMatrixAt(i, _m); _m.decompose(_p, _q, _s);
    if (Math.abs(_q.x) > 1e-4 || Math.abs(_q.z) > 1e-4) continue;
    _q.setFromAxisAngle(_up, Math.atan2(eye.x - _p.x, eye.z - _p.z));
    mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
  }
  mesh.instanceMatrix.clearUpdateRanges(); mesh.instanceMatrix.addUpdateRange(0, count * 16); mesh.instanceMatrix.needsUpdate = true;
}
