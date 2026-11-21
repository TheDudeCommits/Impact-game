/* The room bundle's rivalries (src/server/social/Rivalries.ts on the match server, its disk): on PlayerTwo the head-to-head
 * records come in each player's pass from the economy world (p2roomPass `rivals`), and a result goes back to the world
 * as a signed note through the winner's page (or the loser's), taken once by its id. */
import { passEconomy } from '../economy';

export type Record2 = [number, number];
export interface Rivalries { between(a: string, b: string): Promise<Record2>; record(winner: string, loser: string, mode?: string): void }
let made = 0;
const service: Rivalries = {
  async between(a, b) {
    const mine = passEconomy.passOf(a)?.rivals?.[b];
    if (mine) return [mine[0], mine[1]];
    const theirs = passEconomy.passOf(b)?.rivals?.[a];
    return theirs ? [theirs[1], theirs[0]] : [0, 0];
  },
  record(winner, loser, _mode) {
    const id = `${Date.now().toString(36)}-${(made++).toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const by = passEconomy.passOf(winner) ? winner : loser;
    passEconomy.note(by, { k: 'rival', winner, loser, id });
  },
};
export const rivalries = (): Rivalries | undefined => service;
