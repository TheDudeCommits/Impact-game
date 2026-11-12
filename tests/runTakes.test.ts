import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ORIGINALS } from '../src/originals/roster';
import * as THREE from 'three';
import { FIGHTERS } from '../src/config';
import { Fighter } from '../src/render/Fighter';
import type { FighterId } from '../src/game/types';
import { resolveSkeleton } from '../src/render/skeleton';
import { base } from './rigHarness';
import { loadRigWithExtras } from './extraClips';
import { guardTakes, type Take } from './takeGuard';

/** The ninja pass, iteration nine: the ninja run (scripts/fanim/runs.py) - the torso pitched forward, the
 *  arms swept back, the head level - laid over the upper body of the runs (and Shiden's and Shirokane's walks, upright
 *  jogs mixed under the run) that were thrown upright or with the arms flown out like wings. Konta's own run already
 *  is it. Each take replaces the clip of the same name at its length, keys the joints above the hips (the light
 *  strings' guard, tests/takeGuard.ts), and keys its lean chain itself.
 *
 *  And it touches nothing below the spine: the foot contacts and cadence the run is paced and planted by are measured
 *  off the clip (src/game/data/locomotion.json, Fighter.ts CADENCE), so every channel on the hips, the legs and the
 *  root is the clip's own, key for key (scripts/fanim/graft.py puts them back after the export resamples them). */
const TAKES: Take[] = [
  ['shiden', 'shiden-fanim4.glb', ['Run', 'Walk']],
  ['shirokane', 'shirokane-fanim3.glb', ['Run', 'Walk']],
  ['tobari', 'tobari-fanim1.glb', ['Run']],
  ['akagane', 'akagane-fanim1.glb', ['Run']],
  // Ippon's (9 October 2026, scripts/fanim/slj.py): Sorrel' winged sprint stood up into a plain sprint, the fists
  // pumped against the legs.
  ['ippon', 'ippon-fanim2.glb', ['Run']],
  // Vesper's (7 October, scripts/fanim/vesper.py): upright and light, the sabre carried low at his side with its
  // point forward - it was held up before his face, waving through each stride - the free arm swinging easy.
  ['vesper', 'vesper-fanim2.glb', ['Run', 'Walk']],
  // Kuon's (9 October, scripts/fanim/jjk_ds.py): the open hands flung out at his hips taken in - elbows bent and carried
  // close, the hands loose and half closed, swung forward and back against the legs, the trunk a little into it.
  ['kuon', 'kuon-fanim3.glb', ['Run']],
  // Magatsu's (9 October): the ninja run's arms held stiff out behind him like wings taken in - a fighter's sprint, the
  // arms pumped against the legs, the trunk stood up a little.
  ['magatsu', 'magatsu-fanim4.glb', ['Run']],
  // Taisei's (8 October, scripts/fanim/runs.py): the martial artist's sprint - pitched into it, fists clenched and pumped
  // hard against the legs, elbows near a right angle - and a loose-fisted walk.
  ['taisei', 'taisei-fanim4.glb', ['Run', 'Walk']],
  // Ouga's (8 October): pitched into it, fists clenched and driven against the legs, a
  // little lower and tighter than Taisei's.
  ['ouga', 'ouga-fanim5.glb', ['Run']],
  // Wuming's (8 October): Sorrel' sprint with its arms flung out like wings, the arms drawn in and pumped, the hands
  // held flat, the trunk stood up a little.
  ['wuming', 'wuming-fanim3.glb', ['Run']],
  // Banjaku's (8 October): the same sprint, his fists clenched and pumped short and heavy.
  ['banjaku', 'jirenga-fanim2.glb', ['Run']],
  // Jinlin's (8 October): upright in the shoulders, his hands clasped behind his back.
  ['jinlin', 'jinlin-fanim2.glb', ['Run']],
  // Gohaku's (8 October): fists clenched and pumped, as his father runs.
  ['gohaku', 'gohaku-fanim3.glb', ['Run']],
];

guardTakes('the ninja runs', TAKES);

