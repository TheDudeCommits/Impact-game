import { describe, expect, it } from 'vitest';
import contactFrames from '../src/game/data/contactFrames.json';
import { FIGHTERS } from '../src/config';
import { Fighter, bindClips } from '../src/render/Fighter';
import type { FighterId, PlayerState } from '../src/game/types';
import { base, loadRig } from './rigHarness';
import { loadRigWithExtras } from './extraClips';

/** Where each rush stage's blow is drawn in its clip (Fighter.rushFraction) is a property of the clip: an authored
 *  stage clip lands where its own stage was measured (contactFrames.json rush1..rush3), whichever stage first met it.
 *  The warm-up used to meet some first as an air string's opening stage and keep that stage's contact for the clip -
 *  Ouga's and Shirokane's Rush 3 drew their blow at 0.49 of the clip on the ground instead of 0.40. */
const TABLE = contactFrames as Partial<Record<FighterId, Record<string, number>>>;
const authored = (Object.keys(FIGHTERS) as FighterId[]).filter(id => FIGHTERS[id].rushClips && [1, 2, 3].some(n => TABLE[id]?.[`rush${n}`] !== undefined));

describe('the rush stages land where their clips were measured', () => {
  it.each(authored)('%s', async id => {
    // The body as FighterLibrary builds it: its own clips and extraModels, and the rush file's clips beside them.
    const rig = await loadRigWithExtras(id), url = FIGHTERS[id].rushModel;
    const rush = url ? bindClips(rig.scene, (await loadRig(url)).animations, id) : undefined;
    const body = new Fighter(base(id), rig, false, rush);
    try {
      // As the game does when a body loads: the rush plan, and the warm-up that meets every stage's clip.
      body.prepareRush();
      const plan = (body as unknown as { rushPlan?: { ground: ({ name: string } | undefined)[] } }).rushPlan;
      const fraction = (clip: unknown, stage: number) => (body as unknown as { rushFraction(c: unknown, s: number, st: PlayerState): number })
        .rushFraction(clip, stage, { ...base(id), action: 'light', chain: stage, grounded: true });
      for (let stage = 1; stage <= 3; stage++) {
        const clip = plan?.ground[stage - 1], measured = TABLE[id]?.[`rush${stage}`];
        const authoredClip = (body as unknown as { rushAuthored: Set<unknown> }).rushAuthored.has(clip);
        if (!clip || !authoredClip || measured === undefined || TABLE[id]?.[clip.name] !== undefined) continue;
        expect(fraction(clip, stage), `${id} stage ${stage} (${clip.name})`).toBeCloseTo(measured, 4);
      }
    } finally { body.dispose(); }
  }, 60_000);
});
