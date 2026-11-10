import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { GameRenderer } from '../src/render/GameRenderer';
import { drawingFrame, installSkeletonOnce } from '../src/render/skeletonOnce';
import { nearestLens, secondFrustum, setSecondLens } from '../src/render/lenses';

/** The split screen's frame, done once where a half would only do it again (couch play, 2 November 2026: "the couch
 *  co-op across all modes needs more optimization"): one shadow pass for both halves while one box holds both of theirs,
 *  each skeleton posed once a frame, and the second lens asked by whatever culls by the camera. */

type Proto = Record<string, (...args: unknown[]) => unknown>;
const proto = GameRenderer.prototype as unknown as Proto;
const lens = (at: THREE.Vector3, look: THREE.Vector3) => { const c = new THREE.PerspectiveCamera(45, 16 / 9, .08, 340); c.position.copy(at); c.lookAt(look); c.updateMatrixWorld(); return c; };

/** GameRenderer's shadow state, as renderHalves hands it to shareShadow, with the sun as High quality sets it. */
function stand() {
  const sun = new THREE.DirectionalLight(), own = sun.shadow;
  own.mapSize.set(2048, 2048); Object.assign(own.camera, { left: -18, right: 18, top: 18, bottom: -18, near: .5, far: 150 }); own.camera.updateProjectionMatrix();
  const keyDir = new THREE.Vector3(.45, .8, .35).normalize(), right = new THREE.Vector3().crossVectors(THREE.Object3D.DEFAULT_UP, keyDir).normalize();
  return { sun, own, aims: [new THREE.Vector3(), new THREE.Vector3()], settings: { quality: 'high' }, shadowRight: right, shadowUp: new THREE.Vector3().crossVectors(keyDir, right).normalize(), keyDir,
    sharing: false, sharedShadow: undefined as THREE.DirectionalLightShadow | undefined, shadowCenter: new THREE.Vector3(), scratch: new THREE.Vector3(), focus: new THREE.Vector3(), focusAt: -1, time: 1,
    camera: lens(new THREE.Vector3(0, 3, -4.5), new THREE.Vector3(0, 1, 2)), setFocus: proto.setFocus, shadowAim: proto.shadowAim, placeSun: proto.placeSun,
    // A fight's box, not a ball match's (GameRenderer shadowHalf).
    centred: false, shadowHalf: proto.shadowHalf };
}
/** Two people `apart` metres apart along z, each with the follow camera 4.5 m behind them looking at the other. */
function duel(s: ReturnType<typeof stand>, apart: number) {
  const one = new THREE.Vector3(0, 0, 0), two = new THREE.Vector3(0, 0, apart);
  s.camera = lens(new THREE.Vector3(0, 3, -4.5), new THREE.Vector3(0, 1, apart));
  const second = lens(new THREE.Vector3(0, 3, apart + 4.5), new THREE.Vector3(0, 1, 0));
  return proto.shareShadow.call(s, { screen: 'split-h', second, before() {}, focus: (half: number) => half ? two : one }, s.own) as boolean;
}
const along = (s: ReturnType<typeof stand>, v: THREE.Vector3) => [v.dot(s.shadowRight), v.dot(s.shadowUp)];

describe('the split screen\'s shared shadow (GameRenderer shareShadow)', () => {
  it('draws one pass for both halves while one box holds both of theirs, at the sun\'s own texel', () => {
    for (const apart of [2, 4, 8, 12, 16]) {
      const s = stand();
      expect(duel(s, apart), `${apart} m apart`).toBe(true);
      const shared = s.sun.shadow;
      expect(shared).not.toBe(s.own);
      expect(2 * shared.camera.right / shared.mapSize.x).toBeCloseTo(2 * s.own.camera.right / s.own.mapSize.x, 9);
      // Each half's own box (its aim, 18 m every way) lies inside the shared one.
      const centre = along(s, s.sun.target.position), half = shared.camera.right;
      for (const aim of s.aims) for (const [k, v] of along(s, aim).entries()) expect(Math.abs(v - centre[k]) + 18, `${apart} m apart`).toBeLessThanOrEqual(half + 1e-6);
    }
  });
  it('keeps a pass for each half when their boxes are too far apart, and lets go of it a little further than it takes it', () => {
    const far = stand();
    expect(duel(far, 40)).toBe(false);
    expect(far.sun.shadow).toBe(far.own);
    // Between the taking and the letting go: as it was.
    const reach = (s: ReturnType<typeof stand>) => { const [a, b] = s.aims, d = b.clone().sub(a); return Math.max(...along(s, d).map(Math.abs)); };
    let apart = 12, s = stand();
    for (; apart < 40; apart += .05) { s = stand(); duel(s, apart); if (reach(s) > 36 * .3125 * .99 * .95) break; }
    const fresh = stand(); expect(duel(fresh, apart)).toBe(false);
    const held = stand(); held.sharing = true; expect(duel(held, apart)).toBe(true);
  });
});

describe('a skeleton posed once a drawn frame (skeletonOnce.ts)', () => {
  installSkeletonOnce();
  const bone = new THREE.Bone(), skeleton = new THREE.Skeleton([bone]);
  const at = (x: number) => { bone.position.x = x; bone.updateMatrixWorld(true); skeleton.update(); return skeleton.boneMatrices![12]; };
  it('keeps the first pose of a frame for the frame\'s other draws, and poses afresh outside it and in the next', () => {
    expect(at(1)).toBe(1);
    drawingFrame(true);
    expect(at(2)).toBe(2);
    expect(at(3)).toBe(2);
    drawingFrame(false);
    expect(at(4)).toBe(4);
    drawingFrame(true);
    expect(at(5)).toBe(5);
    drawingFrame(false);
  });
});

describe('the second lens (lenses.ts)', () => {
  it('sees what Player 2\'s camera sees, and measures detail from the nearer lens', () => {
    const one = lens(new THREE.Vector3(10, 0, 0), new THREE.Vector3(20, 0, 0)), two = lens(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1));
    setSecondLens(two);
    expect(secondFrustum()!.containsPoint(new THREE.Vector3(0, 0, -5))).toBe(true);
    expect(secondFrustum()!.containsPoint(new THREE.Vector3(0, 0, 5))).toBe(false);
    expect(nearestLens(one, new THREE.Vector3(1, 0, 0))).toBeCloseTo(1);
    setSecondLens(undefined);
    expect(secondFrustum()).toBeUndefined();
    expect(nearestLens(one, new THREE.Vector3(1, 0, 0))).toBeCloseTo(9);
  });
});
