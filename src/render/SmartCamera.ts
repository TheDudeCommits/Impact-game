
const clamp = (x: number, a: number, b: number) => x < a ? a : x > b ? b : x;
const smooth = (x: number, a: number, b: number) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const wrapped = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const blend = (rate: number, dt: number) => 1 - Math.exp(-rate * dt);

export const FOV = 50, ELEVATION = .23, ELEVATION_NEAR = .17, MIDDLE = .47, CHEST_LEAST = .6, LYING_LOOK = .6, DOLLY_BASE = 5.1, DOLLY_NEAR = 4.5, SHOULDER = .72, SHOULDER_NEAR = .5;
/** How far toward whoever matters the pivot stands: PULL_NEAR of the way at arm's length (PULL_FROM metres) easing to
 *  PULL_FAR by PULL_TO metres. A two-shot near, over the shoulder far. */
export const PULL_NEAR = .28, PULL_FAR = .1, PULL_FROM = 2.5, PULL_TO = 13;
/** The window (radians off the line to the fight, either side) inside which the heading rests: from WINDOW_LO_NEAR to
 *  WINDOW_HI_NEAR at arm's length (WINDOW_FROM metres), narrowing to WINDOW_LO_FAR..WINDOW_HI_FAR by WINDOW_TO metres.
 *  Under the low edge the opponent stands behind the player's own body; past the high edge they are coming round
 *  toward the lens. The side the fight is composed on changes only past SIDE_MARGIN on the other side, held for
 *  SIDE_HOLD seconds, no sooner than SIDE_REST after the last change; the pivot's shoulder crosses in SIDE_TIME. */
export const WINDOW_LO_NEAR = .28, WINDOW_HI_NEAR = 1.15, WINDOW_LO_FAR = .055, WINDOW_HI_FAR = .45, WINDOW_FROM = 3, WINDOW_TO = 12, WINDOW_SPAN = .4, SEPARATE = .8;
export const SIDE_MARGIN = .12, SIDE_HOLD = .45, SIDE_REST = 1.6, SIDE_TIME = .8, SIDE_FROM = 1.2, SHOULDER_FULL = .3, SHOULDER_RATE = 2.2;
/** The composition is chosen each frame, not steered to a point: of every angle off the line (CHOOSE_STEP apart round the
 *  whole circle, the window's edges, and the angle it holds now) the cheapest, where standing outside the window costs
 *  W_WINDOW a radian, turning there W_TURN a radian, and a lens past what the stage allows W_BOUND a metre. So inside the
 *  window and the stage it rests where it is; outside the window it makes for the nearest edge, the short way round; and
 *  a wall turns it to a side-on shot, by the least that fits. A choice on the other side of
 *  the line from the last one must be cheaper by CHOOSE_KEEP, so a near tie does not flicker between the two. */
export const CHOOSE_STEP = .07, W_WINDOW = 1, W_HIDDEN = 2.5, W_TURN = .15, W_BOUND = .7, W_THREAT = .8, THREAT_ZONE = .62, W_HIDE = .6, BODY_HALF = .34, CHOOSE_KEEP = .05, CHOOSE_KEEP_WALL = .12, WALL_NEAR = .6;
/** A pair trading places: with the fight inside the low edge (behind the player's own body) and drifting across it at
 *  PASS_RATE rad/s or more - fast enough to come out of it, on the other side or its own, within PASS_TIME seconds with the
 *  heading held - the heading holds and the two swap sides of the picture, rather than the lens being swung round after
 *  the old side. (Until 25 October 2026 the old side was kept unless the other was cheaper by a turn of 46 degrees: the D
 *  key from Training's marks turned the view 100 degrees to put the dummy back where it had been, and a sparring bot
 *  circling at arm's length was chased round the low edge - where a lens that lags hides the opponent behind the player -
 *  at 180 deg/s, the opponent hidden 10-13% of the fight.) */
export const PASS_RATE = 1, PASS_TIME = .55, PASS_CHECK = .1, PASS_COMMIT = .6;
/** The player's own run on the keys (RUN_FROM to RUN_FULL m/s of travel, eased in at RUN_IN and out at RUN_OUT a second):
 *  while it lasts, a fight the run carries past the window's far edge is followed no faster than RUN_SOFT rad/s as long as
 *  the one the shot is about is within RUN_ZONE of the half-width (the soft zone of Cinemachine's composer, beyond the dead
 *  zone that is the window: the view turns later and slower), and the urgency for them outside the frame waits
 *  RUN_URGENT_AFTER seconds, not URGENT_AFTER - a run past the opponent is the player's own move. (The harness, the keys held
 *  through fights: 25-33% less turning. W from Training's marks past the dummy: 87 degrees in the 1.2 s hold peaking at
 *  123 deg/s, now 71 peaking at 109.) A stick's run turns with the view and is followed as it always was, so a held
 *  direction still curves round the opponent (followed slowly, stick strafes in the small rooms lost the opponent 15% of
 *  the time). */
export const RUN_FROM = 3, RUN_FULL = 5, RUN_IN = 6, RUN_OUT = 2.5, RUN_URGENT_AFTER = .7, RUN_ZONE = .7, RUN_SOFT = .7;
/** A cut (the first frame of a fight) composes the fight REST_SHARE of the way into the window from its low edge. */
export const REST_SHARE = .25;
/** How the heading turns: toward its goal at TURN_GAIN per radian of error, never faster than TURN_SPEED rad/s (about
 *  110 deg/s), never changing speed faster than TURN_ACCEL rad/s^2, braking so it arrives without overshoot. With the
 *  one the shot is about outside the frame or behind the player's body for URGENT_AFTER seconds, up to URGENT_SPEED (about
 *  145 deg/s; 183 until 25 October 2026 - the comfort guidance is about 120 at most - and the harness found the opponent
 *  out of the frame no more often for the slower) and URGENT_ACCEL. For PAN_FOR seconds after a change of opponent, no
 *  faster than PAN_SPEED (both are usually already in the frame: the weights ease, see THREAT_*), and no faster than
 *  PAN_URGENT with the new one outside it (a royale's switch to somebody behind the player whipped round at up to
 *  288 deg/s). The bearing is read LEAD seconds ahead of the bodies' own travel, so a turn starts early and gently.
 *  Integrated in STEP substeps so a slow frame is the same motion sampled coarsely. (Tried on 25 October 2026 and taken
 *  back out: a slower turn, 97 deg/s at 4 rad/s^2, which a blind critic found creeping; then TURN_GAIN 5 for a decisive
 *  finish, with URGENT_SPEED 3.2 and CHOOSE_KEEP 0.12 everywhere - the harness turned 5-13% more and the film's script in
 *  it 22% more, and in the game a key run bent mid-hold, controls.mjs 8.1 degrees against the live camera's 6.5.) */
export const TURN_GAIN = 3, TURN_SPEED = 1.9, TURN_ACCEL = 6, TURN_JERK = 50, URGENT_SPEED = 2.5, URGENT_ACCEL = 14, RATE_EASE = 8, RATE_SHARE = .6, URGENT_AFTER = .2, PAN_FOR = 1, PAN_SPEED = 1.3, PAN_URGENT = 2.2, LEAD = .18, STEP = 1 / 120;
/** The player's own mouse or stick lands 1:1 at once; the composition lets go on the frame they turn and comes back
 *  YIELD_AFTER seconds after their last turn, over YIELD_OVER. What they turned it off the composition by (their
 *  look-away) is given back at AWAY_BACK a second once they leave it alone - but kept while nobody is held: then the view
 *  is simply theirs (EXPLORE). A hand resting on the mouse (under IDLE rad/s) is not a look. */
export const YIELD_AFTER = 1.2, YIELD_OVER = .6, AWAY_BACK = 1.6, IDLE = .05;
/** The player's own tilt of the view is kept for PITCH_AFTER seconds after their last, then levels at PITCH_BACK a second. */
export const PITCH_AFTER = 1.5, PITCH_BACK = .7;
/** The fit: the lens stands back (never nearer than the frame at rest, never further than DOLLY_MOST times it) by the
 *  least that holds the player's crown under FRAME_TOP and soles over -FRAME_BOTTOM of the half-height (the Halo HUD's
 *  plates above and its move row below: the second blind critic found feet on the move row at 0.8), and every body
 *  that must be seen inside FRAME_SIDE of the half-width (the opponent whole within FIT_WHOLE metres; a weighed threat's
 *  chest from THREAT_SEEN of weight). Taken up at DOLLY_OUT a second, given back at DOLLY_IN after DOLLY_HOLD seconds
 *  without needing more. */
