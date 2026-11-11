import { describe, expect, it } from 'vitest';
import { BallMatch, CARRY, LOOSE, SEEN, TRAP, carrySpot } from './BallMatch';
import { BALL_ID, BALL_SPORT, GOAL_RULES, PASS_CALL, quickChat, type BallState } from './model';
import { stepBall } from './physics';
import { PASS_AIM, strikeBall, type StrikeContext } from './strike';
import { TouchForecaster, type LocalFighter } from './touchForecast';
import type { PlayerInput } from '../types';

// Goal Rush's first touch (TRAP), the carry (CARRY, LOOSE), the aimed pass (PASS_AIM)
// and the call for the ball (PASS_CALL), each set up in a match of people (or one bot) and played tick by tick.
const R = GOAL_RULES, r = R.ballRadius, dt = 1 / 60;
type Inside = { bodyContacts(dt: number): void; tackles(events: unknown[]): void; bumps(): void; startCarry(seat: unknown, a: unknown, heading: number): void;
  last: Map<string, { x: number; y: number; z: number; vx: number; vy: number; vz: number }> };
const inside = (m: BallMatch) => m as unknown as Inside;
let SEQ = 1;
const send = (m: BallMatch, id: string, more: Partial<PlayerInput> = {}, lag?: number) =>
  m.submit(id, { seq: ++SEQ, moveX: 0, moveZ: 0, yaw: 0, targetId: BALL_ID, ...(lag !== undefined ? { view: m.sim.serverTime - lag } : {}), ...more } as PlayerInput);

/** People only (`ids`: red-1 and blue-1, and any more given), the ball live, nobody moving it but the test. */
function match(more: { id: string; team: 'red' | 'blue'; bot?: boolean }[] = [], compensate = false) {
  const m = new BallMatch('goal-rush', { seed: 3, access: 'host', fillBots: false, replays: false });
  m.add('red-1', 'taisei', 'Red', false, 'red');
  m.add('blue-1', 'konta', 'Blue', false, 'blue');
  for (const s of more) m.add(s.id, s.team === 'red' ? 'gorai' : 'kubiwa', s.id, !!s.bot, s.team);
  if (compensate) { m.compensate = SEEN.most; m.sim.rewind = SEEN.most; }
  expect(m.start()).toBe(true);
  for (let i = 0; i < 600 && m.view.phase !== 'live'; i++) m.step(dt);
  expect(m.view.phase).toBe('live');
  m.sim.place('blue-1', { x: 11, y: 0, z: 16 }, Math.PI);
  return m;
}
const rest = (m: BallMatch, at: { x: number; z: number }, v: { x: number; z: number } = { x: 0, z: 0 }, team: 'red' | 'blue' | null = null, id: string | null = null) =>
  Object.assign(m.ball, { x: at.x, y: r, z: at.z, vx: v.x, vy: 0, vz: v.z, sx: 0, sy: 0, sz: 0, heat: 0, held: false, super: false, frozenUntil: 0, clash: 0, lastId: id, lastTeam: team, shot: id ? 'tap' : null });
const flat = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);
const body = (m: BallMatch, id: string) => m.sim.actors.get(id)!.state;

/** red-1 at z -8, running up the pitch (+z) into a ball at rest 2.5 m ahead: the carry, for `ticks`. */
function runIn(m: BallMatch, ticks = 60, stick = 1) {
  m.sim.place('red-1', { x: 0, y: 0, z: -8 }, 0);
  rest(m, { x: 0, z: -5.5 });
  for (let i = 0; i < ticks; i++) { send(m, 'red-1', { moveZ: stick }); m.step(dt); }
}

