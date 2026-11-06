import { afterEach, describe, expect, it, vi } from 'vitest';
import { AHEAD, AdaptiveDirector, BASE_STRENGTH, DIFFICULTY_STEP, PRIOR, SKILL_RANGE, START_SKILL, SkillEvidence, meanSkill, power, skillFrom, strengthFor } from '../src/game/adaptive';
import { ArenaSimulation } from '../src/game/simulation';
import { COMBO_HP, COMBO_STAMINA } from '../src/game/moves';
import { ROSTER_PROTOCOL } from '../src/game/rosterProtocol';
import { ArenaRoom } from '../src/server/ArenaRoom';
import type { Client, FixedTimestepCallback } from 'colyseus';

afterEach(() => vi.restoreAllMocks());

describe('adaptive difficulty: the rules', () => {
  it('puts a new player\'s bots at half again today\'s, and every bot 15% ahead of the player it faces', () => {
    expect(BASE_STRENGTH).toBe(1.5);
    expect(AHEAD).toBeGreaterThanOrEqual(1.1); expect(AHEAD).toBeLessThanOrEqual(1.2);
    expect(strengthFor(START_SKILL)).toBeCloseTo(BASE_STRENGTH, 6);
    expect(strengthFor(2)).toBeCloseTo(2 * AHEAD, 6);
    expect(strengthFor(1, DIFFICULTY_STEP.easy)).toBeLessThan(strengthFor(1)); expect(strengthFor(1, DIFFICULTY_STEP.hard)).toBeGreaterThan(strengthFor(1));
  });

  it('carries a strength half in the blows and half in what is taken, so two bots of one strength trade as before', () => {
    expect(power(2.25)).toBeCloseTo(1.5, 6);
    expect(power(1)).toBe(1);
    const d = new AdaptiveDirector(); d.fix('a', 2); d.fix('b', 2); d.fix('c', 1);
    expect(d.factor('a', 'b')).toBeCloseTo(1, 9);
    expect(d.factor('a', 'c') / d.factor('c', 'a')).toBeCloseTo(2, 9);   // a trades two for one with today's bot
  });

  it('takes a page\'s word for its skill only as a number in range, and starts a stranger at the start', () => {
    for (const nonsense of [undefined, null, 'high', NaN, -1, 0, Infinity, {}]) expect(skillFrom(nonsense), String(nonsense)).toBe(START_SKILL);
    expect(skillFrom(100)).toBe(SKILL_RANGE[1]); expect(skillFrom(.01)).toBe(SKILL_RANGE[0]); expect(skillFrom(1.7)).toBe(1.7);
  });

  it('reads a player\'s skill off their exchange with the bots, brought back to today\'s bot and held by PRIOR of the start', () => {
    const e = new SkillEvidence(1);
    expect(e.skill).toBe(1);
    // Against a bot of strength 4 (power 2): dealing 1000 is 2000 against today's bot; taking 1000 is 500 from it.
    e.record(1000, 4, true); e.record(1000, 4, false);
    expect(e.dealt).toBe(2000); expect(e.taken).toBe(500);
    expect(e.skill).toBeCloseTo((2000 + PRIOR) / (500 + PRIOR), 9);
    // A few blows do not swing it: one exchange of 50 each moves a skill of 1 by a little.
    const small = new SkillEvidence(1); small.record(50, 1, false);
    expect(small.skill).toBeGreaterThan(.9);
    expect(meanSkill([1, 4])).toBeCloseTo(2, 9);
  });
});

describe('adaptive difficulty: the director', () => {
  const field = (humans: string[], bots: string[], allies: [string, string][] = []) => ({
    humans: () => humans, bots: () => bots,
    hostile: (a: string, b: string) => !allies.some(([x, y]) => (x === a && y === b) || (x === b && y === a)),
  });
  it('leaves every bot at today\'s strength with no human in the field', () => {
    const d = new AdaptiveDirector(); d.look(0, field([], ['b1', 'b2']), true);
    expect(d.strengthOf('b1')).toBe(1); expect(d.factor('b1', 'b2')).toBe(1);
  });
  it('sets the bots against a human ahead of them, and leaves a bot on their side at today\'s strength', () => {
    const d = new AdaptiveDirector(); d.join('me', 2);
    d.look(0, field(['me'], ['foe', 'friend'], [['friend', 'me']]), true);
    expect(d.strengthOf('foe')).toBeCloseTo(2 * AHEAD, 9);
    expect(d.strengthOf('friend')).toBe(1);
    d.setDifficulty('hard'); d.look(10, field(['me'], ['foe', 'friend'], [['friend', 'me']]), true);
    expect(d.strengthOf('foe')).toBeCloseTo(2 * AHEAD * DIFFICULTY_STEP.hard, 9);
  });
  it('sets a bot that picks one human of several ahead of that human', () => {
    const d = new AdaptiveDirector(); d.join('weak', .5); d.join('strong', 4);
    d.look(0, field(['weak', 'strong'], ['bot']), true);
    expect(d.strengthOf('bot')).toBeCloseTo(meanSkill([.5, 4]) * AHEAD, 9);
    d.engage('bot', 'weak'); expect(d.strengthOf('bot')).toBeCloseTo(.5 * AHEAD, 9);
    d.engage('bot', 'strong'); expect(d.strengthOf('bot')).toBeCloseTo(4 * AHEAD, 9);
  });
  it('counts only blows between a human and a bot as evidence, and keeps a fixed bot fixed', () => {
    const d = new AdaptiveDirector(); d.join('me', 1); d.join('you', 1); d.fix('bot', 4);
    d.look(0, field(['me', 'you'], ['bot', 'other']), true);
    d.tally('me', 'you', 500); d.tally('other', 'bot', 500);           // human on human, bot on bot: nothing
    expect(d.evidenceOf('me')!.exchanged).toBe(0);
    d.tally('me', 'bot', 100); d.tally('bot', 'me', 100);
    expect(d.evidenceOf('me')!.dealt).toBe(200); expect(d.evidenceOf('me')!.taken).toBe(50);
    expect(d.strengthOf('bot')).toBe(4);
  });
  it('is off where it is off: nothing set, nothing counted', () => {
    const d = new AdaptiveDirector(false); d.join('me', 3);
    d.look(0, field(['me'], ['bot']), true); d.tally('bot', 'me', 100);
    expect(d.strengthOf('bot')).toBe(1); expect(d.evidenceOf('me')!.exchanged).toBe(0);
  });
});

