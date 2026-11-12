import type {BallArenaId} from './arenas';
import type {FighterId, GameSnapshot, StageId, Vec3} from '../types';
import type {BallReplay} from './replay';
import type {BallMutator} from './mutators';
import type {BallTrait} from './traits';
import type {DrillView} from './drills';
import type {LessonView} from './lesson';
import type {SeatRank} from './ranked';
import type {BallLook} from './look';
import type {AimAssist, SportFeel} from '../simulation';
import type {MoveDefinition} from '../moves';

/** The two ball modes: Goal Rush, three a side scoring on each other's goal, and Sky Spike, three a side over a net
 *  (volleyball and sepak takraw). Every attack and ability lands on the ball; in Goal Rush they land on the other
 *  side's fighters as well (GOAL_FIGHT), and a fighter whose health runs out is wiped out for a moment, never knocked
 *  out. Sky Spike's sides never meet across the net. Data and rules only, as everything under src/game. */
export type BallModeId = 'goal-rush' | 'sky-spike';
export const BALL_MODES: readonly BallModeId[] = ['goal-rush', 'sky-spike'];
/** Bumped whenever a page and a room would disagree about the ball, its view or its messages. (10: Goal
 *  Rush's carried ball - BallState.carry - the TRAP, and quick chat's fourth INFO line, the call for the ball. 11: the
 *  TACKLE that won the ball - BallEvent.won - the REVERSAL, and the POWER PLAY's goal - BallEvent.short. 13: the
 *  TECHNIQUE DUEL played - a press in its beat is the duel's, and BallEvent.presses.) */
export const BALL_PROTOCOL = 13;
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
  | 'eruption' | 'super' | 'bump' | 'set' | 'serve' | 'dig' | 'block' | 'save' | 'header'
  /** Sky Spike: a light from the air on the attacking touch, soft over the block and down short behind it. */
  | 'tip';
export const SHOT_NAMES: Record<ShotKind, string> = {
  tap: 'TAP', drive: 'DRIVE', power: 'POWER SHOT', pop: 'SKY POP', volley: 'VOLLEY', spike: 'SPIKE', curve: 'CURVE',
  sinker: 'SINKER', blast: 'BLAST', eruption: 'ERUPTION', super: 'SUPER SHOT', bump: 'BUMP', set: 'SET', serve: 'SERVE',
  dig: 'DIG', block: 'BLOCK', save: 'SAVE', header: 'HEADER', tip: 'TIP',
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
  /** A LINK SHOT in flight (superShots.ts LINK): the team-mate who set it up, whose colour shares the trail. */
  link?: string | null;
  /** Goal Rush (BallMatch CARRY): the seat carrying the ball - it is at their feet, CARRY.ahead in front of
   *  their body along the way they run, on the floor, until they strike it, lose it or let the stick go. The room puts it
   *  there every tick; a page draws it at the carrier's drawn feet (it is the page's to draw: online the carrier's body
   *  is drawn ahead of the room's ball). Absent: nobody carries it. */
  carry?: string;
  /** Goal Rush's SPORT mode (football.ts, `?football` on this device only): how far a sprint has knocked the carried ball
   *  on ahead of its spot (m). Absent: at the feet. */
  ahead?: number;
  /** SPORT mode: how far the carrier's held SHOOT is wound up (0-1), for the page's take of its wind-up. Absent: none. */
  wind?: number;
  /** The wind-up is a tap's (FOOTBALL.fun2.kick) - a PASS's or a SHOOT's - not a held SHOOT's: the page plays
   *  that take's short lead-in. */
  windTap?: 'pass' | 'shot';
  /** Sky Spike on the volleyball rules: the court it is played on (VOLLEY_COURT). Absent: SPIKE_RULES' own. */
  court?: SpikeCourt;
}

