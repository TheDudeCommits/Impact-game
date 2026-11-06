import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

type Glb = { json: { nodes: { name?: string }[]; accessors: { bufferView: number; byteOffset?: number; count: number; max?: number[] }[]; bufferViews: { byteOffset?: number; byteStride?: number }[];
  animations: { name: string; channels: { sampler: number; target: { node: number; path: string } }[]; samplers: { input: number; output: number }[] }[] }; bin: Buffer };
function read(file: string): Glb {
  const b = fs.readFileSync(`public/assets/fighters/${file}`), n = b.readUInt32LE(12);
  const json = JSON.parse(b.subarray(20, 20 + n).toString()), at = 20 + n, len = b.readUInt32LE(at);
  return { json, bin: b.subarray(at + 8, at + 8 + len) };
}
function floats(g: Glb, index: number, width: number) {
  const a = g.json.accessors[index], v = g.json.bufferViews[a.bufferView], start = (v.byteOffset ?? 0) + (a.byteOffset ?? 0), stride = v.byteStride ?? 4 * width;
  return Array.from({ length: a.count }, (_, i) => Array.from({ length: width }, (_, k) => g.bin.readFloatLE(start + i * stride + 4 * k)));
}
const length = (g: Glb, clip: string) => Math.max(...g.json.animations.find(a => a.name === clip)!.samplers.map(s => g.json.accessors[s.input].max![0]));
/** The hips' height through a clip's first frames (their translation channel's keys, in the file's units). */
function hips(g: Glb, clip: string) {
  const a = g.json.animations.find(x => x.name === clip)!;
  const channel = a.channels.find(c => c.target.path === 'translation' && /^hips$/i.test(g.json.nodes[c.target.node].name ?? ''))!;
  const s = a.samplers[channel.sampler];
  return { times: floats(g, s.input, 1).map(t => t[0]), y: floats(g, s.output, 3).map(p => p[1]) };
}

describe("Lucy's presses open moving (lucy agent)", () => {
  for (const [file, moves] of [['lucy-px1.glb', 'lucy-px1.glb'], ['sunrise-px1.glb', 'sunrise-pxmoves1.glb']] as const) {
    it(`${file}: the jump opens at its stand, not on a crouch key it leaves on the next frame`, () => {
      const g = read(file), h = hips(g, 'jump');
      expect(length(g, 'jump')).toBeCloseTo(0.5417, 3);
      expect(h.times.length).toBeGreaterThan(3);
      expect(h.y[0] / h.y[1], `hips at the first key against the second (${h.y[0].toFixed(3)} / ${h.y[1].toFixed(3)})`).toBeGreaterThan(.95);
    });
    it(`${moves}: the Bazooka keeps its length (its blow stays on 0.42 s, contactFrames' 0.4667)`, () => {
      expect(length(read(moves), 'Rogue Wave')).toBeCloseTo(0.9, 3);
    });
  }
});

/** (5 November, lucy2) Her idle (lucy-pxidleb1.glb, the Pixel port's `Idle B` and its fidget `Idle B hat`) turned her feet
 *  9-11 degrees and her right knee 3.5 from one key to the next, all through the loop: feet shimmering 1.6-2.4 cm a frame
 *  where Impact's Gummy's move 0.1. On the page that shimmer is what a press has to rise above before it shows (perf's
 *  timed run: first visible pose 25-60 ms after Gummy's), and it reads as a jittery stance. smooth_clip.py low-passed the
 *  leg tracks (9-tap binomial, circular); this keeps every leg joint's key-to-key wobble under a degree and a half. */
const wobble = (g: Glb, clip: string, bone: string) => {
  const a = g.json.animations.find(x => x.name === clip)!;
  const channel = a.channels.find(c => c.target.path === 'rotation' && g.json.nodes[c.target.node].name === bone);
  if (!channel) return 0;
  const v = floats(g, a.samplers[channel.sampler].output, 4), out: number[] = [];
  const dot = (p: number[], q: number[]) => p.reduce((s, x, i) => s + x * q[i], 0);
  for (let i = 1; i < v.length - 1; i++) {
    const b = dot(v[i - 1], v[i + 1]) < 0 ? v[i + 1].map(x => -x) : v[i + 1];
    const m = v[i - 1].map((x, k) => (x + b[k]) / 2), n = Math.hypot(...m);
    out.push(2 * Math.acos(Math.min(1, Math.abs(dot(v[i], m.map(x => x / n))))) * 180 / Math.PI);
  }
  return out.sort((p, q) => p - q)[out.length >> 1] ?? 0;
};
describe("Lucy's idle stands still between presses (lucy agent)", () => {
  const g = read('lucy-pxidleb1.glb');
  for (const clip of ['Idle B', 'Idle B hat']) it(`${clip}: no leg joint shimmers from key to key`, () => {
    for (const side of ['Left', 'Right']) for (const joint of ['UpLeg', 'Leg', 'Foot'])
      expect(wobble(g, clip, side + joint), `${clip} ${side}${joint}: median degrees off the mean of its neighbours`).toBeLessThan(1.5);
  });
});
