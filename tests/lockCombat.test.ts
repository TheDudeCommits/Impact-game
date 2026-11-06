import { afterEach, describe, expect, it, vi } from 'vitest';
import { lockCombatOn, lockPreview } from '../src/game/lockMode';
import { ArenaSimulation, LAG_COMPENSATION } from '../src/game/simulation';
import { RUSH_STAGES } from '../src/game/moves';
import { LOCK_ESCAPE_REWIND, LOCK_FINISH_DAMAGE, LOCK_ROUND_DAMAGE, lockRoundMove, LOCK_COUNTER_STAMINA, LOCK_ESCAPE_WINDOW, LOCK_FIGHTERS, LOCK_FINISH_WINDUP, LOCK_ROUND, LOCK_ROUND_TWO, LOCK_ROUNDS, LOCK_VANISH_STAMINA, lockRoundName, locks } from '../src/game/lockCombat';
import { FIGHTERS } from '../src/config';
import { isReleasedFighter } from '../src/game/rosterAvailability';
import { rushMove } from '../src/game/awakening';
import type { CombatEvent, FighterId, PlayerInput } from '../src/game/types';

function bout(fighter: FighterId = 'taisei', other: FighterId = 'konta', lockCombat = true, gap = 1.6, at?: { stage: 'proving-hall'; x: number; z: number }) {
  const sim = new ArenaSimulation({ trainingBot: false, seed: 9, lockCombat, maxStamina: 225, ...(at ? { stage: at.stage } : {}) });
  sim.addPlayer('a', fighter, 'A', false, { x: at?.x ?? 0, y: 0, z: at?.z ?? 0 });
  sim.addPlayer('b', other, 'B', false, { x: at?.x ?? 0, y: 0, z: (at?.z ?? 0) + gap });
  let seq = 0;
  const held: Record<string, Partial<PlayerInput>> = { a: {}, b: {} };
  const input = (id: string, more: Partial<PlayerInput> = {}) =>
    sim.submitInput(id, { seq: seq++, moveX: 0, moveZ: 0, yaw: id === 'a' ? 0 : Math.PI, targetId: id === 'a' ? 'b' : 'a', ...held[id], ...more });
  const events: CombatEvent[] = [];
  const step = (seconds: number, each?: (frame: number) => void) => {
    for (let i = 0; i < Math.round(seconds * 60); i++) { each?.(i); sim.step(); events.push(...sim.snapshot(true).events); }
  };
  const hits = (by = 'a') => events.filter(e => e.kind === 'hit' && e.actorId === by);
  input('a'); input('b');
  return { sim, input, step, events, hits, held, a: sim.actors.get('a')!, b: sim.actors.get('b')! };
}
/** A light every `every` ticks from A, as a player presses on a beat; B does whatever `b` says on the same frame. */
const press = (fight: ReturnType<typeof bout>, seconds: number, every = 13, b?: (frame: number) => void) =>
  fight.step(seconds, i => { if (i % every === 0) fight.input('a', { attack: 'light' }); else fight.input('a'); b?.(i); });
/** The first contact of each cast A landed, in order. */
const casts = (fight: ReturnType<typeof bout>) => {
  const seen = new Map<number, CombatEvent>();
  for (const h of fight.hits()) if (h.actionSeq !== undefined && !seen.has(h.actionSeq)) seen.set(h.actionSeq, h);
  return [...seen.values()];
};

describe('lock combat\'s switch (lockMode.ts)', () => {
  afterEach(() => vi.unstubAllEnvs());
  it('is on by default, off in a build made with VITE_LOCK_COMBAT=0', () => {
    expect(lockCombatOn()).toBe(true);
    vi.stubEnv('VITE_LOCK_COMBAT', '0');
    expect(lockCombatOn()).toBe(false);
  });
  it('keeps the preview\'s own tag and bot-first Duel to the preview build (VITE_LOCK_COMBAT=1)', () => {
    expect(lockPreview()).toBe(false);
    vi.stubEnv('VITE_LOCK_COMBAT', '1');
    expect(lockPreview()).toBe(true);
  });
});

