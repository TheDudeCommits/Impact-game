import {arenaFor, type BallArenaId} from './arenas';
import {keptSkill} from '../../boot/skill';
import {requireReleasedFighter} from '../rosterAvailability';
import type {FighterId, GameSnapshot, PlayerInput} from '../types';
import {lockCombatOn} from '../lockMode';
import {SECOND} from '../couchSeat';
import {DeviceMatch} from '../economy/device';
import {BallMatch} from './BallMatch';
import type {BotLevel} from './BallBrain';
import {BALL_RULES, BALL_STAGE, otherTeam, type BallModeId, type BallTeam} from './model';
import type {BallMutator} from './mutators';
import type {BallLook} from './look';
import {DRILLS, isDrill, type DrillId} from './drills';

/** What else a match on this device is played with: a mutator, a training drill (FREE PLAY's), and what the
 *  page's own player wears in the ball modes (their seat's look: ball skin, trail, goal burst, celebration). */
export interface BallExtras { mutator?: BallMutator; drill?: DrillId; /** FREE PLAY as LEARN TO PLAY (lesson.ts). */ lesson?: boolean; look?: BallLook; /** The arena picked (arenas.ts); none: the mode's in turn. */ arena?: BallArenaId; /** The other side's bots' level (BallBrain BOT_LEVELS); none: NORMAL. */ difficulty?: BotLevel;
  /** Goal Rush's SPORT mode (football.ts): `?football` in the address (main.ts). Only a match on this device has it. */ football?: boolean;

  /** VOLLEYBALL (volley.ts): Sky Spike played as volleyball - `?volleyball` in the address. */ volleyball?: boolean }
/** The arenas whose intro this page has flown over: a match there again opens with the
 *  short intro (ceremony.ts SHORT_INTRO), as a rematch does. For the page's session. */
