import fs from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { FIGHTERS } from '../src/config';
import type { FighterId } from '../src/game/types';
import { DREAM_IMPACT } from '../src/render/dreamFlag';
import { DREAM_FLINCH, DREAM_HURTS, Fighter } from '../src/render/Fighter';
import { HURT_DONOR, borrowReport, borrowedHurt, installBorrowedHurts, resetBorrowedHurts } from '../src/engine/client/borrowedHurts';
import { decodeTakePack } from '../src/engine/client/takePacks';
import { loadRig } from './rigHarness';
import { assembleFighter } from './popHarness';
import { allPops, buildBody, victimRun, type Press, type ReactSample } from './reactHarness';

/** The borrowed hurts (src/engine/client/borrowedHurts.ts): Taisei's authored hurts - doubled over, snapped back,
 *  spun, and the flinch - fitted to every body whose files carry none, where the other ninety-five played their one
 *  'Hit 01' on every blow of a string. The donor read off the disk as the page fetches it: his take pack's rig, his
 *  takes' file. */
const donor = async () => {
  const bytes = fs.readFileSync(`public/assets/fighters/takes/${HURT_DONOR.fighter}.bin`);
  const rig = decodeTakePack(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)).takes.light!.open.rig;
  return { rig, clips: (await Promise.all(HURT_DONOR.files.map(url => loadRig(url)))).flatMap(file => file.animations) };
};
beforeAll(async () => { await installBorrowedHurts(donor); });
afterAll(() => resetBorrowedHurts());

const KEYS = [...Object.keys(DREAM_HURTS), 'dream flinch', 'abdomen'];
const NAMES = [...Object.values(DREAM_HURTS), DREAM_FLINCH, 'heavy-abdomen-fold'];
/** The bodies with takes of their own. */
const OWN = new Set<FighterId>(['taisei', 'ouga']);
/** Bodies that keep their own acting (borrowedHurts.ts OWN_ACTING). */
const NATIVE = new Set<FighterId>(['gorai']);

describe('the takes, fitted to every body', () => {
  it('every other roster rig takes all six, keyed on its own joints, finite; Gorai keeps its own', async () => {
    const refused: string[] = [];
    for (const id of Object.keys(FIGHTERS) as FighterId[]) {
      if (OWN.has(id)) continue;
      const { source } = await assembleFighter(id);
      for (const [i, key] of KEYS.entries()) {
        const clip = borrowedHurt(source.scene, source.animations, key, id);
        if (NATIVE.has(id)) { expect(clip, `${id} ${key}`).toBeUndefined(); continue; }
        if (!clip) { refused.push(`${id} ${NAMES[i]}: ${borrowReport()[`${id}: ${NAMES[i]}`]?.reason}`); continue; }
        expect(clip.name, `${id} ${key}`).toBe(NAMES[i]);
        for (const track of clip.tracks) {
          expect(THREE.PropertyBinding.findNode(source.scene, THREE.PropertyBinding.parseTrackName(track.name).nodeName), `${id} ${track.name}`).toBeTruthy();
          expect([...track.values].every(Number.isFinite), `${id} ${track.name}`).toBe(true);
        }
      }
    }
    expect(refused, 'rigs the fit refused').toEqual([]);
  }, 900_000);
});

const STRING: Press[] = [0, 9, 18, 27].map(t => ({ tick: 30 + t, attack: 'light' }));
const sub = (a: number[], b: number[]) => a.map((v, i) => v - b[i]);
/** Each stretch of a hurt, by clip: the head off the hips (body-local, metres) 0.12 s into it, against the stance. */
function struck(samples: ReactSample[]) {
  const rest = samples.find((s, i) => s.action === 'idle' && samples[i + 1]?.action !== 'idle')!;
  const home = sub(rest.head, rest.hips!);
  const out: { clip: string; head?: number[]; t0: number }[] = [];
  for (const s of samples) {
    if (s.action !== 'hurt') continue;
    if (!out.length || out[out.length - 1].clip !== s.clip) out.push({ clip: String(s.clip), t0: s.t });
    const seg = out[out.length - 1];
    if (!seg.head && s.t - seg.t0 >= .12) seg.head = sub(sub(s.head, s.hips!), home);
  }
  return out;
}
/** Victims across the rig families (Dust Sea's, Cinder Requiem's, Konta's, Mixamo's, Meshy's), the sizes (Haldor,
 *  Torsion 1.48 m) and the armed; each under a string of its own kind. */
const UNDER: [FighterId, FighterId][] = [['konta', 'tempo'], ['gummy', 'konta'], ['kenzo', 'gummy'], ['nigo', 'taisei'], ['haldor', 'taisei'], ['torsion', 'konta'], ['magatsu', 'tempo'], ['tempo', 'ampere']];
describe.runIf(DREAM_IMPACT)('a string on a body with borrowed takes', () => {
  it.each(UNDER)('%s under %s\'s string: each blow its own take, no jump of a frame', async (id, by) => {
    const victim = await buildBody(id, 'b'), attacker = await buildBody(by, 'a');
    try {
      const { samples } = victimRun(victim, attacker, STRING, 230, { seed: 7 });
      // Never a jump of a frame (a hand over 8 cm or a head over 6 cm, three times the frames around it).
      expect(allPops(samples).map(p => `${p.key} ${p.cm} cm ${p.action} ${p.clip}`)).toEqual([]);
      const hurts = struck(samples);
      expect(hurts.map(h => h.clip).slice(0, 3)).toEqual(['DZ recoil fold', 'DZ recoil back', expect.stringMatching(/^DZ recoil spin [LR]$/)]);
      // Each its own way: the head folded down in front, then thrown back off the fold, then carried across to the side
      // the body turns (in heights: Gorai's 2.6 m to Torsion's 1.48).
      const [fold, back, spin] = hurts.map(h => h.head!), tall = FIGHTERS[id].height ?? 1.8;
      expect(fold[2] / tall, 'the fold: the head down in front').toBeGreaterThan(.05);
      expect((fold[2] - back[2]) / tall, 'the snap-back: the head back off the fold').toBeGreaterThan(.1);
      expect(Math.abs(spin[0]) / tall, 'the spin: the head across').toBeGreaterThan(.03);
    } finally { victim.dispose(); attacker.dispose(); }
  }, 180_000);

  it('the takes off (`?dreamoff`), the body\'s own hurt on every blow', async () => {
    Fighter.dreamTakes = false;
    const victim = await buildBody('konta', 'b'), attacker = await buildBody('tempo', 'a');
    try {
      const { samples } = victimRun(victim, attacker, STRING, 230, { seed: 7 });
      expect([...new Set(samples.filter(s => s.action === 'hurt').map(s => s.clip))]).toEqual(['Hit 01']);
    } finally { Fighter.dreamTakes = true; victim.dispose(); attacker.dispose(); }
  }, 120_000);
});
