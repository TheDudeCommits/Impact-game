import { afterEach, describe, expect, it, vi } from 'vitest';
import { AHEAD, AdaptiveDirector, BASE_STRENGTH, DIFFICULTY_STEP, LEVEL_TOP, PLAY, PRIOR, SKILL_RANGE, START_SKILL, SkillEvidence, half, levelFor, levelParts, meanSkill, playAt, skillFrom, strengthFor } from '../src/game/adaptive';
import { ArenaSimulation } from '../src/game/simulation';
import { COMBO_HP, COMBO_STAMINA } from '../src/game/moves';
import { ROSTER_PROTOCOL } from '../src/game/rosterProtocol';
import { ArenaRoom } from '../src/server/ArenaRoom';
import type { Client, FixedTimestepCallback } from 'colyseus';

afterEach(() => vi.restoreAllMocks());
type Bot = { botSkill: number; botEase: number; botSharp: number; botLevel?: number; botOwn?: number };
const actor = (sim: ArenaSimulation, id: string) => (sim as unknown as { actors: Map<string, Bot> }).actors.get(id)!;

describe('adaptive difficulty: the rules', () => {
  it('stands every bot 5% ahead of the player it faces, a new player\'s at the plain bot a touch sharpened', () => {
    expect(AHEAD).toBe(1.05);
    expect(BASE_STRENGTH).toBeCloseTo(START_SKILL * AHEAD, 9);
    expect(strengthFor(START_SKILL)).toBeCloseTo(BASE_STRENGTH, 9);
    expect(strengthFor(2)).toBeCloseTo(2 * AHEAD, 9);
    expect(strengthFor(1, DIFFICULTY_STEP.easy)).toBeLessThan(strengthFor(1)); expect(strengthFor(1, DIFFICULTY_STEP.hard)).toBeGreaterThan(strengthFor(1));
  });

  it('turns a level into its three dials: all ease at 0, the plain bot at 1, skill 1 at 2, all the edge at the top', () => {
    expect(levelParts(0)).toEqual({ ease: 1, skill: 0, sharp: 0 });
    expect(levelParts(.5)).toEqual({ ease: .5, skill: 0, sharp: 0 });
    expect(levelParts(1)).toEqual({ ease: 0, skill: 0, sharp: 0 });
    expect(levelParts(1.5)).toEqual({ ease: 0, skill: .5, sharp: 0 });
    expect(levelParts(2)).toEqual({ ease: 0, skill: 1, sharp: 0 });
    expect(levelParts(2.5)).toEqual({ ease: 0, skill: 1, sharp: .5 });
    expect(LEVEL_TOP).toBe(3); expect(levelParts(LEVEL_TOP)).toEqual({ ease: 0, skill: 1, sharp: 1 });
    expect(levelParts(-3)).toEqual({ ease: 1, skill: 0, sharp: 0 }); expect(levelParts(9)).toEqual({ ease: 0, skill: 1, sharp: 1 });
  });

  it('knows what each level\'s play is worth, rising all the way, and finds the level a strength asks for', () => {
    for (let i = 1; i < PLAY.length; i++) expect(PLAY[i], `level step ${i}`).toBeGreaterThan(PLAY[i - 1]);
    expect(playAt(1.5)).toBeCloseTo(1, 9);                               // the reference: strength 1 by definition
    expect(playAt(0)).toBeCloseTo(PLAY[0], 9); expect(playAt(LEVEL_TOP)).toBeCloseTo(PLAY[PLAY.length - 1], 9);
    for (const level of [0, .1, .3, .77, 1, 1.2, 1.5, 1.9, 2.2, 2.6, LEVEL_TOP]) expect(levelFor(playAt(level)), String(level)).toBeCloseTo(level, 6);
    // Out of the levels' reach, the nearest end: never a bigger body.
    expect(levelFor(.01)).toBe(0); expect(levelFor(50)).toBe(LEVEL_TOP);
  });

  it('takes a page\'s word for its skill only as a number in range, and starts a stranger at the start', () => {
    for (const nonsense of [undefined, null, 'high', NaN, -1, 0, Infinity, {}]) expect(skillFrom(nonsense), String(nonsense)).toBe(START_SKILL);
    expect(skillFrom(100)).toBe(SKILL_RANGE[1]); expect(skillFrom(.01)).toBe(SKILL_RANGE[0]); expect(skillFrom(1.7)).toBe(1.7);
  });

  it('reads a player\'s skill off their exchange with the bots, brought back by the play they met and held by PRIOR', () => {
    const e = new SkillEvidence(1);
    expect(e.skill).toBe(1);
    // Against play worth 4 (half: 2): dealing 1000 is 2000 against a strength-1 bot; taking 1000 is 500 from one.
    expect(half(4)).toBeCloseTo(2, 9);
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
  const watched = () => { const d = new AdaptiveDirector(), set = new Map<string, number | undefined>(); d.apply = (id, s) => set.set(id, s); return { d, set }; };
  it('sets no bot with no human in the field', () => {
    const { d, set } = watched(); d.look(0, field([], ['b1', 'b2']), true);
    expect(d.strengthOf('b1')).toBeUndefined(); expect(set.size).toBe(0);
  });
  it('sets the bots against a human ahead of them, and lets a bot on their side go', () => {
    const { d, set } = watched(); d.join('me', 2);
    d.look(0, field(['me'], ['foe', 'friend'], [['friend', 'me']]), true);
    expect(d.strengthOf('foe')).toBeCloseTo(2 * AHEAD, 9); expect(set.get('foe')).toBeCloseTo(2 * AHEAD, 9);
    expect(d.strengthOf('friend')).toBeUndefined(); expect(set.has('friend')).toBe(false);
    d.setDifficulty('hard'); d.look(10, field(['me'], ['foe', 'friend'], [['friend', 'me']]), true);
    expect(d.strengthOf('foe')).toBeCloseTo(2 * AHEAD * DIFFICULTY_STEP.hard, 9);
    // The human gone: the bot is let go, back to its own play.
    d.look(20, field([], ['foe', 'friend']), true);
    expect(d.strengthOf('foe')).toBeUndefined(); expect(set.has('foe') && set.get('foe')).toBeUndefined();
  });
  it('sets a bot that picks one human of several ahead of that human', () => {
    const { d } = watched(); d.join('weak', .5); d.join('strong', 4);
    d.look(0, field(['weak', 'strong'], ['bot']), true);
    expect(d.strengthOf('bot')).toBeCloseTo(meanSkill([.5, 4]) * AHEAD, 9);
    d.engage('bot', 'weak'); expect(d.strengthOf('bot')).toBeCloseTo(.5 * AHEAD, 9);
    d.engage('bot', 'strong'); expect(d.strengthOf('bot')).toBeCloseTo(4 * AHEAD, 9);
  });
  it('counts only blows between a human and a bot as evidence, by the play the bot has, and keeps a fixed bot fixed', () => {
    const { d } = watched(); d.join('me', 1); d.join('you', 1); d.fix('bot', 4);
    d.playOf = id => id === 'bot' ? 4 : 1;
    d.look(0, field(['me', 'you'], ['bot', 'other']), true);
    d.tally('me', 'you', 500); d.tally('other', 'bot', 500);           // human on human, bot on bot: nothing
    expect(d.evidenceOf('me')!.exchanged).toBe(0);
    d.tally('me', 'bot', 100); d.tally('bot', 'me', 100);
    expect(d.evidenceOf('me')!.dealt).toBe(200); expect(d.evidenceOf('me')!.taken).toBe(50);
    expect(d.strengthOf('bot')).toBe(4);
    d.pin('pinned'); d.look(10, field(['me'], ['pinned']), true); expect(d.strengthOf('pinned')).toBeUndefined();
  });
  it('is off where it is off: nothing set, nothing counted', () => {
    const { d, set } = watched(); const off = new AdaptiveDirector(false); off.apply = d.apply; off.join('me', 3);
    off.look(0, field(['me'], ['bot']), true); off.tally('bot', 'me', 100);
    expect(off.strengthOf('bot')).toBeUndefined(); expect(set.size).toBe(0); expect(off.evidenceOf('me')!.exchanged).toBe(0);
  });
});

describe('adaptive difficulty in the simulation', () => {
  const match = (roomMode: 'match' | 'training' = 'match') => {
    const sim = new ArenaSimulation({ roomMode, maxStamina: COMBO_STAMINA, maxHp: COMBO_HP, seed: 7 });
    sim.addPlayer('me', 'taisei', 'Me'); sim.addPlayer('bot', 'konta', 'Bot', true);
    return sim;
  };
  it('gives a bot a player\'s body: the same health and stamina, and every blow lands as hard both ways', () => {
    const sim = match(); sim.setPlayerSkill('me', 6); expect(sim.startMatch()).toBe(true); sim.step();
    const me = sim.getPlayer('me')!, bot = sim.getPlayer('bot')!;
    expect(bot.maxHp).toBe(me.maxHp); expect(bot.hp).toBe(me.hp); expect(bot.maxStamina).toBe(me.maxStamina);
    const mine = me.hp; sim.damage('me', 100, 'bot', 'test'); expect(mine - sim.getPlayer('me')!.hp).toBe(100);
    const theirs = bot.hp; sim.damage('bot', 100, 'me', 'test'); expect(theirs - sim.getPlayer('bot')!.hp).toBe(100);
  });
  it('sets a new player\'s bot at the level of BASE_STRENGTH, and writes the player\'s skill on their state', () => {
    const sim = match(); expect(sim.startMatch()).toBe(true);
    sim.step();
    expect(sim.adaptive.strengthOf('bot')).toBeCloseTo(BASE_STRENGTH, 6);
    expect(actor(sim, 'bot').botLevel).toBeCloseTo(levelFor(BASE_STRENGTH), 6);
    expect(sim.adaptive.playOf('bot')).toBeCloseTo(Math.min(BASE_STRENGTH, PLAY[PLAY.length - 1]), 6);
    expect(sim.getPlayer('me')!.skill).toBeCloseTo(START_SKILL, 3);
    expect(sim.getPlayer('bot')!.skill).toBeUndefined();
  });
  it('takes the page\'s skill for the player and sets the bot\'s level from it - ease for a new hand, the best for a strong one', () => {
    const weak = match(); weak.setPlayerSkill('me', .4); weak.startMatch(); weak.step();
    expect(weak.adaptive.strengthOf('bot')).toBeCloseTo(.4 * AHEAD, 6);
    const w = actor(weak, 'bot'); expect(w.botLevel).toBeLessThan(1); expect(w.botEase).toBeCloseTo(1 - w.botLevel!, 9); expect(w.botSkill).toBe(0); expect(w.botSharp).toBe(0);
    const strong = match(); strong.setPlayerSkill('me', 3); strong.startMatch(); strong.step();
    const s = actor(strong, 'bot'); expect(s.botLevel).toBe(LEVEL_TOP); expect(s.botEase).toBe(0); expect(s.botSkill).toBe(1); expect(s.botSharp).toBe(1);
    expect(strong.getPlayer('me')!.skill).toBeCloseTo(3, 3);
  });
  it('lets a bot go back to the skill it was drawn with, and holds a pinned bot where it was put', () => {
    const sim = match(); const drawn = actor(sim, 'bot').botSkill;
    sim.setPlayerSkill('me', .4); sim.startMatch(); sim.step();
    expect(actor(sim, 'bot').botOwn).toBe(drawn);
    sim.removePlayer('me'); for (let i = 0; i < 3 * 60; i++) sim.step();
    expect(actor(sim, 'bot').botSkill).toBe(drawn); expect(actor(sim, 'bot').botEase).toBe(0); expect(actor(sim, 'bot').botSharp).toBe(0); expect(actor(sim, 'bot').botLevel).toBeUndefined();
    const pinned = match(); pinned.setBotSkill('bot', .9); pinned.setPlayerSkill('me', .4); pinned.startMatch(); pinned.step();
    expect(actor(pinned, 'bot').botSkill).toBe(.9); expect(actor(pinned, 'bot').botEase).toBe(0);
  });
  it('is off in the Training Ground', () => {
    const sim = match('training'); sim.setPlayerSkill('me', 3);
    for (let i = 0; i < 180; i++) sim.step();
    expect(sim.adaptive.strengthOf('bot')).toBeUndefined(); expect(actor(sim, 'bot').botLevel).toBeUndefined(); expect(sim.getPlayer('me')!.skill).toBeUndefined();
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
  it('seats a player with the skill their page sent, and the room\'s bots stand ahead of it in their play', async () => {
    const room = new ArenaRoom();
    let tick!: FixedTimestepCallback;
    vi.spyOn(room, 'setPrivate').mockResolvedValue(undefined); vi.spyOn(room, 'setMetadata').mockResolvedValue(undefined);
    vi.spyOn(room, 'broadcast').mockImplementation(() => {}); vi.spyOn(room, 'lock').mockResolvedValue(undefined);
    vi.spyOn(room, 'setFixedTimestep').mockImplementation(callback => { tick = callback; });
    await room.onCreate({ rosterProtocol: ROSTER_PROTOCOL, mode: 'match' });
    try {
      const c = { sessionId: 'me', send: vi.fn(), leave: vi.fn() } as unknown as Client; room.clients.push(c);
      room.onJoin(c, { rosterProtocol: ROSTER_PROTOCOL, fighter: 'taisei', name: 'Me', skill: .6 } as never);
      expect(room.simulation.adaptive.skillOf('me')).toBe(.6);
      let frame = 0;
      for (let i = 0; i < 60 * 40 && room.simulation.status !== 'active'; i++) tick({ dt: 1 / 60, dtMs: 1000 / 60, tick: ++frame, subSteps: 1, subDt: 1 / 60, subDtMs: 1000 / 60 });
      for (let i = 0; i < 5; i++) tick({ dt: 1 / 60, dtMs: 1000 / 60, tick: ++frame, subSteps: 1, subDt: 1 / 60, subDtMs: 1000 / 60 });
      const bots = room.simulation.snapshot().players.filter(p => p.isBot), me = room.simulation.getPlayer('me')!;
      expect(bots.length).toBeGreaterThan(0);
      for (const bot of bots) {
        expect(room.simulation.adaptive.strengthOf(bot.id)).toBeCloseTo(.6 * AHEAD, 6);
        expect(actor(room.simulation, bot.id).botLevel).toBeCloseTo(levelFor(.6 * AHEAD), 6);
        expect(bot.maxHp).toBe(me.maxHp);
      }
    } finally { room.onDispose(); }
  });
});
