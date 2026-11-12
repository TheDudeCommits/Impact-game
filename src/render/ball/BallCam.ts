import * as THREE from 'three';
import {GOAL_RULES, type BallTeam, type BallView} from '../../game/ball/model';
import type {Vec3} from '../../game/types';
import type {FollowCamera} from '../FollowCamera';

/** How fast the view comes round to the ball (a critically damped spring's rate, a second), and the most it turns in a
 *  second. (A spring, where it was an eased step - that started every turn at full speed, so a ball changing
 *  direction kicked the view; the spring starts and stops a turn smoothly and never overshoots.) */
const RATE = 4.2, MOST = 3;
/** The FIGHT stance turns to the one locked this much quicker (a lock is a deliberate press: look at them now). */
const FIGHT_TURN = 1.6;
/** The player's own turning is theirs while they turn and for HOLD seconds after; then it eases back at BACK a second.
 *  It reaches at most AWAY radians off the ball. */
const HOLD = .7, BACK = 2.4, AWAY = 1.3;
/** A jump in the heading the page hands back bigger than this in one frame is a reset (a kickoff's, a serve's), not a
 *  turn of the player's. */
const RESET = .6;
/** A step of the drawn body farther than this (m) in one frame is a placement (a kickoff's, a serve's, a return from a
 *  wipe-out): the view comes round to the ball at once, as at a reset. (The page resets the heading when the newest
 *  snapshot holds the kickoff, a few frames before the bodies drawn are on their marks, or the view would turn from the
 *  old line to the ball for about half a second - half of the kickoff.) */
const PLACED = 4;
/** The sports lens: degrees the ball cam opens the follow camera's lens by (FollowCamera.sportFov), so more of the pitch
 *  is in view round the player and the ball and the floor reads the speed. */
const SPORT_FOV = 14;
const wrapped = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = THREE.MathUtils.clamp;
const smooth = (x: number, a: number, b: number) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/**
 * The ball modes' default camera: the follow camera stood behind your fighter
 * on the line from the ball through you, so you and the ball share the frame, and tilted up after a ball in the air
 * (FollowCamera.keepInView). It eases off when the ball is very close or overhead - it holds its heading rather than
 * whip round - and in the third of the pitch you attack it turns a share of the way to the goal you attack, so the goal
 * is in the frame with the ball. Your own turning (the mouse, the right stick) is yours for a moment and then eases
 * back to the ball. Tab - a couch seat's TARGET button - turns it off for the follow camera you chose, and on again
 * (Sky Spike and FREE PLAY; in Goal Rush Tab is the stance, game/ball/stance.ts, and this heading is the one Goal Rush's
 * own rig stands on, render/ball/BallChase.ts - on the opponent locked in the FIGHT stance).
 *
 * One for the page's own view and one for a split screen's second half (main.ts). A replay's lens is the replay's
 * (BallReplay.aim, after this). Nothing here allocates.
 */
export class BallCam {
  /** On by default in a ball match. */
  on = true;
  /** Filming this frame. */
  active = false;
  /** Goal Rush's SPORT mode (`?football`): FREE LOOK - the heading is the player's alone (the mouse, the right stick, a
   *  drag) and never eased back to the ball; off, BALL LOCK, the ball cam as it always was. (render/ball/footballPage.ts) */
  free = false;
  /** SPORT mode: the seat this lens films (whose carry makes BALL LOCK hold, `calm`). main.ts sets it. */
  selfId = '';
  /** SPORT's BALL LOCK: the drawn body's run, sprung (m/s along x and z), for the heading a carrier is held toward. */
  private runX = 0; private runZ = 0; private lastRunX = NaN; private lastRunZ = NaN;
  private presses = 0;
  private yaw = NaN;
  /** The heading's turning speed (radians a second): the spring's. */
  private rate = 0;
  /** Coming back on after a while off (Goal Rush's FIGHT stance let go, Tab): the view turns from where it is, not cut. */
  private resume = false;
  private handed = NaN;
  private away = 0;
  private still = 0;
  private readonly look = new THREE.Vector3();
  /** Where the drawn body was last frame (NaN: not yet). */
  private lastX = NaN; private lastZ = NaN;