const flown = new Set<BallArenaId>();
/** A rematch's line-up (LocalBall.rematch): its round, and the last match's bots, seat for seat. */
interface Again { round: number; bots: readonly {id: string; fighter: FighterId; name: string; team: BallTeam}[] }

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
  /** A match restarted in place (PLAY AGAIN, a drill's AGAIN): its clock and its events begin again from nothing,
   *  so the page lets go of the last one's (main.ts), as it does for a Duel's next set. Called before its first snapshot. */
  onRestart: () => void = () => {};
  /** Couch (couch/couch.ts): Player 2's fighter, their side, and their command each tick (main.ts sets it). */
  partner?: FighterId;
  second: () => PlayerInput | undefined = () => undefined;
  private generation = 0;
  private rewards = new DeviceMatch();
  private last?: {fighter: FighterId; name: string; partner?: FighterId; rivals?: boolean; rumble?: boolean; practice?: boolean; extras?: BallExtras};
  get id() { return this.match ? 'local-ball-fighter' : ''; }
  connect(mode: BallModeId, fighter: FighterId, name: string, partner?: FighterId, rivals = false, rumble = false, practice = false, extras: BallExtras = {}) {
    return this.open(mode, fighter, name, partner, rivals, rumble, practice, extras);
  }
  /** A match on this device; `again`: the last one's next round, in place - its bots kept, Player 2's hands
   *  kept, the page told (onRestart). */
  private async open(mode: BallModeId, fighter: FighterId, name: string, partner?: FighterId, rivals = false, rumble = false, practice = false, extras: BallExtras = {}, again?: Again | 'drill') {
    requireReleasedFighter(fighter);
    if (partner !== undefined) requireReleasedFighter(partner);
    const second = this.second;
    await this.leave();
    if (again && partner) this.second = second;
    this.mode = mode; this.partner = partner; this.last = {fighter, name, partner, rivals, rumble, practice, extras};
    const generation = this.generation, {createRapierCollision} = await import('../rapierCollision'), collision = await createRapierCollision(BALL_STAGE[mode]);
    if (generation !== this.generation) { collision.dispose?.(); return; }
    // The arena (the one picked, else one in turn), and how the match opens: the full intro the first time this page
    // shows the arena, the short one for a rematch or an arena it has flown over; none in FREE PLAY or a couch's.
    const seed = Math.random() * 0x7fffffff | 0 || 1, arena = extras.arena ?? arenaFor(mode, seed), opens = !partner && !practice;
    const intro = opens ? typeof again === 'object' || flown.has(arena) ? 'short' as const : true : false;
    if (opens) flown.add(arena);
    // `?balllength=` on this machine: a shorter match (seconds of Goal Rush, Sky Spike's target), for checks of its end.
    const here = typeof location === 'object' && ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) ? new URLSearchParams(location.search) : undefined;
    const length = Number(here?.get('balllength')) || undefined;
    this.match = new BallMatch(mode, {collision, seed, access: 'bots', lockCombat: lockCombatOn(), length, replays: !partner, rumble, arena, practice: practice && !partner,
      mutator: rumble ? null : extras.mutator ?? null, drill: practice && !partner ? extras.drill : undefined, lesson: practice && !partner && !extras.drill ? extras.lesson : undefined, intro, round: typeof again === 'object' ? again.round : undefined,
      difficulty: practice && !partner ? undefined : extras.difficulty, ...(extras.football ? {football: true} : {}), ...(extras.volleyball && mode === 'sky-spike' && (!practice || (extras.lesson && !extras.drill)) ? {volleyball: true} : {})});
    const team: BallTeam = 'red';
    this.match.add(this.id, fighter, name, false, team); this.match.sim.setPlayerSkill(this.id, keptSkill()); this.match.setLook(this.id, extras.look);
    // `?ballpilot` on this machine: a bot plays the page's own fighter (the captures and checks of the ball modes).
    if (here?.has('ballpilot')) this.match.pilot(this.id);
    if (partner) this.match.add(SECOND, partner, 'Player 2', false, rivals ? otherTeam(team) : team);
    // A rematch: the same bots on the same sides, under the same ids (the page's bodies for them are already loaded).
    if (typeof again === 'object') for (const bot of again.bots) if (this.match.seats.size < BALL_RULES.capacity) this.match.add(bot.id, bot.fighter, bot.name, true, bot.team);
    this.match.start(); this.paused = false;
    this.room = {send: (type, payload) => { const error = this.act(type, payload); if (error) this.onNotice(error); }};
    this.predictionReady = true;
    if (again) this.onRestart();
    this.publish();
  }
  /** The same FREE PLAY again (a drill's AGAIN and NEXT DRILL), in place. */
  async again() {
    if (!this.last) return;
    // FREE PLAY and its drills keep the arena they were played in (a match picked by none deals the mode's next).
    const arena = this.match?.view.arena;
    if (this.last.practice && arena) this.last.extras = {...this.last.extras, arena: this.last.extras?.arena ?? arena};
    await this.open(this.mode, this.last.fighter, this.last.name, this.last.partner, this.last.rivals, this.last.rumble, this.last.practice, this.last.extras, 'drill');
  }
  /** PLAY AGAIN on the results: the same match again, here and
   *  at once - the same people, the same bots on the same sides, the same arena and rules - as the next round of this one,
   *  opened by the short intro. The page keeps what it has loaded: no loading screen, no stage built again. Nothing: no
   *  finished match to play again (the page then starts one afresh); else the match's opening. */
  rematch(): Promise<void> | undefined {
    const v = this.match?.view, last = this.last;
    if (!v || !last || v.practice || v.phase !== 'over') return undefined;
    const bots = v.seats.filter(s => s.bot && s.id !== this.id && s.id !== SECOND).map(s => ({id: s.id, fighter: s.fighter, name: s.name, team: s.team}));
    return this.open(this.mode, last.fighter, last.name, last.partner, last.rivals, last.rumble, last.practice, {...last.extras, arena: v.arena ?? last.extras?.arena}, {round: v.round + 1, bots})
      .catch(error => this.onNotice(error instanceof Error ? error.message : String(error)));
  }
  startPrivateMatch() {}
  send(input: PlayerInput) {
    if (!this.match || this.paused) return;
    this.match.submit(this.id, input); this.rewards.input(input);
    if (this.partner) { const other = this.second(); if (other) { this.match.submit(SECOND, other); this.rewards.partnerInput(other); } }
    this.match.step(1 / 60); this.publish();
  }
  private act(type: string, _payload?: unknown): string | undefined {
    if (type === 'ball-rematch') { void this.again(); return undefined; }
    // A drill's NEXT DRILL: the same FREE PLAY with the drill named (drills.ts), from its first ball.
    if (type === 'ball-drill' && isDrill(_payload) && DRILLS[_payload].mode === this.mode && this.last) { this.last.extras = {...this.last.extras, drill: _payload}; void this.again(); return undefined; }
    if (type === 'ball-skip') { this.match?.skip(this.id); return undefined; }
    // LEARN TO PLAY's SKIP STEP and END (ui/ball/LearnToPlay.ts).
    if (type === 'ball-lesson') { this.match?.lessonCommand(this.id, _payload); return undefined; }
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
