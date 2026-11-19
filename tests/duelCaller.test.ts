import { existsSync, readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { BIG, BORROWED, DUEL_CALLER, DUEL_MOMENTS, DuelCaller, DuelWatch, GAP, ROUND_CALL_LEAD, SPACING, allDuelCallerFiles, duelCallerLines, setAnnouncer, type DuelMoment } from '../src/audio/duelCaller';
import type { CombatEvent, GameSnapshot, PlayerState } from '../src/game/types';

/** The Duel's announcer (src/audio/duelCaller.ts): rare, never over itself or
 *  a fighter's own big line, its lines borrowed from the Rift's announcer until its own voice is recorded. */
function rig(fighterLines: (readonly [number, number])[] = []) {
  let now = 0;
  const said: { url: string; at: number }[] = [];
  const caller = new DuelCaller({
    announce: (url, _gain, delay = 0) => said.push({ url, at: now + delay }), sampleSeconds: () => 1.4, preload() {},
    fighterLines: () => fighterLines.map(([s, e]) => [s - now, e - now] as const).filter(([, e]) => e > 0),
  }, () => 0, () => now);
  return { caller, said, at: (t: number) => { now = t; } };
}
afterEach(() => setAnnouncer(true));

describe('the Duel\'s announcer: how it talks', () => {
  it('never over itself: a moment while a line is said passes, one two priorities bigger cuts it, a queued one waits', () => {
    const { caller, said, at } = rig();
    expect(caller.say('counter')).toBeTruthy();
    at(.5); expect(caller.say('parry')).toBeUndefined();           // one up: it waits its turn, which has gone
    at(.6); expect(caller.say('ko')).toBeTruthy();                 // a K.O. cuts a counter's call
    at(.8); expect(caller.say('double-ko')).toBeUndefined();        // and nothing but two up cuts the K.O.
    at(5); caller.say('round-1');
    at(5.2); const queued = caller.say('fight', { queue: true });
    expect(queued).toBeTruthy();
    expect(said.at(-1)!.at).toBeCloseTo(5 + 1.4 + GAP, 5);
  });

  it('the fight\'s moments are small and spaced: one waits SPACING after the last line, and each rests its own rest', () => {
    for (const m of ['counter', 'punish', 'parry', 'deflect', 'guard-break', 'wall-splat', 'combo-5', 'combo-10', 'combo-15', 'g-combo'] as DuelMoment[])
      expect(DUEL_CALLER[m].priority, m).toBeLessThan(BIG);
    const { caller, at } = rig();
    at(0); expect(caller.say('ko')).toBeTruthy();
    at(SPACING - 1); expect(caller.say('guard-break')).toBeUndefined();
    at(SPACING + .1); expect(caller.say('guard-break')).toBeTruthy();
    at(SPACING * 2 + 1); expect(caller.say('guard-break')).toBeUndefined();   // still resting
    at(SPACING + .1 + DUEL_CALLER['guard-break'].rest + .1); expect(caller.say('guard-break')).toBeTruthy();
  });

  it('never over a fighter\'s own big line: a moment under one passes, a round\'s call waits for it, and the finale\'s VICTORY! may run into one starting after it', () => {
    const { caller, said, at } = rig([[10, 12]]);
    at(10.5); expect(caller.say('first-strike')).toBeUndefined();
    at(10.5); expect(caller.say('round-2', { queue: true })).toBeTruthy();
    expect(said.at(-1)!.at).toBeCloseTo(12 + GAP, 5);
    const late = rig([[1.9, 3.5]]);
    late.at(0); expect(late.caller.say('victory', { delay: .55, queue: true })).toBeTruthy();
    expect(late.said.at(-1)!.at).toBeCloseTo(.55, 5);
  });

  it('ANNOUNCER off: nothing at all', () => {
    setAnnouncer(false);
    const { caller } = rig();
    for (const m of DUEL_MOMENTS) expect(caller.say(m), m).toBeUndefined();
    expect(duelCallerLines('fight')).toEqual([]);
  });

  it('kept rare: a fight moment every half second for ten one-minute rounds, every chance taken, says five lines a minute, never two at once', () => {
    const { caller, said, at } = rig();
    const small: DuelMoment[] = ['counter', 'punish', 'parry', 'deflect', 'guard-break', 'wall-splat', 'combo-5', 'combo-10', 'combo-15', 'g-combo'];
    let k = 0;
    for (let t = 0; t < 600; t += .5) {
      at(t);
      const s = t % 60;
      if (s === 0) { caller.say(t === 0 ? 'round-1' : t === 60 ? 'round-2' : 'round-final', { queue: true }); caller.say('fight', { queue: true }); }
      else if (s === 2) caller.say('first-strike');
      else if (s === 59) caller.say('ko', { queue: true });
      else caller.say(small[k++ % small.length]);
    }
    // The round's own three, and two of the fight's (SPACING after the last line): five a minute at the most.
    expect(said.length / 10).toBeLessThanOrEqual(5);
    expect(said.filter(l => /round|fight|finisher/.test(l.url)).length).toBe(30);
    for (let i = 1; i < said.length; i++) expect(said[i].at - said[i - 1].at, `${i}`).toBeGreaterThanOrEqual(1.4 - 1e-9);
  });
});

describe('the Duel\'s announcer: its lines', () => {
  const book = JSON.parse(readFileSync('scripts/originals/duel/caller.json', 'utf8')) as { lines: { id: string; moment: string; text: string }[] };
  it('the line book has every moment, 1-3 lines each, short, original', () => {
    for (const m of DUEL_MOMENTS) {
      const lines = book.lines.filter(l => l.moment === m);
      expect(lines.length, m).toBeGreaterThanOrEqual(1);
      expect(lines.length, m).toBeLessThanOrEqual(3);
      for (const l of lines) expect(l.text.length, l.id).toBeLessThanOrEqual(40);
    }
    expect(new Set(book.lines.map(l => l.id)).size).toBe(book.lines.length);
    // No famous announcer's catchphrase from another game, and no fighter's name (Ippon is one).
    const all = book.lines.map(l => l.text.toLowerCase()).join(' | ');
    for (const banned of ['finish him', 'flawless victory', 'new challenger', 'let\'s rock', 'heaven or hell', 'get ready for the next', 'first blood', 'ippon'])
      expect(all, banned).not.toContain(banned);
  });
  it('borrows only the Rift announcer\'s own files, every one on disk, until its own voice is recorded', () => {
    for (const url of allDuelCallerFiles()) {
      expect(url, url).toMatch(/^\/assets\/audio\/(survival\/announcer-|duel\/caller\/)/);
      expect(existsSync(`public${url}`), url).toBe(true);
    }
    expect(duelCallerLines('fight')).toEqual(BORROWED.fight);
    expect(duelCallerLines('double-ko')).toEqual([]);
  });
});

describe('the Duel\'s announcer: what it hears in a Duel', () => {
  const player = (id: string, hp = 1500, alive = true) => ({ id, fighter: 'taisei', hp, maxHp: 1500, alive } as unknown as PlayerState);
  const frame = (over: Partial<GameSnapshot> & { events?: Partial<CombatEvent>[] }, players = [player('you'), player('rival')]) => ({
    serverTime: 10, status: 'active', roomMode: 'match', players, events: [], tick: 0,
    duel: { set: 1, round: 1, firstTo: 2, scores: {}, phase: 'playing', nextRoundAt: null, roundWinner: null, winner: null, runback: [] }, ...over,
  } as unknown as GameSnapshot);
  const hit = (extra: Partial<CombatEvent> = {}) => ({ kind: 'hit', actorId: 'you', targetId: 'rival', serverTime: 10, id: 1, ...extra } as CombatEvent);
  const listen = () => { const heard: DuelMoment[] = []; const watch = new DuelWatch({ say: (m: DuelMoment) => { heard.push(m); return 'x'; } }); return { watch, heard }; };

  it('the round\'s number before its bell: the first in its countdown, the next in the break before it (the third the final)', () => {
    const { watch, heard } = listen();
    watch.frame(frame({ status: 'waiting', lobby: { startsAt: 10 + ROUND_CALL_LEAD - .1 } as GameSnapshot['lobby'] }));
    expect(heard).toEqual(['round-1']);
    watch.frame(frame({ status: 'waiting', serverTime: 70, duel: { set: 1, round: 2, phase: 'interval', nextRoundAt: 71.5 } as GameSnapshot['duel'] }));
    watch.frame(frame({ status: 'waiting', serverTime: 140, duel: { set: 1, round: 3, phase: 'interval', nextRoundAt: 141.5 } as GameSnapshot['duel'] }));
    expect(heard).toEqual(['round-1', 'round-2', 'round-final']);
  });

  it('a round\'s first blow once, a combo of five, ten and fifteen once a combo, a quick G in a combo, a counter, a punish, a parry, a guard break, a wall splat', () => {
    const { watch, heard } = listen();
    watch.frame(frame({ events: [hit({ combo: 1 }), hit({ combo: 2 })] as CombatEvent[] }));
    watch.frame(frame({ events: [hit({ combo: 5 }), hit({ combo: 6 }), hit({ combo: 10, areaCombo: true }), hit({ combo: 15, counter: true })] as CombatEvent[] }));
    watch.frame(frame({ events: [hit({ combo: 1 }), hit({ combo: 5, punish: true })] as CombatEvent[] }));
    watch.frame(frame({ events: [{ kind: 'just-guard', actorId: 'rival', targetId: 'you' }, { kind: 'just-guard', actorId: 'rival', targetId: 'you', reason: 'deflect' },
      { kind: 'guard-break', actorId: 'you', targetId: 'rival' }, { kind: 'wall-splat', actorId: 'rival' }] as CombatEvent[] }));
    expect(heard).toEqual(['first-strike', 'combo-5', 'g-combo', 'combo-10', 'counter', 'combo-15', 'punish', 'combo-5', 'parry', 'deflect', 'guard-break', 'wall-splat']);
  });

  it('a K.O., a comeback\'s K.O. (won from a quarter of the bar against three fifths) and a double K.O.', () => {
    const ko = listen();
    ko.watch.frame(frame({ events: [{ kind: 'eliminated', actorId: 'you', targetId: 'rival' }] as CombatEvent[] }, [player('you'), player('rival', 0, false)]));
    expect(ko.heard).toEqual(['ko']);
    const back = listen();
    back.watch.frame(frame({}, [player('you', 300), player('rival', 1200)]));
    back.watch.frame(frame({ events: [{ kind: 'eliminated', actorId: 'you', targetId: 'rival' }] as CombatEvent[] }, [player('you', 300), player('rival', 0, false)]));
    expect(back.heard).toEqual(['comeback']);
    const both = listen();
    both.watch.frame(frame({ events: [{ kind: 'eliminated', actorId: 'you', targetId: 'rival' }, { kind: 'eliminated', actorId: 'rival', targetId: 'you' }] as CombatEvent[] },
      [player('you', 0, false), player('rival', 0, false)]));
    expect(both.heard).toEqual(['double-ko']);
  });

  it('nothing outside a 1 v 1 Duel', () => {
    const { watch, heard } = listen();
    watch.frame(frame({ duel: undefined, events: [hit({ combo: 15 })] as CombatEvent[] }));
    watch.frame(frame({ events: [hit({ combo: 15 })] as CombatEvent[] }, [player('you'), player('rival'), player('third')]));
    expect(heard).toEqual([]);
  });
});
