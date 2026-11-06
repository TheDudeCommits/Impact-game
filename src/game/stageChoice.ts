import { ARENAS, DUEL_ARENAS } from './social/custom';
import { SMALL_ROYALE_STAGES, type StageId } from './stages';

/** What the sheet remembers: a place, or RANDOM (the default). */
export type StageChoice = 'random' | StageId;
export const DEFAULT_CHOICE: StageChoice = 'random';

/** The modes a place can be chosen for, and the places each offers. Training and the bot Duel take the Duel's
 *  places (any ring, or one of the famous places); the royale and Bad Blood take what their rooms already accept. */
const PLACES: Readonly<Record<string, readonly StageId[]>> = {
  duel: DUEL_ARENAS,
  training: DUEL_ARENAS,
  royale: ARENAS.royale,
  'bad-blood': ARENAS['bad-blood'],
};

/** The places a way of playing `mode` offers, in the order the sheet lists them. Empty: no choice - the way is
 *  online (always dealt by the server), or the mode's place is authored. `way` is the sheet's VariantId. */
export function placesFor(mode: string, way: string): readonly StageId[] {
  return way === 'offline' || way === 'couch' || way === 'friends' ? PLACES[mode] ?? [] : [];
}

/** Whether `field` fighters fit the place: the small rings hold only so many (the royale's smaller rings, stages.ts). */
export function placeFits(stage: StageId, field?: number): boolean {
  return field === undefined || field <= (SMALL_ROYALE_STAGES[stage] ?? Infinity);
}

/** The place the player named for this way, or undefined for RANDOM: a remembered value that is not a place this way
 *  offers (an old build's, or the other way's) or that the field does not fit is RANDOM too, never an error. */
export function namedPlace(saved: unknown, mode: string, way: string, field?: number): StageId | undefined {
  return typeof saved === 'string' && placesFor(mode, way).includes(saved as StageId) && placeFits(saved as StageId, field) ? saved as StageId : undefined;
}

/** A place dealt at random from `pool` - never `previous` while there is another, so RANDOM does not repeat itself
 *  back to back. `rnd` is injectable for tests. */
export function dealPlace(pool: readonly StageId[], previous?: StageId, rnd: () => number = Math.random): StageId {
  const choices = pool.filter(stage => stage !== previous), from = choices.length ? choices : pool;
  return from[Math.min(from.length - 1, Math.floor(rnd() * from.length))];
}

/** A browser driven by a tool (Playwright, the capture and verification scripts) keeps every mode's own place: the
 *  scripts that film or test a fight frame it by where it is fought, and RANDOM would move it under them. A name still wins. */
const automated = () => typeof navigator === 'object' && navigator !== null && (navigator as { webdriver?: boolean }).webdriver === true;

let lastDealt: StageId | undefined;
/** The place a start is fought in, for the runtime that starts it: the one named, if the way offers it and the field
 *  fits; else (RANDOM) one dealt here from the way's places. Undefined means "as the mode always did": the royale's
 *  RANDOM is its own deck's deal (LocalRoyale, the room's RoyaleDeck: never one place twice running, per field size),
 *  and a way with no choice - or a driven browser - keeps the mode's own place. */
export function placeForStart(named: StageId | undefined, mode: string, way: string, field?: number, driven = automated()): StageId | undefined {
  const pool = placesFor(mode, way).filter(stage => placeFits(stage, field));
  if (named && pool.includes(named)) return named;
  if (!pool.length || mode === 'royale' || driven) return undefined;
  return lastDealt = dealPlace(pool, lastDealt);
}
/** Test hook: the deal's memory (page memory only). */
export const forgetDeal = () => { lastDealt = undefined; };

/** The `rules` option of a private royale room (customRules reads `arena` and `players`): the place named, or none -
 *  the room's own deck then deals, as it always has. */
export function royaleRules(named: StageId | undefined, players?: number): { arena: StageId; players?: number } | undefined {
  const arena = placeForStart(named, 'royale', 'friends', players);
  return arena ? players === undefined ? { arena } : { arena, players } : undefined;
}
