import { describe, expect, it } from 'vitest';
import type * as THREE from 'three';
import { Fighter, motionTableBuilt } from '../src/render/Fighter';
import { RUSH_STAGES } from '../src/game/moves';
import { assembleFighter, popBase } from './popHarness';
import type { FighterId, PlayerState } from '../src/game/types';

/** Round 3c (ANIM): "about 100 ms at the start of Shirokane's rush and Ward's
 *  heavy" - the second blind critic's first-use hitch. Timed headless, the
 *  first frame of each move cost 2-31 ms against 0.2-1 ms the second time:
 *  the clip's motion table, the rush stage's measured blow and the body's
 *  samplers and mixer bindings were all built on the frame the move was
 *  first drawn. `prepareRush` (the loading screen's warm-up, and a match
 *  body's creation) builds them now; this holds it to that. */
type Internals = { clipFor(state: PlayerState): THREE.AnimationClip | undefined; poseSamplers: Map<THREE.AnimationClip, unknown>; rushFractions: Map<THREE.AnimationClip, number>; rushPlan?: { ground: (THREE.AnimationClip | undefined)[]; air: (THREE.AnimationClip | undefined)[] } };

describe('a move builds nothing on the frame it is first used', () => {
  it.each(['konta', 'shirokane', 'ward', 'taisei', 'gummy'] as FighterId[])('%s', async id => {
    const { source, rush } = await assembleFighter(id);
    // The loading screen's body, then the match's own, as FighterLibrary does.
    const warm = new Fighter(popBase(id, 'w'), source, false, rush);
    warm.prepareRush();
    const body = new Fighter(popBase(id, 'a'), source, false, rush);
    body.prepareRush();
    const inner = body as unknown as Internals;
    try {
      const clips: THREE.AnimationClip[] = [];
      for (const action of ['light', 'heavy', 'special', 'ultimate'] as const) for (const grounded of [true, false]) {
        const clip = inner.clipFor({ ...body.state, action, chain: 0, grounded });
        if (clip) clips.push(clip);
      }
      for (let stage = 1; stage < RUSH_STAGES; stage++) {
        const clip = inner.clipFor({ ...body.state, action: 'light', chain: stage, grounded: true });
        expect(clip, `stage ${stage}`).toBeTruthy();
        clips.push(clip!);
        expect(inner.rushFractions.has(clip!), `${clip!.name}: the stage's blow is measured`).toBe(true);
      }
      for (const clip of clips) {
        expect(inner.poseSamplers.has(clip), `${clip.name}: its samplers`).toBe(true);
        expect(body.mixer.existingAction(clip), `${clip.name}: its mixer action`).toBeTruthy();
        // Built already, where building it on the frame is 3-16 ms.
        expect(motionTableBuilt(clip), `${clip.name}: its motion table`).toBe(true);
      }
    } finally { body.dispose(); warm.dispose(); }
  }, 120_000);
});
