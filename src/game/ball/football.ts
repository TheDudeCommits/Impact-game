import {GOAL_RULES, type BallState, type BallTeam} from './model';
import {PLAYER_RADIUS} from '../moves';
import type {Vec3} from '../types';

/**
 * Goal Rush's SPORT mode: football played by the fighters - in the SPORT stance the buttons are the sport's, in the FIGHT
 * stance their usual fighting buttons. Behind `?football` in the address, in matches on this device only (LocalBall):
 * the online room never sets it, so nothing here is on its wire.
 *
 * Tab still switches the two stances: FIGHT is today's FIGHT stance, unchanged; SPORT replaces the BALL stance. In SPORT
 * no fighting move plays the ball. The match (BallMatch) takes the presses off the command before the combat kernel sees
 * them and plays the ball itself, so the body keeps its run through every touch and nothing it does takes the stick away:
 *
 * - **Possession first.** A body that meets a ball it can control (`controls`: low and slow enough against its own run)
 *   has it at its feet - the carry (BallMatch CARRY), at `pace` of its run and never let go with the stick. A pass coming
 *   in is taken the same way: the first touch is automatic. Sprinting (the boost) knocks it on ahead (`knock`) and back,
 *   looser: an opponent reaching it while it is out takes it. A carried ball is otherwise shielded: only an opponent
 *   meeting it from in front of the carrier (`front`) takes it off them (there is no TACKLE button in SPORT yet).
 * - **PASS** (the light): to the team-mate the stick points at (else the view), led into their run (`passTo`). A tap rolls
 *   along the floor; held `press.tap` s or more it is lofted to the same spot. Without the ball it is a call for it.
 * - **SHOOT** (the heavy): a tap is placed (`shot.tap` m/s); held, it winds up to `shot.full` over `shot.wind` s, the run
 *   slowed to `shot.slow` while the stick still steers. Aimed with the view, the stick across it bending the aim, and put
 *   inside the post when its line is near the frame (`shotAt`).
 * - A press made just before the ball arrives (`press.buffer`) plays it first time.
 */
