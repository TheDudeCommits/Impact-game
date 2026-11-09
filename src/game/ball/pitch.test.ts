import { describe, expect, it } from 'vitest';
import { BallMatch } from './BallMatch';
import { BALL_ID, GOAL_FIGHT, GOAL_RULES, type BallView } from './model';
import type { ExternalBlow } from '../simulation';
import type { MoveDefinition } from '../moves';
import { DrillRunner, MODE_DRILLS, type DrillFeed, type DrillHost } from './drills';
import { freshBall, stepBall } from './physics';
import { STAGES } from '../stages';

/** Goal Rush's pitch at about half the area it was, everything on it laid from GOAL_RULES, the corners that
 *  kick a ball run along a wall across the goal, and the save OFF THE LINE. */
const steps = (m: BallMatch, seconds: number) => { for (let i = 0; i < Math.round(seconds * 60); i++) m.step(1 / 60); };
const until = (m: BallMatch, done: () => boolean, seconds = 20) => { for (let i = 0; i < seconds * 60 && !done(); i++) m.step(1 / 60); return done(); };
const R = GOAL_RULES;
const MOVE: MoveDefinition = { name: 'Test Blow', duration: .4, contacts: [.1], damage: 10, range: 2, radius: .8, stamina: 0, cooldown: 0, stun: .2, knockback: 4, style: 'melee' };
const blow = (attackerId: string): ExternalBlow =>
  ({ attackerId, slot: 'heavy', move: MOVE, damage: 10, critical: false, finisher: true, pushX: 0, pushZ: 1, knockback: MOVE.knockback, stun: .2, launch: false, hitstop: .05 });
const inside = (p: { x: number; z: number }, margin = 0) => Math.abs(p.x) <= R.halfX - margin && Math.abs(p.z) <= R.halfZ - margin;

function pair() {
  const m = new BallMatch('goal-rush', { seed: 3, access: 'host', fillBots: false });
  m.add('red-1', 'gorai', 'Red', false, 'red');
  m.add('blue-1', 'konta', 'Blue', false, 'blue');
  expect(m.start()).toBe(true);
  expect(until(m, () => m.view.phase === 'live')).toBe(true);
  return m;
}

describe('the smaller pitch', () => {
  it('is about half the area it was, and the stage keeps the bodies a body\'s width inside its walls', () => {
    const area = R.halfX * R.halfZ * 4;
    expect(area / (36 * 52)).toBeGreaterThan(.45);
    expect(area / (36 * 52)).toBeLessThan(.6);
    expect(STAGES['ball-pitch'].halfX).toBeCloseTo(R.halfX - .4, 5);
    expect(STAGES['ball-pitch'].halfZ).toBeCloseTo(R.halfZ - .4, 5);
    // The goal is still a target on it: wider than the six-yard gap a keeper could cover by standing still.
    expect(R.goalHalfWidth * 2).toBeGreaterThan(R.halfX * .55);
  });

  it('turns a ball run hard along a side wall across the face of the goal, at volley height (the corner kick)', () => {
    for (const speed of [16, 22]) {
      const b = freshBall(); b.held = false; b.x = R.halfX - R.ballRadius - .05; b.y = R.ballRadius; b.z = 4; b.vz = speed;
      let across: { z: number; y: number } | null = null;
      for (let i = 0; i < 240 && !across; i++) { stepBall('goal-rush', b, 1 / 60); if (Math.abs(b.x) < 1 && b.z > 0) across = { z: b.z, y: b.y }; }
      expect(across, `${speed} m/s`).not.toBeNull();
      // In front of the goal it came along the wall toward, off the floor.
      expect(R.halfZ - across!.z).toBeLessThan(6);
      expect(across!.y).toBeGreaterThan(1);
      expect(across!.y).toBeLessThan(R.goalHeight);
    }
  });

  it('lays every kickoff mark, every way back from a wipe-out, and every drill\'s ball inside the walls', () => {
    const m = pair();
    for (let goal = 0; goal < 6; goal++) {
      for (const id of ['red-1', 'blue-1']) expect(inside(m.sim.actors.get(id)!.state, 1), `kickoff ${goal}`).toBe(true);
      m.ball.x = 0; m.ball.z = R.halfZ - 4; m.ball.y = 1; m.ball.vz = 30; m.ball.held = false;
      until(m, () => m.view.phase === 'scored', 3);
      until(m, () => m.view.phase === 'kickoff', 12);
    }
    // The way back in: at the seat's own end, either side of its goal.
    expect(GOAL_FIGHT.respawnX).toBeLessThan(R.halfX - 1);
    expect(GOAL_FIGHT.respawnZ).toBeLessThan(R.halfZ / 2);
    // Each Goal Rush drill's ball machine feeds its ten balls, and the person's spot, inside the pitch.
    for (const id of MODE_DRILLS['goal-rush']) {
      let t = 0;
      const fed: DrillFeed[] = [];
      const view = { mode: 'goal-rush', phase: 'live', events: [], aim: null } as unknown as BallView;
      const host: DrillHost = {
        mode: 'goal-rush', view, ball: freshBall(), now: () => t, serveNow: () => {},
        person: () => ({ id: 'me', team: 'red', x: 0, y: 0, z: 0, grounded: true }),
        feed: f => { fed.push(f); },
      };
      const runner = new DrillRunner(id, (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })());
      for (let i = 0; i < 60 * 80 && fed.length < 10; i++) { t += 1 / 60; runner.step(host); }
      expect(fed.length, id).toBe(10);
      for (const f of fed) {
        expect(inside(f.ball, R.ballRadius), `${id} ball ${f.ball.x.toFixed(1)}, ${f.ball.z.toFixed(1)}`).toBe(true);
        if (f.at) expect(inside(f.at, .4), `${id} spot`).toBe(true);
      }
    }
  });

  it('calls a shot struck clear from the goal line OFF THE LINE, a save', () => {
    // A shot of red's a metre and a half from going in, struck away by blue standing beside it.
    const clear = (out: number) => {
      const m = pair();
      m.sim.place('red-1', { x: 6, y: 0, z: 0 }, 0);
      Object.assign(m.ball, { x: 1.5, y: 1, z: R.halfZ - out, vx: 0, vy: 0, vz: 18, held: false, lastId: 'red-1', lastTeam: 'red', shot: 'power' });
      const yaw = -Math.PI / 2, a = m.sim.actors.get('blue-1')!;
      a.attackYaw = yaw; a.input.yaw = yaw; a.state.yaw = yaw;
      m.sim.place('blue-1', { x: m.ball.x + 1, y: 0, z: m.ball.z }, yaw);
      expect(m.receive(m.locate(BALL_ID)!, blow('blue-1'))).not.toBeNull();
      steps(m, .4);
      expect(m.view.score.red).toBe(0);
      return m.view.events.find(e => e.kind === 'save');
    };
    const line = clear(1.5);
    expect(line?.text).toBe('OFF THE LINE');
    expect(line?.actorId).toBe('blue-1');
    // One cleared further out is a plain save.
    expect(clear(5)?.text).toBe('SAVE');
  });
});
