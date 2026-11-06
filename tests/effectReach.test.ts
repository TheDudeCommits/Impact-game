import { describe, expect, it } from 'vitest';
import { measure } from '../scripts/probe_effect_reach.mts';
import type { AttackSlot, FighterId } from '../src/game/types';

/**
 * Round 3e (ULTFIX): a technique is drawn no further than its blow reaches.
 *
 * The third blind critic: "Shiden's Shrike Bolt: the lightning visibly engulfs a
 * target at 2.6 m that takes nothing; it only hits at 2.2 m or closer." The
 * hand techniques' lightning burst a metre and more from the hand on every
 * swing. Now it stays about the hand - inside the blow's own reach - and
 * bursts in the body a blow landed on (signature/struck). Measured off the
 * effect classes themselves (scripts/probe_effect_reach.mts): a body a
 * quarter metre out of reach has no lightning drawn over it; one the blow
 * landed on has it through them.
 */
const LIGHTNING: [FighterId, AttackSlot][] = [['shiden', 'heavy'], ['shirokane', 'heavy'], ['shirokane', 'ultimate'], ['setsu', 'heavy'], ['setsu', 'ultimate'], ['ward', 'special']];

describe('the lightning - and the Cautery Blade - stops where the blow does', () => {
  it.each(LIGHTNING)('%s %s: nothing over a body just out of reach; into one it landed on', (fighter, slot) => {
    const hand = fighter === 'shiden' || fighter === 'ward' ? 'handL' : 'handR';
    const miss = measure({ fighter, slot, hand }, false), hit = measure({ fighter, slot, hand }, true);
    // Setsu's Thunderbolt comes down out of the sky beside him: the foot of
    // the bolt may lean a hand's breadth past the fist.
    expect(miss.drawn - miss.surface, 'drawn past the near side of a body the blow missed').toBeLessThanOrEqual(fighter === 'setsu' && slot === 'heavy' ? .15 : .02);
    expect(hit.drawn, 'drawn into the body it landed on').toBeGreaterThan(hit.surface + .4);
  });
  it('Ward\'s Counter Shock charge stays about his palms', () => {
    const miss = measure({ fighter: 'ward', slot: 'ultimate', hand: 'handL' }, false);
    expect(miss.drawn).toBeLessThan(miss.surface);
  });
});
