import {BALL_ID, GOAL_RULES, SPIKE_RULES, otherTeam, type BallEvent, type BallModeId, type BallState, type BallTeam, type BallView, type ShotKind} from './model';
import {goalZ, landing} from './physics';
import {SPIKE_SET} from './strike';
import type {PlayerInput} from '../types';

/** Training drills: twelve scripted drills on top of FREE PLAY, six
 *  a mode, each ten balls from the ball machine and a bronze, silver or gold medal for how many were done right. The
 *  machine feeds each ball; the drill judges it from the match's own moments (goals, saves, accolades, targets) and
 *  feeds the next. Medals are kept by the page (ui/ball/drillMedals.ts): no feats, no rewards, as FREE PLAY has none.
 *
 *  Goal Rush: VOLLEY FROM A CROSS, CURVE INTO THE TOP CORNER, AERIAL, KEEPER SAVES (the machine shoots at your goal),
 *  LONG GOAL, TACKLE (a bot runs the ball at your goal; take it off them in the FIGHT stance). Sky Spike: DIG A
 *  SERVE, SET TO THE NET, JUMP SPIKE TO A TARGET, STUFF BLOCK, ROLL SPIKE, PERFECT SPIKE (the machine sets;
 *  meet it at the top of your jump).
 *
 *  Data and rules only, as everything under src/game: BallMatch is the host that places the ball (and the TACKLE
 *  drill's carrier, whose hands the drill is: DrillRunner.command). */
export type DrillId = 'gr-volley' | 'gr-curve' | 'gr-aerial' | 'gr-keeper' | 'gr-long' | 'gr-tackle' | 'ss-dig' | 'ss-set' | 'ss-spike' | 'ss-block' | 'ss-roll' | 'ss-perfect';
export type Medal = 'bronze' | 'silver' | 'gold';
export const MEDALS: readonly Medal[] = ['bronze', 'silver', 'gold'];

export interface DrillDef {
  id: DrillId; mode: BallModeId; name: string;
  /** What to do, in a line (the sheet, the HUD). */
  line: string;
  /** Balls in the drill, and the balls done right each medal asks for: bronze, silver, gold. */
  balls: number; medals: readonly [number, number, number];
  /** Goal Rush's fights in the drill (GOAL_FIGHT, the two stances): a bot of the other side carries the ball, the drill's
   *  hands on it (DrillRunner.command), and FREE PLAY's one side becomes two. */
  rival?: true;
}
const def = (id: DrillId, mode: BallModeId, name: string, line: string, medals: [number, number, number], rival?: true): DrillDef => ({id, mode, name, line, balls: 10, medals, ...(rival ? {rival} : {})});
export const DRILLS: Record<DrillId, DrillDef> = {
  'gr-volley': def('gr-volley', 'goal-rush', 'VOLLEY FROM A CROSS', 'A cross comes in from the wing: strike it in the air into the goal.', [3, 6, 8]),
  'gr-curve': def('gr-curve', 'goal-rush', 'CURVE INTO THE TOP CORNER', 'Bend a SPECIAL through the ring in the far corner.', [3, 5, 8]),
  'gr-aerial': def('gr-aerial', 'goal-rush', 'AERIAL', 'The ball is popped high: jump and score it from 2.4 m up or higher.', [2, 4, 7]),
  'gr-keeper': def('gr-keeper', 'goal-rush', 'KEEPER SAVES', 'The ball machine shoots at your goal: GUARD to save it.', [4, 6, 8]),
  'gr-long': def('gr-long', 'goal-rush', 'LONG GOAL', 'Score from your own half.', [3, 5, 8]),
  'gr-tackle': def('gr-tackle', 'goal-rush', 'TACKLE', 'A bot runs the ball at your goal: FIGHT stance, lock on and knock them down.', [3, 6, 8], true),
  'ss-dig': def('ss-dig', 'sky-spike', 'DIG A SERVE', 'The machine drives serves at you: keep each one up on your side.', [4, 7, 9]),
  'ss-set': def('ss-set', 'sky-spike', 'SET TO THE NET', 'A team-mate bumps it to you: SET it down onto the ring at the net.', [4, 6, 8]),
  'ss-spike': def('ss-spike', 'sky-spike', 'JUMP SPIKE TO A TARGET', 'A set hangs at the net: jump and spike it onto the ring.', [3, 5, 8]),
  'ss-block': def('ss-block', 'sky-spike', 'STUFF BLOCK', 'The machine sets and spikes: jump at the net and GUARD on the hit.', [2, 4, 6]),
  'ss-roll': def('ss-roll', 'sky-spike', 'ROLL SPIKE', 'Spike the set going away from the net, back turned, into their court.', [2, 4, 7]),
  'ss-perfect': def('ss-perfect', 'sky-spike', 'PERFECT SPIKE', 'The machine sets: a step behind it, jump as it peaks and spike at the top of your jump.', [3, 6, 8]),
};
export const DRILL_IDS = Object.keys(DRILLS) as DrillId[];
export const MODE_DRILLS: Record<BallModeId, readonly DrillId[]> = {
  'goal-rush': DRILL_IDS.filter(id => DRILLS[id].mode === 'goal-rush'),
  'sky-spike': DRILL_IDS.filter(id => DRILLS[id].mode === 'sky-spike'),
};
export const isDrill = (value: unknown): value is DrillId => typeof value === 'string' && value in DRILLS;
/** The medal `done` balls earn in a drill, or none. */
export function medalFor(id: DrillId, done: number): Medal | null {
  const [bronze, silver, gold] = DRILLS[id].medals;
  return done >= gold ? 'gold' : done >= silver ? 'silver' : done >= bronze ? 'bronze' : null;
}

