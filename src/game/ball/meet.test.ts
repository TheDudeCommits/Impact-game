import { describe, expect, it } from 'vitest';
import { GOAL_RULES, SPIKE_RULES, type BallState } from './model';
import { freshBall, goalZ, landing, stepBall } from './physics';
import { MEET, MOMENTUM, SHOT, chargedPath, meeting, strikeBall, type StrikeContext, type Striker } from './strike';

/** How the swing meets the ball shapes the shot (strike.ts MEET) - LIFT, BEND and RUN, each small and
 *  bounded - and the charged shot's path for an aim line (chargedPath). */
const striker = (over: Partial<Striker> = {}): Striker => ({ id: 'r', team: 'red', x: 0, y: 0, z: 0, grounded: true, aimYaw: 0, forward: 0, lateral: 0, awakened: false, chain: 0, ...over });
const ball = (over: Partial<BallState> = {}): BallState => ({ ...freshBall(), held: false, x: 0, y: GOAL_RULES.ballRadius, z: 1.6, ...over });
const goal = (over: Partial<StrikeContext> = {}): StrikeContext => ({ mode: 'goal-rush', slot: 'heavy', move: { style: 'melee', name: 'Heavy' }, knockback: 0, launch: false, finisher: true, pushX: 0, pushZ: 1,
  striker: striker(), strike: 'tap', ...over });
const speed = (r: { vx: number; vy: number; vz: number }) => Math.hypot(r.vx, r.vy, r.vz);
const DEG = Math.PI / 180;
/** The ball `b` struck by `c`, run on to where it crosses the far goal line: how high, and how far across. */
function atGoal(b: BallState, c: StrikeContext) {
  const r = strikeBall(b, c), fly = { ...b, vx: r.vx, vy: r.vy, vz: r.vz, sx: r.sx, sy: r.sy, sz: r.sz }, gz = goalZ('blue');
  for (let i = 0; i < 240 && fly.z < gz - GOAL_RULES.ballRadius - .05; i++) stepBall('goal-rush', fly, 1 / 60);
  return { x: fly.x, y: fly.y };
}

describe('MEET, LIFT: struck under its centre the ball is lifted, from over it driven down', () => {
  // (Aimed across the pitch, away from either goal: no help on target, the shot's own elevation.)
  const across = (b: BallState, s: Partial<Striker> = {}) => strikeBall(b, goal({ striker: striker({ aimYaw: Math.PI / 2, x: -1.6, z: 0, ...s }) }));
  const elevation = (r: { vx: number; vy: number; vz: number }) => Math.atan2(r.vy, Math.hypot(r.vx, r.vz)) / DEG;
  it('a ball level with the blow is struck square; higher, it climbs more; lower, less - never past the rule\'s few degrees', () => {
    const square = elevation(across(ball({ x: 0, z: 0, y: 1 }))), under = elevation(across(ball({ x: 0, z: 0, y: 2.3 }))), half = elevation(across(ball({ x: 0, z: 0, y: 1.75 })));
    // A fighter in the air over the ball comes down on it.
    const over = elevation(across(ball({ x: 0, z: 0, y: 1.2 }), { y: 1.6, grounded: false }));
    expect(elevation(across(ball({ x: 0, z: 0, y: 1.25 })))).toBeCloseTo(square, 5);
    expect(under - square).toBeCloseTo(MEET.deg, 1);
    expect(half - square).toBeGreaterThan(1); expect(half - square).toBeLessThan(MEET.deg - 1);
    expect(elevation(across(ball({ x: 0, z: 0, y: 6 }))) - square).toBeCloseTo(MEET.deg, 1);
    expect(over).toBeLessThan(elevation(across(ball({ x: 0, z: 0, y: 2.2 }), { y: 1.6, grounded: false })));
  });
  it('a shot put on target arrives higher in the mouth, or lower, and always under the bar', () => {
    const from = { z: 4 }, s = striker({ z: 2.4 });
    const square = atGoal(ball({ ...from, y: 1 }), goal({ striker: s })), under = atGoal(ball({ ...from, y: 2.4 }), goal({ striker: s })), low = atGoal(ball({ ...from, y: 1 }), goal({ striker: { ...s, y: 1.4, grounded: false } }));
    expect(under.y - square.y).toBeGreaterThan(.5); expect(under.y - square.y).toBeLessThan(MEET.goalY + .35);
    expect(under.y + GOAL_RULES.ballRadius).toBeLessThan(GOAL_RULES.goalHeight);
    expect(low.y).toBeLessThan(square.y + .05);
  });
  it('Sky Spike: a spike struck from under the ball floats deeper, from over it it comes down shorter', () => {
    const b = { ...freshBall(), held: false, x: 0, y: 5, z: -1.4 };
    const hit = (y: number) => { const c: StrikeContext = { mode: 'sky-spike', slot: 'heavy', move: { style: 'melee', name: 'Heavy' }, knockback: 3, launch: true, finisher: true, pushX: 0, pushZ: 1, touches: 3, strike: 'tap',
      striker: striker({ y, z: -2.2, grounded: false }) }, r = strikeBall(b, c); return landing('sky-spike', { ...b, vx: r.vx, vy: r.vy, vz: r.vz, sx: r.sx, sy: r.sy, sz: r.sz }, SPIKE_RULES.ballRadius).z; };
    const top = hit(4), rising = hit(2.2), above = hit(5.6);
    expect(rising).toBeGreaterThan(top + .5);
    expect(above).toBeLessThan(top - .5);
    expect(rising - above).toBeLessThan(2 * MEET.deep + 1.2);
    expect(above).toBeGreaterThan(1);
  });
});