export const FRAME_TOP = .6, FRAME_BOTTOM = .66, FRAME_SIDE = .84, FIT_WHOLE = 9, DOLLY_MOST = 1.4, DOLLY_OUT = 2.6, DOLLY_IN = .7, DOLLY_HOLD = 1.2, DOLLY_SLACK = .25;
/** The pivot is the player's own body followed on a critically damped spring at PIVOT_RATE rad/s across the floor and
 *  PIVOT_RISE up and down, never more than PIVOT_LAG metres behind it (a dash runs the fighter a little ahead in the frame
 *  and is caught up), from the edge of a dead zone PIVOT_ZONE metres round it (PIVOT_ZONE_UP up and down: a blow's shove
 *  or a string's step moves the fighter in the frame, not the world), plus the offset toward the fight, followed at
 *  OFFSET_RATE and OFFSET_RISE: the composition changes as a slow move, not with every step of the melee. */
export const PIVOT_RATE = 12, PIVOT_RISE = 5, PIVOT_LAG = .9, PIVOT_ZONE = .3, PIVOT_ZONE_UP = .22, OFFSET_RATE = 2.6, OFFSET_RISE = 2;
/** A body overhead: the look tilts up AIR_TILT radians per metre the fight's chest stands over the player's beyond
 *  AIR_FROM, at most AIR_MOST, eased at AIR_RATE (out at half of it); the pivot rises AIR_LIFT of that height. The lens
 *  never goes nearer the floor than GROUND_CLEAR. */
export const AIR_TILT = .12, AIR_FROM = .5, AIR_MOST = .32, AIR_RATE = 6, AIR_LIFT = .55, GROUND_CLEAR = .55;
/** The field: FOV, plus FOV_BIG degrees per unit a drawn body is bigger than a normal one (at most FOV_BIG_MOST), plus up
 *  to FOV_CROWD when even the furthest stand-back leaves a weighed body outside the frame. Eased at FOV_RATE. */
export const FOV_BIG = 4, FOV_BIG_MOST = 6, FOV_CROWD = 4, FOV_RATE = 1.5, CROWD_RISE = .06, CROWD_RISE_MOST = .12;
/** How much the shot is a fight at all (0 exploring, 1 engaged): an opponent within ENGAGE_NEAR metres engages it in
 *  full, out to ENGAGE_FAR it lets go (the only opponent there is, or a Tab lock, at any distance). Taken up at
 *  ENGAGE_IN a second, given back at ENGAGE_OUT. Exploring, the pivot leads a run by up to EXPLORE_LEAD metres and the
 *  heading comes round behind a steady run (over RECENTRE_SPEED m/s for RECENTRE_AFTER seconds with nobody about and the
 *  mouse left alone) at RECENTRE_RATE rad/s at most. */
export const ENGAGE_NEAR = 16, ENGAGE_FAR = 24, ENGAGE_IN = 4, ENGAGE_OUT = 1.5, EXPLORE_LEAD = 1, RECENTRE_SPEED = 3, RECENTRE_AFTER = 1.5, RECENTRE_RATE = .6;
/** A royale's other bodies: a weight up to THREAT_MOST each, eased in at THREAT_IN and out at THREAT_OUT a second. They
 *  weigh the choice of heading from THREAT_SEEN (W_THREAT) and are held in the frame by the stand-back from THREAT_FIT -
 *  pressing the player, not merely near; whoever still cannot be seen gets the threat ring (SmartThreatRing). */
export const THREAT_MOST = .8, THREAT_IN = 2.5, THREAT_OUT = .8, THREAT_SEEN = .22, THREAT_FIT = .5;
/** The stage: the lens is kept inside the play bounds plus whatever the stage allows past them (`bound.out`), first by
 *  turning (W_BOUND: a side-on shot against a wall), then by coming in along its own line,
 *  rising BOUND_RISE of what it lost - never nearer than MIN_BEHIND metres behind the player's own body. */
export const BOUND_RISE = .35, MIN_BEHIND = 2.4;
/** The stage's squeeze (see the lens): at most SQUEEZE_MOST of the stand-back given up, taken on a critically damped spring
 *  at SQUEEZE_IN rad/s and given back at SQUEEZE_OUT (a spring, not a chase: a wall's goal can step, and a chase of a step
 *  sets off at full speed - a jolt of the whole picture); at a full squeeze the look tilts SQUEEZE_TILT radians further
 *  down, the field opens SQUEEZE_FOV degrees and the look comes SQUEEZE_LOOK of the way in to the player's chest. */
export const SQUEEZE_MOST = .7, SQUEEZE_IN = 22, SQUEEZE_OUT = 2.9, SQUEEZE_TILT = .1, SQUEEZE_FOV = 5, SQUEEZE_LOOK = .8;
/** The hard limit: the player's crown under HARD_TOP of the half-height, soles over -HARD_BOTTOM, both inside HARD_SIDE
 *  of the half-width, searched in HARD_STEPS steps of the look toward their chest; taken up on a critically damped spring
 *  at HARD_IN rad/s and given back at HARD_OUT. (Until 25 October 2026 a chase at 14 a second of a goal in eighths: every
 *  jump's crown crossing the line yanked the look - the worst pitch moments in the harness, up to 495 deg/s, all had it
 *  engaged. A sprung chest for the limit to aim at, tried after it for a knockdown's drop of the chest, made the filmed
 *  camera turn a third more in Training and royales - the limit drew the look toward the player more often - and was
 *  taken out.) */
export const HARD_TOP = .74, HARD_BOTTOM = .8, HARD_SIDE = .88, HARD_STEPS = 16, HARD_IN = 12, HARD_OUT = 6;
/** The chest the hard limit aims at, through a fall to the floor or a rise from it: lying down moves the middle of the body
 *  from its drawn height to LYING_LOOK at once, and the limit, drawing the look toward it, passed that on as a snap of the
 *  aim (into a corner on the tournament ring, a wall splat's landing: the view pitched 5.8 degrees in a frame, 358 deg/s, the
 *  harness's worst frame). The step is carried over and given back on a critically damped spring at LYING_EASE rad/s; the
 *  body's own travel passes straight on (a sprung chest that lagged a jump was tried and taken out: see above). */
export const LYING_EASE = 8;
/** How far toward the fight the pivot may stand off the player's own body (metres, times their size; up and down
 *  OFFSET_UP_MOST): beyond it the fight is the stand-back's, the tilt's and the threat ring's to show, never the player's
 *  to leave the frame for (a Gorai thrown fourteen metres up over an opponent on the floor). */
export const OFFSET_MOST = 2.4, OFFSET_UP_MOST = 1.4;
export const VIEW_TILT = .0436;

export interface SmartBody {
  x: number; y: number; z: number;
  /** Crown over the root, metres (the drawn body's height). */
  high: number;
  lying: boolean; airborne: boolean;
}
export interface SmartThreat extends SmartBody { id: string; weight: number }
export interface SmartInput {
  dt: number;
  /** A cut: everything is laid at once (a match's first frame, a respawn, a teleport, a change of mode). */
  placed: boolean;
  me: SmartBody & { vx: number; vz: number; floor: number; scale: number };
  /** The opponent the shot is about, if any (CameraFocus's pick, the only rival, or a Tab lock). */
  foe?: SmartBody & { id: string; vx: number; vz: number };
  /** Held at any distance: the only opponent there is, or a Tab lock. */
  sole: boolean;
  /** Every other hostile body worth weighing, with the weight FollowCamera gave it this frame (0..1). */
  threats: readonly SmartThreat[]; threatCount: number;
  /** The player's own turn of the view this frame (radians), and tilt. */
  manual: number; manualTilt: number;
  aspect: number;
  /** The play bounds round the origin and how far past them the lens may stand (negative: inside). */
  bound?: { halfX: number; halfZ: number; out: number };
  /** A hit freeze: the shot holds. */
  frozen: boolean;
  /** The movement keys are held: the run is read against the view as it was when they went down (FollowCamera
   *  movementBasis), so the lens turning does not bend it. (A stick's run turns with the view, and a lens that follows the
   *  opponent is what curves a held direction round them.) */
  latched?: boolean;
}

/** One frame's projection of a point: across and up, as shares of the half-width and half-height; `depth` metres along
 *  the view (not in front of the lens: <= 0.2). */
