import * as THREE from 'three';
import {GOAL_RULES, type BallTeam, type BallView} from '../../game/ball/model';
import type {Vec3} from '../../game/types';
import type {FollowCamera} from '../FollowCamera';

/** How fast the view comes round to the ball (per second, eased), and the most it turns in a second. */
const RATE = 5, MOST = 3.6;
/** The player's own turning is theirs while they turn and for HOLD seconds after; then it eases back at BACK a second.
 *  It reaches at most AWAY radians off the ball. */
const HOLD = .7, BACK = 2.4, AWAY = 1.3;
/** A jump in the heading the page hands back bigger than this in one frame is a reset (a kickoff's, a serve's), not a
 *  turn of the player's. */
const RESET = .6;
const wrapped = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = THREE.MathUtils.clamp;
const smooth = (x: number, a: number, b: number) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/**
 * The ball modes' default camera: the follow camera stood behind your fighter
 * on the line from the ball through you, so you and the ball share the frame, and tilted up after a ball in the air
 * (FollowCamera.keepInView). It eases off when the ball is very close or overhead - it holds its heading rather than
 * whip round - and in the third of the pitch you attack it turns a share of the way to the goal you attack, so the goal
 * is in the frame with the ball. Your own turning (the mouse, the right stick) is yours for a moment and then eases
 * back to the ball. Tab - a couch seat's TARGET button - turns it off for the follow camera you chose, and on again.
 *
 * One for the page's own view and one for a split screen's second half (main.ts). A replay's lens is the replay's
 * (BallReplay.aim, after this). Nothing here allocates.
 */
export class BallCam {
  /** On by default in a ball match. */
  on = true;
  /** Filming this frame. */
  active = false;
  private presses = 0;
  private yaw = NaN;
  private handed = NaN;
  private away = 0;
  private still = 0;
  private readonly look = new THREE.Vector3();

  reset() { this.on = true; this.active = false; this.presses = 0; this.forget(); }
  private forget() { this.yaw = this.handed = NaN; this.away = 0; this.still = 0; }
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
   * keeps while this is off. `self` is the player's drawn body, `ball` the drawn ball (null: none up).
   */
  steer(rig: FollowCamera, dt: number, yaw: number, mode: FollowCamera['mode'], self: Vec3, ball: Vec3 | null, view: BallView | undefined, team: BallTeam | undefined): number {
    const playing = !!view && !!ball && view.phase !== 'lobby' && view.phase !== 'over';
    this.active = this.on && playing;
    if (!this.active || !ball || !view) { rig.mode = mode; rig.keepInView = null; this.forget(); return yaw; }
    rig.mode = 'free';
    const turn = Number.isFinite(this.handed) ? wrapped(yaw - this.handed) : 0, reset = Math.abs(turn) > RESET;
    if (reset) { this.away = 0; this.still = 0; }
    else if (Math.abs(turn) > 1e-6) { this.away = clamp(this.away + turn, -AWAY, AWAY); this.still = 0; }
    else this.still += dt;
    if (this.still > HOLD) this.away *= Math.exp(-BACK * dt);
    const dx = ball.x - self.x, dz = ball.z - self.z, d = Math.hypot(dx, dz);
    let bearing = d > 1e-3 ? Math.atan2(dx, dz) : Number.isFinite(this.yaw) ? this.yaw : yaw;
    // The third of the pitch you attack: a share of the way round to the goal, while you are behind the ball and the
    // goal is not far off the line to it, so the ball and the goal are both in the frame.
    if (view.mode === 'goal-rush' && team) {
      const gz = team === 'red' ? GOAL_RULES.halfZ : -GOAL_RULES.halfZ, third = GOAL_RULES.halfZ / 3;
      const w = smooth(Math.sign(gz) * ball.z, third - 2, third + 3);
      if (w > 0 && Math.abs(gz - self.z) > Math.abs(gz - ball.z)) {
        const diff = wrapped(Math.atan2(-self.x, gz - self.z) - bearing);
        bearing += clamp(diff * .5, -.42, .42) * w * smooth(1.15 - Math.abs(diff), 0, .3);
      }
    }
    // Close by or overhead, the line to the ball swings about: the view holds its heading until it is clear again.
    const rise = Math.atan2(ball.y - self.y - 1.2, Math.max(d, .01));
    const pull = smooth(d, 2, 6) * (1 - smooth(rise, .85, 1.2));
    const goal = bearing + this.away;
    if (!Number.isFinite(this.yaw) || reset) this.yaw = goal;
    else {
      this.yaw += turn;
      const gap = wrapped(goal - this.yaw), step = gap * (1 - Math.exp(-RATE * pull * dt));
      this.yaw += clamp(step, -MOST * dt, MOST * dt);
    }
    this.yaw = wrapped(this.yaw); this.handed = this.yaw;
    rig.keepInView = this.look.set(ball.x, ball.y, ball.z);
    return this.yaw;
  }
}

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
