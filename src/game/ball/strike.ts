import type {AttackSlot, Vec3} from '../types';
import type {MoveDefinition} from '../moves';
import {BALL_RULES, GOAL_RULES, SPIKE_RULES, heatTier, type BallModeId, type BallState, type BallTeam, type ShotKind} from './model';
import {goalZ, speedCap} from './physics';

/** Who struck the ball, as the strike needs them: where they stand, whether they are off the floor, where they aimed
 *  (the view's yaw at the press, as every attack aims), how they held the stick against that aim (`forward` toward it,
 *  `lateral` across it, each -1..1), awakened or not, which stage of a light string the blow was. */
export interface Striker extends Vec3 {
  id: string; team: BallTeam; grounded: boolean; aimYaw: number; forward: number; lateral: number; awakened: boolean; chain: number;
}
export interface StrikeContext {
  mode: BallModeId;
  slot: AttackSlot; move: Pick<MoveDefinition, 'style' | 'outcome' | 'name'>; knockback: number; launch: boolean; finisher: boolean;
  /** The blow's own drive along the floor (from its origin to the ball), for shots that fly where they were fired. */
  pushX: number; pushZ: number;
  striker: Striker;
  /** Goal Rush: the striker's team-mates (where they are and where they are running), for a pass's lead. */
  mates?: readonly {x: number; z: number; vx: number; vz: number}[];
  /** Sky Spike: this side's touches including this one; a serve; where the other side stands (a super shot finds the gap). */
  touches?: number; serve?: boolean; rivals?: readonly Vec3[];
}
export interface StrikeResult { vx: number; vy: number; vz: number; sx: number; sy: number; sz: number; shot: ShotKind; heat: number; super: boolean }

const DEG = Math.PI / 180;
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** How a blow drives the ball. The direction is the striker's aim (the view they pressed with: a ball goes where it was
 *  aimed, never where an animation happened to point - Rematch's lesson), helped on target the way the arcade sports
 *  games help it: a Goal Rush shot near the frame is put in the frame, a pass near a team-mate finds their run, a Sky
 *  Spike attack into the far half comes down inside the court. What the blow was decides the shot: a light taps or
 *  bumps, a heavy drives, a launcher pops it into the sky, an air blow volleys or spikes, a special bends it, a shot or
 *  beam blasts it along its line, an area move erupts under it, an ultimate is a super shot. */
export function strikeBall(ball: BallState, c: StrikeContext): StrikeResult {
  const kind = classify(ball, c);
  const heatAdd = c.slot === 'ultimate' ? BALL_RULES.heatMax : (BALL_RULES.heatPer[c.slot] ?? .3) * (c.finisher && c.slot === 'light' ? 2 : 1);
  const heat = Math.min(BALL_RULES.heatMax, ball.heat + heatAdd);
  const power = (1 + .1 * heat) * (c.striker.awakened ? 1.12 : 1);
  const out = c.mode === 'goal-rush' ? goalShot(ball, c, kind, power) : spikeShot(ball, c, kind, power);
  // A hotter ball may fly faster, never faster than its heat allows.
  const cap = c.slot === 'ultimate' ? speedCap(c.mode, BALL_RULES.heatMax) : speedCap(c.mode, heat);
  const s = Math.hypot(out.vx, out.vy, out.vz);
  if (s > cap) { const k = cap / s; out.vx *= k; out.vy *= k; out.vz *= k; }
  return {vx: out.vx, vy: out.vy, vz: out.vz, sx: out.sx, sy: out.sy, sz: out.sz, shot: out.shot ?? kind, heat: heat - ball.heat, super: kind === 'super'};
}