describe('Goal Rush\'s carry (CARRY)', () => {
  it('a body running into a slow ball with the stick held carries it at its feet, at 85% of its pace', () => {
    const m = match();
    runIn(m, 30);
    expect(m.ball.carry).toBe('red-1');
    // At its feet, in front along the run, on the floor, moving as it does - a second later still.
    const spot = (m: BallMatch) => { const p = body(m, 'red-1'); return carrySpot(p, 0, r); };
    for (let i = 0; i < 60; i++) {
      send(m, 'red-1', { moveZ: 1 }); m.step(dt);
      expect(m.ball.carry).toBe('red-1');
      expect(flat(m.ball, spot(m))).toBeLessThan(.05);
      expect(m.ball.y).toBeCloseTo(r, 2);
    }
    const from = { ...body(m, 'red-1') };
    for (let i = 0; i < 30; i++) { send(m, 'red-1', { moveZ: 1 }); m.step(dt); }
    const pace = flat(body(m, 'red-1'), from) / .5;
    expect(pace).toBeGreaterThan(BALL_SPORT['goal-rush'].run * CARRY.pace - .3);
    expect(pace).toBeLessThan(BALL_SPORT['goal-rush'].run * CARRY.pace + .3);
    expect(Math.hypot(m.ball.vx, m.ball.vz)).toBeCloseTo(pace, 0);
    // The ball's view says who carries it: one field, the carrier's id.
    expect(m.snapshot().ball.ball.carry).toBe('red-1');
    expect(m.counts.carries).toBe(1);
  });
  it('turns round the body as the run turns, never a jump', () => {
    const m = match();
    runIn(m, 30);
    let most = 0, was = { ...m.ball };
    for (let i = 0; i < 40; i++) { send(m, 'red-1', { moveX: 1 }); m.step(dt); most = Math.max(most, flat(m.ball, was) - Math.hypot(m.ball.vx, m.ball.vz) * dt); was = { ...m.ball }; }
    expect(m.ball.carry).toBe('red-1');
    // (Off the body along the new way now: +x.)
    expect(m.ball.x - body(m, 'red-1').x).toBeGreaterThan(1);
    expect(most).toBeLessThan(.3);
  });
  it('ends when the stick is let go: the ball rolls on at the carrier\'s pace', () => {
    const m = match();
    runIn(m, 50);
    expect(m.ball.carry).toBe('red-1');
    const v = Math.hypot(m.ball.vx, m.ball.vz);
    send(m, 'red-1'); m.step(dt);
    expect(m.ball.carry).toBeUndefined();
    expect(Math.hypot(m.ball.vx, m.ball.vz)).toBeGreaterThan(v - 1);
    // (Not taken straight back: the slow-ball rule and CARRY.again.)
    for (let i = 0; i < 6; i++) { send(m, 'red-1', { moveZ: 1 }); m.step(dt); }
    expect(m.ball.carry).toBeUndefined();
    expect(m.carryEnds.stick).toBe(1);
  });
  it('a light stick, a slow walk or a fast ball is no carry', () => {
    const half = match(); runIn(half, 40, .4); expect(half.ball.carry).toBeUndefined();
    const fast = match();
    fast.sim.place('red-1', { x: 0, y: 0, z: -8 }, 0);
    rest(fast, { x: 0, z: -2 }, { x: 0, z: -CARRY.slow - 3 });
    for (let i = 0; i < 40; i++) { send(fast, 'red-1', { moveZ: 1 }); fast.step(dt); }
    expect(fast.counts.carries).toBe(0);
  });
  it('the carrier\'s own strike plays it from the feet, as a ball at rest: a tap of SHOOT flies off along the aim', () => {
    const m = match();
    runIn(m, 50);
    expect(m.ball.carry).toBe('red-1');
    send(m, 'red-1', { moveZ: 1, attack: 'heavy' });
    for (let i = 0; i < 20; i++) { m.step(dt); send(m, 'red-1', { moveZ: 1 }); }
    expect(m.ball.carry).toBeUndefined();
    expect(m.ball.vz).toBeGreaterThan(15);
    expect(Math.abs(m.ball.vx)).toBeLessThan(3);
    expect(m.carryEnds.struck).toBe(1);
  });
  it('is the carrier\'s: a team-mate\'s body and swings let it be', () => {
    const m = match([{ id: 'red-2', team: 'red' }]);
    m.sim.place('red-2', { x: 1, y: 0, z: -1 }, Math.PI);
    runIn(m, 60);
    expect(m.ball.carry).toBe('red-1');
    // (It went by the team-mate's body a metre off: still at the carrier's feet.)
    expect(body(m, 'red-1').z).toBeGreaterThan(-1);
    const swing = { attackerId: 'red-2', slot: 'light', move: { name: 'L', duration: .3, contacts: [.1], damage: 1, range: 2, radius: 1, stamina: 0, cooldown: 0, stun: .1, knockback: 2, style: 'melee' }, damage: 1, critical: false, finisher: false, pushX: 0, pushZ: -1, knockback: 2, stun: .1, launch: false, hitstop: 0 } as never;
    expect(m.receive(m.locate(BALL_ID)!, swing)).toBeNull();
    expect(m.ball.carry).toBe('red-1');
  });
  it('a body of the other side meeting the ball knocks it off the carrier', () => {
    const m = match();
    m.sim.place('blue-1', { x: 0, y: 0, z: -1 }, Math.PI);
    runIn(m, 70);
    expect(m.counts.carries).toBe(1);
    expect(m.ball.carry).toBeUndefined();
    expect(m.carryEnds.met).toBe(1);
  });
  it('a TACKLE or a BUMP pops it LOOSE toward whoever knocked it off', () => {
    for (const how of ['tackle', 'bump'] as const) {
      const m = match();
      runIn(m, 40);
      expect(m.ball.carry).toBe('red-1');
      const p = body(m, 'red-1');
      m.sim.place('blue-1', { x: p.x + 1.2, y: 0, z: p.z + .2 }, -Math.PI / 2);
      if (how === 'tackle') { m.seats.get('blue-1')!.lock = 'red-1'; inside(m).tackles([{ kind: 'hit', actorId: 'blue-1', targetId: 'red-1', reaction: 'knockdown' }]); }
      else { m.sim.actors.get('blue-1')!.boosting = true; inside(m).last.set('blue-1', { x: p.x + 1.2, y: 0, z: p.z + .2, vx: -13, vy: 0, vz: 0 }); inside(m).last.set('red-1', { x: p.x, y: 0, z: p.z, vx: 0, vy: 0, vz: 0 }); inside(m).bumps(); }
      const b = m.ball, q = body(m, 'blue-1'), toward = ((q.x - b.x) * b.vx + (q.z - b.z) * b.vz) / (flat(q, b) * Math.hypot(b.vx, b.vz));
      expect(b.carry, how).toBeUndefined();
      // (No further than their feet - fightPays.test.ts.)
      expect(Math.hypot(b.vx, b.vz), how).toBeLessThanOrEqual(LOOSE.speed + 1e-9);
      expect(Math.hypot(b.vx, b.vz), how).toBeGreaterThan(0);
      expect(b.vy, how).toBe(LOOSE.up);
      expect(toward, how).toBeGreaterThan(.99);
      expect(m.counts.loose, how).toBe(1);
      expect(m.carryEnds[how], how).toBe(1);
      // The carrier at their own pace again (the kernel's speed mod set back, never deleted).
      expect(m.sim.mods('red-1').speed, how).toBe(1);
    }
  });
  it('ends at a goal: walked in, it counts for the carrier', () => {
    const m = match();
    m.sim.place('red-1', { x: 0, y: 0, z: R.halfZ - 9 }, 0); m.sim.place('blue-1', { x: 10, y: 0, z: 0 }, 0);
    rest(m, { x: 0, z: R.halfZ - 6.5 });
    for (let i = 0; i < 240 && m.view.phase === 'live'; i++) { send(m, 'red-1', { moveZ: 1 }); m.step(dt); }
    expect(m.counts.carries).toBe(1);
    expect(m.view.score.red).toBe(1);
    expect(m.seats.get('red-1')!.goals).toBe(1);
    expect(m.ball.carry).toBeUndefined();
  });
  it('never in Sky Spike, nor under FREE PLAY\'s ball machine', () => {
    const lesson = new BallMatch('goal-rush', { seed: 3, access: 'bots', practice: true, lesson: true } as never);
    lesson.add('red-1', 'taisei', 'Red', false, 'red'); lesson.start();
    for (let i = 0; i < 60 * 30; i++) { send(lesson, 'red-1', { moveZ: 1 }); lesson.step(dt); }
    expect(lesson.counts.carries).toBe(0);
  });
});

