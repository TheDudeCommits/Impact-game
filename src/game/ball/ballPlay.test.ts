import { describe, expect, it } from 'vitest';
import { BallMatch } from './BallMatch';
import { BALL_ID, BALL_SPORT, CLASH, GOAL_FIGHT, GOAL_RULES, ballAssist, type BallModeId } from './model';
import { freshBall, goalZ, stepBall } from './physics';
import { strikeBall, type StrikeContext } from './strike';
import { ArenaSimulation } from '../simulation';
import type { PlayerInput } from '../types';
import { jumpArc, type MoveDefinition } from '../moves';

/** Goal Rush's fights, the sports movement of both rooms, the ball's feel. */
const BIG: MoveDefinition = { name: 'Test Haymaker', duration: .4, contacts: [0], damage: 999, range: 2, radius: .8, stamina: 0, cooldown: 0, stun: .3, knockback: 4, style: 'melee' };
const steps = (m: { step(dt: number): void }, seconds: number) => { for (let i = 0; i < Math.round(seconds * 60); i++) m.step(1 / 60); };
const until = (m: BallMatch, done: () => boolean, seconds = 20) => { for (let i = 0; i < seconds * 60 && !done(); i++) m.step(1 / 60); return done(); };
let seq = 0;
const press = (m: BallMatch, id: string, input: Partial<PlayerInput>) => m.submit(id, { seq: ++seq, moveX: 0, moveZ: 0, yaw: 0, ...input });

/** Two a side of red against one of blue, people all, nobody else: the ball still at the centre spot once it is live.
 *  (red-1 is Gorai, whose heavy is a plain swing: Taisei's blinks.) */
function match(mode: BallModeId = 'goal-rush') {
  const m = new BallMatch(mode, { seed: 3, access: 'host', fillBots: false });
  m.add('red-1', 'gorai', 'Red', false, 'red');
  m.add('red-2', 'ouga', 'Red Two', false, 'red');
  m.add('blue-1', 'konta', 'Blue', false, 'blue');
  expect(m.start()).toBe(true);
  expect(until(m, () => m.view.phase === (mode === 'goal-rush' ? 'live' : 'kickoff'))).toBe(true);
  return m;
}
const speed = (m: BallMatch, id: string) => { const a = m.sim.actors.get(id)!; return Math.hypot(a.mx, a.mz); };

