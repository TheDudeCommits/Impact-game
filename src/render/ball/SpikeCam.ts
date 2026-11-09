import * as THREE from 'three';
import {SPIKE_RULES, type BallTeam, type BallView} from '../../game/ball/model';
import type {Vec3} from '../../game/types';
import type {FollowCamera} from '../FollowCamera';

/** The broadcast stand, a steady camera that moves only on occasions: metres behind your own baseline and up, the point
 *  it looks at (on your side of the net, near the floor; `lookZ` is metres past the net), and the lens (vertical
 *  degrees). From here
 *  both courts, the net and a set's whole arc are in the frame, the near baseline at the bottom of it and the far one a
 *  little under the top; high enough that the net hides under five and a half metres of the far court (from 9.5 m up it
 *  hid nine of its ten and a half). */
const STAND = {back: 10, up: 13, lookZ: -2, lookY: .3, fov: 44};
/** It follows the play across only gently: the eye's want is this share of your fighter's x and of the ball's, never more
 *  than `most` off the middle; it moves only once the want is `dead` metres from where it is going, on a spring of
 *  `rate` (1/s, critically damped), at most `speed` m/s. The look turns a share (`look`) of the eye's drift back to the
 *  middle, so the court stays centred and the heading barely moves. */
const DRIFT = {self: .5, ball: .18, most: 3.2, dead: 1.1, rate: 1.7, speed: 2.6, look: .55};
/** A very high ball tilts the look up (this share of every metre over `from`), eased at `rate`. */
const LIFT = {from: 7.5, share: .4, most: 3, rate: 1.4};
/** The player's own turning (the mouse, the right stick) pans the view at most AWAY radians either way; it is theirs for
 *  HOLD seconds after they stop, then eases back at BACK a second. A jump bigger than RESET in one frame is a reset. */
const AWAY = .45, HOLD = 1, BACK = 1.6, RESET = .6;
/** The occasions it moves for, each a weight eased in and out (rates 1/s) with what it does at full weight:
 *  - SERVE: the walk-up, a step closer and lower; your own side's serve tilts the look back over the server behind your
 *    baseline. It eases back to the whole court as the serve flies.
 *  - SET: your side's set in the air, the look lifted toward where it will be struck, a step in.
 *  - POINT: the point's beat, the look drawn toward where the ball came down and the lens in and narrowed; `big` times
 *    further for a point won off a PERFECT SPIKE or a SUPER SHOT (the kill that has to read as the moment of the rally).
 *  - FOLLOW: after a PERFECT SPIKE or a SUPER SHOT, the look rides a share of the ball's flight down, until it lands or is
 *    dug or blocked. (Twenty PERFECT SPIKEs a match: kept small, or the view would never be still.) */
const SERVE = {in: 1.4, out: 1.6, push: 1.6, down: 1.1, look: -.25, back: 2.6};
const SET = {in: 1.8, out: 1.3, push: 1.2, lift: 1.1};
const POINT = {in: 1.7, out: 1.1, push: 3, toward: .38, fov: 5, big: 1.6};
const FOLLOW = {seconds: .9, share: .12, in: 6, out: 2};
/** A strike's punch (degrees off the lens, in at PUNCH_IN a second - a few frames, not a step - and back at PUNCH_BACK) and shake (trauma, falling at 2.6 a
 *  second; the noise is its square). A broadcast lens takes them far smaller than the fight's follow camera does. */
const PUNCH = {spike: 2.5, skySpike: 3.5, perfect: 5, super: 6, kill: 2, block: 2.5, dig: 1.5, dive: 2.5};
const SHAKE = {spike: .18, skySpike: .26, perfect: .42, super: .5, kill: .3, block: .25, dig: .14, dive: .24, noise: .022};
const PUNCH_BACK = 4.5, PUNCH_IN = 24;
/** An aspect much wider than a screen's (a couch split top and bottom): the stand moves back and the lens closes, so
 *  the court is not stretched across a fish-eye. Narrower (side by side): the lens opens a little. */
const WIDE_ASPECT = 2.2, NARROW_ASPECT = 1.3;
const clamp = THREE.MathUtils.clamp;
const wrapped = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const ease = (rate: number, dt: number) => 1 - Math.exp(-rate * dt);

