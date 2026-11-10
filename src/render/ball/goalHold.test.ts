import {describe, expect, it} from 'vitest';
import {GOAL_RULES, type BallTeam} from '../../game/ball/model';
import type {PlayerState} from '../../game/types';
import {GoalHold, HOLD, NET_PEAK} from './GoalHold';
import {GoalHuddle, RUN_SPEED, runAt, spotsFor} from './GoalHuddle';
import {goalNetHit} from './hype';

// The goal's hold at the net's furthest stretch and the scorer's side running in to them. Both on
// the page's clock and the page's drawing only: the room's sequence keeps its length.
const body = (id: string, x: number, z: number, more: Partial<PlayerState> = {}) => ({id, x, y: 0, z, yaw: 0, alive: true, ...more}) as PlayerState;
const seats: {id: string; team: BallTeam}[] = [{id: 'a', team: 'red'}, {id: 'b', team: 'red'}, {id: 'k', team: 'blue'}, {id: 'd', team: 'blue'}];
const canvas = {width: 1920, height: 1080} as HTMLCanvasElement;

describe('the goal\'s hold', () => {
  const setup = () => {
    const calls: string[] = [];
    return {calls, hold: new GoalHold({holdFrame: c => calls.push(c ? 'hold' : 'let go')})};
  };
  it('keeps the frame drawn at the net\'s furthest stretch over the canvas for HOLD, the net held at its stretch', () => {
    const {calls, hold} = setup();
    let page = 100;
    hold.goal(page);
    expect(hold.frame(page + .02)).toBe('none'); hold.afterDraw(canvas, page + .02);
    expect(calls).toEqual([]);
    page += NET_PEAK; expect(hold.frame(page)).toBe('capture'); hold.afterDraw(canvas, page);
    expect(calls).toEqual(['hold']);
    let frames = 0;
    for (; frames < 60; frames++) {
      page += 1 / 60;
      if (hold.frame(page) !== 'held') break;
      // The net's own clock is held at its stretch meanwhile (and so is the arena's celebration, timed by it).
      expect(page - goalNetHit.value.w).toBeCloseTo(NET_PEAK, 6);
      expect(hold.holding).toBe(true);
    }
    expect(frames).toBe(Math.ceil(HOLD * 60 - 1e-6) - 1);
    expect(calls).toEqual(['hold', 'let go']);
    // Let go, the net runs on from its stretch.
    expect(page - goalNetHit.value.w).toBeCloseTo(NET_PEAK, 6);
    expect(hold.last.held).toBeGreaterThanOrEqual(HOLD - 1e-6); expect(hold.last.held).toBeLessThan(HOLD + 1 / 60 + 1e-6);
    page += 1; expect(hold.frame(page)).toBe('none');
  });
  it('is short: a few frames inside the goal\'s first half second, before the close-up', () => {
    expect(NET_PEAK + HOLD).toBeLessThan(.5);
    expect(HOLD).toBeLessThanOrEqual(.15);
  });
  it('lets go at once for a new goal or leaving the match, and holds nothing it never kept', () => {
    const {calls, hold} = setup();
    hold.goal(10); hold.frame(10 + NET_PEAK); hold.afterDraw(canvas, 10 + NET_PEAK);
    hold.finish();
    expect(calls).toEqual(['hold', 'let go']);
    hold.goal(20); hold.finish();
    expect(calls).toEqual(['hold', 'let go']);
  });
});

describe('the scorer\'s side running in', () => {
  it('waits its breath, runs at RUN_SPEED and eases to a stop at its place, never past it', () => {
    let last = runAt(0, 0, 10, 0, .2, 0);
    expect(last.x).toBe(0);
    for (let t = 1 / 60; t < 3; t += 1 / 60) {
      const r = runAt(0, 0, 10, 0, .2, t);
      expect(r.x - last.x).toBeLessThanOrEqual(RUN_SPEED / 60 + 1e-9);
      expect(r.x).toBeGreaterThanOrEqual(last.x);
      expect(r.x).toBeLessThanOrEqual(10);
      last = r;
    }
    expect(last.x).toBeCloseTo(10, 6); expect(last.running).toBe(false);
  });
  it('places them beside the scorer and a step beyond, as the lens looks, inside the walls', () => {
    // The lens looks along +z at a scorer at the origin: their places are beyond (z > 0), one either side.
    const spots = spotsFor(0, 0, 0, 2, []);
    expect(spots[0].z).toBeGreaterThan(0); expect(spots[1].z).toBeGreaterThan(0);
    expect(Math.sign(spots[0].x)).toBe(-Math.sign(spots[1].x));
    const wall = spotsFor(GOAL_RULES.halfX, GOAL_RULES.halfZ, 0, 2, []);
    for (const p of wall) { expect(Math.abs(p.x)).toBeLessThan(GOAL_RULES.halfX); expect(Math.abs(p.z)).toBeLessThan(GOAL_RULES.halfZ); }
  });
  it('draws only the scorer\'s side, each in one kept state refilled every frame, facing the scorer once there', () => {
    const h = new GoalHuddle(), scorer = body('a', 0, 10, {yaw: 0});
    h.begin(scorer, 'red', [scorer, body('b', -6, 0), body('k', 2, 15), body('d', 8, 0)], seats, 0);
    const k = body('k', 2, 15);
    expect(h.posed('k', k, 1)).toBe(k);
    expect(h.posed('a', scorer, 1)).toBe(scorer);
    const one = h.posed('b', body('b', -6, 0), .5), two = h.posed('b', body('b', -6, 0), 5);
    expect(one).toBe(two);
    expect(Math.hypot(two.x - scorer.x, two.z - scorer.z)).toBeLessThan(2);
    expect(two.yaw).toBeCloseTo(Math.atan2(scorer.x - two.x, scorer.z - two.z), 6);
    // Placed for the close-up's lens: from the scorer's front (the lens at yaw 0, looking back along yaw + pi), the
    // places lie behind the scorer.
    h.aim(Math.PI);
    const after = h.posed('b', body('b', -6, 0), 9);
    expect(after.z).toBeLessThan(scorer.z);
    h.stop();
    const b = body('b', -6, 0);
    expect(h.posed('b', b, 6)).toBe(b);
  });
});