export interface BallSeat {
  id: string; name: string; fighter: FighterId; team: BallTeam; bot: boolean; disconnected?: boolean;
  /** The bot's (or an idle human's stand-in's) job this moment: Goal Rush's attacker, support and keeper; Sky Spike's
   *  front and back row. */
  role?: 'attack' | 'support' | 'keeper' | 'front' | 'back';
  /** Goal Rush's SPORT mode (game/ball/football.ts): the side's keeper, a fourth body the game plays - not one of the
   *  three a side (BALL_RULES.teamSize), not counted in the score bug's faces. Only a match on this device has one. */
  keeper?: boolean;
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
  /** Goal Rush (GOAL_FIGHT): wiped out - their health ran out - and off the pitch until this server time, when they come
   *  back at their own end with it full. The body lies where it fell meanwhile (the kernel's 'defeated'), which the page
   *  may fade. Absent: in play. */
  out?: number;
  /** Goal Rush: the opponents this seat has wiped out this match. */
  wipeouts?: number;
  /** Goal Rush's FIGHT stance (GOAL_STANCE): the opponent this seat is locked on, whose blows land on them and never on
   *  the ball. Absent: the BALL stance, whose blows play the ball and never hurt a fighter. The room's to say (BallMatch
   *  reads it off each command's target), so every page can draw who is hunting whom. */
  lock?: string;
  /** Goal Rush: the takedowns this seat has made (GOAL_STANCE.tackle). */
  tackles?: number;
  /** Goal Rush: the PERFECT STRIKEs and PERFECT HEADERs this seat has struck (BallMatch PERFECT_STRIKE). */
  perfects?: number;
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
    | 'target'
    /** A TECHNIQUE DUEL (superShots.ts DUEL): a PERFECT guard met a SUPER SHOT - actorId the keeper, targetId the striker,
     *  value the beat's seconds - and how it ended: actorId the winner, targetId the loser, text SHOT STOPPED or BREAKS
     *  THROUGH, `presses` how near each pressed to the beat's mark. */
    | 'duel' | 'duel-won'
    /** VOLLEYBALL (volley.ts; behind `?volleyball`, this device only - the online room never emits it):
     *  a touch played - actorId who, shot what it became, text how well it was timed (PERFECT, GOOD, EARLY, LATE,
     *  FLUBBED), value the ball's speed leaving (m/s). The HUD names it in the line under the score. */
    | 'touch'
    /** Goal Rush's fights (GOAL_FIGHT): a fighter wiped out - actorId whoever landed the last blow (absent: nobody's,
     *  their team in `team`), targetId who went down, value the seconds they are out, x/y/z where they fell, text the
     *  blow's name or BUMP - and a boosting body's bump that knocked somebody flat ('demo': actorId the bumper, targetId
     *  the bumped, value the bumper's speed, m/s). */
    | 'wipeout'
    /** Sky Spike: a hard ball (strike.ts SPIKE_DIG, a spike or a drive) kept up on the first touch - actorId the
     *  digger, value the ball's speed coming in (m/s), text DIG or DIVING DIG (off a dash, BallMatch DIG_DIVE). A page may
     *  make a moment of it; the HUD need not (thirty a match). */
    | 'dig'
    /** Goal Rush's FIGHT stance (GOAL_STANCE.tackle): a fighter locked on the one on the ball put them down - actorId the
     *  tackler, targetId the striker, text TACKLE (knocked down or sent flying) or TAKEDOWN (wiped out), x/y/z where.
     *  (BallMatch TACKLE_WON) `won` when it knocked the ball off its carrier, popped LOOSE to the tackler. */
    | 'tackle'
    /** Goal Rush (BallMatch REVERSAL): a guard timed against a TACKLE turned it - actorId the one on the
     *  ball who guarded, targetId the tackler put down, text REVERSAL, x/y/z where; a carrier kept the ball. */
    | 'reversal'
    /** Sky Spike: a set that is a choice - actorId the setter, text QUICK SET (a jump set, at the hitter's hand
     *  on the way up: no PERFECT SPIKE, but no time for the block) or BACK SET (to the wing across the court). The
     *  floating set has none (it comes every rally). */
    | 'set'
    /** Sky Spike: the swings of a match. 'deuce': the score tied at one short of the target or later, text
     *  DEUCE, value the score each side has. 'comeback': a side that trailed by four or more has drawn level - team the
     *  side, value the deepest deficit it came back from, text COMEBACK. */
    | 'deuce' | 'comeback'
    /** Goal Rush's SPORT mode (football.ts): a PASS - actorId the passer, targetId the team-mate it went to (absent: into
     *  space), text PASS or LOFTED, value its speed (m/s). Only a match on this device under `?football` says it. */
    | 'pass'
    /** Goal Rush's SPORT mode (football.ts): a TACKLE or a TRICK - actorId who made it, targetId on whom, text
     *  POKE or SLIDE (`won` when it took the ball; MISSED when a slide won nothing; SLIDING and POKING as each starts), BEATEN (a tackle into a trick: the
     *  trickster is actorId) or TRICK. Only a match on this device under `?football` says it. */
    | 'steal';
  team?: BallTeam; actorId?: string; assistId?: string; targetId?: string;
  x: number; y: number; z: number;
  /** A shot's speed (m/s), a rally's length, a point's worth. */
  value?: number;
  shot?: ShotKind;
  text?: string;
  /** A charm grabbed or used (RUMBLE). */
  charm?: CharmKind;
  /** Sky Spike: a strike that was a PERFECT SPIKE (struck from the top of the jump, at the net; its text is SKY SPIKE).
   *  Goal Rush: a strike that was a PERFECT STRIKE (a ball coming in, met just as it arrived: BallMatch
   *  PERFECT_STRIKE) - text PERFECT STRIKE, PERFECT VOLLEY (in the air), PERFECT HEADER (shot `header`), or a flair's
   *  name (BICYCLE KICK). A plain HEADER is a strike too: shot `header`, text HEADER. */
  perfect?: boolean;
  /** Goal Rush: a TACKLE that knocked the ball off its carrier (BallMatch TACKLE_WON). */
  won?: boolean;
  /** Goal Rush on the sport rules (football.ts FOOTBALL.fun.full): a SHOOT struck at full power. */
  full?: boolean;
  /** Goal Rush (the POWER PLAY): a goal scored into a side's goal while that side was short - the bodies
   *  in play then, the scorers' first (3 v 2). */
  short?: [number, number];
  /** A TECHNIQUE DUEL's end (superShots.ts DUEL): each of the two's press, ms from the mark (late is
   *  positive), absent for no press. */
  presses?: {keeper?: number; striker?: number};
}
/** Goal Rush (the POWER PLAY): the bodies each side has in play - its seats less any wiped out
 *  (BallSeat.out) - read the same by the room (BallMatch) and every page (the score bug's count, the short side's goal
 *  glowing). */