describe('MEET, BEND: a crossing ball met late bends away the way it was going; met early, the other way', () => {
  // The ball rolling across the aim, left to right (+x), at 8 m/s; the striker at the origin aiming up the pitch (+z).
  const crossing = (x: number, vx = 8) => ball({ x, z: 1.5, vx, vz: 0 });
  const aimed = (b: BallState) => { const r = strikeBall(b, goal({ striker: striker({ aimYaw: Math.PI / 2 * 0 }) })); return Math.atan2(r.vx, r.vz); };
  // (Up the pitch from deep in its own half is out of the help's reach: the yaw is the rule's own.)
  const deep = (b: BallState) => { const r = strikeBall({ ...b, z: b.z - 17 }, goal({ striker: striker({ z: -17 }) })); return { yaw: Math.atan2(r.vx, r.vz), sy: r.sy }; };
  it('late (the ball already past the line of the aim) to the right, early to the left, on time straight', () => {
    const late = deep(crossing(1.3)), early = deep(crossing(-1.3)), on = deep(crossing(0));
    expect(on.yaw).toBeCloseTo(0, 5); expect(on.sy).toBe(0);
    expect(late.yaw).toBeCloseTo(MEET.yaw, 3); expect(early.yaw).toBeCloseTo(-MEET.yaw, 3);
    // And it curls on the same way: side spin toward the aim's right pulls it right (physics.ts).
    expect(late.sy).toBeGreaterThan(0); expect(early.sy).toBeLessThan(0);
    // The other way round for a ball going right to left.
    expect(deep(crossing(-1.3, -8)).yaw).toBeLessThan(-MEET.yaw * .9);
    expect(deep(crossing(1.3, -8)).yaw).toBeGreaterThan(MEET.yaw * .9);
    void aimed;
  });
  it('is bounded, grows with how late and how fast, and leaves a ball at rest or coming straight alone', () => {
    expect(deep(crossing(5)).yaw).toBeCloseTo(MEET.yaw, 3);
    expect(deep(crossing(.65)).yaw).toBeGreaterThan(.02); expect(deep(crossing(.65)).yaw).toBeLessThan(MEET.yaw * .7);
    expect(deep(crossing(1.3, 4)).yaw).toBeLessThan(deep(crossing(1.3, 8)).yaw);
    expect(deep(crossing(1.3, MEET.from)).yaw).toBeCloseTo(0, 5);
    expect(deep(ball({ x: 1.3, z: 1.5 })).yaw).toBeCloseTo(0, 5);
    expect(deep(ball({ x: 1.3, z: 4, vz: -12 })).yaw).toBeCloseTo(0, 5);
    expect(MEET.yaw).toBeLessThan(.15);
  });
  it('a shot put on target keeps its corner and is still a goal; Sky Spike lands it across', () => {
    const late = atGoal(ball({ x: 1.2, z: 9, vx: 8 }), goal({ striker: striker({ z: 7.6 }) })), on = atGoal(ball({ x: 0, z: 9, vx: 8 }), goal({ striker: striker({ z: 7.6 }) }));
    expect(Math.abs(late.x)).toBeLessThan(GOAL_RULES.goalHalfWidth); expect(Math.abs(on.x)).toBeLessThan(GOAL_RULES.goalHalfWidth);
    expect(late.x).toBeGreaterThan(on.x);
    const b = { ...freshBall(), held: false, x: 1.2, y: 4.6, z: -1.6, vx: 6 };
    const c: StrikeContext = { mode: 'sky-spike', slot: 'heavy', move: { style: 'melee', name: 'Heavy' }, knockback: 3, launch: true, finisher: true, pushX: 0, pushZ: 1, touches: 3, strike: 'tap', striker: striker({ y: 3.6, z: -2.4, grounded: false }) };
    const land = (bb: BallState) => { const r = strikeBall(bb, c); return landing('sky-spike', { ...bb, vx: r.vx, vy: r.vy, vz: r.vz, sx: r.sx, sy: r.sy, sz: r.sz }, SPIKE_RULES.ballRadius).x; };
    expect(land(b) - land({ ...b, vx: 0 })).toBeGreaterThan(.4);
    expect(land(b) - land({ ...b, vx: 0 })).toBeLessThan(MEET.x + .6);
  });
  it('never touches a tap\'s pass, a pop, a serve, a SCUFF or a SUPER SHOT', () => {
    const b = crossing(1.3);
    expect(meeting(b, { striker: striker(), scuff: { yaw: .2, off: .4 } })).toEqual({ lift: 0, bend: 0 });
    expect(meeting(b, { striker: striker(), serve: true })).toEqual({ lift: 0, bend: 0 });
    expect(meeting(b, { striker: striker() }).bend).toBe(1);
    const pass = strikeBall({ ...b, z: b.z - 17 }, goal({ slot: 'light', strike: undefined, striker: striker({ z: -17 }) }));
    expect(Math.atan2(pass.vx, pass.vz)).toBeCloseTo(0, 5);
    const sup = strikeBall(b, goal({ slot: 'ultimate', strike: undefined }));
    expect(sup.super).toBe(true); expect(sup.sy).toBe(0);
  });
});