interface Projected { x: number; y: number; depth: number }

export class SmartRig {
  /** Outputs: where the lens stands, what it looks at, its field, the heading the view runs along (for the movement
   *  basis when nobody is held), and the line to whoever is held (for the basis and the aim when somebody is). */
  lensX = 0; lensY = 2; lensZ = 0; lookX = 0; lookY = 1; lookZ = 1; fov = FOV;
  heading = Math.PI;
  /** The line from the player to the fight the shot holds (the weighted group, radians), kept where it last meant
   *  something; and the line to the one opponent the shot is about, which is what the keys and the aim are read against. */
  bearing = 0; foeBearing = 0;
  /** How much the shot is a fight (0..1). */
  engaged = 0;
  /** The player's look-away off the composition (radians). */
  away = 0;
  /** Which side of the line the lens composes from (+1: the lens on the line's right, the player left of the middle). */
  side = 1;
  /** The shoulder as the pivot has it this frame, -1..1 (continuous: see SHOULDER_RATE). */
  get shoulder() { return this.shoulderEase; }
  /** Read-only state for the evidence and the tests. */
  readonly state = { window: 0, lo: 0, hi: 0, phi: 0, goal: 0, urgent: 0, pass: 0, run: 0, drift: 0, dolly: DOLLY_BASE, need: DOLLY_BASE, turnSpeed: 0, pull: 0, shoulder: SHOULDER, bounded: 0, group: 0, tilt: 0, hard: 0 };

  private initialized = false;
  private age = 0;
  private pivotX = 0; private pivotY = 1; private pivotZ = 0;
  private bodyX = 0; private bodyY = 1; private bodyZ = 0; private bvx = 0; private bvy = 0; private bvz = 0;
  private offX = 0; private offY = 0; private offZ = 0; private ovx = 0; private ovy = 0; private ovz = 0;
  private turnVelocity = 0; private turnAccel = 0;
  private dolly = DOLLY_BASE; private needAt = -Infinity;
  private tilt = 0;
  private shoulderEase = 1; private sideFrom = 1; private sideAt = -Infinity; private flipFor = 0;
  private lastTurn = -Infinity;
  private lastFoe = ''; private foeAt = -Infinity;
  private hiddenFor = 0; private urgent = 0;
  private choiceSide = 1; private threatSeen = 0; private costTanH = 1; private costScale = 1; private bearingRate = 0; private lastFight = ''; private atEdge = false;
  /** Whether the fight is passing behind the player this frame (PASS_*), and how much the player is running (RUN_*, 0..1). */
  private passing = false; private wasPassing = false; private passFor = 0; private passFrom = 0; private passSide = 1; private commitFor = 0; private run = 0;
  private recentreFor = 0;
  private pitchOffset = 0; private lastTilt = -Infinity;
  private fovNow = FOV; private crowd = 0; private crowdRise = 0; private squeeze = 0; private squeezeV = 0; private hard = 0; private hardV = 0;
  private wasLying = false; private chestStep = 0; private chestStepV = 0;
  /** Eased weights by id (see THREAT_*): grown, never shrunk while a match lasts. */
  private readonly weights = new Map<string, number>();
  private readonly seen = new Set<string>();

  reset() {
    this.initialized = false; this.age = 0; this.turnVelocity = 0; this.turnAccel = 0; this.dolly = DOLLY_BASE; this.needAt = -Infinity; this.tilt = 0;
    this.side = this.shoulderEase = this.sideFrom = 1; this.sideAt = -Infinity; this.flipFor = 0; this.lastTurn = -Infinity; this.lastFoe = ''; this.foeAt = -Infinity;
    this.hiddenFor = 0; this.urgent = 0; this.choiceSide = 1; this.passing = this.wasPassing = false; this.passFor = this.commitFor = 0; this.run = 0; this.recentreFor = 0; this.pitchOffset = 0; this.lastTilt = -Infinity; this.fovNow = FOV; this.crowd = 0; this.crowdRise = 0; this.squeeze = this.squeezeV = 0; this.hard = this.hardV = 0; this.wasLying = false; this.chestStep = this.chestStepV = 0; this.away = 0; this.engaged = 0;
    this.weights.clear(); this.bvx = this.bvy = this.bvz = this.ovx = this.ovy = this.ovz = 0;
  }
  /** A cut to this heading (the start of a match or a round): laid on the next frame. */
  lookAlong(yaw: number) { this.heading = yaw; this.initialized = false; this.away = 0; }

