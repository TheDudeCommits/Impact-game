import * as THREE from 'three';
import {GOAL_RULES, SPIKE_RULES, type BallModeId} from '../../game/ball/model';
import type {Vec3} from '../../game/types';
import {dampedVector} from '../dampedSpring';
import type {ChaseCamStyle} from './ballCamChoice';

/**
 * Goal Rush's ball cam as a rig of its own: an arcade sports chase camera, laid over the follow camera's frame after it
 * has run (as BallReplay.aim and BallCeremony.aim are), in the BALL stance only. The FIGHT stance is the fight's own
 * lock-on framing, and the two hand over to each other with a short blend, never a cut.
 *
 * - **Behind you, on the line from the ball through you.** The heading is BallCam's (its springs, the player's own look
 *   away, its hold when the ball is close or overhead); this rig stands on it, a boom back and a little up and over the
 *   right shoulder, so you and the ball share the frame and a ball at your feet is not hidden by your own back.
 * - **Critically damped everywhere.** The body the rig follows is sprung stiffly along the floor (no lag at a boost's
 *   speed, no snapshot jitter) and softly in height (a jump lifts the frame a little, it does not bob it); the boom's
 *   length, its height, the shoulder, the tilt and the lens are each a critically damped spring, so nothing ever starts
 *   or stops with a jerk and nothing overshoots.
 * - **Tilts up after high balls** as far as keeps your own chest in the frame: a lob climbs to the top of the frame and
 *   the view follows it up; at the top of a big one the ball may leave the frame (the HUD's edge arrow finds it) but you
 *   never do.
 * - **Pulls in and up as the ball comes close** (the strike, read from above), and **back out as it goes far** (more of
 *   the pitch to play into).
 * - **Kept inside the walls.** A boom that would pass a wall is shortened along its own line and lifted by what it lost,
 *   so the lens looks down on you over the boards instead of through them; it comes back out slowly.
 * - **The lens reads the speed**: it opens a few degrees on the boost and closes a touch on a strike (`impact`), with a
 *   short shake for the big moments (BallMoments hands each its weight).
 *
 * One for each half of a split screen. Nothing here allocates in a frame.
 */
/** The rig's numbers (metres, degrees, springs in radians a second). */
const RIG = {
  /** The boom behind the body, at rest, with the ball near (`near`) and far off (`far`). */
  boom: 6.4, boomNear: 5.6, boomFar: 7.4,
  /** The lens's height over the feet, at rest and with the ball near; and the height a metre of the ball's height adds. */
  height: 3.3, heightNear: 4, heightPerBall: .06, heightMost: 5,
  /** Over the right shoulder: metres to the side, at rest and with the ball at the feet. */
  shoulder: .55, shoulderNear: .95,
  /** The tilt at rest (down), the most it ever climbs after a high ball (up), and the margins kept: the ball under the
   *  top of the frame, the player's chest over the bottom (degrees). */
  pitch: -12, pitchMost: 13, topMargin: 7, chestMargin: 6,
  /** The pitch keeps this share of the frame's height at the bottom, measured to a point on the floor `floorAhead` metres
   *  out from the lens - the tilt never climbs past it (`floorKeepLoft` under a ball high over you, the lens stood well
   *  back: the floor beyond that point fills more of the frame). A high ball is framed by standing the lens back, up and
   *  opening it (`loft`), never by tilting into the roof; at the top of a big lob the ball may leave the frame for a
   *  moment (the landing sight and the edge arrow find it), the pitch, you and its fall never do. */
  floorKeep: .32, floorKeepLoft: .22, floorAhead: 16,
  /** A ball high over you, or about to be (`loft`, read off where its flight is going over the next `loftLead` s): the
   *  boom this much longer, the lens up to this height, the lens this much wider. (A lens dropped low and
   *  looking up frames the stands and the roof.) */
  loftBoom: 4.4, loftHeight: 5.4, loftFov: 12, loftLead: .7,
  /** The lens: at rest, opened on the boost, opened further at full pelt, closed by a strike's punch (most). */
  fov: 64, fovBoost: 6, fovSpeed: 3, punchMost: 4.5,
  /** The springs: the body along the floor and in height, the boom, the tilt, the lens. */
  follow: 22, rise: 5, riseFight: 8, boomRate: 4.5, pitchRate: 6, pitchUp: 10, fovRate: 5,
  /** A wall: how far inside it the lens keeps (a goal's mouth: inside its posts and under its bar by these), how short the
   *  boom may become, how much of what the walls take comes back as height (and the most), how fast the lens is moved in
   *  and comes back out; and the steepest the lens looks down (degrees). */
  wallGap: 1.1, wallLoose: .35, mouthGap: .7, mouthRamp: 2.4, settle: 16, glide: 12, barGap: .45, boomLeast: 3.4,
  /** The room behind wanted before the boom swings round (metres), and the swing's springs, in and back. */
  swingRoom: 4.6, swingIn: 4, swingOut: 1.6, wallLift: .3, wallLiftMost: 2.4, wallIn: 12, wallOut: 2.4, pitchLeast: -34,
  /** The hand-over to and from the follow camera's own shots (seconds). */
  blend: .42,
} as const;
/** The FIGHT stance's framing (game/ball/stance.ts): the same rig on the opponent locked instead of the ball - closer,
 *  lower and narrower, a fight's lock-on: the boom at rest and in close (melee), the height, the shoulder, the tilt and
 *  the lens. The two stances' springs carry the frame from one to the other. */
const FIGHT = {boom: 5.1, boomNear: 4.3, height: 2.35, heightNear: 2.75, shoulder: .8, shoulderNear: 1.05, pitch: -6, fov: 57} as const;
/** The CLOSE lens, an option beside the classic rig (ballCamChoice.ts; off unless the player picks it): in Goal
 *  Rush everyone but you is a speck. CLOSE is the same rig - the same boom, springs,
 *  walls and hand-overs - with the BALL stance's lens `fov` degrees narrower, stood `height` metres higher and tilted
 *  `pitch` degrees further down, so every body reads about a seventh larger (you a tenth), your own head stays where the
 *  classic frame has it and your feet stay over the stance badge under them. (Narrower or tilted further, the far goal's
 *  bar climbs into the banner's place under the score bug, ui/hud/ballHud.css: at nine degrees and four down it stood
 *  35 px inside the banner's foot at 1080p.) It gives the difference back, a share at a time, whenever the classic frame
 *  holds something the tighter one would lose:
 *  - a ball climbing over the frame's top (its elevation from the lens between `riseFrom` and `riseTo` degrees), and all
 *    of it under a lofted ball: the high-ball frame (back, up, wider) is the classic's own, to the degree;
 *  - a goal within `goalEdge` degrees of the tighter frame's side edge while the classic frame still holds it;
 *  - the ball within `ballEdge` degrees of the tighter frame's side or top edge while the classic frame still holds it
 *    (read off the frame on screen a moment ago).
 *  What it gives back it gives at once (`back`, a second) and takes again more slowly (`again`). Measured in bot play on
 *  the Ink Bowl against the classic lens on the same frames (77 s of live play): the ball out of the frame on 0.85% more
 *  frames (2.2% more without the ball's give-back, lost mostly over the top), the CLOSE lens on 52% of the way on
 *  average, bodies a median 1.055 times as tall (1.13 at the 90th percentile), and the lens's field of view travelling
 *  6.7 degrees a second to the classic's 4.6.
 *  The FIGHT stance's framing is not touched. */
