import type {BallArenaId} from './arenas';
import type {FighterId, GameSnapshot, StageId, Vec3} from '../types';
import type {BallReplay} from './replay';
import type {BallMutator} from './mutators';
import type {BallTrait} from './traits';
import type {DrillView} from './drills';
import type {SeatRank} from './ranked';
import type {BallLook} from './look';

/** The two ball modes: Goal Rush, three a side scoring on each other's goal, and Sky Spike, three a side over a net
 *  (volleyball and sepak takraw). Every attack and ability lands on the ball and only on the ball: fighters never hurt
 *  each other here. Data and rules only, as everything under src/game. */
export type BallModeId = 'goal-rush' | 'sky-spike';
export const BALL_MODES: readonly BallModeId[] = ['goal-rush', 'sky-spike'];
/** Bumped whenever a page and a room would disagree about the ball, its view or its messages. */
export const BALL_PROTOCOL = 2;
export type BallTeam = 'red' | 'blue';
export const BALL_TEAMS: readonly BallTeam[] = ['red', 'blue'];
export const otherTeam = (team: BallTeam): BallTeam => team === 'red' ? 'blue' : 'red';
export const BALL_TEAM_NAMES: Record<BallTeam, string> = {red: 'CRIMSON', blue: 'AZURE'};
export const BALL_TEAM_COLOURS: Record<BallTeam, number> = {red: 0xff3b52, blue: 0x2f8cff};
export type BallAccess = 'bots' | 'quick' | 'host';
/** lobby: seats filling. countdown: the match is about to begin. kickoff: bodies on their marks, the ball held (a
 *  kickoff, a serve's walk-up). live: play. scored: a goal or a point is being celebrated, the clock stopped. over. */
export type BallPhase = 'lobby' | 'countdown' | 'kickoff' | 'live' | 'scored' | 'over';

/** What kind of shot a strike made, as it is named on screen. */
export type ShotKind = 'tap' | 'drive' | 'power' | 'pop' | 'volley' | 'spike' | 'curve' | 'sinker' | 'blast'
  | 'eruption' | 'super' | 'bump' | 'set' | 'serve' | 'dig' | 'block' | 'save' | 'header';
export const SHOT_NAMES: Record<ShotKind, string> = {
  tap: 'TAP', drive: 'DRIVE', power: 'POWER SHOT', pop: 'SKY POP', volley: 'VOLLEY', spike: 'SPIKE', curve: 'CURVE',
  sinker: 'SINKER', blast: 'BLAST', eruption: 'ERUPTION', super: 'SUPER SHOT', bump: 'BUMP', set: 'SET', serve: 'SERVE',
  dig: 'DIG', block: 'BLOCK', save: 'SAVE', header: 'HEADER',
};

/** The ball as every page draws it. `heat` 0-4.6 (its tier is the floor, 4 and over OVERDRIVE): passes and heavy blows
 *  heat it, bounces and guards cool it, and a hotter ball flies faster and burns brighter; an OVERDRIVE ball staggers
 *  whoever it hits. */
export interface BallState extends Vec3 {
  vx: number; vy: number; vz: number;
  /** Spin (rad/s, a world-space axis times its rate): curves and dips the flight, and turns the drawn ball. */
  sx: number; sy: number; sz: number;
  heat: number;
  /** Who touched it last, and their side: the trail's colour, the scorer, the fault. */
  lastId: string | null; lastTeam: BallTeam | null;
  /** The last strike's name, for the popup beside it. */
  shot: ShotKind | null;
  /** Held in place: a kickoff's ball, a serve waiting to be struck, a ball in somebody's stopped time. */
  held: boolean;
  /** Server time a stopped time lets the ball go (the blows it took meanwhile land together then). */
  frozenUntil: number;
  /** A super shot (an ultimate's blow) is in flight: the screen's cut-in and the goal's worth key off it. */
  super: boolean;
  /** RUMBLE's charms on the ball: its size (GIANT BALL), its gravity (FEATHER BALL), and the goal an IRON WALL seals.
   *  The flight reads them, so every page runs the same ball on. */
  size: number; grav: number; wall: BallTeam | null;
  /** The arena's ground and air (game/ball/arenas.ts twist): the floor's friction and bounce as multipliers, and a wind
   *  (m/s², across the place). Absent: as the mode always was. */
  ground?: number; spring?: number; windX?: number; windZ?: number;
  /** A CLASH holds the ball until this server time (0: none): two sides' blows met it at once, and the stronger one
   *  sends it on when the clash breaks. */
  clash: number;
}