  update(i: SmartInput) {
    const dt = clamp(Number.isFinite(i.dt) ? i.dt : 0, 0, .25), placed = i.placed || !this.initialized;
    this.age += dt;
    const me = i.me, scale = clamp(me.scale || 1, .4, 4);
    // ---- The player's own look: 1:1, at once. ----
    if (!placed && Math.abs(i.manual) > 1e-7) {
      this.heading = wrapped(this.heading + i.manual);
      if (Math.abs(i.manual) > IDLE * dt) { this.lastTurn = this.age; this.turnVelocity *= .2; }
      this.away = wrapped(this.away + i.manual);
    }
    if (!placed && Math.abs(i.manualTilt) > 1e-7) { this.pitchOffset = clamp(this.pitchOffset + i.manualTilt, -.35, .45); this.lastTilt = this.age; }
    // A tilt left alone levels itself (PITCH_*).
    else if (this.age - this.lastTilt > PITCH_AFTER) this.pitchOffset -= this.pitchOffset * blend(PITCH_BACK, dt);
    const mine = smooth(this.age - this.lastTurn, YIELD_AFTER, YIELD_AFTER + YIELD_OVER);

    // ---- Who matters, and how much. ----
    const foe = i.foe;
    const fd = foe ? Math.hypot(foe.x - me.x, foe.z - me.z) : Infinity;
    if (foe && fd > .45) this.foeBearing = Math.atan2(foe.x - me.x, foe.z - me.z);
    const engageGoal = foe ? (i.sole ? 1 : 1 - smooth(fd, ENGAGE_NEAR, ENGAGE_FAR)) : 0;
    this.engaged = placed ? engageGoal : this.engaged + (engageGoal - this.engaged) * blend(engageGoal > this.engaged ? ENGAGE_IN : ENGAGE_OUT, dt);
    if (this.engaged < 1e-3 && engageGoal === 0) this.engaged = 0;
    const e = this.engaged;
    if (foe && foe.id !== this.lastFoe) { if (this.lastFoe && !placed) this.foeAt = this.age; this.lastFoe = foe.id; this.hiddenFor = 0; }
    // The group: the one the shot is about by 1, each weighed threat by its eased weight.
    this.seen.clear();
    let gw = foe ? 1 : 0, gx = foe ? foe.x + foe.vx * LEAD : 0, gz = foe ? foe.z + foe.vz * LEAD : 0, gy = foe ? this.chest(foe) : 0, groupW = 0;
    for (let k = 0; k < i.threatCount; k++) {
      const t = i.threats[k]; if (foe && t.id === foe.id) continue;
      const was = this.weights.get(t.id) ?? 0, goal = clamp(t.weight, 0, THREAT_MOST);
      const w = placed ? goal : was + (goal - was) * blend(goal > was ? THREAT_IN : THREAT_OUT, dt);
      this.weights.set(t.id, w); this.seen.add(t.id);
      if (w < .02) continue;
      gw += w; gx += t.x * w; gz += t.z * w; gy += this.chest(t) * w; groupW += w;
    }
    // (A weight whose body has gone - dead, out of range - is let go too.)
    for (const [id, w] of this.weights) if (!this.seen.has(id)) { const left = w - w * blend(THREAT_OUT, dt); if (left < .01) this.weights.delete(id); else this.weights.set(id, left); }
    const hasGroup = gw > 1e-6;
    if (hasGroup) { gx /= gw; gz /= gw; gy /= gw; }
    this.state.group = groupW;
    // The look's height: the middle of the body as drawn (a crouched stance is a lower body, held in the middle of the frame).
    const meChest = this.chest(me), mx = me.x + me.vx * LEAD * .5, mz = me.z + me.vz * LEAD * .5;
    // (The chest the hard limit aims at: a fall to the floor or a rise from it carried over and eased, LYING_EASE.)
    if (placed || !LYING_EASE) { this.chestStep = this.chestStepV = 0; }
    else {
      if (me.lying !== this.wasLying) this.chestStep += (me.lying ? 1 : -1) * (Math.max(CHEST_LEAST, me.high * MIDDLE) - LYING_LOOK);
      spring(this.chestStep, this.chestStepV, 0, LYING_EASE, dt); this.chestStep = sprung.x; this.chestStepV = sprung.v;
    }
    this.wasLying = me.lying;
    const hardChest = meChest + this.chestStep;
    // The line the composition is made on is the line to the one opponent the shot is about (CameraFocus's pick, chosen
    // with hysteresis): the others are weighed into the pivot, the stand-back and the choice (W_THREAT), not the line.
    const ax = foe ? foe.x + foe.vx * LEAD : gx, az = foe ? foe.z + foe.vz * LEAD : gz;
    const gd = hasGroup ? Math.hypot(ax - mx, az - mz) : Infinity;
    if (hasGroup && gd > .45) {
      const b = Math.atan2(ax - mx, az - mz);
      // The line's own turning (rad/s), smoothed: a composition held at the window's edge turns with it (feed-forward),
      // so an opponent circling at arm's length is led, not chased round behind the player's back.
      if (!placed && dt > 0 && this.lastFight === (foe?.id ?? '')) { const jump = wrapped(b - this.bearing), rate = Math.abs(jump) < .8 ? clamp(jump / dt, -URGENT_SPEED, URGENT_SPEED) : 0; this.bearingRate += (rate - this.bearingRate) * blend(RATE_EASE, dt); }
      else this.bearingRate = 0;
      this.bearing = b;
    } else this.bearingRate -= this.bearingRate * blend(RATE_EASE, dt);
    this.lastFight = foe?.id ?? '';

    // The frame at rest (see DOLLY_*), which the stage's bound is judged at.
    const rest = lerp(DOLLY_BASE, lerp(DOLLY_NEAR, DOLLY_BASE, smooth(gd, PULL_FROM, PULL_TO)), e) * scale;
    // How far toward the fight the pivot stands, and the shoulder's breadth (see the pivot, below; a pass judges the lens
    // it would hold with them).
    const pull = hasGroup ? e * lerp(PULL_FAR, PULL_NEAR, 1 - smooth(gd, PULL_FROM, PULL_TO)) : 0;
    const shoulder = lerp(SHOULDER, lerp(SHOULDER_NEAR, SHOULDER, smooth(gd, PULL_FROM, PULL_TO)), e) * scale;
    // ---- The heading. ----
    const near = hasGroup ? 1 - smooth(gd, WINDOW_FROM, WINDOW_TO) : 1;
    // The low edge is where the two bodies stop overlapping on screen: the pair SEPARATE metres apart across the view
    // (times their sizes) - about 32 degrees at arm's length, 13 at three metres - and never under the window's own.
    const apartNeed = SEPARATE * (scale + (foe ? foe.high / 1.95 : 1)) / 2;
    const lo = Math.max(lerp(WINDOW_LO_FAR, WINDOW_LO_NEAR, near), hasGroup && gd > apartNeed ? Math.asin(Math.min(.95, apartNeed / gd)) : WINDOW_LO_NEAR);
    const hi = Math.max(lerp(WINDOW_HI_FAR, WINDOW_HI_NEAR, near), lo + WINDOW_SPAN);
    this.state.lo = lo; this.state.hi = hi;
    let goal = this.heading, phi = 0;
    this.passing = false;
    if (placed) {
      if (hasGroup && e > 0) { this.side = 1; this.choiceSide = 1; goal = wrapped(this.bearing + this.side * (lo + REST_SHARE * (hi - lo))); this.heading = goal; this.away = 0; }
      this.sideFrom = this.shoulderEase = this.side; this.sideAt = -Infinity; this.turnVelocity = 0; this.turnAccel = 0;
    } else if (hasGroup && e > 0) {
      // The player's look-away is theirs while they turn and a beat after; left alone, it is given back.
      if (mine >= 1) { this.away -= this.away * blend(AWAY_BACK, dt); if (Math.abs(this.away) < 1e-4) this.away = 0; }
      phi = wrapped(this.heading - this.away - this.bearing);
      // The composition (see CHOOSE_*): the cheapest angle off the line, either side of it.
      const back = Math.max(this.dolly, rest) * Math.cos(ELEVATION);
      this.costTanH = Math.tan((this.fovNow * Math.PI / 180) / 2) * i.aspect; this.threatSeen = 0; this.costScale = scale;
      this.costPull = pull; this.costShoulder = shoulder;
      for (let k = 0; k < i.threatCount; k++) if ((this.weights.get(i.threats[k].id) ?? 0) >= THREAT_SEEN) this.threatSeen++;
      let best = phi, bestCost = this.costAt(phi, phi, lo, hi, i, back), pos = NaN, posCost = Infinity, neg = NaN, negCost = Infinity;
      const consider = (p: number) => {
        const c = this.costAt(p, phi, lo, hi, i, back);
        if (c < bestCost) { best = p; bestCost = c; }
        if (p >= 0) { if (c < posCost) { pos = p; posCost = c; } } else if (c < negCost) { neg = p; negCost = c; }
      };
      consider(phi); consider(lo); consider(-lo); consider(hi); consider(-hi);
      for (let p = -Math.PI; p < Math.PI; p += CHOOSE_STEP) consider(p);
      // A pair trading places (PASS_*): the fight crossing behind the player fast enough to be out from behind them soon
      // with the heading held is let through - the two swap sides of the picture - and the side is where it is going.
      // The crossing is read off the bodies' own travel across the line between them (the line's turning rate, not
      // differentiated: a smoothed rate of the bearing lags a dash by a fifth of a second, and passed for crossings that
      // never came).
      const drift = foe && fd > .45 ? -((foe.vx - me.vx) * Math.cos(this.foeBearing) - (foe.vz - me.vz) * Math.sin(this.foeBearing)) / fd : 0, across = Math.abs(drift);
      this.state.drift = drift;
      // Against a wall the side is the stage's to choose (W_BOUND): no pass there, and the old side kept as firmly as it
      // always was (CHOOSE_KEEP_WALL) - with the lens squeezed, or within WALL_NEAR of what the stage allows. (Passes and the
      // looser keep along the walls hid the opponent twice as often: the side they chose had no room for the lens.) Nor
      // with others pressing the player (THREAT_SEEN): a crowd's composition is the threats' to weigh.
      this.lensFor(phi, clamp(phi / Math.max(SHOULDER_FULL, lo), -1, 1), back, i);
      const walled = this.squeeze > .05 || this.pastBound(this.lensX0, this.lensZ0, i, WALL_NEAR) > 0;
      if (!walled && this.threatSeen === 0 && Math.abs(phi) < lo && across > PASS_RATE && this.passFor < PASS_TIME * 2) {
        const going = Math.sign(drift), side = this.passFor > 0 ? this.passSide : going;
        const left = Math.sign(phi) === side ? lo - Math.abs(phi) : Math.abs(phi) + lo;
        // (Under way it must be getting there - the fight at least half as far toward its side as its travel says - and the
        // lens it holds, the shoulder on the new side, inside what the stage allows; a pass let go is not taken up again
        // until the fight has left the low zone.)
        const progress = this.passFor <= PASS_CHECK || (phi - this.passFrom) * side >= .5 * across * this.passFor;
        if (going === side && left / across < PASS_TIME && progress) {
          this.lensFor(phi, side, back, i);
          if (this.pastBound(this.lensX0, this.lensZ0, i) < .05) {
            if (this.passFor === 0) { this.passFrom = phi; this.passSide = side; }
            this.passing = true; best = phi; this.choiceSide = side;
          }
        }
        if (!this.passing && this.passFor > 0) this.passFor = PASS_TIME * 2;
      }
      // A pass that stops short - the opponent halted right behind the player - commits the side it was going to for
      // PASS_COMMIT seconds: the turn out from behind goes that way at once, rather than waiting on a near tie of the two
      // sides that flips with every step (the sparring bot in the tournament ring).
      if (this.wasPassing && !this.passing && Math.abs(phi) < lo) this.commitFor = PASS_COMMIT;
      this.wasPassing = this.passing;
      this.commitFor = Math.abs(phi) < lo ? Math.max(0, this.commitFor - dt) : 0;
      this.passFor = this.passing ? this.passFor + dt : Math.abs(phi) < lo ? this.passFor : 0;
      if (!this.passing) {
        // (A choice across the line from the last one has to be clearly cheaper.)
        const last = this.commitFor > 0 ? this.passSide : this.choiceSide, same = last > 0 ? pos : neg, sameCost = last > 0 ? posCost : negCost;
        if (last !== 0 && Math.sign(best) !== last && Number.isFinite(same) && (this.commitFor > 0 || sameCost <= bestCost + (walled ? CHOOSE_KEEP_WALL : CHOOSE_KEEP))) best = same;
        this.choiceSide = Math.abs(best) > .02 ? Math.sign(best) : this.choiceSide;
      }
      // Which shoulder: the side the composition is on, once it has stood there for a beat.
      // (Not with the two all but on top of each other (SIDE_FROM), where the side flickers; from there on the shoulder goes
      // with the fight - kept on the old side, the eighth critic found the pair in the left third and the right half empty.)
      const other = Math.sign(best) !== this.side && Math.abs(best) > SIDE_MARGIN && gd > SIDE_FROM;
      this.flipFor = other ? this.flipFor + dt : 0;
      if (this.flipFor >= SIDE_HOLD && this.age - this.sideAt >= SIDE_REST) { this.sideFrom = this.shoulderEase; this.side = -this.side; this.sideAt = this.age; this.flipFor = 0; }
      goal = wrapped(this.bearing + best + this.away);
      this.atEdge = Math.abs(wrapped(best - phi)) > .01;
      this.state.window = Math.abs(phi) >= lo && Math.abs(phi) <= hi ? 1 : 0;
    } else {
      // Exploring: the view is the player's; the heading comes round behind a steady run once the mouse is left alone.
      this.away = 0;
      const speed = Math.hypot(me.vx, me.vz);
      this.recentreFor = speed > RECENTRE_SPEED && mine >= 1 ? this.recentreFor + dt : 0;
      if (this.recentreFor > RECENTRE_AFTER) {
        const run = Math.atan2(me.vx, me.vz), off = wrapped(run - this.heading);
        // (Never round to face the lens: a run toward the camera is the player's choice.)
        if (Math.abs(off) < 2.2) goal = wrapped(this.heading + clamp(off, -RECENTRE_RATE * dt * 4, RECENTRE_RATE * dt * 4));
      }
    }
    this.state.phi = phi; this.state.goal = goal; this.state.pass = this.passing ? 1 : 0;
    // The player's own run (RUN_*).
    const runGoal = placed || !i.latched ? 0 : smooth(Math.hypot(me.vx, me.vz), RUN_FROM, RUN_FULL);
    this.run += (runGoal - this.run) * blend(runGoal > this.run ? RUN_IN : RUN_OUT, dt); this.state.run = this.run;
    // Urgency: the one the shot is about outside the frame or behind the player's body (not while they pass behind it).
    const lost = foe && e > .5 && !this.passing ? this.lostFoe(foe, scale, i.aspect) : false;
    this.hiddenFor = lost ? this.hiddenFor + dt : 0;
    const after = lerp(URGENT_AFTER, RUN_URGENT_AFTER, this.run);
    this.urgent += ((this.hiddenFor >= after ? 1 : 0) - this.urgent) * blend(this.hiddenFor >= after ? 8 : 3, dt);
    this.state.urgent = this.urgent;
    if (!placed) {
      let speed = lerp(TURN_SPEED, URGENT_SPEED, this.urgent), accel = lerp(TURN_ACCEL, URGENT_ACCEL, this.urgent);
      const pan = 1 - smooth(this.age - this.foeAt, PAN_FOR * .5, PAN_FOR);
      if (pan > 0) speed = lerp(speed, Math.min(speed, lerp(PAN_SPEED, PAN_URGENT, this.urgent)), pan);
      // Exploring, only a recentre turns it, at its own pace.
      if (e <= 0) { speed = RECENTRE_RATE; accel = 2; }
      const gain = mine;
      let error = wrapped(goal - this.heading);
      // At the window's edge the composition turns with the line (RATE_SHARE of its own rate fed forward), and may go as
      // fast as the line does, up to URGENT_SPEED.
      const lead = e > 0 && this.atEdge ? this.bearingRate * RATE_SHARE : 0;
      if (Math.abs(lead) > speed) speed = Math.min(URGENT_SPEED, Math.abs(lead));
      // The player's own run carrying the fight past the far edge, the one the shot is about still well inside the frame
      // (RUN_*): a slow follow, picking up to the ordinary pace as they near the frame's edge - the line's own rate fed
      // forward included (a run past them at arm's length turns the line five radians a second).
      if (this.run > 0 && foe && e > 0 && Math.abs(phi) > hi) {
        const q = this.project(foe.x, this.chest(foe), foe.z, Math.tan((this.fovNow * Math.PI / 180) / 2), Math.tan((this.fovNow * Math.PI / 180) / 2) * i.aspect);
        if (q.depth > .5) speed = lerp(speed, Math.min(speed, RUN_SOFT), this.run * (1 - smooth(Math.abs(q.x), RUN_ZONE - .3, RUN_ZONE)));
      }
      if (i.frozen) { this.turnVelocity *= Math.exp(-20 * dt); this.turnAccel = 0; }
      else for (let left = dt; left > 1e-9; left -= STEP) {
        const h = Math.min(STEP, left), size = Math.abs(error);
        const wanted = gain * clamp(Math.sign(error) * Math.min(speed, Math.sqrt(1.6 * accel * size), TURN_GAIN * size) + lead, -speed, speed);
        // (The acceleration itself changes no faster than TURN_JERK: a turn starts as an ease, never a lurch out of rest -
        // the first blind critic's "still, then a lurch".)
        const push = clamp((wanted - this.turnVelocity) / h, -accel, accel);
        this.turnAccel += clamp(push - this.turnAccel, -TURN_JERK * h, TURN_JERK * h);
        if (Math.sign(this.turnAccel) !== Math.sign(push) && Math.abs(push) < Math.abs(this.turnAccel)) this.turnAccel = push;
        // (Never past the speed limit, and never past the goal: the eased acceleration may not brake in time on its own.)
        this.turnVelocity += this.turnAccel * h;
        if (Math.abs(this.turnVelocity) > speed) { this.turnVelocity = Math.sign(this.turnVelocity) * speed; this.turnAccel = 0; }
        let stepped = this.turnVelocity * h;
        if (Math.abs(lead) < 1e-6 && Math.sign(stepped) === Math.sign(error) && Math.abs(stepped) > Math.abs(error)) { stepped = error; this.turnVelocity = 0; this.turnAccel = 0; }
        this.heading = wrapped(this.heading + stepped); error -= stepped;
      }
    }
    this.state.turnSpeed = this.turnVelocity;
    // The shoulder crosses as a move with a beginning and an end.
    // The shoulder is continuous (SHOULDER_RATE): full on the side the fight stands, once it stands SHOULDER_FULL radians or
    // more off the line, and through the middle as it crosses behind the player - so the pair is always balanced in the
    // frame (the eighth critic: kept on its old side, the pair sat in the left third and the right half stood empty) without
    // the discrete swap of a shoulder from one side to the other.
    // (A pair passing behind the player has the shoulder go straight to the side the fight is coming out on.)
    const shoulderGoal = hasGroup && e > 0 ? (this.passing ? this.choiceSide : clamp(phi / Math.max(SHOULDER_FULL, lo), -1, 1)) : Math.sign(this.shoulderEase) || 1;
    this.shoulderEase = placed ? (hasGroup && e > 0 ? this.side : 1) : this.shoulderEase + (shoulderGoal - this.shoulderEase) * blend(SHOULDER_RATE, dt);

    // ---- The pivot. ----
    this.state.pull = pull; this.state.shoulder = shoulder;
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading), rx = -fz, rz = fx;
    // Two layers: the player's own body, followed closely (PIVOT_RATE, never more than PIVOT_LAG behind), and the offset
    // toward the fight - the pull, the shoulder, a run's look-ahead, the height between the chests - followed slowly
    // (OFFSET_RATE), so the pair's every step in and out of a melee is not a breath of the whole picture.
    // (Toward the one the shot is about, not the crowd's middle: a royale's others are held by the choice and the fit, and
    // drawing the pivot into the crowd made the player a small figure off to one side of a spectator's view.)
    const tx0 = foe ? foe.x : gx, tz0 = foe ? foe.z : gz, ty0 = foe ? this.chest(foe) : gy;
    let ox = hasGroup ? (tx0 - me.x) * pull : 0, oz = hasGroup ? (tz0 - me.z) * pull : 0;
    // Over the shoulder: the pivot to the lens's side of the player, so the player stands off the middle and the line of
    // sight to the fight passes beside them. Exploring, a run is looked ahead of.
    ox += rx * shoulder * this.shoulderEase; oz += rz * shoulder * this.shoulderEase;
    if (e < 1) { const k = (1 - e) * Math.min(1, EXPLORE_LEAD / Math.max(1, Math.hypot(me.vx, me.vz) * .25)); ox += me.vx * .25 * k; oz += me.vz * .25 * k; }
    // Up: between the chests, and a share of a body overhead.
    const above = hasGroup ? Math.max(0, ty0 - meChest - AIR_FROM) : 0;
    let oy = (hasGroup ? (ty0 - meChest) * pull : 0) + above * AIR_LIFT * e * .3;
    { const reach = Math.hypot(ox, oz), most = OFFSET_MOST * scale; if (reach > most) { ox *= most / reach; oz *= most / reach; } oy = clamp(oy, -OFFSET_UP_MOST * scale, OFFSET_UP_MOST * scale); }
    if (placed) {
      this.bodyX = me.x; this.bodyZ = me.z; this.bodyY = meChest; this.bvx = this.bvz = this.bvy = 0;
      this.offX = ox; this.offZ = oz; this.offY = oy; this.ovx = this.ovz = this.ovy = 0;
    } else {
      // The body is followed only once it leaves a little zone round where the pivot holds it (PIVOT_ZONE): a blow's shove,
      // a string's step and a guard's slide move the fighter in the frame, not the world round them; travel is followed
      // from the zone's edge, so it never stops short with a jolt either.
      const zx = this.bodyX - me.x, zz = this.bodyZ - me.z, zone = Math.hypot(zx, zz), keep = zone > PIVOT_ZONE * scale ? PIVOT_ZONE * scale / zone : 1;
      const tx = zone > PIVOT_ZONE * scale ? me.x + zx * keep : this.bodyX, tz = zone > PIVOT_ZONE * scale ? me.z + zz * keep : this.bodyZ;
      spring(this.bodyX, this.bvx, tx, PIVOT_RATE, dt); this.bodyX = sprung.x; this.bvx = sprung.v;
      spring(this.bodyZ, this.bvz, tz, PIVOT_RATE, dt); this.bodyZ = sprung.x; this.bvz = sprung.v;
      const zy = this.bodyY - meChest, ty = Math.abs(zy) > PIVOT_ZONE_UP ? meChest + Math.sign(zy) * PIVOT_ZONE_UP : this.bodyY;
      spring(this.bodyY, this.bvy, ty, PIVOT_RISE, dt); this.bodyY = sprung.x; this.bvy = sprung.v;
      const lx = this.bodyX - me.x, lz = this.bodyZ - me.z, lag = Math.hypot(lx, lz);
      if (lag > PIVOT_LAG) { const k = PIVOT_LAG / lag; this.bodyX = me.x + lx * k; this.bodyZ = me.z + lz * k; }
      if (!i.frozen) {
        spring(this.offX, this.ovx, ox, OFFSET_RATE, dt); this.offX = sprung.x; this.ovx = sprung.v;
        spring(this.offZ, this.ovz, oz, OFFSET_RATE, dt); this.offZ = sprung.x; this.ovz = sprung.v;
        spring(this.offY, this.ovy, oy, OFFSET_RISE, dt); this.offY = sprung.x; this.ovy = sprung.v;
      }
    }
    this.pivotX = this.bodyX + this.offX; this.pivotY = this.bodyY + this.offY; this.pivotZ = this.bodyZ + this.offZ;