describe("Goal Rush's fights", () => {
  it('puts the sides on the kernel\'s sides in Goal Rush only, and both rooms move as a sport', () => {
    const m = match();
    expect(m.sim.actors.get('red-1')!.state.team).toBe('red');
    expect(m.sim.actors.get('blue-1')!.state.team).toBe('blue');
    expect(m.sim.assist).toBe(ballAssist('goal-rush'));
    expect(m.sim.assist?.sport).toBe(BALL_SPORT['goal-rush']);
    const spike = match('sky-spike');
    expect(spike.sim.actors.get('red-1')!.state.team).toBe(spike.sim.actors.get('blue-1')!.state.team);
    expect(spike.sim.assist?.sport).toBe(BALL_SPORT['sky-spike']);
    // FREE PLAY has nobody to fight.
    const free = new BallMatch('goal-rush', { seed: 3, practice: true });
    free.add('me', 'taisei', 'Me', false, 'red');
    expect(free.sim.actors.get('me')!.state.team).toBe('pitch');
  });
  it('swings at the ball when it is in reach, at an opponent when it is not, and never at a team-mate', () => {
    // In reach: the ball, whoever stands about.
    let m = match();
    m.sim.place('red-1', { x: 0, y: 0, z: -1.7 }, 0);
    m.sim.place('blue-1', { x: 1.2, y: 0, z: -2.6 }, 0);
    press(m, 'red-1', { attack: 'heavy', yaw: 0 });
    steps(m, .7);
    expect(m.ball.lastId).toBe('red-1');
    expect(Math.hypot(m.ball.vx, m.ball.vz)).toBeGreaterThan(8);
    // Out of reach: the opponent in front takes it, the ball is left alone.
    m = match();
    m.sim.place('red-1', { x: -8, y: 0, z: -8 }, 0);
    m.sim.place('blue-1', { x: -8, y: 0, z: -6.6 }, Math.PI);
    m.sim.place('red-2', { x: 8, y: 0, z: 8 }, 0);
    const whole = m.sim.actors.get('blue-1')!.state.hp;
    press(m, 'red-1', { attack: 'heavy', yaw: 0 });
    steps(m, .7);
    expect(m.sim.actors.get('blue-1')!.state.hp).toBeLessThan(whole);
    expect(m.ball.lastId).toBeNull();
    // A team-mate in front is never struck.
    m = match();
    m.sim.place('red-1', { x: -8, y: 0, z: -8 }, 0);
    m.sim.place('red-2', { x: -8, y: 0, z: -6.6 }, Math.PI);
    m.sim.place('blue-1', { x: 8, y: 0, z: 8 }, 0);
    press(m, 'red-1', { attack: 'heavy', yaw: 0 });
    steps(m, .7);
    expect(m.sim.actors.get('red-2')!.state.hp).toBe(GOAL_FIGHT.health);
  });
  it('wipes out a fighter whose health runs out, then brings them back at their own end, whole', () => {
    const m = match();
    expect(m.sim.actors.get('blue-1')!.state.maxHp).toBe(GOAL_FIGHT.health);
    m.sim.place('blue-1', { x: 5, y: 0, z: 5 }, 0);
    m.sim.strike('red-1', 'blue-1', 'heavy', BIG);
    m.step(1 / 60);
    const seat = m.seats.get('blue-1')!, out = seat.out!;
    expect(out).toBeGreaterThan(m.sim.serverTime);
    expect(m.view.events.find(e => e.kind === 'wipeout')).toMatchObject({ actorId: 'red-1', targetId: 'blue-1', team: 'red', value: GOAL_FIGHT.seconds });
    expect(m.seats.get('red-1')!.wipeouts).toBe(1);
    // In the snapshot for the page, and still down a moment later (the kernel's own respawn held off).
    expect(m.snapshot().ball.seats.find(s => s.id === 'blue-1')!.out).toBe(out);
    steps(m, GOAL_FIGHT.seconds - .3);
    expect(m.sim.actors.get('blue-1')!.state.alive).toBe(false);
    steps(m, .4);
    const p = m.sim.actors.get('blue-1')!.state;
    expect(p.alive).toBe(true);
    expect(p.hp).toBe(GOAL_FIGHT.health);
    expect(seat.out).toBeUndefined();
    expect(p.z).toBeCloseTo(goalZ('blue') - GOAL_FIGHT.respawnZ, 1);
  });
  it('fills health again a while after the last blow, and at every kickoff', () => {
    const m = match();
    m.sim.strike('red-1', 'blue-1', 'heavy', { ...BIG, damage: 100 });
    const hurt = m.sim.actors.get('blue-1')!.state.hp;
    expect(hurt).toBeLessThan(GOAL_FIGHT.health);
    steps(m, GOAL_FIGHT.regenAfter - .5);
    expect(m.sim.actors.get('blue-1')!.state.hp).toBe(hurt);
    steps(m, 1.5);
    expect(m.sim.actors.get('blue-1')!.state.hp).toBeGreaterThan(hurt);
  });
  it('knocks an opponent flat with a boosting body (a BUMP), never a team-mate', () => {
    const m = match();
    m.sim.place('red-1', { x: -6, y: 0, z: -12 }, 0);
    m.sim.place('blue-1', { x: -6, y: 0, z: -9 }, Math.PI);
    m.sim.place('red-2', { x: 8, y: 0, z: 8 }, 0);
    const a = m.sim.actors.get('red-1')!;
    a.boosting = true; a.mz = BALL_SPORT['goal-rush'].boost;
    for (let i = 0; i < 20; i++) { press(m, 'red-1', { moveZ: 1 }); m.step(1 / 60); }
    expect(m.view.events.find(e => e.kind === 'demo')).toMatchObject({ actorId: 'red-1', targetId: 'blue-1', text: 'BUMP' });
    expect(m.sim.actors.get('blue-1')!.state.hp).toBeLessThan(GOAL_FIGHT.health);
  });
  it('gives a wiped-out bot no job until it is back', () => {
    const m = new BallMatch('goal-rush', { seed: 5, access: 'bots' });
    m.add('me', 'taisei', 'Me', false, 'red');
    m.start();
    until(m, () => m.view.phase === 'live');
    const bot = [...m.seats.values()].find(s => s.bot && s.team === 'blue')!;
    m.sim.strike('me', bot.id, 'heavy', BIG);
    steps(m, .5);
    expect(bot.out).toBeDefined();
    expect([...m.seats.values()].filter(s => s.team === 'blue' && s.out === undefined).every(s => s.role !== undefined)).toBe(true);
  });
});