export const FOOTBALL = {
  /** The ball: 0.6 m across (the classic ball is 1.6 m; a real one 0.22), as a share of the classic radius
   *  (BallState.size, which the physics and the page already scale by), floatier gravity gone (10.5 of 13) and the floor
   *  rolling it shorter (BallState.ground: 3 of 2.4). The page keeps its ground ring lit (BallField). (Started at 0.44 m:
   *  from the chase camera at 35 m it was 6.4 px tall at 1280 x 720 and 3.5 px on a phone at 844 x 390, which did not
   *  read at a glance on the phone; 0.3 m of radius is as large as it may be.) */
  radius: .3, gravity: 10.5, roll: 3,
  /** Control (`controls`): a ball whose centre is at most `low` m over its rest height, coming at the body no faster than
   *  `slow` m/s against the body's own run, or one up to `chest` m high no faster than `chestSlow`, rising or falling no
   *  faster than `lift`. Faster or higher balls bounce off the body as they always have: a block. */
  control: {low: .45, slow: 18, chest: 1.5, chestSlow: 10, lift: 5},
  /** A body controls (and an opponent takes) the ball this much further out than its bounds meet it: four bodies round a
   *  ball at rest stand off it by their own bounds, and none could reach it. */
  reach: .3,
  /** The side's keeper (today's keeper role, a bot, inside its own box: `box` m out from its line, `wide` m either side)
   *  gathers what it reaches: `reach` m out from its bounds, as fast as `slow` m/s (`chestSlow` up to `chest` m, its
   *  hands) - a shot it gets to is caught and is a save. */
  keeper: {reach: .3, slow: 19, chest: 2.6, chestSlow: 17, box: 6, wide: 7},
  /** Each side's keeper is a fourth body the game plays (`on`), stood `line` m off its line at the kickoff -
   *  three a side outfield, so a PASS always has two team-mates to choose from and no person keeps goal. */
  keeper4: {on: true, line: 1.2},
  /** The carry: the body runs at `pace` of its speed (the boost's too), the ball `gap` m in front of it, turned round it at
   *  up to `turn` rad/s toward the stick (`steer` of the stick or more). */
  pace: .94, gap: .12, turn: 12, steer: .3,
  /** Sprinting with it: every `every` s it is knocked `out` m on ahead along a half-sine and comes back to the feet; while it
   *  is more than `live` m out an opponent reaching it takes it. */
  knock: {every: .6, out: 1.5, live: .5},
  /** An opponent meeting a carried ball takes it when they come from within `front` radians of the carrier's heading,
   *  and not in the carrier's first `settle` s on it (a ball just taken is theirs a moment). */
  front: 50 * Math.PI / 180, settle: .35,
  /** A kicker lets its own ball go for `again` s; one who lost it to the other side, `lost` s. */
  again: .25, lost: .5,
  /** A press is kept `buffer` s for a ball still on its way (first time); a key let go inside `tap` s is a tap. A hold is
   *  played as the key comes up, or at `most` s. */
  press: {buffer: .3, tap: .2, most: 1.2},
  /** PASS: along the floor it arrives at `arrive` m/s plus `perM` a metre, never launched faster than `most`; lofted, it
   *  lands at the led spot after `loftT` s plus a metre's `loftPerM`. The team-mate nearest the stick's (or the view's)
   *  line within `cone` radians, `near`-`far` m off; nobody: a pass into space `space` m on. */
  pass: {arrive: 10, perM: .15, most: 24, loftT: .55, loftPerM: 1 / 18, cone: 45 * Math.PI / 180, near: 2.5, far: 32, space: 12, rounds: 3, wall: 1.2},
  /** SHOOT: a tap `tap` m/s; held, `tap` to `full` over `wind` s, the run at `slow` meanwhile. The stick across the view
   *  bends the aim up to `bend` rad. A line within `help` m of the frame and `reach` half-lengths of the goal is laid inside
   *  the post (`inset` m in from it), at `lowY` m (a tap) to `highY` (full), under the bar. The run adds `momentum` of
   *  itself along the aim, at most `runMost`. */
  shot: {tap: 26, full: 34, wind: .7, slow: .85, bend: .2, help: 2.5, reach: 1.25, inset: .15, lowY: .6, highY: 2.2, momentum: .5, runMost: 6.5},
  /** SPRINT is the boost (BALL_SPORT: 13.5 m/s on 42 of the bar a second, the bar 225): the bar comes back `refill`
   *  times as fast as a fighter's stamina does (STAMINA_REGEN 32 a second, so 48), so a two-second run (84 of it) is
   *  back in under two seconds and a full bar in under five. */
  sprint: {refill: 1.5},
  /** TACKLE (the guard's button): pressed with one of the other side carrying the ball, a standing POKE reaches
   *  `reach` m from the tackler's body to the ball for `live` s and wins it clean to the tackler's feet; pressed on the
   *  boost it is a SLIDE - `slide.reach` m, within `slide.cone` rad of the run, for `slide.live` s - that knocks the ball
   *  loose ahead at `slide.pop` m/s, and a slide that wins nothing leaves the slider down `slide.down` s. Again after
   *  `again` s. No fouls. (A short poke is a timing; the slide's reach costs the slider the next moment when it misses.) */
  tackle: {reach: 1.3, live: .15, again: .5, slide: {reach: 2.6, cone: 1.05, live: .35, pop: 6, down: .6},
    /** The contest (steals came too often - about 16 in 80 s of play): a POKE wins only from within `front` rad of
     *  the carrier's run - one who has turned the ball away from the tackler shields it, and the poke misses. A miss (a
     *  poke shielded or out of reach in its time, a slide that wins nothing) costs the tackler `missPace` of its run for
     *  `miss` s and no tackle again for `missAgain` s; the carrier who loses it takes one checked stride - `checkPace` for
     *  `check` s - and lets it go `lost` s. So a miss costs the tackler about four times what a win costs the carrier.
     *  A slide that misses: `slideMissPace` for `slideMiss` s (a stumble, never a knockdown: that is the FIGHT stance's). */
    front: 70 * Math.PI / 180, missPace: .55, miss: .5, missAgain: 1, checkPace: .6, check: .25, slideMissPace: .35, slideMiss: .6},
  /** The TRICK (the special's button, with the ball): the carrier jinks `jink` rad off its run; a TACKLE that lands inside
   *  `window` s of it misses and leaves the tackler BEATEN, unable to tackle again for `beaten` s (the REVERSAL's idea,
   *  in the sport's clothes). Again after `again` s. */
  trick: {window: .25, beaten: .4, again: 1.2, jink: 1.1},
  /** A person's PASS without the ball calls for it: their side's bots carrying it look for them first for `call` s. */
  call: 1.5,
} as const;

