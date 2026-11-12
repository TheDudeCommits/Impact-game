import { describe, expect, it } from 'vitest';
import { BallMatch } from './BallMatch';
import { FOOTBALL, FOOTBALL_SIZE, personPass } from './football';
import { GOAL_RULES } from './model';
import { QUICK_INTRO, SHORT_INTRO } from './ceremony';
import type { PlayerInput } from '../types';

/** A match a person can win - keepers that save what is at them and are beaten by a
 *  placed shot, a person's PASS that finds the open team-mate the stick is toward, a call that is never a first-time pass,
 *  a person's shot in range put on frame, a short wind-up before a tap leaves, a support that marks space near its box -
 *  and the quick intro after a visit's first match. */
let seq = 0;
type Keys = Partial<PlayerInput> & { lightHeld?: boolean; heavyHeld?: boolean };
const tick = (m: BallMatch, id: string, input: Keys) => { m.submit(id, { seq: ++seq, moveX: 0, moveZ: 0, yaw: 0, ...input }); m.step(1 / 60); };
const until = (m: BallMatch, done: () => boolean, seconds = 20) => { for (let i = 0; i < seconds * 60 && !done(); i++) m.step(1 / 60); return done(); };
const drop = (m: BallMatch) => (m as unknown as { drop(pop?: unknown, why?: string): void }).drop(undefined, 'check');
const carry = (m: BallMatch, id: string, heading = 0) => (m as unknown as { startCarry(s: unknown, a: unknown, h: number): void }).startCarry(m.seats.get(id), m.sim.actors.get(id), heading);
const r = GOAL_RULES.ballRadius * FOOTBALL_SIZE;

/** Red's people 'p' and 'q', blue's 'b' and 'c', SPORT on, live; with each side's keeper the game plays. */
function people() {
  const m = new BallMatch('goal-rush', { seed: 5, access: 'host', fillBots: false, football: true });
  m.add('p', 'konta', 'P', false, 'red'); m.add('q', 'taisei', 'Q', false, 'red'); m.add('b', 'kenzo', 'B', false, 'blue'); m.add('c', 'ume', 'C', false, 'blue');
  expect(m.start()).toBe(true);
  expect(until(m, () => m.view.phase === 'live')).toBe(true);
  return m;
}
/** A shot struck by 'p' from (x, z) at blue's goal toward (tx, ty) on its line, at `speed`, blue's keeper stood at
 *  (kx, its line's 1.2 m out); how it ended - 'save', 'goal' or 'other' - within two seconds. */
function shotAt(tx: number, kx: number, speed = 27, from = { x: 0, z: 9 }) {
  const m = people();
  drop(m);
  const gz = GOAL_RULES.halfZ, keeper = 'keeper-blue';
  m.put('p', from.x, from.z - 1, 0); m.put('q', -10, -10, 0); m.put('b', 11, -12, 0); m.put('c', -11, -14, 0);
  m.put(keeper, kx, gz - FOOTBALL.keeper4.line, Math.PI);
  const d = Math.hypot(tx - from.x, gz - from.z), t = d / speed;
  Object.assign(m.ball, { x: from.x, y: .9, z: from.z, vx: (tx - from.x) / t, vy: 1.2 / t + .5 * GOAL_RULES.gravity * t * .35, vz: (gz - from.z) / t, lastId: 'p', lastTeam: 'red', shot: 'drive', held: false });
  // (Struck now: the keeper's dive comes FOOTBALL.fun2.keeper.react s after a SHOOT leaves the boot.)
  (m as unknown as { footShotAt: number }).footShotAt = m.sim.serverTime;
  const before = m.view.events.length ? m.view.events[m.view.events.length - 1].id : 0;
  let end: 'save' | 'goal' | 'other' = 'other';
  for (let i = 0; i < 120 && end === 'other'; i++) {
    m.step(1 / 60);
    for (const e of m.view.events) if (e.id > before && (e.kind === 'save' || e.kind === 'goal')) end = e.kind;
  }
  return { end, m };
}

