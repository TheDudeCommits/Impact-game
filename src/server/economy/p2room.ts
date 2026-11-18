/* The economy's side of Impact's rooms on PlayerTwo (src/p2room).
 *
 * A PlayerTwo room's code has no network, so the player's page carries what passes between it and the book, signed with
 * P2ROOM_KEY (the same key is built into the room bundle, which PlayerTwo never serves):
 * - POST /api/economy/p2room-pass { token, name }: the page's account as rooms read it (its public id, what it owns and
 *   wears, its username) and the names roomName gives the typed name, signed for ten minutes; and whether the game's
 *   matches go to PlayerTwo's rooms at all (P2ROOMS=0 in the server's variables sends every page back to this server's
 *   own rooms, with no new build: the fallback switch).
 * - POST /api/economy/p2room-complete { done }: a match completion a room worked out (RoomRewards) and signed; settled
 *   exactly as a room on this server settles one (Economy.complete: once per match and account, whoever posts it).
 */
import type { Account } from '../../game/economy/account';
import type { Report } from '../../game/economy/earn';
import { NAME_SIZES } from '../cluster/economyLink';
import { PASS_MS, seal, unseal, type Done, type PassAccount } from './p2roomSigned';

/** What this needs of the economy (api.ts Economy). */
export interface P2RoomBook {
  book: { find(token: unknown): Account | undefined };
  complete(pk: string, report: Report): unknown;
}

export const p2roomKey = (env: Record<string, string | undefined> = process.env) => (env.P2ROOM_KEY ?? '').trim();
/** Whether pages go to PlayerTwo's rooms: a key set, and P2ROOMS not "0". */
export const p2roomsOn = (env: Record<string, string | undefined> = process.env) => !!p2roomKey(env) && env.P2ROOMS !== '0';

/** What rooms read of an account, and nothing else (no balance, no ledger, no history). */
export function slimAccount(account: Account): PassAccount {
  const items: Record<string, { at: number }> = {};
  for (const id of Object.keys(account.items ?? {})) items[id] = { at: 0 };
  return { pk: account.pk, ...(account.name ? { name: account.name } : {}), xp: account.xp ?? 0, items, ...(account.allAccess ? { allAccess: true } : {}), worn: account.worn };
}

export async function p2roomPass(economy: P2RoomBook, token: unknown, typed: unknown, roomName: (token: unknown, typed: unknown, max: number) => string,
  env: Record<string, string | undefined> = process.env, now = Date.now()) {
  const key = p2roomKey(env), rooms = p2roomsOn(env);
  if (!rooms) return { rooms: false };
  const account = economy.book.find(token);
  if (!account) return { rooms: true, pass: null };
  const names: Record<number, string> = {};
  for (const size of NAME_SIZES) names[size] = roomName(token, typed, size);
  const pass = await seal(key, { k: 'pass', pk: account.pk, account: slimAccount(account), names, exp: now + PASS_MS });
  return { rooms: true, pass };
}

export class P2RoomRefusal extends Error {}

export async function p2roomComplete(economy: P2RoomBook, done: unknown, env: Record<string, string | undefined> = process.env, now = Date.now()) {
  const key = p2roomKey(env);
  if (!key) throw new P2RoomRefusal('Rooms on PlayerTwo are off.');
  const note = await unseal<Done>(key, done, now);
  if (!note || note.k !== 'done' || typeof note.pk !== 'string' || !note.report || typeof note.report !== 'object') throw new P2RoomRefusal('That result is not one of ours.');
  const completion = economy.complete(note.pk, note.report as Report);
  return { completion: completion ?? null };
}