/** The classic ball's radius times this is SPORT's (BallState.size). */
export const FOOTBALL_SIZE = FOOTBALL.radius / GOAL_RULES.ballRadius;

/** Whether a body meeting the ball takes it under control (FOOTBALL.control): `rel` the ball's speed against the body's
 *  run, `r` the ball's radius. */
export function controls(b: BallState, r: number, rel: number, body: {grounded: boolean; alive: boolean; reeling: boolean; locked: boolean; stunned: boolean; y: number}, keeper = false) {
  const C = keeper ? {...FOOTBALL.control, ...FOOTBALL.keeper} : FOOTBALL.control, over = b.y - body.y - r;
  if (b.held || b.super || !body.alive || !body.grounded || body.reeling || body.locked || body.stunned || Math.abs(b.vy) > C.lift) return false;
  return over <= C.low ? rel <= C.slow : b.y - body.y <= C.chest && rel <= C.chestSlow;
}

/** Where a carried ball sits in SPORT: `gap` m in front of the body along `heading`, plus `ahead` m (a sprint's knock-on). */
export function footSpot(p: {x: number; z: number; size?: number}, heading: number, r: number, ahead = 0) {
  const d = PLAYER_RADIUS * (p.size ?? 1) + r + FOOTBALL.gap + ahead;
  return {x: p.x + Math.sin(heading) * d, y: r, z: p.z + Math.cos(heading) * d};
}
/** The knock-on's reach out ahead `t` s into a sprint (FOOTBALL.knock): a half-sine every `every` s. */
export const knockAhead = (t: number) => FOOTBALL.knock.out * Math.sin(Math.PI * ((t % FOOTBALL.knock.every) / FOOTBALL.knock.every));

export interface Mate { id: string; x: number; z: number; vx: number; vz: number }
/** The team-mate a PASS goes to from `from` along `yaw` (the stick's, else the view's): the one nearest that line within
 *  FOOTBALL.pass.cone, by angle first; undefined with nobody there. Shared by the match, the bots and the page's mark. */
export function passPick(from: {x: number; z: number}, yaw: number, mates: readonly Mate[]): Mate | undefined {
  const P = FOOTBALL.pass, ux = Math.sin(yaw), uz = Math.cos(yaw);
  let best: Mate | undefined, score = Infinity;
  for (const m of mates) {
    const ex = m.x - from.x, ez = m.z - from.z, d = Math.hypot(ex, ez);
    if (d < P.near || d > P.far) continue;
    const off = Math.acos(Math.max(-1, Math.min(1, (ex * ux + ez * uz) / d)));
    if (off > P.cone) continue;
    const s = off + d * .004;
    if (s < score) { score = s; best = m; }
  }
  return best;
}

/** The floor's slowing of a rolling ball (m/s a second) at a ground share (BallState.ground). */
const rollOf = (ground = 1) => GOAL_RULES.roll * ground;
/** How fast a pass along the floor leaves to cover `d` m, and how long it takes (FOOTBALL.pass). */
export function groundPass(d: number, ground = 1) {
  const P = FOOTBALL.pass, a = rollOf(ground), arrive = P.arrive + P.perM * d;
  const v0 = Math.min(P.most, Math.sqrt(arrive * arrive + 2 * a * d)), end = Math.sqrt(Math.max(0, v0 * v0 - 2 * a * d));
  return {v0, t: Math.max(.15, (v0 - end) / a)};
}
/** The ballistic velocity to land at a point after `t` s (strike.ts arc's, drag made up for roughly). */
export function arcTo(from: Vec3, toX: number, toY: number, toZ: number, t: number, g: number) {
  const k = 1 + GOAL_RULES.drag * t * .5;
  return {vx: (toX - from.x) / t * k, vy: ((toY - from.y) + .5 * g * t * t) / t, vz: (toZ - from.z) / t * k};
}