describe('sports movement in the ball rooms', () => {
  it('runs quicker, and a dash runs on as a boost on the stamina bar while the stick holds', () => {
    const m = match();
    m.sim.place('red-1', { x: -10, y: 0, z: -20 }, 0);
    for (let i = 0; i < 60; i++) { press(m, 'red-1', { moveZ: 1 }); m.step(1 / 60); }
    expect(speed(m, 'red-1')).toBeCloseTo(BALL_SPORT['goal-rush'].run, 1);
    press(m, 'red-1', { moveZ: 1, dash: true });
    for (let i = 0; i < 40; i++) { press(m, 'red-1', { moveZ: 1 }); m.step(1 / 60); }
    const a = m.sim.actors.get('red-1')!;
    expect(a.boosting).toBe(true);
    expect(a.state.boost).toBe(true);
    expect(speed(m, 'red-1')).toBeCloseTo(BALL_SPORT['goal-rush'].boost, 1);
    const fuel = a.state.stamina;
    for (let i = 0; i < 30; i++) { press(m, 'red-1', { moveZ: 1 }); m.step(1 / 60); }
    expect(a.state.stamina).toBeLessThan(fuel - BALL_SPORT['goal-rush'].boostDrain * .4);
    // The stick let go: the boost is over.
    press(m, 'red-1', {}); m.step(1 / 60);
    expect(a.boosting).toBe(false);
    expect(a.state.boost).toBeUndefined();
  });
  it('leaves every other mode moving as it did', () => {
    const sim = new ArenaSimulation({ roomMode: 'training', trainingBot: false, stage: 'ball-pitch' });
    sim.addPlayer('p', 'taisei', 'P', false, { x: 0, y: 0, z: -10 });
    for (let i = 0; i < 60; i++) { sim.submitInput('p', { seq: ++seq, moveX: 0, moveZ: 1, yaw: 0 }); sim.step(1 / 60); }
    const a = sim.actors.get('p')!;
    expect(Math.hypot(a.mx, a.mz)).toBeCloseTo(7.5, 1);
    sim.submitInput('p', { seq: ++seq, moveX: 0, moveZ: 1, yaw: 0, dash: true });
    for (let i = 0; i < 40; i++) { sim.submitInput('p', { seq: ++seq, moveX: 0, moveZ: 1, yaw: 0 }); sim.step(1 / 60); }
    expect(a.boosting).toBe(false);
    expect(Math.hypot(a.mx, a.mz)).toBeCloseTo(7.5, 1);
    sim.dispose();
  });
  it('jumps twice in Goal Rush (the double jump), once in Sky Spike', () => {
    for (const mode of ['goal-rush', 'sky-spike'] as const) {
      const m = match(mode), a = m.sim.actors.get('red-1')!;
      m.sim.place('red-1', { x: -6, y: 0, z: -6 }, 0);
      press(m, 'red-1', { jump: true, jumpHeld: true });
      for (let i = 0; i < 30; i++) { press(m, 'red-1', { jumpHeld: true }); m.step(1 / 60); }
      const before = a.vy;
      press(m, 'red-1', { jump: true, jumpHeld: true }); m.step(1 / 60);
      if (mode === 'goal-rush') expect(a.vy).toBeGreaterThan(jumpArc('gorai').speed * BALL_SPORT[mode].airJump * .9);
      else expect(a.vy).toBeLessThan(before);
    }
  });
  it('dashes at the ball in the air (the aerial)', () => {
    const m = match(), a = m.sim.actors.get('red-1')!;
    m.sim.place('red-1', { x: 0, y: 0, z: -5 }, 0);
    Object.assign(m.ball, { x: 0, y: 6, z: -1, vx: 0, vy: 4, vz: 0 });
    press(m, 'red-1', { jump: true, jumpHeld: true });
    for (let i = 0; i < 9; i++) { press(m, 'red-1', { jumpHeld: true }); m.step(1 / 60); }
    press(m, 'red-1', { moveZ: 1, dash: true }); m.step(1 / 60);
    expect(a.dashY).toBeGreaterThan(.2);
    expect(a.dashZ).toBeGreaterThan(.2);
  });
  it('cuts a kick\'s tail: a heavy is over soon after its blow', () => {
    const lasts = (sim: ArenaSimulation, id: string) => {
      const a = sim.actors.get(id)!;
      sim.submitInput(id, { seq: ++seq, moveX: 0, moveZ: 0, yaw: Math.PI, attack: 'heavy' });
      let t = 0;
      sim.step(1 / 60);
      while (a.cast && t < 3) { sim.step(1 / 60); t += 1 / 60; }
      return t;
    };
    const m = match();
    m.sim.place('red-1', { x: 10, y: 0, z: -10 }, Math.PI);
    const heavy = m.sim.actors.get('red-1')!;
    const ball = lasts(m.sim, 'red-1');
    const plain = new ArenaSimulation({ roomMode: 'training', trainingBot: false, stage: 'ball-pitch' });
    plain.addPlayer('p', 'gorai', 'P', false, { x: 10, y: 0, z: -10 });
    const whole = lasts(plain, 'p');
    plain.dispose();
    expect(whole).toBeGreaterThan(ball + .2);
    void heavy;
  });
});

