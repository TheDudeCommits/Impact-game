import { describe, expect, it } from 'vitest';
import { BallMatch, CARRY, LOOSE, REVERSAL, SEEN, TACKLE_WON, looseToward } from './BallMatch';
import { PLAYER_RADIUS } from '../moves';
import { BALL_ID, GOAL_FIGHT, GOAL_RULES, inPlay, shortSide, type BallSeat } from './model';
import { BOT_LEVELS, FIGHT_BOT, LEVEL_EDGE } from './BallBrain';
import { StanceControl, WON_HOLD } from './stance';
import { goalZ } from './physics';
import type { PlayerInput } from '../types';

// The fight paid in the sport: Goal Rush's TACKLE that wins the ball off its
// carrier (TACKLE_WON), the REVERSAL (a guard timed against a tackle), and the POWER PLAY (a side a body short) - each set up
// in a match of people and played tick by tick through the fighting kernel.
const r = GOAL_RULES.ballRadius, dt = 1 / 60;
let SEQ = 1;
const send = (m: BallMatch, id: string, more: Partial<PlayerInput> = {}, lag?: number) =>
  m.submit(id, { seq: ++SEQ, moveX: 0, moveZ: 0, yaw: 0, targetId: BALL_ID, ...(lag !== undefined ? { view: m.sim.serverTime - lag } : {}), ...more } as PlayerInput);
const body = (m: BallMatch, id: string) => m.sim.actors.get(id)!.state;
const flat = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);

/** red-1 carrying the ball up the pitch (+z), blue-1 off to the side; `lag`: online, red-1's page drawing that far behind. */
function carrying(compensate = false, lag?: number) {
  const m = new BallMatch('goal-rush', { seed: 3, access: 'host', fillBots: false, replays: false });
  m.add('red-1', 'taisei', 'Red', false, 'red');
  m.add('blue-1', 'konta', 'Blue', false, 'blue');
  if (compensate) { m.compensate = SEEN.most; m.sim.rewind = SEEN.most; }
  expect(m.start()).toBe(true);
  for (let i = 0; i < 600 && m.view.phase !== 'live'; i++) m.step(dt);
  m.sim.place('blue-1', { x: 11, y: 0, z: 16 }, Math.PI);
  m.sim.place('red-1', { x: 0, y: 0, z: -8 }, 0);
  Object.assign(m.ball, { x: 0, y: r, z: -5.5, vx: 0, vy: 0, vz: 0, sx: 0, sy: 0, sz: 0, heat: 0, held: false, super: false, frozenUntil: 0, clash: 0, lastId: null, lastTeam: null, shot: null });
  for (let i = 0; i < 40; i++) { send(m, 'red-1', { moveZ: 1 }, lag); m.step(dt); }
  expect(m.ball.carry).toBe('red-1');
  return m;
}
/** blue-1 put 1.8 m beside the carrier, locked on them, a light pressed on the first tick and run at them; red-1 runs on
 *  with the ball, the guard pressed from tick `guard` (never: -1), facing blue-1 or not. The kernel's light lands on
 *  the 20th tick (0.32 s: the lock-on's chase and the blow), in this setup. Returns what the room said. */
