import type {PlayerInput, PlayerState} from '../types';
import {BALL_ID, GOAL_RULES, SPIKE_RULES, otherTeam, type BallModeId, type BallSeat, type BallView} from './model';
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

/** A bot that plays the ball game it was seated in, through the same inputs a person sends (a stick, a view, the
 *  buttons): it reads the ball - where it is, where it will come down - and the job its side gave it (BallMatch's
 *  roles), and never touches the ball any way a person could not. `skill` (0-1) is how cleanly it times and aims. */
export class BallBrain {
  private nextPress = 0;
  private nextJump = 0;
  private jumpUntil = 0;
  private nextDash = 0;
  private serveAt = -1;
  /** When this bot left the floor for a spike. */
  private spikeAt = -Infinity;
  /** The block it is going up for: timed to the hit (a STUFF BLOCK) or the hands up early (soft), and whose spike. */
  private stuff = false; private stuffFor: string | null = null;
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
    return d;
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
    if (now >= this.nextJump && me.grounded && dBall < 2.6 && b.y > 2.6 && b.y < 6.2 && b.vy < 5 && role !== 'keeper') this.jump(input, now);
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
      return input;
    }
    if (role === 'support') {
      const back = {x: clamp(b.x * .5 + this.flank * 7, -R.halfX + 2, R.halfX - 2), z: clamp(b.z + (ownZ - b.z) * .42, -R.halfZ + 3, R.halfZ - 3)};
      const chase = dBall < 5 && Math.sign(ownZ) * (me.z - b.z) > 0;
      // RUMBLE: the support goes for a charm when the ball is not theirs to play.
      const near = !chase && !ownDanger && dBall > 7 ? this.charm(me, view, 12) : undefined;
      this.run(me, chase ? {x: b.x - Math.sin(shotYaw) * 1.2, z: b.z - Math.cos(shotYaw) * 1.2} : near ?? back, input, now, near ? .2 : .8, 12);
      if (inReach && now >= this.nextPress) this.press(input, this.rng() < .6 ? 'heavy' : 'light', shotYaw, now);
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
    const toGoal = Math.abs(enemyZ - b.z);
    if (inReach && now >= this.nextPress) {
      const air = !me.grounded;
      const slot = me.ultimate >= 100 && toGoal < 28 ? 'ultimate'
        : air ? (this.rng() < .6 ? 'heavy' : 'light')
        : toGoal < 26 && (me.cooldowns.special ?? 0) <= now && this.rng() < .3 ? 'special'
        : toGoal < 32 ? (this.rng() < .7 ? 'heavy' : 'light')
        : this.rng() < .55 ? 'light' : 'heavy';
      this.press(input, slot, shotYaw, now, slot === 'light' ? .28 : .5);
    }
    void players;
    return input;
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
      // The serve: walk up behind the ball, a breath, then strike it over.
      const spot = {x: b.x, z: b.z + sign * 1.1};
      const d = this.run(me, spot, input, now, .25, 30);
      if (d < .6) {
        input.yaw = sendYaw(b);
        if (this.serveAt < 0) this.serveAt = now + .7 + this.rng() * 1.2;
        if (now >= this.serveAt && now >= this.nextPress) { this.press(input, this.rng() < .55 ? 'heavy' : 'light', sendYaw(b), now, .6); this.serveAt = -1; }
      }
      return input;
    }
    this.serveAt = -1;
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
    const atNet = (b.shot === 'set' && Math.abs(landing(this.mode, b, SPIKE_HIT, 2.5).z) < 3.4) || (b.shot === 'spike' && Math.abs(b.z) < 3.6);
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
        if (at && at.t < BLOCK_LEAD + .14 && this.stuffFor !== b.lastId) { this.stuffFor = b.lastId; this.stuff = this.rng() < .15 + this.skill * .3; }
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
