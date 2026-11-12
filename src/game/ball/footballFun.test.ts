import { describe, expect, it } from 'vitest';
import { BallMatch } from './BallMatch';
import { FOOTBALL, FOOTBALL_SIZE, controls, kindTouch, passPick, shotAt } from './football';
import { FUN, SPORT_BOT } from './sportBrain';
import { GOAL_RULES } from './model';
import { freshBall } from './physics';
import type { PlayerInput } from '../types';

/** Goal Rush on the sport rules with the person at the heart of it - the kickoff to the person, a kind first touch, a
 *  tap that goes where it was pointed, the open corner for the person's finish, the full-power shot's beat - and bots
 *  that feed an open person, keep the ball a while and press a person softer by level. */
let seq = 0;
type Keys = Partial<PlayerInput> & { lightHeld?: boolean; dashHeld?: boolean };
const tick = (m: BallMatch, id: string, input: Keys) => { m.submit(id, { seq: ++seq, moveX: 0, moveZ: 0, yaw: 0, ...input }); m.step(1 / 60); };
const until = (m: BallMatch, done: () => boolean, seconds = 20) => { for (let i = 0; i < seconds * 60 && !done(); i++) m.step(1 / 60); return done(); };
const drop = (m: BallMatch) => (m as unknown as { drop(pop?: unknown, why?: string): void }).drop(undefined, 'check');
const carry = (m: BallMatch, id: string, heading = 0) => (m as unknown as { startCarry(s: unknown, a: unknown, h: number): void }).startCarry(m.seats.get(id), m.sim.actors.get(id), heading);
const r = GOAL_RULES.ballRadius * FOOTBALL_SIZE;

/** Red's people 'p' and 'q', blue's 'b' and 'c', no bots, SPORT on, live. */
function people() {
  const m = new BallMatch('goal-rush', { seed: 5, access: 'host', fillBots: false, football: true });
  m.add('p', 'konta', 'P', false, 'red'); m.add('q', 'taisei', 'Q', false, 'red'); m.add('b', 'kenzo', 'B', false, 'blue'); m.add('c', 'ume', 'C', false, 'blue');
  expect(m.start()).toBe(true);
  expect(until(m, () => m.view.phase === 'live')).toBe(true);
  return m;
}
/** The page's person 'p' on red with bots and keepers, SPORT on, on `level`, live. */
function withBots(level: 'easy' | 'normal' | 'hard' = 'normal', seed = 5, settled = false) {
  const m = new BallMatch('goal-rush', { seed, access: 'bots', football: true, difficulty: level });
  m.add('p', 'konta', 'P', false, 'red');
  expect(m.start()).toBe(true);
  expect(until(m, () => m.view.phase === 'live')).toBe(true);
  // (Past the kickoff's own pass, for the checks of open play.)
  if (settled) { const at = m.sim.serverTime; until(m, () => m.sim.serverTime > at + 3 || m.view.phase !== 'live', 4); }
  return m;
}

