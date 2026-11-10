import * as THREE from 'three';
import {SPIKE_RULES, type BallTeam, type BallView} from '../../game/ball/model';
import type {Vec3} from '../../game/types';
import type {FollowCamera} from '../FollowCamera';
import type {SpikeCamStyle} from './ballCamChoice';

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
/** The stand's few purposeful moves for the match's swings, all along the lens and none turning it (the view's heading
 *  holds):
 *  - TENSE: match point or DEUCE - the stand creeps `push` metres in and the lens closes `fov` degrees, eased in over the
 *    serve's walk-up (`in`) and held through the rally; the walk-up's own step in is `serve` times longer.
 *  - CRESCENDO: a long rally - from `from` crossings on, over `span` more - closes in the same way by up to `push` and
 *    `fov` (FEVER is all of it), so the frame tightens as the rally climbs, and lets go at the point.
 *  - The point that ends a rally of `long` crossings or more (or a FEVER rally, a match point) is the big one, `big` times
 *    a point's move (a PERFECT SPIKE's is POINT.big). */
const TENSE = {push: 1.6, fov: 3, in: .9, out: 1.2, serve: 1.8} as const;
const CRESCENDO = {from: 4, span: 6, push: 1.4, fov: 2.6, in: 1.2, out: 1.6} as const;
const LONG = {long: 7, big: 1.9} as const;
/** LEARN TO PLAY's BLOCK step (game/ball/lesson.ts) - you at the net, their hitter rising on the far side of it
 *  for the glint you block on (SpikeCues). The hitter's feet top out near five metres up, its hand (the glint) over six:
 *  from the stand that is the top 7% of the screen, under the score bug, the glint's flare cut off at the edge. For the
 *  step the look comes `toward` metres up to the net and rises `lift` metres - the glint's flare a fifth of the way down a
 *  desktop's screen, your own fighter at the net over the line of the lesson (two thirds down). A phone on its side
 *  (`phone`: from that aspect) has the lesson's line across the middle of the screen, so there it rises `phoneLift`: the
 *  glint under a third of the way down, you between the line and the meter under the play. Eased in and out at `in` and `out`; a match's stand is untouched. */
const BLOCK_STEP = {lift: 2.75, toward: 1.5, phone: 2, phoneLift: 4.4, in: 1.6, out: 1.4} as const;
/** A strike's punch (degrees off the lens, in at PUNCH_IN a second - a few frames, not a step - and back at PUNCH_BACK) and shake (trauma, falling at 2.6 a
 *  second; the noise is its square). A broadcast lens takes them far smaller than the fight's follow camera does. */
const PUNCH = {spike: 2.5, skySpike: 3.5, perfect: 5, super: 6, kill: 2, block: 2.5, dig: 1.5, dive: 2.5};
const SHAKE = {spike: .18, skySpike: .26, perfect: .42, super: .5, kill: .3, block: .25, dig: .14, dive: .24, noise: .022};
const PUNCH_BACK = 4.5, PUNCH_IN = 24;
/** An aspect much wider than a screen's (a couch split top and bottom): the stand moves back and the lens closes, so
 *  the court is not stretched across a fish-eye. Narrower (side by side): the lens opens a little. */
const WIDE_ASPECT = 2.2, NARROW_ASPECT = 1.3;
/** What differs between the two stands, as one table each. CLASSIC is the numbers above, unchanged (camDefaults.test.ts
 *  holds every one of them): `most` and `dead` the drift's, `lift*` a very high ball's, `serve*` the walk-up's, `block*`
 *  the BLOCK step's, `move` and `lens` how far each occasion's push and each change of the lens goes (shares of the
 *  classic's), `wide*`, `narrowFov`, `across` and `narrowMost` what the lens does on a frame that is not a screen's. */
const CLASSIC = {...STAND, most: DRIFT.most, dead: DRIFT.dead, liftFrom: LIFT.from, liftShare: LIFT.share, liftMost: LIFT.most, servePush: SERVE.push, serveDown: SERVE.down, serveBack: SERVE.back, serveFov: 0,
  blockLift: BLOCK_STEP.lift, blockPhoneLift: BLOCK_STEP.phoneLift, blockToward: BLOCK_STEP.toward, blockFov: 0, move: 1, lens: 1, wide: 1.3, wideFov: -12, narrowFov: 6, across: 0, narrowMost: 0};
