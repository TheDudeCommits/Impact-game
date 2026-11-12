import type {ArenaSimulation} from '../simulation';
import {jumpArcTo, PLAYER_RADIUS} from '../moves';
import type {FighterId, PlayerState, Vec3} from '../types';
import {SHOOT, SPIKE_RULES, BALL_RULES, VOLLEY_JUMP, onCourt, otherTeam, spikeCourt, type BallEvent, type BallSeat, type BallState, type BallTeam, type BallView, type ShotKind, type VolleyView} from './model';
import {courtSide, sideOf, stepBall, type BallContact} from './physics';
import {PLACE, SPIKE_DIG, placement, strikeBall, type Striker} from './strike';
import {ballRulesOf} from './sportRules';

/** The raised hand's height over the feet (VOLLEY.air.hand), which a set is laid to at the top of the jump. */
const VOLLEY_JUMP_HAND = 2.1;
/** VOLLEYBALL: Sky Spike played as volleyball. One button a touch, chosen by the moment; the game walks you the last
 *  step to the landing mark; timing decides how good the touch is, not whether it happens; you aim the set and the
 *  spike with the stick.
 *
 *  Behind `?volleyball` in the address (main.ts), in a Sky Spike match on this device (LocalBall: BOTS and COUCH); the
 *  online room never asks for it, so nothing here is on the wire. With it, BallMatch hands Sky Spike's touches to this
 *  file and no fighter's move ever plays the ball:
 *  - **PLAY** (the light or the heavy, whichever is pressed) does the touch the moment asks for: the serve, the receive
 *    (a DIG off a hard ball), the set, and on the third touch the spike (up in the air near the net) or a safe shot OVER.
 *    A press is held until the ball comes (`hold` seconds on the floor, the whole jump in the air), and the first press
 *    counts: a flurry is no better timed than its first press.
 *  - **Whose ball** (`owner`): the side's player who gets to the touch's spot soonest, a person ahead of a bot by
 *    `own.person` seconds while they can still get there in time, the setter ahead on the second touch, the hitter the set
 *    was laid for on the third. Any press near the ball plays it, the ball's owner's or not.
 *  - **The walk** (`walk`): the ball's owner's stick, held within `walk.cone` of the touch's spot, is turned onto it and eased to
 *    a stop there; a stick at rest or held further off is left alone. Inside the touch (`contact` s from the swing's start
 *    to the ball) the body runs on to the ball, if the stick is at rest or toward it.
 *  - **Timing**: the best moment is the ball coming down through the touch's height (`ideal`) at the body; a press within
 *    `tier.perfect` of that moment (less the swing's `contact`) is PERFECT, within `tier.early`/`tier.late` GOOD, further
 *    off EARLY or LATE, and no press at all leaves the ball to the body (`keepAt`): FLUBBED, low and short, a touch spent,
 *    still a team-mate's to play. A spike's tier is the height in the jump it is struck from (`spike`): the jump is its
 *    timing, cued by SpikeCues' JUMP ring.
 *  - **The stick aims** the set (across: that wing, a BACK SET across the setter; toward the net: a QUICK SET; back: the
 *    back-row hitter; at rest: the game's pick, a person first) and the spike and the OVER and the serve (strike.ts PLACE).
 *  - **Scoring** is volleyball's: every point one (BallMatch worth). FEVER keeps its look and the crowd's mood. */
export const VOLLEY = {
  /** The ball's size, a share of SPIKE_RULES.ballRadius's (0.5 m): 0.35 m, 0.7 m across. */
  size: .7,
  /** From the swing's start to its contact with the ball (SHOOT's quick strike draws the touch, so its contact). */
  contact: SHOOT.contact,
  /** How long an early press on the floor is held for the ball (an air press is held for the whole jump). */
  hold: .45,
  /** Flat metres: how far a body reaches for a ball, and the step inside a touch beyond it. */
  reach: 1, step: 1.2,
  /** A hard ball (strike.ts SPIKE_DIG.from and over): the share of the step it leaves time for, and the receive's tier
   *  off a PERFECT SPIKE one worse (`down`). */
  hard: {step: .5, down: true},
  /** Heights a ball can be played at from the floor, and each touch's best height there. */
  band: {lo: .3, hi: 3.3}, ideal: {receive: 1, set: 2.3, over: 1.5},
  /** A ball let fall to this height by a body (flat within `keepWide` of it) is the body's keep, FLUBBED. */
  keepAt: .6, keepWide: .25,
  /** Seconds off the best moment: PERFECT inside `perfect`; GOOD `early` before or `late` after. */
  tier: {perfect: .06, early: .18, late: .1},
  /** The walk: from `within` s before the touch, a stick within `cone` (rad) of the spot, eased over `ease` m. */
  walk: {within: 1.2, cone: 70 * Math.PI / 180, dead: .3, ease: .6, close: .2},
  /** The air touch: the hand `hand` m over the body's feet, reaching `reach` m; swung for a ball that will be within
   *  `meet` of it, or at its nearest. The hand is the raised one (2 m over the feet: the drawn hitting hand,
   *  BallField MEET), so on volleyball's jump (model.ts VOLLEY_JUMP) a set is met about 3.9 m up - a metre and a quarter
   *  over the net's band. */
  air: {hand: VOLLEY_JUMP_HAND, reach: 1.5, meet: .45},
  /** Whose ball: a person's lead (s), the setter's on the second touch, the ball's owner keeping it unless beaten by `keep`, and
   *  the one who touched last held back by `again`. */
  own: {person: .25, setter: .4, keep: .2, again: .6, run: 9},
  /** The serve's clock (s): it serves itself after `seconds`; the point's beat; a bot's wait before serving. */
  serve: {seconds: 2.5, point: .4, botWait: .35, botSpread: .1},
  /** The receive: to the setter's spot (`x`, `z` off the net), coming down through `height` after `seconds` (a DIG, off a
   *  hard ball: `digHeight`, `digSeconds`); off by up to `miss` metres by the tier. */
  pass: {x: 1.2, z: 1.8, height: 2.3, seconds: 1.12, digHeight: 2.6, digSeconds: 1.3, miss: {PERFECT: .3, GOOD: 1, EARLY: 2.2, LATE: 2.2}},
  /** The set's spots (wing `wing` m across and `z` off the net; QUICK `quickZ` off it a step from the setter; the back
   *  row `backZ` off it), its flight (`seconds`, a BACK SET's `back`, a QUICK's `quick` to `quickHeight`), the hitter's
   *  hand over the top of their jump (`reach`), and how far off the tier lays it (`miss`, and `high` up or down). */
  set: {wing: 4.6, z: 1.2, quickZ: 1.3, quickStep: 1.3, backZ: 4.6, seconds: 1.42, back: 1.2, quick: .7, quickHeight: 3.8, quickMeet: 3.25, reach: VOLLEY_JUMP_HAND,
    miss: {PERFECT: 0, GOOD: .6, EARLY: 1.5, LATE: 1.5}, high: .8,
    /** A person is ready to be set (the setter's pick) on their own side's front `front` metres, within `near` of a spot.
     *  The pick is a high set or a BACK SET, never a QUICK SET: a person at a run makes one (scripts: from 4 m), but the
     *  high set is the one the JUMP cue teaches - a QUICK is a person's own call with the stick when they set. */
    front: 5.5, near: 3.5},
  /** FLUBBED: low and short, toward the middle of the side's court, turned by up to `turn` rad: down through `height`
   *  `near`-`far` m off after `seconds` (the timed dig's flight, given a breath longer to be reached). */
  flub: {height: 1.1, near: 1.4, far: 2.6, turn: .9, seconds: 1},
  /** The safe shot OVER: to the stick's zone or the emptiest deep spot, `seconds` up, clearing the net by `clear`. */
  over: {seconds: 1.2, clear: .8},
  /** The spike: PERFECT from `perfect` of the jump's top or more (with the ball over the net's zone, as PERFECT_SPIKE),
   *  GOOD from `good` (a QUICK SET's, met rising, from `quick`), slower (`offPace`) and unplaced below; a ball under the
   *  net by `under` goes OVER instead. */
  spike: {perfect: .92, clean: .7, good: .75, quick: .3, offPace: .88, net: 3.6, ball: 3.4, under: .3, heat: .7},
  /** The BLOCK: a body in the air within `net` m of the net, `wide` m across from the ball's line, as the other
   *  side's spike crosses `plane` m of the net plane at a height between `low` under its feet and `top` over them, blocks
   *  it with no press - the jump is the block. From `stuff` of its jump's top, the ball within `square` across of the
   *  blocker's middle, it is a STUFF BLOCK, straight down into the
   *  hitters' court at `stuffSpeed`; from `soft` a soft block, up on its own side (`softHeight` after `softSeconds`, its
   *  three touches whole). A PERFECT SPIKE goes through anything short of a STUFF BLOCK, a SUPER SHOT through every block;
   *  a TIP and a shot OVER are never blocked. */
  block: {net: 1.4, wide: 1.2, square: .45, plane: .6, top: 2.85, low: .5, stuff: .96, soft: .6, stuffSpeed: 15, softHeight: 3.6, softSeconds: .95},
  /** The DIVE: BOOST (the dash) at a low ball of yours (under `height`, `from`-`to` m off) is a press, with the
   *  reach `reach` m longer; a dive's touch is at best GOOD. */
  dive: {reach: 1.4, from: 1.6, to: 3.4, height: 2.5},
  /** A hard ball, playable by a person: a press held for one coming at your
   *  side waits `hold` s, and made before its moment it digs at a tier set by how near the ball meets the body (`perfect`,
   *  `good` m; further: LATE) - reading the attack and standing right is the skill; a press after the moment is tiered by
   *  its timing, as any. */
  dig: {hold: 1.2, perfect: .6, good: 1.1},
  /** The share of a setter's picks that go to a person who is ready, by the setter's level. */
  setShare: {easy: .85, normal: .7, hard: .6} as Record<string, number>,
  /** The JUMP SERVE (BallMatch SERVE_RULES's numbers): PERFECT from `apex`; sprayed below by `spray` + up to `wild` long
   *  and half `spray` + `wide` across, all of it from `low` down. */
  jumpServe: {apex: .92, spray: 1.2, wild: 4, wide: 2.4, low: .7},
  /** The spike's hit-stop (s) - the hitter held at the contact as the ball goes, by the spike's tier; a SUPER SHOT's. */
  stop: {PERFECT: .1, GOOD: .06, super: .12} as Record<string, number>,
  /** The person is the side's hitter, in every rally.
   *  - The bot setter sets a person who can attack, always: the set spot nearest them, if they can get to it (`reach` m
   *    flat; the walk brings them). A person's first touch is set back to them.
   *  - The second touch is a bot's while one can get there: a person is held back `second` s from it.
   *  - The walk's help (never against the stick; a stick at rest is walked too, at a run eased over `ease` m): to the set
   *    laid for them; while a team-mate plays the first or second touch, to the set spot they will be given (`behind` m
   *    back from it, to run into it); as the other side's set goes up, to the net in front of it (`blockZ` m off it) to
   *    block. Their own ball to receive or set is the walk's as it was (a stick toward it turned onto it).
   *  - A person's block (the jump at the net as they attack, or PLAY there, which jumps) always meets a spike passing
   *    within `wide` m across, anywhere in the jump from `low` of its top (`top` and `under` m round the body, more than a
   *    bot's), graded by how near the jump's top it meets it: from `stuff` (and within `square` m across) a STUFF BLOCK; else a soft block, up on
   *    their own side, as likely as the jump was high - none from `soft[0]` of the top, every one from `soft[1]` - or a
   *    BLOCK TOUCH, off the hands into their own court, down after `touch` s - theirs to dig if they get there (a PERFECT
   *    SPIKE short of a STUFF BLOCK is only touched). PLAY's jump is held `hold` s.
   *  - A third touch that is no set (a ball to put OVER) is a person's ahead of a bot by `third` s.
   *  - `slip` of a person's BLOCK TOUCHes the spike beats instead (a block that met three spikes in four would win their
   *    side nearly every point); where the rest go is `touchOff`'s. (`touch` is not read.) */
  /** Where a person's BLOCK TOUCH goes (`blocks`): off the hands and OUT past the blockers' own side or back line
   *  (`out` of them, landing `outBy` m or so past it after `outSeconds`), back over the net high onto the attackers' side
   *  (`back`, down through `backHeight` after `backSeconds`), or down fast into the blockers' own court where it is
   *  emptiest (the rest, `digSeconds`): a hard dig. */
  touchOff: {out: .25, outBy: 1.4, outSeconds: .55, back: .3, backHeight: 1.2, backSeconds: 1.05, digSeconds: .4},
  person: {reach: 9, second: .6, ease: .8, behind: 1.2, blockZ: .7, wide: 1.3, low: .6, top: 2.75, under: 1, stuff: .95, square: 1, soft: [.6, 1.1] as readonly [number, number], touch: .45, hold: .6, third: .6, slip: .65},
} as const;
/** A fighter's jump on the volleyball rules (model.ts VOLLEY_JUMP; the kernel's own, simulation.ts sportJump), and
 *  the block's hop at the net - what the rules, the bots, the JUMP cue and the toss time against. */