export function inPlay(seats: readonly Pick<BallSeat, 'team' | 'out' | 'keeper'>[]): Record<BallTeam, number> {
  const n = {red: 0, blue: 0};
  // (SPORT mode's keeper - football.ts, a fourth body - is not counted: the count is of the three a side.)
  for (const s of seats) if (s.out === undefined && !s.keeper) n[s.team]++;
  return n;
}
/** The side a POWER PLAY is against - the one with fewer bodies in play while both have someone on the pitch - or null.
 *  (A side with nobody seated is not short: FREE PLAY, a drill.) */
export function shortSide(seats: readonly Pick<BallSeat, 'team' | 'out'>[]): BallTeam | null {
  let red = 0, blue = 0;
  for (const s of seats) if (s.team === 'red') red++; else blue++;
  if (!red || !blue) return null;
  const n = inPlay(seats);
  return n.red < n.blue ? 'red' : n.blue < n.red ? 'blue' : null;
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
  /** The bots' level when it is not NORMAL (BallBrain BOT_LEVELS) - a match against bots, or a private room's
   *  host's pick (the lobby says so). */
  level?: 'easy' | 'hard';
  /** FREE PLAY's training drill (drills.ts): which, which ball, the results, the medal once it is over. */
  drill?: DrillView | null;
  /** LEARN TO PLAY (lesson.ts), FREE PLAY's guided first game - the step on now, what is done, why the last try
   *  missed. */
  lesson?: LessonView | null;
  /** Goal Rush's SPORT mode (football.ts): possession, PASS, SHOOT and SPRINT in place of the BALL stance's swings. Set
   *  only by a match on this device under `?football`; the online room never sets it. */
  football?: boolean;
  /** RANKED (ranked.ts): a ranked queue's room, and whether the people at kickoff made the match ranked. */
  ranked?: boolean;
  /** The match's intro (ceremony.ts INTRO): it runs through the countdown, from `startsAt - seconds` to `startsAt`. The
   *  skip vote's count, and whether it carried. Absent: no intro (FREE PLAY, a couch split screen). */
  intro?: BallIntro | null;
  /** The page's own (render/CombatTimeline; never sent): the server time this ball was sampled at, and the next
   *  snapshot's ball and its time when the frame falls between two, so the page draws the ball where it is at the
   *  frame's time (render/ball/BallField) instead of where it was at the last snapshot. */
  sampledAt?: number; next?: BallState | null; nextAt?: number;
  /** VOLLEYBALL (volley.ts): set only in a Sky Spike match on this device opened with `?volleyball`; the
   *  online room never sets it. */
  volley?: VolleyView;
}
/** VOLLEYBALL (volley.ts VolleyView's fields, kept here so the page reads them without the rules): whose
 *  ball it is (`owner`, null: nobody's), the room's time of its touch's best moment (`at`) and where (`x`, `z`), which
 *  of the side's touches it is (`touch`, 0 for the serve), the kit take each seat's last touch is drawn with (`takes`,
 *  ballMoves.ts keys), and what PLAY does now for each person (`prompt`: SERVE, RECEIVE, SET, SPIKE, OVER). */
