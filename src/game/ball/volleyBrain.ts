import {jumpArc} from '../moves';
import type {PlayerInput, PlayerState} from '../types';
import {BALL_ID, SPIKE_RULES, onCourt, spikeCourt, type BallSeat, type BallTeam, type BallView} from './model';
import {sideOf} from './physics';
import {SPIKE_DIG} from './strike';
import {VOLLEY, type Volley} from './volley';

/** VOLLEYBALL's bots (volley.ts; behind `?volleyball`): team-mates and rivals who play volleyball by the
 *  rules a person plays by - the same PLAY, the same walk, the same tiers, through the same Volley.input - with their
 *  level as how cleanly they time a press (`sigma`, seconds) and a jump. A side's roles: one setter (Volley.setter, the
 *  bot nearest the net at the serve) and hitters; a person is always a hitter.
 *  - The ball's owner (Volley.owner) runs to the touch's spot and presses PLAY at its moment, off by its own error.
 *  - The setter sets a person who is ready first (Volley's pick, the stick at rest), else the hitter it picks; a bot
 *    setter never gives a person a QUICK SET (VOLLEY.set's note).
 *  - A hitter a set is laid for waits a stride behind the set's spot, jumps to meet it at the top of the jump (a QUICK
 *    SET's on the way up) and presses PLAY once in the air, the spike placed into the other court's open zone.
 *  - Nobody else stands still: the setter goes to the net, the hitters to their receive and approach spots, by what the
 *    rally is doing. (Cover and choices by level are the next slice's.) */
export const VOLLEY_BOT = {
  sigma: {easy: .14, normal: .08, hard: .045} as Record<string, number>,
  /** How long after the other side's touch a bot moves for the ball (s), by level. */
  react: {easy: .3, normal: .2, hard: .14} as Record<string, number>, spikeRead: 1,
  /** A PERFECT SPIKE is read this many times the bot's reaction (not `spikeRead` of it): too fast to read off the
   *  swing, it is dug where it is hit at a defender, not chased down. */
  perfectRead: 1.3,
  /** A hitter's jump against the set's best moment, by level: on time (within `onTime` s) for `perfect` of its spikes -
   *  about a third of EASY's, half of NORMAL's, two thirds of HARD's, from the top of the jump (PERFECT) - and otherwise
   *  `offFrom`-`offTo` s late: still a spike, GOOD, struck on the way up. (Early is no lever: the top of a jump is broad
   *  - its 0.92 lasts a quarter of a second - and the swing's own lift meets the ball there; much earlier misses it.) */
  jump: {perfect: {easy: .2, normal: .36, hard: .56} as Record<string, number>, onTime: .04, offFrom: .15, offTo: .24},
  /** The share of a bot's serves that are JUMP SERVEs, by level. */
  jumpServe: {easy: .1, normal: .25, hard: .45} as Record<string, number>,
  /** Spots (m): the setter's (x across as the pass's, `setZ` off the net), the hitters' receive (`wide` across, `deep`)
   *  and approach (the set's wing, `approachZ`); a hitter waits `behind` metres back of the set's spot. */
  setZ: 1.8, wide: 3.2, deep: 6.2, approachZ: 4.2, behind: 1.6, defZ: 6.5,
  /** Choices by level: the share of spikes placed into the other court's open zone (the rest go where they
   *  face), of attacks TIPped when a block is up across, and of full meters spent on the SUPER SHOT. */
  place: {easy: 0, normal: .4, hard: .8} as Record<string, number>,
  tip: {easy: 0, normal: .12, hard: .25} as Record<string, number>,
  /** The rivals attack in different ways by level (volleyball's court only): the share of attacks TIPped short
   *  whatever is up across (`tipAny`), and of a setter's sets on a side with no person in it that are a QUICK SET - the
   *  middle's quick attack, a step from the setter - instead of the high ball to a wing (`quick`). */
  tipAny: {easy: 0, normal: .07, hard: .12} as Record<string, number>,
  quick: {easy: 0, normal: .12, hard: .25} as Record<string, number>, quickNear: 2.6,
  /** The share of spikes hit round a person's block up in front - a sharp cross, short, to the far side of the
   *  court from the hitter - by level (a block that always meets the ball it can reach is beaten by aim). */
  around: {easy: .25, normal: .5, hard: .75} as Record<string, number>,
  super: {easy: .5, normal: .7, hard: .9} as Record<string, number>,
  /** The block by level: the share of the other side's attacks a front-row bot goes up for, its spot `blockZ`
   *  off the net, and its jump's timing error (the timing's sigma times `blockSigma`). */
  block: {easy: .07, normal: .15, hard: .24} as Record<string, number>,
  /** A bot's DIVE (the dash) at a ball of its own just out of reach, by level: whether it dives at all. */
  dive: {easy: false, normal: true, hard: true} as Record<string, boolean>,
  /** Whether it dives for a hard ball (a spike, a JUMP SERVE) on volleyball's court, by level. */
  diveHard: {easy: false, normal: false, hard: true} as Record<string, boolean>,
  blockZ: .7, blockSigma: 1.2, blockFrom: 6.5,
  /** The share of a bot's blocks jumped on time (a STUFF BLOCK's), by level; the rest `blockLate` s late (a soft one's). */
  blockOnTime: {easy: .3, normal: .45, hard: .55} as Record<string, number>, blockLate: [.2, .3] as const,
  /** Cover: where the hitter's team-mates stand as the attack goes (off the hitter, metres back from the net). */
  coverZ: 3.2, coverBack: 5.5,
} as const;
type Command = Omit<PlayerInput, 'seq'>;
const own = (team: BallTeam) => team === 'red' ? -1 : 1;
const gauss = (r: () => number) => { let s = 0; for (let i = 0; i < 4; i++) s += r(); return (s - 2) / Math.sqrt(4 / 12); };