export const volleyArc = (fighter: FighterId) => jumpArcTo(fighter, VOLLEY_JUMP);
export const hopArc = (fighter: FighterId) => jumpArcTo(fighter, {apex: VOLLEY_JUMP.hop.apex, float: VOLLEY_JUMP.float, spread: VOLLEY_JUMP.spread});
/** Whether a page plays Sky Spike as volleyball (main.ts): on the sport rules (sportRules.ts - the default on any host,
 *  `?classic` for the classic rules; `?volleyball` is still accepted and changes nothing). */
export function volleyballWanted(location?: {search: string}): boolean {
  return ballRulesOf(location) === 'sport';
}
export type VolleyTier = 'PERFECT' | 'GOOD' | 'EARLY' | 'LATE' | 'FLUBBED';
export type VolleyKind = 'float' | 'jumpServe' | 'receive' | 'set' | 'spike' | 'over' | 'keep';
export type VolleyLevel = 'easy' | 'normal' | 'hard';

/** What the match lends the rules (BallMatch makes it, so its own bookkeeping stays its own). */
export interface VolleyHost {
  readonly sim: ArenaSimulation; readonly seats: ReadonlyMap<string, BallSeat>; readonly view: BallView; readonly ball: BallState;
  /** How the seat's body moved last tick (m/s). */
  motion(id: string): {vx: number; vy: number; vz: number} | undefined;
  touched(seat: BallSeat, shot: ShotKind, serve?: boolean): void;
  emit(kind: BallEvent['kind'], fields: Omit<BallEvent, 'id' | 'at' | 'kind'>): void;
  dug(seat: BallSeat, incoming: number, dived?: boolean): void;
  award(seat: BallSeat, kind: 'perfectSpike' | 'perfectServe'): void;
  passed(seat: BallSeat, now: number): boolean;
  /** The serve struck: the ball let go, play live. */
  served(seat: BallSeat, perfect: boolean, floated: boolean): void;
  meter(id: string, ultimate: number, awaken: number): void;
  /** A block (a STUFF BLOCK or a soft one) by `seat` - the card, MVP, the event; not one of its side's touches. */
  blocked(seat: BallSeat, stuff: boolean): void;
  /** A SUPER SHOT struck by `seat` - its meter spent, the event the show is for. */
  superShot(seat: BallSeat): void;
  /** The spike's hit-stop - the hitter held `seconds` in the air at the contact as the ball goes. */
  stop?(seat: BallSeat, seconds: number): void;
}
/** A press: when, the aim and stick, in the air or not, near the ball or not; which button (`slot`: PLAY, the TIP's -
 *  the heavy's - or the SUPER SHOT's), and a DIVE's. */
interface Press {at: number; yaw: number; x: number; z: number; air: boolean; near?: boolean; slot: 'play' | 'tip' | 'super'; dive?: boolean}
interface Commit {id: string; kind: VolleyKind; at: number; contactAt: number; delta: number; press: Press; touch: number; team: BallTeam; lastId: string | null; touches: number; take: string;
  /** An air touch: the body's height as the swing left (the swing brakes the jump: its height then is the touch's). */
  fromY: number;
  /** A hard ball's dig pressed before its moment: how far (flat m) the ball meets the body - its tier (VOLLEY.dig). */
  place?: number}
interface Plan {team: BallTeam; touch: number; x: number; y: number; z: number; at: number; air: boolean}
/** A set laid: for whom, how well, its kind, and the best moment for the spike (room time). */
export interface VolleySet {team: BallTeam; hitter: string; tier: VolleyTier; kind: 'high' | 'back' | 'quick'; at: number; x: number; z: number; best: number}
type Sample = {t: number; x: number; y: number; z: number; vy: number};

/** The measures (for checking the rules against play): every press, whether it played the ball, the press-to-contact of a ball
 *  already in reach, the walk turning a stick against itself, the touches by seat and by tier. */
export interface VolleyStats {
  presses: number; near: number; nearPlayed: number; unplayed: number; cancelled: number;
  /** Press to contact (s) for presses made with the ball already within reach. */
  latency: number[];
  /** Ticks the walk's help pointed against a stick held past its dead zone (must stay 0). */
  against: number;
  /** Ticks the walk helped at all. */
  helped: number;
  tiers: Record<VolleyTier, number>; kinds: Record<string, number>;
  touches: Record<string, number>; attacks: Record<string, number>;
  /** Balls that were a person's (owner as they fell) let fall to their body or the floor with no press of theirs - and of
   *  those, hard ones (a spike or a JUMP SERVE at SPIKE_DIG.from or more) - and every ball that was a person's as it was
   *  played or fell, whoever played it. */
  unpressed: Record<string, number>; unpressedHard: Record<string, number>; owned: Record<string, number>;
  /** Seconds from the other side's spike or JUMP SERVE contact to the receive's best moment; spikes struck at
   *  each side, and those that side blocked (all, and STUFF BLOCKs); the setters' picks with a person ready, and those
   *  given to the person; SUPER SHOTs; DIVEs. */
  react: number[]; spikesAt: Record<string, number>; blocked: Record<string, number>; stuffed: Record<string, number>;
  ready: number; given: number; supers: number; dives: number;
  /** Bots' spikes, PERFECT ones among them, and blocks by kind (soft, STUFF). */
  botSpikes: Record<string, number>; botPerfect: Record<string, number>; soft: Record<string, number>; stuffs: Record<string, number>;
  /** Each side's possessions (from its first touch to the ball going over or down) and the touches in each. */
  possessions: number[];
  /** Point to the next serve's contact (s). */
  dead: number[];
  /** Sets laid for a person, by kind, and seconds from the set's contact to the spike's best moment. */
  setsFor: Record<string, number>; setTimes: Record<string, number[]>;
}

const DT = 1 / 60;
const flat = (a: {x: number; z: number}, b: {x: number; z: number}) => Math.hypot(a.x - b.x, a.z - b.z);
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
/** The ballistic velocity from `from` to (`x`, `y`, `z`) in `t` s, drag made up roughly (strike.ts's arc). */
function arc(from: Vec3, x: number, y: number, z: number, t: number, g: number, drag: number) {
  const k = 1 + drag * t * .5;
  return {vx: (x - from.x) / t * k, vy: ((y - from.y) + .5 * g * t * t) / t, vz: (z - from.z) / t * k};
}
/** Whether a ball leaving `b` at `v` is over the net by `over` m when it crosses (strike.ts's clears). */
function clears(b: Vec3, v: {vx: number; vy: number; vz: number}, g: number, over: number) {
  if (Math.abs(v.vz) < 1e-3 || Math.sign(-b.z) !== Math.sign(v.vz)) return true;
  const t = -b.z / v.vz, y = b.y + v.vy * t - .5 * g * t * t;
  return y > SPIKE_RULES.netHeight + SPIKE_RULES.ballRadius + over;
}
/** A side's own sign: its court's z (red -1, blue 1). */
const own = (team: BallTeam) => team === 'red' ? -1 : 1;

/** The tier a press `delta` seconds off its best moment earns. */
export function tierOf(delta: number): VolleyTier {
  const T = VOLLEY.tier;
  if (Math.abs(delta) <= T.perfect + 1e-9) return 'PERFECT';
  if (delta >= -T.early - 1e-9 && delta <= T.late + 1e-9) return 'GOOD';
  return delta < 0 ? 'EARLY' : 'LATE';
}
/** The walk's help (VOLLEY.walk): the stick `raw` turned onto the spot `to` (flat, from the body) and eased in, or left
 *  as it is. Never turned more than the cone, so never against the stick. */
export function walked(raw: {x: number; z: number}, to: {x: number; z: number}): {x: number; z: number; helped: boolean} {
  const W = VOLLEY.walk, m = Math.hypot(raw.x, raw.z), d = Math.hypot(to.x, to.z);
  if (m < W.dead || d < W.close) return {x: raw.x, z: raw.z, helped: false};
  const cos = (raw.x * to.x + raw.z * to.z) / (m * d);
  if (cos < Math.cos(W.cone)) return {x: raw.x, z: raw.z, helped: false};
  const k = Math.min(1, m) * Math.max(.35, Math.min(1, d / W.ease)) / d;
  return {x: to.x * k, z: to.z * k, helped: true};
}

/** The walk's help for a person (VOLLEY.person): a stick held within the cone is turned onto the spot as
 *  `walked` turns it; a stick at rest is walked there at a run, eased over `ease` m to a stop; a stick held further off is
 *  the person's own. Never against the stick. */
export function brought(raw: {x: number; z: number}, to: {x: number; z: number}): {x: number; z: number; helped: boolean} {
  const W = VOLLEY.walk, m = Math.hypot(raw.x, raw.z), d = Math.hypot(to.x, to.z);
  if (m >= W.dead) return walked(raw, to);
  if (d < W.close) return {x: raw.x, z: raw.z, helped: false};
  const k = Math.max(.35, Math.min(1, d / VOLLEY.person.ease)) / d;
  return {x: to.x * k, z: to.z * k, helped: true};
}

/** One Sky Spike match's volleyball rules (BallMatch keeps one when its options ask for `volleyball`). */
export class Volley {
  readonly stats: VolleyStats = {presses: 0, near: 0, nearPlayed: 0, unplayed: 0, cancelled: 0, latency: [], against: 0, helped: 0,
    tiers: {PERFECT: 0, GOOD: 0, EARLY: 0, LATE: 0, FLUBBED: 0}, kinds: {}, touches: {}, attacks: {}, unpressed: {}, unpressedHard: {}, owned: {}, possessions: [], dead: [], setsFor: {}, setTimes: {},
    react: [], spikesAt: {}, blocked: {}, stuffed: {}, ready: 0, given: 0, supers: 0, dives: 0, botSpikes: {}, botPerfect: {}, soft: {}, stuffs: {}};
  /** Each side's setter (a bot; none on a side of people), by role at the serve. */
  readonly setter: Partial<Record<BallTeam, string>> = {};
  /** The touch being played now and its spot, its owner, the last set. */
  plan: Plan | null = null;
  owner: string | null = null;
  lastSet: VolleySet | null = null;
  private readonly presses = new Map<string, Press>();
  private readonly raw = new Map<string, {x: number; z: number}>();
  private readonly commits = new Map<string, Commit>();
  private readonly takes: Record<string, string> = {};
  private readonly levels = new Map<string, VolleyLevel>();
  private readonly fc: Sample[] = Array.from({length: 150}, () => ({t: 0, x: 0, y: 0, z: 0, vy: 0}));
  private fcN = 0;
  private readonly scratch: BallContact[] = [];
  private possession: {team: BallTeam; touches: number} | null = null;
  private pointAt = -Infinity;
  private seed: number;
  private rng = () => { let x = this.seed; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; this.seed = x >>> 0 || 1; return this.seed / 0x100000000; };

