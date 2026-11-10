import { describe, expect, it } from 'vitest';
import { BallMatch } from './BallMatch';
import { BOT_LEVELS, BOT_PLANS, LEVEL_EDGE, PLAN_LINES, dealPlan, type BotLevel, type BotPlan } from './BallBrain';
import { BALL_MODES, type BallModeId, type BallTeam } from './model';

// Difficulty that means something (each level's own levers, LEVEL_EDGE; each mode's own
// bands, BOT_LEVELS) and bots that play like people (a side's plan, PLAN: dealt from the match's seed, said at the start).
const steps = (m: BallMatch, seconds: number) => { for (let i = 0; i < Math.round(seconds * 60); i++) m.step(1 / 60); };
type Brain = { skill: number; plan: BotPlan | null; wing: 1 | -1; edge: (typeof LEVEL_EDGE)[BotLevel] };
const brains = (m: BallMatch) => (m as unknown as { brains: Map<string, Brain> }).brains;

/** A match against bots on this device: a person on red (and on blue with `rivals`), the rest bots at `difficulty`. */
function bots(mode: BallModeId, difficulty?: BotLevel, rivals = false, seed = 8) {
  const m = new BallMatch(mode, { seed, access: 'bots', difficulty });
  m.add('me', 'taisei', 'Me', false, 'red');
  if (rivals) m.add('p2', 'konta', 'P2', false, 'blue');
  expect(m.start()).toBe(true);
  return m;
}
const side = (m: BallMatch, team: BallTeam) => [...brains(m)].filter(([id]) => m.seats.get(id)!.team === team).map(([, b]) => b);

describe('ball modes: the levels\' own levers', () => {
  it('leaves NORMAL\'s bots as they were and makes HARD\'s sharper on every lever, EASY\'s no sharper', () => {
    const N = LEVEL_EDGE.normal, H = LEVEL_EDGE.hard, E = LEVEL_EDGE.easy;
    // NORMAL: every factor 1 and every share 0 - no new draw from a match's stream.
    for (const k of ['read', 'keeper', 'timing', 'again', 'react', 'form', 'quickSet'] as const) expect(N[k]).toBe(1);
    for (const k of ['dive', 'corner', 'tackle', 'link', 'mark', 'stuff', 'quickRead', 'jumpServe', 'tip'] as const) expect(N[k]).toBe(0);
    // HARD: reads and errors smaller, the choices that win points more often.
    for (const k of ['read', 'keeper', 'timing', 'again', 'react', 'form'] as const) { expect(H[k]).toBeLessThan(1); expect(E[k]).toBeGreaterThanOrEqual(1); }
    for (const k of ['dive', 'corner', 'tackle', 'link', 'mark', 'stuff', 'quickRead', 'jumpServe', 'tip'] as const) { expect(H[k]).toBeGreaterThan(0); expect(E[k]).toBeLessThanOrEqual(0); }
    expect(H.quickSet).toBeGreaterThan(1);
  });
  it('gives the other side\'s bots their level\'s levers and each mode its own bands', () => {
    for (const mode of BALL_MODES) for (const difficulty of ['easy', 'normal', 'hard'] as const) {
      const m = bots(mode, difficulty), shape = BOT_LEVELS[mode][difficulty];
      for (const b of side(m, 'blue')) { expect(b.edge).toBe(LEVEL_EDGE[difficulty]); expect(b.skill).toBeGreaterThanOrEqual(shape.lo - 1e-9); expect(b.skill).toBeLessThanOrEqual(shape.lo + shape.span + 1e-9); }
      for (const b of side(m, 'red')) expect(b.edge).toBe(LEVEL_EDGE[shape.mates]);
      m.dispose();
    }
    // HARD is a step up from NORMAL in both modes: its band starts no lower (Sky Spike's is NORMAL's: its step is the
    // levers, and a side that hardly eases off ahead).
    for (const mode of BALL_MODES) expect(BOT_LEVELS[mode].hard.lo).toBeGreaterThanOrEqual(BOT_LEVELS[mode].normal.lo);
    expect(BOT_LEVELS['sky-spike'].hard.ease).toBeLessThan(BOT_LEVELS['sky-spike'].normal.ease);
  });
});

describe('ball modes: a side\'s plan', () => {
  it('deals each mode its own plans from the seed and the side - the same every time, each plan and wing in turn', () => {
    for (const mode of BALL_MODES) {
      const seen = new Set<string>();
      for (let seed = 1; seed <= 60; seed++) for (const team of ['red', 'blue'] as const) {
        const a = dealPlan(mode, seed, team), b = dealPlan(mode, seed, team);
        expect(a).toEqual(b);
        expect(BOT_PLANS[mode]).toContain(a.plan);
        expect(PLAN_LINES[mode][a.plan]).toBeTruthy();
        seen.add(`${a.plan}:${a.wing}`);
      }
      expect(seen.size).toBe(BOT_PLANS[mode].length * 2);
      // (A rematch deals again.)
      expect(Array.from({ length: 20 }, (_, i) => dealPlan(mode, 7, 'red', i + 1).plan)).not.toEqual(Array(20).fill(dealPlan(mode, 7, 'red', 1).plan));
    }
  });
  it('gives a side of bots alone its plan, says it after the kickoff, and leaves a person\'s team-mates to follow the person', () => {
    for (const mode of BALL_MODES) {
      const m = bots(mode, 'hard');
      const theirs = side(m, 'blue'), mine = side(m, 'red');
      expect(new Set(theirs.map(b => `${b.plan}:${b.wing}`)).size).toBe(1);
      expect(theirs[0].plan).not.toBeNull();
      for (const b of mine) expect(b.plan).toBeNull();
      steps(m, (m.view.startsAt ?? 0) - m.sim.serverTime + 1.6);
      const said = m.view.events.filter(e => e.kind === 'chat');
      expect(said.some(e => e.team === 'blue' && e.text === PLAN_LINES[mode][theirs[0].plan!])).toBe(true);
      expect(said.some(e => e.team === 'red' && Object.values(PLAN_LINES[mode]).includes(e.text ?? ''))).toBe(false);
      m.dispose();
    }
  });
  it('deals no plan with people on both sides, nor in FREE PLAY', () => {
    const m = bots('goal-rush', 'normal', true);
    for (const b of brains(m).values()) expect(b.plan).toBeNull();
    m.dispose();
    const couch = bots('sky-spike', 'normal', true);
    for (const b of brains(couch).values()) expect(b.plan).toBeNull();
    couch.dispose();
    const free = new BallMatch('sky-spike', { seed: 3, access: 'bots', practice: true });
    free.add('me', 'taisei', 'Me', false, 'red'); free.start();
    for (const b of brains(free).values()) expect(b.plan).toBeNull();
    free.dispose();
  });
  it('puts a level that is not NORMAL on the view, for the lobby and the results', () => {
    expect(bots('sky-spike', 'hard').view.level).toBe('hard');
    expect(bots('goal-rush', 'easy').view.level).toBe('easy');
    expect(bots('goal-rush').view.level).toBeUndefined();
  });
});