  reset() { this.on = true; this.active = false; this.presses = 0; this.resume = false; this.forget(); }
  private forget() { this.yaw = this.handed = NaN; this.rate = 0; this.away = 0; this.still = 0; this.lastX = this.lastZ = NaN; }
  /** The toggle's press count (the page's Tab presses, a couch seat's TARGET presses): each press flips it. */
  pressed(count: number) {
    if (count === this.presses) return;
    // A count that went back is a new couch: on again, as a new match starts.
    if (count < this.presses) { this.presses = count; this.on = true; return; }
    if (Math.abs(count - this.presses) % 2 === 1) this.on = !this.on;
    this.presses = count;
  }

  /**
   * Sets `rig` up for this frame's update and returns the heading to hand it. `yaw` is the heading the page holds now
   * (the last one handed back, plus the player's own turn since); `mode` the camera the player chose, which the rig
   * keeps while this is off. `self` is the player's drawn body, `ball` the drawn ball (null: none up). `fighting`: Goal
   * Rush's FIGHT stance (game/ball/stance.ts): `ball` is then the opponent locked, whom the view follows the same way
   * (the share of the way round to the goal is the ball's alone).
   */
  steer(rig: FollowCamera, dt: number, yaw: number, mode: FollowCamera['mode'], self: Vec3, ball: Vec3 | null, view: BallView | undefined, team: BallTeam | undefined, fighting = false): number {
    const playing = !!view && !!ball && view.phase !== 'lobby' && view.phase !== 'over';
    this.active = this.on && playing;
    if (!this.active || !ball || !view) { rig.mode = mode; rig.keepInView = null; rig.sportFov = 0; if (Number.isFinite(this.yaw)) this.resume = true; this.forget(); return yaw; }
    rig.mode = 'free'; rig.sportFov = SPORT_FOV;
    const placed = Math.hypot(self.x - this.lastX, self.z - this.lastZ) > PLACED;
    this.lastX = self.x; this.lastZ = self.z;
    // (SPORT mode's BALL LOCK - `calm`: steadier than the classic ball cam's, which stays as it is without the flag.)
    if (view.football && !fighting && !this.free) return this.calm(rig, dt, yaw, self, ball, view, team, placed);
    // (FREE LOOK: the heading handed in, the player's, as it is; the lens no longer kept on the ball. Switched back to BALL
    // LOCK, the spring takes up from this heading - a turn, never a cut.)
    if (this.free && !fighting) { this.yaw = wrapped(yaw); this.handed = this.yaw; this.rate = 0; this.away = 0; this.still = 0; rig.keepInView = null; return this.yaw; }
    const turn = Number.isFinite(this.handed) ? wrapped(yaw - this.handed) : 0, reset = Math.abs(turn) > RESET || placed;
    if (reset) { this.away = 0; this.still = 0; }
    else if (Math.abs(turn) > 1e-6) { this.away = clamp(this.away + turn, -AWAY, AWAY); this.still = 0; }
    else this.still += dt;
    if (this.still > HOLD) this.away *= Math.exp(-BACK * dt);
    const dx = ball.x - self.x, dz = ball.z - self.z, d = Math.hypot(dx, dz);
    let bearing = d > 1e-3 ? Math.atan2(dx, dz) : Number.isFinite(this.yaw) ? this.yaw : yaw;
    // The third of the pitch you attack: a share of the way round to the goal, while you are behind the ball and the
    // goal is not far off the line to it, so the ball and the goal are both in the frame.
    if (view.mode === 'goal-rush' && team && !fighting) {
      const gz = team === 'red' ? GOAL_RULES.halfZ : -GOAL_RULES.halfZ, third = GOAL_RULES.halfZ / 3;
      const w = smooth(Math.sign(gz) * ball.z, third - 2, third + 3);
      if (w > 0 && Math.abs(gz - self.z) > Math.abs(gz - ball.z)) {
        const diff = wrapped(Math.atan2(-self.x, gz - self.z) - bearing);
        bearing += clamp(diff * .5, -.42, .42) * w * smooth(1.15 - Math.abs(diff), 0, .3);
      }
    }
    // Close by or overhead, the line to the ball swings about: the view holds its heading until it is clear again.
    const rise = Math.atan2(ball.y - self.y - 1.2, Math.max(d, .01));
    const pull = smooth(d, 2, 6.5) * (1 - smooth(rise, .85, 1.2));
    const goal = bearing + this.away;
    if (!Number.isFinite(this.yaw) || reset) { this.yaw = this.resume && !reset ? yaw : goal; this.rate = 0; this.resume = false; }
    else {
      this.yaw += turn;
      // The spring: its pull scaled by how clear the line to the ball is (a close or overhead ball holds the view), its
      // damping always whole, so a held view settles rather than drifts. Stepped in sixtieths for a hitch's sake.
      for (let left = dt; left > 1e-6;) {
        const h = Math.min(left, 1 / 60), gap = wrapped(goal - this.yaw), k = fighting ? RATE * FIGHT_TURN : RATE, most = fighting ? MOST * FIGHT_TURN : MOST;
        this.rate += (k * k * pull * gap - 2 * k * this.rate) * h;
        this.rate = clamp(this.rate, -most, most);
        this.yaw += this.rate * h; left -= h;
      }
    }
    this.yaw = wrapped(this.yaw); this.handed = this.yaw;
    rig.keepInView = this.look.set(ball.x, ball.y, ball.z);
    return this.yaw;
  }
  /** SPORT mode's BALL LOCK (CALM, below). */
  private calm(rig: FollowCamera, dt: number, yaw: number, self: Vec3, ball: Vec3, view: BallView, team: BallTeam | undefined, placed: boolean): number {
    const me = this;
    // (The body's run, from its drawn steps: placed, the run starts again.)
    if (Number.isFinite(me.lastRunX) && !placed && dt > 0) { const k = Math.min(1, dt * 8); me.runX += ((self.x - me.lastRunX) / dt - me.runX) * k; me.runZ += ((self.z - me.lastRunZ) / dt - me.runZ) * k; }
    else { me.runX = me.runZ = 0; }
    me.lastRunX = self.x; me.lastRunZ = self.z;
    const turn = Number.isFinite(me.handed) ? wrapped(yaw - me.handed) : 0, reset = Math.abs(turn) > RESET || placed;
    // (The player's own turn is taken as it is; for HOLD s after it the lens lets their view be, then eases in.)
    if (reset || Math.abs(turn) > 1e-6) me.still = 0; else me.still += dt;
    me.away = 0;
    const dx = ball.x - self.x, dz = ball.z - self.z, d = Math.hypot(dx, dz), bearing = d > 1e-3 ? Math.atan2(dx, dz) : Number.isFinite(me.yaw) ? me.yaw : yaw;
    const now = Number.isFinite(me.yaw) ? me.yaw : bearing, carrying = !!me.selfId && view.ball.carry === me.selfId;
    let goal = now, k: number = CALM.rate, most: number = CALM.most, pull = 1, fetching = false;
    if (carrying) {
      // Held toward the run, and a share of the way to the goal attacked.
      const speed = Math.hypot(me.runX, me.runZ), run = speed > CALM.run ? Math.atan2(me.runX, me.runZ) : now;
      const gz = team === 'blue' ? -GOAL_RULES.halfZ : GOAL_RULES.halfZ, toGoal = Math.atan2(-self.x, gz - self.z);
      goal = run + clamp(wrapped(toGoal - run) * CALM.goalShare, -CALM.goalMost, CALM.goalMost);
      k = CALM.carryRate; most = CALM.carryMost; pull = smooth(speed, 1, 4);
    } else {
      // (The ball's bearing as the lens sees it, from its stand CALM.boom m behind the body: a ball close beside the body
      // is well inside the frame, and swings the heading far less than it does off the body itself.)
      const lx = self.x - Math.sin(now) * CALM.boom, lz = self.z - Math.cos(now) * CALM.boom, gap = wrapped(Math.atan2(ball.x - lx, ball.z - lz) - now);
      if (Math.abs(gap) > CALM.dead) goal = now + gap - Math.sign(gap) * CALM.dead;
      // (A ball gone out of the frame - a long ball behind you - is fetched back quicker, so it is lost only briefly.)
      if (Math.abs(gap) > CALM.out) { most = CALM.fetch; k = CALM.rate * 1.3; fetching = true; }
      const rise = Math.atan2(ball.y - self.y - 1.2, Math.max(d, .01));
      pull = smooth(d, CALM.near - 1, CALM.near + 2) * (1 - smooth(rise, .85, 1.2));
    }
    pull *= reset ? 1 : smooth(me.still, HOLD, HOLD + .5);
    // (By a wall - CALM.wallFrom..wallTo m off the nearest - the heading turns slower and further behind
    // (CALM.wallRate, wallMost of itself), so a corner scramble's turns and the run's swerves along the glass do not
    // swing it. A ball gone out of the frame is fetched as fast as ever.)
    const G = GOAL_RULES, gap = Math.min(G.halfX - Math.abs(self.x), G.halfZ - Math.abs(self.z), (G.halfX + G.halfZ - G.corner - Math.abs(self.x) - Math.abs(self.z)) / Math.SQRT2);
    const walled = fetching ? 0 : 1 - smooth(gap, CALM.wallFrom, CALM.wallTo);
    k *= 1 - (1 - CALM.wallRate) * walled; most *= 1 - (1 - CALM.wallMost) * walled;
    if (!Number.isFinite(me.yaw) || reset) { me.yaw = me.resume && !reset ? yaw : bearing; me.rate = 0; me.resume = false; }
    else {
      me.yaw += turn;
      for (let left = dt; left > 1e-6;) {
        const h = Math.min(left, 1 / 60), g = wrapped(goal - me.yaw);
        me.rate += (k * k * pull * g - 2 * k * me.rate) * h;
        me.rate = clamp(me.rate, -most, most);
        me.yaw += me.rate * h; left -= h;
      }
    }
    me.yaw = wrapped(me.yaw); me.handed = me.yaw;
    rig.keepInView = me.look.set(ball.x, ball.y, ball.z);
    return me.yaw;
  }
}