function classify(ball: BallState, c: StrikeContext): ShotKind {
  const s = c.striker, air = !s.grounded;
  if (c.slot === 'ultimate') return 'super';
  if (c.mode === 'sky-spike' && c.serve) return 'serve';
  if (c.slot === 'area') return 'eruption';
  // Sky Spike: anything struck from the air above the net is a spike, a beam or a bomb as much as a kick.
  if (c.mode === 'sky-spike' && air && c.slot !== 'light' && ball.y > SPIKE_RULES.netHeight) return 'spike';
  if (c.move.style === 'projectile' || c.move.style === 'beam' || c.move.style === 'bomb' || c.move.style === 'field') return 'blast';
  // Only a move made to launch (a string's launcher ender, a rising strike) pops the ball into the sky.
  const launcher = c.move.outcome === 'launch' || c.move.outcome === 'hop';
  if (air && (c.slot === 'heavy' || c.slot === 'special') && ball.y < s.y + 2.4) return 'spike';
  if (launcher) return 'pop';
  if (air) return c.slot === 'light' ? 'volley' : 'spike';
  if (c.slot === 'special') return s.forward > .5 ? 'sinker' : 'curve';
  if (c.slot === 'heavy') return 'power';
  return c.finisher || s.chain >= 3 ? 'drive' : 'tap';
}

/** The ballistic velocity that carries the ball from `from` to land at `to` (height `toY`) in `t` seconds, drag made
 *  up for roughly. */
function arc(from: Vec3, toX: number, toY: number, toZ: number, t: number, g: number, drag: number) {
  const k = 1 + drag * t * .5;
  return {vx: (toX - from.x) / t * k, vy: ((toY - from.y) + .5 * g * t * t) / t, vz: (toZ - from.z) / t * k};
}

type Flight = {vx: number; vy: number; vz: number; sx: number; sy: number; sz: number; shot?: ShotKind};