/** red-1 standing at z -6 facing up the pitch; a ball rolled at it from up the pitch (`team`'s, at `speed`); the guard
 *  pressed `lead` s before the ball reaches the guard (read off the ball's own flight), held after. */
function guardFor(lead: number, team: 'red' | 'blue', opts: { speed?: number; z?: number; lag?: number; compensate?: boolean; grounded?: boolean } = {}) {
  const m = match([], !!opts.compensate);
  const z = opts.z ?? -6, lag = opts.lag;
  m.sim.place('red-1', { x: 0, y: 0, z }, 0);
  for (let i = 0; i < 40; i++) { send(m, 'red-1', {}, lag); m.step(dt); }
  rest(m, { x: 0, z: z + 9 }, { x: 0, z: -(opts.speed ?? 11) }, team, team === 'red' ? 'red-9' : 'blue-1');
  const reach = r + .45 + .7, kept: BallState[] = [];
  let pressed = false;
  for (let i = 0; i < 120; i++) {
    kept.push({ ...m.ball });
    // (The ball as the page draws it: `lag` behind the room.)
    const drawn = lag ? kept[Math.max(0, kept.length - 1 - Math.round(lag * 60))] : m.ball;
    const probe = { ...drawn }, p = body(m, 'red-1');
    let t = 0;
    for (; t < 2 && flat(probe, p) > reach; t += dt) stepBall('goal-rush', probe, dt);
    if (!pressed && t <= lead + 1e-6) pressed = true;
    send(m, 'red-1', { guard: pressed }, lag);
    m.step(dt);
  }
  return m;
}

