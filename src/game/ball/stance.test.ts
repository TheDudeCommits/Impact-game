import { describe, expect, it } from 'vitest';
import { BallMatch } from './BallMatch';
import { BALL_ID, BALL_SPORT, GOAL_FIGHT, GOAL_STANCE, type BallModeId } from './model';
import type { PlayerInput } from '../types';
import type { MoveDefinition } from '../moves';

/** Goal Rush's two stances (model.ts GOAL_STANCE): the BALL stance's swings play the ball and never hurt a
 *  fighter; the FIGHT stance's are the fighter's kit on the opponent locked and never touch the ball; the room reads the
 *  stance off each command's target. */
const steps = (m: { step(dt: number): void }, seconds: number) => { for (let i = 0; i < Math.round(seconds * 60); i++) m.step(1 / 60); };
const until = (m: BallMatch, done: () => boolean, seconds = 20) => { for (let i = 0; i < seconds * 60 && !done(); i++) m.step(1 / 60); return done(); };
let seq = 0;
const press = (m: BallMatch, id: string, input: Partial<PlayerInput>) => m.submit(id, { seq: ++seq, moveX: 0, moveZ: 0, yaw: 0, ...input });
const hp = (m: BallMatch, id: string) => m.sim.actors.get(id)!.state.hp;
const FLOOR: MoveDefinition = { name: 'Test Sweep', duration: .4, contacts: [0], damage: 30, range: 2, radius: .8, stamina: 0, cooldown: 0, stun: .6, knockback: 6, style: 'melee', outcome: 'knockdown' };

function match(mode: BallModeId = 'goal-rush') {
  const m = new BallMatch(mode, { seed: 3, access: 'host', fillBots: false });
  m.add('red-1', 'gorai', 'Red', false, 'red');
  m.add('red-2', 'ouga', 'Red Two', false, 'red');
  m.add('blue-1', 'konta', 'Blue', false, 'blue');
  expect(m.start()).toBe(true);
  expect(until(m, () => m.view.phase === (mode === 'goal-rush' ? 'live' : 'kickoff'))).toBe(true);
  return m;
}