export interface BallSeat {
  id: string; name: string; fighter: FighterId; team: BallTeam; bot: boolean; disconnected?: boolean;
  /** The bot's (or an idle human's stand-in's) job this moment: Goal Rush's attacker, support and keeper; Sky Spike's
   *  front and back row. */
  role?: 'attack' | 'support' | 'keeper' | 'front' | 'back';
  goals: number; assists: number; saves: number; shots: number; touches: number;
  /** Sky Spike: points won with a strike that landed, aces, blocks, digs. */
  kills: number; aces: number; blocks: number; digs: number;
  /** The results screen's tally (MVP is the most). */
  points: number;
  /** The accolades earned this match (HAT TRICK, SAVIOR...), in the order earned, and the clashes won. */
  feats?: string[]; clashes?: number;
  /** The fighter's ball trait (traits.ts: AERIALIST, STRIKER, WALL, PLAYMAKER), read off their kit. */
  trait?: BallTrait;
  /** RANKED: a person's standing when the match began, and at the end the change (ranked.ts). */
  rank?: SeatRank;
  /** The ball gear the seat wears (look.ts): ball skin, trail, goal burst, celebration. */
  look?: BallLook;
}

export interface BallEvent {
  id: number; at: number;
  kind: 'goal' | 'own-goal' | 'save' | 'shot' | 'post' | 'kickoff' | 'overtime' | 'point' | 'ace' | 'kill' | 'block' | 'fault'
    | 'out' | 'net' | 'touches' | 'rally' | 'fever' | 'super' | 'bowled' | 'perfect' | 'serve' | 'side-out' | 'match-point'
    | 'demo' | 'strike' | 'win'
    /** A feat (HAT TRICK, AERIAL GOAL, SAVIOR...: the match's accolades), and a bot's line (its quick chat). */
    | 'accolade' | 'chat'
    /** RUMBLE: a charm grabbed, and one that saved a goal or a point (IRON WALL, SAFETY NET). */
    | 'charm' | 'shield'
    /** Two sides' blows on the ball at once (a shot clash, a 50/50): actorId won it,
     *  targetId lost it, value is the speed it breaks out at (m/s). */
    | 'clash'
    /** FREE PLAY: a target hit (value: the streak). */
    | 'target';
  team?: BallTeam; actorId?: string; assistId?: string; targetId?: string;
  x: number; y: number; z: number;
  /** A shot's speed (m/s), a rally's length, a point's worth. */
  value?: number;
  shot?: ShotKind;
  text?: string;
  /** A charm grabbed or used (RUMBLE). */
  charm?: CharmKind;
}

