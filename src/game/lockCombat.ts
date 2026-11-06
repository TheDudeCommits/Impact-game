import { rushMove } from './awakening';
import type { MoveDefinition } from './moves';
import { LOCK_ROUND_FILL } from './lockRoundFill';
import { LOCK_ROUND_BORROW } from './lockRoundBorrow';
import type { FighterId } from './types';

export const LOCK_FIGHTERS: ReadonlySet<FighterId> = new Set<FighterId>(['konta', 'taisei', 'gummy', 'nigo', 'ouga', 'shiden']);
/** Light stages in a round: 0, 1 and 2. The last of them ends the round. */
export const LOCK_ROUND = 3;
/** Rounds in a string before it must end: in the finisher (stage 3, the launch) or an ender (combos.ts). */
export const LOCK_ROUNDS = 2;
export const LOCK_FINISH_WINDUP = .12;
// (Was 0.2. The critic, round 3: "B goes still before the hit ... Taisei hangs in the air for 0.24-0.28 s"; the string should move
// continuously into its finisher and be still after it - LOCK_CHASE_HOLD.)
/** After the finisher sends them off, a light waits this long (after the impact freeze) before it chases, or opens a
 *  string of its own: the knockaway reads before what comes after it (the critic: a hold of 100-130 ms, then
 *  the target is launched, and a calm 170-200 ms beat after it; ours started the next string 0.24 s after the blow). */
export const LOCK_CHASE_HOLD = .3;
/** How much further a pilot's finisher throws them than the live string's (a blind critic: the knockaway should send
 *  the target 4-6 body widths; ours sent 1-1.5). */
export const LOCK_FINISH_THROW = 1.4;
/** What a string's second round and its finisher deal, of the live string's blows they are made from. A lock string
 *  is seven blows with a beat, a wind-up and a knockaway in it, where the live one runs four stages into an air string:
 *  bot Duels on lock combat dealt 28% less a minute and ran 29% longer (scripts/combat/online_royale.mts). Seeing a
 *  string through pays for it; its first round is the live one's. */
export const LOCK_ROUND_DAMAGE = 1.6, LOCK_FINISH_DAMAGE = 2;
/** A bot carries a landed lock string on light by light only with nobody else this near (metres): in a crowd its combo
 *  ender stands (simulation.ts thinkBot). */
export const LOCK_BOT_CROWD = 6;
/** The open floor a finisher's throw wants behind the body, and how far off its line it may be turned to find it (the
 *  critic, round 4: in the training hall it crashed them into the rock a second time - "debris, black crack zigzags" -
 *  and the next string was pinned there). */
export const LOCK_THROW_ROOM = 3.5, LOCK_THROW_TURN = .35;
/** The finisher's knockaway (simulation.ts lockKnockaway): rising no faster than this (m/s; the live launch is 7.5), and
 *  sliding at least this far along the blow (m) - low and long (the critic, round 5). */
export const LOCK_THROW_RISE = 5.5, LOCK_THROW_FAR = 4;
/** How far short of a wall any other blow of a string stops the body it slides (simulation.ts lockClear). */
export const LOCK_WALL_MARGIN = .15;
/** How long, from the round's last blow (its impact freeze not counted), a guard press is a clean escape. */
export const LOCK_ESCAPE_WINDOW = .22;
/** Online, how far back from its arrival a guard press is judged at most (seconds): the frame the defender pressed on
 *  (PlayerInput.view). The server's lag compensation for blows reaches a quarter of a second; a round trip of 200-300 ms
 *  and the page's drawing delay need more, and the escape is the defender's own press, never the attacker's. */
export const LOCK_ESCAPE_REWIND = .35;
/** A guard pressed this soon before the round's last blow is a press made during the round - mashing - and spends
 *  this gap's escape: the window opens shut. */
export const LOCK_ESCAPE_EARLY = .3;
export const LOCK_VANISH_STAMINA = 75;
/** The attacker's answer to an escape, a counter-vanish: guard pressed within LOCK_COUNTER_WINDOW of the
 *  defender vanishing puts the attacker behind them in turn, for half the escape's price (one bar of six). */
export const LOCK_COUNTER_WINDOW = .35;
export const LOCK_COUNTER_STAMINA = 37;
/** How long the attacker reels after the defender vanishes from their string: long enough for a light from behind. */
export const LOCK_LOST = .5;
export const LOCK_DASH_IN = 8;
/** ...from beyond this many metres, centre to centre: nearer, the jab's own step-in lands it (measured: from 1.6 m its
 *  first blow lands 0.13 s after the press; from 3 m it whiffs). */
