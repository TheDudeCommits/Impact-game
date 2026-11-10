import { describe, expect, it } from 'vitest';
import { BallMatch, SWINGS } from './BallMatch';
import { BOT_LEVELS as LEVELS, COMPOSURE, FORM, LEVEL_EDGE, REACT, type BotLevel } from './BallBrain';
// (Each mode has its own levels; these are Sky Spike's.)
const BOT_LEVELS = LEVELS['sky-spike'];
import { SPIKE_RULES, type BallTeam } from './model';

// Sky Spike's matches that go down to the wire (FEVER for the side behind, the bots' form and
// composure), and the bots' level the player picks (EASY, NORMAL, HARD).
const steps = (m: BallMatch, seconds: number) => { for (let i = 0; i < Math.round(seconds * 60); i++) m.step(1 / 60); };
type Private = { point(winner: BallTeam, why: 'floor' | 'out' | 'touches' | 'serve', byId?: string): void; climb(to: BallTeam): void; brains: Map<string, { skill: number; sk: number; composed: boolean }> };
const inside = (m: BallMatch) => m as unknown as Private;

/** Two people, one a side, nobody else. */
function pair() {
  const m = new BallMatch('sky-spike', { seed: 3, access: 'host', fillBots: false });
  m.add('red-1', 'taisei', 'Red', false, 'red');
  m.add('blue-1', 'konta', 'Blue', false, 'blue');
  expect(m.start()).toBe(true);
  steps(m, 3.1);
  return m;
}
/** A point to `winner` at `red`-`blue`, in a FEVER rally or not: what it was worth. */
function scored(winner: BallTeam, red: number, blue: number, fever = true) {
  const m = pair();
  m.view.score.red = red; m.view.score.blue = blue; m.view.fever = fever; m.view.phase = 'live';
  inside(m).point(winner, 'floor');
  return m.view.score[winner] - (winner === 'red' ? red : blue);
}
/** A match against bots on this device: a person on red (or on both sides), the rest bots at `difficulty`. */
function bots(difficulty?: BotLevel, rivals = false) {
  const m = new BallMatch('sky-spike', { seed: 8, access: 'bots', difficulty });
  m.add('me', 'taisei', 'Me', false, 'red');
  if (rivals) m.add('p2', 'konta', 'P2', false, 'blue');
  expect(m.start()).toBe(true);
  const level = new Map<string, { skill: number; composed: boolean; team: BallTeam }>();
  for (const [id, brain] of inside(m).brains) level.set(id, { skill: brain.skill, composed: brain.composed, team: m.seats.get(id)!.team });
  return { m, level };
}
const within = (skill: number, level: BotLevel) => skill >= BOT_LEVELS[level].lo - 1e-9 && skill <= BOT_LEVELS[level].lo + BOT_LEVELS[level].span + 1e-9;

describe('Sky Spike: FEVER, the comeback\'s lever', () => {
  it('counts a FEVER point double to the side behind and to either side level, and one to the side ahead', () => {
    expect(SWINGS.feverBehind).toBe(true);
    expect(scored('blue', 6, 3)).toBe(2);
    expect(scored('red', 6, 3)).toBe(1);
    expect(scored('red', 4, 4)).toBe(2);
    expect(scored('blue', 4, 4)).toBe(2);
    // Outside a FEVER rally a point is a point.
    expect(scored('blue', 6, 3, false)).toBe(1);
  });
  it('names the side behind on the FEVER event (none when level), and the banner\'s line says so', () => {
    const behind = pair();
    behind.view.score.red = 2; behind.view.score.blue = 5; behind.view.phase = 'live'; behind.view.rally = SPIKE_RULES.fever - 1;
    inside(behind).climb('blue');
    expect(behind.view.fever).toBe(true);
    expect(behind.view.events.at(-1)).toMatchObject({ kind: 'fever', team: 'red', text: 'FEVER RALLY · DOUBLE FOR THE SIDE BEHIND' });
    const level = pair();
    level.view.score.red = 3; level.view.score.blue = 3; level.view.phase = 'live'; level.view.rally = SPIKE_RULES.fever - 1;
    inside(level).climb('red');
    const e = level.view.events.at(-1)!;
    expect(e).toMatchObject({ kind: 'fever', text: 'FEVER RALLY · POINTS COUNT DOUBLE' });
    expect(e.team).toBeUndefined();
  });
  it('keeps SUDDEN DEATH\'s every point worth two, to either side at any score', () => {
    const m = new BallMatch('sky-spike', { seed: 3, access: 'host', fillBots: false, mutator: 'sudden-death' });
    m.add('red-1', 'taisei', 'Red', false, 'red'); m.add('blue-1', 'konta', 'Blue', false, 'blue');
    m.start(); steps(m, 3.1);
    m.view.score.red = 5; m.view.score.blue = 1; m.view.phase = 'live';
    inside(m).point('red', 'floor');
    expect(m.view.score.red).toBe(7);
  });
  it('saves a match point only off a point the side ahead could have won it with, at its own worth', () => {
    const save = (red: number, blue: number) => {
      const m = pair();
      steps(m, 1.5);
      m.view.score.red = red; m.view.score.blue = blue; m.view.fever = true; m.view.phase = 'live';
      inside(m).point('red', 'floor', 'red-1');
      return m.view.replay;
    };
    // 8-10, FEVER: red's kill is worth two (10-10), and blue's point (worth one to the side ahead) would have won it.
    expect(save(8, 10)).toMatchObject({ text: 'FEVER POINT', ceremony: true });
    // 8-9: blue's point would have made it 10-8, not the match - no match point was saved, whatever red's is worth.
    const plain = save(8, 9);
    expect(plain?.text).toBe('FEVER POINT'); expect(plain?.ceremony).toBeUndefined();
  });
});

