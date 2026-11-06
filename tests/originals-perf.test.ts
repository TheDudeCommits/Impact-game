import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FIGHTERS } from '../src/config';
import type { FighterId } from '../src/game/types';
import { ORIGINALS } from '../src/originals/roster';

const TRIS = 32_000, SKIN_VERTS = 26_000;
/** Measured exceptions, each with what it holds. Shijima's awakened form carries a halo of wings drawn faceted: 9 300
 *  triangles on 17 700 vertices (every face its own normals), which no simplification can thin without smoothing it. */
const OVER: Record<string, { skinVerts: number }> = { '/assets/fighters/shijima-form-tr1.glb': { skinVerts: 34_000 } };

/** Slots whose body files another agent is still rebuilding (5 November): none. clips-r1's, clips-r3's, Kenzo's, Cardo's,
 *  Akaito's and Lucy's (after her lag fix) bodies were slimmed after their merges, fix-polish2's 16 on its own branch after
 *  their clean clips. */
const WAITING = new Set<string>([
]);
const NEVER = new Set(['/assets/fighters/barrow-tr1.glb', '/assets/fighters/kenzo-awakened-tr1.glb']);

type Json = { nodes: { name?: string; mesh?: number; skin?: number }[]; meshes: { primitives: { attributes: Record<string, number>; indices?: number }[] }[]; accessors: { count: number }[] };
function weight(url: string) {
  const b = fs.readFileSync(`public${url}`), n = b.readUInt32LE(12), j = JSON.parse(b.subarray(20, 20 + n).toString('utf8')) as Json;
  let tris = 0, skinVerts = 0, awakenTris = 0;
  const seen = new Set<number>();
  for (const node of j.nodes) {
    if (node.mesh === undefined || node.skin === undefined || seen.has(node.mesh)) continue;
    seen.add(node.mesh);
    for (const p of j.meshes[node.mesh].primitives) {
      const t = p.indices === undefined ? 0 : j.accessors[p.indices].count / 3;
      if (/^awaken-on/.test(node.name ?? '')) { awakenTris += t; continue; }
      tris += t; skinVerts += j.accessors[p.attributes.POSITION].count;
    }
  }
  return { tris, skinVerts, awakenTris };
}

const bodies = (Object.keys(ORIGINALS) as FighterId[]).flatMap(id => [FIGHTERS[id].model, FIGHTERS[id].formModel].filter((url): url is string => !!url && !NEVER.has(url)).map(url => ({ id, url })));

describe('the originals\' bodies hold Impact\'s budget (perf pass)', () => {
  it('finds the bodies it measures', () => expect(bodies.filter(b => !WAITING.has(b.id)).length).toBeGreaterThanOrEqual(30));
  it.each(bodies.filter(b => !WAITING.has(b.id)).map(b => [`${b.id} ${b.url.split('/').pop()}`, b.url]))('%s', (_, url) => {
    const w = weight(url);
    expect(w.tris).toBeLessThanOrEqual(TRIS);
    expect(w.skinVerts).toBeLessThanOrEqual(OVER[url]?.skinVerts ?? SKIN_VERTS);
    expect(w.awakenTris).toBeLessThanOrEqual(TRIS);
  });
});