/**
 * Sky Spike's camera. The ball cam (BallCam) turns the follow camera onto
 * the line from the ball through your fighter; in volleyball the ball crosses over you all the time, so that view swung
 * round constantly (measured over a rally: 31 degrees a second on average, 46 reversals a minute, its heading over 300
 * degrees of the compass). This is a broadcast camera instead: behind and above your own side, looking across the net
 * along the court, on one heading all match. It drifts with your fighter only gently (a dead zone, heavy damping, a
 * capped speed), and moves noticeably only on occasions - the serve, your side's set, a spike's punch, a point won.
 *
 * It stands in for the ball cam while that is on in Sky Spike (Tab, a couch seat's TARGET, still turns both off):
 * `steer` before the follow camera's update hands it the view's heading (the follow camera films 'free', so the
 * heading the page holds stays the view's), and `aim` after it places the lens, as the replay's and the ceremonies'
 * lenses do, and makes the follow camera's movement basis this view's heading - so the stick moves you up and across
 * this screen, and a strike aims where it looks (into the far court). One for the page's own view and one for a split
 * screen's second half (main.ts). Nothing here allocates in a frame.
 */
export class SpikeCam {
  /** Filming this frame. */
  active = false;
  /** The view's heading (radians, the simulation's yaw): the movement basis and the aim. */
  yaw = 0;
  private team: BallTeam = 'red';
  private match = NaN;
  private seen = 0;
  private handed = NaN;
  private away = 0;
  private still = 0;
  private x = 0; private vx = 0; private goalX = 0;
  private lift = 0;
  private serveW = 0; private setW = 0; private pointW = 0; private followW = 0; private followUntil = -Infinity;
  /** The rally's last strike was a PERFECT SPIKE or a SUPER SHOT (its point, if it wins one, is the big one). */
  private big = false; private pointBig = 1;
  private punch = 0; private punchGoal = 0; private trauma = 0; private age = 0;
  private placed = false;
  private readonly landed = new THREE.Vector3();
  private readonly eye = new THREE.Vector3();
  private readonly look = new THREE.Vector3();
  private fov = STAND.fov;

  reset() { this.active = false; this.match = NaN; this.seen = 0; this.forget(); }
  private forget() {
    this.handed = NaN; this.away = this.still = 0; this.vx = 0; this.lift = 0; this.placed = false;
    this.serveW = this.setW = this.pointW = this.followW = 0; this.followUntil = -Infinity; this.punch = this.punchGoal = this.trauma = 0;
  }