/** The view a room publishes beside the fighters: `GameSnapshot & {ball: BallView}`. */
export interface BallView {
  kind: 'ball'; mode: BallModeId; phase: BallPhase; access: BallAccess; round: number;
  hostId: string | null; code?: string; capacity: number; fillBots: boolean;
  startsAt: number | null; startedAt: number; endsAt: number;
  /** When the current kickoff, celebration or serve walk-up ends. */
  phaseUntil: number;
  seats: BallSeat[];
  score: Record<BallTeam, number>;
  ball: BallState;
  /** Goal Rush: seconds of play left (the clock stops for goals and kickoffs). Sky Spike: unused (0). */
  clock: number;
  overtime: boolean;
  /** Sky Spike: the side whose half the ball is in and how many times that side has touched it since it came over; the
   *  rally's crossings; whose serve; the score to win; whether the rally is past FEVER and every point is worth two. */
  touchTeam: BallTeam | null; touches: number; rally: number; servingTeam: BallTeam; serverId: string | null;
  target: number; fever: boolean;
  winner: BallTeam | 'draw' | null; reason: string; mvp: string | null;
  events: BallEvent[];
  /** The replay of the last goal or great point, while the room holds its celebration (replay.ts). */
  replay: BallReplay | null;
  /** RUMBLE: charms appear on the field and fire for whoever runs
   *  through one. The charms lying there, and the ones working now. */
  rumble: boolean; charms: BallCharm[]; effects: BallEffect[];
  /** Which of the mode's arenas the match is played in (game/ball/arenas.ts): its look, and its twist on the ball. */
  arena?: BallArenaId;
  /** FREE PLAY: one person and the ball, no clock, no end. Goal Rush puts the ball back on
   *  the spot after each goal; Sky Spike's ball machine on the far side keeps sending balls over. `best` is the fastest
   *  strike so far (m/s). */
  practice: boolean; best: number;
  /** FREE PLAY's target practice: the ring to put the ball through (Goal Rush: on the goal's mouth, facing the pitch) or
   *  onto (Sky Spike: on the far court's floor), and the targets hit, the streak and the best streak. */
  aim: {x: number; y: number; z: number; r: number; floor: boolean} | null; hits: number; streak: number; bestStreak: number;
  party?: boolean; autoStart?: boolean;
  /** A mutator (mutators.ts: HEAT RUSH, LOW GRAVITY, GIANT BALL, SUDDEN DEATH), or none: CLASSIC or RUMBLE. */
  mutator?: BallMutator | null;
  /** FREE PLAY's training drill (drills.ts): which, which ball, the results, the medal once it is over. */
  drill?: DrillView | null;
  /** RANKED (ranked.ts): a ranked queue's room, and whether the people at kickoff made the match ranked. */
  ranked?: boolean;
}
/** The events that end a Sky Spike rally, by how (a page's sound reads them: src/audio/ballAudio.ts): a point won outright -
 *  a kill, an ace off the serve, a point - and a point given away (out, four touches, a fault). */
export const POINT_WON: ReadonlySet<BallEvent['kind']> = new Set(['kill', 'ace', 'point']);
export const POINT_GIVEN: ReadonlySet<BallEvent['kind']> = new Set(['out', 'touches', 'fault']);
/** A point won straight off the serve. */
export const servedPoint = (e: Pick<BallEvent, 'kind'>) => e.kind === 'ace';
export type BallSnapshot = GameSnapshot & {ball: BallView; receipt?: {matchId: string; reward?: GameSnapshot['reward']}};
export const ballOf = (snapshot: GameSnapshot | null | undefined): BallView | undefined => (snapshot as BallSnapshot | undefined)?.ball;
/** What a ball match adds to a seat's match report (economy/earn.ts MatchReport): the mode, what they scored (Goal Rush's
 *  goals; Sky Spike's kills and aces) and their saves (Goal Rush's saves; Sky Spike's blocks and digs). */
export function ballReportOf(view: BallView | undefined, id: string): {ball?: BallModeId; scored?: number; saves?: number} {
  const seat = view?.seats.find(s => s.id === id);
  if (!view || !seat) return {};
  return view.mode === 'goal-rush' ? {ball: view.mode, scored: seat.goals, saves: seat.saves} : {ball: view.mode, scored: seat.kills + seat.aces, saves: seat.blocks + seat.digs};
}

/** Quick chat: four menus of four lines, the same everywhere, so a room relays an index and never
 *  free text. The first menu's lines are each mode's own calls. */
export const QUICK_CHAT_MENUS = ['INFO', 'PRAISE', 'REACT', 'SORRY'] as const;
export function quickChat(mode: BallModeId): readonly string[] {
  const info = mode === 'goal-rush' ? ['I got it!', 'Take the shot!', 'Defending...', 'Centering!'] : ['I got it!', 'Set me up!', 'Block!', 'Mine!'];
  return [...info, 'Nice shot!', 'Great pass!', 'What a save!', 'Thanks!', 'OMG!', 'Wow!', 'Close one!', 'Noooo!', 'Whoops...', 'My bad...', 'Sorry!', 'No problem.'];
}
/** A person's quick chat: no sooner than `gap` s after their last line, and no more than `burst` lines in `window` s. */
export const QUICK_CHAT_LIMIT = {gap: .8, burst: 4, window: 8} as const;

