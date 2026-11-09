import { describe, expect, it } from 'vitest';
import { BallMatch, HEADER } from './BallMatch';
import { BallBrain } from './BallBrain';
import { GOAL_RULES, type BallView } from './model';
import { freshBall } from './physics';
import { PERFECT_SHOT, strikeBall, type StrikeContext } from './strike';
import { MOVES } from '../moves';
import type { PlayerInput } from '../types';

/** Goal Rush: the PERFECT STRIKE, the HEADER, the bots' pressure and mistakes, the FINAL PUSH and the COMEBACK. */
const steps = (m: { step(dt: number): void }, seconds: number) => { for (let i = 0; i < Math.round(seconds * 60); i++) m.step(1 / 60); };
const until = (m: BallMatch, done: () => boolean, seconds = 20) => { for (let i = 0; i < seconds * 60 && !done(); i++) m.step(1 / 60); return done(); };
let seq = 0;
const press = (m: BallMatch, id: string, input: Partial<PlayerInput>) => m.submit(id, { seq: ++seq, moveX: 0, moveZ: 0, yaw: 0, ...input });

/** Red's Gorai (a plain heavy swing, its blow 0.5 s in) alone against blue's Konta, people both: the ball live. */
function match() {
  const m = new BallMatch('goal-rush', { seed: 3, access: 'host', fillBots: false });
  m.add('red-1', 'gorai', 'Red', false, 'red');
  m.add('blue-1', 'konta', 'Blue', false, 'blue');
  expect(m.start()).toBe(true);
  expect(until(m, () => m.view.phase === 'live')).toBe(true);
  m.sim.place('blue-1', { x: 10, y: 0, z: 14 }, 0);
  return m;
}
/** A ball rolled at red-1 (standing at z -6, facing the far goal) from 16 m out at `speed` m/s, and a heavy pressed
 *  `early` seconds before the moment that lands its blow as the ball reaches 2.3 m - the blow's lunge carrying the body
 *  part of the way at it first, as the bots time it (BallBrain PRESSURE). The strike events after. */
function meet(early: number, speed = 12, whiffFirst = false) {
  const m = match();
  m.sim.place('red-1', { x: 0, y: 0, z: -6 }, 0);
  const b = m.ball;
  b.x = 0; b.y = GOAL_RULES.ballRadius; b.z = 10; b.vx = 0; b.vy = 0; b.vz = -speed; b.heat = 0; b.lastId = 'blue-1'; b.lastTeam = 'blue';
  // (A masher's swing at nothing first: a light pressed with the ball far off.)
  if (whiffFirst) press(m, 'red-1', { attack: 'light', yaw: 0 });
  const heavy = MOVES.gorai.heavy, lands = heavy.contacts[0], lunge = .6 * Math.min(3, (heavy.lunge ?? 3.2) * (lands - (heavy.lungeDelay ?? 0)));
  let pressed = false;
  for (let i = 0; i < 160; i++) {
    const p = m.sim.actors.get('red-1')!.state, d = Math.hypot(b.x - p.x, b.y - (p.y + 1), b.z - p.z), closing = -b.vz;
    if (!pressed && (d - 2.3 - lunge) / Math.max(1, closing) <= lands + early) { press(m, 'red-1', { attack: 'heavy', yaw: 0 }); pressed = true; }
    m.step(1 / 60);
  }
  return { m, strikes: m.view.events.filter(e => e.kind === 'strike' && e.actorId === 'red-1') };
}

describe("Goal Rush's PERFECT STRIKE", () => {
  it('is a ball coming in met just as it arrives: faster, gold, worth more', () => {
    const { m, strikes } = meet(0);
    expect(strikes.length).toBe(1);
    expect(strikes[0].perfect).toBe(true);
    expect(strikes[0].text).toBe('PERFECT STRIKE');
    expect(m.seats.get('red-1')!.perfects).toBe(1);
    // A still ball struck with the same heavy is an ordinary power shot, and slower.
    const still = match();
    still.sim.place('red-1', { x: 0, y: 0, z: -6 }, 0);
    Object.assign(still.ball, { x: 0, y: GOAL_RULES.ballRadius, z: -4, vx: 0, vy: 0, vz: 0, heat: 0 });
    press(still, 'red-1', { attack: 'heavy', yaw: 0 });
    steps(still, 1);
    const plain = still.view.events.filter(e => e.kind === 'strike' && e.actorId === 'red-1');
    expect(plain.length).toBe(1);
    expect(plain[0].perfect).toBeUndefined();
    expect(strikes[0].value!).toBeGreaterThan(plain[0].value!);
  });
  it('is spoilt by a swing at nothing a moment before (the masher\'s), and missed by a swing pressed early', () => {
    const spoilt = meet(0, 12, true);
    expect(spoilt.strikes.length).toBe(1);
    expect(spoilt.strikes[0].perfect).toBeUndefined();
    // Pressed a fifth of a second early, the lunge meets the ball four metres out: a strike, not a perfect one.
    const early = meet(.2);
    expect(early.strikes.length).toBe(1);
    expect(early.strikes[0].perfect).toBeUndefined();
    // Half a second early, the swing's box has closed before the ball comes: no strike at all.
    expect(meet(.5).strikes.length).toBe(0);
  });
  it('flies faster and is laid deeper in its corner (strike.ts)', () => {
    const ball = { ...freshBall(), x: 3, y: .8, z: 8, vx: 0, vy: 0, vz: -6 };
    const c: StrikeContext = { mode: 'goal-rush', slot: 'heavy', move: { style: 'melee', name: 'Heavy' }, knockback: 0, launch: false, finisher: false, pushX: 0, pushZ: 0,
      striker: { id: 'r', team: 'red', x: 3, y: 0, z: 7, grounded: true, aimYaw: .25, forward: 0, lateral: 0, awakened: false, chain: 0 } };
    const plain = strikeBall(ball, c), perfect = strikeBall(ball, { ...c, perfect: true });
    expect(plain.perfect).toBe(false);
    expect(perfect.perfect).toBe(true);
    expect(Math.hypot(perfect.vx, perfect.vy, perfect.vz)).toBeGreaterThan(Math.hypot(plain.vx, plain.vy, plain.vz) * 1.08);
    // A tap is never one (a pass), nor a pop.
    expect(strikeBall(ball, { ...c, slot: 'light', perfect: true }).perfect).toBe(false);
    expect(PERFECT_SHOT.speed).toBeGreaterThan(1);
  });
});

