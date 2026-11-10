import { describe, expect, it } from 'vitest';
import { BallMatch, MASHED } from './BallMatch';
import { GOAL_RULES, SPIKE_RULES } from './model';
import { freshBall } from './physics';
import { SCUFF, strikeBall, type StrikeContext } from './strike';
import { HumanHands } from './playerModels';
import { MOVES } from '../moves';
import type { PlayerInput } from '../types';

/** Skill against mashing. A blow out of a flurry of presses is a SCUFF (BallMatch MASHED,
 *  strike.ts SCUFF), and the scripted players the sims measure it with (playerModels.ts). */
const steps = (m: { step(dt: number): void }, seconds: number) => { for (let i = 0; i < Math.round(seconds * 60); i++) m.step(1 / 60); };
const until = (m: BallMatch, done: () => boolean, seconds = 20) => { for (let i = 0; i < seconds * 60 && !done(); i++) m.step(1 / 60); return done(); };
let seq = 0;
const press = (m: BallMatch, id: string, input: Partial<PlayerInput>) => m.submit(id, { seq: ++seq, moveX: 0, moveZ: 0, yaw: 0, ...input });

/** Red's Gorai alone against blue's Konta, people both, the ball live. */
function match(mode: 'goal-rush' | 'sky-spike' = 'goal-rush') {
  const m = new BallMatch(mode, { seed: 3, access: 'host', fillBots: false });
  m.add('red-1', 'gorai', 'Red', false, 'red');
  m.add('blue-1', 'konta', 'Blue', false, 'blue');
  expect(m.start()).toBe(true);
  expect(until(m, () => m.view.phase === 'live')).toBe(true);
  m.sim.place('blue-1', { x: 10, y: 0, z: 14 }, 0);
  return m;
}
/** A still ball a stride in front of red-1 and a heavy pressed at it - and, a masher's hands, pressed again every tenth
 *  of a second through its wind-up. The strike events after. */
function strike(mash: boolean) {
  const m = match();
  m.sim.place('red-1', { x: 0, y: 0, z: -6 }, 0);
  Object.assign(m.ball, { x: 0, y: GOAL_RULES.ballRadius, z: -4.2, vx: 0, vy: 0, vz: 0, heat: 0 });
  press(m, 'red-1', { attack: 'heavy', yaw: 0 });
  for (let i = 0; i < 6; i++) { steps(m, .1); if (mash) press(m, 'red-1', { attack: 'heavy', yaw: 0 }); }
  steps(m, .6);
  return { m, strikes: m.view.events.filter(e => e.kind === 'strike' && e.actorId === 'red-1') };
}