describe('adaptive difficulty in the simulation', () => {
  const match = (roomMode: 'match' | 'training' = 'match') => {
    const sim = new ArenaSimulation({ roomMode, maxStamina: COMBO_STAMINA, maxHp: COMBO_HP, seed: 7 });
    sim.addPlayer('me', 'taisei', 'Me'); sim.addPlayer('bot', 'konta', 'Bot', true);
    return sim;
  };
  it('stands a new player\'s bot at half again today\'s, writes the player\'s skill on their state, and hits harder for it', () => {
    const sim = match(); expect(sim.startMatch()).toBe(true);
    sim.step();
    expect(sim.adaptive.strengthOf('bot')).toBeCloseTo(BASE_STRENGTH, 6);
    expect(sim.getPlayer('me')!.skill).toBeCloseTo(START_SKILL, 3);
    expect(sim.getPlayer('bot')!.skill).toBeUndefined();
    const before = sim.getPlayer('me')!.hp; sim.damage('me', 100, 'bot', 'test');
    expect(before - sim.getPlayer('me')!.hp).toBeCloseTo(100 * power(BASE_STRENGTH), 6);
  });
  it('takes the page\'s skill for the player, and sets the bots from it', () => {
    const sim = match(); sim.setPlayerSkill('me', 3); sim.startMatch(); sim.step();
    expect(sim.adaptive.strengthOf('bot')).toBeCloseTo(3 * AHEAD, 6);
    expect(sim.getPlayer('me')!.skill).toBeCloseTo(3, 3);
  });
  it('is off in the Training Ground', () => {
    const sim = match('training'); sim.setPlayerSkill('me', 3);
    for (let i = 0; i < 180; i++) sim.step();
    expect(sim.adaptive.strengthOf('bot')).toBe(1); expect(sim.getPlayer('me')!.skill).toBeUndefined();
  });
});

describe('adaptive difficulty: the page and the room', () => {
  it('keeps the skill a match hands back, and nothing that is not a skill', async () => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) });
    vi.resetModules();
    const { keepSkill, keptSkill } = await import('../src/boot/skill');
    expect(keptSkill()).toBeUndefined();
    keepSkill('2'); keepSkill(NaN); keepSkill(-1); expect(keptSkill()).toBeUndefined();
    keepSkill(1.734); expect(keptSkill()).toBe(1.734); expect(store.get('impact-skill')).toBe('1.734');
    vi.unstubAllGlobals();
  });
  it('seats a player with the skill their page sent, and the room\'s bots stand ahead of it', async () => {
    const room = new ArenaRoom();
    let tick!: FixedTimestepCallback;
    vi.spyOn(room, 'setPrivate').mockResolvedValue(undefined); vi.spyOn(room, 'setMetadata').mockResolvedValue(undefined);
    vi.spyOn(room, 'broadcast').mockImplementation(() => {}); vi.spyOn(room, 'lock').mockResolvedValue(undefined);
    vi.spyOn(room, 'setFixedTimestep').mockImplementation(callback => { tick = callback; });
    await room.onCreate({ rosterProtocol: ROSTER_PROTOCOL, mode: 'match' });
    try {
      const c = { sessionId: 'me', send: vi.fn(), leave: vi.fn() } as unknown as Client; room.clients.push(c);
      room.onJoin(c, { rosterProtocol: ROSTER_PROTOCOL, fighter: 'taisei', name: 'Me', skill: 2.5 } as never);
      expect(room.simulation.adaptive.skillOf('me')).toBe(2.5);
      let frame = 0;
      for (let i = 0; i < 60 * 40 && room.simulation.status !== 'active'; i++) tick({ dt: 1 / 60, dtMs: 1000 / 60, tick: ++frame, subSteps: 1, subDt: 1 / 60, subDtMs: 1000 / 60 });
      for (let i = 0; i < 5; i++) tick({ dt: 1 / 60, dtMs: 1000 / 60, tick: ++frame, subSteps: 1, subDt: 1 / 60, subDtMs: 1000 / 60 });
      const bots = room.simulation.snapshot().players.filter(p => p.isBot);
      expect(bots.length).toBeGreaterThan(0);
      for (const bot of bots) expect(room.simulation.adaptive.strengthOf(bot.id)).toBeCloseTo(2.5 * AHEAD, 6);
    } finally { room.onDispose(); }
  });
});