function goalShot(ball: BallState, c: StrikeContext, kind: ShotKind, power: number): Flight {
  const R = GOAL_RULES, s = c.striker;
  // A blast from a shot or a beam goes where its thrower aimed, as every other strike does.
  const yaw = s.aimYaw;
  const enemy = s.team === 'red' ? 'blue' : 'red', gz = goalZ(enemy);
  // [speed, lift in degrees, side spin, top spin] by shot.
  const table: Record<string, [number, number, number, number]> = {
    tap: [13, 9, 0, 0], drive: [20, 10, 0, 0], power: [25, 11, 0, 0], volley: [22, -2, 0, 0], spike: [27, -22, 0, 0],
    curve: [24, 9, 15, 0], sinker: [25, 17, 0, 17], blast: [24, 6, 0, 0], header: [18, 6, 0, 0],
  };
  let vx: number, vy: number, vz: number, sx = 0, sy = 0, sz = 0;
  if (kind === 'pop' || kind === 'eruption') {
    const up = (kind === 'eruption' ? 17.5 : 15) * Math.min(1.25, Math.sqrt(power)), fwd = kind === 'eruption' ? 7 : 4.5;
    return {vx: Math.sin(yaw) * fwd, vy: up, vz: Math.cos(yaw) * fwd, sx: 0, sy: 0, sz: 0};
  }
  if (kind === 'super') {
    // The super shot goes for the frame wherever it was struck from: the far side of the mouth from the keeper's end, low.
    const tx = Math.max(-R.goalHalfWidth + 1.1, Math.min(R.goalHalfWidth - 1.1, ball.x + Math.sin(yaw) * Math.abs(gz - ball.z) * .35));
    const d = Math.hypot(tx - ball.x, gz - ball.z), speed = R.speedCap[4] * .96, t = Math.max(.25, d / speed);
    const v = arc(ball, tx, 1.6, gz, t, R.gravity, R.drag);
    return {...v, sx: 0, sy: 0, sz: 0};
  }
  const [base, lift, side, top] = table[kind] ?? table.tap;
  let speed = base * power + (kind === 'power' ? Math.min(6, c.knockback * .35) : 0);
  let dx = Math.sin(yaw), dz = Math.cos(yaw);
  // A tap toward a team-mate is a pass to where they are running.
  if (kind === 'tap' && c.mates?.length) {
    let best: {x: number; z: number; t: number} | undefined, bestCos = Math.cos(28 * DEG);
    for (const m of c.mates) {
      const ex = m.x - ball.x, ez = m.z - ball.z, d = Math.hypot(ex, ez);
      if (d < 3 || d > 26) continue;
      const cos = (ex * dx + ez * dz) / d;
      if (cos <= bestCos) continue;
      const t = d / (speed * .9);
      best = {x: m.x + m.vx * t * .8, z: m.z + m.vz * t * .8, t}; bestCos = cos;
    }
    if (best) {
      const d = Math.hypot(best.x - ball.x, best.z - ball.z), t = Math.max(.35, d / (speed * .9));
      const v = arc(ball, best.x, R.ballRadius + .4, best.z, t, R.gravity, R.drag);
      return {...v, sx: 0, sy: 0, sz: 0};
    }
  }
  // A shot whose line runs near the enemy frame is put on target: its line through the goal mouth (the corner it was
  // aimed at, kept), and a height under the bar when it gets there.
  const toward = Math.sign(gz - ball.z);
  // (A light string's drive is a shot of its own: only a committed blow is helped on target.)
  if (kind !== 'tap' && kind !== 'drive' && dz * toward > .2) {
    const t = (gz - ball.z) / dz, hitX = ball.x + dx * t, d = Math.abs(t);
    if (d < 34 && Math.abs(hitX) < R.goalHalfWidth + 3) {
      const tx = Math.max(-R.goalHalfWidth + .6, Math.min(R.goalHalfWidth - .6, hitX));
      const flat = Math.hypot(tx - ball.x, gz - ball.z);
      dx = (tx - ball.x) / flat; dz = (gz - ball.z) / flat;
      const time = Math.max(.2, flat / speed), aimY = kind === 'spike' ? 1 : kind === 'sinker' ? 1.4 : 2.1;
      const v = arc(ball, tx, aimY, gz, time, R.gravity, R.drag);
      // A curve still bends: aimed off the post it was, it swings back across.
      if (kind === 'curve') { const sign = s.lateral < -.2 ? -1 : 1; sy = sign * side * .55; const back = -sign * Math.min(3, flat * .07); v.vx += -dz * back / time; v.vz += dx * back / time; }
      if (kind === 'sinker') { sx = -dz * top * .5; sz = dx * top * .5; }
      return {vx: v.vx, vy: v.vy, vz: v.vz, sx, sy, sz};
    }
  }
  const elevation = lift * DEG, flatSpeed = speed * Math.cos(elevation);
  vx = dx * flatSpeed; vz = dz * flatSpeed; vy = speed * Math.sin(elevation);
  if (kind === 'spike' && ball.y < 1.2) vy = Math.max(vy, 2);
  if (side) { const sign = s.lateral < -.2 ? -1 : 1; sy = sign * side; }
  // Topspin: about the axis across the flight, so the flight dips.
  if (top) { sx = -dz * top; sz = dx * top; }
  return {vx, vy, vz, sx, sy, sz};
}

/** Sky Spike. A light keeps the ball on its side - a bump to the middle of the court, a set up at the net - until the
 *  third touch, which has to go over; anything heavier goes over at once: a spike if struck from the air, a drive or a
 *  lob from the floor, a bending shot, a super shot into the court's emptiest corner. */
