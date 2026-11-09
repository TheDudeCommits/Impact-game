import type {AttackSlot, PlayerInput, PlayerState} from '../types';
import {MOVES} from '../moves';
import {BALL_ID, GOAL_RULES, SPIKE_RULES, otherTeam, type BallModeId, type BallSeat, type BallTeam, type BallView} from './model';
import {goalZ, landing, sideOf, stepBall, type BallContact} from './physics';
import type {BallState} from './model';

type Command = Omit<PlayerInput, 'seq'>;
const gap = (a: {x: number; z: number}, b: {x: number; z: number}) => Math.hypot(a.x - b.x, a.z - b.z);
/** Sky Spike's attack: the height a spiker meets the ball at, and how long before the ball gets there they leave the
 *  floor. The swing goes on takeoff: its contact lands about 0.12 s later, as the rising body meets the ball (a jump
 *  climbs 4.5-5.5 m, and an air heavy can pull a fighter back down, so a swing at the top would come too late). */
const SPIKE_HIT = 4, SPIKE_RISE = .15;
/** A block leaves the floor this long before the spike crosses the net, so the body is a metre or two up and rising as it
 *  arrives (leave sooner and the spike passes under the top of the jump). */
const BLOCK_LEAD = .1;
/** Scratch for reading a struck ball's flight to the net. */
const probe = {} as BallState, contacts: BallContact[] = [];
/** Where and when the ball crosses the net, run on along its flight (half a second at most), or undefined. */
function crossing(b: BallState): {x: number; y: number; t: number} | undefined {
  Object.assign(probe, b); probe.held = false;
  const side = Math.sign(probe.z) || 1;
  for (let t = 0; t < .6; t += 1 / 60) {
    stepBall('sky-spike', probe, 1 / 60, contacts);
    if (Math.sign(probe.z) !== side) return {x: probe.x, y: probe.y, t: t + 1 / 60};
  }
  return undefined;
}
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
/** A seat of the view by id (no allocation: six at most). */
function seatOf(view: BallView, id: string): BallSeat | undefined {
  for (let i = 0; i < view.seats.length; i++) if (view.seats[i].id === id) return view.seats[i];
  return undefined;
}
/** How far `p` stands off the segment from `a` to `b`, along the floor. */
function offLine(p: {x: number; z: number}, a: {x: number; z: number}, b: {x: number; z: number}) {
  const dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz || 1, t = clamp(((p.x - a.x) * dx + (p.z - a.z) * dz) / l2, 0, 1);
  return Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t);
}
/** The bots show off a little. A SUPER SHOT on its way at a bot
 *  is guarded as it arrives (a perfect guard: the TECHNIQUE DUEL) this much of the time, more the better the bot; a
 *  guard leaves `GUARD_LEAD` seconds before the ball gets there (the just-guard window is 0.25 s). A bot in reach of a
 *  ball with a team-mate placed to finish it sets them up (a LINK SHOT) about `LINK_SET` of the time, no more than once
 *  every few seconds. Measured on headless bot matches. */
const DUEL_TRY = [.55, .35] as const, GUARD_LEAD = .15, LINK_SET = .7, LINK_GAP = 2.6;
/** Goal Rush: a SUPER SHOT is struck from up to this far out, with the goal in sight (not from too wide). */
const SUPER_RANGE = 40, SUPER_WIDE = 15;

/** A bot that plays the ball game it was seated in, through the same inputs a person sends (a stick, a view, the
 *  buttons): it reads the ball - where it is, where it will come down - and the job its side gave it (BallMatch's
 *  roles), and never touches the ball any way a person could not. `skill` (0-1) is how cleanly it times and aims. */
