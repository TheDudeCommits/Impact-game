import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { DREAM_IMPACT } from '../src/render/dreamFlag';
import { DREAM_FLINCH, DREAM_HURTS, Fighter, dreamHurt } from '../src/render/Fighter';
import type { FighterId } from '../src/game/types';
import { loadRigWithExtras } from './extraClips';
import { base } from './rigHarness';
import { allPops, buildBody, victimRun, type Press, type ReactSample } from './reactHarness';

/** The dream loop, round 28 (scripts/fanim/dream_hurts.py): a body struck on its feet is drawn with one of four authored
 *  hurts - snapped back, doubled over, spun to its left or right - taking turns through a string, where it played its
 *  one hurt on every blow; and its flinch jolts the arms out, where the roster's cringe snatched them in (Ouga's never
 *  left his crossed-arm stance). Taisei's (taisei-fanim7) and Ouga's (ouga-fanim7). */
const BODIES: [FighterId, string, string][] = [['taisei', 'adapted_hit', 'shake'], ['ouga', 'Hit 01', 'shake']];
const TAKES = Object.values(DREAM_HURTS);
const CORE = ['Hips', 'Spine', 'Spine1', 'Neck', 'Head', 'LeftArm', 'LeftForeArm', 'RightArm', 'RightForeArm', 'LeftUpLeg', 'LeftLeg', 'RightUpLeg', 'RightLeg'];

describe('the takes', () => {
  it.each(BODIES)('%s carries them at its own hurt\'s and flinch\'s lengths, every core joint keyed', async (id, hurt, flinch) => {
    const body = new Fighter(base(id), await loadRigWithExtras(id));
    try {
      const clip = (name: string) => body.clips.find(c => c.name === name);
      for (const name of [...TAKES, DREAM_FLINCH]) {
        const take = clip(name);
        expect(take, name).toBeDefined();
        const own = clip(name === DREAM_FLINCH ? flinch : hurt)!;
        expect(Math.abs(take!.duration - own.duration), `${name}'s length`).toBeLessThan(1 / 30);
        // restore_still: no joint left to keep another clip's pose.
        const keyed = new Set(take!.tracks.map(t => THREE.PropertyBinding.parseTrackName(t.name).nodeName));
        const loose = CORE.map(k => body.joints.get(k)?.name).filter((n): n is string => !!n && !keyed.has(n));
        expect(loose, `${name}: core joints left unkeyed`).toEqual([]);
      }
    } finally { body.dispose(); }
  }, 60_000);
});

describe('which take a blow is drawn with', () => {
  it('takes turns through a string: snapped back, folded, spun the way the blow went (round 29: as the dream string throws a punch, a knee, a kick)', () => {
    // (Round 87: folded first, then snapped back, then spun.)
    expect([0, 1, 2, 3, 4, 5].map(stage => dreamHurt(stage, 1))).toEqual(['dream fold', 'dream back', 'dream spin L', 'dream fold', 'dream back', 'dream spin L']);
    expect(dreamHurt(2, -1)).toBe('dream spin R');
  });

  it('in lock combat, ends each round of three on the fold, so the body held through the beat is bent over facing its thrower', () => {
    expect([0, 1, 2, 3, 4, 5].map(stage => dreamHurt(stage, 1, true))).toEqual(['dream back', 'dream spin L', 'dream fold', 'dream back', 'dream spin L', 'dream fold']);
    expect(dreamHurt(1, -1, true)).toBe('dream spin R');
  });
});

const STRING: Press[] = [0, 9, 18, 27].map(t => ({ tick: 30 + t, attack: 'light' }));
const sub = (a: number[], b: number[]) => a.map((v, i) => v - b[i]);
/** Each stretch of a hurt, by clip: the head off the hips (body-local, metres) 0.12 s into it - the struck blend done,
 *  the recoil at its peak - against the stance before the first blow. */
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
describe.runIf(DREAM_IMPACT)('a string on a body with the takes', () => {
  it.each([['ouga', 'taisei'], ['taisei', 'ouga']] as [FighterId, FighterId][])('%s under %s\'s string', async (id, by) => {
    const victim = await buildBody(id, 'b'), attacker = await buildBody(by, 'a');
    try {
      const { samples } = victimRun(victim, attacker, STRING, 230, { seed: 7 });
      // Never a jump of a frame (the critic's measure: a hand over 8 cm or a head over 6 cm, three times the frames
      // around it).
      expect(allPops(samples).map(p => `${p.key} ${p.cm} cm ${p.action} ${p.clip}`)).toEqual([]);
      const hurts = struck(samples);
      expect(hurts.map(h => h.clip).slice(0, 3)).toEqual(['DZ recoil fold', 'DZ recoil back', expect.stringMatching(/^DZ recoil spin [LR]$/)]);
      // Each its own way, as far as it goes: the head thrown back, carried across to the side the body turns, folded
      // down in front - where the body's own hurt took it 11 cm (Ouga's, under Taisei's string).
      const [fold, back, spin] = hurts.map(h => h.head!);
      expect(back[2], 'the snap-back: the head back, metres').toBeLessThan(-.1);
      expect(Math.abs(spin[0]), 'the spin: the head across, metres').toBeGreaterThan(.08);
      expect(Math.sign(spin[0]), 'the spin: across to the side it turns').toBe(hurts[2].clip.endsWith('L') ? 1 : -1);
      expect(fold[2], 'the fold: the head down in front, metres').toBeGreaterThan(.15);
    } finally { victim.dispose(); attacker.dispose(); }
  }, 120_000);

  it('and, the takes off, the body\'s own hurt on every blow', async () => {
    Fighter.dreamTakes = false;
    const victim = await buildBody('ouga', 'b'), attacker = await buildBody('taisei', 'a');
    try {
      const { samples } = victimRun(victim, attacker, STRING, 230, { seed: 7 });
      expect([...new Set(samples.filter(s => s.action === 'hurt').map(s => s.clip))]).toEqual(['Hit 01']);
    } finally { Fighter.dreamTakes = true; victim.dispose(); attacker.dispose(); }
  }, 120_000);
});