/** A drill as every screen sees it (BallView.drill): which ball, the results so far, the medal once it is over. */
export interface DrillView {
  id: DrillId; ball: number; balls: number; done: number;
  /** Each ball's result so far, in order. */
  results: boolean[];
  state: 'feed' | 'live' | 'pause' | 'over';
  medal: Medal | null;
}

/** Where the machine puts the ball and the person for one ball. */
export interface DrillFeed {
  ball: Pick<BallState, 'x' | 'y' | 'z' | 'vx' | 'vy' | 'vz'> & {heat?: number; shot?: ShotKind | null};
  /** Whose ball it counts as: the person's side (a team-mate's pass) or the machine's (a shot, a serve, a spike). */
  team: BallTeam;
  /** Sky Spike: the side whose touches run, and how many it has spent. */
  touchTeam?: BallTeam; touches?: number;
  /** Where the person starts the ball, facing. */
  at?: {x: number; z: number; yaw: number};
  aim?: BallView['aim'];
  /** The TACKLE drill: where its carrier starts, facing (on its feet again, its health full). */
  rival?: {x: number; z: number; yaw: number};
}
/** The TACKLE drill's carrier as the drill sees it: where it is, whether it is down (knocked down, launched, wiped out:
 *  the ball comes loose) or reeling from a blow (it stands, the ball at its feet), and whether the person is locked on
 *  it (the FIGHT stance, whose blows never touch the ball: a touch of theirs then is their body's). */
export interface DrillRival {id: string; team: BallTeam; x: number; y: number; z: number; down: boolean; reeling: boolean; marked: boolean}
/** What a drill needs of its match (BallMatch). */
export interface DrillHost {
  readonly mode: BallModeId; readonly view: BallView; readonly ball: BallState;
  now(): number;
  /** The person drilling: their seat and where their body is. */
  person(): {id: string; team: BallTeam; x: number; y: number; z: number; grounded: boolean; swinging?: boolean} | undefined;
  feed(feed: DrillFeed): void;
  /** Sky Spike: end the rally now; the machine serves the next ball (DrillRunner.serve). */
  serveNow(): void;
  /** The TACKLE drill's carrier (DrillDef.rival), when there is one. */
  rival?(): DrillRival | undefined;
}