const CLOSE = {fov: -7, height: .5, pitch: -2, riseFrom: 9, riseTo: 16, goalEdge: 5, ballEdge: 5, back: 12, again: 3} as const;
/** Goal Rush's SPORT stance (football, `ChaseFrame.football`): a chase camera that sat low and tilted up showed the pitch
 *  in the bottom third, stands in half the frame, cage posts and goal frames across the view, and swung between pitch,
 *  crowd and goal frame. Still behind the person's fighter (the chase camera, BALL LOCK / FREE LOOK on V), but stood higher
 *  and further back, tilted down, so the pitch fills the frame and the play ahead is seen:
 *  - the lens `boom` m back (`boomNear` with the ball at the feet, `boomLoft` more under a high ball) and `height` m up
 *    (`heightNear`, `heightLoft`), `shoulder` m over the right shoulder; its lens `fov` degrees tall (`fovLoft` wider
 *    under a high ball, `fovBoost` on a sprint);
 *  - the tilt puts the body's feet `body` of the way down from the frame's middle (NDC: in the lower third, clear of the
 *    control strip), but never so flat that the far boundary along the heading (the mean of `rays` rays `spread` rad
 *    apart) stands more than `far` up from the middle - the stands above it about a fifth of the frame or less, so near an
 *    end it tilts further down (the boundary `nearFrom` m off or less may stand up to `farNear`, by `nearTo` m `far` again:
 *    a wall run at is the play's edge) - never steeper than `least` nor flatter than `most` degrees; the ball under `top`
 *    (BALL LOCK keeps it in frame) and the head too, the feet never over `high` (unless backed into a corner) and over
 *    `feet` whatever else;
 *  - damped: the tilt is a spring (`pitchRate`) that never turns faster than `pitchSpeed` rad/s, the lens's place a
 *    spring capped as the classic rig's is (RIG.glide), and the heading BallCam's calm one;
 *  - the walls: no swing round you - the boom is shortened along its own line (to `boomLeast` at most) and the lens
 *    lifted by `wallLift` of what the walls took (at most `wallLiftMost` m), so in a corner or against the glass it
 *    pulls in and up and looks down on you; it never enters a goal's mouth (it stands over the bar's height). */
const FOOT = {boom: 8, boomNear: 7.4, boomLoft: 2.2, height: 8, heightNear: 7.4, heightLoft: 1.2, shoulder: .3, fov: 50, fovLoft: 8, fovBoost: 3,
  far: .58, farNear: .84, nearFrom: 12, nearTo: 26, rays: 3, spread: .28, least: -48, steep: -82, most: -17, body: -.4, high: -.1, feet: -.62, top: .78, pitchRate: 3.2, pitchSpeed: .55, boomLeast: 3.4, wallGap: 1.2, wallLift: .6, wallLiftMost: 3,
  /** So the side glass and the stands never fill a third of a corner's frame, the heading never swings, and a phone
   *  near a corner keeps the ball on screen: the tilt is judged on the whole frame - never flatter than leaves
   *  `stands` of it off the pitch's floor (the glass, the stands, the roof: a grid of `gridX` x `gridY` rays from the lens),
   *  the side walls' share as well as the far end's; and BALL LOCK keeps the ball `edge` of the frame's half-width inside
   *  its sides by opening the lens up to `edgeFov` degrees (springs `edgeIn` and `edgeOut` a second) - never by turning
   *  it (a turn to keep it in would swing the heading about thirteen times a minute). The tilt's cap (`pitchSpeed`) is lifted to
   *  `pitchCatch` while the body's feet would stand outside `feetLow`..`feetHigh` of the frame at the tilt held. */
  stands: .17, gridX: 9, gridY: 6, edge: .86, edgeFov: 10, edgeIn: 10, edgeOut: 1.5, feetLow: -.7, feetHigh: .55, pitchCatch: 3,
  /** A wall close ahead of the body (its boundary along the heading `aheadFrom`-`aheadTo` m off, all of it at the
   *  near end): the lens stands up to `aheadLift` m higher, may look down as steep as `aheadLeast` degrees, and the body
   *  may stand as high as `aheadHigh` up the frame (kept under the middle, the wall and the stands take the top half
   *  of a corner's frame): near a wall the play is round the body, seen from above. */
  aheadFrom: 3, aheadTo: 10, aheadLift: 1.4, aheadLeast: -68, aheadHigh: .45,
  /** By a wall (the nearest `nearWall`-`clearWall` m off): the lens slid toward the pitch's middle, square to the heading,
   *  by `sideShare` of how far off it the body is that way (at most `sideMost` m, all of it with `sideTo` m of room
   *  behind the body, none with `sideFrom`), closed `zoomWall` degrees, and the body
   *  let stand up to `wallHigh` of the way to `aheadHigh`. */
  nearWall: 2.5, clearWall: 7, sideShare: .45, sideMost: 4, sideFrom: 2.5, sideTo: 6, zoomWall: 8, wallHigh: .8,
  /** The frame's turn toward the look point when the lens is off the heading's line: a spring this fast (1/s). */
  viewRate: 2.2,
  /** The lens stands no higher over the body than `liftPer` times how far off it stands (along the floor), and `liftLeast`
   *  m at least (about 60 degrees down at most). */
  liftPer: 1.75, liftLeast: 6,
  /** BALL LOCK: the ball kept over `ballLow` of the frame's foot (tilting down for it), the feet no higher than `ballFeet`. */
  ballLow: .82, ballFeet: .7} as const;
const D2R = Math.PI / 180;
const wrapped = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
/** The swings tried, nearest first (radians either way from straight behind). */
const SWINGS = [.3, .55, .8, 1.05, 1.3, 1.57, 1.85] as const;
const clamp = THREE.MathUtils.clamp;
const smooth = (x: number, a: number, b: number) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/** One critically damped scalar spring (exact for a fixed target over the step, so a hitch never overshoots). */
class Spring {
  v = 0;
  constructor(public x = 0) {}
  to(target: number, rate: number, dt: number) {
    if (dt <= 0) return this.x;
    const decay = Math.exp(-rate * dt), off = this.x - target, drive = this.v + rate * off;
    this.x = target + (off + drive * dt) * decay; this.v = (this.v - rate * drive * dt) * decay;
    return this.x;
  }
  snap(x: number) { this.x = x; this.v = 0; }
}

export interface ChaseFrame {
  /** The drawn body's feet; the heading the rig stands on (BallCam's); the drawn ball (null: none up) - in the FIGHT
   *  stance (`fight`) the opponent locked instead. */
  self: THREE.Vector3; heading: number; ball: Vec3 | null; fight: boolean;
  mode: BallModeId;
  /** The body is boosting (the lens opens; how fast it runs is read off the rig's own follow). */
  boosting: boolean;
  /** The player's SHAKE setting (0-1). */
  shake: number;
  /** Goal Rush on the sport rules (BallView.football) - its SPORT stance filmed by the FOOT rig. */
  football?: boolean;
}

