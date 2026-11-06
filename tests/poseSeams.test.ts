import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FIGHTERS } from '../src/config';
import { MOVES } from '../src/game/moves';
import { Fighter } from '../src/render/Fighter';
import type { FighterId, PlayerState } from '../src/game/types';

const ROOTED: FighterId[] = ['kosho', 'kenzo', 'gummy', 'nigo', 'kagari', 'ward'];
const SEAM_CEILING = .8;
/** Coming out of a completed attack into idle there is no such excuse - the
 *  blend owns the whole transition. This is the number that was 6.42. */
const CLEAN_SEAM = .8;

const ALIASES: Record<string, string[]> = JSON.parse(fs.readFileSync('src/game/data/skeletonAliases.json', 'utf8'));
const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
function bodyJoints(names: string[]): Set<string> {
  const have = new Map<string, string>();
  for (const n of names) if (!have.has(key(n))) have.set(key(n), n);
  const out = new Set<string>(), taken = new Set<string>();
  for (const c of Object.keys(ALIASES)) { const a = have.get(key(c)); if (a) { out.add(a); taken.add(a); } }
  for (const [c, spellings] of Object.entries(ALIASES)) {
    if ([...out].some(o => key(o) === key(c))) continue;
    for (const s of spellings) { const a = have.get(key(s)); if (a && !taken.has(a)) { out.add(a); taken.add(a); break; } }
  }
  return out;
}
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

/** Play a run of actions, giving each one its own `actionStarted` the way the
 *  simulation does, and return the worst joint movement on the first frame of
 *  each action - the seam - separately from the worst inside them. */
async function seams(id: FighterId, steps: { action: PlayerState['action']; seconds: number }[]) {
  const rig = await loadRig(FIGHTERS[id].model);
  const fighter = new Fighter(base(id), rig);
  try {
    const names: string[] = [];
    fighter.group.traverse(o => { if ((o as THREE.Bone).isBone) names.push(o.name); });
    const body = bodyJoints(names);
    const pose = () => {
      fighter.group.updateMatrixWorld(true);
      const out: { p: THREE.Vector3; name: string }[] = [];
      fighter.group.traverse(o => { if ((o as THREE.Bone).isBone && body.has(o.name)) out.push({ p: o.getWorldPosition(new THREE.Vector3()), name: o.name }); });
      return out;
    };
    let previous: { p: THREE.Vector3; name: string }[] | null = null, worst = 0, where = '';
    for (let s = 0; s < steps.length; s++) {
      const frames = Math.max(1, Math.ceil(steps[s].seconds * 60));
      for (let i = 0; i < frames; i++) {
        fighter.update(1 / 60, { ...base(id), action: steps[s].action, actionDuration: steps[s].seconds,
          actionStarted: s * 10 + 3, actionTime: Math.min(.999, (i / 60) / steps[s].seconds) }, true);
        const now = pose();
        if (previous && i === 0 && s > 0) {
          for (let j = 0; j < Math.min(previous.length, now.length); j++) {
            const moved = previous[j].p.distanceTo(now[j].p);
            if (moved > worst) { worst = moved; where = `${previous[j].name} on ${steps[s - 1].action}->${steps[s].action}`; }
          }
        }
        previous = now;
      }
    }
    return { worst, where };
  } finally { fighter.dispose(); }
}

describe('a transition blends from the pose that was drawn', () => {
  it.each(ROOTED)('%s finishes an attack without the body snapping back to the clip', async id => {
    const { worst, where } = await seams(id, [
      { action: 'idle', seconds: .4 },
      { action: 'heavy', seconds: MOVES[id].heavy.duration },
      { action: 'idle', seconds: .5 },
    ]);
    expect(worst, `${id}: ${where} moved ${worst.toFixed(2)} m in one frame`).toBeLessThan(CLEAN_SEAM);
  }, 120_000);

  it.each(ROOTED)('%s survives a swing cut short by a hit', async id => {
    const { worst, where } = await seams(id, [
      { action: 'heavy', seconds: MOVES[id].heavy.duration * .5 },
      { action: 'hurt', seconds: .35 },
      { action: 'idle', seconds: .4 },
    ]);
    expect(worst, `${id}: ${where} moved ${worst.toFixed(2)} m in one frame`).toBeLessThan(SEAM_CEILING);
  }, 120_000);
});