  /**
   * Before the follow camera's update: returns the heading to hand it. `yaw` is the heading the page holds now (the last
   * one handed back plus the player's own turn since), `handed` what the ball cam would have handed it (returned as it
   * is while this is not filming), `on` whether the ball cam is on. `self` is the player's drawn body, `ball` the drawn
   * ball, `aspect` the lens's.
   */
  steer(rig: FollowCamera, dt: number, yaw: number, handed: number, on: boolean, self: Vec3, ball: Vec3 | null, view: BallView | undefined, team: BallTeam | undefined, aspect: number): number {
    const playing = !!view && view.mode === 'sky-spike' && !!team && view.phase !== 'lobby' && view.phase !== 'over';
    this.active = on && playing;
    if (!this.active || !view || !team) { if (this.placed) this.forget(); return handed; }
    rig.mode = 'free'; rig.keepInView = null; rig.sportFov = 0;
    dt = clamp(Number.isFinite(dt) ? dt : 0, 0, .1);
    if (view.startedAt !== this.match || team !== this.team) { this.match = view.startedAt; this.team = team; this.seen = 0; this.forget(); }
    this.moments(view);
    const R = SPIKE_RULES, s = team === 'red' ? 1 : -1, b = ball ?? view.ball, wide = aspect > WIDE_ASPECT ? 1.3 : 1;
    // The player's own turn, in live play: a pan, held a moment, then eased back. (Each kickoff and serve the page turns
    // the heading it holds to the fighter's, put back on their mark (main.ts ballMark), which is no turn of the player's;
    // the frame drawn may still be the point's when it does, so nothing between points is read as one.)
    const turn = Number.isFinite(this.handed) && view.phase === 'live' ? wrapped(yaw - this.handed) : 0;
    if (Math.abs(turn) > RESET) { this.away = 0; this.still = 0; }
    else if (Math.abs(turn) > 1e-6) { this.away = clamp(this.away + turn, -AWAY, AWAY); this.still = 0; }
    else this.still += dt;
    if (this.still > HOLD) this.away *= Math.exp(-BACK * dt);
    // Across: a dead zone, then a damped spring at a capped speed.
    const ownBall = Math.sign(b.z) === -s || Math.abs(b.z) < 2 ? 1 : .5;
    const want = clamp(self.x * DRIFT.self + b.x * DRIFT.ball * ownBall, -DRIFT.most, DRIFT.most);
    if (!this.placed) { this.x = this.goalX = want; this.vx = 0; }
    else if (Math.abs(want - this.goalX) > DRIFT.dead) this.goalX = want - Math.sign(want - this.goalX) * DRIFT.dead;
    const w = DRIFT.rate;
    this.vx += (w * w * (this.goalX - this.x) - 2 * w * this.vx) * dt;
    this.vx = clamp(this.vx, -DRIFT.speed, DRIFT.speed);
    this.x += this.vx * dt;
    // A very high ball: the look tilts up after it.
    const lift = clamp((b.y - LIFT.from) * LIFT.share, 0, LIFT.most);
    this.lift += (lift - this.lift) * (this.placed ? ease(LIFT.rate, dt) : 1);
    // The occasions.
    const serving = view.phase === 'kickoff';
    const setUp = view.phase === 'live' && view.touchTeam === team && view.ball.shot === 'set' && Math.sign(b.z) === -s && view.ball.lastTeam === team;
    const pointGoal = view.phase === 'scored' ? 1 : 0;
    const follow = view.phase === 'live' && this.age < this.followUntil ? 1 : 0;
    this.serveW = this.weigh(this.serveW, serving ? 1 : 0, SERVE.in, SERVE.out, dt);
    this.setW = this.weigh(this.setW, setUp ? 1 : 0, SET.in, SET.out, dt);
    this.pointW = this.weigh(this.pointW, pointGoal, POINT.in, POINT.out, dt);
    if (this.pointW < .01) this.pointBig = 1;
    this.followW = this.weigh(this.followW, follow, FOLLOW.in, FOLLOW.out, dt);
    // The pose: the stand, then each occasion laid over it.
    const back = (R.courtHalfZ + STAND.back) * wide, up = STAND.up * wide;
    const eye = this.eye.set(this.x, up, -s * back), look = this.look.set(this.x * (1 - DRIFT.look), STAND.lookY + this.lift, s * STAND.lookZ);
    look.y += SERVE.look * this.serveW + SET.lift * this.setW;
    if (view.servingTeam === team) look.z -= s * SERVE.back * this.serveW;
    look.z -= s * SET.lift * .8 * this.setW;
    if (this.pointW > 0) { const k = Math.min(.9, POINT.toward * this.pointW * this.pointBig); look.x += (this.landed.x - look.x) * k; look.z += (this.landed.z - look.z) * k; look.y += (.4 - look.y) * k; }
    if (this.followW > 0) { const k = FOLLOW.share * this.followW; look.x += (b.x - look.x) * k; look.y += (b.y - look.y) * k; look.z += (b.z - look.z) * k; }
    // Pushed in along the view, and lowered for the walk-up.
    let dx = look.x - eye.x, dy = look.y - eye.y, dz = look.z - eye.z;
    const d = Math.hypot(dx, dy, dz) || 1, push = SERVE.push * this.serveW + SET.push * this.setW + POINT.push * this.pointW * this.pointBig;
    eye.x += dx / d * push; eye.y += dy / d * push - SERVE.down * this.serveW; eye.z += dz / d * push;
    // The player's pan: the look turned about the eye.
    dx = look.x - eye.x; dz = look.z - eye.z;
    const flat = Math.hypot(dx, dz), heading = Math.atan2(dx, dz) + this.away;
    look.x = eye.x + Math.sin(heading) * flat; look.z = eye.z + Math.cos(heading) * flat;
    this.yaw = heading;
    // The lens: the stand's, opened for a narrow half and closed for a wide one, narrowed for a point and a strike's punch.
    this.age += dt;
    this.punchGoal *= Math.exp(-PUNCH_BACK * dt);
    this.punch += (this.punchGoal - this.punch) * ease(this.punch < this.punchGoal ? PUNCH_IN : PUNCH_BACK * 2, dt);
    this.trauma = Math.max(0, this.trauma - 2.6 * dt);
    const base = aspect > WIDE_ASPECT ? STAND.fov - 12 : aspect < NARROW_ASPECT ? STAND.fov + 6 : STAND.fov;
    this.fov = base - POINT.fov * this.pointW * this.pointBig - this.punch;
    this.placed = true;
    this.handed = heading;
    return heading;
  }