export class VolleyBrain {
  /** The play this bot last planned a press for (its key), the error it drew for it, and its presses on it. */
  private playKey = ''; private err = 0; private pressed = 0;
  private readKey = ''; private readAt = 0; private held = {x: 0, z: 0};
  private jumpKey = ''; private jumpErr = 0;
  private serveKey = ''; private serveAt = 0; private serveJump = false;
  constructor(readonly id: string, private readonly volley: Volley) {}

  command(me: PlayerState, seat: BallSeat, view: BallView, now: number): {command: Command; aim?: {x: number; z: number}} {
    const input: Command = {moveX: 0, moveZ: 0, yaw: me.yaw, targetId: BALL_ID, lock: true};
    if (!me.alive || (view.phase !== 'live' && view.phase !== 'kickoff')) return {command: input};
    const V = this.volley, level = V.levelOf(this.id), sigma = VOLLEY_BOT.sigma[level] ?? .08, b = view.ball, team = seat.team, s = own(team);
    if (view.phase === 'kickoff') return this.serving(me, seat, view, now, input, level);
    const plan = V.plan, mine = V.owner === this.id && plan?.team === team;
    // (The other side's touch read a moment late: until then the bot holds where it was going.)
    const touchKey = `${b.lastId}|${b.lastTeam}|${view.rally}|${view.touches}`;
    // (A spike is read off the hitter's swing, mostly before it is struck: `spikeRead` of the delay.)
    // (And a person's BLOCK TOUCH off their own side's hands, as a spike.)
    const deflected = b.shot === 'block' && now - V.deflectedAt < .1;
    if (touchKey !== this.readKey) { this.readKey = touchKey; this.readAt = (b.lastTeam && b.lastTeam !== team) || deflected ? now + (VOLLEY_BOT.react[level] ?? .2) * (.8 + V.draw() * .4) * (b.shot === 'spike' || b.super || deflected ? V.hot ? VOLLEY_BOT.perfectRead : VOLLEY_BOT.spikeRead : 1) : now; }
    if (now < this.readAt) { input.moveX = this.held.x; input.moveZ = this.held.z; return {command: input}; }
    if (mine && plan) {
      if (plan.air) return this.attack(me, seat, view, now, input, sigma);
      const far = this.run(me, plan, input, .15);
      // (A ball of its own it cannot run to in time, low and a dive away: the DIVE - the dash, the same as a person's.)
      // (On volleyball's court a spike or a JUMP SERVE a dive away is HARD's to dive for - NORMAL's lets it go: a
      // spike that beats the defence is the point, and the rally is back to a volleyball rally's length.)
      const hard = Math.hypot(b.vx, b.vy, b.vz) >= SPIKE_DIG.from && V.court !== spikeCourt() && !VOLLEY_BOT.diveHard[level];
      if (VOLLEY_BOT.dive[level] && !hard && plan.touch === 1 && far >= VOLLEY.dive.from && far <= VOLLEY.dive.to && plan.at - now < .3 && me.grounded) input.dash = true;
      const key = `${plan.touch}|${b.lastId}|${view.rally}|${view.touches}`;
      if (key !== this.playKey) { this.playKey = key; this.err = gauss(() => V.draw()) * sigma; this.pressed = 0; }
      if (this.pressed < 1 && now >= plan.at - VOLLEY.contact + this.err - 1e-6) {
        this.pressed++;
        input.attack = 'light';
        return {command: input, aim: this.aim(seat, plan.touch, me, view)};
      }
      return {command: input};
    }
    this.place(me, seat, view, input, now);
    void s;
    return {command: input};
  }
  /** Where the stick points as the bot presses: a set by the setter's pick (at rest), the spike or OVER into the open
   *  zone (at rest too: its aim already faces it), a serve at a deep corner. */
  private aim(seat: BallSeat, touch: number, me: PlayerState, view: BallView): {x: number; z: number} | undefined {
    void me;
    // (By level, a setter with no person on its side sets the QUICK now and then - the stick toward the net.)
    const V = this.volley;
    // (Only with a hitter a stride or two from the QUICK's spot: from further off the quick is never met.)
    if (touch === 2 && V.court !== spikeCourt() && !view.seats.some(q => q.team === seat.team && !q.bot) && V.draw() < (VOLLEY_BOT.quick[V.levelOf(this.id)] ?? 0)) {
      const q = V.spots(seat.team, view.ball.x).quick;
      if (view.seats.some(o => o.team === seat.team && o.id !== this.id && (() => { const p = V.bodyOf(o.id); return !!p && Math.hypot(p.x - q.x, p.z - q.z) <= VOLLEY_BOT.quickNear; })())) return {x: 0, z: seat.team === 'red' ? 1 : -1};
    }
    return {x: 0, z: 0};
  }
  /** The hitter a set is laid for: a stride behind its spot, the jump timed to meet it, PLAY in the air. */
  private attack(me: PlayerState, seat: BallSeat, view: BallView, now: number, input: Command, sigma: number) {
    const V = this.volley, set = V.lastSet, s = own(seat.team), plan = V.plan!;
    const arc = jumpArc(me.fighter), quick = set?.kind === 'quick';
    const key = `${set?.at ?? 0}`;
    if (key !== this.jumpKey) {
      const J = VOLLEY_BOT.jump, on = V.draw() < (J.perfect[V.levelOf(this.id)] ?? .5);
      this.jumpKey = key; this.jumpErr = on ? gauss(() => V.draw()) * J.onTime : J.offFrom + V.draw() * (J.offTo - J.offFrom);
      void sigma;
    }
    // When the hand must be at the ball: the set's best moment; how long into the jump the hand gets that high.
    const H = quick ? VOLLEY.set.quickMeet : arc.apex + VOLLEY.set.reach, need = Math.min(1, Math.max(0, (H - VOLLEY.air.hand) / arc.apex));
    // (A high set is met at the top of the jump - its contact there - a QUICK on the way up.)
    const up = quick ? (1 - Math.sqrt(1 - need)) * arc.rise : arc.rise * .97, jumpAt = plan.at - up + this.jumpErr;
    // Face the far court's open side, the way the spike goes.
    const yaw = Math.atan2(-plan.x * .3, -s * 6);
    if (me.grounded) {
      const behind = {x: plan.x, z: plan.z + s * VOLLEY_BOT.behind};
      if (now < jumpAt - .35) this.run(me, behind, input, .2);
      else { this.run(me, plan, input, .05); if (now >= jumpAt - 1e-6 && plan.at - now > .05) { input.jump = true; input.jumpHeld = true; } }
      input.yaw = yaw;
      return {command: input};
    }
    // In the air: drift to the spot, the attack pressed (held until the ball comes) - by level, a SUPER SHOT with the
    // meter full, a TIP over a block that is up, a spike placed into the open zone.
    this.run(me, plan, input, .05); input.jumpHeld = true; input.yaw = yaw;
    if (this.pressed < 1 || this.playKey !== key) {
      this.playKey = key; this.pressed = 1;
      const level = V.levelOf(this.id), r = V.draw();
      const blockUp = [...view.seats].some(q => { if (q.team === seat.team) return false; const p = V.bodyOf(q.id); return !!p && !p.grounded && Math.abs(p.z) < 1.6 && Math.abs(p.x - plan.x) < 2; });
      if (me.ultimate >= 100 && r < (VOLLEY_BOT.super[level] ?? .7)) { input.attack = 'ultimate'; return {command: input, aim: {x: 0, z: 0}}; }
      input.attack = (blockUp && r < (VOLLEY_BOT.tip[level] ?? 0)) || (V.court !== spikeCourt() && V.draw() < (VOLLEY_BOT.tipAny[level] ?? 0)) ? 'heavy' : 'light';
      // (A person up at the net in front - round them, by level: the sharp cross.)
      const person = view.seats.some(q => q.team !== seat.team && !q.bot && (() => { const p = V.bodyOf(q.id); return !!p && Math.abs(p.z) < 2 && Math.abs(p.x - plan.x) < 2.5; })());
      if (input.attack === 'light' && person && V.court !== spikeCourt() && V.draw() < (VOLLEY_BOT.around[level] ?? 0)) return {command: input, aim: {x: plan.x > 0 ? -1 : 1, z: seat.team === 'red' ? -1 : 1}};
      return {command: input, aim: input.attack === 'light' && V.draw() < (VOLLEY_BOT.place[level] ?? 0) ? this.openZone(seat, view) : {x: 0, z: 0}};
    }
    return {command: input};
  }
  /** The stick that places a spike into the other court's emptiest zone (strike.ts PLACE: across, deep, short). */
  private openZone(seat: BallSeat, view: BallView): {x: number; z: number} {
    const far = -own(seat.team), V = this.volley;
    let best = {x: 0, z: 0}, bestD = -1;
    for (const a of [-1, 0, 1]) for (const f of [-1, 0, 1]) {
      // (The zones of the court in play - volleyball's for three a side carried from the classic's.)
      const at = onCourt(V.court, a * 5.2, f > 0 ? 8.6 : f < 0 ? 2.6 : 5), x = at.x, z = far * at.z;
      let d = 9;
      for (const q of view.seats) { if (q.team === seat.team) continue; const p = V.bodyOf(q.id); if (p) d = Math.min(d, Math.hypot(p.x - x, p.z - z)); }
      // (The stick as PLACE reads it: across is the world's x, toward the far court is red's +z and blue's -z.)
      if (d > bestD) { bestD = d; best = {x: a, z: seat.team === 'red' ? f : -f}; }
    }
    return best;
  }
  private serving(me: PlayerState, seat: BallSeat, view: BallView, now: number, input: Command, level: string) {
    const b = view.ball, s = own(seat.team), V = this.volley;
    if (view.serverId !== this.id || !b.held) { this.place(me, seat, view, input, now); return {command: input}; }
    const key = `${view.score.red}-${view.score.blue}-${view.phaseUntil}`;
    if (key !== this.serveKey) {
      this.serveKey = key; this.serveAt = view.phaseUntil - VOLLEY.serve.seconds + VOLLEY.serve.botWait + (V.draw() * 2 - 1) * VOLLEY.serve.botSpread;
      this.serveJump = V.draw() < (VOLLEY_BOT.jumpServe[level] ?? .25); this.pressed = 0;
    }
    // At the ball, facing the far court's seam.
    const spot = {x: b.x, z: b.z + s * 1.1}, d = Math.hypot(spot.x - me.x, spot.z - me.z);
    if (d > .7 && me.grounded) this.run(me, spot, input, .2);
    const deep = {x: (V.draw() < .5 ? -1 : 1) * .6, z: -s * .8};
    input.yaw = Math.atan2(-b.x * .2, -s * 9);
    if (now < this.serveAt) return {command: input};
    if (!this.serveJump) { if (this.pressed++ < 1) { input.moveX = input.moveZ = 0; input.attack = 'light'; return {command: input, aim: deep}; } return {command: input}; }
    if (me.grounded && this.pressed === 0) { input.jump = true; input.jumpHeld = true; this.pressed = 1; this.serveAt = now; return {command: input}; }
    input.jumpHeld = true;
    const arc = jumpArc(me.fighter), sigma = VOLLEY_BOT.sigma[level] ?? .08;
    if (!me.grounded && this.pressed === 1 && now >= this.serveAt + arc.rise * .97 + gauss(() => V.draw()) * sigma * .3) { this.pressed = 2; input.attack = 'light'; return {command: input, aim: deep}; }
    return {command: input};
  }
  /** Not this bot's ball: its spot for what the rally is doing. */
  private place(me: PlayerState, seat: BallSeat, view: BallView, input: Command, now = 0) {
    const V = this.volley, team = seat.team, s = own(team), B = VOLLEY_BOT, b = view.ball, plan = V.plan;
    const setter = V.setter[team] === this.id;
    const hitters = [...view.seats].filter(q => q.team === team && V.setter[team] !== q.id);
    // Left or right: by where the other hitter stands (a person's side is theirs).
    const other = hitters.find(q => q.id !== this.id), oq = other ? V.bodyOf(other.id) : undefined;
    const side = oq ? (oq.x > me.x ? -1 : 1) : me.x < 0 ? -1 : 1;
    let spot: {x: number; z: number};
    const ours = plan?.team === team, touch = ours ? plan!.touch : 0, level = V.levelOf(this.id);
    // (A person setting: every bot - the setter too - a ready hitter on a wing, so the stick finds one where it names.)
    const personSets = touch === 2 && !!V.owner && !view.seats.find(q => q.id === V.owner)?.bot && view.seats.find(q => q.id === V.owner)?.team === team;
    const bots = view.seats.filter(q => q.team === team && q.bot && q.id !== V.owner).map(q => q.id).sort((x, y) => (V.bodyOf(x)?.x ?? 0) - (V.bodyOf(y)?.x ?? 0));
    // The block: the other side's set is up - a front-row bot goes up for it by its level (its read once a set).
    const theirSet = V.lastSet && V.lastSet.team !== team && plan?.team === V.lastSet.team && plan.touch === SPIKE_RULES.touches ? V.lastSet : null;
    const C = V.court, at = (x: number, z: number) => onCourt(C, x, z), edge = C.x - 1.5;
    if (theirSet && `${theirSet.at}` !== this.blockKey) {
      this.blockKey = `${theirSet.at}`;
      const spotB = {x: Math.max(-edge, Math.min(edge, theirSet.x)), z: s * B.blockZ};
      // (A side with a person in it leaves the block to them - the walk brings them to it: volley.ts personSpot.)
      this.blocking = Math.hypot(me.x - spotB.x, me.z - spotB.z) < B.blockFrom && V.draw() < (B.block[level] ?? .5) && !(V.court !== spikeCourt() && view.seats.some(q => q.team === team && !q.bot));
      // (On time - a STUFF BLOCK's jump - for a level's share; otherwise a step late, a soft block's.)
      this.blockErr = V.draw() < (B.blockOnTime[level] ?? .45) ? gauss(() => V.draw()) * (B.sigma[level] ?? .08) * B.blockSigma : B.blockLate[0] + V.draw() * (B.blockLate[1] - B.blockLate[0]);
    }
    if (theirSet && this.blocking) {
      const spotB = {x: Math.max(-edge, Math.min(edge, theirSet.x)), z: s * B.blockZ}, arc = jumpArc(me.fighter);
      // (Up at the top of the jump as the spike crosses: a breath after the set's best moment.)
      const jumpAt = theirSet.best + .08 - arc.rise + this.blockErr;
      // (Only from the spot: a jump short of the net blocks nothing.)
      const there = Math.hypot(me.x - spotB.x, me.z - spotB.z) < 1;
      if (me.grounded) { this.run(me, spotB, input, .2); if (there && now >= jumpAt && now < theirSet.best + .2) { input.jump = true; input.jumpHeld = true; } }
      else input.jumpHeld = true;
      input.yaw = Math.atan2(0, -s);
      return;
    }
    // (Defence: the other side's attack coming - the line and the cross a little deep, the setter in for the TIP.)
    const defending = !!theirSet || (b.lastTeam !== team && (b.shot === 'spike' || b.super) && sideOf(b.z) !== team);
    if (defending && !personSets) {
      const sx = theirSet ? Math.max(-at(5, 0).x, Math.min(at(5, 0).x, theirSet.x)) : b.x;
      spot = setter ? {x: sx * .3, z: s * at(0, 3.2).z} : {x: at(side * 3.4, 0).x + sx * .25, z: s * at(0, side * sx > 0 ? 4.6 : 6.4).z};
      this.run(me, spot, input, .35); input.yaw = Math.atan2(b.x - me.x, b.z - me.z);
      return;
    }
    if (personSets) spot = {x: (bots.indexOf(this.id) === 0 ? -1 : 1) * V.wing, z: s * at(0, B.approachZ).z};
    else if (setter) spot = {x: VOLLEY.pass.x * -s, z: s * (touch >= 1 ? B.setZ : 1.5)};
    else if (touch === 2) spot = {x: side * V.wing, z: s * at(0, B.approachZ).z};
    // (Cover: round the hitter as the attack goes, for a ball the block sends back.)
    else if (touch === 3 && V.lastSet) spot = {x: V.lastSet.x * .5 + side * 1.4, z: s * at(0, setter ? B.coverZ : B.coverBack).z};
    else if (touch === 1) spot = {x: at(side * B.wide, 0).x, z: s * at(0, B.deep).z};
    else spot = {x: at(side * 3.5, 0).x, z: s * at(0, sideOf(b.z) === team ? B.deep : B.defZ).z};
    this.run(me, spot, input, .35);
    input.yaw = Math.atan2(b.x - me.x, b.z - me.z);
  }
  private blockKey = ''; private blocking = false; private blockErr = 0;
  private run(me: PlayerState, to: {x: number; z: number}, input: Command, stop: number) {
    const dx = to.x - me.x, dz = to.z - me.z, d = Math.hypot(dx, dz);
    if (d > stop) { const k = Math.min(1, d / .8); input.moveX = dx / d * k; input.moveZ = dz / d * k; input.yaw = Math.atan2(dx, dz); }
    this.held.x = input.moveX; this.held.z = input.moveZ;
    return d;
  }
}