  constructor(private readonly host: VolleyHost, seed: number) { this.seed = (seed * 2246822519 ^ 0x5bd1e995) >>> 0 || 1; }

  levelled(id: string, level: VolleyLevel) { this.levels.set(id, level); }
  /** A seat's body as the kernel has it (the bots read their team-mates'). */
  bodyOf(id: string) { return this.host.sim.actors.get(id)?.state; }
  levelOf(id: string): VolleyLevel { return this.levels.get(id) ?? 'normal'; }
  /** The volleyball rules' own draws (the bots' timing too): a classic match's are never touched. */
  draw() { return this.rng(); }

  // ─── Input: a press and the stick, a person's and a bot's alike ─────────────────────────────────────────────────
  /** A command from a seat (BallMatch.submit, or a bot's): the press noted (the first one counts while it waits), the
   *  stick kept for the walk, and the command the kernel plays - no attack, no guard, nothing of the fight. */
  input<T extends {moveX: number; moveZ: number; yaw: number; attack?: string; guard?: boolean; heavyHeld?: boolean; awaken?: boolean}>(id: string, input: T, now: number, aim?: {x: number; z: number}): T {
    this.raw.set(id, {x: input.moveX, z: input.moveZ});
    const ax = aim?.x ?? input.moveX, az = aim?.z ?? input.moveZ;
    // (A person's PLAY at the net as the other side attacks is the BLOCK - the jump, at once.)
    const blockJump = (input.attack === 'light' || input.attack === 'heavy') && this.blocking(id);
    if (blockJump) this.blockHold.set(id, now + VOLLEY.person.hold);
    else if (input.attack === 'light' || input.attack === 'heavy') this.press(id, now, input.yaw, ax, az, input.attack === 'heavy' ? 'tip' : 'play');
    // (The ultimate's button is the SUPER SHOT's only while you are up for the attack with the meter full.)
    else if (input.attack === 'ultimate' && this.superReady(id)) this.press(id, now, input.yaw, ax, az, 'super');
    // (BOOST at a low ball of yours just out of reach is the DIVE.)
    const dive = !!(input as {dash?: boolean}).dash && this.diveable(id);
    if (dive) this.press(id, now, input.yaw, ax, az, 'play', true);
    const out = {...input};
    // (The dive goes at the ball, with the stick at rest or toward it - never against it.)
    if (dive) {
      const p = this.host.sim.actors.get(id)!.state, to = this.plan ?? this.host.ball, dx = to.x - p.x, dz = to.z - p.z, d = Math.hypot(dx, dz) || 1, m = Math.hypot(input.moveX, input.moveZ);
      if (m < VOLLEY.walk.dead || input.moveX * dx + input.moveZ * dz >= 0) { out.moveX = dx / d; out.moveZ = dz / d; this.raw.set(id, {x: out.moveX, z: out.moveZ}); }
    }
    delete out.attack; delete out.guard; delete out.heavyHeld; delete out.awaken;
    if (blockJump) { (out as {jump?: boolean}).jump = true; (out as {jumpHeld?: boolean}).jumpHeld = true; }
    return out;
  }
  /** Whether a press by `id` now is a person's BLOCK - on the floor at the net as the other side attacks (the BLOCK
   *  prompt's place), with no ball of their own side's to play. */
  blocking(id: string) {
    const a = this.host.sim.actors.get(id), seat = this.host.seats.get(id);
    if (!a || !seat || seat.bot || !a.state.grounded || this.host.ball.held) return false;
    return Math.abs(a.state.z) <= VOLLEY.block.net + .6 && this.attacking(otherTeam(seat.team)) && sideOf(this.host.ball.z) !== seat.team;
  }
  /** Whether `id` is up for the attack (in the air, its side's third touch to come) with its meter full. */
  superReady(id: string) {
    const a = this.host.sim.actors.get(id), seat = this.host.seats.get(id);
    return !!a && !!seat && !a.state.grounded && a.state.ultimate >= 100 && this.touchFor(seat.team) === SPIKE_RULES.touches && this.plan?.team === seat.team;
  }
  /** Whether a dash by `id` now is a DIVE: a low ball of its side's to play, just past its reach. */
  diveable(id: string) {
    const a = this.host.sim.actors.get(id), seat = this.host.seats.get(id), b = this.host.ball, D = VOLLEY.dive;
    if (!a || !seat || !a.state.grounded || b.held || b.y > D.height || b.vy > 0) return false;
    if (sideOf(b.z) !== seat.team && !(this.plan?.team === seat.team && this.plan.touch === 1)) return false;
    if (this.touchFor(seat.team) > SPIKE_RULES.touches || (b.lastId === id && b.lastTeam === seat.team)) return false;
    const d = flat(a.state, this.plan?.team === seat.team ? this.plan : b);
    return d >= D.from && d <= D.to;
  }
  /** How long a floor press waits for its ball: a hard ball coming at the side is waited for longer (VOLLEY.dig). */
  private holdFor(team: BallTeam) {
    const b = this.host.ball;
    return !b.held && b.lastTeam !== team && Math.hypot(b.vx, b.vy, b.vz) >= SPIKE_DIG.from ? VOLLEY.dig.hold : VOLLEY.hold;
  }
  private press(id: string, now: number, yaw: number, x: number, z: number, slot: Press['slot'] = 'play', dive = false) {
    const a = this.host.sim.actors.get(id), seat = this.host.seats.get(id);
    if (!a || !seat || this.commits.has(id)) return;
    this.stats.presses++;
    const p = a.state, b = this.host.ball, r = SPIKE_RULES.ballRadius * (b.size || 1);
    // (Near the ball: within reach and the step, at a height a body plays it - and not a frame from the floor, which no
    // touch can be in time for.)
    const landing = this.fcN > 0 && this.fcN <= 2 && this.fc[this.fcN - 1].y < r + .2;
    const hard = Math.hypot(b.vx, b.vy, b.vz) >= SPIKE_DIG.from;
    // (In the air: within the hand's reach, as the air touch is committed.)
    const near = !b.held && !landing && (p.grounded ? flat(p, b) <= VOLLEY.reach + VOLLEY.step * (hard ? VOLLEY.hard.step : 1) && b.y >= VOLLEY.band.lo && b.y <= VOLLEY.band.hi : Math.hypot(b.x - p.x, b.y - p.y - VOLLEY.air.hand, b.z - p.z) <= VOLLEY.air.reach)
      && sideOf(b.z) === seat.team && this.touchFor(seat.team) <= SPIKE_RULES.touches && !(b.lastId === id && b.lastTeam === seat.team && this.host.view.touchTeam === seat.team);
    // (The first press counts: one made while it waits is not another.)
    // (A SUPER SHOT's or a TIP's button over a PLAY already waiting says which attack it is, the timing kept; a dive, its
    // reach.)
    const kept = this.presses.get(id);
    if (kept && now - kept.at <= (kept.air ? 2 : this.holdFor(seat.team))) { if (slot !== 'play') kept.slot = slot; if (dive) kept.dive = true; return; }
    if (near) { this.stats.near++; this.log?.(`near-press ${id} y=${b.y.toFixed(2)} vy=${b.vy.toFixed(1)} grounded=${p.grounded}`); }
    this.presses.set(id, {at: now, yaw, x, z, air: !p.grounded, near, slot, ...(dive ? {dive} : {})});
    if (dive) this.stats.dives++;
  }

  // ─── Each tick ─────────────────────────────────────────────────────────────────────────────────────────────────
  /** Before the kernel's step: the ball's flight ahead, whose it is, the walk, and the presses whose moment has come
   *  (their swing begun: SHOOT's quick strike draws it, BallMatch letting its blow by). */
  before(now: number) {
    const v = this.host.view;
    if (v.phase !== 'live' && v.phase !== 'kickoff') { for (const [id, p] of this.presses) if (p.near) this.log?.(`lost-phase ${id} ${v.phase}`); this.presses.clear(); this.commits.clear(); this.publish(now); return; }
    this.forecast(now);
    this.planNext(now);
    for (const seat of this.host.seats.values()) {
      const a = this.host.sim.actors.get(seat.id);
      if (!a) continue;
      // (Where each body last stood on the floor - its jump's takeoff, a hop at the net or the full jump: arcOf.)
      if (a.state.grounded) this.stood.set(seat.id, a.state.z);
      const raw = this.raw.get(seat.id) ?? {x: a.input.moveX, z: a.input.moveZ};
      const commit = this.commits.get(seat.id);
      let mx = raw.x, mz = raw.z, to: {x: number; z: number} | null = null;
      if (commit) {
        // The touch's own step: on to where the ball will be met, if the stick is at rest or toward it.
        const at = this.ballAt(commit.contactAt), dx = at.x - a.state.x, dz = at.z - a.state.z, d = Math.hypot(dx, dz), m = Math.hypot(raw.x, raw.z);
        if (a.state.grounded && d > VOLLEY.reach * .6 && (m < VOLLEY.walk.dead || raw.x * dx + raw.z * dz >= 0)) { const k = Math.min(1, d / .5) / d; mx = dx * k; mz = dz * k; }
      } else if (!seat.bot && a.state.grounded && (to = this.personSpot(seat, a.state, now))) {
        // (A person is brought to the ball, the attack, the block - VOLLEY.person.)
        const w = brought(raw, {x: to.x - a.state.x, z: to.z - a.state.z});
        if (w.helped) { this.stats.helped++; if (w.x * raw.x + w.z * raw.z < 0) this.stats.against++; }
        mx = w.x; mz = w.z;
      } else if (this.plan && this.owner === seat.id && a.state.grounded && this.plan.at - now <= VOLLEY.walk.within) {
        const w = walked(raw, {x: this.plan.x - a.state.x, z: this.plan.z - a.state.z});
        if (w.helped) { this.stats.helped++; if (w.x * raw.x + w.z * raw.z < 0) this.stats.against++; }
        mx = w.x; mz = w.z;
      }
      a.input.moveX = mx; a.input.moveZ = mz;
      // (Up at the net as the other side attacks, the body's arms go up - the kit's block take on the guard.)
      a.input.guard = !a.state.grounded && Math.abs(a.state.z) <= VOLLEY.block.net && this.attacking(otherTeam(seat.team));
      // (PLAY at the net as they attack is the block's jump, held its time.)
      if ((this.blockHold.get(seat.id) ?? -Infinity) > now) a.input.jumpHeld = true;
      this.tryCommit(seat, a, now);
    }
    this.publish(now);
  }
  /** After the ball's step: the touches whose contact has come, and a ball let fall to a body. */
  after(now: number, floored: boolean) {
    const v = this.host.view;
    // (A ball that hit the floor this tick is down: BallMatch judges the point.)
    if ((v.phase !== 'live' && v.phase !== 'kickoff') || floored) return;
    for (const c of [...this.commits.values()]) if (now + 1e-6 >= c.contactAt) { this.commits.delete(c.id); this.contact(c, now); }
    if (v.phase === 'live') { this.blocks(now); this.keeps(now); }
    // A floor press that waited its time with no ball is let go (an air press waits for the landing).
    for (const [id, p] of this.presses) {
      const a = this.host.sim.actors.get(id);
      const team = this.host.seats.get(id)?.team ?? 'red';
      if ((!p.air && now - p.at > this.holdFor(team)) || (p.air && a?.state.grounded && now - p.at > .1)) {
        this.presses.delete(id);
        if (p.near) { this.stats.unplayed++; const b = this.host.ball, q = a?.state; this.log?.(`unplayed ${id} air=${p.air} age=${(now - p.at).toFixed(2)} y=${b.y.toFixed(2)} vy=${b.vy.toFixed(1)} d=${q ? flat(q, b).toFixed(2) : '?'} side=${sideOf(b.z)} team=${this.host.seats.get(id)?.team} touches=${this.host.view.touches} last=${b.lastId}`); }
      }
    }
  }
  /** A point scored (BallMatch point): the rally's presses go, and the dead time's clock starts. */
  scored(now: number) {
    for (const [id, p] of this.presses) if (p.near) this.log?.(`lost ${id} age=${(now - p.at).toFixed(2)}`);
    this.presses.clear(); this.commits.clear(); this.pointAt = now; this.lastSet = null; this.closePossession();
  }
  /** A new serve (BallMatch serve): each side's setter, the bot nearest the net. */
  served(now: number) {
    for (const [id, p] of this.presses) if (p.near) this.log?.(`lost-serve ${id}`);
    this.presses.clear(); this.commits.clear(); this.lastSet = null; this.possession = null;
    for (const team of ['red', 'blue'] as const) {
      let best: string | undefined, bestZ = Infinity;
      for (const s of this.host.seats.values()) {
        if (s.team !== team || !s.bot) continue;
        const p = this.host.sim.actors.get(s.id)?.state;
        if (p && Math.abs(p.z) < bestZ) { bestZ = Math.abs(p.z); best = s.id; }
      }
      if (best) this.setter[team] = best; else delete this.setter[team];
    }
    this.publish(now);
  }

