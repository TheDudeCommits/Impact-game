import type {AttackSlot, PlayerInput, PlayerState} from '../types';
import {MOVES, jumpArc} from '../moves';
import {BALL_ID, GOAL_RULES, SPIKE_RULES, otherTeam, type BallModeId, type BallSeat, type BallState, type BallTeam, type BallView} from './model';
import {goalZ, landing, sideOf, stepBall, type BallContact} from './physics';

/** Skill against mashing (a game worth coming back to rewards learning): scripted people for the headless sims, to
 *  show with numbers that a player who has learnt the modes beats one mashing
 *  the buttons. Each drives one seat through `BallMatch.submit`, the way a page does - a stick, a view, the buttons, the
 *  Tab lock - and sees the match only as a person could (`Eyes`): the ball and the bodies as they were a reaction ago,
 *  run on along their own flight from there (the landing sight on the floor shows where a ball comes down). Its presses
 *  carry a person's timing error and its view a person's aim error. The bots (BallBrain) are not touched.
 *
 *  - MASHER: holds the stick at the ball and presses attack constantly near it, a slot picked at random (the ultimate
 *    among them once it is full), now and then the jump; never the stance, the guard or a timed press. The view is the
 *    ball cam's own (Goal Rush) or the broadcast camera's (Sky Spike): never turned.
 *  - CASUAL: runs at the ball, swings when it is close (a heavy at the goal, or a light), sometimes jumps for a high one;
 *    turns the view roughly at the goal. Sky Spike: bump, set, a hit over (a jump and a swing on takeoff, sometimes).
 *  - SKILLED: Goal Rush - meets a ball coming in for a PERFECT STRIKE (the press timed to the blow's own contact),
 *    heads crosses at the top of the jump, locks a striker on the ball in its half with Tab and knocks them down (a
 *    TACKLE), boosts, comes round behind the ball, and takes a place up the pitch for the pass when a team-mate has it;
 *    never swings at nothing. Sky Spike - the spike from the top of the jump (PERFECT SPIKE), QUICK and BACK SETs, a TIP
 *    over a block that is up, the STUFF BLOCK timed to the hitter, the DIVE for a hard ball just out of reach, and the
 *    JUMP SERVE from the top. Every timed press is timed to the cue the page draws (JUMP, APEX, BLOCK, DIVE: SpikeCues;
 *    the gold ring of a ball coming in), not to the room's state of the instant. */
export type HumanStyle = 'masher' | 'casual' | 'skilled';
export const HUMAN_STYLES: readonly HumanStyle[] = ['masher', 'casual', 'skilled'];

/** A person's limits, by style: `react` the reaction (s: what the eyes see is the match this long ago, run on along its
 *  flight), `timing` the spread of a timed press (s, one standard deviation: about 35 ms for a practised hand meeting a
 *  cue it can see coming, 80-100 ms for a casual one), `aim` the spread of the view's heading at a press (radians),
 *  `read` how far off a person's read of where a ball comes down is (m, a standard deviation, rolled once a flight), and
 *  the masher's pace, a press every `pace` seconds. */
export const HUMAN = {
  masher: {react: .25, timing: .1, aim: .2, read: 1.2, pace: [.1, .2] as const},
  casual: {react: .25, timing: .09, aim: .18, read: .8, pace: [.45, .65] as const},
  skilled: {react: .2, timing: .035, aim: .06, read: .15, pace: [.3, .4] as const},
} as const;

type Command = Omit<PlayerInput, 'seq'>;
type Body = {id: string; team?: string; x: number; y: number; z: number; vx: number; vz: number; grounded: boolean; alive: boolean; action: string};
const gap = (a: {x: number; z: number}, b: {x: number; z: number}) => Math.hypot(a.x - b.x, a.z - b.z);
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const SWINGING: ReadonlySet<string> = new Set(['light', 'heavy', 'special', 'ultimate', 'area']);

/** What a person sees: the match a reaction ago - the ball run on along its own flight from there (it is drawn with its
 *  landing sight, so a flight already under way is read; a strike or a bounce since is not), the bodies run on along
 *  their run. */
class Eyes {
  private frames: {t: number; ball: BallState; bodies: Map<string, Body>}[] = [];
  private readonly probe = {} as BallState;
  private readonly contacts: BallContact[] = [];
  constructor(private readonly mode: BallModeId) {}
  record(now: number, ball: BallState, players: readonly PlayerState[]) {
    const last = this.frames[this.frames.length - 1], bodies = new Map<string, Body>();
    for (const p of players) {
      const was = last?.bodies.get(p.id), dt = last ? now - last.t : 0;
      bodies.set(p.id, {id: p.id, team: p.team, x: p.x, y: p.y, z: p.z, vx: was && dt > 0 ? (p.x - was.x) / dt : 0, vz: was && dt > 0 ? (p.z - was.z) / dt : 0, grounded: p.grounded, alive: p.alive, action: p.action});
    }
    this.frames.push({t: now, ball: {...ball}, bodies});
    while (this.frames.length > 2 && this.frames[1].t <= now - 1) this.frames.shift();
  }
  private frame(now: number, delay: number) {
    let f = this.frames[0];
    for (const g of this.frames) { if (g.t <= now - delay + 1e-6) f = g; else break; }
    return f;
  }
  /** The ball as seen: where it was `delay` ago, run on along its own flight to now. */
  ball(now: number, delay: number): BallState {
    const f = this.frame(now, delay), b = Object.assign(this.probe, f.ball);
    if (b.held || b.frozenUntil > f.t || b.clash > f.t) return b;
    for (let t = f.t; t < now - 1e-6; t += 1 / 60) stepBall(this.mode, b, 1 / 60, this.contacts);
    return b;
  }
  /** The bodies as seen: where they were `delay` ago, run on along their run. */
  bodies(now: number, delay: number): Body[] {
    const f = this.frame(now, delay), ahead = now - f.t, out: Body[] = [];
    for (const p of f.bodies.values()) out.push({...p, x: p.x + p.vx * ahead, z: p.z + p.vz * ahead});
    return out;
  }
}