  /** After the follow camera's update: the lens placed, and the follow camera's movement basis made this view's. `shake`
   *  is the player's SHAKE setting. */
  aim(rig: FollowCamera, lens: THREE.PerspectiveCamera, shake: number) {
    if (!this.active || !this.placed) return;
    lens.position.copy(this.eye); lens.up.set(0, 1, 0); lens.lookAt(this.look);
    const amount = this.trauma * this.trauma * SHAKE.noise * clamp(Number.isFinite(shake) ? shake * 2 : 0, 0, 2);
    if (amount > 1e-5) { lens.rotateX(Math.sin(this.age * 29) * amount); lens.rotateY(Math.sin(this.age * 23 + 1) * amount * .6); }
    lens.fov = this.fov; lens.updateProjectionMatrix(); lens.updateMatrixWorld();
    rig.movementYaw = this.yaw;
  }

  /** The eye and look this frame, for checks. */
  pose() { return {eye: this.eye, look: this.look, fov: this.fov, yaw: this.yaw}; }

  private weigh(w: number, goal: number, rateIn: number, rateOut: number, dt: number) {
    if (!this.placed) return goal;
    return w + (goal - w) * ease(goal > w ? rateIn : rateOut, dt);
  }

  /** The room's events, each once: a strike's punch and shake, where a point came down, a PERFECT SPIKE's follow. */
  private moments(view: BallView) {
    let newest = this.seen;
    for (const e of view.events) {
      if (e.id <= this.seen) continue;
      newest = Math.max(newest, e.id);
      if (!this.placed) continue; // (a page that joins late does not replay a backlog)
      switch (e.kind) {
        case 'strike':
          this.big = !!e.perfect;
          if (this.big) { this.hit(PUNCH.perfect, SHAKE.perfect); this.followUntil = this.age + FOLLOW.seconds; }
          else if (e.text === 'SKY SPIKE') this.hit(PUNCH.skySpike, SHAKE.skySpike);
          else if (e.shot === 'spike') this.hit(PUNCH.spike, SHAKE.spike);
          break;
        case 'super': this.big = true; this.hit(PUNCH.super, SHAKE.super); this.followUntil = this.age + FOLLOW.seconds; break;
        // (A block or a dig answers the big strike: the point, if one comes, is not its.)
        case 'block': case 'perfect': this.big = false; this.followUntil = -Infinity; this.hit(PUNCH.block, SHAKE.block); break;
        case 'dig': this.big = false; this.followUntil = -Infinity; if (e.text === 'DIVING DIG') this.hit(PUNCH.dive, SHAKE.dive); else this.hit(PUNCH.dig, SHAKE.dig); break;
        case 'kill': case 'ace': this.hit(PUNCH.kill * (this.big ? 2 : 1), SHAKE.kill * (this.big ? 1.6 : 1)); this.landed.set(e.x, 0, e.z); this.pointBig = this.big ? POINT.big : 1; this.big = false; break;
        case 'point': case 'out': case 'touches': case 'fault': this.landed.set(e.x, 0, e.z); break;
        default: break;
      }
    }
    this.seen = newest;
  }
  private hit(punch: number, trauma: number) { this.punchGoal = Math.max(this.punchGoal, punch); this.trauma = Math.max(this.trauma, trauma); }
}
