import {keptSkill} from '../../boot/skill';
import {requireReleasedFighter} from '../rosterAvailability';
import type {FighterId, GameSnapshot, PlayerInput} from '../types';
import {lockCombatOn} from '../lockMode';
import {SECOND} from '../couchSeat';
import {DeviceMatch} from '../economy/device';
import {BallMatch} from './BallMatch';
import {BALL_STAGE, otherTeam, type BallModeId, type BallTeam} from './model';

/** A ball match played on this device: Goal Rush or Sky Spike against bots, or with a second person on the couch (on
 *  Player 1's team, or the other). It pays the account as the other on-device matches do (economy/device.ts). */
export class LocalBall {
  readonly local = true;
  room: {send(type: string, payload?: unknown): void} | null = null;
  snapshot: GameSnapshot | null = null;
  receivedAt = 0;
  predictionReady = false;
  paused = false;
  match: BallMatch | null = null;
  mode: BallModeId = 'goal-rush';
  onSnapshot: (snapshot: GameSnapshot) => void = () => {};
  onControlReset: () => void = () => {};
  onDisconnect: (message: string) => void = () => {};
  onNotice: (message: string) => void = () => {};
  /** Couch (couch/couch.ts): Player 2's fighter, their side, and their command each tick (main.ts sets it). */
  partner?: FighterId;
  second: () => PlayerInput | undefined = () => undefined;
  private generation = 0;
  private rewards = new DeviceMatch();
  private last?: {fighter: FighterId; name: string; partner?: FighterId; rivals?: boolean; rumble?: boolean; practice?: boolean};
  get id() { return this.match ? 'local-ball-fighter' : ''; }
  async connect(mode: BallModeId, fighter: FighterId, name: string, partner?: FighterId, rivals = false, rumble = false, practice = false) {
    requireReleasedFighter(fighter);
    if (partner !== undefined) requireReleasedFighter(partner);
    await this.leave();
    this.mode = mode; this.partner = partner; this.last = {fighter, name, partner, rivals, rumble, practice};
    const generation = this.generation, {createRapierCollision} = await import('../rapierCollision'), collision = await createRapierCollision(BALL_STAGE[mode]);
    if (generation !== this.generation) { collision.dispose?.(); return; }
    // `?balllength=` on this machine: a shorter match (seconds of Goal Rush, Sky Spike's target), for checks of its end.
    const here = typeof location === 'object' && ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) ? new URLSearchParams(location.search) : undefined;
    const length = Number(here?.get('balllength')) || undefined;
    this.match = new BallMatch(mode, {collision, seed: Math.random() * 0x7fffffff | 0 || 1, access: 'bots', lockCombat: lockCombatOn(), length, replays: !partner, rumble, practice: practice && !partner});
    const team: BallTeam = 'red';
    this.match.add(this.id, fighter, name, false, team); this.match.sim.setPlayerSkill(this.id, keptSkill());
    // `?ballpilot` on this machine: a bot plays the page's own fighter (the captures and checks of the ball modes).
    if (here?.has('ballpilot')) this.match.pilot(this.id);
    if (partner) this.match.add(SECOND, partner, 'Player 2', false, rivals ? otherTeam(team) : team);
    this.match.start(); this.paused = false;
    this.room = {send: (type, payload) => { const error = this.act(type, payload); if (error) this.onNotice(error); }};
    this.predictionReady = true; this.publish();
  }
  /** The same match again, with the same people (PLAY AGAIN on the results). */
  async again() { if (this.last) await this.connect(this.mode, this.last.fighter, this.last.name, this.last.partner, this.last.rivals, this.last.rumble, this.last.practice); }
  startPrivateMatch() {}
  send(input: PlayerInput) {
    if (!this.match || this.paused) return;
    this.match.submit(this.id, input); this.rewards.input(input);
    if (this.partner) { const other = this.second(); if (other) { this.match.submit(SECOND, other); this.rewards.partnerInput(other); } }
    this.match.step(1 / 60); this.publish();
  }
  private act(type: string, _payload?: unknown): string | undefined {
    if (type === 'ball-rematch') { void this.again(); return undefined; }
    if (type === 'ball-skip') { this.match?.skip(this.id); return undefined; }
    if (type === 'ball-reset') { this.match?.reset(this.id); return undefined; }
    if (type === 'ball-chat') { this.match?.chat(this.id, _payload); return undefined; }
    return undefined;
  }
  private publish() {
    if (!this.match) return;
    this.snapshot = this.match.snapshot(true);
    this.rewards.observe(this.snapshot, this.id, this.partner ? SECOND : undefined);
    this.receivedAt = performance.now(); this.onSnapshot(this.snapshot);
  }
  async leave() { this.generation++; this.rewards.reset(); this.partner = undefined; this.second = () => undefined; this.match?.dispose(); this.match = null; this.room = null; this.snapshot = null; this.receivedAt = 0; this.predictionReady = false; this.paused = false; }
}