  // ─── The ball ahead ─────────────────────────────────────────────────────────────────────────────────────────────
  private forecast(now: number) {
    const b = this.host.ball;
    this.fcN = 0;
    if (b.held) return;
    const c: BallState = {...b};
    for (let i = 0; i < this.fc.length; i++) {
      this.scratch.length = 0;
      stepBall('sky-spike', c, DT, this.scratch);
      const s = this.fc[i]; s.t = now + (i + 1) * DT; s.x = c.x; s.y = c.y; s.z = c.z; s.vy = c.vy; this.fcN = i + 1;
      if (this.scratch.some(k => k.kind === 'floor' || k.kind === 'wall' || k.kind === 'ceiling')) break;
    }
  }
  /** Where the walk brings a person now (VOLLEY.person), or null (the walk as before, or their own stick): the set
   *  laid for them; while a team-mate plays the side's first or second touch, the set spot they will be given, a stride
   *  back from it; as the other side's set goes up, the net in front of it. */
  personSpot(seat: BallSeat, p: {x: number; z: number}, now: number): {x: number; z: number} | null {
    const plan = this.plan, P = VOLLEY.person, s = own(seat.team);
    if (!plan || this.host.ball.held) return null;
    if (plan.team === seat.team) {
      // (Their own ball to receive or set is the walk's as it always was - a stick toward it is helped, and reading it and
      // standing right is the skill; the set laid for them is brought.)
      if (this.owner === seat.id) return plan.air || plan.touch === SPIKE_RULES.touches ? {x: plan.x, z: plan.z} : null;
      // (A team-mate's touch first: the set spot this person will be given, a stride back to run into it.)
      if (plan.touch < SPIKE_RULES.touches) {
        const sp = this.spots(seat.team, this.host.ball.x), list = [sp.left, sp.right, sp.back];
        let best = list[0], bestD = Infinity;
        // (Two people on a side - a couch's - each to their own: a spot another person is nearer is theirs.)
        const others = [...this.host.seats.values()].filter(q => q.team === seat.team && !q.bot && q.id !== seat.id).map(q => this.host.sim.actors.get(q.id)?.state).filter(q => !!q);
        for (const q of list) { const d = flat(p, q); if (d < bestD && !others.some(o => flat(o!, q) < d)) { bestD = d; best = q; } }
        return {x: best.x, z: best.z + s * P.behind};
      }
      return null;
    }
    // (Their set up for their attack: to the net in front of it, to block.)
    const set = this.lastSet;
    if (plan.touch === SPIKE_RULES.touches && set && set.team === plan.team && plan.air) return {x: clamp(set.x, -this.court.x + .5, this.court.x - .5), z: s * P.blockZ};
    return null;
  }
  private readonly blockHold = new Map<string, number>();
  /** Each body's z where it last stood on the floor (the takeoff of the jump it is in). */
  private readonly stood = new Map<string, number>();
  /** The arc of the jump `id` is in, or would take from where it stands: the block's hop from the net, else the
   *  volleyball jump (the kernel's choice: simulation.ts sportJump). */
  arcOf(id: string, p: {z: number; grounded?: boolean; fighter: FighterId}) {
    const z = p.grounded === false ? this.stood.get(id) ?? p.z : p.z;
    return Math.abs(z) <= VOLLEY_JUMP.hop.within ? hopArc(p.fighter) : volleyArc(p.fighter);
  }
  /** Where the ball is at room time `t` (the flight ahead; now, or the last forecast point past it). */
  ballAt(t: number): {x: number; y: number; z: number} {
    const b = this.host.ball;
    if (b.held || !this.fcN || t <= this.fc[0].t - DT) return b;
    const i = clamp(Math.round((t - this.fc[0].t) / DT), 0, this.fcN - 1);
    return this.fc[i];
  }
  /** The side's next touch number (4: its touches are spent). */
  private touchFor(team: BallTeam) { const v = this.host.view; return (v.touchTeam === team ? v.touches : 0) + 1; }
  /** Which side plays the ball next and which of its touches, and the touch's spot and best moment. */
  private planNext(now: number) {
    const b = this.host.ball, v = this.host.view;
    this.plan = null;
    if (b.held) { this.owner = v.phase === 'kickoff' ? v.serverId : null; return; }
    // The side: where the flight comes down through head height (over the net, the other side's first touch).
    let team: BallTeam = sideOf(b.z);
    for (let i = 0; i < this.fcN; i++) { const s = this.fc[i]; if (s.y < 2.4 && s.vy < 0) { team = sideOf(s.z); break; } }
    let touch = team === v.touchTeam ? v.touches + 1 : 1;
    // (A set laid is its hitter's until its moment has gone, even one flying on toward the net and over it - a set
    // from deep in the court did, and its hitter was never told to jump.)
    if (this.court !== spikeCourt() && this.lastSet && b.shot === 'set' && v.touchTeam === this.lastSet.team && v.touches === SPIKE_RULES.touches - 1 && now <= this.lastSet.best + .4) { team = this.lastSet.team; touch = SPIKE_RULES.touches; }
    if (touch > SPIKE_RULES.touches) { this.owner = null; return; }
    // (A set no touch of these rules laid - LEARN TO PLAY's machine, a drill's - is read off its flight: coming down
    // through a hitter's hand at the top of a jump, for the side's player nearest there.)
    if (touch === 3 && b.shot === 'set' && !(this.lastSet && this.lastSet.team === team)) {
      for (let i = 0; i < this.fcN; i++) {
        const f = this.fc[i];
        if (f.vy >= 0 || f.y > 6 || sideOf(f.z) !== team) continue;
        const hitter = this.nearestTo(team, f, '');
        if (hitter) this.lastSet = {team, hitter, tier: 'GOOD', kind: 'high', at: now, x: f.x, z: f.z, best: f.t};
        break;
      }
    }
    const set = this.lastSet && this.lastSet.team === team && touch === 3 && b.shot === 'set' ? this.lastSet : null;
    if (set) {
      this.plan = {team, touch, x: set.x, y: 0, z: set.z, at: set.best, air: true};
    } else {
      const h = touch === 1 ? VOLLEY.ideal.receive : touch === 2 ? VOLLEY.ideal.set : VOLLEY.ideal.over;
      let found: Sample | undefined;
      for (let i = 0; i < this.fcN; i++) { const s = this.fc[i]; if (sideOf(s.z) === team && Math.abs(s.z) > .3 && s.y <= h && (s.vy < 0 || s.y < .8)) { found = s; break; } }
      const at = found ?? (sideOf(b.z) === team ? {t: now, x: b.x, y: b.y, z: b.z} : undefined);
      if (!at) { this.owner = null; return; }
      this.plan = {team, touch, x: at.x, y: at.y, z: at.z, at: at.t, air: false};
      // (The time a receiver has from the other side's spike or JUMP SERVE to the receive's best moment.)
      if (this.attackAt && this.attackAt.team !== team && touch === 1 && found) { this.stats.react.push(at.t - this.attackAt.at); this.attackAt = null; }
    }
    // Out by a stride or more: nobody's (a press near it still plays it).
    const R = SPIKE_RULES, p = this.plan;
    if (!set && (Math.abs(p.x) > this.court.x + .3 || Math.abs(p.z) > this.court.z + .3)) { this.owner = null; return; }
    this.owner = this.whose(p, set, now);
  }
  /** Whose ball it is (VOLLEY.own): the side's player soonest at the spot. A person's lead holds only while they can still
   *  get there in time - a bot never leaves a ball to a person who is not there to play it. */
  private whose(p: Plan, set: VolleySet | null, now: number): string | null {
    const O = VOLLEY.own, left = Math.max(0, p.at - now), b = this.host.ball;
    let best: string | null = null, bestScore = Infinity;
    const scoreOf = (seat: BallSeat) => {
      const q = this.host.sim.actors.get(seat.id)?.state;
      if (!q) return Infinity;
      const d = flat(q, p), eta = Math.max(0, d - VOLLEY.reach - VOLLEY.step) / O.run, can = eta <= left + .05;
      let s = eta + (can ? 0 : 5);
      // (A person is the side's hitter - the second touch is a bot's while one can get there.)
      if (can && !seat.bot) s += p.touch === 2 && this.setter[seat.team] ? VOLLEY.person.second : p.touch === 3 && !set ? -VOLLEY.person.third : -O.person;
      if (can && p.touch === 2 && this.setter[seat.team] === seat.id && b.lastId !== seat.id) s -= O.setter;
      if (this.owner === seat.id) s -= O.keep;
      if (b.lastId === seat.id && b.lastTeam === seat.team && this.host.view.touchTeam === seat.team) s += O.again + 5;
      return s;
    };
    if (set) { const hitter = this.host.seats.get(set.hitter); if (hitter && scoreOf(hitter) < 5) return hitter.id; }
    for (const seat of this.host.seats.values()) {
      if (seat.team !== p.team) continue;
      const s = scoreOf(seat);
      if (s < bestScore) { bestScore = s; best = seat.id; }
    }
    return best;
  }

