import { isReleasedFighter } from './rosterAvailability';
import { MOVES } from './moves';
import { HELD } from './economy/fighters';
import type { FighterId } from './types';

// Less any fighter built but not yet released (economy/fighters.ts HELD): never drafted as a bot.
const ROSTER = (Object.keys(MOVES) as FighterId[]).filter(f => isReleasedFighter(f) && !HELD.has(f));

/** Draft `count` bot fighters. Every human's own pick is left out so the
 *  field reads as a bracket rather than a mirror match; the rest of the
 *  roster is dealt in a random order and only repeats once every distinct
 *  fighter is on the stage. The order used to be fixed - Konta, Gummy, Kenzo,
 *  Ouga... - so the first rival anyone met in a royale was always Konta. */
export function draftBots(taken: readonly FighterId[], count: number, shuffle: <T>(items: readonly T[]) => T[]): FighterId[] {
  const pool = ROSTER.filter(f => !taken.includes(f));
  const deck = pool.length ? pool : ROSTER;
  const draft: FighterId[] = [];
  while (draft.length < count) draft.push(...shuffle(deck));
  return draft.slice(0, count);
}

