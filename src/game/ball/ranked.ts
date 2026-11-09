import type {BallModeId, BallTeam} from './model';

/** Ranked 3 v 3: a rating per person per mode, per season, shown
 *  as an ink stamp. The server keeps the ratings (src/server/ball/ranked.ts) and rates a match at its end; the page
 *  draws the stamps (src/ui/ball/ranks.ts). Data and arithmetic only.
 *
 *  THE RULES, as players are told them:
 *  - Ranked is ONLINE only, its own matchmaking queue. Nothing played on the device, in a private room or in the other
 *    queues is rated.
 *  - Only people are rated. Bots never gain or lose rating, and their seats count in neither side's average.
 *  - A match is RANKED if, at kickoff, each side has at least one person. A queue that filled with bots on one side
 *    plays on, unranked (the lobby says so).
 *  - At the final whistle every person still seated is rated: their side's average rating (people only) against the
 *    other side's people who started, Elo's expectation, a K of 32 (48 for the first five matches of a season, the
 *    placements).
 *  - Whoever leaves a ranked match before the final whistle loses rating as if beaten, at once; a bot plays their
 *    seat. The match stays ranked for the people left.
 *  - Seasons run eight weeks from Monday 9 November 2026, midnight UTC. A new season starts each rating halfway back to
 *    1,000 and its placements again.
 *  - Matchmaking looks first for a ranked room of people within one band (150 rating) of yours, then for any ranked
 *    room, then opens one; it waits 30 s for people before bots fill the empty seats. */
export const RANKED = {
  /** Every rating starts here, and a new season pulls each one halfway back to it. */
  start: 1000,
  /** Elo's step, and the placements' (the first matches of a season move further). */
  k: 32, placementK: 48, placements: 5,
  /** The rating band matchmaking looks in first. */
  band: 150,
  /** Seconds a ranked room waits for people before bots fill the empty seats (classic matchmaking waits 15). */
  wait: 30,
  /** Seasons: weeks each, from the first one's Monday (9 November 2026, midnight UTC). */
  seasonWeeks: 8, seasonZero: Date.UTC(2026, 10, 9),
} as const;

/** A person's standing in one mode, one season. */
export interface Rating { rating: number; games: number; wins: number; peak: number }
export const freshRating = (): Rating => ({rating: RANKED.start, games: 0, wins: 0, peak: RANKED.start});

/** The stamps: the stages a manga page is made in, rough to cover. Each is a red seal with its kanji. */
export interface Tier { id: 'rough' | 'pencil' | 'inked' | 'toned' | 'gilded' | 'cover'; name: string; mark: string; from: number }
export const TIERS: readonly Tier[] = [
  {id: 'rough', name: 'ROUGH', mark: '下', from: -Infinity},
  {id: 'pencil', name: 'PENCIL', mark: '鉛', from: 900},
  {id: 'inked', name: 'INKED', mark: '墨', from: 1000},
  {id: 'toned', name: 'TONED', mark: '網', from: 1150},
  {id: 'gilded', name: 'GILDED', mark: '金', from: 1300},
  {id: 'cover', name: 'COVER', mark: '表', from: 1450},
];
/** The stamp a rating earns, or null while the season's placements are still being played. */
export function tierOf(r: Pick<Rating, 'rating' | 'games'> | undefined): Tier | null {
  if (!r || r.games < RANKED.placements) return null;
  let tier = TIERS[0];
  for (const t of TIERS) if (r.rating >= t.from) tier = t;
  return tier;
}
/** Matchmaking's band for a rating. */
export const bandOf = (rating: number) => Math.floor(rating / RANKED.band);

const WEEK = 7 * 86_400_000;
/** The season `now` falls in: its number (from 1), when it began and when it ends. */
export function seasonOf(now: number): {n: number; start: number; end: number} {
  const span = RANKED.seasonWeeks * WEEK, i = Math.max(0, Math.floor((now - RANKED.seasonZero) / span));
  const start = RANKED.seasonZero + i * span;
  return {n: i + 1, start, end: start + span};
}
/** A rating carried into a new season: halfway back to the start, the placements to play again. */
export const intoSeason = (r: Rating): Rating => {
  const rating = Math.round(RANKED.start + (r.rating - RANKED.start) / 2);
  return {rating, games: 0, wins: 0, peak: rating};
};

/** Elo's expectation for a side rated `own` against one rated `other`. */
export const expected = (own: number, other: number) => 1 / (1 + 10 ** ((other - own) / 400));
/** The change for one person (`r`) whose side, rated `own` on average, met a side rated `other` and won or lost. */
export function change(r: Pick<Rating, 'games'>, own: number, other: number, won: boolean): number {
  const k = r.games < RANKED.placements ? RANKED.placementK : RANKED.k;
  return Math.round(k * ((won ? 1 : 0) - expected(own, other)));
}

/** A person seated in a ranked match: their seat, their account, their rating when the match began. */
export interface RankedSeat { id: string; pk: string; team: BallTeam; rating: number; games: number }
const average = (seats: readonly RankedSeat[]) => seats.reduce((sum, s) => sum + s.rating, 0) / Math.max(1, seats.length);
/** Whether the people who started make it a ranked match: at least one on each side. */
export const rankedStart = (seats: readonly RankedSeat[]) => seats.some(s => s.team === 'red') && seats.some(s => s.team === 'blue');
/** The change for each of `rated` (the people still seated at the end, or one who left) after a match the people
 *  `started` began, won by `winner` ('draw': nobody gains). By seat id. */
export function rate(started: readonly RankedSeat[], rated: readonly RankedSeat[], winner: BallTeam | 'draw' | null): Map<string, number> {
  const out = new Map<string, number>();
  if (!rankedStart(started) || !winner || winner === 'draw') return out;
  const red = average(started.filter(s => s.team === 'red')), blue = average(started.filter(s => s.team === 'blue'));
  for (const s of rated) out.set(s.id, change(s, s.team === 'red' ? red : blue, s.team === 'red' ? blue : red, s.team === winner));
  return out;
}

/** What a page is told of a seat's standing (BallSeat.rank): the rating, the matches played this season, and at the
 *  end the change. */
export interface SeatRank { rating: number; games: number; delta?: number }
/** A page's ask for its own standing, and the server's answer (src/server/ball/ranked.ts). */
export interface RankedAnswer { season: number; ends: number; modes: Partial<Record<BallModeId, Rating>> }