export class BallChase {
  /** Filming this frame (the BALL stance, a ball up, in play). */
  active = false;
  /** The heading the frame was laid along: the run's basis and the aim's, while active. */
  yaw = 0;
  /** Which lens the BALL stance is filmed with (ballCamChoice.ts): 'classic' unless the player picked
   *  CLOSE. main.ts sets it before `aim`; the springs carry the frame from one to the other. */
  style: ChaseCamStyle = 'classic';
  /** How much of the CLOSE lens is on this frame (0: the classic frame; for checks). */
  tight = 0;
  /** The CLOSE lens's own numbers, for checks. */
  static readonly CLOSE = CLOSE;
  private ready = false;
  private readonly body = new THREE.Vector3();
  private readonly bodyVel = new THREE.Vector3();
  private readonly boom = new Spring(RIG.boom);
  private readonly height = new Spring(RIG.height);
  private readonly shoulder = new Spring(RIG.shoulder);
  private readonly pitch = new Spring(RIG.pitch * D2R);
  private readonly fov = new Spring(RIG.fov);
  /** How far round the boom has swung from straight behind (radians): the walls'. */
  private readonly swing = new Spring(0);
  private readonly probe = new THREE.Vector3();
  /** The lens's place off the body, and its spring's speed (RIG.settle). */
  private readonly offset = new THREE.Vector3();
  private readonly offsetVel = new THREE.Vector3();
  private readonly lastOffset = new THREE.Vector3();
  /** What the walls move the lens by (metres, from where it would stand), and its spring's speed: fast in, slow out. */
  private readonly held = new THREE.Vector3();
  private readonly heldVel = new THREE.Vector3();
  private readonly free = new THREE.Vector3();
  private readonly goal = new THREE.Vector3();
  private punch = 0;
  private trauma = 0;
  private age = 0;
  /** The drawn ball's last place and its climb (m/s, sprung off the frames' steps): where its flight is going. */
  private readonly ballPrev = new THREE.Vector3();
  private ballVy = 0;
  private ballSeen = false;
  /** The hand-over: the pose on screen when the lens changed hands, and how far into the blend from it. */
  private readonly fromPos = new THREE.Vector3();
  private readonly fromQuat = new THREE.Quaternion();
  private fromFov = 64;
  private blendT = 1;
  private wasActive = false;
  /** The next take-over is laid outright (a match's start, a kickoff, a replay or a ceremony handing the view back). */
  private cutNext = true;
  /** This rig's last frame, for the blend when it lets go. */
  private readonly laidPos = new THREE.Vector3();
  private readonly laidQuat = new THREE.Quaternion();
  private laidFov = 64;
  private laid = false;
  private readonly want = new THREE.Vector3();
  private readonly euler = new THREE.Euler(0, 0, 0, 'YXZ');
  /** (The CLOSE lens's look at the ball through the last frame: ballAtEdge.) */
  private readonly seen = new THREE.Vector3();
  private readonly unseen = new THREE.Quaternion();
  private readonly quat = new THREE.Quaternion();

  /** A cut: the next frame is laid fresh (a kickoff, a replay or a ceremony handing the view back). */
  cut() { this.ready = false; this.blendT = 1; this.cutNext = true; this.laid = false; }
  /** A moment's weight (BallMoments, a strike, a tackle): a short shake and the lens closing a touch. `tier` 0-2. */
  impact(weight: number, _direction?: THREE.Vector3, tier: 0 | 1 | 2 = 0) {
    const w = clamp(Number.isFinite(weight) ? weight : 0, 0, 1);
    this.trauma = Math.min(.85, Math.max(this.trauma, w));
    if (tier > 0) this.punch = Math.max(this.punch, (tier > 1 ? 1 : .6) * w);
  }

  /**
   * Lays `camera` for this frame when `on` (the BALL stance, in play, a ball up), else leaves the follow camera's frame
   * as it is - blending from this rig's last pose into it for a moment after it lets go, and from the follow camera's
   * into this rig's as it takes over. Run after the follow camera's update, before the replay's and ceremonies' lenses.
   */
  aim(camera: THREE.PerspectiveCamera, dt: number, on: boolean, f: ChaseFrame | null) {
    this.age += dt;
    const take = on && !!f;
    if (take !== this.wasActive) {
      // Taking over: from the follow camera's frame on screen now (straight in after a cut). Letting go: from this rig's
      // own last frame, which the follow camera has already drawn over this frame.
      if (take) { this.fromPos.copy(camera.position); this.fromQuat.copy(camera.quaternion); this.fromFov = camera.fov; this.blendT = this.cutNext ? 1 : 0; }
      else { this.fromPos.copy(this.laidPos); this.fromQuat.copy(this.laidQuat); this.fromFov = this.laidFov; this.blendT = this.laid ? 0 : 1; }
      this.wasActive = take;
    }
    this.active = take;
    if (!take || !f) {
      if (this.blendT < 1) this.handOver(camera, dt);
      this.ready = false; this.laid = false;
      return;
    }
    this.lay(camera, dt, f);
    this.cutNext = false;
    if (this.blendT < 1) this.handOver(camera, dt);
    this.laidPos.copy(camera.position); this.laidQuat.copy(camera.quaternion); this.laidFov = camera.fov; this.laid = true;
  }

  private handOver(camera: THREE.PerspectiveCamera, dt: number) {
    this.blendT = Math.min(1, this.blendT + dt / RIG.blend);
    const t = this.blendT, k = t * t * (3 - 2 * t);
    camera.position.lerpVectors(this.fromPos, camera.position, k);
    camera.quaternion.slerpQuaternions(this.fromQuat, camera.quaternion, k);
    camera.fov = THREE.MathUtils.lerp(this.fromFov, camera.fov, k);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  }

