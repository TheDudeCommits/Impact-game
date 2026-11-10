import type {AttackSlot, PlayerInput, PlayerState} from '../types';
import {MOVES, jumpArc} from '../moves';
import {BALL_ID, GOAL_RULES, SPIKE_RULES, otherTeam, type BallModeId, type BallSeat, type BallTeam, type BallView} from './model';
import {goalZ, landing, sideOf, stepBall, type BallContact} from './physics';
import type {BallState} from './model';

type Command = Omit<PlayerInput, 'seq'>;
const gap = (a: {x: number; z: number}, b: {x: number; z: number}) => Math.hypot(a.x - b.x, a.z - b.z);
/** Sky Spike's attack: the height a spiker meets the ball at, and how long before the ball gets there they leave the
 *  floor. The swing goes on takeoff: its contact lands about 0.12 s later, as the rising body meets the ball (a jump
 *  climbs 4.5-5.5 m, and an air heavy can pull a fighter back down, so a swing at the top would come too late). */
const SPIKE_HIT = 4, SPIKE_RISE = .15;
/** The PERFECT SPIKE, from the top of the jump. Under a set high enough (strike.ts SPIKE_SET)
 *  the hitter meets it there instead: the ball's height at the blow is the jump's top plus APEX_REACH; the swing goes
 *  APEX_SWING seconds short of the jump's top (as the climb slows to the air cast's own rise, so the swing does not
 *  brake it), the body hangs at the top through the wind-up, and the blow lands about APEX_CONTACT after it - so the
 *  hitter leaves the floor that long, plus the jump's rise, before the ball gets there. */
const APEX_REACH = .9, APEX_SWING = .1, APEX_CONTACT = .23;
/** A block leaves the floor this long before the spike crosses the net, so the body is a metre or two up and rising as it
 *  arrives (leave sooner and the spike passes under the top of the jump). */
const BLOCK_LEAD = .1;
/** Scratch for reading a struck ball's flight to the net. */
const probe = {} as BallState, contacts: BallContact[] = [];
/** Where and when the ball crosses the net, run on along its flight (half a second at most), or undefined. */
function crossing(b: BallState): {x: number; y: number; t: number} | undefined {
  // (The arena's own twists are optional fields: cleared first, or the last ball read - another room's on the server, the
  // last match's in a run of sims - lends its wind and its floor to one that has none.)
  probe.ground = probe.spring = probe.windX = probe.windZ = undefined;
  Object.assign(probe, b); probe.held = false;
  const side = Math.sign(probe.z) || 1;
  for (let t = 0; t < .6; t += 1 / 60) {
    stepBall('sky-spike', probe, 1 / 60, contacts);
    if (Math.sign(probe.z) !== side) return {x: probe.x, y: probe.y, t: t + 1 / 60};
  }
  return undefined;
}
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
/** A seat of the view by id (no allocation: six at most). */
function seatOf(view: BallView, id: string): BallSeat | undefined {
  for (let i = 0; i < view.seats.length; i++) if (view.seats[i].id === id) return view.seats[i];
  return undefined;
}
/** How far `p` stands off the segment from `a` to `b`, along the floor. */
function offLine(p: {x: number; z: number}, a: {x: number; z: number}, b: {x: number; z: number}) {
  const dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz || 1, t = clamp(((p.x - a.x) * dx + (p.z - a.z) * dz) / l2, 0, 1);
  return Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t);
}
/** The bots show off a little. A SUPER SHOT on its way at a bot
 *  is guarded as it arrives (a perfect guard: the TECHNIQUE DUEL) this much of the time, more the better the bot; a
 *  guard leaves `GUARD_LEAD` seconds before the ball gets there (the just-guard window is 0.25 s). A bot in reach of a
 *  ball with a team-mate placed to finish it sets them up (a LINK SHOT) about `LINK_SET` of the time, no more than once
 *  every few seconds. Measured on headless bot matches. */
const DUEL_TRY = [.55, .35] as const, GUARD_LEAD = .15, LINK_SET = .7, LINK_GAP = 2.6;
/** LEVEL_EDGE.mark: how far goal-side of the runner it marks a HARD support stands (m). */
const MARK = 1.8;
/** Goal Rush's places and reaches, as shares of the pitch (GOAL_RULES halfX, halfZ), so the bots play the pitch they are
 *  on (26 × 38 m; the shares are the metres first laid on a 36 × 52 m pitch, over its half-sizes):
 *  - a SUPER SHOT is struck from up to `superRange` of a half-length out with the goal in sight, not wider than
 *    `superWide` of a half-width;
 *  - a ball on its way at the bot's own goal is a danger within `danger` of a half-length; the keeper clears a loose
 *    ball within `clear` of one and tackles a striker in front of goal there, and leaves its goal for a charm only with
 *    the ball beyond `keeperCharm`;
 *  - the support holds `flank` of a half-width out to the side;
 *  - the attacker shoots a special inside `special` and a heavy inside `heavy` (half-lengths), and a LINK SHOT's
 *    team-mate is within `link` of a half-length of the goal and `linkWide` of a half-width of the middle. */
const PITCH = {superRange: 1.54, superWide: .83, danger: .85, clear: .5, keeperCharm: .77, flank: .39, special: 1, heavy: 1.23, link: .92, linkWide: .67} as const;
/** Goal Rush's bots play like people, mistakes and all, and sharpen under pressure, so that beating them feels earned
 *  and losing to them fair:
 *  - **The pressure:** a side behind plays `behind` sharper a goal (at most `most`), and `late` more in the last
 *    `lateFrom` seconds and in overtime (never past `cap`): the comeback and the last push are real. A side behind in
 *    those last seconds pushes its support up the pitch, and in the last `sweepFrom` its keeper off the line (`sweep` m
 *    out): a goal to draw level, or one on the break.
 *  - **The read:** a change in the ball's flight - a strike, a deflection - is taken in a reaction late (`reactionBest`
 *    s at the best, `reaction` more at none); between reads the bot runs on along the flight it saw. A keeper beaten by
 *    a sudden shot was beaten, not cheated.
 *  - **The strike:** a ball coming at the bot is struck so the blow lands as the ball reaches `meet` metres (a timed
 *    swing: BallMatch's PERFECT STRIKE, the best bots' habit; a melee blow's lunge carries the body `lungeShare` of the
 *    way it could toward the ball first), off by up to about `timing` s of error at none (a swing early whiffs or meets
 *    it far out, one late meets it on the body), rolled once a ball; and a shot now and then is shanked (`shank` of them
 *    at none, `shankYaw` rad off).
 *  - **The keeper:** reads each shot once - a miss of the read altogether `missRead` of the time at none, a guess of the
 *    side off by up to `guess` metres - puts the guard up as it arrives (GUARD_LEAD, with its timing error), and dives
 *    (the dash) for a shot it cannot reach at a run (`runs` m/s from a standstill, the guard reaching `reach` m) but can
 *    at a dash (`dives` m/s): the DIVING SAVE. The guard goes up for a shot coming past within `guardReach` metres of
 *    its chest (a body and a guard's reach and the ball's radius) as it comes within `guardFrom` metres. */
const PRESSURE = {behind: .03, most: .09, late: .05, lateFrom: 45, cap: .98, sweepFrom: 20, sweep: 6, reactionBest: .09, reaction: .3, meet: 2.3, lungeShare: .6, timing: .15,
  shank: .12, shankYaw: .45, missRead: .2, guess: 1.6, runs: 7, dives: 13, reach: 1, guardReach: 2.4, guardFrom: 3} as const;
const SUPER_RANGE = PITCH.superRange * GOAL_RULES.halfZ, SUPER_WIDE = PITCH.superWide * GOAL_RULES.halfX;
/** Sky Spike's bots: three styles,
 *  dealt round a match, each leaning on its own choices (strike.ts SERVE_STYLE, SPIKE_QUICK, SPIKE_TIP):
 *  - POWER: JUMP SERVEs and spikes off the high set, rarely a tip;
 *  - CRAFT: FLOAT SERVEs, QUICK and BACK SETs, and TIPs over a block that is up;
 *  - WALL: the DRIVE, STUFF BLOCKs timed more often, a quick read.
 *  The shares are [jump serve, float serve] (the rest drive), [quick set, back set] (the rest high), the tip over a block
 *  that is up, a tip anyway, and the STUFF BLOCK's extra share. */
type SpikeStyle = 'power' | 'craft' | 'wall';
const SPIKE_STYLES: Record<SpikeStyle, {serve: readonly [number, number]; set: readonly [number, number]; tip: number; tipAny: number; stuff: number}> = {
  power: {serve: [.6, .15], set: [.12, .12], tip: .15, tipAny: .03, stuff: 0},
  craft: {serve: [.2, .6], set: [.3, .28], tip: .6, tipAny: .1, stuff: 0},
  wall: {serve: [.2, .35], set: [.14, .16], tip: .28, tipAny: .05, stuff: .15},
};
/** A bot reads a ball the other side has just played (a serve, a set, a spike, a tip) this long after it was played
 *  (`base` less `skill` times its skill, s): before then it holds where it was going. Without it every serve was read
 *  at once and none was ever an ACE (none in five matches), and a tip was met before it fell. (The same read as .34
 *  less .2 × skill for an average bot, a slower one for a poor one and a quicker one for the best, so its skill tells:
 *  FORM.) */
export const REACT = {base: .5, skill: .4, spike: 0, jump: .16} as const;
/** The difficulty that scales: a bot's skill this rally is its own less COMPOSURE for every point its side leads by
 *  (more for every point it trails), at most `most` either way - a side well ahead eases off, one behind digs in, so a
 *  match stays close enough for DEUCE and a COMEBACK (without it, bot matches ended 11-3, 11-4 and 11-5). Only a side
 *  with nobody's own hands on it (BallMatch.levelBots) - a person's team-mates play their own game at any score, so the
 *  side that eases off or digs in is always the other one - and with FORM it tells. (At 0.06 a point, with a bot's
 *  skill hardly moving the rallies it won, a side three points up won 49% of them.) */