/** Goal Rush's ball cam heading, as the page steers it (render/ball/BallCam.ts, stripped to what the aim needs): round
 *  to the line from you to the ball on a critically damped spring, held while the ball is close or overhead, turned a
 *  share of the way to the goal in the third you attack. A person may turn it up to `away` radians off that. */
class Heading {
  yaw = NaN; private rate = 0;
  static readonly away = 1.3;
  steer(dt: number, me: PlayerState, ball: BallState, team: BallTeam) {
    const dx = ball.x - me.x, dz = ball.z - me.z, d = Math.hypot(dx, dz);
    let bearing = d > 1e-3 ? Math.atan2(dx, dz) : Number.isFinite(this.yaw) ? this.yaw : me.yaw;
    const gz = goalZ(otherTeam(team)), third = GOAL_RULES.halfZ / 3;
    const smooth = (x: number, a: number, b: number) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
    const w = smooth(Math.sign(gz) * ball.z, third - 2, third + 3);
    if (w > 0 && Math.abs(gz - me.z) > Math.abs(gz - ball.z)) {
      const diff = wrap(Math.atan2(-me.x, gz - me.z) - bearing);
      bearing += clamp(diff * .5, -.42, .42) * w * smooth(1.15 - Math.abs(diff), 0, .3);
    }
    const rise = Math.atan2(ball.y - me.y - 1.2, Math.max(d, .01)), pull = smooth(d, 2, 6.5) * (1 - smooth(rise, .85, 1.2));
    if (!Number.isFinite(this.yaw)) { this.yaw = bearing; this.rate = 0; return this.yaw; }
    for (let left = dt; left > 1e-6;) {
      const h = Math.min(left, 1 / 60), g = wrap(bearing - this.yaw);
      this.rate = clamp(this.rate + (4.2 * 4.2 * pull * g - 2 * 4.2 * this.rate) * h, -3, 3);
      this.yaw += this.rate * h; left -= h;
    }
    return this.yaw = wrap(this.yaw);
  }
  /** A heading the person turns the view to, as far as the camera lets them. */
  turn(want: number) { return wrap(this.yaw + clamp(wrap(want - this.yaw), -Heading.away, Heading.away)); }
}

/** One person's hands on one seat. `command` is called once a tick before the match steps; its result goes to
 *  `BallMatch.submit` with the next sequence number. */
export class HumanHands {
  private readonly eyes: Eyes;
  private readonly heading = new Heading();
  private readonly limits: (typeof HUMAN)[HumanStyle];
  private seed: number;
  private nextPress = 0; private jumpUntil = 0; private nextJump = 0; private nextDash = 0; private lastNow = -1;
  /** The flight a read was rolled for, and what the read and timing errors came to. */
  private rolledFor = ''; private readErr = {x: 0, z: 0}; private timeErr = 0;
  /** The jump as this person has learnt it: how high it tops out and how long it takes to get there (s), from the
   *  fighter's own arc, then from the jumps they have made. */
  private apex = 0; private rise = 0; private jumpedAt = -Infinity; private peak = 0; private peakAt = 0;
  /** Goal Rush's FIGHT stance: the opponent locked on, since when. */
  private fight: {id: string; since: number} | null = null; private nextTackle = 0;
  /** Sky Spike: a spike's jump (when it left the floor, when its swing goes), a block's (whose set, a stuff's guard
   *  pressed), the set chosen this possession, the serve's choice and its jump. */
  private spikeAt = -Infinity; private swingAt = 0; private blockFor = ''; private guardAt = -Infinity;
  private setFor = ''; private setKind: 'quick' | 'back' | 'high' = 'high'; private tipFor = ''; private tipping = false;
  private serveKind: 'jump' | 'float' | 'drive' | null = null; private serveAt = -1; private serveJump = -Infinity;
  private jumpsFor = ''; private jumpsHere = false;
  /** What the hands did this tick (a word, for a sim's tally). */
  did = '';
  constructor(readonly id: string, readonly mode: BallModeId, readonly style: HumanStyle, seed = 1) {
    this.eyes = new Eyes(mode);
    this.limits = HUMAN[style];
    this.seed = (seed * 2654435761 + 97) >>> 0 || 1;
  }
  private rng() { let x = this.seed; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; this.seed = x >>> 0 || 1; return this.seed / 0x100000000; }
  /** A normal draw (Box-Muller). */
  private normal() { return Math.sqrt(-2 * Math.log(this.rng() || 1e-9)) * Math.cos(2 * Math.PI * this.rng()); }