  private lay(camera: THREE.PerspectiveCamera, dt: number, f: ChaseFrame) {
    if (f.football && !f.fight && f.mode === 'goal-rush') { this.layFoot(camera, dt, f); return; }
    const s = f.self, ball = f.ball, fresh = !this.ready;
    // The body the rig follows: stiff along the floor, soft in height.
    if (fresh) { this.body.set(s.x, s.y, s.z); this.bodyVel.set(0, 0, 0); }
    else {
      this.followAxis('x', s.x, RIG.follow, dt); this.followAxis('z', s.z, RIG.follow, dt);
      this.followAxis('y', Math.max(0, s.y), f.fight ? RIG.riseFight : RIG.rise, dt);
    }
    const b = this.body;
    // The ball's reach: how near it is along the floor, and how high.
    const dx = ball ? ball.x - b.x : 0, dz = ball ? ball.z - b.z : 0, d = ball ? Math.hypot(dx, dz) : 20, hb = ball ? Math.max(0, ball.y - 1) : 0;
    // The ball's climb, off the drawn ball's steps (sprung: a bounce is a turn, not a spike), and the height its flight
    // reaches over the next RIG.loftLead s: the lens starts standing back as a lob leaves the boot, not as it peaks.
    if (ball && this.ballSeen && dt > 0 && Math.abs(ball.y - this.ballPrev.y) < 3) this.ballVy += ((ball.y - this.ballPrev.y) / dt - this.ballVy) * Math.min(1, dt * 14);
    else this.ballVy = 0;
    if (ball) this.ballPrev.set(ball.x, ball.y, ball.z);
    this.ballSeen = !!ball;
    const g = GOAL_RULES.gravity, rise = Math.max(0, Math.min(this.ballVy / g, RIG.loftLead)), peak = ball ? ball.y + Math.max(0, this.ballVy * rise - .5 * g * rise * rise) : 0;
    // A ball high over you (a lob dropping, a clearance overhead, a cross): the lens stands back, rises a little and opens
    // so the ball's flight, you and the pitch share the frame (never low and looking up into the roof).
    const loft = ball && !f.fight && peak > 2.8 ? smooth(Math.atan2(peak - b.y - 1.2, Math.max(d, .5)), .3, .95) : 0;
    const near = ball ? (1 - smooth(d, 2.5, 9)) * (1 - loft) : 0, far = f.fight ? 0 : smooth(d, 12, 32);
    const boomWant = f.fight ? FIGHT.boom + (FIGHT.boomNear - FIGHT.boom) * near : RIG.boom + (RIG.boomNear - RIG.boom) * near + (RIG.boomFar - RIG.boom) * far + RIG.loftBoom * loft;
    // How much of the CLOSE lens this frame takes (none on the classic rig): all of it with the ball low and
    // nothing at the frame's edge, less as the ball climbs toward the frame's top or a goal or the ball nears its side,
    // none lofted. Given back at once and taken again slowly (CLOSE.back, CLOSE.again a second), so the lens does not
    // breathe in and out with every touch.
    const tightWant = this.style === 'close' && !f.fight ? (1 - loft) * (1 - this.climbing(ball, d, fresh)) * (1 - this.goalAtEdge(f, camera.aspect, fresh)) * (1 - this.ballAtEdge(ball, camera.aspect, fresh)) : 0;
    const eased = fresh || this.style !== 'close' ? tightWant : this.tight + (tightWant - this.tight) * (1 - Math.exp(-(tightWant < this.tight ? CLOSE.back : CLOSE.again) * dt));
    const tight = this.tight = Math.abs(eased - tightWant) < 1e-3 ? tightWant : eased;
    const stood = CLOSE.height * tight;
    const heightWant = f.fight ? FIGHT.height + (FIGHT.heightNear - FIGHT.height) * near
      : THREE.MathUtils.lerp(Math.min(RIG.heightMost + stood, RIG.height + stood + (RIG.heightNear - RIG.height) * near + RIG.heightPerBall * Math.min(hb, 14) * (1 - near)), RIG.loftHeight, loft);
    const shoulderWant = f.fight ? FIGHT.shoulder + (FIGHT.shoulderNear - FIGHT.shoulder) * near : RIG.shoulder + (RIG.shoulderNear - RIG.shoulder) * near;
    const fovWant = (f.fight ? FIGHT.fov : RIG.fov + CLOSE.fov * tight) + (f.boosting ? RIG.fovBoost : 0) + RIG.fovSpeed * smooth(Math.hypot(this.bodyVel.x, this.bodyVel.z), 9, 14) + RIG.loftFov * loft;
    // (A narrow frame - a split screen's half, a phone held upright - stands further back and less over the shoulder.)
    const narrow = clamp((1.5 - camera.aspect) / .7, 0, 1);
    if (fresh) { this.boom.snap(boomWant * (1 + .3 * narrow)); this.height.snap(heightWant); this.shoulder.snap(shoulderWant * (1 - .6 * narrow)); this.fov.snap(fovWant); this.held.set(0, 0, 0); this.heldVel.set(0, 0, 0); }
    const boom = this.boom.to(boomWant * (1 + .3 * narrow), RIG.boomRate, dt), height = this.height.to(heightWant, RIG.boomRate, dt), shoulder = this.shoulder.to(shoulderWant * (1 - .6 * narrow), RIG.boomRate, dt);
    // Where the lens would stand: back along the heading, up, and over the right shoulder.
    // Backed into a wall or a corner, the boom swings round you toward the open pitch (the nearest way with room, eased
    // there and slowly back), rather than climbing on top of you; the frame still looks along the heading.
    const head = f.heading, hx = Math.sin(head), hz = Math.cos(head);
    const swingWant = this.swingFor(f.mode, b.x + -hz * shoulder, b.z + hx * shoulder, head, b.y + height, Math.min(boom, RIG.swingRoom));
    if (fresh) this.swing.snap(swingWant);
    const yaw = head + this.swing.to(swingWant, Math.abs(swingWant) > Math.abs(this.swing.x) ? RIG.swingIn : RIG.swingOut, dt);
    const fx = Math.sin(yaw), fz = Math.cos(yaw), rx = -fz, rz = fx;
    const free = this.free.set(b.x - fx * boom + rx * shoulder, b.y + height, b.z - fz * boom + rz * shoulder);
    // The walls: the boom shortened along its own line (no shorter than RIG.boomLeast), whatever is left slid along the
    // wall, and the lens lifted by what the walls took - looking down on you over the boards. A keeper on the line has the
    // goal's mouth behind them: the lens stands in it, under the bar. Eased in fast and back out slowly.
    const ox = b.x + rx * shoulder, oz = b.z + rz * shoulder, room = this.room(f.mode, ox, oz, -fx, -fz, b.y + height, boom);
    const reach = Math.max(Math.min(boom, room), RIG.boomLeast), want = this.want.set(ox - fx * reach, b.y + height, oz - fz * reach);
    const slid = this.keepIn(f.mode, want), taken = boom - reach + slid;
    let wy = want.y + Math.min(taken * RIG.wallLift, RIG.wallLiftMost);
    if (f.mode === 'goal-rush' && Math.abs(want.z) > GOAL_RULES.halfZ - RIG.wallGap) wy = Math.min(wy, GOAL_RULES.goalHeight - RIG.barGap);
    const goal = this.goal.set(want.x - free.x, wy - free.y, want.z - free.z);
    if (fresh) this.held.copy(goal);
    else {
      const rate = goal.lengthSq() > this.held.lengthSq() ? RIG.wallIn : RIG.wallOut;
      for (const axis of ['x', 'y', 'z'] as const) {
        const decay = Math.exp(-rate * dt), off = this.held[axis] - goal[axis], drive = this.heldVel[axis] + rate * off;
        this.held[axis] = goal[axis] + (off + drive * dt) * decay; this.heldVel[axis] = (this.heldVel[axis] - rate * drive * dt) * decay;
      }
    }
    // The lens's place off the body, sprung once more as a whole (quick, so it never lags a run): whatever the walls did
    // to it in a frame - into a goal's mouth, along a board - is a glide, never a jump.
    // (The place it springs to is kept within the boards themselves - a goal's mouth whole, under its bar - and the glide
    // there within the stadium's; a glide may graze a goal's frame for a moment, never the stands.)
    const at = this.want.copy(free).add(this.held);
    this.inBounds(f.mode, at); at.sub(b);
    if (fresh) { this.offset.copy(at); this.offsetVel.set(0, 0, 0); }
    else {
      // (A glide is capped at RIG.glide m/s off the body: on the smaller goal a keeper at a post pushed the lens out
      // of the mouth across four metres in a few frames, a whip at 20 m/s. At twelve a turn of the heading comes round at two radians a second at most: calmer.)
      this.lastOffset.copy(this.offset);
      dampedVector(this.offset, this.offsetVel, at, RIG.settle, dt);
      const step = this.offset.distanceTo(this.lastOffset), most = RIG.glide * dt;
      if (step > most) { const k = most / step; this.offset.lerpVectors(this.lastOffset, this.offset, k); this.offsetVel.multiplyScalar(k); }
    }
    at.copy(b).add(this.offset);
    {
      const R = f.mode === 'goal-rush' ? GOAL_RULES : SPIKE_RULES, deep = R.halfZ + (f.mode === 'goal-rush' ? GOAL_RULES.goalDepth : 0) - .2;
      at.x = clamp(at.x, -R.halfX + .2, R.halfX - .2); at.z = clamp(at.z, -deep, deep); at.y = clamp(at.y, .8, R.ceiling - 1);
    }
    // The heading on screen: along the heading, turned to the play ahead when the walls moved the lens off its line.
    const lookX = b.x + hx * 9 - hz * shoulder, lookZ = b.z + hz * 9 + hx * shoulder, view = Math.atan2(lookX - at.x, lookZ - at.z);
    // The tilt: at rest a little down on the play ahead; up after a high ball as far as the chest stays in the frame and
    // the pitch keeps its share of the frame (RIG.floorKeep: the floor RIG.floorAhead out from the lens no higher than
    // that share from the bottom - on a frame's centre line, tan(angle off the axis) / tan(half the lens) up from the middle).
    const fovNow = this.fov.to(fovWant, RIG.fovRate, dt), half = fovNow * D2R / 2, lifted = Math.max(0, at.y - (b.y + height));
    const chest = Math.atan2(b.y + 1.15 - at.y, Math.max(.5, Math.hypot(b.x - at.x, b.z - at.z)));
    const floor = -Math.atan2(at.y, RIG.floorAhead) + Math.atan(Math.tan(half) * (1 - 2 * THREE.MathUtils.lerp(RIG.floorKeep, RIG.floorKeepLoft, loft)));
    const most = Math.min(RIG.pitchMost * D2R, f.fight ? Infinity : floor, chest + half - RIG.chestMargin * D2R);
    let pitchWant = (f.fight ? FIGHT.pitch : RIG.pitch + CLOSE.pitch * tight) * D2R - Math.atan2(lifted, 9) - (f.fight ? 0 : near * 4 * D2R);
    if (ball) {
      // (The opponent: their head kept under the top of the frame, as the ball is.)
      const up = Math.atan2(ball.y + (f.fight ? 1.7 : 0) - at.y, Math.max(.5, Math.hypot(ball.x - at.x, ball.z - at.z)));
      pitchWant = Math.max(pitchWant, up - (half - RIG.topMargin * D2R));
    }
    // (Your own head under the top of the frame too: a jump, an aerial, an air combo.)
    pitchWant = Math.max(pitchWant, Math.atan2(s.y + 1.9 - at.y, Math.max(.5, Math.hypot(s.x - at.x, s.z - at.z))) - (half - RIG.topMargin * D2R));
    pitchWant = Math.max(RIG.pitchLeast * D2R, Math.min(pitchWant, most));
    if (fresh) this.pitch.snap(pitchWant);
    // (Quicker up than down: a ball launched skyward is followed at once, a ball come down is let settle.)
    const pitch = this.pitch.to(pitchWant, pitchWant > this.pitch.x ? RIG.pitchUp : RIG.pitchRate, dt);
    // The moments: the lens closing a touch and a short shake (the player's SHAKE setting).
    this.punch = Math.max(0, this.punch - dt * 3.2);
    this.trauma = Math.max(0, this.trauma - dt * 2.6);
    const shake = this.trauma * this.trauma * clamp(f.shake, 0, 1) * .035;
    camera.position.copy(at);
    this.euler.set(pitch + Math.sin(this.age * 31) * shake, view + Math.PI + Math.sin(this.age * 23 + 1.7) * shake * .6, Math.sin(this.age * 27) * shake * .5);
    camera.quaternion.setFromEuler(this.euler);
    camera.fov = fovNow - RIG.punchMost * this.punch * this.punch;
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    this.yaw = view; this.ready = true;
  }