  // ─── A press meeting its moment ────────────────────────────────────────────────────────────────────────────────
  private tryCommit(seat: BallSeat, a: NonNullable<ReturnType<ArenaSimulation['actors']['get']>>, now: number) {
    const press = this.presses.get(seat.id);
    if (!press || this.commits.has(seat.id)) return;
    const b = this.host.ball, v = this.host.view, p = a.state, C = VOLLEY.contact;
    // One touch at a time on a side: a team-mate's under way leaves this press waiting.
    for (const c of this.commits.values()) if (c.team === seat.team) return;
    // The serve.
    if (b.held) {
      if (v.phase !== 'kickoff' || v.serverId !== seat.id) return;
      const air = !p.grounded, hand = {x: p.x, y: p.y + VOLLEY.air.hand, z: p.z};
      if (!air && flat(p, b) <= VOLLEY.reach + VOLLEY.step) this.commit(seat, a, 'float', now, 0, press, 0);
      else if (air && Math.hypot(b.x - hand.x, b.y - hand.y, b.z - hand.z) <= VOLLEY.air.reach + .6) this.commit(seat, a, 'jumpServe', now, 0, press, 0);
      return;
    }
    const touch = this.touchFor(seat.team);
    if (touch > SPIKE_RULES.touches) return;
    // (Volleyball's rule: nobody plays the ball twice running - the press waits for the next ball.)
    if (b.lastId === seat.id && b.lastTeam === seat.team && v.touchTeam === seat.team) return;
    if (!p.grounded) {
      // In the air: the hand, where it is now, meets the ball when the ball comes within its reach - the swing brakes
      // the jump, so the jump's height as it leaves is the touch's (a spike's tier: the jump is its timing).
      const at = this.ballAt(now + C), hy = p.y + VOLLEY.air.hand;
      if (sideOf(at.z) !== seat.team && Math.abs(at.z) > .9) return;
      // (At its nearest to the hand by the contact - or as good as there - so the swing meets it rather than reaches.)
      const d = Math.hypot(at.x - p.x, at.y - hy, at.z - p.z), on = this.ballAt(now + C + DT), dn = Math.hypot(on.x - p.x, on.y - hy, on.z - p.z);
      if (d <= VOLLEY.air.reach && (d <= VOLLEY.air.meet || dn >= d)) this.commit(seat, a, touch === 3 ? 'spike' : 'keep', now, 0, press, touch);
      return;
    }
    // On the floor: the best moment is the ball coming down through the touch's height within reach and the step.
    // (A hard ball - a spike, a JUMP SERVE - leaves no time for the step's whole length: `hard` of it.)
    const hard = Math.hypot(b.vx, b.vy, b.vz) >= SPIKE_DIG.from;
    const h = touch === 1 ? VOLLEY.ideal.receive : touch === 2 ? VOLLEY.ideal.set : VOLLEY.ideal.over, zone = VOLLEY.reach + VOLLEY.step * (hard ? VOLLEY.hard.step : 1) + (press.dive ? VOLLEY.dive.reach : 0);
    let ideal: number | undefined;
    if (sideOf(b.z) === seat.team && b.y <= h && b.y >= VOLLEY.band.lo && (b.vy < 0 || b.y < .8) && flat(p, b) <= zone) {
      // Already past it (a late press, or a ball that never came higher): played now, late by how far it has fallen.
      ideal = now - Math.max(0, h - b.y) / Math.max(2, -b.vy);
    } else for (let i = 0; i < this.fcN; i++) {
      const s = this.fc[i];
      if (sideOf(s.z) !== seat.team || s.y > h || !(s.vy < 0 || s.y < .8) || s.y < VOLLEY.band.lo) continue;
      if (flat(p, s) <= zone) { ideal = s.t; break; }
    }
    // (A press with the ball within reach and playable now, its moment never to come within reach - a hard ball going
    // past and down - plays it now: a press near the ball always plays it.)
    if (ideal === undefined && sideOf(b.z) === seat.team && b.y >= VOLLEY.band.lo && b.y <= VOLLEY.band.hi && flat(p, b) <= zone) ideal = now + C;
    if (ideal === undefined || ideal - C > now + 1e-6) return;
    const kind: VolleyKind = touch === 1 ? 'receive' : touch === 2 ? 'set' : 'over';
    this.commit(seat, a, kind, now, press.at - (ideal - C), press, touch, hard && touch === 1);
  }
  private commit(seat: BallSeat, a: NonNullable<ReturnType<ArenaSimulation['actors']['get']>>, kind: VolleyKind, now: number, delta: number, press: Press, touch: number, hard = false) {
    const b = this.host.ball, v = this.host.view;
    this.presses.delete(seat.id);
    const take = this.takeFor(seat, a.state, kind, press);
    // (A late press is still a touch: its contact comes sooner, before the ball gets out of reach or to the floor - the
    // swing hurried rather than the ball missed.)
    let contactAt = now + VOLLEY.contact;
    if (!b.held && a.state.grounded) {
      const zone = VOLLEY.reach + VOLLEY.step + .5, low = SPIKE_RULES.ballRadius * (b.size || 1) + .1;
      for (let i = 0; i < this.fcN; i++) {
        const f = this.fc[i];
        if (f.t > contactAt + DT + 1e-6) break;
        // (A tick to spare: the floor's own tick judges the point before any touch of that tick.)
        if (f.y < low || i === this.fcN - 1 || flat(a.state, f) > zone) { contactAt = Math.max(now + DT, f.t - 2 * DT); break; }
      }
    }
    this.commits.set(seat.id, {id: seat.id, kind, at: now, contactAt, delta, press, touch, team: seat.team, lastId: b.lastId, touches: v.touchTeam === seat.team ? v.touches : 0, take, fromY: a.state.y,
      // (A hard ball's dig pressed before its moment is tiered by placement: where the ball meets the body.)
      ...(hard && delta <= 1e-6 ? {place: this.closest(a.state)} : {})});
    this.takes[seat.id] = take;
    // The swing that draws it: SHOOT's quick strike (a tap), its blow let by (BallMatch.received), its take the kit's.
    const at = this.ballAt(now + VOLLEY.contact), yaw = Math.atan2(at.x - a.state.x, at.z - a.state.z);
    a.input = {...a.input, attack: 'heavy', heavyHeld: false, yaw: Number.isFinite(yaw) ? yaw : a.input.yaw};
    a.attackSeq = a.input.seq; a.attackYaw = a.input.yaw; a.attackMoveX = 0; a.attackMoveZ = 0; a.heldPress = undefined;
  }
  /** How near (flat m) the ball's flight ahead comes to `p` before it lands: where it meets the body. */
  private closest(p: {x: number; z: number}) {
    let d = flat(p, this.host.ball);
    for (let i = 0; i < this.fcN; i++) d = Math.min(d, flat(p, this.fc[i]));
    return d;
  }
  private takeFor(seat: BallSeat, p: PlayerState, kind: VolleyKind, press: Press): string {
    if (kind === 'float' || kind === 'over') return 'SS.float';
    if (kind === 'jumpServe') return 'SS.jumpServe';
    if (kind === 'receive') return 'SS.dig';
    if (kind === 'keep') return 'SS.setAir';
    if (kind === 'set') return this.setKind(seat, press).kind === 'back' ? 'SS.backSet' : 'SS.set';
    if (press.slot === 'tip') return 'SS.tip';
    const zone = placement(this.striker(seat, p, press), seat.team);
    return press.slot === 'super' ? 'SS.spike' : zone?.f && zone.f < 0 ? 'SS.spikeRoll' : zone?.a ? 'SS.spikeCut' : 'SS.spike';
  }
  private striker(seat: BallSeat, p: PlayerState, press: Press): Striker {
    const yaw = press.yaw, mx = press.x, mz = press.z;
    return {id: seat.id, team: seat.team, x: p.x, y: p.y, z: p.z, grounded: p.grounded, aimYaw: yaw, awakened: !!p.awakened,
      forward: mx * Math.sin(yaw) + mz * Math.cos(yaw), lateral: -mx * Math.cos(yaw) + mz * Math.sin(yaw), chain: 0};
  }

