import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ArenaSimulation } from '../src/game/simulation';
import { JUST_GUARD_WINDOW, MOVES, PARRY_FREEZE } from '../src/game/moves';
import { CombatTimeline } from '../src/render/CombatTimeline';
import { PARRY_HOLD, PARRY_PAY, PARRY_SPAN, ParryPayoff, parryLagAt, parryOf } from '../src/render/parryPayoff';
import { STING_PEAK, STING_SECONDS, parrySting } from '../src/audio/parrySting';
import { parryPayPulse, pulseFor } from '../src/input/rumble';
import type { CombatEvent, GameSnapshot, PlayerInput } from '../src/game/types';

/** A parry's payoff (render/parryPayoff.ts): the drawn fight slowed a tenth of
 *  a second and caught up, a sting made in code, a rumble pulse - no camera move, and nothing the simulation hears of. */
const FRAME = 1000 / 60;

describe('the parry\'s payoff: the drawn clock', () => {
  it('slows to 0.3 for a tenth of a second, falls 52 ms behind at the most, and is back on the fight within 0.23 s', () => {
    expect(PARRY_SPAN).toBeCloseTo(.23, 3);
    expect(PARRY_HOLD).toBeGreaterThan(0);
    let most = 0, drawnBefore = -Infinity;
    for (let t = 0; t <= PARRY_SPAN + .05; t += 1 / 600) {
      const lag = parryLagAt(t);
      expect(lag, `${t}`).toBeGreaterThanOrEqual(0);
      most = Math.max(most, lag);
      // The drawn clock (real time less the lag) never runs backwards.
      expect(t - lag, `${t}`).toBeGreaterThanOrEqual(drawnBefore - 1e-9);
      drawnBefore = t - lag;
    }
    expect(most).toBeCloseTo((1 - PARRY_PAY.rate) * (PARRY_PAY.slow - PARRY_PAY.ease), 3);
    expect(parryLagAt(PARRY_SPAN - 1e-4)).toBeLessThan(1e-3);
    // Caught up within eight frames at sixty once the slowdown is over.
    expect((PARRY_SPAN - PARRY_PAY.slow) * 60).toBeLessThanOrEqual(8.5);
  });

  it('begins as the parry\'s freeze lets go, as drawn, for a parry the player is in only; `?ab=parrypay` never', () => {
    const parry = { kind: 'just-guard', id: 1, serverTime: 10, actorId: 'them', targetId: 'me' } as CombatEvent;
    const elsewhere = { ...parry, actorId: 'bot-3', targetId: 'bot-7' };
    const mine = (id: string) => id === 'me';
    expect(parryOf(parry, mine)).toBe(true);
    expect(parryOf({ ...parry, actorId: 'me', targetId: 'them' }, mine)).toBe(true);
    expect(parryOf(elsewhere, mine)).toBe(false);
    const pay = new ParryPayoff();
    expect(pay.observe([elsewhere], mine)).toHaveLength(0);
    expect(pay.observe([parry], mine)).toHaveLength(1);
    // Still in the freeze: nothing yet.
    expect(pay.frame(1000, 10 + PARRY_FREEZE - .02)).toEqual({ lag: 0, rate: 1 });
    expect(pay.frame(1000 + FRAME, 10 + PARRY_FREEZE + .001).lag).toBe(0);
    const slow = pay.frame(1000 + FRAME * 4, 10.3);
    expect(slow.rate).toBeCloseTo(PARRY_PAY.rate, 5);
    expect(slow.lag).toBeGreaterThan(0);
    expect(pay.frame(1000 + FRAME + PARRY_SPAN * 1000 + 1, 10.5)).toEqual({ lag: 0, rate: 1 });
    const off = new ParryPayoff(() => false);
    expect(off.observe([parry], mine)).toHaveLength(0);
    expect(off.frame(1000, 11)).toEqual({ lag: 0, rate: 1 });
  });

  it('the timeline drawn behind by it never rewinds, and is back on its own clock when it is over - its catch-up not held to CATCH_UP', () => {
    const plain = new CombatTimeline(), warped = new CombatTimeline();
    const snap = (t: number) => ({ serverTime: t, tick: Math.round(t * 60), status: 'active', roomMode: 'match', events: [],
      players: [{ id: 'a', x: t, y: 0, z: 0, yaw: 0, action: 'idle', actionStarted: 0, actionDuration: 0, actionTime: 0, alive: true, hp: 1, maxHp: 1, cooldowns: {} }] } as unknown as GameSnapshot);
    const pay = new ParryPayoff();
    pay.observe([{ kind: 'just-guard', id: 1, serverTime: 1, actorId: 'x', targetId: 'me' } as CombatEvent], id => id === 'me');
    let before = -Infinity, now = 0;
    for (let i = 0; i < 180; i++, now += FRAME) {
      for (const tl of [plain, warped]) tl.push(snap(i / 60 + .1), now);
      const lag = pay.frame(now, warped.drawnAt).lag;
      const a = plain.sample(now)!, b = warped.sample(now, lag * 1000)!;
      expect(b.time, `${i}`).toBeGreaterThanOrEqual(before - 1e-9);
      before = b.time;
      if (now > (1 + PARRY_FREEZE + .06) * 1000 + PARRY_SPAN * 1000) expect(b.time, `${i}`).toBeCloseTo(a.time, 6);
    }
  });
});

