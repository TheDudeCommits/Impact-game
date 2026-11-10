import { describe, expect, it } from 'vitest';
import { BallMatch } from './BallMatch';
import { BALL_ID, BALL_SPORT, GOAL_RULES, SHOOT, SPIKE_RULES, type BallModeId } from './model';
import { STRIKE_MEET, pressAt } from './lesson';
import { freshBall } from './physics';
import { strikeBall } from './strike';
import { ArenaSimulation, validateInput } from '../simulation';
import { MOVES } from '../moves';
import { comboMove } from '../combos';
import { isReleasedFighter } from '../rosterAvailability';
import { HELD } from '../economy/fighters';
import type { FighterId, PlayerInput } from '../types';

/** SHOOT (model.ts SHOOT; the kernel's rule: simulation.ts SportStrike): a tap is the quick strike every
 *  fighter shares, a key held on winds up the fighter's own heavy as a CHARGED shot. Measured headless, in ticks from
 *  the command the room hears to the ball's velocity changing. */
const ROSTER = (Object.keys(MOVES) as FighterId[]).filter(f => isReleasedFighter(f) && !HELD.has(f));
/** The ball leaves this many ticks after the room hears a tap: the tick the swing starts on, and the seven its blow
 *  takes to land (SHOOT.contact). 0.133 s. */
const TAP_TICKS = 8;
/** The tick a blow whose first contact is `contact` seconds into its swing lands on, counted the same way. */
const ticksOf = (contact: number) => Math.ceil((contact + 1e-6) * 60 - 1e-9) + 1;
/** The tick a key held past SHOOT.hold turns the swing into the fighter's own move (a blow already due lands then). */
const HOLD_TICKS = Math.round(SHOOT.hold * 60) + 1;

interface Shot { at: number; shot: string | null; speed: number; heat: number; perfect?: boolean; text?: string; strikes: number; states: (string | undefined)[]; charge: number }
/** FREE PLAY, one fighter and the ball: the ball held still a stride ahead on the floor (or, `air`, level with the chest
 *  of a body on its way up), SHOOT pressed and its key kept down for `held` ticks; then what the ball was sent off with,
 *  and when. `setup` may change the fighter first (its stamina). */
function shoot(mode: BallModeId, fighter: FighterId, held: number, air = false, setup?: (m: BallMatch) => void): Shot {
  const m = new BallMatch(mode, { seed: 3, access: 'bots', practice: true });
  m.add('me', fighter, 'Me', false, 'red'); m.start();
  for (let i = 0; i < 600 && m.view.phase !== 'live'; i++) m.step(1 / 60);
  const R = mode === 'goal-rush' ? GOAL_RULES : SPIKE_RULES, z0 = mode === 'goal-rush' ? -6 : -5, b = m.ball, me = () => m.sim.actors.get('me')!.state;
  m.sim.place('me', { x: 0, y: 0, z: z0 }, 0); m.sim.clearPlayerInput('me');
  // (Sky Spike's ball is this side's to hit over: two touches in.)
  m.feed({ ball: { x: 0, y: R.ballRadius, z: z0 + 2, vx: 0, vy: 0, vz: 0 }, team: 'red', touchTeam: 'red', touches: 2 });
  const hang = () => { const p = me(); Object.assign(b, air ? { x: p.x, y: p.y + 1.3, z: p.z + 1.9 } : { x: 0, y: R.ballRadius, z: z0 + 2 }, { vx: 0, vy: 0, vz: 0, sx: 0, sy: 0, sz: 0, heat: 0 }); };
  let seq = 5000;
  const send = (input: Partial<PlayerInput>) => m.submit('me', { seq: ++seq, moveX: 0, moveZ: 0, yaw: 0, targetId: BALL_ID, ...input });
  setup?.(m);
  if (air) for (let i = 0; i < 9; i++) { hang(); send({ jump: i === 0, jumpHeld: true }); m.step(1 / 60); }
  const out: Shot = { at: -1, shot: null, speed: 0, heat: 0, strikes: 0, states: [], charge: 0 };
  for (let i = 0; i < 100 && out.at < 0; i++) {
    hang();
    send({ attack: i === 0 ? 'heavy' : undefined, heavyHeld: i < held, jumpHeld: air });
    m.step(1 / 60);
    const p = me();
    if (out.states[out.states.length - 1] !== p.strike) out.states.push(p.strike);
    out.charge = Math.max(out.charge, p.charge ?? 0);
    if (Math.hypot(b.vx, b.vy, b.vz) > 2) {
      const events = m.view.events.filter(e => e.kind === 'strike' && e.actorId === 'me'), last = events[events.length - 1];
      Object.assign(out, { at: i + 1, shot: b.shot, speed: Math.hypot(b.vx, b.vy, b.vz), heat: b.heat, perfect: last?.perfect, text: last?.text, strikes: events.length });
    }
  }
  return out;
}

