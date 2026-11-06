
const TAU = Math.PI * 2;
const wrapped = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (x: number, a: number, b: number) => x < a ? a : x > b ? b : x;
const smooth = (x: number, a: number, b: number) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const blend = (rate: number, dt: number) => 1 - Math.exp(-rate * dt);
/** Toward `goal` at `up` per second when rising and `down` when falling. */
const ease = (value: number, goal: number, up: number, down: number, dt: number) => value + (goal - value) * blend(goal > value ? up : down, dt);

/** The heading controller (see `steer`): never faster than the frame's speed
 *  cap (rad/s), what it feeds forward included - SPEED for a duel, the
 *  owner-approved 150 deg/s of lock-on; up to CROSS_SPEED (round 4: 200 deg/s;
 *  round 4b: 230, the blind critic - "the target is off screen ~0.5 s and
 *  re-centring takes ~1 s ... faster but still calm") with an opponent outside
 *  the frame - and never past MAX_SPEED at all, under the
 *  400 deg/s the knockback tests allow; the acceleration toward the speed it wants is
 *  limited (ACCEL, CROSS_ACCEL) and so is the change of acceleration (JERK),
 *  so a swing starts and stops as an ease, never a kick; it brakes to arrive
 *  (BRAKE of the deceleration it has) and settles the last of it at GAIN.
 *  Integrated in 120 Hz substeps, like the lock-on assist. */
export const SPEED = 2.6, CROSS_SPEED = 4, MAX_SPEED = 6, ACCEL = 9, CROSS_ACCEL = 17, JERK = 120, BRAKE = .6, GAIN = 3.2, FOLLOW = 12, STEP = 1 / 120;
/** The opponent's bearing rate is fed forward (FF_SHARE of it, smoothed at
 *  FF_RATE), so a target circling the player is held where the composition
 *  puts them instead of trailing it by speed/GAIN; not inside FF_NEAR..FF_FULL
 *  metres, where the bearing swings faster than anybody moves. */
export const FF_SHARE = .85, FF_RATE = 8, FF_NEAR = 1.3, FF_FULL = 2.6;
/** The composition: the opponent FOE_ANGLE off the centre line on the far
 *  side from the shoulder, the line between the two never opening past
 *  MAX_OFFSET (FollowCamera's lock-on numbers, and its framingHeading
 *  formula, repeated so the brain imports nothing). */
export const FOE_ANGLE = .1, MAX_OFFSET = .8;
/** Which shoulder: the other one is taken when its framing is SIDE_MARGIN
 *  radians the shorter turn, for SIDE_HOLD seconds, no sooner than SIDE_REST
 *  after the last change; the lens crosses over in SIDE_TIME, rising SIDE_LIFT
 *  at the middle to look over the player's head while it is straight behind
 *  them.
 *
 *  Launch night: at any range. Round 4 kept the shoulder with the opponent
 *  inside SIDE_NEAREST (1.8 m), so at arm's length - where an opponent steps
 *  across the player's front every second or two - the heading was swung to
 *  the same shoulder's composition on their other side instead: ninety to a
 *  hundred and twenty degrees of view, and of the direction every key points,
 *  where the lens crossing two metres behind the player's back turns neither
 *  (measured in the scripted brawls: most of the 4,000 degrees a minute). And
 *  while the other shoulder is the one wanted - the beat it is held for, the
 *  rest since the last change - the heading is steered for that shoulder's
 *  window, not swung toward the composition about to be left. */
export const SIDE_MARGIN = .5, SIDE_HOLD = .12, SIDE_REST = 1.2, SIDE_TIME = .6, SIDE_LIFT = .35;
/** A swing of more than SWING_BIG radians to either composition - a target
 *  behind the player, passing behind the lens - turns toward the side the
 *  target is on, whichever shoulder that brings round first. */
export const SWING_BIG = 1.1;
/** The cross-up's extra speed (CROSS_SPEED) is taken up at URGENT_IN while the
 *  target is outside the frame and given back at URGENT_OUT once it is in it
 *  again, so a swing eases back to SPEED as the target comes into view rather
 *  than carrying 200 deg/s across the frame (measured in the harbour duel: a
 *  slower give-back left 103 of 177 frames over 150 deg/s with the target
 *  already in view). */
export const URGENT_IN = 8, URGENT_OUT = 6;
/** The target is the fight within the lock-on's ranges: an auto-selected one
 *  out to SOFT_NEAR, gone by SOFT_FAR; a Tab lock to HARD_NEAR..HARD_FAR. The
 *  framing holds still while the target is within DEAD_ZONE (horizontally) and
 *  is at full strength from FULL_ASSIST. */
export const SOFT_NEAR = 14, SOFT_FAR = 22, HARD_NEAR = 34, HARD_FAR = 44, DEAD_ZONE = .45, FULL_ASSIST = .9;
/** Who else is in the fight. An attacker (Targeting's rule: aiming at the
 *  player, mid-swing, within the move's range plus three metres) weighs
 *  W_ATTACK, whoever hit the player in the last HIT_FOR seconds W_HIT, anybody
 *  else hostile and near W_NEAR (fading over 5..9 m); all of it fades out over
 *  GROUP_NEAR..GROUP_FAR metres. Threats are those weighing THREAT or more. */
export const W_ATTACK = .9, W_HIT = .75, W_NEAR = .2, HIT_FOR = 3, GROUP_NEAR = 9, GROUP_FAR = 13, THREAT = .5;
/** Group framing: candidate headings DELTA_STEP apart out to DELTA_MOST either
 *  side of the duel's, each scored by the weight of what it holds inside
 *  FRAME_SAFE of the half-width (and a little for holding it nearer the
 *  middle), less TURN_COST per radian; the target must stay within
 *  TARGET_SAFE. The chosen offset is followed at DELTA_SPEED. The stand-back
 *  for the group - GROUP_BOOM metres back, GROUP_LIFT up and GROUP_FOV degrees
 *  wider at full - is wanted as threats stand off the duel's heading, taken
 *  up at GROUP_IN and given back at GROUP_OUT. */
export const DELTA_STEP = .07, DELTA_MOST = 1.05, FRAME_SAFE = .8, TARGET_SAFE = .78, TURN_COST = .35, DELTA_SPEED = 1.2, DELTA_ACCEL = 5, DELTA_GAIN = 4;
export const GROUP_BOOM = 1.5, GROUP_LIFT = .7, GROUP_FOV = 5, GROUP_IN = 3, GROUP_OUT = .55;
export const LEAD_TIME = .16, LEAD_MOST = 1.1, AHEAD_PER = .22, AHEAD_MOST = 1.7, LEAD_RATE = 3.5, EXPLORE_BOOM = .3, EXPLORE_LIFT = .3;
/** Every dynamic shot stands DYN_BOOM further back and DYN_LIFT higher than
 *  lock-on's 3.1 m over the shoulder: "the lens is tight" was half of why it
 *  felt stiff. */