/** The TACKLE drill: the carrier runs the ball at the person's goal from `start` metres out,
 *  the ball `lead` m ahead of its feet, and shoots once it is `shoot` m out (never while reeling from a blow). Each stage
 *  of the drill (balls 1-4, 5-7, 8-10) runs harder: the stick's share of the run (BALL_SPORT's 9.5 m/s), how far it
 *  weaves either side of its line and how often, where it shoots from (less runway to catch it), and how many times it
 *  sidesteps a swing thrown at it from within `dodgeAt` m - a dash across, whose moment of evasion the blow passes
 *  through - at most every `dodgeGap` s. The first balls come straight at a jog: lock on, run in, strike. The last weave at
 *  nearly full pace, shoot from further out and sidestep the first two swings: mashing loses them; a gold takes baiting
 *  the dodge and striking as it ends. */
export const TACKLE = {
  start: 21, person: 7, lead: 1.25, pickUp: 1.7, dodgeAt: 3.2, dodgeGap: .7,
  stages: [{pace: .55, weave: 0, period: 2, dodges: 0, shoot: 8.5}, {pace: .76, weave: 2.4, period: 1.6, dodges: 1, shoot: 10.5}, {pace: .9, weave: 3.4, period: 1.25, dodges: 2, shoot: 12.5}],
} as const;

/** How long a ball is given before it counts as missed, and the breath between two. */
const BALL_SECONDS = 6, PAUSE = 1.1, FIRST = .8;

/** The TACKLE drill's carrier's seat (BallMatch adds it; LEARN TO PLAY's opponent in Goal Rush and Sky Spike sits in it
 *  too: lesson.ts). */
export const DRILL_RIVAL = 'drill-rival';

/** The velocity that carries a ball from `p` to (tx, ty, tz) in `t` seconds under gravity `g` (drag made up for
 *  roughly, as strike.ts's arc does). */
export function arc(p: {x: number; y: number; z: number}, tx: number, ty: number, tz: number, t: number, g: number, drag: number) {
  const k = 1 + drag * t * .5;
  return {vx: (tx - p.x) / t * k, vy: ((ty - p.y) + .5 * g * t * t) / t, vz: (tz - p.z) / t * k};
}

/** Sky Spike: whether a ball sent from `b` at `v` clears the net (with a little to spare), or never crosses it. */
export function clearsNet(b: {x: number; y: number; z: number}, v: {vx: number; vy: number; vz: number}, g: number) {
  if (Math.abs(v.vz) < 1e-3 || Math.sign(-b.z) !== Math.sign(v.vz)) return true;
  const t = -b.z / v.vz, y = b.y + v.vy * t - .5 * g * t * t;
  return y > SPIKE_RULES.netHeight + SPIKE_RULES.ballRadius + .2;
}

/** One drill being run. BallMatch steps it after every tick, and hands it Sky Spike's machine serves. */
export class DrillRunner {
  readonly view: DrillView;
  private seen = 0;
  private at = 0;
  private flag = {roll: false, target: false, stuffed: false, shot: false};
  /** The TACKLE drill's carrier: carrying the ball, the way it is running, when it started, and its run's pace. */
  private carry = {on: false, dx: 0, dz: 1, since: 0, pace: .55, weave: 0, period: 2, side: 1, seq: 0, dodges: 0, dodgeAt: 0, shoot: 8.5};
  /** STUFF BLOCK: when the machine spikes the set it fed (0: not waiting). */
  private spikeAt = 0;
  private side = 1;
  constructor(readonly id: DrillId, private readonly rng: () => number) {
    const d = DRILLS[id];
    this.view = {id, ball: 0, balls: d.balls, done: 0, results: [], state: 'pause', medal: null};
  }
  private get def() { return DRILLS[this.id]; }
  private rand(a: number, b: number) { return a + (b - a) * this.rng(); }