export class BallBrain {
  private nextPress = 0;
  private nextJump = 0;
  private jumpUntil = 0;
  private nextDash = 0;
  /** Goal Rush's fights: when this bot may tackle again, and go up again off the floor (the double jump) or dash at the
   *  ball in the air (the aerial). */
  private nextTackle = 0;
  private nextAerial = 0;
  /** The opponent this bot's tackle is on, and until when it follows the first blow with its string. */
  private tackling: {id: string; until: number} | null = null;
  private serveAt = -1;
  /** When this bot left the floor for a spike. */
  private spikeAt = -Infinity;
  /** The block it is going up for: timed to the hit (a STUFF BLOCK) or the hands up early (soft), and whose spike. */
  private stuff = false; private stuffFor: string | null = null;
  /** A SUPER SHOT read: whose, and whether this bot goes for the perfect guard against it. */
  private duelFor = ''; private duelTry = false;
  /** Goal Rush: when this bot may next set a team-mate up. */
  private nextLink = 0;
  private readonly skill: number;
  private readonly flank: number;
  constructor(readonly id: string, readonly mode: BallModeId, readonly index: number, private readonly rng: () => number) {
    this.skill = .55 + rng() * .4;
    this.flank = index % 2 ? 1 : -1;
  }
  command(me: PlayerState, seat: BallSeat, players: readonly PlayerState[], view: BallView, now: number): Command {
    const input: Command = {moveX: 0, moveZ: 0, yaw: me.yaw, targetId: BALL_ID, lock: true};
    if (!me.alive || view.phase === 'over' || view.phase === 'countdown') return input;
    if (now < this.jumpUntil) input.jumpHeld = true;
    if (view.phase === 'scored' || (view.phase === 'kickoff' && this.mode === 'goal-rush')) return input;
    return this.mode === 'goal-rush' ? this.football(me, seat, players, view, now, input) : this.volley(me, seat, players, view, now, input);
  }

  private run(me: PlayerState, to: {x: number; z: number}, input: Command, now: number, stop = .6, sprint = 10) {
    const dx = to.x - me.x, dz = to.z - me.z, d = Math.hypot(dx, dz);
    if (d > stop) { input.moveX = dx / d; input.moveZ = dz / d; input.yaw = Math.atan2(dx, dz); }
    if (d > sprint && now >= this.nextDash && me.grounded && me.stamina > 40) { input.dash = true; this.nextDash = now + 1.4 + this.rng() * 1.2; }
    // The ball rooms' boost (a dash runs on into it while the stick holds): let go of it a few strides short, or with
    // the bar low (a keeper's guard needs some), by easing the stick for a tick - the run carries on after.
    if (me.boost && (d < 3 || me.stamina < 45) && d > stop) { input.moveX = dx / d * .45; input.moveZ = dz / d * .45; }
    return d;
  }
  /** Goal Rush's fights (GOAL_FIGHT): a tackle, never a brawl away from the ball. The one of the other side at the ball
   *  (nearer it than this bot, and at its feet) or standing in the way to it, within a swing's reach, is struck at -
   *  while the ball itself is out of this bot's reach (the swing's aim takes the ball whenever it is near: simulation.ts
   *  assistAim). Whether it swung. */
  private tackle(me: PlayerState, seat: BallSeat, players: readonly PlayerState[], b: {x: number; y: number; z: number}, input: Command, now: number, near = 2.8) {
    if (me.team !== seat.team || now < this.nextPress) return false;
    // A tackle that has begun follows its first blow with the light string while they are still in reach.
    const on = this.tackling && now < this.tackling.until ? players.find(q => q.id === this.tackling!.id && q.alive) : undefined;
    if (on && gap(me, on) < 2.6 && Math.abs(on.y - me.y) < 1.6) { this.press(input, 'light', Math.atan2(on.x - me.x, on.z - me.z), now, .14); return true; }
    if (now < this.nextTackle) return false;
    const toBall = gap(me, b);
    let best: PlayerState | undefined, bestD = 2.4;
    for (const q of players) {
      if (!q.alive || q.id === me.id || q.team === seat.team || Math.abs(q.y - me.y) > 1.4) continue;
      const d = gap(me, q);
      if (d >= bestD || d < 1e-3) continue;
      const theirs = gap(q, b);
      const carrier = theirs < near && theirs < toBall;
      const inWay = d < toBall && ((q.x - me.x) * (b.x - me.x) + (q.z - me.z) * (b.z - me.z)) / (d * Math.max(1e-3, toBall)) > .8;
      if (carrier || inWay) { best = q; bestD = d; }
    }
    if (!best) return false;
    const string = this.rng() < .35 + this.skill * .4;
    this.press(input, string ? 'light' : 'heavy', Math.atan2(best.x - me.x, best.z - me.z), now, string ? .14 : .4);
    this.tackling = string ? {id: best.id, until: now + .9 + this.skill * .5} : null;
    this.nextTackle = now + .9 + this.rng() * (1.6 - this.skill);
    return true;
  }
  /** RUMBLE: the nearest charm within `within` metres (on its own side of the net in Sky Spike), if any. */
  private charm(me: PlayerState, view: BallView, within: number, side?: number) {
    let best: {x: number; z: number} | undefined, bestD = within;
    for (const c of view.charms) { const d = gap(me, c); if (d < bestD && (side === undefined || Math.sign(c.z) === side)) { best = c; bestD = d; } }
    return best;
  }
  private press(input: Command, slot: NonNullable<Command['attack']>, yaw: number, now: number, wait = .4) {
    input.attack = slot; input.yaw = yaw + (this.rng() - .5) * (1 - this.skill) * .5;
    this.nextPress = now + wait + this.rng() * .25;
  }
  private jump(input: Command, now: number) {
    input.jump = true; input.jumpHeld = true; this.jumpUntil = now + .35; this.nextJump = now + 1.1;
  }

