import {afterEach, describe, expect, it} from 'vitest';
import {AimLine} from './aimLine';
import {chargeFull, ownCharge, ownShot, ownStrike} from './ownShot';
import {BallMatch} from '../../game/ball/BallMatch';
import {BALL_ID, GOAL_RULES, SHOOT, SPIKE_RULES, type BallModeId} from '../../game/ball/model';
import {MOVES} from '../../game/moves';
import type {FighterId} from '../../game/types';

/** The page's own SHOOT (render/ball/ownShot.ts, aimLine.ts): its charge as the page simulates it, and
 *  the aim line on the pitch from it - through a real match, the key held as a page holds it. */
const reset = () => { ownShot.read = () => undefined; ownShot.clock = () => NaN; ownShot.drawn = () => false; };
afterEach(reset);

/** FREE PLAY, one fighter, a still ball a stride ahead; SHOOT pressed and held `held` ticks (Infinity: all along), the
 *  aim `yaw`. Each tick: the charge, and the line an AimLine draws from it. */
function hold(mode: BallModeId, fighter: FighterId, held: number, yaw = 0, length = 70) {
  const m = new BallMatch(mode, {seed: 3, access: 'bots', practice: true});
  m.add('me', fighter, 'Me', false, 'red'); m.start();
  for (let i = 0; i < 600 && m.view.phase !== 'live'; i++) m.step(1 / 60);
  const R = mode === 'goal-rush' ? GOAL_RULES : SPIKE_RULES, z0 = mode === 'goal-rush' ? -6 : -5;
  m.sim.place('me', {x: 0, y: 0, z: z0}, 0); m.sim.clearPlayerInput('me');
  m.feed({ball: {x: 0, y: R.ballRadius, z: z0 + 2, vx: 0, vy: 0, vz: 0}, team: 'red', touchTeam: 'red', touches: 2});
  ownShot.read = () => m.sim.actors.get('me'); ownShot.clock = () => m.sim.serverTime;
  const line = new AimLine(), ticks: {charge?: number; left?: number; letGo?: boolean; on: boolean; length: number; full: number; end: [number, number]; ball: number}[] = [];
  let seq = 0;
  for (let i = 0; i < length; i++) {
    m.submit('me', {seq: ++seq, moveX: 0, moveZ: 0, yaw, targetId: BALL_ID, attack: i === 0 ? 'heavy' : undefined, heavyHeld: i < held});
    m.step(1 / 60);
    const c = ownCharge('me');
    line.update(m.view, 'me', {...m.ball}, undefined, 1 / 60, true);
    ticks.push({charge: c?.charge, left: c?.left, letGo: c?.letGo, on: line.look.on, length: line.look.length, full: line.look.full, end: [...line.look.end] as [number, number], ball: Math.hypot(m.ball.vx, m.ball.vy, m.ball.vz)});
  }
  return {ticks, line, m};
}

describe("the page's own charge (ownShot.ts)", () => {
  it('nothing on a tap; held, from the split to the blow, the share of the wind-up held - full as the blow lands', () => {
    const tap = hold('goal-rush', 'gorai', 3);
    expect(tap.ticks.every(t => t.charge === undefined && !t.on)).toBe(true);
    const {ticks} = hold('goal-rush', 'gorai', Infinity), blow = MOVES.gorai.heavy.contacts[0];
    const shown = ticks.map((t, i) => ({i, ...t})).filter(t => t.charge !== undefined);
    // From the split (the key still down 0.2 s after the press): already that share of the wind-up.
    expect(shown[0].i + 1).toBeGreaterThanOrEqual(Math.round(SHOOT.hold * 60));
    expect(shown[0].charge!).toBeCloseTo(SHOOT.hold / blow, 1);
    expect(shown.every((t, k) => k === 0 || t.charge! >= shown[k - 1].charge!)).toBe(true);
    expect(shown.at(-1)!.charge!).toBeGreaterThan(.95);
    expect(shown.at(-1)!.left!).toBeLessThan(1 / 30);
    // (Full as it shows from the last two frames before the blow - the readout's flash, the ring lit - and not before.)
    expect(chargeFull(shown.at(-1) as {charge: number; left: number; letGo: boolean})).toBe(true);
    expect(chargeFull(shown[0] as {charge: number; left: number; letGo: boolean})).toBe(false);
    // Gone the tick the ball is struck.
    const struck = ticks.findIndex(t => t.ball > 2);
    expect(struck).toBe(shown.at(-1)!.i + 1);
    expect(ticks[struck].charge).toBeUndefined();
  });
  it('the key up before the blow: the charge stops there, and the blow still lands when the heavy\'s does', () => {
    const {ticks} = hold('goal-rush', 'gorai', 18), shown = ticks.filter(t => t.charge !== undefined);
    const stopped = shown.filter(t => t.letGo);
    expect(stopped.length).toBeGreaterThan(3);
    expect(new Set(stopped.map(t => t.charge!.toFixed(3))).size).toBe(1);
    expect(stopped[0].charge!).toBeLessThan(.8);
    expect(stopped.some(t => chargeFull(t as {charge: number; left: number; letGo: boolean}))).toBe(false);
  });
  it('the quick strike\'s take reads the page\'s own swing only where its body is drawn from it (online)', () => {
    const {m} = hold('goal-rush', 'gorai', 3);
    const a = m.sim.actors.get('me')!;
    Object.assign(a.state, {action: 'heavy', strike: 'tap', actionSeq: 9});
    expect(ownStrike('me', 9)).toBeUndefined();
    ownShot.drawn = () => true;
    expect(ownStrike('me', 9)).toBe('tap');
    expect(ownStrike('me', 8)).toBeUndefined();
    expect(ownStrike('someone', 9)).toBeUndefined();
  });
});