/** RUMBLE's charms. Each fires the moment a fighter runs through it. */
export type CharmKind = 'charge' | 'magnet' | 'feather' | 'giant' | 'ice' | 'wall' | 'surge';
export const CHARM_KINDS: readonly CharmKind[] = ['charge', 'magnet', 'feather', 'giant', 'ice', 'wall', 'surge'];
export const charmName = (kind: CharmKind, mode: BallModeId) => kind === 'wall' && mode === 'sky-spike' ? 'SAFETY NET' : CHARM_NAMES[kind];
const CHARM_NAMES: Record<CharmKind, string> = {charge: 'KI CHARGE', magnet: 'SPIRIT HOOK', feather: 'FEATHER BALL', giant: 'GIANT BALL', ice: 'ICE SEAL', wall: 'IRON WALL', surge: 'KI SURGE'};
/** What each does, for the HUD and the how-to-play. */
export const charmLine = (kind: CharmKind, mode: BallModeId) => ({
  charge: 'YOUR NEXT STRIKE FLIES AT OVERDRIVE', magnet: 'THE BALL BENDS TOWARD YOU', feather: 'THE BALL FLOATS',
  giant: 'THE BALL GROWS', ice: 'THE BALL FREEZES WHERE IT IS', wall: mode === 'sky-spike' ? 'THE NEXT BALL INTO YOUR COURT BOUNCES BACK UP' : 'YOUR GOAL IS SEALED',
  surge: 'HALF A SUPER SHOT OF METER',
})[kind];
export const CHARM_COLOURS: Record<CharmKind, number> = {charge: 0xffb02e, magnet: 0xc86bff, feather: 0x9ff0ff, giant: 0xff5a3c, ice: 0x6fc8ff, wall: 0xf3eee4, surge: 0x7dff6a};
export interface BallCharm { id: number; kind: CharmKind; x: number; z: number; until: number }
/** A charm at work: whose, which side's, until when. */
export interface BallEffect { kind: CharmKind; team: BallTeam; id: string; until: number }
export const RUMBLE = {
  /** The first charm this long after a kickoff or serve, then one every so often, so many lying at once, each so long. */
  first: 4, every: 8, most: 2, life: 14,
  /** How close a body comes to take one. */
  reach: 1.5,
  seconds: {charge: 10, magnet: 6, feather: 7, giant: 8, ice: 1.6, wall: 6, surge: 0} as Record<CharmKind, number>,
  /** Sky Spike's SAFETY NET waits this long for a ball to land. */
  netSeconds: 12,
  /** SPIRIT HOOK: how far it reaches and how hard it bends (m/s²). */
  magnetRange: 10, magnetPull: 30,
  featherGravity: .4, giantSize: 1.8,
} as const;

/** The id the ball goes by wherever a body's id is wanted: the sim's external target, a soft lock, the camera. */
export const BALL_ID = 'ball';

export const BALL_STAGE: Record<BallModeId, StageId> = {'goal-rush': 'ball-pitch', 'sky-spike': 'ball-court'};

/** Shared numbers. Every speed is metres a second, every time seconds. */
export const BALL_RULES = {
  capacity: 6, teamSize: 3, countdown: 3, snapshotHz: 30,
  /** Heat each slot adds to the ball, the most it holds, and how fast it cools when nobody heats it. The most is past
   *  tier 4 (OVERDRIVE starts at 4), so an OVERDRIVE ball burns for a moment before it cools back under it. Heat builds from
   *  passes and heavies and falls at every bounce and guard, so OVERDRIVE is a few moments a match, not the ball's usual
   *  state. */
  heatPer: {light: .15, heavy: .65, special: .85, ultimate: 4.6, area: .7} as Record<string, number>,
  heatMax: 4.6, heatCool: .22,
  /** What a bounce off the floor (harder than `bounceFrom` m/s) and a guard (a save, a block) take off the ball's heat. */
  bounceHeat: .25, bounceFrom: 2.5, guardHeat: 1,
  /** A pass completed: a strike by a team-mate of the side's last striker, inside `passWithin` s (the heat it adds is
   *  each mode's `passHeat`). */
  passWithin: 3.5,
  /** An OVERDRIVE ball (tier 4) at this speed staggers an opponent who is not guarding for `staggerSeconds` (a SUPER
   *  SHOT bulldozes instead: GOAL_RULES and BallMatch). Once a body is staggered, not again for `staggerGap`. */
  bowlSpeed: 24, bowlTier: 4, staggerSeconds: .4, staggerGap: 1.2,
  /** How long a blow on the ball has to wait before the same cast may strike it again. */
  restrike: .1,
} as const;