describe('SHOOT, a tap: the quick strike every fighter shares', () => {
  it('the ball leaves 8 ticks (0.133 s) after the press for every fighter, on the floor, in both modes', () => {
    for (const mode of ['goal-rush', 'sky-spike'] as const) {
      const late = ROSTER.map(f => [f, shoot(mode, f, 0)] as const).filter(([, s]) => s.at !== TAP_TICKS).map(([f, s]) => `${f}:${s.at}`);
      expect(late, mode).toEqual([]);
    }
    // (The heavy's own first blow, which SHOOT was before the quick strike: 0.26 to 0.61 s by the fighter.)
    const own = ROSTER.map(f => MOVES[f].heavy.contacts[0]);
    expect(Math.min(...own)).toBeGreaterThan(.25); expect(Math.max(...own)).toBeGreaterThan(.6);
    expect(TAP_TICKS / 60).toBeLessThanOrEqual(.15);
  }, 240_000);
  it('and in the air, in both modes', () => {
    for (const mode of ['goal-rush', 'sky-spike'] as const) {
      const late = ROSTER.map(f => [f, shoot(mode, f, 0, true)] as const).filter(([, s]) => s.at !== TAP_TICKS).map(([f, s]) => `${f}:${s.at}`);
      expect(late, mode).toEqual([]);
    }
  }, 240_000);
  it('is a DRIVE on the floor and a VOLLEY in the air in Goal Rush, put on target; a hit over in Sky Spike', () => {
    const floor = shoot('goal-rush', 'gorai', 0), volley = shoot('goal-rush', 'gorai', 0, true);
    expect(floor).toMatchObject({ shot: 'drive', strikes: 1, states: ['tap'] });
    expect(volley.shot).toBe('volley');
    expect(floor.heat).toBeLessThan(.5);
    // A launcher's heavy (Konta's) and a thrown one (Lord Oro's) shoot the same shot: the quick strike is nobody's own.
    for (const f of ['konta', 'oro'] as const) expect(shoot('goal-rush', f, 0)).toMatchObject({ shot: 'drive', at: TAP_TICKS });
    expect(Math.abs(shoot('goal-rush', 'konta', 0).speed - floor.speed)).toBeLessThan(.01);
    expect(shoot('sky-spike', 'gorai', 0).shot).toBe('power');
  });
  it('let go a little late - up to SHOOT.hold after the press - is still a tap, struck as the key comes up', () => {
    for (const held of [3, 7, 8, 10, HOLD_TICKS - 2]) {
      const s = shoot('goal-rush', 'gorai', held);
      expect(s, `held ${held}`).toMatchObject({ shot: 'drive', states: ['tap'] });
      expect(s.at, `held ${held}`).toBe(Math.max(TAP_TICKS, held + 1));
      expect(s.at / 60).toBeLessThanOrEqual(SHOOT.hold + 1 / 60);
    }
  });
  it('is never refused for the lack of stamina (a heavy cost 20-30 of it, and a boost empties the bar)', () => {
    const s = shoot('goal-rush', 'gorai', 0, false, m => { m.sim.actors.get('me')!.state.stamina = 0; });
    expect(s).toMatchObject({ shot: 'drive', at: TAP_TICKS });
  });
  it('can be a PERFECT STRIKE, on the one cue every fighter shares (lesson.ts STRIKE_MEET)', () => {
    for (const f of ['gorai', 'konta', 'oro', 'kubiwa', 'setsu'] as const) {
      const m = new BallMatch('goal-rush', { seed: 3, access: 'host', fillBots: false });
      m.add('red-1', f, 'Red', false, 'red'); m.add('blue-1', 'konta', 'Blue', false, 'blue'); m.start();
      for (let i = 0; i < 1200 && m.view.phase !== 'live'; i++) m.step(1 / 60);
      m.sim.place('blue-1', { x: 10, y: 0, z: 14 }, 0); m.sim.place('red-1', { x: 0, y: 0, z: -6 }, 0);
      Object.assign(m.ball, { x: 0, y: GOAL_RULES.ballRadius, z: 10, vx: 0, vy: 0, vz: -12, heat: 0, lastId: 'blue-1', lastTeam: 'blue' });
      let seq = 0, pressed = false;
      for (let i = 0; i < 200; i++) {
        const p = m.sim.actors.get('red-1')!.state, b = m.ball, d = Math.hypot(b.x - p.x, b.z - p.z), press = !pressed && d <= pressAt(Math.hypot(b.vx, b.vz));
        if (press) pressed = true;
        m.submit('red-1', { seq: ++seq, moveX: 0, moveZ: 0, yaw: 0, targetId: BALL_ID, attack: press ? 'heavy' : undefined });
        m.step(1 / 60);
      }
      const strikes = m.view.events.filter(e => e.kind === 'strike' && e.actorId === 'red-1');
      expect(strikes.map(e => [e.shot, e.text, e.perfect]), f).toEqual([['drive', 'PERFECT STRIKE', true]]);
    }
    expect(STRIKE_MEET).toBeGreaterThan(1.9);
  });
});

