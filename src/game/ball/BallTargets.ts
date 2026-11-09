import {Group} from 'three';
import type {Fighter} from '../../render/Fighter';
import type {ExternalBody, ExternalTargets} from '../simulation';
import type {GameSnapshot, PlayerState, Vec3} from '../types';
import {BALL_ID, GOAL_RULES, SPIKE_RULES, ballOf, ballRadius} from './model';

/** The ball, on the page, as the two things the game already knows how to aim at: a stand-in fighter for the soft
 *  target, the lock (Tab locks the ball: the ball cam) and the camera's framing, beside every fighter of the match (no
 *  fighter is anybody's target here: they all share one side in the kernel); and the external body the page's own
 *  prediction swings at, so a press homes on the ball at once. It forecasts nothing: what a blow did to the ball is the
 *  room's to say (receive is null), as Rift War's prediction adapter leaves its armies to the room. */
export class BallTargets implements ExternalTargets {
  readonly players: PlayerState[] = [];
  readonly crowd = new Map<string, Pick<Fighter, 'state' | 'group'>>();
  private readonly proxy: {state: PlayerState; group: Group} = {group: new Group(), state: {id: BALL_ID, name: 'Ball', fighter: 'taisei', enemy: 'ball', alive: true, isBot: true,
    x: 0, y: 0, z: 0, yaw: 0, hp: 1, maxHp: 1, stamina: 100, ultimate: 0, action: 'idle', actionStarted: 0, actionTime: 0, actionDuration: 0, target: null,
    grounded: true, guarding: false, cooldowns: {light: 0, heavy: 0, special: 0, ultimate: 0}}};
  private readonly body: ExternalBody = {id: BALL_ID, x: 0, y: 0, z: 0, radius: 1, height: 2, airborne: false};
  private live = false;
  /** The match's fighters and the ball. `drawn`: where the page draws the ball now (smoothed), else the snapshot's. */
  update(snapshot: GameSnapshot, drawn?: Vec3 | null): PlayerState[] {
    this.players.length = 0; this.players.push(...snapshot.players); this.crowd.clear();
    const view = ballOf(snapshot);
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
  receive() { return null; }
  freeze() {}
  clear() { this.players.length = 0; this.crowd.clear(); this.live = false; }
}
