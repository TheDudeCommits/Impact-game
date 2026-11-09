import { describe, expect, it, vi } from 'vitest';
import { BallMatch } from './BallMatch';
import { LocalBall } from './LocalBall';
import { INTRO, SHORT_INTRO } from './ceremony';

/** The short intro, and PLAY AGAIN as the same match again in place. */
const steps = (m: BallMatch, seconds: number) => { for (let i = 0; i < Math.round(seconds * 60); i++) m.step(1 / 60); };

describe('the short intro', () => {
  it('is the full intro\'s tail: the splash page and the whistle, its countdown that long, and skipped the same way', () => {
    const m = new BallMatch('goal-rush', { seed: 5, access: 'host', fillBots: false, intro: 'short' });
    m.add('red-1', 'taisei', 'Red', false, 'red'); m.add('blue-1', 'gummy', 'Blue', false, 'blue');
    expect(m.start()).toBe(true);
    expect(m.view.intro).toMatchObject({ seconds: SHORT_INTRO.seconds, short: true });
    expect(SHORT_INTRO.seconds).toBeCloseTo(INTRO.seconds - INTRO.splash, 5);
    expect((m.view.startsAt ?? 0) - m.sim.serverTime).toBeCloseTo(SHORT_INTRO.seconds, 3);
    expect(SHORT_INTRO.seconds).toBeLessThan(3);
    m.skip('red-1'); m.skip('blue-1');
    expect(m.view.intro?.skipped).toBe(true);
    steps(m, INTRO.skipTo + .1);
    expect(m.view.phase).toBe('kickoff');
  });
});

describe('PLAY AGAIN on this device', () => {
  it('plays the same match again in place: the same bots on the same sides, the same arena, the next round, the short intro', async () => {
    const local = new LocalBall(), restarted = vi.fn();
    local.onRestart = restarted;
    await local.connect('goal-rush', 'taisei', 'Me');
    const first = local.match!;
    expect(first.view.intro).toMatchObject({ seconds: INTRO.seconds });
    expect(local.rematch()).toBeUndefined(); // not over yet: nothing to play again
    const seats = first.view.seats.map(s => `${s.id}:${s.fighter}:${s.team}`), arena = first.view.arena;
    first.view.phase = 'over';
    await local.rematch();
    const next = local.match!;
    expect(next).not.toBe(first);
    expect(next.view.seats.map(s => `${s.id}:${s.fighter}:${s.team}`)).toEqual(seats);
    expect(next.view.arena).toBe(arena);
    expect(next.view.round).toBe(2);
    expect(next.view.intro).toMatchObject({ seconds: SHORT_INTRO.seconds, short: true });
    expect(next.view.phase).toBe('countdown');
    expect(restarted).toHaveBeenCalledTimes(1);
    expect(local.snapshot?.serverTime).toBeLessThan(1);
    // The same arena flown over before, from the mode's sheet: the short intro too.
    await local.connect('goal-rush', 'taisei', 'Me', undefined, false, false, false, { arena });
    expect(local.match!.view.intro).toMatchObject({ short: true });
    expect(restarted).toHaveBeenCalledTimes(1);
    await local.leave();
  });
});