/** A PASS's flight (FOOTBALL.pass): to `mate` led into their run (their run carried on over the flight, worked out again
 *  `rounds` times, inside the walls by `wall` m), or into space along `yaw` with nobody. Lofted: the same spot, in the air.
 *  `g` the ball's gravity, `r` its radius, `ground` the floor's share (BallState.ground). */
export function passTo(ball: Vec3, yaw: number, mate: Mate | undefined, lofted: boolean, g: number, r: number, ground = 1) {
  const P = FOOTBALL.pass, inX = GOAL_RULES.halfX - P.wall, inZ = GOAL_RULES.halfZ - P.wall;
  let tx = mate ? mate.x : ball.x + Math.sin(yaw) * P.space, tz = mate ? mate.z : ball.z + Math.cos(yaw) * P.space;
  const time = (x: number, z: number) => { const d = Math.hypot(x - ball.x, z - ball.z); return lofted ? P.loftT + d * P.loftPerM : groundPass(d, ground).t; };
  if (mate) for (let i = 0; i < P.rounds; i++) { const t = time(tx, tz); tx = mate.x + mate.vx * t; tz = mate.z + mate.vz * t; }
  tx = Math.max(-inX, Math.min(inX, tx)); tz = Math.max(-inZ, Math.min(inZ, tz));
  const d = Math.hypot(tx - ball.x, tz - ball.z) || 1e-3;
  if (lofted) return {...arcTo(ball, tx, r + .3, tz, time(tx, tz), g), tx, tz};
  const v = groundPass(d, ground).v0;
  return {vx: (tx - ball.x) / d * v, vy: 0, vz: (tz - ball.z) / d * v, tx, tz};
}

/** A SHOT's flight (FOOTBALL.shot) at `charge` (0: a tap, 1: full), along `yaw` (the view, bent by the stick), with the
 *  striker's run (`run`) carried. Put inside the post when its line is near the frame. */
export function shotAt(ball: Vec3, yaw: number, charge: number, team: BallTeam, run: {vx: number; vz: number}, g: number, r: number) {
  const S = FOOTBALL.shot, R = GOAL_RULES, gz = team === 'red' ? R.halfZ : -R.halfZ;
  let dx = Math.sin(yaw), dz = Math.cos(yaw);
  const speed = S.tap + (S.full - S.tap) * charge + Math.max(0, Math.min(S.runMost, (run.vx * dx + run.vz * dz) * S.momentum));
  const toward = Math.sign(gz - ball.z);
  if (dz * toward > .2) {
    const t = (gz - ball.z) / dz, hitX = ball.x + dx * t;
    if (Math.abs(t) < R.halfZ * S.reach && Math.abs(hitX) < R.goalHalfWidth + S.help) {
      const inside = R.goalHalfWidth - r - S.inset, tx = Math.max(-inside, Math.min(inside, hitX)), flat = Math.hypot(tx - ball.x, gz - ball.z);
      const y = Math.min(R.goalHeight - r - .15, S.lowY + (S.highY - S.lowY) * charge);
      dx = (tx - ball.x) / flat; dz = (gz - ball.z) / flat;
      return {...arcTo(ball, tx, y, gz, Math.max(.2, flat / speed), g), speed};
    }
  }
  const lift = (5 + 4 * charge) * Math.PI / 180;
  return {vx: dx * speed * Math.cos(lift), vy: speed * Math.sin(lift), vz: dz * speed * Math.cos(lift), speed};
}

/** Whether nobody of `foes` stands within `clear` m of the line from `a` to `b` (its middle stretch): an open lane. */
export function laneOpen(a: {x: number; z: number}, b: {x: number; z: number}, foes: readonly {x: number; z: number}[], clear = 1.6) {
  const ex = b.x - a.x, ez = b.z - a.z, L2 = ex * ex + ez * ez || 1e-6;
  for (const f of foes) {
    const t = ((f.x - a.x) * ex + (f.z - a.z) * ez) / L2;
    if (t < .08 || t > .95) continue;
    if (Math.hypot(a.x + ex * t - f.x, a.z + ez * t - f.z) < clear) return false;
  }
  return true;
}
