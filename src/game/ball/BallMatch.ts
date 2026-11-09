import {BALL_ARENAS, arenaFor, isBallArena, type BallArenaId} from './arenas';
import {isReleasedFighter, requireReleasedFighter} from '../rosterAvailability';
import {ArenaSimulation, validateInput, type ExternalBlow, type ExternalBody, type ExternalTargets} from '../simulation';
import {COMBO_HP, COMBO_STAMINA, JUST_GUARD_WINDOW, MOVES, PLAYER_RADIUS, type MoveDefinition} from '../moves';
import {HELD} from '../economy/fighters';
import {tidyName} from '../displayName';
import type {CollisionWorld, CombatEvent, FighterId, PlayerState, Vec3} from '../types';
import {BallBrain} from './BallBrain';
import {
  BALL_ID, BALL_RULES, BALL_STAGE, BALL_TEAMS, CHARM_KINDS, CLASH, GOAL_FIGHT, QUICK_CHAT_LIMIT, quickChat, GOAL_RULES, RUMBLE, SPIKE_RULES, ballAssist, charmName, heatTier, otherTeam,
  type BallAccess, type BallCharm, type BallEffect, type CharmKind, type BallEvent, type BallModeId, type BallSeat, type BallSnapshot, type BallState,
  type BallTeam, type BallView, type ShotKind,
} from './model';
import {courtSide, freshBall, goalZ, landing, sideOf, speedCap, stepBall, type BallContact} from './physics';
import {strikeBall} from './strike';
import {REPLAY, replayLength, type BallReplay} from './replay';
import {MUTATOR_RULES, baseGravity, baseSize, isMutator, type BallMutator} from './mutators';
import {TRAIT_RULES, traitOf, withTrait} from './traits';
import {DRILLS, DrillRunner, isDrill, type DrillFeed, type DrillHost, type DrillId} from './drills';
import {CELEBRATE, celebrationOf, cleanLook, type Celebration} from './look';
import {DUEL, LINK, SIGNATURE_FIGHTERS, SIGNATURE_SHOTS} from './superShots';
import {INTRO, podiumOf} from './ceremony';

export interface BallOptions {
  collision?: CollisionWorld; seed?: number; access?: BallAccess; round?: number; fillBots?: boolean;
  /** Lock combat (game/lockCombat.ts): the fighters' light strings play it, as in every mode. */
  lockCombat?: boolean;
  /** Goal Rush: seconds of play (GOAL_RULES.matchSeconds unless a room says). Sky Spike: the score to win. */
  length?: number;
  /** Replays of goals and great points (replay.ts); off for a couch match, whose split screen has no one lens to lend. */
  replays?: boolean;
  /** RUMBLE: charms on the field, picked up by running through them. */
  rumble?: boolean;
  /** FREE PLAY: the people seated and the ball, nobody else, no clock and no end. */
  practice?: boolean;
  /** Which of the mode's arenas (game/ball/arenas.ts); none or one of the other mode's: the mode's arenas in turn by the seed. */
  arena?: BallArenaId;
  /** A mutator (mutators.ts): HEAT RUSH, LOW GRAVITY, GIANT BALL or SUDDEN DEATH. */
  mutator?: BallMutator | null;
  /** FREE PLAY's training drill (drills.ts), this mode's. */
  drill?: DrillId;
  /** The match opens with its intro (ceremony.ts INTRO: the flyover, the splash page, the whistle), held in a
   *  longer countdown. Never in FREE PLAY; the page's offline match and the online rooms ask for it, a couch one doesn't. */
  intro?: boolean;
}

/** Sky Spike and FREE PLAY: every fighter shares one side in the combat kernel, so no blow ever finds another fighter:
 *  blows find the ball, which this match puts in front of them as the kernel's one external body. Goal Rush's sides are
 *  the kernel's own (GOAL_FIGHT), so a blow finds the other side's fighters as well as the ball, never a team-mate. */
const PITCH = 'pitch';
const POOL = (Object.keys(MOVES) as FighterId[]).filter(f => isReleasedFighter(f) && !HELD.has(f));
/** A SUPER SHOT bulldozing somebody: a heavy knockdown with no harm in it (nobody's health counts here). */
const BOWL: MoveDefinition = {name: 'Ball Impact', duration: .4, contacts: [0], damage: 1, range: 1, radius: 1, stamina: 0, cooldown: 0, stun: .8, knockback: 11, style: 'melee', outcome: 'knockdown'};
/** An OVERDRIVE ball meeting somebody: a short stagger, never off their feet (only a SUPER SHOT
 *  still bulldozes: a ball that bowled players over every few seconds took the match away from them). */
const STAGGER: MoveDefinition = {name: 'Ball Impact', duration: .3, contacts: [0], damage: 1, range: 1, radius: 1, stamina: 0, cooldown: 0, stun: BALL_RULES.staggerSeconds, knockback: 3.5, style: 'melee', outcome: 'stagger'};
/** Ultimate and awakening meter a touch is worth, by slot: a side that keeps the ball moving earns its super shot. */
const TOUCH_METER: Record<string, [number, number]> = {light: [2, 2.5], heavy: [3.5, 3.5], special: [4, 4], ultimate: [0, 5], area: [3.5, 3.5]};
/** The share of bot matches in which a side's bots bring a fighter with a signature super shot (superShots.ts). (.35 with
 *  the bigger ball and running shots made 13 goals a match against 9.8; .15 makes 11.4.) */
const SIGNATURE_BOTS = .15;
/** Goal Rush's jobs: metres of head start toward the attacker's job for a bot whose super shot is ready. */
const SUPER_READY = 3;
/** Body contact: the capsule a fighter's body is to the ball, and how soft. Goal Rush's is livelier: a body
 *  run or boosted into the ball drives it on by half again its own speed. */
const BODY_LOW = .45, BODY_HIGH = 1.45, BODY_BOUNCE = .35, GOAL_BODY_BOUNCE = .5;
/** Goal Rush's BUMP (GOAL_FIGHT.bump): a boosting body knocking an opponent flat. */
const BUMP: MoveDefinition = {name: 'BUMP', duration: .4, contacts: [0], damage: Math.round(GOAL_FIGHT.health * GOAL_FIGHT.bump.damage), range: 1, radius: 1, stamina: 0, cooldown: 0, stun: .7, knockback: 10, style: 'melee', outcome: 'knockdown'};
/** How much further than its body a guard meets the ball. */
const GUARD_REACH = .7;
/** Goal Rush's kickoff spots (on red's half; blue's mirror them): five of them, scaled to the pitch. */
const KICKOFF_SPOTS: readonly {x: number; z: number}[] = [{x: -8.1, z: 10.2}, {x: 8.1, z: 10.2}, {x: -1.6, z: 15.2}, {x: 1.6, z: 15.2}, {x: 0, z: 18.3}];

interface Touch { id: string; team: BallTeam; at: number; x: number; y: number; z: number }
/** What the bots say to the moments (the quick chat's lines), picked at random, a beat after the moment. */
const CHAT = {
  scored: ['Nice shot!', 'What a play!', 'Wow!', 'Yes!!'], assisted: ['Great pass!', 'Nice shot!', 'What a play!'],
  conceded: ['No problem.', 'Close one!', 'We got this.', 'Okay.'], ownGoal: ['Oops!', 'My bad...', 'Whoops...'], gifted: ['Calculated.', 'Thanks!'],
  saved: ['What a save!', 'Great save!', 'Nice block!'], kill: ['Nice one!', 'What a spike!', 'Wow!'], lost: ['My bad...', 'Close one!', 'Next one.'],
  fever: ['Here we go!', 'Hold on!', 'This is it!'], won: ['GG!', 'Good game!', 'Well played!'], beaten: ['GG', 'gg wp', 'Good game.'],
} as const;

/** One Goal Rush or Sky Spike match around the shared fighting kernel: its seats and teams, its ball and the rules of
 *  each game. A server room, a page's offline match and the tests all drive it the same way: `add`, `start`, then
 *  `submit` and `step` each tick, `snapshot` to publish. */
export class BallMatch implements ExternalTargets, DrillHost {
  readonly sim: ArenaSimulation;
  readonly seats = new Map<string, BallSeat>();
  readonly view: BallView;
  readonly ball: BallState;
  private readonly brains = new Map<string, BallBrain>();
  private readonly body: ExternalBody = {id: BALL_ID, x: 0, y: 0, z: 0, radius: 1, height: 2, airborne: false};
  private readonly contacts: BallContact[] = [];
  private readonly last = new Map<string, {x: number; y: number; z: number; vx: number; vz: number; vy: number}>();
  private readonly strikes = new Map<string, {cast: number; at: number}>();
  private readonly bodyTouch = new Map<string, number>();
  /** The cast each seat last touched the ball with: a move's later contacts strike it again but are not new touches. */
  private readonly touchCast = new Map<string, number>();
  private readonly touchedAt = new Map<string, number>();
  /** Every touch lately, oldest first: `strike` false for a ball that only bounced off a body. */
  private touchesLog: (Touch & {strike: boolean; shot?: ShotKind})[] = [];
  /** Blows a stopped ball took, landing together when its time starts again. */
  private stack: {vx: number; vy: number; vz: number; heat: number; count: number; id: string; team: BallTeam; shot: ShotKind; super?: boolean} | null = null;
  /** A TECHNIQUE DUEL on now: who guarded, whose shot, and how it ends when the beat does (releaseStack). */
  private duelling: {keeper: string; striker?: string; keeperWins: boolean; x: number; y: number; z: number} | null = null;
  /** The last real strike (not a tap, bump or set), for a CLASH with the other side's next one. */
  private clashAt = -Infinity;
  /** When each seat last dashed: a save straight after one is a DIVING SAVE. */
  private readonly dashAt = new Map<string, number>();
  /** The last flair shot named (BICYCLE KICK...): whose and when, for the accolade if it scores. */
  private flair: {id: string; at: number; text: string} | null = null;
  private lastStrike: {id: string; team: BallTeam; at: number; power: number; vx: number; vy: number; vz: number; shot: ShotKind; super: boolean} | null = null;
  private events: CombatEvent[] = [];
  private serial = 0;
  private rolesAt = 0;
  private serveRotation: Record<BallTeam, number> = {red: 0, blue: 0};
  private readonly hitR: number;
  private readonly radius: number;
  /** Goal Rush outside FREE PLAY: the sides fight (GOAL_FIGHT). */
  private readonly pvp: boolean;
  /** When each seat last bumped somebody (GOAL_FIGHT.bump.gap). */
  private readonly bumpAt = new Map<string, number>();
  private onTargetSince = -Infinity;
  private feverTold = false;
  private matchPointTold = 0;
  private endWait = false;
  /** When the bodies were last put on their marks: no replay reaches back past it. */
  private liveSince = 0;
  /** When overtime began (its ball heats by itself from then), and when each seat was last staggered by the ball. */
  private overtimeSince = 0;
  private readonly staggeredAt = new Map<string, number>();
  /** Sky Spike: the scorer whose celebration plays on into the next serve's walk-up, and until when. */
  /** The people who have voted to skip the replay showing now. */
  private readonly skips = new Set<string>();
  private readonly replays: boolean;
  private watched = false;
  /** Bots' lines waiting for their beat, and Sky Spike's kill streak. */
  private chats: {at: number; id: string; team: BallTeam; text: string}[] = [];
  private streak = {id: '', count: 0};
  /** The match's own seeded numbers (bots' nerve, who serves first), apart from the kernel's. */
  private seed: number;
  private rng = () => { let x = this.seed; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; this.seed = x >>> 0 || 1; return this.seed / 0x100000000; };

  constructor(readonly mode: BallModeId, options: BallOptions = {}) {
    this.seed = ((options.seed ?? 1) * 2654435761) >>> 0 || 1;
    this.replays = (options.replays ?? true) && !options.practice;
    this.radius = mode === 'goal-rush' ? GOAL_RULES.ballRadius : SPIKE_RULES.ballRadius;
    this.hitR = mode === 'goal-rush' ? GOAL_RULES.hitRadius : SPIKE_RULES.hitRadius;
    this.pvp = mode === 'goal-rush' && !options.practice;
    this.sim = new ArenaSimulation({roomMode: 'training', adaptive: false, trainingBot: false, respawn: true, stage: BALL_STAGE[mode],
      collision: options.collision, seed: options.seed ?? 1, capacity: BALL_RULES.capacity, maxHp: this.pvp ? GOAL_FIGHT.health : COMBO_HP, maxStamina: COMBO_STAMINA,
      ...(options.lockCombat ? {lockCombat: true} : {})});
    // The aim at the ball and the sports movement (model.ts BALL_SPORT), as the page's prediction of the room has them.
    this.sim.status = 'waiting'; this.sim.external = this; this.sim.assist = ballAssist(mode);
    this.ball = freshBall();
    this.view = {kind: 'ball', mode, phase: 'lobby', access: options.access ?? 'host', round: options.round ?? 1, hostId: null,
      capacity: BALL_RULES.capacity, fillBots: options.fillBots ?? true, startsAt: null, startedAt: 0, endsAt: 0, phaseUntil: 0, seats: [],
      score: {red: 0, blue: 0}, ball: this.ball, clock: mode === 'goal-rush' ? options.length ?? GOAL_RULES.matchSeconds : 0, overtime: false,
      touchTeam: null, touches: 0, rally: 0, servingTeam: 'red', serverId: null,
      target: mode === 'sky-spike' ? options.length ?? SPIKE_RULES.target : 0, fever: false, winner: null, reason: '', mvp: null, events: [], replay: null,
      rumble: !!options.rumble, charms: [], effects: [], practice: !!options.practice, best: 0, aim: null, hits: 0, streak: 0, bestStreak: 0,
      mutator: isMutator(options.mutator) ? options.mutator : null};
    // SUDDEN DEATH: Goal Rush's clock is a minute, then the next goal wins.
    if (mode === 'goal-rush' && this.view.mutator === 'sudden-death' && options.length === undefined) this.view.clock = MUTATOR_RULES.suddenSeconds;
    if (options.practice) { this.view.fillBots = false; if (mode === 'sky-spike') this.view.target = 999; }
    else if (options.intro) this.view.intro = {seconds: INTRO.seconds};
    this.view.arena = isBallArena(options.arena) && BALL_ARENAS[options.arena].mode === mode ? options.arena : arenaFor(mode, this.seed);
    if (options.practice && isDrill(options.drill) && DRILLS[options.drill].mode === mode) { this.drill = new DrillRunner(options.drill, this.rng); this.view.drill = this.drill.view; }
    this.placeBallAtRest();
  }