export const COMPOSURE = {point: .08, most: .3, lo: .1, hi: 1} as const;
/** Sky Spike's bots' form, for close matches and a difficulty a new player can beat and a good one is challenged by. A
 *  person's errors, more the lower the bot's skill this rally - so a bot's skill, its COMPOSURE and its side's
 *  difficulty change the rallies it wins. (Bots that barely missed - a side of them at 0.4 against one at 1 still won
 *  38% of the rallies. With these and REACT's slower read, a side at 0.55 against one at 0.85 wins 38%.) Each is rolled
 *  once a ball:
 *  - **The takeoff:** the attack's jump leaves up to `jump` × (1 − skill) seconds early or late - off the top of the
 *    jump, an ordinary spike or a swing at nothing.
 *  - **The misread:** a ball of the other side's is misjudged `miss` × (1 − skill) of the time: the bot runs for a spot
 *    `misread` metres off where it will come down, and sees the truth only `late` seconds before it lands - a scramble,
 *    a dig off the arm, or the floor. */
export const FORM = {jump: .4, miss: .35, misread: 1.6, late: .35} as const;
/** The bots' level the player picks for a match against them (EASY, NORMAL, HARD on the mode sheet): the band
 *  their skill is drawn from (`lo` plus up to `span`), and how much of COMPOSURE's easing off ahead (`ease`) and digging
 *  in behind (`dig`) their side has. The other side's bots take the level picked; a person's own team-mates take
 *  `mates` (BallMatch.levelBots) - at EASY the best, who cover a new player's misses, otherwise NORMAL. NORMAL is the
 *  band every bot had before. EASY's side eases off as far as any but hardly digs in, so a new player who gets ahead
 *  stays in reach of winning; HARD's digs in as far as any but hardly eases off, so a good player has to close it out.
 *  (Above a skill of about 0.9 and below about 0.3 a bot's skill hardly moves the rallies it wins - FORM's errors are
 *  all but gone, or both sides make them all - so HARD is NORMAL's best, all of them, and EASY sits just under where
 *  it starts to tell.)
 *  Each mode has its own, aimed at a casual player winning about 60% on EASY, 35% on NORMAL and under 15% on HARD,
 *  and a skilled one about 85%, 55% and 30-40% (measured with the scripted players, playerModels.ts, on 48 paired seeds).
 *  - Goal Rush: EASY's bots a shade better (0.25-0.5) and a person's team-mates NORMAL's (with HARD's, a casual
 *    player's side won 88% once the bots had plans). HARD's team-mates are EASY's: HARD's levers (LEVEL_EDGE) hit a
 *    skilled player's runs and shots, and a casual player's side lived on its team-mates (29% with NORMAL's, 13% with
 *    EASY's; a skilled player's 40% and 33%) - on HARD you carry your side.
 *  - Sky Spike: a person's team-mates are HARD's at every level (with NORMAL's, a skilled player's side won 29% on
 *    NORMAL; with HARD's, 44%: they set and cover for the person). HARD's bots are NORMAL's in skill: its step up is
 *    its levers and a side that hardly eases off ahead. (A lower NORMAL band - 0.4-0.9 - was fairer to a person, but
 *    cut the bots' own rallies to 3.2-3.4 crossings.) */
export type BotLevel = 'easy' | 'normal' | 'hard';
export type LevelShape = {lo: number; span: number; mates: BotLevel; ease: number; dig: number};
export const BOT_LEVELS: Readonly<Record<BallModeId, Readonly<Record<BotLevel, LevelShape>>>> = {
  'goal-rush': {
    easy: {lo: .25, span: .25, mates: 'normal', ease: 1, dig: .3},
    normal: {lo: .55, span: .4, mates: 'normal', ease: 1, dig: 1},
    hard: {lo: .85, span: .15, mates: 'easy', ease: .3, dig: 1},
  },
  'sky-spike': {
    easy: {lo: .2, span: .25, mates: 'hard', ease: 1, dig: .3},
    normal: {lo: .55, span: .4, mates: 'hard', ease: 1, dig: 1},
    hard: {lo: .55, span: .4, mates: 'hard', ease: .3, dig: 1},
  },
};
export const isBotLevel = (v: unknown): v is BotLevel => v === 'easy' || v === 'normal' || v === 'hard';
/** HARD is a real step up for a good player, with levers of its own, not just skill. The scripted players
 *  (playerModels.ts) showed why the band alone could not do it: a SKILLED player won 41% on
 *  NORMAL and 44% on HARD in Sky Spike, because skill over about 0.9 hardly tells and NORMAL's side digs in to it when
 *  behind. So each level also changes what its bots choose and how cleanly they read, at any score. NORMAL's are the
 *  bots as they were (every factor 1, every share 0: no new draw from the match's stream, so NORMAL's seeded matches
 *  play as before). Goal Rush:
 *  - `read`: the reaction to a change in the ball's flight (PRESSURE.reactionBest and reaction) times this;
 *  - `keeper`: the keeper's misread and its guess of the side (PRESSURE.missRead, guess) and the guard's timing error
 *    times this, and `dive` m/s on its dive (PRESSURE.dives); `timing`: the timed swing's error (PRESSURE.timing)
 *    times this - more PERFECT STRIKEs;
 *  - `corner`: how far the aim goes from the goal's middle third to the corner away from the keeper (0-1);
 *  - `tackle`: added to the share of tackles taken when one is on, and `again` the wait before the next look, times;
 *  - `link`: added to LINK_SET's share - passes into a team-mate's run;
 *  - `mark`: with the other side on the ball in its half, the support marks their runner nearest its goal, goal-side
 *    (`MARK` m) - a good player's run into space is followed. (A HARD that left a skilled player's runs
 *    free it won 54% on HARD, as on NORMAL, while a casual player's fell to 25%.)
 *  Sky Spike:
 *  - `react`: REACT's read times this; `form`: FORM's takeoff and misread errors times this;
 *  - `stuff`: added to a block's share timed to the hitter (STUFF); `quickRead`: added to COMMIT.quick's, a QUICK SET
 *    read in time to go up with its hitter;
 *  - `jumpServe`: the share of the other serves turned into JUMP SERVEs; `quickSet`: the QUICK SET's share times this
 *    (the set that beats a slow block); `tip`: added to the TIP's share over a block that is up. */
export const LEVEL_EDGE: Readonly<Record<BotLevel, {read: number; keeper: number; dive: number; timing: number; corner: number; tackle: number; again: number; link: number; mark: number;
  react: number; form: number; stuff: number; quickRead: number; jumpServe: number; quickSet: number; tip: number}>> = {
  easy: {read: 1, keeper: 1, dive: 0, timing: 1, corner: 0, tackle: 0, again: 1, link: 0, mark: 0, react: 1, form: 1, stuff: 0, quickRead: 0, jumpServe: 0, quickSet: 1, tip: 0},
  normal: {read: 1, keeper: 1, dive: 0, timing: 1, corner: 0, tackle: 0, again: 1, link: 0, mark: 0, react: 1, form: 1, stuff: 0, quickRead: 0, jumpServe: 0, quickSet: 1, tip: 0},
  hard: {read: .35, keeper: .2, dive: 3, timing: .4, corner: 1, tackle: .35, again: .4, link: .3, mark: 1, react: .7, form: .5, stuff: .05, quickRead: .3, jumpServe: .6, quickSet: 1.6, tip: .1},
};
/** Bots that play like people: a side with a recognisable plan the player can read and beat. Each side of bots is dealt one plan a match (`dealPlan`, BallMatch.levelBots: from the match's seed,
 *  no draw from its stream), says it at the kickoff (`PLAN_LINES`), and leans on it all match:
 *  - Goal Rush, WING: the play goes down one wing (`wing`, by the world's x) - the attacker carries the ball up that
 *    channel (`channel` of a half-width out; its taps, from `carryFrom` of a half-length out to the last `crossFrom`),
 *    and from out wide there (`crossWide` m) crosses it into the box, where the support waits at the far post
 *    (`backPost` m across, `box` m out) to meet it first time. Beaten by covering that wing and the far post.
 *  - Goal Rush, BOX: with the ball theirs in the last third the support goes to the edge of the box (`box` m out) for
 *    the second ball and the pass - many shots, and open to a quick break.
 *  - Goal Rush, PRESS: the attacker and the support hunt the ball - the attacker from `pressRange` m, the support a
 *    carrier `supportPress` m off it in the other half - and more of their tackles are taken (`press`) - beaten by
 *    passing it early.
 *  - Sky Spike, QUICK: the QUICK SET to the hitter at the net whenever there is one (`set` of the sets) - fast, and
 *    beats a slow block, but always that hitter, so a block that goes up with them stuffs it.
 *  - Sky Spike, POWER: every serve a JUMP SERVE, and the high set for the spike from the top of the jump (`set` of the
 *    sets) - big, but slow to build: a block timed on the hitter stuffs it, and a deep receiver digs the serve.
 *  - Sky Spike, TIP: its hitters TIP over a block that is up (`tip` of the time) and now and then anyway (`tipAny`) -
 *    beaten by staying down and covering short.
 *  (Tried and dropped, Sky Spike: WING, every set out to one wing. A set turned by the setter's aim moves 2 m at most;
 *  the stick across sets it wide, but the room reads the stick as the blow lands, and that is often a swing pressed
 *  for another touch. Held through every swing, the side's attacks came from its wing 59% of the time (others' 46-53%),
 *  its attacks fell from 17 a match to 9 and the bots' rallies to 3.2 crossings. SWITCH, the BACK SET to a wing, was
 *  no more readable.)
 *  The rest of the time a bot plays its own game (its style, SPIKE_STYLES). A person's own team-mates play no plan:
 *  they follow the person. (Tried and dropped: FEED, a person's Sky Spike team-mates setting the person whenever they
 *  stood at the net. It took the attack from HARD's team-mates, who convert it better than most people: a skilled
 *  player's side won 75% on EASY where it had won 88%, a casual one's 79% where it had won 65%.) */