export const LOCK_DASH_FROM = 2.3;
/** Mashing is how lock combat is played: a pilot's light pressed sooner than MASH_INTERVAL after the last is not mashed
 *  (no MASH_SCALE, and it chases), where the live rules make a mashed string worth three quarters and never chase. */
/** The longest a round's last blow holds its body for the gap and the blow after it. */
export const LOCK_STUN_MOST = .8;
/** The breaker's budget in a lock string: two rounds, the finisher and an air string fit inside it. */
export const LOCK_BREAK_CASTS = 12;
/** A COUNTER (a light or heavy landing during the other's swing, before its blow) holds them this much longer, so a
 *  counter starts a string rather than another exchange. */
export const LOCK_COUNTER_STUN = .12;
/** A bot in the gap: the chance it tries the escape, by skill (0 to 1); how soon after the window opens it presses,
 *  by skill; and a person's spread on that press. Early presses are barred and late ones miss, as a person's are. */
export const LOCK_BOT_ESCAPE = [.04, .15] as const;
// (Was 0.15-0.45: a bot escaped a quarter of the rounds. A defender should seldom break a
// string, and the playtester's complaint was strings the bots kept dropping.)
export const LOCK_BOT_REACT = [.17, .1] as const;
export const LOCK_BOT_SPREAD = [.07, .04] as const;
/** A bot whose string was escaped: the chance it counter-vanishes, by skill. */
export const LOCK_BOT_COUNTER = [.1, .4] as const;

/** Whether a fighter plays lock combat in a simulation that asks for it. */
export const locks = (_fighter: FighterId) => true;

export const LOCK_ROUND_TWO: Partial<Record<FighterId, readonly [string, string, string]>> = {
  konta: ['Clone Hook', 'Twin Knee', 'Whirlwind Kick'],
  taisei: ['Meteor Elbow', 'Cross Strike', 'Straight Palm'],
  gummy: ['Rubber Jab', 'Rubber Hook', 'Undertow Sweep'],
  nigo: ['Rising HAIZAN', 'Return Cut', 'HAIZAN Cleave'],
  ouga: ['Elbow Palm', 'Rising Kick', 'Ki Volley'],
  shiden: ['Slash Palm', 'Rising Slash', 'Plunging Cut'],
};

/** The move a second-round light throws at `stage` (0-2, or LOCK_ROUND: the finisher, on its wind-up), or undefined to
 *  throw the live string's (a fighter without a second round, or awakened: an awakened body draws its own string). */
export function lockRoundMove(fighter: FighterId, stage: number, awakened: boolean): MoveDefinition | undefined {
  if (awakened || stage < 0 || stage > LOCK_ROUND) return undefined;
  if (stage === LOCK_ROUND) {
    const finisher = rushMove(fighter, LOCK_ROUND, false);
    return { ...finisher, duration: finisher.duration + LOCK_FINISH_WINDUP, contacts: finisher.contacts.map(c => c + LOCK_FINISH_WINDUP),
      damage: finisher.damage * LOCK_FINISH_DAMAGE, knockback: finisher.knockback * LOCK_FINISH_THROW, ...(finisher.finisherKnockback !== undefined ? { finisherKnockback: finisher.finisherKnockback * LOCK_FINISH_THROW } : {}) };
  }
  const name = lockRoundName(fighter, stage);
  if (!name) return undefined;
  const move = rushMove(fighter, stage === LOCK_ROUND - 1 ? 2 : 1, false);
  return { ...move, name, damage: move.damage * LOCK_ROUND_DAMAGE };
}

/** A second round's move at `stage` (0-2) for `fighter`, or undefined to throw the first round's there: the hand-picked
 *  one (LOCK_ROUND_TWO), else the roster's (lockRoundFill.ts: a take of the fighter's own body that nothing else of
 *  theirs plays - their air string's, then their combo enders' - written by scripts/combat/lock_round_fill.mts), else for
 *  the nine with none to spare another fighter's strike fitted to them (lockRoundBorrow.ts). */
export function lockRoundName(fighter: FighterId, stage: number): string | undefined {
  return LOCK_ROUND_TWO[fighter]?.[stage] ?? LOCK_ROUND_FILL[fighter]?.[stage]?.name ?? LOCK_ROUND_BORROW[fighter]?.[stage]?.name;
}
