import {GOAL_RULES, SPIKE_RULES, otherTeam, type BallEvent, type BallModeId, type BallState, type BallTeam, type BallView, type ShotKind} from './model';
import {landing} from './physics';

/** Training drills: ten scripted drills on top of FREE PLAY, five
 *  a mode, each ten balls from the ball machine and a bronze, silver or gold medal for how many were done right. The
 *  machine feeds each ball; the drill judges it from the match's own moments (goals, saves, accolades, targets) and
 *  feeds the next. Medals are kept by the page (ui/ball/drillMedals.ts): no feats, no rewards, as FREE PLAY has none.
 *
 *  Goal Rush: VOLLEY FROM A CROSS, CURVE INTO THE TOP CORNER, AERIAL, KEEPER SAVES (the machine shoots at your goal),
 *  LONG GOAL. Sky Spike: DIG A SERVE, SET TO THE NET, JUMP SPIKE TO A TARGET, STUFF BLOCK, ROLL SPIKE.
 *
 *  Data and rules only, as everything under src/game: BallMatch is the host that places the ball. */
export type DrillId = 'gr-volley' | 'gr-curve' | 'gr-aerial' | 'gr-keeper' | 'gr-long' | 'ss-dig' | 'ss-set' | 'ss-spike' | 'ss-block' | 'ss-roll';
export type Medal = 'bronze' | 'silver' | 'gold';
export const MEDALS: readonly Medal[] = ['bronze', 'silver', 'gold'];

export interface DrillDef {
  id: DrillId; mode: BallModeId; name: string;
  /** What to do, in a line (the sheet, the HUD). */
  line: string;
  /** Balls in the drill, and the balls done right each medal asks for: bronze, silver, gold. */
  balls: number; medals: readonly [number, number, number];
}
const def = (id: DrillId, mode: BallModeId, name: string, line: string, medals: [number, number, number]): DrillDef => ({id, mode, name, line, balls: 10, medals});
export const DRILLS: Record<DrillId, DrillDef> = {
  'gr-volley': def('gr-volley', 'goal-rush', 'VOLLEY FROM A CROSS', 'A cross comes in from the wing: strike it in the air into the goal.', [3, 6, 8]),
  'gr-curve': def('gr-curve', 'goal-rush', 'CURVE INTO THE TOP CORNER', 'Bend a SPECIAL through the ring in the far corner.', [3, 5, 8]),
  'gr-aerial': def('gr-aerial', 'goal-rush', 'AERIAL', 'The ball is popped high: jump and score it from 2.4 m up or higher.', [2, 4, 7]),
  'gr-keeper': def('gr-keeper', 'goal-rush', 'KEEPER SAVES', 'The ball machine shoots at your goal: GUARD to save it.', [4, 6, 8]),
  'gr-long': def('gr-long', 'goal-rush', 'LONG GOAL', 'Score from your own half.', [3, 5, 8]),
  'ss-dig': def('ss-dig', 'sky-spike', 'DIG A SERVE', 'The machine drives serves at you: keep each one up on your side.', [4, 7, 9]),
  'ss-set': def('ss-set', 'sky-spike', 'SET TO THE NET', 'A team-mate bumps it to you: SET it down onto the ring at the net.', [4, 6, 8]),
  'ss-spike': def('ss-spike', 'sky-spike', 'JUMP SPIKE TO A TARGET', 'A set hangs at the net: jump and spike it onto the ring.', [3, 5, 8]),
  'ss-block': def('ss-block', 'sky-spike', 'STUFF BLOCK', 'The machine sets and spikes: jump at the net and GUARD on the hit.', [2, 4, 6]),
  'ss-roll': def('ss-roll', 'sky-spike', 'ROLL SPIKE', 'Spike the set going away from the net, back turned, into their court.', [2, 4, 7]),
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
}
/** What a drill needs of its match (BallMatch). */
export interface DrillHost {
  readonly mode: BallModeId; readonly view: BallView; readonly ball: BallState;
  now(): number;
  /** The person drilling: their seat and where their body is. */
  person(): {id: string; team: BallTeam; x: number; y: number; z: number; grounded: boolean} | undefined;
  feed(feed: DrillFeed): void;
  /** Sky Spike: end the rally now; the machine serves the next ball (DrillRunner.serve). */
  serveNow(): void;
}