export interface VolleyView {
  owner: string | null; at: number; x: number; z: number; touch: number;
  takes: Record<string, string>; prompt: Record<string, string>;
}
export interface BallIntro { seconds: number; skips?: number; people?: number; skipped?: boolean;
  /** The short intro (ceremony.ts SHORT_INTRO) - a rematch's, or an arena's this page has seen: no flyover. */
  short?: boolean }
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
/** Goal Rush's call for the ball (no new key): a person's "Pass it here!" has the carrying bot of
 *  their side look for them first for `seconds` (BallBrain CALLED) - a pass if the lane is open, never a blind one. It
 *  took the fourth INFO line's place ('Centering!'). */
export const PASS_CALL = {line: 'Pass it here!', seconds: 5} as const;
export function quickChat(mode: BallModeId): readonly string[] {
  const info = mode === 'goal-rush' ? ['I got it!', 'Take the shot!', 'Defending...', PASS_CALL.line] : ['I got it!', 'Set me up!', 'Block!', 'Mine!'];
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
 *  more; a little luck either way) sends it on `boost` times harder and `heat` hotter. The next can't come for `gap` s.
 *  (A hold of 0.5 s every 2 s at most was 11-16 clashes and 6-8 s of a match held still; a breath now, and rarer, so a
 *  50/50 is mostly the ball's own.) */
export const CLASH = {window: .22, hold: .3, freeze: .2, boost: 1.2, heat: 1, gap: 4} as const;

/** Goal Rush. The pitch is a walled box with chamfered corners and a goal sunk into each end wall, sized to
 *  a fighter's run (7.5 m/s; BALL_SPORT's 9.5, and 13.5 on the boost).
 *  A big ball that reads at a glance, and play that flows: the ball is
 *  bigger (0.62 to 0.8 m, as tall as a fighter's chest) and floatier (gravity 15 to 13), the walls livelier (0.74 to
 *  0.8, and a low ball off one is lifted by its foot, `wallLift`) and the floor rolls it further (roll 3.2 to 2.4), and
 *  the kickoff is two seconds, not three. */
export const GOAL_RULES = {
  /** The pitch is 26 × 38 m, about half the 36 × 52 it was (halfX 18, halfZ 26), so the ball is
   *  never far from somebody and every clearance off a wall is a chance at one end or the other. Everything on the pitch
   *  is laid from these numbers: the stage's bounds (game/stages.ts), the kickoff and respawn spots, the bots' places,
   *  the drills, the arena and its stands, the screens' broadcast camera, the intro and the replay's lenses. The
   *  corner's chamfer kept its 4.5 m, a larger share of the shorter walls: a ball run along a side wall meets it and is
   *  turned across the face of the goal, a cross. */
  halfX: 13, halfZ: 19, wall: 10, ceiling: 17, corner: 4.5,
  // (The goal 7.2 m wide, not 8 m: with SHOOT shooting for every fighter and the guard's ball leaving the keeper put
  // 16.3 on the score a match over 16 seeds, live 81.5%; at 7.2 m, 12.6 and 84.7%.)
  goalHalfWidth: 3.6, goalHeight: 4, goalDepth: 3.4, post: .28,
  ballRadius: .8, hitRadius: 1.35, gravity: 13, drag: .07, roll: 2.4, bounce: .64, wallBounce: .8,
  /** A low ball off a wall (its centre under the ball's radius plus this) climbs by this share of how hard it met it: the
   *  wall's foot curves it back up into play instead of letting it die along the boards. (Raised from .32 to .4: more of
   *  the play off the walls in the air, aerial goals 2.4 to 3.2 a match in the bot sims.) */
  wallFoot: .7, wallLift: .4,
  /** The chamfered corners kick: a ball meets one and comes off it livelier than off a wall (`cornerBounce`) and
   *  lifted by more of how hard it met it (`cornerLift`), so a ball run along a side wall is turned across the face of the
   *  goal as a cross at volley height, never dead in the corner. */
  cornerBounce: .92, cornerLift: .5,
  /** The ball's top speed at each heat tier. */
  speedCap: [23, 27, 32, 38, 46],
  /** The clock; the kickoff's hold with the bodies on their marks; a goal's hold - its sequence, the net, the burst, the
   *  lights and the scorer's close-up - when it has no replay (a replay holds it on: replay.ts REPLAY). Play comes back
   *  fast: 3.4 s from a goal to the ball back in play without a replay, under 6 s with one (with every goal replayed
   *  and a longer hold it was 9 s). */
  matchSeconds: 240, kickoffSeconds: 1, goalSeconds: 2.4,
  /** Overtime's ball heats by itself (its heat can't fall under this many a second of overtime), so a tied match
   *  always ends. */
  overtimeHeat: .05,
  /** Heat a completed pass adds (BALL_RULES.passWithin). */
  passHeat: .5,
  /** A super shot's goal counts twice. */
  superGoal: 2,
} as const;

/** Goal Rush's fights. The sides are sides in the combat kernel, so a blow finds the other side's
 *  fighters and never a team-mate's, and every blow still finds the ball: the swing's aim (simulation.ts assistAim) takes
 *  the ball whenever it is within the swing's reach and a stride, else the nearest opponent there.
 *  - `health`: a smaller bar than a duel's (a light string, a heavy and a special take it), so a fight is a moment, not
 *    a minute; it fills again `regenAfter` s after the last blow, at `regen` a second.
 *  - Nobody is knocked out: a fighter whose health runs out is WIPED OUT, off the pitch for `seconds`, then back at their
 *    own end (`respawnZ` from their goal line, `respawnX` either side) with it full, protected for `guard` s.
 *  - A wipe-out is worth MVP.wipeout toward MVP (BallMatch).
 *  - A BUMP: a boosting body at `bump.speed` or more, closing on an opponent at `bump.closing`, knocks them flat
 *    (`bump.damage` of the bar; one out of health is wiped out), at most once a `bump.gap` s each. */
export const GOAL_FIGHT = {
  health: 220, regenAfter: 6, regen: 25, seconds: 3, guard: 1, respawnZ: 3.5, respawnX: 5,
  bump: {speed: 11, closing: 8, damage: .5, gap: 1.2, reach: .45},
} as const;

/** Goal Rush's two stances, a clear line between playing the ball and fighting (Tab switches between them):
 *  - BALL (the default): every swing plays the ball - shots, passes, volleys - and never hurts a fighter; the camera is
 *    the ball cam.
 *  - FIGHT: locked on one opponent, the fighter's whole combat kit is theirs (the kernel's own lock-on) and never touches
 *    the ball; the camera is the fight's lock-on framing.
 *  Body touches and BUMPs move the ball and knock fighters flat in either stance. A command's target says which (BallMatch
 *  .submit): the ball's id is BALL, an opponent's id with the lock on is FIGHT on them. Sky Spike and FREE PLAY have the
 *  BALL stance only.
 *  - `reach`: metres a lock holds out to (past it, and when the one locked is wiped out, it is the BALL stance again).
 *  - `tackle`: a FIGHT-stance blow that knocks down, launches or wipes out the one on the ball - the nearest of their side
 *    within `near` m of it, or the last to touch it within `touched` s - is a TACKLE (TAKEDOWN if it wiped them out),
 *    worth MVP.tackle (MVP.takedown; BallMatch) toward MVP and `meter` of the super shot's meter (`awaken` of the awakening's), at most
 *    once a `gap` s on the same striker: winning the ball back by force pays toward the shot that follows it. */
export const GOAL_STANCE = {
  reach: 32,
  tackle: {near: 3.4, touched: 1.4, gap: 1.5, meter: 12, awaken: 6},
} as const;

/** Sports movement in the ball rooms (simulation.ts SportFeel). A quicker run (7.5 to 9.5 m/s) on quicker feet, the dash run on as a boost on the stamina bar (13.5 m/s; a
 *  full bar is about five seconds of it), a double jump and the air dash at the ball for aerials, half the impact
 *  freezes, and a kick's tail cut so the play flows on. Sky Spike keeps its jump (its spikes and blocks are timed to
 *  it) and its flat air dash, and has no double jump: its rallies were tuned on them. A Sky Spike blow thrown
 *  in the air (the spike) plays its follow-through out (`airTail`). */
/** SHOOT: instant on a tap, and held it charges the fighter's own move. SHOOT was each fighter's heavy, whose first blow came 0.26 to 0.61 s after the press by the
 *  fighter (the median 0.50 s; with the stick toward the ball a person threw the Charging Strike, 0.50 s for everyone),
 *  so a shot was a wait and a different wait for every fighter. Now (the kernel's rule: simulation.ts SportStrike):
 *  - **Tap:** one quick strike every fighter shares. Its blow lands `contact` s into the swing - the ball leaves 8
 *    ticks, 0.133 s, after the room hears the press - on the floor and in the air, in both modes: the sport's timing
 *    is learnt once. A key let go up to `hold` s after the press is
 *    still a tap, struck as it comes up (a slow thumb, a finger on glass).
 *  - **Hold:** a key still down at `hold` winds up the fighter's own heavy (off the floor their air strike) from the
 *    press: its blow lands when it always did (0.26-0.61 s on the floor, about 0.23 s in the air), as a CHARGED shot -
 *    more pace, a higher cap and more heat by how far it is charged (strike.ts SHOT), aimed as the key comes up. The
 *    wait is the player's choice: a charged shot can be tackled, blocked or closed down while it winds up.
 *  The quick strike reaches as a fighter's light does at the roster's middle (`reach`, 2.85 m to the ball's edge), steps
 *  in through its last strides as any blow with no lunge of its own, costs `stamina` (a heavy's 20-30 went on a tap,
 *  and with the bar low from a boost SHOOT was refused) and may be thrown again `cooldown` s after the press. */
export const SHOOT = {contact: .115, hold: .2, duration: .4, reach: 2.2, range: 2.4, radius: .95, stamina: 8, cooldown: .45} as const;
const QUICK_STRIKE: MoveDefinition = {name: 'Quick Strike', duration: SHOOT.duration, contacts: [SHOOT.contact], damage: 10, range: SHOOT.range, radius: SHOOT.radius,
  stamina: SHOOT.stamina, cooldown: SHOOT.cooldown, stun: .2, knockback: 2, style: 'melee', reach: SHOOT.reach};
/** (Off the floor it flies at the ball as the air strike does - simulation.ts airborneOpener - for as long as it has.) */
const QUICK_VOLLEY: MoveDefinition = {...QUICK_STRIKE, name: 'Quick Volley', lunge: 3};
const STRIKE = {move: QUICK_STRIKE, air: QUICK_VOLLEY, hold: SHOOT.hold};
export const BALL_SPORT: Record<BallModeId, SportFeel> = {
  'goal-rush': {run: 9.5, feet: 1.35, boost: 13.5, boostDrain: 42, dashGap: .15, jump: 1.06, airJumps: 1, airJump: .8, leap: 16, airDash: 9, hitstop: .5, recovery: .14, strike: STRIKE},
  'sky-spike': {run: 9, feet: 1.3, boost: 12.5, boostDrain: 42, dashGap: .15, jump: 1, airJumps: 0, airJump: .8, leap: 15, airDash: 0, hitstop: .6, recovery: .14, airTail: true, strike: STRIKE},
};
const ASSIST: Record<BallModeId, AimAssist> = {
  'goal-rush': {magnet: .9, airExternal: true, sport: BALL_SPORT['goal-rush']},
  'sky-spike': {magnet: .9, airExternal: true, sport: BALL_SPORT['sky-spike']},
};
/** The combat kernel's aim and movement in a ball room: the room's and the page's prediction of it (main.ts) alike. */
export const ballAssist = (mode: BallModeId): AimAssist => ASSIST[mode];

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
  rallyHeat: 5, fever: 8,
  target: 11, cap: 15,
  /** Heat a completed pass adds (a bump to a set, a set to a spike); every blow's own heat counts this share of what it
   *  would in Goal Rush (a rally crosses the net with three touches, all of them in the air); a SKY SPIKE's own heat. A
   *  rally builds to OVERDRIVE around FEVER, not by its third crossing. */
  passHeat: .1, heatShare: .75, skySpikeHeat: .4,
  /** The serve's walk-up (it serves itself after this), and the point's beat before the next serve. The scorer's
   *  celebration plays on into the walk-up for `celebrateSeconds` (Sky Spike was live for only 53-56% of a
   *  match). A point flows into the next serve, and a person serves within 3.5 s. */
  serveSeconds: 3.5, pointSeconds: .6, celebrateSeconds: 2,
  /** Where a serve's ball hangs: this far in front of the server, this high. */
  serveAhead: 1.1, serveHeight: 1.75,
} as const;

