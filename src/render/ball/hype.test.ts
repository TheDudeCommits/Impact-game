import {describe, expect, it} from 'vitest';
import {forgetGoal, goalNetHit, goalNetPower} from './hype';

describe('a goal put away', () => {
  it('leaves nothing for the next match to celebrate', () => {
    const now = 1234.5;
    goalNetHit.value.set(1, 2, 19, now); goalNetPower.value = .8;
    // BallArena.update's test: the celebration is drawn for the ten seconds after the hit.
    const drawn = (time: number) => { const since = time - goalNetHit.value.w; return since >= 0 && since < 10; };
    expect(drawn(now + 2)).toBe(true);
    forgetGoal();
    expect(drawn(now + 2)).toBe(false);
    expect(goalNetPower.value).toBe(0);
  });
});
