import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

type Glb = { json: { nodes: { name?: string }[]; accessors: { bufferView: number; byteOffset?: number; count: number; max?: number[] }[]; bufferViews: { byteOffset?: number; byteStride?: number }[];
  animations?: { name: string; channels: { sampler: number; target: { node: number; path: string } }[]; samplers: { input: number; output: number }[] }[] }; bin: Buffer };
function read(url: string): Glb {
  const b = fs.readFileSync(`public${url}`), n = b.readUInt32LE(12);
  const json = JSON.parse(b.subarray(20, 20 + n).toString()), at = 20 + n, len = b.readUInt32LE(at);
  return { json, bin: b.subarray(at + 8, at + 8 + len) };
}
function floats(g: Glb, index: number, width: number) {
  const a = g.json.accessors[index], v = g.json.bufferViews[a.bufferView], start = (v.byteOffset ?? 0) + (a.byteOffset ?? 0), stride = v.byteStride ?? 4 * width;
  return Array.from({ length: a.count }, (_, i) => Array.from({ length: width }, (_, k) => g.bin.readFloatLE(start + i * stride + 4 * k)));
}
/** The hips' height keys of a clip (their translation channel), or null when the clip or the channel is missing. */
function hips(g: Glb, clip: string) {
  const a = g.json.animations?.find(x => x.name === clip);
  const channel = a?.channels.find(c => c.target.path === 'translation' && /^(mixamorig:)?hips$/i.test(g.json.nodes[c.target.node].name ?? ''));
  if (!a || !channel) return null;
  const s = a.samplers[channel.sampler];
  return { times: floats(g, s.input, 1).map(t => t[0]), y: floats(g, s.output, 3).map(p => p[1]) };
}
function at(times: number[], y: number[], t: number) {
  if (t <= times[0]) return y[0];
  const k = times.findIndex(x => x >= t);
  if (k < 0) return y[y.length - 1];
  const u = (t - times[k - 1]) / Math.max(1e-9, times[k] - times[k - 1]);
  return y[k - 1] + (y[k] - y[k - 1]) * u;
}

type Entry = { body: string; clips: Record<string, string | null>; form?: { body: string; clips: Record<string, string | null> } };
const map = JSON.parse(fs.readFileSync('src/engine/client/clips.json', 'utf8')) as Record<string, Entry>;
const jumps = new Map<string, { body: string; clip: string }>();
for (const [slot, entry] of Object.entries(map)) {
  for (const [label, part] of [[slot, entry], [`${slot} (form)`, entry.form]] as const) {
    const clip = part?.clips.jump ?? part?.clips.rise;
    if (!part || !clip || !fs.existsSync(`public${part.body}`) || [...jumps.values()].some(j => j.body === part.body && j.clip === clip)) continue;
    jumps.set(label, { body: part.body, clip });
  }
}

describe('every shipped jump opens moving, not on a crouch key it leaves on the next frames (polish3)', () => {
  it('finds the roster', () => expect(jumps.size).toBeGreaterThan(90));
  for (const [label, { body, clip }] of jumps) {
    it(`${label}: ${body.split('/').pop()} "${clip}"`, () => {
      const h = hips(read(body), clip);
      if (!h || h.times.length < 4) return;
      const p = at(h.times, h.y, .05), q = at(h.times, h.y, .067);
      const plateau = Math.abs(q - p) / Math.abs(p) < .03;
      expect(plateau && h.y[0] < .85 * p, `hips at the first key ${h.y[0].toFixed(3)} against the stand ${p.toFixed(3)} by 0.05 s`).toBe(false);
    });
  }
});