function tackle(m: BallMatch, guard = -1, face = true, lag?: number, ticks = 50) {
  const p = body(m, 'red-1');
  m.sim.place('blue-1', { x: p.x + 1.8, y: 0, z: p.z }, -Math.PI / 2);
  const from = m.view.events.length ? m.view.events[m.view.events.length - 1].id : 0;
  const kernel: string[] = [];
  /** The ball as it left the carrier's feet, and the tackler then. */
  let popped: { vx: number; vz: number; toward: number } | null = null;
  for (let i = 0; i < ticks; i++) {
    const q = body(m, 'blue-1'), me = body(m, 'red-1'), at = Math.atan2(me.x - q.x, me.z - q.z);
    send(m, 'blue-1', { targetId: 'red-1', lock: true, yaw: at, moveX: Math.sin(at), moveZ: Math.cos(at), ...(i === 0 ? { attack: 'light' } : {}) });
    send(m, 'red-1', { moveZ: 1, yaw: face ? at + Math.PI : 0, ...(guard >= 0 && i >= guard ? { guard: true } : {}) }, lag);
    const carried = m.ball.carry;
    m.step(dt);
    if (carried && !m.ball.carry && !popped) { const b = m.ball, t = body(m, 'blue-1'); popped = { vx: b.vx, vz: b.vz, toward: ((t.x - b.x) * b.vx + (t.z - b.z) * b.vz) / (flat(t, b) * Math.hypot(b.vx, b.vz)) }; }
    for (const e of (m as unknown as { events: { kind: string; actorId: string; targetId?: string }[] }).events.splice(0)) if (['hit', 'blocked', 'just-guard'].includes(e.kind) && e.targetId === 'red-1') kernel.push(e.kind);
  }
  const said = m.view.events.filter(e => e.id > from && (e.kind === 'tackle' || e.kind === 'reversal'));
  return { kernel, said, tackled: said.find(e => e.kind === 'tackle'), reversed: said.find(e => e.kind === 'reversal'), popped };
}

describe('Goal Rush\'s TACKLE that wins the ball (TACKLE_WON)', () => {
  it('a FIGHT-stance blow on the carrier is a TACKLE whatever it does to them: the ball pops LOOSE to the tackler', () => {
    const m = carrying();
    const { kernel, tackled, reversed, popped } = tackle(m, -1, true, undefined, 21);
    // (A light's first blow: a flinch, not a knockdown - a TACKLE on the carrier all the same.)
    expect(kernel).toEqual(['hit']);
    expect(tackled?.text).toBe('TACKLE');
    expect(tackled?.won).toBe(true);
    expect(tackled?.actorId).toBe('blue-1');
    expect(reversed).toBeUndefined();
    expect(m.ball.carry).toBeUndefined();
    expect(m.carryEnds.tackle).toBe(1);
    expect(m.counts.won).toBe(1);
    expect(m.counts.loose).toBe(1);
    // Popped toward the tackler (as it left the feet), to come down at their feet - not into their shins and back.
    expect(popped!.toward).toBeGreaterThan(.95);
    expect(Math.hypot(popped!.vx, popped!.vz)).toBeLessThanOrEqual(LOOSE.speed + 1e-9);
    for (let i = 0; i < 30; i++) { send(m, 'red-1'); send(m, 'blue-1', { targetId: 'red-1', lock: true }); m.step(dt); }
    // (Down at the tackler's feet: a body's radius, the ball's and a hand off its middle.)
    expect(flat(m.ball, body(m, 'blue-1'))).toBeLessThan(1.7);
    expect(m.ball.y).toBeLessThan(r + .3);
    expect(m.seats.get('blue-1')!.tackles).toBe(1);
  });
  it('a flinch on anybody else on the ball is no TACKLE (they must go down), as it always was', () => {
    const m = carrying();
    // (The ball let go: red-1 is the last to touch it, on it - not carrying it.)
    for (let i = 0; i < 3; i++) { send(m, 'red-1'); m.step(dt); }
    expect(m.ball.carry).toBeUndefined();
    const inside = m as unknown as { tackles(e: unknown[]): void };
    m.seats.get('blue-1')!.lock = 'red-1';
    inside.tackles([{ kind: 'hit', actorId: 'blue-1', targetId: 'red-1', reaction: 'flinch', damage: 10 }]);
    expect(m.view.events.some(e => e.kind === 'tackle')).toBe(false);
    inside.tackles([{ kind: 'hit', actorId: 'blue-1', targetId: 'red-1', reaction: 'launched', damage: 10 }]);
    const t = m.view.events.find(e => e.kind === 'tackle');
    expect(t?.won).toBeUndefined();
  });
  it('a BALL-stance blow never tackles anybody (it plays the ball, never a fighter)', () => {
    const m = carrying();
    const inside = m as unknown as { tackles(e: unknown[]): void };
    inside.tackles([{ kind: 'hit', actorId: 'blue-1', targetId: 'red-1', reaction: 'flinch', damage: 10 }]);
    expect(m.ball.carry).toBe('red-1');
    expect(m.view.events.some(e => e.kind === 'tackle')).toBe(false);
  });
});

