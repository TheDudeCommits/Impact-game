import fs from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { FIGHTERS } from '../src/config';
import type { PlayerState } from '../src/game/types';
import { BANK, Fighter } from '../src/render/Fighter';

/** The feel pass, iteration twelve: a turn banks by the sideways force of the path the body takes
 *  (Fighter.ts BANK) - not by how fast its facing turns, not on the spot, and not at the hips. The benchmark's turn lean
 *  "reads as skating": a body tipping over feet that never stepped out. */
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
const base = (): PlayerState => ({ id: 'bank', name: 'B', fighter: 'kenzo', x: 0, y: 0, z: 0, yaw: 0,
  hp: 1000, maxHp: 1000, stamina: 100, ultimate: 0, action: 'run', actionStarted: 0, actionDuration: 0, actionTime: 0,
  target: null, alive: true, isBot: false, grounded: true, guarding: false, cooldowns: { light: 0, heavy: 0, special: 0, ultimate: 0 } });

let kenzo: GLTF;
beforeAll(async () => { kenzo = await loadRig(FIGHTERS.kenzo.model); }, 120_000);

const roll = (fighter: Fighter) => (fighter as unknown as { leanRoll: number }).leanRoll;
const most = THREE.MathUtils.degToRad(5);

describe('the turn bank', () => {
  it('stays upright turning on the spot, and running straight', () => {
    const fighter = new Fighter(base(), kenzo);
    try {
      let worst = 0;
      // Half a turn in half a second, standing.
      for (let i = 0; i < 60; i++) { fighter.update(1 / 60, { ...base(), action: 'idle', yaw: Math.min(Math.PI, i / 30 * Math.PI) }, true); worst = Math.max(worst, Math.abs(roll(fighter))); }
      expect(worst, 'a pivot').toBeLessThan(.005);
      // Straight down the floor at a run.
      for (let i = 0; i < 90; i++) { fighter.update(1 / 60, { ...base(), z: i * 7.5 / 60, yaw: 0 }, true); if (i > 20) worst = Math.max(worst, Math.abs(roll(fighter))); }
      expect(worst, 'a straight run').toBeLessThan(.01);
    } finally { fighter.dispose(); }
  });

  it('leans into a curve at a run, toward its centre and no further than the cap', () => {
    // A circle of four metres at 7.5 m/s, both ways round: about 14 m/s^2 sideways, well past the cap. The chest's tilt
    // toward the circle's centre is measured with the bank and without it (BANK.share 0), everything else alike - the
    // hip lead twists a running chest in a turn too, and that is not a lean.
    const circle = (dir: 1 | -1) => {
      const fighter = new Fighter(base(), kenzo);
      let peak = 0, tilt = 0;
      try {
        for (let i = 0; i < 120; i++) {
          const a = dir * 1.875 * i / 60, x = 4 * Math.cos(a), z = 4 * Math.sin(a);
          fighter.update(1 / 60, { ...base(), x, z, yaw: Math.atan2(-Math.sin(a) * dir, Math.cos(a) * dir) }, true);
          if (i > 40) {
            peak = Math.max(peak, Math.abs(roll(fighter)));
            fighter.group.updateMatrixWorld(true);
            const chest = fighter.joints.get('Spine1') ?? fighter.joints.get('Spine')!;
            const up = new THREE.Vector3(0, 1, 0).applyQuaternion(chest.getWorldQuaternion(new THREE.Quaternion()));
            const facing = fighter.group.rotation.y, right = Math.asin(THREE.MathUtils.clamp(up.x * -Math.cos(facing) + up.z * Math.sin(facing), -1, 1));
            // The centre is on the right going anticlockwise, on the left going clockwise.
            tilt += right * dir / 79;
          }
        }
      } finally { fighter.dispose(); }
      return { peak, tilt };
    };
    for (const dir of [1, -1] as const) {
      const on = circle(dir), share = BANK.share;
      BANK.share = 0;
      const off = circle(dir);
      BANK.share = share;
      expect(on.peak, `${dir}: the bank reaches its cap`).toBeGreaterThan(most * .7);
      expect(on.peak, `${dir}: and no further`).toBeLessThanOrEqual(most + 1e-6);
      expect(off.peak).toBeLessThan(.001);
      // Into the turn. The chest takes the bank less its own forward pitch (the run leans it over), so about a third
      // of the cap shows as its up-axis tilting toward the centre - measured 1.5 degrees on Kenzo.
      expect(on.tilt - off.tilt, `${dir}: toward the centre`).toBeGreaterThan(most * .2);
    }
  });

  it('puts none of the bank in the hips', () => {
    const source = fs.readFileSync('src/render/Fighter.ts', 'utf8');
    expect(source).toContain('if(Math.abs(this.leanRoll)>1e-4&&i>0)');
  });
});
