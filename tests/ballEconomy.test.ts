import { describe, expect, it } from 'vitest';
import { payFor, plausible, type MatchReport } from '../src/game/economy/earn';
import { DAILY, DAILY_CHALLENGES, WEEKLY_CHALLENGES } from '../src/game/economy/missions';
import { modesOf, tallyModes } from '../src/game/economy/modeStats';
import { ballReportOf, type BallView } from '../src/game/ball/model';

/** A ball match's report, as a page or a room sends it (economy/device.ts, server/economy/RoomRewards.ts). */
const report = (o: Partial<MatchReport> = {}): MatchReport => ({ id: 'ball-report-1', fighter: 'konta', seconds: 300, mode: 'bots', practice: true, place: 1, players: 6, kos: 0,
  ball: 'goal-rush', scored: 2, saves: 1, ...o });
const count = (id: string, r: MatchReport) => [...DAILY, ...DAILY_CHALLENGES, ...WEEKLY_CHALLENGES].find(m => m.id === id)!.count(r, { fighter: false });

describe('the ball modes in the economy', () => {
  it('reads a seat\'s line into its report: Goal Rush goals and saves, Sky Spike points of their own and blocks and digs', () => {
    const seat = { id: 'me', goals: 3, saves: 2, kills: 5, aces: 1, blocks: 2, digs: 4 };
    expect(ballReportOf({ mode: 'goal-rush', seats: [seat] } as unknown as BallView, 'me')).toEqual({ ball: 'goal-rush', scored: 3, saves: 2 });
    expect(ballReportOf({ mode: 'sky-spike', seats: [seat] } as unknown as BallView, 'me')).toEqual({ ball: 'sky-spike', scored: 6, saves: 6 });
    expect(ballReportOf(undefined, 'me')).toEqual({});
  });
  it('keeps the fields, no more of them than the match\'s length allows from a page', () => {
    const kept = plausible(report({ scored: 50, saves: 900 }));
    expect('report' in kept && kept.report).toMatchObject({ ball: 'goal-rush', scored: Math.floor(300 / 8), saves: 60 });
    const verified = plausible(report({ scored: 50 }), true);
    expect('report' in verified && verified.report).toMatchObject({ scored: 50 });
    const nonsense = plausible({ ...report(), ball: 'tennis' } as unknown as MatchReport);
    expect('report' in nonsense && (nonsense.report as MatchReport).ball).toBeUndefined();
  });
  it('pays as a team battle with what was scored and saved, never a royale\'s place', () => {
    const won = payFor(report({ practice: false, mode: 'match' })), lost = payFor(report({ practice: false, mode: 'match', place: 2, scored: 0, saves: 0 }));
    expect(won.map(l => l.label)).toEqual(['Goal Rush match completed', 'Team victory', '2 goals', '1 save']);
    expect(won.reduce((n, l) => n + l.amount, 0)).toBe(8 + 12 + 6 + 1);
    expect(lost.map(l => l.label)).toEqual(['Goal Rush match completed']);
    expect(payFor(report({ ball: 'sky-spike', scored: 7, saves: 3 })).map(l => l.label)).toEqual(['Sky Spike match completed', 'Team victory', '7 points of your own', '3 blocks and digs']);
  });
  it('counts toward its own challenges, and a lost one is no royale top three and no podium', () => {
    expect(count('d-goal-rush-goals', report())).toBe(2);
    expect(count('d-sky-spike-win', report({ ball: 'sky-spike' }))).toBe(1);
    expect(count('d-sky-spike-win', report({ ball: 'sky-spike', place: 2 }))).toBe(0);
    expect(count('w-sky-spike-points-20', report({ ball: 'sky-spike', scored: 6 }))).toBe(6);
    expect(count('d-royale-top-3', report({ place: 2 }))).toBe(0);
    expect(count('d-top-3', report({ place: 2 }))).toBe(0);
    expect(count('d-top-3', report())).toBe(1);
  });
  it('tallies a ball win as the mode\'s, never a Battle Royale\'s', () => {
    const stats: { modes?: ReturnType<typeof modesOf> } = {};
    tallyModes(stats, report({ scored: 3 }));
    tallyModes(stats, report({ ball: 'sky-spike', scored: 8, place: 2 }));
    expect(modesOf(stats)).toMatchObject({ goalRushWins: 1, goals: 3, bestGoals: 3, skySpikeWins: 0, spikePoints: 8, royaleWins: 0 });
  });
});