describe('the aim line (aimLine.ts)', () => {
  it('lies on the pitch from the ball to the goal for a charged shot, drawn out as far as it is charged, turned with the aim', () => {
    const straight = hold('goal-rush', 'gorai', Infinity), on = straight.ticks.filter(t => t.on);
    expect(on.length).toBeGreaterThan(10);
    for (const t of on) expect(t.length).toBeCloseTo(t.full * t.charge!, 0);
    // Further each tick it is held, and all of it at the end: into the goal it is put on target for.
    expect(on.at(-1)!.length).toBeGreaterThan(on[0].length + 2);
    expect(on.at(-1)!.end[1]).toBeGreaterThan(GOAL_RULES.halfZ - 2);
    expect(Math.abs(on.at(-1)!.end[0])).toBeLessThan(GOAL_RULES.goalHalfWidth);
    // Gone the moment the ball leaves; the mesh one draw while it shows.
    expect(straight.ticks[straight.ticks.findIndex(t => t.ball > 2)].on).toBe(false);
    expect(straight.line.mesh.geometry.drawRange.count).toBeGreaterThan(0);
    // The aim turned either way: the line to that corner of the goal (the shot is put on target there).
    const one = hold('goal-rush', 'gorai', Infinity, -.15).ticks.filter(t => t.on).at(-1)!, other = hold('goal-rush', 'gorai', Infinity, .15).ticks.filter(t => t.on).at(-1)!;
    expect(one.end[0]).toBeLessThan(-1); expect(other.end[0]).toBeGreaterThan(1);
  });
  it('Sky Spike: ends where the hit over first comes down, in the far court', () => {
    const on = hold('sky-spike', 'gorai', Infinity).ticks.filter(t => t.on);
    expect(on.length).toBeGreaterThan(5);
    const end = on.at(-1)!.end;
    expect(end[1]).toBeGreaterThan(1); expect(end[1]).toBeLessThan(SPIKE_RULES.courtHalfZ + 1);
  });
  it('nobody else\'s, and nothing for a ball the swing cannot reach', () => {
    const {m} = hold('goal-rush', 'gorai', 3);
    const line = new AimLine();
    line.update(m.view, 'someone', {...m.ball}, undefined, 1 / 60, true);
    expect(line.look.on).toBe(false);
    // A charge under way: drawn for the ball at the feet, not for one far off, nor in a replay.
    const mid = hold('goal-rush', 'gorai', Infinity, 0, 20);
    expect(mid.line.look.on).toBe(true);
    mid.line.update(mid.m.view, 'me', {...mid.m.ball, x: 15, z: 10}, undefined, 1 / 60, true);
    expect(mid.line.look.on).toBe(false);
    mid.line.update(mid.m.view, 'me', {...mid.m.ball}, undefined, 1 / 60, false);
    expect(mid.line.look.on).toBe(false);
    expect(mid.line.mesh.visible).toBe(false);
  });
});
