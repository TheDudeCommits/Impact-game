import fs from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { FIGHTERS } from '../src/config';
import { MOVES, PUSH_RADIUS } from '../src/game/moves';
import { Fighter } from '../src/render/Fighter';
import type { FighterId, PlayerState } from '../src/game/types';
import { ORIGINALS } from '../src/originals/roster';

/** A swing does not carry the attacker's body into the opponent's.
 *
 *  The simulation holds two capsules 1.1 m apart. Gummy's Rogue Wave
 *  carries its hips 2.4 m forward on the clip's own root, and the root clamp
 *  only ever measured that against a per-fighter cap: at contact range the
 *  attacker's torso was drawn inside the defender's and snapped back out when
 *  the clip ended - the most obvious thing in a close exchange. The clamp now
 *  also knows how much floor there is before the locked opponent. */
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
const base = (fighter: FighterId): PlayerState => ({ id: 'p', name: 'P', fighter, x: 0, y: 0, z: 0, yaw: 0,
  hp: 900, maxHp: 1000, stamina: 100, ultimate: 50, action: 'idle', actionStarted: 0, actionDuration: 0, actionTime: 0,
  target: null, alive: true, isBot: false, grounded: true, guarding: false, cooldowns: { light: 0, heavy: 0, special: 0, ultimate: 0 } });

let gummy: GLTF;
beforeAll(async () => { gummy = await loadRig(FIGHTERS.gummy.model); }, 120_000);

/** The furthest forward the hips are drawn over a whole heavy, in the
 *  fighter's own frame, with the opponent at `gap` metres or absent. */
function reach(gap?: number) {
  const fighter = new Fighter(base('gummy'), gummy);
  fighter.dynamics = false;
  try {
    if (gap !== undefined) fighter.targetPoint = new THREE.Vector3(0, 1.45, gap);
    const move = MOVES.gummy.heavy, hips = fighter.joints.get('Hips')!;
    for (let i = 0; i < 20; i++) fighter.update(1 / 60, { ...base('gummy') }, true);
    let furthest = -Infinity;
    for (let i = 0; i * (1 / 60) <= move.duration; i++) {
      fighter.update(1 / 60, { ...base('gummy'), action: 'heavy', actionStarted: 1, actionDuration: move.duration,
        actionTime: Math.min(.999, (i / 60) / move.duration) }, true);
      fighter.group.updateMatrixWorld(true);
      furthest = Math.max(furthest, fighter.group.worldToLocal(hips.getWorldPosition(new THREE.Vector3())).z);
    }
    return furthest;
  } finally { fighter.dispose(); }
}

describe('the root clamp knows where the opponent is', () => {
  it.skipIf(!!ORIGINALS.gummy)('lets a swing at empty air travel', () => {
    expect(reach(), 'the clip\'s own lunge, clamped only by the fighter\'s cap').toBeGreaterThan(1.2);
    expect(reach(6), 'an opponent well out of range costs nothing').toBeGreaterThan(1.2);
  });

  it('stops the hips at the opponent\'s body', () => {
    const gap = PUSH_RADIUS * 2;
    const furthest = reach(gap);
    // The room is the gap less the two push radii, floored at twelve
    // centimetres; the hips must not be drawn past the defender's surface.
    expect(furthest, `hips drawn ${furthest.toFixed(2)} m forward against a body ${gap.toFixed(2)} m away`).toBeLessThan(.45);
  });
});
