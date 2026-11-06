import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FIGHTERS } from '../src/config';
import { Fighter } from '../src/render/Fighter';
import type { FighterId, PlayerState } from '../src/game/types';

/**
 * A sword does not move in the hand that is holding it.
 *
 * Nigo carries HAIZAN on a bone whose rest offset puts it 0.99 m up from
 * his right hand; every clip he was authored with carries a translation that
 * brings it back to 0.07. A retarget writes rotations, so the clips donated to
 * him left that bone at rest, and the blade floated a metre off his hand
 * through `Run`, `down_lp`, `down_end`, `shake` and `stun` - visible as the
 * sword detaching whenever he moved.
 *
 * This measures what is drawn rather than what is in the file, because the
 * renderer is where it is corrected: whatever a fighter's own idle does with
 * something he is holding, every other clip does too.
 */
const BUDGET = .35;

async function loadRig(path: string) {
  const file = fs.readFileSync(`public${path}`), length = file.readUInt32LE(12);
  const json = JSON.parse(file.subarray(20, 20 + length).toString());
  json.materials = (json.materials ?? []).map((m: { name: string }) => ({ name: m.name }));
  delete json.images; delete json.textures; delete json.samplers;
  const data = Buffer.from(JSON.stringify(json)), padded = Buffer.concat([data, Buffer.alloc((4 - data.length % 4) % 4, 32)]);
  const tail = file.subarray(20 + length), result = Buffer.alloc(20 + padded.length + tail.length);
  result.writeUInt32LE(0x46546c67, 0); result.writeUInt32LE(2, 4); result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(padded.length, 12); result.writeUInt32LE(0x4e4f534a, 16); padded.copy(result, 20); tail.copy(result, 20 + padded.length);
  return new GLTFLoader().parseAsync(result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength), '');
}
const base = (fighter: FighterId): PlayerState => ({ id: 'a', name: 'A', fighter, x: 0, y: 0, z: 0, yaw: 0,
  hp: 900, maxHp: 1000, stamina: 100, ultimate: 100, action: 'idle', actionStarted: 0, actionDuration: 0, actionTime: 0,
  target: null, alive: true, isBot: false, grounded: true, guarding: false, cooldowns: { light: 0, heavy: 0, special: 0, ultimate: 0 } });

/** Everything drawn below a hand, and which hand holds it. */
function heldBones(fighter: Fighter) {
  const hands = (['LeftHand', 'RightHand'] as const).map(n => fighter.joints.get(n)).filter(Boolean) as THREE.Object3D[];
  const owner = new Map<THREE.Object3D, THREE.Object3D>();
  for (const hand of hands) hand.traverse(n => { if (n !== hand) owner.set(n, hand); });
  const drawn = new Map<THREE.Object3D, THREE.Object3D>();
  fighter.group.traverse(object => {
    const skin = object as THREE.SkinnedMesh;
    if (!skin.isSkinnedMesh) return;
    const ids = skin.geometry.attributes.skinIndex, weights = skin.geometry.attributes.skinWeight;
    if (!ids || !weights) return;
    for (let i = 0; i < ids.count; i += 2) for (let j = 0; j < 4; j++) {
      if (weights.getComponent(i, j) <= .1) continue;
      const bone = skin.skeleton.bones[ids.getComponent(i, j)];
      const hand = bone && owner.get(bone);
      if (hand) drawn.set(bone, hand);
    }
  });
  return drawn;
}

const roster = Object.keys(FIGHTERS) as FighterId[];

describe('what a fighter is holding stays in his hand', () => {
  it.each(roster)('%s keeps hold of it through a run and a combo', async id => {
    const rig = await loadRig(FIGHTERS[id].model);
    const fighter = new Fighter(base(id), rig);
    try {
      const held = heldBones(fighter);
      if (!held.size) return;           // nothing in his hands to drop
      const settle = () => { fighter.group.updateMatrixWorld(true); };
      settle();
      const home = new Map([...held].map(([bone, hand]) =>
        [bone, bone.getWorldPosition(new THREE.Vector3()).distanceTo(hand.getWorldPosition(new THREE.Vector3()))]));
      const script: [string, number][] = [['idle', 0], ['run', 0], ['run', 0], ['light', .55],
        ['heavy', 1.1], ['run', 0], ['hurt', .4], ['run', 0], ['light', .55]];
      let worst = 0, where = '', z = 0;
      for (const [action, duration] of script) {
        const frames = duration ? Math.ceil(duration * 60) : 40;
        for (let i = 0; i < frames; i++) {
          if (action === 'run') z += 7.5 / 60;
          fighter.update(1 / 60, { ...base(id), action: action as PlayerState['action'], actionDuration: duration,
            actionStarted: 3, actionTime: duration ? Math.min(.999, (i / 60) / duration) : 0, z }, true);
          settle();
          for (const [bone, hand] of held) {
            const now = bone.getWorldPosition(new THREE.Vector3()).distanceTo(hand.getWorldPosition(new THREE.Vector3()));
            const moved = Math.abs(now - home.get(bone)!);
            if (moved > worst) { worst = moved; where = `${bone.name} during ${action} at frame ${i}`; }
          }
        }
      }
      expect(worst, `${id}: ${where} moved ${worst.toFixed(2)} m out of his hand`).toBeLessThan(BUDGET);
    } finally { fighter.dispose(); }
  }, 120_000);
});