  command(view: BallView, players: readonly PlayerState[], now: number): Command | null {
    const me = players.find(p => p.id === this.id), seat = view.seats.find(s => s.id === this.id);
    const dt = this.lastNow < 0 ? 1 / 60 : Math.max(1 / 240, now - this.lastNow); this.lastNow = now;
    this.eyes.record(now, view.ball, players);
    if (!me || !seat) return null;
    if (!this.apex) { const arc = jumpArc(me.fighter); this.apex = arc.apex * (this.mode === 'goal-rush' ? 1.1 : 1); this.rise = arc.rise; }
    this.learnJump(me, now);
    if (this.was && now > this.was.t) { this.moving = {x: (me.x - this.was.x) / (now - this.was.t), z: (me.z - this.was.z) / (now - this.was.t)}; }
    this.was = {x: me.x, z: me.z, t: now};
    const input: Command = {moveX: 0, moveZ: 0, yaw: me.yaw, targetId: BALL_ID, lock: true};
    if (now < this.jumpUntil) input.jumpHeld = true;
    if (view.phase === 'over' || view.phase === 'countdown' || view.phase === 'lobby' || !me.alive) return input;
    if (view.phase === 'scored' || (view.phase === 'kickoff' && this.mode === 'goal-rush')) { this.fight = null; this.heading.yaw = NaN; return input; }
    const b = this.eyes.ball(now, this.limits.react), bodies = this.eyes.bodies(now, this.limits.react);
    if (this.mode === 'goal-rush') {
      input.yaw = this.heading.steer(dt, me, view.ball, seat.team);
      return this.style === 'masher' ? this.mashGoal(me, b, now, input) : this.style === 'casual' ? this.casualGoal(me, seat, b, now, input) : this.skilledGoal(me, seat, view, b, bodies, now, input);
    }
    input.yaw = seat.team === 'red' ? 0 : Math.PI;
    return this.style === 'masher' ? this.mashSpike(me, seat, view, b, now, input) : this.volley(me, seat, view, b, bodies, now, input);
  }

  /** The jump as felt: each one's top and the time to it, folded into what this person expects of the next. */
  private learnJump(me: PlayerState, now: number) {
    if (this.jumpedAt === -Infinity) return;
    if (!me.grounded && me.y > this.peak) { this.peak = me.y; this.peakAt = now - this.jumpedAt; }
    if (me.grounded && now - this.jumpedAt > .2) {
      if (this.peak > 1) { this.apex += (this.peak - this.apex) * .5; this.rise += (this.peakAt - this.rise) * .5; }
      this.jumpedAt = -Infinity; this.peak = 0;
    }
  }
  private jump(input: Command, now: number, hold = .35) {
    input.jump = true; input.jumpHeld = true; this.jumpUntil = now + hold; this.nextJump = now + 1; this.jumpedAt = now; this.peak = 0;
  }
  private stick(me: PlayerState, to: {x: number; z: number}, input: Command, stop = .5) {
    const dx = to.x - me.x, dz = to.z - me.z, d = Math.hypot(dx, dz);
    if (d > stop) { input.moveX = dx / d; input.moveZ = dz / d; }
    return d;
  }
  /** The boost (a dash run on while the stick holds): from afar, with the bar to spend. */
  private boost(me: PlayerState, d: number, input: Command, now: number, from = 9) {
    if (d > from && now >= this.nextDash && me.grounded && me.stamina > 40) { input.dash = true; this.nextDash = now + 1.2 + this.rng() * .8; }
  }
  /** A flight's read and timing errors, rolled once a flight (a new striker, a new way). */
  private roll(b: BallState) {
    const key = `${b.lastId}:${Math.round(Math.atan2(b.vx, b.vz) * 3)}:${b.shot}`;
    if (key === this.rolledFor) return;
    this.rolledFor = key;
    this.readErr = {x: this.normal() * this.limits.read, z: this.normal() * this.limits.read};
    this.timeErr = this.normal() * this.limits.timing;
  }
  private press(input: Command, slot: AttackSlot, yaw: number, now: number, pace: readonly [number, number] = this.limits.pace) {
    input.attack = slot; input.yaw = wrap(yaw + this.normal() * this.limits.aim);
    this.nextPress = now + pace[0] + this.rng() * (pace[1] - pace[0]);
  }
  /** A slot picked at random from what the fighter has (the ultimate once it is full). */
  private anySlot(me: PlayerState): AttackSlot {
    const slots: AttackSlot[] = me.ultimate >= 100 ? ['light', 'heavy', 'special', 'ultimate'] : ['light', 'heavy', 'special'];
    return slots[Math.floor(this.rng() * slots.length)];
  }