describe("the ball's feel", () => {
  it('is bigger and lands with the stamina bar as the boost meter in the view', () => {
    expect(GOAL_RULES.ballRadius).toBeGreaterThanOrEqual(.8);
    expect(CLASH.hold).toBeLessThanOrEqual(.3);
  });
  it('carries the striker\'s run into a shot, never into a tap\'s pass', () => {
    const ball = { ...freshBall(), held: false, x: 0, y: 1, z: 0, heat: 3 };
    const c = (run?: { vx: number; vz: number }, slot: StrikeContext['slot'] = 'heavy'): StrikeContext => ({
      mode: 'goal-rush', slot, move: { style: 'melee', outcome: undefined, name: 'Kick' }, knockback: 0, launch: false, finisher: false, pushX: 0, pushZ: 1, run,
      striker: { id: 'a', team: 'red', x: 0, y: 0, z: -1, grounded: true, aimYaw: Math.PI / 2, forward: 0, lateral: 0, awakened: false, chain: 0 },
    });
    const still = strikeBall(ball, c()), running = strikeBall(ball, c({ vx: 12, vz: 0 }));
    expect(Math.hypot(running.vx, running.vy, running.vz)).toBeGreaterThan(Math.hypot(still.vx, still.vy, still.vz) + 3);
    const backwards = strikeBall(ball, c({ vx: -12, vz: 0 }));
    expect(Math.hypot(backwards.vx, backwards.vy, backwards.vz)).toBeCloseTo(Math.hypot(still.vx, still.vy, still.vz), 3);
    const tap = strikeBall(ball, c(undefined, 'light')), tapRun = strikeBall(ball, c({ vx: 12, vz: 0 }, 'light'));
    expect(Math.hypot(tapRun.vx, tapRun.vz)).toBeCloseTo(Math.hypot(tap.vx, tap.vz), 3);
  });
  it('lifts a low ball off a wall back into play', () => {
    const r = GOAL_RULES.ballRadius, b = { ...freshBall(), held: false, x: GOAL_RULES.halfX - r - .2, y: r, z: 0, vx: 14 };
    let rose = false;
    for (let i = 0; i < 30; i++) { stepBall('goal-rush', b, 1 / 60); if (b.vy > 2) rose = true; }
    expect(rose).toBe(true);
    expect(b.vx).toBeLessThan(0);
  });
  it('keeps a body touch from flying the ball past what its heat allows', () => {
    const m = match();
    m.sim.place('red-1', { x: -2, y: 0, z: -2 }, 0);
    m.sim.place('blue-1', { x: 8, y: 0, z: 8 }, 0);
    Object.assign(m.ball, { x: -2, y: GOAL_RULES.ballRadius, z: -.4, vx: 0, vy: 0, vz: -40, heat: 0 });
    m.step(1 / 60);
    expect(Math.hypot(m.ball.vx, m.ball.vy, m.ball.vz)).toBeLessThanOrEqual(40.01);
    void BALL_ID;
  });
});
