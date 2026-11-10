import { describe, expect, it } from 'vitest';
import { BallMatch } from './BallMatch';
import { BALL_ID, GOAL_RULES, type BallModeId } from './model';
import { stepBall } from './physics';
import type { MoveDefinition } from '../moves';
import type { ExternalBlow } from '../simulation';

// A guard meets the ball once (BallMatch GUARD_OFF). Each moment below is one the bot sims found before that rule, set up again and played tick by tick through the match's own body contacts and the ball's flight, the body
// held where it was (in the air, guard up, pressed just now: a perfect guard).
const ULT: MoveDefinition = { name: 'Test Ultimate', duration: 1.2, contacts: [.1, .4, .7], damage: 10, range: 2, radius: .8, stamina: 0, cooldown: 0, stun: .2, knockback: 4, style: 'melee' };
const blow = (attackerId: string, slot: ExternalBlow['slot']): ExternalBlow =>
  ({ attackerId, slot, move: ULT, damage: 10, critical: false, finisher: false, pushX: 0, pushZ: 1, knockback: 4, stun: .2, launch: false, hitstop: .05 });
type Inside = { bodyContacts(dt: number): void; last: Map<string, unknown> };
const inside = (m: BallMatch) => m as unknown as Inside;
const steps = (m: BallMatch, seconds: number) => { for (let i = 0; i < Math.round(seconds * 60); i++) m.step(1 / 60); };

/** Two people, one a side, nobody else, the ball live: no bot moves the ball but the test. */
function pair(mode: BallModeId) {
  const m = new BallMatch(mode, { seed: 3, access: 'host', fillBots: false, replays: false });
  m.add('red-1', 'taisei', 'Red', false, 'red');
  m.add('blue-1', 'konta', 'Blue', false, 'blue');
  expect(m.start()).toBe(true);
  steps(m, 3.1);
  for (let i = 0; i < 300 && m.view.phase !== 'live'; i++) m.step(1 / 60);
  m.view.phase = 'live';
  return m;
}
/** `id`'s guard up, pressed now, its body at `at` (in the air above the floor) moving at `v`, looking along `yaw`; then
 *  `ticks` of the body contacts (`pressedAgo`: the guard pressed that long before, not perfect past JUST_GUARD_WINDOW) and the ball's flight. Returns how far the ball was from the body each tick. */
function guardAgainst(m: BallMatch, id: string, at: { x: number; y: number; z: number }, v: { x: number; y: number; z: number }, yaw: number, ticks = 40, pressedAgo = 0) {
  const a = m.sim.actors.get(id)!, dt = 1 / 60;
  m.sim.place(id, { x: at.x, y: 0, z: at.z }, yaw);
  a.input.yaw = yaw; a.state.yaw = yaw;
  inside(m).last.clear();
  a.guardPressedAt = m.sim.serverTime - pressedAgo;
  const gaps: number[] = [];
  for (let i = 0; i < ticks; i++) {
    const p = a.state;
    p.x = at.x + v.x * dt * i; p.y = at.y + v.y * dt * i; p.z = at.z + v.z * dt * i;
    p.grounded = p.y <= 0; p.guarding = true; p.action = 'guard'; p.alive = true;
    inside(m).bodyContacts(dt);
    stepBall(m.mode, m.ball, dt);
    m.sim.serverTime += dt;
    const b = m.ball;
    gaps.push(Math.hypot(b.x - p.x, b.y - (p.y + 1), b.z - p.z));
  }
  return gaps;
}
const guards = (m: BallMatch, id: string) => m.view.events.filter(e => (e.kind === 'perfect' || e.kind === 'block' || e.kind === 'save') && e.actorId === id);