  // ─── Goal Rush ────────────────────────────────────────────────────────────────────────────────────────────────────
  /** MASHER: the stick at the ball, the boost from afar, every button near it. */
  private mashGoal(me: PlayerState, b: BallState, now: number, input: Command) {
    const d = this.stick(me, b, input, .2);
    this.boost(me, d, input, now, 8);
    const near = Math.hypot(b.x - me.x, b.y - (me.y + 1), b.z - me.z) < 6;
    if (near && now >= this.nextPress) {
      input.attack = this.anySlot(me); this.nextPress = now + HUMAN.masher.pace[0] + this.rng() * (HUMAN.masher.pace[1] - HUMAN.masher.pace[0]);
      if (this.rng() < .06 && me.grounded) this.jump(input, now, .25);
    }
    return input;
  }
  /** CASUAL: run at where the ball is going, swing when it is close, jump for a high one now and then; the view turned
   *  roughly at the goal near the ball. */
  private casualGoal(me: PlayerState, seat: BallSeat, b: BallState, now: number, input: Command) {
    this.roll(b);
    const lead = {x: b.x + b.vx * .3 + this.readErr.x, z: b.z + b.vz * .3 + this.readErr.z};
    const d = this.stick(me, lead, input, .3);
    this.boost(me, d, input, now, 11);
    const gz = goalZ(otherTeam(seat.team)), atGoal = Math.atan2(-b.x * .5 - me.x * .5, gz - me.z);
    if (gap(me, b) < 6) input.yaw = this.heading.turn(atGoal);
    const reach = Math.hypot(b.x - me.x, b.y - (me.y + 1), b.z - me.z);
    const key = `${b.lastId}:${Math.round(b.x / 4)}:${Math.round(b.z / 4)}`;
    if (key !== this.jumpsFor) { this.jumpsFor = key; this.jumpsHere = this.rng() < .3; }
    if (this.jumpsHere && me.grounded && now >= this.nextJump && b.y > 2.4 && b.y < 6 && gap(me, b) < 3) this.jump(input, now);
    // (The SUPER SHOT once the meter says it is ready.)
    if (reach < 2.4 && now >= this.nextPress) this.press(input, me.ultimate >= 100 ? 'ultimate' : this.rng() < .6 ? 'heavy' : 'light', input.yaw, now);
    return input;
  }
  /** SKILLED: the whole of Goal Rush as it is taught (the how-to-play and the hints). */
  private skilledGoal(me: PlayerState, seat: BallSeat, view: BallView, b: BallState, bodies: Body[], now: number, input: Command) {
    const R = GOAL_RULES, team = seat.team, ownZ = goalZ(team), enemyZ = goalZ(otherTeam(team)), toward = Math.sign(enemyZ);
    this.roll(b); this.did = '';
    // The aim: the corner of the goal away from its keeper (the one of theirs nearest the goal line), turned to as far
    // as the camera allows.
    const keeper = bodies.filter(q => q.team !== team && q.alive).sort((x, y) => Math.abs(x.z - enemyZ) - Math.abs(y.z - enemyZ))[0];
    const corner = (keeper && keeper.x > 0 ? -1 : 1) * (R.goalHalfWidth - 1.3);
    const aim = Math.atan2(corner - b.x, enemyZ - b.z), aimYaw = this.heading.turn(aim);
    const chest = Math.hypot(b.x - me.x, b.y - (me.y + 1), b.z - me.z), dy = b.y - (me.y + 1);
    const inReach = chest < 2.3 && dy > -1.4 && dy < 1.7;
    const mates = bodies.filter(q => q.team === team && q.id !== this.id && q.alive);
    const rivals = bodies.filter(q => q.team !== team && q.alive && view.seats.find(s => s.id === q.id)?.out === undefined);
    const nearestMate = Math.min(...mates.map(q => gap(q, b)));
    // A tackle under way (the FIGHT stance) goes on until it is done.
    if (this.tackling(me, b, rivals, now, input)) { this.did = 'tackle'; return input; }
    // A striker of theirs on the ball, nearer it than this player, in this half or running at its goal: Tab, and knock
    // them off it - when the ball is not about to come loose here.
    const carrier = rivals.filter(q => gap(q, b) < 2.4 && b.y < 2.4).sort((x, y) => gap(x, b) - gap(y, b))[0];
    if (carrier && now >= this.nextTackle && !inReach && gap(me, carrier) < 6 && gap(carrier, b) + .4 < gap(me, b) && Math.sign(b.z) === Math.sign(ownZ)) {
      this.fight = {id: carrier.id, since: now};
      if (this.tackling(me, b, rivals, now, input)) { this.did = 'lock'; return input; }
    }
    // A cross coming in at head height: up to meet it at the top of the jump, the stick at the goal (a header goes the
    // way the body faces) - a PERFECT HEADER.
    if (me.grounded && now >= this.nextJump && this.header(me, b)) {
      this.jump(input, now, this.rise + .05);
      this.stick(me, {x: me.x + Math.sin(aim), z: me.z + Math.cos(aim)}, input, 0);
      input.yaw = aimYaw; this.did = 'header';
      return input;
    }
    if (!me.grounded && now - this.jumpedAt < 1.2) { this.stick(me, {x: me.x + Math.sin(aim), z: me.z + Math.cos(aim)}, input, 0); input.yaw = aimYaw; }
    // A ball coming in (a pass, a cross, a rebound): stand for it, the view at the goal, the blow timed to land as it
    // arrives - the PERFECT STRIKE. (The slot that can make one: the heavy, or the special if the heavy only pops it up.)
    const eta = this.arriving(me, b);
    const slot = this.strikeSlot(me, now);
    // (Never a press on top of a swing of its own still under way.)
    if (SWINGING.has(me.action)) this.nextPress = Math.max(this.nextPress, now + 1 / 60);
    if (eta !== undefined && slot && me.grounded) {
      input.yaw = aimYaw;
      this.did = 'meet';
      if (now >= this.nextPress && this.onTime(me, slot, eta)) { this.press(input, me.ultimate >= 100 && this.inRange(b, enemyZ) ? 'ultimate' : slot, aimYaw, now); this.did = 'meet-press'; }
      return input;
    }
    // The ball ahead, lined up on the way to the goal: the swing started so its blow lands as the run reaches the ball
    // (the run and the ball closing together) - a shot in range (the super shot if it is full), a ball driven forward
    // from further out; a pass to a team-mate up the pitch and open, now and then.
    const lined = Math.abs(wrap(Math.atan2(b.x - me.x, b.z - me.z) - aim)) < .7 && Math.abs(wrap(aimYaw - aim)) < .3;
    const run = eta === undefined ? this.runEta(me, b) : undefined;
    if (lined && run !== undefined && now >= this.nextPress && dy < 1.7 && dy > -1.4) {
      const mate = mates.filter(q => toward * (q.z - b.z) > 3 && gap(q, b) < 12 && rivals.every(r => gap(r, q) > 2.5)).sort((x, y) => Math.abs(enemyZ - x.z) - Math.abs(enemyZ - y.z))[0];
      if (mate && !this.inRange(b, enemyZ) && this.rng() < .02) { const to = Math.atan2(mate.x - b.x, mate.z - b.z); input.yaw = this.heading.turn(to); this.press(input, 'light', input.yaw, now); this.did = 'pass'; return input; }
      const strike = me.ultimate >= 100 && this.inRange(b, enemyZ) ? 'ultimate' : slot ?? 'heavy';
      if (this.onTime(me, strike, run)) { this.press(input, strike, aimYaw, now); this.did = 'shoot'; }
    }
    if (inReach && !this.did) this.did = 'feet';
    // Where to be: on the ball (round behind it on the line to the goal, the boost from afar) unless a team-mate is
    // clearly on it, nearer by some way; then up the pitch on the far side of it for the pass.
    const mateOn = mates.some(q => gap(q, b) < 3 && gap(q, b) + 4 < gap(me, b));
    if (!mateOn || gap(me, b) < 8) {
      const lead = b.y > 2 ? landing(this.mode, b, 1.4, 2.5) : {x: b.x + b.vx * .25, z: b.z + b.vz * .25};
      const ux = Math.sin(aim), uz = Math.cos(aim);
      // (Straight through the ball from behind it: the run carries into the blow.)
      let spot = {x: lead.x + ux * .5, z: lead.z + uz * .5};
      if ((me.x - lead.x) * ux + (me.z - lead.z) * uz > -.6 && gap(me, b) > 1.2) {
        const side = (me.x - lead.x) * uz - (me.z - lead.z) * ux > 0 ? 1 : -1;
        spot = {x: lead.x - ux * 2.4 + uz * 2.4 * side, z: lead.z - uz * 2.4 - ux * 2.4 * side};
      }
      const d = this.stick(me, spot, input, .3);
      this.boost(me, d, input, now, 8);
      if (gap(me, b) < 5) input.yaw = aimYaw;
      if (!this.did) this.did = 'chase';
    } else {
      const flank = b.x > 0 ? -1 : 1;
      const spot = {x: clamp(flank * R.halfX * .35, -R.halfX + 2, R.halfX - 2), z: clamp(b.z + toward * 7, -R.halfZ + 4, R.halfZ - 4)};
      const d = this.stick(me, spot, input, .8);
      this.boost(me, d, input, now, 12);
      this.did = 'support';
    }
    return input;
  }
  /** A tackle held: the lock on them (Tab), run them down, a heavy in reach (a knockdown takes the ball off them). Let go
   *  once they are down, off the ball, out of reach, after two seconds, or when the ball comes loose here. */
  private tackling(me: PlayerState, b: BallState, rivals: Body[], now: number, input: Command) {
    const f = this.fight;
    if (!f) return false;
    const q = rivals.find(r => r.id === f.id), held = now - f.since;
    const down = !q || ['knockdown', 'launched', 'splat', 'getup', 'defeated'].includes(q.action);
    if (down || held > 2 || gap(me, q!) > 9 || (held > .4 && gap(q!, b) > 4) || (gap(me, b) < 2 && gap(me, b) < gap(q!, b))) {
      this.fight = null; this.nextTackle = now + (down ? .6 : 1.2);
      return false;
    }
    input.targetId = q!.id; input.lock = true;
    const yaw = Math.atan2(q!.x - me.x, q!.z - me.z), d = this.stick(me, q!, input, 1.2);
    this.boost(me, d, input, now, 5);
    input.yaw = yaw;
    if (d < 2.5 && now >= this.nextPress) this.press(input, 'heavy', yaw, now, [.45, .6]);
    return true;
  }
  /** Whether a ball in the air is crossing here at head height in about the jump's rise from now: the moment to leave
   *  the floor so the top of the jump meets it. (Read off its flight, as the ball and its landing sight show it.) */
  private header(me: PlayerState, b: BallState) {
    if (b.y < 1.2 && b.vy < 2) return false;
    const probe = {...b}, contacts: BallContact[] = [];
    const head = this.apex + 1.1;
    for (let t = 0; t < this.rise + .25; t += 1 / 60) {
      stepBall(this.mode, probe, 1 / 60, contacts);
      const d = Math.hypot(probe.x - me.x, probe.z - me.z);
      if (d < 1.1 && Math.abs(probe.y - head) < .8) {
        const toward = -((probe.vx) * (probe.x - me.x) + probe.vz * (probe.z - me.z)) / Math.max(.3, d);
        return Math.abs(t - this.rise - this.timeErr) < 1 / 50 && (toward > 3 || Math.hypot(probe.vx, probe.vz) > 6);
      }
    }
    return false;
  }
  /** A ball coming to this player on its own flight (5 m/s or more at the chest, its line within a swing of this player, there inside 1.1 s), and how
   *  soon it is 2.3 m off; or undefined. */
  private arriving(me: PlayerState, b: BallState): number | undefined {
    const dx = me.x - b.x, dy = me.y + 1 - b.y, dz = me.z - b.z, d = Math.hypot(dx, dy, dz) || 1, closing = (b.vx * dx + b.vy * dy + b.vz * dz) / d;
    if (closing < 5 || d > 14) return undefined;
    // (A ball along the floor stays on it: the floor is under the flight.)
    const t = Math.max(0, (d - 2.3) / closing);
    if (t > 1.1) return undefined;
    const px = b.x + b.vx * t, py = Math.max(GOAL_RULES.ballRadius, b.y + b.vy * t - .5 * GOAL_RULES.gravity * t * t), pz = b.z + b.vz * t;
    // (Its line along the floor passes within a swing of this player, at a height a swing meets.)
    const flat = Math.hypot(b.vx, b.vz), miss = flat > .5 ? Math.abs(b.vx * dz - b.vz * dx) / flat : Math.hypot(px - me.x, pz - me.z);
    if (miss > 1.6 || py - (me.y + 1) > 1.7 || py - (me.y + 1) < -1.4) return undefined;
    this.closing = closing;
    return t;
  }
  private closing = 0;
  /** The ball and this player closing on each other (its flight less this player's run): how soon it is 2.3 m off the
   *  chest, if it will pass within a swing of it; or undefined. */
  private runEta(me: PlayerState, b: BallState): number | undefined {
    const v = this.moving, rx = b.vx - v.x, rz = b.vz - v.z, dx = me.x - b.x, dz = me.z - b.z, d = Math.hypot(dx, dz) || 1;
    const closing = (rx * dx + rz * dz) / d;
    if (closing < 2.5 || d > 9) return undefined;
    const t = Math.max(0, (d - 2.3) / closing), miss = Math.abs(rx * dz - rz * dx) / Math.max(.1, Math.hypot(rx, rz));
    if (miss > 1.6 || b.y + b.vy * t - .5 * GOAL_RULES.gravity * t * t > me.y + 2.7) return undefined;
    this.closing = closing;
    return t;
  }
  /** This player's own run (m/s along the floor), felt. */
  private moving = {x: 0, z: 0}; private was: {x: number; z: number; t: number} | null = null;
  /** Whether a press of `slot` now lands its blow as the arriving ball reaches 2.3 m (the blow's lunge carrying the body
   *  part of the way), give or take this person's timing. */
  private onTime(me: PlayerState, slot: AttackSlot, eta: number) {
    const move = MOVES[me.fighter][slot], lands = move?.contacts[0] ?? .3;
    const lunge = move?.style === 'melee' ? .6 * Math.min(3, (move.lunge ?? 3.2) * Math.max(0, lands - (move.lungeDelay ?? 0))) : 0;
    return eta - lunge / Math.max(4, this.closing) - lands - this.timeErr <= 1 / 50;
  }
  /** The slot a person learns makes a real strike with their fighter: a melee heavy that is not a launcher, else such a
   *  special (off cooldown), else none. */
  private strikeSlot(me: PlayerState, now: number): AttackSlot | undefined {
    const moves = MOVES[me.fighter], fit = (m: typeof moves.heavy | undefined) => !!m && m.style === 'melee' && m.outcome !== 'launch' && m.outcome !== 'hop';
    if (fit(moves.heavy)) return 'heavy';
    if (fit(moves.special) && (me.cooldowns.special ?? 0) <= now) return 'special';
    return undefined;
  }
  private inRange(b: BallState, enemyZ: number) { return Math.abs(enemyZ - b.z) < GOAL_RULES.halfZ * 1.15 && Math.abs(b.x) < GOAL_RULES.halfX * .85; }

