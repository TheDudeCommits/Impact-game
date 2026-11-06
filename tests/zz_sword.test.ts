import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FIGHTERS } from '../src/config';
import { Fighter } from '../src/render/Fighter';
import type { PlayerState } from '../src/game/types';
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
const st = (): PlayerState => ({ id: 'a', name: 'A', fighter: 'nigo', x: 0, y: 0, z: 0, yaw: 0, hp: 900,
  maxHp: 1000, stamina: 100, ultimate: 100, action: 'idle', actionStarted: 0, actionDuration: 0, actionTime: 0,
  target: null, alive: true, isBot: false, grounded: true, guarding: false, cooldowns: { light: 0, heavy: 0, special: 0, ultimate: 0 } });
describe('sword', () => {
  it('ancestry of the drifting bone', async () => {
    const rig = await loadRig(FIGHTERS.nigo.model);
    const f = new Fighter(st(), rig);
    const { isDynamicBoneName } = await import('../src/render/SecondaryMotion');
    let sword: THREE.Object3D | undefined;
    f.group.traverse(o => { if (o.name === 'Bone016_065') sword = o; });
    const chain: string[] = [];
    for (let n: THREE.Object3D | null = sword!; n; n = n.parent) chain.push(`${n.name}${isDynamicBoneName(n.name) ? '  <== SPRUNG' : ''}`);
    // And every sprung bone on this rig, for the record.
    const sprung: string[] = [];
    f.group.traverse(o => { if ((o as THREE.Bone).isBone && isDynamicBoneName(o.name)) sprung.push(o.name); });
    fs.writeFileSync('/tmp/sword.out', 'chain from the drifting bone up to the root:\n  ' + chain.join('\n  ')
      + `\n\nsprung bones on this rig (${sprung.length}): ` + sprung.slice(0, 12).join(', ') + '\n');
    expect(true).toBe(true);
  }, 300_000);
});