/** Sky Spike's court as the ball meets it - half its width (`x`) and length (`z`), and the free zone's walls (`wallX`,
 *  `wallZ`). The classic's is SPIKE_RULES' own (15 x 21 m, bigger than an indoor court for six); volleyball's three a side
 *  play on 9 x 16 m with 4 m round it. Carried on the ball (BallState.court) by a match on the volleyball rules, so the
 *  room's flight, the forecasts and a page's drawing meet the same lines; never on the wire (those matches are this
 *  device's), and absent everywhere else: SPIKE_RULES as it always was. */
export interface SpikeCourt { x: number; z: number; wallX: number; wallZ: number }
export const CLASSIC_COURT: SpikeCourt = {x: SPIKE_RULES.courtHalfX, z: SPIKE_RULES.courtHalfZ, wallX: SPIKE_RULES.halfX, wallZ: SPIKE_RULES.halfZ};
export const VOLLEY_COURT: SpikeCourt = {x: 4.5, z: 8, wallX: 8.5, wallZ: 12};
/** Whether two courts are the same (a page's copy of the view's is not the room's object). */
export const sameCourt = (a: SpikeCourt | undefined, b: SpikeCourt | undefined) => (a ?? CLASSIC_COURT).x === (b ?? CLASSIC_COURT).x && (a ?? CLASSIC_COURT).z === (b ?? CLASSIC_COURT).z && (a ?? CLASSIC_COURT).wallX === (b ?? CLASSIC_COURT).wallX && (a ?? CLASSIC_COURT).wallZ === (b ?? CLASSIC_COURT).wallZ;
/** The court a ball is played on (the classic's when it carries none). */
export const spikeCourt = (b?: {court?: SpikeCourt} | null): SpikeCourt => b?.court ?? CLASSIC_COURT;
/** A spot laid out on the classic court, carried onto `c` (each axis by the courts' ratio: the classic's exactly). */
export const onCourt = (c: SpikeCourt, x: number, z: number) => ({x: c === CLASSIC_COURT ? x : x * c.x / SPIKE_RULES.courtHalfX, z: c === CLASSIC_COURT ? z : z * c.z / SPIKE_RULES.courtHalfZ});

export const ballRadius = (mode: BallModeId) => mode === 'goal-rush' ? GOAL_RULES.ballRadius : SPIKE_RULES.ballRadius;
export const heatTier = (heat: number) => Math.max(0, Math.min(4, Math.floor(heat + 1e-6)));