describe('MEET, RUN: the striker\'s own speed into the ball adds pace', () => {
  // (A hot ball: its cap - 38 m/s - leaves the run room to show.)
  const hot = ball({ heat: 3.2, z: -17 + 1.6 }), s = striker({ z: -17 });
  it('by MOMENTUM of the run along the aim, MEET.runMost at the most, and nothing for a run across or away', () => {
    const still = speed(strikeBall(hot, goal({ striker: s }))), run = speed(strikeBall(hot, goal({ striker: s, run: { vx: 0, vz: 9.5 } })));
    expect(run - still).toBeCloseTo(9.5 * MOMENTUM, 1);
    expect(speed(strikeBall(hot, goal({ striker: s, run: { vx: 0, vz: 40 } }))) - still).toBeCloseTo(MEET.runMost, 1);
    expect(speed(strikeBall(hot, goal({ striker: s, run: { vx: 9.5, vz: 0 } })))).toBeCloseTo(still, 3);
    expect(speed(strikeBall(hot, goal({ striker: s, run: { vx: 0, vz: -9.5 } })))).toBeCloseTo(still, 3);
  });
  it('never past the ball\'s cap', () => {
    const cool = ball({ z: -17 + 1.6 });
    expect(speed(strikeBall(cool, goal({ striker: s, run: { vx: 0, vz: 13.5 } })))).toBeLessThanOrEqual(GOAL_RULES.speedCap[0] + 1e-6);
  });
});

describe('a charged shot (SHOT): more pace, a higher cap and more heat by its charge', () => {
  const cool = ball({ z: -17 + 1.6 }), s = striker({ z: -17 });
  it('Goal Rush: a tap is a DRIVE under the tier\'s cap, a full charge a POWER SHOT a tier over it', () => {
    const tap = strikeBall(cool, goal({ striker: s })), none = strikeBall(cool, goal({ striker: s, strike: 'charge', charge: 0 })), half = strikeBall(cool, goal({ striker: s, strike: 'charge', charge: .5 })), full = strikeBall(cool, goal({ striker: s, strike: 'charge', charge: 1 }));
    expect(tap.shot).toBe('drive'); expect(full.shot).toBe('power');
    expect(speed(tap)).toBeLessThan(GOAL_RULES.speedCap[0]);
    expect(speed(none)).toBeCloseTo(GOAL_RULES.speedCap[0], 3);
    expect(speed(full)).toBeCloseTo(GOAL_RULES.speedCap[1], 3);
    expect(speed(half)).toBeGreaterThan(speed(none) + 1); expect(speed(half)).toBeLessThan(speed(full) - 1);
    expect(tap.heat).toBeCloseTo(SHOT.tapHeat, 5); expect(full.heat).toBeCloseTo(.65 + SHOT.heat, 5); expect(none.heat).toBeCloseTo(.65, 5);
    // A heavy that is nobody's SHOOT (a FIGHT-stance blow's ball, a test's) is as it always was.
    const plain = strikeBall(cool, goal({ striker: s, strike: undefined }));
    expect(plain.shot).toBe('power'); expect(speed(plain)).toBeCloseTo(speed(none), 5); expect(plain.heat).toBeCloseTo(.65, 5);
  });
  it('a tapped drive can be a PERFECT STRIKE; a light string\'s drive still cannot', () => {
    const coming = ball({ z: -17 + 1.6, vz: -9 });
    expect(strikeBall(coming, goal({ striker: s, perfect: true })).perfect).toBe(true);
    expect(strikeBall(coming, goal({ striker: { ...s, chain: 3 }, slot: 'light', strike: undefined, perfect: true })).perfect).toBe(false);
  });
});