export const DYN_BOOM = .5, DYN_LIFT = .1;
/** The field: BASE_FOV, DASH_FOV wider through a dash, RUN_FOV running flat
 *  out with nobody near, GROUP_FOV for a group, PLUNGE_FOV for a ground
 *  smash, never outside FOV_LEAST..FOV_MOST. (Launch night: a dash widened it
 *  four degrees, and a fight is full of dashes - the field breathed four
 *  hundred degrees a minute. One and a half now, and one for a run.) */
export const BASE_FOV = 50, DASH_FOV = 1.5, RUN_FOV = 1, PLUNGE_FOV = 3, FOV_LEAST = 45, FOV_MOST = 60;
/** Vertical: a target in the air off a launch lifts the lens JUGGLE_LIFT and
 *  stands it JUGGLE_BOOM back (FollowCamera's vertical framing tilts after
 *  the body); the player's own ground smash raises it PLUNGE_LIFT, stands it
 *  PLUNGE_BOOM back and drops the look PLUNGE_FOCUS, to show where it lands; a
 *  target on the floor is read from DOWN_BOOM back and DOWN_LIFT up. */
export const JUGGLE_LIFT = .3, JUGGLE_BOOM = .35, PLUNGE_LIFT = 1, PLUNGE_BOOM = .9, PLUNGE_FOCUS = -.25, DOWN_BOOM = .45, DOWN_LIFT = .3;
/** The player's own turning: a turn at YIELD_FULL rad/s (25 deg/s) or more
 *  and the brain lets go entirely - a slow deliberate pan is not something to
 *  pull against - while one under YIELD_FROM is a hand resting on the mouse; it holds off for YIELD_HOLD after the last of it and comes back
 *  over YIELD_BACK, eased. Meanwhile a target past EDGE of the half-field is
 *  kept just inside it, at EDGE_SPEED - so long as it is not already out past
 *  EDGE_OUT, which is the player looking away on purpose. */
export const YIELD_FROM = .05, YIELD_FULL = .45, YIELD_HOLD = .3, YIELD_BACK = 1, EDGE = .78, EDGE_OUT = 1.08, EDGE_SPEED = 1.2;
/** And the way back to the composition after the player has looked away is
 *  unhurried: the speed cap is RETURN_SHARE of itself as the brain takes
 *  over again, all of it RETURN_AFTER seconds after that (unless the target
 *  is outside the frame, which is a cross-up's business). Measured in the
 *  harbour: a 76-degree look let go swung back at 140 deg/s, lock-on's own
 *  pace. */
export const RETURN_SHARE = .6, RETURN_AFTER = 1.2;
/** Round 4b: a change of opponent (see the header). The move takes
 *  1.875 x the turn / SWITCH_SPEED (rad/s; OUT_SWITCH_SPEED for one starting
 *  outside the frame) - the minimum-jerk path's peak speed is 1.875 times its
 *  mean - within SWITCH_LEAST..SWITCH_MOST seconds, its peak never past
 *  SWITCH_PEAK whatever the opponent does meanwhile; never less than
 *  SWITCH_TAIL of it is planned for, so the last frames do not have to rush;
 *  the goal it makes for is followed at SWITCH_FOLLOW/s (a shoulder or a
 *  group offset changing under it is a curve, not a kink); a turn under
 *  SWITCH_FROM radians is the controller's ordinary business. Over the move
 *  the lens breathes out by SWITCH_BOOM metres, SWITCH_LIFT up and SWITCH_FOV
 *  degrees wider at the middle (sin squared), scaled by the size of the turn.
 *  Launch night ("target switches that do not whip"): the pan's mean speed is
 *  86 deg/s where it was 132 (138 from outside the frame, was 178), its peak
 *  never past 150 (was 206), it may take 1.4 s (was 1), the breath is about
 *  half what it was - and it only goes as far as the new opponent's window
 *  (CALM_*): one already standing in it is not panned to at all. */
export const SWITCH_SPEED = 1.5, OUT_SWITCH_SPEED = 2.4, SWITCH_PEAK = 2.6, SWITCH_LEAST = .55, SWITCH_MOST = 1.4, SWITCH_TAIL = .25, SWITCH_FOLLOW = 10, SWITCH_FROM = .1,
  SWITCH_BOOM = .4, SWITCH_LIFT = .15, SWITCH_FOV = 2;
/** The challenger CameraFocus is weighing weighs up to PENDING_WEIGHT as its
 *  case grows, so the group framing holds it before it takes the shot. */
export const PENDING_WEIGHT = .9;
export const CALM_INNER = .3, CALM_KEEP = .1, CALM_OUTER = .5, CALM_NEAR = 1.6, CALM_FAR = 2.8, CALM_FF = .03, CALM_GAIN = 2.2, CALM_ACCEL = 5.5, CALM_GROUP = .5;
/** A cross-up seen coming: the opponent's place CROSS_LEAD seconds ahead (at
 *  the pair's closing speed, from CROSS_FROM m/s) is framed as soon as it is
 *  behind the composition - for a pair passing each other at least CROSS_MISS
 *  metres apart (a dive or a dash straight at them stops at them, however far
 *  past it extrapolates), and never by changing shoulder. */
export const CROSS_LEAD = .22, CROSS_FROM = 5, CROSS_MISS = .7;
/** Tall air (the bodies AIR_FROM..AIR_FULL metres over the floor the player
 *  last stood on): the lens AIR_BOOM2 back, AIR_LIFT2 up and AIR_FOV2 wider. */
export const AIR_FROM = 1.4, AIR_FULL = 5, AIR_BOOM2 = 1.1, AIR_LIFT2 = .35, AIR_FOV2 = 4;
/** The pitch levels itself back to PITCH_LEVEL - the input's own resting
 *  pitch, which every rig here was composed at - PITCH_REST seconds after the
 *  player last tilted it, at PITCH_RATE. */
export const PITCH_LEVEL = .02, PITCH_REST = 1.4, PITCH_RAMP = .8, PITCH_RATE = .9;

/** One body the shot may be about, filled in place by FollowCamera. */
export interface Subject {
  id: string; x: number; y: number; z: number;
  /** Crown over the root, and the body's radius, for the frame tests. */
  high: number; radius: number;
  /** The player's current target (hard or soft). */
  target: boolean;
  /** Attacking the player now (Targeting's rule). */
  attacking: boolean;
  /** Seconds since it last hit the player (Infinity: never). */
  hitAgo: number;
  airborne: boolean; lying: boolean; launched: boolean;
  /** Written by the brain: how much this body is the fight, 0..1. */
  weight: number;
}
export const subject = (): Subject => ({ id: '', x: 0, y: 0, z: 0, high: 1.95, radius: .3, target: false, attacking: false, hitAgo: Infinity, airborne: false, lying: false, launched: false, weight: 0 });

