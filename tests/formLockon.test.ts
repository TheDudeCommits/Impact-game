import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { FollowCamera } from '../src/render/FollowCamera';
import type { Fighter } from '../src/render/Fighter';
import type { FighterId, PlayerState } from '../src/game/types';

/** Round 3c (CAM3): "The Kurobi form fills about half the frame"
 *  (idle/konta/awake-lockon, the second blind critic) - and the target,
 *  eight metres on, was a figure at the far wall. The lock-on rig for a big
 *  form now comes over its shoulder instead of standing behind all of it. */
const state = (id: string, fighter: FighterId): PlayerState => ({ id, name: id, fighter, x: 0, y: 0, z: 0, yaw: 0, hp: 1000, maxHp: 1000, stamina: 100, ultimate: 0,
  action: 'idle', actionStarted: 0, actionDuration: 0, actionTime: 0, target: null, alive: true, isBot: false, grounded: true, guarding: false,
  cooldowns: { light: 0, heavy: 0, special: 0, ultimate: 0 } });
/** A skinned box the camera measures as the body drawn: `size` across,
 *  standing on the floor, its middle `back` metres behind the root. */
function box(size: [number, number, number], back: number, material: THREE.Material) {
  const geometry = new THREE.BoxGeometry(...size, 2, 2, 4).translate(0, size[1] / 2, -back);
  const n = geometry.getAttribute('position').count;
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Uint16Array(n * 4), 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(new Float32Array(n * 4).map((_, i) => i % 4 === 0 ? 1 : 0), 4));
  const bone = new THREE.Bone(), mesh = new THREE.SkinnedMesh(geometry, material);
  mesh.add(bone); mesh.bind(new THREE.Skeleton([bone]));
  return mesh;
}
/** Awakened Konta as the client draws him: his own model hidden, the fox -
 *  3 m tall, its body and tails reaching 8.5 m behind his root. */
function fox() {
  const group = new THREE.Group(), model = new THREE.Group(); model.visible = false; group.add(model);
  group.add(box([2.4, 3, 9.5], 3.8, new THREE.MeshToonMaterial()));
  const s = state('me', 'konta'); s.awakened = true;
  return { state: s, group, model, velocity: new THREE.Vector3(), joints: new Map() } as unknown as Fighter;
}
/** Awakened Shiden: a body of his own, and the worn Guardian round him - a
 *  ghost, drawn without depth, 7 m tall. */
function guardian(withShell: boolean) {
  const group = new THREE.Group(), model = new THREE.Group(); group.add(model);
  model.add(box([.5, 1.8, .3], 0, new THREE.MeshToonMaterial()));
  if (withShell) group.add(box([4, 7, 3], .3, new THREE.ShaderMaterial({ depthWrite: false })));
  const s = state('me', 'shiden'); s.awakened = true;
  return { state: s, group, model, velocity: new THREE.Vector3(), joints: new Map() } as unknown as Fighter;
}
const foe = (z: number) => { const group = new THREE.Group(); group.position.set(.4, 0, z); return { state: state('foe', 'kenzo'), group, velocity: new THREE.Vector3() } as unknown as Fighter; };
function settle(me: Fighter, distance: number) {
  const camera = new THREE.PerspectiveCamera(50, 16 / 9, .1, 200), follow = new FollowCamera(camera);
  follow.mode = 'lockon';
  const them = foe(distance);
  let input = 0;
  for (let i = 0; i < 400; i++) { me.group.updateMatrixWorld(true); follow.update(1 / 60, me, input, 0, [], 0, them, true); input = follow.inputYaw; camera.updateMatrixWorld(); }
  const ndc = (up: number) => them.group.position.clone().setY(up).project(camera);
  return { camera, height: (ndc(1.8).y - ndc(0).y) / 2, feet: ndc(0), head: ndc(1.9) };
}

describe('a big form is framed over its shoulder', () => {
  it.each([[3.5, .19], [6, .155]])('Kurobi: the target %f m off is drawn at %f of the frame or more, whole and in it', (d, least) => {
    const shot = settle(fox(), d);
    // Round 3b's rig: 15% and 13% of the frame's height here (14-16% measured in training).
    expect(shot.height, 'the target\'s size on screen').toBeGreaterThan(least);
    for (const p of [shot.feet, shot.head]) { expect(Math.abs(p.x)).toBeLessThan(1); expect(Math.abs(p.y)).toBeLessThan(.9); }
    // Round 3e (CAM4): no longer over the fox looking down past its head -
    // the third blind critic saw only a paw in the corner from there - but at
    // the height of its back and out past its flank (FollowCamera's
    // FOX_LOCK), and nowhere near the tails' end.
    expect(shot.camera.position.y).toBeGreaterThan(1.4);
    expect(shot.camera.position.y).toBeLessThan(2.8);
    expect(Math.abs(shot.camera.position.x)).toBeGreaterThan(1.5);
    expect(shot.camera.position.distanceTo(new THREE.Vector3())).toBeLessThan(8);
  });

  it('sizes a Guardian user\'s rig by the body, not the ghost round it', () => {
    const plain = settle(guardian(false), 3.5), worn = settle(guardian(true), 3.5);
    // The shell drawn round him no longer counts: the same shot either way.
    expect(worn.camera.position.distanceTo(plain.camera.position)).toBeLessThan(1e-6);
    expect(worn.height).toBeGreaterThan(.22);
  });
});