interface Gltf {
  nodes: { name?: string; children?: number[] }[];
  animations?: { name: string; samplers: { input: number; output: number; interpolation?: string }[]; channels: { sampler: number; target: { node?: number; path: string } }[] }[];
  accessors: { bufferView: number; byteOffset?: number; count: number; type: string }[];
  bufferViews: { byteOffset?: number; byteStride?: number }[];
}
interface Channel { times: number[]; values: number[]; interpolation: string }
const url = (file: string) => `/assets/fighters/${file}`;
/** A GLB's nodes and each clip's channels, `node path` to its keys. */
function readGlb(path: string) {
  const data = fs.readFileSync(`public${path}`), length = data.readUInt32LE(12);
  const json = JSON.parse(data.subarray(20, 20 + length).toString()) as Gltf, at = 20 + length;
  const bin = at < data.length ? data.subarray(at + 8, at + 8 + data.readUInt32LE(at)) : Buffer.alloc(0);
  const floats = (index: number) => {
    const accessor = json.accessors[index], view = json.bufferViews[accessor.bufferView];
    const width = accessor.type === 'VEC4' ? 4 : accessor.type === 'VEC3' ? 3 : 1, stride = view.byteStride ?? 4 * width;
    const start = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0), out: number[] = [];
    for (let i = 0; i < accessor.count; i++) for (let j = 0; j < width; j++) out.push(bin.readFloatLE(start + i * stride + j * 4));
    return out;
  };
  const clips = new Map<string, Map<string, Channel>>();
  for (const animation of json.animations ?? []) {
    const channels = new Map<string, Channel>();
    for (const channel of animation.channels) {
      if (channel.target.node === undefined) continue;
      const sampler = animation.samplers[channel.sampler];
      channels.set(`${json.nodes[channel.target.node].name ?? ''} ${channel.target.path}`,
        { times: floats(sampler.input), values: floats(sampler.output), interpolation: sampler.interpolation ?? 'LINEAR' });
    }
    clips.set(animation.name, channels);
  }
  return { nodes: json.nodes, clips };
}
/** The clip a name plays without the take, as FighterLibrary resolves it: the body's own, then each extra file listed
 *  before the take, and the rush file's only for a name none of those carry. */
function replacedClip(fighter: FighterId, take: string, name: string) {
  const def = FIGHTERS[fighter], extras = def.extraModels ?? [];
  let clip = readGlb(def.model).clips.get(name);
  for (const extra of extras.slice(0, extras.indexOf(url(take)))) clip = readGlb(extra).clips.get(name) ?? clip;
  if (!clip && def.rushModel) clip = readGlb(def.rushModel).clips.get(name);
  return clip;
}
/** The body's joints from its spine up: the only ones a run take may pose. */
function upperBody(fighter: FighterId) {
  const { nodes } = readGlb(FIGHTERS[fighter].model);
  const spine = resolveSkeleton(nodes.map(n => n.name ?? '')).get('Spine');
  const start = nodes.findIndex(n => n.name === spine), out = new Set<string>();
  const walk = (i: number) => { out.add(nodes[i].name ?? ''); for (const child of nodes[i].children ?? []) walk(child); };
  if (start >= 0) walk(start);
  return out;
}
const same = (a: Channel, b: Channel) => a.interpolation === b.interpolation && a.times.length === b.times.length && a.values.length === b.values.length
  && a.times.every((t, i) => Math.abs(t - b.times[i]) < 1e-6) && a.values.every((v, i) => Math.abs(v - b.values[i]) < 1e-6);
const angle = (a: number[], b: number[]) => 2 * Math.acos(Math.min(1, Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3])));

/** Leg channels a run take re-poses on purpose, by `fighter clip`: Vesper's run holds the heel it kicks up under his
 *  cape's belt (8 October 2026, scripts/fanim/vesper.py lower_heels) - the thighs and shins turned, the feet, the hips
 *  and the root the clip's own; tests/vesperTakes.test.ts checks every foot contact is where it was. */
const LEGS_REPOSED: Record<string, readonly string[]> = {
  'vesper Run': ['LeftUpLeg rotation', 'LeftLeg rotation', 'RightUpLeg rotation', 'RightLeg rotation'],
};