describe('Goal Rush football: keepers', () => {
  it('a shot at the keeper, near its body, is saved - caught at its feet', () => {
    const { end, m } = shotAt(.6, 0, 24);
    expect(end).toBe('save');
    expect(m.ball.carry).toBe('keeper-blue');
  });
  it('a hard one at it is saved too, pushed out wide off its line', () => {
    const { end, m } = shotAt(-1.6, 0, 33);
    expect(end).toBe('save');
    expect(m.ball.carry).toBeUndefined();
    expect(Math.abs(m.ball.vx)).toBeGreaterThan(5);
  });
  it('a placed shot - the far corner, away from the keeper - beats it', () => {
    const inside = GOAL_RULES.goalHalfWidth - r - FOOTBALL.shot.inset - FOOTBALL.fun.corner.in;
    expect(shotAt(-inside, .8, 27).end).toBe('goal');
    expect(shotAt(inside, -.8, 27).end).toBe('goal');
  });
  it('a shot from close in, past its body, beats a keeper whose dive has not come yet', () => {
    expect(shotAt(1.9, 0, 30, { x: .5, z: 15.2 }).end).toBe('goal');
  });
});

describe("Goal Rush football: a person's PASS", () => {
  const mate = (id: string, x: number, z: number, keeper = false) => ({ id, x, z, vx: 0, vz: 0, ...(keeper ? { keeper } : {}) });
  it('snaps to the open team-mate the stick is toward, over a marked one nearer the stick', () => {
    const pick = personPass({ x: 0, z: 0 }, 0, [mate('a', 1, 12), mate('b', -6, 10)], [{ x: 1.3, z: 12.5 }]);
    expect(pick.mate?.id).toBe('b');
  });
  // (One stood a couple of metres up the lane is chipped over; the one pressing right at the ball lets a
  // pass by - footballFun3.test.ts.)
  it('chips over one of theirs stood in the lane near the ball, to a team-mate far enough off', () => {
    const pick = personPass({ x: 0, z: 0 }, 0, [mate('a', 0, 12)], [{ x: 0, z: 2.5 }]);
    expect(pick.mate?.id).toBe('a');
    expect(pick.lofted).toBe(true);
  });
  it('leads round one of theirs off the lane further along: to one side of the team-mate, along the floor', () => {
    const pick = personPass({ x: 0, z: 0 }, 0, [mate('a', 0, 14)], [{ x: -1.8, z: 9 }]);
    expect(pick.lofted).toBe(false);
    expect(pick.mate?.id).toBe('a');
    expect(Math.abs((pick.mate?.x ?? 0))).toBeGreaterThan(1);
  });
  it('finds somebody of the side when nobody is in the cone (within FOOTBALL.fun2.pass.wide)', () => {
    const pick = personPass({ x: 0, z: 0 }, 0, [mate('a', 9, 3)], []);
    expect(pick.mate?.id).toBe('a');
    expect(personPass({ x: 0, z: 0 }, 0, [mate('a', 0, -9)], []).mate).toBeUndefined();
  });
  it('a PASS pressed while a team-mate has the ball is a call - never a first-time pass when it arrives', () => {
    const m = people();
    drop(m);
    m.put('q', 0, -8, 0); m.put('p', 0, 4, Math.PI); m.put('b', 12, 0, 0); m.put('c', -12, 4, 0);
    Object.assign(m.ball, { x: 0, y: r, z: -7, vx: 0, vy: 0, vz: 0 });
    carry(m, 'q', 0);
    // ('p' calls - its PASS down and up - the moment before 'q' plays it to them.)
    tick(m, 'p', { moveX: 1, moveZ: 0, yaw: Math.PI, attack: 'light' });
    tick(m, 'q', { moveZ: 1, yaw: 0, attack: 'light' });
    let passes = 0;
    for (let i = 0; i < 120; i++) { tick(m, 'p', { moveX: 1, yaw: Math.PI }); passes = m.view.events.filter(e => e.kind === 'pass' && e.actorId === 'p').length; if (m.ball.carry === 'p') break; }
    expect(m.ball.carry).toBe('p');
    for (let i = 0; i < 20; i++) tick(m, 'p', { moveX: 1, yaw: Math.PI });
    expect(passes).toBe(0);
    expect(m.ball.carry).toBe('p');
  });
});

