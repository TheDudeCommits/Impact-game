import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ClipPool, shareClips } from '../src/render/clipShare';
import { FighterLibrary, clipMotionTable } from '../src/render/Fighter';
import { loadRig } from './rigHarness';

/** Launch day 10 (perf4): the clips a fighter loads share the arrays of their held channels (src/render/clipShare.ts), and
 *  FighterLibrary lets go of the glTF parser each file came back with. The rule is that nothing a player sees can change: a
 *  track keeps its object, its keys and its place, so every number the game reads off a clip is the number it read before. */
vi.setConfig({ testTimeout: 1200000 }); // the gate's own limit (merge_one.sh --testTimeout=1200000): a sharing check, not a speed one; 180 s timed out under load

const quaternion = (name: string, keys: number[][], times = keys.map((_, i) => i)) => new THREE.QuaternionKeyframeTrack(name, times, keys.flat());
const vector = (name: string, keys: number[][], times = keys.map((_, i) => i)) => new THREE.VectorKeyframeTrack(name, times, keys.flat());
/** Everything a reader can see of a clip: names, durations, tracks' class, name, interpolation, keys and values - as bytes. */
const snapshot = (clips: readonly THREE.AnimationClip[]) => clips.map(clip => ({ name: clip.name, duration: clip.duration, tracks: clip.tracks.map(track => ({ type: track.constructor.name, name: track.name, interpolation: track.getInterpolation(), times: Array.from(track.times), values: Array.from(track.values) })) }));
/** Every track sampled at `count` times, as the game samples (a fresh interpolant: Float32 results). */
const sampled = (clips: readonly THREE.AnimationClip[], count = 60) => clips.map(clip => clip.tracks.map(track => {
  const interpolant = (track as THREE.KeyframeTrack & { createInterpolant(): THREE.Interpolant }).createInterpolant(), out: number[] = [];
  for (let i = 0; i <= count; i++) out.push(...Array.from(interpolant.evaluate(clip.duration * 1.1 * i / count - clip.duration * .05) as ArrayLike<number>));
  return out;
}));