/** What the brain is told each frame. FollowCamera keeps one and refills it. */
export interface BrainInput {
  dt: number;
  /** The player: root, travel along the floor (m/s), and what they are doing. */
  x: number; y: number; z: number; vx: number; vz: number;
  grounded: boolean; dashing: boolean; plunging: boolean; reacting: boolean;
  /** Whether a run's direction is held while the camera turns (see
   *  FollowCamera.movementBasis): the recentre only turns behind a run that
   *  will not turn with it. */
  basisHeld: boolean;
  /** The lens as last placed: the heading (with this frame's own turning
   *  already in it), how far it stands behind the anchor along the floor,
   *  how far right of the heading line (signed), the horizontal half-tangent. */
  heading: number; back: number; shoulder: number; tanH: number;
  /** Launch night, second pass: the lens where it actually stands when the stage's bound has squeezed the rig
   *  (FollowCamera SQUEEZE_*) - nearer, and less to one side, than `back` and `shoulder` (the same, with room). Only
   *  for telling whether the opponent is in the frame: the composition is still solved from the rig at rest, so a wall
   *  never moves the goal - but a lens that has come in sees less to either side, and an opponent it has lost is
   *  turned to at the pace of one outside the frame, which they are. */
  lensBack: number; lensShoulder: number;
  /** The player's own turning this frame (radians) and whether they tilted. */
  manual: number; tilted: boolean;
  locked: boolean;
  /** The composition's own: how far the close-quarters swing has opened the
   *  framing (0..1) and the opponent's angle off centre (FOE_ANGLE, more for
   *  Kurobi). */
  engage: number; foe: number;
  subjects: readonly Subject[]; count: number;
  /** Round 4b: the challenger CameraFocus is weighing ('' for none) and how
   *  far its case has got (0..1); the floor the player last stood on. */
  pending: string; pendingShare: number; floor: number;
  /** Round 4b: how far a form with a rig of its own is drawn (FollowCamera's
   *  foxness, 0..1): its rig stands out past the form's right flank, so the
   *  shot keeps the right shoulder (the blind critic: the dynamic camera took
   *  the left one round Kurobi and the fox went behind the move cards). */
  form: number;
}
export const brainInput = (): BrainInput => ({ dt: 0, x: 0, y: 0, z: 0, vx: 0, vz: 0, grounded: true, dashing: false, plunging: false, reacting: false, basisHeld: false,
  heading: 0, back: 3.1, shoulder: 1.05, lensBack: NaN, lensShoulder: NaN, tanH: Math.tan(25 * Math.PI / 180) * 16 / 9, manual: 0, tilted: false, locked: false, engage: 0, foe: FOE_ANGLE, subjects: [], count: 0,
  pending: '', pendingShare: 0, floor: 0, form: 0 });

export type BrainMode = 'idle' | 'explore' | 'duel' | 'group';

/** The calm window (CALM_*) for an opponent `distance` metres off: how far short of the composition's own angle off
 *  the line to them (`own`, radians) the view may rest, and how far past it. */
export function calmInner(distance: number, own: number) { return clamp(own - CALM_KEEP, 0, CALM_INNER * (1 - smooth(distance, CALM_NEAR, CALM_FAR))); }
export function calmOuter(distance: number) { return CALM_OUTER * (1 - smooth(distance, CALM_NEAR, CALM_FAR)); }

/** The heading that puts a target `distance` off at `bearing` on `foe` for a
 *  lens `shoulder` right of the heading line (signed: left is negative) and
 *  `back` behind the anchor - FollowCamera's framingHeading, mirrored for the
 *  left shoulder. */
export function framing(bearing: number, distance: number, shoulder: number, back: number, most = MAX_OFFSET, foe = FOE_ANGLE) {
  const side = shoulder < 0 ? -1 : 1, s = Math.abs(shoulder);
  const reach = s * Math.cos(foe) + back * Math.sin(foe);
  return bearing + side * (foe + Math.asin(Math.min(reach / Math.max(distance, 1e-3), Math.sin(most - foe))));
}
/** Where a body at (x, z) falls across the frame - its edges at -1 and +1 -
 *  for a lens `back` behind (px, pz) and `shoulder` right of the heading line,
 *  looking along `heading`; NaN when it is not in front of the lens. */
export function across(x: number, z: number, px: number, pz: number, heading: number, back: number, shoulder: number, tanH: number) {
  const sh = Math.sin(heading), ch = Math.cos(heading);
  const ex = px - sh * back - ch * shoulder, ez = pz - ch * back + sh * shoulder;
  const dx = x - ex, dz = z - ez, depth = dx * sh + dz * ch;
  return depth > .5 ? (dz * sh - dx * ch) / (depth * tanH) : NaN;
}

/** The gameplay shots (FollowCamera's `play` layer): a launch's lift, a
 *  knockdown or splat's punch-in, a ground smash's pull-back. Short and
 *  cosmetic - laid over the frame after the movement heading is taken - and
 *  rationed: never within SHOT_GAP of the last, never during the player's own
 *  string unless it is the string's ender, never over an authored shot. */
export type PlayKind = 'launch' | 'knockdown' | 'splat' | 'smash';
export const SHOT_GAP = 2.5;
export const PLAY_LENGTH: Record<PlayKind, number> = { launch: .7, knockdown: .62, splat: .45, smash: .75 };
const PLAY_SHAPE: Record<PlayKind, { back: number; up: number; tilt: number; fov: number; trauma: number; rise: number; hold: number; turn: number }> = {
  launch: { back: .25, up: -.15, tilt: -.065, fov: 2.5, trauma: 0, rise: .16, hold: .22, turn: 0 },
  knockdown: { back: -.15, up: .05, tilt: .015, fov: -2, trauma: .06, rise: .08, hold: .12, turn: 0 },
  splat: { back: -.15, up: .025, tilt: 0, fov: -2, trauma: .08, rise: .08, hold: .12, turn: 0 },
  smash: { back: .55, up: .3, tilt: .02, fov: 2, trauma: .2, rise: .12, hold: .15, turn: 0 },
};
const shape = { w: 0, back: 0, up: 0, tilt: 0, fov: 0, trauma: 0, turn: 0 };
/** The weight and the shape of a shot `t` seconds in: up over `rise` (eased),
 *  held for `hold`, let go over the rest of its length (eased); the turn
 *  comes in behind the rest and goes out over the last of it. One object,
 *  rewritten by every call: read it before the next. */
export function playShape(kind: PlayKind, t: number) {
  const s = PLAY_SHAPE[kind], length = PLAY_LENGTH[kind];
  const w = t < 0 || t >= length ? 0 : t < s.rise ? smooth(t, 0, s.rise) : t < s.rise + s.hold ? 1 : 1 - smooth(t, s.rise + s.hold, length);
  const follow = t < 0 || t >= length ? 0 : smooth(t, s.rise * .5, s.rise + s.hold + .1) * (1 - smooth(t, length - .22, length));
  shape.w = w; shape.back = s.back * w; shape.up = s.up * w; shape.tilt = s.tilt * w; shape.fov = s.fov * w; shape.trauma = s.trauma; shape.turn = s.turn * follow;
  return shape;
}
/** Whether a cued shot may play now (see SHOT_GAP). `stringing`: the player
 *  is mid-string; `ender`: the cue is that string's ender; `authored`: an
 *  authored shot (CameraDirector) is on screen. */