describe('Goal Rush football: the person plays', () => {
  it("kicks off to the person: the person's side first, on the spot, the ball at their feet as play goes live", () => {
    const m = withBots();
    expect(m.ball.carry).toBe('p');
    const p = m.sim.actors.get('p')!.state;
    expect(Math.hypot(p.x, p.z)).toBeLessThan(FOOTBALL.fun.kickoff.spot + .5);
  });
  it('after a goal the side that conceded kicks off, its first field player the taker', () => {
    const m = people();
    drop(m);
    // (A goal for red: the ball rolled over blue's line.)
    Object.assign(m.ball, { x: 0, y: r, z: GOAL_RULES.halfZ + 1, vx: 0, vy: 0, vz: 6 });
    expect(until(m, () => m.view.phase === 'scored', 2)).toBe(true);
    expect(until(m, () => m.view.phase === 'live', 20)).toBe(true);
    expect(m.view.score.red).toBe(1);
    expect(m.ball.carry).toBe('b');
  });
  it('a team-mate\'s pass to a person is taken cleanly - unless one of theirs is right on them', () => {
    const body = { grounded: true, alive: true, reeling: false, locked: false, stunned: false, y: 0 };
    // (A hard pass met at a run: 26 m/s against the body bounces off the ordinary control, not off the kind one.)
    expect(controls({ ...freshBall(), held: false, y: r }, r, 26, body)).toBe(false);
    expect(kindTouch({ ...freshBall(), held: false, y: r }, r, 26, body)).toBe(true);
    expect(kindTouch({ ...freshBall(), held: false, y: 2 }, r, 18, body)).toBe(true);
    const m = people();
    drop(m);
    m.put('q', 0, -8, 0); m.put('p', 0, 6, Math.PI); m.put('b', 12, 0, 0); m.put('c', -12, 4, 0);
    Object.assign(m.ball, { x: 0, y: r, z: -7, vx: 0, vy: 0, vz: 0 });
    carry(m, 'q', 0);
    tick(m, 'q', { moveX: 0, moveZ: 1, yaw: 0, attack: 'light' });
    // (Struck after its short wind-up, FOOTBALL.fun2.kick.)
    for (let i = 0; i < 12 && m.ball.carry !== undefined; i++) tick(m, 'q', { moveX: 0, moveZ: 1, yaw: 0 });
    expect(m.ball.carry).toBeUndefined();
    // ('p' runs hard at the pass: met at well over FOOTBALL.control.slow against its run, and taken.)
    for (let i = 0; i < 90 && m.ball.carry === undefined; i++) tick(m, 'p', { moveZ: -1, yaw: Math.PI });
    expect(m.ball.carry).toBe('p');
  });
  it('a ball up to head height is brought down, not carried on the head', () => {
    const body = { grounded: true, alive: true, reeling: false, locked: false, stunned: false, y: 0 };
    expect(controls({ ...freshBall(), held: false, y: 1.9 }, r, 3, body)).toBe(true);
  });
  it('a tapped PASS goes where the stick pointed as the key went down', () => {
    const m = people();
    drop(m);
    m.put('p', 0, 0, 0); m.put('q', 10, 0, 0); m.put('b', -10, 8, 0); m.put('c', 0, -12, 0);
    Object.assign(m.ball, { x: 0, y: r, z: .9, vx: 0, vy: 0, vz: 0 });
    carry(m, 'p', 0);
    // (Down with the stick on 'q' (+x); up a tick later with the stick swung up the pitch.)
    tick(m, 'p', { moveX: 1, moveZ: 0, yaw: 0, attack: 'light', lightHeld: true });
    tick(m, 'p', { moveX: 0, moveZ: 1, yaw: 0, lightHeld: false });
    for (let i = 0; i < 12 && m.ball.carry !== undefined; i++) tick(m, 'p', { moveX: 0, moveZ: 1, yaw: 0 });
    const pass = m.view.events.find(e => e.kind === 'pass');
    expect(pass?.targetId).toBe('q');
  });
  it('a PASS takes the side\'s keeper only when the stick is plainly on them', () => {
    const mates = [{ id: 'k', x: 3, z: -14, vx: 0, vz: 0, keeper: true }, { id: 'a', x: 5, z: -10, vx: 0, vz: 0 }];
    expect(passPick({ x: 0, z: 0 }, Math.PI, mates)?.id).toBe('a');
    expect(passPick({ x: 0, z: 0 }, Math.PI, [{ ...mates[0], keeper: false }, mates[1]])?.id).toBe('k');
  });
  it("a person's shot at the middle of the goal goes for the corner away from the keeper", () => {
    const mid = shotAt({ x: 0, y: r, z: 8 }, 0, 0, 'red', { vx: 0, vz: 0 }, FOOTBALL.gravity, r);
    const open = shotAt({ x: 0, y: r, z: 8 }, 0, 0, 'red', { vx: 0, vz: 0 }, FOOTBALL.gravity, r, -1);
    expect(Math.abs(mid.vx)).toBeLessThan(.01);
    expect(open.vx).toBeLessThan(-2);
    // (A shot the person put wide of the middle is theirs.)
    const wide = shotAt({ x: 0, y: r, z: 8 }, .22, 0, 'red', { vx: 0, vz: 0 }, FOOTBALL.gravity, r, -1);
    expect(wide.vx).toBeGreaterThan(0);
  });
  it('a ball a person has just won is theirs a moment: a POKE straight back is shielded', () => {
    const m = people();
    drop(m);
    m.put('p', 0, 0, 0); m.put('b', 0, 2.1, Math.PI); m.put('q', -10, -10, 0); m.put('c', 10, -10, 0);
    Object.assign(m.ball, { x: 0, y: r, z: .9, vx: 0, vy: 0, vz: 0 });
    carry(m, 'p', 0);
    tick(m, 'b', { yaw: Math.PI, guard: true });
    for (let i = 0; i < 12; i++) tick(m, 'b', { yaw: Math.PI });
    expect(m.ball.carry).toBe('p');
    // (Once the moment is past, the same poke from in front wins it.)
    until(m, () => false, FOOTBALL.fun.fresh.normal + .6);
    m.put('p', 0, 0, 0); m.put('b', 0, 2.1, Math.PI);
    tick(m, 'b', { yaw: Math.PI, guard: true });
    for (let i = 0; i < 12 && m.ball.carry === 'p'; i++) tick(m, 'b', { yaw: Math.PI });
    expect(m.ball.carry).toBe('b');
  });
  it('a full-power shot hangs a beat at the boot and says so', () => {
    const m = people();
    drop(m);
    m.put('p', 0, 0, 0); m.put('q', -10, -6, 0); m.put('b', 10, 6, 0); m.put('c', 10, -6, 0);
    Object.assign(m.ball, { x: 0, y: r, z: .9, vx: 0, vy: 0, vz: 0 });
    carry(m, 'p', 0);
    tick(m, 'p', { moveZ: 1, attack: 'heavy', heavyHeld: true });
    for (let i = 0; i < 50; i++) tick(m, 'p', { moveZ: 1, heavyHeld: true });
    tick(m, 'p', { moveZ: 1, heavyHeld: false });
    const shot = m.view.events.find(e => e.kind === 'strike');
    expect(shot?.full).toBe(true);
    expect(m.ball.frozenUntil).toBeGreaterThan(m.sim.serverTime);
    expect(m.ball.frozenUntil - m.sim.serverTime).toBeLessThanOrEqual(FOOTBALL.fun.full.stop + 1e-6);
  });
});