describe("Goal Rush's stances", () => {
  it('reads the stance off the command: an opponent locked is FIGHT, the ball or a team-mate is BALL', () => {
    const m = match();
    press(m, 'red-1', { targetId: 'blue-1', lock: true }); m.step(1 / 60);
    expect(m.seats.get('red-1')!.lock).toBe('blue-1');
    expect(m.sim.actors.get('red-1')!.state.target).toBe('blue-1');
    expect(m.snapshot().ball.seats.find(s => s.id === 'red-1')!.lock).toBe('blue-1');
    // A soft target (no lock) is no stance: the ball.
    press(m, 'red-1', { targetId: 'blue-1', lock: false }); m.step(1 / 60);
    expect(m.seats.get('red-1')!.lock).toBeUndefined();
    press(m, 'red-1', { targetId: 'red-2', lock: true }); m.step(1 / 60);
    expect(m.seats.get('red-1')!.lock).toBeUndefined();
    press(m, 'red-1', { targetId: BALL_ID, lock: true }); m.step(1 / 60);
    expect(m.seats.get('red-1')!.lock).toBeUndefined();
    expect(m.sim.actors.get('red-1')!.state.target).toBeNull();
  });
  it("never hurts a fighter with a BALL-stance swing, even one standing in the swing's arc", () => {
    const m = match();
    // The ball out of reach, an opponent right in front.
    m.sim.place('red-1', { x: -8, y: 0, z: -8 }, 0);
    m.sim.place('blue-1', { x: -8, y: 0, z: -6.6 }, Math.PI);
    press(m, 'red-1', { attack: 'heavy', yaw: 0, targetId: BALL_ID });
    steps(m, .7);
    expect(hp(m, 'blue-1')).toBe(GOAL_FIGHT.health);
    // The ball in reach with an opponent beside it: the ball goes, the opponent is untouched.
    const n = match();
    n.sim.place('red-1', { x: 0, y: 0, z: -1.7 }, 0);
    n.sim.place('blue-1', { x: .9, y: 0, z: -.6 }, Math.PI);
    press(n, 'red-1', { attack: 'heavy', yaw: 0, targetId: BALL_ID });
    steps(n, .7);
    expect(n.ball.lastId).toBe('red-1');
    expect(hp(n, 'blue-1')).toBe(GOAL_FIGHT.health);
  });
  it('never strikes the ball with a FIGHT-stance swing, even with the ball at the feet', () => {
    const m = match();
    m.sim.place('red-1', { x: 0, y: 0, z: -1.7 }, 0);
    m.sim.place('blue-1', { x: 2.6, y: 0, z: -1.7 }, -Math.PI / 2);
    press(m, 'red-1', { attack: 'heavy', yaw: 0, targetId: 'blue-1', lock: true });
    steps(m, .7);
    expect(m.ball.lastId).not.toBe('red-1');
    // The kernel's own lock-on turned the swing to them.
    expect(hp(m, 'blue-1')).toBeLessThan(GOAL_FIGHT.health);
  });
  it('still moves the ball with a body, and still BUMPs in the BALL stance', () => {
    const m = match();
    m.sim.place('red-1', { x: -6, y: 0, z: -12 }, 0);
    m.sim.place('blue-1', { x: -6, y: 0, z: -9 }, Math.PI);
    m.sim.place('red-2', { x: 8, y: 0, z: 8 }, 0);
    const a = m.sim.actors.get('red-1')!;
    a.boosting = true; a.mz = BALL_SPORT['goal-rush'].boost;
    for (let i = 0; i < 20; i++) { press(m, 'red-1', { moveZ: 1, targetId: BALL_ID }); m.step(1 / 60); }
    expect(m.seats.get('red-1')!.lock).toBeUndefined();
    expect(m.view.events.find(e => e.kind === 'demo')).toMatchObject({ actorId: 'red-1', targetId: 'blue-1', text: 'BUMP' });
    expect(hp(m, 'blue-1')).toBeLessThan(GOAL_FIGHT.health);
    // A FIGHT-stance body run into the ball still drives it on.
    const n = match();
    n.sim.place('red-1', { x: 0, y: 0, z: -4 }, 0);
    for (let i = 0; i < 50 && n.ball.lastId === null; i++) { press(n, 'red-1', { moveZ: 1, targetId: 'blue-1', lock: true }); n.step(1 / 60); }
    expect(n.ball.lastId).toBe('red-1');
  });
  it('lets a lock go when the one locked is wiped out, or out of reach', () => {
    const m = match();
    m.sim.place('blue-1', { x: 3, y: 0, z: 3 }, 0);
    press(m, 'red-1', { targetId: 'blue-1', lock: true }); m.step(1 / 60);
    expect(m.seats.get('red-1')!.lock).toBe('blue-1');
    m.sim.strike('red-2', 'blue-1', 'heavy', { ...FLOOR, damage: 999 });
    m.step(1 / 60);
    expect(m.seats.get('blue-1')!.out).toBeDefined();
    expect(m.seats.get('red-1')!.lock).toBeUndefined();
    // Out of reach.
    const n = match();
    n.sim.place('red-1', { x: 0, y: 0, z: -GOAL_STANCE.reach / 2 - 1 }, 0);
    n.sim.place('blue-1', { x: 0, y: 0, z: GOAL_STANCE.reach / 2 + 1 }, 0);
    press(n, 'red-1', { targetId: 'blue-1', lock: true }); n.step(1 / 60);
    expect(n.seats.get('red-1')!.lock).toBeUndefined();
  });
  it('names a TACKLE: a FIGHT-stance blow that puts down the one on the ball', () => {
    const m = match();
    // Blue on the ball, red locked on them.
    m.sim.place('blue-1', { x: 0, y: 0, z: -1.6 }, 0);
    m.sim.place('red-1', { x: 0, y: 0, z: -3.4 }, 0);
    m.sim.place('red-2', { x: 10, y: 0, z: 10 }, 0);
    press(m, 'red-1', { targetId: 'blue-1', lock: true }); m.step(1 / 60);
    m.sim.strike('red-1', 'blue-1', 'heavy', FLOOR); m.step(1 / 60);
    const e = m.view.events.find(e => e.kind === 'tackle');
    expect(e).toMatchObject({ actorId: 'red-1', targetId: 'blue-1', team: 'red', text: 'TACKLE' });
    expect(m.seats.get('red-1')!.tackles).toBe(1);
    // In the BALL stance the same knockdown is no tackle (only a FIGHT-stance blow is one).
    const n = match();
    n.sim.place('blue-1', { x: 0, y: 0, z: -1.6 }, 0);
    n.sim.place('red-1', { x: 0, y: 0, z: -3.4 }, 0);
    n.sim.strike('red-1', 'blue-1', 'heavy', FLOOR); n.step(1 / 60);
    expect(n.view.events.find(e => e.kind === 'tackle')).toBeUndefined();
  });
  it('keeps Sky Spike and FREE PLAY on the BALL stance', () => {
    const spike = match('sky-spike');
    press(spike, 'red-1', { targetId: 'blue-1', lock: true }); spike.step(1 / 60);
    expect(spike.seats.get('red-1')!.lock).toBeUndefined();
    const free = new BallMatch('goal-rush', { seed: 3, practice: true });
    free.add('me', 'taisei', 'Me', false, 'red');
    free.start(); until(free, () => free.view.phase === 'live');
    press(free, 'me', { targetId: 'nobody', lock: true }); free.step(1 / 60);
    expect(free.seats.get('me')!.lock).toBeUndefined();
  });
  it('has the bots lock on to tackle and let go to play the ball', () => {
    const m = new BallMatch('goal-rush', { seed: 8, access: 'bots' });
    m.add('me', 'taisei', 'Me', false, 'red'); m.pilot('me');
    m.start();
    let locked = 0, live = 0, flips = 0;
    const was = new Map<string, string | undefined>();
    for (let i = 0; i < 60 * 90; i++) {
      m.step(1 / 60);
      if (m.view.phase !== 'live') continue;
      live++;
      for (const s of m.seats.values()) { if (s.lock) locked++; if (was.get(s.id) !== s.lock) flips++; was.set(s.id, s.lock); }
    }
    // Some of the time, never most of it, and in and out (a tackle, then the ball).
    expect(locked / (live * 6)).toBeGreaterThan(.01);
    expect(locked / (live * 6)).toBeLessThan(.35);
    expect(flips).toBeGreaterThan(6);
  });
});
