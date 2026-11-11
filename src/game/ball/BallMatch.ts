import {BALL_ARENAS, arenaFor, isBallArena, type BallArenaId} from './arenas';
import {isReleasedFighter, requireReleasedFighter} from '../rosterAvailability';
import {ArenaSimulation, validateInput, type ExternalBlow, type ExternalBody, type ExternalTargets} from '../simulation';
import {COMBO_HP, COMBO_STAMINA, JUST_GUARD_WINDOW, MOVES, PLAYER_RADIUS, jumpArc, type MoveDefinition} from '../moves';
import {HELD} from '../economy/fighters';
import {tidyName} from '../displayName';
import type {CollisionWorld, CombatEvent, FighterId, PlayerState, Vec3} from '../types';
import {BOT_LEVELS, BallBrain, PLAN_LINES, dealPlan, isBotLevel, type BotLevel} from './BallBrain';
import {
  BALL_ID, BALL_RULES, BALL_SPORT, BALL_STAGE, BALL_TEAMS, CHARM_KINDS, CLASH, GOAL_FIGHT, GOAL_STANCE, PASS_CALL, QUICK_CHAT_LIMIT, quickChat, GOAL_RULES, RUMBLE, SPIKE_RULES, ballAssist, charmName, heatTier, otherTeam,
  type BallAccess, type BallCharm, type BallEffect, type CharmKind, type BallEvent, type BallModeId, type BallSeat, type BallSnapshot, type BallState,
  type BallTeam, type BallView, type ShotKind,
} from './model';
import {courtSide, freshBall, goalZ, headingInto, landing, sideOf, speedCap, stepBall, type BallContact} from './physics';
import {SPIKE_DIG, strikeBall} from './strike';
import {REPLAY, replayLength, type BallReplay} from './replay';
import {MUTATOR_RULES, baseGravity, baseSize, isMutator, type BallMutator} from './mutators';
import {TRAIT_RULES, traitOf, withTrait} from './traits';
import {DRILLS, DRILL_RIVAL, DrillRunner, isDrill, type DrillFeed, type DrillId} from './drills';
import {BallLesson, LESSON_CAST, type LessonHost} from './lesson';
import {CELEBRATE, celebrationOf, cleanLook, type Celebration} from './look';
import {DUEL, LINK, SIGNATURE_FIGHTERS, SIGNATURE_SHOTS} from './superShots';
import {INTRO, SHORT_INTRO, podiumOf} from './ceremony';

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
  /** FREE PLAY as LEARN TO PLAY, the guided first game (lesson.ts): its cast seated, its steps on the machine. */
  lesson?: boolean;
  /** The match opens with its intro (ceremony.ts INTRO: the flyover, the splash page, the whistle), held in a
   *  longer countdown. Never in FREE PLAY; the page's offline match and the online rooms ask for it, a couch one doesn't.
   *  'short' is the short intro (SHORT_INTRO: the splash page and the whistle), a rematch's. */
  intro?: boolean | 'short';
  /** The bots' level the player picked (BallBrain BOT_LEVELS: EASY, NORMAL, HARD), for the bots of a side with
   *  no person on it (levelBots); NORMAL unless a match on this device asks. */
  difficulty?: BotLevel;
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
/** The TACKLE drill's carrier's seat (drills.ts). */
export {DRILL_RIVAL};
/** Ultimate and awakening meter a touch is worth, by slot: a side that keeps the ball moving earns its super shot. */
const TOUCH_METER: Record<string, [number, number]> = {light: [2, 2.5], heavy: [3.5, 3.5], special: [4, 4], ultimate: [0, 5], area: [3.5, 3.5]};
/** Goal Rush's share of TOUCH_METER's ultimate meter (on the smaller pitch the ball is touched a fifth more
 *  often and the sides fight half as much again, so at the full share there were 8.3 super shots a match, one every 40
 *  s, and their goals were 63% of the score; at .8, 7 a match and about half). */
const GOAL_TOUCH_METER = .8;
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
/** A guard meets the ball once (a block announced a dozen times, and paid a dozen times, is no moment at all). The ball it turns away leaves it - at `leave` m/s at
 *  the least against the guarding body's own motion, along the line from the body to the ball - and that body lets it
 *  go until it is clear of its reach (`clear` s at the most) or somebody else has touched it. A SUPER SHOT that bowls a
 *  body over flies on through it the same way. And a guard's credit (its event, the block or save, the points, the meter)
 *  comes once a `credit` s. Without it, in the bot sims, a stuffed ball rode a rising blocker's hands, a STUFF BLOCK every tick;
 *  a keeper's PERFECT GUARD sent the ball up the way they looked, back into their own body in the air, eight times in a
 *  row, each a sixth of the super shot's meter; a SUPER SHOT bulldozed the same keeper four ticks running, a tenth of
 *  its speed lost at each. */
const GUARD_OFF = {leave: 3, clear: .4, credit: .4} as const;
/** How near the net (m) a Sky Spike fighter's body may stand: never past it (tidyBodies). The net's collider is
 *  0.12 m either side of the line (game/environmentLayout.ts) and a body a PLAYER_RADIUS round: no step ever stands a
 *  body nearer, so only a move that carried one through it is put back. */
const NET_SIDE = .12 + PLAYER_RADIUS;
/** The frame's posts and crossbar ring once for a ball rattling between them (OFF THE POST!, CROSSBAR!: one
 *  event a `post` s), and Sky Spike's net once for a ball caught in it (one 'net' a `net` s). */
const RATTLE = {post: .6, net: .6} as const;
/** What each thing a seat does is worth toward MVP (BallSeat.points: the results card's order and its MVP, the podium's
 *  steps). One table, so the tally reads as a whole. The MVP is the most points, `win` more to each of the winners.
 *  Rewards follow skill: a tally carried by touches hardly told a skilled player from a casual one (Goal Rush
 *  1043 points against 1000) and a masher out-scored a casual one in Sky Spike, because touches (2 each, sixty a match)
 *  and shots on target (20) carried it. Now the moments carry it - goals and assists, the PERFECT STRIKE and SPIKE, the
 *  STUFF BLOCK, saves, tackles, digs and kills - and a touch is worth 1, a shot on target 10. A strike out of a flurry of
 *  presses (MASHED: a SCUFF) earns nothing for its touch or its shot, and a goal or a kill off one a third or so of a
 *  clean one's; a ball put out, a fourth touch and an own goal are debits. A LINK SHOT is worth `link` and no more (its
 *  accolade was 25 on top). Measured with the scripted players (playerModels.ts), 48 paired seeds. */
export const MVP = {
  touch: 1, shot: 10, scuffTouch: 0, scuffShot: 0, goal: 120, scuffGoal: 40, ownGoal: -60, assist: 50,
  save: 50, divingSave: 60, perfectSave: 80, shield: 30,
  perfectStrike: 100, perfectSpike: 80, tackle: 30, takedown: 50, wipeout: 10,
  block: 30, stuff: 110, dig: 30, divingDig: 50, kill: 80, scuffKill: 20, superKill: 140, ace: 90, fault: -60, serve: 2, perfectServe: 50,
  link: 25, linkSetter: 10, duel: 90, clash: 15, charm: 5, win: 25,
} as const;
export type MvpKind = Exclude<keyof typeof MVP, 'win'>;
/** Sky Spike: a body climbing at `rising` m/s or more is still on its way up; a ball within `near` metres past its reach
 *  is one it is climbing past (bodyContacts). */
const CLIMB = {rising: .6, near: .6} as const;
/** Sky Spike: a swing leaving with the body falling slower than this (m/s) is one from the top of the jump. */
const SWING_TOP = .6;
/** Sky Spike's PERFECT SPIKE: a
 *  spike struck from the top of the jump - the striker's body at `apex` of their jump's height or more - with the ball
 *  over `ball` metres and within `net` metres of the net (so every one is a SKY SPIKE too). It flies faster and a heat
 *  tier over its cap (strike.ts), burns `heat` hotter, holds the striker in the air a beat on the blow (`freeze` s: the
 *  hang at the top), and is worth MVP.perfectSpike. Struck on the way up instead, the swing brakes the jump at a metre or two
 *  (the kernel's air cast) and the spike is an ordinary one. Its strike event is a SKY SPIKE's (`text`), so whatever
 *  the page does for one it does for this, with `perfect` set for anything more (the shot ticker names it). It
 *  goes through any block at the net (`through` metres of it) that is not a STUFF BLOCK - hands up early, or a body in
 *  the way - so the timing of the spike is answered only by the timing of the block (or a dig behind it). */
const PERFECT_SPIKE = {apex: .92, net: 3.6, ball: 3.6, heat: .7, freeze: .1, through: 2.6} as const;
/** Goal Rush's PERFECT STRIKE, the moment a player is proud of. A ball coming to you - a pass, a cross, a rebound, a
 *  clearance: `incoming` m/s or more
 *  of its own flight toward you - met by the blow just as it arrives: it came inside `shell` metres of your chest no more
 *  than `arrived` s before the blow (too late, the ball is on your body first), it is met no further than `sweet` metres
 *  out (a melee blow's lunge carries the body at the ball, so a swing pressed early meets it four metres out), and the
 *  blow's box had been open no more than `late` s (earlier still, the swing waits for it with its box open, or whiffs).
 *  A heavy met at 12 m/s has about an eighth of a second to be pressed in. A heavy, a special or an air blow (a tap's
 *  pass, a launcher's pop, a beam, an area move and an ultimate never are). It flies `speed` times faster and a heat tier
 *  over the ball's cap (strike.ts), is helped onto the frame from further out and laid deeper in its corner, burns
 *  `heat` hotter, holds the striker a beat on the blow (`freeze` s), and is worth MVP.perfectStrike and `meter` of the
 *  super shot's. A swing at nothing in the last `clean` s spoils it - a perfect strike is the first swing at the ball, so a
 *  button-masher swinging at the air as it comes never has one (in the bot sims, before that rule, a masher piloting a
 *  seat struck five times the perfects a bot at its best did). Its strike event is `perfect: true` with the text
 *  PERFECT STRIKE, PERFECT VOLLEY in the air (or the flair's own name). */
export const PERFECT_STRIKE = {incoming: 5, shell: 2.6, arrived: .1, late: .04, sweet: 3, clean: .65, speed: 1.15, heat: .6, freeze: .07, meter: 4} as const;
/** Goal Rush's HEADER: a ball meeting the upper body (its centre over `head` metres off the feet: the chest up) that
 *  jumped into it, coming in at `from` m/s or more, is headed on - not bounced off - the way the body faces (the
 *  stick's), helped onto the frame like a shot (strike.ts). A cross off a corner is turned in by jumping into it. (A
 *  ball dropping onto a head that stayed on the floor only bounces: with those, every match had forty headers.) Timed at the top of the jump (the body rising or falling no faster than `apex` m/s) with the ball
 *  coming in at PERFECT_STRIKE.incoming or more, it is a PERFECT HEADER. At most once a `gap` s each. */
export const HEADER = {head: .75, from: 3, apex: 2.6, gap: .35} as const;
/** Goal Rush's swings (comebacks, the last push, overtime's drama). With `finalFrom` seconds left and the score
 *  within `close` goals, the FINAL PUSH: the event 'fever' (text FINAL PUSH; `view.fever` on), the ball burning at
 *  `finalHeat` at least (every shot livelier), and the side behind earning `finalMeter` times the super shot's meter from
 *  its touches. A goal that draws a side level after it was `behind` or more down is a COMEBACK (an accolade). (A side
 *  two down earning a quarter more meter all match, with the bots behind sharper by .05 a goal, won eight of sixteen bot
 *  matches it had been two down in: a comeback is a moment, not the rule.) */
const GOAL_SWING = {behind: 2, finalFrom: 30, close: 2, finalHeat: 1.5, finalMeter: 1.5} as const;
/** Skill against mashing (a game worth coming back to rewards learning): a blow on the ball out of a flurry of
 *  presses - the attack pressed `presses` times or more
 *  (cooldowns and all) in the `window` seconds before it lands, in the BALL stance - is MASHED: a SCUFF (strike.ts),
 *  slower, off its aim by up to `yaw` radians either way, unhelped and never a PERFECT, its strike event's text SCUFFED,
 *  and it earns none of the touch's meter. In Sky Spike the body's own touch (the automatic bump) while the hands mash
 *  is one too: flailing, nothing is played clean. An ultimate is never one. A timed press, a light string pressed in rhythm
 *  (a press every 0.25 s or slower: three span 0.5 s, past the window by a twentieth, the room's jitter's margin) and
 *  every bot's press (0.28 s apart at the least) never are. Presses are counted as the room steps them (the kernel's
 *  attackSeq), so a press its cooldown refused counts: they are the hands, not the blows. Measured with the scripted
 *  players (playerModels.ts): without it, a masher's side did as well as a casual player's in Goal Rush and a skilled
 *  one's in Sky Spike.
 *  A heavy's half second of wind-up let a flurry show before its blow landed; SHOOT's quick strike (model.ts SHOOT)
 *  lands an eighth of a second after its press, before a third press can come. So a quick strike with any attack
 *  pressed again between its own press and its blow is MASHED too: nobody timing a shot presses twice inside an
 *  eighth of a second, and a masher's first swing at the ball no longer comes out clean. And so is a quick strike
 *  pressed within `tap` seconds of the attack press before it: a flurry's second press, where a person timing a shot
 *  presses once (the scripted casual and skilled players press 0.3 s apart or more, the bots 0.28). Without it the
 *  masher's instant swings came out clean between its flurries: the scripted MASHER won 56% of Sky Spike's matches on
 *  NORMAL (29% before the quick strike), over the skilled player's 48%. */
export const MASHED = {presses: 3, window: .45, yaw: .5, tap: .25} as const;
/** A body reeling from a blow (or down) heads nothing: the ball only bounces off it. */
const REELING: ReadonlySet<string> = new Set(['launched', 'knockdown', 'getup', 'stun', 'splat', 'defeated']);
/** A HEADER's blow, as strike.ts reads one (no swing: the body's own). */
const HEADED: MoveDefinition = {name: 'Header', duration: .3, contacts: [0], damage: 0, range: 1, radius: 1, stamina: 0, cooldown: 0, stun: 0, knockback: 0, style: 'melee'};
type Actor = NonNullable<ReturnType<ArenaSimulation['actors']['get']>>;
/** Sky Spike's DIVING DIG: a body that has dashed in the last `window` s, at a hard ball (strike.ts SPIKE_DIG)
 *  coming into its own court off the other side, reaches `reach` metres further for it - the dive. The dig itself (any,
 *  dived or not) floats up high (strike.ts) and is announced (the event 'dig', DIG or DIVING DIG). With spikes struck from the
 *  top of the jump, nine points in ten were kills and a rally lasted 2.7 crossings: the dive is the defence's answer. */
const DIG_DIVE = {window: .5, reach: .75, ahead: .12} as const;
/** Sky Spike's JUMP SERVE (strike.ts SERVE_STYLE). The server jumps in the walk-up and the
 *  hanging ball is tossed with them: it climbs to the server's reach at the top of their jump (`reach` m over the jump's
 *  top) as the body gets there, and drops back to where it hung if it is not struck (no fault: a toss let go). Struck
 *  with the body at `apex` of its jump's top or more (as a PERFECT SPIKE), the serve goes where it was aimed, a heat tier
 *  over the ball's cap; struck lower, it sprays long by `spray` metres plus up to `wild` more, and wide by up to half of
 *  `spray` plus `wide`, the further under the top the more (all of it from `low` of the top down) - an ACE on the lines,
 *  or out. */
/* A FLOAT SERVE's late drift makes its reception go off line: the receiver's first touch lands up to `shank` metres off
 *  the spot a bump is laid for (across, and along the court), so the set comes from wherever the setter can get to. A
 *  serve of `stretch.speed` m/s or more (a JUMP SERVE, a hot DRIVE) met with the body `stretch.from` metres or more off
 *  its line - at full stretch, not behind it - comes off the arms `stretch.miss` metres off line and up to `stretch.wild`
 *  more (all of it `span` metres further out): often out or down, the server's ACE (point). */
const SERVE_RULES = {reach: .9, apex: .92, spray: 1.2, wild: 4, wide: 2.4, low: .7, shank: {x: 3.4, z: 2.4},
  stretch: {speed: 22, from: 1.15, span: .9, miss: 2.5, wild: 3.5}} as const;
/** Online, a person's touch of the ball judged against the ball as their page drew it: a PERFECT STRIKE must not be a
 *  coin toss online. A page draws the ball and everyone else `view` seconds behind the room - the round trip, the
 *  timeline's 60 ms, the input queue: 0.15 s on a local link, 0.25 s at a 120 ms round trip (measured,
 *  network/devLag.ts) - and its own fighter where its presses will put it. Judged against the room's present, a
 *  perfectly timed PERFECT STRIKE scored 0 in 20 at every round trip, a STUFF BLOCK 0 in 20 from 60 ms, a PERFECT SPIKE
 *  0 in 20 at 200 ms. So the room keeps the ball's last `keep` seconds, a tick at a time (with the rally's count and
 *  where each fighter stood), and judges a person's swing, guard, header and tackle against the ball (and the one
 *  tackled) as their page had it:
 *  - at most `most` seconds back (the bound: a page claiming an older view gains at most that much of a look ahead);
 *  - by the lag the person's own inputs report (PlayerInput.view), from views that never run backwards, and never more
 *    than `over` past the lag's steady value (which follows the link over `settle` s): a page cannot claim a long lag for
 *    one press only;
 *  - only when nobody else has touched the ball since (and no point was won): a touch of the person's own body since does
 *    not count - it is the very lateness this mends (online the ball reached the body before the late swing did).
 *  Off (`compensate` 0) on this device, in a couch match and in every test that does not ask: the online room turns it on
 *  (BallRoom). */
export const SEEN = {most: .3, keep: .4, over: .04, settle: 1, overNet: 1} as const;
/** A body's touch of the ball and the same seat's swing landing on it within `window` s are one touch. The ball meets the
 *  body a breath before the swing pressed for it lands, and both counted: in Sky Spike that spent two of a side's three
 *  touches (a bump and a set from one player, a set's hitter called for FOUR TOUCHES), about 13 a match; in Goal Rush 15
 *  touches a match too many on the card. The swing plays the ball - its flight, its events, a LINK SHOT off a team-mate's
 *  set - as the touch the body already counted; the body's own ball is the swing's to replace. (Sky Spike's last touch
 *  played by the body goes over by itself: a swing just behind it plays it instead.) */
export const DOUBLE = {window: .12} as const;
/** Goal Rush's first touch (before it nobody in Goal Rush ever had the ball: it was struck, it flew, it was struck again):
 *  - **TRAP:** a guard pressed `window` seconds or less before the ball reaches it, the body on its feet, kills a ball that
 *    is not a shot at the guard's own goal dead at its feet - where a PERFECT GUARD's rebound sent it up and away - and
 *    the body carries it (CARRY), held for it `settle` s with the stick let go so it can start its run. Judged where the
 *    page drew the ball (SEEN): online, the press as the page made it against the ball reaching the body, a press heard
 *    after the room's ball has met the body included. A keeper's save stays a save: a shot at its own goal is saved, as
 *    ever. Its event is a 'perfect' one with the text TRAP, and it earns a light touch's meter and no points (a PERFECT
 *    GUARD's 16 of the super shot's, with fifteen TRAPs a match in the bot sims, made 0.9 more super shots a match).
 *    A press heard after the room's ball met the body traps it where it is, if that is no more than `reach` m off.
 *    (0.3 s: the just-guard window's 0.25 and a little more - the sport's first touch, not a parry - the margin a page's
 *    jitter takes out of it online.) */