/** SPORT mode's BALL LOCK, calm (a view that chased the ball swung to a new background every half second while a small
 *  fast ball was passed about nearby, and re-aimed W under the player's thumb):
 *  - with the ball at your feet the view does not chase it there: it holds, easing toward the way you run and a share of
 *    the way to the goal you attack (CALM.carry);
 *  - with it anywhere else the view follows it with a dead zone - no turn while it is within CALM.dead radians of the
 *    heading, well inside the frame - and only so far as to bring it back to that zone's edge; a ball gone out of the
 *    frame (CALM.out rad off) is fetched back at up to CALM.fetch rad/s;
 *  - every turn on a spring capped at CALM.most rad/s; a ball close by (CALM.near m) or overhead holds the view, as ever;
 *    the player's own turn is taken as it is, and for HOLD s after it the lens lets it be. */
const CALM = {boom: 8.4, dead: .36, rate: 2.6, most: .95, out: .62, fetch: 1.4, near: 3.2, carryRate: 2, carryMost: .9, goalShare: .35, goalMost: .35, run: 2,
  /** By a wall (the nearest `wallFrom`-`wallTo` m off) the spring's rate and its cap at these shares. */
  wallFrom: 2.5, wallTo: 6, wallRate: .6, wallMost: .6} as const;
/** Where the sun's shadow box centres in a ball match (main.ts, GameRenderer.shadowCentred): between the player and the
 *  ball, never more than SHADOW_REACH metres from the player, so the box (18 m either way) always holds them and holds
 *  the ball whenever it is near. Written into `out`. */
const SHADOW_REACH = 7;
export function ballShadowFocus(self: Vec3, ball: Vec3 | null, out: THREE.Vector3) {
  out.set(self.x, self.y, self.z);
  if (!ball) return out;
  const dx = (ball.x - self.x) * .5, dz = (ball.z - self.z) * .5, d = Math.hypot(dx, dz), k = d > SHADOW_REACH ? SHADOW_REACH / d : 1;
  return out.set(self.x + dx * k, self.y, self.z + dz * k);
}

/** A seat's side in the match, without a closure (main.ts asks it every frame). */
export function teamOf(view: BallView | undefined, id: string): BallTeam | undefined {
  if (!view) return undefined;
  for (let i = 0; i < view.seats.length; i++) if (view.seats[i].id === id) return view.seats[i].team;
  return undefined;
}