  // ─── Goal Rush ────────────────────────────────────────────────────────────────────────────────────────────────────
  private football(me: PlayerState, seat: BallSeat, players: readonly PlayerState[], view: BallView, now: number, input: Command): Command {
    const b = view.ball, R = GOAL_RULES, team = seat.team, ownZ = goalZ(team), enemyZ = goalZ(otherTeam(team)), toward = Math.sign(enemyZ);
    // Where the ball is about to be: a high ball where it comes down, a low one a moment ahead.
    const lead = b.y > 2 ? landing(this.mode, b, 1.4, 2.5) : {x: b.x + b.vx * .22, z: b.z + b.vz * .22, t: .22};
    const focus = {x: clamp(lead.x, -R.halfX + 1, R.halfX - 1), z: clamp(lead.z, -R.halfZ + 1, R.halfZ - 1)};
    const goal = {x: clamp(b.x * .25, -R.goalHalfWidth + 1.2, R.goalHalfWidth - 1.2) + (this.rng() - .5) * (1 - this.skill) * 3, z: enemyZ};
    const shotYaw = Math.atan2(goal.x - b.x, goal.z - b.z);
    const dBall = gap(me, b), dy = b.y - (me.y + 1);
    const inReach = dBall < 2.2 && dy > -1.4 && dy < 1.7;
    const role = seat.role ?? 'attack';
    const ownDanger = Math.sign(b.vz) === Math.sign(ownZ) && Math.abs(b.z - ownZ) < 22 && Math.hypot(b.vx, b.vz) > 9;
    // Up for a ball in the air in front of it.
    if (now >= this.nextJump && me.grounded && dBall < 2.6 && b.y > 2.6 && b.y < 8.5 && b.vy < 5 && role !== 'keeper') this.jump(input, now);
    // A SUPER SHOT coming through this bot: the guard timed to it (a perfect one is a TECHNIQUE DUEL).
    if (this.brace(me, b, team, now, input, role === 'keeper')) return input;
    if (role === 'keeper') {
      let spot = {x: clamp(b.x * .4, -R.goalHalfWidth + .8, R.goalHalfWidth - .8), z: ownZ - Math.sign(ownZ) * 2.4};
      if (ownDanger && Math.abs(b.vz) > .5) {
        const t = (ownZ - b.z) / b.vz;
        if (t > 0 && t < 2.5) spot = {x: clamp(b.x + b.vx * t, -R.goalHalfWidth + .5, R.goalHalfWidth - .5), z: ownZ - Math.sign(ownZ) * 1.4};
      }
      // A ball loose near the goal is the keeper's to clear.
      if (gap(b, {x: 0, z: ownZ}) < 13 && !ownDanger && b.y < 2.4) spot = {x: b.x - Math.sin(shotYaw) * 1.2, z: b.z - Math.cos(shotYaw) * 1.2};
      // A charm near the goal, with the ball far off, is worth the few steps.
      const near = !ownDanger && gap(b, {x: 0, z: ownZ}) > 20 ? this.charm(me, view, 7) : undefined;
      if (near) spot = near;
      this.run(me, spot, input, now, .4, 14);
      const speed = Math.hypot(b.vx, b.vy, b.vz);
      if (dBall < 3 && ownDanger && speed > 13 && this.rng() < .35 + this.skill * .5) { input.guard = true; input.yaw = Math.atan2(b.x - me.x, b.z - me.z); }
      else if (inReach && now >= this.nextPress) this.press(input, me.ultimate >= 100 ? 'ultimate' : 'heavy', Math.atan2(toward * 9 * this.flank, toward * 20), now, .5);
      // A striker on the ball in front of goal is tackled.
      else if (!inReach && Math.abs(b.z - ownZ) < 13) this.tackle(me, seat, players, b, input, now, 2.2);
      return input;
    }
    // A team-mate's pass on its way here: met first time at the goal (a LINK SHOT).
    if (this.meet(me, b, team, enemyZ, now, input)) return input;
    if (role === 'support') {
      const back = {x: clamp(b.x * .5 + this.flank * 7, -R.halfX + 2, R.halfX - 2), z: clamp(b.z + (ownZ - b.z) * .42, -R.halfZ + 3, R.halfZ - 3)};
      const chase = dBall < 5 && Math.sign(ownZ) * (me.z - b.z) > 0;
      // RUMBLE: the support goes for a charm when the ball is not theirs to play.
      const near = !chase && !ownDanger && dBall > 7 ? this.charm(me, view, 12) : undefined;
      this.run(me, chase ? {x: b.x - Math.sin(shotYaw) * 1.2, z: b.z - Math.cos(shotYaw) * 1.2} : near ?? back, input, now, near ? .2 : .8, 12);
      if (inReach && now >= this.nextPress) {
        if (this.setUp(me, b, team, toward, enemyZ, players, view, now, input)) return input;
        // With the meter full and the goal in sight, the super shot.
        const sight = Math.abs(enemyZ - b.z) < SUPER_RANGE && Math.abs(b.x) < SUPER_WIDE;
        this.press(input, me.ultimate >= 100 && sight ? 'ultimate' : this.rng() < .6 ? 'heavy' : 'light', shotYaw, now);
      }
      else if (!inReach && (chase || dBall < 6)) this.tackle(me, seat, players, b, input, now);
      return input;
    }
    // The attacker: round behind the ball, then drive it at the goal.
    const ux = Math.sin(shotYaw), uz = Math.cos(shotYaw);
    let approach = {x: focus.x - ux * 1.3, z: focus.z - uz * 1.3};
    const ahead = (me.x - focus.x) * ux + (me.z - focus.z) * uz;
    if (ahead > .4 && dBall > 1.2) approach = {x: focus.x - ux * 2.6 - uz * 2.6 * this.flank, z: focus.z - uz * 2.6 + ux * 2.6 * this.flank};
    // A charm a stride or two off the way to a ball still far off.
    const near = dBall > 6 ? this.charm(me, view, 3.5) : undefined;
    if (near) approach = near;
    this.run(me, approach, input, now, .3, 9);
    if (dBall < 3.5) input.yaw = shotYaw;
    // The aerial (BALL_SPORT): off the floor under a high ball, up again off the air and a dash at it.
    if (!me.grounded && now >= this.nextAerial && b.y > me.y + 2 && b.y < 10 && gap(me, b) < 4.5 && this.rng() < .25 + this.skill * .5) {
      const up = Math.hypot(b.x - me.x, b.y - (me.y + 1), b.z - me.z);
      if (b.y - me.y > 3.2) { input.jump = true; input.jumpHeld = true; this.jumpUntil = now + .3; }
      else if (up < 7 && me.stamina > 30) { input.dash = true; input.moveX = (b.x - me.x) / Math.max(.1, gap(me, b)); input.moveZ = (b.z - me.z) / Math.max(.1, gap(me, b)); }
      this.nextAerial = now + .35;
    }
    const toGoal = Math.abs(enemyZ - b.z);
    if (inReach && now >= this.nextPress) {
      const air = !me.grounded;
      if (!air && this.setUp(me, b, team, toward, enemyZ, players, view, now, input)) return input;
      const slot = me.ultimate >= 100 && toGoal < SUPER_RANGE && Math.abs(b.x) < SUPER_WIDE ? 'ultimate'
        : air ? (this.rng() < .6 ? 'heavy' : 'light')
        : toGoal < 26 && (me.cooldowns.special ?? 0) <= now && this.rng() < .3 ? 'special'
        : toGoal < 32 ? (this.rng() < .7 ? 'heavy' : 'light')
        : this.rng() < .55 ? 'light' : 'heavy';
      this.press(input, slot, shotYaw, now, slot === 'light' ? .28 : .5);
    }
    // Their striker on the ball, or one in the way to it: tackled.
    else if (!inReach && dBall < 6) this.tackle(me, seat, players, b, input, now);
    return input;
  }