  /** Every tick: the ball being judged against the match's new moments, the next fed after a breath. */
  step(host: DrillHost) {
    const v = this.view, now = host.now();
    const fresh = host.view.events.filter(e => e.id > this.seen);
    if (fresh.length) this.seen = fresh[fresh.length - 1].id;
    if (v.state === 'over') return;
    if (v.state === 'live') {
      if (this.spikeAt && now >= this.spikeAt) this.machineSpike(host);
      if (this.def.rival) this.carryBall(host);
      const verdict = this.judge(host, fresh);
      if (verdict === undefined && now - this.at > BALL_SECONDS) this.settle(host, this.timeout(host));
      else if (verdict !== undefined) this.settle(host, verdict);
      return;
    }
    if (v.state === 'pause' && now - this.at >= (v.ball === 0 ? FIRST : PAUSE)) {
      if (v.ball >= v.balls) { v.state = 'over'; v.medal = medalFor(this.id, v.done); host.view.aim = null; return; }
      v.state = 'feed';
    }
    if (v.state === 'feed') {
      if (host.mode === 'goal-rush') { if (host.view.phase !== 'scored') this.feed(host); }
      // Sky Spike: the machine serves it (serve), from its next serve; a rally still going is ended for it.
      else if (host.view.phase === 'live') host.serveNow();
    }
  }
  /** Sky Spike's machine serve, which this drill makes its next ball (once every ball is fed, the machine stays still).
   *  True: the drill has taken the serve. */
  serve(host: DrillHost): boolean {
    const v = this.view;
    // Every ball fed and judged: the machine is still (the drill's result is on screen).
    if (v.state === 'over' || v.ball >= v.balls) return true;
    v.state = 'feed';
    this.feed(host);
    return true;
  }

  private settle(host: DrillHost, hit: boolean) {
    const v = this.view;
    v.results.push(hit); if (hit) v.done++;
    v.state = 'pause'; this.at = host.now(); this.spikeAt = 0;
  }
  /** A ball given its time: a save the keeper kept out without a guard is still kept out. */
  private timeout(host: DrillHost) {
    const me = host.person();
    return this.id === 'gr-keeper' && !!me && host.ball.lastId === me.id;
  }

  private feed(host: DrillHost) {
    const v = this.view, me = host.person();
    if (!me) return;
    v.ball++; v.state = 'live'; this.at = host.now(); this.flag = {roll: false, target: false, stuffed: false, shot: false}; this.spikeAt = 0;
    this.side = -this.side;
    const f = host.mode === 'goal-rush' ? this.goalFeed(host, me.team) : this.spikeFeed(host, me.team);
    host.feed(f);
  }

  // ─── Goal Rush ─────────────────────────────────────────────────────────────────────────────────────────────────────
  private goalFeed(host: DrillHost, team: BallTeam): DrillFeed {
    const R = GOAL_RULES, s = team === 'red' ? 1 : -1, goal = s * R.halfZ, g = R.gravity * (host.ball.grav || 1), r = R.ballRadius * (host.ball.size || 1);
    const face = s > 0 ? 0 : Math.PI;
    // (Every spot is laid as a share of the pitch's half-width X and half-length Z, so the drills follow its size.)
    const X = R.halfX, Z = R.halfZ;
    switch (this.id) {
      case 'gr-volley': {
        // A cross from the wing to about head height a stride in front of the person, at the edge of the box.
        const spot = {x: this.rand(-2, 2), z: goal - s * .42 * Z};
        const from = {x: this.side * (X - 3), y: .9, z: goal - s * this.rand(.24, .34) * Z};
        return {ball: {...from, ...arc(from, spot.x, 1.9, spot.z + s * 1.2, 1.15, g, R.drag)}, team, at: {x: spot.x, z: spot.z, yaw: face}};
      }
      case 'gr-curve': {
        // At rest off to one side; the ring in the far top corner, which a curve bends into.
        const ball = {x: this.side * this.rand(.44, .61) * X, y: r + .02, z: goal - s * this.rand(.46, .58) * Z};
        const aim = {x: -this.side * (R.goalHalfWidth - 1.3), y: 2.7, z: goal, r: 1.2, floor: false};
        const yaw = Math.atan2(aim.x - ball.x, aim.z - ball.z);
        return {ball: {...ball, vx: 0, vy: 0, vz: 0}, team, aim, at: {x: ball.x - Math.sin(yaw) * 2.2, z: ball.z - Math.cos(yaw) * 2.2, yaw}};
      }
      case 'gr-aerial': {
        // Popped high in front of the goal: up past four metres and down onto the person's run.
        const from = {x: this.rand(-3, 3), y: .8, z: goal - s * this.rand(.33, .4) * Z};
        return {ball: {...from, vx: this.rand(-1, 1), vy: this.rand(12.5, 14), vz: -s * this.rand(.6, 1.6)}, team, at: {x: from.x, z: from.z - s * 4.5, yaw: face}};
      }
      case 'gr-keeper': {
        // A shot from the edge of the box at a corner of the person's own goal (about two thirds of a second away, as it
        // was from further out on the bigger pitch).
        const own = -goal, from = {x: this.rand(-.44, .44) * X, y: .7, z: own + s * this.rand(.58, .73) * Z};
        const tx = this.side * this.rand(1.6, R.goalHalfWidth - .8), ty = this.rand(.7, R.goalHeight - .9), speed = this.rand(17, 21);
        const t = Math.hypot(tx - from.x, own - from.z) / speed;
        return {ball: {...from, ...arc(from, tx, ty, own, t, g, R.drag), heat: 1.5, shot: 'power'}, team: otherTeam(team), at: {x: 0, z: own + s * 1.2, yaw: face}};
      }
      case 'gr-tackle': {
        // The carrier 21 m out from the person's goal, a little to one side, the ball at its feet toward the goal; the
        // person 7 m out, between it and the goal (TACKLE).
        const own = -goal, T = TACKLE, stage = T.stages[Math.min(2, Math.floor((this.view.ball - 1) / 3.4))];
        const rx = this.side * this.rand(2, 5), rz = own + s * T.start;
        this.carry = {...this.carry, on: true, dx: 0, dz: -s, since: host.now(), pace: stage.pace, weave: stage.weave, period: stage.period, side: this.side, dodges: stage.dodges, dodgeAt: 0, shoot: stage.shoot};
        return {ball: {x: rx, y: r + .02, z: rz - s * T.lead, vx: 0, vy: 0, vz: 0}, team: otherTeam(team), at: {x: rx * .3, z: own + s * T.person, yaw: face}, rival: {x: rx, z: rz, yaw: face + Math.PI}};
      }
      case 'gr-long': default: {
        // At rest in the person's own half.
        const ball = {x: this.rand(-.5, .5) * X, y: r + .02, z: -s * this.rand(.19, .42) * Z};
        const yaw = Math.atan2(-ball.x * .3, goal - ball.z);
        return {ball: {...ball, vx: 0, vy: 0, vz: 0}, team, at: {x: ball.x - Math.sin(yaw) * 2.2, z: ball.z - Math.cos(yaw) * 2.2, yaw}};
      }
    }
  }

