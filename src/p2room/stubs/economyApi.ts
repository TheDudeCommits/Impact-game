/* The room bundle's src/server/economy/api.ts: the economy as a PlayerTwo room sees it (../economy.ts). */
import { displayName } from '../../server/displayName';
import { passEconomy, type RoomEconomy } from '../economy';
export const sharedEconomy = (): RoomEconomy | undefined => passEconomy;
/** The name a player goes by in a room: their account's username, or the name the economy gave the typed one when it
  *  signed the pass (it checks it against every username); with no pass, the typed name as displayName tidies it. */
export function roomName(token: unknown, typed: unknown, max = 20): string {
  return passEconomy.name(token, max) ?? displayName(typed, max);
}