export type BotPlan = 'wing' | 'box' | 'press' | 'quick' | 'power' | 'tip';
export const BOT_PLANS: Readonly<Record<BallModeId, readonly BotPlan[]>> = {'goal-rush': ['wing', 'box', 'press'], 'sky-spike': ['quick', 'power', 'tip']};
export const PLAN = {channel: .62, crossFrom: .66, carryFrom: 1.5, crossWide: 4.5, backPost: 2, box: 10, near: 3, press: .05, pressRange: 8, supportPress: 4, set: .7, tip: .85, tipAny: .35} as const;
/** What a side's bots say at the first kickoff of a match: their plan, out loud, so it can be read. */
export const PLAN_LINES: Readonly<Record<BallModeId, Partial<Record<BotPlan, string>>>> = {
  'goal-rush': {wing: 'Wide, then cross it in!', box: 'Everyone in the box!', press: "Hunt the ball. Don't let them breathe."},
  'sky-spike': {quick: 'Quick sets, all match!', power: 'Big serves, big spikes!', tip: 'Tip it over their hands!'},
};
/** A side's plan for a match (and a round of rematches): from the match's own seed and the side, so a seeded match
 *  deals the same and no draw is taken from its stream (each mode's matches stay as they were). */
export function dealPlan(mode: BallModeId, seed: number, team: BallTeam, round = 1): {plan: BotPlan; wing: 1 | -1} {
  let h = (seed ^ (team === 'red' ? 0x9e3779b9 : 0x85ebca6b) ^ Math.imul(round, 0xc2b2ae35)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0; h = (h ^ (h >>> 13)) >>> 0;
  const plans = BOT_PLANS[mode];
  return {plan: plans[h % plans.length], wing: (h >>> 8) & 1 ? 1 : -1};
}
/** The block: a blocker commits with the hitter, leaving the floor as the set comes down through hitting height
 *  `lead` seconds plus its own jump's rise share `rise` away - before the ball is struck, as a blocker must, so a TIP
 *  can go over a block that is already up. (A blocker leaving the floor after the spike was struck, a tenth of a
 *  second before it crossed, could never time it.) A blocker still on the floor when the spike is struck goes up only
 *  `late` of the time. A QUICK SET is read in time to go up with its hitter only `quick` plus `quickSkill` times the
 *  bot's skill of the time. */
const COMMIT = {lead: .06, rise: .8, late: .25, quick: .2, quickSkill: .3} as const;
/** How often a block is timed to the hit (a STUFF BLOCK): `base` plus `skill` times the bot's skill (plus its style's).
 *  (.15 + .3 × skill, with the blockers committing with the hitter and so up in front of every high set, stuffed eight
 *  spikes a match and cut rallies to 3.3 crossings.) */
const STUFF = {base: .06, skill: .2} as const;
/** A setter swings for the set with the ball falling this far above its waist or less (a bump: 1.7 m). */
const SET_SWING = 3;


/** A bot that plays the ball game it was seated in, through the same inputs a person sends (a stick, a view, the
 *  buttons): it reads the ball - where it is, where it will come down - and the job its side gave it (BallMatch's
 *  roles), and never touches the ball any way a person could not. `skill` (0-1) is how cleanly it times and aims. */
export class BallBrain {
  private nextPress = 0;
  private nextJump = 0;
  private jumpUntil = 0;
  private nextDash = 0;
  /** Goal Rush's fights: when this bot may tackle again, and go up again off the floor (the double jump) or dash at the
   *  ball in the air (the aerial). */
  private nextTackle = 0;
  private nextAerial = 0;
  /** Goal Rush's FIGHT stance (model.ts GOAL_STANCE): the opponent this bot's tackle is locked on, and since when. */
  private fight: {id: string; since: number} | null = null;
  private serveAt = -1;
  /** When this bot left the floor for a spike, and how long after that its swing goes (0: on takeoff; a PERFECT SPIKE's,
   *  near the top). */
  private spikeAt = -Infinity; private apex = 0;
  /** The block it is going up for: timed to the hit (a STUFF BLOCK) or the hands up early (soft), and whose spike. */
  private stuff = false; private stuffFor: string | null = null;
  /** A SUPER SHOT read: whose, and whether this bot goes for the perfect guard against it. */
  private duelFor = ''; private duelTry = false;
  /** Goal Rush: when this bot may next set a team-mate up. */
  private nextLink = 0;
  /** Goal Rush (PRESSURE): the skill this tick; the ball as this bot has read it (run on along its own flight
   *  between reads), when the last read was, and since when its flight has changed unread; the flight a timing error and
   *  a keeper's read were rolled for, and what they came to. */
  private sk = 0;
  private readonly seen = {} as BallState; private seenAt = -Infinity; private unread = Infinity;
  private rolledFor = ''; private timingErr = 0; private shotRead = true; private guardErr = 0; private guess = 0; private closing = 0; private diveAt = -Infinity;
  private skill: number;
  /** The skill's draw (0-1), placed in the bot's level's band (levelled), and whether the score moves it (COMPOSURE). */
  private readonly draw: number;
  private composed = true;
  private level: BotLevel = 'normal';
  private readonly flank: number;
  /** Sky Spike: this bot's style, its skill as the score has it now (COMPOSURE: `sk`, shared with Goal Rush's
   *  PRESSURE above - a bot plays one mode), the other side's last touch it has read and when it can act on it (REACT),
   *  where it was last going, this serve's choice and its jump's swing. */
  readonly style: SpikeStyle;
  private readKey = ''; private readAt = -Infinity;
  private spotX = NaN; private spotZ = 0;
  private serveKind: 'jump' | 'float' | 'drive' | null = null; private serveJump = -Infinity; private serveSwing = 0;
  private setKind: 'quick' | 'back' | 'high' | null = null; private setFor = '';
  constructor(readonly id: string, readonly mode: BallModeId, readonly index: number, private readonly rng: () => number) {
    // (One draw, as before: the level only places it in its band - levelled.)
    this.draw = rng(); this.skill = BOT_LEVELS[mode].normal.lo + this.draw * BOT_LEVELS[mode].normal.span;
    this.flank = index % 2 ? 1 : -1;
    // (Drawn for Sky Spike's bots only: a draw from the shared stream in Goal Rush would play every one of its seeded
    // matches differently.)
    this.style = mode === 'sky-spike' ? (['power', 'craft', 'wall'] as const)[(index + Math.floor(rng() * 3)) % 3] : 'power';
  }
  /** The bot's level (BOT_LEVELS) and whether its side's score moves it (COMPOSURE): BallMatch.levelBots, at the start
   *  and whenever a seat is handed to a bot. */
  levelled(level: BotLevel, composed: boolean, plan?: {plan: BotPlan; wing: 1 | -1}) {
    const band = BOT_LEVELS[this.mode][level]; this.skill = band.lo + this.draw * band.span; this.composed = composed; this.level = level; this.edge = LEVEL_EDGE[level];
    this.plan = plan?.plan ?? null; this.wing = plan?.wing ?? 1;
  }
  /** The level's own levers (LEVEL_EDGE), and its side's plan (PLAN) and wing. */
  private edge = LEVEL_EDGE.normal;
  plan: BotPlan | null = null; wing: 1 | -1 = 1;
  command(me: PlayerState, seat: BallSeat, players: readonly PlayerState[], view: BallView, now: number): Command {
    const input: Command = {moveX: 0, moveZ: 0, yaw: me.yaw, targetId: BALL_ID, lock: true};
    this.sk = this.skill;
    if (!me.alive || view.phase === 'over' || view.phase === 'countdown') return input;
    if (now < this.jumpUntil) input.jumpHeld = true;
    if (view.phase === 'scored' || (view.phase === 'kickoff' && this.mode === 'goal-rush')) { this.fight = null; return input; }
    return this.mode === 'goal-rush' ? this.football(me, seat, players, view, now, input) : this.volley(me, seat, players, view, now, input);
  }

  private run(me: PlayerState, to: {x: number; z: number}, input: Command, now: number, stop = .6, sprint = 10) {
    this.spotX = to.x; this.spotZ = to.z;
    const dx = to.x - me.x, dz = to.z - me.z, d = Math.hypot(dx, dz);
    if (d > stop) { input.moveX = dx / d; input.moveZ = dz / d; input.yaw = Math.atan2(dx, dz); }
    if (d > sprint && now >= this.nextDash && me.grounded && me.stamina > 40) { input.dash = true; this.nextDash = now + 1.4 + this.rng() * 1.2; }
    // The ball rooms' boost (a dash runs on into it while the stick holds): let go of it a few strides short, or with
    // the bar low (a keeper's guard needs some), by easing the stick for a tick - the run carries on after.
    if (me.boost && (d < 3 || me.stamina < 45) && d > stop) { input.moveX = dx / d * .45; input.moveZ = dz / d * .45; }
    return d;
  }
  /** Goal Rush's fights (GOAL_FIGHT) in the FIGHT stance (GOAL_STANCE): a tackle, never a brawl away from the ball. The
   *  one of the other side on the ball (nearer it than this bot, at its feet) or standing in the way to it, within
   *  `range`, is locked on - the bot's swings are its kit on them now, and no longer the ball's (the BALL stance's swings
   *  never hurt a fighter) - then closed on and struck (fighting). Not at every chance: a bot that lets one go looks
   *  again in a moment. Whether it locked on. */
  private tackle(me: PlayerState, seat: BallSeat, players: readonly PlayerState[], view: BallView, b: {x: number; y: number; z: number}, input: Command, now: number, near = 2.8, range = 6) {
    if (me.team !== seat.team || now < this.nextTackle || this.fight) return false;
    const toBall = gap(me, b);
    let best: PlayerState | undefined, bestD = range;
    for (const q of players) {
      if (!q.alive || q.id === me.id || q.team === seat.team || Math.abs(q.y - me.y) > 1.4 || seatOf(view, q.id)?.out !== undefined) continue;
      const d = gap(me, q);
      if (d >= bestD || d < 1e-3) continue;
      const theirs = gap(q, b);
      const carrier = theirs < near && theirs < toBall;
      const inWay = d < 2.4 && d < toBall && ((q.x - me.x) * (b.x - me.x) + (q.z - me.z) * (b.z - me.z)) / (d * Math.max(1e-3, toBall)) > .8;
      if (carrier || inWay) { best = q; bestD = d; }
    }
    if (!best) return false;
    if (this.rng() > .45 + this.sk * .3 + this.edge.tackle + (this.plan === 'press' ? PLAN.press : 0)) { this.nextTackle = now + .6 * this.edge.again; return false; }
    this.fight = {id: best.id, since: now};
    return this.fighting(me, seat, players, view, b, input, now);
  }
  /** A tackle's lock held: run them down (the boost from afar), and in reach strike - the light string followed through,
   *  or a heavy; a special now and then. It lets go for the BALL stance once they are down or out, off the ball, out of
   *  reach, after a few seconds, or when the ball comes loose to this bot. True while it holds. */
  private fighting(me: PlayerState, seat: BallSeat, players: readonly PlayerState[], view: BallView, b: {x: number; y: number; z: number}, input: Command, now: number) {
    const f = this.fight;
    if (!f) return false;
    const q = players.find(p => p.id === f.id), held = now - f.since;
    const down = !q || !q.alive || seatOf(view, f.id)?.out !== undefined || q.action === 'knockdown' || q.action === 'launched' || q.action === 'splat' || q.action === 'getup';
    const d = q ? gap(me, q) : Infinity, theirs = q ? gap(q, b) : Infinity, mine = gap(me, b);
    const loose = mine < 2.4 && mine < theirs && b.y < 2.4;
    if (down || d > 10 || held > 2 || (held > .45 && theirs > 4) || loose) {
      this.fight = null; this.nextTackle = now + (down ? .5 : 1) + this.rng() * (1.6 - this.skill);
      return false;
    }
    input.targetId = q!.id; input.lock = true;
    const yaw = Math.atan2(q!.x - me.x, q!.z - me.z);
    this.run(me, {x: q!.x, z: q!.z}, input, now, 1.3, 5);
    input.yaw = yaw;
    if (d < 2.6 && Math.abs(q!.y - me.y) < 1.6 && now >= this.nextPress) {
      const special = (me.cooldowns.special ?? 0) <= now && this.rng() < .15;
      const string = !special && this.rng() < .45 + this.skill * .4;
      this.press(input, special ? 'special' : string ? 'light' : 'heavy', yaw, now, string ? .14 : .45);
    }
    return true;
  }
  /** Goal Rush's press: the one of the other side on the ball (within 2.5 m of it and nearer it than anyone of this
   *  side), if any. */
  private carrier(me: PlayerState, seat: BallSeat, players: readonly PlayerState[], b: {x: number; z: number}, within = 2.5) {
    let theirs: PlayerState | undefined, theirD = within, ours = Infinity;
    for (const q of players) {
      if (!q.alive) continue;
      const d = gap(q, b), mate = q.team === me.team;
      if (mate) ours = Math.min(ours, d);
      else if (q.team !== seat.team && d < theirD) { theirs = q; theirD = d; }
    }
    return theirs && theirD < ours ? theirs : undefined;
  }
  /** Goal Rush: whether this bot's side has the ball - the one nearest it, within `PLAN.near` m and on the floor, is one
   *  of its own (PLAN: a side goes forward with the ball, not before). */
  private ours(players: readonly PlayerState[], team: BallTeam, b: {x: number; y: number; z: number}) { return this.holder(players, b) === team; }
  /** Goal Rush: the side on the ball - of the one nearest it, within `PLAN.near` m, with the ball low - or undefined. */
  private holder(players: readonly PlayerState[], b: {x: number; y: number; z: number}) {
    let near: PlayerState | undefined, best: number = PLAN.near;
    for (const q of players) { const d = gap(q, b); if (q.alive && d < best) { best = d; near = q; } }
    return near && b.y < 2.5 ? near.team as BallTeam : undefined;
  }
  /** RUMBLE: the nearest charm within `within` metres (on its own side of the net in Sky Spike), if any. */
  private charm(me: PlayerState, view: BallView, within: number, side?: number) {
    let best: {x: number; z: number} | undefined, bestD = within;
    for (const c of view.charms) { const d = gap(me, c); if (d < bestD && (side === undefined || Math.sign(c.z) === side)) { best = c; bestD = d; } }
    return best;
  }
  private press(input: Command, slot: NonNullable<Command['attack']>, yaw: number, now: number, wait = .4) {
    input.attack = slot; input.yaw = yaw + (this.rng() - .5) * (1 - this.sk) * .5;
    // (Goal Rush: now and then a shot is shanked - PRESSURE.)
    if (this.mode === 'goal-rush' && this.rng() < PRESSURE.shank * (1 - this.sk)) input.yaw += (this.rng() < .5 ? -1 : 1) * PRESSURE.shankYaw;
    this.nextPress = now + wait + this.rng() * .25;
  }
  /** Goal Rush's pressure on this bot's side (PRESSURE): its skill now, and whether it is pushing for a late goal. */
  private pressure(view: BallView, team: BallTeam) {
    const down = view.score[otherTeam(team)] - view.score[team], late = view.overtime || (!view.practice && view.clock < PRESSURE.lateFrom);
    this.sk = Math.min(PRESSURE.cap, this.skill + Math.min(PRESSURE.most, Math.max(0, down) * PRESSURE.behind) + (late ? PRESSURE.late : 0));
    return down > 0 && late;
  }
  /** The ball as this bot reads it (PRESSURE): a change in its flight along the floor is taken in a reaction late; until
   *  then the bot sees it run on along the flight it last read. */
  private read(b: BallState, now: number): BallState {
    const r = this.seen, dt = Math.min(.1, Math.max(0, now - this.seenAt));
    if (this.seenAt === -Infinity) { Object.assign(r, b); this.seenAt = now; return r; }
    r.x += r.vx * dt; r.y = Math.max(GOAL_RULES.ballRadius, r.y + r.vy * dt - .5 * GOAL_RULES.gravity * dt * dt); r.z += r.vz * dt; r.vy -= GOAL_RULES.gravity * dt;
    this.seenAt = now;
    if (Math.hypot(b.vx - r.vx, b.vz - r.vz) < 3.5 && Math.hypot(b.x - r.x, b.z - r.z) < 1.5) { Object.assign(r, b); this.unread = Infinity; return r; }
    if (this.unread === Infinity) this.unread = now;
    if (now - this.unread >= (PRESSURE.reactionBest + PRESSURE.reaction * (1 - this.sk)) * this.edge.read) { Object.assign(r, b); this.unread = Infinity; }
    return r;
  }
  /** A ball's flight, rolled once (a new striker or a new way): this bot's timing error on it, and - a shot at its goal -
   *  whether it reads it at all, how late its guard comes, and the side it guesses. */
  private roll(b: BallState) {
    const key = `${b.lastId}:${Math.round(Math.atan2(b.vx, b.vz) * 2)}`;
    if (key === this.rolledFor) return;
    this.rolledFor = key;
    const off = 1 - this.sk, n = this.rng() + this.rng() - 1, E = this.edge;
    this.timingErr = n * PRESSURE.timing * off * E.timing;
    this.shotRead = this.rng() >= PRESSURE.missRead * off * E.keeper;
    this.guardErr = (this.rng() + this.rng() - 1) * .2 * off * E.keeper;
    this.guess = (this.rng() + this.rng() - 1) * PRESSURE.guess * off * E.keeper;
  }
  /** A ball on its way to this bot - its own flight closing on the bot's chest at 4 m/s or more, coming down within a
   *  swing of it - and how soon it reaches PRESSURE.meet (s); or undefined. */
  private arriving(me: PlayerState, b: BallState): number | undefined {
    const dx = me.x - b.x, dy = me.y + 1 - b.y, dz = me.z - b.z, d = Math.hypot(dx, dy, dz) || 1, closing = (b.vx * dx + b.vy * dy + b.vz * dz) / d;
    if (closing < 4 || d > 9) return undefined;
    this.closing = closing;
    const t = Math.max(0, (d - PRESSURE.meet) / closing), px = b.x + b.vx * t, py = b.y + b.vy * t - .5 * GOAL_RULES.gravity * t * t, pz = b.z + b.vz * t;
    if (Math.hypot(px - me.x, pz - me.z) > 2.2 || py - (me.y + 1) > 1.7 || py - (me.y + 1) < -1.4) return undefined;
    return t;
  }
  /** A ball's flight past this bot: how soon it comes nearest its chest (s; gravity left out over a shot's moment) and
   *  how near (m). */
  private passing(me: PlayerState, b: BallState) {
    const px = me.x - b.x, py = me.y + 1 - b.y, pz = me.z - b.z, v2 = b.vx * b.vx + b.vy * b.vy + b.vz * b.vz || 1, t = (px * b.vx + py * b.vy + pz * b.vz) / v2;
    return {t, miss: Math.hypot(px - b.vx * t, py - b.vy * t, pz - b.vz * t)};
  }
  /** Whether a press of `slot` now lands its blow as an arriving ball reaches PRESSURE.meet (with this bot's error): the
   *  ball's own flight and the blow's lunge close the gap together. */
  private onTime(me: PlayerState, slot: AttackSlot, eta: number, b: BallState) {
    this.roll(b);
    const move = MOVES[me.fighter][slot], lands = move?.contacts[0] ?? .3;
    const lunge = move?.style === 'melee' ? PRESSURE.lungeShare * Math.min(3, (move.lunge ?? 3.2) * Math.max(0, lands - (move.lungeDelay ?? 0))) : 0;
    return eta - lunge / Math.max(4, this.closing) - lands - this.timingErr <= 1 / 50;
  }
  /** (`hold`: how long the button stays down - the whole climb, for a jump to its top.) */
  private jump(input: Command, now: number, hold = .35) {
    input.jump = true; input.jumpHeld = true; this.jumpUntil = now + hold; this.nextJump = now + 1.1;
  }

  // ─── Goal Rush ────────────────────────────────────────────────────────────────────────────────────────────────────
  private football(me: PlayerState, seat: BallSeat, players: readonly PlayerState[], view: BallView, now: number, input: Command): Command {
    const b = view.ball, R = GOAL_RULES, team = seat.team, ownZ = goalZ(team), enemyZ = goalZ(otherTeam(team)), toward = Math.sign(enemyZ);
    // The pressure on its side (PRESSURE), and the ball as it has read it - where the play is going is read a reaction
    // late; the ball at its feet, at once.
    const push = this.pressure(view, team), r = this.read(b, now);
    // Where the ball is about to be: a high ball where it comes down, a low one a moment ahead.
    const lead = r.y > 2 ? landing(this.mode, r, 1.4, 2.5) : {x: r.x + r.vx * .22, z: r.z + r.vz * .22, t: .22};
    const focus = {x: clamp(lead.x, -R.halfX + 1, R.halfX - 1), z: clamp(lead.z, -R.halfZ + 1, R.halfZ - 1)};
    const goal = {x: clamp(b.x * .25, -R.goalHalfWidth + 1.2, R.goalHalfWidth - 1.2) + (this.rng() - .5) * (1 - this.sk) * 3, z: enemyZ};
    // (LEVEL_EDGE.corner: the aim taken toward the corner away from their keeper - the one of theirs nearest the line.)
    if (this.edge.corner > 0) {
      let keeper: PlayerState | undefined;
      for (const q of players) if (q.alive && q.team !== team && (!keeper || Math.abs(q.z - enemyZ) < Math.abs(keeper.z - enemyZ))) keeper = q;
      if (keeper) goal.x += ((keeper.x > 0 ? -1 : 1) * (R.goalHalfWidth - 1.2) - goal.x) * this.edge.corner;
    }
    const shotYaw = Math.atan2(goal.x - b.x, goal.z - b.z);
    const dBall = gap(me, b), dy = b.y - (me.y + 1);
    const inReach = dBall < 2.2 && dy > -1.4 && dy < 1.7;
    const role = seat.role ?? 'attack';
    const ownDanger = Math.sign(r.vz) === Math.sign(ownZ) && Math.abs(r.z - ownZ) < PITCH.danger * R.halfZ && Math.hypot(r.vx, r.vz) > 9;
    // Up for a ball in the air in front of it.
    if (now >= this.nextJump && me.grounded && dBall < 2.6 && b.y > 2.6 && b.y < 8.5 && b.vy < 5 && role !== 'keeper') this.jump(input, now);
    // A SUPER SHOT coming through this bot: the guard timed to it (a perfect one is a TECHNIQUE DUEL).
    if (this.brace(me, b, team, now, input, role === 'keeper')) { this.fight = null; return input; }
    // A tackle under way (the FIGHT stance) goes on until it lets go.
    if (this.fighting(me, seat, players, view, b, input, now)) return input;
    if (role === 'keeper') {
      // (Behind in the last seconds, the keeper comes off its line: PRESSURE.)
      const sweep = push && (view.overtime || view.clock < PRESSURE.sweepFrom);
      let spot = {x: clamp(r.x * .4, -R.goalHalfWidth + .8, R.goalHalfWidth - .8), z: ownZ - Math.sign(ownZ) * (sweep ? PRESSURE.sweep : 2.4)};
      let dive = false;
      if (ownDanger && Math.abs(r.vz) > .5) {
        const t = (ownZ - r.z) / r.vz;
        if (t > 0 && t < 2.5) {
          // A shot read once (PRESSURE): a keeper that misses the read stays where it was; one that reads it guesses the
          // side, off by its error, and dives for it if it is out of a run's reach but not a dash's.
          this.roll(b);
          const cross = clamp(r.x + r.vx * t + this.guess, -R.goalHalfWidth + .5, R.goalHalfWidth - .5), across = Math.abs(cross - me.x);
          if (this.shotRead) spot = {x: cross, z: ownZ - Math.sign(ownZ) * 1.4};
          dive = this.shotRead && me.grounded && me.stamina > 25 && now - this.diveAt > 1 && t > .1 && t < 1 && across > PRESSURE.runs * t + PRESSURE.reach && across < (PRESSURE.dives + this.edge.dive) * t + PRESSURE.reach;
        }
      }
      // A ball loose near the goal is the keeper's to clear.
      if (gap(b, {x: 0, z: ownZ}) < PITCH.clear * R.halfZ && !ownDanger && b.y < 2.4) spot = {x: b.x - Math.sin(shotYaw) * 1.2, z: b.z - Math.cos(shotYaw) * 1.2};
      // A charm near the goal, with the ball far off, is worth the few steps.
      const near = !ownDanger && gap(b, {x: 0, z: ownZ}) > PITCH.keeperCharm * R.halfZ ? this.charm(me, view, 5) : undefined;
      if (near) spot = near;
      this.run(me, spot, input, now, .4, 14);
      if (dive) { input.dash = true; input.yaw = Math.atan2(spot.x - me.x, spot.z - me.z); this.diveAt = now; }
      // The guard up as the shot comes past within its reach, `guardFrom` metres off (more or less by this keeper's timing
      // error on it: too late and the ball is past or on the body, a little early and it is a plain save).
      const speed = Math.hypot(b.vx, b.vy, b.vz), pass = this.passing(me, b);
      // (Diving, it goes up at the ball whatever the line: the dive is the lunge to put it there.)
      if (speed > 13 && ownDanger && this.shotRead && pass.t > -.05 && (pass.miss < PRESSURE.guardReach || now - this.diveAt < .6) && !dive && dBall < PRESSURE.guardFrom + speed * this.guardErr) { input.guard = true; input.yaw = Math.atan2(b.x - me.x, b.z - me.z); }
      else if ((inReach || (!ownDanger && this.arriving(me, b) !== undefined)) && now >= this.nextPress) {
        const slot = me.ultimate >= 100 ? 'ultimate' : 'heavy', eta = this.arriving(me, b);
        if (eta === undefined || this.onTime(me, slot, eta, b)) this.press(input, slot, Math.atan2(toward * 9 * this.flank, toward * 20), now, .5);
      }
      // A striker on the ball in front of goal is tackled.
      else if (!inReach && Math.abs(b.z - ownZ) < PITCH.clear * R.halfZ) this.tackle(me, seat, players, view, b, input, now, 2.2, 5);
      return input;
    }
    // A team-mate's pass on its way here: met first time at the goal (a LINK SHOT).
    if (this.meet(me, b, team, enemyZ, now, input)) return input;
    if (role === 'support') {
      // (Behind in the last seconds, the support pushes up level with the ball and beyond, for the pass: PRESSURE.)
      let back = push ? {x: clamp(b.x * .3 + this.flank * PITCH.flank * R.halfX * 1.3, -R.halfX + 2, R.halfX - 2), z: clamp(b.z + toward * 5, -R.halfZ + 3, R.halfZ - 3)}
        : {x: clamp(b.x * .5 + this.flank * PITCH.flank * R.halfX, -R.halfX + 2, R.halfX - 2), z: clamp(b.z + (ownZ - b.z) * .42, -R.halfZ + 3, R.halfZ - 3)};
      // The plan (PLAN): with the ball in the last third and theirs to play, WING waits at the far post for the cross
      // and BOX goes into the box. (Only then: a support that went forward whenever the ball did left its keeper alone
      // against every break - 15-17 goals a match in the bot sims, from 12.)
      const final = !ownDanger && !push && Math.abs(enemyZ - b.z) < PLAN.crossFrom * R.halfZ && this.ours(players, team, b);
      if (final && this.plan === 'wing') back = {x: -this.wing * PLAN.backPost, z: enemyZ - toward * PLAN.box};
      // (HARD: with the other side on the ball in this half, the support marks their runner nearest this goal, goal-side
      // - LEVEL_EDGE.mark.)
      else if (this.edge.mark && !push && Math.sign(b.z) === Math.sign(ownZ) && this.holder(players, b) === otherTeam(team)) {
        let runner: PlayerState | undefined;
        for (const q of players) if (q.alive && q.team !== team && gap(q, b) > PLAN.near && (!runner || Math.abs(q.z - ownZ) < Math.abs(runner.z - ownZ))) runner = q;
        if (runner && Math.abs(runner.z - ownZ) < R.halfZ) back = {x: runner.x * .85, z: clamp(runner.z - toward * MARK, -R.halfZ + 2, R.halfZ - 2)};
      }
      else if (final && this.plan === 'box') back = {x: clamp(b.x * .3, -PLAN.backPost * 2, PLAN.backPost * 2), z: enemyZ - toward * PLAN.box};
      const chase = dBall < 5 && Math.sign(ownZ) * (me.z - b.z) > 0;
      // The press (on the smaller pitch): in the half its side attacks, one of the other side on the ball (nearer it
      // than any of this side, at its feet) is closed down at a run from the goal side and tackled, so the ball is fought
      // for where it was lost instead of handed back. Never in its own half, where the support keeps the keeper company.
      // (A PRESS side's support hunts a carrier from further off: PLAN.supportPress.)
      const carrier = !chase && Math.sign(b.z) === toward && b.y < 2 ? this.carrier(me, seat, players, b, this.plan === 'press' ? PLAN.supportPress : 2.5) : undefined;
      // RUMBLE: the support goes for a charm when the ball is not theirs to play.
      const near = !chase && !carrier && !ownDanger && dBall > 7 ? this.charm(me, view, 9) : undefined;
      const press = carrier && {x: carrier.x + (b.x - carrier.x) * .3, z: carrier.z + Math.sign(ownZ) * 1.1};
      this.run(me, chase ? {x: b.x - Math.sin(shotYaw) * 1.2, z: b.z - Math.cos(shotYaw) * 1.2} : press || near || back, input, now, near ? .2 : press ? .3 : .8, press ? 6 : 12);
      const eta = this.arriving(me, b);
      if ((inReach || eta !== undefined) && now >= this.nextPress) {
        if (inReach && this.setUp(me, b, team, toward, enemyZ, players, view, now, input)) return input;
        // With the meter full and the goal in sight, the super shot. (A ball coming in is met as it arrives.)
        const sight = Math.abs(enemyZ - b.z) < SUPER_RANGE && Math.abs(b.x) < SUPER_WIDE;
        const slot = me.ultimate >= 100 && sight ? 'ultimate' : this.rng() < .6 ? 'heavy' : 'light';
        if (eta === undefined || this.onTime(me, slot, eta, b)) this.press(input, slot, shotYaw, now);
        else input.yaw = shotYaw;
      }
      else if (!inReach && (chase || press || dBall < 6)) this.tackle(me, seat, players, view, b, input, now, press ? 3.2 : 2.8);
      return input;
    }
    // The attacker: round behind the ball, then drive it at the goal. (A WING side's carries it up its wing through the
    // middle of the pitch - its taps that way, its shots still at the goal - and crosses it from out wide near their
    // goal: PLAN. A WING that drove every ball up the wing from anywhere, and a casual player beat it four
    // times in five.)
    const toTheirs = Math.abs(enemyZ - b.z), far = toTheirs > PLAN.crossFrom * R.halfZ && toTheirs < PLAN.carryFrom * R.halfZ;
    const cross = this.plan === 'wing' && toTheirs < PLAN.crossFrom * R.halfZ && Math.sign(b.x) === this.wing && Math.abs(b.x) > PLAN.crossWide;
    const driveYaw = this.plan !== 'wing' ? shotYaw
      : far ? Math.atan2(this.wing * PLAN.channel * R.halfX - b.x, toward * 9)
      : cross ? Math.atan2(-this.wing * PLAN.backPost - b.x, enemyZ - toward * PLAN.box - b.z) : shotYaw;
    const ux = Math.sin(driveYaw), uz = Math.cos(driveYaw);
    let approach = {x: focus.x - ux * 1.3, z: focus.z - uz * 1.3};
    const ahead = (me.x - focus.x) * ux + (me.z - focus.z) * uz;
    if (ahead > .4 && dBall > 1.2) approach = {x: focus.x - ux * 2.6 - uz * 2.6 * this.flank, z: focus.z - uz * 2.6 + ux * 2.6 * this.flank};
    // A charm a stride or two off the way to a ball still far off.
    const near = dBall > 6 ? this.charm(me, view, 3.5) : undefined;
    if (near) approach = near;
    this.run(me, approach, input, now, .3, 9);
    if (dBall < 3.5) input.yaw = driveYaw;
    // The aerial (BALL_SPORT): off the floor under a high ball, up again off the air and a dash at it.
    if (!me.grounded && now >= this.nextAerial && b.y > me.y + 2 && b.y < 10 && gap(me, b) < 4.5 && this.rng() < .25 + this.sk * .5) {
      const up = Math.hypot(b.x - me.x, b.y - (me.y + 1), b.z - me.z);
      if (b.y - me.y > 3.2) { input.jump = true; input.jumpHeld = true; this.jumpUntil = now + .3; }
      else if (up < 7 && me.stamina > 30) { input.dash = true; input.moveX = (b.x - me.x) / Math.max(.1, gap(me, b)); input.moveZ = (b.z - me.z) / Math.max(.1, gap(me, b)); }
      this.nextAerial = now + .35;
    }
    const toGoal = Math.abs(enemyZ - b.z), eta = this.arriving(me, b);
    if ((inReach || eta !== undefined) && now >= this.nextPress) {
      const air = !me.grounded;
      if (!air && inReach && this.setUp(me, b, team, toward, enemyZ, players, view, now, input)) return input;
      // (A WING side's cross is a light into the box, met there by its support - PLAN.)
      if (!air && inReach && cross) { this.press(input, 'light', driveYaw, now, .45); return input; }
      const slot = me.ultimate >= 100 && toGoal < SUPER_RANGE && Math.abs(b.x) < SUPER_WIDE ? 'ultimate'
        : air ? (this.rng() < .6 ? 'heavy' : 'light')
        : toGoal < PITCH.special * R.halfZ && (me.cooldowns.special ?? 0) <= now && this.rng() < .3 ? 'special'
        : toGoal < PITCH.heavy * R.halfZ ? (this.rng() < .7 ? 'heavy' : 'light')
        : this.rng() < .55 ? 'light' : 'heavy';
      // (A ball coming in is met as it arrives - the timed swing; until then the bot squares up to the goal.)
      if (eta === undefined || this.onTime(me, slot, eta, b)) this.press(input, slot, far && slot === 'light' ? driveYaw : shotYaw, now, slot === 'light' ? .28 : .5);
      else input.yaw = shotYaw;
    }
    // Their striker on the ball, or one in the way to it: tackled (from further by a PRESS side).
    else if (!inReach && dBall < (this.plan === 'press' ? PLAN.pressRange : 7)) this.tackle(me, seat, players, view, b, input, now, 2.8, this.plan === 'press' ? PLAN.pressRange : 6);
    return input;
  }

  /** A SUPER SHOT on its way through this bot (or, for the keeper, into its goal): step into its line and put the guard
   *  up as it arrives, so the guard is perfect - the TECHNIQUE DUEL. Decided once a shot; true while it is bracing. */
  private brace(me: PlayerState, b: BallState, team: BallTeam, now: number, input: Command, keeper: boolean): boolean {
    if (!b.super || b.lastTeam === null || b.lastTeam === team || b.clash > now) { this.duelFor = ''; return false; }
    const speed = Math.hypot(b.vx, b.vy, b.vz);
    if (speed < 8) return false;
    // (Rolled once a shot: the read is whether to try at all.)
    const key = b.lastId ?? '?';
    if (key !== this.duelFor) { this.duelFor = key; this.duelTry = this.rng() < DUEL_TRY[0] + this.skill * DUEL_TRY[1] - (keeper ? 0 : .25); }
    if (!this.duelTry) return false;
    // Where it passes this bot's line: along its flight, the point nearest the body.
    const fx = b.vx / speed, fy = b.vy / speed, fz = b.vz / speed;
    const along = (me.x - b.x) * fx + (me.y + 1 - b.y) * fy + (me.z - b.z) * fz;
    if (along < -.5) return false;
    const px = b.x + fx * along, pz = b.z + fz * along, miss = Math.hypot(me.x - px, me.z - pz);
    const eta = along / speed;
    // Off its line: the keeper runs across to meet it (about 9 m a second, the dash), anyone else only guards one at them.
    if (miss > 1.1 + (keeper ? Math.max(0, eta) * 9 : 0) || eta > 1.6) return false;
    if (miss > .5) this.run(me, {x: px, z: pz}, input, now, .2, .5);
    input.yaw = Math.atan2(b.x - me.x, b.z - me.z);
    // The guard comes up GUARD_LEAD before the ball does (a fresh press: down until then).
    const up = eta <= GUARD_LEAD + (1 - this.skill) * .05;
    input.guard = up;
    return true;
  }
  /** A LINK SHOT set up: a team-mate ahead of the ball, a short pass away, in range of the goal and open (no rival on
   *  them or across the pass), and this bot farther out than they are: a tap to them (strike.ts leads their run), now
   *  and then. True when it passed. */
  private setUp(me: PlayerState, b: BallState, team: BallTeam, toward: number, enemyZ: number, players: readonly PlayerState[], view: BallView, now: number, input: Command): boolean {
    if (now < this.nextLink || !me.grounded || b.y > 1.3) return false;
    let mate: PlayerState | undefined, best = Infinity;
    for (const p of players) {
      if (p.id === me.id || !p.alive || !p.grounded) continue;
      const seat = seatOf(view, p.id);
      if (!seat || seat.team !== team || seat.role === 'keeper') continue;
      const d = gap(p, b), ahead = toward * (p.z - b.z), toGoal = Math.abs(enemyZ - p.z);
      if (d < 3.2 || d > 7.4 || ahead < -2 || toGoal > PITCH.link * GOAL_RULES.halfZ || Math.abs(p.x) > PITCH.linkWide * GOAL_RULES.halfX || toGoal > Math.abs(enemyZ - me.z) + 1) continue;
      let open = true;
      for (const r of players) {
        if (!r.alive) continue;
        const rs = seatOf(view, r.id);
        if (!rs || rs.team === team) continue;
        if (gap(r, p) < 2.2 || offLine(r, b, p) < 1.1) { open = false; break; }
      }
      if (open && toGoal + d < best) { best = toGoal + d; mate = p; }
    }
    if (!mate) return false;
    // Now and then: a bot that passes on the chance does not ask again for a moment.
    const pass = this.rng() < LINK_SET + this.edge.link;
    this.nextLink = now + (pass ? LINK_GAP : 1);
    if (!pass) return false;
    this.press(input, 'light', Math.atan2(mate.x - b.x, mate.z - b.z), now, .45);
    return true;
  }
  /** A team-mate's pass coming to this bot: stand for it facing the goal, and strike it first time, the blow timed to land
   *  as the ball does (a heavy; the special if the heavy is a launcher, which would only pop it up). True while meeting it. */
  private meet(me: PlayerState, b: BallState, team: BallTeam, enemyZ: number, now: number, input: Command): boolean {
    if (b.shot !== 'tap' || b.lastTeam !== team || b.lastId === me.id || !me.grounded) return false;
    const dx = me.x - b.x, dz = me.z - b.z, d = Math.hypot(dx, dz), flat = Math.hypot(b.vx, b.vz);
    const closing = (b.vx * dx + b.vz * dz) / Math.max(.01, d);
    if (closing < 4 || d > 9 || Math.abs(b.vx * dz - b.vz * dx) / Math.max(.01, flat) > 1.6) return false;
    const moves = MOVES[me.fighter];
    const heavyPops = moves.heavy.outcome === 'launch' || moves.heavy.outcome === 'hop';
    const slot: AttackSlot = me.ultimate >= 100 ? 'ultimate' : heavyPops && (me.cooldowns.special ?? 0) <= now ? 'special' : 'heavy';
    const lands = moves[slot]?.contacts[0] ?? .35;
    input.moveX = input.moveZ = 0;
    const goalYaw = Math.atan2(clamp(b.x * .25, -GOAL_RULES.goalHalfWidth + 1.2, GOAL_RULES.goalHalfWidth - 1.2) - me.x, enemyZ - me.z);
    input.yaw = goalYaw;
    this.roll(b);
    if (now >= this.nextPress && (d - PRESSURE.meet) / closing <= lands + .02 + this.timingErr) this.press(input, slot, goalYaw, now, .6);
    return true;
  }

  // ─── Sky Spike ────────────────────────────────────────────────────────────────────────────────────────────────────
  private volley(me: PlayerState, seat: BallSeat, players: readonly PlayerState[], view: BallView, now: number, input: Command): Command {
    const b = view.ball, R = SPIKE_RULES, team = seat.team, sign = team === 'red' ? -1 : 1, theirs = otherTeam(team), S = SPIKE_STYLES[this.style];
    // The difficulty that scales (COMPOSURE): sharper behind, easier ahead (as low as `lo`, for EASY's bots ahead).
    const lead = view.score[team] - view.score[theirs], shape = BOT_LEVELS[this.mode][this.level];
    this.sk = clamp(this.skill - (this.composed ? clamp(lead * COMPOSURE.point, -COMPOSURE.most, COMPOSURE.most) * (lead > 0 ? shape.ease : shape.dig) : 0), COMPOSURE.lo, COMPOSURE.hi);
    const sk = this.sk;
    const rivals = players.filter(p => p.alive && Math.sign(p.z) === -sign);
    // Where to send it: the far court's emptiest spot.
    const gapSpot = (() => {
      let best = {x: 0, z: -sign * 6}, bestD = -1;
      for (const x of [-5, -2.5, 0, 2.5, 5]) for (const z of [3, 5.5, 8.5]) {
        const d = Math.min(9, ...rivals.map(p => Math.hypot(p.x - x, p.z + sign * z)));
        if (d > bestD) { bestD = d; best = {x, z: -sign * z}; }
      }
      return best;
    })();
    const sendYaw = (from: {x: number; z: number}) => Math.atan2(gapSpot.x - from.x, gapSpot.z - from.z);
    const home = seat.role === 'back' ? {x: 0, z: sign * 7.4} : {x: this.flank * 3.4, z: sign * 3.2};
    const arcOf = jumpArc(me.fighter);
    if (view.phase === 'kickoff') {
      this.readKey = ''; this.readAt = -Infinity;
      if (view.serverId !== seat.id) { this.run(me, home, input, now, .5, 30); return input; }
      this.lastPlayers = players;
      return this.serving(me, b, arcOf, sign, now, input);
    }
    this.serveAt = -1; this.serveKind = null;
    // A SUPER SHOT coming through this bot: the guard timed to it (a perfect one is a TECHNIQUE DUEL).
    if (this.brace(me, b, team, now, input, false)) return input;
    // The other side's touch, read a moment after it was made (REACT): until then the bot holds where it was going.
    if (b.lastTeam === theirs && b.lastId) {
      const key = `${b.lastId}:${b.shot}:${view.rally}`;
      // (A spike is read off the hitter's swing, mostly before it is struck: a share of the delay.)
      // (A JUMP SERVE, the fastest ball a side receives, a little later still.)
      if (key !== this.readKey) {
        this.readKey = key; this.readAt = now + (REACT.base - REACT.skill * sk + (this.style === 'wall' ? -.03 : 0) + (b.shot === 'serve' && Math.hypot(b.vx, b.vy, b.vz) > 24 ? REACT.jump : 0)) * (b.shot === 'spike' || b.shot === 'super' || b.shot === 'blast' ? REACT.spike : 1) * this.edge.react;
        // (FORM: now and then misjudged, the poorer the bot the more often.)
        const miss = this.rng() < FORM.miss * (1 - sk) * this.edge.form, ang = this.rng() * Math.PI * 2;
        this.misX = miss ? Math.sin(ang) * FORM.misread : 0; this.misZ = miss ? Math.cos(ang) * FORM.misread : 0;
      }
    }
    if (now < this.readAt && me.grounded && Number.isFinite(this.spotX)) { this.run(me, {x: this.spotX, z: this.spotZ}, input, now, .6, 30); return input; }
    const fall = landing(this.mode, b, 1.2, 3);
    // A misread ball (FORM) is run for off its true spot until it is nearly down.
    if ((this.misX || this.misZ) && b.lastTeam === theirs && fall.t > FORM.late) { fall.x += this.misX; fall.z += this.misZ; }
    // A ball of theirs coming down out of the court is let go (not played, so a serve sprayed long is out):
    // judged to the line by a margin the better the bot, the finer.
    const floor = b.lastTeam === theirs && b.shot !== 'block' ? landing(this.mode, b, R.ballRadius, 3) : undefined;
    const margin = .25 + (1 - sk) * .9;
    const out = !!floor && floor.t > .15 && (Math.abs(floor.x) > R.courtHalfX + margin || Math.abs(floor.z) > R.courtHalfZ + margin);
    const comingHere = !out && sideOf(fall.z) === team && Math.abs(fall.x) < R.halfX && Math.abs(fall.z) < R.halfZ;
    const onHere = !out && sideOf(b.z) === team && Math.abs(b.z) > .4;
    const touches = view.touchTeam === team ? view.touches : 0;
    const mates = players.filter(p => p.alive && Math.sign(p.z || sign) === sign);
    // The ball is still theirs, their set up or their spike struck. (This comes before the reads of a ball coming here: a
    // struck spike is forecast to land here, and the blocker would go to dig it instead.) While their set is up the
    // front-row player nearest where it will be spiked shadows it at the net and commits with the hitter (COMMIT): up as
    // the set comes down through hitting height, before the ball is struck - so a TIP can go over a block that is up.
    // (Never a serve: it is the serving side's last touch, and the ball it sends is received, not blocked.)
    const setUp = view.phase === 'live' && view.rally > 0 && b.shot !== 'serve' && view.touchTeam === theirs && view.touches >= 2 && sideOf(b.z) === theirs;
    // Only a set coming down at the net, or the spike off it, is blocked: a deep ball is defended from the back.
    const atNet = (b.shot === 'set' && Math.abs(landing(this.mode, b, SPIKE_HIT, 2.5).z) < 3.4) || ((b.shot === 'spike' || b.shot === 'super') && Math.abs(b.z) < 3.6);
    if (setUp && atNet && seat.role === 'front') {
      const high = b.y + Math.max(0, b.vy) ** 2 / (2 * R.gravity * (b.grav || 1)) >= arcOf.apex + APEX_REACH + .2;
      const read = landing(this.mode, b, high ? arcOf.apex + APEX_REACH : SPIKE_HIT, 2.5), x = read.t > .02 ? read.x : b.x;
      const front = mates.filter(p => p.id !== me.id && Math.abs(p.z) < 3.8);
      // Struck and on its way over: its flight read to where and when it crosses the net.
      const struck = Math.sign(b.vz) === sign && Math.abs(b.vz) > 2 && b.lastTeam === theirs && view.touches >= 3;
      const over = struck ? crossing(b) : undefined;
      const at = over && over.y > SPIKE_RULES.netHeight - .2 ? over : undefined;
      // Out of reach (it crosses too far along the net, or too high to meet): no block - back to defend, to dig it.
      const reachable = !!at && Math.abs(at.x - me.x) < 2.2 && at.y < 7.4;
      if (!front.some(p => Math.abs(p.x - x) < Math.abs(me.x - x) - .3) && !(struck && me.grounded && !reachable)) {
        // Shadow where it will be spiked at the net; once struck, slide to where it crosses.
        this.run(me, {x: clamp(at ? at.x : x, -R.courtHalfX + .5, R.courtHalfX - .5), z: sign * .95}, input, now, .15, at ? 1.2 : 4);
        // Timed to the hit (a STUFF BLOCK: the hands come up as the spike arrives) the better the bot, the more often;
        // otherwise the hands are up from the takeoff (soft). Decided once a set.
        // (Against a SUPER SHOT the block goes for the stuff far more often: a perfect one is the TECHNIQUE DUEL.)
        const key = `${b.lastId}:${view.rally}`;
        if (this.stuffFor !== key) { this.stuffFor = key; this.stuff = this.rng() < (b.super ? DUEL_TRY[0] + sk * DUEL_TRY[1] : STUFF.base + sk * STUFF.skill + S.stuff + this.edge.stuff); }
        const wall = input.yaw = Math.atan2(0, -sign);
        if (me.grounded && now >= this.nextJump) {
          // Committed with the hitter, as the set comes through hitting height; or late, off the strike, now and then.
          // (A QUICK SET - a set that never climbs to the top of a jump - is read only some of the time: COMMIT.quick.)
          if (!high && this.quickFor !== key) { this.quickFor = key; this.quickRead = this.rng() < COMMIT.quick + sk * COMMIT.quickSkill + this.edge.quickRead; }
          const commit = !struck && read.t > .02 && read.t < COMMIT.lead + arcOf.rise * COMMIT.rise + (1 - sk) * .1 && Math.abs(me.x - x) < 1.8 && b.shot === 'set' && (high || this.quickRead);
          const late = struck && at && at.t < BLOCK_LEAD + .05 && this.rng() < COMMIT.late * (.5 + sk);
          if (commit || late) this.jump(input, now, arcOf.rise + .05);
        }
        if (!me.grounded) {
          // In the air: a soft block's hands are up at once; a stuff's come up as the spike gets there.
          input.guard = !this.stuff || (!!at && at.t < .14);
          input.yaw = wall;
        }
        return input;
      }
    }
    if (comingHere || onHere) {
      // The one nearest where it comes down plays it; the others make room and offer a set.
      const target = onHere && b.y < 3 ? {x: b.x, z: b.z} : {x: fall.x, z: fall.z};
      const nearest = mates.reduce((best, p) => gap(p, target) < gap(best, target) ? p : best, me);
      // (A set on its way up is the hitter's alone: nobody standing by the setter plays it straight back.)
      const mine = nearest.id === me.id || (gap(me, b) < 1.6 && !(touches === 2 && b.vy > 0));
      if (!mine) {
        const near = touches === 0 ? this.charm(me, view, 5, sign) : undefined;
        const spot = near ?? (touches >= 1 && seat.role === 'front' ? {x: clamp(target.x * .5, -5, 5), z: sign * 2.4} : home);
        this.run(me, spot, input, now, .6, 30);
        return input;
      }
      const dBall = gap(me, b), dy = b.y - (me.y + 1);
      // The attack: two touches in and a high ball coming down near the net. Run in under where it falls through
      // hitting height, a little behind it, and leave the floor so the body meets it there. Under a floating set (round
      // 3) that is the top of the jump - the PERFECT SPIKE - taken off for its rise and the swing's wind-up before the
      // ball gets there; under a lower ball (a QUICK SET), on the way up (a jump climbs 4.5-5.5 m and the body is at
      // hitting height about 0.2 s after takeoff), the swing on takeoff.
      const top = arcOf.apex + APEX_REACH, gravity = R.gravity * (b.grav || 1);
      const high = touches >= 2 && b.y + Math.max(0, b.vy) ** 2 / (2 * gravity) >= top + .2;
      const hit = touches >= 2 && sideOf(b.z) === team ? landing(this.mode, b, high ? top : SPIKE_HIT, 2.5) : undefined;
      const attack = !!hit && hit.t > .05 && Math.abs(hit.z) < 4.6 && Math.abs(hit.x) < R.courtHalfX + .5;
      if (attack && me.grounded) {
        const spot = {x: hit!.x, z: hit!.z + sign * .7};
        const d = this.run(me, spot, input, now, .15, 4);
        // (The better the bot, the closer to the top it meets the ball.)
        const lead = high ? arcOf.rise - APEX_SWING + APEX_CONTACT : SPIKE_RISE;
        // (FORM: the takeoff off by a little, rolled once an attack; the poorer the bot, the more.)
        const akey = `${view.rally}:${b.lastId}`;
        if (akey !== this.attackFor) { this.attackFor = akey; this.jumpErr = (this.rng() * 2 - 1) * Math.max(0, 1 - sk) * FORM.jump * this.edge.form; }
        if (now >= this.nextJump && d < 1.6 && hit!.t < lead + .04 + this.jumpErr + (1 - sk) * (high ? .12 : .06)) { this.jump(input, now, high ? arcOf.rise + .05 : .35); this.spikeAt = now; this.apex = high ? arcOf.rise - APEX_SWING : 0; }
      } else {
        const under = {x: target.x - Math.sin(sendYaw(target)) * .4 * (touches >= 2 ? 1 : 0), z: target.z + sign * .35};
        // A hard ball coming in (a spike): dive for it, the dig.
        const hard = Math.hypot(b.vx, b.vy, b.vz) > 13 && touches === 0;
        this.run(me, under, input, now, .2, hard ? .9 : 6);
        // A high ball near the net that the read above missed: up for it anyway.
        const spikeable = touches >= 1 && Math.abs(b.z) < 4.5 && b.y > 2.8;
        if (spikeable && me.grounded && now >= this.nextJump && dBall < 2.2 && b.vy < 2 && b.y < 6.5) this.jump(input, now);
      }
      // In the air for a spike, the swing goes at once (at the top of the jump, for a PERFECT one); any other time, when
      // the ball is in reach.
      const since = now - this.spikeAt - this.apex;
      if (!me.grounded && since < 0 && since > -.6) return input;
      const spiking = !me.grounded && since >= 0 && since < .3 && Math.hypot(b.x - me.x, b.y - (me.y + 1.1), b.z - me.z) < (this.apex ? 3.8 : 3.4);
      // (The set is swung for a little sooner, while the ball is still above the head: swung as late as a bump, the body met
      // the ball first and every set was the floating one, whatever the bot chose.)
      const reach = spiking || (!me.grounded ? Math.hypot(b.x - me.x, b.y - (me.y + 1.1), b.z - me.z) < 2.3 : dBall < 1.9 && dy > -1.2 && dy < (touches === 1 && b.vy < 0 ? SET_SWING : 1.7));
      // A ball this side has already sent over is left alone.
      const sent = touches >= SPIKE_RULES.touches && Math.sign(b.vz) === -sign;
      // The set's choice (SPIKE_STYLES), once a possession: a QUICK SET (a hop and the set from the air) to a team-mate
      // at the net, a BACK SET to the far wing, or the floating set.
      if (touches === 1 && reach && me.grounded && this.setFor !== `${view.rally}:${b.lastId}`) {
        this.setFor = `${view.rally}:${b.lastId}`;
        const hitter = mates.some(p => p.id !== me.id && Math.abs(p.z) < 3.6 && Math.abs(p.x - me.x) < 6), draw = this.rng();
        // (The side's plan, PLAN.set of the time - the same draw, the rest of it the bot's own style's.)
        const planned = this.plan && draw < PLAN.set ? this.plan : null, r = this.plan ? Math.max(0, draw - PLAN.set) / (1 - PLAN.set) : draw;
        this.setKind = planned === 'quick' ? (hitter ? 'quick' : 'high') : planned === 'power' ? 'high'
          : hitter && r < S.set[0] * (.6 + sk * .6) * this.edge.quickSet ? 'quick' : r < S.set[0] + S.set[1] ? 'back' : 'high';
      }
      if (touches === 1 && this.setKind === 'quick' && reach && me.grounded && b.y > me.y + 1.2 && now >= this.nextJump && now >= this.nextPress) { this.jump(input, now, .12); return input; }
      if (reach && !sent && now >= this.nextPress) {
        let slot: NonNullable<Command['attack']> = 'light';
        let yaw = Math.atan2(-me.x, -me.z);
        if (me.ultimate >= 100 && touches >= 1) slot = 'ultimate';
        else if (touches >= 2 && !me.grounded && b.y > R.netHeight && this.tips(b, players, me, `${view.rally}:${b.lastId}`)) slot = 'light';
        else if (touches >= 2 || (!me.grounded && !(touches === 1 && this.setKind === 'quick'))) slot = this.rng() < .75 ? 'heavy' : 'special';
        else if (touches === 1 && this.rng() < .12 && b.y > 2 && this.setKind === 'high') slot = 'heavy';
        if (slot !== 'light' || touches >= 2) yaw = sendYaw(b);
        else if (touches === 1 && this.setKind === 'back') {
          // The stick across, toward the far wing from where the setter stands: the BACK SET (strike.ts reads the stick).
          yaw = Math.atan2(0, -sign); input.moveX = me.x > 0 ? -1 : 1; input.moveZ = 0;
        }
        this.press(input, slot, yaw, now, .35);
        if (touches === 1 && slot === 'light') this.setKind = null;
      }
      return input;
    }
    const threat = sideOf(b.z) !== team && Math.abs(b.z) < 4.5 && b.y > 2.4 && view.touchTeam !== team && view.touches >= 1;
    if (threat && seat.role === 'front') {
      const spot = {x: clamp(b.x, -R.courtHalfX + .5, R.courtHalfX - .5), z: sign * 1};
      this.run(me, spot, input, now, .3, 30);
      if (me.grounded && now >= this.nextJump && Math.abs(b.z) < 2.6 && b.y > 2.6 && b.y < 5.5 && this.rng() < .25 + sk * .4) this.jump(input, now);
      if (!me.grounded) { input.guard = true; input.yaw = Math.atan2(0, -sign); }
      return input;
    }
    this.run(me, this.charm(me, view, 8, sign) ?? home, input, now, .6, 30);
    return input;
  }
  /** The serve (strike.ts SERVE_STYLE): walk up behind the ball, a breath, then the choice made once a serve -
   *  a JUMP SERVE (the jump, the toss, the swing near the top: the better the bot, the closer to it), a FLOAT SERVE (a
   *  light) or a DRIVE (a heavy). Short: the point's celebration plays on meanwhile, and the match gets back under way. */
  private serving(me: PlayerState, b: BallState, arcOf: {rise: number}, sign: number, now: number, input: Command): Command {
    const S = SPIKE_STYLES[this.style];
    // (LEVEL_EDGE.jumpServe: a share of the floats and drives struck as JUMP SERVEs instead.)
    // (A POWER side's every serve: PLAN.)
    if (!this.serveKind) { const r = this.rng(), jump = this.plan === 'power' ? 1 : S.serve[0] + (1 - S.serve[0]) * this.edge.jumpServe; this.serveKind = r < jump ? 'jump' : r < jump + S.serve[1] * (1 - this.edge.jumpServe) ? 'float' : 'drive'; }
    // A serve goes for the seam: the deep spot farthest from the three receiving it (a float may go short as well).
    const seam = this.seam(sign, this.serveKind === 'float'), sendYaw = (from: {x: number; z: number}) => Math.atan2(seam.x - from.x, seam.z - from.z);
    if (!me.grounded && this.serveKind === 'jump') {
      // In the air with the toss: the swing a breath before the top of the jump (sooner, the worse the bot: a spray).
      if (now - this.serveJump >= this.serveSwing && now >= this.nextPress) this.press(input, 'heavy', sendYaw(b), now, .6);
      input.yaw = sendYaw(b);
      return input;
    }
    const spot = {x: b.x, z: b.z + sign * 1.1};
    const d = this.run(me, spot, input, now, .25, 30);
    if (d < .6) {
      input.yaw = sendYaw(b);
      if (this.serveAt < 0) this.serveAt = now + .25 + this.rng() * .45;
      if (now >= this.serveAt && now >= this.nextPress && now >= this.nextJump) {
        if (this.serveKind === 'jump') {
          this.jump(input, now, arcOf.rise + .05); this.serveJump = now;
          this.serveSwing = Math.max(.08, arcOf.rise - APEX_SWING + (this.rng() - .62) * (1 - this.sk) * .9);
        } else { this.press(input, this.serveKind === 'float' ? 'light' : 'heavy', sendYaw(b), now, .6); this.serveAt = -1; }
      }
    }
    return input;
  }
  /** The serve's target: the spot of the far court (deep, or anywhere for a float) farthest from its three. */
  private seam(sign: number, short: boolean) {
    let best = {x: 0, z: -sign * 8}, bestD = -1;
    for (const x of [-6, -4, -2, 0, 2, 4, 6]) for (const z of short ? [3.5, 6, 9] : [6.5, 8, 9.5]) {
      let d = 9;
      for (const p of this.lastPlayers) if (p.alive && Math.sign(p.z) === -sign) d = Math.min(d, Math.hypot(p.x - x, p.z + sign * z));
      if (d > bestD) { bestD = d; best = {x, z: -sign * z}; }
    }
    return best;
  }
  private lastPlayers: readonly PlayerState[] = [];
  /** Whether this hitter TIPs (SPIKE_TIP) instead of spiking: a block of theirs up in front of it at the net (in the air,
   *  across the ball's line) - the more so the craftier the bot - and now and then anyway. */
  private tips(b: BallState, players: readonly PlayerState[], me: PlayerState, key: string) {
    const S = SPIKE_STYLES[this.style];
    if (this.tipFor === key) return this.tipping;
    this.tipFor = key;
    // (Sky Spike's fighters share one kernel side: the other side is the far half of the court.)
    const blocked = players.some(p => p.alive && Math.sign(p.z) !== Math.sign(me.z) && !p.grounded && Math.abs(p.z) < 2 && Math.abs(p.x - b.x) < 1.8 && p.y > .8);
    // (A TIP side's hitters tip far more: PLAN.)
    this.tipping = this.rng() < (this.plan === 'tip' ? (blocked ? PLAN.tip : PLAN.tipAny) : blocked ? S.tip * (.6 + this.sk * .5) + this.edge.tip : S.tipAny);
    return this.tipping;
  }
  private tipFor = ''; private tipping = false; private quickFor = ''; private quickRead = false;
  /** FORM: the misread of the ball being read (metres off its spot), and the attack's takeoff error (s) and whose. */
  private misX = 0; private misZ = 0; private attackFor = ''; private jumpErr = 0;
}
