import {Group} from 'three';
import type {Fighter} from '../../render/Fighter';
import type {ExternalBlow, ExternalBody, ExternalTargets} from '../simulation';
import type {GameSnapshot, PlayerState, Vec3} from '../types';
import {BALL_ID, GOAL_RULES, SPIKE_RULES, ballOf, ballRadius, type BallState, type BallView} from './model';
import {TouchForecaster, type LocalFighter, type TouchForecast} from './touchForecast';

/** The ball, on the page, as the two things the game already knows how to aim at: a stand-in fighter for the soft
 *  target, the lock (Tab locks the ball: the ball cam) and the camera's framing, beside every fighter of the match (Sky
 *  Spike's all share one side in the kernel; Goal Rush's sides fight, and a swing still takes the ball whenever it is in
 *  reach: model.ts GOAL_FIGHT); and the external body the page's own prediction swings at, so a press homes on the ball
 *  at once - where the page draws it, as the room judges a person's swing (BallMatch SEEN). What a blow does to the ball
 *  is the room's to say (receive answers null to the kernel), but online the page forecasts its own fighter's touch -
 *  a blow's strike, the body's guard, header, bump and bounce (touchForecast.ts) - and hands it to the page (`onTouch`),
 *  which draws the ball leaving at once and blends onto the room's word when it comes (render/ball/BallField). */
export class BallTargets implements ExternalTargets {
  readonly players: PlayerState[] = [];
  readonly crowd = new Map<string, Pick<Fighter, 'state' | 'group'>>();
  private readonly proxy: {state: PlayerState; group: Group} = {group: new Group(), state: {id: BALL_ID, name: 'Ball', fighter: 'taisei', enemy: 'ball', alive: true, isBot: true,
    x: 0, y: 0, z: 0, yaw: 0, hp: 1, maxHp: 1, stamina: 100, ultimate: 0, action: 'idle', actionStarted: 0, actionTime: 0, actionDuration: 0, target: null,
    grounded: true, guarding: false, cooldowns: {light: 0, heavy: 0, special: 0, ultimate: 0}}};
  private readonly body: ExternalBody = {id: BALL_ID, x: 0, y: 0, z: 0, radius: 1, height: 2, airborne: false};
  private live = false;
  // ─── The page's own touch, forecast (online) ──────────────────────────────────────────────────────────────────────
  private readonly forecaster = new TouchForecaster();
  private view: BallView | null = null;
  /** The page's own fighter as its prediction has it, the prediction's clock, and whether it is stepping a snapshot's
   *  commands again (game/prediction.ts `local`, `localTime`, `replaying`); the ball as the page draws it now
   *  (BallField.drawnState); where a forecast touch goes. main.ts sets them; unset, nothing is forecast. */
  local: () => LocalFighter | undefined = () => undefined;
  clock: () => number = () => NaN;
  replaying: () => boolean = () => false;
  drawn: () => BallState | null = () => null;
  onTouch: (touch: TouchForecast) => void = () => {};
  selfId = '';
  /** Each fighter's run along the floor (m/s), from the snapshots as they come (the forecast leads a pass to a running
   *  team-mate as the room does), and where and when each was last seen. */
  private readonly runs = new Map<string, {x: number; z: number; t: number; vx: number; vz: number}>();
  /** The match's fighters and the ball. `drawn`: where the page draws the ball now (smoothed), else the snapshot's. */
  update(snapshot: GameSnapshot, drawn?: Vec3 | null): PlayerState[] {
    this.players.length = 0; this.players.push(...snapshot.players); this.crowd.clear();
    const view = ballOf(snapshot);
    this.view = view ?? null;
    if (view) for (const p of snapshot.players) {
      const was = this.runs.get(p.id), dt = was ? snapshot.serverTime - was.t : 0;
      if (!was) this.runs.set(p.id, {x: p.x, z: p.z, t: snapshot.serverTime, vx: 0, vz: 0});
      else if (dt > 1 / 120) {
        const vx = (p.x - was.x) / dt, vz = (p.z - was.z) / dt, ok = dt < .25 && Math.hypot(vx, vz) < 40;
        was.vx = ok ? vx : 0; was.vz = ok ? vz : 0; was.x = p.x; was.z = p.z; was.t = snapshot.serverTime;
      }
    }
    this.live = !!view && (view.phase === 'live' || view.phase === 'kickoff' || view.phase === 'scored');
    if (!view || !this.live) return this.players;
    const b = drawn ?? view.ball, r = ballRadius(view.mode), p = this.proxy.state;
    p.x = b.x; p.y = Math.max(0, b.y - r); p.z = b.z; p.size = Math.max(.5, r * 2 / 1.8); p.grounded = b.y <= r + .1; p.alive = true;
    this.proxy.group.position.set(p.x, p.y, p.z);
    this.players.push(p); this.crowd.set(BALL_ID, this.proxy);
    const hit = view.mode === 'goal-rush' ? GOAL_RULES.hitRadius : SPIKE_RULES.hitRadius, body = this.body;
    body.radius = hit; body.height = hit * 2; body.x = b.x; body.z = b.z; body.y = b.y - body.height * .55; body.airborne = b.y > r + .35;
    return this.players;
  }
  /** The ball's stand-in body, for the target marker's centre. */
  stand(id: string) { return id === BALL_ID && this.live ? this.proxy : undefined; }
  hostile() { return true; }
  locate(id: string): ExternalBody | undefined { return id === BALL_ID && this.live ? this.body : undefined; }
  query(a: Vec3, b: Vec3, radius: number, out: ExternalBody[]): number {
    out.length = 0;
    if (!this.live) return 0;
    const pad = radius + this.body.radius + 4, x = this.body.x, z = this.body.z;
    if (x < Math.min(a.x, b.x) - pad || x > Math.max(a.x, b.x) + pad || z < Math.min(a.z, b.z) - pad || z > Math.max(a.z, b.z) + pad) return 0;
    out[0] = this.body; out.length = 1; return 1;
  }
  /** The page's prediction landed a blow on the ball. The kernel is told nothing landed (null: the hit, the freeze and
   *  the meter are the room's); the page's own fighter's blow, on its live step (never a replay's), is forecast. */
  receive(_body: ExternalBody, blow: ExternalBlow) {
    if (blow.attackerId === this.selfId && !this.replaying()) {
      const a = this.local(), ball = this.drawn(), world = this.world();
      const now = this.clock(), touch = a && ball && world ? this.forecaster.blow(a, blow, now, ball, world) : null;
      if (touch) { touch.room = now; this.onTouch(touch); }
    }
    return null;
  }
  /** Around each live step of the page's prediction (main.ts sendCommand): before it, where a swing leaves from; after
   *  it, the room's bookkeeping for this seat and the body's own touch of the ball, forecast. */
  beforeStep() { const a = this.local(); if (a && this.view) this.forecaster.before(a); }
  afterStep(dt = 1 / 60) {
    const a = this.local(), world = this.world();
    if (!a || !world) return;
    const now = this.clock(), touch = this.forecaster.after(a, now, dt, this.live ? this.drawn() : null, world);
    if (touch) { touch.room = now; this.onTouch(touch); }
  }
  private world() { return this.view && this.selfId ? {view: this.view, selfId: this.selfId, players: this.players, run: this.run} : null; }
  private readonly run = (id: string) => this.runs.get(id);
  freeze() {}
  clear() { this.players.length = 0; this.crowd.clear(); this.live = false; this.view = null; this.forecaster.reset(); this.runs.clear(); }
}