describe('SHOOT, held: the fighter\'s own heavy, wound up as a CHARGED shot', () => {
  it('lands when the heavy\'s own blow always did, for every fighter (0.26 to 0.61 s by the fighter)', () => {
    const wrong: string[] = [], ticks: number[] = [];
    for (const f of ROSTER) {
      const own = MOVES[f].heavy, s = shoot('goal-rush', f, 200);
      // (A thrown or a beamed heavy lands when its shot gets there.)
      if (own.style !== 'melee') { if (s.shot !== 'blast' || s.at < HOLD_TICKS) wrong.push(`${f}:${s.shot}@${s.at}`); continue; }
      ticks.push(s.at);
      if (s.at !== Math.max(HOLD_TICKS, ticksOf(own.contacts[0])) || s.shot !== 'power' || s.states.join() !== 'tap,charge') wrong.push(`${f}:${s.shot}@${s.at} (${own.contacts[0]} s) ${s.states}`);
    }
    expect(wrong.join(' | ')).toBe('');
    expect(Math.min(...ticks) / 60).toBeGreaterThan(.25); expect(Math.max(...ticks) / 60).toBeLessThan(.66);
  }, 240_000);
  it('off the floor is the fighter\'s own air strike, landing when it did', () => {
    const wrong: string[] = [];
    for (const f of ROSTER) {
      const own = comboMove(f, 'airHeavy', false)!, s = shoot('goal-rush', f, 200, true);
      if (own.style !== 'melee') { if (s.shot !== 'blast') wrong.push(`${f}:${s.shot}@${s.at}`); continue; }
      if (s.at !== Math.max(HOLD_TICKS, ticksOf(own.contacts[0])) || s.shot !== 'spike') wrong.push(`${f}:${s.shot}@${s.at} (${own.contacts[0]} s)`);
    }
    expect(wrong.join(' | ')).toBe('');
  }, 240_000);
  it('flies clearly faster and hotter than a tap, the more the longer the key stayed down', () => {
    const tap = shoot('goal-rush', 'kubiwa', 0), full = shoot('goal-rush', 'kubiwa', 200), half = shoot('goal-rush', 'kubiwa', 20);
    expect(full.shot).toBe('power'); expect(half.shot).toBe('power');
    expect(full.speed).toBeGreaterThan(tap.speed * 1.2);
    expect(full.heat).toBeGreaterThan(tap.heat + .4);
    expect(full.charge).toBe(1);
    // Let go a third of a second in (Kubiwa's blow lands at 0.61 s): it still lands, half charged.
    expect(half.at).toBe(full.at);
    expect(half.charge).toBeGreaterThan(.4); expect(half.charge).toBeLessThan(.7);
    expect(half.speed).toBeGreaterThan(tap.speed); expect(half.speed).toBeLessThan(full.speed);
    expect(half.heat).toBeLessThan(full.heat);
    // Sky Spike's spike, the same way (struck from over the net, where its pace is its own and not the net's to set).
    const ball = { ...freshBall(), x: 0, y: 5.2, z: -1.4, held: false };
    const spike = (strike: 'tap' | 'charge', charge?: number) => { const r = strikeBall(ball, { mode: 'sky-spike', slot: 'heavy', move: { style: 'melee', name: 'Heavy' }, knockback: 3, launch: true, finisher: true, pushX: 0, pushZ: 1,
      touches: 3, strike, charge, striker: { id: 'r', team: 'red', x: 0, y: 4.2, z: -2.2, grounded: false, aimYaw: 0, forward: 0, lateral: 0, awakened: false, chain: 0 } }); return { shot: r.shot, speed: Math.hypot(r.vx, r.vy, r.vz), heat: r.heat }; };
    expect(spike('tap').shot).toBe('spike'); expect(spike('charge', 1).shot).toBe('spike');
    expect(spike('charge', 1).speed).toBeGreaterThan(spike('tap').speed * 1.15);
    expect(spike('charge', 1).heat).toBeGreaterThan(spike('tap').heat);
    expect(spike('charge', .5).speed).toBeLessThan(spike('charge', 1).speed);
  });
  it('without the stamina for the heavy is the quick strike after all, as the key\'s hold runs out', () => {
    const s = shoot('goal-rush', 'gorai', 200, false, m => { m.sim.actors.get('me')!.state.stamina = SHOOT.stamina + 2; });
    expect(s).toMatchObject({ shot: 'drive', at: HOLD_TICKS, states: ['tap'] });
  });
  it('is only the press that is still held: a second tap does not charge the first, and waits for SHOOT\'s cooldown', () => {
    const m = new BallMatch('goal-rush', { seed: 3, access: 'bots', practice: true });
    m.add('me', 'gorai', 'Me', false, 'red'); m.start();
    for (let i = 0; i < 600 && m.view.phase !== 'live'; i++) m.step(1 / 60);
    m.sim.place('me', { x: 0, y: 0, z: -6 }, 0);
    const b = m.ball, hits: number[] = [];
    let seq = 9000;
    for (let i = 0; i < 60; i++) {
      Object.assign(b, { x: 0, y: GOAL_RULES.ballRadius, z: -4, vx: 0, vy: 0, vz: 0, heat: 0 });
      // Pressed and let go, then pressed again four ticks later and held from there on.
      m.submit('me', { seq: ++seq, moveX: 0, moveZ: 0, yaw: 0, targetId: BALL_ID, attack: i === 0 || i === 4 ? 'heavy' : undefined, heavyHeld: i === 0 || i >= 4 });
      m.step(1 / 60);
      if (Math.hypot(b.vx, b.vy, b.vz) > 2) hits.push(i + 1);
    }
    // The first swing was a tap (its own key came up), struck on time; nothing lands again inside the cooldown.
    expect(hits[0]).toBe(TAP_TICKS);
    expect(hits.length).toBeGreaterThan(0);
    for (const at of hits.slice(1)) expect(at / 60).toBeGreaterThan(SHOOT.cooldown);
  });
});