export const TRAP = {window: .3, settle: .5, reach: 4} as const;
/** - **CARRY:** a body in the BALL stance, on its feet and not swinging, with the stick held (`stick` of it or more), that
 *    runs at `run` m/s or more into a slow ball - `slow` m/s or less along the floor, its centre no more than `low` m over
 *    a ball at rest, rising or falling no faster than `lift` m/s - or has just trapped it carries it: the ball stays at its
 *    feet, `gap` m in front of its body along the way it runs (turned round the body at up to `turn` rad/s as the run
 *    turns: a turn, never a jump), and the body runs at `pace` of its speed, the boost's too (the kernel's speed mod, which
 *    the carrier's own rollback checkpoint carries to their page). It ends when the carrier strikes the ball (its own blow plays
 *    it from the feet, as a ball at rest), loses it (a TACKLE or a BUMP, which pop it LOOSE toward whoever did it; a blow
 *    that leaves the carrier reeling; a body of the other side meeting the ball; a swing of theirs playing it), leaves the
 *    floor, locks on a fighter, or lets the stick go (the ball rolls on at the carrier's pace); a wall or a post that holds
 *    the ball `lose` m off its spot ends it too, and so does the goal line: carried over it in the mouth, where the body
 *    can go no further, the ball rolls on into the net at the carrier's pace. A carried ball is the carrier's: a team-mate's body and swings let it be.
 *    A body that has lost one does not carry again for `again` s. Live play only, and never under a ball machine (FREE
 *    PLAY's drills, LEARN TO PLAY: their machine moves the ball itself). (`slow` 6.5: the carrier's own pace let go is 8,
 *    so a ball let go a moment ago is not taken straight back.) */
export const CARRY = {stick: .5, slow: 6.5, low: .35, lift: 3, run: 1.5, gap: .12, turn: 9, pace: .85, lose: .7, again: .5} as const;
/** - **LOOSE:** a carried ball knocked off its carrier by the other side - a TACKLE, a
 *    BUMP - pops loose toward whoever did it, `speed` m/s along the floor and `up` m/s up: it comes down about two metres
 *    on, at the feet of a tackler in reach, theirs to win if they follow it up. */
export const LOOSE = {speed: 5, up: 3} as const;
/** Where a carried ball sits (CARRY): `gap` m in front of a body along `heading`, on the floor (`r`: the ball's radius). */
export function carrySpot(p: {x: number; z: number; size?: number}, heading: number, r: number) {
  const d = PLAYER_RADIUS * (p.size ?? 1) + r + CARRY.gap;
  return {x: p.x + Math.sin(heading) * d, y: r, z: p.z + Math.cos(heading) * d};
}
/** Whether a body meeting the ball takes it on as a carry (CARRY): the ball slow, low and free, the body on its feet in
 *  the BALL stance, not swinging or reeling, its stick held and its run (`run`, m/s toward the ball) into it. */
export function carries(b: BallState, r: number, body: {grounded: boolean; alive: boolean; action: string; swinging: boolean; locked: boolean; stick: number}, run: number, now: number) {
  return !b.held && !b.super && b.frozenUntil <= now && b.clash <= now && Math.hypot(b.vx, b.vz) <= CARRY.slow && b.y <= r + CARRY.low && Math.abs(b.vy) <= CARRY.lift
    && body.alive && body.grounded && !body.swinging && !body.locked && !REELING.has(body.action) && body.stick >= CARRY.stick && run >= CARRY.run;
}
/** The velocity a carried ball pops LOOSE with from `b` toward `to` (LOOSE). */
export function looseToward(b: Vec3, to: {x: number; z: number}) {
  const dx = to.x - b.x, dz = to.z - b.z, d = Math.hypot(dx, dz) || 1;
  return {vx: dx / d * LOOSE.speed, vy: LOOSE.up, vz: dz / d * LOOSE.speed};
}
const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
/** The rules of a touch that the page forecasts for its own fighter (touchForecast.ts), read from here so the
 *  page's forecast and the room's touch cannot drift apart. */
export const TOUCH_RULES = {BODY_LOW, BODY_HIGH, BODY_BOUNCE, GOAL_BODY_BOUNCE, GUARD_REACH, CLIMB, SWING_TOP, PERFECT_SPIKE, SERVE_RULES, DIG_DIVE, HEADED, BOWL, REELING, GUARD_OFF, DOUBLE, TRAP, CARRY} as const;
/** One tick of the ball's history (SEEN): the ball, the rally's count, where each fighter stood, and what changed the
 *  ball's flight in that tick - a seat's touch (`body`: its body's, `touch`: a swing's or a guard's), or the match's own
 *  doing or nobody's known (`by` null). */
interface Seen {t: number; phase: BallView['phase']; ball: BallState; touchTeam: BallTeam | null; touches: number; rally: number; hot: boolean; bodies: Map<string, Vec3>; change?: {by: string | null; kind: 'body' | 'touch'}}
/** Sky Spike: the swings of a match. DEUCE at `target - 1` all (and every tie after it); a COMEBACK when a side
 *  that trailed by `comeback` or more draws level. Matches that go down to the wire, without feeling rigged:
 *  `feverBehind` - a FEVER rally's point counts double to the side behind, or to either side with the score level,
 *  and one to the side ahead. The comeback's lever, in the open: the banner and the caller say whose point is worth
 *  two. */
export const SWINGS = {comeback: 4, feverBehind: true} as const;
/** Goal Rush: a save made with the ball this close to the goal line (m), in front of the mouth, is OFF THE LINE (round
 *  3's near-misses). A body stands at most a stride off its line (the stage's bounds) and meets a shot straight at it
 *  about 2.1 m out, so this is a strike that clears it from the line, or a body that meets one coming in across the
 *  mouth: two or three a bot match. (At 2.3 m every shot blocked by somebody standing on the line counted, ten a match.) */
const LINE = 1.9;
/** A ball this fast (m/s) cleared by a body on the line, or by a strike, is a shot saved; slower, it only rolled there. */
const LINE_SHOT = 15;
/** Goal Rush: a strike or a header that stops a shot is a save only this close to its own goal line (m) - in
 *  front of the goal, a keeper's ground. Further out it is a block, as a defender's is: with the bots meeting balls as
 *  they arrive (BallBrain PRESSURE), every shot charged down on halfway was a SAVE, thirty a match. */
const SAVE_ZONE = 8;
/** A spot on red's half laid as shares of the pitch's half-width and half-length (GOAL_RULES), so the marks follow the
 *  pitch's size. */
const share = (x: number, z: number) => ({x: x * GOAL_RULES.halfX, z: z * GOAL_RULES.halfZ});
/** Goal Rush's kickoff spots (on red's half; blue's mirror them): five of them, scaled to the pitch (on the 26 × 38 m
 *  pitch the diagonals are 9.5 m from the ball, a second's run). */
const KICKOFF_SPOTS: readonly {x: number; z: number}[] = [share(-.45, .39), share(.45, .39), share(-.09, .58), share(.09, .58), share(0, .7)];
/** The match's first kickoff: one straight at the ball, two on the diagonals. */
const FIRST_KICKOFF: readonly {x: number; z: number}[] = [share(0, .5), share(-.47, .69), share(.47, .69)];

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
export class BallMatch implements ExternalTargets, LessonHost {
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
  /** DOUBLE: when each seat's body last played the ball as a touch of its own (Sky Spike's automatic bump, a
   *  body's bounce counted as a touch), and whether it was one of a Sky Spike side's three. */
  private readonly bodyPlayed = new Map<string, {at: number; three: boolean}>();
  /** Every touch lately, oldest first: `strike` false for a ball that only bounced off a body. */
  private touchesLog: (Touch & {strike: boolean; shot?: ShotKind; scuffed?: boolean})[] = [];
  /** Blows a stopped ball took, landing together when its time starts again. */
  private stack: {vx: number; vy: number; vz: number; heat: number; count: number; id: string; team: BallTeam; shot: ShotKind; super?: boolean} | null = null;
  /** A TECHNIQUE DUEL on now: who guarded, whose shot, and how it ends when the beat does (releaseStack). */
  private duelling: {keeper: string; striker?: string; keeperWins: boolean; x: number; y: number; z: number} | null = null;
  /** The last real strike (not a tap, bump or set), for a CLASH with the other side's next one. */
  private clashAt = -Infinity;
  /** When each seat last dashed: a save straight after one is a DIVING SAVE. */
  private readonly dashAt = new Map<string, number>();
  /** GUARD_OFF: the bodies letting the ball go after their guard turned it away (or a SUPER SHOT bowled them
   *  over), until when; and when each seat's guard was last credited. */
  private readonly shed = new Map<string, number>();
  private readonly guardCredit = new Map<string, number>();
  /** When the frame last rang (RATTLE), and the cast each seat's SUPER SHOT was last announced for. */
  private postAt = -Infinity;
  private netAt = -Infinity;
  private readonly superCast = new Map<string, number>();
  /** What each seat's points were for (MVP's kinds, and the accolades' own), for the measures. */
  private readonly tally = new Map<string, Partial<Record<MvpKind | 'accolade', number>>>();
  /** Goal Rush: when the ball was last outside each seat's PERFECT_STRIKE.shell (the strike's timing reads it); each
   *  seat's swing under way (its cast's id) and when its last swing at nothing ended (PERFECT_STRIKE.clean). */
  private readonly outsideAt = new Map<string, number>();
  private readonly swingOf = new Map<string, number>();
  private readonly whiffAt = new Map<string, number>();
  /** Each seat's last attack presses in the BALL stance (server times, newest last) and the press it last counted
   *  (the kernel's attackSeq): MASHED reads them. */
  private readonly pressedAt = new Map<string, number[]>();
  private readonly pressSeq = new Map<string, number>();
  /** The last flair shot named (BICYCLE KICK...): whose and when, for the accolade if it scores. */
  private flair: {id: string; at: number; text: string} | null = null;
  private lastStrike: {id: string; team: BallTeam; at: number; power: number; vx: number; vy: number; vz: number; shot: ShotKind; super: boolean; tapped?: boolean} | null = null;
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
  /** When each striker was last tackled (GOAL_STANCE.tackle.gap). */
  private readonly tackledAt = new Map<string, number>();
  /** (CARRY) The carry on now - whose, the way the ball sits round their body, since when, and until when it
   *  is held for them with the stick let go (a TRAP's grace) - and when each seat last lost one (CARRY.again). */
  private carrier: {id: string; heading: number; since: number; settle: number} | null = null;
  private readonly lostAt = new Map<string, number>();
  /** Online (TRAP, judged as SEEN judges): when each person's body last met the ball unguarded, and whether it was a shot
   *  at their goal then; the guard press last heard from each. */
  private readonly metAt = new Map<string, {t: number; shot: boolean}>();
  private readonly guardHeard = new Map<string, number>();
  /** (PASS_CALL) Each side's call for the ball - the person who called, until when. */
  private readonly calls = new Map<BallTeam, {id: string; until: number}>();
  /** Goal Rush's first touches and passes, counted for the measures: TRAPs, carries
   *  begun (a TRAP's among them) and the seconds carried, passes the stick aimed (PASS_AIM), bots' passes to a person who
   *  called for it, and carried balls popped LOOSE. */
  readonly counts = {traps: 0, carries: 0, carried: 0, aimed: 0, called: 0, loose: 0};
  /** How each carry ended, by cause (the measures'). */
  readonly carryEnds: Record<string, number> = {};
  private onTargetSince = -Infinity;
  private feverTold = false;
  /** The most each side has been down this match: Goal Rush's COMEBACK (GOAL_SWING) and Sky Spike's (a match plays one). */
  private deficit: Record<BallTeam, number> = {red: 0, blue: 0};
  private matchPointTold = 0;
  /** Sky Spike: the JUMP SERVE's toss under way (SERVE_RULES): from when, where the ball hung, how high it goes, and the
   *  server's rise (s) to the top of the jump. The deepest deficit each side has been in this match (a COMEBACK). */
  private toss: {at: number; from: number; peak: number; rise: number} | null = null;
  /** Sky Spike: a FLOAT SERVE on its way, not yet played: its receiver's first touch goes off line (SERVE_RULES.shank). */
  private floated = false;
  /** Sky Spike: a PERFECT SPIKE in flight, untouched since: it goes through hands and bodies up at the net that are not a
   *  STUFF BLOCK (PERFECT_SPIKE.through). */
  private hot = false;
  /** Online lag compensation's reach (SEEN.most), set by the online room; 0: off (this device, couch, tests). */
  compensate = 0;
  /** Each person's view (SEEN): the newest their page reported, its lag behind the room and the lag's steady value. */
  private readonly views = new Map<string, {view: number; lag: number; steady: number; at: number}>();
  /** The ball's last SEEN.keep seconds, oldest first (SEEN), and what has changed its flight in the tick under way. */
  private history: Seen[] = [];
  private change: Seen['change'];
  /** Whose time the ball plays in (SEEN): the person it was last put back for, until somebody else touches it; null:
   *  the room's own. */
  private frame: string | null = null;
  /** Until when the ball hangs where the last touch left it, for the person whose page has not seen it go yet (SEEN). */
  private hangUntil = -Infinity;
  private readonly flight: BallContact[] = [];
  /** A swing's view of the ball as its page drew it (locate, query): the body handed to the kernel, and whose it is. */
  private readonly seenBody: ExternalBody = {id: BALL_ID, x: 0, y: 0, z: 0, radius: 1, height: 2, airborne: false};
  /** Sky Spike: where each seat's swing left from (its cast and the body's height as it began): a swing pressed at the top
   *  of the jump is struck from there (receive), whatever the wind-up's air cast does to the body before it lands. */
  private readonly castFrom = new Map<string, {id: number; y: number}>();
  private readonly preCast = new Map<string, {y: number; cast: number; vy: number}>();
  /** Sky Spike: hitters climbing past the ball on the attacking touch, whose body plays it at the top (bodyContacts). */
  private readonly climbing = new Set<string>();
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
  /** The seed as the match began, which deals each side of bots its plan (BallBrain dealPlan) without a draw. */
  private readonly dealt: number;
  private rng = () => { let x = this.seed; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; this.seed = x >>> 0 || 1; return this.seed / 0x100000000; };