  /** A SUPER SHOT on its way through this bot (or, for the keeper, into its goal): step into its line and put the guard
   *  up as it arrives, so the guard is perfect - the TECHNIQUE DUEL. Decided once a shot; true while it is bracing. */
  private brace(me: PlayerState, b: BallState, team: BallTeam, now: number, input: Command, keeper: boolean): boolean {
    if (!b.super || b.lastTeam === null || b.lastTeam === team || b.clash > now) { this.duelFor = ''; return false; }
    const speed = Math.hypot(b.vx, b.vy, b.vz);
    if (speed < 8) return false;
    // (Rolled once a shot: the read is whether to try at all.)
    const key = b.lastId ?? '?';
    if (key !== this.duelFor) { this.duelFor = key; this.duelTry = this.rng() < DUEL_TRY[0] + this.skill * DUEL_TRY[1] - (keeper ? 0 : .25); }
    if (!this.duelTry) return false;
    // Where it passes this bot's line: along its flight, the point nearest the body.
    const fx = b.vx / speed, fy = b.vy / speed, fz = b.vz / speed;
    const along = (me.x - b.x) * fx + (me.y + 1 - b.y) * fy + (me.z - b.z) * fz;
    if (along < -.5) return false;
    const px = b.x + fx * along, pz = b.z + fz * along, miss = Math.hypot(me.x - px, me.z - pz);
    const eta = along / speed;
    // Off its line: the keeper runs across to meet it (about 9 m a second, the dash), anyone else only guards one at them.
    if (miss > 1.1 + (keeper ? Math.max(0, eta) * 9 : 0) || eta > 1.6) return false;
    if (miss > .5) this.run(me, {x: px, z: pz}, input, now, .2, .5);
    input.yaw = Math.atan2(b.x - me.x, b.z - me.z);
    // The guard comes up GUARD_LEAD before the ball does (a fresh press: down until then).
    const up = eta <= GUARD_LEAD + (1 - this.skill) * .05;
    input.guard = up;
    return true;
  }
  /** A LINK SHOT set up: a team-mate ahead of the ball, a short pass away, in range of the goal and open (no rival on
   *  them or across the pass), and this bot farther out than they are: a tap to them (strike.ts leads their run), now
   *  and then. True when it passed. */
  private setUp(me: PlayerState, b: BallState, team: BallTeam, toward: number, enemyZ: number, players: readonly PlayerState[], view: BallView, now: number, input: Command): boolean {
    if (now < this.nextLink || !me.grounded || b.y > 1.3) return false;
    let mate: PlayerState | undefined, best = Infinity;
    for (const p of players) {
      if (p.id === me.id || !p.alive || !p.grounded) continue;
      const seat = seatOf(view, p.id);
      if (!seat || seat.team !== team || seat.role === 'keeper') continue;
      const d = gap(p, b), ahead = toward * (p.z - b.z), toGoal = Math.abs(enemyZ - p.z);
      if (d < 3.2 || d > 7.4 || ahead < -2 || toGoal > 24 || Math.abs(p.x) > 12 || toGoal > Math.abs(enemyZ - me.z) + 1) continue;
      let open = true;
      for (const r of players) {
        if (!r.alive) continue;
        const rs = seatOf(view, r.id);
        if (!rs || rs.team === team) continue;
        if (gap(r, p) < 2.2 || offLine(r, b, p) < 1.1) { open = false; break; }
      }
      if (open && toGoal + d < best) { best = toGoal + d; mate = p; }
    }
    if (!mate) return false;
    // Now and then: a bot that passes on the chance does not ask again for a moment.
    const pass = this.rng() < LINK_SET;
    this.nextLink = now + (pass ? LINK_GAP : 1);
    if (!pass) return false;
    this.press(input, 'light', Math.atan2(mate.x - b.x, mate.z - b.z), now, .45);
    return true;
  }
  /** A team-mate's pass coming to this bot: stand for it facing the goal, and strike it first time, the blow timed to land
   *  as the ball does (a heavy; the special if the heavy is a launcher, which would only pop it up). True while meeting it. */
  private meet(me: PlayerState, b: BallState, team: BallTeam, enemyZ: number, now: number, input: Command): boolean {
    if (b.shot !== 'tap' || b.lastTeam !== team || b.lastId === me.id || !me.grounded) return false;
    const dx = me.x - b.x, dz = me.z - b.z, d = Math.hypot(dx, dz), flat = Math.hypot(b.vx, b.vz);
    const closing = (b.vx * dx + b.vz * dz) / Math.max(.01, d);
    if (closing < 4 || d > 9 || Math.abs(b.vx * dz - b.vz * dx) / Math.max(.01, flat) > 1.6) return false;
    const moves = MOVES[me.fighter];
    const heavyPops = moves.heavy.outcome === 'launch' || moves.heavy.outcome === 'hop';
    const slot: AttackSlot = me.ultimate >= 100 ? 'ultimate' : heavyPops && (me.cooldowns.special ?? 0) <= now ? 'special' : 'heavy';
    const lands = moves[slot]?.contacts[0] ?? .35;
    input.moveX = input.moveZ = 0;
    const goalYaw = Math.atan2(clamp(b.x * .25, -GOAL_RULES.goalHalfWidth + 1.2, GOAL_RULES.goalHalfWidth - 1.2) - me.x, enemyZ - me.z);
    input.yaw = goalYaw;
    if (now >= this.nextPress && (d - 1.2) / closing <= lands + .04) this.press(input, slot, goalYaw, now, .6);
    return true;
  }