export class ShotGate {
  last = -Infinity;
  allow(now: number, stringing: boolean, ender: boolean, authored: boolean) {
    if (authored || now - this.last < SHOT_GAP || (stringing && !ender)) return false;
    this.last = now; return true;
  }
  reset() { this.last = -Infinity; }
}

export class CameraBrain {
  /** Outputs, rewritten by every `think`: the heading to make for (NaN: hold;
   *  the input heading plus the turn decided on, so its way round is meant),
   *  how hard (0..1), the speed cap and the acceleration for it, the rate to
   *  feed forward (rad/s); the shoulder side (-1..1, eased); the rig's
   *  offsets over the lock-on rig (metres; `ahead` along the look, `leadX`/
   *  `leadZ` a translation of the whole rig, which leaves the heading and so
   *  the movement basis exactly as they are); the field (degrees); the pitch
   *  to level toward (NaN: leave it) and the rate. */
  goal = NaN; gain = 0; speed = SPEED; accel = ACCEL; ff = 0; side = 1;
  /** What `steer` settles the last of a turn at, per second (GAIN; CALM_GAIN after an opponent in the frame). */
  rate = GAIN;
  boom = DYN_BOOM; lift = DYN_LIFT; focus = 0; ahead = 0; leadX = 0; leadZ = 0; fov = BASE_FOV; pitchGoal = NaN; pitchRate = 0;
  /** Launch night (CALM_*): the window round `goal` the heading may rest in, as the turns still to make that are let
   *  be - `slackLo` (zero or less) to `slackHi` (zero or more), radians. Both zero: the goal is a point (a target outside
   *  the frame, a cross-up, the player aiming, nobody framed). `steer` reads them; FollowCamera zeroes them (`exact`)
   *  for a frame in which its own turn away from a body in the way is on the goal. */
  slackLo = 0; slackHi = 0;
  mode: BrainMode = 'idle';
  /** Eased presences, for the outputs and the evidence: how much this is a
   *  duel, a group fight, a run; how far the brain is yielding to the player. */
  duel = 0; group = 0; explore = 0; yieldTo = 0;
  /** The controller's state (see `steer`), and how many substeps of the
   *  last one it wrote into the trace it was handed. */
  velocity = 0; acceleration = 0; traced = 0;
  private clock = 0;
  private sideGoal = 1; private sideFrom = 1; private sideAt = -Infinity; private sideWant = 0;
  private steerAt = -Infinity; private steerPeak = 0; private pitchAt = -Infinity;
  private delta = 0; private deltaVelocity = 0; private deltaGoal = 0;
  private urgent = 0; private juggle = 0; private plunge = 0; private down = 0; private dash = 0;
  private bearing = NaN; private bearingRate = 0; private targetId = '';
  private leadVX = 0; private leadVZ = 0; private aheadV = 0;
  private steered = false;
  /** Which way a big swing goes (see SWING_BIG); 0 between them. */
  private swingWay = 0;
  /** Round 4b: the change of opponent under way (SWITCH_*): when it began on
   *  this clock (-Infinity: none), how long it is planned to take, the turn it
   *  set out to make (radians) and whether it was urgent. `switching` is the
   *  lens's breath (0..1) and `switchShare` how far through it is, for the
   *  rig and the evidence. */
  switching = 0; switchShare = 0;
  /** Round 4b: a cross-up was seen coming this frame (CROSS_LEAD), for the evidence. */
  foresaw = false;
  private swAt = -Infinity; private swDur = 0; private swSize = 0; private swGoal = 0; private swWay = 0;
  /** Tall air (AIR_*), and the target's own travel (for CROSS_LEAD). */
  private airIn = 0;
  private tvx = 0; private tvz = 0; private tlx = NaN; private tlz = NaN;

  reset() {
    this.goal = NaN; this.gain = 0; this.speed = SPEED; this.accel = ACCEL; this.ff = 0; this.side = 1; this.rate = GAIN;
    this.boom = DYN_BOOM; this.lift = DYN_LIFT; this.focus = 0; this.ahead = 0; this.leadX = this.leadZ = 0; this.fov = BASE_FOV; this.pitchGoal = NaN; this.pitchRate = 0;
    this.mode = 'idle'; this.duel = this.group = this.explore = this.yieldTo = 0; this.velocity = this.acceleration = 0;
    this.clock = 0; this.sideGoal = this.sideFrom = 1; this.sideAt = -Infinity; this.sideWant = 0;
    this.steerAt = -Infinity; this.steerPeak = 0; this.pitchAt = -Infinity; this.slackLo = this.slackHi = 0;
    this.delta = this.deltaVelocity = this.deltaGoal = 0; this.urgent = this.juggle = this.plunge = this.down = this.dash = 0;
    this.bearing = NaN; this.bearingRate = 0; this.targetId = ''; this.leadVX = this.leadVZ = this.aheadV = 0; this.steered = false; this.swingWay = 0;
    this.switching = this.switchShare = 0; this.swAt = -Infinity; this.swDur = this.swSize = this.swGoal = 0;
    this.airIn = 0; this.tvx = this.tvz = 0; this.tlx = this.tlz = NaN;
  }
  /** Whether a change of opponent is being made (see SWITCH_*). */
  get switchActive() { return this.swAt > -Infinity; }
  /** This frame's goal is a point, not a window (CALM_*): FollowCamera, when it has laid its own turn on it. `brisk`
   *  (the view as it stands hides the opponent): at the duel's own pace, not the window's gentler one. */
  exact(brisk = false) { this.slackLo = this.slackHi = 0; if (brisk) { this.rate = Math.max(this.rate, GAIN); this.accel = Math.max(this.accel, ACCEL); } }
  /** Launch day: for a camera that takes the brain's presences and rig offsets but turns its own heading
   *  (FollowCamera's arena camera, which never calls `steer`): a change of opponent's plan is over once its time has
   *  run, so the breath it gives the lens (SWITCH_*) plays once and `switchActive` does not stay set. */
  settle() { if (this.swAt > -Infinity && this.clock - this.swAt >= this.swDur) this.swAt = -Infinity; }
  /** `error` (a turn still to make) less what of it the window lets be (CALM_*): the turn to its nearest edge. */
  past(error: number) { return error - clamp(error, this.slackLo, this.slackHi); }