  /** The SPORT stance's frame (FOOT): behind the body, high, tilted down by the pitch ahead, damped. */
  private layFoot(camera: THREE.PerspectiveCamera, dt: number, f: ChaseFrame) {
    const s = f.self, ball = f.ball, fresh = !this.ready, G = GOAL_RULES;
    if (fresh) { this.body.set(s.x, s.y, s.z); this.bodyVel.set(0, 0, 0); }
    else { this.followAxis('x', s.x, RIG.follow, dt); this.followAxis('z', s.z, RIG.follow, dt); this.followAxis('y', Math.max(0, s.y), RIG.rise, dt); }
    const b = this.body;
    const dx = ball ? ball.x - b.x : 0, dz = ball ? ball.z - b.z : 0, d = ball ? Math.hypot(dx, dz) : 20;
    if (ball && this.ballSeen && dt > 0 && Math.abs(ball.y - this.ballPrev.y) < 3) this.ballVy += ((ball.y - this.ballPrev.y) / dt - this.ballVy) * Math.min(1, dt * 14);
    else this.ballVy = 0;
    if (ball) this.ballPrev.set(ball.x, ball.y, ball.z);
    this.ballSeen = !!ball;
    const g = G.gravity, rise = Math.max(0, Math.min(this.ballVy / g, RIG.loftLead)), peak = ball ? ball.y + Math.max(0, this.ballVy * rise - .5 * g * rise * rise) : 0;
    const loft = ball && peak > 3.2 ? smooth(Math.atan2(peak - b.y - 1.2, Math.max(d, .5)), .25, .8) : 0;
    const near = ball ? (1 - smooth(d, 2.5, 9)) * (1 - loft) : 0;
    const narrow = clamp((1.5 - camera.aspect) / .7, 0, 1);
    const boomWant = (FOOT.boom + (FOOT.boomNear - FOOT.boom) * near + FOOT.boomLoft * loft) * (1 + .25 * narrow);
    // (A wall close ahead - FOOT.aheadFrom..aheadTo - lifts the lens, and lets it look down further.)
    const ahead = 1 - smooth(this.boundary(b.x, b.z, f.heading), FOOT.aheadFrom, FOOT.aheadTo);
    const heightWant = FOOT.height + (FOOT.heightNear - FOOT.height) * near + FOOT.heightLoft * loft + FOOT.aheadLift * ahead;
    // (By a wall - FOOT.nearWall..clearWall m off the nearest - the lens slides across toward the pitch's
    // middle, square to the heading, the look with it (no turn), up to FOOT.sideMost m; and it closes by FOOT.zoomWall
    // degrees: less of the glass and the stands, more of the scramble round the body.)
    const G2 = GOAL_RULES, wallGap = Math.min(G2.halfX - Math.abs(b.x), G2.halfZ - Math.abs(b.z), (G2.halfX + G2.halfZ - G2.corner - Math.abs(b.x) - Math.abs(b.z)) / Math.SQRT2);
    const byWall = 1 - smooth(wallGap, FOOT.nearWall, FOOT.clearWall), across = -b.x * -Math.cos(f.heading) + -b.z * Math.sin(f.heading);
    // (Only with room behind the body - FOOT.sideFrom..sideTo m: backed into a corner, a slide would put it off the frame's side.)
    const sideMost = FOOT.sideMost * smooth(this.roomFoot(b.x, b.z, -Math.sin(f.heading), -Math.cos(f.heading), FOOT.boom), FOOT.sideFrom, FOOT.sideTo);
    const shoulderWant = FOOT.shoulder * (1 - .6 * narrow) + clamp(across * FOOT.sideShare, -sideMost, sideMost) * byWall;
    const fovWant = FOOT.fov + FOOT.fovLoft * loft + (f.boosting ? FOOT.fovBoost : 0) + 6 * narrow - FOOT.zoomWall * byWall;
    if (fresh) { this.boom.snap(boomWant); this.height.snap(heightWant); this.shoulder.snap(shoulderWant); this.fov.snap(fovWant); this.swing.snap(0); this.held.set(0, 0, 0); this.heldVel.set(0, 0, 0); }
    const boom = this.boom.to(boomWant, RIG.boomRate, dt), height = this.height.to(heightWant, RIG.boomRate, dt), shoulder = this.shoulder.to(shoulderWant, RIG.boomRate, dt);
    // (No swing round the body: the walls shorten and lift the boom instead. A swing left by the classic rig eases out.)
    const head = f.heading + this.swing.to(0, RIG.swingOut, dt), hx = Math.sin(head), hz = Math.cos(head), rx = -hz, rz = hx;
    const free = this.free.set(b.x - hx * boom + rx * shoulder, b.y + height, b.z - hz * boom + rz * shoulder);
    const ox = b.x + rx * shoulder, oz = b.z + rz * shoulder, room = this.roomFoot(ox, oz, -hx, -hz, boom);
    const reach = Math.max(Math.min(boom, room), FOOT.boomLeast), want = this.want.set(ox - hx * reach, b.y + height, oz - hz * reach);
    const slid = this.keepFoot(want), taken = boom - reach + slid;
    want.y += Math.min(taken * FOOT.wallLift, FOOT.wallLiftMost);
    const goal = this.goal.set(want.x - free.x, want.y - free.y, want.z - free.z);
    if (fresh) this.held.copy(goal);
    else {
      const rate = goal.lengthSq() > this.held.lengthSq() ? RIG.wallIn : RIG.wallOut;
      for (const axis of ['x', 'y', 'z'] as const) {
        const decay = Math.exp(-rate * dt), off = this.held[axis] - goal[axis], drive = this.heldVel[axis] + rate * off;
        this.held[axis] = goal[axis] + (off + drive * dt) * decay; this.heldVel[axis] = (this.heldVel[axis] - rate * drive * dt) * decay;
      }
    }
    const at = this.want.copy(free).add(this.held);
    this.keepFoot(at, RIG.wallLoose); at.sub(b);
    if (fresh) { this.offset.copy(at); this.offsetVel.set(0, 0, 0); }
    else {
      this.lastOffset.copy(this.offset);
      dampedVector(this.offset, this.offsetVel, at, RIG.settle, dt);
      const step = this.offset.distanceTo(this.lastOffset), most = RIG.glide * dt;
      if (step > most) { const k = most / step; this.offset.lerpVectors(this.lastOffset, this.offset, k); this.offsetVel.multiplyScalar(k); }
    }
    at.copy(b).add(this.offset);
    at.x = clamp(at.x, -G.halfX + .2, G.halfX - .2); at.z = clamp(at.z, -G.halfZ + .2, G.halfZ - .2); at.y = clamp(at.y, 1.5, G.ceiling - 1);
    // (Never so high over a body it stands close to that it looks down more steeply than FOOT.liftPer allows - backed
    // into a corner, a lens 2 m off and 10 m up would have the body under the frame's foot.)
    at.y = Math.min(at.y, b.y + Math.max(FOOT.liftLeast, Math.hypot(at.x - b.x, at.z - b.z) * FOOT.liftPer));
    // The heading on screen: along the heading, turned to the play ahead when the walls moved the lens off its line.
    const lookX = b.x + hx * 9 - hz * shoulder, lookZ = b.z + hz * 9 + hx * shoulder;
    // (The turn toward the look point - the lens moved off the heading's line by the walls or slid across by them - is
    // sprung on its own, slowly (FOOT.viewRate): else the lens's lag behind a quick slide swings the frame one way and
    // back.)
    const off = wrapped(Math.atan2(lookX - at.x, lookZ - at.z) - head);
    if (fresh) this.viewOff.snap(off); else this.viewOff.to(off, FOOT.viewRate, dt);
    const view = wrapped(head + this.viewOff.x);
    // (BALL LOCK: the ball kept inside the frame's sides - FOOT.edge of its half-width - from where the lens stands now,
    // not from the boom's full length: a lens the walls pull in would have a ball beside the body off its edge.
    // The lens opens for it, up to FOOT.edgeFov degrees, rather than turning: no swing.)
    let open = 0;
    if (ball && !this.footFree) {
      const off = Math.abs(wrapped(Math.atan2(ball.x - at.x, ball.z - at.z) - view));
      if (off < 1.3) { const need = 2 * Math.atan(Math.tan(off) / (camera.aspect * FOOT.edge)) / D2R; open = clamp(need - fovWant, 0, FOOT.edgeFov); }
    }
    if (fresh) this.edgeOpen = open; else this.edgeOpen += (open - this.edgeOpen) * (1 - Math.exp(-(open > this.edgeOpen ? FOOT.edgeIn : FOOT.edgeOut) * dt));
    const fovNow = this.fov.to(fovWant + this.edgeOpen, RIG.fovRate * 2, dt), half = fovNow * D2R / 2, t = Math.tan(half);
    // The tilt: the far boundary along the view `far` up the frame (the mean of a few rays), then the feet over the foot
    // of the frame, the ball and the head under its top.
    let reachFar = 0;
    for (let i = 0; i < FOOT.rays; i++) reachFar += this.boundary(at.x, at.z, view + (i - (FOOT.rays - 1) / 2) * FOOT.spread);
    reachFar = clamp(reachFar / FOOT.rays, 6, 60);
    // (The body's feet at FOOT.body up the frame; never so flat that the stands take more than the far rule leaves them.)
    const elev = (x: number, y: number, z: number) => Math.atan2(y - at.y, Math.max(.15, Math.hypot(x - at.x, z - at.z))), feet = elev(b.x, b.y, b.z);
    // (A boundary close ahead - a wall the body runs at - is the play's edge: more of it may stand in the frame, rather than
    // the empty grass behind the body.)
    const farUp = FOOT.far + (FOOT.farNear - FOOT.far) * (1 - smooth(reachFar, FOOT.nearFrom, FOOT.nearTo));
    // (And never flatter than leaves FOOT.stands of the whole frame off the floor - the side glass in a
    // corner or along a wall counted as well as the far end's.)
    let pitchWant = Math.min(feet - Math.atan(FOOT.body * t), -Math.atan2(at.y, reachFar) - Math.atan(farUp * t), this.standsPitch(at, view, t, camera.aspect));
    pitchWant = clamp(pitchWant, THREE.MathUtils.lerp(FOOT.least, FOOT.aheadLeast, ahead) * D2R, FOOT.most * D2R);
    if (ball) pitchWant = Math.max(pitchWant, elev(ball.x, ball.y, ball.z) - Math.atan(FOOT.top * t));
    pitchWant = Math.max(pitchWant, elev(s.x, s.y + 1.9, s.z) - Math.atan(FOOT.top * t));
    pitchWant = Math.min(pitchWant, feet - Math.atan(FOOT.feet * t));
    // (Backed into a corner the lens may stand little behind the body: it looks further down onto it, as steep as `steep`.)
    const behind = (b.x - at.x) * hx + (b.z - at.z) * hz, cornered = smooth(2.5 - behind, 0, 2.5), least = THREE.MathUtils.lerp(THREE.MathUtils.lerp(FOOT.least, FOOT.aheadLeast, ahead), FOOT.steep, cornered) * D2R;
    // (Never so steep that the body climbs over the frame's middle - `high`: near an end the wall and the goal take the
    // top of the frame rather than the body going up into it - but when backed into a corner.)
    if (cornered < 1) pitchWant = Math.max(pitchWant, feet - Math.atan((FOOT.high + (FOOT.aheadHigh - FOOT.high) * Math.max(ahead, byWall * FOOT.wallHigh)) * t) - cornered * .6);
    pitchWant = clamp(pitchWant, least, (FOOT.most + 14) * D2R);
    // (And the feet in the frame whatever the clamp - a lens the walls lifted and pulled in looks down
    // further than `least` rather than lose the body off the frame's foot.)
    pitchWant = Math.max(FOOT.steep * D2R, Math.min(pitchWant, feet - Math.atan(FOOT.feet * t)));
    // (BALL LOCK: a ball run in behind the body, between it and the lens, over the frame's foot - tilted down for it, as
    // far as keeps the feet under FOOT.ballFeet of the frame: the high lens's foot is 4 m in front of it, and a carrier
    // run past the body would leave the frame there.)
    if (ball) pitchWant = Math.max(FOOT.steep * D2R, Math.min(pitchWant, Math.max(elev(ball.x, ball.y, ball.z) + Math.atan(FOOT.ballLow * t), feet - Math.atan(FOOT.ballFeet * t))));
    if (fresh) this.pitch.snap(pitchWant);
    // (The cap is lifted while the body's feet would stand outside FOOT.feetLow..feetHigh of the frame at the tilt held
    // now - the walls pull the lens in and up faster than 0.55 rad/s turns it, and the body would slide off the frame's
    // foot for most of a second.)
    const heldY = Math.tan(feet - this.pitch.x) / t, ballY = ball ? Math.tan(elev(ball.x, ball.y, ball.z) - this.pitch.x) / t : 0;
    const out = heldY < FOOT.feetLow || heldY > FOOT.feetHigh || ballY < -FOOT.ballLow - .1;
    const was = this.pitch.x, next = this.pitch.to(pitchWant, out ? FOOT.pitchRate * 3 : FOOT.pitchRate, dt), cap = (out ? FOOT.pitchCatch : FOOT.pitchSpeed) * dt;
    if (!fresh && Math.abs(next - was) > cap) { this.pitch.x = was + Math.sign(next - was) * cap; this.pitch.v = Math.sign(next - was) * FOOT.pitchSpeed; }
    const pitch = this.pitch.x;
    this.punch = Math.max(0, this.punch - dt * 3.2);
    this.trauma = Math.max(0, this.trauma - dt * 2.6);
    const shake = this.trauma * this.trauma * clamp(f.shake, 0, 1) * .025;
    camera.position.copy(at);
    this.euler.set(pitch + Math.sin(this.age * 31) * shake, view + Math.PI + Math.sin(this.age * 23 + 1.7) * shake * .6, Math.sin(this.age * 27) * shake * .5);
    camera.quaternion.setFromEuler(this.euler);
    camera.fov = fovNow - RIG.punchMost * .5 * this.punch * this.punch;
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    this.yaw = view; this.ready = true; this.tight = 0;
  }
  /** BALL LOCK: how far the lens is opened to keep the ball inside the frame's sides (degrees). */
  private edgeOpen = 0;
  /** The frame's turn off the heading toward the look point (rad), sprung (FOOT.viewRate). */
  private readonly viewOff = new Spring(0);
  /** FREE LOOK - the frame never turns to the ball by itself (main.ts sets it with BallCam.free). */
  footFree = false;
  /** The share of the frame (a FOOT.gridX x FOOT.gridY grid of rays from the lens at `at`, along `view`,
   *  tilted `pitch`) that does not land on the pitch's floor - inside its walls, or a goal's mouth. */
  private standsAt(at: THREE.Vector3, view: number, pitch: number, t: number, aspect: number) {
    const G = GOAL_RULES, a = view + Math.PI, ca = Math.cos(a), sa = Math.sin(a), cp = Math.cos(pitch), sp = Math.sin(pitch), tx = t * aspect;
    let miss = 0;
    for (let i = 0; i < FOOT.gridX; i++) for (let j = 0; j < FOOT.gridY; j++) {
      const u = ((i + .5) / FOOT.gridX * 2 - 1) * tx, v = ((j + .5) / FOOT.gridY * 2 - 1) * t;
      const y = v * cp + sp, z = v * sp - cp;
      if (y >= -1e-4) { miss++; continue; }
      const k = at.y / -y, x = at.x + (u * ca + z * sa) * k, w = at.z + (-u * sa + z * ca) * k, ax = Math.abs(x), az = Math.abs(w);
      const on = (ax <= G.halfX && az <= G.halfZ && ax + az <= G.halfX + G.halfZ - G.corner) || (ax <= G.goalHalfWidth && az <= G.halfZ + G.goalDepth);
      if (!on) miss++;
    }
    return miss / (FOOT.gridX * FOOT.gridY);
  }
  /** The flattest tilt (between FOOT.steep and FOOT.most degrees) that leaves no more than FOOT.stands of the
   *  frame off the floor (standsAt), found by halving. */
  private standsPitch(at: THREE.Vector3, view: number, t: number, aspect: number) {
    let lo = FOOT.steep * D2R, hi = FOOT.most * D2R;
    if (this.standsAt(at, view, hi, t, aspect) <= FOOT.stands) return hi;
    if (this.standsAt(at, view, lo, t, aspect) > FOOT.stands) return lo;
    for (let i = 0; i < 8; i++) { const mid = (lo + hi) / 2; if (this.standsAt(at, view, mid, t, aspect) <= FOOT.stands) lo = mid; else hi = mid; }
    return lo;
  }
  /** How far from (x, z) along `yaw` the pitch's boundary is (its walls and chamfered corners; m). */
  private boundary(x: number, z: number, yaw: number) {
    const G = GOAL_RULES, ux = Math.sin(yaw), uz = Math.cos(yaw);
    let best = Infinity;
    if (Math.abs(ux) > 1e-4) best = Math.min(best, (Math.sign(ux) * G.halfX - x) / ux);
    if (Math.abs(uz) > 1e-4) best = Math.min(best, (Math.sign(uz) * G.halfZ - z) / uz);
    // (A corner's chamfer: |x| + |z| = halfX + halfZ - corner, on the side the ray runs to.)
    const sx = ux >= 0 ? 1 : -1, sz = uz >= 0 ? 1 : -1, c = G.halfX + G.halfZ - G.corner, along = sx * ux + sz * uz;
    if (along > 1e-4) best = Math.min(best, (c - (sx * x + sz * z)) / along);
    return Math.max(0, best);
  }
  /** The SPORT frame's room behind: how far the boom may run from (x, z) along (ux, uz) inside the walls (FOOT.wallGap),
   *  marched in quarter metres, at most `most`. */
  private roomFoot(x: number, z: number, ux: number, uz: number, most: number) {
    if (!this.insideFoot(x, z, FOOT.wallGap)) { const p = this.probe.set(x, 0, z); this.keepFoot(p); x = p.x; z = p.z; }
    let t = 0;
    while (t < most) { const next = Math.min(most, t + .25); if (!this.insideFoot(x + ux * next, z + uz * next, FOOT.wallGap)) return t; t = next; }
    return most;
  }
  private insideFoot(x: number, z: number, gap: number) {
    const G = GOAL_RULES;
    return Math.abs(x) <= G.halfX - gap && Math.abs(z) <= G.halfZ - gap && Math.abs(x) + Math.abs(z) <= G.halfX + G.halfZ - G.corner - gap * Math.SQRT2;
  }
  /** The SPORT lens put back inside the walls by `gap` (never into a goal's mouth): how far it moved along the floor. */
  private keepFoot(p: THREE.Vector3, gap: number = FOOT.wallGap) {
    const G = GOAL_RULES, x0 = p.x, z0 = p.z;
    p.x = clamp(p.x, -G.halfX + gap, G.halfX - gap); p.z = clamp(p.z, -G.halfZ + gap, G.halfZ - gap);
    const c = G.halfX + G.halfZ - G.corner - gap * Math.SQRT2, over = Math.abs(p.x) + Math.abs(p.z) - c;
    if (over > 0) { p.x -= Math.sign(p.x) * over / 2; p.z -= Math.sign(p.z) * over / 2; }
    return Math.hypot(p.x - x0, p.z - z0);
  }