  // ─── The touch itself ──────────────────────────────────────────────────────────────────────────────────────────
  private contact(c: Commit, now: number) {
    const seat = this.host.seats.get(c.id), a = this.host.sim.actors.get(c.id), b = this.host.ball, v = this.host.view;
    if (!seat || !a) return;
    const p = a.state, serve = c.kind === 'float' || c.kind === 'jumpServe';
    // Still the ball it was pressed for: nobody else's touch since, and within the reach it was committed at.
    const same = serve ? b.held && v.phase === 'kickoff' : !b.held && b.lastId === c.lastId && (v.touchTeam === seat.team ? v.touches : 0) === c.touches;
    const reach = p.grounded || serve ? flat(p, b) <= VOLLEY.reach + VOLLEY.step + .5 + (c.press.dive ? VOLLEY.dive.reach : 0) : Math.hypot(b.x - p.x, b.y - Math.max(p.y, c.fromY) - VOLLEY.air.hand, b.z - p.z) <= VOLLEY.air.reach + .6;
    if (!same || !reach) { this.stats.cancelled++; this.log?.(`cancel ${c.kind} ${c.id} same=${same} reach=${reach} grounded=${p.grounded} d=${flat(p, b).toFixed(2)} dy=${(b.y - p.y).toFixed(2)}`); return; }
    if (c.press.near) { this.stats.nearPlayed++; this.log?.(`near-played ${c.id}`); }
    // (Press to contact, for a press made with its moment already come - its swing begun on the tick it was heard: the
    // game's answer to a press. An early press waits for its ball, by design.)
    if (c.at - c.press.at <= DT + 1e-6) this.stats.latency.push(now - c.press.at);
    const incoming = Math.hypot(b.vx, b.vy, b.vz);
    let tier: VolleyTier = tierOf(c.delta), label = '';
    let shot: ShotKind = 'bump';
    if (c.kind === 'float' || c.kind === 'jumpServe') {
      const jump = c.kind === 'jumpServe', J = VOLLEY.jumpServe, share = jump ? Math.max(p.y, c.fromY) / Math.max(.1, volleyArc(p.fighter).apex) : 0, perfect = jump && share >= J.apex;
      let spray: {x: number; z: number} | undefined;
      if (jump && !perfect) { const k = clamp((J.apex - share) / (J.apex - J.low), 0, 1), on = onCourt(this.court, 1, 1); spray = {x: (this.rng() * 2 - 1) * (J.spray * .5 + J.wide * k) * on.x, z: (J.spray + J.wild * k * (.6 + this.rng() * .4)) * on.z}; }
      const r = strikeBall(b, {mode: 'sky-spike', slot: jump ? 'heavy' : 'light', move: TOUCH, knockback: 1, launch: false, finisher: false, pushX: 0, pushZ: 0, serve: true, touches: SPIKE_RULES.touches,
        perfect, spray, gravity: b.grav || 1, striker: this.striker(seat, p, c.press)});
      this.fly(b, r); b.heat = Math.min(BALL_RULES.heatMax, b.heat + r.heat); shot = 'serve';
      tier = jump ? perfect ? 'PERFECT' : share >= VOLLEY.spike.good ? 'GOOD' : (this.host.motion(seat.id)?.vy ?? 0) > 0 ? 'EARLY' : 'LATE' : 'GOOD';
      label = jump ? 'JUMP SERVE' : 'FLOAT SERVE';
      this.host.served(seat, perfect, !jump);
      if (perfect) this.host.award(seat, 'perfectServe');
      if (this.pointAt > -Infinity) { this.stats.dead.push(now - this.pointAt); this.pointAt = -Infinity; }
    } else if (c.kind === 'receive' || c.kind === 'keep' && c.touch === 1) {
      // (A hard ball's held dig, by placement; a dive is a scramble, GOOD at best.)
      if (c.place !== undefined) tier = c.place <= VOLLEY.dig.perfect ? 'PERFECT' : c.place <= VOLLEY.dig.good ? 'GOOD' : 'LATE';
      if (c.press.dive && tier === 'PERFECT') tier = 'GOOD';
      if (b.super) tier = tier === 'PERFECT' || tier === 'GOOD' ? 'LATE' : 'FLUBBED';
      // (A PERFECT SPIKE is harder to dig: the receive's tier one worse.)
      if (VOLLEY.hard.down && this.hotSpike && c.kind === 'receive') tier = tier === 'PERFECT' ? 'GOOD' : tier === 'GOOD' ? (c.delta < 0 ? 'EARLY' : 'LATE') : 'FLUBBED';
      label = this.receive(seat, p, tier, incoming);
      shot = 'bump';
      if (c.press.dive && incoming >= SPIKE_DIG.from) this.dived = true;
    } else if (c.kind === 'set' || c.kind === 'keep') {
      label = this.set(seat, p, c.press, c.kind === 'keep' ? 'GOOD' : tier, now);
      shot = 'set';
    } else if (c.kind === 'spike') {
      // (How cleanly the hand met it: the ball's distance from the hand at the jump's height as the swing left.)
      const r = this.spike(seat, p, c.press, c.fromY, Math.hypot(b.x - p.x, b.y - Math.max(p.y, c.fromY) - VOLLEY.air.hand, b.z - p.z));
      tier = r.tier; label = r.label; shot = r.shot;
      // (A spike's hit-stop - a court of the volleyball rules only, LEARN TO PLAY's left as it was.)
      const hold = shot === 'super' ? VOLLEY.stop.super : shot === 'spike' ? VOLLEY.stop[tier] : 0;
      if (hold && this.court !== spikeCourt()) this.host.stop?.(seat, hold);
    } else {
      this.over(seat, p, c.press, tier === 'PERFECT' || tier === 'GOOD' ? 1 : .85);
      label = 'OVER'; shot = 'pop';
    }
    // (The strike's own event, as a fighter's strike makes one - the sound, the words, the moments, LEARN TO PLAY.)
    if (shot === 'spike' || shot === 'tip' || shot === 'serve') this.host.emit('strike', {team: seat.team, actorId: seat.id, x: b.x, y: b.y, z: b.z, shot, value: Math.round(Math.hypot(b.vx, b.vy, b.vz)),
      text: shot === 'tip' ? 'TIP' : shot === 'serve' ? (tier === 'PERFECT' ? 'PERFECT SERVE' : label) : tier === 'PERFECT' ? 'SKY SPIKE' : undefined, perfect: (shot !== 'tip' && tier === 'PERFECT') || undefined});
    if (shot === 'spike' || shot === 'super' || (shot === 'serve' && c.kind === 'jumpServe')) this.attackAt = {team: seat.team, at: now};
    this.log?.(`touch ${seat.id} ${label} ${tier} delta=${c.delta.toFixed(3)} y=${b.y.toFixed(2)} grounded=${p.grounded} share=${(Math.max(p.y, c.fromY) / this.arcOf(c.id, p).apex).toFixed(2)}`);
    this.played(seat, shot, tier, label, serve, incoming, now);
  }
  /** The velocity that brings the ball to (`x`, `y`, `z`) in `t` s as the court's own flight carries it - its drag, an
   *  arena's wind - found by flying it ahead and mending the miss a few times (an arc alone drifted a set a metre and
   *  more off its hitter on a windy court). */
  private aimed(b: BallState, x: number, y: number, z: number, t: number) {
    const g = SPIKE_RULES.gravity * (b.grav || 1), v = arc(b, x, y, z, t, g, SPIKE_RULES.drag), n = Math.max(1, Math.round(t / DT));
    for (let k = 0; k < 4; k++) {
      const c: BallState = {...b, vx: v.vx, vy: v.vy, vz: v.vz, sx: 0, sy: 0, sz: 0, held: false};
      for (let i = 0; i < n; i++) { this.scratch.length = 0; stepBall('sky-spike', c, DT, this.scratch); }
      const ex = x - c.x, ey = y - c.y, ez = z - c.z;
      if (Math.abs(ex) + Math.abs(ey) + Math.abs(ez) < .05) break;
      v.vx += ex / t; v.vy += ey / t; v.vz += ez / t;
    }
    return v;
  }
  private fly(b: BallState, r: {vx: number; vy: number; vz: number; sx: number; sy: number; sz: number}) {
    b.vx = r.vx; b.vy = r.vy; b.vz = r.vz; b.sx = r.sx; b.sy = r.sy; b.sz = r.sz;
  }
  /** The bookkeeping every touch shares: the side's count, the card, the heat a pass adds, the meter, the touch's line. */
  private played(seat: BallSeat, shot: ShotKind, tier: VolleyTier, label: string, serve: boolean, incoming: number, now: number) {
    const b = this.host.ball;
    if (!serve && this.owner && !this.host.seats.get(this.owner)?.bot && this.host.seats.get(this.owner)?.team === seat.team) this.stats.owned[this.owner] = (this.stats.owned[this.owner] ?? 0) + 1;
    if (shot !== 'spike') this.hotSpike = false;
    if (shot !== 'super') b.super = false;
    if (!serve) {
      if (shot !== 'spike' && this.host.passed(seat, now)) b.heat = Math.min(BALL_RULES.heatMax, b.heat + SPIKE_RULES.passHeat);
      b.shot = shot;
      this.host.touched(seat, shot);
      if (shot === 'bump' && incoming >= SPIKE_DIG.from && tier !== 'FLUBBED') { this.host.dug(seat, incoming, this.dived); label = this.dived ? 'DIVING DIG' : 'DIG'; }
      this.dived = false;
    }
    this.host.meter(seat.id, shot === 'spike' ? 4 : 2, 2);
    this.stats.tiers[tier]++; this.stats.kinds[label] = (this.stats.kinds[label] ?? 0) + 1; this.stats.touches[seat.id] = (this.stats.touches[seat.id] ?? 0) + 1;
    if (shot === 'spike' || shot === 'pop' || shot === 'tip' || shot === 'super') this.stats.attacks[seat.id] = (this.stats.attacks[seat.id] ?? 0) + 1;
    if (!serve) {
      if (this.possession?.team !== seat.team) { this.closePossession(); this.possession = {team: seat.team, touches: 0}; }
      this.possession.touches++;
      if (shot === 'spike' || shot === 'pop' || shot === 'tip' || shot === 'super') this.closePossession();
    }
    this.host.emit('touch', {team: seat.team, actorId: seat.id, x: b.x, y: b.y, z: b.z, shot, text: `${label} · ${tier}`, value: Math.round(Math.hypot(b.vx, b.vy, b.vz)), perfect: tier === 'PERFECT' || undefined});
  }
  private closePossession() { if (this.possession) this.stats.possessions.push(this.possession.touches); this.possession = null; }