  /** Decide this frame's shot from `i` (see the outputs). */
  think(i: BrainInput) {
    const dt = clamp(Number.isFinite(i.dt) ? i.dt : 0, 0, .25);
    this.clock += dt;
    const now = this.clock, H = i.heading;
    // The player's own turning: yield in proportion, come back eased.
    const rate = dt > 0 ? Math.abs(i.manual) / dt : 0, y = smooth(rate, YIELD_FROM, YIELD_FULL);
    const held = this.steerPeak * (1 - smooth(now - this.steerAt, YIELD_HOLD, YIELD_HOLD + YIELD_BACK));
    if (y > .02 && y >= held - 1e-9) { this.steerPeak = y; this.steerAt = now; }
    this.steered = y > .02;
    this.yieldTo = Math.max(y, held);
    if (i.tilted) this.pitchAt = now;
    // Who is in the fight, and how much.
    let target: Subject | undefined, threatSum = 0, threats = 0;
    for (let k = 0; k < i.count; k++) {
      const s = i.subjects[k], d = Math.hypot(s.x - i.x, s.z - i.z);
      if (s.target) {
        const range = i.locked ? 1 - smooth(d, HARD_NEAR, HARD_FAR) : 1 - smooth(d, SOFT_NEAR, SOFT_FAR);
        s.weight = range; if (range > 0) target = s;
        continue;
      }
      let w = s.attacking ? W_ATTACK : s.hitAgo < HIT_FOR ? W_HIT * (1 - smooth(s.hitAgo, HIT_FOR - 1, HIT_FOR)) : W_NEAR * (1 - smooth(d, 5, 9));
      // Round 4b: the challenger the focus is weighing is held in the frame as its case grows.
      if (i.pending && s.id === i.pending) w = Math.max(w, PENDING_WEIGHT * clamp(i.pendingShare, 0, 1));
      s.weight = w * (1 - smooth(d, GROUP_NEAR, GROUP_FAR));
      if (s.weight >= THREAT) { threats++; threatSum += s.weight; }
    }
    const targetW = target ? target.weight : 0;
    const speed = Math.hypot(i.vx, i.vz);
    // Eased presences.
    this.duel = ease(this.duel, targetW, 4, 3, dt);
    this.explore = ease(this.explore, !target && threats === 0 ? smooth(speed, 1, 4) : 0, 1.5, 4, dt);
    this.dash = ease(this.dash, i.dashing ? 1 : 0, 10, 2.5, dt);
    this.plunge = ease(this.plunge, i.plunging ? 1 : 0, 6, 1.2, dt);
    this.juggle = ease(this.juggle, target && target.launched && target.airborne ? 1 : 0, 5, 1.5, dt);
    this.down = ease(this.down, target && target.lying ? 1 : 0, 4, 1, dt);
    let goal = NaN, gain = 0, speedCap = SPEED, accel = ACCEL, ff = 0, settle = GAIN;
    let groupWant = 0;
    this.slackLo = this.slackHi = 0;
    if (target) {
      const dx = target.x - i.x, dz = target.z - i.z, d = Math.hypot(dx, dz), bearing = Math.atan2(dx, dz);
      // Round 4b: a different opponent from the last frame's is a switch (SWITCH_*).
      const switched = this.targetId !== '' && target.id !== this.targetId;
      // The target's own travel, for the cross-up seen coming (CROSS_LEAD).
      if (target.id === this.targetId && Number.isFinite(this.tlx) && dt > 0) {
        const vx = (target.x - this.tlx) / dt, vz = (target.z - this.tlz) / dt;
        if (Math.hypot(vx, vz) < 40) { const k = blend(10, dt); this.tvx += (vx - this.tvx) * k; this.tvz += (vz - this.tvz) * k; } else this.tvx = this.tvz = 0;
      } else this.tvx = this.tvz = 0;
      this.tlx = target.x; this.tlz = target.z;
      // The bearing's own rate, fed forward (FF_*); a new target starts it
      // afresh, and so does a bearing that jumped (a body passing through or
      // over the player: its rate then means nothing).
      const jump = Number.isFinite(this.bearing) ? wrapped(bearing - this.bearing) : 0;
      if (target.id === this.targetId && Number.isFinite(this.bearing) && dt > 0 && Math.abs(jump) < .6)
        this.bearingRate += (clamp(jump / dt, -MAX_SPEED, MAX_SPEED) - this.bearingRate) * blend(FF_RATE, dt);
      else this.bearingRate = 0;
      this.bearing = bearing; this.targetId = target.id;
      const most = MAX_OFFSET + .2 * i.engage, s = Math.abs(i.shoulder) || 1e-3;
      const right = framing(bearing, d, s, i.back, most, i.foe), left = framing(bearing, d, -s, i.back, most, i.foe);
      // The two compositions as turns from the heading, and where the target
      // falls across the frame now.
      let eR = wrapped(right - H), eL = wrapped(left - H);
      // (From the lens as it stands: squeezed by a wall, it sees less to either side. NaN: the rig's own.)
      const x = across(target.x, target.z, i.x, i.z, H, Number.isFinite(i.lensBack) ? i.lensBack : i.back, Number.isFinite(i.lensShoulder) ? i.lensShoulder : i.shoulder, i.tanH);
      // Round 4b: a cross-up seen coming. The pair closing fast (a dash past
      // them), where the opponent will be CROSS_LEAD seconds on is framed as
      // soon as that place is behind the composition, rather than once they
      // have left the frame - the swing starts while they are still in it.
      let foreseen = false, seen = bearing;
      const rvx = this.tvx - i.vx, rvz = this.tvz - i.vz;
      if (!switched && Math.hypot(rvx, rvz) > CROSS_FROM && Math.abs(x) <= 1) {
        const px = dx + rvx * CROSS_LEAD, pz = dz + rvz * CROSS_LEAD, pd = Math.hypot(px, pz);
        // (Past them: the place ahead is on the far side of the player from
        // where they are now. A head-on approach that stops short is not a
        // cross-up, however close it brings them.)
        const speedR = Math.hypot(rvx, rvz), miss = Math.abs(dx * rvz - dz * rvx) / speedR;
        if (pd >= 1 && d >= DEAD_ZONE && dx * px + dz * pz < 0 && miss >= CROSS_MISS) {
          const pb = Math.atan2(px, pz), pR = wrapped(framing(pb, pd, s, i.back, most, i.foe) - H), pL = wrapped(framing(pb, pd, -s, i.back, most, i.foe) - H);
          // Out of the frame by then, or a big swing away.
          const xp = across(i.x + px, i.z + pz, i.x, i.z, H, i.back, i.shoulder, i.tanH);
          if (!(Math.abs(xp) <= 1) || Math.min(Math.abs(pR), Math.abs(pL)) > SWING_BIG) { eR = pR; eL = pL; foreseen = true; seen = pb; }
        }
      }
      let turn: number, judged = this.sideGoal;
      const swinging = (!(Math.abs(x) <= 1) || foreseen || Math.min(Math.abs(eR), Math.abs(eL)) > SWING_BIG) && d >= DEAD_ZONE;
      if (swinging) {
        // Out of the frame, or a big swing away - a cross-up, a pass through
        // them: turned toward the side they are on (or the way a swing
        // already goes), over the shoulder that is nearer that way round, at
        // once. Either shoulder's composition the other way round - the
        // shorter turn by a few degrees when they stand behind - showed the
        // target 40-90 degrees of turning later (measured in the harbour: a
        // light that carried the player through the bot swung the long way
        // for half a second, then back).
        // (A target straight behind is on whichever side the last decision put
        // it, so a centimetre either way does not flip the swing.)
        const rel = wrapped(seen - H);
        // (A new opponent is turned to the short way, whatever the lens was
        // doing for the last one: the switch's plan starts from that motion.)
        const way = switched ? Math.sign(rel) || 1 : this.swAt > -Infinity && this.swWay ? this.swWay : Math.abs(this.velocity) > .15 ? Math.sign(this.velocity) : this.swingWay !== 0 && Math.abs(rel) > 2.6 ? this.swingWay : Math.sign(rel) || 1;
        this.swingWay = way;
        const turnR = way * eR >= 0 ? eR : eR + way * TAU, turnL = way * eL >= 0 ? eL : eL + way * TAU;
        // (Not while the player aims: the lens is theirs to turn, not to slide.)
        const pick = i.form > .5 ? 1 : this.yieldTo >= .5 || foreseen ? this.sideGoal : Math.abs(turnL) < Math.abs(turnR) ? -1 : 1;
        if (pick !== this.sideGoal) { this.sideFrom = this.side; this.sideGoal = pick; this.sideAt = now; }
        this.sideWant = 0; turn = pick > 0 ? turnR : turnL; judged = pick;
        // Nothing fed forward against the swing.
        if (Math.sign(this.bearingRate) !== Math.sign(turn)) this.bearingRate = 0;
      } else {
        this.swingWay = 0;
        // In it: the other shoulder only when it is much the shorter way
        // round, held a beat (SIDE_*).
        const want = i.form > .5 ? 1 : Math.abs(eL) + SIDE_MARGIN < Math.abs(eR) ? -1 : Math.abs(eR) + SIDE_MARGIN < Math.abs(eL) ? 1 : this.sideGoal;
        judged = this.sideGoal;
        if (want !== this.sideGoal && this.yieldTo < .5 && this.swAt === -Infinity) {
          this.sideWant += dt; judged = want;
          if (this.sideWant >= SIDE_HOLD && now - this.sideAt >= SIDE_REST) { this.sideFrom = this.side; this.sideGoal = want; this.sideAt = now; this.sideWant = 0; }
        } else this.sideWant = 0;
        turn = judged > 0 ? eR : eL;
      }
      const duelGoal = H + turn;
      // Launch night (CALM_*): the window round that composition the heading may rest in. A swing after a target
      // outside the frame ends at its edge too: they are in the frame from there.
      if (d >= DEAD_ZONE) {
        const own = Math.abs(wrapped((judged > 0 ? right : left) - bearing));
        const share = threats === 0 ? 1 : Math.abs(this.deltaGoal) > 1e-3 || Math.abs(this.delta) > .02 ? 0 : CALM_GROUP;
        const inner = calmInner(d, own) * share, outer = calmOuter(d) * share;
        // (Over the right shoulder the composition is the line turned left by its own angle: a turn still to make to
        // the left is the view short of it, one to the right the view past it. Mirrored over the left.)
        this.slackLo = -(judged > 0 ? outer : inner); this.slackHi = judged > 0 ? inner : outer;
      }
      // The group (GROUP_*): the offset off the duel's heading that holds the
      // most of it, and the stand-back the rest of it wants.
      let need = 0;
      for (let k = 0; k < i.count; k++) {
        const o = i.subjects[k]; if (o.target || o.weight < THREAT) continue;
        const off = Math.abs(wrapped(Math.atan2(o.x - i.x, o.z - i.z) - duelGoal));
        need = Math.max(need, o.weight * smooth(off, .45, 1.4));
      }
      groupWant = clamp(need + .25 * smooth(threatSum, .5, 1.5), 0, 1);
      this.deltaGoal = threats > 0 ? this.bestDelta(i, duelGoal, target) : 0;
      // Urgency: the target outside the frame altogether - a cross-up - swings faster.
      this.foresaw = foreseen;
      this.urgent = ease(this.urgent, !(Math.abs(x) <= 1) ? 1 : foreseen ? .5 : 0, URGENT_IN, URGENT_OUT, dt);
      goal = duelGoal + this.delta;
      // Round 4b: the switch's plan (SWITCH_*), from where the heading is now. Launch night: as far as the new
      // opponent's window, and no plan at all for one already inside it.
      const toWindow = this.past(goal - H);
      if (switched && dt > 0 && this.yieldTo < .5 && Math.abs(toWindow) >= SWITCH_FROM) {
        this.swAt = now; this.swSize = Math.abs(toWindow); this.swGoal = H + toWindow; this.swWay = Math.sign(toWindow);
        this.swDur = clamp(1.875 * this.swSize / (!(Math.abs(x) <= 1) ? OUT_SWITCH_SPEED : SWITCH_SPEED), SWITCH_LEAST, SWITCH_MOST);
      }
      gain = targetW * smooth(d, DEAD_ZONE, FULL_ASSIST);
      const back = RETURN_SHARE + (1 - RETURN_SHARE) * smooth(now - this.steerAt, YIELD_HOLD, YIELD_HOLD + YIELD_BACK + RETURN_AFTER);
      speedCap = SPEED * (back + (1 - back) * this.urgent) + (CROSS_SPEED - SPEED) * this.urgent;
      // (CALM_*: gentler after an opponent who is in the frame; a swing after one who is not keeps the pace it had -
      // and so does a turn from the window's near edge, where the opponent is about to go behind the player's own back.)
      // (Second pass: and so does all of it from CALM_FAR on, where the window is shut. The gentler pace is for the
      // window's far edge; kept at range too, a player running along a wall with the opponent chasing from one side
      // had them out of the frame's side in 6% of frames where it had been 3%.)
      const near = toWindow * judged > 0, wide = 1 - smooth(d, CALM_NEAR, CALM_FAR), calmAccel = near ? ACCEL : ACCEL + (CALM_ACCEL - ACCEL) * wide, calmGain = near ? GAIN : GAIN + (CALM_GAIN - GAIN) * wide;
      accel = calmAccel + (CROSS_ACCEL - calmAccel) * this.urgent; settle = calmGain + (GAIN - calmGain) * this.urgent;
      ff = FF_SHARE * this.bearingRate * smooth(d, FF_NEAR, FF_FULL) * targetW;
      // While the player aims, only a target about to leave the frame is
      // kept inside its edge (EDGE_*).
      if (this.yieldTo > 0) {
        const angle = Math.atan(Math.abs(x) * i.tanH), half = Math.atan(i.tanH);
        const edge = Number.isFinite(x) && angle > EDGE * half && angle < EDGE_OUT * half ? Math.sign(x) * (angle - EDGE * half) : 0;
        // A target right of the frame needs the heading turned right: a
        // smaller angle (FollowCamera's right is the forward turned back).
        // (The way back to the composition is the way back to its window: where the player's own turn left the
        // opponent inside it, there is no way back to make.)
        const frameErr = toWindow, edgeErr = -edge;
        const err = (1 - this.yieldTo) * frameErr + this.yieldTo * edgeErr;
        this.slackLo = this.slackHi = 0;
        goal = H + err; gain = Math.max((1 - this.yieldTo) * gain, edge !== 0 ? this.yieldTo * targetW : 0);
        speedCap += (EDGE_SPEED - speedCap) * this.yieldTo; ff *= 1 - this.yieldTo;
      }
      this.mode = threats > 0 ? 'group' : 'duel';
    } else {
      this.bearing = NaN; this.bearingRate = 0; this.targetId = ''; this.urgent = ease(this.urgent, 0, URGENT_IN, URGENT_OUT, dt); this.sideWant = 0;
      this.swAt = -Infinity; this.tvx = this.tvz = 0; this.tlx = this.tlz = NaN;
      this.deltaGoal = 0;
      if (threats > 0) {
        // Threats and no target (Targeting nominates an attacker as soon as
        // it can, so this is a frame or two): the heaviest of them framed as
        // the target would be.
        let best: Subject | undefined;
        for (let k = 0; k < i.count; k++) { const o = i.subjects[k]; if (!o.target && (!best || o.weight > best.weight)) best = o; }
        if (best) {
          const d = Math.hypot(best.x - i.x, best.z - i.z);
          goal = H + wrapped(framing(Math.atan2(best.x - i.x, best.z - i.z), d, this.sideGoal * (Math.abs(i.shoulder) || 1e-3), i.back, MAX_OFFSET, i.foe) - H);
          gain = best.weight * smooth(d, DEAD_ZONE, FULL_ASSIST) * (1 - this.yieldTo);
          groupWant = clamp(.25 * smooth(threatSum, .5, 1.5) + (threats > 1 ? .5 : 0), 0, 1);
        }
        this.mode = 'group';
      } else {
        // Nobody near: the run is looked ahead of (LEAD_*), and the heading is the player's alone.
        this.mode = speed > 1 ? 'explore' : 'idle';
      }
      // The side comes back to the right shoulder with nobody to frame.
      if (this.sideGoal !== 1 && now - this.sideAt >= SIDE_REST) { this.sideFrom = this.side; this.sideGoal = 1; this.sideAt = now; }
    }
    // The group offset, followed (it is a goal of its own, searched afresh each frame).
    this.followDelta(dt);
    this.group = ease(this.group, groupWant, GROUP_IN, GROUP_OUT, dt);
    // The shoulder, crossing over eased (SIDE_TIME).
    const u = smooth(now - this.sideAt, 0, SIDE_TIME);
    this.side = this.sideFrom + (this.sideGoal - this.sideFrom) * u;
    // The run looked ahead of, eased (a critically damped follow, so a
    // change of direction is a move and not a cut).
    const lead = this.explore * (1 - this.yieldTo), sh = Math.sin(H), ch = Math.cos(H);
    const along = i.vx * sh + i.vz * ch, sideways = i.vz * sh - i.vx * ch;
    const lx = clamp(sideways * LEAD_TIME, -LEAD_MOST, LEAD_MOST) * lead, aheadGoal = clamp(along * AHEAD_PER, 0, AHEAD_MOST) * lead;
    // The sideways lead is a translation across the view: right is (-cos, sin).
    this.leadX = this.spring(this.leadX, -ch * lx, 'leadVX', dt); this.leadZ = this.spring(this.leadZ, sh * lx, 'leadVZ', dt);
    this.ahead = this.spring(this.ahead, aheadGoal, 'aheadV', dt);
    // The rig's offsets, the field and the pitch.
    const crossing = 1 - Math.abs(this.side);
    // Round 4b: the switch's breath and tall air. (Launch night: the calm duel's drift - six degrees of sway and a
    // breath of the lens every eleven seconds, for life in the shot - and the dolly in on the player's own string are
    // gone: the lens does not move for its own sake.)
    if (this.swAt > -Infinity && (this.steered || !Number.isFinite(goal))) this.swAt = -Infinity;
    const through = this.swAt > -Infinity ? clamp((now - this.swAt) / Math.max(1e-3, this.swDur), 0, 1) : 0;
    this.switchShare = through;
    this.switching = this.swAt > -Infinity ? Math.sin(Math.PI * through) ** 2 * smooth(this.swSize, .25, 1) : 0;
    const high = Math.max(i.y - i.floor, target ? target.y - i.floor : 0);
    this.airIn = ease(this.airIn, smooth(high, AIR_FROM, AIR_FULL), 4, 1.2, dt);
    this.boom = DYN_BOOM + this.group * GROUP_BOOM + this.explore * EXPLORE_BOOM + this.juggle * JUGGLE_BOOM + this.plunge * PLUNGE_BOOM + this.down * DOWN_BOOM
      + this.switching * SWITCH_BOOM + this.airIn * AIR_BOOM2;
    this.lift = DYN_LIFT + this.group * GROUP_LIFT + this.explore * EXPLORE_LIFT + this.juggle * JUGGLE_LIFT + this.plunge * PLUNGE_LIFT + this.down * DOWN_LIFT + crossing * SIDE_LIFT
      + this.switching * SWITCH_LIFT + this.airIn * AIR_LIFT2;
    this.focus = this.plunge * PLUNGE_FOCUS;
    this.fov = clamp(BASE_FOV + this.dash * DASH_FOV + this.explore * smooth(speed, 4, 7.5) * RUN_FOV + this.group * GROUP_FOV + this.plunge * PLUNGE_FOV
      + this.switching * SWITCH_FOV + this.airIn * AIR_FOV2, FOV_LEAST, FOV_MOST);
    const level = smooth(now - this.pitchAt, PITCH_REST, PITCH_REST + PITCH_RAMP);
    this.pitchGoal = level > 0 ? PITCH_LEVEL : NaN; this.pitchRate = PITCH_RATE * level;
    this.goal = goal; this.gain = clamp(gain, 0, 1); this.speed = Math.min(speedCap, MAX_SPEED); this.accel = accel; this.rate = settle; this.ff = clamp(ff, -MAX_SPEED, MAX_SPEED);
    if (!Number.isFinite(goal)) this.slackLo = this.slackHi = 0;
  }