  // ─── Sky Spike ─────────────────────────────────────────────────────────────────────────────────────────────────────
  private spikeFeed(host: DrillHost, team: BallTeam): DrillFeed {
    const R = SPIKE_RULES, c = team === 'red' ? -1 : 1, g = R.gravity * (host.ball.grav || 1), face = c < 0 ? 0 : Math.PI, machine = otherTeam(team);
    // A team-mate's floating set, onto the net as strike.ts sets it (SPIKE_SET), for the spikes.
    const set = (x: number): DrillFeed => {
      const from = {x: x + this.rand(-1.5, 1.5), y: 1.6, z: c * this.rand(4.5, 6)};
      const ring = {x: this.rand(-R.courtHalfX + 1.8, R.courtHalfX - 1.8), y: .02, z: -c * this.rand(3, R.courtHalfZ - 2), r: 1.6, floor: true};
      return {ball: {...from, ...arc(from, x, SPIKE_SET.height, c * SPIKE_SET.z, SPIKE_SET.seconds, g, R.drag), shot: 'set'}, team, touchTeam: team, touches: 2, at: {x, z: c * 4.2, yaw: face}, aim: this.id === 'ss-spike' ? ring : null};
    };
    switch (this.id) {
      case 'ss-dig': {
        // A driven serve from the far baseline at the person, clearing the net.
        const me = host.person()!, from = {x: this.rand(-4, 4), y: 2.2, z: -c * (R.courtHalfZ + .9)};
        const tx = Math.max(-R.courtHalfX + 1, Math.min(R.courtHalfX - 1, me.x + this.rand(-2.2, 2.2))), tz = c * this.rand(4.5, 8.5);
        let t = Math.hypot(tx - from.x, tz - from.z) / 20, vel = arc(from, tx, R.ballRadius, tz, t, g, R.drag);
        for (let i = 0; i < 20 && !this.clears(from, vel, g); i++) { t *= 1.07; vel = arc(from, tx, R.ballRadius, tz, t, g, R.drag); }
        return {ball: {...from, ...vel, heat: 1, shot: 'serve'}, team: machine, touchTeam: machine, touches: R.touches, at: {x: 0, z: c * 6.5, yaw: face}};
      }
      case 'ss-set': {
        // A team-mate's bump from the back of the court up to the person, the first touch spent; the ring at the net.
        const x = this.rand(-3, 3), from = {x: x + this.rand(-2, 2), y: 1.2, z: c * 9};
        const aim = {x: this.rand(-4, 4), y: .02, z: c * SPIKE_SET.z, r: 1.3, floor: true};
        return {ball: {...from, ...arc(from, x, 1.5, c * 4.6, 1.3, g, R.drag), shot: 'bump'}, team, touchTeam: team, touches: 1, at: {x, z: c * 4.4, yaw: face}, aim};
      }
      case 'ss-block': {
        // The machine's set on its own side, rising to the net; it spikes it at the top (machineSpike).
        const x = this.rand(-3.5, 3.5), from = {x: x + this.rand(-1, 1), y: 1.8, z: -c * 4.5};
        this.spikeAt = host.now() + .95;
        return {ball: {...from, ...arc(from, x, 4.5, -c * 1.3, 1.0, g, R.drag), shot: 'set'}, team: machine, touchTeam: machine, touches: 2, at: {x: x + this.rand(-1.5, 1.5), z: c * 1.15, yaw: face}};
      }
      case 'ss-perfect': {
        // The machine's floating set (SPIKE_SET), the person a good step back from where it comes down to hitting height
        // (a body right under it meets the ball before the swing does - the third touch's body bump - and the spike is
        // never PERFECT). From the fifth ball they start a few steps to one side, from the eighth further and further
        // back, so getting to the right spot is part of the timing.
        const f = set(this.rand(-3, 3)), n = this.view.ball, off = n <= 4 ? 0 : n <= 7 ? this.rand(1.5, 2.5) : this.rand(2.8, 3.6);
        if (f.at) f.at = {...f.at, x: Math.max(-R.courtHalfX + 1, Math.min(R.courtHalfX - 1, f.at.x + this.side * off)), z: f.at.z + c * (n <= 7 ? 0 : 1.5)};
        return f;
      }
      case 'ss-spike': case 'ss-roll': default: return set(this.rand(-3, 3));
    }
  }
  /** STUFF BLOCK: the machine's spike, down into the person's court from where its set hangs. */
  private machineSpike(host: DrillHost) {
    const R = SPIKE_RULES, b = host.ball, me = host.person();
    this.spikeAt = 0;
    if (!me || b.held) return;
    const c = me.team === 'red' ? -1 : 1, g = R.gravity * (b.grav || 1);
    const tx = this.rand(-R.courtHalfX + 1.5, R.courtHalfX - 1.5), tz = c * this.rand(3.5, 8);
    let t = Math.hypot(tx - b.x, tz - b.z) / 19, vel = arc(b, tx, R.ballRadius, tz, t, g, R.drag);
    for (let i = 0; i < 20 && !this.clears(b, vel, g); i++) { t *= 1.07; vel = arc(b, tx, R.ballRadius, tz, t, g, R.drag); }
    Object.assign(b, vel, {shot: 'spike', heat: Math.max(b.heat, 1.5)});
    host.view.touchTeam = otherTeam(me.team); host.view.touches = SPIKE_RULES.touches;
  }
  private clears(b: {x: number; y: number; z: number}, v: {vx: number; vy: number; vz: number}, g: number) { return clearsNet(b, v, g); }