describe('chargedPath: the flight a charged shot would take, for an aim line', () => {
  const b = ball({ x: 2, z: 4 }), shot = { mode: 'goal-rush' as const, striker: striker({ x: 2, z: 2.4, aimYaw: -.1 }), charge: 1 };
  it('starts at the ball, flies where the shot is aimed, further the more it is charged, and leaves the ball alone', () => {
    const before = JSON.stringify(b), full = chargedPath(b, shot), none = chargedPath(b, { ...shot, charge: 0 });
    expect(JSON.stringify(b)).toBe(before);
    expect(full[0]).toEqual({ x: b.x, y: b.y, z: b.z });
    expect(full.length).toBeGreaterThan(8);
    expect(full[6].z).toBeGreaterThan(none[6].z + .4);
    // The first step is the strike's own velocity: the same shot strikeBall makes.
    const r = strikeBall(b, { mode: 'goal-rush', slot: 'heavy', move: { style: 'melee', name: '' }, knockback: 0, launch: false, finisher: true, pushX: 0, pushZ: 1, striker: shot.striker, strike: 'charge', charge: 1 });
    expect((full[1].z - full[0].z) * 30).toBeCloseTo(r.vz, 0);
    expect((full[1].x - full[0].x) * 30).toBeCloseTo(r.vx, 0);
    // Put on target from here: it ends in the goal, and the path stops there.
    const last = full[full.length - 1];
    expect(Math.abs(last.z)).toBeGreaterThan(GOAL_RULES.halfZ - 1); expect(Math.abs(last.x)).toBeLessThan(GOAL_RULES.goalHalfWidth);
  });
  it('follows the stick and the view as they are now, and the fighter\'s own heavy', () => {
    const left = chargedPath(b, { ...shot, striker: { ...shot.striker, aimYaw: -.5 } }), right = chargedPath(b, { ...shot, striker: { ...shot.striker, aimYaw: .5 } });
    expect(left[4].x).toBeLessThan(right[4].x - 2);
    // A thrown heavy's shot is a BLAST, flatter than a POWER SHOT (from deep, where neither is put on target).
    const far = ball({ z: -15 }), deep = { ...shot, striker: striker({ z: -16.6 }) };
    const blast = chargedPath(far, { ...deep, move: { style: 'projectile', name: 'Shot', knockback: 2 } }), power = chargedPath(far, deep);
    expect(blast[6].y).toBeLessThan(power[6].y - .2);
  });
  it('Sky Spike: a spike from the net comes down in the far court, where the stick places it', () => {
    const set = { ...freshBall(), held: false, x: 0, y: 5.2, z: -1.4 };
    const from = (forward: number, lateral: number) => chargedPath(set, { mode: 'sky-spike', charge: 1, touches: 3, striker: striker({ y: 4.2, z: -2.2, grounded: false, forward, lateral }) }, 2);
    // (Where it first comes down past the net.)
    const mid = from(0, 0), deep = from(1, 0), end = (p: { x: number; y: number; z: number }[]) => p.find(q => q.z > 0 && q.y < SPIKE_RULES.ballRadius + .25) ?? { x: 0, y: 0, z: -99 };
    expect(end(mid).z).toBeGreaterThan(1); expect(end(mid).z).toBeLessThan(SPIKE_RULES.courtHalfZ);
    expect(end(deep).z).toBeGreaterThan(end(mid).z + 1.5);
    expect(mid.every(p => Math.abs(p.x) < SPIKE_RULES.halfX && Number.isFinite(p.y))).toBe(true);
  });
});