/** The COURT-SIDE stand, an option beside the classic one (ballCamChoice.ts; off unless the player picks it). From
 *  thirteen metres up your fighter is about 115 px tall on a 1080p screen and the
 *  far side about 70 px, seen from over their heads - the game's best asset, a hundred toon fighters, read as rings on
 *  a floor. This stand is the same camera in every way but where it stands: the same fixed heading, the same few
 *  occasions - from seven metres up (`up`), fourteen behind the baseline (`back`) and on a longer lens (`fov`), as a
 *  volleyball broadcast's end camera films a match. The bodies are seen from the side, and the long lens keeps the far
 *  side near the size of the near one: a 1.8 m body by your baseline 179 px tall at 1080p (102 from the classic stand),
 *  at the net 136 (91), on the far side 98 to 114 (74 to 82).
 *  - The frame holds what the classic's does. On a screen the near baseline's corners stand at the foot of the frame's
 *    sides (they set how tight the lens may be: both halves of the court are always in it), the far baseline is at its
 *    middle, and a ball is in it to nine metres over the net before the look lifts after it (`lift*`: a smaller tilt
 *    for a narrower lens, the same share of the frame). A screen narrower than 16:9 opens the lens to keep those
 *    corners (`across`); a couch split's narrow half opens it as far as `narrowMost`, which shows what the classic's
 *    narrow half shows of the near baseline; a wide half and a phone keep the screen's lens.
 *  - It does not drift (`most` 0): from down here a step to the side would take a near corner out of the frame, and
 *    the whole court is in it from one spot. Each occasion's push and lens change is scaled to the stand (`move`,
 *    `lens`), so a set, a point and a strike's punch read as they do from the classic stand, no larger.
 *  - The walk-up is a small step (`servePush`, `serveDown`), not the classic's stride: for your own side's serve the
 *    lens opens a little instead (`serveFov`) and the look comes back (`serveBack`), so the server behind the baseline
 *    and the glint over a JUMP SERVE's top share the frame.
 *  - LEARN TO PLAY's BLOCK step keeps its framing (the glint a fifth of the way down, you over the lesson's line) with a
 *    smaller lift and the lens a touch open (`block*`).
 *  - From this height the net stands between the lens and the far court: BallArena thins its weave for this stand
 *    alone (`sheer`; main.ts hands it over through ballCamChoice's netSheer). */
const SIDE = {back: 14, up: 7, lookZ: 8, lookY: .3, fov: 33, most: 0, dead: DRIFT.dead, liftFrom: 8.5, liftShare: .22, liftMost: 1.6, servePush: .5, serveDown: .2, serveBack: 3.2, serveFov: 3,
  blockLift: .5, blockPhoneLift: 2.2, blockToward: 1.5, blockFov: 3, move: .8, lens: .7, wide: 1, wideFov: 0, narrowFov: 0, across: 16 / 9, narrowMost: 52};
