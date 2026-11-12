import { describe, expect, it } from 'vitest';
import { BallMatch } from './BallMatch';
import { FOOTBALL, FOOTBALL_SIZE, controls, groundPass, passPick, shotAt } from './football';
import { GOAL_RULES } from './model';
import { freshBall } from './physics';
import type { PlayerInput } from '../types';

/** Goal Rush's SPORT mode (football.ts, `?football`): possession, PASS, SHOOT and SPRINT, and how fast each answers a
 *  press - its measurable targets: a pass or a tap's shot gone in the tick the press is heard, possession the
 *  tick the ball is in reach, a 180 degree turn with the ball inside 0.45 s, and nothing of one's own touches taking the
 *  stick away. */
let seq = 0;
type Keys = Partial<PlayerInput> & { lightHeld?: boolean; dashHeld?: boolean };
const tick = (m: BallMatch, id: string, input: Keys) => { m.submit(id, { seq: ++seq, moveX: 0, moveZ: 0, yaw: 0, ...input }); m.step(1 / 60); };
const until = (m: BallMatch, done: () => boolean, seconds = 20) => { for (let i = 0; i < seconds * 60 && !done(); i++) m.step(1 / 60); return done(); };

/** Red's two people (the page's 'p' and a team-mate 'q') and blue's one, no bots, SPORT on, live. */
function match(football = true) {
  const m = new BallMatch('goal-rush', { seed: 5, access: 'host', fillBots: false, football });
  m.add('p', 'konta', 'P', false, 'red'); m.add('q', 'taisei', 'Q', false, 'red'); m.add('r', 'kenzo', 'R', false, 'blue');
  expect(m.start()).toBe(true);
  expect(until(m, () => m.view.phase === 'live')).toBe(true);
  // (The kickoff's taker - 'p', the person on red, the side that kicks off first - has it at their feet as
  // play goes live; these checks start from a loose ball.)
  expect(m.ball.carry).toBe(football ? 'p' : undefined);
  (m as unknown as { drop(pop?: unknown, why?: string): void }).drop(undefined, 'check');
  m.put('p', 0, -6, 0); m.put('q', 0, 8, 0); m.put('r', 9, -14, 0);
  const b = m.ball; Object.assign(b, { x: 0, y: GOAL_RULES.ballRadius * FOOTBALL_SIZE, z: -4.6, vx: 0, vy: 0, vz: 0 });
  return m;
}
/** Runs 'p' up the pitch into the ball at rest until it is at the feet: the ticks it took from the ball being in reach. */
function take(m: BallMatch) {
  // (In reach as the tick's bodies are met: the body's bounds, the ball's radius and FOOTBALL.reach, centre to centre in
  // three dimensions - the body's lowest point 0.45 m over its feet.)
  const R = .45 + GOAL_RULES.ballRadius * FOOTBALL_SIZE + FOOTBALL.reach;
  let inReach = -1, at = -1;
  for (let i = 0; i < 120 && m.ball.carry !== 'p'; i++) {
    const was = m.sim.actors.get('p')!.state, b = m.ball;
    if (inReach < 0 && Math.hypot(b.x - was.x, b.y - .45, b.z - was.z) < R) inReach = i;
    tick(m, 'p', { moveZ: 1 });
    const p = m.sim.actors.get('p')!.state;
    if (inReach < 0 && Math.hypot(b.x - p.x, b.y - .45, b.z - p.z) < R) inReach = i;
    if (m.ball.carry === 'p') at = i;
  }
  return { carried: m.ball.carry === 'p', ticks: at - inReach };
}

