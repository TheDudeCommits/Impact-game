import {RANKED, change, seasonOf, tierOf, type Tier} from '../ball/ranked';

/** Ranked Duel on PlayerTwo: the 1 v 1 Duel rated as the ball modes' RANKED is (game/ball/ranked.ts: Elo, K 32 / 48 for
 *  the five placements, seasons of eight weeks from 9 November 2026, the manga-stage stamps), under one more mode id,
 *  `duel`, in the same tables. Data and arithmetic only: the room rates (server/duel/RankedDuel.ts), the economy world
 *  keeps the standings (p2world/economy.ts), the page draws them (ui/duel/ranked.ts).
 *
 *  THE RULES, as the Duel sheet's RANKED says them:
 *  - Online on PlayerTwo's rooms only, its own queue, for a signed-in PlayerTwo account. A guest is told to sign in;
 *    nothing is rated for a guest. Never a bot: a 1 v 1 rating against a bot says nothing.
 *  - Matched by rating: PlayerTwo seats the player in the waiting ranked Duel whose player is rated nearest (PlayerTwo's
 *    own skill rating for this queue, which each ranked room feeds with its set's result), one rated more than 400
 *    apart only when no nearer one is waiting; with nobody waiting, a new room, and the next player to queue is the
 *    opponent. (A crowd would hold a player back for a nearer match first; Impact's queue is a few people an hour.)
 *  - The ordinary Duel: first to two rounds, the online Duel's rings, lock combat and timing, the same rules for both
 *    (no handicaps, no room rules, no forged fighters), and no RUN IT BACK: each ranked set is queued for.
 *  - Rated by the room at the set's end: each person's change from their rating and the other's as the set began, a
 *    win or a loss, K 32 (48 for a season's first five). Leaving before the set is decided (or not coming back within
 *    PlayerTwo's 20 s) loses as if beaten, at once, and the one who stayed is rated the winner.
 *  - Nobody found: the queue keeps searching (CANCEL backs out), and after BOT_OFFER seconds it offers an UNRANKED bot
 *    on this device instead, which leaves the queue (ui/modes/WaitingDock.ts). */
export const RANKED_DUEL = {
  /** The mode id in the ranked tables (rk/<season>/duel/<pk>). */
  mode: 'duel',
  /** The join option a ranked Duel room is made and joined with (a casual one has none). */
  queue: 'ranked',
  /** PlayerTwo's matching key's filter: p2Mode('duel_arena', ['rk']) = i1-duel-rk. */
  match: 'rk',
  /** Seconds alone in the queue before it offers a bot on the device (the online Duel's own: WaitingDock BOT_OFFER_SECONDS). */
  offerBot: 30,
} as const;

/** What a page is told when it may not queue: why, and how to play ranked after all. */
export const RANKED_SIGN_IN = 'Ranked is for signed-in PlayerTwo players: sign in on PlayerTwo, then queue again.';
export const RANKED_ONLY_P2 = "Ranked Duel is played on PlayerTwo's rooms: open Impact on PlayerTwo to queue.";

/** A seat's standing in a ranked Duel, on every page's snapshot: the rating and the matches played this season as the
 *  set began, and at its end the change. */
export interface RankedDuelSeat { rating: number; games: number; delta?: number }
/** What a ranked Duel room tells its pages (GameSnapshot.ranked). */
export interface RankedDuelView {
  queue: 'ranked';
  /** The season the set is rated in (game/ball/ranked.ts seasonOf). */
  season: number;
  /** Each person's standing, by seat id, once the room has read it from their pass. */
  seats: Record<string, RankedDuelSeat>;
  /** The set started with both people's standings known: it is rated. */
  rated: boolean;
}

/** A person as a ranked set started: their seat, account and standing then. */
export interface DuelRanked { id: string; pk: string; rating: number; games: number }

/** Each person's change for a set won by `winner`: the winner's from their rating against the loser's, the loser's the
 *  other way round, a placement's K for one still placing. By seat id; empty when `winner` is neither of them. */
export function rateDuel(a: DuelRanked, b: DuelRanked, winner: string | null): Map<string, number> {
  const out = new Map<string, number>();
  if (winner !== a.id && winner !== b.id) return out;
  out.set(a.id, change(a, a.rating, b.rating, winner === a.id));
  out.set(b.id, change(b, b.rating, a.rating, winner === b.id));
  return out;
}

/** What a set did to a standing, for the results: the stamp first earned (the placements done), a stamp gained or
 *  lost, or nothing new. */
export type Promotion = { kind: 'placed' | 'promoted' | 'demoted'; tier: Tier } | undefined;
export function promotionOf(before: {rating: number; games: number}, after: {rating: number; games: number}): Promotion {
  const was = tierOf(before), now = tierOf(after);
  if (!now) return undefined;
  if (!was) return {kind: 'placed', tier: now};
  if (now.from > was.from) return {kind: 'promoted', tier: now};
  if (now.from < was.from) return {kind: 'demoted', tier: now};
  return undefined;
}
/** Placement matches left this season (0 once the stamp is earned). */
export const placementsLeft = (r: {games: number} | undefined) => Math.max(0, RANKED.placements - (r?.games ?? 0));
/** A ranked Duel's view as the room starts it. */
export const freshRankedView = (now = Date.now()): RankedDuelView => ({queue: 'ranked', season: seasonOf(now).n, seats: {}, rated: false});