  /** The CLOSE lens: how far the ball has climbed toward the tighter frame's top, 0 (well inside it) to 1
   *  (where the classic frame is needed) - its elevation from where the lens stands now, behind the body. */
  private climbing(ball: Vec3 | null, d: number, fresh: boolean) {
    if (!ball) return 0;
    const lens = this.body.y + (fresh ? RIG.height + CLOSE.height : this.height.x), reach = d + (fresh ? RIG.boom : this.boom.x);
    return smooth(Math.atan2(ball.y - lens, Math.max(reach, .5)) / D2R, CLOSE.riseFrom, CLOSE.riseTo);
  }
  /** The CLOSE lens: whether a goal's mouth stands at the tighter frame's side edge while the classic frame
   *  holds it, 0 (no) to 1 (the classic lens is needed) - the mouth's centre against each lens's half-width across. */
  private goalAtEdge(f: ChaseFrame, aspect: number, fresh: boolean) {
    if (f.mode !== 'goal-rush') return 0;
    const b = this.body, boom = fresh ? RIG.boom : this.boom.x, lx = b.x - Math.sin(f.heading) * boom, lz = b.z - Math.cos(f.heading) * boom;
    const wide = Math.atan(Math.tan(RIG.fov * D2R / 2) * aspect) / D2R, close = Math.atan(Math.tan((RIG.fov + CLOSE.fov) * D2R / 2) * aspect) / D2R;
    let need = 0;
    for (let side = -1; side <= 1; side += 2) {
      const off = Math.abs(wrapped(Math.atan2(-lx, side * GOAL_RULES.halfZ - lz) - f.heading)) / D2R;
      need = Math.max(need, smooth(off, close - CLOSE.goalEdge * 2, close - CLOSE.goalEdge) * (1 - smooth(off, wide, wide + CLOSE.goalEdge)));
    }
    return need;
  }