describe('Goal Rush\'s first touch (TRAP)', () => {
  it('the guard pressed as a pass arrives traps it dead at the feet, carried; a guard up long before only turns it', () => {
    for (const lead of [.05, .15, .25]) {
      const m = guardFor(lead, 'red');
      expect(m.view.events.filter(e => e.kind === 'perfect' && e.actorId === 'red-1').map(e => e.text), `lead ${lead}`).toEqual(['TRAP']);
      expect(m.counts.traps, `lead ${lead}`).toBe(1);
      // At the feet: still there (the body stood, its guard up: the guard's reach keeps it off), the ball all but still.
      expect(flat(m.ball, body(m, 'red-1')), `lead ${lead}`).toBeLessThan(2.1);
      expect(Math.hypot(m.ball.vx, m.ball.vz), `lead ${lead}`).toBeLessThan(.5);
    }
    for (const lead of [TRAP.window + .2, .8]) {
      const m = guardFor(lead, 'red');
      expect(m.counts.traps, `lead ${lead}`).toBe(0);
      expect(flat(m.ball, body(m, 'red-1')), `lead ${lead}`).toBeGreaterThan(3);
    }
  });
  it('traps the other side\'s ball too - an interception - but a shot at your own goal is a save, as ever', () => {
    // (Slow enough that it would not reach their goal inside the 1.8 s that make a ball a shot on target.)
    expect(guardFor(.15, 'blue', { speed: 7 }).counts.traps).toBe(1);
    const m = guardFor(.15, 'blue', { z: -R.halfZ + 1.6, speed: 22 });
    expect(m.counts.traps).toBe(0);
    expect(m.view.events.filter(e => e.kind === 'save' && e.actorId === 'red-1').map(e => e.text)).toEqual(['PERFECT SAVE']);
  });
  it('online, judged where the page drew the ball (SEEN): a press heard after the room\'s ball met the body', () => {
    for (const lag of [.22, .28]) {
      // (Judged against the room's own present, the ball is off the body before the guard goes up.)
      expect(guardFor(.12, 'red', { lag, compensate: false }).counts.traps, `lag ${lag}`).toBe(0);
      const m = guardFor(.12, 'red', { lag, compensate: true });
      expect(m.counts.traps, `lag ${lag}`).toBe(1);
      expect(flat(m.ball, body(m, 'red-1')), `lag ${lag}`).toBeLessThan(2.1);
    }
    // Pressed late as the page drew it: no trap.
    expect(guardFor(-.15, 'red', { lag: .22, compensate: true }).counts.traps).toBe(0);
  });
});