  /** The receive: to the setter's spot, off by the tier. */
  private receive(seat: BallSeat, p: Vec3, tier: VolleyTier, incoming: number) {
    const b = this.host.ball, P = VOLLEY.pass, s = own(seat.team), g = SPIKE_RULES.gravity * (b.grav || 1);
    if (tier === 'FLUBBED') { this.flub(seat); return 'RECEIVE'; }
    const setter = this.setter[seat.team] && this.setter[seat.team] !== seat.id ? this.host.sim.actors.get(this.setter[seat.team]!)?.state : undefined;
    const C = this.court, mid = onCourt(C, 3, 6);
    const hx = setter && Math.abs(setter.z) < 3.5 ? clamp(setter.x, -mid.x, mid.x) : P.x * -s, miss = P.miss[tier as keyof typeof P.miss] ?? 0, ang = this.rng() * Math.PI * 2;
    const tx = clamp(hx + Math.sin(ang) * miss, -C.x + 1, C.x - 1), tz = s * clamp(P.z + Math.cos(ang) * miss, 1.2, mid.z);
    const dig = incoming >= SPIKE_DIG.from, t = dig ? P.digSeconds : P.seconds;
    this.fly(b, {...this.aimed(b, tx, dig ? P.digHeight : P.height, tz, t), sx: 0, sy: 0, sz: 0});
    return 'RECEIVE';
  }
  /** FLUBBED: low and short toward the middle of the side's own court. */
  private flub(seat: BallSeat) {
    const b = this.host.ball, F = VOLLEY.flub, s = own(seat.team), g = SPIKE_RULES.gravity * (b.grav || 1), off = this.rng() * 2 - 1;
    const C = this.court, mz = s * onCourt(C, 0, 4.5).z - b.z, mx = -b.x, m = Math.hypot(mx, mz), yaw = (m > .5 ? Math.atan2(mx, mz) : Math.atan2(0, s)) + off * F.turn, d = (F.near + F.far) / 2 + (F.far - F.near) / 2 * off;
    const tx = clamp(b.x + Math.sin(yaw) * d, -C.x + .8, C.x - .8), tz = s * clamp(s * (b.z + Math.cos(yaw) * d), 1.2, C.z - .8);
    this.fly(b, {...this.aimed(b, tx, F.height, tz, F.seconds), sx: 0, sy: 0, sz: 0}); void g;
  }
  /** The set the stick names (VOLLEY.set): its kind, its spot and its hitter. */
  setKind(seat: BallSeat, press: Press): {kind: 'high' | 'back' | 'quick'; x: number; z: number; hitter: string | null} {
    const S = VOLLEY.set, b = this.host.ball, s = own(seat.team), p = this.host.sim.actors.get(seat.id)?.state ?? b;
    const zone = placement(this.striker(seat, p as PlayerState, press), seat.team);
    const spots = this.spots(seat.team, b.x);
    let spot: {x: number; z: number; kind: 'high' | 'back' | 'quick'}, given: string | undefined;
    if (zone && (zone.a || zone.f)) {
      // (PLACE's square: toward the far court is toward the net from a setter's side - the QUICK; back, the back row.)
      if (Math.abs(zone.f) > Math.abs(zone.a)) spot = zone.f > 0 ? spots.quick : spots.back;
      else spot = zone.a < 0 ? spots.left : spots.right;
    } else { const auto = this.autoSpot(seat, spots); spot = auto.spot; given = auto.hitter; }
    const hitter = given ?? this.nearestTo(seat.team, spot, seat.id);
    // (A BACK SET: to the wing behind the setter - the far side of them from the court's middle.)
    const sx = (p as {x: number}).x, kind = spot.kind === 'high' && Math.abs(spot.z) < S.backZ - .5 && Math.sign(spot.x - sx) === Math.sign(sx || 1) && Math.abs(spot.x - sx) >= 1.5 ? 'back' : spot.kind;
    void s;
    return {kind, x: spot.x, z: spot.z, hitter};
  }
  /** The set's spots for `team`, the QUICK's a step from the ball toward the court's middle. */
  spots(team: BallTeam, bx: number) {
    const S = VOLLEY.set, s = own(team), W = this.wing, back = onCourt(this.court, 3, 0).x;
    return {
      left: {x: -W, z: s * S.z, kind: 'high' as const}, right: {x: W, z: s * S.z, kind: 'high' as const},
      quick: {x: clamp(bx - Math.sign(bx || 1) * S.quickStep, -W, W), z: s * S.quickZ, kind: 'quick' as const},
      back: {x: clamp(bx * .3, -back, back), z: s * Math.min(S.backZ, this.court.z * .45), kind: 'high' as const},
    };
  }
  /** The court in play (volleyball's for three a side; the classic's in LEARN TO PLAY), and a wing set's x on it. */
  get court() { return spikeCourt(this.host.ball); }
  get wing() { return Math.min(VOLLEY.set.wing, this.court.x - 1); }
  /** The setter's own pick with the stick at rest. A person who can get to a set spot (VOLLEY.person.reach: the
   *  walk brings them) is the hitter, always - the spot nearest them; else the hitter nearest a spot. */
  private autoSpot(seat: BallSeat, spots: ReturnType<Volley['spots']>): {spot: {x: number; z: number; kind: 'high' | 'back' | 'quick'}; hitter?: string} {
    const list = [spots.left, spots.right, spots.back];
    let pick: {x: number; z: number; kind: 'high' | 'back' | 'quick'} | undefined, bestD = Infinity, who: string | undefined;
    for (const other of this.host.seats.values()) {
      if (other.team !== seat.team || other.id === seat.id || other.bot) continue;
      const q = this.host.sim.actors.get(other.id)?.state;
      if (!q || sideOf(q.z) !== seat.team) continue;
      for (const sp of list) { const d = flat(q, sp); if (d < VOLLEY.person.reach && d < bestD) { bestD = d; pick = sp; who = other.id; } }
    }
    if (pick) { if (seat.bot) { this.stats.ready++; this.stats.given++; } return {spot: pick, hitter: who}; }
    for (const other of this.host.seats.values()) {
      if (other.team !== seat.team || other.id === seat.id) continue;
      const q = this.host.sim.actors.get(other.id)?.state;
      if (!q) continue;
      for (const sp of list) { const d = flat(q, sp); if (d < bestD) { bestD = d; pick = sp; } }
    }
    return {spot: pick ?? spots.left};
  }
  private nearestTo(team: BallTeam, spot: {x: number; z: number}, not: string) {
    let best: string | null = null, bestD = Infinity;
    for (const s of this.host.seats.values()) {
      if (s.team !== team || s.id === not) continue;
      const q = this.host.sim.actors.get(s.id)?.state;
      if (q && flat(q, spot) < bestD) { bestD = flat(q, spot); best = s.id; }
    }
    return best;
  }
  /** The set: to its spot, coming down through the hitter's hand at the top of their jump (a QUICK's on the way up). */
  private set(seat: BallSeat, p: Vec3, press: Press, tier: VolleyTier, now: number) {
    const b = this.host.ball, S = VOLLEY.set, g = SPIKE_RULES.gravity * (b.grav || 1);
    if (tier === 'FLUBBED') { this.flub(seat); this.lastSet = null; return 'SET'; }
    const k = this.setKind(seat, press), hitter = k.hitter ? this.host.sim.actors.get(k.hitter)?.state : undefined;
    const apex = hitter ? volleyArc(hitter.fighter).apex : VOLLEY_JUMP.apex;
    const miss = S.miss[tier as keyof typeof S.miss] ?? 0, ang = this.rng() * Math.PI * 2, high = tier === 'EARLY' || tier === 'LATE' ? (this.rng() < .5 ? -1 : 1) * S.high : 0;
    const tx = clamp(k.x + Math.sin(ang) * miss, -this.court.x + .6, this.court.x - .6), tz = k.z + Math.cos(ang) * miss * .5;
    const H = (k.kind === 'quick' ? S.quickHeight : apex + S.reach) + high, t = k.kind === 'quick' ? S.quick : k.kind === 'back' ? S.back : S.seconds;
    this.fly(b, {...this.aimed(b, tx, H, tz, t), sx: 0, sy: 0, sz: 0}); void g;
    // The spike's best moment: a high set's coming down through the hand at the top of the jump; a QUICK's coming down
    // through `quickMeet`, met by a hitter on the way up (SpikeCues' JUMP cue says the same: SPIKE_TIMING.low).
    let best = now + t;
    if (k.kind === 'quick') {
      const c: BallState = {...b, held: false};
      for (let i = 0; i < 120; i++) { this.scratch.length = 0; stepBall('sky-spike', c, DT, this.scratch); if (c.vy < 0 && c.y <= S.quickMeet) { best = now + (i + 1) * DT; break; } }
    }
    this.lastSet = k.hitter ? {team: seat.team, hitter: k.hitter, tier, kind: k.kind, at: now, x: tx, z: tz, best} : null;
    const forPerson = k.hitter && !this.host.seats.get(k.hitter)?.bot;
    if (forPerson) this.stats.setsFor[k.kind] = (this.stats.setsFor[k.kind] ?? 0) + 1;
    (this.stats.setTimes[k.kind] ??= []).push(best - now);
    if (k.kind !== 'high') this.host.emit('set', {team: seat.team, actorId: seat.id, x: b.x, y: b.y, z: b.z, shot: 'set', text: k.kind === 'quick' ? 'QUICK SET' : 'BACK SET'});
    return k.kind === 'quick' ? 'QUICK SET' : k.kind === 'back' ? 'BACK SET' : 'SET';
  }
  /** The spike (strike.ts's, PLACE by the stick as pressed): PERFECT from the top of the jump off a set of GOOD or
   *  better, GOOD from `good` of it, and below that slower and unplaced; a ball under the net goes OVER. */
  private spike(seat: BallSeat, p: PlayerState, press: Press, fromY: number, hand = 0): {tier: VolleyTier; label: string; shot: ShotKind} {
    const b = this.host.ball, K = VOLLEY.spike, share = Math.max(p.y, fromY) / Math.max(.1, this.arcOf(seat.id, p).apex);
    const rising = (this.host.motion(seat.id)?.vy ?? 0) > 0;
    const rivals = [...this.host.seats.values()].filter(s => s.team !== seat.team).map(s => this.host.sim.actors.get(s.id)!.state);
    const tierAt = share >= K.good ? 'GOOD' as const : rising ? 'EARLY' as const : 'LATE' as const;
    // The SUPER SHOT: the ultimate's button with the meter full, up for the attack - strike.ts's own (the
    // emptiest corner at the ball's top speed), its meter spent, its show; through every block.
    if (press.slot === 'super' && p.ultimate >= 100 && b.y > SPIKE_RULES.netHeight) {
      const r = strikeBall(b, {mode: 'sky-spike', slot: 'ultimate', move: TOUCH, knockback: 1, launch: false, finisher: false, pushX: 0, pushZ: 0, touches: SPIKE_RULES.touches, rivals, gravity: b.grav || 1, striker: this.striker(seat, p, press)});
      this.fly(b, r); b.heat = Math.min(BALL_RULES.heatMax, b.heat + r.heat); b.super = true;
      this.host.superShot(seat); this.stats.supers++;
      return {tier: share >= K.perfect ? 'PERFECT' : tierAt, label: 'SUPER SHOT', shot: 'super'};
    }
    // The TIP: the heavy's button on the attack - soft over the block's hands, short behind it (strike.ts's).
    if (press.slot === 'tip' && b.y > SPIKE_RULES.netHeight) {
      const r = strikeBall(b, {mode: 'sky-spike', slot: 'light', move: TOUCH, knockback: 1, launch: false, finisher: false, pushX: 0, pushZ: 0, touches: SPIKE_RULES.touches, rivals, gravity: b.grav || 1, striker: this.striker(seat, p, press)});
      this.fly(b, r);
      return {tier: share >= K.quick ? 'GOOD' : tierAt, label: 'TIP', shot: 'tip'};
    }
    if (b.y < SPIKE_RULES.netHeight + K.under || Math.abs(b.z) > K.net + 2) {
      this.over(seat, p, press, share >= K.good ? 1 : .85);
      return {tier: share >= K.good ? 'GOOD' : rising ? 'EARLY' : 'LATE', label: 'OVER', shot: 'pop'};
    }
    const setOk = !this.lastSet || this.lastSet.hitter !== seat.id || this.lastSet.tier === 'PERFECT' || this.lastSet.tier === 'GOOD';
    // (A QUICK SET is met on the way up - its own timing: GOOD there, never PERFECT, as before.)
    const quick = this.lastSet?.kind === 'quick' && this.lastSet.hitter === seat.id;
    // (PERFECT: from the top of the jump and met clean in the hand - a ball the arm reaches up for is GOOD.)
    const perfect = !quick && share >= K.perfect && hand <= K.clean && Math.abs(b.z) < K.net && b.y > K.ball && setOk;
    const tier: VolleyTier = perfect ? 'PERFECT' : share >= (quick ? K.quick : K.good) ? 'GOOD' : rising ? 'EARLY' : 'LATE';
    const off = tier === 'EARLY' || tier === 'LATE';
    this.stats.spikesAt[otherTeam(seat.team)] = (this.stats.spikesAt[otherTeam(seat.team)] ?? 0) + 1;
    const striker = this.striker(seat, p, off ? {...press, x: 0, z: 0} : press);
    if (off) striker.aimYaw = Math.atan2(0, -own(seat.team));
    const r = strikeBall(b, {mode: 'sky-spike', slot: 'heavy', move: TOUCH, knockback: 1, launch: false, finisher: false, pushX: 0, pushZ: 0, touches: SPIKE_RULES.touches, rivals, perfect, gravity: b.grav || 1, striker});
    if (off) { const g = SPIKE_RULES.gravity * (b.grav || 1), slow = {vx: r.vx * K.offPace, vy: r.vy * K.offPace, vz: r.vz * K.offPace}; if (clears(b, slow, g, .15)) { r.vx = slow.vx; r.vy = slow.vy; r.vz = slow.vz; } }
    this.fly(b, r);
    b.heat = Math.min(BALL_RULES.heatMax, b.heat + r.heat + (perfect ? K.heat : 0) + SPIKE_RULES.skySpikeHeat);
    if (perfect) this.host.award(seat, 'perfectSpike');
    this.hotSpike = perfect;
    if (seat.bot) { const t = seat.team; this.stats.botSpikes[t] = (this.stats.botSpikes[t] ?? 0) + 1; if (perfect) this.stats.botPerfect[t] = (this.stats.botPerfect[t] ?? 0) + 1; }
    return {tier, label: 'SPIKE', shot: r.shot === 'spike' ? 'spike' : r.shot};
  }
  /** The safe shot OVER: to the stick's zone, or the emptiest deep spot of the other court, high over the net. */
  private over(seat: BallSeat, p: PlayerState, press: Press, pace: number) {
    const b = this.host.ball, R = SPIKE_RULES, s = own(seat.team), far = -s, g = R.gravity * (b.grav || 1), O = VOLLEY.over, C = this.court, k = onCourt(C, 1, 1);
    const zone = placement(this.striker(seat, p, press), seat.team);
    let tx: number, tz: number;
    if (zone && (zone.a || zone.f)) { tx = zone.a * PLACE.x.other * k.x; tz = far * (zone.f > 0 ? PLACE.deep.other : zone.f < 0 ? PLACE.short.other : 6.5) * k.z; }
    else {
      let best = {x: 0, z: far * 6.5 * k.z, d: -1};
      for (const x0 of [-5, -2.5, 0, 2.5, 5]) for (const z0 of [4, 6.5, 8.6]) {
        const x = x0 * k.x, z = z0 * k.z;
        let d = 9;
        for (const q of this.host.seats.values()) { if (q.team === seat.team) continue; const st = this.host.sim.actors.get(q.id)?.state; if (st) d = Math.min(d, Math.hypot(st.x - x, st.z - far * z)); }
        if (d > best.d) best = {x, z: far * z, d};
      }
      tx = best.x; tz = best.z;
    }
    tx = clamp(tx, -C.x + .8, C.x - .8); tz = far * clamp(Math.abs(tz), 2.5 * k.z, C.z - .8);
    let t = O.seconds / pace, v = arc(b, tx, R.ballRadius, tz, t, g, R.drag);
    for (let i = 0; i < 16 && !clears(b, v, g, O.clear); i++) { t *= 1.06; v = arc(b, tx, R.ballRadius, tz, t, g, R.drag); }
    this.fly(b, {...v, sx: 0, sy: 0, sz: 0});
  }