  /** The CLOSE lens: whether the ball stands at the tighter frame's side or top while the classic frame holds it,
   *  0 (no) to 1 (the classic lens is needed) - its angle off the frame on screen a moment ago (this rig's last), across
   *  and up or down, against each lens's half-widths. */
  private ballAtEdge(ball: Vec3 | null, aspect: number, fresh: boolean) {
    if (!ball || fresh || !this.laid) return 0;
    const v = this.seen.set(ball.x, ball.y, ball.z).sub(this.laidPos).applyQuaternion(this.unseen.copy(this.laidQuat).invert()), ahead = -v.z;
    if (ahead < .5) return 0;
    const wideV = (this.fov.x - CLOSE.fov * this.tight) / 2, closeV = wideV + CLOSE.fov / 2, e = CLOSE.ballEdge;
    const across = (half: number) => Math.atan(Math.tan(half * D2R) * aspect) / D2R;
    const need = (off: number, close: number, wide: number) => smooth(off, close - e * 2, close - e) * (1 - smooth(off, wide, wide + e));
    // (Across, and over the top: a ball at the foot of the frame is at your feet, where the rig's own pull in and up has it.)
    return Math.max(need(Math.atan2(Math.abs(v.x), ahead) / D2R, across(closeV), across(wideV)), v.y > 0 ? need(Math.atan2(v.y, ahead) / D2R, closeV, wideV) : 0);
  }