    // ---- The tilt for a body overhead. ----
    const tiltGoal = clamp(above * AIR_TILT, 0, AIR_MOST) * e;
    this.tilt = placed ? tiltGoal : this.tilt + (tiltGoal - this.tilt) * blend(tiltGoal > this.tilt ? AIR_RATE : AIR_RATE * .5, dt);
    this.state.tilt = this.tilt;
    // A crowd is filmed a little higher (CROWD_RISE a unit of weight pressing in, at most CROWD_RISE_MOST): the royale's
    // full shot over the duel's lower one.
    const crowdGoal = Math.min(CROWD_RISE_MOST, CROWD_RISE * this.state.group) * e;
    this.crowdRise = placed ? crowdGoal : this.crowdRise + (crowdGoal - this.crowdRise) * blend(crowdGoal > this.crowdRise ? 1.5 : .6, dt);
    // (Lower at arm's length - ELEVATION_NEAR, about 7 degrees down - for the melee's depth; the fourth and seventh critics.)
    const elevation = clamp(lerp(ELEVATION, ELEVATION_NEAR, e * (1 - smooth(gd, PULL_FROM, PULL_TO))) - this.tilt + this.pitchOffset + this.crowdRise, -.3, .8);

    // ---- The field. ----
    const big = Math.min(FOV_BIG_MOST, FOV_BIG * Math.max(0, scale - 1));
    const most = Math.max(rest, DOLLY_BASE * scale) * DOLLY_MOST;
    const tanV = Math.tan((this.fovNow * Math.PI / 180) / 2), tanH = tanV * i.aspect;
    let need = this.fit(i, rest, most, elevation, tanV, tanH, scale);
    // A crowd that will not fit even from the furthest stand-back widens the field instead, by how far it is from fitting.
    const short = need > most - 1e-3 ? 1 : 0;
    this.crowd = placed ? short : this.crowd + (short - this.crowd) * blend(short > this.crowd ? 2 : .7, dt);
    need = Math.min(need, most);
    const fovGoal = FOV + big + FOV_CROWD * this.crowd * e;
    this.fovNow = placed ? fovGoal : this.fovNow + (fovGoal - this.fovNow) * blend(FOV_RATE, dt);
    this.fov = this.fovNow;
    // Out quickly once it needs clearly more (DOLLY_SLACK), in slowly once it needs clearly less and has for a beat.
    if (need > this.dolly + DOLLY_SLACK) this.needAt = this.age;
    if (placed) this.dolly = need;
    else if (need > this.dolly + DOLLY_SLACK * .5) this.dolly += (need - this.dolly) * blend(DOLLY_OUT, dt);
    else if (need < this.dolly - DOLLY_SLACK && this.age - this.needAt > DOLLY_HOLD && !i.frozen) this.dolly += (need - this.dolly) * blend(DOLLY_IN, dt);
    this.state.need = need; this.state.dolly = this.dolly;

