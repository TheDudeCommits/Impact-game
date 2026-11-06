import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FIGHTERS } from '../src/config';
import { Fighter } from '../src/render/Fighter';
import type { FighterId, PlayerState } from '../src/game/types';

const CEILING = 2.1;

const ALIASES: Record<string, string[]> = JSON.parse(fs.readFileSync('src/game/data/skeletonAliases.json', 'utf8'));
const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
/** Canonical body joints only. Every rig also carries world helpers, effect
 *  muzzles, cigarettes, cloth and weapon controllers, and those move metres by
 *  design - measuring them says nothing about whether the body animates. */
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

const roster = Object.keys(FIGHTERS) as FighterId[];

describe('a limb moves rather than teleports', () => {
  it.each(roster)('%s draws every frame within reach of the one before it', async id => {
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
      // Clips run at the rate they were drawn at: advancing actionTime by a
      // fixed fraction per frame plays a two-second special at four times
      // speed and reports the clip's own motion as a jump.
      const script: [string, number][] = [['idle', 0], ['light', .6], ['idle', 0], ['heavy', 1.1],
        ['hurt', .4], ['idle', 0], ['run', 0], ['guard', 0], ['idle', 0]];
      let worst = 0, where = '', previous = pose();
      for (const [action, duration] of script) {
        const frames = duration ? Math.ceil(duration * 60) : 24;
        for (let i = 0; i < frames; i++) {
          fighter.update(1 / 60, { ...base(id), action: action as PlayerState['action'], actionDuration: duration,
            actionStarted: 3, actionTime: duration ? Math.min(.999, (i / 60) / duration) : 0 }, true);
          const now = pose();
          // Past the opening frames of a reaction, where the snap onto the
          // recoil is deliberate and is what being hit looks like.
          if (!(action === 'hurt' && i <= 3)) {
            for (let j = 0; j < Math.min(previous.length, now.length); j++) {
              const moved = previous[j].p.distanceTo(now[j].p);
              if (moved > worst) { worst = moved; where = `${previous[j].name} during ${action} at frame ${i}`; }
            }
          }
          previous = now;
        }
      }
      expect(worst, `${id}: ${where} moved ${worst.toFixed(2)} m in one frame`).toBeLessThan(CEILING);
    } finally { fighter.dispose(); }
  }, 120_000);
});