describe('LOOSE, to the tackler\'s feet (looseToward)', () => {
  it('pops at LOOSE.speed to a tackler far off, and no further than the feet of one a stride off', () => {
    const b = { x: 0, y: r, z: 0 }, air = 2 * LOOSE.up / GOAL_RULES.gravity;
    const far = looseToward(b, { x: 0, z: 6 });
    expect(far.vz).toBeCloseTo(LOOSE.speed, 9); expect(far.vy).toBe(LOOSE.up);
    for (const d of [1, 1.6, 2.2, 2.8]) {
      const v = looseToward(b, { x: d, z: 0 }), lands = v.vx * air;
      expect(v.vx, `${d} m`).toBeLessThanOrEqual(LOOSE.speed);
      // (It comes down at their feet: a body's radius, the ball's and a hand short of their middle - or where it was.)
      expect(lands, `${d} m`).toBeLessThanOrEqual(Math.max(0, d - PLAYER_RADIUS - r - CARRY.gap) + 1e-9);
      expect(v.vy).toBe(LOOSE.up);
    }
  });
});

describe('the REVERSAL', () => {
  it('a guard pressed in the window before the tackle lands turns it: the tackler down, the carrier keeps the ball', () => {
    // (Facing the tackle: the kernel's own just guard, which slips the guard past the tackler with the ball.)
    for (const guard of [6, 12, 16]) {
      const m = carrying();
      const { kernel, tackled, reversed } = tackle(m, guard, true, undefined, 30);
      expect(kernel, `guard at ${guard}`).toEqual(['just-guard']);
      expect(reversed?.actorId, `guard at ${guard}`).toBe('red-1');
      expect(reversed?.targetId).toBe('blue-1');
      expect(reversed?.text).toBe('REVERSAL');
      expect(tackled).toBeUndefined();
      expect(m.ball.carry, `guard at ${guard}`).toBe('red-1');
      expect(['knockdown', 'launched', 'splat']).toContain(body(m, 'blue-1').action);
      expect(m.counts.reversals).toBe(1);
      expect(m.mvpTally('red-1').reversal).toBe(1);
    }
  });
  it('turned away from the tackle, a press in the window is a REVERSAL all the same (the kernel only blocks it)', () => {
    const m = carrying();
    const { kernel, reversed } = tackle(m, 12, false, undefined, 30);
    expect(kernel).toEqual(['blocked']);
    expect(reversed?.actorId).toBe('red-1');
    expect(m.ball.carry).toBe('red-1');
    expect(['knockdown', 'launched', 'splat']).toContain(body(m, 'blue-1').action);
  });
  it('a guard up too soon only blocks it: no REVERSAL, and the ball spills off the carrier\'s feet', () => {
    const m = carrying();
    // (Pressed on the tackle's first tick: 0.32 s before it lands, past the window's 0.25.)
    expect(19 * dt).toBeGreaterThan(REVERSAL.window);
    const { kernel, said } = tackle(m, 0, true, undefined, 30);
    expect(kernel).toEqual(['blocked']);
    expect(said).toHaveLength(0);
    expect(m.ball.carry).toBeUndefined();
    expect(m.carryEnds.reeling).toBe(1);
  });
  it('a mashed guard opens no window: the kernel\'s freshness is the REVERSAL\'s', () => {
    const m = carrying();
    const p = body(m, 'red-1');
    m.sim.place('blue-1', { x: p.x + 1.8, y: 0, z: p.z }, -Math.PI / 2);
    const kernel: string[] = [];
    for (let i = 0; i < 30; i++) {
      const q = body(m, 'blue-1'), me = body(m, 'red-1'), at = Math.atan2(me.x - q.x, me.z - q.z);
      send(m, 'blue-1', { targetId: 'red-1', lock: true, yaw: at, moveX: Math.sin(at), moveZ: Math.cos(at), ...(i === 0 ? { attack: 'light' } : {}) });
      // (Down every other tick: never up for the kernel's re-arm, so no press is fresh.)
      send(m, 'red-1', { moveZ: 1, yaw: at + Math.PI, guard: i % 2 === 0 });
      m.step(dt);
      for (const e of (m as unknown as { events: { kind: string; targetId?: string }[] }).events.splice(0)) if (['hit', 'blocked', 'just-guard'].includes(e.kind) && e.targetId === 'red-1') kernel.push(e.kind);
    }
    expect(kernel).not.toContain('just-guard');
    expect(m.view.events.some(e => e.kind === 'reversal')).toBe(false);
  });
  it('online, judged as the guard\'s page drew it: a press heard after the blow landed, made in time on the page, turns it', () => {
    // red-1's page draws 0.22 s behind the room: a guard pressed on its page 0.1 s before the blow landed there reaches
    // the room after the blow. The room holds the tackle (the ball at red-1's feet, nothing told) for the page's lag.
    const lag = .22;
    const m = carrying(true, lag);
    const p = body(m, 'red-1');
    m.sim.place('blue-1', { x: p.x + 1.8, y: 0, z: p.z }, -Math.PI / 2);
    let landed = -1, told = -1;
    for (let i = 0; i < 60; i++) {
      const q = body(m, 'blue-1'), me = body(m, 'red-1'), at = Math.atan2(me.x - q.x, me.z - q.z);
      send(m, 'blue-1', { targetId: 'red-1', lock: true, yaw: at, moveX: Math.sin(at), moveZ: Math.cos(at), ...(i === 0 ? { attack: 'light' } : {}) });
      // (The press the page made 0.1 s before the blow landed on it, heard by the room the page's lag later: 0.12 s after
      // the blow landed in the room.)
      const pressed = landed >= 0 && i >= landed + Math.round((lag - .1) / dt);
      send(m, 'red-1', { moveZ: 1, yaw: at + Math.PI, guard: pressed }, lag);
      m.step(dt);
      for (const e of (m as unknown as { events: { kind: string; targetId?: string }[] }).events.splice(0)) if (e.kind === 'hit' && e.targetId === 'red-1' && landed < 0) landed = i;
      if (landed >= 0 && told < 0 && m.view.events.some(e => e.kind === 'reversal' || e.kind === 'tackle')) told = i;
      // (Held meanwhile: the ball at its carrier's feet, the tackle untold.)
      if (landed >= 0 && told < 0) expect(m.ball.carry).toBe('red-1');
    }
    expect(landed).toBeGreaterThan(0);
    const reversed = m.view.events.find(e => e.kind === 'reversal');
    expect(reversed?.actorId).toBe('red-1');
    expect(m.view.events.some(e => e.kind === 'tackle')).toBe(false);
    expect(m.ball.carry).toBe('red-1');
    // (The flinch taken back and its harm healed.)
    expect(body(m, 'red-1').hp).toBe(body(m, 'red-1').maxHp);
    expect(told - landed).toBeLessThanOrEqual(Math.ceil(TACKLE_WON.hold / dt) + 1);
  });
  it('online, no press in time: the held tackle is told once the page could have answered, and the ball pops', () => {
    const lag = .22;
    const m = carrying(true, lag);
    const p = body(m, 'red-1');
    m.sim.place('blue-1', { x: p.x + 1.8, y: 0, z: p.z }, -Math.PI / 2);
    let landed = -1, told = -1;
    for (let i = 0; i < 60; i++) {
      const q = body(m, 'blue-1'), me = body(m, 'red-1'), at = Math.atan2(me.x - q.x, me.z - q.z);
      send(m, 'blue-1', { targetId: 'red-1', lock: true, yaw: at, moveX: Math.sin(at), moveZ: Math.cos(at), ...(i === 0 ? { attack: 'light' } : {}) });
      // (A press 0.4 s after the blow landed on the page: late.)
      send(m, 'red-1', { moveZ: 1, guard: landed >= 0 && i >= landed + Math.round((lag + .4) / dt) }, lag);
      m.step(dt);
      for (const e of (m as unknown as { events: { kind: string; targetId?: string }[] }).events.splice(0)) if (e.kind === 'hit' && e.targetId === 'red-1' && landed < 0) landed = i;
      if (landed >= 0 && told < 0 && m.view.events.some(e => e.kind === 'tackle')) told = i;
    }
    const t = m.view.events.find(e => e.kind === 'tackle');
    expect(t?.won).toBe(true);
    expect(m.view.events.some(e => e.kind === 'reversal')).toBe(false);
    // (Held for the page's lag and the frame it rides on, no more.)
    expect((told - landed) * dt).toBeGreaterThan(lag - 1e-6);
    expect((told - landed) * dt).toBeLessThan(lag + REVERSAL.over + 3 / 60);
    expect(m.counts.won).toBe(1);
  });
});