  // ─── Sky Spike ────────────────────────────────────────────────────────────────────────────────────────────────────
  private volley(me: PlayerState, seat: BallSeat, players: readonly PlayerState[], view: BallView, now: number, input: Command): Command {
    const b = view.ball, R = SPIKE_RULES, team = seat.team, sign = team === 'red' ? -1 : 1;
    const rivals = players.filter(p => p.alive && Math.sign(p.z) === -sign);
    // Where to send it: the far court's emptiest spot.
    const gapSpot = (() => {
      let best = {x: 0, z: -sign * 6}, bestD = -1;
      for (const x of [-5, -2.5, 0, 2.5, 5]) for (const z of [3, 5.5, 8.5]) {
        const d = Math.min(9, ...rivals.map(p => Math.hypot(p.x - x, p.z + sign * z)));
        if (d > bestD) { bestD = d; best = {x, z: -sign * z}; }
      }
      return best;
    })();
    const sendYaw = (from: {x: number; z: number}) => Math.atan2(gapSpot.x - from.x, gapSpot.z - from.z);
    const home = seat.role === 'back' ? {x: 0, z: sign * 7.4} : {x: this.flank * 3.4, z: sign * 3.2};
    if (view.phase === 'kickoff') {
      if (view.serverId !== seat.id) { this.run(me, home, input, now, .5, 30); return input; }
      // The serve: walk up behind the ball, a breath, then strike it over (a short one: the point's celebration plays
      // on meanwhile, and the match gets back under way).
      const spot = {x: b.x, z: b.z + sign * 1.1};
      const d = this.run(me, spot, input, now, .25, 30);
      if (d < .6) {
        input.yaw = sendYaw(b);
        if (this.serveAt < 0) this.serveAt = now + .25 + this.rng() * .45;
        if (now >= this.serveAt && now >= this.nextPress) { this.press(input, this.rng() < .55 ? 'heavy' : 'light', sendYaw(b), now, .6); this.serveAt = -1; }
      }
      return input;
    }
    this.serveAt = -1;
    // A SUPER SHOT coming through this bot: the guard timed to it (a perfect one is a TECHNIQUE DUEL).
    if (this.brace(me, b, team, now, input, false)) return input;
    const fall = landing(this.mode, b, 1.2, 3);
    const comingHere = sideOf(fall.z) === team && Math.abs(fall.x) < R.halfX && Math.abs(fall.z) < R.halfZ;
    const onHere = sideOf(b.z) === team && Math.abs(b.z) > .4;
    const touches = view.touchTeam === team ? view.touches : 0;
    const mates = players.filter(p => p.alive && Math.sign(p.z || sign) === sign);
    // The ball is still theirs, their set up or their spike struck. (This comes before the reads of a ball coming here: a
    // struck spike is forecast to land here, and the blocker would go to dig it instead.) While their set is up the front-row player nearest where it will be spiked shadows it at the
    // net; when the spike comes (a struck ball on its way over, high), they go up to block a breath before it crosses,
    // so the body is a metre or two up and rising as it arrives.
    // (Never a serve: it is the serving side's last touch, and the ball it sends is received, not blocked.)
    const theirs = otherTeam(team), setUp = view.phase === 'live' && view.rally > 0 && b.shot !== 'serve' && view.touchTeam === theirs && view.touches >= 2 && sideOf(b.z) === theirs;
    // Only a set coming down at the net, or the spike off it, is blocked: a deep ball is defended from the back.
    const atNet = (b.shot === 'set' && Math.abs(landing(this.mode, b, SPIKE_HIT, 2.5).z) < 3.4) || ((b.shot === 'spike' || b.shot === 'super') && Math.abs(b.z) < 3.6);
    if (setUp && atNet && seat.role === 'front') {
      const read = landing(this.mode, b, SPIKE_HIT, 2.5), x = read.t > .02 ? read.x : b.x;
      const front = mates.filter(p => p.id !== me.id && Math.abs(p.z) < 3.8);
      // Struck and on its way over: its flight read to where and when it crosses the net.
      const struck = Math.sign(b.vz) === sign && Math.abs(b.vz) > 2 && b.lastTeam === theirs && view.touches >= 3;
      const over = struck ? crossing(b) : undefined;
      const at = over && over.y > SPIKE_RULES.netHeight - .2 ? over : undefined;
      // Out of reach (it crosses too far along the net, or too high to meet): no block - back to defend, to dig it.
      const reachable = !!at && Math.abs(at.x - me.x) < 2.2 && at.y < 5.2;
      if (!front.some(p => Math.abs(p.x - x) < Math.abs(me.x - x) - .3) && !(struck && me.grounded && !reachable)) {
        // Shadow where it will be spiked at the net; once struck, slide to where it crosses and go up a breath before.
        this.run(me, {x: clamp(at ? at.x : x, -R.courtHalfX + .5, R.courtHalfX - .5), z: sign * .95}, input, now, .15, at ? 1.2 : 4);
        // The hands go up early (a soft block) unless this is one of the times it is timed to the hit (a STUFF BLOCK):
        // the better the bot, the more often.
        // (Against a SUPER SHOT the block goes for the stuff far more often: a perfect one is the TECHNIQUE DUEL.)
        if (at && at.t < BLOCK_LEAD + .14 && this.stuffFor !== b.lastId) { this.stuffFor = b.lastId; this.stuff = this.rng() < (b.super ? DUEL_TRY[0] + this.skill * DUEL_TRY[1] : .15 + this.skill * .3); }
        if (at && me.grounded && !this.stuff && at.t < BLOCK_LEAD + .12) { input.guard = true; input.yaw = Math.atan2(0, -sign); }
        if (at && me.grounded && now >= this.nextJump && at.t < BLOCK_LEAD + (1 - this.skill) * .04 && this.rng() < .55 + this.skill * .4) this.jump(input, now);
        if (!me.grounded) { input.guard = true; input.yaw = Math.atan2(0, -sign); }
        return input;
      }
    }
    if (comingHere || onHere) {
      // The one nearest where it comes down plays it; the others make room and offer a set.
      const target = onHere && b.y < 3 ? {x: b.x, z: b.z} : {x: fall.x, z: fall.z};
      const nearest = mates.reduce((best, p) => gap(p, target) < gap(best, target) ? p : best, me);
      // (A set on its way up is the hitter's alone: nobody standing by the setter plays it straight back.)
      const mine = nearest.id === me.id || (gap(me, b) < 1.6 && !(touches === 2 && b.vy > 0));
      if (!mine) {
        const near = touches === 0 ? this.charm(me, view, 5, sign) : undefined;
        const spot = near ?? (touches >= 1 && seat.role === 'front' ? {x: clamp(target.x * .5, -5, 5), z: sign * 2.4} : home);
        this.run(me, spot, input, now, .6, 30);
        return input;
      }
      const dBall = gap(me, b), dy = b.y - (me.y + 1);
      // The attack: two touches in and a high ball coming down near the net. Run in under where it falls through
      // hitting height, a little behind it, and leave the floor so the body meets it on the way up (a jump climbs 4.5-5.5
      // m and the body is at hitting height about 0.2 s after takeoff).
      const hit = touches >= 2 && sideOf(b.z) === team ? landing(this.mode, b, SPIKE_HIT, 2.5) : undefined;
      const attack = !!hit && hit.t > .05 && Math.abs(hit.z) < 4.6 && Math.abs(hit.x) < R.courtHalfX + .5;
      if (attack && me.grounded) {
        const spot = {x: hit!.x, z: hit!.z + sign * .7};
        const d = this.run(me, spot, input, now, .15, 4);
        if (now >= this.nextJump && d < 1.6 && hit!.t < SPIKE_RISE + .04 + (1 - this.skill) * .06) { this.jump(input, now); this.spikeAt = now; }
      } else {
        const under = {x: target.x - Math.sin(sendYaw(target)) * .4 * (touches >= 2 ? 1 : 0), z: target.z + sign * .35};
        // A hard ball coming in (a spike): dive for it, the dig.
        const hard = Math.hypot(b.vx, b.vy, b.vz) > 13 && touches === 0;
        this.run(me, under, input, now, .2, hard ? .9 : 6);
        // A high ball near the net that the read above missed: up for it anyway.
        const spikeable = touches >= 1 && Math.abs(b.z) < 4.5 && b.y > 2.8;
        if (spikeable && me.grounded && now >= this.nextJump && dBall < 2.2 && b.vy < 2 && b.y < 6.5) this.jump(input, now);
      }
      // In the air for a spike, the swing goes at once; any other time, when the ball is in reach.
      const spiking = !me.grounded && now - this.spikeAt < .3 && Math.hypot(b.x - me.x, b.y - (me.y + 1.1), b.z - me.z) < 3.4;
      const reach = spiking || (!me.grounded ? Math.hypot(b.x - me.x, b.y - (me.y + 1.1), b.z - me.z) < 2.3 : dBall < 1.9 && dy > -1.2 && dy < 1.7);
      // A ball this side has already sent over is left alone.
      const sent = touches >= SPIKE_RULES.touches && Math.sign(b.vz) === -sign;
      if (reach && !sent && now >= this.nextPress) {
        let slot: NonNullable<Command['attack']> = 'light';
        if (me.ultimate >= 100 && touches >= 1) slot = 'ultimate';
        else if (touches >= 2 || !me.grounded) slot = this.rng() < .75 ? 'heavy' : 'special';
        else if (touches === 1 && this.rng() < .12 && b.y > 2) slot = 'heavy';
        this.press(input, slot, slot === 'light' ? Math.atan2(-me.x, -me.z) : sendYaw(b), now, .35);
      }
      return input;
    }
    const threat = sideOf(b.z) !== team && Math.abs(b.z) < 4.5 && b.y > 2.4 && view.touchTeam !== team && view.touches >= 1;
    if (threat && seat.role === 'front') {
      const spot = {x: clamp(b.x, -R.courtHalfX + .5, R.courtHalfX - .5), z: sign * 1};
      this.run(me, spot, input, now, .3, 30);
      if (me.grounded && now >= this.nextJump && Math.abs(b.z) < 2.6 && b.y > 2.6 && b.y < 5.5 && this.rng() < .25 + this.skill * .4) this.jump(input, now);
      if (!me.grounded) { input.guard = true; input.yaw = Math.atan2(0, -sign); }
      return input;
    }
    this.run(me, this.charm(me, view, 8, sign) ?? home, input, now, .6, 30);
    return input;
  }
}