describe('Goal Rush\'s aimed pass (PASS_AIM)', () => {
  const ball = (): BallState => ({ x: 0, y: r, z: 0, vx: 0, vy: 0, vz: 0, sx: 0, sy: 0, sz: 0, heat: 0, lastId: null, lastTeam: null, shot: null, held: false, frozenUntil: 0, super: false, size: 1, grav: 1, wall: null, clash: 0 });
  /** A light (the tap's pass) struck from a ball at rest at the striker's feet, the view along +z, the stick `stick`. */
  const pass = (stick: { x: number; z: number }, mates: { x: number; z: number; vx: number; vz: number }[]) => {
    const yaw = 0, c: StrikeContext = { mode: 'goal-rush', slot: 'light', move: { style: 'melee', name: 'L', contacts: [.1] }, knockback: 2, launch: false, finisher: false, pushX: 0, pushZ: 1, mates,
      striker: { id: 'p', team: 'red', x: 0, y: 0, z: -1.4, grounded: true, aimYaw: yaw, awakened: false, chain: 0, forward: stick.x * Math.sin(yaw) + stick.z * Math.cos(yaw), lateral: -stick.x * Math.cos(yaw) + stick.z * Math.sin(yaw) } };
    return strikeBall(ball(), c);
  };
  /** Where the pass comes down to a foot's height, and when. */
  const lands = (v: { vx: number; vy: number; vz: number }) => {
    const b = { ...ball(), ...v, held: false };
    let t = 0;
    for (; t < 4 && !(b.vy < 0 && b.y <= r + .4); t += dt) stepBall('goal-rush', b, dt);
    return { x: b.x, z: b.z, t };
  };
  it('goes to the team-mate nearest the stick\'s line, led by their run so it arrives where they will be', () => {
    const A = { x: 5, z: 9, vx: 0, vz: 0 }, B = { x: -9, z: 6, vx: 0, vz: 6 };
    const toB = pass({ x: -9 / Math.hypot(9, 6), z: 6 / Math.hypot(9, 6) }, [A, B]);
    expect(toB.aimed).toBe(1);
    const at = lands(toB), there = { x: B.x + B.vx * at.t, z: B.z + B.vz * at.t };
    expect(flat(at, there)).toBeLessThan(1.2);
    // The other, its stick at A (off the view's 28 degrees: no pass to them without the stick).
    const toA = pass({ x: 5 / Math.hypot(5, 9), z: 9 / Math.hypot(5, 9) }, [A, B]);
    expect(toA.aimed).toBe(0);
    expect(flat(lands(toA), A)).toBeLessThan(1.2);
    // Two near the line: the nearer to it.
    const C = { x: -2, z: 14, vx: 0, vz: 0 }, D = { x: 3, z: 8, vx: 0, vz: 0 };
    expect(pass({ x: 0, z: 1 }, [D, C]).aimed).toBe(1);
  });
  it('with no stick (or nobody near its line) the tap is as it always was', () => {
    const A = { x: 1.5, z: 9, vx: 0, vz: 4 }, B = { x: -9, z: 2, vx: 0, vz: 0 };
    const none = pass({ x: 0, z: 0 }, [A, B]), eased = pass({ x: 0, z: PASS_AIM.stick - .05 }, [A, B]), away = pass({ x: 0, z: -1 }, [A, B]);
    for (const p of [none, eased, away]) {
      expect(p.aimed).toBeUndefined();
      expect(p).toEqual({ ...none });
    }
    // (Today's: the team-mate within 28 degrees of the view, four fifths of their run.)
    const at = lands(none);
    expect(flat(at, { x: A.x, z: A.z + A.vz * at.t * .8 })).toBeLessThan(1.5);
  });
});