describe('the POWER PLAY', () => {
  const seats = (out: Partial<Record<string, number>>): Pick<BallSeat, 'team' | 'out'>[] => [
    { id: 'a', team: 'red', out: out.a }, { id: 'b', team: 'red', out: out.b }, { id: 'c', team: 'red', out: out.c },
    { id: 'd', team: 'blue', out: out.d }, { id: 'e', team: 'blue', out: out.e }, { id: 'f', team: 'blue', out: out.f },
  ] as (Pick<BallSeat, 'team' | 'out'> & { id: string })[];
  it('counts the bodies each side has in play, and names the side short', () => {
    expect(inPlay(seats({}))).toEqual({ red: 3, blue: 3 });
    expect(shortSide(seats({}))).toBeNull();
    expect(inPlay(seats({ d: 5 }))).toEqual({ red: 3, blue: 2 });
    expect(shortSide(seats({ d: 5 }))).toBe('blue');
    expect(shortSide(seats({ a: 1, b: 1 }))).toBe('red');
    // (A body down a side each: level, no power play.)
    expect(shortSide(seats({ a: 1, d: 1 }))).toBeNull();
    // (A side with nobody seated is not short: FREE PLAY.)
    expect(shortSide([{ team: 'red', out: undefined }])).toBeNull();
  });
  it('a wipe-out begins one; a goal into the short side\'s goal says the count; their return ends it', () => {
    const m = new BallMatch('goal-rush', { seed: 3, access: 'host', fillBots: false, replays: false });
    for (const [id, team] of [['red-1', 'red'], ['red-2', 'red'], ['blue-1', 'blue'], ['blue-2', 'blue']] as const) m.add(id, 'taisei', id, false, team);
    m.start();
    for (let i = 0; i < 600 && m.view.phase !== 'live'; i++) m.step(dt);
    // blue-2 wiped out (red-1's blow: the kernel's knock-out).
    m.sim.damage('blue-2', 9999, 'red-1', 'test');
    m.step(dt);
    expect(m.seats.get('blue-2')!.out).toBeDefined();
    expect(shortSide(m.snapshot().ball.seats)).toBe('blue');
    expect(m.counts.powerPlays).toBe(1);
    // A goal into blue's goal (red attacks +z... whichever is blue's: physics.goalZ).
    const z = goalZ('blue');
    Object.assign(m.ball, { x: 0, y: r, z: z - Math.sign(z) * 2, vx: 0, vy: 0, vz: Math.sign(z) * 20, held: false, frozenUntil: 0, clash: 0, lastId: 'red-1', lastTeam: 'red', shot: 'power' });
    for (let i = 0; i < 30 && m.view.phase === 'live'; i++) m.step(dt);
    const goal = m.view.events.find(e => e.kind === 'goal');
    expect(goal?.team).toBe('red');
    expect(goal?.short).toEqual([2, 1]);
    expect(m.counts.powerGoals).toBe(1);
    // (Live play's: it ends with the goal's celebration.)
    m.step(dt);
    expect(m.counts.powerSeconds).toBeGreaterThan(0);
    expect(m.counts.powerSeconds).toBeLessThanOrEqual(GOAL_FIGHT.seconds);
    // A goal with the sides level says nothing of it.
    const m2 = new BallMatch('goal-rush', { seed: 3, access: 'host', fillBots: false, replays: false });
    m2.add('red-1', 'taisei', 'R', false, 'red'); m2.add('blue-1', 'konta', 'B', false, 'blue'); m2.start();
    for (let i = 0; i < 600 && m2.view.phase !== 'live'; i++) m2.step(dt);
    Object.assign(m2.ball, { x: 0, y: r, z: z - Math.sign(z) * 2, vx: 0, vy: 0, vz: Math.sign(z) * 20, held: false, frozenUntil: 0, clash: 0, lastId: 'red-1', lastTeam: 'red', shot: 'power' });
    for (let i = 0; i < 30 && m2.view.phase === 'live'; i++) m2.step(dt);
    expect(m2.view.events.find(e => e.kind === 'goal')?.short).toBeUndefined();
    expect(m2.counts.powerPlays).toBe(0);
  });
});