  // ─── The TACKLE drill's carrier ───────────────────────────────────────────────────────────────────────────────────
  /** Every tick of a ball: the carrier's ball at its feet while it runs (a dribble the drill keeps, so it is always the
   *  one on the ball: BallMatch.onBall), loose once it is down or someone else has struck it - it runs back onto a loose
   *  ball and picks it up again - and its shot at the goal once it is close enough. */
  private carryBall(host: DrillHost) {
    const r = host.rival?.(), b = host.ball, me = host.person();
    if (!r || !me || this.flag.shot) return;
    const T = TACKLE, own = goalZ(me.team), radius = GOAL_RULES.ballRadius * (b.size || 1);
    // Struck by someone else - a BALL-stance swing from the person - or the carrier down: the ball is loose. A person
    // fighting it (locked on: their blows never touch the ball) who runs into the ball does not take it: the carrier
    // shields it, and only a knockdown wins it, as the drill teaches.
    const struck = b.lastId !== r.id && b.lastId !== null && !(b.lastId === me.id && r.marked);
    if (this.carry.on && (r.down || struck && host.now() - this.carry.since > .05)) this.carry.on = false;
    if (!this.carry.on) {
      if (!r.down && !r.reeling && b.y < 1.6 && Math.hypot(b.x - r.x, b.z - r.z) < T.pickUp + radius * .5) { this.carry.on = true; this.carry.since = host.now(); }
      else return;
    }
    // Close enough: the shot, low into a corner of the goal, hard.
    if (Math.abs(r.z - own) <= this.carry.shoot && !r.reeling) {
      const tx = -this.carry.side * (GOAL_RULES.goalHalfWidth - 1.1), from = {x: b.x, y: Math.max(b.y, radius), z: b.z}, t = Math.hypot(tx - from.x, own - from.z) / 21;
      Object.assign(b, arc(from, tx, 1.1, own, t, GOAL_RULES.gravity * (b.grav || 1), GOAL_RULES.drag), {y: from.y, lastId: r.id, lastTeam: r.team, shot: 'power', heat: Math.max(b.heat, 1)});
      this.carry.on = false; this.flag.shot = true;
      return;
    }
    const lead = r.reeling ? .9 : T.lead, run = r.reeling ? 0 : 9.5 * this.carry.pace;
    Object.assign(b, {x: r.x + this.carry.dx * lead, z: r.z + this.carry.dz * lead, y: radius + .02, vx: this.carry.dx * run, vy: 0, vz: this.carry.dz * run, sx: 0, sy: 0, sz: 0, lastId: r.id, lastTeam: r.team, held: false});
  }
  /** The TACKLE drill's carrier's hands (BallMatch steps it instead of its bot): at the person's goal along a weaving
   *  line while it has the ball, onto the ball when it is loose, still between balls. Undefined: not the carrier. */
  command(host: DrillHost, id: string): PlayerInput | undefined {
    const r = host.rival?.(), me = host.person();
    if (!this.def.rival || !r || r.id !== id) return undefined;
    const still: PlayerInput = {seq: ++this.carry.seq, moveX: 0, moveZ: 0, yaw: 0, guard: false, targetId: BALL_ID};
    if (!me || this.view.state !== 'live' || this.flag.shot || r.down) return still;
    const b = host.ball, own = goalZ(me.team), T = TACKLE;
    let tx: number, tz: number, pace = this.carry.pace;
    if (this.carry.on) {
      // Down the pitch at the shooting spot, weaving either side of the line.
      const t = host.now() - this.carry.since, weave = this.carry.weave * Math.sin(t * Math.PI * 2 / this.carry.period) * this.carry.side;
      tx = weave; tz = own + Math.sign(r.z - own) * (this.carry.shoot - 1);
    } else { tx = b.x; tz = b.z; pace = Math.max(pace, .8); }
    const dx = tx - r.x, dz = tz - r.z, d = Math.hypot(dx, dz) || 1;
    // The sidestep: from a swing thrown at it up close, across its line away from the swinger.
    const ex = me.x - r.x, ez = me.z - r.z, near = Math.hypot(ex, ez);
    if (this.carry.on && this.carry.dodges > 0 && me.swinging && !r.reeling && near < T.dodgeAt && host.now() >= this.carry.dodgeAt) {
      this.carry.dodges--; this.carry.dodgeAt = host.now() + T.dodgeGap;
      const away = (dx * ez - dz * ex) > 0 ? 1 : -1, sx = -dz / d * away, sz = dx / d * away;
      this.carry.dx = sx; this.carry.dz = sz;
      return {...still, moveX: sx, moveZ: sz, yaw: Math.atan2(sx, sz), dash: true};
    }
    if (this.carry.on) { this.carry.dx = dx / d; this.carry.dz = dz / d; }
    return {...still, moveX: dx / d * pace, moveZ: dz / d * pace, yaw: Math.atan2(dx, dz)};
  }