  /** Turn `heading` toward `goal` (the brain's, plus whatever FollowCamera adds
   *  to look past a body in the way) for `dt`; returns the new heading. The
   *  goal is the heading `think` was given plus the turn it decided on - not
   *  wrapped, so a turn the long way round is one it can ask for. A hit
   *  freeze (`frozen`) brakes it as hard as the limits allow. `trace` gets the
   *  size of the angular acceleration in each substep (rad/s^2), which
   *  FollowCamera's tilt shares its budget with (see its `approach`). */
  steer(heading: number, goal: number, dt: number, frozen = false, trace?: Float64Array) {
    dt = clamp(Number.isFinite(dt) ? dt : 0, 0, .25);
    this.traced = 0;
    if (!(dt > 0)) return heading;
    // The player turning: the brain's own swing dies within a few frames
    // instead of braking at its limit while they steer somewhere else.
    if (this.steered) { this.velocity *= Math.exp(-20 * dt); this.acceleration = 0; }
    let error = Number.isFinite(goal) ? goal - heading : 0;
    if (Math.abs(error) > TAU) error = wrapped(error);
    // A goal passing straight behind flips the shortest way round with every
    // centimetre; once a swing has begun it finishes the way it started.
    if (Math.abs(error) > 2.6 && Math.abs(this.velocity) > .2 && Math.sign(error) !== Math.sign(this.velocity) && this.swAt === -Infinity) error += Math.sign(this.velocity) * TAU;
    // Launch night (CALM_*): what of the turn the window lets be is not made, so from here the turn is the one to
    // its nearest edge - none at all with the opponent inside it.
    const windowed = this.slackLo !== 0 || this.slackHi !== 0;
    if (windowed) error = this.past(error);
    // Round 4b: a change of opponent follows its plan (SWITCH_*): a
    // minimum-jerk path from the heading's position, speed and acceleration
    // to the goal, re-planned every substep so a goal on the move is met
    // where it is. A hit freeze holds it (the plan's clock waits) and the
    // controller below brakes as it always has.
    if (this.swAt > -Infinity && frozen) this.swAt += dt;
    else if (this.swAt > -Infinity && !this.steered && Number.isFinite(goal)) {
      let spent = 0;
      const goalNow = heading + error;
      for (let left = dt; left > 1e-9; left -= STEP) {
        const h = Math.min(STEP, left), elapsed = this.clock - dt + spent - this.swAt;
        this.swGoal += (goalNow - this.swGoal) * (1 - Math.exp(-SWITCH_FOLLOW * h));
        const X = this.swGoal - heading;
        // More time when the goal has run on further than the peak allows;
        // never planned over less than SWITCH_TAIL, though the plan ends on time.
        const slow = 1.875 * Math.abs(X) / SWITCH_PEAK;
        if (this.swDur - elapsed < slow) this.swDur = elapsed + slow;
        const R = Math.max(this.swDur - elapsed, SWITCH_TAIL);
        const v0 = this.velocity, a0 = this.acceleration, tau = h / R;
        const c3 = 10 * X - 6 * v0 * R - 1.5 * a0 * R * R, c4 = -15 * X + 8 * v0 * R + 1.5 * a0 * R * R, c5 = 6 * X - 3 * v0 * R - .5 * a0 * R * R;
        const t2 = tau * tau, t3 = t2 * tau, t4 = t3 * tau;
        const step = v0 * R * tau + .5 * a0 * R * R * t2 + c3 * t3 + c4 * t4 + c5 * t4 * tau;
        this.velocity = clamp((v0 * R + a0 * R * R * tau + 3 * c3 * t2 + 4 * c4 * t3 + 5 * c5 * t4) / R, -MAX_SPEED, MAX_SPEED);
        this.acceleration = (a0 * R * R + 6 * c3 * tau + 12 * c4 * t2 + 20 * c5 * t3) / (R * R);
        if (trace && this.traced < trace.length) trace[this.traced++] = Math.abs(this.acceleration);
        heading += step; spent += h;
      }
      if (this.clock - this.swAt >= this.swDur - 1e-9) this.swAt = -Infinity;
      return heading;
    }
    const gain = frozen || !Number.isFinite(goal) ? 0 : this.gain, ff = frozen ? 0 : this.ff, speed = this.speed, accel = this.accel, rate = this.rate;
    for (let left = dt; left > 1e-9; left -= STEP) {
      const h = Math.min(STEP, left), size = Math.abs(error);
      // (From a window's edge the opponent's own rate is fed forward only while they press on it, eased in over
      // CALM_FF: inside it, or turning back across it, there is nothing to lead.)
      const lead = !windowed ? ff : ff * error > 0 ? ff * smooth(size, 0, CALM_FF) : 0;
      const want = gain * clamp(Math.sign(error) * Math.min(speed, Math.sqrt(2 * BRAKE * accel * size), rate * size) + lead, -speed, speed);
      const push = clamp((want - this.velocity) * FOLLOW, -accel, accel);
      this.acceleration += clamp(push - this.acceleration, -JERK * h, JERK * h);
      this.velocity = clamp(this.velocity + this.acceleration * h, -MAX_SPEED, MAX_SPEED);
      if (trace && this.traced < trace.length) trace[this.traced++] = Math.abs(this.acceleration);
      const step = this.velocity * h; heading += step;
      // (Carried into the window, the turn is over: the edge was the goal.)
      if (windowed && error !== 0 && (error - step) * error <= 0) error = 0; else if (!windowed || error !== 0) error -= step;
    }
    if (Math.abs(this.velocity) < 1e-5 && Math.abs(this.acceleration) < 1e-4 && gain === 0) this.velocity = this.acceleration = 0;
    return heading;
  }

