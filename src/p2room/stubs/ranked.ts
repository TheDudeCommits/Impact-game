/* The room bundle's ball RANKED book (src/server/ball/ranked.ts on the match server, its disk): on PlayerTwo a player's standing
 * comes in the pass the economy world signed for their page (src/p2world/economy.ts p2roomPass), and a ranked match's
 * change goes back to the world as a signed note through that player's page (economy.ts PassEconomy.note), which the
 * world takes once per match and account. A pass from the match server carries no standings: a fresh one is read. */
import type { BallModeId } from '../../game/ball/model';
import { freshRating, type RankedAnswer, type Rating } from '../../game/ball/ranked';
import { passEconomy } from '../economy';

export interface Ranked {
  rating(pk: string, mode: BallModeId): Promise<Rating>;
  apply(pk: string, mode: BallModeId, delta: number, won: boolean, id: string): Promise<Rating | undefined>;
  answer(pk: string): Promise<RankedAnswer>;
}
const service: Ranked = {
  async rating(pk, mode) {
    const kept = passEconomy.passOf(pk)?.ranked?.[mode];
    return kept ? { ...freshRating(), rating: kept.rating, games: kept.games, peak: Math.max(freshRating().peak, kept.rating) } : freshRating();
  },
  async apply(pk, mode, delta, won, id) { passEconomy.note(pk, { k: 'rank', pk, mode, delta, won, id }); return undefined; },
  async answer() { return { season: 0, ends: 0, modes: {} } as unknown as RankedAnswer; },
};
export const ranked = (): Ranked | undefined => service;
export const setRanked = (_next: unknown) => {};