describe('a ninja run re-poses the upper body only', () => {
  for (const [fighter, take, names] of TAKES) for (const name of names) {
    it.skipIf(!!ORIGINALS[fighter])(`${fighter} ${name}: the hips, legs and root are the clip's own, key for key, and the take loops`, () => {
      const mine = readGlb(url(take)).clips.get(name)!, before = replacedClip(fighter, take, name)!, upper = upperBody(fighter);
      expect(upper.size, `${fighter}: no spine`).toBeGreaterThan(3);
      const reposed = new Set(LEGS_REPOSED[`${fighter} ${name}`] ?? []);
      const below = (key: string) => !upper.has(key.slice(0, key.lastIndexOf(' '))) && !reposed.has(key);
      const theirs = [...before.keys()].filter(below).sort(), ours = [...mine.keys()].filter(below).sort();
      expect(ours, `${fighter} ${name}: channels below the spine`).toEqual(theirs);
      for (const key of theirs) expect(same(mine.get(key)!, before.get(key)!), `${fighter} ${name}: ${key} moved`).toBe(true);
      const seam = (channel?: Channel) => channel ? THREE.MathUtils.radToDeg(angle(channel.values.slice(0, 4), channel.values.slice(channel.values.length - 4))) : 0;
      for (const [key, channel] of mine) {
        if (below(key) || !key.endsWith(' rotation') || (before.get(key) && same(channel, before.get(key)!))) continue;
        expect(seam(channel), `${fighter} ${name}: ${key} at the seam`).toBeLessThan(seam(before.get(key)) + 2);
      }
    });
  }
});

describe('a ninja run keys its lean chain and plays without a snap', () => {
  it.each(TAKES.map(([fighter]) => fighter))('%s', async fighter => {
    const body = new Fighter(base(fighter), await loadRigWithExtras(fighter));
    try {
      // The hit lean turns these joints over the pose every frame: the run that replaces the clip keys each of them.
      const chain = (body as unknown as { leanChain: (THREE.Bone | undefined)[] }).leanChain.filter(Boolean) as THREE.Bone[];
      const run = body.clips.find(c => c.name === 'Run')!;
      const keyed = new Set(run.tracks.map(t => THREE.PropertyBinding.parseTrackName(t.name).nodeName));
      expect(chain.filter(bone => !keyed.has(bone.name)).map(bone => bone.name), `${fighter}: lean-chain joints the run leaves unkeyed`).toEqual([]);
      // Full speed from a standstill, through the walk's mix into the run, then let go: the arms and trunk turn
      // smoothly - no frame turns a joint more than twice as far as both frames either side of it (as
      // tests/motionContinuity.test.ts asks of the moves), nor further than a run's arm ever swung.
      const upper = upperBody(fighter);
      // (A 3ds Max Biped hangs its thighs off the spine - Magatsu's - so its legs, the clip's own key for key, are left out
      // by name: the planter's stop is theirs, not the take's.)
      const joints = [...body.joints].filter(([name, joint]) => upper.has(joint.name) && !/finger|thumb|index|middle|ring|pinky|eye|jaw|leg|foot|toe/i.test(name));
      let z = 0, previous = joints.map(([, j]) => j.quaternion.clone()), peak = 0, where = '';
      const frames: number[] = [];
      for (let f = 0; f < 150; f++) {
        const speed = f < 110 ? Math.min(7.5, f * .25) : 0;
        z += speed / 60;
        body.update(1 / 60, { ...base(fighter), action: speed > 0 ? 'run' : 'idle', z }, true, 1 / 60);
        let most = 0;
        joints.forEach(([name, j], i) => { const a = THREE.MathUtils.radToDeg(previous[i].angleTo(j.quaternion)); most = Math.max(most, a); if (a > peak) { peak = a; where = `${name} at frame ${f}`; } previous[i].copy(j.quaternion); });
        frames.push(most);
      }
      expect(peak, where).toBeLessThan(fighter === 'taisei' && ORIGINALS.taisei || fighter === 'magatsu' && ORIGINALS.magatsu ? 32 : 30);
      for (let f = 1; f < frames.length - 1; f++) if (frames[f] > 10) expect(frames[f], `${fighter}: a snap at frame ${f}`).toBeLessThanOrEqual(2 * Math.max(frames[f - 1], frames[f + 1]));
    } finally { body.dispose(); }
  }, 60_000);
});