  /** How far round (radians) the boom must swing from behind the heading for RIG.swingRoom of room: none with room
   *  straight behind, else the nearest swing either way that has it (or the roomiest tried). */
  private swingFor(mode: BallModeId, x: number, z: number, heading: number, y: number, want: number) {
    // (Straight behind needs only a short boom's room: a keeper in their goal's mouth is filmed from straight behind.)
    if (this.room(mode, x, z, -Math.sin(heading), -Math.cos(heading), y, want) >= Math.min(want, RIG.boomLeast) - .01) return 0;
    let best = 0, bestRoom = -1;
    for (const step of SWINGS) for (const side of [1, -1]) {
      const a = heading + step * side, r = this.room(mode, x, z, -Math.sin(a), -Math.cos(a), y, want);
      if (r >= want - .01) return step * side;
      if (r > bestRoom + .3) { bestRoom = r; best = step * side; }
    }
    return best;
  }

  private followAxis(axis: 'x' | 'y' | 'z', target: number, rate: number, dt: number) {
    const decay = Math.exp(-rate * dt), off = this.body[axis] - target, drive = this.bodyVel[axis] + rate * off;
    this.body[axis] = target + (off + drive * dt) * decay; this.bodyVel[axis] = (this.bodyVel[axis] - rate * drive * dt) * decay;
  }

  /** Whether the lens may stand at (x, y, z): inside the field's walls (Goal Rush: its chamfered corners too) by
   *  RIG.wallGap, or in a goal's mouth under its bar. */
  private allowed(mode: BallModeId, x: number, y: number, z: number, gap: number = RIG.wallGap) {
    const R = mode === 'goal-rush' ? GOAL_RULES : SPIKE_RULES, hx = R.halfX - gap, hz = R.halfZ - gap;
    if (mode === 'goal-rush') {
      const G = GOAL_RULES;
      // In a goal's mouth, the lens is kept under the bar (keepIn lowers it there), and the deeper in the further it is
      // from the posts - the room in there shrinks smoothly to nothing toward them, so a keeper stepping along the line
      // never has the lens flip in and out of the goal.
      if (Math.abs(z) > hz) {
        const open = 1 - smooth(Math.abs(x), G.goalHalfWidth - RIG.mouthGap - RIG.mouthRamp, G.goalHalfWidth - RIG.mouthGap);
        return open > 0 && Math.abs(z) < hz + (G.halfZ + G.goalDepth - RIG.mouthGap - hz) * open;
      }
      if (Math.abs(x) + Math.abs(z) > G.halfX + G.halfZ - G.corner - gap * Math.SQRT2) return false;
    }
    return Math.abs(x) <= hx && Math.abs(z) <= hz;
  }
  /** How far the boom may run from (x, z) along (ux, uz) at height y before the lens would leave the allowed room
   *  (marched in quarter metres; at most `most`). */
  private room(mode: BallModeId, x: number, z: number, ux: number, uz: number, y: number, most: number) {
    // (A body hugging a wall stands inside the lens's gap from it: the march starts from the nearest point the lens may.)
    if (!this.allowed(mode, x, y, z)) { const p = this.probe.set(x, y, z); this.keepIn(mode, p); x = p.x; z = p.z; }
    let t = 0;
    while (t < most) { const next = Math.min(most, t + .25); if (!this.allowed(mode, x + ux * next, y, z + uz * next)) return t; t = next; }
    return most;
  }
  /** The boards themselves (a goal's mouth whole), and the roof: the lens's last bound. */
  private inBounds(mode: BallModeId, p: THREE.Vector3) {
    const R = mode === 'goal-rush' ? GOAL_RULES : SPIKE_RULES, gap = RIG.wallLoose, hx = R.halfX - gap, hz = R.halfZ - gap;
    // (A goal's mouth is open to a lens between its posts, closing smoothly toward them, and the lens is brought down under
    // its bar smoothly as it goes in.)
    const G = GOAL_RULES, open = mode !== 'goal-rush' ? 0 : 1 - smooth(Math.abs(p.x), G.goalHalfWidth - RIG.mouthRamp, G.goalHalfWidth - gap);
    const deep = hz + (R.halfZ + G.goalDepth - gap - hz) * open;
    p.x = clamp(p.x, -hx, hx); p.z = clamp(p.z, -deep, deep);
    const roof = mode === 'goal-rush' ? THREE.MathUtils.lerp(R.ceiling - 1, G.goalHeight - .2, smooth(Math.abs(p.z), hz - .6, hz + .4) * open) : R.ceiling - 1;
    p.y = clamp(p.y, .8, roof);
    if (mode === 'goal-rush' && Math.abs(p.z) <= hz) {
      const c = GOAL_RULES.halfX + GOAL_RULES.halfZ - GOAL_RULES.corner - gap * Math.SQRT2, over = Math.abs(p.x) + Math.abs(p.z) - c;
      if (over > 0) { p.x -= Math.sign(p.x) * over / 2; p.z -= Math.sign(p.z) * over / 2; }
    }
  }
  /** The lens put back inside (slid along the wall it passed; under the bar in a goal's mouth): how far it moved. */
  private keepIn(mode: BallModeId, p: THREE.Vector3, gap: number = RIG.wallGap) {
    const R = mode === 'goal-rush' ? GOAL_RULES : SPIKE_RULES, hx = R.halfX - gap, hz = R.halfZ - gap;
    p.y = clamp(p.y, .8, R.ceiling - 1);
    if (mode === 'goal-rush' && Math.abs(p.z) > hz) p.y = Math.min(p.y, GOAL_RULES.goalHeight - RIG.barGap);
    if (this.allowed(mode, p.x, p.y, p.z, gap)) return 0;
    const x0 = p.x, z0 = p.z;
    p.x = clamp(p.x, -hx, hx); p.z = clamp(p.z, -hz, hz);
    if (mode === 'goal-rush') {
      const c = GOAL_RULES.halfX + GOAL_RULES.halfZ - GOAL_RULES.corner - gap * Math.SQRT2, over = Math.abs(p.x) + Math.abs(p.z) - c;
      if (over > 0) { p.x -= Math.sign(p.x) * over / 2; p.z -= Math.sign(p.z) * over / 2; }
    }
    return Math.hypot(p.x - x0, p.z - z0);
  }
}
