import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FIGHTERS } from '../src/config';
import { OUTFITS } from '../src/game/economy/outfits';

type Gltf = { accessors: { bufferView?: number; byteOffset?: number; componentType: number; count: number; type: string }[];
  bufferViews: { byteOffset?: number; byteLength: number; byteStride?: number; extensions?: object }[];
  meshes: { name?: string; primitives: { attributes: Record<string, number>; indices?: number; mode?: number }[] }[];
  materials?: { name?: string; normalTexture?: object }[] };

function load(path: string) {
  const file = fs.readFileSync(`public${path}`), length = file.readUInt32LE(12);
  const gltf = JSON.parse(file.subarray(20, 20 + length).toString()) as Gltf;
  return { gltf, bin: file.subarray(20 + length + 8) };
}
function read(gltf: Gltf, bin: Buffer, index: number): number[][] | undefined {
  const a = gltf.accessors[index];
  if (a.bufferView === undefined) return undefined;
  const view = gltf.bufferViews[a.bufferView];
  if (view.extensions) return undefined; // Compressed: not for this reader.
  const width = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type] ?? 1;
  const size = { 5126: 4, 5125: 4, 5123: 2, 5121: 1 }[a.componentType];
  if (!size) return undefined;
  const stride = view.byteStride ?? size * width, start = (view.byteOffset ?? 0) + (a.byteOffset ?? 0), out: number[][] = [];
  for (let k = 0; k < a.count; k++) {
    const row: number[] = [];
    for (let c = 0; c < width; c++) {
      const at = start + k * stride + c * size;
      row.push(a.componentType === 5126 ? bin.readFloatLE(at) : a.componentType === 5125 ? bin.readUInt32LE(at) : a.componentType === 5123 ? bin.readUInt16LE(at) : bin.readUInt8(at));
    }
    out.push(row);
  }
  return out;
}
/** The share of triangles whose averaged vertex normal is within sixty degrees of the triangle's own. */
function agreement(path: string) {
  const { gltf, bin } = load(path);
  let agree = 0, counted = 0;
  for (const mesh of gltf.meshes) for (const p of mesh.primitives) {
    if ((p.mode ?? 4) !== 4 || p.attributes.NORMAL === undefined) continue;
    const P = read(gltf, bin, p.attributes.POSITION), N = read(gltf, bin, p.attributes.NORMAL);
    if (!P || !N || gltf.accessors[p.attributes.NORMAL].componentType !== 5126) continue;
    const I = p.indices !== undefined ? read(gltf, bin, p.indices)?.map(v => v[0]) : P.map((_, k) => k);
    if (!I) continue;
    for (let t = 0; t + 2 < I.length; t += 3) {
      const [a, b, c] = [I[t], I[t + 1], I[t + 2]];
      const e1 = [0, 1, 2].map(k => P[b][k] - P[a][k]), e2 = [0, 1, 2].map(k => P[c][k] - P[a][k]);
      const f = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      const m = [0, 1, 2].map(k => N[a][k] + N[b][k] + N[c][k]);
      const fl = Math.hypot(...f), ml = Math.hypot(...m);
      if (fl < 1e-12 || ml < 1e-12) continue;
      counted++;
      if ((f[0] * m[0] + f[1] * m[1] + f[2] * m[2]) / (fl * ml) > .5) agree++;
    }
  }
  return counted ? agree / counted : 1;
}

const bodies = [...new Set([
  ...Object.values(FIGHTERS).flatMap(f => [f.model, f.formModel]),
  ...Object.values(OUTFITS).map(o => o.model),
].filter((url): url is string => !!url && url.endsWith('.glb') && fs.existsSync(`public${url}`)))].sort();

describe('every body is lit by its own surfaces', () => {
  it.each(bodies)('%s keeps most triangles facing the way their normals say', path => {
    expect(agreement(path), path).toBeGreaterThan(.8);
  }, 60_000);
});