describe("Goal Rush football: a person's SHOOT in range is on frame", () => {
  it('the view on the goal, the stick across it: the corner on that side, inside the post', () => {
    const m = people();
    drop(m);
    m.put('p', 2, 6, 0); m.put('keeper-blue', 0, GOAL_RULES.halfZ - 1.2, Math.PI);
    Object.assign(m.ball, { x: 2, y: r, z: 6.9, vx: 0, vy: 0, vz: 0 });
    carry(m, 'p', 0);
    // (The view 25 degrees off the goal; the stick across it to the view's left - +x here.)
    tick(m, 'p', { moveX: 1, moveZ: .2, yaw: .44, attack: 'heavy' });
    for (let i = 0; i < 12 && m.ball.carry !== undefined; i++) tick(m, 'p', { moveX: 1, moveZ: .2, yaw: .44 });
    const b = m.ball, t = (GOAL_RULES.halfZ - b.z) / b.vz, hitX = b.x + b.vx * t;
    expect(b.vz).toBeGreaterThan(10);
    expect(hitX).toBeGreaterThan(1.5);
    expect(hitX).toBeLessThan(GOAL_RULES.goalHalfWidth - r);
  });
});

describe('Goal Rush football: no box scrums', () => {
  it('with the other side on the ball in the box, at most two of the defending field players are near it', () => {
    let worst = 0;
    for (const seed of [3, 7]) {
      const m = new BallMatch('goal-rush', { seed, access: 'bots', football: true, difficulty: 'normal' });
      m.add('p', 'konta', 'P', false, 'red');
      expect(m.start()).toBe(true);
      expect(until(m, () => m.view.phase === 'live')).toBe(true);
      drop(m);
      // (Blue's bots on the ball in red's box; red's two field bots and the person stood back.)
      const red = m.view.seats.filter(s => s.team === 'red' && !s.keeper && s.id !== 'p').map(s => s.id), blue = m.view.seats.filter(s => s.team === 'blue' && !s.keeper).map(s => s.id);
      m.put(blue[0], 1, -GOAL_RULES.halfZ + 7, Math.PI); m.put(blue[1], -4, -GOAL_RULES.halfZ + 10, Math.PI); m.put(blue[2], 5, -4, Math.PI);
      m.put(red[0], 0, -2, Math.PI); m.put(red[1], -3, 0, Math.PI); m.put('p', 6, 4, Math.PI);
      Object.assign(m.ball, { x: 1, y: r, z: -GOAL_RULES.halfZ + 6.1, vx: 0, vy: 0, vz: 0 });
      carry(m, blue[0], Math.PI);
      for (let i = 0; i < 150 && m.view.phase === 'live'; i++) {
        tick(m, 'p', {});
        const b = m.ball; if (Math.abs(b.z) < GOAL_RULES.halfZ - 9) continue;
        const near = red.filter(id => { const q = m.sim.actors.get(id)!.state; return Math.hypot(q.x - b.x, q.z - b.z) < 4; }).length;
        if (i > 60) worst = Math.max(worst, near);
      }
    }
    expect(worst).toBeLessThanOrEqual(2);
  });
});

describe('Goal Rush and Sky Spike: the quick intro', () => {
  it("is the short intro's tail, shorter, for both modes", () => {
    expect(QUICK_INTRO.seconds).toBeLessThan(SHORT_INTRO.seconds);
    for (const mode of ['goal-rush', 'sky-spike'] as const) {
      const m = new BallMatch(mode, { seed: 2, access: 'bots', intro: 'quick' });
      m.add('p', 'konta', 'P', false, 'red');
      expect(m.start()).toBe(true);
      expect(m.view.intro).toMatchObject({ seconds: QUICK_INTRO.seconds, short: true });
      expect(m.leadIn()).toBe(QUICK_INTRO.seconds);
    }
  });
});