describe('Goal Rush football: the bots', () => {
  /** Red's bot carrying in midfield, the person `open` m clear of everyone further up. */
  function feed(open: boolean) {
    const m = withBots('normal', 5, true);
    drop(m);
    const bot = [...m.seats.values()].find(s => s.team === 'red' && s.bot && !s.keeper)!.id;
    for (const s of m.seats.values()) if (s.id !== bot && s.id !== 'p' && !s.keeper) m.put(s.id, s.team === 'red' ? -11 : 11, s.team === 'red' ? -12 : 14, 0);
    m.put(bot, 0, -6, 0); m.put('p', 4, 4, 0);
    if (!open) { const foe = [...m.seats.values()].find(s => s.team === 'blue' && !s.keeper)!.id; m.put(foe, 4.5, 5.2, Math.PI); }
    Object.assign(m.ball, { x: 0, y: r, z: -5.1, vx: 0, vy: 0, vz: 0 });
    carry(m, bot, 0);
    return { m, bot };
  }
  it('a bot on the ball feeds an open person within about a second', () => {
    const { m } = feed(true);
    let at = -1;
    for (let i = 0; i < 90 && at < 0; i++) { tick(m, 'p', {}); if (m.view.events.some(e => e.kind === 'pass' && e.targetId === 'p')) at = i / 60; }
    expect(at).toBeGreaterThan(FUN.feed - .05);
    expect(at).toBeLessThanOrEqual(1.3);
  });
  it('a CALL gets the ball as soon as a lane is open', () => {
    const { m } = feed(false);
    tick(m, 'p', { attack: 'light' });
    let at = -1;
    for (let i = 0; i < 30 && at < 0; i++) { tick(m, 'p', {}); if (m.view.events.some(e => e.kind === 'pass' && e.targetId === 'p')) at = i / 60; }
    expect(at).toBeGreaterThanOrEqual(0);
    expect(at).toBeLessThan(.3);
  });
  it('a bot with nobody on it keeps the ball a while before it passes', () => {
    const m = withBots('normal', 9, true);
    drop(m);
    const bot = [...m.seats.values()].find(s => s.team === 'red' && s.bot && !s.keeper)!.id;
    // (Everyone else far off, the person marked tight so it is no feed.)
    let k = 0;
    for (const s of m.seats.values()) if (s.id !== bot && !s.keeper) m.put(s.id, (k++ % 2 ? -1 : 1) * 10, s.team === 'red' ? -2 : 12, 0);
    const foe = [...m.seats.values()].find(s => s.team === 'blue' && !s.keeper)!.id, p = m.sim.actors.get('p')!.state;
    m.put(bot, 0, -12, 0); m.put(foe, p.x + .8, p.z + .8, 0);
    Object.assign(m.ball, { x: 0, y: r, z: -11.1, vx: 0, vy: 0, vz: 0 });
    carry(m, bot, 0);
    let passed = -1;
    for (let i = 0; i < 240 && passed < 0; i++) { tick(m, 'p', {}); m.put(foe, m.sim.actors.get('p')!.state.x + .8, m.sim.actors.get('p')!.state.z + .8, 0); if (m.ball.carry !== bot) passed = i / 60; }
    expect(passed).toBeGreaterThan(SPORT_BOT.normal.carry[0] - .1);
  });
  it('rivals press a person on the ball softer on EASY than on NORMAL, harder on HARD', () => {
    expect(SPORT_BOT.easy.person).toBeLessThan(SPORT_BOT.normal.person);
    expect(SPORT_BOT.normal.person).toBeLessThan(SPORT_BOT.hard.person);
    expect(SPORT_BOT.easy.markPerson).toBeGreaterThan(SPORT_BOT.hard.markPerson);
  });
});