  // ─── Sky Spike ────────────────────────────────────────────────────────────────────────────────────────────────────
  /** MASHER: the stick at the ball (on this side of the net), every button near it, a jump now and then. */
  private mashSpike(me: PlayerState, seat: BallSeat, view: BallView, b: BallState, now: number, input: Command) {
    const sign = seat.team === 'red' ? -1 : 1;
    this.stick(me, {x: b.x, z: sign * Math.max(.6, sign * b.z)}, input, .2);
    const near = Math.hypot(b.x - me.x, b.y - (me.y + 1), b.z - me.z) < 5 && (view.phase !== 'kickoff' || view.serverId === this.id);
    if (near && now >= this.nextPress) {
      input.attack = this.anySlot(me); this.nextPress = now + HUMAN.masher.pace[0] + this.rng() * (HUMAN.masher.pace[1] - HUMAN.masher.pace[0]);
      if (this.rng() < .06 && me.grounded) this.jump(input, now, .3);
    }
    return input;
  }
  /** CASUAL and SKILLED Sky Spike: play the ball that comes down here, three touches; the skilled one with every choice
   *  and every timing the cues teach. */
  private volley(me: PlayerState, seat: BallSeat, view: BallView, b: BallState, bodies: Body[], now: number, input: Command) {
    const R = SPIKE_RULES, team = seat.team, sign = team === 'red' ? -1 : 1, skilled = this.style === 'skilled', base = input.yaw;
    const mates = bodies.filter(q => q.alive && Math.sign(q.z || sign) === sign && q.id !== this.id);
    const rivals = bodies.filter(q => q.alive && Math.sign(q.z) === -sign);
    // The far court's emptiest spot, aimed at as far as the broadcast camera's pan allows (26 degrees).
    const empty = (deep: readonly number[]) => {
      let best = {x: 0, z: -sign * 6}, bestD = -1;
      for (const x of [-5.5, -2.75, 0, 2.75, 5.5]) for (const z of deep) {
        const d = Math.min(9, ...rivals.map(p => Math.hypot(p.x - x, p.z + sign * z)));
        if (d > bestD) { bestD = d; best = {x, z: -sign * z}; }
      }
      return best;
    };
    const aimAt = (to: {x: number; z: number}, from: {x: number; z: number}) => skilled ? wrap(base + clamp(wrap(Math.atan2(to.x - from.x, to.z - from.z) - base), -.45, .45)) : base;
    // A front-row player, on the flank the other front-row one is not on.
    const front = mates.find(q => Math.abs(q.z) < 5);
    // (A skilled one takes the serve deeper, where a serve comes down: the front row's spot leaves the deep corners.)
    const home = {x: front && front.x > 0 ? -3.4 : 3.4, z: sign * (skilled && view.servingTeam !== team && view.rally <= 1 ? 6 : 3.2)};
    if (view.phase === 'kickoff') {
      if (view.serverId !== this.id) { this.stick(me, home, input, .5); return input; }
      return this.serving(me, b, sign, now, input, empty, aimAt);
    }
    this.serveKind = null; this.serveAt = -1;
    const touches = view.touchTeam === team ? view.touches : 0;
    this.roll(b);
    // A hard ball of theirs whose line passes just out of reach (the DIVE cue: 0.9-1.75 m, within 0.55 s): dive at it.
    if (skilled && me.grounded && now >= this.nextDash && b.lastTeam !== team && touches === 0 && Math.hypot(b.vx, b.vy, b.vz) >= 17) {
      const dive = this.diveTo(me, b);
      if (dive) { this.stick(me, dive, input, 0); input.dash = true; this.nextDash = now + .8; return input; }
    }
    // Their set up at the net, its hitter going up: the block, shadowing it at the net, up with the hitter, the guard
    // timed to the spike (the BLOCK cue) - a STUFF BLOCK.
    if (skilled && view.touchTeam !== team && view.touches >= 2 && sideOf(b.z) !== team && b.shot === 'set') {
      const hit = landing(this.mode, b, this.apex + .9, 2.5);
      if (hit.t > .02 && Math.abs(hit.z) < 3.4 && Math.abs(hit.x - me.x) < 4 && Math.abs(me.z) < 5) {
        this.blockFor = `${b.lastId}:${view.rally}`;
        this.stick(me, {x: clamp(hit.x, -R.courtHalfX + .5, R.courtHalfX - .5), z: sign * .95}, input, .15);
        if (me.grounded && now >= this.nextJump && hit.t < .06 + this.rise * .8 + this.timeErr) this.jump(input, now, this.rise + .05);
        input.yaw = base;
        // (The spike comes off the hitter's hand about 0.2 s after the ball reaches it: the guard pressed a tenth before.)
        if (!me.grounded && hit.t < .12 + this.timeErr && now - this.guardAt > .6) { input.guard = true; this.guardAt = now; }
        return input;
      }
    }
    if (skilled && !me.grounded && now - this.guardAt < .45 && this.blockFor === `${b.lastId}:${view.rally}`) { input.guard = true; return input; }
    const fall = landing(this.mode, b, 1.2, 3);
    const comingHere = sideOf(fall.z) === team && Math.abs(fall.x) < R.halfX && Math.abs(fall.z) < R.halfZ && !(b.lastTeam === team && touches >= R.touches);
    const onHere = sideOf(b.z) === team && Math.abs(b.z) > .4;
    if (comingHere || onHere) {
      const target = onHere && b.y < 3 ? {x: b.x, z: b.z} : {x: fall.x + this.readErr.x, z: fall.z + this.readErr.z};
      const mine = mates.every(q => gap(q, target) > gap(me, target) - .3) || gap(me, b) < 1.6;
      if (!mine) { this.stick(me, touches >= 1 ? {x: clamp(target.x * .5, -5, 5), z: sign * 2.4} : home, input, .6); return input; }
      // The attack: two touches in, the ball coming down at the net. Under it, a little behind, and up so the top of
      // the jump meets it (the JUMP cue, then the APEX cue's swing) - or, for a casual player, a jump and a swing on
      // the way up, now and then.
      const top = this.apex + .9;
      const hit = touches >= 2 ? landing(this.mode, b, skilled ? top : 4, 2.5) : undefined;
      const attack = !!hit && hit.t > .05 && Math.abs(hit.z) < 4.6 && Math.abs(hit.x) < R.courtHalfX + .5;
      const key = `${view.rally}:${b.lastId}:${touches}`;
      if (key !== this.jumpsFor) { this.jumpsFor = key; this.jumpsHere = skilled || this.rng() < .5; }
      if (attack && me.grounded && this.jumpsHere) {
        const d = this.stick(me, {x: hit!.x, z: hit!.z + sign * .7}, input, .15);
        const lead = skilled ? this.rise - .1 + .23 : .12;
        if (now >= this.nextJump && d < 1.6 && hit!.t < lead + this.timeErr) { this.jump(input, now, this.rise + .05); this.spikeAt = now; this.swingAt = skilled ? this.rise - .1 + this.normal() * this.limits.timing : 0; }
        return input;
      }
      if (!me.grounded && now - this.spikeAt < 1) {
        // In the air for the attack: the swing at the top (the APEX cue), or on takeoff; a TIP over a block that is up.
        if (now - this.spikeAt >= this.swingAt && now >= this.nextPress && Math.hypot(b.x - me.x, b.y - (me.y + 1.1), b.z - me.z) < 3.8) {
          const blocked = rivals.some(p => !p.grounded && Math.abs(p.z) < 2 && Math.abs(p.x - b.x) < 1.8 && p.y > .8);
          if (this.tipFor !== key) { this.tipFor = key; this.tipping = skilled && blocked && this.rng() < .5; }
          const to = empty([3, 5.5, 8.5]);
          this.press(input, this.tipping ? 'light' : 'heavy', aimAt(to, b), now);
        }
        return input;
      }
      this.stick(me, {x: target.x, z: target.z + sign * .35}, input, .2);
      const dBall = gap(me, b), dy = b.y - (me.y + 1);
      const reach = dBall < 1.9 && dy > -1.2 && dy < (touches === 1 && b.vy < 0 ? 3 : 1.7);
      if (!reach || now < this.nextPress) return input;
      // The set's choice, once a possession: a QUICK SET (a hop and the set from the air) to a front-row team-mate at
      // the net, a BACK SET (the stick across) to the far wing, or the floating set.
      if (touches === 1) {
        if (this.setFor !== key) {
          this.setFor = key; const r = this.rng();
          this.setKind = !skilled ? 'high' : mates.some(q => Math.abs(q.z) < 3.6) && r < .25 ? 'quick' : r < .5 ? 'back' : 'high';
        }
        if (this.setKind === 'quick' && me.grounded && b.y > me.y + 1.2 && now >= this.nextJump) { this.jump(input, now, .12); return input; }
        if (this.setKind === 'back') { input.moveX = me.x > 0 ? -1 : 1; input.moveZ = 0; }
        this.press(input, 'light', base, now);
        return input;
      }
      // The third touch from the floor: a hit over (a drive) into the emptiest spot; the first, a bump.
      if (touches >= 2) this.press(input, me.ultimate >= 100 ? 'ultimate' : 'heavy', aimAt(empty([3, 5.5, 8.5]), b), now);
      else this.press(input, 'light', base, now);
      return input;
    }
    this.stick(me, home, input, .6);
    return input;
  }
  /** The DIVE: where a hard ball's line passes this player 0.9-1.75 m off within the next 0.55 s (beyond the reach of a
   *  body, inside a dive's), or undefined. */
  private diveTo(me: PlayerState, b: BallState) {
    const probe = {...b}, contacts: BallContact[] = [];
    for (let t = 0; t < .55; t += 1 / 60) {
      stepBall(this.mode, probe, 1 / 60, contacts);
      if (sideOf(probe.z) !== sideOf(me.z)) continue;
      const d = Math.hypot(probe.x - me.x, probe.z - me.z);
      if (probe.y < 2.2 && d > .9 && d < 1.75 && t > this.timeErr) return {x: probe.x, z: probe.z};
      if (probe.y < .6) return undefined;
    }
    return undefined;
  }
  /** The serve: walk up behind the hanging ball, a breath, then - skilled - a JUMP SERVE struck at the top of the jump
   *  (or a FLOAT now and then), aimed at the seam; casual, a FLOAT or a DRIVE at the middle of the far court. */
  private serving(me: PlayerState, b: BallState, sign: number, now: number, input: Command,
    empty: (deep: readonly number[]) => {x: number; z: number}, aimAt: (to: {x: number; z: number}, from: {x: number; z: number}) => number) {
    const skilled = this.style === 'skilled';
    if (!this.serveKind) this.serveKind = skilled ? (this.rng() < .7 ? 'jump' : 'float') : this.rng() < .5 ? 'float' : 'drive';
    const yaw = aimAt(empty(this.serveKind === 'float' ? [3.5, 6, 9] : [6.5, 8, 9.5]), b);
    if (!me.grounded && this.serveKind === 'jump') {
      if (now - this.serveJump >= this.swingAt && now >= this.nextPress) this.press(input, 'heavy', yaw, now);
      input.yaw = yaw;
      return input;
    }
    const d = this.stick(me, {x: b.x, z: b.z + sign * 1.1}, input, .25);
    if (d < .6) {
      input.yaw = yaw;
      if (this.serveAt < 0) this.serveAt = now + .4 + this.rng() * .6;
      if (now >= this.serveAt && now >= this.nextPress && now >= this.nextJump) {
        if (this.serveKind === 'jump') { this.jump(input, now, this.rise + .05); this.serveJump = now; this.swingAt = this.rise - .1 + this.normal() * this.limits.timing; }
        else { this.press(input, this.serveKind === 'float' ? 'light' : 'heavy', yaw, now); this.serveAt = -1; }
      }
    }
    return input;
  }
}
