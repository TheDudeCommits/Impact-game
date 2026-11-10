import { describe, expect, it } from 'vitest';
import { BallMatch, MVP } from './BallMatch';
import { GOAL_RULES } from './model';
import type { PlayerInput } from '../types';

// MVP points that follow skill (BallMatch MVP), and a SCUFF that is never a LINK SHOT.
const steps = (m: { step(dt: number): void }, seconds: number) => { for (let i = 0; i < Math.round(seconds * 60); i++) m.step(1 / 60); };
const until = (m: BallMatch, done: () => boolean, seconds = 20) => { for (let i = 0; i < seconds * 60 && !done(); i++) m.step(1 / 60); return done(); };
let seq = 0;
const press = (m: BallMatch, id: string, input: Partial<PlayerInput>) => m.submit(id, { seq: ++seq, moveX: 0, moveZ: 0, yaw: 0, ...input });
type Log = { touchesLog: { id: string; team: string; at: number; x: number; y: number; z: number; strike: boolean; shot?: string }[] };

/** Red's Gorai and a team-mate against blue's Konta, people all, the ball live. */
function match() {
  const m = new BallMatch('goal-rush', { seed: 3, access: 'host', fillBots: false, replays: false });
  m.add('red-1', 'gorai', 'Red', false, 'red');
  m.add('red-2', 'taisei', 'Mate', false, 'red');
  m.add('blue-1', 'konta', 'Blue', false, 'blue');
  expect(m.start()).toBe(true);
  expect(until(m, () => m.view.phase === 'live')).toBe(true);
  m.sim.place('blue-1', { x: 10, y: 0, z: 14 }, 0);
  m.sim.place('red-2', { x: -8, y: 0, z: -10 }, 0);
  return m;
}

describe('a SCUFF is never a LINK SHOT', () => {
  it('finishes a team-mate\'s pass first time as a LINK SHOT when struck clean, and not when mashed', () => {
    const finish = (mash: boolean) => {
      const m = match();
      m.sim.place('red-1', { x: 0, y: 0, z: -6 }, 0);
      Object.assign(m.ball, { x: 0, y: GOAL_RULES.ballRadius, z: -4.2, vx: 0, vy: 0, vz: 0, heat: 0, lastId: 'red-2', lastTeam: 'red' });
      // red-2's pass a moment ago, as the touch log has it (BallMatch.linkFrom reads it).
      const log = (m as unknown as Log).touchesLog, pass = () => { log.length = 0; log.push({ id: 'red-2', team: 'red', at: m.sim.serverTime, x: 0, y: 1, z: -9, strike: true, shot: 'tap' }); };
      press(m, 'red-1', { attack: 'heavy', yaw: 0 });
      for (let i = 0; i < 6; i++) { pass(); steps(m, .1); if (mash) press(m, 'red-1', { attack: 'heavy', yaw: 0 }); }
      steps(m, .4);
      return { strikes: m.view.events.filter(e => e.kind === 'strike' && e.actorId === 'red-1').map(e => e.text), links: m.view.events.filter(e => e.kind === 'accolade' && e.text === 'LINK SHOT').length, tally: m.mvpTally('red-1') };
    };
    const clean = finish(false), mashed = finish(true);
    expect(clean.strikes).toEqual(['LINK SHOT']);
    expect(clean.links).toBe(1);
    expect(mashed.strikes).toEqual(['SCUFFED']);
    expect(mashed.links).toBe(0);
    // A scuffed strike's touch is tallied apart (MVP.scuffTouch), worth less than a clean one's.
    expect(mashed.tally.scuffTouch).toBe(1);
    expect(mashed.tally.touch ?? 0).toBe(0);
    expect(MVP.scuffTouch).toBeLessThan(MVP.touch);
  });
});

describe('MVP points that follow skill (BallMatch MVP)', () => {
  it('weighs the skills over mere touches, a scuffed strike at little, and an error as a debit', () => {
    const busy = MVP.shot + 12 * MVP.touch;
    for (const skill of [MVP.perfectStrike, MVP.perfectSpike, MVP.stuff, MVP.save, MVP.tackle, MVP.divingDig, MVP.perfectServe]) expect(skill).toBeGreaterThan(busy);
    expect(MVP.scuffTouch).toBe(0); expect(MVP.scuffShot).toBe(0);
    expect(MVP.scuffGoal).toBeLessThan(MVP.goal); expect(MVP.scuffKill).toBeLessThan(MVP.kill);
    expect(MVP.ownGoal).toBeLessThan(0); expect(MVP.fault).toBeLessThan(0);
  });
  it('names the most points MVP, MVP.win more to each of the winners', () => {
    const m = match();
    m.seats.get('red-1')!.points = 400; m.seats.get('red-2')!.points = 100; m.seats.get('blue-1')!.points = 400 + MVP.win - 1;
    (m as unknown as { finish(w: string, r: string): void }).finish('red', 'Full time.');
    expect(m.view.mvp).toBe('red-1');
    // The results card's line for each seat is its points (BallUI): what the tally added up.
    expect(m.view.seats.find(s => s.id === 'red-1')!.points).toBe(400);
  });
});
