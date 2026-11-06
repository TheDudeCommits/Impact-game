import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FIGHTERS } from '../src/config';
import type { FighterId } from '../src/game/types';

// The same table scripts/skeleton_map.py resolves with, read rather than
// restated: two copies of this would drift, and the whole point of it is that
// one rig spelling its joints differently must never again go unnoticed.
const ALIASES: Record<string, string[]> = JSON.parse(fs.readFileSync('src/game/data/skeletonAliases.json', 'utf8'));
const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
// scripts/skeleton_map.py `_PREFIXES` and `_loose`, kept in step by hand
// because one is Python and one is TypeScript. The table itself is shared.
const PREFIXES = ['mixamorig1:', 'mixamorig:', 'mixamorig1', 'mixamorig', 'armature|', 'bip01 ', 'bip001 '];
/** `mixamorig:LeftUpLeg_056` -> `leftupleg`. Only an underscore- or
 *  dot-separated numeric tail is dropped: a bare trailing digit belongs to the
 *  name, and eating it would collapse `Spine1` onto `Spine`. */
function loose(name: string) {
  let out = name.toLowerCase();
  for (const p of PREFIXES) if (out.startsWith(p)) { out = out.slice(p.length); break; }
  for (;;) {
    const m = out.match(/^(.*)[_.](\d+)$/);
    if (!m) break;
    out = m[1];
  }
  return key(out);
}
function joints(id: FighterId): string[] {
  const file = fs.readFileSync(`public${FIGHTERS[id].model}`);
  const json = JSON.parse(file.subarray(20, 20 + file.readUInt32LE(12)).toString());
  const skin = (json.skins ?? [])[0];
  return skin ? skin.joints.map((i: number) => json.nodes[i].name) : [];
}
/** scripts/skeleton_map.py resolve(), in the same three passes: exact
 *  spellings claim their bone, then aliases, then decorated forms - and the
 *  loose pass refuses anything ambiguous, because handing `DEF_Spine_001` to
 *  `Spine` on a coin flip is the silent mispairing this exists to prevent. */
function resolve(names: string[]) {
  const have = new Map<string, string>();
  for (const n of names) if (!have.has(key(n))) have.set(key(n), n);
  const byLoose = new Map<string, string[]>();
  for (const n of names) { const k = loose(n); byLoose.set(k, [...(byLoose.get(k) ?? []), n]); }
  const found: Record<string, string> = {}, taken = new Set<string>();
  const claim = (c: string, a: string) => { found[c] = a; taken.add(a); };
  for (const canonical of Object.keys(ALIASES)) {
    const actual = have.get(key(canonical));
    if (actual !== undefined) claim(canonical, actual);
  }
  for (const [canonical, spellings] of Object.entries(ALIASES)) {
    if (found[canonical]) continue;
    for (const spelling of spellings) {
      const actual = have.get(key(spelling));
      if (actual !== undefined && !taken.has(actual)) { claim(canonical, actual); break; }
    }
  }
  for (const [canonical, spellings] of Object.entries(ALIASES)) {
    if (found[canonical]) continue;
    for (const spelling of [canonical, ...spellings]) {
      const options = (byLoose.get(loose(spelling)) ?? []).filter(n => !taken.has(n));
      if (options.length === 1) { claim(canonical, options[0]); break; }
    }
  }
  return found;
}

const roster = Object.keys(FIGHTERS) as FighterId[];
// The joints a donation needs on both sides to carry a performance.
const NEEDED = ['Hips', 'Spine', 'Neck', 'Head', 'LeftArm', 'RightArm', 'LeftForeArm', 'RightForeArm',
  'LeftUpLeg', 'RightUpLeg', 'LeftLeg', 'RightLeg', 'LeftFoot', 'RightFoot'];

describe('the roster speaks one skeleton', () => {
  // Taisei's Meshy rebuild calls his hips DEF_Pelvis and his thighs DEF_Thigh.L.
  // Every donation paired bones by identical name, so for him the pair set was
  // empty and the transfer silently did nothing at all - no error, no warning,
  // just a fighter who could never be given a clip. He was the last fighter in
  // the roster who skated, and this is why.
  it.each(roster)('%s resolves every joint a donation needs', id => {
    const found = resolve(joints(id));
    const missing = NEEDED.filter(n => !found[n]);
    expect(missing, `${id} cannot be paired on ${missing.join(', ')} - add its spellings to src/game/data/skeletonAliases.json`)
      .toEqual([]);
  });

  it('never gives two canonical bones the same joint', () => {
    for (const id of roster) {
      const found = resolve(joints(id));
      const used = Object.values(found);
      expect(new Set(used).size, `${id} maps two bones onto one joint`).toBe(used.length);
    }
  });

  // Nine of the ten already agree; the resolver must leave those alone rather
  // than quietly re-pointing a bone that was working.
  it('leaves a rig that already uses the canonical names untouched', () => {
    for (const id of roster.filter(f => f !== 'taisei')) {
      const found = resolve(joints(id));
      for (const [canonical, actual] of Object.entries(found))
        expect(actual, `${id}'s ${canonical} was re-pointed at ${actual}`).toBe(canonical);
    }
  });
});
