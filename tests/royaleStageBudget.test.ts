import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ROYALE_STAGES, STAGES, type StageId } from '../src/game/stages';
import { BUILT_PLACES } from '../src/originals/stages';

/**
 * The battle royale's famous places stay cheap: the game loads fast and runs
 * smoothly on players' devices, and a stage is a backdrop behind twelve
 * skinned fighters. Each is held to the budget it was built to: at most 60
 * draw calls, 150k triangles, 1024-pixel textures and 12 MB on the wire before
 * the deploy packer's meshopt. The harbour they replaced as the default was
 * 133 draws, 438k triangles and 33 MB, with a 4096-pixel albedo.
 */
const FAMOUS_PLACES: StageId[] = ['sunward-summit', 'ashfall-weir', 'mirror-mere', 'hollowmere-quarry', 'dry-harbour', 'thornwood-ward', 'kuroyuki-hall', 'starfall-crater'];

function glb(stage: StageId) {
  const file = fs.readFileSync(`public${STAGES[stage].model}`);
  const length = file.readUInt32LE(12), json = JSON.parse(file.subarray(20, 20 + length).toString());
  return { file, json, bin: file.subarray(20 + length + 8) };
}
function imageSize(blob: Buffer): [number, number] {
  if (blob.readUInt32BE(0) === 0x89504e47) return [blob.readUInt32BE(16), blob.readUInt32BE(20)];
  for (let k = 2; k < blob.length - 9;) {
    if (blob[k] !== 0xff) { k++; continue; }
    const marker = blob[k + 1];
    if (marker >= 0xc0 && marker <= 0xc3) return [blob.readUInt16BE(k + 7), blob.readUInt16BE(k + 5)];
    k += 2 + blob.readUInt16BE(k + 2);
  }
  return [0, 0];
}

describe('the battle royale stages stay inside their budget', () => {
  it('are all in the royale pool', () => {
    for (const stage of FAMOUS_PLACES) expect(ROYALE_STAGES).toContain(stage);
  });

  // The eight are built whole in code (src/originals/stages.ts BUILT_PLACES) and ship no model; a place is held to the
  // budget while it ships one.
  it.each(FAMOUS_PLACES.filter(stage => !BUILT_PLACES[stage]))('%s: draws, triangles, textures and bytes', stage => {
    const { file, json, bin } = glb(stage);
    const nodes = (json.nodes as { mesh?: number }[]).filter(n => n.mesh !== undefined);
    const draws = nodes.reduce((n, node) => n + json.meshes[node.mesh!].primitives.length, 0);
    const triangles = nodes.reduce((n, node) => n + (json.meshes[node.mesh!].primitives as { indices?: number }[])
      .reduce((t, p) => t + (p.indices !== undefined ? json.accessors[p.indices].count / 3 : 0), 0), 0);
    expect(draws, 'draw calls').toBeLessThanOrEqual(60);
    expect(triangles, 'triangles').toBeLessThanOrEqual(150_000);
    for (const image of json.images ?? []) {
      const view = json.bufferViews[image.bufferView];
      const [w, h] = imageSize(bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength));
      expect(Math.max(w, h), `${image.name ?? 'image'} is ${w}x${h}`).toBeLessThanOrEqual(1024);
      expect(w * h).toBeGreaterThan(0);
    }
    expect(file.length, 'bytes').toBeLessThanOrEqual(12 * 2 ** 20);
    // Plain glTF: the client has no Draco or KTX2 loader, and the deploy packer
    // only compresses a model that is not compressed already.
    const used: string[] = json.extensionsUsed ?? [];
    for (const ext of ['KHR_draco_mesh_compression', 'KHR_texture_basisu', 'EXT_meshopt_compression', 'KHR_meshopt_compression', 'KHR_mesh_quantization'])
      expect(used, `${stage} ships no ${ext}`).not.toContain(ext);
  });
});