describe("Goal Rush's HEADER", () => {
  it('heads a ball met by the top of a jumping body on the way it faces, a strike that can score', () => {
    const m = match();
    m.sim.place('red-1', { x: 0, y: 0, z: 10 }, 0);
    press(m, 'red-1', { jump: true, jumpHeld: true, yaw: 0 });
    // Up to the top of the jump.
    const p = m.sim.actors.get('red-1')!.state;
    let last = -1;
    for (let i = 0; i < 90 && p.y > last; i++) { last = p.y; m.step(1 / 60); }
    expect(p.grounded).toBe(false);
    // A cross across the face of the goal, at the head at the top of the jump (a stride off it: met in a few frames):
    // timed there, a PERFECT HEADER.
    Object.assign(m.ball, { x: p.x - 2.2, y: p.y + HEADER.head + .6, z: p.z, vx: 13, vy: 0, vz: 0, heat: 0, lastId: 'blue-1', lastTeam: 'blue' });
    steps(m, .4);
    const header = m.view.events.find(e => e.kind === 'strike' && e.actorId === 'red-1' && e.shot === 'header');
    expect(header).toBeDefined();
    expect(header!.text).toBe('PERFECT HEADER');
    expect(header!.perfect).toBe(true);
    // Headed on toward the goal it faces (red attacks +z), not bounced back the way it came.
    expect(m.ball.lastId).toBe('red-1');
    expect(m.ball.vz).toBeGreaterThan(4);
  });
  it('only bounces a ball off a head that stayed on the floor', () => {
    const m = match();
    m.sim.place('red-1', { x: 0, y: 0, z: 10 }, 0);
    steps(m, .1);
    Object.assign(m.ball, { x: -3, y: 2.6, z: 10, vx: 13, vy: 0, vz: 0, heat: 0, lastId: 'blue-1', lastTeam: 'blue' });
    steps(m, .4);
    expect(m.view.events.some(e => e.kind === 'strike' && e.shot === 'header')).toBe(false);
  });
});

describe("Goal Rush's swings", () => {
  it('calls the FINAL PUSH with half a minute left in a match in reach, and the ball burns', () => {
    const m = match();
    m.view.clock = 30.5;
    steps(m, 1);
    const push = m.view.events.find(e => e.kind === 'fever');
    expect(push?.text).toBe('FINAL PUSH');
    expect(m.view.fever).toBe(true);
    steps(m, .5);
    expect(m.ball.heat).toBeGreaterThanOrEqual(1.5 - 1e-6);
    // Not in a match already decided.
    const decided = match();
    decided.view.score.red = 5; decided.view.clock = 30.5;
    steps(decided, 1);
    expect(decided.view.events.some(e => e.kind === 'fever')).toBe(false);
    expect(decided.view.fever).toBe(false);
  });
  it('sharpens a side behind, and more in the last seconds; a bot sees a sudden change of the ball a reaction late', () => {
    const brain = new BallBrain('b', 'goal-rush', 0, () => .5) as unknown as { skill: number; sk: number; pressure(v: BallView, t: 'red' | 'blue'): boolean; read(b: ReturnType<typeof freshBall>, now: number): ReturnType<typeof freshBall> };
    const view = { score: { red: 0, blue: 0 }, clock: 200, overtime: false, practice: false } as unknown as BallView;
    expect(brain.pressure(view, 'red')).toBe(false);
    expect(brain.sk).toBeCloseTo(brain.skill);
    view.score.blue = 2;
    expect(brain.pressure(view, 'red')).toBe(false);
    const behind = brain.sk;
    expect(behind).toBeGreaterThan(brain.skill);
    view.clock = 20;
    expect(brain.pressure(view, 'red')).toBe(true);
    expect(brain.sk).toBeGreaterThan(behind);
    // The read: a ball rolling along is seen as it is; struck the other way, it is still seen going the old way for a beat.
    const ball = { ...freshBall(), x: 0, z: 0, vx: 0, vz: 10 };
    let now = 0;
    for (let i = 0; i < 10; i++) { ball.z += ball.vz / 60; now += 1 / 60; brain.read(ball, now); }
    ball.vz = -10;
    ball.z += ball.vz / 60; now += 1 / 60;
    expect(brain.read(ball, now).vz).toBeGreaterThan(0);
    for (let i = 0; i < 40; i++) { ball.z += ball.vz / 60; now += 1 / 60; brain.read(ball, now); }
    expect(brain.read(ball, now).vz).toBeLessThan(0);
  });
});