  /** Whether `team` is attacking: its third touch to come (the set up), or its spike on the way to the net. */
  attacking(team: BallTeam) {
    const b = this.host.ball;
    if (b.held) return false;
    if (this.plan?.team === team && this.plan.touch === SPIKE_RULES.touches) return true;
    return b.lastTeam === team && (b.shot === 'spike' || b.super) && sideOf(b.z) === team;
  }
  /** The BLOCK (VOLLEY.block): the other side's spike crossing the net through a body up in the air there. */
  private blocks(now: number) {
    const b = this.host.ball, B = VOLLEY.block;
    if (b.held || !b.lastTeam || !(b.shot === 'spike' || b.super) || Math.abs(b.z) > B.plane) return;
    const A = b.lastTeam, D = otherTeam(A), s = own(D), key = `${b.lastId}|${this.host.view.rally}|${this.host.view.score.red + this.host.view.score.blue}`;
    if (Math.sign(b.vz) !== s || key === this.blockedKey) return;
    // (A person's block always meets a spike passing within its reach - VOLLEY.person - a grade 2 STUFF BLOCK or
    // 1 a soft one; a bot's by its jump, as before.)
    let who: BallSeat | undefined, best = -1, grade = 0;
    const P = VOLLEY.person;
    for (const seat of this.host.seats.values()) {
      if (seat.team !== D) continue;
      const p = this.host.sim.actors.get(seat.id)?.state, person = !seat.bot;
      if (!p || p.grounded || Math.abs(p.z) > B.net || Math.abs(b.x - p.x) > (person ? P.wide : B.wide) || b.y > p.y + (person ? P.top : B.top) || b.y < p.y - (person ? P.under : B.low)) continue;
      const share = p.y / Math.max(.1, this.arcOf(seat.id, p).apex), across = Math.abs(b.x - p.x);
      // (Grades: 3 a STUFF BLOCK, 2 a soft block, 1 a person's BLOCK TOUCH.)
      let g = person ? share < P.low ? 0 : share >= P.stuff && across <= P.square ? 3 : this.rng() < clamp((share - P.soft[0]) / (P.soft[1] - P.soft[0]), 0, 1) ? 2 : 1 : share >= B.stuff && across <= B.square ? 3 : share >= B.soft ? 2 : 0;
      // (A person's BLOCK TOUCH is no sure thing - `P.slip` of them the spike beats, over or through the hands.)
      if (person && g === 1 && this.rng() < P.slip) g = 0;
      if (g > grade || (g === grade && g > 0 && share > best)) { best = share; who = seat; grade = g; }
    }
    if (!who || grade === 0) return;
    // (A PERFECT SPIKE through a person's block short of a STUFF BLOCK is only touched on its way.)
    if (this.hotSpike && !who.bot && grade === 2) grade = 1;
    const stuff = grade === 3, touch = grade === 1;
    // (A SUPER SHOT goes through every block; a PERFECT SPIKE through any but a STUFF BLOCK - or a person's.)
    if (b.super || (this.hotSpike && !stuff && who.bot)) return;
    this.blockedKey = key;
    const v = this.host.view, C = this.court;
    if (stuff) {
      const tx = clamp(b.x + (this.rng() - .5) * 3, -C.x + .8, C.x - .8), tz = own(A) * (1.6 + this.rng() * 2.4) * onCourt(C, 1, 1).z;
      const t = Math.max(.3, Math.hypot(tx - b.x, b.y, tz - b.z) / B.stuffSpeed);
      this.fly(b, {...this.aimed(b, tx, SPIKE_RULES.ballRadius * (b.size || 1), tz, t), sx: 0, sy: 0, sz: 0});
    } else if (touch) {
      // (A BLOCK TOUCH: off the hands and on into their own court where it is emptiest, `touch` s to come down - theirs to
      // dig, if they get there. VOLLEY.touchOff: so it is not nearly always dug and their own counterattack, a share of
      // them go off the hands and OUT past the blockers' own lines (the attackers' point), a share drop back over the net
      // onto the attackers' side for them to play again, and the rest come down fast into the blockers' court, a hard
      // dig.)
      const T = VOLLEY.touchOff, roll = this.rng(), r = SPIKE_RULES.ballRadius * (b.size || 1);
      if (roll < T.out) {
        const side = Math.sign(b.x || (this.rng() - .5)) || 1, wide = this.rng() < .6;
        const tx = wide ? side * (C.x + T.outBy * (.6 + this.rng() * .8)) : clamp(b.x * 1.3, -C.x + .5, C.x - .5), tz = wide ? s * C.z * (.25 + this.rng() * .6) : s * (C.z + T.outBy * (.5 + this.rng() * .8));
        this.fly(b, {...this.aimed(b, tx, r, tz, T.outSeconds), sx: 0, sy: 0, sz: 0});
      } else if (roll < T.out + T.back) {
        const k = onCourt(C, 4, 0), tx = clamp(b.x * .7 + (this.rng() - .5) * 3, -k.x, k.x), tz = own(A) * C.z * (.3 + this.rng() * .35);
        this.fly(b, {...this.aimed(b, tx, T.backHeight, tz, T.backSeconds), sx: 0, sy: 0, sz: 0});
      } else {
        let tx = 0, tz = s * 4, far = -1;
        for (const x of [-.7, -.35, 0, .35, .7]) for (const z of [.3, .5, .7, .85]) {
          const px = x * C.x, pz = s * z * C.z;
          let d = 9;
          for (const q of this.host.seats.values()) { if (q.team !== D) continue; const st = this.host.sim.actors.get(q.id)?.state; if (st && st.grounded) d = Math.min(d, Math.hypot(st.x - px, st.z - pz)); }
          d -= Math.abs(px - b.x) * .15;
          if (d > far) { far = d; tx = px; tz = pz; }
        }
        this.fly(b, {...this.aimed(b, tx, r, tz, T.digSeconds), sx: 0, sy: 0, sz: 0});
        this.deflectedAt = this.host.sim.serverTime;
      }
    }
    else { const k = onCourt(C, 5, 3); this.fly(b, {...this.aimed(b, clamp(b.x * .6, -k.x, k.x), B.softHeight, s * k.z, B.softSeconds), sx: 0, sy: 0, sz: 0}); }
    b.shot = 'block'; this.hotSpike = false;
    this.host.blocked(who, stuff);
    // (A block is none of a side's three: a soft one leaves the blockers all three; a STUFF BLOCK's ball is the hitters'.)
    v.touchTeam = stuff ? A : D; v.touches = 0;
    this.stats.blocked[D] = (this.stats.blocked[D] ?? 0) + 1;
    if (stuff) this.stats.stuffed[D] = (this.stats.stuffed[D] ?? 0) + 1;
    if (stuff) this.stats.stuffs[D] = (this.stats.stuffs[D] ?? 0) + 1; else this.stats.soft[D] = (this.stats.soft[D] ?? 0) + 1;
    this.closePossession();
    this.host.emit('touch', {team: D, actorId: who.id, x: b.x, y: b.y, z: b.z, shot: 'block', text: stuff ? 'STUFF BLOCK · PERFECT' : touch ? 'BLOCK TOUCH · LATE' : 'BLOCK · GOOD'});
    this.log?.(`block ${who.id} stuff=${stuff} share=${best.toFixed(2)}`);
    void now;
  }
  /** A ball let fall to a body with no touch under way: the body's keep, FLUBBED (the third touch's a free ball over). */
  private keeps(now: number) {
    const b = this.host.ball, v = this.host.view;
    if (b.held || b.y > VOLLEY.keepAt || b.vy > 0) return;
    const team = sideOf(b.z), touch = this.touchFor(team);
    if (touch > SPIKE_RULES.touches) return;
    for (const c of this.commits.values()) if (c.team === team) return;
    const r = SPIKE_RULES.ballRadius * (b.size || 1);
    let who: BallSeat | undefined, bestD = Infinity;
    for (const seat of this.host.seats.values()) {
      if (seat.team !== team) continue;
      const p = this.host.sim.actors.get(seat.id)?.state;
      if (!p || !p.grounded) continue;
      const d = flat(p, b);
      if (d <= PLAYER_RADIUS * (p.size ?? 1) + r + VOLLEY.keepWide && d < bestD) { bestD = d; who = seat; }
    }
    if (!who) {
      // (Down on the floor with nobody under it: a person's ball nobody pressed for is counted.)
      if (b.y < r + .15 && courtSide(b.x, b.z, this.court) === team && this.owner && !this.host.seats.get(this.owner)?.bot) this.unpressed(this.owner);
      return;
    }
    if (this.owner && !this.host.seats.get(this.owner)?.bot) this.unpressed(this.owner);
    const p = this.host.sim.actors.get(who.id)!.state, incoming = Math.hypot(b.vx, b.vy, b.vz);
    void v;
    if (touch === SPIKE_RULES.touches) { this.over(who, p, {at: now, yaw: 0, x: 0, z: 0, air: false, slot: 'play'}, .85); this.played(who, 'pop', 'FLUBBED', 'OVER', false, incoming, now); }
    else { this.flub(who); this.played(who, touch === 2 ? 'set' : 'bump', 'FLUBBED', touch === 2 ? 'SET' : 'RECEIVE', false, incoming, now); }
  }
  private unpressed(id: string) {
    const key = `${id}@${this.host.view.rally}:${this.host.view.score.red + this.host.view.score.blue}:${this.host.view.touches}`;
    if (this.told.has(key)) return;
    this.told.add(key); this.stats.unpressed[id] = (this.stats.unpressed[id] ?? 0) + 1;
    const q = this.host.sim.actors.get(id)?.state, b = this.host.ball;
    if (Math.hypot(b.vx, b.vy, b.vz) >= SPIKE_DIG.from) this.stats.unpressedHard[id] = (this.stats.unpressedHard[id] ?? 0) + 1;
    this.log?.(`unpressed ${id} d=${q ? flat(q, b).toFixed(2) : '?'} y=${b.y.toFixed(2)} pressed=${this.presses.has(id)} commits=${this.commits.size} touches=${this.host.view.touches} plan=${this.plan ? `${this.plan.touch}@${(this.plan.at - this.host.sim.serverTime).toFixed(2)}` : '-'}`);
  }
  private readonly told = new Set<string>();
  /** A PERFECT SPIKE in flight, untouched since. */
  private hotSpike = false;
  /** Whether a PERFECT SPIKE is in flight (the bots read it later: volleyBrain.ts). */
  get hot() { return this.hotSpike; }
  /** When the last BLOCK TOUCH sent the ball on (its own side's bots read it as they read a spike). */
  deflectedAt = -Infinity;
  /** This touch was a DIVE's; the last spike or JUMP SERVE struck, for the receivers' time (VolleyStats.react). */
  private dived = false;
  private attackAt: {team: BallTeam; at: number} | null = null;
  /** The spike already blocked (no second block of one flight). */
  private blockedKey = '';
  /** For the measures' scripts: each commit, touch and cancel, said. */
  log?: (line: string) => void;

  // ─── What the page reads ───────────────────────────────────────────────────────────────────────────────────────
  private publish(now: number) {
    const v = this.host.view, b = this.host.ball, prompt: Record<string, string> = {};
    for (const seat of this.host.seats.values()) {
      if (seat.bot) continue;
      const p = this.host.sim.actors.get(seat.id)?.state;
      if (!p) continue;
      if (b.held) { if (v.phase === 'kickoff' && v.serverId === seat.id) prompt[seat.id] = 'SERVE'; continue; }
      const touch = this.plan?.team === seat.team ? this.plan.touch : 0;
      // (At the net as the other side attacks, the jump is the block.)
      // (And on the way there, as the walk brings a person to the net for it.)
      if ((Math.abs(p.z) <= VOLLEY.block.net + .6 || (this.plan?.team !== seat.team && !!this.personSpot(seat, p, now))) && this.attacking(otherTeam(seat.team))) prompt[seat.id] = 'BLOCK';
      else if (touch === 1) prompt[seat.id] = 'RECEIVE';
      // (A team-mate bot's set is no press of the person's - they are its hitter: no SET told them.)
      else if (touch === 2) { if (this.owner === seat.id || !this.setter[seat.team]) prompt[seat.id] = 'SET'; }
      else if (touch === 3) prompt[seat.id] = !p.grounded && Math.abs(b.z) < VOLLEY.spike.net + 1 ? 'SPIKE' : this.owner === seat.id && this.plan?.air ? 'JUMP' : 'OVER';
    }
    const plan = this.plan, out: VolleyView = {owner: this.owner, at: plan?.at ?? now, x: plan?.x ?? b.x, z: plan?.z ?? b.z, touch: plan?.touch ?? 0, takes: {...this.takes}, prompt};
    v.volley = out;
  }
}
/** The move a touch is struck with, as strike.ts reads one (its style: nothing of a fighter's kit). */
const TOUCH = {name: 'Touch', style: 'melee' as const};