function spikeShot(ball: BallState, c: StrikeContext, kind: ShotKind, power: number): Flight {
  const R = SPIKE_RULES, s = c.striker, own = s.team, sign = own === 'red' ? -1 : 1, g = R.gravity;
  const touches = c.touches ?? 1;
  const keep = !c.serve && touches < R.touches && (c.slot === 'light' || (kind === 'eruption' && touches < 2)) && kind !== 'spike';
  if (keep) {
    // First touch: up and toward the middle of this side. Second: a set at the net for a spiker to jump on.
    const set = touches >= 2;
    const tx = Math.max(-R.courtHalfX + 1.2, Math.min(R.courtHalfX - 1.2, set ? ball.x * .5 + Math.sin(s.aimYaw) * 2 : ball.x * .4));
    const tz = sign * (set ? 1.9 : 5.2), t = kind === 'eruption' ? 1.7 : set ? 1.15 : 1.2;
    const v = arc(ball, tx, set ? 4.3 : 2.6, tz, t, g, R.drag);
    // A set climbs to about 5 m and comes down onto the net at 4.3, where a jumping spiker meets it on the way up.
    return {...v, sx: 0, sy: 0, sz: 0, shot: kind === 'eruption' ? 'eruption' : set ? 'set' : 'bump'};
  }
  const yaw = s.aimYaw;
  const dx = Math.sin(yaw), dz = Math.cos(yaw);
  // The other side's court: [how far past the net it lands, flight time per metre, landing height].
  const deep = kind === 'spike' ? 4.8 : kind === 'serve' ? (c.slot === 'light' ? 8 : 7.4) : kind === 'volley' ? 7 : kind === 'super' ? 0 : 7.8;
  const speedOf: Record<string, number> = {spike: 22, serve: c.slot === 'light' ? 11 : 19, volley: 17, drive: 20, power: 21, curve: 19, sinker: 20, blast: 21, tap: 12, pop: 10, eruption: 11, super: 38};
  const intoFar = dz * -sign > .25;
  let tx: number, tz: number;
  if (kind === 'super') {
    // The emptiest point of the other court.
    let best = {x: 0, z: -sign * 5, d: -1};
    for (let ix = -2; ix <= 2; ix++) for (let iz = 1; iz <= 4; iz++) {
      const x = ix * (R.courtHalfX - 1) / 2, z = -sign * iz * (R.courtHalfZ - .8) / 4;
      const d = Math.min(...(c.rivals?.length ? c.rivals.map(r => Math.hypot(r.x - x, r.z - z)) : [9]));
      if (d > best.d) best = {x, z, d};
    }
    tx = best.x; tz = best.z;
  } else if (intoFar) {
    const reach = (Math.abs(ball.z) + deep) / Math.max(.25, Math.abs(dz));
    tx = Math.max(-R.courtHalfX + .7, Math.min(R.courtHalfX - .7, ball.x + dx * reach));
    tz = -sign * Math.max(1.2, Math.min(R.courtHalfZ - .7, deep + (kind === 'spike' ? 0 : -Math.abs(dx) * 1.5)));
  } else {
    // Aimed away from the other court: it flies the way it was aimed, and is probably out.
    tx = ball.x + dx * 9; tz = ball.z + dz * 9;
  }
  const speed = (speedOf[kind] ?? 18) * power;
  const flat = Math.hypot(tx - ball.x, tz - ball.z);
  let t = kind === 'serve' && c.slot === 'light' ? 1.55 : Math.max(.28, flat / speed);
  let v = arc(ball, tx, R.ballRadius, tz, t, g, R.drag);
  // It has to clear the net (a spike from too low becomes a tip that does): the slowest flight that does.
  if (intoFar || kind === 'super') {
    for (let tries = 0; tries < 24 && !clears(ball, v, g); tries++) { t *= 1.08; v = arc(ball, tx, R.ballRadius, tz, t, g, R.drag); }
  }
  let sx = 0, sy = 0, sz = 0;
  if (kind === 'curve') sy = (s.lateral < -.2 ? -1 : 1) * 6;
  if (kind === 'spike' || kind === 'sinker') { sx = -v.vz * .25; sz = v.vx * .25; }
  return {vx: v.vx, vy: v.vy, vz: v.vz, sx, sy, sz};
}

/** Whether a ball leaving `b` at `v` is over the net (with its radius and a hand's breadth) when it crosses it. */
function clears(b: Vec3, v: {vx: number; vy: number; vz: number}, g: number) {
  if (Math.abs(v.vz) < 1e-3 || Math.sign(-b.z) !== Math.sign(v.vz)) return true;
  const t = -b.z / v.vz, y = b.y + v.vy * t - .5 * g * t * t;
  return y > SPIKE_RULES.netHeight + SPIKE_RULES.ballRadius + .15;
}

export const tierOf = heatTier;
export const angleBetween = (a: number, b: number) => Math.abs(wrap(a - b));