  // ─── Judging ───────────────────────────────────────────────────────────────────────────────────────────────────────
  /** This ball's verdict from the new moments: true done right, false missed, undefined still in play. */
  private judge(host: DrillHost, events: readonly BallEvent[]): boolean | undefined {
    const me = host.person();
    if (!me) return false;
    const mine = (e: BallEvent) => e.actorId === me.id;
    for (const e of events) {
      if (e.kind === 'target') this.flag.target = true;
      if (e.kind === 'strike' && mine(e) && e.text === 'ROLL SPIKE') this.flag.roll = true;
      switch (this.id) {
        case 'gr-volley': if (e.kind === 'goal' || e.kind === 'own-goal') return e.kind === 'goal' && mine(e) && (e.shot === 'volley' || e.shot === 'spike'); break;
        case 'gr-curve': if (e.kind === 'goal' || e.kind === 'own-goal') return e.kind === 'goal' && mine(e) && this.flag.target && (e.shot === 'curve' || e.shot === 'sinker'); break;
        case 'gr-aerial': if (e.kind === 'accolade' && mine(e) && e.text === 'AERIAL GOAL') return true; if (e.kind === 'own-goal') return false; break;
        case 'gr-long': if (e.kind === 'accolade' && mine(e) && e.text === 'LONG GOAL') return true; if (e.kind === 'own-goal') return false; break;
        case 'gr-keeper':
          if ((e.kind === 'save' || e.kind === 'perfect') && mine(e)) return true;
          if ((e.kind === 'goal' || e.kind === 'own-goal') && e.team !== me.team) return false;
          break;
        case 'ss-block':
          if (e.kind === 'perfect' && mine(e) && e.text === 'STUFF BLOCK') return true;
          if (e.kind === 'point' || e.kind === 'kill' || e.kind === 'ace' || e.kind === 'out' || e.kind === 'touches' || e.kind === 'block') return false;
          break;
        case 'gr-tackle':
          if (e.kind === 'tackle' && mine(e)) return true;
          if (e.kind === 'goal' || e.kind === 'own-goal') return false;
          break;
        // A PERFECT SPIKE: the person's strike on the set, from the top of the jump (BallMatch's own call); any other
        // strike of theirs on it - a spike from lower, a bump - is the ball spent.
        case 'ss-perfect':
          if (e.kind === 'strike' && mine(e)) return !!e.perfect;
          if (e.kind === 'point' || e.kind === 'kill' || e.kind === 'ace' || e.kind === 'out' || e.kind === 'touches') return false;
          break;
        case 'ss-spike': if (e.kind === 'kill' || e.kind === 'point' || e.kind === 'out' || e.kind === 'touches') return this.flag.target && e.kind === 'kill' && mine(e); break;
        case 'ss-roll': if (e.kind === 'kill' || e.kind === 'point' || e.kind === 'out' || e.kind === 'touches') return this.flag.roll && e.kind === 'kill' && mine(e); break;
        case 'ss-dig': case 'ss-set': if (e.kind === 'point' || e.kind === 'kill' || e.kind === 'ace' || e.kind === 'out' || e.kind === 'touches') return false; break;
      }
    }
    // The carrier got to its shot: too late.
    if (this.id === 'gr-tackle' && this.flag.shot) return false;
    const b = host.ball;
    // A dig: the person's touch keeps the serve up on their side.
    if (this.id === 'ss-dig' && b.lastId === me.id && (b.shot === 'dig' || b.shot === 'bump' || b.shot === 'set')) return true;
    if (this.id === 'ss-dig' && b.lastId === me.id) return false;
    // A set: the person's, coming down onto the net over the ring, at the height a spiker meets it (SPIKE_SET).
    if (this.id === 'ss-set' && b.lastId === me.id) {
      const aim = host.view.aim;
      if (b.shot !== 'set' || !aim) return false;
      const down = landing(host.mode, b, SPIKE_SET.height);
      return Math.hypot(down.x - aim.x, down.z - aim.z) <= aim.r + .4;
    }
    return undefined;
  }
}