describe("Goal Rush's SPORT mode", () => {
  it('is a match on this device asking for it, Goal Rush only (LEARN TO PLAY on its rules), never a drill', () => {
    expect(new BallMatch('goal-rush', { football: true }).view.football).toBe(true);
    expect(new BallMatch('goal-rush', {}).view.football).toBeUndefined();
    expect(new BallMatch('sky-spike', { football: true }).view.football).toBeUndefined();
    expect(new BallMatch('goal-rush', { football: true, practice: true, lesson: true }).view.lesson?.sport).toBe(true);
    expect(new BallMatch('goal-rush', { football: true, practice: true, drill: 'gr-tackle' }).view.football).toBeUndefined();
  });
  it('has the nearer-real ball: 0.6 m across, heavier, no heat', () => {
    const m = match();
    expect(GOAL_RULES.ballRadius * m.ball.size * 2).toBeCloseTo(.6, 5);
    expect(GOAL_RULES.gravity * m.ball.grav).toBeCloseTo(FOOTBALL.gravity, 5);
    expect(m.ball.heat).toBe(0);
    expect(match(false).ball.size).toBe(1);
  });
  it('controls a low, slow ball; a hard one bounces off', () => {
    const r = .22, body = { grounded: true, alive: true, reeling: false, locked: false, stunned: false, y: 0 };
    expect(controls({ ...freshBall(), held: false, y: r }, r, 12, body)).toBe(true);
    expect(controls({ ...freshBall(), held: false, y: r }, r, 24, body)).toBe(false);
    expect(controls({ ...freshBall(), held: false, y: 1.2 }, r, 8, body)).toBe(true);
    expect(controls({ ...freshBall(), held: false, y: 1.2 }, r, 14, body)).toBe(false);
    expect(controls({ ...freshBall(), held: false, y: r }, r, 5, { ...body, locked: true })).toBe(false);
  });
  it('has the ball at the feet the tick it is in reach, and the run at near full pace', () => {
    const m = match(), t = take(m);
    expect(t.carried).toBe(true);
    expect(t.ticks).toBeGreaterThanOrEqual(0);
    const at = m.sim.actors.get('p')!.state.z;
    for (let i = 0; i < 60; i++) tick(m, 'p', { moveZ: 1 });
    const pace = m.sim.actors.get('p')!.state.z - at;
    console.log(`[football] possession ${t.ticks === 0 ? 'the tick' : `${t.ticks} ticks after`} the ball came in reach; a second's run with the ball ${pace.toFixed(2)} m`);
    expect(m.ball.carry).toBe('p');
    expect(pace).toBeGreaterThan(8);
  });
  it('PASS: gone after its short wind-up (FOOTBALL.fun2.kick.pass), to the team-mate pointed at, and the run never slowed', () => {
    const m = match(); take(m);
    for (let i = 0; i < 30; i++) tick(m, 'p', { moveZ: 1 });
    const before = m.sim.actors.get('p')!.state.z;
    tick(m, 'p', { moveZ: 1, attack: 'light' });
    // (The foot drawn back and brought through first - the ball still at the feet, the page's take wound.)
    expect(m.ball.carry).toBe('p');
    expect(m.ball.windTap).toBe('pass');
    let ticks = 1;
    for (; ticks < 20 && m.ball.carry !== undefined; ticks++) tick(m, 'p', { moveZ: 1 });
    expect(ticks / 60).toBeLessThanOrEqual(FOOTBALL.fun2.kick.pass + 2 / 60);
    expect(m.ball.carry).toBeUndefined();
    const pass = m.view.events.filter(e => e.kind === 'pass').at(-1);
    expect(pass?.targetId).toBe('q');
    const fly = Math.hypot(m.ball.vx, m.ball.vz);
    for (let i = 0; i < 30 - ticks; i++) tick(m, 'p', { moveZ: 1 });
    const after = (m.sim.actors.get('p')!.state.z - before) / (31 / 60);
    console.log(`[football] PASS left ${ticks} ticks after the press at ${fly.toFixed(1)} m/s; the passer's run over the next half second ${after.toFixed(2)} m/s`);
    expect(fly).toBeGreaterThan(9);
    expect(after).toBeGreaterThan(8.5);
  });
  it('PASS held is lofted, played as the key comes up', () => {
    const m = match(); take(m);
    tick(m, 'p', { moveZ: 1, attack: 'light', lightHeld: true });
    let ticks = 1;
    for (; ticks < 20; ticks++) tick(m, 'p', { moveZ: 1, lightHeld: true });
    expect(m.ball.carry).toBe('p');
    tick(m, 'p', { moveZ: 1 });
    expect(m.ball.carry).toBeUndefined();
    expect(m.view.events.filter(e => e.kind === 'pass').at(-1)?.text).toBe('LOFTED');
    expect(m.ball.vy).toBeGreaterThan(2);
  });
  it('SHOOT: a tap gone its short wind-up after its key comes up, a hold wound up harder, the run slowed but steered meanwhile', () => {
    const m = match(); take(m);
    m.put('p', 0, 4, 0); Object.assign(m.ball, { x: 0, z: 4.8 }); take(m);
    tick(m, 'p', { moveZ: 1, attack: 'heavy', heavyHeld: true });
    tick(m, 'p', { moveZ: 1, heavyHeld: true });
    expect(m.ball.carry).toBe('p');
    tick(m, 'p', { moveZ: 1 });
    // (FOOTBALL.fun2.kick.shot of wind-up, the take's lead-in, before the contact.)
    for (let i = 0; i < 12 && m.ball.carry !== undefined; i++) { expect(m.ball.windTap).toBe('shot'); tick(m, 'p', { moveZ: 1 }); }
    expect(m.ball.carry).toBeUndefined();
    const tap = Math.hypot(m.ball.vx, m.ball.vy, m.ball.vz);
    const n = match(); take(n); n.put('p', 0, 4, 0); Object.assign(n.ball, { x: 0, z: 4.8 }); take(n);
    tick(n, 'p', { moveZ: 1, attack: 'heavy', heavyHeld: true });
    const x0 = n.sim.actors.get('p')!.state.x;
    for (let i = 0; i < 40; i++) tick(n, 'p', { moveX: -1, heavyHeld: true });
    const steered = Math.abs(n.sim.actors.get('p')!.state.x - x0);
    tick(n, 'p', { moveZ: 1 });
    const held = Math.hypot(n.ball.vx, n.ball.vy, n.ball.vz);
    console.log(`[football] SHOOT tap ${tap.toFixed(1)} m/s (gone as its key came up, 2 ticks after the press); held 0.67 s ${held.toFixed(1)} m/s; steered ${steered.toFixed(2)} m across while winding`);
    // (The tap's wind-up keeps the run's pace in it - FOOTBALL.shot.momentum - a little more than at once.)
    expect(held).toBeGreaterThan(tap + 3.5);
    expect(steered).toBeGreaterThan(3);
  });
  it('turns 180 degrees with the ball inside 0.45 s', () => {
    const m = match(); take(m);
    for (let i = 0; i < 50; i++) tick(m, 'p', { moveZ: 1 });
    // (Done when the ball is round in front of the body the new way and the body runs back at half its pace with it.)
    let t = 0, z = m.sim.actors.get('p')!.state.z;
    for (; t < 60; t++) {
      tick(m, 'p', { moveZ: -1 });
      const p = m.sim.actors.get('p')!.state, vz = (p.z - z) * 60; z = p.z;
      if (m.ball.carry === 'p' && m.ball.z < p.z - .5 && vz < -BALL_RUN / 2) break;
    }
    console.log(`[football] 180 degree turn with the ball: ${(t + 1)} ticks (${((t + 1) / 60).toFixed(3)} s) to the ball in front the new way and the run back at half pace`);
    expect(m.ball.carry).toBe('p');
    expect((t + 1) / 60).toBeLessThanOrEqual(.45);
  });
  it('SPRINT knocks the ball on ahead and back, and letting the key go ends it', () => {
    const m = match(); take(m);
    tick(m, 'p', { moveZ: 1, dash: true, dashHeld: true });
    let most = 0;
    for (let i = 0; i < 40; i++) { tick(m, 'p', { moveZ: 1, dashHeld: true }); most = Math.max(most, m.ball.ahead ?? 0); }
    expect(most).toBeGreaterThan(1);
    expect(m.sim.actors.get('p')!.boosting).toBe(true);
    tick(m, 'p', { moveZ: 1, dashHeld: false });
    tick(m, 'p', { moveZ: 1, dashHeld: false });
    expect(m.sim.actors.get('p')!.boosting).toBe(false);
  });
  it('brings the BOOST bar back fast enough for a run every few seconds', () => {
    const m = match(); take(m);
    const p = () => m.sim.actors.get('p')!.state;
    tick(m, 'p', { moveZ: 1, dash: true, dashHeld: true });
    for (let i = 0; i < 119; i++) tick(m, 'p', { moveZ: 1, dashHeld: true });
    const spent = p().maxStamina! - p().stamina;
    tick(m, 'p', { moveZ: 1, dashHeld: false });
    let back = 0;
    for (; back < 600 && p().stamina < p().maxStamina! - .01; back++) tick(m, 'p', { moveZ: 1 });
    console.log(`[football] a two-second SPRINT spent ${spent.toFixed(0)} of ${p().maxStamina} and was back in ${(back / 60).toFixed(2)} s`);
    expect(back / 60).toBeLessThan(2.2);
  });
  it('passes the press on to the kernel as no attack: no fighting move plays the ball', () => {
    const m = match(); take(m);
    tick(m, 'p', { moveZ: 1, attack: 'special' });
    tick(m, 'p', { moveZ: 1, attack: 'light' });
    const a = m.sim.actors.get('p')!;
    expect(['light', 'heavy', 'special']).not.toContain(a.state.action);
  });
  it('picks the team-mate nearest the line, else nobody', () => {
    const mates = [{ id: 'a', x: 0, z: 10, vx: 0, vz: 0 }, { id: 'b', x: 8, z: 4, vx: 0, vz: 0 }];
    expect(passPick({ x: 0, z: 0 }, 0, mates)?.id).toBe('a');
    expect(passPick({ x: 0, z: 0 }, Math.PI / 2.6, mates)?.id).toBe('b');
    expect(passPick({ x: 0, z: 0 }, Math.PI, mates)).toBeUndefined();
    expect(groundPass(15).v0).toBeLessThanOrEqual(FOOTBALL.pass.most);
    const s = shotAt({ x: 0, y: .22, z: 8 }, 0, 0, 'red', { vx: 0, vz: 0 }, FOOTBALL.gravity, .22);
    expect(s.speed).toBe(FOOTBALL.shot.tap);
  });
});