describe('the call for the ball (PASS_CALL)', () => {
  /** red-1 a person up the pitch, red-bot carrying the ball, blue-1 `blocking` the lane or far off; the call made or not. */
  function called(call: boolean, blocking = false) {
    const m = match([{ id: 'red-bot', team: 'red', bot: true }]);
    m.sim.place('red-bot', { x: 0, y: 0, z: -10 }, 0); m.sim.place('red-1', { x: -8, y: 0, z: -2 }, 0);
    m.sim.place('blue-1', blocking ? { x: -4, y: 0, z: -6 } : { x: 11, y: 0, z: 16 }, Math.PI);
    m.step(dt);
    const seat = m.seats.get('red-bot')!, a = m.sim.actors.get('red-bot')!;
    rest(m, carrySpot(a.state, 0, r)); inside(m).startCarry(seat, a, 0);
    if (call) expect(m.chat('red-1', quickChat('goal-rush').indexOf(PASS_CALL.line))).toBe(true);
    let to = '';
    for (let i = 0; i < 60 && !to; i++) {
      // (The rival keeps to the lane: halfway between the ball and the caller.)
      if (blocking) m.sim.place('blue-1', { x: (m.ball.x - 8) / 2, y: 0, z: (m.ball.z - 2) / 2 }, Math.PI);
      send(m, 'red-1'); m.step(dt); if (m.ball.lastId === 'red-bot' && m.ball.shot === 'tap') to = flat({ x: m.ball.vx, z: m.ball.vz }, { x: 0, z: 0 }) > 3 ? 'pass' : ''; }
    return { m, to };
  }
  it('is quick chat\'s fourth INFO line in Goal Rush, no new key', () => {
    expect(quickChat('goal-rush')[3]).toBe(PASS_CALL.line);
    expect(quickChat('sky-spike')).not.toContain(PASS_CALL.line);
  });
  it('has the carrying bot of their side pass to the person who called, when the lane is open', () => {
    const yes = called(true);
    expect(yes.to).toBe('pass');
    expect(yes.m.counts.called).toBe(1);
    // Toward them: the pass's line at the caller.
    const b = yes.m.ball, q = body(yes.m, 'red-1');
    expect(((q.x - b.x) * b.vx + (q.z - b.z) * b.vz) / (flat(q, b) * Math.hypot(b.vx, b.vz))).toBeGreaterThan(.9);
    // Not called: carried on.
    expect(called(false).to).toBe('');
  });
  it('never a blind one: a rival in the lane, and the bot plays on', () => {
    const blind = called(true, true);
    expect(blind.m.counts.called).toBe(0);
    expect(blind.to).toBe('');
  });
  it('lasts five seconds', () => {
    const m = match([{ id: 'red-bot', team: 'red', bot: true }]);
    m.chat('red-1', quickChat('goal-rush').indexOf(PASS_CALL.line));
    for (let i = 0; i < (PASS_CALL.seconds + .2) * 60; i++) { send(m, 'red-1'); m.step(dt); }
    const seat = m.seats.get('red-bot')!, a = m.sim.actors.get('red-bot')!;
    m.sim.place('red-bot', { x: 0, y: 0, z: -10 }, 0); m.sim.place('red-1', { x: -8, y: 0, z: -2 }, 0); m.sim.place('blue-1', { x: 11, y: 0, z: 16 }, Math.PI); m.step(dt);
    rest(m, carrySpot(a.state, 0, r)); inside(m).startCarry(seat, a, 0);
    const before = m.counts.called;
    for (let i = 0; i < 30; i++) { send(m, 'red-1'); m.step(dt); }
    expect(m.counts.called - before).toBe(0);
  });
});

describe('the page\'s forecast of the trap and the carry (touchForecast.ts)', () => {
  it('forecasts a carry begun and a trap as the room makes them', () => {
    for (const what of ['carry', 'trap'] as const) {
      const m = match();
      const f = new TouchForecaster(), me = () => m.sim.actors.get('red-1')! as unknown as LocalFighter;
      const world = () => ({ view: m.view, selfId: 'red-1', players: m.sim.playerStates() });
      const M = m as unknown as { bodyContacts(dt: number): void };
      let out: { room: BallState; forecast: BallState | null } | null = null;
      const bodyContacts = M.bodyContacts.bind(m);
      M.bodyContacts = d => {
        const before = { ...m.ball }, fc = f.after(me(), m.sim.serverTime, d, before, world());
        bodyContacts(d);
        if (!out && m.ball.carry) out = { room: { ...m.ball }, forecast: fc?.ball ?? null };
      };
      if (what === 'carry') runIn(m, 40);
      else {
        m.sim.place('red-1', { x: 0, y: 0, z: -6 }, 0);
        rest(m, { x: 0, z: 3 }, { x: 0, z: -11 }, 'red', 'red-9');
        for (let i = 0; i < 120 && !out; i++) { const near = flat(m.ball, body(m, 'red-1')) < 4; f.before(me()); send(m, 'red-1', { guard: near }); m.step(dt); }
      }
      expect(out, what).not.toBeNull();
      expect(out!.forecast, what).not.toBeNull();
      expect(out!.forecast!.carry, what).toBe('red-1');
      expect(Math.hypot(out!.forecast!.vx - out!.room.vx, out!.forecast!.vz - out!.room.vz), what).toBeLessThan(.05);
      expect(flat(out!.forecast!, out!.room), what).toBeLessThan(.05);
    }
  });
});