describe('a guard meets the ball once (GUARD_OFF)', () => {
  it('Goal Rush: a keeper up in the air, looking back at their own goal, perfectly guards a header from below: one PERFECT GUARD, and the ball leaves', () => {
    // (The sims, seed 377: the ball sent up "the way they look" into their own body eight ticks running - eight
    // PERFECT GUARDs, a PERFECT SAVE of their own ball among them, and the super shot's meter all but full.)
    const m = pair('goal-rush');
    const keeper = m.sim.actors.get('blue-1')!, meter = keeper.state.ultimate;
    Object.assign(m.ball, { x: 5.66, y: 3.59, z: 8.82, vx: 12.7, vy: 1.4, vz: -28.8, held: false, lastId: 'red-1', lastTeam: 'red', shot: 'header', heat: .5 });
    const gaps = guardAgainst(m, 'blue-1', { x: 6.6, y: 4.7, z: 7.8 }, { x: -3, y: 0, z: 3 }, -.75);
    expect(guards(m, 'blue-1').map(e => e.text)).toEqual(['PERFECT GUARD']);
    expect(m.seats.get('blue-1')!.saves).toBe(0);
    expect(keeper.state.ultimate - meter).toBeLessThanOrEqual(16);
    // Off the guard and away: never back in its reach.
    const met = gaps.findIndex(g => g < 2.6);
    expect(gaps.slice(met + 12).every(g => g > 2.6)).toBe(true);
  });
  it('Goal Rush: a PERFECT SAVE by a keeper looking back at their own net goes out of their end, never into it', () => {
    // (The sims, seed 8: a bot keeper running across its goal mouth met a ball from the side, looking back at its
    // net, and its PERFECT SAVE went in off the post.)
    const m = pair('goal-rush');
    Object.assign(m.ball, { x: 2.6, y: 1.1, z: -GOAL_RULES.halfZ + 1, vx: -19.5, vy: 1, vz: -5.8, held: false, lastId: 'blue-1', lastTeam: 'blue', shot: 'blast', heat: 1 });
    guardAgainst(m, 'red-1', { x: 1, y: 0, z: -GOAL_RULES.halfZ + 1.8 }, { x: 0, y: 0, z: 0 }, Math.PI * .85, 1);
    expect(guards(m, 'red-1').map(e => e.text)).toEqual(['PERFECT SAVE']);
    expect(m.ball.vz).toBeGreaterThan(0);
  });
  it('Goal Rush: a guard that is not perfect, met by a body rising into the ball, turns it away once', () => {
    const m = pair('goal-rush');
    Object.assign(m.ball, { x: 0, y: 2.2, z: -GOAL_RULES.halfZ + 4, vx: 0, vy: -1, vz: -22, held: false, lastId: 'blue-1', lastTeam: 'blue', shot: 'power', heat: 1 });
    const gaps = guardAgainst(m, 'red-1', { x: 0, y: .6, z: -GOAL_RULES.halfZ + 2.4 }, { x: 0, y: 6, z: 2 }, 0, 40, 1);
    expect(guards(m, 'red-1').map(e => e.text)).toEqual(['SAVE']);
    expect(m.seats.get('red-1')!.saves).toBe(1);
    expect(m.seats.get('red-1')!.touches).toBe(1);
    const met = gaps.findIndex(g => g < 2.6);
    expect(gaps.slice(met + 15).every(g => g > 2.2)).toBe(true);
  });
  it('Sky Spike: a stuffed spike off a blocker still rising is one STUFF BLOCK, driven down into the hitters\' court', () => {
    // (The sims: the stuffed ball rode the rising blocker's hands, a STUFF BLOCK each tick.)
    const m = pair('sky-spike');
    m.view.rally = 2; m.view.touchTeam = 'blue'; m.view.touches = 3;
    for (const lift of [.2, .5, .8]) {
      const before = guards(m, 'red-1').length, blocks = m.seats.get('red-1')!.blocks;
      Object.assign(m.ball, { x: -.3, y: 2.7 + 1.45 + lift + .5, z: .9, vx: 0, vy: -9, vz: -17, held: false, lastId: 'blue-1', lastTeam: 'blue', shot: 'spike', heat: 1.5 });
      m.view.touchTeam = 'blue'; m.view.touches = 3;
      guardAgainst(m, 'red-1', { x: -.2, y: 1.2, z: -.6 }, { x: .2, y: 9, z: .1 }, 0, 30);
      expect(guards(m, 'red-1').length - before).toBe(1);
      expect(guards(m, 'red-1').at(-1)!.text).toBe('STUFF BLOCK');
      expect(m.seats.get('red-1')!.blocks - blocks).toBe(1);
      // Down in the hitters' court: on blue's side, falling.
      expect(m.ball.z).toBeGreaterThan(0);
      m.sim.serverTime += 1;
    }
  });
  it('a SUPER SHOT bulldozes a body once and flies on, met square or glancing', () => {
    // (The sims, seed 1597: a super shot glancing off a body was put by on its far side - where its flight still
    // came back at the body - and bulldozed it again, four ticks running, jumping two metres back and forth, a tenth of
    // its speed off each time.)
    for (const at of [{ x: 0, y: 1.2, z: -6.6, vx: 0, vy: 0, vz: -34 }, { x: -.5, y: 2.2, z: -8.6, vx: -9.6, vy: -8.5, vz: 7.7 }]) {
      const m = pair('goal-rush');
      Object.assign(m.ball, { ...at, held: false, lastId: 'blue-1', lastTeam: 'blue', shot: 'super', super: true, heat: 4.6 });
      const speed = Math.hypot(m.ball.vx, m.ball.vy, m.ball.vz);
      const a = m.sim.actors.get('red-1')!;
      m.sim.place('red-1', { x: 0, y: 0, z: -8 }, 0); inside(m).last.clear();
      let fastest = 0, jump = 0, was = { ...m.ball };
      for (let i = 0; i < 10; i++) {
        a.state.guarding = false;
        inside(m).bodyContacts(1 / 60); stepBall(m.mode, m.ball, 1 / 60); m.sim.serverTime += 1 / 60;
        if (i >= 4) fastest = Math.max(fastest, Math.hypot(m.ball.vx, m.ball.vy, m.ball.vz));
        jump = Math.max(jump, Math.hypot(m.ball.x - was.x, m.ball.z - was.z)); was = { ...m.ball };
      }
      expect(m.view.events.filter(e => e.kind === 'bowled' && e.targetId === 'red-1').length).toBe(1);
      expect(fastest).toBeGreaterThan(speed * .8);
      // It flies on along its own line: never put metres off it in a tick.
      expect(jump).toBeLessThan(speed / 60 + .1);
    }
  });
  it('a stopped ball\'s SUPER SHOT is announced once, whoever strikes between its blows', () => {
    // (The sims: an ultimate's blows landing in stopped time, the others' between them, each announced as a SUPER
    // SHOT - four in a second.)
    const m = pair('goal-rush');
    Object.assign(m.ball, { x: 0, y: 1.2, z: 0, vx: 0, vy: 0, vz: 0, held: false, frozenUntil: m.sim.serverTime + 3 });
    const red = m.sim.actors.get('red-1')!, blue = m.sim.actors.get('blue-1')!;
    m.sim.place('red-1', { x: 0, y: 0, z: -1.5 }, 0); m.sim.place('blue-1', { x: 0, y: 0, z: 1.5 }, Math.PI);
    red.cast = { id: 7, start: m.sim.serverTime, move: ULT } as never; blue.cast = { id: 3, start: m.sim.serverTime, move: ULT } as never;
    for (let i = 0; i < 3; i++) {
      expect(m.receive(m.locate(BALL_ID)!, blow('red-1', 'ultimate'))).not.toBeNull();
      m.sim.serverTime += .15; blue.cast = { id: 4 + i * 2, start: m.sim.serverTime, move: ULT } as never;
      m.receive(m.locate(BALL_ID)!, blow('blue-1', 'heavy'));
      m.sim.serverTime += .15;
    }
    expect(m.view.events.filter(e => e.kind === 'super' && e.actorId === 'red-1').length).toBe(1);
  });
});