describe('lock combat online', () => {
  it('says so in its snapshots, so a page predicts it as its server plays it; the live rules say nothing', () => {
    expect(bout('taisei', 'konta').sim.snapshot().lockCombat).toBe(true);
    expect(bout('taisei', 'konta', false).sim.snapshot().lockCombat).toBeUndefined();
  });

  /** A round end; then B's guard pressed on the frame `seenAfter` past it, arriving `lag` later, with or without saying it. */
  const escapeOver = (lag: number, rewind: boolean, says = true) => {
    const fight = bout('taisei', 'konta');
    if (rewind) fight.sim.rewind = LAG_COMPENSATION;
    let pressed: { at: number; view: number } | undefined, sent = 0;
    press(fight, 3, 13, () => {
      const gap = fight.events.find(e => e.kind === 'lock-gap');
      if (gap && !pressed) pressed = { view: gap.serverTime + .12, at: gap.serverTime + .12 + lag };
      if (pressed && fight.sim.serverTime >= pressed.at && sent < 9) { fight.input('b', { guard: true, ...(says ? { view: pressed.view } : {}) }); sent++; }
      else fight.input('b');
    });
    return fight.events.find(e => e.kind === 'lock-escape' && e.actorId === 'b');
  };
  it('judges the escape by when the defender saw the ring: a press made in the window escapes though it arrives after it', () => {
    expect(escapeOver(.3, true)?.reason).toBeUndefined();
    expect(escapeOver(LOCK_ESCAPE_REWIND - .02, true)?.reason).toBeUndefined();
  });
  it('judges it on arrival offline, for a page that does not say what it saw, and past LOCK_ESCAPE_REWIND', () => {
    expect(escapeOver(.3, false)?.reason).toBe('late');
    expect(escapeOver(.3, true, false)?.reason).toBe('late');
    // (Past it the string is often over before the press arrives: no escape either way.)
    const far = escapeOver(.9, true);
    expect(!far || far.reason !== undefined).toBe(true);
  });

  it('pays for seeing a string through: its second round and finisher deal more than the live blows they are made of', () => {
    for (const fighter of ['taisei', 'konta', 'jirenga'] as FighterId[]) {
      expect(lockRoundMove(fighter, 0, false)!.damage, fighter).toBeCloseTo(rushMove(fighter, 1, false).damage * LOCK_ROUND_DAMAGE);
      expect(lockRoundMove(fighter, LOCK_ROUND, false)!.damage, fighter).toBeCloseTo(rushMove(fighter, LOCK_ROUND, false).damage * LOCK_FINISH_DAMAGE);
    }
  });
});