    // ---- The lens. ----
    // Squeezed by the stage (SQUEEZE_*): the share of the stand-back a wall takes this frame - taken up fast, given back
    // slowly, so a corner is an ease and a turn of the heading in it is not a breath - and the shot answers it as the
    // other cameras' tight-space handling does: the lens rises and looks down a little more, the field opens a little, and
    // the look comes in toward the player's own chest, so they stay whole however near the wall stands the lens.
    const cos0 = Math.cos(elevation), back0 = this.dolly * cos0;
    let squeezeGoal = 0;
    if (i.bound) {
      const ex0 = this.pivotX - fx * back0, ez0 = this.pivotZ - fz * back0, ax = i.bound.halfX + i.bound.out, az = i.bound.halfZ + i.bound.out;
      let k = 1;
      if (Math.abs(ex0) > ax) k = Math.min(k, (ax * Math.sign(ex0) - this.pivotX) / (ex0 - this.pivotX));
      if (Math.abs(ez0) > az) k = Math.min(k, (az * Math.sign(ez0) - this.pivotZ) / (ez0 - this.pivotZ));
      // Never nearer than MIN_BEHIND behind the player's own body along the view: past that the wall is the stage fade's
      // to cut away, not the player's to be lost behind.
      const ahead = (me.x - this.pivotX) * fx + (me.z - this.pivotZ) * fz, least = Math.max(0, MIN_BEHIND * scale + ahead) / Math.max(back0, 1e-3);
      squeezeGoal = 1 - clamp(Number.isFinite(k) ? Math.max(k, least) : 1, 1 - SQUEEZE_MOST, 1);
    }
    if (placed) { this.squeeze = squeezeGoal; this.squeezeV = 0; }
    else { spring(this.squeeze, this.squeezeV, squeezeGoal, squeezeGoal > this.squeeze ? SQUEEZE_IN : SQUEEZE_OUT, dt); this.squeeze = clamp(sprung.x, 0, SQUEEZE_MOST); this.squeezeV = sprung.v; }
    if (this.squeeze < 1e-4 && Math.abs(this.squeezeV) < 1e-3) this.squeeze = this.squeezeV = 0;
    const q = this.squeeze, elev = elevation + q * SQUEEZE_TILT, cos = Math.cos(elev), sin = Math.sin(elev);
    let back = this.dolly * cos * (1 - q), lift = this.dolly * sin + this.dolly * cos * q * BOUND_RISE;
    this.state.bounded = this.dolly * cos * q;
    // The look: the pivot, drawn toward the player's own chest as the squeeze takes the room.
    let lookX = lerp(this.pivotX, this.bodyX, q * SQUEEZE_LOOK), lookY = lerp(this.pivotY, this.bodyY, q * SQUEEZE_LOOK), lookZ = lerp(this.pivotZ, this.bodyZ, q * SQUEEZE_LOOK);
    let ex = lookX - fx * back, ez = lookZ - fz * back, ey = Math.max(lookY + lift, me.floor + GROUND_CLEAR);
    // And never past what the stage allows, whatever the squeeze has yet to take up: along the lens's own line.
    if (i.bound) {
      const ax = i.bound.halfX + i.bound.out, az = i.bound.halfZ + i.bound.out;
      let k = 1;
      if (Math.abs(ex) > ax) k = Math.min(k, (ax * Math.sign(ex) - lookX) / (ex - lookX));
      if (Math.abs(ez) > az) k = Math.min(k, (az * Math.sign(ez) - lookZ) / (ez - lookZ));
      if (Number.isFinite(k) && k < 1) { k = Math.max(k, 0); ex = lookX + (ex - lookX) * k; ez = lookZ + (ez - lookZ) * k; }
    }
    this.fov = this.fovNow + q * SQUEEZE_FOV;
    // The hard limit (Cinemachine's): whatever the composition, the player's own body is never outside the frame. If the
    // crown, the soles or the chest would leave it, the look is drawn toward the player's chest by the least that keeps them
    // in (searched in HARD_STEPS steps) - a correction the softer rules above almost never leave it to make. It judges the
    // frame as it is seen, tilted (VIEW_TILT).
    const hv = Math.tan((this.fov * Math.PI / 180) / 2), hh = hv * i.aspect;
    let hardGoal = 1;
    for (let k = 0; k <= HARD_STEPS; k++) {
      const t = k / HARD_STEPS, lx = lerp(lookX, me.x, t), ly = lerp(lookY, hardChest, t), lz = lerp(lookZ, me.z, t);
      const top = this.project(me.x, me.lying ? me.y + .5 : me.y + me.high, me.z, hv, hh, ex, ey, ez, lx, ly, lz, VIEW_TILT);
      const okTop = top.depth > .2 && top.y < HARD_TOP && Math.abs(top.x) < HARD_SIDE;
      const sole = this.project(me.x, me.y + .03, me.z, hv, hh, ex, ey, ez, lx, ly, lz, VIEW_TILT);
      const okSole = sole.depth > .2 && sole.y > -HARD_BOTTOM && Math.abs(sole.x) < HARD_SIDE;
      if (okTop && okSole) { hardGoal = t; break; }
    }
    // (Taken up fast and given back slowly - HARD_IN, HARD_OUT - on a spring, so the correction is a move, not a snap of the aim.)
    if (placed) { this.hard = hardGoal; this.hardV = 0; }
    else { spring(this.hard, this.hardV, hardGoal, hardGoal > this.hard ? HARD_IN : HARD_OUT, dt); this.hard = clamp(sprung.x, 0, 1); this.hardV = sprung.v; }
    lookX = lerp(lookX, me.x, this.hard); lookY = lerp(lookY, hardChest, this.hard); lookZ = lerp(lookZ, me.z, this.hard); this.state.hard = this.hard;
    // The view's tilt (VIEW_TILT): the look turned up about the lens, its heading and its distance kept.
    {
      const dx = lookX - ex, dy = lookY - ey, dz = lookZ - ez, across = Math.hypot(dx, dz), reach = Math.hypot(across, dy), pitch = Math.atan2(dy, across) + VIEW_TILT;
      if (across > 1e-6) { const k = Math.cos(pitch) * reach / across; lookX = ex + dx * k; lookZ = ez + dz * k; lookY = ey + Math.sin(pitch) * reach; }
    }
    this.lensX = ex; this.lensY = ey; this.lensZ = ez;
    this.lookX = lookX; this.lookY = lookY; this.lookZ = lookZ;
    // How much of the opponent the player's own body hides from this lens (0..1): the occlusion fade thins the player's
    // torso by it (OcclusionFader.selfCover), so a pair stepping across each other is seen through rather than turned for.
    this.selfCover = foe ? this.cover(me, foe, scale, hv, hh) : 0;
    this.initialized = true;
  }
  /** Of the opponent's box on screen, the share the player's own box covers, the player being nearer the lens. */
  selfCover = 0;
  private cover(me: SmartBody, foe: SmartBody, scale: number, tanV: number, tanH: number) {
    const box = (b: SmartBody, half: number, out: { x0: number; x1: number; y0: number; y1: number; d: number }) => {
      const top = this.project(b.x, b.lying ? b.y + .5 : b.y + b.high, b.z, tanV, tanH); const ty = top.y, td = top.depth;
      const low = this.project(b.x, b.y + .03, b.z, tanV, tanH); const ly = low.y, ld = low.depth;
      const mid = this.project(b.x, this.chest(b), b.z, tanV, tanH); if (mid.depth <= .2 || td <= .2 || ld <= .2) return false;
      const w = half / (mid.depth * tanH); out.x0 = mid.x - w; out.x1 = mid.x + w; out.y0 = Math.min(ty, ly); out.y1 = Math.max(ty, ly); out.d = mid.depth; return true;
    };
    const a = this.boxA, b = this.boxB;
    if (!box(foe, BODY_HALF * foe.high / 1.95, b) || !box(me, BODY_HALF * scale, a) || a.d >= b.d) return 0;
    const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0), area = (b.x1 - b.x0) * (b.y1 - b.y0);
    return w > 0 && h > 0 && area > 1e-9 ? Math.min(1, w * h / area) : 0;
  }
  private boxA = { x0: 0, x1: 0, y0: 0, y1: 0, d: 0 }; private boxB = { x0: 0, x1: 0, y0: 0, y1: 0, d: 0 };

  /** The middle of a body as drawn; lying down, LYING_LOOK over the floor (not the 0.35 m its chest lies at: the shot would
   *  drop to the floor with every knockdown and the standing opponent ride up into the health bars). */
  private chest(b: SmartBody) { return b.y + (b.lying ? LYING_LOOK : Math.max(CHEST_LEAST, b.high * MIDDLE)); }

  /** The one the shot is about, as the lens last stood: outside the frame, or behind the player's own body. */
  private lostFoe(foe: SmartBody, scale: number, aspect: number) {
    const tanV = Math.tan((this.fovNow * Math.PI / 180) / 2), tanH = tanV * aspect;
    const p = this.project(foe.x, this.chest(foe), foe.z, tanV, tanH);
    if (p.depth <= .2 || Math.abs(p.x) > 1 || Math.abs(p.y) > 1) return true;
    // Behind the player: across within the player's own half-breadth on screen, and further from the lens.
    const m = this.projectedMe;
    if (m.depth > .2 && p.depth > m.depth) { const half = .34 * scale / (m.depth * tanH); return Math.abs(p.x - m.x) < half * .8; }
    return false;
  }
  private projectedMe: Projected = { x: 0, y: 0, depth: 1 };

  /** The share of the half-width and half-height a point stands at, from the lens as it last stood. */
  private out: Projected = { x: 0, y: 0, depth: 0 };
  private project(x: number, y: number, z: number, tanV: number, tanH: number, ex = this.lensX, ey = this.lensY, ez = this.lensZ, lx = this.lookX, ly = this.lookY, lz = this.lookZ, tilt = 0): Projected {
    let fx = lx - ex, fy = ly - ey, fz = lz - ez; const fl = Math.hypot(fx, fy, fz) || 1; fx /= fl; fy /= fl; fz /= fl;
    // right = forward x up, up' = right x forward
    let rx = -fz, rz = fx; const rl = Math.hypot(rx, rz) || 1; rx /= rl; rz /= rl;
    let ux = -rz * fy, uy = rz * fx - rx * fz, uz = rx * fy;
    // (A view tilted up about the lens: forward and up turned about the right, which stays.)
    if (tilt) { const c = Math.cos(tilt), s = Math.sin(tilt), gx = fx * c + ux * s, gy = fy * c + uy * s, gz = fz * c + uz * s; ux = ux * c - fx * s; uy = uy * c - fy * s; uz = uz * c - fz * s; fx = gx; fy = gy; fz = gz; }
    const qx = x - ex, qy = y - ey, qz = z - ez, depth = qx * fx + qy * fy + qz * fz;
    const o = this.out; o.depth = depth;
    if (depth <= .2) { o.x = o.y = 9; return o; }
    o.x = (qx * rx + qz * rz) / (depth * tanH); o.y = (qx * ux + qy * uy + qz * uz) / (depth * tanV);
    return o;
  }

  /** The stand-back (metres from the pivot) that holds everybody who must be seen, between `rest` and `most`. */
  private fit(i: SmartInput, rest: number, most: number, elevation: number, tanV: number, tanH: number, scale: number) {
    // Keep the player's own projection for the hidden test (from the lens as it stands, not a candidate's).
    const m = this.project(i.me.x, this.chest(i.me), i.me.z, tanV, tanH);
    this.projectedMe.x = m.x; this.projectedMe.y = m.y; this.projectedMe.depth = m.depth;
    this.fitFx = Math.sin(this.heading); this.fitFz = Math.cos(this.heading); this.fitCos = Math.cos(elevation); this.fitSin = Math.sin(elevation);
    if (this.fits(i, rest, tanV, tanH)) return rest;
    if (!this.fits(i, most, tanV, tanH)) return most;
    let lo = rest, hi = most;
    for (let k = 0; k < 9; k++) { const mid = (lo + hi) / 2; if (this.fits(i, mid, tanV, tanH)) hi = mid; else lo = mid; }
    return hi;
  }
  private fitFx = 0; private fitFz = 1; private fitCos = 1; private fitSin = 0;
  /** Whether everybody who must be seen is inside the frame from a stand-back of `d` (see FRAME_*). */
  private fits(i: SmartInput, d: number, tanV: number, tanH: number) {
    const me = i.me, foe = i.foe;
    const ex = this.pivotX - this.fitFx * d * this.fitCos, ez = this.pivotZ - this.fitFz * d * this.fitCos, ey = Math.max(this.pivotY + d * this.fitSin, me.floor + GROUND_CLEAR);
    const px = this.pivotX, py = this.pivotY, pz = this.pivotZ;
    // The player whole: crown under the bars, soles over the key strip, inside the sides.
    let p = this.project(me.x, me.lying ? me.y + .5 : me.y + me.high, me.z, tanV, tanH, ex, ey, ez, px, py, pz);
    if (p.depth <= .2 || p.y > FRAME_TOP || Math.abs(p.x) > FRAME_SIDE) return false;
    p = this.project(me.x, me.y + .03, me.z, tanV, tanH, ex, ey, ez, px, py, pz);
    if (p.y < -FRAME_BOTTOM || Math.abs(p.x) > FRAME_SIDE) return false;
    if (foe && this.engaged > .3) {
      const fd = Math.hypot(foe.x - me.x, foe.z - me.z);
      p = this.project(foe.x, this.chest(foe), foe.z, tanV, tanH, ex, ey, ez, px, py, pz);
      if (p.depth <= .2 || Math.abs(p.x) > FRAME_SIDE || Math.abs(p.y) > FRAME_TOP + .25) return false;
      if (fd < FIT_WHOLE) {
        p = this.project(foe.x, foe.lying ? foe.y + .5 : foe.y + foe.high, foe.z, tanV, tanH, ex, ey, ez, px, py, pz); if (p.y > FRAME_TOP) return false;
        p = this.project(foe.x, foe.y + .03, foe.z, tanV, tanH, ex, ey, ez, px, py, pz); if (p.y < -FRAME_BOTTOM - .06) return false;
      }
    }
    for (let k = 0; k < i.threatCount; k++) {
      const t = i.threats[k]; if (foe && t.id === foe.id) continue;
      if ((this.weights.get(t.id) ?? 0) < THREAT_FIT) continue;
      p = this.project(t.x, this.chest(t), t.z, tanV, tanH, ex, ey, ez, px, py, pz);
      if (p.depth <= .2 || Math.abs(p.x) > FRAME_SIDE || Math.abs(p.y) > FRAME_TOP + .25) return false;
    }
    return true;
  }

  /** Where the lens would stand across the floor (into lensX0, lensZ0) for the composition `p` off the line, its shoulder
   *  at `side` (-1..1): behind the pivot that composition settles to - the player's body, the pull toward the fight and the
   *  shoulder to the lens's side - not the pivot of the moment, whose shoulder may be on the other side. */
  private lensFor(p: number, side: number, back: number, i: SmartInput) {
    const h = this.bearing + p + this.away, fx = Math.sin(h), fz = Math.cos(h), foe = i.foe;
    let px = this.bodyX + side * -fz * this.costShoulder, pz = this.bodyZ + side * fx * this.costShoulder;
    if (foe) { px += (foe.x - i.me.x) * this.costPull; pz += (foe.z - i.me.z) * this.costPull; }
    this.lensX0 = px - fx * back; this.lensZ0 = pz - fz * back;
  }
  private lensX0 = 0; private lensZ0 = 0; private costPull = 0; private costShoulder = 0;

  /** How far past what the stage allows a lens at (x, z) would stand, metres (0 inside, or with no bound), `margin` short of it. */
  private pastBound(x: number, z: number, i: SmartInput, margin = 0) { const b = i.bound; return b ? Math.max(0, Math.abs(x) - (b.halfX + b.out - margin), Math.abs(z) - (b.halfZ + b.out - margin)) : 0; }

  /** What composing the fight `p` radians off the line costs (see CHOOSE_*), the composition held now being `phi` and the
   *  lens standing `back` metres behind the pivot. */
  private costAt(p: number, phi: number, lo: number, hi: number, i: SmartInput, back: number) {
    const h = this.bearing + p + this.away, ex = this.pivotX - Math.sin(h) * back, ez = this.pivotZ - Math.cos(h) * back;
    const size = Math.abs(p), outside = size < lo ? (lo - size) * W_HIDDEN : size > hi ? size - hi : 0;
    let cost = outside * W_WINDOW + Math.abs(wrapped(p - phi)) * W_TURN;
    // A weighed threat the view would leave outside its sides costs its weight times how far outside (W_THREAT a radian),
    // judged from the player: a royale's crowd turns the view only by what it takes to keep the ones pressing in sight.
    if (this.threatSeen > 0) {
      const h = this.bearing + p + this.away, half = Math.atan(this.costTanH * THREAT_ZONE);
      for (let k = 0; k < i.threatCount; k++) {
        const t = i.threats[k]; if (i.foe && t.id === i.foe.id) continue;
        const w = this.weights.get(t.id) ?? 0; if (w < THREAT_SEEN) continue;
        const off = Math.abs(wrapped(Math.atan2(t.x - i.me.x, t.z - i.me.z) - h));
        if (off > half) cost += w * (off - half) * W_THREAT;
      }
    }
    cost += this.pastBound(ex, ez, i) * W_BOUND;
    // The opponent behind the player's own body as this lens would see them (W_HIDE at full cover): judged across the
    // floor, the player's breadth BODY_HALF a side (times their size) against the opponent's, the opponent further away.
    const foe = i.foe;
    if (foe) {
      const mx = i.me.x - ex, mz = i.me.z - ez, fx = foe.x - ex, fz = foe.z - ez, dm = Math.hypot(mx, mz), df = Math.hypot(fx, fz);
      if (df > dm + .2 && dm > .3) {
        const apart = Math.abs(Math.atan2(mx * fz - mz * fx, mx * fx + mz * fz)), cover = Math.atan(BODY_HALF * this.costScale / dm) + Math.atan(BODY_HALF * .6 * foe.high / 1.95 / df);
        if (apart < cover) cost += W_HIDE * (1 - apart / cover);
      }
    }
    return cost;
  }
}

/** One axis of a critically damped spring toward a fixed goal over `dt` (exact, so a hitch is the same motion), into
 *  `sprung`. */
const sprung = { x: 0, v: 0 };
function spring(x: number, v: number, goal: number, rate: number, dt: number) {
  if (dt <= 0) { sprung.x = x; sprung.v = v; return; }
  const decay = Math.exp(-rate * dt), offset = x - goal, drive = v + rate * offset;
  sprung.x = goal + (offset + drive * dt) * decay; sprung.v = (v - rate * drive * dt) * decay;
}