describe('SHOOT is the ball\'s: every other heavy is the fighter\'s own', () => {
  it('Goal Rush\'s FIGHT stance keeps its heavy, whatever the key does', () => {
    const m = new BallMatch('goal-rush', { seed: 3, access: 'host', fillBots: false });
    m.add('red-1', 'gorai', 'Red', false, 'red'); m.add('blue-1', 'konta', 'Blue', false, 'blue'); m.start();
    for (let i = 0; i < 1200 && m.view.phase !== 'live'; i++) m.step(1 / 60);
    m.sim.place('red-1', { x: 0, y: 0, z: -6 }, 0); m.sim.place('blue-1', { x: 0, y: 0, z: -4.4 }, Math.PI);
    Object.assign(m.ball, { x: 8, y: GOAL_RULES.ballRadius, z: 8, vx: 0, vy: 0, vz: 0 });
    const hp = m.sim.actors.get('blue-1')!.state.hp;
    let seq = 0, seen: string | undefined, hurtAt = -1;
    for (let i = 0; i < 60; i++) {
      m.submit('red-1', { seq: ++seq, moveX: 0, moveZ: 0, yaw: 0, targetId: 'blue-1', lock: true, attack: i === 0 ? 'heavy' : undefined });
      m.step(1 / 60);
      seen ??= m.sim.actors.get('red-1')!.state.strike;
      if (hurtAt < 0 && m.sim.actors.get('blue-1')!.state.hp < hp) hurtAt = i + 1;
    }
    expect(m.seats.get('red-1')!.lock).toBe('blue-1');
    expect(seen).toBeUndefined();
    // A tap: and still Gorai's own heavy, landing on them half a second in.
    expect(hurtAt).toBe(ticksOf(MOVES.gorai.heavy.contacts[0]));
  });
  it('a room that does not ask ignores the held key; only a true one is kept on the wire, and only a boolean is let in', () => {
    expect(BALL_SPORT['goal-rush'].strike?.move.contacts[0]).toBe(SHOOT.contact);
    expect(BALL_SPORT['sky-spike'].strike?.hold).toBe(SHOOT.hold);
    const sim = new ArenaSimulation({ roomMode: 'training', adaptive: false, trainingBot: false, seed: 3 });
    sim.addPlayer('a', 'gorai', 'A'); sim.addPlayer('b', 'konta', 'B');
    for (let i = 0; i < 40; i++) { sim.submitInput('a', { seq: i + 1, moveX: 0, moveZ: 0, yaw: 0, attack: i === 0 ? 'heavy' : undefined, heavyHeld: true }); sim.step(1 / 60); }
    const a = sim.getPlayer('a')!;
    expect(a.action).toBe('heavy'); expect(a.strike).toBeUndefined(); expect(a.actionDuration).toBeCloseTo(MOVES.gorai.heavy.duration, 5);
    const base = { seq: 1, moveX: 0, moveZ: 0, yaw: 0 };
    expect(validateInput({ ...base, heavyHeld: true })?.heavyHeld).toBe(true);
    expect('heavyHeld' in validateInput({ ...base, heavyHeld: false })!).toBe(false);
    expect('heavyHeld' in validateInput(base)!).toBe(false);
    expect(validateInput({ ...base, heavyHeld: 1 })).toBeNull();
  });
});