describe('lock combat', () => {
  it('is for every fighter on the roster; the first six keep their hand-picked second rounds', () => {
    const roster = (Object.keys(FIGHTERS) as FighterId[]).filter(isReleasedFighter);
    expect(roster.every(locks)).toBe(true);
    expect([...LOCK_FIGHTERS].sort()).toEqual(['gummy', 'konta', 'nigo', 'ouga', 'shiden', 'taisei']);
    for (const id of LOCK_FIGHTERS) expect(LOCK_ROUND_TWO[id], id).toBeDefined();
  });

  it('gives the rest second rounds of their own takes, never a move the first round or the finisher throws', () => {
    const roster = (Object.keys(FIGHTERS) as FighterId[]).filter(isReleasedFighter).filter(id => !LOCK_FIGHTERS.has(id));
    let full = 0;
    for (const id of roster) {
      const first = [0, 1, 2, 3].map(s => rushMove(id, s, false).name), names = [0, 1, 2].map(s => lockRoundName(id, s)).filter((n): n is string => !!n);
      for (const name of names) expect(first, `${id}: ${name}`).not.toContain(name);
      expect(new Set(names).size, id).toBe(names.length);
      if (names.length === 3) full++;
    }
    // (lockRoundFill.ts: 73 of the 90 have three takes to spare; the other 17's 25-odd clips are all their own moves already.)
    expect(full).toBeGreaterThanOrEqual(73);
  });

  it('plays rounds of three, then the finisher, for every fighter on the roster', () => {
    const roster = (Object.keys(FIGHTERS) as FighterId[]).filter(isReleasedFighter);
    const broken: string[] = [];
    for (const fighter of roster) {
      const fight = bout(fighter, 'konta');
      press(fight, 4);
      const order = casts(fight).map(h => `${h.round ?? 0}:${h.chain}`);
      const string = Array.from({ length: LOCK_ROUND * LOCK_ROUNDS }, (_, k) => `${Math.floor(k / LOCK_ROUND)}:${k % LOCK_ROUND}`).concat(`${LOCK_ROUNDS - 1}:3`);
      if (order.slice(0, string.length).join(' ') !== string.join(' ')) broken.push(`${fighter}: ${order.slice(0, 8).join(' ')}`);
    }
    expect(broken).toEqual([]);
  });

  it('plays the string in rounds of three with a beat between them, then the finisher', () => {
    for (const fighter of LOCK_FIGHTERS) {
      const fight = bout(fighter, 'konta');
      press(fight, 4);
      const order = casts(fight).map(h => `${h.round ?? 0}:${h.chain}`);
      const string = Array.from({ length: LOCK_ROUND * LOCK_ROUNDS }, (_, k) => `${Math.floor(k / LOCK_ROUND)}:${k % LOCK_ROUND}`).concat(`${LOCK_ROUNDS - 1}:${RUSH_STAGES - 1}`);
      expect(order.slice(0, string.length), fighter).toEqual(string);
      const gaps = fight.events.filter(e => e.kind === 'lock-gap');
      expect(gaps.length, `${fighter}: one gap per round`).toBeGreaterThanOrEqual(LOCK_ROUNDS);
      expect(gaps[0].targetId).toBe('b');
      // No pause between the rounds: the next round's first blow comes on the string's own pace (aimed at
      // 267-300 ms). The finisher lands a wind-up later, its accent (about 467 ms). (Inside measured from stage 1 to 2: a
      // stage 0 can be a barrage, Konta's.)
      const list = casts(fight), end = list[LOCK_ROUND - 1], next = list[LOCK_ROUND], inside = list[2].serverTime - list[1].serverTime;
      const last = list[LOCK_ROUND * LOCK_ROUNDS - 1], finisher = list[LOCK_ROUND * LOCK_ROUNDS];
      expect(next.serverTime - end.serverTime, fighter).toBeLessThan(inside + .1);
      expect(finisher.serverTime - last.serverTime, fighter).toBeGreaterThanOrEqual(LOCK_FINISH_WINDUP + inside * .5);
      expect(finisher.serverTime - last.serverTime, fighter).toBeLessThan(.6);
    }
  });

  it('throws a second round of its own: six blows, no two alike, before the finisher', () => {
    for (const fighter of LOCK_FIGHTERS) {
      const fight = bout(fighter, 'konta');
      press(fight, 4);
      const list = casts(fight).slice(0, LOCK_ROUND * LOCK_ROUNDS), names = list.map(h => h.move);
      expect(names.slice(LOCK_ROUND), fighter).toEqual([...LOCK_ROUND_TWO[fighter]!]);
      expect(new Set(names).size, `${fighter}: ${names.join(', ')}`).toBe(LOCK_ROUND * LOCK_ROUNDS);
      // And the body says which round it is in, for the page to draw the round's own takes.
      expect(fight.events.some(e => e.kind === 'cast' && e.actorId === 'a' && e.round === 1), fighter).toBe(true);
    }
  });

  it('dashes in: a light pressed from across the room lands, where the live rules swing at air', () => {
    for (const fighter of LOCK_FIGHTERS) {
      const lock = bout(fighter, 'konta', true, 5), live = bout(fighter, 'konta', false, 5);
      lock.step(1); live.step(1);
      const from = lock.sim.serverTime;
      press(lock, 1.2, 6); press(live, 1.2, 6);
      const first = lock.hits()[0];
      expect(lock.events.some(e => e.kind === 'chase' && e.actorId === 'a'), fighter).toBe(true);
      expect(first && first.serverTime - from, fighter).toBeLessThan(.5);
      expect(lock.hits().length, fighter).toBeGreaterThan(live.hits().length);
    }
  });

  it('takes mashing: a light every tenth of a second is a full string and its chase', () => {
    const fight = bout('konta', 'taisei');
    fight.step(1);
    press(fight, 3.4, 6);
    const names = casts(fight).map(h => h.move);
    expect(names.slice(0, 7)).toEqual(['Foxpack Barrage', 'Twin Clone Jab', 'Twin Clone Upper', ...LOCK_ROUND_TWO.konta!, 'Up You Go!!']);
    expect(fight.events.some(e => e.kind === 'chase' && e.actorId === 'a')).toBe(true);
  });

  it('holds the body through the beat: with no press from them, the next round lands', () => {
    const fight = bout('gummy', 'nigo');
    press(fight, 3);
    const list = casts(fight);
    expect(list.length).toBeGreaterThanOrEqual(LOCK_ROUND * LOCK_ROUNDS + 1);
    // B never acted: every one of A's blows landed, none were B's.
    expect(fight.hits('b')).toHaveLength(0);
  });

  it('escapes on a clean guard press in the window: behind the attacker, for a third of the bar, and the string is over', () => {
    const fight = bout('taisei', 'konta');
    let pressedAt = -1;
    press(fight, 3, 13, () => {
      const gap = fight.events.find(e => e.kind === 'lock-gap');
      if (gap && pressedAt < 0 && fight.sim.serverTime >= gap.serverTime + .12) { pressedAt = fight.sim.serverTime; fight.held.b = { guard: true }; }
      fight.input('b');
    });
    const escape = fight.events.find(e => e.kind === 'lock-escape' && e.actorId === 'b');
    expect(escape?.reason).toBeUndefined();
    expect(fight.events.some(e => e.kind === 'vanish' && e.actorId === 'b')).toBe(true);
    // The stamina: the bar the press opened with, less the escape (a held guard blocks nothing here).
    expect(fight.b.state.stamina).toBeLessThanOrEqual(225 - LOCK_VANISH_STAMINA + 1);
    // Nothing of round two landed after the escape.
    expect(fight.hits().filter(h => h.serverTime > escape!.serverTime && (h.round ?? 0) > 0)).toHaveLength(0);
    // And the escaper stands behind the attacker: past them along the line they came at it from.
    expect(fight.b.state.z).toBeLessThan(fight.a.state.z);
  });

  it('does not escape on a guard mashed during the round, nor on one pressed after the window', () => {
    // Mashed: a tap every 10 ticks from the start.
    const early = bout('shiden', 'ouga');
    press(early, 3, 13, i => { early.input('b', { guard: i % 10 < 3 }); });
    expect(early.events.some(e => e.kind === 'lock-escape' && e.actorId === 'b' && !e.reason)).toBe(false);
    expect(early.events.some(e => e.kind === 'lock-gap' && e.reason === 'early')).toBe(true);
    expect(casts(early).some(h => (h.round ?? 0) === 1)).toBe(true);
    // Late: one press, after the window has closed.
    const late = bout('shiden', 'ouga');
    let pressed = false;
    press(late, 3, 13, () => {
      const gap = late.events.find(e => e.kind === 'lock-gap');
      if (gap && !pressed && late.sim.serverTime >= (gap.due ?? gap.serverTime + LOCK_ESCAPE_WINDOW) + .03) { pressed = true; late.held.b = { guard: true }; }
      late.input('b');
    });
    expect(late.events.some(e => e.kind === 'lock-escape' && e.actorId === 'b' && !e.reason)).toBe(false);
    expect(casts(late).some(h => (h.round ?? 0) === 1)).toBe(true);
  });

  it('lets the attacker counter-vanish an escape for half its price', () => {
    const fight = bout('ouga', 'taisei');
    let escaped = -1;
    press(fight, 3, 13, () => {
      const gap = fight.events.find(e => e.kind === 'lock-gap');
      if (gap && fight.sim.serverTime >= gap.serverTime + .12) fight.held.b = { guard: true };
      fight.input('b');
      const out = fight.events.find(e => e.kind === 'lock-escape' && e.actorId === 'b' && !e.reason);
      if (out && escaped < 0) escaped = fight.sim.serverTime;
      if (escaped > 0 && fight.sim.serverTime >= escaped + .1) fight.held.a = { guard: true };
    });
    const counter = fight.events.find(e => e.kind === 'lock-escape' && e.actorId === 'a' && e.reason === 'counter');
    expect(counter).toBeDefined();
    expect(fight.a.state.stamina).toBeLessThanOrEqual(225 - LOCK_COUNTER_STAMINA + 1);
  });

  it('does not trade: the first light to land takes the other out of its swing, a COUNTER', () => {
    for (const lock of [true, false]) {
      // B swings a heavy first; A's quicker light, pressed four frames later, lands inside its wind-up. (Not Taisei's
      // heavy, an Cloudstep that steps out of the jab.)
      const fight = bout('konta', 'nigo', lock, 1.4);
      fight.step(1.2, i => { fight.input('a', i === 4 ? { attack: 'light' } : {}); fight.input('b', i === 0 ? { attack: 'heavy' } : {}); });
      const first = fight.hits('a')[0];
      expect(first, `lock ${lock}: A lands`).toBeDefined();
      if (lock) {
        expect(first.counter).toBe(true);
        expect(fight.hits('b'), 'B was taken out of its heavy').toHaveLength(0);
      } else expect(fight.hits('b').length, 'the live rules: the heavy is armoured and lands too').toBeGreaterThan(0);
    }
  });

  it('turns a body it is working on to face it: one standing with its back to the string faces it from the first blow', () => {
    const fight = bout('taisei', 'ouga');
    fight.held.b = { yaw: 0, targetId: undefined };
    fight.input('b');
    fight.b.state.yaw = 0;
    fight.step(.2);
    expect(Math.abs(Math.cos(fight.b.state.yaw)), 'B starts facing away').toBeGreaterThan(.9);
    expect(Math.cos(fight.b.state.yaw)).toBeGreaterThan(0);
    let first = -1;
    press(fight, 1.2, 13, () => { if (first < 0 && fight.hits().length) first = fight.b.state.yaw; });
    expect(first).not.toBe(-1);
    expect(Math.cos(first), 'facing A (yaw pi) after the first blow').toBeLessThan(-.9);
  });

  it('knocks the body away low and long with the finisher: 2 m and more along the floor, under a metre up, before the chase', () => {
    for (const fighter of ['taisei', 'ouga', 'jirenga', 'levin'] as FighterId[]) {
      const fight = bout(fighter, 'ouga', true, 1.4);
      let at: { x: number; z: number } | undefined, top = 0, off = 0;
      press(fight, 2.6, 6, () => {
        const fin = fight.hits().find(h => (h.chain ?? 0) >= LOCK_ROUND);
        if (!fin) return;
        const b = fight.b.state;
        at ??= { x: b.x, z: b.z };
        if (!fight.events.some(e => e.kind === 'chase' && e.serverTime > fin.serverTime)) { top = Math.max(top, b.y); off = Math.hypot(b.x - at.x, b.z - at.z); }
      });
      expect(at, fighter).toBeDefined();
      expect(off, `${fighter} thrown`).toBeGreaterThan(2);
      expect(top, `${fighter} rise`).toBeLessThan(1);
    }
  });

  it('never drives the body into a wall: a string mashed at the Proving Hall\'s wall, finisher and chase, and not one splat', () => {
    for (const fighter of ['taisei', 'gummy', 'nigo', 'levin'] as FighterId[]) for (const z of [1, 2.5]) {
      const fight = bout(fighter, 'ouga', true, 1.4, { stage: 'proving-hall', x: 1.2, z });
      press(fight, 4.5, 6);
      expect(fight.hits().length, `${fighter} from ${z}`).toBeGreaterThan(10);
      expect(fight.events.filter(e => e.kind === 'wall-splat').length, `${fighter} from ${z}`).toBe(0);
    }
  });

  it('marks a string\'s slide so nothing it slides into splats it (lockSlide) - not the finisher\'s throw, nor the live rules', () => {
    const fight = bout('taisei', 'ouga');
    let slid = false, thrown = false;
    press(fight, 2.4, 6, () => {
      const fin = fight.hits().some(h => (h.chain ?? 0) >= LOCK_ROUND);
      if (!fin && fight.hits().length && fight.b.lockSlide) slid = true;
      if (fin && fight.b.state.action === 'launched' && !fight.b.lockSlide) thrown = true;
    });
    expect(slid).toBe(true);
    expect(thrown).toBe(true);
    const live = bout('taisei', 'ouga', false);
    press(live, 2.4, 6);
    expect(live.hits().length).toBeGreaterThan(2);
    expect(live.b.lockSlide).toBeUndefined();
  });

  it('leaves the live rules alone in a simulation that does not ask for it', () => {
    for (const [fighter, lock] of [['taisei', false], ['kenzo', false]] as const) {
      const fight = bout(fighter, 'konta', lock);
      press(fight, 3);
      expect(fight.events.some(e => e.kind === 'lock-gap'), `${fighter} lock ${lock}`).toBe(false);
      expect(casts(fight).every(h => !h.round), `${fighter} lock ${lock}`).toBe(true);
    }
  });
});
