import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FIGHTERS } from '../src/config';
import { AWAKENINGS } from '../src/game/awakening';
import { Fighter } from '../src/render/Fighter';
import type { FighterId, PlayerState } from '../src/game/types';

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
const state = (fighter: FighterId): PlayerState => ({ id: 'a', name: 'A', fighter, x: 0, y: 0, z: 0, yaw: 0,
  hp: 900, maxHp: 1000, stamina: 100, ultimate: 100, action: 'idle', actionStarted: 0, actionDuration: 0, actionTime: 0,
  target: null, alive: true, isBot: false, grounded: true, guarding: false, cooldowns: { light: 0, heavy: 0, special: 0, ultimate: 0 } });

// Whoever the tint is defined for has to be able to receive it.
const tinted = (Object.keys(FIGHTERS) as FighterId[]).filter(id => AWAKENINGS[id]?.hair !== undefined);

describe('a transformation that changes the hair', () => {
  it('has somebody to change it on', () => expect(tinted.length).toBeGreaterThan(0));

  // The gold awakening is a vertex tint, not a second model: the crown weight marks
  // the head-bone vertices above the joint and the shader golds the dark ones.
  // The head was found by matching `head` or `defhead` against a cleaned bone
  // name, which is two of the three spellings in the roster - on a Mixamo rig
  // it found nothing, every weight stayed zero, and Taisei awakened with black
  // hair while the aura and the meter both behaved perfectly.
  it.each(tinted)('%s has crown vertices to gild', async id => {
    const rig = await loadRig(FIGHTERS[id].model);
    const fighter = new Fighter(state(id), rig);
    try {
      let weighted = 0, total = 0;
      fighter.group.traverse(o => {
        const skin = o as THREE.SkinnedMesh;
        const crown = skin.isSkinnedMesh ? skin.geometry.getAttribute('crownWeight') : undefined;
        if (!crown) return;
        total += crown.count;
        for (let i = 0; i < crown.count; i++) if (crown.getX(i) > .5) weighted++;
      });
      expect(total, `${id} never had a crown weight computed`).toBeGreaterThan(0);
      expect(weighted, `${id} has ${weighted} crown vertices: nothing would turn gold`).toBeGreaterThan(80);
    } finally { fighter.dispose(); }
  }, 120_000);
});