  constructor(readonly mode: BallModeId, options: BallOptions = {}) {
    this.seed = ((options.seed ?? 1) * 2654435761) >>> 0 || 1; this.dealt = this.seed;
    this.difficulty = isBotLevel(options.difficulty) ? options.difficulty : 'normal';
    this.replays = (options.replays ?? true) && !options.practice;
    this.radius = mode === 'goal-rush' ? GOAL_RULES.ballRadius : SPIKE_RULES.ballRadius;
    this.hitR = mode === 'goal-rush' ? GOAL_RULES.hitRadius : SPIKE_RULES.hitRadius;
    // (A drill with a carrier, FREE PLAY's TACKLE, fights as a match does: drills.ts DrillDef.rival.)
    // (So does LEARN TO PLAY's, whose FIGHT & TACKLE is that drill's: lesson.ts.)
    this.pvp = mode === 'goal-rush' && (!options.practice || (isDrill(options.drill) && !!DRILLS[options.drill].rival) || !!options.lesson);
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
    else if (options.intro) this.view.intro = options.intro === 'short' ? {seconds: SHORT_INTRO.seconds, short: true} : {seconds: INTRO.seconds};
    this.view.arena = isBallArena(options.arena) && BALL_ARENAS[options.arena].mode === mode ? options.arena : arenaFor(mode, this.seed);
    if (this.difficulty !== 'normal' && !options.practice) this.view.level = this.difficulty;
    if (options.practice && isDrill(options.drill) && DRILLS[options.drill].mode === mode) { this.drill = new DrillRunner(options.drill, this.rng); this.view.drill = this.drill.view; }
    else if (options.practice && options.lesson) { this.lesson = new BallLesson(mode, this.rng); this.view.lesson = this.lesson.view; }
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
    if (this.view.phase !== 'lobby') this.levelBots();
  }
  /** Each bot's level and composure (BallBrain BOT_LEVELS, COMPOSURE). A side with a person on it (a seat no
   *  bot plays) is the person's: its bots are the level's team-mates (EASY's the best, otherwise NORMAL's), who play
   *  their own game at any score. A side of bots alone takes the difficulty picked, and eases off ahead and digs in
   *  behind. With people on both sides, every bot takes the difficulty and none eases off: each person has the same
   *  help. A side of bots alone also plays a plan (BallBrain PLAN, dealt from the match's seed and round), and
   *  at the start one of them says it (PLAN_LINES); a person's team-mates follow the person. */
  private levelBots(start = false) {
    const people = (team: BallTeam) => [...this.seats.values()].some(s => s.team === team && !this.brains.has(s.id));
    const both = BALL_TEAMS.every(people);
    for (const [id, brain] of this.brains) {
      const seat = this.seats.get(id);
      if (!seat) continue;
      const mine = people(seat.team);
      brain.levelled(both || !mine ? this.difficulty : BOT_LEVELS[this.mode][this.difficulty].mates, !mine,
        mine || this.view.practice ? undefined : dealPlan(this.mode, this.dealt, seat.team, this.view.round));
    }
    if (!start || this.view.practice) return;
    for (const team of BALL_TEAMS) {
      const said = !people(team) && [...this.seats.values()].find(s => s.team === team && this.brains.has(s.id));
      const line = said && PLAN_LINES[this.mode][dealPlan(this.mode, this.dealt, team, this.view.round).plan];
      if (said && line) { this.chats.push({at: (this.view.startsAt ?? this.sim.serverTime) + 1.2, id: said.id, team, text: line}); this.chats.sort((x, y) => x.at - y.at); }
    }
  }
  private readonly difficulty: BotLevel;
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
    // (Online: when the page drew the ball and the others as it sent this - SEEN.)
    if (this.compensate > 0 && input.view !== undefined) this.viewed(id, input.view);
    // Bodies hold their marks through a countdown and a kickoff (the serve's walk-up is play).
    if (this.view.phase === 'countdown' || (this.view.phase === 'kickoff' && this.mode === 'goal-rush' && !this.view.practice)) return this.heard(id, input.seq);
    // Everyone watches the replay: nobody plays on behind it.
    if (this.replaying()) return this.heard(id, input.seq);
    // The stance (GOAL_STANCE): the ball, or the opponent the person locked on with Tab.
    this.stance(seat, input);
    return this.sim.submitInput(id, input);
  }
  /** A command the match holds back (a countdown, a kickoff, a replay) is not played, but it is heard: its number is
   *  acknowledged (the snapshot's `ackSeq`), as a played one's is. A page online counts the commands the room has not
   *  acknowledged and stops sending at forty of them (main.ts MAX_IN_FLIGHT, a stalled link's guard), so unacknowledged
   *  the countdown's three seconds would stop it for good, and every fighter in an online ball room would stand frozen
   *  from the first kickoff on (the offline match has no wire). */
  private heard(id: string, seq: number) {
    const a = this.sim.actors.get(id);
    if (a && seq > a.lastSeq) a.lastSeq = seq;
    return false;
  }
  // ─── Online: the ball as each person's page drew it (SEEN) ─────────────────────────────────────────────────────────
  /** A person's input says when their page drew the frame it was pressed on: the lag behind the room now, never from a
   *  view older than one already heard (the page's clock never runs back), and its steady value, which follows it over
   *  SEEN.settle seconds. */
  private viewed(id: string, view: number) {
    const now = this.sim.serverTime, was = this.views.get(id), seen = Math.max(view, was?.view ?? -Infinity);
    const lag = Math.max(0, Math.min(this.compensate, now - seen));
    const steady = was ? was.steady + (lag - was.steady) * Math.min(1, Math.max(0, now - was.at) / SEEN.settle) : lag;
    this.views.set(id, {view: seen, lag, steady, at: now});
  }
  /** How far behind the room a person's page drew the ball (s; 0 for a bot, offline, or with compensation off). */
  lagOf(id: string) {
    const v = this.compensate > 0 ? this.views.get(id) : undefined;
    return v ? Math.min(v.lag, v.steady + SEEN.over, this.compensate) : 0;
  }
  /** The tick of the ball's history a person's page drew (SEEN), while it still stands: nobody else has touched the ball
   *  since, no point has been won, and the person's own touches since were their body's alone. */
  private seen(id: string) {
    const lag = this.lagOf(id), h = this.history;
    if (lag < 1 / 120 || !h.length || this.frame === id) return undefined;
    const t = this.sim.serverTime - lag;
    let i = h.length - 1;
    while (i > 0 && h[i].t > t + 1e-6) i--;
    if (h[i].t > t + 1e-6 || !this.fair(id, this.change)) return undefined;
    // (Somebody else's touch since: the page has not seen it yet. The ball as it left that touch, held there until the
    // page would see it go - `hang` s, the most it can be is the lag.)
    let k = h.length - 1;
    while (k > i && this.fair(id, h[k].change)) k--;
    const e = h[k];
    if (e.phase !== this.view.phase || e.ball.held) return undefined;
    // (CARRY: never a carried ball, then or now - it is at its carrier's feet, which their page draws ahead
    // of the room's ball; a swing at it meets it where the room has it.)
    if (e.ball.carry !== undefined || this.ball.carry !== undefined) return undefined;
    return {entry: e, index: k, lag, hang: k > i ? Math.max(0, e.t - t) : 0};
  }
  private fair(id: string, c: Seen['change']) { return !c || (c.by === id && c.kind === 'body'); }
  /** Something changed the ball's flight this tick: `by` a seat's body or touch (two seats in one tick: nobody's). */
  private changed(by: string, kind: 'body' | 'touch') {
    if (this.frame !== by) this.frame = null;
    const c = this.change;
    this.change = !c ? {by, kind} : c.by !== by ? {by: null, kind: 'touch'} : {by, kind: c.kind === 'touch' || kind === 'touch' ? 'touch' : 'body'};
  }
  /** The ball, the rally's count and the PERFECT SPIKE's flight as they stood at `e` (SEEN). */
  private restore(e: Pick<Seen, 'ball' | 'touchTeam' | 'touches' | 'rally' | 'hot'>) {
    Object.assign(this.ball, e.ball);
    if (this.mode === 'sky-spike') { this.view.touchTeam = e.touchTeam; this.view.touches = e.touches; this.view.rally = e.rally; }
    this.hot = e.hot;
  }
  private kept(): Pick<Seen, 'ball' | 'touchTeam' | 'touches' | 'rally' | 'hot'> {
    return {ball: {...this.ball}, touchTeam: this.view.touchTeam, touches: this.view.touches, rally: this.view.rally, hot: this.hot};
  }
  /** After each tick (online only): the ball, the rally and the fighters as they stand, and whether anything but its own
   *  flight changed the ball this tick - a touch said so (changed), or the ball is not where the last tick's flight
   *  would have put it (a kickoff, a serve, a drill's machine, a charm: the match's own doing). */
  private record() {
    const now = this.sim.serverTime, b = this.ball, prev = this.history[this.history.length - 1];
    let change = this.change;
    if (prev && !change) {
      const f = {...prev.ball};
      if (!f.held && f.frozenUntil <= now && f.clash <= now && this.hangUntil <= now) { this.flight.length = 0; stepBall(this.mode, f, now - prev.t, this.flight); }
      if (Math.abs(f.x - b.x) + Math.abs(f.y - b.y) + Math.abs(f.z - b.z) > 1e-3 || Math.abs(f.vx - b.vx) + Math.abs(f.vy - b.vy) + Math.abs(f.vz - b.vz) > 1e-2 || f.held !== b.held) { change = {by: null, kind: 'touch'}; this.frame = null; }
    }
    const bodies = new Map<string, Vec3>();
    for (const seat of this.seats.values()) { const q = this.sim.actors.get(seat.id)?.state; if (q) bodies.set(seat.id, {x: q.x, y: q.y, z: q.z}); }
    this.history.push({t: now, phase: this.view.phase, ...this.kept(), bodies, change});
    this.change = undefined;
    let old = 0;
    while (old < this.history.length - 1 && this.history[old].t < now - SEEN.keep) old++;
    if (old) this.history.splice(0, old);
  }
  /** The ball as `by`'s page drew it, as the kernel's body, while that view stands (locate, query); else nothing. */
  private seenOf(by: string | undefined) {
    const s = by && this.compensate > 0 && this.seats.has(by) ? this.seen(by) : undefined;
    // (A swing meets only a ball its page saw: none since somebody else's touch it has not seen yet.)
    if (!s || s.hang > 0) return undefined;
    const b = s.entry.ball, body = this.seenBody;
    body.radius = this.hitR * (1 + (b.size - 1) * .8); body.height = body.radius * 2;
    body.x = b.x; body.z = b.z; body.y = b.y - body.height * .55; body.airborne = b.y > this.radius * b.size + .35;
    return body;
  }
  /** The other side's attack about to reach a person (SEEN): a spike or serve coming at them, a shot at their goal. Online
   *  their guard and their jump go up a round trip late, so the ball as it stands would be past them - landed for a point,
   *  in the net - before the ball they saw got to their hands. So it is put back where their page drew it first (if the
   *  touch that sent it is newer than their page's view, as it left that touch, held there until they would see it go:
   *  `hangUntil`), and from then on it plays in their time (`frame`) until somebody else touches it: their guard meets it
   *  as they saw it come (a STUFF BLOCK, a PERFECT SAVE pressed in time on their screen). Their own side's balls are not
   *  put back: their swing finds the ball where they saw it (seenOf), which put back would be a round trip later again
   *  (the page draws the room's ball a lag behind, whatever the room did to it). */
  private meetSeen(seat: BallSeat, a: Actor, r: number) {
    const b = this.ball, p = a.state;
    if (b.held || b.carry !== undefined || !p.alive || this.frame === seat.id || b.lastTeam === null || b.lastTeam === seat.team) return;
    if (this.mode === 'goal-rush' ? !this.headingInto(seat.team) : sideOf(b.z) !== seat.team && Math.abs(b.z) > SEEN.overNet) return;
    // (Within reach of the body as it may be by the time its page sees the ball: on its feet, or up a jump.)
    const size = p.size ?? 1, lo = p.y + BODY_LOW * size, up = p.grounded || (this.last.get(seat.id)?.vy ?? 0) > 0 ? jumpArc(p.fighter).apex * BALL_SPORT[this.mode].jump ** 2 : 0;
    const cy = Math.max(lo, Math.min(p.y + BODY_HIGH * size + up, b.y)), nx = b.x - p.x, ny = b.y - cy, nz = b.z - p.z, d = Math.hypot(nx, ny, nz);
    if (d >= r + PLAYER_RADIUS * size + GUARD_REACH + DIG_DIVE.reach + CLIMB.near) return;
    // (Coming at it.)
    const v = this.last.get(seat.id);
    if ((b.vx - (v?.vx ?? 0)) * nx + (b.vz - (v?.vz ?? 0)) * nz >= 0 && (b.vy - (v?.vy ?? 0)) * ny >= 0) return;
    const s = this.seen(seat.id);
    if (!s) return;
    this.restore(s.entry); this.changed(seat.id, 'body'); this.frame = seat.id;
    if (s.hang > 1 / 120) this.hangUntil = this.sim.serverTime + s.hang;
  }
  /** Goal Rush's TACKLE, judged as the tackler's page drew it (SEEN): whether `seat` was the one on the ball then - the
   *  last to touch it a moment before, or the nearest of their side to it and within reach of it. */
  private onBallSeen(by: string, seat: BallSeat) {
    const lag = this.lagOf(by);
    if (lag < 1 / 120) return false;
    const T = GOAL_STANCE.tackle, t = this.sim.serverTime - lag, h = this.history;
    let i = h.length - 1;
    while (i > 0 && h[i].t > t + 1e-6) i--;
    const e = h[i];
    if (!e || e.t > t + 1e-6) return false;
    // (The carrier, as the page drew them, is the one on it.)
    if (e.ball.carry === seat.id) return true;
    for (let k = this.touchesLog.length - 1; k >= 0; k--) {
      const touch = this.touchesLog[k];
      if (touch.at > e.t) continue;
      if (touch.id === seat.id && e.t - touch.at <= T.touched) return true;
      break;
    }
    const q = e.bodies.get(seat.id);
    if (!q) return false;
    const d = Math.hypot(q.x - e.ball.x, q.z - e.ball.z);
    if (d > T.near) return false;
    for (const other of this.seats.values()) {
      if (other.team !== seat.team || other.id === seat.id || other.out !== undefined) continue;
      const r = e.bodies.get(other.id);
      if (r && Math.hypot(r.x - e.ball.x, r.z - e.ball.z) < d) return false;
    }
    return true;
  }
  /** A person's quick chat line (an index into quickChat), into every page's feed; too many too fast are dropped. */
  chat(id: string, index: unknown): boolean {
    const seat = this.seats.get(id), lines = quickChat(this.mode), now = this.sim.serverTime;
    if (!seat || seat.bot || typeof index !== 'number' || !Number.isInteger(index) || index < 0 || index >= lines.length) return false;
    const said = (this.said.get(id) ?? []).filter(t => now - t < QUICK_CHAT_LIMIT.window);
    if (said.length >= QUICK_CHAT_LIMIT.burst || now - (said.at(-1) ?? -Infinity) < QUICK_CHAT_LIMIT.gap) return false;
    said.push(now); this.said.set(id, said);
    this.emit('chat', {team: seat.team, actorId: seat.id, x: 0, y: 0, z: 0, text: lines[index], value: index});
    // (PASS_CALL: a person's call for the ball - their side's bot on it looks for them first.)
    if (this.mode === 'goal-rush' && lines[index] === PASS_CALL.line && !this.brains.has(id)) {
      this.calls.set(seat.team, {id, until: now + PASS_CALL.seconds});
      for (const [bot, brain] of this.brains) if (this.seats.get(bot)?.team === seat.team) brain.called(id, now + PASS_CALL.seconds);
    }
    return true;
  }
  private readonly said = new Map<string, number[]>();
  /** FREE PLAY's target practice: a new ring somewhere to aim at - a corner or the middle of the goal the person shoots
   *  at, top or bottom; a spot on the far court's floor. */
  private newTarget() {
    // (A drill puts its own ring up, ball by ball; the lesson has none.)
    if (!this.view.practice || this.script) return;
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
    if (!this.view.practice || this.script || !seat || !a || (this.view.phase !== 'live' && this.view.phase !== 'kickoff')) return false;
    if (this.mode === 'goal-rush') {
      const yaw = a.input.yaw ?? a.state.yaw, p = a.state, R = GOAL_RULES, r = this.radius * b.size;
      this.drop(undefined, 'reset');
      Object.assign(b, {vx: 0, vy: 0, vz: 0, sx: 0, sy: 0, sz: 0, heat: 0, super: false, held: false, frozenUntil: 0, clash: 0});
      b.x = Math.max(-R.halfX + 2, Math.min(R.halfX - 2, p.x + Math.sin(yaw) * 2.6)); b.z = Math.max(-R.halfZ + 2, Math.min(R.halfZ - 2, p.z + Math.cos(yaw) * 2.6)); b.y = r + .02;
      this.stack = null; this.lastStrike = null; this.view.phase = 'live';
    } else { this.ball.held = true; this.serve(); this.view.phaseUntil = now + .4; }
    return true;
  }
  /** A person voting to skip what holds play up after a goal or a point: its sequence (the scorer's close-up) and its
   *  replay, from REPLAY.skipFrom after it. Any one of the scoring side's people ends it at once - it is their moment
   *  to cut short - as does everyone in the match voting, so the one person of a match against
   *  bots ends it with any press (the pages send any key then: render/ball/BallReplay.ts). The kickoff or the serve
   *  follows REPLAY.after later. */
  skip(id: string): boolean {
    if (this.view.phase === 'countdown' && this.view.intro) return this.skipIntro(id);
    const r = this.view.replay, seat = this.seats.get(id), now = this.sim.serverTime;
    if (!seat || seat.bot || this.brains.has(id) || this.view.phase !== 'scored' || now < this.scoredAt + REPLAY.skipFrom) return false;
    // (Nothing left to skip: the replay over, or the beat before the next kickoff or serve all that is left.)
    if (this.view.phaseUntil - now <= REPLAY.after + 1e-6) return false;
    this.skips.add(id);
    const people = [...this.seats.values()].filter(s => !s.bot && !s.disconnected && !this.brains.has(s.id));
    const voted = people.filter(s => this.skips.has(s.id)).length;
    if (r) { r.skips = voted; r.people = people.length; }
    if (voted === people.length || (this.scoredBy !== null && seat.team === this.scoredBy)) {
      if (r) { r.at = Math.min(r.at, now); r.until = Math.min(r.until, now); }
      this.view.phaseUntil = Math.min(this.view.phaseUntil, now + REPLAY.after);
    }
    return true;
  }
  /** When the goal or point that holds play now was scored, and by which side (the skip's say). */
  private scoredAt = Infinity;
  private scoredBy: BallTeam | null = null;
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
  leadIn() { return this.view.intro ? this.view.intro.skipped ? INTRO.skipTo : this.view.intro.seconds : BALL_RULES.countdown; }
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
    // The TACKLE drill's carrier: a bot of the other side, its hands the drill's (DrillRunner.command).
    const person = [...this.seats.values()].find(s => !s.bot);
    if (this.drill && DRILLS[this.drill.id].rival && person && !this.seats.has(DRILL_RIVAL)) {
      const fighter = this.sim.shuffle(POOL.filter(f => f !== person.fighter))[0];
      this.add(DRILL_RIVAL, fighter, fighter.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' '), true, otherTeam(person.team));
    }
    // LEARN TO PLAY's cast (lesson.ts): bots whose hands are the lesson's.
    if (this.lesson && person) for (const c of LESSON_CAST[this.mode]) {
      if (this.seats.has(c.id)) continue;
      const used = new Set([...this.seats.values()].map(s => s.fighter)), fighter = this.sim.shuffle(POOL.filter(f => !used.has(f)))[0];
      this.add(c.id, fighter, fighter.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' '), true, c.side === 'mine' ? person.team : otherTeam(person.team));
    }
    if (!this.view.practice && !BALL_TEAMS.every(team => this.count(team) > 0)) return false;
    this.view.phase = 'countdown'; this.view.startsAt = this.sim.serverTime + this.leadIn();
    this.levelBots(true);
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
      delete seat.out; delete seat.lock;
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
    this.drop(undefined, 'rest');
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
    b.link = null; this.stack = null; this.lastStrike = null; this.duelling = null; this.shed.clear();
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
        if (!seat || !me) continue;
        const command = this.script?.command(this, id) ?? brain.command(me, seat, players, this.view, now);
        this.stance(seat, command);
        this.sim.command(id, command);
      }
    }
    this.presses();
    // (Sky Spike: where each swing leaves from - the body's height as the tick it begins in begins, before its air cast
    // lets the body sink - for receive, which judges a swing pressed at the top of the jump from there.)
    if (this.mode === 'sky-spike') for (const seat of this.seats.values()) { const a = this.sim.actors.get(seat.id), pre = this.preCast.get(seat.id) ?? {y: 0, cast: -1, vy: 0}; pre.y = a?.state.y ?? 0; pre.cast = a?.cast?.id ?? -1; pre.vy = this.last.get(seat.id)?.vy ?? 0; this.preCast.set(seat.id, pre); }
    this.sim.step(dt, waiting);
    if (this.mode === 'sky-spike') for (const seat of this.seats.values()) {
      const a = this.sim.actors.get(seat.id), pre = this.preCast.get(seat.id);
      // (Only a swing that leaves on the way up or at the top: past the top, where it lands is what counts, as ever.)
      if (a?.cast && pre && a.cast.id !== pre.cast) this.castFrom.set(seat.id, {id: a.cast.id, y: pre.vy > -SWING_TOP ? Math.max(pre.y, a.state.y) : 0});
    }
    // (Read at once, for Goal Rush's knock-outs: each one a wipe-out.)
    const fresh = this.sim.drainEvents();
    this.events.push(...fresh);
    if (this.pvp) { this.tackles(fresh); this.wipeOuts(fresh); this.holdLocks(); }
    // (TRAP online: a guard press heard after the room's ball met the body, judged as the page drew it.)
    if (this.compensate > 0 && this.mode === 'goal-rush') this.trapsSeen();
    this.tidyBodies(dt);
    if (this.celebration) this.holdCelebration();
    for (const seat of this.seats.values()) if (this.sim.actors.get(seat.id)?.state.action === 'dash') this.dashAt.set(seat.id, this.sim.serverTime);
    if (this.mode === 'goal-rush') this.swings();
    const t = this.sim.serverTime;
    if (this.view.phase === 'countdown' && t + 1e-6 >= (this.view.startsAt ?? Infinity)) this.begin();
    else if (this.view.phase === 'kickoff' && this.mode === 'goal-rush' && t + 1e-6 >= this.view.phaseUntil) this.release();
    else if (this.view.phase === 'scored' && t + 1e-6 >= this.view.phaseUntil) this.afterPoint();
    this.say();
    this.events.push(...this.sim.drainEvents());
    if (this.events.length > 600) this.events.splice(0, this.events.length - 600);
    // (CARRY: only live play carries.)
    if (this.carrier && this.view.phase !== 'live') this.drop(undefined, 'phase');
    if (this.view.phase === 'live' || (this.view.phase === 'kickoff' && this.mode === 'sky-spike')) this.play(dt);
    else if (this.view.phase === 'scored') this.coast(dt);
    if (this.view.rumble && this.view.phase === 'live') this.rumbleStep(dt);
    if (this.script && this.view.phase !== 'lobby' && this.view.phase !== 'countdown') this.script.step(this);
    if (this.compensate > 0) this.record();
  }

  // ─── Training drills (drills.ts) and LEARN TO PLAY (lesson.ts): the host's side ────────────────────────────────────
  private drill?: DrillRunner;
  private lesson?: BallLesson;
  /** What runs on the ball machine: a drill, or the lesson. */
  private get script(): DrillRunner | BallLesson | undefined { return this.drill ?? this.lesson; }
  /** A seat's body as the kernel has it. */
  stateOf(id: string) { return this.sim.actors.get(id)?.state; }
  /** Goal Rush's FIGHT stance: the seat locked on an opponent. */
  locked(id: string) { return !!this.seats.get(id)?.lock; }
  /** A body put on a spot, facing, standing still (the lesson's setups). */
  put(id: string, x: number, z: number, yaw: number) {
    const a = this.sim.actors.get(id);
    if (!a) return;
    if (!a.state.alive) this.sim.revive(id, a.state.maxHp);
    this.sim.place(id, {x, y: 0, z}, yaw); this.sim.clearPlayerInput(id); this.last.delete(id);
  }
  /** Sky Spike, LEARN TO PLAY's JUMP SERVE: the person serves - the ball hung at their baseline, they behind it - with
   *  `seconds` to do it before the machine hangs it again (lesson.ts). */
  servePerson(seconds: number) {
    const seat = [...this.seats.values()].find(s => !s.bot);
    if (!seat || this.mode !== 'sky-spike') return;
    this.serving = seat.team; this.serve(); this.serving = null;
    this.view.serverId = seat.id;
    this.sim.place(seat.id, this.mark(seat), this.facing(seat.team)); this.sim.clearPlayerInput(seat.id); this.last.delete(seat.id);
    this.view.phaseUntil = this.sim.serverTime + seconds;
  }
  /** FREE PLAY's serving side when the lesson has the person serve. */
  private serving: BallTeam | null = null;
  /** LEARN TO PLAY's SKIP STEP and END, from the person's page. */
  lessonCommand(id: string, what: unknown): boolean {
    const seat = this.seats.get(id);
    if (!this.lesson || !seat || seat.bot || this.view.phase === 'lobby' || this.view.phase === 'countdown') return false;
    if (what === 'skip') this.lesson.skip(this);
    else if (what === 'end') this.lesson.end();
    else return false;
    return true;
  }
  now() { return this.sim.serverTime; }
  person() {
    const seat = [...this.seats.values()].find(s => !s.bot), p = seat && this.sim.actors.get(seat.id)?.state;
    const a = p?.action;
    return seat && p ? {id: seat.id, team: seat.team, x: p.x, y: p.y, z: p.z, grounded: p.grounded, swinging: a === 'light' || a === 'heavy' || a === 'special' || a === 'ultimate' || a === 'area'} : undefined;
  }
  /** The ball machine's ball: placed and set going, whose it counts as, the touches spent, the person on their spot. */
  feed(f: DrillFeed) {
    const b = this.ball, now = this.sim.serverTime, m = this.view.mutator;
    this.drop(undefined, 'feed');
    Object.assign(b, freshBall(), {x: f.ball.x, y: f.ball.y, z: f.ball.z, vx: f.ball.vx, vy: f.ball.vy, vz: f.ball.vz, held: false, lastTeam: f.team, shot: f.ball.shot ?? null});
    b.grav = baseGravity(m); b.size = baseSize(m); b.heat = Math.max(f.ball.heat ?? 0, m === 'heat-rush' ? MUTATOR_RULES.heatStart : 0);
    this.stack = null; this.lastStrike = null; this.touchesLog = []; this.flair = null; this.endWait = false; this.shed.clear();
    this.view.phase = 'live'; this.view.phaseUntil = now; this.liveSince = now; this.view.aim = f.aim ?? null;
    if (this.mode === 'sky-spike') { this.view.touchTeam = f.touchTeam ?? f.team; this.view.touches = f.touches ?? 0; this.view.rally = 1; }
    const me = this.person();
    if (me && f.at) { this.sim.place(me.id, {x: f.at.x, y: 0, z: f.at.z}, f.at.yaw); this.sim.clearPlayerInput(me.id); this.last.delete(me.id); }
    // The TACKLE drill's carrier, on its feet at its start, its health full, nobody locked on any more.
    const rival = this.seats.get(DRILL_RIVAL), a = rival && this.sim.actors.get(rival.id);
    if (rival && a && f.rival) {
      delete rival.out; delete rival.lock; if (me) delete this.seats.get(me.id)?.lock;
      if (!a.state.alive) this.sim.revive(rival.id, a.state.maxHp);
      a.state.hp = a.state.maxHp; a.cast = null; a.state.action = 'idle';
      this.sim.place(rival.id, {x: f.rival.x, y: 0, z: f.rival.z}, f.rival.yaw); this.sim.clearPlayerInput(rival.id); this.last.delete(rival.id);
    }
  }
  /** The TACKLE drill's carrier, as the drill reads it. */
  rival() {
    const seat = this.seats.get(DRILL_RIVAL), p = seat && this.sim.actors.get(seat.id)?.state;
    if (!seat || !p) return undefined;
    const action = p.action, down = !p.alive || seat.out !== undefined || action === 'knockdown' || action === 'launched' || action === 'splat' || action === 'getup' || action === 'defeated';
    const marked = [...this.seats.values()].some(s => !s.bot && s.lock === seat.id);
    return {id: seat.id, team: seat.team, x: p.x, y: p.y, z: p.z, down, reeling: action === 'hurt' || action === 'flinch' || action === 'stun', marked};
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
        // (Sky Spike's fighters stay on their own side of the net. A move that carries its fighter to the ball -
        // an ultimate's rush - put one in the other court, a body in the other side's play until the next serve, once in
        // sixteen bot matches.)
        const own = seat.team === 'red' ? -1 : 1;
        if (this.mode === 'sky-spike' && this.view.phase !== 'over' && a.state.z * own < NET_SIDE) { a.state.z = own * NET_SIDE; a.kz = 0; }
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
    seat.out = now + GOAL_FIGHT.seconds; a.respawnAt = Infinity; this.last.delete(seat.id); delete seat.lock;
    if (by) { by.wipeouts = (by.wipeouts ?? 0) + 1; this.award(by, 'wipeout'); }
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
  private kickSpots: readonly {x: number; z: number}[] = FIRST_KICKOFF;
  private kickoff() {
    this.celebration = null;
    if (this.view.score.red + this.view.score.blue > 0) this.kickSpots = this.sim.shuffle([...KICKOFF_SPOTS]).slice(0, 3);
    this.view.phase = 'kickoff'; this.view.phaseUntil = this.sim.serverTime + (this.view.practice ? .6 : GOAL_RULES.kickoffSeconds);
    this.placeBallAtRest(); this.ball.held = true; this.touchesLog = []; this.endWait = false;
    // FREE PLAY: the ball back on the spot, the person left where they stand.
    if (!this.view.practice) this.placeAll(); this.liveSince = this.sim.serverTime; this.view.replay = null; this.skips.clear(); this.resetRumble();
    this.scoredAt = Infinity; this.scoredBy = null;
    if (!this.view.practice) this.emit('kickoff', {x: 0, y: 0, z: 0, value: GOAL_RULES.kickoffSeconds});
  }
  private release() {
    this.view.phase = 'live'; this.ball.held = false; this.ball.vy = 0;
  }
  /** FREE PLAY in Sky Spike: the side nobody sits on, where the ball machine stands. */
  private machine(): BallTeam { return this.count('red') > 0 && this.count('blue') === 0 ? 'blue' : this.count('red') === 0 ? 'red' : 'blue'; }
  private serve() {
    if (this.view.practice) this.view.servingTeam = this.serving ?? this.machine();
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
    this.liveSince = this.sim.serverTime; this.view.replay = null; this.skips.clear(); this.scoredAt = Infinity; this.scoredBy = null;
    // A rally is short: the charms lying on the court and the ones at work carry over to the next serve.
    if (this.charmAt === 0) this.resetRumble(); else this.carryRumble();
    const b = this.ball;
    b.x = 0; b.z = sign * (R.courtHalfZ + 1.4 - R.serveAhead); b.y = R.serveHeight; b.held = true; this.toss = null; this.floated = false;
    this.emit('serve', {team, actorId: server?.id, x: b.x, y: b.y, z: b.z});
  }

  private play(dt: number) {
    const b = this.ball, now = this.sim.serverTime;
    if (this.mode === 'sky-spike' && this.view.phase === 'kickoff') {
      // The serve hangs until its server strikes it; one who never does serves a soft lob when the clock runs out. A
      // server who jumps beside it tosses it up with them (the JUMP SERVE).
      if (b.held) this.tossing(now);
      if (now >= this.view.phaseUntil && b.held) { if (this.toss) { b.y = this.toss.from; this.toss = null; } this.autoServe(); }
      this.bodyContacts(dt);
      return;
    }
    // (CARRY: a ball held in stopped time or a clash is nobody's at the feet.)
    if (this.carrier && (b.frozenUntil > now || b.clash > now)) this.drop(undefined, 'held');
    if (b.frozenUntil > now || b.clash > now || this.hangUntil > now) return;
    if (this.stack) this.releaseStack();
    // Heat: it cools when nobody heats it; a long rally and an overtime heat it by themselves.
    let floor = 0;
    if (this.mode === 'sky-spike' && this.view.rally >= SPIKE_RULES.rallyHeat) floor = Math.min(3.2, .6 + (this.view.rally - SPIKE_RULES.rallyHeat) * .32);
    if (this.view.overtime) floor = Math.min(BALL_RULES.heatMax - .01, (now - this.overtimeSince) * GOAL_RULES.overtimeHeat);
    floor = Math.max(floor, BALL_ARENAS[this.view.arena ?? arenaFor(this.mode, this.seed)].twist.heatFloor ?? 0);
    if (this.view.mutator === 'heat-rush') floor = Math.max(floor, MUTATOR_RULES.heatFloor);
    if (this.mode === 'goal-rush' && this.view.fever) floor = Math.max(floor, GOAL_SWING.finalHeat);
    if (b.heat > floor) b.heat = Math.max(floor, b.heat - BALL_RULES.heatCool * dt);
    else b.heat = floor;
    if (this.mode === 'goal-rush' && !this.view.overtime && !this.view.practice) {
      this.view.clock = Math.max(0, this.view.clock - dt);
      if (this.view.clock <= 0 && !this.endWait) this.endWait = true;
      // The FINAL PUSH (GOAL_SWING): the last seconds of a match still in reach.
      if (!this.feverTold && this.view.clock <= GOAL_SWING.finalFrom && Math.abs(this.view.score.red - this.view.score.blue) <= GOAL_SWING.close) {
        this.feverTold = true; this.view.fever = true;
        this.emit('fever', {x: 0, y: 0, z: 0, value: Math.ceil(this.view.clock), text: 'FINAL PUSH'});
        for (const team of BALL_TEAMS) this.chatter(team, CHAT.fever, undefined, .5);
      }
    }
    const sideBefore = sideOf(b.z);
    // (CARRY: a carried ball is sent to its carrier's feet by its own flight, so the walls, the posts and the
    // goal still judge it; then it moves as the carrier does.)
    const spot = this.mode === 'goal-rush' ? this.carryStep(dt) : undefined;
    stepBall(this.mode, b, dt, this.contacts);
    if (spot) this.carried(spot, dt);
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
      // (Goal Rush: the ball still outside this body's strike shell - the PERFECT STRIKE's timing reads when it came in.)
      if (this.mode === 'goal-rush' && Math.hypot(b.x - p.x, b.y - (p.y + 1), b.z - p.z) > PERFECT_STRIKE.shell) this.outsideAt.set(seat.id, now);
      // (Online, the ball meets a person where their page drew it: SEEN.)
      if (this.compensate > 0 && !seat.bot) this.meetSeen(seat, a, r);
      if (b.held || !p.alive) continue;
      if (this.mode === 'sky-spike' && this.sentBy(seat)) continue;
      // Sky Spike: a fighter in the air mid-swing lets the ball come to the swing (the spike) rather than to the body.
      if (this.mode === 'sky-spike' && !p.grounded && a.cast && !b.super) continue;
      // A TIP goes over the block's hands (strike.ts SPIKE_TIP): a body of the other side up in the air at the net lets it
      // by - the answer to a tip is staying down, and the cost of that is an open lane for the spike.
      if (this.mode === 'sky-spike' && (b.shot === 'tip' && !p.grounded || this.overNet(b)) && b.lastTeam !== seat.team && Math.abs(b.z) < 2.4) continue;
      // A PERFECT SPIKE goes through a block that is not timed to it: only a STUFF BLOCK, the guard pressed as
      // it arrives, stops it at the net - the answer to the spike's timing is the block's.
      if (this.mode === 'sky-spike' && this.hot && !p.grounded && b.lastTeam !== seat.team && Math.abs(b.z) < PERFECT_SPIKE.through
        && !((p.guarding || p.action === 'guard') && now - a.guardPressedAt <= JUST_GUARD_WINDOW)) continue;
      const size = p.size ?? 1;
      const lo = p.y + BODY_LOW * size, hi = p.y + BODY_HIGH * size, cy = Math.max(lo, Math.min(hi, b.y));
      let nx = b.x - p.x, ny = b.y - cy, nz = b.z - p.z;
      // A guard reaches further than a body (the keeper's dive, the blocker's arms); and in Sky Spike a dash at a hard
      // ball coming into the court (the DIVING DIG).
      const guardReach = (p.guarding || p.action === 'guard') ? GUARD_REACH + (seat.trait === 'wall' ? TRAIT_RULES.guardReach : 0) : 0;
      const dive = this.mode === 'sky-spike' && !guardReach && b.lastTeam !== null && b.lastTeam !== seat.team && sideOf(b.z) === seat.team
        && now - (this.dashAt.get(seat.id) ?? -Infinity) < DIG_DIVE.window && Math.hypot(b.vx, b.vy, b.vz) >= SPIKE_DIG.from ? DIG_DIVE.reach : 0;
      const d = Math.hypot(nx, ny, nz), reach = r + PLAYER_RADIUS * size + guardReach + dive;
      // (CARRY: a carried ball is its carrier's - their body and their team-mates' let it be; a body of the
      // other side that meets it knocks it off them, and meets it as any body meets a ball.)
      const carried = this.carrier;
      if (carried) {
        if (carried.id === seat.id || this.seats.get(carried.id)?.team === seat.team) continue;
        if (d < reach) this.drop(undefined, 'met');
      }
      // (GUARD_OFF: a body whose guard has just turned the ball away, or that a SUPER SHOT has just bowled over,
      // lets it go until it is clear.)
      const shed = this.shed.get(seat.id);
      if (shed !== undefined) { if (now < shed && d < reach) continue; this.shed.delete(seat.id); }
      // Sky Spike, the attacking touch: a hitter still climbing lets the ball by the body, for the swing (one
      // jumping straight up under the set would meet it with the head first: a PERFECT SPIKE off a set right overhead
      // came 27% of the time, a step back 97%). Not swung for by the top of the jump, it is the body's there, as it always was (the
      // takraw rule: touching the ball plays it).
      if (this.mode === 'sky-spike' && !b.super && !guardReach && sideOf(b.z) === seat.team && this.view.touchTeam === seat.team && this.view.touches === SPIKE_RULES.touches - 1) {
        const up = !p.grounded && b.y > lo && (this.last.get(seat.id)?.vy ?? 0) > CLIMB.rising;
        if (up && d < reach + CLIMB.near) { this.climbing.add(seat.id); continue; }
        if (this.climbing.delete(seat.id) && !p.grounded && d < reach + CLIMB.near && (this.bodyTouch.get(seat.id) ?? -Infinity) + .4 <= now) {
          this.bodyTouch.set(seat.id, now); this.changed(seat.id, 'body');
          this.autoBump(seat, a, Math.hypot(b.vx, b.vy, b.vz));
          continue;
        }
      } else if (p.grounded) this.climbing.delete(seat.id);
      if (d >= reach) continue;
      // (Whatever follows changes the ball: a guard's touch, or the body's - SEEN tells them apart.)
      this.changed(seat.id, guardReach ? 'touch' : 'body');
      // (TRAP online: when a person's body met the ball unguarded, and whether it was a shot at their goal - a
      // guard pressed for it on their page may be heard after: trapsSeen.)
      if (this.compensate > 0 && !guardReach && this.mode === 'goal-rush' && !this.brains.has(seat.id)) this.metAt.set(seat.id, {t: now, shot: this.headingInto(seat.team) && this.theirs(seat.team)});
      // (A DIVING DIG is one only the dive's reach got to: the ball and the body going on as they are, the body's own reach
      // would not have met it in the next moment. Calling every dig off a dash one made 24 of 25 a match one, though most
      // came straight at a body that had dashed under them.)
      let dived = false;
      if (dive > 0) {
        const own = reach - dive, mv = this.last.get(seat.id), rx = b.vx - (mv?.vx ?? 0), ry = b.vy - (mv?.vy ?? 0), rz = b.vz - (mv?.vz ?? 0), s2 = rx * rx + ry * ry + rz * rz;
        const tc = s2 > 1e-6 ? Math.max(0, Math.min(DIG_DIVE.ahead, -(nx * rx + ny * ry + nz * rz) / s2)) : 0;
        dived = Math.hypot(nx + rx * tc, ny + ry * tc, nz + rz * tc) >= own;
      }
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
        // (GUARD_OFF: on through the body along its own line - put by on the body's far side across the floor, a glancing one's flight came back at it and bulldozed it again, the ball jumping back and forth. And a
        // body is bulldozed once a BALL_RULES.staggerGap, as it is staggered: a slow super shot in a scrum bowled the same
        // one over three times in a second.)
        this.shed.set(seat.id, now + GUARD_OFF.clear);
        if (now - (this.staggeredAt.get(seat.id) ?? -Infinity) < BALL_RULES.staggerGap) continue;
        this.staggeredAt.set(seat.id, now);
        if (p.action !== 'knockdown') this.sim.strike(BALL_ID, seat.id, 'heavy', BOWL, {x: b.x, y: b.y, z: b.z});
        const keep = guarding ? .78 : .9;
        b.vx *= keep; b.vy *= keep; b.vz *= keep;
        this.emit('bowled', {team: b.lastTeam!, actorId: b.lastId ?? undefined, targetId: seat.id, x: p.x, y: p.y + 1, z: p.z, value: Math.round(speed), text: guarding ? 'BREAKS THROUGH' : 'BULLDOZED'});
        continue;
      }
      if (guarding && rel < -1) { this.guardBall(seat, a.guardPressedAt, nx, ny, nz, speed, fvx, fvy, fvz); continue; }
      // Goal Rush's HEADER: a ball meeting the top of a body that jumped into it is headed on, the way the body faces.
      // (The BALL stance's: a body locked in a fight only bounces it; a lob dropping on a head standing still too.)
      if (this.mode === 'goal-rush' && !seat.lock && rel < -HEADER.from && b.y - p.y > HEADER.head * size && !p.grounded
        && !REELING.has(p.action) && (this.bodyTouch.get(seat.id) ?? -Infinity) + HEADER.gap <= now) {
        this.header(seat, a, speed);
        continue;
      }
      // Goal Rush: a shot on its way in (LINE_SHOT m/s or more), met by a body on the line: if it
      // no longer goes in after the bounce, it was cleared OFF THE LINE, a save.
      const lineBall = this.mode === 'goal-rush' && hostile && rel < -1.5 && speed >= LINE_SHOT && this.onLine(seat.team) && this.headingInto(seat.team, .6);
      // Sky Spike: a ball that meets a body on its own side is played - an automatic bump, one of the side's touches
      // (touching the ball hits it), so a rally is lost to a missed read, never to a bad bounce.
      const used = this.view.touchTeam === seat.team ? this.view.touches : 0;
      if (this.mode === 'sky-spike' && rel < -1.5 && sideOf(b.z) === seat.team && used < SPIKE_RULES.touches && (this.bodyTouch.get(seat.id) ?? -Infinity) + .4 <= now) {
        this.bodyTouch.set(seat.id, now);
        this.autoBump(seat, a, speed, dived);
        continue;
      }
      // (CARRY) A body running into a slow ball with the stick held takes it on - at its feet, its own.
      if (this.mode === 'goal-rush' && !this.carrier && this.carryable() && now - (this.lostAt.get(seat.id) ?? -Infinity) >= CARRY.again
        && carries(b, r, {grounded: p.grounded, alive: p.alive, action: p.action, swinging: !!a.cast, locked: !!seat.lock, stick: Math.hypot(a.input.moveX, a.input.moveZ)}, fvx * nx + fvz * nz, now)) {
        if ((this.bodyTouch.get(seat.id) ?? -Infinity) + .35 <= now) { this.bodyTouch.set(seat.id, now); this.bodyPlayed.set(seat.id, {at: now, three: false}); this.touched(seat, null, 'header'); }
        else { b.lastId = seat.id; b.lastTeam = seat.team; }
        this.startCarry(seat, a, Math.atan2(nx, nz));
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
      if (lineBall && !this.headingInto(seat.team, 1.2)) {
        seat.saves++; this.award(seat, 'save');
        this.emit('save', {team: seat.team, actorId: seat.id, x: b.x, y: b.y, z: b.z, value: Math.round(speed), text: 'OFF THE LINE', shot: 'save'}); this.saved(seat);
      }
      if ((this.bodyTouch.get(seat.id) ?? -Infinity) + .35 <= now && Math.abs(rel) > 1.5) {
        this.bodyTouch.set(seat.id, now); this.bodyPlayed.set(seat.id, {at: now, three: false});
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
        // (LOOSE: the carrier bumped flat - the ball pops loose toward the bumper.)
        if (this.carrier?.id === other.id) this.drop(seat, 'bump');
        break;
      }
    }
  }
  /** A guard meets the ball: a block (Sky Spike at the net: back down into their court), a save, and, timed within the
   *  just-guard window, a perfect one - the ball's heat gone and the keeper's meter up. */
  private guardBall(seat: BallSeat, pressedAt: number, nx: number, ny: number, nz: number, speed: number, fvx = 0, fvy = 0, fvz = 0) {
    const b = this.ball, now = this.sim.serverTime, perfect = now - pressedAt <= JUST_GUARD_WINDOW;
    // (GUARD_OFF: one guard is one block or save - its event, its count, its points and its meter.)
    const credit = now - (this.guardCredit.get(seat.id) ?? -Infinity) >= GUARD_OFF.credit;
    if (credit) this.guardCredit.set(seat.id, now);
    // (A save is of the other side's ball - their strike last, whoever's body it bounced off since - never of a
    // team-mate's pass back, nor of the guard's own ball turned back at its goal.)
    const wasOnTarget = this.mode === 'goal-rush' && this.headingInto(seat.team) && this.theirs(seat.team), line = wasOnTarget && this.onLine(seat.team);
    if (this.mode === 'sky-spike' && Math.abs(b.z) < 2.6 && b.y > SPIKE_RULES.netHeight - .6) {
      const away = seat.team === 'red' ? 1 : -1;
      // A perfect one is a STUFF BLOCK, driven down into the hitter's court. Any other comes off the hands soft and up,
      // back over the net to the hitters' side: the rally goes on (a block is no touch).
      if (perfect) { b.vz = away * Math.max(7, Math.abs(b.vz) * .95); b.vy = -Math.max(3, Math.abs(b.vy) * .5) - 5; b.vx *= .5; }
      else { b.vz = away * (2.5 + this.rng() * 2.5); b.vy = 6 + this.rng() * 2.5; b.vx *= .35; }
      b.heat = Math.max(0, b.heat - BALL_RULES.guardHeat * (perfect ? .5 : 1));
      if (credit) {
        seat.blocks++; this.award(seat, perfect ? 'stuff' : 'block');
        if (seat.blocks === 3) this.accolade(seat, 'THE WALL');
        this.emit(perfect ? 'perfect' : 'block', {team: seat.team, actorId: seat.id, x: b.x, y: b.y, z: b.z, shot: 'block', text: perfect ? 'STUFF BLOCK' : 'BLOCK'});
      }
      this.touched(seat, null, 'block', true);
      this.shed.set(seat.id, now + GUARD_OFF.clear);
      // The ball comes back to the hitters with three touches of their own (else a block met before the ball crossed would
      // leave them on their spent three, and their dig of it would be FOUR TOUCHES). A stuffed ball that lands is the
      // blocker's point.
      // (Met before it crossed, the block is the rally's exchange at the net: the blockers commit with the hitter and meet
      // most spikes there, before the rally counts the crossing.)
      const crossed = sideOf(b.z) === seat.team;
      b.shot = 'block'; this.view.touchTeam = otherTeam(seat.team); this.view.touches = 0;
      if (!crossed && credit) this.climb(otherTeam(seat.team));
      if (perfect && credit) this.sim.addMeter(seat.id, 14, 8);
      return;
    }
    // (TRAP) On its feet, the guard pressed as a ball that is no shot at its goal arrives - online, as the page
    // drew it (SEEN; a ball already in their time is judged there) - kills it dead at its feet, to carry.
    const guarder = this.sim.actors.get(seat.id)!, drew = pressedAt - (this.frame === seat.id ? 0 : this.lagOf(seat.id));
    if (this.mode === 'goal-rush' && !wasOnTarget && !b.super && !seat.lock && guarder.state.grounded && this.carryable() && now - drew <= TRAP.window + 1e-6) {
      this.trap(seat, guarder, nx, nz, credit);
      return;
    }
    const rel = b.vx * nx + b.vy * ny + b.vz * nz;
    if (perfect) {
      // The keeper's perfect save: the ball dead, then sent up the way they look - out of their own end: a bot
      // keeper running across its goal mouth, looking back at its net, sent a PERFECT SAVE into it (Goal Rush).
      const a = this.sim.actors.get(seat.id)!, yaw = a.input.yaw, out = -Math.sign(goalZ(seat.team));
      const dz = this.mode === 'goal-rush' && Math.cos(yaw) * out < 0 ? -Math.cos(yaw) : Math.cos(yaw);
      b.vx = Math.sin(yaw) * 11; b.vz = dz * 11; b.vy = 8; b.heat = 0; b.super = false; b.sx = b.sy = b.sz = 0;
      if (credit) this.sim.addMeter(seat.id, 16, 10);
    } else {
      b.vx -= 1.45 * rel * nx; b.vy -= 1.45 * rel * ny; b.vz -= 1.45 * rel * nz;
      b.heat = Math.max(0, b.heat - BALL_RULES.guardHeat);
      if (b.super) { b.super = false; }
    }
    // (And away from the body that turned it - a keeper up in the air over the ball looking back at their own
    // goal sent it up into themselves: GUARD_OFF.)
    this.leaveGuard(nx, ny, nz, fvx, fvy, fvz);
    // A save straight off a dash is a dive (the keeper's lunge across the line).
    const dived = now - (this.dashAt.get(seat.id) ?? -Infinity) < .6;
    if (credit && wasOnTarget) { seat.saves++; this.award(seat, perfect ? 'perfectSave' : dived ? 'divingSave' : 'save'); this.emit('save', {team: seat.team, actorId: seat.id, x: b.x, y: b.y, z: b.z, value: Math.round(speed), text: perfect ? 'PERFECT SAVE' : dived ? 'DIVING SAVE' : line ? 'OFF THE LINE' : 'SAVE', shot: 'save'}); this.saved(seat, speed); }
    else if (credit && perfect) this.emit('perfect', {team: seat.team, actorId: seat.id, x: b.x, y: b.y, z: b.z, text: 'PERFECT GUARD', shot: 'save'});
    this.touched(seat, null, 'save', true);
    this.shed.set(seat.id, now + GUARD_OFF.clear);
  }
  /** GUARD_OFF: the ball a guard turned away leaves the guarding body - its speed out along (nx, ny, nz), the
   *  line from the body to the ball, against the body's own (fvx, fvy, fvz) at least GUARD_OFF.leave. */
  private leaveGuard(nx: number, ny: number, nz: number, fvx: number, fvy: number, fvz: number) {
    const b = this.ball, n = Math.hypot(nx, ny, nz);
    if (n < 1e-6) return;
    nx /= n; ny /= n; nz /= n;
    const out = (b.vx - fvx) * nx + (b.vy - fvy) * ny + (b.vz - fvz) * nz;
    if (out >= GUARD_OFF.leave) return;
    const k = GUARD_OFF.leave - out;
    b.vx += nx * k; b.vy += ny * k; b.vz += nz * k;
  }
  /** Goal Rush: whether the ball is the other side's - their strike the last, whoever's body it has bounced off
   *  since (a deflection) - so a guard or a touch that stops it at `team`'s goal saves a shot. */
  private theirs(team: BallTeam) {
    const b = this.ball;
    if (b.lastTeam !== null && b.lastTeam !== team) return true;
    for (let i = this.touchesLog.length - 1; i >= 0; i--) if (this.touchesLog[i].strike) return this.touchesLog[i].team !== team;
    return false;
  }

  // ─── Goal Rush's first touch and carry (TRAP, CARRY, LOOSE) ─────────────────────────────────────────
  /** Goal Rush's first touch and carry are on: live play, and no ball machine (a drill's, the lesson's) moving the ball. */
  private carryable() { return this.mode === 'goal-rush' && this.view.phase === 'live' && !this.script; }
  /** A carry begins (CARRY): the ball at the seat's feet along `heading` (the way it lay off the body), moving as the body
   *  does, the body on its carrying pace; `settle` s held for it with the stick let go (a TRAP's). */
  private startCarry(seat: BallSeat, a: Actor, heading: number, settle = 0) {
    const b = this.ball, p = a.state, now = this.sim.serverTime, v = this.last.get(seat.id), spot = carrySpot(p, heading, this.radius * b.size);
    this.carrier = {id: seat.id, heading, since: now, settle: now + settle};
    b.carry = seat.id; b.x = spot.x; b.y = spot.y; b.z = spot.z; b.vx = v?.vx ?? 0; b.vy = 0; b.vz = v?.vz ?? 0; b.sx = b.sy = b.sz = 0;
    this.sim.setMods(seat.id, {speed: CARRY.pace});
    this.counts.carries++;
  }
  /** The carry ends (CARRY): the ball nobody's at the feet, the body at its own pace again; `pop`, a seat of the other side
   *  that knocked it off its carrier, and the ball pops LOOSE toward them. */
  private drop(pop?: BallSeat, why = 'gone') {
    const c = this.carrier, now = this.sim.serverTime;
    if (!c) return;
    this.carrier = null; delete this.ball.carry; this.carryEnds[why] = (this.carryEnds[why] ?? 0) + 1;
    // (Set back, never deleted: the carrier's own rollback checkpoint keeps a key it no longer hears of as it was.)
    this.sim.setMods(c.id, {speed: 1});
    this.lostAt.set(c.id, now); this.counts.carried += now - c.since;
    const q = pop && this.sim.actors.get(pop.id)?.state, b = this.ball;
    if (q) { Object.assign(b, looseToward(b, q), {sx: 0, sy: 0, sz: 0}); this.counts.loose++; }
  }
  /** Each tick of a carry, before the ball's flight (CARRY): whether it still is one, the way the run turns it round the
   *  body, and the ball sent to the carrier's feet - the spot it is sent to, or undefined when the carry has ended. */
  private carryStep(dt: number) {
    const c = this.carrier;
    if (!c) return undefined;
    const b = this.ball, now = this.sim.serverTime, seat = this.seats.get(c.id), a = seat && this.sim.actors.get(c.id), p = a?.state;
    const stick = a ? Math.hypot(a.input.moveX, a.input.moveZ) : 0;
    const why = !seat || !a || !p || !this.carryable() || !p.alive || seat.out !== undefined || b.held || b.super ? 'gone' : seat.lock ? 'lock' : !p.grounded ? 'air'
      : REELING.has(p.action) || now < a.stunUntil ? 'reeling' : stick < CARRY.stick && now >= c.settle ? 'stick' : '';
    if (why || !a || !p) { this.drop(undefined, why || 'gone'); return undefined; }
    if (stick >= CARRY.stick) { const turn = wrapAngle(Math.atan2(a.input.moveX, a.input.moveZ) - c.heading), most = CARRY.turn * dt; c.heading = wrapAngle(c.heading + Math.max(-most, Math.min(most, turn))); }
    const r = this.radius * b.size, spot = carrySpot(p, c.heading, r);
    // (Over the goal line in the mouth, where the body can go no further, it rolls on into the net at the carrier's pace.)
    if (Math.abs(spot.z) > GOAL_RULES.halfZ && Math.abs(spot.x) < GOAL_RULES.goalHalfWidth - r) {
      const pace = BALL_SPORT[this.mode].run * CARRY.pace;
      this.drop(undefined, 'line'); b.vx = Math.sin(c.heading) * pace; b.vz = Math.cos(c.heading) * pace; b.vy = 0;
      return undefined;
    }
    b.vx = (spot.x - b.x) / dt; b.vz = (spot.z - b.z) / dt; b.vy = 0; b.y = r; b.sx = b.sy = b.sz = 0;
    return spot;
  }
  /** After the ball's flight (CARRY): at the feet, it moves as the carrier does; held off its spot (a wall, a post), the
   *  carry is over. */
  private carried(spot: {x: number; z: number}, dt: number) {
    const c = this.carrier, b = this.ball;
    if (!c || b.carry !== c.id) return;
    if (Math.hypot(b.x - spot.x, b.z - spot.z) > CARRY.lose) { this.drop(undefined, 'off'); return; }
    const p = this.sim.actors.get(c.id)?.state, was = this.last.get(c.id);
    b.vx = p && was ? (p.x - was.x) / dt : 0; b.vz = p && was ? (p.z - was.z) / dt : 0; b.vy = 0;
    if (Math.hypot(b.vx, b.vz) > 40) b.vx = b.vz = 0;
  }
  /** A TRAP (TRAP): the ball dead at the guard's feet, cooled as a guard cools it, the seat's touch, and its carry; the
   *  event and a light touch's meter once a guard's credit. */
  private trap(seat: BallSeat, a: Actor, nx: number, nz: number, credit: boolean) {
    const b = this.ball;
    b.heat = Math.max(0, b.heat - BALL_RULES.guardHeat); b.super = false;
    this.touched(seat, null, 'save', true);
    this.startCarry(seat, a, Math.atan2(nx, nz), TRAP.settle);
    this.counts.traps++;
    if (!credit) return;
    const [ult, awaken] = TOUCH_METER.light;
    this.sim.addMeter(seat.id, ult * GOAL_TOUCH_METER * this.swing(seat.team), awaken);
    this.emit('perfect', {team: seat.team, actorId: seat.id, x: b.x, y: b.y, z: b.z, text: 'TRAP', shot: 'save'});
  }
  /** Online (TRAP, as SEEN judges): a person's guard press heard after the room's ball met their body unguarded. As their
   *  page drew it the press came TRAP.window or less before the ball got there - the view the press was made on, against
   *  when the ball met the body - and nobody else has touched the ball since: trapped now, where it is, at the feet. */
  private trapsSeen() {
    const now = this.sim.serverTime;
    for (const seat of this.seats.values()) {
      const a = this.brains.has(seat.id) ? undefined : this.sim.actors.get(seat.id);
      if (!a) continue;
      const pressed = a.guardPressedAt, heard = this.guardHeard.get(seat.id);
      this.guardHeard.set(seat.id, pressed);
      if (pressed === heard || pressed < now - 1e-6) continue;
      const met = this.metAt.get(seat.id), lag = this.lagOf(seat.id), drew = pressed - lag, p = a.state, b = this.ball;
      if (!met || met.shot || lag < 1 / 120 || met.t < drew - 1e-6 || met.t - drew > TRAP.window + 1e-6) continue;
      if (this.carrier || !this.carryable() || seat.lock || !p.grounded || !p.alive || b.held || b.super || b.frozenUntil > now || b.clash > now) continue;
      if (!this.fair(seat.id, this.change) || this.history.some(h => h.t > met.t + 1e-6 && !this.fair(seat.id, h.change))) continue;
      const dx = b.x - p.x, dz = b.z - p.z, d = Math.hypot(dx, dz);
      if (d > TRAP.reach) continue;
      const credit = now - (this.guardCredit.get(seat.id) ?? -Infinity) >= GUARD_OFF.credit;
      if (credit) this.guardCredit.set(seat.id, now);
      this.changed(seat.id, 'touch');
      this.trap(seat, a, d > 1e-6 ? dx / d : Math.sin(p.yaw), d > 1e-6 ? dz / d : Math.cos(p.yaw), credit);
    }
  }

  // ─── Goal Rush's two stances (model.ts GOAL_STANCE) ─────────────────────────────────────────────────────────────
  /** A seat's stance from its command, and the command's target made to say it to the kernel: an opponent's id with the
   *  lock on (a person's Tab, a bot's tackle) is the FIGHT stance on them - the kernel's own lock-on - while they are in
   *  play and within reach; anything else is the BALL stance, the ball's id. Sky Spike and FREE PLAY: the ball always. */
  private stance(seat: BallSeat, input: {targetId?: string | null; lock?: boolean}) {
    const foe = input.lock && typeof input.targetId === 'string' && input.targetId !== BALL_ID ? this.seats.get(input.targetId) : undefined;
    if (foe && this.lockable(seat, foe)) { seat.lock = foe.id; input.targetId = foe.id; input.lock = true; return; }
    delete seat.lock; input.targetId = BALL_ID;
  }
  private lockable(seat: BallSeat, foe: BallSeat) {
    if (!this.pvp || foe.team === seat.team || foe.out !== undefined || seat.out !== undefined || foe.disconnected) return false;
    const p = this.sim.actors.get(seat.id)?.state, q = this.sim.actors.get(foe.id)?.state;
    return !!p && !!q && q.alive && Math.hypot(q.x - p.x, q.z - p.z) <= GOAL_STANCE.reach;
  }
  /** After each step: a lock whose opponent went down (wiped out) or out of reach lets go - the BALL stance again. */
  private holdLocks() {
    for (const seat of this.seats.values()) {
      const foe = seat.lock ? this.seats.get(seat.lock) : undefined;
      if (seat.lock && (!foe || !this.lockable(seat, foe))) delete seat.lock;
    }
  }
  /** This step's TACKLEs (GOAL_STANCE.tackle): a FIGHT-stance blow that knocked down, launched or wiped out the one of the
   *  other side on the ball - the nearest of their side to it within a few metres, or the last to touch it a moment ago. */
  private tackles(events: readonly CombatEvent[]) {
    const T = GOAL_STANCE.tackle, now = this.sim.serverTime;
    for (const e of events) {
      if (e.kind !== 'hit' || !e.targetId) continue;
      const by = this.seats.get(e.actorId), seat = this.seats.get(e.targetId);
      if (!by?.lock || !seat || seat.team === by.team || seat.out !== undefined || now - (this.tackledAt.get(seat.id) ?? -Infinity) < T.gap) continue;
      const q = this.sim.actors.get(seat.id)?.state;
      if (!q) continue;
      const down = !q.alive || q.hp <= 0, flat = down || e.reaction === 'knockdown' || e.reaction === 'launched';
      // (Online, the one on the ball as the tackler's page drew them: SEEN.)
      if (!flat || !(this.onBall(seat, q) || this.onBallSeen(by.id, seat))) continue;
      this.tackledAt.set(seat.id, now);
      by.tackles = (by.tackles ?? 0) + 1; this.award(by, down ? 'takedown' : 'tackle'); this.sim.addMeter(by.id, T.meter, T.awaken);
      this.emit('tackle', {team: by.team, actorId: by.id, targetId: seat.id, x: q.x, y: q.y + 1, z: q.z, text: down ? 'TAKEDOWN' : 'TACKLE'});
      // (LOOSE: the carrier tackled - the ball pops loose toward the tackler.)
      if (this.carrier?.id === seat.id) this.drop(by, 'tackle');
    }
  }
  /** Whether a seat is the one on the ball: the last to touch it a moment ago, or the nearest of their side to it and
   *  within reach of it. */
  private onBall(seat: BallSeat, q: PlayerState) {
    const T = GOAL_STANCE.tackle, b = this.ball, now = this.sim.serverTime;
    // (The carrier is the one on it.)
    if (this.carrier?.id === seat.id) return true;
    const last = this.touchesLog[this.touchesLog.length - 1];
    if (last && last.id === seat.id && now - last.at <= T.touched) return true;
    const d = Math.hypot(q.x - b.x, q.z - b.z);
    if (d > T.near) return false;
    for (const other of this.seats.values()) {
      if (other.team !== seat.team || other.id === seat.id || other.out !== undefined) continue;
      const r = this.sim.actors.get(other.id)?.state;
      if (r && Math.hypot(r.x - b.x, r.z - b.z) < d) return false;
    }
    return true;
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
  /** The ball is every blow's but a FIGHT-stance one's (GOAL_STANCE). */
  hostile(attackerId: string) { return !this.seats.get(attackerId)?.lock; }
  /** A BALL-stance swing never hurts a fighter (GOAL_STANCE). (A BUMP is no swing: the kernel's strike lands it in either
   *  stance.) */
  spares(attackerId: string, targetId: string) {
    if (!this.pvp) return false;
    const seat = this.seats.get(attackerId);
    return !!seat && !seat.lock && this.seats.has(targetId);
  }
  /** (`by`: online, a person's swing finds the ball where their page drew it - SEEN.) */
  locate(id: string, by?: string): ExternalBody | undefined { return id === BALL_ID && this.strikable() ? this.seenOf(by) ?? this.refreshBody() : undefined; }
  query(a: Vec3, b: Vec3, radius: number, out: ExternalBody[], by?: string): number {
    out.length = 0;
    if (!this.strikable()) return 0;
    const ball = this.seenOf(by) ?? this.refreshBody(), pad = radius + this.hitR + 4;
    if (ball.x < Math.min(a.x, b.x) - pad || ball.x > Math.max(a.x, b.x) + pad || ball.z < Math.min(a.z, b.z) - pad || ball.z > Math.max(a.z, b.z) + pad) return 0;
    out[0] = ball; out.length = 1;
    return 1;
  }
  receive(body: ExternalBody, blow: ExternalBlow): {damage: number; reaction?: 'flinch'; killed: boolean} | null {
    // Online, a person's swing met the ball where their page drew it (SEEN): the ball is put back there and struck
    // from there - or, if the blow is not one that plays the ball after all, left as it was.
    if (body !== this.seenBody) { const out = this.received(blow); if (out) this.changed(blow.attackerId, 'touch'); return out; }
    const claim = this.seen(blow.attackerId);
    if (!claim || claim.hang > 0) return null;
    const now = this.kept();
    this.restore(claim.entry);
    const out = this.received(blow, claim);
    if (out) { this.changed(blow.attackerId, 'touch'); this.frame = blow.attackerId; } else this.restore(now);
    return out;
  }
  private received(blow: ExternalBlow, claim?: {entry: Seen; index: number}): {damage: number; reaction?: 'flinch'; killed: boolean} | null {
    const seat = this.seats.get(blow.attackerId), a = this.sim.actors.get(blow.attackerId), b = this.ball, now = this.sim.serverTime;
    // (A FIGHT-stance blow is the fighter's, never the ball's: GOAL_STANCE.)
    if (!seat || !a || seat.lock || !this.strikable() || b.clash > now) return null;
    // (CARRY: a carried ball is its carrier's - a team-mate's swing lets it be.)
    const carried = this.carrier;
    if (carried && carried.id !== seat.id && this.seats.get(carried.id)?.team === seat.team) return null;
    const castId = a.cast?.id ?? -1, prior = this.strikes.get(seat.id);
    if (prior && prior.cast === castId && now - prior.at < BALL_RULES.restrike) return null;
    // (The carrier's own blow plays it from the feet, as a ball at rest - it moved as they did; one of the other side's
    // knocks it off them as it plays it.)
    if (carried) { if (carried.id === seat.id) b.vx = b.vy = b.vz = 0; this.drop(undefined, carried.id === seat.id ? 'struck' : 'poked'); }
    if (this.mode === 'sky-spike') {
      // Nobody plays the ball on the far side of the net; a serve is its server's alone; and a ball a side has sent
      // over (its last touch spent, on its way to the net) goes by that side's own swings.
      if (sideOf(b.z) !== seat.team && Math.abs(b.z) > .9) return null;
      if (this.sentBy(seat) && this.touchCast.get(seat.id) !== castId && !this.merges(seat, now, blow.slot)?.three) return null;
      if (b.held && (this.view.phase !== 'kickoff' || seat.id !== this.view.serverId)) return null;
      // A TIP goes over the block's hands and its swings alike (bodyContacts); a serve is never blocked or attacked at the
      // net (volleyball's rule: it is received).
      if ((b.shot === 'tip' && !a.state.grounded || this.overNet(b)) && b.lastTeam !== seat.team && Math.abs(b.z) < 2.4) return null;
    }
    this.strikes.set(seat.id, {cast: castId, at: now});
    // The ball leaving a striker's foot brushes their own body: not a touch of its own.
    this.bodyTouch.set(seat.id, now);
    // (The stick as the button was pressed, as the aim is - read as the blow landed, a set pressed with the stick
    // across had mostly been let go by the contact, and came out the floating one; a curl, the same.)
    const p = a.state, yaw = a.attackYaw ?? a.input.yaw, mx = a.attackMoveX ?? a.input.moveX, mz = a.attackMoveZ ?? a.input.moveZ;
    const serve = this.mode === 'sky-spike' && b.held;
    const again = b.lastId === seat.id && (this.touchCast.get(seat.id) === castId || now - (this.touchedAt.get(seat.id) ?? -Infinity) < .3);
    // (DOUBLE: the body played it a breath ago - this swing is that touch, played as the swing plays it.)
    const merged = !again && !serve ? this.merges(seat, now, blow.slot) : undefined;
    if (merged) { this.bodyPlayed.delete(seat.id); this.unlog(seat.id); }
    this.touchedAt.set(seat.id, now);
    // (A serve's later contacts - a many-blow heavy's - leave it be: they struck it again as a spike from the baseline, and
    // a JUMP SERVE flew into the far wall.)
    if (again && this.mode === 'sky-spike' && b.shot === 'serve') return {damage: 1, reaction: 'flinch', killed: false};
    const touches = this.mode === 'sky-spike' ? (serve ? SPIKE_RULES.touches : (this.view.touchTeam === seat.team ? this.view.touches : 0) + (again || merged?.three ? 0 : 1)) : 0;
    this.touchCast.set(seat.id, castId);
    const mateSeats = this.mode === 'goal-rush' ? [...this.seats.values()].filter(s => s.team === seat.team && s.id !== seat.id) : [];
    const mates = this.mode === 'goal-rush' ? mateSeats.map(s => {
      const m = this.sim.actors.get(s.id)!.state, v = this.last.get(s.id);
      return {x: m.x, z: m.z, vx: v?.vx ?? 0, vz: v?.vz ?? 0};
    }) : undefined;
    const rivals = this.mode === 'sky-spike' ? [...this.seats.values()].filter(s => s.team !== seat.team).map(s => this.sim.actors.get(s.id)!.state) : undefined;
    const moving = this.last.get(seat.id);
    // A PERFECT SPIKE: from the top of the jump, at the net (strike.ts makes it a spike or not). A JUMP SERVE from the top
    // of the jump is perfect too; one struck lower sprays (SERVE_RULES).
    // (From where the swing left, if higher - a swing pressed at the top of the jump is struck from the top, as
    // the APEX cue says, though its air cast's wind-up lets the body sink a little before it lands: SpikeCues.)
    const from = this.castFrom.get(seat.id), share = p.grounded ? 0 : Math.max(p.y, from && from.id === castId ? from.y : 0) / Math.max(.1, jumpArc(p.fighter).apex);
    const jumpServe = serve && !p.grounded && blow.slot !== 'light';
    const perfect = this.mode === 'sky-spike' && !again && (jumpServe ? share >= SERVE_RULES.apex : !serve && !p.grounded && blow.slot !== 'light' && b.y > SPIKE_RULES.netHeight
      && Math.abs(b.z) < PERFECT_SPIKE.net && b.y > PERFECT_SPIKE.ball && share >= PERFECT_SPIKE.apex);
    let spray: {x: number; z: number} | undefined;
    if (jumpServe && !perfect) {
      // Long, and wide either way (a short one would only be easier to dig): the further under the top, the more.
      const k = Math.min(1, Math.max(0, (SERVE_RULES.apex - share) / (SERVE_RULES.apex - SERVE_RULES.low)));
      spray = {x: (this.rng() * 2 - 1) * (SERVE_RULES.spray * .5 + SERVE_RULES.wide * k), z: SERVE_RULES.spray + SERVE_RULES.wild * k * (.6 + this.rng() * .4)};
    }
    // A QUICK SET goes to the team-mate nearest the net (in front of the setter if none is near).
    let quickTo: {x: number} | undefined;
    if (this.mode === 'sky-spike' && touches === 2 && !p.grounded) {
      let best = 4.5;
      for (const s of this.seats.values()) {
        const q = s.team === seat.team && s.id !== seat.id ? this.sim.actors.get(s.id)?.state : undefined;
        if (q && Math.abs(q.z) < best && Math.abs(q.x - p.x) < 7) { best = Math.abs(q.z); quickTo = {x: q.x}; }
      }
    }
    const shank = this.shanked(seat, p, touches, Math.hypot(b.vx, b.vy, b.vz), again);
    // Goal Rush's PERFECT STRIKE: a ball coming in, met by the blow just as it arrived (strike.ts says whether the shot
    // it makes can be one).
    // A blow out of a flurry of presses is a SCUFF (MASHED): off its aim, slower, unhelped, never perfect.
    // (And SHOOT's quick strike pressed over before it landed: the kernel's cast knows its own press.)
    const scuffed = !again && !serve && (this.mashed(seat, blow.slot) || (blow.strike === 'tap' && ((a.cast?.press !== undefined && a.attackSeq !== a.cast.press) || this.tapMashed(seat))));
    const off = scuffed ? this.rng() * 2 - 1 : 0, scuff = scuffed ? {yaw: off * MASHED.yaw, off} : undefined;
    const timed = this.mode === 'goal-rush' && !again && !scuffed && this.timed(seat, a, blow, claim);
    // (SHOOT: the quick strike or the wound-up heavy and its charge - the kernel's word, ExternalBlow.strike.)
    const result = strikeBall(b, {mode: this.mode, slot: blow.slot, move: blow.move, knockback: blow.knockback, launch: blow.launch, finisher: blow.finisher, perfect: (perfect || timed) && !scuffed, spray, quickTo, shank, scuff,
      strike: blow.strike, charge: blow.charge,
      pushX: blow.pushX, pushZ: blow.pushZ, mates, touches, serve, rivals, gravity: baseGravity(this.view.mutator), run: {vx: moving?.vx ?? 0, vz: moving?.vz ?? 0},
      striker: {id: seat.id, team: seat.team, x: p.x, y: p.y, z: p.z, grounded: p.grounded, aimYaw: yaw, awakened: !!p.awakened,
        forward: mx * Math.sin(yaw) + mz * Math.cos(yaw), lateral: -mx * Math.cos(yaw) + mz * Math.sin(yaw), chain: p.chain ?? 0}});
    // A pass completed (the side's last strike a team-mate's, a moment ago) heats the ball: passing is how it burns.
    if (!again && !serve && this.passed(seat, now)) result.heat += this.mode === 'goal-rush' ? GOAL_RULES.passHeat : SPIKE_RULES.passHeat;
    // (A pass the stick aimed - PASS_AIM - and one a bot sent to the person of its side who called for it.)
    if (!again && result.aimed !== undefined) {
      this.counts.aimed++;
      const call = this.calls.get(seat.team);
      if (call && call.until > now && mateSeats[result.aimed]?.id === call.id && this.brains.has(seat.id)) this.counts.called++;
    }
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
    // (SHOOT's quick strike is one, but two sides' taps a breath apart are a touch and its answer - in Goal
    // Rush a CLASH needs one of the two blows to be more than a tap. Counted as clashes, taps held the ball up fourteen
    // times a match where five had been tuned for; left out altogether, a CLASH came once in three matches. In Sky Spike,
    // where no CLASH came before, a tap never makes one.)
    const real = !again && !serve && result.shot !== 'tap' && result.shot !== 'bump' && result.shot !== 'set', tapped = blow.strike === 'tap';
    const power = Math.hypot(result.vx, result.vy, result.vz) * (blow.slot === 'ultimate' ? 1.6 : blow.slot === 'special' || blow.slot === 'area' ? 1.15 : 1) + (p.awakened ? 4 : 0);
    const rival = this.lastStrike;
    const clashed = real && !!rival && !(tapped && (rival.tapped || this.mode === 'sky-spike')) && !(rival.tapped && this.mode === 'sky-spike') && rival.team !== seat.team && now - rival.at <= CLASH.window && now - this.clashAt >= CLASH.gap && b.frozenUntil <= now && !this.stack && this.view.phase === 'live';
    if (real) this.lastStrike = clashed ? null : {id: seat.id, team: seat.team, at: now, power, vx: result.vx, vy: result.vy, vz: result.vz, shot: result.shot, super: result.super, ...(tapped ? {tapped} : {})};
    if (clashed) {
      this.clash(seat, power, result, rival!, merged);
      const [ult, awaken] = TOUCH_METER[blow.slot] ?? [3, 2];
      this.sim.addMeter(seat.id, this.mode === 'goal-rush' ? ult * GOAL_TOUCH_METER * this.swing(seat.team) : ult, awaken);
      return {damage: 1, reaction: 'flinch', killed: false};
    }
    // SKY SPIKE: a spike struck high over the net, the mode's own move, burns hotter and is named.
    const skySpike = this.mode === 'sky-spike' && !again && !scuffed && result.shot === 'spike' && b.y > (seat.trait === 'aerialist' ? TRAIT_RULES.skySpike : 3.6) && Math.abs(b.z) < 3.6;
    if (skySpike) result.heat += SPIKE_RULES.skySpikeHeat;
    const perfectSpike = perfect && !scuffed && result.shot === 'spike';
    if (perfectSpike) {
      result.heat += PERFECT_SPIKE.heat; this.award(seat, 'perfectSpike');
      if (now >= a.hitstopUntil) a.hitstopFrom = now;
      a.hitstopUntil = Math.max(a.hitstopUntil, now + PERFECT_SPIKE.freeze);
    }
    const perfectStrike = timed && result.perfect;
    if (perfectStrike) this.perfectStruck(seat, a, result);
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
    // (Never a SCUFF - the strike event would read SCUFFED while the LINK SHOT's accolade, heat and points
    // went to it, and a masher finished the most sets of anyone.)
    const linked = !again && !serve && !scuffed && LINK.finishes.has(result.shot) ? this.linkFrom(seat, now) : undefined;
    if (linked) result.heat += LINK.heat;
    let stopped: boolean | undefined;
    if (b.frozenUntil > now) {
      // In stopped time the blows pile up and land together when it starts again.
      const s = this.stack ?? {vx: 0, vy: 0, vz: 0, heat: 0, count: 0, id: seat.id, team: seat.team, shot: result.shot};
      s.vx += result.vx; s.vy += result.vy; s.vz += result.vz; s.heat += result.heat; s.count++; s.id = seat.id; s.team = seat.team; s.shot = result.shot;
      this.stack = s;
    } else {
      const incoming = Math.hypot(b.vx, b.vy, b.vz);
      // (Read before the strike sends it away: a shot on its way in that this strike stops is a save - a real one, LINE_SHOT
      // m/s or more and a second from the line, not any ball rolling goalward that a clearance meets.)
      if (this.mode === 'goal-rush' && !again) stopped = incoming >= LINE_SHOT && this.onTarget(seat, 1) && Math.abs(b.z - goalZ(seat.team)) < SAVE_ZONE;
      b.vx = result.vx; b.vy = result.vy; b.vz = result.vz; b.sx = result.sx; b.sy = result.sy; b.sz = result.sz;
      b.heat = Math.min(BALL_RULES.heatMax, b.heat + result.heat); b.super = result.super; b.shot = result.shot;
      if (serve) { b.held = false; this.view.phase = 'live'; this.award(seat, 'serve'); if (perfect) this.award(seat, 'perfectServe'); this.toss = null; this.floated = result.style === 'FLOAT SERVE'; }
      if (result.shot === 'bump' && incoming >= SPIKE_DIG.from) this.dug(seat, incoming, false);
      // A QUICK SET or a BACK SET is announced (the hitter's cue, the block's read); a floating set is the rally's own beat.
      // (Once - a many-blow light's later contacts lay the same set again, and said it again each time.)
      if ((result.style === 'QUICK SET' || result.style === 'BACK SET') && !again) this.emit('set', {team: seat.team, actorId: seat.id, x: b.x, y: b.y, z: b.z, shot: 'set', text: result.style});
    }
    const [ult, awaken] = TOUCH_METER[blow.slot] ?? [3, 2];
    // (A SCUFF earns none of it: MASHED.)
    if (!scuffed) this.sim.addMeter(seat.id, this.mode === 'goal-rush' ? ult * GOAL_TOUCH_METER * this.swing(seat.team) : ult, awaken);
    // (A SUPER SHOT is announced once a cast - in stopped time, the others' blows landing between its own, each
    // of its blows was announced again: four SUPER SHOTs in a second, the stands and the caller each time.)
    const announced = result.super && castId >= 0 && this.superCast.get(seat.id) === castId;
    if (result.super && !again) { if (!announced) { this.superCast.set(seat.id, castId); this.emit('super', {team: seat.team, actorId: seat.id, x: b.x, y: b.y, z: b.z, shot: 'super', text: blow.move.name}); } }
    else if (!again && result.shot !== 'tap' && result.shot !== 'bump' && result.shot !== 'set') this.emit('strike', {team: seat.team, actorId: seat.id, assistId: linked?.id, x: b.x, y: b.y, z: b.z, shot: b.shot ?? result.shot, value: Math.round(Math.hypot(b.vx, b.vy, b.vz)), text: perfectSpike ? 'SKY SPIKE' : perfectStrike ? flair ?? (air ? 'PERFECT VOLLEY' : 'PERFECT STRIKE') : scuffed ? 'SCUFFED' : serve && result.style ? (perfect ? 'PERFECT SERVE' : result.style) : result.shot === 'tip' ? 'TIP' : linked ? 'LINK SHOT' : charged ? 'KI CHARGE' : flair ?? (skySpike ? 'SKY SPIKE' : undefined), perfect: perfectSpike || perfectStrike || undefined});
    if (!seat.bot && !this.brains.has(seat.id)) this.view.best = Math.max(this.view.best, Math.hypot(b.vx, b.vy, b.vz));
    // A move's later contacts drive the ball on; the touch was its first.
    if (again) { b.lastId = seat.id; b.lastTeam = seat.team; }
    else this.touched(seat, result.shot, b.shot ?? result.shot, false, serve, stopped, scuffed, merged);
    if (!again) this.hot = perfectSpike;
    if (linked) {
      b.link = linked.id; this.award(seat, 'link'); this.award(linked, 'linkSetter');
      this.accolade(seat, 'LINK SHOT', 0, linked.id);
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
  /** Goal Rush's share of a touch's super-shot meter for `team` (GOAL_SWING): more for a side behind in the FINAL PUSH. */
  private swing(team: BallTeam) {
    return this.view.fever && this.view.score[otherTeam(team)] > this.view.score[team] ? GOAL_SWING.finalMeter : 1;
  }
  /** Goal Rush: each seat's swings as they end - one that never touched the ball is a swing at nothing (a whiff). */
  private swings() {
    const now = this.sim.serverTime;
    for (const seat of this.seats.values()) {
      const id = this.sim.actors.get(seat.id)?.cast?.id ?? -1, was = this.swingOf.get(seat.id) ?? -1;
      if (id === was) continue;
      if (was >= 0 && this.touchCast.get(seat.id) !== was) this.whiffAt.set(seat.id, now);
      this.swingOf.set(seat.id, id);
    }
  }
  /** Each seat's attack presses since the last step (a person's through submit, a bot's command), in the BALL stance:
   *  MASHED reads the last few. */
  private presses() {
    const now = this.sim.serverTime;
    for (const seat of this.seats.values()) {
      const a = this.sim.actors.get(seat.id), seq = a?.attackSeq ?? 0;
      if (!a || seq === (this.pressSeq.get(seat.id) ?? 0)) continue;
      this.pressSeq.set(seat.id, seq);
      if (seat.lock) continue;
      const list = this.pressedAt.get(seat.id) ?? [];
      list.push(now);
      if (list.length > MASHED.presses) list.shift();
      this.pressedAt.set(seat.id, list);
    }
  }
  /** SHOOT's quick strike pressed within MASHED.tap of the press before it (its own press the last heard: one pressed
   *  over is MASHED already). */
  private tapMashed(seat: BallSeat) {
    const list = this.pressedAt.get(seat.id);
    return !!list && list.length >= 2 && list[list.length - 1] - list[list.length - 2] <= MASHED.tap + 1e-6;
  }
  /** A blow on the ball out of a flurry of presses (MASHED); Sky Spike's body touch (autoBump) asks it too. */
  private mashed(seat: BallSeat, slot: string) {
    const list = this.pressedAt.get(seat.id);
    return slot !== 'ultimate' && !!list && list.length >= MASHED.presses && this.sim.serverTime - list[list.length - MASHED.presses] <= MASHED.window;
  }
  /** Goal Rush's PERFECT STRIKE timing (PERFECT_STRIKE): a melee blow (no ultimate, no area move) on a ball coming in on
   *  its own flight, inside the striker's shell only a moment, the blow's box only just open, and no swing at nothing a
   *  moment before it. */
  private timed(seat: BallSeat, a: Actor, blow: ExternalBlow, claim?: {entry: Seen; index: number}) {
    const b = this.ball, p = a.state, now = this.sim.serverTime, cast = a.cast, P = PERFECT_STRIKE;
    if (!cast || blow.move.style !== 'melee' || blow.slot === 'ultimate' || blow.slot === 'area') return false;
    if (now - (this.whiffAt.get(seat.id) ?? -Infinity) < P.clean) return false;
    const dx = p.x - b.x, dy = p.y + 1 - b.y, dz = p.z - b.z, d = Math.hypot(dx, dy, dz) || 1;
    // (Met where the page drew it - SEEN - it came into the shell when the ball the page drew did, round this body.)
    let inside = now - (this.outsideAt.get(seat.id) ?? -Infinity);
    if (claim) {
      let k = claim.index;
      while (k > 0 && Math.hypot(this.history[k].ball.x - p.x, this.history[k].ball.y - (p.y + 1), this.history[k].ball.z - p.z) <= P.shell) k--;
      inside = claim.entry.t - this.history[k].t;
    }
    if (d > P.sweet || (b.vx * dx + b.vy * dy + b.vz * dz) / d < P.incoming || inside > P.arrived) return false;
    // (How long the contact that landed had its box open: the latest of the move's contacts already due.)
    const age = now - cast.start;
    let open = -Infinity;
    for (const c of cast.move.contacts) if (c <= age + 1e-6) open = c;
    return age - open <= P.late;
  }
  /** A PERFECT STRIKE's (or PERFECT HEADER's) worth: hotter, points, meter, and the striker held a beat on the blow. */
  private perfectStruck(seat: BallSeat, a: Actor, result: {heat: number}) {
    const now = this.sim.serverTime;
    result.heat += PERFECT_STRIKE.heat; this.award(seat, 'perfectStrike'); seat.perfects = (seat.perfects ?? 0) + 1;
    this.sim.addMeter(seat.id, PERFECT_STRIKE.meter, 0);
    if (now >= a.hitstopUntil) a.hitstopFrom = now;
    a.hitstopUntil = Math.max(a.hitstopUntil, now + PERFECT_STRIKE.freeze);
  }
  /** Goal Rush's HEADER (HEADER): the ball headed on the way the body faces (the stick's), helped onto the frame as a
   *  shot is (strike.ts); timed at the top of the jump with the ball coming in hard, a PERFECT HEADER. A strike of its
   *  own: it may score, assist, save and pass as any other. */
  private header(seat: BallSeat, a: Actor, incoming: number) {
    const b = this.ball, p = a.state, now = this.sim.serverTime, v = this.last.get(seat.id);
    this.bodyTouch.set(seat.id, now); this.touchedAt.set(seat.id, now);
    const dx = p.x - b.x, dy = p.y + 1.5 - b.y, dz = p.z - b.z, toward = (b.vx * dx + b.vy * dy + b.vz * dz) / (Math.hypot(dx, dy, dz) || 1);
    // (Online, the ball the person's page drew reaches the head their lag later in the jump than it does here - SEEN: the
    // top of the jump is judged there, the climb slowed by the jump's own fall over the lag. Not for a ball already put
    // back into their time: meetSeen.)
    const arc = jumpArc(p.fighter), lag = this.frame === seat.id ? 0 : this.lagOf(seat.id), fall = lag > 0 ? 2 * arc.apex / Math.max(.05, arc.rise) ** 2 * lag : 0;
    const timed = !p.grounded && Math.abs((v?.vy ?? 0) - fall) <= HEADER.apex && toward >= PERFECT_STRIKE.incoming;
    const stopped = incoming >= LINE_SHOT && this.onTarget(seat, 1) && Math.abs(b.z - goalZ(seat.team)) < SAVE_ZONE;
    const result = strikeBall(b, {mode: this.mode, slot: 'light', move: HEADED, knockback: 0, launch: false, finisher: false, header: true, incoming, perfect: timed,
      pushX: 0, pushZ: 0, gravity: baseGravity(this.view.mutator), run: {vx: v?.vx ?? 0, vz: v?.vz ?? 0},
      striker: {id: seat.id, team: seat.team, x: p.x, y: p.y, z: p.z, grounded: p.grounded, aimYaw: p.yaw, awakened: !!p.awakened, forward: 0, lateral: 0, chain: 0}});
    if (!stopped && this.passed(seat, now)) result.heat += GOAL_RULES.passHeat;
    withTrait(seat.trait, this.mode, b.heat, result);
    if (result.perfect) this.perfectStruck(seat, a, result);
    b.vx = result.vx; b.vy = result.vy; b.vz = result.vz; b.sx = result.sx; b.sy = result.sy; b.sz = result.sz;
    b.heat = Math.min(BALL_RULES.heatMax, b.heat + result.heat); b.super = false; b.shot = 'header';
    const [ult, awaken] = TOUCH_METER.light;
    this.sim.addMeter(seat.id, ult * GOAL_TOUCH_METER * this.swing(seat.team), awaken);
    this.emit('strike', {team: seat.team, actorId: seat.id, x: b.x, y: b.y, z: b.z, shot: 'header', value: Math.round(Math.hypot(b.vx, b.vy, b.vz)), text: result.perfect ? 'PERFECT HEADER' : 'HEADER', perfect: result.perfect || undefined});
    this.touched(seat, 'header', 'header', false, false, stopped);
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
      b.heat = 0; this.award(seat, 'duel'); this.sim.addMeter(seat.id, 16, 10);
      if (onTarget) { seat.saves++; this.saved(seat, speed); } else if (this.mode === 'sky-spike') seat.blocks++;
      this.touched(seat, null, 'save', true);
      if (this.mode === 'sky-spike') { this.view.touchTeam = seat.team; this.view.touches = 0; }
    } else {
      this.stack = {vx: v.vx, vy: v.vy, vz: v.vz, heat: 0, count: 1, id: b.lastId ?? seat.id, team: b.lastTeam ?? otherTeam(seat.team), shot: 'super', super: true};
      if (striker) this.award(striker, 'duel', .5);
    }
    this.duelling = {keeper: seat.id, striker: striker?.id, keeperWins, x: b.x, y: b.y, z: b.z};
    // (GUARD_OFF: the ball the duel sends on - popped up in front of the keeper, or through them - leaves them.)
    this.shed.set(seat.id, now + DUEL.hold + GUARD_OFF.clear);
    this.emit('duel', {team: seat.team, actorId: seat.id, targetId: striker?.id, x: b.x, y: b.y, z: b.z, value: DUEL.hold, text: 'TECHNIQUE DUEL'});
  }
  /** Two sides' blows on the ball at once: it hangs in the clash, both fighters freeze, and the stronger blow (with a
   *  little luck either way) sends it on harder and hotter when the clash breaks (releaseStack). */
  private clash(seat: BallSeat, power: number, result: ReturnType<typeof strikeBall>, rival: NonNullable<BallMatch['lastStrike']>, merged?: {three: boolean}) {
    const b = this.ball, now = this.sim.serverTime;
    const mine = power * (.85 + this.rng() * .3) >= rival.power * (.85 + this.rng() * .3);
    const win = mine ? {id: seat.id, team: seat.team, vx: result.vx, vy: result.vy, vz: result.vz, shot: result.shot, super: result.super} : rival;
    const loser = mine ? rival.id : seat.id, k = CLASH.boost;
    this.stack = {vx: win.vx * k, vy: win.vy * k, vz: win.vz * k, heat: CLASH.heat + result.heat, count: 1, id: win.id, team: win.team, shot: win.shot};
    b.clash = now + CLASH.hold; this.clashAt = now; b.vx = b.vy = b.vz = 0; b.sx = b.sy = b.sz = 0; b.super = win.super;
    for (const id of [seat.id, rival.id]) { const a = this.sim.actors.get(id); if (a) { if (now >= a.hitstopUntil) a.hitstopFrom = now; a.hitstopUntil = Math.max(a.hitstopUntil, now + CLASH.freeze); } }
    const winner = this.seats.get(win.id)!;
    this.touched(seat, result.shot, result.shot, false, false, undefined, false, merged);
    b.lastId = winner.id; b.lastTeam = winner.team; b.shot = win.shot;
    if (this.mode === 'sky-spike') { this.view.touchTeam = winner.team; this.view.touches = SPIKE_RULES.touches; }
    this.award(winner, 'clash'); winner.clashes = (winner.clashes ?? 0) + 1;
    if (winner.clashes === 3) this.accolade(winner, 'CLASH KING');
    const speed = Math.min(speedCap(this.mode, BALL_RULES.heatMax), Math.hypot(win.vx, win.vy, win.vz) * k);
    this.emit('clash', {team: winner.team, actorId: winner.id, targetId: loser, x: b.x, y: b.y, z: b.z, value: Math.round(speed), shot: win.shot});
  }
  /** Sky Spike's body contact: a light keep (bump or set) struck for the body the ball met. */
  private autoBump(seat: BallSeat, a: NonNullable<ReturnType<typeof this.sim.actors.get>>, incoming: number, dived = false) {
    const b = this.ball, p = a.state, touches = (this.view.touchTeam === seat.team ? this.view.touches : 0) + 1;
    // A body can't aim: the third touch, which has to go over, is a free ball into the middle of the far court.
    const far = seat.team === 'red' ? 6 : -6, aimYaw = touches >= SPIKE_RULES.touches ? Math.atan2(-b.x * .5, far - b.z) : a.input.yaw;
    // Up in the air at the net on the last touch, the body spikes it (touching the ball hits it).
    const spike = !p.grounded && touches >= SPIKE_RULES.touches && b.y > SPIKE_RULES.netHeight && Math.abs(b.z) < 3.6;
    const shank = this.shanked(seat, p, touches, incoming, false);
    // (Hands mashing at it, the body's touch is a SCUFF as the blows are: MASHED - flailing, nothing is played clean.)
    const off = this.mashed(seat, 'light') ? this.rng() * 2 - 1 : 0, scuff = off ? {yaw: off * MASHED.yaw, off} : undefined;
    const result = strikeBall(b, {mode: this.mode, slot: spike ? 'heavy' : 'light', move: BOWL, knockback: 1, launch: false, finisher: false, pushX: 0, pushZ: 0, touches, shank, scuff, gravity: baseGravity(this.view.mutator),
      striker: {id: seat.id, team: seat.team, x: p.x, y: p.y, z: p.z, grounded: p.grounded, aimYaw, awakened: false, forward: 0, lateral: 0, chain: 0}});
    withTrait(seat.trait, this.mode, b.heat, result);
    b.vx = result.vx; b.vy = result.vy; b.vz = result.vz; b.sx = b.sy = b.sz = 0; b.shot = result.shot;
    b.heat = Math.min(BALL_RULES.heatMax, b.heat + result.heat * .5);
    if (result.shot === 'bump' && incoming >= SPIKE_DIG.from) this.dug(seat, incoming, dived);
    this.sim.addMeter(seat.id, 2, 2);
    this.touched(seat, result.shot, b.shot ?? result.shot, false, false, undefined, !!scuff);
    this.bodyPlayed.set(seat.id, {at: this.sim.serverTime, three: true});
  }
  /** Sky Spike: a serve's reception (the receiving side's first touch of it) off line - a FLOAT SERVE's always a little
   *  (SERVE_RULES.shank), a hard serve's met at full stretch, with the body `stretch.from` metres or more off the ball's
   *  line, wild (`stretch.miss` metres and up to `stretch.wild` more): get behind a JUMP SERVE. */
  private shanked(seat: BallSeat, p: Vec3, touches: number, incoming: number, again: boolean): {x: number; z: number} | undefined {
    const b = this.ball, R = SERVE_RULES.stretch;
    if (again || touches !== 1 || seat.team === b.lastTeam || b.shot !== 'serve') return undefined;
    const off = Math.hypot(b.x - p.x, b.z - p.z);
    if (incoming >= R.speed && off > R.from) {
      this.floated = false;
      const ang = this.rng() * Math.PI * 2, miss = R.miss + R.wild * Math.min(1, (off - R.from) / R.span);
      return {x: Math.sin(ang) * miss, z: Math.cos(ang) * miss};
    }
    if (!this.floated) return undefined;
    this.floated = false;
    return {x: (this.rng() - .5) * 2 * SERVE_RULES.shank.x, z: (this.rng() - .5) * 2 * SERVE_RULES.shank.z};
  }
  /** Sky Spike: a hard ball kept up on the first touch - a DIG (a DIVING DIG off a dash), its own event. */
  private dug(seat: BallSeat, incoming: number, dived: boolean) {
    const b = this.ball;
    b.shot = 'dig'; seat.digs++; this.award(seat, dived ? 'divingDig' : 'dig');
    this.emit('dig', {team: seat.team, actorId: seat.id, x: b.x, y: b.y, z: b.z, value: Math.round(incoming), shot: 'dig', text: dived ? 'DIVING DIG' : 'DIG'});
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

  /** Goal Rush: the other side's ball on its way into `seat`'s goal (a touch that stops it is a save). */
  private onTarget(seat: BallSeat, within?: number) {
    const b = this.ball;
    return this.mode === 'goal-rush' && b.lastTeam !== null && b.lastTeam !== seat.team && this.headingInto(seat.team, within);
  }
  /** A touch of the ball by `seat`: whose ball it is now, the touch count, the shot bookkeeping. `stopped` is whether the
   *  ball was on its way into their goal before the touch, when the touch has already sent it on (a strike's); `scuffed`,
 *  a strike or a body's touch out of a flurry of presses (MASHED), whose MVP worth is MVP.scuffTouch's and .scuffShot's. */
  private touched(seat: BallSeat, shot: ShotKind | null, named: ShotKind, block = false, serve = false, stopped?: boolean, scuffed = false, merged?: {three: boolean}) {
    const b = this.ball, now = this.sim.serverTime;
    // (A strike's touch is told whether it stopped a ball on target, read before the strike sent it away. Read
    // here, after, a clearance was never a save: only a strike that still sent the ball at its own goal was.)
    const wasOnTarget = stopped ?? this.onTarget(seat);
    b.lastId = seat.id; b.lastTeam = seat.team; b.link = null; this.hot = false;
    // (GUARD_OFF: a touch is a new flight - every body that let the last one go may meet this one.)
    this.shed.clear();
    // (DOUBLE: a swing just behind its body's touch is that touch - counted once, on the card and toward MVP.)
    if (!merged) { seat.touches++; this.award(seat, scuffed ? 'scuffTouch' : 'touch'); }
    this.touchesLog.push({id: seat.id, team: seat.team, at: now, x: b.x, y: b.y, z: b.z, strike: shot !== null, shot: shot ?? undefined, ...(scuffed ? {scuffed} : {})});
    if (this.touchesLog.length > 12) this.touchesLog.shift();
    if (this.mode === 'goal-rush') {
      if (wasOnTarget && shot !== null && named !== 'save') { seat.saves++; this.award(seat, 'save'); this.emit('save', {team: seat.team, actorId: seat.id, x: b.x, y: b.y, z: b.z, text: this.onLine(seat.team) ? 'OFF THE LINE' : 'SAVE', shot: 'save'}); this.saved(seat); }
      if (shot !== null && this.headingInto(otherTeam(seat.team), 2.6)) { seat.shots++; this.award(seat, scuffed ? 'scuffShot' : 'shot'); this.onTargetSince = now; }
      return;
    }
    if (serve) { this.view.touchTeam = seat.team; this.view.touches = SPIKE_RULES.touches; return; }
    // A block, and a ball that only bounced off somebody, take none of a side's three touches (it still says whose
    // ball it was last, for the line call).
    if (block || shot === null) { if (this.view.touchTeam !== seat.team && sideOf(b.z) === seat.team) { this.view.touchTeam = seat.team; this.view.touches = 0; } return; }
    if (this.view.touchTeam !== seat.team) { this.view.touchTeam = seat.team; this.view.touches = 0; }
    if (!merged?.three || this.view.touches === 0) this.view.touches++;
    if (this.view.touches > SPIKE_RULES.touches) this.point(otherTeam(seat.team), 'touches', seat.id);
  }
  /** DOUBLE: the ball is the seat's own body's touch of a moment ago, still on the flight it gave it - a swing
   *  landing now is that touch. Not a blow out of a flurry of presses (MASHED): it was pressed for no ball in particular,
   *  and merged, flailing at a ball cost a side nothing - the scripted masher's side won 40% on NORMAL (21% before). */
  private merges(seat: BallSeat, now: number, slot: string) {
    const body = this.bodyPlayed.get(seat.id);
    return body && this.ball.lastId === seat.id && !this.ball.held && now - body.at <= DOUBLE.window + 1e-6 && !this.mashed(seat, slot) ? body : undefined;
  }
  /** The seat's own last touch, its body's, taken off the log (DOUBLE: the swing's goes in its place). */
  private unlog(id: string) {
    const last = this.touchesLog[this.touchesLog.length - 1];
    if (last?.id === id) this.touchesLog.pop();
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
  /** Sky Spike: a serve still up over the net zone (2.4 m either side, above the net's height), which nobody of the
   *  receiving side may block or attack (else the front row swats JUMP SERVEs back at the net). */
  private overNet(b: BallState) { return b.shot === 'serve' && b.y > SPIKE_RULES.netHeight; }
  /** Sky Spike: the seat's side has spent its last touch and the ball is on its way over the net. */
  private sentBy(seat: BallSeat) {
    const b = this.ball;
    if (this.view.touchTeam !== seat.team || this.view.touches < SPIKE_RULES.touches || b.held) return false;
    return Math.sign(b.vz) === (seat.team === 'red' ? 1 : -1) && sideOf(b.z) === seat.team;
  }
  /** Whether the ball is on its way into `team`'s goal inside `within` seconds (a shot on target, a save to be made). */
  private headingInto(team: BallTeam, within = 1.8) { return headingInto(this.ball, team, within); }

  /** The ball is on `team`'s goal line: in front of the mouth, within LINE metres of it (a stop here is OFF THE LINE). */
  private onLine(team: BallTeam) {
    const b = this.ball;
    return Math.abs(b.z - goalZ(team)) < LINE && Math.abs(b.x) < GOAL_RULES.goalHalfWidth + 1;
  }

  // ─── Goal Rush ────────────────────────────────────────────────────────────────────────────────────────────────────
  private judgeGoal() {
    const b = this.ball;
    for (const c of this.contacts) {
      // (A ball rattling between the post and the bar rings once: RATTLE.)
      if ((c.kind === 'post' || c.kind === 'bar') && this.sim.serverTime - this.postAt >= RATTLE.post) { this.postAt = this.sim.serverTime; this.emit('post', {team: b.lastTeam ?? undefined, actorId: b.lastId ?? undefined, x: c.x, y: c.y, z: c.z, value: Math.round(c.speed), text: c.kind === 'bar' ? 'CROSSBAR!' : 'OFF THE POST!'}); }
      if (c.kind === 'goal') { this.targetHit(c.x, c.y, c.z); this.goal(c.team!, c); return; }
      if (c.kind === 'shield') this.shielded(c.team!, c.x, c.y, c.z, 'IRON WALL');
      if (c.kind === 'floor' && this.endWait) { this.timeUp(); return; }
    }
    // The clock at nought ends the match the moment the ball next comes down.
    if (this.endWait && b.y <= this.radius * b.size + .05) this.timeUp();
  }
  private goal(conceded: BallTeam, c: BallContact) {
    const b = this.ball, scorers = otherTeam(conceded), now = this.sim.serverTime, mark = this.serial;
    this.drop(undefined, 'goal');
    const worth = b.super ? GOAL_RULES.superGoal : 1;
    this.view.score[scorers] += worth;
    this.deficit[conceded] = Math.max(this.deficit[conceded], this.view.score[scorers] - this.view.score[conceded]);
    if (this.view.overtime && this.view.mutator === 'sudden-death') this.decider = scorers;
    // The goal is the last striker's of the scoring side when the ball only bounced in off a defender after it (a
    // deflection); a defender's own blow into their own net is an own goal.
    const lastTouch = this.touchesLog[this.touchesLog.length - 1];
    const shooter = [...this.touchesLog].reverse().find(t => t.team === scorers && t.strike && now - t.at < 4);
    const deflected = !!lastTouch && lastTouch.team === conceded && !lastTouch.strike && !!shooter;
    const scorerId = deflected ? shooter!.id : b.lastId;
    const scorer = scorerId ? this.seats.get(scorerId) : undefined, own = !!scorer && scorer.team !== scorers;
    const assist = [...this.touchesLog].reverse().find(t => t.team === scorers && t.id !== scorerId && t.strike && now - t.at < 7);
    // (A goal off a SCUFF - MASHED - is worth MVP.scuffGoal toward MVP; an own goal MVP.ownGoal, a debit.)
    const scuffed = !!(deflected ? shooter : lastTouch?.id === scorerId ? lastTouch : undefined)?.scuffed;
    if (scorer && !own) { scorer.goals++; this.award(scorer, scuffed ? 'scuffGoal' : 'goal', worth); this.sim.addMeter(scorer.id, 10, 10); }
    else if (scorer && own) this.award(scorer, 'ownGoal');
    const helper = assist && !own ? this.seats.get(assist.id) : undefined;
    if (helper) { helper.assists++; this.award(helper, 'assist'); }
    for (const s of this.seats.values()) if (s.team === conceded) this.sim.addMeter(s.id, 12, 10);
    const speed = Math.round(c.speed * 3.6);
    // The feats in it, and what the bots make of it.
    if (scorer && !own) {
      const struck = deflected ? shooter : [...this.touchesLog].reverse().find(t => t.id === scorer.id && t.strike);
      if (scorer.goals === 3) this.accolade(scorer, 'HAT TRICK', 50);
      if (struck && struck.y >= 2.4) this.accolade(scorer, 'AERIAL GOAL');
      else if (struck && Math.sign(struck.z) === Math.sign(goalZ(scorers)) && Math.abs(struck.z) > 3) this.accolade(scorer, 'LONG GOAL');
      if (this.endWait || (!this.view.overtime && this.view.clock <= 1)) this.accolade(scorer, 'BUZZER BEATER', 40);
      // (GOAL_SWING: level again after being well behind.)
      if (this.view.score[scorers] === this.view.score[conceded] && this.deficit[scorers] >= GOAL_SWING.behind) { this.accolade(scorer, 'COMEBACK', 40); this.deficit[scorers] = 0; }
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
    this.scoredAt = now; this.scoredBy = scorers; this.skips.clear();
    const decisive = deflected ? shooter : [...this.touchesLog].reverse().find(t => t.strike);
    // Played again only when it earned it (REPLAY.screamer); every goal has its sequence.
    if (!own && this.earned(b, decisive, speed, mark)) this.replay('goal', decisive?.at, {team: scorers, actorId: scorer?.id, shot: b.shot ?? undefined, speed, text: b.super ? 'SUPER GOAL' : undefined, ceremony: !!scorer});
  }
  /** Whether a goal earns its replay (REPLAY.screamer): a SUPER GOAL; a decisive strike that was PERFECT, a
   *  flair shot or a LINK SHOT (its strike event says so); a screamer; or a goal that turned the match - a BUZZER
   *  BEATER, a COMEBACK, overtime's golden goal (the feats emitted with it since `mark`). An own goal never does. */
  private earned(b: BallState, decisive: {id: string; at: number} | undefined, speed: number, mark: number) {
    if (b.super || speed >= REPLAY.screamer || this.view.overtime) return true;
    const events = this.view.events;
    for (let i = events.length - 1; i >= 0 && events[i].id > mark; i--) if (events[i].kind === 'accolade' && (events[i].text === 'BUZZER BEATER' || events[i].text === 'COMEBACK' || events[i].text === 'BICYCLE GOAL')) return true;
    if (!decisive) return false;
    for (let i = events.length - 1; i >= 0; i--) {
      const e = events[i];
      if (e.at < decisive.at - 1e-6) break;
      if (e.kind === 'strike' && e.actorId === decisive.id && Math.abs(e.at - decisive.at) < 1e-6) return !!e.perfect || !!e.assistId || e.text === 'BICYCLE KICK';
    }
    return false;
  }
  /** The replay of what just happened, shown after the celebration's first beat; the celebration waits for it. */
  private replay(kind: BallReplay['kind'], key: number | undefined, fields: Pick<BallReplay, 'team' | 'actorId' | 'shot' | 'speed' | 'text' | 'ceremony'>) {
    if (!this.replays) return;
    const now = this.sim.serverTime, decisive = key ?? now - .6;
    const from = Math.max(this.liveSince + .05, Math.min(now - REPLAY.lead, decisive - REPLAY.before));
    if (now - from < 1) return;
    const r: BallReplay = {kind, from, to: now + REPLAY.tail, key: decisive, at: now + (fields.ceremony ? kind === 'goal' ? REPLAY.goalCeremony : REPLAY.ceremony : REPLAY.delay), until: 0, ...fields};
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
      this.view.touchTeam = sideNow; this.view.touches = 0;
      this.climb(sideNow);
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
      if (c.kind === 'net' && c.speed > 4 && this.sim.serverTime - this.netAt >= RATTLE.net) { this.netAt = this.sim.serverTime; this.emit('net', {team: b.lastTeam ?? undefined, x: c.x, y: c.y, z: c.z}); }
    }
  }
  /** The rally climbs by an exchange (a crossing of the net, or a block that met the attack at it): it heats, and FEVER. */
  private climb(to: BallTeam) {
    const b = this.ball;
    this.view.rally++;
    if (this.view.rally === SPIKE_RULES.rallyHeat) this.emit('rally', {x: b.x, y: b.y, z: b.z, value: this.view.rally, text: 'RALLY HEATS UP'});
    if (this.view.rally >= SPIKE_RULES.fever && !this.feverTold) {
      // (SWINGS.feverBehind: level, a point either way counts double; otherwise only the side behind's - the team
      // named.)
      const {red, blue} = this.view.score, behind = !SWINGS.feverBehind || red === blue ? undefined : red < blue ? 'red' : 'blue';
      this.feverTold = true; this.view.fever = true;
      this.emit('fever', {team: behind, x: b.x, y: b.y, z: b.z, value: this.view.rally, text: behind ? 'FEVER RALLY · DOUBLE FOR THE SIDE BEHIND' : 'FEVER RALLY · POINTS COUNT DOUBLE'});
      this.chatter(to, CHAT.fever, undefined, .6);
    }
    else if (this.view.rally > SPIKE_RULES.rallyHeat && this.view.rally % 5 === 0) this.emit('rally', {x: b.x, y: b.y, z: b.z, value: this.view.rally});
  }
  private point(winner: BallTeam, why: 'floor' | 'out' | 'touches' | 'serve', byId?: string) {
    if (this.view.phase !== 'live' && this.view.phase !== 'kickoff') return;
    const b = this.ball, now = this.sim.serverTime, worth = this.worth(winner), R = SPIKE_RULES, target = this.view.target, cap = Math.max(target, R.cap + (target - R.target));
    const won = (s: number, o: number) => s >= cap || (s >= target && s - o >= 2);
    // A match point saved: the other side could have won the match with this point, and lost it.
    const matchPoint = won(this.view.score[otherTeam(winner)] + this.worth(otherTeam(winner)), this.view.score[winner]);
    this.view.score[winner] += worth;
    // A serve whose reception went out of play or down (a JUMP SERVE met at full stretch) is the server's ACE.
    const server = this.view.serverId ? this.seats.get(this.view.serverId) : undefined, toucher = byId ? this.seats.get(byId) : undefined;
    const received = (why === 'out' || why === 'floor') && this.view.rally <= 1 && winner === this.view.servingTeam && server?.team === winner && !!toucher && toucher.team !== winner
      && this.touchesLog.length === 2 && this.touchesLog[0].id === server.id && this.touchesLog[0].shot === 'serve';
    if (received) { why = 'floor'; byId = server!.id; }
    const by = received ? server : toucher;
    if (why === 'floor' && by && by.team === winner) {
      const ace = this.view.rally <= 1 && (b.shot === 'serve' || received);
      // (A kill off a SCUFF - MASHED - is worth MVP.scuffKill toward MVP.)
      const last = this.touchesLog[this.touchesLog.length - 1], scuffed = !!last?.scuffed && last.id === by.id;
      if (ace) { by.aces++; this.award(by, 'ace'); } else { by.kills++; this.award(by, b.super ? 'superKill' : scuffed ? 'scuffKill' : 'kill'); }
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
    // (A ball put out or a fourth touch is the toucher's fault, MVP.fault toward MVP: a debit.)
    if ((why === 'out' || why === 'touches') && toucher && toucher.team !== winner) this.award(toucher, 'fault');
    for (const s of this.seats.values()) if (s.team !== winner) this.sim.addMeter(s.id, 5, 6);
    const sideOut = winner !== this.view.servingTeam;
    if (sideOut) { this.serveRotation[winner]++; this.view.servingTeam = winner; this.emit('side-out', {team: winner, x: 0, y: 0, z: 0}); }
    b.held = true; b.vx = b.vy = b.vz = 0;
    const {red, blue} = this.view.score;
    // The great points are shown again (only these, so play gets back under way): a FEVER point, a super shot,
    // a match point saved and the one that wins the match. Every other point's celebration plays on into the next serve's
    // walk-up instead of holding the match up.
    const last = won(red, blue) || won(blue, red);
    const decisive = [...this.touchesLog].reverse().find(t => t.strike)?.at;
    // (And a kill by a PERFECT SPIKE that ends a rally of REPLAY.perfectRally crossings or more: its strike
    // event says it was perfect.)
    const perfect = why === 'floor' && !!by && by.team === winner && this.view.rally >= REPLAY.perfectRally && decisive !== undefined
      && this.view.events.some(e => e.kind === 'strike' && e.perfect && e.actorId === by.id && Math.abs(e.at - decisive) < 1e-6);
    // (A match point saved is shown again once a match, and only when a kill saved it: a deuce that runs on saves
    // one every other point.)
    const saved = matchPoint && !this.savedShown && why === 'floor' && !!by && by.team === winner;
    if (saved) this.savedShown = true;
    const highlight = why !== 'touches' && (this.view.fever || b.super || saved || last || perfect);
    const text = last ? 'WINNING POINT' : b.super ? 'SUPER SHOT' : this.view.fever ? 'FEVER POINT' : saved ? 'MATCH POINT SAVED' : perfect ? 'PERFECT SPIKE' : undefined;
    this.scoredAt = now; this.scoredBy = winner; this.skips.clear();
    // A kill on match point - the winning one, or one that saves it - gets the goal's sequence before its replay.
    const ceremony = why === 'floor' && by?.team === winner && (last || saved) && !this.view.practice;
    if (last) { this.view.phase = 'scored'; this.view.phaseUntil = now + REPLAY.lastPoint; this.pendingWinner = won(red, blue) ? 'red' : 'blue'; if (highlight) this.replay('point', decisive, {team: winner, actorId: by?.team === winner ? by.id : undefined, shot: b.shot ?? undefined, text, ceremony}); return; }
    // The swings (SWINGS): a COMEBACK drawn level from four or more down, and DEUCE.
    for (const team of BALL_TEAMS) this.deficit[team] = Math.max(this.deficit[team], this.view.score[otherTeam(team)] - this.view.score[team]);
    if (red === blue && this.deficit[winner] >= SWINGS.comeback && !this.view.practice) { this.emit('comeback', {team: winner, x: 0, y: 0, z: 0, value: this.deficit[winner], text: 'COMEBACK'}); this.deficit[winner] = 0; }
    if (red === blue && red >= target - 1 && !this.view.practice) this.emit('deuce', {x: 0, y: 0, z: 0, value: red, text: 'DEUCE'});
    for (const team of BALL_TEAMS) {
      const s = this.view.score[team], o = this.view.score[otherTeam(team)];
      if ((s + 1 >= target && s + 1 - o >= 2 || s + 1 >= cap) && this.matchPointTold !== s * 100 + o) { this.matchPointTold = s * 100 + o; this.emit('match-point', {team, x: 0, y: 0, z: 0, text: 'MATCH POINT'}); }
    }
    this.view.phase = 'scored'; this.view.phaseUntil = now + (this.view.practice ? 1.2 : R.pointSeconds);
    if (highlight) this.replay('point', decisive, {team: winner, actorId: by?.team === winner ? by.id : undefined, shot: b.shot ?? undefined, text, ceremony});
    if (this.celebration) this.celebration.until = this.view.phaseUntil + R.celebrateSeconds;
  }
  /** What the point is worth to `team`: one, or two in a FEVER rally to the side behind or either side level
   *  (SWINGS.feverBehind); SUDDEN DEATH's every point is a FEVER point, worth two to anyone. */
  private worth(team: BallTeam) {
    if (!this.view.fever) return 1;
    return this.view.mutator === 'sudden-death' || !SWINGS.feverBehind || this.view.score[team] <= this.view.score[otherTeam(team)] ? 2 : 1;
  }
  private pendingWinner: BallTeam | null = null;
  /** Sky Spike: a match point saved has been shown again this match (point). */
  private savedShown = false;
  /** SUDDEN DEATH: the side whose goal after the minute won the match. */
  private decider: BallTeam | null = null;
  /** The JUMP SERVE's toss (SERVE_RULES): the server off the floor within reach of the hanging ball tosses it, and it
   *  climbs to meet the top of their jump, then drops back to where it hung if they let it go. */
  private tossing(now: number) {
    const b = this.ball, server = this.view.serverId ? this.sim.actors.get(this.view.serverId) : undefined;
    if (!this.toss) {
      const p = server?.state, rising = this.view.serverId ? (this.last.get(this.view.serverId)?.vy ?? 0) > 0 : false;
      if (!p || p.grounded || p.y < .25 || !rising || Math.hypot(p.x - b.x, p.z - b.z) > 2.2) return;
      const arc = jumpArc(p.fighter);
      // (The rise left from here: the jump's own rise less what is already climbed, by the arc's shape.)
      const left = arc.rise * Math.sqrt(Math.max(0, 1 - p.y / arc.apex));
      this.toss = {at: now - (arc.rise - left), from: b.y, peak: arc.apex + SERVE_RULES.reach, rise: arc.rise};
    }
    const t = (now - this.toss.at) / this.toss.rise, k = Math.max(0, 1 - (t - 1) * (t - 1));
    if (t >= 2) { b.y = this.toss.from; this.toss = null; return; }
    b.y = this.toss.from + (this.toss.peak - this.toss.from) * k;
  }
  private autoServe() {
    // A drill's ball machine feeds its own balls.
    if (this.script?.serve(this)) return;
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
    this.drop(undefined, 'over');
    v.phase = 'over'; v.winner = winner; v.reason = reason; v.endsAt = this.sim.serverTime; this.sim.status = 'finished';
    let mvp: BallSeat | undefined;
    for (const s of this.seats.values()) if (!mvp || s.points + (s.team === winner ? MVP.win : 0) > mvp.points + (mvp.team === winner ? MVP.win : 0)) mvp = s;
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
      if (this.mode === 'goal-rush') { x = (this.rng() * 2 - 1) * (GOAL_RULES.halfX - 4); z = (this.rng() * 2 - 1) * (GOAL_RULES.halfZ - 6); }
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
    this.award(seat, 'charm');
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
    if (seat) { seat.saves++; this.award(seat, 'shield'); }
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
  /** `seat` earns `times` of MVP's worth for `kind` (an accolade: its own `times` points). */
  private award(seat: BallSeat, kind: MvpKind | 'accolade', times = 1) {
    seat.points += kind === 'accolade' ? times : MVP[kind] * times;
    const t = this.tally.get(seat.id) ?? {};
    t[kind] = (t[kind] ?? 0) + times;
    this.tally.set(seat.id, t);
  }
  /** Each seat's points by what they were for (MVP's kinds; 'accolade' in points), for the measures. */
  mvpTally(id: string) { return {...this.tally.get(id)}; }
  /** A feat named on every screen (an accolade), worth a few points toward MVP. */
  private accolade(seat: BallSeat, text: string, points = 25, assistId?: string) { this.award(seat, 'accolade', points); (seat.feats ??= []).push(text); this.emit('accolade', {team: seat.team, actorId: seat.id, assistId, x: 0, y: 0, z: 0, text}); }
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
      charms: this.view.charms.map(c => ({...c})), effects: this.view.effects.map(e => ({...e})), drill: this.view.drill ? {...this.view.drill, results: this.view.drill.results.slice()} : undefined,
      lesson: this.view.lesson ? {...this.view.lesson, done: this.view.lesson.done.slice(), skipped: this.view.lesson.skipped.slice(), parts: this.view.lesson.parts.slice()} : undefined};
    if (consume) this.events = [];
    return {...base, roomMode: 'match', events, ball: view};
  }
  dispose() { this.brains.clear(); this.strikes.clear(); this.last.clear(); this.sim.dispose(); }
  /** Seat ids by team, for a room's metadata and a page's plates. */
  side(team: BallTeam): PlayerState[] { return [...this.seats.values()].filter(s => s.team === team).map(s => this.sim.actors.get(s.id)!.state); }
}
