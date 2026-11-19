/* The room bundle's RANKED book (src/server/ball/ranked.ts on the match server, its disk): on PlayerTwo a player's standing
 * comes in the pass the economy world signed for their page (src/p2world/economy.ts p2roomPass), and a ranked match's
 * change goes back to the world as a signed note through the players' pages (economy.ts PassEconomy.note), which the
 * world takes once per match and account. A pass from the match server carries no standings: a fresh one is read. */
import { freshRating, type RankedAnswer, type RankedMode, type Rating } from '../../game/ball/ranked';
import { passEconomy } from '../economy';

export interface RankedExtra { carriers?: readonly string[]; name?: string }
export interface Ranked {
  rating(pk: string, mode: RankedMode): Promise<Rating>;
  apply(pk: string, mode: RankedMode, delta: number, won: boolean, id: string, extra?: RankedExtra): Promise<Rating | undefined>;
  answer(pk: string): Promise<RankedAnswer>;
  eligible?(pk: string): boolean;
}
const service: Ranked = {
  async rating(pk, mode) {
    const kept = passEconomy.passOf(pk)?.ranked?.[mode];
    return kept ? { ...freshRating(), rating: kept.rating, games: kept.games, peak: Math.max(freshRating().peak, kept.rating) } : freshRating();
  },
  /* (the note goes to the account's own page and to every carrier's: the world takes it once) */
  async apply(pk, mode, delta, won, id, extra) {
    passEconomy.note(pk, { k: 'rank', pk, mode, delta, won, id, ...(extra?.name ? { name: extra.name.slice(0, 24) } : {}) }, extra?.carriers ?? []);
    return undefined;
  },
  async answer() { return { season: 0, ends: 0, modes: {} } as unknown as RankedAnswer; },
  /* (the ranked Duel: a pass the world signed for a signed-in account says so; a guest's, or the match server's, does not) */
  eligible(pk) { return passEconomy.passOf(pk)?.signed === true; },
};
export const ranked = (): Ranked | undefined => service;
export const setRanked = (_next: unknown) => {};