describe('shareClips: a held channel shares its arrays and nothing else moves', () => {
  const unit = [0, 0, 0, 1];
  const build = () => [
    new THREE.AnimationClip('a', 2, [vector('Hips.position', [[0, 1, 0], [0, 1, 0]], [0, 2]), vector('Hips.scale', [[1, 1, 1], [1, 1, 1]], [0, 2]), quaternion('Spine.quaternion', [unit, unit], [0, 2]), quaternion('Head.quaternion', [[0, 0, 0, 1], [0, .2, 0, .98]], [0, 2])]),
    new THREE.AnimationClip('b', 3, [vector('Hips.position', [[0, 1, 0], [0, 1, 0]], [0, 3]), vector('Hips.scale', [[1, 1, 1], [1, 1, 1]], [0, 3]), quaternion('Spine.quaternion', [unit, unit], [0, 3])]),
  ];

  it('gives tracks with the same held keys the same arrays, and keeps every key, every object and every order', () => {
    const clips = build(), before = snapshot(clips), objects = clips.map(clip => [...clip.tracks]);
    const stats = shareClips(clips);
    expect(snapshot(clips)).toEqual(before);
    clips.forEach((clip, i) => expect(clip.tracks.every((track, k) => track === objects[i][k])).toBe(true));
    expect(stats).toMatchObject({ tracks: 7, held: 6, reused: expect.any(Number) });
    // The scales are one value across both clips; the values arrays are shared (the times differ by clip: 2 s against 3 s).
    expect(clips[0].tracks[1].values).toBe(clips[1].tracks[1].values);
    expect(clips[0].tracks[0].values).toBe(clips[1].tracks[0].values);
    expect(clips[0].tracks[2].values).toBe(clips[1].tracks[2].values);
    expect(clips[0].tracks[0].times).not.toBe(clips[1].tracks[0].times);
    // Both clips' hip tracks keep two keys: nothing is collapsed to one (the mixer's blend of two equal keys is not the key).
    expect(clips[0].tracks[0].times.length).toBe(2);
    expect(clips[0].tracks[2].times.length).toBe(2);
  });

  it('never touches a track that moves', () => {
    const clips = build(), moving = clips[0].tracks[3], times = moving.times, values = moving.values;
    shareClips(clips);
    expect(moving.times).toBe(times);
    expect(moving.values).toBe(values);
  });

  it('reads the same numbers off every track, at every time, before and after (the sampler is the game\'s)', () => {
    const clips = build(), before = sampled(clips);
    shareClips(clips);
    expect(sampled(clips)).toEqual(before);
  });

  it('leaves clipMotionTable exactly as it was, with held rotations that are not exactly unit length', () => {
    // (A held quaternion off unit length "turns" a hair against itself in the table; its keys must stay for it to.)
    const slightly = [.0001, .0002, .0003, .99999994];
    const make = () => new THREE.AnimationClip('m', 1, [quaternion('Spine.quaternion', [slightly, slightly], [0, 1]), quaternion('LeftHandIndex1.quaternion', [slightly, slightly], [0, 1]), quaternion('Head.quaternion', [[0, 0, 0, 1], [0, .3, 0, .954], [0, .6, 0, .8]], [0, .4, 1])]);
    const plain = make(), shared = make();
    shareClips([shared]);
    expect(Array.from(clipMotionTable(shared))).toEqual(Array.from(clipMotionTable(plain)));
  });

  it('does not take a -0 for a 0, a spline for a track of equal keys, or a one-key track for anything but itself', () => {
    const negative = vector('A.position', [[0, 0, 0], [-0, 0, 0]], [0, 1]), zero = vector('B.position', [[0, 0, 0], [0, 0, 0]], [0, 1]);
    const spline = new THREE.VectorKeyframeTrack('C.position', [0, 1], [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], THREE.InterpolateSmooth);
    const single = vector('D.position', [[1, 2, 3]], [0]);
    const stats = shareClips([new THREE.AnimationClip('x', 1, [negative, zero, spline, single])]);
    expect(Object.is(negative.values[0], -0) || Object.is(negative.values[3], -0)).toBe(true);
    expect(negative.values).not.toBe(zero.values);
    expect(stats.held).toBe(2);   // `zero` and the one-key track
    expect(Array.from(spline.values)).toEqual(new Array(18).fill(1));
  });

  it('is safe to run twice, and over nothing', () => {
    const clips = build(), pool = new ClipPool();
    shareClips(clips, pool);
    const once = snapshot(clips), second = shareClips(clips, pool);
    expect(snapshot(clips)).toEqual(once);
    expect(second.held).toBe(6);
    expect(shareClips(undefined)).toEqual({ tracks: 0, held: 0, reused: 0 });
  });
});


describe('FighterLibrary lets go of the parser each file came back with', () => {
  const load = GLTFLoader.prototype.loadAsync, warn = console.warn;
  const library = new FighterLibrary();
  type Held = { sources: Map<string, { parser?: { json?: unknown }; animations: THREE.AnimationClip[] }>; forms: Map<string, { parser?: unknown }> };
  beforeAll(() => { GLTFLoader.prototype.loadAsync = function (url: string) { return loadRig(url.split('?')[0]); }; console.warn = () => {}; });
  afterAll(() => { GLTFLoader.prototype.loadAsync = load; console.warn = warn; });


  it('keeps Gummy\'s, whose plain face and open palms are found by the file\'s own JSON', async () => {
    await library.ensure(['gummy']);
    const body = (library as unknown as Held).sources.get('gummy')!;
    expect(body.parser?.json).toBeDefined();
  });

  it('is the whole list of files that read a loaded glTF\'s parser (a new reader of a fighter\'s must keep it for that fighter)', () => {
    const root = path.resolve(__dirname, '../src'), found: string[] = [];
    const walk = (dir: string) => { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) { if (entry.name !== 'vendor') walk(file); continue; }
      if (/\.ts$/.test(entry.name) && !/\.test\.ts$/.test(entry.name) && /\.parser\b/.test(fs.readFileSync(file, 'utf8'))) found.push(path.relative(root, file));
    } };
    walk(root);
    expect(found.sort()).toEqual(['render/EnemyHorde.ts', 'render/Fighter.ts', 'render/gummy/openHands.ts', 'render/stages/StageKit.ts']);
  });
});