describe('Sky Spike: the bots\' level and composure', () => {
  it('draws the other side\'s bots from the level picked, and a person\'s team-mates from its `mates`, playing their own game', () => {
    for (const difficulty of ['easy', 'normal', 'hard'] as const) {
      const { level } = bots(difficulty);
      expect(level.size).toBe(5);
      for (const bot of level.values()) {
        if (bot.team === 'red') { expect(within(bot.skill, BOT_LEVELS[difficulty].mates)).toBe(true); expect(bot.composed).toBe(false); }
        else { expect(within(bot.skill, difficulty)).toBe(true); expect(bot.composed).toBe(true); }
      }
    }
    // A person's Sky Spike team-mates are HARD's at every level (they cover a person's misses), and the
    // levels' bands climb.
    expect([BOT_LEVELS.easy.mates, BOT_LEVELS.normal.mates, BOT_LEVELS.hard.mates]).toEqual(['hard', 'hard', 'hard']);
    expect(BOT_LEVELS.easy.lo).toBeLessThan(BOT_LEVELS.normal.lo);
    expect(BOT_LEVELS.normal.lo).toBeLessThanOrEqual(BOT_LEVELS.hard.lo);
    expect([...bots().level.values()].filter(b => b.team === 'blue').every(b => within(b.skill, 'normal'))).toBe(true);
    // The draw is the same one: the bots' places in their band, whichever band.
    const easy = [...bots('easy').level.values()].filter(b => b.team === 'blue').map(b => (b.skill - BOT_LEVELS.easy.lo) / BOT_LEVELS.easy.span);
    const hard = [...bots('hard').level.values()].filter(b => b.team === 'blue').map(b => (b.skill - BOT_LEVELS.hard.lo) / BOT_LEVELS.hard.span);
    easy.forEach((u, i) => expect(u).toBeCloseTo(hard[i], 9));
  });
  it('gives every bot the level with people on both sides, and lets no bot\'s side ease off', () => {
    const { level } = bots('hard', true);
    for (const bot of level.values()) { expect(within(bot.skill, 'hard')).toBe(true); expect(bot.composed).toBe(false); }
  });
  it('levels a seat handed to a bot mid-match: a side left without a person eases off and digs in', () => {
    const { m } = bots('easy', true);
    steps(m, 4);
    m.remove('p2');
    const brain = inside(m).brains.get('p2')!;
    expect(brain.composed).toBe(true);
    for (const [id, b] of inside(m).brains) if (m.seats.get(id)!.team === 'blue') { expect(within(b.skill, 'easy')).toBe(true); expect(b.composed).toBe(true); }
  });
  it('moves a bot\'s skill with its side\'s score (COMPOSURE), never a person\'s team-mates\'', () => {
    const sk = (difficulty: BotLevel, red: number, blue: number) => {
      const { m } = bots(difficulty);
      steps(m, 4);
      m.view.score.red = red; m.view.score.blue = blue;
      m.step(1 / 60);
      const out: { team: BallTeam; skill: number; sk: number }[] = [];
      for (const [id, b] of inside(m).brains) out.push({ team: m.seats.get(id)!.team, skill: b.skill, sk: b.sk });
      return out;
    };
    const lead = (n: number) => Math.min(COMPOSURE.most, n * COMPOSURE.point);
    for (const difficulty of ['easy', 'normal', 'hard'] as const) {
      const shape = BOT_LEVELS[difficulty];
      // The other side behind by six digs in by its level's share; the person's team-mates stay as they are.
      for (const b of sk(difficulty, 6, 0)) {
        if (b.team === 'red') expect(b.sk).toBeCloseTo(b.skill, 9);
        else expect(b.sk).toBeCloseTo(Math.min(COMPOSURE.hi, b.skill + lead(6) * shape.dig), 9);
      }
      // Ahead by two, it eases off by its level's share.
      for (const b of sk(difficulty, 0, 2)) if (b.team === 'blue') expect(b.sk).toBeCloseTo(Math.max(COMPOSURE.lo, b.skill - lead(2) * shape.ease), 9);
    }
    // EASY's side eases off fully but hardly digs in; HARD's the other way round.
    expect(BOT_LEVELS.easy.ease).toBeGreaterThan(BOT_LEVELS.easy.dig);
    expect(BOT_LEVELS.hard.dig).toBeGreaterThan(BOT_LEVELS.hard.ease);
    expect(BOT_LEVELS.normal).toMatchObject({ ease: 1, dig: 1 });
  });
  it('makes a bot\'s errors grow as its skill falls (FORM), and its read slower', () => {
    expect(FORM.jump).toBeGreaterThan(0); expect(FORM.miss).toBeGreaterThan(0); expect(FORM.misread).toBeGreaterThan(1);
    const read = (sk: number) => REACT.base - REACT.skill * sk;
    // An average bot reads about as fast as at .34 less .2 × skill; a poor one later, the best sooner.
    expect(Math.abs(read(.75) - (.34 - .2 * .75))).toBeLessThan(.02);
    expect(read(BOT_LEVELS.easy.lo)).toBeGreaterThan(.38);
    // (HARD's own levers read faster still - BallBrain LEVEL_EDGE.react.)
    expect(read(BOT_LEVELS.hard.lo + BOT_LEVELS.hard.span) * LEVEL_EDGE.hard.react).toBeLessThan(.1);
  });
});
