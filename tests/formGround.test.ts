import fs from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { FIGHTERS } from '../src/config';
import { MOVES } from '../src/game/moves';
import { Fighter } from '../src/render/Fighter';
import type { FighterId, PlayerState } from '../src/game/types';
import { ORIGINALS } from '../src/originals/roster';

/** A replacement body stands on the floor and stays there.
 *
 *  Full Swell's idle leaves the floor by a sixth of his height, and the
 *  correction for it used to be proportional with a gain of one, recomputed
 *  every frame from the lowest sole: any flight phase in the form's own clip
 *  became a vertical teleport of the whole body - measured, 0.44 m in one
 *  frame - and the bouncing form's bounce, which IS his idle, was deleted. The hover
 *  is a property of the rig, so it is measured once over the whole idle
 *  cycle; what is corrected per frame is sustained drift, rate limited. */
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
  hp: 900, maxHp: 1000, stamina: 100, ultimate: 0, action: 'idle', actionStarted: 0, actionDuration: 0, actionTime: 0,
  target: null, alive: true, isBot: false, grounded: true, guarding: false, awakened: true, cooldowns: { light: 0, heavy: 0, special: 0, ultimate: 0 } });

/** The fighters whose transformation is a body of its own. */
const FORMS: FighterId[] = ['gummy', 'konta', 'nigo', 'gaunt', 'gaku', 'vesper', 'rook', 'jinlin', 'shiun', 'magatsu'];
const rigs = new Map<FighterId, [GLTF, GLTF]>();
beforeAll(async () => {
  for (const id of FORMS) rigs.set(id, [await loadRig(FIGHTERS[id].model), await loadRig(FIGHTERS[id].formModel!)]);
}, 240_000);

describe('a transformation stands on the floor', () => {
  it.each(FORMS)('%s: the bottom of the idle is on the tile', id => {
    const [body, form] = rigs.get(id)!;
    const fighter = new Fighter(base(id), body);
    try {
      fighter.attachForm(form);
      let lowest = Infinity;
      for (let i = 0; i < 180; i++) {
        fighter.update(1 / 60, { ...base(id) }, true);
        const sole = fighter.formSole();
        if (sole !== undefined) lowest = Math.min(lowest, sole);
      }
      // Over three seconds of idle the soles come down to the floor - and
      // not through it. A hover here was the bouncing form standing forty
      // centimetres in the air; a sink is the correction chasing a bounce.
      expect(lowest, `${id}'s form bottoms out ${lowest.toFixed(3)} m off the floor`).toBeLessThan(.06);
      expect(lowest).toBeGreaterThan(-.06);
    } finally { fighter.dispose(); }
  });

  it.each([[1 / 60], [1 / 20]])('never moves the body vertically faster than the correction is allowed, at a step of %f', dt => {
    const [body, form] = rigs.get('gummy')!;
    const fighter = new Fighter(base('gummy'), body);
    try {
      fighter.attachForm(form);
      const script: [PlayerState['action'], number][] = [['idle', 1], ['run', 1], ['light', MOVES.gummy.light.duration],
        ['heavy', MOVES.gummy.heavy.duration], ['ultimate', MOVES.gummy.ultimate.duration], ['idle', .5]];
      let x = 0, worst = 0, previous: number | undefined, started = 1;
      for (const [action, seconds] of script) {
        const frames = Math.ceil(seconds / dt);
        for (let i = 0; i < frames; i++) {
          if (action === 'run') x += 7.5 * dt;
          const moving = action !== 'idle' && action !== 'run';
          fighter.update(dt, { ...base('gummy'), action, x, actionStarted: started, actionDuration: moving ? seconds : 0,
            actionTime: moving ? Math.min(.999, (i * dt) / seconds) : 0 }, true, dt);
          const now = fighter.formOffset;
          if (now !== undefined && previous !== undefined) worst = Math.max(worst, Math.abs(now - previous) / dt);
          previous = now;
        }
        started += seconds;
      }
      expect(worst, `the form was moved at ${worst.toFixed(2)} m/s`).toBeLessThanOrEqual((ORIGINALS.gummy ? .85 : .6) + 1e-6);
    } finally { fighter.dispose(); }
  });
});