describe('the page\'s lock after a TACKLE won (stance.ts WON_HOLD)', () => {
  it('lets go a beat after this seat\'s TACKLE won the ball off the one it locked, and not for anybody else\'s', () => {
    const m = carrying();
    const s = new StanceControl(), view = m.snapshot().ball, players = m.sim.playerStates(), me = players.find(p => p.id === 'blue-1')!;
    s.toggle(view, me, players, 0, m.ball);
    expect(s.lock).toBe('red-1');
    // (The room's own lock, so the page's is confirmed.)
    m.seats.get('blue-1')!.lock = 'red-1';
    const won = { ...m.snapshot().ball, events: [{ id: 999, at: 0, kind: 'tackle', actorId: 'blue-1', targetId: 'red-1', text: 'TACKLE', won: true, x: 0, y: 0, z: 0 }] } as typeof view;
    s.update(WON_HOLD / 2, won, me, players, 0);
    expect(s.lock).toBe('red-1');
    s.update(WON_HOLD, won, me, players, 0);
    expect(s.lock).toBeNull(); expect(s.lastChange).toBe('won');
    // (Somebody else's won tackle leaves this lock be.)
    const t = new StanceControl();
    t.toggle(view, me, players, 0, m.ball);
    const theirs = { ...won, events: [{ ...won.events[0], actorId: 'blue-2' }] } as typeof view;
    t.update(1, theirs, me, players, 0);
    expect(t.lock).toBe('red-1');
  });
});