describe('MASHED: a blow out of a flurry of presses is a SCUFF', () => {
  it('scuffs a heavy pressed on top of a flurry: slower, off its aim, named SCUFFED, no meter', () => {
    const clean = strike(false), mashed = strike(true);
    expect(clean.strikes.length).toBe(1);
    expect(clean.strikes[0].text).not.toBe('SCUFFED');
    expect(mashed.strikes.length).toBe(1);
    expect(mashed.strikes[0].text).toBe('SCUFFED');
    expect(mashed.strikes[0].value!).toBeLessThan(clean.strikes[0].value! * .8);
    // (The clean one earned its touch's meter; the scuff none.)
    expect(mashed.m.sim.actors.get('red-1')!.state.ultimate).toBeLessThan(clean.m.sim.actors.get('red-1')!.state.ultimate);
  });
  it('never scuffs a press in rhythm, nor any bot', () => {
    // A press every 0.3 s - a light string's rhythm - is never mashing.
    const m = match();
    m.sim.place('red-1', { x: 0, y: 0, z: -6 }, 0);
    for (let i = 0; i < 4; i++) { press(m, 'red-1', { attack: 'light', yaw: 0 }); Object.assign(m.ball, { x: 0, y: GOAL_RULES.ballRadius, z: -4.6, vx: 0, vy: 0, vz: 0 }); steps(m, .3); }
    expect(m.view.events.some(e => e.text === 'SCUFFED')).toBe(false);
    // A minute of a bots' match in each mode: not one.
    for (const mode of ['goal-rush', 'sky-spike'] as const) {
      const bots = new BallMatch(mode, { seed: 8, access: 'bots' });
      bots.add('p', 'konta', 'P', false, 'red'); bots.pilot('p'); bots.start();
      steps(bots, 60);
      expect(bots.view.events.some(e => e.kind === 'strike')).toBe(true);
      expect(bots.view.events.some(e => e.text === 'SCUFFED')).toBe(false);
    }
  });
  it("scuffs Sky Spike's body touch too while the hands mash (the automatic bump)", () => {
    /** A ball dropped onto red-1's body on red's first touch, after `mash` presses a tenth apart (the ultimate with no
     *  meter: refused, so no swing comes of them - only the hands). */
    const bump = (mash: number) => {
      const m = match('sky-spike');
      until(m, () => m.view.phase === 'live' || m.view.phase === 'kickoff');
      m.view.phase = 'live';
      m.sim.place('red-1', { x: 0, y: 0, z: -6 }, 0);
      Object.assign(m.ball, { x: 6, y: 9, z: -9, vx: 0, vy: 0, vz: 0, held: false, lastId: 'blue-1', lastTeam: 'blue', shot: 'spike' });
      m.sim.actors.get('red-1')!.state.ultimate = 0;
      for (let i = 0; i < MASHED.presses; i++) { if (i < mash) press(m, 'red-1', { attack: 'ultimate', yaw: 0 }); steps(m, .1); m.ball.y = 9; m.ball.vy = 0; }
      Object.assign(m.ball, { x: 0, y: 2.6, z: -6, vx: 0, vy: -6, vz: 0 });
      m.view.touchTeam = 'blue'; m.view.touches = 0;
      steps(m, .12);
      return { by: m.ball.lastId, vx: m.ball.vx, vz: m.ball.vz };
    };
    const clean = bump(0), mashed = bump(MASHED.presses);
    expect(clean.by).toBe('red-1');
    expect(mashed.by).toBe('red-1');
    expect(Math.hypot(mashed.vx - clean.vx, mashed.vz - clean.vz)).toBeGreaterThan(.3);
  });
  it("lands a Sky Spike keep off its spot, and sends a scuffed hit over slower (strike.ts)", () => {
    const ball = { ...freshBall(), x: 0, y: 1.6, z: -5, vx: 0, vy: -2, vz: 0 };
    const c: StrikeContext = { mode: 'sky-spike', slot: 'light', move: { style: 'melee', name: 'Light' }, knockback: 0, launch: false, finisher: false, pushX: 0, pushZ: 0, touches: 2,
      striker: { id: 'r', team: 'red', x: 0, y: 0, z: -5.5, grounded: true, aimYaw: 0, forward: 0, lateral: 0, awakened: false, chain: 0 } };
    const land = (v: { vx: number; vz: number }) => ({ x: ball.x + v.vx * 1.35, z: ball.z + v.vz * 1.35 });
    const set = strikeBall(ball, c), scuffed = strikeBall(ball, { ...c, scuff: { yaw: .5, off: 1 } });
    expect(Math.abs(land(scuffed).x - land(set).x)).toBeGreaterThan(SCUFF.keep * .7);
    // A spike from the top of a jump at the net: scuffed, slower.
    const high = { ...ball, y: 4.4, z: -1.2, vy: 0 };
    const hit = { ...c, slot: 'heavy' as const, touches: 3, striker: { ...c.striker, z: -1.6, y: 3, grounded: false } };
    const over = strikeBall(high, hit), mis = strikeBall(high, { ...hit, scuff: { yaw: .3, off: .6 } });
    expect(over.shot).toBe('spike');
    expect(Math.hypot(mis.vx, mis.vy, mis.vz)).toBeLessThan(Math.hypot(over.vx, over.vy, over.vz) * .8);
    expect(SPIKE_RULES.touches).toBe(3);
  });
});

describe('The scripted players (playerModels.ts)', () => {
  /** A ball rolled at red-1 from 16 m out at 12 m/s, red-1's seat in a person's hands of `style`. Its strikes. */
  function rolled(style: 'masher' | 'skilled', seed: number) {
    const m = match(), hands = new HumanHands('red-1', 'goal-rush', style, seed);
    m.sim.place('red-1', { x: 0, y: 0, z: -6 }, 0);
    // (A breath for the eyes to see the ball at rest first.)
    Object.assign(m.ball, { x: 0, y: GOAL_RULES.ballRadius, z: 10, vx: 0, vy: 0, vz: 0, heat: 0, lastId: 'blue-1', lastTeam: 'blue' });
    let n = 1e6;
    const drive = (seconds: number) => { for (let i = 0; i < seconds * 60; i++) { const cmd = hands.command(m.view, m.sim.playerStates(), m.sim.serverTime); if (cmd) m.submit('red-1', { ...cmd, seq: ++n }); m.step(1 / 60); } };
    m.sim.place('red-1', { x: 0, y: 0, z: -6 }, 0);
    for (let i = 0; i < 20; i++) { hands.command(m.view, m.sim.playerStates(), m.sim.serverTime); m.step(1 / 60); m.ball.vz = 0; m.ball.z = 10; }
    m.ball.vz = -12;
    drive(1.6);
    return m.view.events.filter(e => e.kind === 'strike' && e.actorId === 'red-1');
  }
  it('a skilled hand meets a ball coming in with a PERFECT STRIKE most of the time; a masher never does', () => {
    let skilled = 0, masher = 0;
    for (let seed = 1; seed <= 6; seed++) {
      if (rolled('skilled', seed).some(e => e.perfect)) skilled++;
      if (rolled('masher', seed).some(e => e.perfect)) masher++;
    }
    expect(skilled).toBeGreaterThanOrEqual(4);
    expect(masher).toBe(0);
    expect(MOVES.gorai.heavy.contacts[0]).toBeGreaterThan(.2);
  });
});