const STANDS: Record<SpikeCamStyle, Record<keyof typeof CLASSIC, number>> = {classic: CLASSIC, side: SIDE};
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
  /** Which stand it films from (ballCamChoice.ts): 'classic' unless the player picked COURT-SIDE. main.ts
   *  sets it before `steer`; a change is a cut to the other stand. */
  style: SpikeCamStyle = 'classic';
  private styled: SpikeCamStyle = 'classic';
  /** How see-through the net is drawn for this stand (0: as it is; BallArena's `netSheer`), while filming. */
  get sheer() { return this.active && this.style === 'side' ? 1 : 0; }
  /** The stands' own numbers, for checks. */
  static readonly STANDS = STANDS;
  private team: BallTeam = 'red';
  private match = NaN;
  private seen = 0;
  private handed = NaN;
  private away = 0;
  private still = 0;
  private x = 0; private vx = 0; private goalX = 0;
  private lift = 0;
  private serveW = 0; private setW = 0; private pointW = 0; private followW = 0; private followUntil = -Infinity;
  private tenseW = 0; private climbW = 0; private blockW = 0;
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
    this.serveW = this.setW = this.pointW = this.followW = this.tenseW = this.climbW = this.blockW = 0; this.followUntil = -Infinity; this.punch = this.punchGoal = this.trauma = 0;
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
    // (The other stand picked in the menu: placed there outright, as at a match's start; the events read stay read.)
    if (this.style !== this.styled) { this.styled = this.style; this.forget(); }
    this.moments(view);
    const P = STANDS[this.style];
    const R = SPIKE_RULES, s = team === 'red' ? 1 : -1, b = ball ?? view.ball, wide = aspect > WIDE_ASPECT ? P.wide : 1;
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
    const want = clamp(self.x * DRIFT.self + b.x * DRIFT.ball * ownBall, -P.most, P.most);
    if (!this.placed) { this.x = this.goalX = want; this.vx = 0; }
    else if (Math.abs(want - this.goalX) > P.dead) this.goalX = want - Math.sign(want - this.goalX) * P.dead;
    const w = DRIFT.rate;
    this.vx += (w * w * (this.goalX - this.x) - 2 * w * this.vx) * dt;
    this.vx = clamp(this.vx, -DRIFT.speed, DRIFT.speed);
    this.x += this.vx * dt;
    // A very high ball: the look tilts up after it.
    const lift = clamp((b.y - P.liftFrom) * P.liftShare, 0, P.liftMost);
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
    // The match's swings: match point or DEUCE, and a long rally climbing.
    const tense = (view.phase === 'kickoff' || view.phase === 'live') && SpikeCam.onTheEdge(view) ? 1 : 0;
    const climb = view.phase === 'live' ? (view.fever ? 1 : clamp((view.rally - CRESCENDO.from) / CRESCENDO.span, 0, 1)) : 0;
    this.tenseW = this.weigh(this.tenseW, tense, TENSE.in, TENSE.out, dt);
    this.climbW = this.weigh(this.climbW, climb, CRESCENDO.in, CRESCENDO.out, dt);
    this.blockW = this.weigh(this.blockW, view.lesson?.step === 'ss-block' && view.lesson.state !== 'over' ? 1 : 0, BLOCK_STEP.in, BLOCK_STEP.out, dt);
    // (The point that ends a long rally is the big one.)
    if (view.phase === 'scored' && this.pointBig < LONG.big && (view.rally >= LONG.long || view.fever)) this.pointBig = LONG.big;
    // The pose: the stand, then each occasion laid over it.
    const back = (R.courtHalfZ + P.back) * wide, up = P.up * wide;
    const eye = this.eye.set(this.x, up, -s * back), look = this.look.set(this.x * (1 - DRIFT.look), P.lookY + this.lift, s * P.lookZ);
    look.y += (SERVE.look * this.serveW + SET.lift * this.setW) * P.move + (aspect >= BLOCK_STEP.phone && aspect <= WIDE_ASPECT ? P.blockPhoneLift : P.blockLift) * this.blockW;
    look.z += s * P.blockToward * this.blockW;
    if (view.servingTeam === team) look.z -= s * P.serveBack * this.serveW;
    look.z -= s * SET.lift * .8 * this.setW * P.move;
    if (this.pointW > 0) { const k = Math.min(.9, POINT.toward * this.pointW * this.pointBig) * P.move; look.x += (this.landed.x - look.x) * k; look.z += (this.landed.z - look.z) * k; look.y += (.4 - look.y) * k; }
    if (this.followW > 0) { const k = FOLLOW.share * this.followW * P.move; look.x += (b.x - look.x) * k; look.y += (b.y - look.y) * k; look.z += (b.z - look.z) * k; }
    // Pushed in along the view, and lowered for the walk-up.
    let dx = look.x - eye.x, dy = look.y - eye.y, dz = look.z - eye.z;
    const d = Math.hypot(dx, dy, dz) || 1, push = (P.servePush * this.serveW * (1 + (TENSE.serve - 1) * this.tenseW) + SET.push * this.setW + POINT.push * this.pointW * this.pointBig
      + TENSE.push * this.tenseW + CRESCENDO.push * this.climbW * (1 - this.tenseW * .5)) * P.move;
    eye.x += dx / d * push; eye.y += dy / d * push - P.serveDown * this.serveW; eye.z += dz / d * push;
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
    // (A stand with `across` holds what it shows from side to side on any frame narrower than that, by opening the lens,
    // as far as `narrowMost`: the court-side stand's near corners.)
    const base = aspect > WIDE_ASPECT ? P.fov + P.wideFov : P.across > 0 ? (aspect < P.across ? Math.min(P.narrowMost, 2 * Math.atan(Math.tan(P.fov * Math.PI / 360) * P.across / aspect) * 180 / Math.PI) : P.fov)
      : aspect < NARROW_ASPECT ? P.fov + P.narrowFov : P.fov;
    // (Each term on its own, in the classic's order: there `lens` is 1 and the opening 0, so the sum is the classic's to
    // the last bit.)
    this.fov = base + P.blockFov * this.blockW + (view.servingTeam === team ? P.serveFov * this.serveW : 0) - POINT.fov * this.pointW * this.pointBig * P.lens - this.punch * P.lens
      - TENSE.fov * this.tenseW * P.lens - CRESCENDO.fov * this.climbW * (1 - this.tenseW * .5) * P.lens;
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

  /** Whether a side is a point from the match (match point), or the score is tied at one short of the target or past it
   *  (DEUCE). */
  static onTheEdge(view: BallView) {
    const {red, blue} = view.score, target = view.target, cap = Math.max(target, SPIKE_RULES.cap + (target - SPIKE_RULES.target));
    if (view.practice || target >= 99) return false;
    const point = (s: number, o: number) => s + 1 >= cap || (s + 1 >= target && s + 1 - o >= 2);
    return point(red, blue) || point(blue, red) || (red === blue && red >= target - 1);
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