  /** The best group offset off `duel` (see DELTA_STEP): outward from no turn,
   *  the candidate holding the most weight in the frame for the least turn,
   *  the target always inside TARGET_SAFE. The one already being made for
   *  wins ties, so the choice does not flicker. */
  private bestDelta(i: BrainInput, duel: number, target: Subject) {
    let best = 0, bestScore = -Infinity;
    const steps = Math.round(DELTA_MOST / DELTA_STEP);
    for (let k = -steps; k <= steps; k++) {
      const delta = k * DELTA_STEP, h = duel + delta;
      const tx = across(target.x, target.z, i.x, i.z, h, i.back, i.shoulder, i.tanH);
      if (!(Math.abs(tx) <= TARGET_SAFE)) continue;
      let score = 1 - TURN_COST * Math.abs(delta) + (Math.abs(delta - this.deltaGoal) < DELTA_STEP * .75 ? .08 : 0);
      for (let n = 0; n < i.count; n++) {
        const o = i.subjects[n]; if (o.target || o.weight <= .05) continue;
        const x = across(o.x, o.z, i.x, i.z, h, i.back, i.shoulder, i.tanH);
        if (Math.abs(x) <= FRAME_SAFE) score += o.weight * (1 + .15 * (1 - Math.abs(x)));
      }
      if (score > bestScore + 1e-9) { bestScore = score; best = delta; }
    }
    return best;
  }
  private followDelta(dt: number) {
    // The heading assist's integrator (FollowCamera's `approach`), inline.
    for (let left = dt; left > 1e-9; left -= STEP) {
      const h = Math.min(STEP, left), error = this.deltaGoal - this.delta, size = Math.abs(error);
      const want = Math.sign(error) * Math.min(DELTA_SPEED, Math.sqrt(1.8 * DELTA_ACCEL * size), DELTA_GAIN * size);
      this.deltaVelocity += clamp(want - this.deltaVelocity, -DELTA_ACCEL * h, DELTA_ACCEL * h);
      this.delta += this.deltaVelocity * h;
    }
    if (this.deltaGoal === 0 && Math.abs(this.delta) < 1e-5 && Math.abs(this.deltaVelocity) < 1e-4) this.delta = this.deltaVelocity = 0;
  }
  /** A critically damped follow of one scalar at LEAD_RATE (dampedVector's
   *  exact step); `velocity` names the field its speed lives in. */
  private spring(value: number, goal: number, velocity: 'leadVX' | 'leadVZ' | 'aheadV', dt: number) {
    if (!(dt > 0)) return value;
    const w = LEAD_RATE, decay = Math.exp(-w * dt), offset = value - goal, drive = this[velocity] + w * offset;
    this[velocity] = (this[velocity] - w * drive * dt) * decay;
    const next = goal + (offset + drive * dt) * decay;
    return Math.abs(next) < 1e-6 && goal === 0 && Math.abs(this[velocity]) < 1e-6 ? (this[velocity] = 0) : next;
  }
}