/** How long a ball is given before it counts as missed, and the breath between two. */
const BALL_SECONDS = 6, PAUSE = 1.1, FIRST = .8;

/** The velocity that carries a ball from `p` to (tx, ty, tz) in `t` seconds under gravity `g` (drag made up for
 *  roughly, as strike.ts's arc does). */
function arc(p: {x: number; y: number; z: number}, tx: number, ty: number, tz: number, t: number, g: number, drag: number) {
  const k = 1 + drag * t * .5;
  return {vx: (tx - p.x) / t * k, vy: ((ty - p.y) + .5 * g * t * t) / t, vz: (tz - p.z) / t * k};
}

/** One drill being run. BallMatch steps it after every tick, and hands it Sky Spike's machine serves. */
export class DrillRunner {
  readonly view: DrillView;
  private seen = 0;
  private at = 0;
  private flag = {roll: false, target: false, stuffed: false};
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
    v.ball++; v.state = 'live'; this.at = host.now(); this.flag = {roll: false, target: false, stuffed: false}; this.spikeAt = 0;
    this.side = -this.side;
    const f = host.mode === 'goal-rush' ? this.goalFeed(host, me.team) : this.spikeFeed(host, me.team);
    host.feed(f);
  }

  // ─── Goal Rush ─────────────────────────────────────────────────────────────────────────────────────────────────────
  private goalFeed(host: DrillHost, team: BallTeam): DrillFeed {
    const R = GOAL_RULES, s = team === 'red' ? 1 : -1, goal = s * R.halfZ, g = R.gravity * (host.ball.grav || 1), r = R.ballRadius * (host.ball.size || 1);
    const face = s > 0 ? 0 : Math.PI;
    switch (this.id) {
      case 'gr-volley': {
        // A cross from the wing to about head height a stride in front of the person, at the edge of the box.
        const spot = {x: this.rand(-2, 2), z: goal - s * 11};
        const from = {x: this.side * 14, y: .9, z: goal - s * this.rand(6, 9)};
        return {ball: {...from, ...arc(from, spot.x, 1.9, spot.z + s * 1.2, 1.15, g, R.drag)}, team, at: {x: spot.x, z: spot.z, yaw: face}};
      }
      case 'gr-curve': {
        // At rest off to one side; the ring in the far top corner, which a curve bends into.
        const ball = {x: this.side * this.rand(8, 11), y: r + .02, z: goal - s * this.rand(12, 15)};
        const aim = {x: -this.side * (R.goalHalfWidth - 1.3), y: 2.7, z: goal, r: 1.2, floor: false};
        const yaw = Math.atan2(aim.x - ball.x, aim.z - ball.z);
        return {ball: {...ball, vx: 0, vy: 0, vz: 0}, team, aim, at: {x: ball.x - Math.sin(yaw) * 2.2, z: ball.z - Math.cos(yaw) * 2.2, yaw}};
      }
      case 'gr-aerial': {
        // Popped high in front of the goal: up past four metres and down onto the person's run.
        const from = {x: this.rand(-3, 3), y: .8, z: goal - s * this.rand(8.5, 10.5)};
        return {ball: {...from, vx: this.rand(-1, 1), vy: this.rand(12.5, 14), vz: -s * this.rand(.6, 1.6)}, team, at: {x: from.x, z: from.z - s * 4.5, yaw: face}};
      }
      case 'gr-keeper': {
        // A shot from the edge of the box at a corner of the person's own goal.
        const own = -goal, from = {x: this.rand(-8, 8), y: .7, z: own + s * this.rand(15, 19)};
        const tx = this.side * this.rand(1.6, R.goalHalfWidth - .8), ty = this.rand(.7, R.goalHeight - .9), speed = this.rand(21, 26);
        const t = Math.hypot(tx - from.x, own - from.z) / speed;
        return {ball: {...from, ...arc(from, tx, ty, own, t, g, R.drag), heat: 1.5, shot: 'power'}, team: otherTeam(team), at: {x: 0, z: own + s * 1.2, yaw: face}};
      }
      case 'gr-long': default: {
        // At rest in the person's own half.
        const ball = {x: this.rand(-9, 9), y: r + .02, z: -s * this.rand(5, 11)};
        const yaw = Math.atan2(-ball.x * .3, goal - ball.z);
        return {ball: {...ball, vx: 0, vy: 0, vz: 0}, team, at: {x: ball.x - Math.sin(yaw) * 2.2, z: ball.z - Math.cos(yaw) * 2.2, yaw}};
      }
    }
  }

  // ─── Sky Spike ─────────────────────────────────────────────────────────────────────────────────────────────────────
  private spikeFeed(host: DrillHost, team: BallTeam): DrillFeed {
    const R = SPIKE_RULES, c = team === 'red' ? -1 : 1, g = R.gravity * (host.ball.grav || 1), face = c < 0 ? 0 : Math.PI, machine = otherTeam(team);
    // A team-mate's set, onto the net at 4.3 m (as strike.ts sets), for the spikes.
    const set = (x: number): DrillFeed => {
      const from = {x: x + this.rand(-1.5, 1.5), y: 1.6, z: c * this.rand(4.5, 6)};
      const ring = {x: this.rand(-R.courtHalfX + 1.8, R.courtHalfX - 1.8), y: .02, z: -c * this.rand(3, R.courtHalfZ - 2), r: 1.6, floor: true};
      return {ball: {...from, ...arc(from, x, 4.3, c * 1.9, 1.15, g, R.drag), shot: 'set'}, team, touchTeam: team, touches: 2, at: {x, z: c * 4.2, yaw: face}, aim: this.id === 'ss-spike' ? ring : null};
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
        const aim = {x: this.rand(-4, 4), y: .02, z: c * 1.9, r: 1.3, floor: true};
        return {ball: {...from, ...arc(from, x, 1.5, c * 4.6, 1.3, g, R.drag), shot: 'bump'}, team, touchTeam: team, touches: 1, at: {x, z: c * 4.4, yaw: face}, aim};
      }
      case 'ss-block': {
        // The machine's set on its own side, rising to the net; it spikes it at the top (machineSpike).
        const x = this.rand(-3.5, 3.5), from = {x: x + this.rand(-1, 1), y: 1.8, z: -c * 4.5};
        this.spikeAt = host.now() + .95;
        return {ball: {...from, ...arc(from, x, 4.5, -c * 1.3, 1.0, g, R.drag), shot: 'set'}, team: machine, touchTeam: machine, touches: 2, at: {x: x + this.rand(-1.5, 1.5), z: c * 1.15, yaw: face}};
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
  private clears(b: {x: number; y: number; z: number}, v: {vx: number; vy: number; vz: number}, g: number) {
    if (Math.abs(v.vz) < 1e-3 || Math.sign(-b.z) !== Math.sign(v.vz)) return true;
    const t = -b.z / v.vz, y = b.y + v.vy * t - .5 * g * t * t;
    return y > SPIKE_RULES.netHeight + SPIKE_RULES.ballRadius + .2;
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
        case 'ss-spike': if (e.kind === 'kill' || e.kind === 'point' || e.kind === 'out' || e.kind === 'touches') return this.flag.target && e.kind === 'kill' && mine(e); break;
        case 'ss-roll': if (e.kind === 'kill' || e.kind === 'point' || e.kind === 'out' || e.kind === 'touches') return this.flag.roll && e.kind === 'kill' && mine(e); break;
        case 'ss-dig': case 'ss-set': if (e.kind === 'point' || e.kind === 'kill' || e.kind === 'ace' || e.kind === 'out' || e.kind === 'touches') return false; break;
      }
    }
    const b = host.ball;
    // A dig: the person's touch keeps the serve up on their side.
    if (this.id === 'ss-dig' && b.lastId === me.id && (b.shot === 'dig' || b.shot === 'bump' || b.shot === 'set')) return true;
    if (this.id === 'ss-dig' && b.lastId === me.id) return false;
    // A set: the person's, coming down through 3 m onto the ring at the net.
    if (this.id === 'ss-set' && b.lastId === me.id) {
      const aim = host.view.aim;
      if (b.shot !== 'set' || !aim) return false;
      const down = landing(host.mode, b, 3);
      return Math.hypot(down.x - aim.x, down.z - aim.z) <= aim.r + .4;
    }
    return undefined;
  }
}