  // ─── Seats ────────────────────────────────────────────────────────────────────────────────────────────────────────
  private count(team: BallTeam) { let n = 0; for (const s of this.seats.values()) if (s.team === team) n++; return n; }
  add(id: string, fighter: FighterId, name: string, bot = false, team?: BallTeam): BallSeat {
    if (this.view.phase !== 'lobby' || this.seats.has(id) || this.seats.size >= BALL_RULES.capacity) throw new Error('This match has already started or is full.');
    requireReleasedFighter(fighter);
    const side = team && this.count(team) < BALL_RULES.teamSize ? team : this.count('red') <= this.count('blue') ? 'red' : 'blue';
    if (this.count(side) >= BALL_RULES.teamSize) throw new Error('Both teams are full.');
    const seat: BallSeat = {id, name: tidyName(name, 18), fighter, team: side, bot, goals: 0, assists: 0, saves: 0, shots: 0, touches: 0, kills: 0, aces: 0, blocks: 0, digs: 0, points: 0, trait: traitOf(fighter)};
    this.seats.set(id, seat);
    this.sim.addPlayer(id, fighter, seat.name, bot, this.mark(seat));
    this.sim.setTeam(id, this.pvp ? seat.team : PITCH);
    if (bot) this.attachBrain(id);
    else if (this.view.hostId === null) this.view.hostId = id;
    this.view.seats = [...this.seats.values()];
    return seat;
  }
  private attachBrain(id: string) {
    const actor = this.sim.actors.get(id);
    if (!actor) return;
    actor.external = true; actor.state.isBot = true;
    this.brains.set(id, new BallBrain(id, this.mode, this.brains.size, this.rng));
  }
  /** A person's seat played by a bot (a page's demo and captures, `?ballpilot` on this machine): their fighter, the bot's hands. */
  pilot(id: string) { if (this.seats.has(id)) this.attachBrain(id); }
  /** A private room's host choosing RUMBLE or CLASSIC in the lobby. */
  /** The host picks the arena in the lobby (one of the mode's). */
  setArena(id: string, arena: unknown) {
    if (id !== this.view.hostId || this.view.phase !== 'lobby' || !isBallArena(arena) || BALL_ARENAS[arena].mode !== this.mode) return false;
    this.view.arena = arena; this.placeBallAtRest(); return true;
  }
  setRumble(id: string, on: unknown) { if (id !== this.view.hostId || this.view.phase !== 'lobby' || typeof on !== 'boolean') return false; if (on && this.view.mutator) this.setMutator(id, null); this.view.rumble = on; return true; }
  /** A private room's host choosing a mutator (or none) in the lobby. */
  setMutator(id: string, mutator: unknown) {
    if (id !== this.view.hostId || this.view.phase !== 'lobby' || (mutator !== null && !isMutator(mutator))) return false;
    this.view.mutator = mutator; if (mutator) this.view.rumble = false;
    if (this.mode === 'goal-rush') this.view.clock = mutator === 'sudden-death' ? MUTATOR_RULES.suddenSeconds : GOAL_RULES.matchSeconds;
    this.placeBallAtRest();
    return true;
  }
  setFill(id: string, fill: unknown) { if (id !== this.view.hostId || this.view.phase !== 'lobby' || typeof fill !== 'boolean') return false; this.view.fillBots = fill; return true; }
  /** A seat changing sides in the lobby, where the other side has room. */
  swap(id: string): boolean {
    const seat = this.seats.get(id);
    if (!seat || this.view.phase !== 'lobby') return false;
    const to = otherTeam(seat.team);
    if (this.count(to) >= BALL_RULES.teamSize) return false;
    seat.team = to; this.view.seats = [...this.seats.values()];
    if (this.pvp) this.sim.setTeam(id, to);
    return true;
  }
  submit(id: string, raw: unknown): boolean {
    const seat = this.seats.get(id), input = validateInput(raw);
    if (!seat || seat.bot || seat.disconnected || !input || this.brains.has(id)) return false;
    // Bodies hold their marks through a countdown and a kickoff (the serve's walk-up is play).
    if (this.view.phase === 'countdown' || (this.view.phase === 'kickoff' && this.mode === 'goal-rush' && !this.view.practice)) return false;
    // Everyone watches the replay: nobody plays on behind it.
    if (this.replaying()) return false;
    input.targetId = BALL_ID;
    return this.sim.submitInput(id, input);
  }
  /** A person's quick chat line (an index into quickChat), into every page's feed; too many too fast are dropped. */
  chat(id: string, index: unknown): boolean {
    const seat = this.seats.get(id), lines = quickChat(this.mode), now = this.sim.serverTime;
    if (!seat || seat.bot || typeof index !== 'number' || !Number.isInteger(index) || index < 0 || index >= lines.length) return false;
    const said = (this.said.get(id) ?? []).filter(t => now - t < QUICK_CHAT_LIMIT.window);
    if (said.length >= QUICK_CHAT_LIMIT.burst || now - (said.at(-1) ?? -Infinity) < QUICK_CHAT_LIMIT.gap) return false;
    said.push(now); this.said.set(id, said);
    this.emit('chat', {team: seat.team, actorId: seat.id, x: 0, y: 0, z: 0, text: lines[index], value: index});
    return true;
  }
  private readonly said = new Map<string, number[]>();
  /** FREE PLAY's target practice: a new ring somewhere to aim at - a corner or the middle of the goal the person shoots
   *  at, top or bottom; a spot on the far court's floor. */
  private newTarget() {
    // (A drill puts its own ring up, ball by ball.)
    if (!this.view.practice || this.drill) return;
    const person = [...this.seats.values()].find(s => !s.bot), team = person?.team ?? 'red';
    if (this.mode === 'goal-rush') {
      const R = GOAL_RULES, z = goalZ(otherTeam(team)), xs = [-(R.goalHalfWidth - 1.25), 0, R.goalHalfWidth - 1.25], ys = [1.05, R.goalHeight - 1.15];
      let x = 0, y = 0;
      do { x = xs[Math.floor(this.rng() * 3)]; y = ys[Math.floor(this.rng() * 2)]; } while (this.view.aim && this.view.aim.x === x && this.view.aim.y === y);
      this.view.aim = {x, y, z, r: 1.05, floor: false};
    } else {
      const far = team === 'red' ? 1 : -1;
      this.view.aim = {x: (this.rng() * 2 - 1) * (SPIKE_RULES.courtHalfX - 1.6), y: .02, z: far * (2.2 + this.rng() * (SPIKE_RULES.courtHalfZ - 3.6)), r: 1.5, floor: true};
    }
  }
  /** The ball went into the goal (or down on the floor) here: through the ring, a target; anywhere else, the streak's end. */
  private targetHit(x: number, y: number, z: number) {
    const aim = this.view.aim, v = this.view;
    if (!v.practice || !aim) return;
    const hit = aim.floor ? Math.hypot(x - aim.x, z - aim.z) <= aim.r : Math.sign(z) === Math.sign(aim.z) && Math.hypot(x - aim.x, y - aim.y) <= aim.r;
    if (!hit) { v.streak = 0; return; }
    v.hits++; v.streak++; v.bestStreak = Math.max(v.bestStreak, v.streak);
    this.emit('target', {x: aim.x, y: aim.y, z: aim.z, value: v.streak, text: v.streak >= 3 ? `${v.streak} IN A ROW` : 'TARGET'});
    this.newTarget();
  }
  /** FREE PLAY's reset: Goal Rush's ball at rest a stride in front of the person, Sky Spike's ball machine sending the
   *  next ball now. */
  reset(id: string): boolean {
    const seat = this.seats.get(id), a = this.sim.actors.get(id), b = this.ball, now = this.sim.serverTime;
    if (!this.view.practice || this.drill || !seat || !a || (this.view.phase !== 'live' && this.view.phase !== 'kickoff')) return false;
    if (this.mode === 'goal-rush') {
      const yaw = a.input.yaw ?? a.state.yaw, p = a.state, R = GOAL_RULES, r = this.radius * b.size;
      Object.assign(b, {vx: 0, vy: 0, vz: 0, sx: 0, sy: 0, sz: 0, heat: 0, super: false, held: false, frozenUntil: 0, clash: 0});
      b.x = Math.max(-R.halfX + 2, Math.min(R.halfX - 2, p.x + Math.sin(yaw) * 2.6)); b.z = Math.max(-R.halfZ + 2, Math.min(R.halfZ - 2, p.z + Math.cos(yaw) * 2.6)); b.y = r + .02;
      this.stack = null; this.lastStrike = null; this.view.phase = 'live';
    } else { this.ball.held = true; this.serve(); this.view.phaseUntil = now + .4; }
    return true;
  }
  /** A person voting to skip the replay showing now; when every person in the match has, it ends (a vote). */
  skip(id: string): boolean {
    if (this.view.phase === 'countdown' && this.view.intro) return this.skipIntro(id);
    const r = this.view.replay, seat = this.seats.get(id), now = this.sim.serverTime;
    if (!r || !seat || seat.bot || this.brains.has(id) || !this.replaying()) return false;
    this.skips.add(id);
    const people = [...this.seats.values()].filter(s => !s.bot && !s.disconnected && !this.brains.has(s.id));
    r.skips = people.filter(s => this.skips.has(s.id)).length; r.people = people.length;
    if (people.every(s => this.skips.has(s.id))) { r.until = now; this.view.phaseUntil = Math.min(this.view.phaseUntil, now + REPLAY.after); }
    return true;
  }
  /** The intro's skip, voted as a replay's is: once every person in the match has, the kickoff comes at once. */
  private skipIntro(id: string): boolean {
    const intro = this.view.intro!, seat = this.seats.get(id), now = this.sim.serverTime;
    if (!seat || seat.bot || this.brains.has(id) || intro.skipped) return false;
    this.skips.add(id);
    const people = [...this.seats.values()].filter(s => !s.bot && !s.disconnected && !this.brains.has(s.id));
    intro.skips = people.filter(s => this.skips.has(s.id)).length; intro.people = people.length;
    if (people.every(s => this.skips.has(s.id))) { intro.skipped = true; this.view.startsAt = Math.min(this.view.startsAt ?? now, now + INTRO.skipTo); }
    return true;
  }
  /** Seconds from the start to the kickoff: the intro's, or the plain countdown's (a room holds it while its pages load). */
  leadIn() { return this.view.intro ? this.view.intro.skipped ? INTRO.skipTo : INTRO.seconds : BALL_RULES.countdown; }
  /** A replay is on every screen. */
  replaying() { const r = this.view.replay, now = this.sim.serverTime; return this.view.phase === 'scored' && !!r && now >= r.at && now < r.until; }
  disconnect(id: string, away: boolean) { const seat = this.seats.get(id); if (!seat) return; seat.disconnected = away || undefined; this.sim.clearPlayerInput(id); }
  remove(id: string) {
    const seat = this.seats.get(id);
    if (!seat) return;
    if (this.view.phase === 'lobby') { this.seats.delete(id); this.brains.delete(id); this.sim.removePlayer(id); }
    else { seat.bot = true; seat.disconnected = undefined; this.attachBrain(id); }
    if (this.view.hostId === id) this.view.hostId = [...this.seats.values()].find(s => !s.bot)?.id ?? null;
    this.view.seats = [...this.seats.values()];
  }
  start(): boolean {
    if (this.view.phase !== 'lobby' || !this.seats.size) return false;
    if (this.view.fillBots) {
      const deck = this.sim.shuffle(POOL.slice()), headliners = this.sim.shuffle(SIGNATURE_FIGHTERS.filter(f => POOL.includes(f)));
      let n = 0;
      for (const team of BALL_TEAMS) {
        // (Now and then a side's bots bring one of the eight fighters with a signature super shot, if the side has none,
        // so a bot match shows them off.)
        let signature = [...this.seats.values()].some(s => s.team === team && SIGNATURE_SHOTS[s.fighter]) || this.rng() >= SIGNATURE_BOTS;
        while (this.count(team) < BALL_RULES.teamSize) {
          const used = new Set([...this.seats.values()].map(s => s.fighter)), pick = signature ? undefined : headliners.find(f => !used.has(f));
          signature = true;
          const fighter = pick ?? deck.find(f => !used.has(f)) ?? deck[n % deck.length];
          this.add(`ball-bot-${++n}`, fighter, fighter.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' '), true, team);
        }
      }
    }
    if (!this.view.practice && !BALL_TEAMS.every(team => this.count(team) > 0)) return false;
    this.view.phase = 'countdown'; this.view.startsAt = this.sim.serverTime + this.leadIn();
    for (const seat of this.seats.values()) { this.sim.place(seat.id, this.mark(seat), this.facing(seat.team)); this.sim.clearPlayerInput(seat.id); }
    return true;
  }

  // ─── Marks ────────────────────────────────────────────────────────────────────────────────────────────────────────
  private facing(team: BallTeam) { return team === 'red' ? 0 : Math.PI; }
  private order(seat: BallSeat) { return [...this.seats.values()].filter(s => s.team === seat.team).findIndex(s => s.id === seat.id); }
  /** Where a seat stands for a kickoff or a serve. A kickoff's three spots are dealt from five each time
   *  (two diagonals, two just off centre, one deep), the same for both sides, so who reaches the ball first changes. */
  private mark(seat: BallSeat): Vec3 {
    const i = Math.max(0, this.order(seat)), sign = seat.team === 'red' ? -1 : 1;
    if (this.mode === 'goal-rush') {
      const spots = this.kickSpots;
      const s = spots[i % spots.length];
      return {x: s.x, y: 0, z: sign * s.z};
    }
    const R = SPIKE_RULES;
    if (this.view.phase !== 'lobby' && this.view.serverId === seat.id) return {x: 0, y: 0, z: sign * (R.courtHalfZ + 1.4)};
    const spots = [{x: -3.6, z: 3.2}, {x: 3.6, z: 3.2}, {x: 0, z: 7.6}];
    const s = spots[i % 3];
    return {x: s.x, y: 0, z: sign * s.z};
  }
  private placeAll() {
    for (const seat of this.seats.values()) {
      const a = this.sim.actors.get(seat.id);
      if (!a) continue;
      delete seat.out;
      if (!a.state.alive) this.sim.revive(seat.id, a.state.maxHp);
      a.state.hp = a.state.maxHp;
      this.sim.place(seat.id, this.mark(seat), this.facing(seat.team)); this.sim.clearPlayerInput(seat.id);
      if (this.celebration?.id === seat.id) { a.cast = null; continue; }
      a.cast = null; a.state.action = 'idle'; a.state.actionStarted = this.sim.serverTime; a.state.actionDuration = 0;
    }
    this.last.clear();
  }
  private placeBallAtRest() {
    const b = this.ball, m = this.view.mutator;
    Object.assign(b, freshBall());
    // The mutators' ball: its weight and size all match, and HEAT RUSH's start at tier 3.
    b.grav = baseGravity(m); b.size = baseSize(m);
    if (m === 'heat-rush') b.heat = MUTATOR_RULES.heatStart;
    b.y = this.radius * b.size + .02;
    // The arena's twist on the ball: its ground, a wind that turns between points, a ball that starts warm.
    const twist = BALL_ARENAS[this.view?.arena ?? arenaFor(this.mode, this.seed)].twist;
    if (twist.groundFriction !== 1) b.ground = twist.groundFriction;
    if (twist.groundBounce !== 1) b.spring = twist.groundBounce;
    if (twist.wind) { const turn = ((this.seed + (this.view?.score.red ?? 0) * 7919 + (this.view?.score.blue ?? 0) * 104729) % 360) * Math.PI / 180; b.windX = Math.cos(turn) * twist.wind; b.windZ = Math.sin(turn) * twist.wind; }
    if (twist.startHeat) b.heat = Math.max(b.heat, twist.startHeat);
    b.link = null; this.stack = null; this.lastStrike = null; this.duelling = null;
  }

  // ─── The step ─────────────────────────────────────────────────────────────────────────────────────────────────────
  step(dt = 1 / 60, waiting?: ReadonlySet<string>) {
    if (!Number.isFinite(dt) || dt <= 0 || dt > .05) throw new Error('Invalid ball match timestep.');
    const now = this.sim.serverTime;
    if (this.view.phase === 'over') { this.sim.serverTime += dt; this.sim.tick++; this.tidyBodies(); this.say(); return; }
    // Behind a replay everyone stands and watches: the bots' hands still, nobody's last press carried on.
    const watching = this.replaying();
    if (watching && !this.watched) for (const seat of this.seats.values()) this.sim.clearPlayerInput(seat.id);
    this.watched = watching;
    const playing = !watching && (this.view.phase === 'live' || this.view.phase === 'scored' || (this.view.phase === 'kickoff' && this.mode === 'sky-spike'));
    if (playing) {
      if (now >= this.rolesAt) { this.rolesAt = now + .3; this.assignRoles(); }
      const players = this.sim.playerStates();
      for (const [id, brain] of this.brains) {
        // (A bot celebrating a goal stands for it.)
        if (this.celebration?.id === id && this.view.phase === 'scored') continue;
        const seat = this.seats.get(id), me = this.sim.actors.get(id)?.state;
        if (seat && me) this.sim.command(id, brain.command(me, seat, players, this.view, now));
      }
    }
    this.sim.step(dt, waiting);
    // (Read at once, for Goal Rush's knock-outs: each one a wipe-out.)
    const fresh = this.sim.drainEvents();
    this.events.push(...fresh);
    if (this.pvp) this.wipeOuts(fresh);
    this.tidyBodies(dt);
    if (this.celebration) this.holdCelebration();
    for (const seat of this.seats.values()) if (this.sim.actors.get(seat.id)?.state.action === 'dash') this.dashAt.set(seat.id, this.sim.serverTime);
    const t = this.sim.serverTime;
    if (this.view.phase === 'countdown' && t + 1e-6 >= (this.view.startsAt ?? Infinity)) this.begin();
    else if (this.view.phase === 'kickoff' && this.mode === 'goal-rush' && t + 1e-6 >= this.view.phaseUntil) this.release();
    else if (this.view.phase === 'scored' && t + 1e-6 >= this.view.phaseUntil) this.afterPoint();
    this.say();
    this.events.push(...this.sim.drainEvents());
    if (this.events.length > 600) this.events.splice(0, this.events.length - 600);
    if (this.view.phase === 'live' || (this.view.phase === 'kickoff' && this.mode === 'sky-spike')) this.play(dt);
    else if (this.view.phase === 'scored') this.coast(dt);
    if (this.view.rumble && this.view.phase === 'live') this.rumbleStep(dt);
    if (this.drill && this.view.phase !== 'lobby' && this.view.phase !== 'countdown') this.drill.step(this);
  }

  // ─── Training drills (drills.ts): the host's side ───────────────────────────────────────────────────────────────
  private drill?: DrillRunner;
  now() { return this.sim.serverTime; }
  person() {
    const seat = [...this.seats.values()].find(s => !s.bot), p = seat && this.sim.actors.get(seat.id)?.state;
    return seat && p ? {id: seat.id, team: seat.team, x: p.x, y: p.y, z: p.z, grounded: p.grounded} : undefined;
  }
  /** The ball machine's ball: placed and set going, whose it counts as, the touches spent, the person on their spot. */
  feed(f: DrillFeed) {
    const b = this.ball, now = this.sim.serverTime, m = this.view.mutator;
    Object.assign(b, freshBall(), {x: f.ball.x, y: f.ball.y, z: f.ball.z, vx: f.ball.vx, vy: f.ball.vy, vz: f.ball.vz, held: false, lastTeam: f.team, shot: f.ball.shot ?? null});
    b.grav = baseGravity(m); b.size = baseSize(m); b.heat = Math.max(f.ball.heat ?? 0, m === 'heat-rush' ? MUTATOR_RULES.heatStart : 0);
    this.stack = null; this.lastStrike = null; this.touchesLog = []; this.flair = null; this.endWait = false;
    this.view.phase = 'live'; this.view.phaseUntil = now; this.liveSince = now; this.view.aim = f.aim ?? null;
    if (this.mode === 'sky-spike') { this.view.touchTeam = f.touchTeam ?? f.team; this.view.touches = f.touches ?? 0; this.view.rally = 1; }
    const me = this.person();
    if (me && f.at) { this.sim.place(me.id, {x: f.at.x, y: 0, z: f.at.z}, f.at.yaw); this.sim.clearPlayerInput(me.id); this.last.delete(me.id); }
  }
  serveNow() { if (this.mode !== 'sky-spike') return; this.ball.held = true; this.serve(); this.view.phaseUntil = this.sim.serverTime + .3; }

  /** Sky Spike and FREE PLAY: nobody's health counts, and nobody stays down: a body knocked off the arena comes back on
   *  its mark. Goal Rush (GOAL_FIGHT): health counts, and fills again a while after the last blow; a wiped-out fighter
   *  comes back at their own end when their time is up. */
  private tidyBodies(dt = 0) {
    const now = this.sim.serverTime;
    for (const seat of this.seats.values()) {
      const a = this.sim.actors.get(seat.id);
      if (!a) continue;
      if (!this.pvp) {
        a.state.hp = a.state.maxHp;
        if (!a.state.alive) { this.sim.revive(seat.id, a.state.maxHp); this.sim.place(seat.id, this.mark(seat), this.facing(seat.team)); }
        continue;
      }
      if (seat.out !== undefined) { if (now + 1e-6 >= seat.out) this.backIn(seat); continue; }
      // (A knock-out the kernel's events did not name - off the arena - is a wipe-out all the same.)
      if (!a.state.alive) { this.wipeOut(seat); continue; }
      if (now - a.lastDamageAt >= GOAL_FIGHT.regenAfter && a.state.hp < a.state.maxHp) a.state.hp = Math.min(a.state.maxHp, a.state.hp + GOAL_FIGHT.regen * dt);
    }
  }
  /** Goal Rush: the kernel's knock-outs this tick, each a wipe-out credited to whoever landed the last blow. */
  private wipeOuts(events: readonly CombatEvent[]) {
    for (const e of events) {
      if (e.kind !== 'eliminated' || !e.targetId) continue;
      const seat = this.seats.get(e.targetId), by = e.actorId ? this.seats.get(e.actorId) : undefined;
      if (!seat || seat.out !== undefined) continue;
      let blow: string | undefined;
      for (const h of events) if (h.kind === 'hit' && h.targetId === seat.id && h.actorId === e.actorId && h.move) blow = h.move;
      this.wipeOut(seat, by && by.team !== seat.team ? by : undefined, blow);
    }
  }
  /** A fighter's health ran out: WIPED OUT, off the pitch for GOAL_FIGHT.seconds (the body lies where it fell, the
   *  kernel's own respawn held off: backIn brings them back). */
  private wipeOut(seat: BallSeat, by?: BallSeat, blow?: string) {
    const a = this.sim.actors.get(seat.id), now = this.sim.serverTime;
    if (!a) return;
    seat.out = now + GOAL_FIGHT.seconds; a.respawnAt = Infinity; this.last.delete(seat.id);
    if (by) { by.wipeouts = (by.wipeouts ?? 0) + 1; by.points += GOAL_FIGHT.points; }
    const p = a.state;
    this.emit('wipeout', {team: by?.team ?? otherTeam(seat.team), actorId: by?.id, targetId: seat.id, x: p.x, y: p.y + 1, z: p.z, value: GOAL_FIGHT.seconds, text: blow});
  }
  /** Back from a wipe-out: at their own end, either side of their goal (the side away from the ball), facing the far
   *  goal, health full, the meters kept, untouchable for a moment. */
  private backIn(seat: BallSeat) {
    const a = this.sim.actors.get(seat.id), now = this.sim.serverTime;
    delete seat.out;
    if (!a) return;
    const home = goalZ(seat.team), x = (this.ball.x > 0 ? -1 : 1) * GOAL_FIGHT.respawnX;
    if (!a.state.alive) this.sim.revive(seat.id, a.state.maxHp);
    a.state.hp = a.state.maxHp;
    this.sim.place(seat.id, {x, y: 0, z: home - Math.sign(home) * GOAL_FIGHT.respawnZ}, this.facing(seat.team));
    this.sim.clearPlayerInput(seat.id);
    a.evadeUntil = now + GOAL_FIGHT.guard;
  }

  private begin() {
    this.view.startsAt = null; this.view.startedAt = this.sim.serverTime; this.sim.status = 'active';
    this.newTarget();
    if (this.mode === 'goal-rush') this.kickoff();
    else { this.view.servingTeam = this.view.practice ? this.machine() : this.rng() < .5 ? 'red' : 'blue'; this.serve(); }
  }
  /** This kickoff's spots (mark). The match's first is the classic one: straight at the ball, two diagonals. */
  private kickSpots: readonly {x: number; z: number}[] = [{x: 0, z: 13}, {x: -8.5, z: 18}, {x: 8.5, z: 18}];
  private kickoff() {
    this.celebration = null;
    if (this.view.score.red + this.view.score.blue > 0) this.kickSpots = this.sim.shuffle([...KICKOFF_SPOTS]).slice(0, 3);
    this.view.phase = 'kickoff'; this.view.phaseUntil = this.sim.serverTime + (this.view.practice ? .6 : GOAL_RULES.kickoffSeconds);
    this.placeBallAtRest(); this.ball.held = true; this.touchesLog = []; this.endWait = false;
    // FREE PLAY: the ball back on the spot, the person left where they stand.
    if (!this.view.practice) this.placeAll(); this.liveSince = this.sim.serverTime; this.view.replay = null; this.skips.clear(); this.resetRumble();
    if (!this.view.practice) this.emit('kickoff', {x: 0, y: 0, z: 0, value: GOAL_RULES.kickoffSeconds});
  }
  private release() {
    this.view.phase = 'live'; this.ball.held = false; this.ball.vy = 0;
  }
  /** FREE PLAY in Sky Spike: the side nobody sits on, where the ball machine stands. */
  private machine(): BallTeam { return this.count('red') > 0 && this.count('blue') === 0 ? 'blue' : this.count('red') === 0 ? 'red' : 'blue'; }
  private serve() {
    if (this.view.practice) this.view.servingTeam = this.machine();
    const R = SPIKE_RULES, team = this.view.servingTeam, sign = team === 'red' ? -1 : 1;
    const servers = [...this.seats.values()].filter(s => s.team === team);
    const server = servers[this.serveRotation[team] % Math.max(1, servers.length)];
    this.view.serverId = server?.id ?? null;
    if (this.celebration?.id === this.view.serverId) this.celebration = null;
    this.view.phase = 'kickoff'; this.view.phaseUntil = this.sim.serverTime + (this.view.practice ? 1 : R.serveSeconds);
    this.view.touchTeam = team; this.view.touches = 0; this.view.rally = 0; this.view.fever = false; this.feverTold = false;
    // SUDDEN DEATH: every point is a FEVER point, worth two.
    if (this.view.mutator === 'sudden-death') { this.view.fever = true; this.feverTold = true; }
    this.placeBallAtRest(); this.touchesLog = [];
    if (!this.view.practice) this.placeAll();
    this.liveSince = this.sim.serverTime; this.view.replay = null; this.skips.clear();
    // A rally is short: the charms lying on the court and the ones at work carry over to the next serve.
    if (this.charmAt === 0) this.resetRumble(); else this.carryRumble();
    const b = this.ball;
    b.x = 0; b.z = sign * (R.courtHalfZ + 1.4 - R.serveAhead); b.y = R.serveHeight; b.held = true;
    this.emit('serve', {team, actorId: server?.id, x: b.x, y: b.y, z: b.z});
  }

  private play(dt: number) {
    const b = this.ball, now = this.sim.serverTime;
    if (this.mode === 'sky-spike' && this.view.phase === 'kickoff') {
      // The serve hangs until its server strikes it; one who never does serves a soft lob when the clock runs out.
      if (now >= this.view.phaseUntil && b.held) this.autoServe();
      this.bodyContacts(dt);
      return;
    }
    if (b.frozenUntil > now || b.clash > now) return;
    if (this.stack) this.releaseStack();
    // Heat: it cools when nobody heats it; a long rally and an overtime heat it by themselves.
    let floor = 0;
    if (this.mode === 'sky-spike' && this.view.rally >= SPIKE_RULES.rallyHeat) floor = Math.min(3.2, .6 + (this.view.rally - SPIKE_RULES.rallyHeat) * .32);
    if (this.view.overtime) floor = Math.min(BALL_RULES.heatMax - .01, (now - this.overtimeSince) * GOAL_RULES.overtimeHeat);
    floor = Math.max(floor, BALL_ARENAS[this.view.arena ?? arenaFor(this.mode, this.seed)].twist.heatFloor ?? 0);
    if (this.view.mutator === 'heat-rush') floor = Math.max(floor, MUTATOR_RULES.heatFloor);
    if (b.heat > floor) b.heat = Math.max(floor, b.heat - BALL_RULES.heatCool * dt);
    else b.heat = floor;
    if (this.mode === 'goal-rush' && !this.view.overtime && !this.view.practice) {
      this.view.clock = Math.max(0, this.view.clock - dt);
      if (this.view.clock <= 0 && !this.endWait) this.endWait = true;
    }
    const sideBefore = sideOf(b.z);
    stepBall(this.mode, b, dt, this.contacts);
    // Every real bounce off the floor takes some of the heat away: a ball has to be kept in the air, passed and struck
    // to burn.
    for (const c of this.contacts) if (c.kind === 'floor' && c.speed > BALL_RULES.bounceFrom) b.heat = Math.max(floor, b.heat - BALL_RULES.bounceHeat);
    this.bodyContacts(dt);
    if (this.pvp) this.bumps();
    if (this.mode === 'goal-rush') this.judgeGoal(); else this.judgeSpike(sideBefore);
  }
  /** After a goal or a point the ball rests where it ended (a goal's in its net) while everyone celebrates. */
  private coast(dt: number) {
    if (this.mode === 'goal-rush' && this.ball.held) return;
    stepBall(this.mode, this.ball, dt, this.contacts);
  }

  // ─── Bodies against the ball ──────────────────────────────────────────────────────────────────────────────────────
  private bodyContacts(dt: number) {
    const b = this.ball, now = this.sim.serverTime, r = this.radius * b.size;
    for (const seat of this.seats.values()) {
      const a = this.sim.actors.get(seat.id);
      if (!a) continue;
      const p = a.state, prev = this.last.get(seat.id);
      const vx = prev ? (p.x - prev.x) / dt : 0, vy = prev ? (p.y - prev.y) / dt : 0, vz = prev ? (p.z - prev.z) / dt : 0;
      this.last.set(seat.id, {x: p.x, y: p.y, z: p.z, vx: Math.abs(vx) < 40 ? vx : 0, vy: Math.abs(vy) < 40 ? vy : 0, vz: Math.abs(vz) < 40 ? vz : 0});
      if (b.held || !p.alive) continue;
      if (this.mode === 'sky-spike' && this.sentBy(seat)) continue;
      // Sky Spike: a fighter in the air mid-swing lets the ball come to the swing (the spike) rather than to the body.
      if (this.mode === 'sky-spike' && !p.grounded && a.cast && !b.super) continue;
      const size = p.size ?? 1;
      const lo = p.y + BODY_LOW * size, hi = p.y + BODY_HIGH * size, cy = Math.max(lo, Math.min(hi, b.y));
      let nx = b.x - p.x, ny = b.y - cy, nz = b.z - p.z;
      // A guard reaches further than a body (the keeper's dive, the blocker's arms).
      const guardReach = (p.guarding || p.action === 'guard') ? GUARD_REACH + (seat.trait === 'wall' ? TRAIT_RULES.guardReach : 0) : 0;
      const d = Math.hypot(nx, ny, nz), reach = r + PLAYER_RADIUS * size + guardReach;
      if (d >= reach) continue;
      if (d < 1e-5) { nx = Math.sin(p.yaw); ny = 0; nz = Math.cos(p.yaw); } else { nx /= d; ny /= d; nz /= d; }
      b.x = p.x + nx * reach; b.y = Math.max(r, cy + ny * reach); b.z = p.z + nz * reach;
      const fvx = this.last.get(seat.id)!.vx, fvy = this.last.get(seat.id)!.vy, fvz = this.last.get(seat.id)!.vz;
      const speed = Math.hypot(b.vx, b.vy, b.vz), rel = (b.vx - fvx) * nx + (b.vy - fvy) * ny + (b.vz - fvz) * nz;
      const guarding = p.guarding || p.action === 'guard';
      const hostile = b.lastTeam !== null && b.lastTeam !== seat.team;
      // A PERFECT guard against a SUPER SHOT: a TECHNIQUE DUEL.
      if (b.super && hostile && rel < -1 && guarding && now - a.guardPressedAt <= JUST_GUARD_WINDOW) { this.duel(seat, a, speed); return; }
      // A super shot is stopped by nothing but a perfect guard: anyone else in its way is bowled over and it flies on
      // (a guard that is not perfect is broken through), the keeper blasted back with it.
      if (b.super && hostile && rel < -1 && !(guarding && now - a.guardPressedAt <= JUST_GUARD_WINDOW)) {
        if (p.action !== 'knockdown') this.sim.strike(BALL_ID, seat.id, 'heavy', BOWL, {x: b.x, y: b.y, z: b.z});
        const keep = guarding ? .78 : .9;
        b.x = p.x - nx * reach; b.z = p.z - nz * reach;
        b.vx *= keep; b.vy *= keep; b.vz *= keep;
        b.x += b.vx * dt; b.z += b.vz * dt;
        this.emit(guarding ? 'bowled' : 'bowled', {team: b.lastTeam!, actorId: b.lastId ?? undefined, targetId: seat.id, x: p.x, y: p.y + 1, z: p.z, value: Math.round(speed), text: guarding ? 'BREAKS THROUGH' : 'BULLDOZED'});
        continue;
      }
      if (guarding && rel < -1) { this.guardBall(seat, a.guardPressedAt, nx, ny, nz, speed); continue; }
      // Sky Spike: a ball that meets a body on its own side is played - an automatic bump, one of the side's touches
      // (touching the ball hits it), so a rally is lost to a missed read, never to a bad bounce.
      const used = this.view.touchTeam === seat.team ? this.view.touches : 0;
      if (this.mode === 'sky-spike' && rel < -1.5 && sideOf(b.z) === seat.team && used < SPIKE_RULES.touches && (this.bodyTouch.get(seat.id) ?? -Infinity) + .4 <= now) {
        this.bodyTouch.set(seat.id, now);
        this.autoBump(seat, a, speed);
        continue;
      }
      if (rel < 0) {
        const e = this.mode === 'goal-rush' ? GOAL_BODY_BOUNCE : BODY_BOUNCE;
        b.vx -= (1 + e) * rel * nx; b.vy -= (1 + e) * rel * ny; b.vz -= (1 + e) * rel * nz;
      }
      // A body running into the ball drives it on ahead of itself: the dribble.
      const run = fvx * nx + fvz * nz, ahead = b.vx * nx + b.vz * nz;
      if (run > 1 && ahead < run * 1.15 + .6) { const add = run * 1.15 + .6 - ahead; b.vx += nx * add; b.vz += nz * add; }
      // (No faster than its heat lets a strike fly it, unless it came in faster: a body is no boot.)
      if (this.mode === 'goal-rush') {
        const after = Math.hypot(b.vx, b.vy, b.vz), cap = Math.max(speed, speedCap(this.mode, b.heat));
        if (after > cap) { const k = cap / after; b.vx *= k; b.vy *= k; b.vz *= k; }
      }
      // An OVERDRIVE ball at speed staggers whoever it meets on the other side (never knocks them down: that is a
      // SUPER SHOT's alone).
      if (hostile && speed >= BALL_RULES.bowlSpeed && heatTier(b.heat) >= BALL_RULES.bowlTier && p.action !== 'knockdown' && now - (this.staggeredAt.get(seat.id) ?? -Infinity) >= BALL_RULES.staggerGap) {
        this.staggeredAt.set(seat.id, now);
        this.sim.strike(BALL_ID, seat.id, 'light', STAGGER, {x: b.x, y: b.y, z: b.z});
        b.vx *= .62; b.vy *= .62; b.vz *= .62;
        this.emit('bowled', {team: b.lastTeam!, actorId: b.lastId ?? undefined, targetId: seat.id, x: p.x, y: p.y + 1, z: p.z, value: Math.round(speed), text: 'STAGGERED'});
      }
      if ((this.bodyTouch.get(seat.id) ?? -Infinity) + .35 <= now && Math.abs(rel) > 1.5) {
        this.bodyTouch.set(seat.id, now);
        this.touched(seat, null, 'header');
      }
    }
  }
  /** Goal Rush's BUMP (GOAL_FIGHT.bump): a boosting body closing hard on one of the other side knocks them flat - a
   *  blow of the bumper's, through the kernel's own rules (a guard takes it; one out of health is wiped out). */
  private bumps() {
    const B = GOAL_FIGHT.bump, now = this.sim.serverTime;
    for (const seat of this.seats.values()) {
      const a = this.sim.actors.get(seat.id), v = this.last.get(seat.id);
      if (!a?.boosting || !a.state.alive || seat.out !== undefined || !v || Math.hypot(v.vx, v.vz) < B.speed || now - (this.bumpAt.get(seat.id) ?? -Infinity) < B.gap) continue;
      const p = a.state;
      for (const other of this.seats.values()) {
        const q = other.team !== seat.team && other.out === undefined ? this.sim.actors.get(other.id)?.state : undefined;
        if (!q?.alive || Math.abs(q.y - p.y) > 1.2) continue;
        const dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz);
        if (d < 1e-3 || d > PLAYER_RADIUS * ((p.size ?? 1) + (q.size ?? 1)) + B.reach) continue;
        const w = this.last.get(other.id), closing = ((v.vx - (w?.vx ?? 0)) * dx + (v.vz - (w?.vz ?? 0)) * dz) / d;
        if (closing < B.closing) continue;
        this.bumpAt.set(seat.id, now);
        this.sim.strike(seat.id, other.id, 'heavy', BUMP, {x: p.x, y: p.y + 1, z: p.z});
        this.emit('demo', {team: seat.team, actorId: seat.id, targetId: other.id, x: q.x, y: q.y + 1, z: q.z, value: Math.round(Math.hypot(v.vx, v.vz)), text: 'BUMP'});
        break;
      }
    }
  }
  /** A guard meets the ball: a block (Sky Spike at the net: back down into their court), a save, and, timed within the
   *  just-guard window, a perfect one - the ball's heat gone and the keeper's meter up. */
  private guardBall(seat: BallSeat, pressedAt: number, nx: number, ny: number, nz: number, speed: number) {
    const b = this.ball, now = this.sim.serverTime, perfect = now - pressedAt <= JUST_GUARD_WINDOW;
    const wasOnTarget = this.mode === 'goal-rush' && this.headingInto(seat.team);
    if (this.mode === 'sky-spike' && Math.abs(b.z) < 2.6 && b.y > SPIKE_RULES.netHeight - .6) {
      const away = seat.team === 'red' ? 1 : -1;
      // A perfect one is a STUFF BLOCK, driven down into the hitter's court. Any other comes off the hands soft and up,
      // back over the net to the hitters' side: the rally goes on (a block is no touch).
      if (perfect) { b.vz = away * Math.max(7, Math.abs(b.vz) * .95); b.vy = -Math.max(3, Math.abs(b.vy) * .5) - 5; b.vx *= .5; }
      else { b.vz = away * (2.5 + this.rng() * 2.5); b.vy = 6 + this.rng() * 2.5; b.vx *= .35; }
      b.heat = Math.max(0, b.heat - BALL_RULES.guardHeat * (perfect ? .5 : 1));
      seat.blocks++; seat.points += perfect ? 60 : 35;
      if (seat.blocks === 3) this.accolade(seat, 'THE WALL');
      this.emit(perfect ? 'perfect' : 'block', {team: seat.team, actorId: seat.id, x: b.x, y: b.y, z: b.z, shot: 'block', text: perfect ? 'STUFF BLOCK' : 'BLOCK'});
      this.touched(seat, null, 'block', true);
      if (perfect) this.sim.addMeter(seat.id, 14, 8);
      return;
    }
    const rel = b.vx * nx + b.vy * ny + b.vz * nz;
    if (perfect) {
      // The keeper's perfect save: the ball dead, then sent up the way they look.
      const a = this.sim.actors.get(seat.id)!, yaw = a.input.yaw;
      b.vx = Math.sin(yaw) * 11; b.vz = Math.cos(yaw) * 11; b.vy = 8; b.heat = 0; b.super = false; b.sx = b.sy = b.sz = 0;
      this.sim.addMeter(seat.id, 16, 10);
    } else {
      b.vx -= 1.45 * rel * nx; b.vy -= 1.45 * rel * ny; b.vz -= 1.45 * rel * nz;
      b.heat = Math.max(0, b.heat - BALL_RULES.guardHeat);
      if (b.super) { b.super = false; }
    }
    // A save straight off a dash is a dive (the keeper's lunge across the line).
    const dived = now - (this.dashAt.get(seat.id) ?? -Infinity) < .6;
    if (wasOnTarget) { seat.saves++; seat.points += perfect ? 75 : dived ? 60 : 50; this.emit('save', {team: seat.team, actorId: seat.id, x: b.x, y: b.y, z: b.z, value: Math.round(speed), text: perfect ? 'PERFECT SAVE' : dived ? 'DIVING SAVE' : 'SAVE', shot: 'save'}); this.saved(seat, speed); }
    else if (perfect) this.emit('perfect', {team: seat.team, actorId: seat.id, x: b.x, y: b.y, z: b.z, text: 'PERFECT GUARD', shot: 'save'});
    this.touched(seat, null, 'save', true);
  }

  // ─── The kernel's external body: the ball ─────────────────────────────────────────────────────────────────────────
  private strikable() {
    const p = this.view.phase;
    return p === 'live' || (p === 'kickoff' && this.mode === 'sky-spike');
  }
  private refreshBody() {
    const b = this.ball, body = this.body;
    body.radius = this.hitR * (1 + (b.size - 1) * .8); body.height = body.radius * 2;
    body.x = b.x; body.z = b.z; body.y = b.y - body.height * .55; body.airborne = b.y > this.radius * b.size + .35;
    return body;
  }
  hostile() { return true; }
  locate(id: string): ExternalBody | undefined { return id === BALL_ID && this.strikable() ? this.refreshBody() : undefined; }
  query(a: Vec3, b: Vec3, radius: number, out: ExternalBody[]): number {
    out.length = 0;
    if (!this.strikable()) return 0;
    const ball = this.ball, pad = radius + this.hitR + 4;
    if (ball.x < Math.min(a.x, b.x) - pad || ball.x > Math.max(a.x, b.x) + pad || ball.z < Math.min(a.z, b.z) - pad || ball.z > Math.max(a.z, b.z) + pad) return 0;
    out[0] = this.refreshBody(); out.length = 1;
    return 1;
  }
  receive(_body: ExternalBody, blow: ExternalBlow): {damage: number; reaction?: 'flinch'; killed: boolean} | null {
    const seat = this.seats.get(blow.attackerId), a = this.sim.actors.get(blow.attackerId), b = this.ball, now = this.sim.serverTime;
    if (!seat || !a || !this.strikable() || b.clash > now) return null;
    const castId = a.cast?.id ?? -1, prior = this.strikes.get(seat.id);
    if (prior && prior.cast === castId && now - prior.at < BALL_RULES.restrike) return null;
    if (this.mode === 'sky-spike') {
      // Nobody plays the ball on the far side of the net; a serve is its server's alone; and a ball a side has sent
      // over (its last touch spent, on its way to the net) goes by that side's own swings.
      if (sideOf(b.z) !== seat.team && Math.abs(b.z) > .9) return null;
      if (this.sentBy(seat) && this.touchCast.get(seat.id) !== castId) return null;
      if (b.held && (this.view.phase !== 'kickoff' || seat.id !== this.view.serverId)) return null;
    }
    this.strikes.set(seat.id, {cast: castId, at: now});
    // The ball leaving a striker's foot brushes their own body: not a touch of its own.
    this.bodyTouch.set(seat.id, now);
    const p = a.state, yaw = a.attackYaw ?? a.input.yaw, mx = a.input.moveX, mz = a.input.moveZ;
    const serve = this.mode === 'sky-spike' && b.held;
    const again = b.lastId === seat.id && (this.touchCast.get(seat.id) === castId || now - (this.touchedAt.get(seat.id) ?? -Infinity) < .3);
    this.touchedAt.set(seat.id, now);
    const touches = this.mode === 'sky-spike' ? (serve ? SPIKE_RULES.touches : (this.view.touchTeam === seat.team ? this.view.touches : 0) + (again ? 0 : 1)) : 0;
    this.touchCast.set(seat.id, castId);
    const mates = this.mode === 'goal-rush' ? [...this.seats.values()].filter(s => s.team === seat.team && s.id !== seat.id).map(s => {
      const m = this.sim.actors.get(s.id)!.state, v = this.last.get(s.id);
      return {x: m.x, z: m.z, vx: v?.vx ?? 0, vz: v?.vz ?? 0};
    }) : undefined;
    const rivals = this.mode === 'sky-spike' ? [...this.seats.values()].filter(s => s.team !== seat.team).map(s => this.sim.actors.get(s.id)!.state) : undefined;
    const moving = this.last.get(seat.id);
    const result = strikeBall(b, {mode: this.mode, slot: blow.slot, move: blow.move, knockback: blow.knockback, launch: blow.launch, finisher: blow.finisher,
      pushX: blow.pushX, pushZ: blow.pushZ, mates, touches, serve, rivals, gravity: baseGravity(this.view.mutator), run: {vx: moving?.vx ?? 0, vz: moving?.vz ?? 0},
      striker: {id: seat.id, team: seat.team, x: p.x, y: p.y, z: p.z, grounded: p.grounded, aimYaw: yaw, awakened: !!p.awakened,
        forward: mx * Math.sin(yaw) + mz * Math.cos(yaw), lateral: -mx * Math.cos(yaw) + mz * Math.sin(yaw), chain: p.chain ?? 0}});
    // A pass completed (the side's last strike a team-mate's, a moment ago) heats the ball: passing is how it burns.
    if (!again && !serve && this.passed(seat, now)) result.heat += this.mode === 'goal-rush' ? GOAL_RULES.passHeat : SPIKE_RULES.passHeat;
    // The fighter's ball trait (traits.ts): a few percent on the shots their kit is made for.
    withTrait(seat.trait, this.mode, b.heat, result);
    // RUMBLE's KI CHARGE: the strike flies at the ball's top speed, burning at OVERDRIVE (a Sky Spike lob keeps its arc).
    const charged = !again && !serve && (this.charge.get(seat.id) ?? 0) > now && result.shot !== 'bump' && result.shot !== 'set' && result.shot !== 'tap';
    if (charged) {
      const v = Math.hypot(result.vx, result.vy, result.vz) || 1, top = speedCap(this.mode, BALL_RULES.heatMax) / v;
      const k = this.mode === 'goal-rush' ? Math.max(1, top) : result.vy <= 1 ? Math.min(1.5, Math.max(1, top)) : 1;
      result.vx *= k; result.vy *= k; result.vz *= k; result.heat = BALL_RULES.heatMax;
      this.endEffect('charge', seat.team, seat.id);
    }
    // A CLASH: the other side struck it a breath ago, and this blow meets theirs.
    const real = !again && !serve && result.shot !== 'tap' && result.shot !== 'bump' && result.shot !== 'set';
    const power = Math.hypot(result.vx, result.vy, result.vz) * (blow.slot === 'ultimate' ? 1.6 : blow.slot === 'special' || blow.slot === 'area' ? 1.15 : 1) + (p.awakened ? 4 : 0);
    const rival = this.lastStrike;
    const clashed = real && !!rival && rival.team !== seat.team && now - rival.at <= CLASH.window && now - this.clashAt >= CLASH.gap && b.frozenUntil <= now && !this.stack && this.view.phase === 'live';
    if (real) this.lastStrike = clashed ? null : {id: seat.id, team: seat.team, at: now, power, vx: result.vx, vy: result.vy, vz: result.vz, shot: result.shot, super: result.super};
    if (clashed) {
      this.clash(seat, power, result, rival!);
      const [ult, awaken] = TOUCH_METER[blow.slot] ?? [3, 2];
      this.sim.addMeter(seat.id, ult, awaken);
      return {damage: 1, reaction: 'flinch', killed: false};
    }
    // SKY SPIKE: a spike struck high over the net, the mode's own move, burns hotter and is named.
    const skySpike = this.mode === 'sky-spike' && !again && result.shot === 'spike' && b.y > (seat.trait === 'aerialist' ? TRAIT_RULES.skySpike : 3.6) && Math.abs(b.z) < 3.6;
    if (skySpike) result.heat += SPIKE_RULES.skySpikeHeat;
    // The flair shots: Goal Rush's BICYCLE KICK (in the air, running away from
    // the goal it sends the ball at) and AERIAL (struck four metres up); Sky Spike's ROLL SPIKE (takraw's: spiked with the
    // back to the net, going away from it).
    const run = this.last.get(seat.id), air = !p.grounded && !again && !serve;
    let flair: string | undefined;
    if (air && this.mode === 'goal-rush') {
      const gz = goalZ(otherTeam(seat.team)), toward = Math.sign(gz), away = run ? -(run.vz * toward) : 0;
      if (away > 2.6 && b.y > 1.6 && Math.sign(result.vz) === toward) flair = 'BICYCLE KICK';
      else if (b.y > 4) flair = 'AERIAL';
    } else if (air && result.shot === 'spike') {
      const towardNet = seat.team === 'red' ? 1 : -1;
      if (run && run.vz * towardNet < -1.2) flair = 'ROLL SPIKE';
    }
    if (flair) { result.heat += .3; this.flair = {id: seat.id, at: now, text: flair}; }
    // A LINK SHOT: a team-mate's set finished first time.
    const linked = !again && !serve && LINK.finishes.has(result.shot) ? this.linkFrom(seat, now) : undefined;
    if (linked) result.heat += LINK.heat;
    if (b.frozenUntil > now) {
      // In stopped time the blows pile up and land together when it starts again.
      const s = this.stack ?? {vx: 0, vy: 0, vz: 0, heat: 0, count: 0, id: seat.id, team: seat.team, shot: result.shot};
      s.vx += result.vx; s.vy += result.vy; s.vz += result.vz; s.heat += result.heat; s.count++; s.id = seat.id; s.team = seat.team; s.shot = result.shot;
      this.stack = s;
    } else {
      const incoming = Math.hypot(b.vx, b.vy, b.vz);
      b.vx = result.vx; b.vy = result.vy; b.vz = result.vz; b.sx = result.sx; b.sy = result.sy; b.sz = result.sz;
      b.heat = Math.min(BALL_RULES.heatMax, b.heat + result.heat); b.super = result.super; b.shot = result.shot;
      if (serve) { b.held = false; this.view.phase = 'live'; seat.points += 5; }
      if (result.shot === 'bump' && incoming > 17) { b.shot = 'dig'; seat.digs++; seat.points += 15; }
    }
    const [ult, awaken] = TOUCH_METER[blow.slot] ?? [3, 2];
    this.sim.addMeter(seat.id, ult, awaken);
    if (result.super && !again) this.emit('super', {team: seat.team, actorId: seat.id, x: b.x, y: b.y, z: b.z, shot: 'super', text: blow.move.name});
    else if (!again && result.shot !== 'tap' && result.shot !== 'bump' && result.shot !== 'set') this.emit('strike', {team: seat.team, actorId: seat.id, assistId: linked?.id, x: b.x, y: b.y, z: b.z, shot: b.shot ?? result.shot, value: Math.round(Math.hypot(b.vx, b.vy, b.vz)), text: linked ? 'LINK SHOT' : charged ? 'KI CHARGE' : flair ?? (skySpike ? 'SKY SPIKE' : undefined)});
    if (!seat.bot && !this.brains.has(seat.id)) this.view.best = Math.max(this.view.best, Math.hypot(b.vx, b.vy, b.vz));
    // A move's later contacts drive the ball on; the touch was its first.
    if (again) { b.lastId = seat.id; b.lastTeam = seat.team; }
    else this.touched(seat, result.shot, b.shot ?? result.shot, false, serve);
    if (linked) {
      b.link = linked.id; seat.points += LINK.points; linked.points += LINK.setter;
      this.accolade(seat, 'LINK SHOT', 25, linked.id);
    }
    return {damage: 1, reaction: 'flinch', killed: false};
  }
  /** The team-mate whose set this strike finishes first time (a LINK SHOT), if it does: the last strike on the ball was
   *  theirs, a set (LINK.sets), inside the mode's window, with nobody of the other side touching it since. */
  private linkFrom(seat: BallSeat, now: number): BallSeat | undefined {
    for (let i = this.touchesLog.length - 1; i >= 0; i--) {
      const t = this.touchesLog[i];
      if (t.team !== seat.team) return undefined;
      if (!t.strike) continue;
      if (t.id === seat.id || !t.shot || !LINK.sets.has(t.shot) || now - t.at > LINK.window[this.mode]) return undefined;
      return this.seats.get(t.id);
    }
    return undefined;
  }
  /** A PERFECT guard meets a SUPER SHOT: the ball hangs between them for the beat, the keeper frozen in the guard, and
   *  then either the shot dies (the keeper's side's ball, cold, popped up in front of them) or it breaks through and the
   *  keeper goes down (releaseStack ends it). */
  private duel(seat: BallSeat, a: NonNullable<ReturnType<typeof this.sim.actors.get>>, speed: number) {
    const b = this.ball, now = this.sim.serverTime, striker = b.lastId ? this.seats.get(b.lastId) : undefined;
    const shooter = striker && this.sim.actors.get(striker.id)?.state;
    const onTarget = this.mode === 'goal-rush' && this.headingInto(seat.team);
    const keeperWins = this.rng() < DUEL.keeper + (a.state.awakened ? DUEL.awakened : 0) - (shooter?.awakened ? DUEL.awakened : 0);
    const v = {vx: b.vx, vy: b.vy, vz: b.vz};
    b.clash = now + DUEL.hold; this.clashAt = now; this.lastStrike = null;
    b.vx = b.vy = b.vz = 0; b.sx = b.sy = b.sz = 0;
    if (now >= a.hitstopUntil) a.hitstopFrom = now;
    a.hitstopUntil = Math.max(a.hitstopUntil, now + DUEL.hold);
    if (keeperWins) {
      // Popped up in front of the keeper (Sky Spike: back into their own court), cold: their side's ball to play.
      const yaw = a.input.yaw, home = seat.team === 'red' ? -1 : 1;
      const dx = this.mode === 'sky-spike' ? 0 : Math.sin(yaw) * 3.5, dz = this.mode === 'sky-spike' ? home * 2.5 : Math.cos(yaw) * 3.5;
      this.stack = {vx: dx, vy: 7, vz: dz, heat: 0, count: 1, id: seat.id, team: seat.team, shot: 'save', super: false};
      b.heat = 0; seat.points += DUEL.points; this.sim.addMeter(seat.id, 16, 10);
      if (onTarget) { seat.saves++; this.saved(seat, speed); } else if (this.mode === 'sky-spike') seat.blocks++;
      this.touched(seat, null, 'save', true);
      if (this.mode === 'sky-spike') { this.view.touchTeam = seat.team; this.view.touches = 0; }
    } else {
      this.stack = {vx: v.vx, vy: v.vy, vz: v.vz, heat: 0, count: 1, id: b.lastId ?? seat.id, team: b.lastTeam ?? otherTeam(seat.team), shot: 'super', super: true};
      if (striker) striker.points += DUEL.points / 2;
    }
    this.duelling = {keeper: seat.id, striker: striker?.id, keeperWins, x: b.x, y: b.y, z: b.z};
    this.emit('duel', {team: seat.team, actorId: seat.id, targetId: striker?.id, x: b.x, y: b.y, z: b.z, value: DUEL.hold, text: 'TECHNIQUE DUEL'});
  }
  /** Two sides' blows on the ball at once: it hangs in the clash, both fighters freeze, and the stronger blow (with a
   *  little luck either way) sends it on harder and hotter when the clash breaks (releaseStack). */
  private clash(seat: BallSeat, power: number, result: ReturnType<typeof strikeBall>, rival: NonNullable<BallMatch['lastStrike']>) {
    const b = this.ball, now = this.sim.serverTime;
    const mine = power * (.85 + this.rng() * .3) >= rival.power * (.85 + this.rng() * .3);
    const win = mine ? {id: seat.id, team: seat.team, vx: result.vx, vy: result.vy, vz: result.vz, shot: result.shot, super: result.super} : rival;
    const loser = mine ? rival.id : seat.id, k = CLASH.boost;
    this.stack = {vx: win.vx * k, vy: win.vy * k, vz: win.vz * k, heat: CLASH.heat + result.heat, count: 1, id: win.id, team: win.team, shot: win.shot};
    b.clash = now + CLASH.hold; this.clashAt = now; b.vx = b.vy = b.vz = 0; b.sx = b.sy = b.sz = 0; b.super = win.super;
    for (const id of [seat.id, rival.id]) { const a = this.sim.actors.get(id); if (a) { if (now >= a.hitstopUntil) a.hitstopFrom = now; a.hitstopUntil = Math.max(a.hitstopUntil, now + CLASH.freeze); } }
    const winner = this.seats.get(win.id)!;
    this.touched(seat, result.shot, result.shot);
    b.lastId = winner.id; b.lastTeam = winner.team; b.shot = win.shot;
    if (this.mode === 'sky-spike') { this.view.touchTeam = winner.team; this.view.touches = SPIKE_RULES.touches; }
    winner.points += 30; winner.clashes = (winner.clashes ?? 0) + 1;
    if (winner.clashes === 3) this.accolade(winner, 'CLASH KING');
    const speed = Math.min(speedCap(this.mode, BALL_RULES.heatMax), Math.hypot(win.vx, win.vy, win.vz) * k);
    this.emit('clash', {team: winner.team, actorId: winner.id, targetId: loser, x: b.x, y: b.y, z: b.z, value: Math.round(speed), shot: win.shot});
  }
  /** Sky Spike's body contact: a light keep (bump or set) struck for the body the ball met. */
  private autoBump(seat: BallSeat, a: NonNullable<ReturnType<typeof this.sim.actors.get>>, incoming: number) {
    const b = this.ball, p = a.state, touches = (this.view.touchTeam === seat.team ? this.view.touches : 0) + 1;
    // A body can't aim: the third touch, which has to go over, is a free ball into the middle of the far court.
    const far = seat.team === 'red' ? 6 : -6, aimYaw = touches >= SPIKE_RULES.touches ? Math.atan2(-b.x * .5, far - b.z) : a.input.yaw;
    // Up in the air at the net on the last touch, the body spikes it (touching the ball hits it).
    const spike = !p.grounded && touches >= SPIKE_RULES.touches && b.y > SPIKE_RULES.netHeight && Math.abs(b.z) < 3.6;
    const result = strikeBall(b, {mode: this.mode, slot: spike ? 'heavy' : 'light', move: BOWL, knockback: 1, launch: false, finisher: false, pushX: 0, pushZ: 0, touches, gravity: baseGravity(this.view.mutator),
      striker: {id: seat.id, team: seat.team, x: p.x, y: p.y, z: p.z, grounded: p.grounded, aimYaw, awakened: false, forward: 0, lateral: 0, chain: 0}});
    withTrait(seat.trait, this.mode, b.heat, result);
    b.vx = result.vx; b.vy = result.vy; b.vz = result.vz; b.sx = b.sy = b.sz = 0; b.shot = result.shot;
    b.heat = Math.min(BALL_RULES.heatMax, b.heat + result.heat * .5);
    if (result.shot === 'bump' && incoming > 17) { b.shot = 'dig'; seat.digs++; seat.points += 15; }
    this.sim.addMeter(seat.id, 2, 2);
    this.touched(seat, result.shot, b.shot ?? result.shot);
  }
  freeze(centre: Vec3, radius: number, seconds: number) {
    const b = this.ball;
    if (!this.strikable() || Math.hypot(b.x - centre.x, b.y - centre.y, b.z - centre.z) > radius + this.radius * b.size) return;
    b.frozenUntil = Math.max(b.frozenUntil, this.sim.serverTime + Math.min(6, seconds));
  }
  private releaseStack() {
    const s = this.stack!, b = this.ball;
    this.stack = null;
    const cap = speedCap(this.mode, BALL_RULES.heatMax), speed = Math.hypot(s.vx, s.vy, s.vz), k = speed > cap ? cap / speed : 1;
    b.vx = s.vx * k; b.vy = s.vy * k; b.vz = s.vz * k; b.heat = Math.min(BALL_RULES.heatMax, b.heat + s.heat); b.shot = s.shot;
    if (s.super !== undefined) b.super = s.super;
    const d = this.duelling;
    if (d) {
      // The duel's end: the shot dies, or the keeper goes down under it and it flies on.
      this.duelling = null;
      const keeper = this.seats.get(d.keeper), striker = d.striker ? this.seats.get(d.striker) : undefined;
      if (!d.keeperWins && keeper) { const p = this.sim.actors.get(keeper.id)?.state; if (p && p.action !== 'knockdown') this.sim.strike(BALL_ID, keeper.id, 'heavy', BOWL, {x: b.x, y: b.y, z: b.z}); }
      if (d.keeperWins && keeper) this.accolade(keeper, 'TECHNIQUE DUEL', 30);
      const winner = d.keeperWins ? keeper : striker, loser = d.keeperWins ? striker : keeper;
      this.emit('duel-won', {team: winner?.team ?? keeper?.team, actorId: winner?.id, targetId: loser?.id, x: d.x, y: d.y, z: d.z, value: Math.round(speed * k), text: d.keeperWins ? 'SHOT STOPPED' : 'BREAKS THROUGH'});
      if (d.keeperWins && keeper) this.chatter(keeper.team, CHAT.saved, keeper.id, .7);
    }
    if (s.count > 1) this.emit('strike', {team: s.team, actorId: s.id, x: b.x, y: b.y, z: b.z, shot: s.shot, value: Math.round(speed * k), text: `${s.count} BLOWS AT ONCE`});
  }

  /** A touch of the ball by `seat`: whose ball it is now, the touch count, the shot bookkeeping. */
  private touched(seat: BallSeat, shot: ShotKind | null, named: ShotKind, block = false, serve = false) {
    const b = this.ball, now = this.sim.serverTime;
    const wasOnTarget = this.mode === 'goal-rush' && b.lastTeam !== null && b.lastTeam !== seat.team && this.headingInto(seat.team);
    b.lastId = seat.id; b.lastTeam = seat.team; b.link = null;
    seat.touches++; seat.points += 2;
    this.touchesLog.push({id: seat.id, team: seat.team, at: now, x: b.x, y: b.y, z: b.z, strike: shot !== null, shot: shot ?? undefined});
    if (this.touchesLog.length > 12) this.touchesLog.shift();
    if (this.mode === 'goal-rush') {
      if (wasOnTarget && shot !== null && named !== 'save') { seat.saves++; seat.points += 50; this.emit('save', {team: seat.team, actorId: seat.id, x: b.x, y: b.y, z: b.z, text: 'SAVE', shot: 'save'}); this.saved(seat); }
      if (shot !== null && this.headingInto(otherTeam(seat.team), 2.6)) { seat.shots++; seat.points += 20; this.onTargetSince = now; }
      return;
    }
    if (serve) { this.view.touchTeam = seat.team; this.view.touches = SPIKE_RULES.touches; return; }
    // A block, and a ball that only bounced off somebody, take none of a side's three touches (it still says whose
    // ball it was last, for the line call).
    if (block || shot === null) { if (this.view.touchTeam !== seat.team && sideOf(b.z) === seat.team) { this.view.touchTeam = seat.team; this.view.touches = 0; } return; }
    if (this.view.touchTeam !== seat.team) { this.view.touchTeam = seat.team; this.view.touches = 0; }
    this.view.touches++;
    if (this.view.touches > SPIKE_RULES.touches) this.point(otherTeam(seat.team), 'touches', seat.id);
  }
  /** Whether the last strike on the ball before this one was a team-mate's, inside BALL_RULES.passWithin: a pass. */
  private passed(seat: BallSeat, now: number) {
    for (let i = this.touchesLog.length - 1; i >= 0; i--) {
      const t = this.touchesLog[i];
      if (!t.strike) continue;
      return t.team === seat.team && t.id !== seat.id && now - t.at <= BALL_RULES.passWithin;
    }
    return false;
  }
  /** Sky Spike: the seat's side has spent its last touch and the ball is on its way over the net. */
  private sentBy(seat: BallSeat) {
    const b = this.ball;
    if (this.view.touchTeam !== seat.team || this.view.touches < SPIKE_RULES.touches || b.held) return false;
    return Math.sign(b.vz) === (seat.team === 'red' ? 1 : -1) && sideOf(b.z) === seat.team;
  }
  /** Whether the ball is on its way into `team`'s goal inside `within` seconds (a shot on target, a save to be made). */
  private headingInto(team: BallTeam, within = 1.8) {
    const b = this.ball, R = GOAL_RULES, gz = goalZ(team);
    if (Math.sign(b.vz) !== Math.sign(gz) || Math.abs(b.vz) < 2) return false;
    const t = (gz - b.z) / b.vz;
    if (t < 0 || t > within) return false;
    const x = b.x + b.vx * t, y = b.y + b.vy * t - .5 * R.gravity * (b.grav || 1) * t * t;
    return Math.abs(x) < R.goalHalfWidth + .4 && y < R.goalHeight + .5;
  }

  // ─── Goal Rush ────────────────────────────────────────────────────────────────────────────────────────────────────
  private judgeGoal() {
    const b = this.ball;
    for (const c of this.contacts) {
      if (c.kind === 'post' || c.kind === 'bar') this.emit('post', {team: b.lastTeam ?? undefined, actorId: b.lastId ?? undefined, x: c.x, y: c.y, z: c.z, value: Math.round(c.speed), text: c.kind === 'bar' ? 'CROSSBAR!' : 'OFF THE POST!'});
      if (c.kind === 'goal') { this.targetHit(c.x, c.y, c.z); this.goal(c.team!, c); return; }
      if (c.kind === 'shield') this.shielded(c.team!, c.x, c.y, c.z, 'IRON WALL');
      if (c.kind === 'floor' && this.endWait) { this.timeUp(); return; }
    }
    // The clock at nought ends the match the moment the ball next comes down.
    if (this.endWait && b.y <= this.radius * b.size + .05) this.timeUp();
  }
  private goal(conceded: BallTeam, c: BallContact) {
    const b = this.ball, scorers = otherTeam(conceded), now = this.sim.serverTime;
    const worth = b.super ? GOAL_RULES.superGoal : 1;
    this.view.score[scorers] += worth;
    if (this.view.overtime && this.view.mutator === 'sudden-death') this.decider = scorers;
    // The goal is the last striker's of the scoring side when the ball only bounced in off a defender after it (a
    // deflection); a defender's own blow into their own net is an own goal.
    const lastTouch = this.touchesLog[this.touchesLog.length - 1];
    const shooter = [...this.touchesLog].reverse().find(t => t.team === scorers && t.strike && now - t.at < 4);
    const deflected = !!lastTouch && lastTouch.team === conceded && !lastTouch.strike && !!shooter;
    const scorerId = deflected ? shooter!.id : b.lastId;
    const scorer = scorerId ? this.seats.get(scorerId) : undefined, own = !!scorer && scorer.team !== scorers;
    const assist = [...this.touchesLog].reverse().find(t => t.team === scorers && t.id !== scorerId && t.strike && now - t.at < 7);
    if (scorer && !own) { scorer.goals++; scorer.points += 100 * worth; this.sim.addMeter(scorer.id, 10, 10); }
    const helper = assist && !own ? this.seats.get(assist.id) : undefined;
    if (helper) { helper.assists++; helper.points += 50; }
    for (const s of this.seats.values()) if (s.team === conceded) this.sim.addMeter(s.id, 12, 10);
    const speed = Math.round(c.speed * 3.6);
    // The feats in it, and what the bots make of it.
    if (scorer && !own) {
      const struck = deflected ? shooter : [...this.touchesLog].reverse().find(t => t.id === scorer.id && t.strike);
      if (scorer.goals === 3) this.accolade(scorer, 'HAT TRICK', 50);
      if (struck && struck.y >= 2.4) this.accolade(scorer, 'AERIAL GOAL');
      else if (struck && Math.sign(struck.z) === Math.sign(goalZ(scorers)) && Math.abs(struck.z) > 3) this.accolade(scorer, 'LONG GOAL');
      if (this.endWait || (!this.view.overtime && this.view.clock <= 1)) this.accolade(scorer, 'BUZZER BEATER', 40);
      if (this.flair?.id === scorer.id && now - this.flair.at < 3 && this.flair.text === 'BICYCLE KICK') this.accolade(scorer, 'BICYCLE GOAL', 40);
      this.celebrate(scorer.id, GOAL_RULES.goalSeconds + 8);
    }
    if (helper && helper.assists === 3) this.accolade(helper, 'PLAYMAKER', 40);
    this.chatter(scorers, own ? CHAT.gifted : helper ? CHAT.assisted : CHAT.scored, scorer?.id);
    this.chatter(conceded, own ? CHAT.ownGoal : CHAT.conceded, own ? undefined : scorer?.id, .45);
    this.emit(own ? 'own-goal' : 'goal', {team: scorers, actorId: scorer?.id, assistId: helper?.id, x: b.x, y: b.y, z: b.z, value: speed, shot: b.shot ?? undefined, text: b.super ? 'SUPER GOAL' : undefined});
    b.held = true; b.vx = b.vy = b.vz = 0;
    this.view.phase = 'scored'; this.view.phaseUntil = now + (this.view.practice ? 1.6 : GOAL_RULES.goalSeconds);
    if (this.view.overtime) this.view.phaseUntil = now + GOAL_RULES.goalSeconds * .8;
    const decisive = deflected ? shooter : [...this.touchesLog].reverse().find(t => t.strike);
    this.replay('goal', decisive?.at, {team: scorers, actorId: scorer?.id, shot: b.shot ?? undefined, speed, text: own ? 'OWN GOAL' : b.super ? 'SUPER GOAL' : undefined, ceremony: !own && !!scorer});
  }
  /** The replay of what just happened, shown after the celebration's first beat; the celebration waits for it. */
  private replay(kind: BallReplay['kind'], key: number | undefined, fields: Pick<BallReplay, 'team' | 'actorId' | 'shot' | 'speed' | 'text' | 'ceremony'>) {
    if (!this.replays) return;
    const now = this.sim.serverTime, decisive = key ?? now - .6;
    const from = Math.max(this.liveSince + .05, Math.min(now - REPLAY.lead, decisive - 1));
    if (now - from < 1) return;
    const r: BallReplay = {kind, from, to: now + REPLAY.tail, key: decisive, at: now + (fields.ceremony ? REPLAY.ceremony : REPLAY.delay), until: 0, ...fields};
    if (!r.ceremony) delete r.ceremony;
    r.until = r.at + replayLength(r);
    this.view.replay = r; this.skips.clear();
    this.view.phaseUntil = Math.max(this.view.phaseUntil, r.until + REPLAY.after);
  }
  private timeUp() {
    const {red, blue} = this.view.score;
    // SUDDEN DEATH: whatever the score, the next goal wins.
    if (this.view.mutator === 'sudden-death') { this.view.overtime = true; this.overtimeSince = this.sim.serverTime; this.endWait = false; this.emit('overtime', {x: 0, y: 0, z: 0, text: 'SUDDEN DEATH · NEXT GOAL WINS'}); this.view.phase = 'scored'; this.view.phaseUntil = this.sim.serverTime + 2.2; this.ball.held = true; return; }
    if (red === blue) { this.view.overtime = true; this.overtimeSince = this.sim.serverTime; this.endWait = false; this.emit('overtime', {x: 0, y: 0, z: 0, text: 'OVERTIME · NEXT GOAL WINS'}); this.view.phase = 'scored'; this.view.phaseUntil = this.sim.serverTime + 2.2; this.ball.held = true; return; }
    this.finish(red > blue ? 'red' : 'blue', 'Full time.');
  }

  // ─── Sky Spike ────────────────────────────────────────────────────────────────────────────────────────────────────
  private judgeSpike(sideBefore: BallTeam) {
    const b = this.ball;
    const sideNow = sideOf(b.z);
    if (sideNow !== sideBefore && b.y > SPIKE_RULES.netHeight * .5) {
      // Over the net: the rally climbs, and the other side's three touches begin.
      this.view.rally++; this.view.touchTeam = sideNow; this.view.touches = 0;
      if (this.view.rally === SPIKE_RULES.rallyHeat) this.emit('rally', {x: b.x, y: b.y, z: b.z, value: this.view.rally, text: 'RALLY HEATS UP'});
      if (this.view.rally >= SPIKE_RULES.fever && !this.feverTold) { this.feverTold = true; this.view.fever = true; this.emit('fever', {x: b.x, y: b.y, z: b.z, value: this.view.rally, text: 'FEVER RALLY · POINTS COUNT DOUBLE'}); this.chatter(sideNow, CHAT.fever, undefined, .6); }
      else if (this.view.rally > SPIKE_RULES.rallyHeat && this.view.rally % 5 === 0) this.emit('rally', {x: b.x, y: b.y, z: b.z, value: this.view.rally});
    }
    for (const c of this.contacts) {
      if (c.kind === 'floor') {
        // RUMBLE's SAFETY NET: the ball springs back up off the court it guards, and that side plays it.
        if (c.team && this.view.effects.some(e => e.kind === 'wall' && e.team === c.team)) {
          this.endEffect('wall', c.team);
          b.vy = Math.max(b.vy, 10); b.vx *= .3; b.vz *= .3; this.view.touchTeam = c.team; this.view.touches = 0;
          this.shielded(c.team, c.x, 0, c.z, 'SAFETY NET');
          return;
        }
        if (c.team) this.targetHit(c.x, 0, c.z);
        if (c.team) this.point(otherTeam(c.team), 'floor', b.lastId ?? undefined);
        else this.point(b.lastTeam ? otherTeam(b.lastTeam) : otherTeam(this.view.servingTeam), 'out', b.lastId ?? undefined);
        return;
      }
      if (c.kind === 'wall' || c.kind === 'ceiling') { this.point(b.lastTeam ? otherTeam(b.lastTeam) : otherTeam(this.view.servingTeam), 'out', b.lastId ?? undefined); return; }
      if (c.kind === 'net' && c.speed > 4) this.emit('net', {team: b.lastTeam ?? undefined, x: c.x, y: c.y, z: c.z});
    }
  }
  private point(winner: BallTeam, why: 'floor' | 'out' | 'touches' | 'serve', byId?: string) {
    if (this.view.phase !== 'live' && this.view.phase !== 'kickoff') return;
    const b = this.ball, now = this.sim.serverTime, worth = this.view.fever ? 2 : 1, R = SPIKE_RULES, target = this.view.target, cap = Math.max(target, R.cap + (target - R.target));
    const won = (s: number, o: number) => s >= cap || (s >= target && s - o >= 2);
    // A match point saved: the other side could have won the match with this point, and lost it.
    const matchPoint = won(this.view.score[otherTeam(winner)] + worth, this.view.score[winner]);
    this.view.score[winner] += worth;
    const by = byId ? this.seats.get(byId) : undefined;
    if (why === 'floor' && by && by.team === winner) {
      const ace = this.view.rally <= 1 && b.shot === 'serve';
      if (ace) { by.aces++; by.points += 90; } else { by.kills++; by.points += b.super ? 140 : 80; }
      this.streak = this.streak.id === by.id ? {id: by.id, count: this.streak.count + 1} : {id: by.id, count: 1};
      if (this.streak.count === 3) this.accolade(by, 'ON FIRE');
      if (ace && by.aces === 3) this.accolade(by, 'ACE MACHINE');
      this.chatter(winner, CHAT.kill, by.id, .35);
      this.celebrate(by.id, R.pointSeconds + R.celebrateSeconds);
      this.chatter(otherTeam(winner), CHAT.lost, undefined, .2);
      this.emit(ace ? 'ace' : 'kill', {team: winner, actorId: by.id, x: b.x, y: 0, z: b.z, value: worth, shot: b.shot ?? undefined, text: b.super ? 'SUPER SHOT' : undefined});
    } else if (why === 'touches') this.emit('touches', {team: winner, actorId: byId, x: b.x, y: b.y, z: b.z, value: worth, text: 'FOUR TOUCHES'});
    else if (why === 'out') this.emit('out', {team: winner, actorId: byId, x: b.x, y: b.y, z: b.z, value: worth, text: 'OUT'});
    else this.emit('point', {team: winner, actorId: byId, x: b.x, y: 0, z: b.z, value: worth});
    for (const s of this.seats.values()) if (s.team !== winner) this.sim.addMeter(s.id, 5, 6);
    const sideOut = winner !== this.view.servingTeam;
    if (sideOut) { this.serveRotation[winner]++; this.view.servingTeam = winner; this.emit('side-out', {team: winner, x: 0, y: 0, z: 0}); }
    b.held = true; b.vx = b.vy = b.vz = 0;
    const {red, blue} = this.view.score;
    // The great points are shown again (only these, so play gets back under way): a FEVER point, a super shot,
    // a match point saved and the one that wins the match. Every other point's celebration plays on into the next serve's
    // walk-up instead of holding the match up.
    const last = won(red, blue) || won(blue, red);
    const highlight = why !== 'touches' && (this.view.fever || b.super || matchPoint || last);
    const decisive = [...this.touchesLog].reverse().find(t => t.strike)?.at;
    const text = last ? 'WINNING POINT' : b.super ? 'SUPER SHOT' : this.view.fever ? 'FEVER POINT' : matchPoint ? 'MATCH POINT SAVED' : undefined;
    // A kill on match point - the winning one, or one that saves it - gets the goal's sequence before its replay.
    const ceremony = why === 'floor' && by?.team === winner && (last || matchPoint) && !this.view.practice;
    if (last) { this.view.phase = 'scored'; this.view.phaseUntil = now + REPLAY.lastPoint; this.pendingWinner = won(red, blue) ? 'red' : 'blue'; if (highlight) this.replay('point', decisive, {team: winner, actorId: by?.team === winner ? by.id : undefined, shot: b.shot ?? undefined, text, ceremony}); return; }
    for (const team of BALL_TEAMS) {
      const s = this.view.score[team], o = this.view.score[otherTeam(team)];
      if ((s + 1 >= target && s + 1 - o >= 2 || s + 1 >= cap) && this.matchPointTold !== s * 100 + o) { this.matchPointTold = s * 100 + o; this.emit('match-point', {team, x: 0, y: 0, z: 0, text: 'MATCH POINT'}); }
    }
    this.view.phase = 'scored'; this.view.phaseUntil = now + (this.view.practice ? 1.2 : R.pointSeconds);
    if (highlight) this.replay('point', decisive, {team: winner, actorId: by?.team === winner ? by.id : undefined, shot: b.shot ?? undefined, text, ceremony});
    if (this.celebration) this.celebration.until = this.view.phaseUntil + R.celebrateSeconds;
  }
  private pendingWinner: BallTeam | null = null;
  /** SUDDEN DEATH: the side whose goal after the minute won the match. */
  private decider: BallTeam | null = null;
  private autoServe() {
    // A drill's ball machine feeds its own balls.
    if (this.drill?.serve(this)) return;
    const b = this.ball, team = this.view.servingTeam, sign = team === 'red' ? -1 : 1, server = this.view.serverId ? this.seats.get(this.view.serverId) : undefined;
    b.held = false; this.view.phase = 'live';
    let target = {x: 0, z: -sign * 6};
    // FREE PLAY's ball machine: a ball over the net to somewhere near the person, a step or two to reach.
    const person = this.view.practice ? [...this.seats.values()].find(s => s.team !== team) : undefined, p = person && this.sim.actors.get(person.id)?.state;
    if (p) target = {x: Math.max(-SPIKE_RULES.courtHalfX + 1, Math.min(SPIKE_RULES.courtHalfX - 1, p.x + (this.rng() - .5) * 5)), z: -sign * Math.max(2.5, Math.min(SPIKE_RULES.courtHalfZ - 1, Math.abs(p.z) + (this.rng() - .5) * 5))};
    // (The machine lobs higher, so a ball dropped short over the net still clears the cord.)
    const t = p ? 2.1 : 1.6, g = SPIKE_RULES.gravity * (b.grav || 1);
    b.vx = (target.x - b.x) / t; b.vz = (target.z - b.z) / t; b.vy = ((SPIKE_RULES.ballRadius - b.y) + .5 * g * t * t) / t; b.shot = 'serve';
    if (server) this.touched(server, 'serve', 'serve', false, true);
    else { this.view.touchTeam = team; this.view.touches = SPIKE_RULES.touches; }
  }

  // ─── After a goal or point; the end ───────────────────────────────────────────────────────────────────────────────
  private afterPoint() {
    if (this.mode === 'goal-rush') {
      const {red, blue} = this.view.score;
      if (this.decider) { this.finish(this.decider, 'Sudden death.'); return; }
      if (this.view.overtime && red !== blue && this.view.mutator !== 'sudden-death') { this.finish(red > blue ? 'red' : 'blue', 'Golden goal.'); return; }
      if (this.view.clock <= 0 && !this.view.overtime && red !== blue) { this.finish(red > blue ? 'red' : 'blue', 'Full time.'); return; }
      this.kickoff();
      return;
    }
    if (this.pendingWinner) { this.finish(this.pendingWinner, `${this.view.score[this.pendingWinner]}-${this.view.score[otherTeam(this.pendingWinner)]}`); return; }
    this.serve();
  }
  private finish(winner: BallTeam | 'draw', reason: string) {
    const v = this.view;
    v.phase = 'over'; v.winner = winner; v.reason = reason; v.endsAt = this.sim.serverTime; this.sim.status = 'finished';
    let mvp: BallSeat | undefined;
    for (const s of this.seats.values()) if (!mvp || s.points + (s.team === winner ? 25 : 0) > mvp.points + (mvp.team === winner ? 25 : 0)) mvp = s;
    v.mvp = mvp?.id ?? null;
    // The podium (ceremony.ts): the winning side's best on the top step, the other two either side; the others back on
    // their marks. FREE PLAY never ends; a draw stands the MVP's side up.
    const side = winner === 'draw' ? mvp?.team : winner;
    const podium = side ? [...this.seats.values()].filter(s => s.team === side).sort((x, y) => y.points - x.points) : [];
    this.sim.winnerId = podium[0]?.id ?? [...this.seats.values()].find(s => s.team === winner)?.id ?? null;
    const stand = side ? podiumOf(this.mode, side) : undefined;
    for (const seat of this.seats.values()) {
      this.sim.clearPlayerInput(seat.id);
      const a = this.sim.actors.get(seat.id)!;
      a.cast = null; delete seat.out;
      if (!a.state.alive) this.sim.revive(seat.id, a.state.maxHp);
      const step = stand ? podium.indexOf(seat) : -1;
      if (stand && step >= 0 && step < stand.spots.length) this.sim.place(seat.id, stand.spots[step], stand.yaw);
      else if (stand) this.sim.place(seat.id, this.mark(seat), this.facing(seat.team));
      a.state.action = seat.team === winner ? 'victory' : 'idle'; a.state.actionStarted = this.sim.serverTime; a.state.actionDuration = 0;
    }
    if (stand) { const b = this.ball; Object.assign(b, {x: stand.ball.x, y: this.radius + .02, z: stand.ball.z, vx: 0, vy: 0, vz: 0, sx: 0, sy: 0, sz: 0, super: false, clash: 0, frozenUntil: 0}); }
    this.ball.held = true;
    if (winner !== 'draw') { this.chatter(winner, CHAT.won, undefined, 1); this.chatter(otherTeam(winner), CHAT.beaten, undefined, .8); }
    this.emit('win', {team: winner === 'draw' ? undefined : winner, actorId: v.mvp ?? undefined, x: 0, y: 0, z: 0, text: reason});
  }

  // ─── Bots' jobs ───────────────────────────────────────────────────────────────────────────────────────────────────
  /** Who chases, who supports and who keeps (Goal Rush), who is front and back row (Sky Spike): re-dealt a few times a
   *  second by where each body is against the ball, so a side never has three bodies on one ball or none in goal. */
  private assignRoles() {
    const b = this.ball;
    for (const team of BALL_TEAMS) {
      // The jobs go to the side's bots (and anyone a bot is playing for): a person plays as they please, and a bot left
      // to support a person who never attacks would leave the side with no attacker at all. With two people beside it,
      // the one bot keeps goal.
      // (A wiped-out bot has no job until it is back.)
      const all = [...this.seats.values()].filter(s => s.team === team), side = all.filter(s => this.brains.has(s.id) && s.out === undefined);
      const people = all.length - side.length;
      for (const s of all) if (!this.brains.has(s.id)) s.role = undefined;
      if (!side.length) continue;
      if (this.mode === 'goal-rush' && people >= 2) { for (const s of side) s.role = 'keeper'; continue; }
      if (this.mode === 'goal-rush') {
        const own = goalZ(team);
        const scored = side.map(s => {
          const p = this.sim.actors.get(s.id)!.state;
          // Behind the ball (between it and their own goal) is where an attacker comes from.
          const behind = Math.sign(own) * (p.z - b.z) > 0 ? 0 : 6;
          // (A bot with its super shot ready is the one sent at the ball, a few metres sooner, so the meter is spent on a
          // shot rather than sat on.)
          const ready = p.ultimate >= 100 ? SUPER_READY : 0;
          return {s, chase: Math.hypot(p.x - b.x, p.z - b.z) + behind - ready, home: Math.hypot(p.x, p.z - own)};
        });
        scored.sort((x, y) => x.chase - y.chase);
        const attacker = scored[0];
        const rest = scored.slice(1).sort((x, y) => x.home - y.home);
        if (attacker) attacker.s.role = 'attack';
        if (rest[0]) rest[0].s.role = rest.length > 1 || side.length < 3 ? 'keeper' : 'support';
        if (rest[1]) rest[1].s.role = 'support';
      } else {
        const sign = team === 'red' ? -1 : 1;
        const byDepth = side.map(s => ({s, z: Math.abs(this.sim.actors.get(s.id)!.state.z)})).sort((x, y) => x.z - y.z);
        // Two front, one back; a person on the side stands in for one front-row player.
        byDepth.forEach((e, i) => { e.s.role = i < Math.max(1, 2 - people) ? 'front' : 'back'; });
        void sign;
      }
    }
  }

  // ─── RUMBLE ───────────────────────────────────────────────────────────────────────────────────────────────────────
  private charmAt = 0; private charmSerial = 0; private charmFlip = 1;
  /** KI CHARGE: whose next strike flies at OVERDRIVE, until when. */
  private readonly charge = new Map<string, number>();
  private resetRumble() { this.view.charms = []; this.view.effects = []; this.charge.clear(); this.charmAt = this.sim.serverTime + RUMBLE.first; }
  /** The fresh ball of a new serve takes on the charms still at work on the ball. */
  private carryRumble() {
    const b = this.ball;
    for (const e of this.view.effects) { if (e.kind === 'feather') b.grav = RUMBLE.featherGravity * baseGravity(this.view.mutator); else if (e.kind === 'giant') b.size = Math.max(RUMBLE.giantSize, baseSize(this.view.mutator)); }
  }
  private rumbleStep(dt: number) {
    const v = this.view, b = this.ball, now = this.sim.serverTime;
    if (v.charms.some(c => c.until <= now)) v.charms = v.charms.filter(c => c.until > now);
    if (now >= this.charmAt) { this.charmAt = now + RUMBLE.every; if (v.charms.length < RUMBLE.most) this.spawnCharm(); }
    for (const seat of this.seats.values()) {
      const p = this.sim.actors.get(seat.id)?.state;
      if (!p?.alive || p.y > 2.5) continue;
      const i = v.charms.findIndex(c => Math.hypot(p.x - c.x, p.z - c.z) < RUMBLE.reach);
      if (i >= 0) this.grab(seat, v.charms.splice(i, 1)[0]);
    }
    if (v.effects.some(e => e.until <= now)) { for (const e of v.effects) if (e.until <= now) this.lapse(e); v.effects = v.effects.filter(e => e.until > now); }
    // SPIRIT HOOK: the ball bends toward its holder while it is near them.
    const hook = v.effects.find(e => e.kind === 'magnet'), holder = hook && this.sim.actors.get(hook.id)?.state;
    if (holder && !b.held && b.frozenUntil <= now && b.clash <= now) {
      const dx = holder.x - b.x, dy = holder.y + 1 - b.y, dz = holder.z - b.z, d = Math.hypot(dx, dy, dz);
      if (d > 1.2 && d < RUMBLE.magnetRange) { const a = RUMBLE.magnetPull * (1 - d / RUMBLE.magnetRange) * dt / d; b.vx += dx * a; b.vy += dy * a * .5; b.vz += dz * a; }
    }
  }
  /** A charm somewhere open on the field: Goal Rush's anywhere, Sky Spike's in each court by turns. */
  private spawnCharm() {
    const v = this.view, b = this.ball, kind = CHARM_KINDS[Math.floor(this.rng() * CHARM_KINDS.length)];
    let x = 0, z = 0;
    for (let tries = 0; tries < 8; tries++) {
      if (this.mode === 'goal-rush') { x = (this.rng() * 2 - 1) * 13; z = (this.rng() * 2 - 1) * 18; }
      else { x = (this.rng() * 2 - 1) * 6; z = -this.charmFlip * (2.5 + this.rng() * 7); }
      if (Math.hypot(x - b.x, z - b.z) > 4 && v.charms.every(c => Math.hypot(x - c.x, z - c.z) > 5)) break;
    }
    this.charmFlip = -this.charmFlip;
    v.charms.push({id: ++this.charmSerial, kind, x, z, until: this.sim.serverTime + RUMBLE.life});
  }
  private grab(seat: BallSeat, charm: BallCharm) {
    const v = this.view, b = this.ball, now = this.sim.serverTime, kind = charm.kind;
    const seconds = this.mode === 'sky-spike' && kind === 'wall' ? RUMBLE.netSeconds : RUMBLE.seconds[kind];
    // One of each kind works at a time: a newer one takes over from it.
    for (const e of v.effects) if (e.kind === kind && !(kind === 'wall' && this.mode === 'sky-spike' && e.team !== seat.team)) { this.lapse(e); e.until = 0; }
    v.effects = v.effects.filter(e => e.until > 0);
    if (seconds > 0) v.effects.push({kind, team: seat.team, id: seat.id, until: now + seconds});
    if (kind === 'charge') this.charge.set(seat.id, now + seconds);
    else if (kind === 'feather') b.grav = RUMBLE.featherGravity * baseGravity(this.view.mutator);
    else if (kind === 'giant') b.size = Math.max(RUMBLE.giantSize, baseSize(this.view.mutator));
    else if (kind === 'ice' && !b.held) b.frozenUntil = Math.max(b.frozenUntil, now + seconds);
    else if (kind === 'wall' && this.mode === 'goal-rush') b.wall = seat.team;
    else if (kind === 'surge') this.sim.addMeter(seat.id, 50, 25);
    seat.points += 10;
    this.emit('charm', {team: seat.team, actorId: seat.id, x: charm.x, y: 1.2, z: charm.z, charm: kind, text: charmName(kind, this.mode)});
  }
  /** A charm's time is up, or it was used: what it changed put back. */
  private lapse(e: BallEffect) {
    const b = this.ball;
    if (e.kind === 'feather') b.grav = baseGravity(this.view.mutator);
    else if (e.kind === 'giant') b.size = baseSize(this.view.mutator);
    else if (e.kind === 'wall' && b.wall === e.team) b.wall = null;
    else if (e.kind === 'charge') this.charge.delete(e.id);
  }
  private endEffect(kind: CharmKind, team: BallTeam, id?: string) {
    const v = this.view, e = v.effects.find(x => x.kind === kind && x.team === team && (id === undefined || x.id === id));
    if (!e) return;
    this.lapse(e); v.effects = v.effects.filter(x => x !== e);
  }
  /** An IRON WALL or a SAFETY NET kept the ball out: a save for whoever grabbed it. */
  private shielded(team: BallTeam, x: number, y: number, z: number, text: string) {
    const holder = this.view.effects.find(e => e.kind === 'wall' && e.team === team)?.id ?? [...this.touchesLog].reverse().find(t => t.team === team)?.id;
    const seat = holder ? this.seats.get(holder) : undefined;
    if (seat) { seat.saves++; seat.points += 30; }
    this.emit('shield', {team, actorId: seat?.id, x, y, z, charm: 'wall', text});
  }

  /** The scorer strikes their victory pose while the celebration is on (the next kickoff or serve puts them back). */
  private celebrate(id: string, seconds: number) {
    const a = this.sim.actors.get(id);
    if (!a || !a.state.alive) return;
    this.sim.clearPlayerInput(id); a.cast = null;
    a.state.action = 'victory'; a.state.actionStarted = this.sim.serverTime; a.state.actionDuration = 0;
    // Held for the celebration (holdCelebration), as the seat's look says: the pose, or a spin, a stand or a swing first.
    this.celebration = {id, kind: celebrationOf(this.seats.get(id)?.look), at: this.sim.serverTime, yaw: a.state.yaw, until: this.sim.serverTime + seconds};
  }
  /** The scorer celebrating, and how (look.ts): the kernel would hand an idle body back to its idle stance on the next
   *  tick, so the pose is put back after every one until the next kickoff or serve - or until the scorer moves. */
  private celebration: {id: string; kind: Celebration; at: number; yaw: number; until: number} | null = null;
  private holdCelebration() {
    const c = this.celebration, a = c && this.sim.actors.get(c.id);
    if (!c || !a || (this.view.phase !== 'scored' && this.sim.serverTime >= c.until) || !a.state.alive || a.cast || (a.state.action !== 'idle' && a.state.action !== 'victory' && a.state.action !== 'guard' && a.state.action !== 'heavy')) { this.celebration = null; return; }
    const p = a.state, t = this.sim.serverTime - c.at, swing = Math.min(CELEBRATE.showboatMost, MOVES[p.fighter]?.heavy.duration ?? .6);
    const pose = (action: typeof p.action, from: number, duration = 0) => { if (p.action !== action || p.actionStarted !== from) { p.action = action; p.actionStarted = from; } p.actionDuration = duration; p.actionTime = duration > 0 ? Math.min(1, (this.sim.serverTime - from) / duration) : 0; };
    if (c.kind === 'stand-tall') { pose('guard', c.at); return; }
    if (c.kind === 'showboat' && t < swing) { pose('heavy', c.at, swing); return; }
    pose('victory', c.kind === 'showboat' ? c.at + swing : c.at);
    if (c.kind === 'spin') { const k = Math.min(1, t / CELEBRATE.spinSeconds), eased = k * k * (3 - 2 * k); p.yaw = c.yaw + eased * CELEBRATE.spinTurns * Math.PI * 2; }
  }
  /** What a seat wears in the ball modes (look.ts), as a room read it off the account or a page off its own. */
  setLook(id: string, look: unknown) { const seat = this.seats.get(id); if (!seat) return false; seat.look = cleanLook(look); this.view.seats = [...this.seats.values()]; return true; }
  /** A feat named on every screen (an accolade), worth a few points toward MVP. */
  private accolade(seat: BallSeat, text: string, points = 25, assistId?: string) { seat.points += points; (seat.feats ??= []).push(text); this.emit('accolade', {team: seat.team, actorId: seat.id, assistId, x: 0, y: 0, z: 0, text}); }
  /** A save's feats: the third (SAVIOR), one off a ball at full tilt (EPIC SAVE); and the saver's side says so. */
  private saved(seat: BallSeat, speed = 0) {
    if (seat.saves === 3) this.accolade(seat, 'SAVIOR', 40);
    if (speed >= 30) this.accolade(seat, 'EPIC SAVE');
    this.chatter(seat.team, CHAT.saved, seat.id, .5);
  }
  /** The bots' lines whose beat has come. */
  private say() { const t = this.sim.serverTime; while (this.chats.length && this.chats[0].at <= t) { const c = this.chats.shift()!; this.emit('chat', {team: c.team, actorId: c.id, x: 0, y: 0, z: 0, text: c.text}); } }
  /** One of `team`'s bots (not `not`) says one of `lines` a beat from now, `chance` of the time. */
  private chatter(team: BallTeam, lines: readonly string[], not?: string, chance = .55) {
    const bots = [...this.seats.values()].filter(s => s.team === team && s.bot && s.id !== not);
    if (!bots.length || this.rng() > chance) return;
    const who = bots[Math.floor(this.rng() * bots.length)], at = this.sim.serverTime + .6 + this.rng() * .9;
    if (this.chats.some(c => c.id === who.id)) return;
    this.chats.push({at, id: who.id, team, text: lines[Math.floor(this.rng() * lines.length)]});
    this.chats.sort((x, y) => x.at - y.at);
  }

  private emit(kind: BallEvent['kind'], fields: Omit<BallEvent, 'id' | 'at' | 'kind'>) {
    this.view.events.push({id: ++this.serial, at: this.sim.serverTime, kind, ...fields});
    if (this.view.events.length > 60) this.view.events.splice(0, this.view.events.length - 60);
  }

  /** Where the ball comes down next (for the pages' landing ring and the bots). */
  landing() { return landing(this.mode, this.ball); }
  courtSide(x: number, z: number) { return courtSide(x, z); }

  snapshot(consume = false): BallSnapshot {
    const base = this.sim.snapshot(), events = this.events.slice();
    // The match's moments ride every snapshot for a few seconds (each page takes each one once, by its id): a page reads
    // its HUD a few times a second, not every snapshot, and must not miss a goal that came and went between two reads.
    const recent = this.sim.serverTime - 3;
    const view: BallView = {...this.view, seats: [...this.seats.values()].map(s => ({...s, feats: s.feats?.slice()})), score: {...this.view.score}, ball: {...this.ball},
      events: this.view.events.filter(e => e.at >= recent).map(e => ({...e})), replay: this.view.replay ? {...this.view.replay} : null, aim: this.view.aim ? {...this.view.aim} : null,
      charms: this.view.charms.map(c => ({...c})), effects: this.view.effects.map(e => ({...e})), drill: this.view.drill ? {...this.view.drill, results: this.view.drill.results.slice()} : undefined};
    if (consume) this.events = [];
    return {...base, roomMode: 'match', events, ball: view};
  }
  dispose() { this.brains.clear(); this.strikes.clear(); this.last.clear(); this.sim.dispose(); }
  /** Seat ids by team, for a room's metadata and a page's plates. */
  side(team: BallTeam): PlayerState[] { return [...this.seats.values()].filter(s => s.team === team).map(s => this.sim.actors.get(s.id)!.state); }
}