describe("Goal Rush's SPORT mode: the tackle, the trick and the keeper", () => {
  /** Blue's 'r' carrying the ball at (0, 0) running up +z; red's 'p' stood `ahead` m in front of it facing it. */
  function carried(ahead: number) {
    const m = match();
    m.put('r', 0, 0, 0); m.put('p', 0, ahead, Math.PI); m.put('q', -10, -10, 0);
    const r = m.sim.actors.get('r')!, seat = m.seats.get('r')!;
    Object.assign(m.ball, { x: 0, z: .9, vx: 0, vz: 0 });
    (m as unknown as { startCarry(s: unknown, a: unknown, h: number): void }).startCarry(seat, r, 0);
    // (Had a while: past the fresh moment, FOOTBALL.fun.fresh, in which a ball just won is not poked back.)
    (m as unknown as { carrier: { since: number } }).carrier.since -= FOOTBALL.fun.fresh.easy + .05;
    return m;
  }
  it('POKE: live in the press\'s own tick, wins it clean to the tackler\'s feet', () => {
    const m = carried(2.1);
    m.submit('r', { seq: ++seq, moveX: 0, moveZ: 0, yaw: 0 });
    tick(m, 'p', { yaw: Math.PI, guard: true });
    expect(m.ball.carry).toBe('p');
    expect(m.view.events.some(e => e.kind === 'steal' && e.text === 'POKE' && e.won)).toBe(true);
  });
  it('POKE out of reach wins nothing', () => {
    const m = carried(4);
    for (let i = 0; i < 15; i++) tick(m, 'p', { yaw: Math.PI, guard: i === 0 });
    expect(m.ball.carry).toBe('r');
  });
  it('TRICK: a poke into it inside its window misses and is BEATEN', () => {
    const m = carried(1.7);
    m.submit('r', { seq: ++seq, moveX: 0, moveZ: 0, yaw: 0, attack: 'special' }); m.step(1 / 60);
    tick(m, 'p', { yaw: Math.PI, guard: true });
    expect(m.ball.carry).toBe('r');
    expect(m.view.events.some(e => e.kind === 'steal' && e.text === 'BEATEN')).toBe(true);
    for (let i = 0; i < 6; i++) tick(m, 'p', { yaw: Math.PI, guard: i % 2 === 0 });
    expect(m.ball.carry).toBe('r');
  });
  it('SLIDE: on the boost, longer, and a miss leaves the slider down', () => {
    const m = match();
    m.put('p', 0, -6, 0); m.put('r', 8, 12, 0); Object.assign(m.ball, { x: -10, z: -12 });
    tick(m, 'p', { moveZ: 1, dash: true });
    for (let i = 0; i < 20; i++) tick(m, 'p', { moveZ: 1 });
    expect(m.sim.actors.get('p')!.boosting).toBe(true);
    tick(m, 'p', { moveZ: 1, guard: true });
    for (let i = 0; i < 30; i++) tick(m, 'p', { moveZ: 1 });
    expect(m.view.events.some(e => e.kind === 'steal' && e.text === 'MISSED')).toBe(true);
    expect(m.footCounts.slidesMissed).toBe(1);
  });
  it('seats a keeper a side, a fourth body the game plays, on its line', () => {
    const m = new BallMatch('goal-rush', { seed: 5, access: 'bots', football: true });
    m.add('p', 'konta', 'P', false, 'red'); m.start();
    const keepers = [...m.seats.values()].filter(s => s.keeper);
    expect(keepers.map(s => s.team).sort()).toEqual(['blue', 'red']);
    expect([...m.seats.values()].filter(s => !s.keeper && s.team === 'red').length).toBe(3);
    expect(Math.abs(m.sim.actors.get('keeper-red')!.state.z)).toBeGreaterThan(GOAL_RULES.halfZ - 2);
    const classic = new BallMatch('goal-rush', { seed: 5, access: 'bots' });
    classic.add('p', 'konta', 'P', false, 'red'); classic.start();
    expect([...classic.seats.values()].some(s => s.keeper)).toBe(false);
    expect(classic.seats.size).toBe(6);
  });
});
const BALL_RUN = 9.5 * FOOTBALL.pace;
