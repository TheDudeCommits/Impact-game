import {jumpArc} from '../moves';
import type {PlayerInput, PlayerState} from '../types';
import {BALL_ID, SPIKE_RULES, type BallSeat, type BallTeam, type BallView} from './model';
import {sideOf} from './physics';
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
  react: {easy: .3, normal: .2, hard: .14} as Record<string, number>,
  /** The share of a bot's serves that are JUMP SERVEs, by level. */
  jumpServe: {easy: .1, normal: .25, hard: .45} as Record<string, number>,
  /** Spots (m): the setter's (x across as the pass's, `setZ` off the net), the hitters' receive (`wide` across, `deep`)
   *  and approach (the set's wing, `approachZ`); a hitter waits `behind` metres back of the set's spot. */
  setZ: 1.8, wide: 3.2, deep: 6.2, approachZ: 4.2, behind: 1.6, defZ: 6.5,
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
    if (touchKey !== this.readKey) { this.readKey = touchKey; this.readAt = b.lastTeam && b.lastTeam !== team ? now + (VOLLEY_BOT.react[level] ?? .2) * (.8 + V.draw() * .4) : now; }
    if (now < this.readAt) { input.moveX = this.held.x; input.moveZ = this.held.z; return {command: input}; }
    if (mine && plan) {
      if (plan.air) return this.attack(me, seat, view, now, input, sigma);
      this.run(me, plan, input, .15);
      const key = `${plan.touch}|${b.lastId}|${view.rally}|${view.touches}`;
      if (key !== this.playKey) { this.playKey = key; this.err = gauss(() => V.draw()) * sigma; this.pressed = 0; }
      if (this.pressed < 1 && now >= plan.at - VOLLEY.contact + this.err - 1e-6) {
        this.pressed++;
        input.attack = 'light';
        return {command: input, aim: this.aim(seat, plan.touch, me, view)};
      }
      return {command: input};
    }
    this.place(me, seat, view, input);
    void s;
    return {command: input};
  }
  /** Where the stick points as the bot presses: a set by the setter's pick (at rest), the spike or OVER into the open
   *  zone (at rest too: its aim already faces it), a serve at a deep corner. */
  private aim(seat: BallSeat, touch: number, me: PlayerState, view: BallView): {x: number; z: number} | undefined {
    void seat; void touch; void me; void view;
    return {x: 0, z: 0};
  }
  /** The hitter a set is laid for: a stride behind its spot, the jump timed to meet it, PLAY in the air. */
  private attack(me: PlayerState, seat: BallSeat, view: BallView, now: number, input: Command, sigma: number) {
    const V = this.volley, set = V.lastSet, s = own(seat.team), plan = V.plan!;
    const arc = jumpArc(me.fighter), quick = set?.kind === 'quick';
    const key = `${set?.at ?? 0}`;
    if (key !== this.jumpKey) { this.jumpKey = key; this.jumpErr = gauss(() => V.draw()) * sigma * 1.3; }
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
    // In the air: drift to the spot, PLAY pressed (held until the ball comes).
    this.run(me, plan, input, .05); input.jumpHeld = true; input.yaw = yaw;
    if (this.pressed < 1 || this.playKey !== key) { this.playKey = key; this.pressed = 1; input.attack = 'light'; return {command: input, aim: {x: 0, z: 0}}; }
    return {command: input};
  }
  private serving(me: PlayerState, seat: BallSeat, view: BallView, now: number, input: Command, level: string) {
    const b = view.ball, s = own(seat.team), V = this.volley;
    if (view.serverId !== this.id || !b.held) { this.place(me, seat, view, input); return {command: input}; }
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
  private place(me: PlayerState, seat: BallSeat, view: BallView, input: Command) {
    const V = this.volley, team = seat.team, s = own(team), B = VOLLEY_BOT, b = view.ball, plan = V.plan;
    const setter = V.setter[team] === this.id;
    const hitters = [...view.seats].filter(q => q.team === team && V.setter[team] !== q.id);
    // Left or right: by where the other hitter stands (a person's side is theirs).
    const other = hitters.find(q => q.id !== this.id), oq = other ? V.bodyOf(other.id) : undefined;
    const side = oq ? (oq.x > me.x ? -1 : 1) : me.x < 0 ? -1 : 1;
    let spot: {x: number; z: number};
    const ours = plan?.team === team, touch = ours ? plan!.touch : 0;
    if (setter) spot = {x: VOLLEY.pass.x * -s, z: s * (touch >= 1 ? B.setZ : 1.5)};
    else if (touch === 2) spot = {x: side * VOLLEY.set.wing, z: s * B.approachZ};
    else if (touch === 3 && V.lastSet) spot = {x: V.lastSet.x * .4 + side * 1.5, z: s * 3.6};
    else if (touch === 1) spot = {x: side * B.wide, z: s * B.deep};
    else spot = {x: side * 3.5, z: s * (sideOf(b.z) === team ? B.deep : B.defZ)};
    void SPIKE_RULES;
    this.run(me, spot, input, .35);
    input.yaw = Math.atan2(b.x - me.x, b.z - me.z);
  }
  private run(me: PlayerState, to: {x: number; z: number}, input: Command, stop: number) {
    const dx = to.x - me.x, dz = to.z - me.z, d = Math.hypot(dx, dz);
    if (d > stop) { const k = Math.min(1, d / .8); input.moveX = dx / d * k; input.moveZ = dz / d * k; input.yaw = Math.atan2(dx, dz); }
    this.held.x = input.moveX; this.held.z = input.moveZ;
    return d;
  }
}