/** A CLASH: blows of both sides on the ball inside `window` seconds of each other. The ball hangs `hold` seconds while
 *  the two fighters freeze `freeze` seconds, then the stronger blow (an ultimate, a special, an awakened fighter weigh
 *  more; a little luck either way) sends it on `boost` times harder and `heat` hotter. The next can't come for `gap` s. */
export const CLASH = {window: .22, hold: .5, freeze: .34, boost: 1.2, heat: 1, gap: 2} as const;

/** Goal Rush. The pitch is a walled box with chamfered corners and a goal sunk into each end wall, sized to
 *  a fighter's run (7.5 m/s). */
export const GOAL_RULES = {
  halfX: 18, halfZ: 26, wall: 10, ceiling: 17, corner: 4.5,
  goalHalfWidth: 4.6, goalHeight: 4.3, goalDepth: 3.4, post: .28,
  ballRadius: .62, hitRadius: 1.15, gravity: 15, drag: .07, roll: 3.2, bounce: .62, wallBounce: .74,
  /** The ball's top speed at each heat tier. */
  speedCap: [24, 29, 34, 41, 50],
  matchSeconds: 240, kickoffSeconds: 3, goalSeconds: 4.2,
  /** Overtime's ball heats by itself (its heat can't fall under this many a second of overtime), so a tied match
   *  always ends. */
  overtimeHeat: .05,
  /** Heat a completed pass adds (BALL_RULES.passWithin). */
  passHeat: .5,
  /** A super shot's goal counts twice. */
  superGoal: 2,
} as const;

/** Sky Spike. A court split by a net, a free zone round it and a dome over it: a ball that lands in a side's court is
 *  the other side's point, a ball that lands anywhere else is out off whoever touched it last. Three touches a side
 *  (sepak takraw's), and every crossing of the net heats the rally a little more. */
export const SPIKE_RULES = {
  courtHalfX: 7.5, courtHalfZ: 10.5, halfX: 15, halfZ: 18.5, ceiling: 22,
  netHeight: 2.7, netPost: 1.4,
  ballRadius: .5, hitRadius: 1.2, gravity: 11.5, drag: .06, bounce: .5, wallBounce: .6,
  speedCap: [22, 26, 31, 37, 46],
  touches: 3,
  /** The rally at which the ball starts to heat by itself, and at which FEVER makes every point worth two. */
  rallyHeat: 5, fever: 10,
  target: 11, cap: 15,
  /** Heat a completed pass adds (a bump to a set, a set to a spike); every blow's own heat counts this share of what it
   *  would in Goal Rush (a rally crosses the net with three touches, all of them in the air); a SKY SPIKE's own heat. A
   *  rally builds to OVERDRIVE around FEVER, not by its third crossing. */
  passHeat: .1, heatShare: .75, skySpikeHeat: .4,
  /** The serve's walk-up (it serves itself after this), and the point's beat before the next serve. The scorer's
   *  celebration plays on into the walk-up for `celebrateSeconds` (Sky Spike was live for only 53-56% of a
   *  match). */
  serveSeconds: 5, pointSeconds: .8, celebrateSeconds: 2,
  /** Where a serve's ball hangs: this far in front of the server, this high. */
  serveAhead: 1.1, serveHeight: 1.75,
} as const;

export const ballRadius = (mode: BallModeId) => mode === 'goal-rush' ? GOAL_RULES.ballRadius : SPIKE_RULES.ballRadius;
export const heatTier = (heat: number) => Math.max(0, Math.min(4, Math.floor(heat + 1e-6)));