describe('the bots\' fight for the ball by level (BallBrain FIGHT_BOT)', () => {
  it('EASY to HARD: more hunting, sooner reads, wider eyes behind, more REVERSALs - NORMAL keeps HARD\'s levers HARD\'s', () => {
    const L = ['easy', 'normal', 'hard'] as const;
    for (let i = 1; i < 3; i++) {
      expect(FIGHT_BOT.go[L[i]]).toBeGreaterThan(FIGHT_BOT.go[L[i - 1]]);
      expect(FIGHT_BOT.range[L[i]]).toBeGreaterThan(FIGHT_BOT.range[L[i - 1]]);
      expect(FIGHT_BOT.read[L[i]]).toBeLessThan(FIGHT_BOT.read[L[i - 1]]);
      expect(FIGHT_BOT.blind[L[i]]).toBeGreaterThan(FIGHT_BOT.blind[L[i - 1]]);
      expect(FIGHT_BOT.reverse[L[i]]).toBeGreaterThan(FIGHT_BOT.reverse[L[i - 1]]);
    }
    // (HARD's own levers, LEVEL_EDGE, and its band are untouched.)
    expect(LEVEL_EDGE.normal.tackle).toBe(0);
    expect(BOT_LEVELS['goal-rush'].normal).toEqual({ lo: .55, span: .4, mates: 'normal', ease: 1, dig: 1 });
    expect(LOOSE).toEqual({ speed: 5, up: 3 });
  });
});