describe('the parry\'s payoff: its sting and its pulse', () => {
  it('the sting is made in code, the same every time: half a second, its peak where the freeze lets go', () => {
    const a = parrySting(48000), b = parrySting(48000);
    expect(a.length).toBe(Math.round(STING_SECONDS * 48000));
    expect(Array.from(a.subarray(0, 4000))).toEqual(Array.from(b.subarray(0, 4000)));
    let peak = 0, at = 0, swell = 0;
    for (let i = 0; i < a.length; i++) { expect(Number.isFinite(a[i])).toBe(true); if (Math.abs(a[i]) > peak) { peak = Math.abs(a[i]); at = i / 48000; } if (i / 48000 < STING_PEAK) swell = Math.max(swell, Math.abs(a[i])); }
    expect(peak).toBeCloseTo(.9, 3);
    expect(at).toBeGreaterThanOrEqual(STING_PEAK);
    expect(at).toBeLessThan(STING_PEAK + .05);
    expect(swell).toBeLessThan(peak * .7);
    expect(Math.abs(a[a.length - 1])).toBeLessThan(1e-3);
    // No file: the public repo carries the code.
    expect(readFileSync('src/audio/parrySting.ts', 'utf8')).not.toMatch(/\.(wav|m4a|mp3|ogg)['"]/);
  });

  it('the pulse: a thump in the parrier\'s hands and a knock in the thrower\'s, as the freeze lets go - after the parry\'s own kick', () => {
    const parry = { kind: 'just-guard', id: 1, serverTime: 10, actorId: 'them', targetId: 'me' } as CombatEvent;
    const own = pulseFor(parry, 'me')!, pay = parryPayPulse(parry, 'me')!, knock = parryPayPulse(parry, 'them')!;
    expect(pay.delay).toBeCloseTo(PARRY_FREEZE * 1000, 6);
    expect(own.delay ?? 0).toBe(0);
    expect(pay.strong).toBeGreaterThan(own.strong);
    expect(knock.delay).toBeCloseTo(PARRY_FREEZE * 1000, 6);
    expect(parryPayPulse(parry, 'someone')).toBeUndefined();
    expect(parryPayPulse({ ...parry, kind: 'blocked' }, 'me')).toBeUndefined();
  });
});

describe('the parry\'s payoff: never the simulation\'s, never the camera\'s', () => {
  /** A parry in the simulation: Kenzo swings, Taisei brings the guard up on the beat. */
  function parried(drawn?: (snapshot: GameSnapshot) => void) {
    const sim = new ArenaSimulation({ trainingBot: false, seed: 9 });
    sim.addPlayer('a', 'kenzo', 'A', false, { x: 0, y: 0, z: 0 });
    sim.addPlayer('b', 'taisei', 'B', false, { x: 0, y: 0, z: 1.6 });
    let seq = 0;
    const input = (id: string, more: Partial<PlayerInput> = {}) => sim.submitInput(id, { seq: seq++, moveX: 0, moveZ: 0, yaw: id === 'a' ? 0 : Math.PI, targetId: id === 'a' ? 'b' : 'a', ...more });
    const states: string[] = [];
    const step = (ticks: number, each?: () => void) => { for (let i = 0; i < ticks; i++) { each?.(); sim.step(); const snapshot = sim.snapshot(true); drawn?.(snapshot); states.push(JSON.stringify(snapshot)); } };
    input('a'); input('b');
    input('a', { attack: 'light' });
    step(Math.round((MOVES.kenzo.light.contacts[0] - JUST_GUARD_WINDOW * .5) * 60));
    step(Math.round((JUST_GUARD_WINDOW * .5 + .07) * 60), () => input('b', { guard: true }));
    step(60);
    return states;
  }
  it('the same parry played with the payoff drawing it and without: the simulation\'s every tick the same', () => {
    const timeline = new CombatTimeline(), pay = new ParryPayoff();
    let now = 0, slowed = false;
    const withPayoff = parried(snapshot => {
      now += FRAME; timeline.push(snapshot, now);
      const frame = timeline.sample(now, pay.frame(now, timeline.drawnAt).lag * 1000);
      if (frame) pay.observe(frame.events, id => id === 'b');
      slowed ||= pay.frame(now + 1, timeline.drawnAt).rate < 1;
    });
    const without = parried();
    expect(withPayoff.some(s => s.includes('"just-guard"'))).toBe(true);
    expect(slowed).toBe(true);
    expect(withPayoff).toEqual(without);
  });
  it('asks nothing of the camera, the simulation, the prediction or the input', () => {
    const source = readFileSync('src/render/parryPayoff.ts', 'utf8');
    const imports = source.split('\n').filter(line => line.startsWith('import ')).join('\n'), code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(imports).not.toMatch(/simulation|prediction|network|camera|input/i);
    for (const word of [/camera\./, /input\./, /submitInput/, /\.step\(/]) expect(code, String(word)).not.toMatch(word);
  });
});
