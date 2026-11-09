import type {BallModeId} from './model';

/** The ball modes' mutators: rules beside CLASSIC and RUMBLE that a
 *  private room's host, the BOTS and COUCH sheet and the weekly online playlist can pick. Each changes one thing about
 *  the ball, so the match is still Goal Rush or Sky Spike:
 *
 *  - HEAT RUSH: the ball starts every kickoff and serve at heat tier 3 and never cools below tier 2.
 *  - LOW GRAVITY: the ball falls at 55% of its gravity. Only the ball: the fighters' gravity is the combat kernel's own
 *    constant, shared with the page's prediction, and no mode may change it without the kernel learning a new option.
 *  - GIANT BALL: the ball is 1.6 times its size all match (RUMBLE's GIANT BALL charm still grows it further).
 *  - SUDDEN DEATH: Goal Rush plays one minute, then the next goal wins whoever scores it; in Sky Spike every point is a
 *    FEVER point, worth two.
 *
 *  TWO BALLS was considered and left out: the kernel takes any number of external bodies, but the ball is one
 *  `BallState` through every layer above it - the room's view, the page's prediction targets (BallTargets), the
 *  renderer, the replays, the bots' reads and the HUD - and a second ball means a second copy of each.
 *
 *  Data and arithmetic only, as everything under src/game. */
export type BallMutator = 'heat-rush' | 'low-gravity' | 'giant-ball' | 'sudden-death';
export const BALL_MUTATORS: readonly BallMutator[] = ['heat-rush', 'low-gravity', 'giant-ball', 'sudden-death'];
export const isMutator = (value: unknown): value is BallMutator => typeof value === 'string' && (BALL_MUTATORS as readonly string[]).includes(value);

export const MUTATOR_NAMES: Record<BallMutator, string> = {'heat-rush': 'HEAT RUSH', 'low-gravity': 'LOW GRAVITY', 'giant-ball': 'GIANT BALL', 'sudden-death': 'SUDDEN DEATH'};
/** What each does, in a line for the sheet, the lobby and the HUD's chip. */
export function mutatorLine(mutator: BallMutator, mode: BallModeId): string {
  switch (mutator) {
    case 'heat-rush': return mode === 'goal-rush' ? 'Every kickoff starts the ball at tier 3, and it never cools below 2.' : 'Every serve starts the ball at tier 3, and it never cools below 2.';
    case 'low-gravity': return 'The ball falls at about half its gravity: higher pops, longer flights, floating sets.';
    case 'giant-ball': return 'The ball is 1.6 times its size all match.';
    case 'sudden-death': return mode === 'goal-rush' ? 'One minute of play, then the next goal wins - whoever scores it.' : 'Every point is a FEVER point, worth two.';
  }
}

export const MUTATOR_RULES = {
  /** HEAT RUSH: the heat a kickoff's or a serve's ball starts at, and the floor it never cools below. */
  heatStart: 3, heatFloor: 2,
  /** LOW GRAVITY: the ball's share of its gravity. */
  gravity: .55,
  /** GIANT BALL: the ball's size all match. */
  size: 1.6,
  /** SUDDEN DEATH (Goal Rush): seconds of play before the next goal wins. */
  suddenSeconds: 60,
} as const;

/** The ball's weight and size under a mutator (1: as the rules have it). The flight reads them from `BallState`, so
 *  every page runs the same ball on. */
export const baseGravity = (mutator: BallMutator | null | undefined) => mutator === 'low-gravity' ? MUTATOR_RULES.gravity : 1;
export const baseSize = (mutator: BallMutator | null | undefined) => mutator === 'giant-ball' ? MUTATOR_RULES.size : 1;

const DAY = 86_400_000, WEEK = 7 * DAY;
/** Weeks since the first Monday of 1970 (the 5th of January), UTC: the same turnover as the weekly missions. */
export const weekIndex = (now: number) => Math.floor((now - 4 * DAY) / WEEK);
/** The online playlist's mutator this week: the same for everyone, from the UTC week alone (turning over at midnight
 *  UTC on Monday), going through the list in turn so each comes round every four weeks. */
export function weeklyMutator(now: number): BallMutator {
  const n = BALL_MUTATORS.length;
  return BALL_MUTATORS[((weekIndex(now) % n) + n) % n];
}
/** When this week's playlist turns over (ms since the epoch). */
export const weeklyTurnover = (now: number) => (weekIndex(now) + 1) * WEEK + 4 * DAY;
