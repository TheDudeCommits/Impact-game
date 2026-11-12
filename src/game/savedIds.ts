/** Ids renamed so that none carries a name from another work. What a player saved under an id as it was - an account's
 *  items, what it wears, its feats and stats, Arcade progress and the career, a Forge kit, Arcade records and settings
 *  this browser keeps - is read through this one table, and so is what an older page still sends.
 *
 *  The old ids are not spelled here: each key is the first 12 hex digits of the SHA-256 of an id as it was (hash.ts),
 *  each value the id it is now. tests/savedIds.test.ts loads a profile written with the old ids and finds every unlock
 *  and loadout under the new ones. */
import { sha256 } from '../engine/sim/hash';
import type { Account } from './economy/account';

export const RENAMED_IDS: Readonly<Record<string, string>> = Object.freeze({
  // a fighter (the key, the Arcade boss of that key) and the shop item that unlocks it
  '968cbbaa031a': 'banjaku', '88220597bc7d': 'fighter-banjaku',
  // items an account owns and wears: an emote, two outfits
  '4438ea6f010c': 'emote-rumble', 'a2a3598b59cb': 'outfit-ouga-crownfire', 'e342c843fd35': 'outfit-ouga-azure-crown',
  // a stage (Last Stand's village), an Arcade boss, an Arcade place
  '300994d13bf6': 'ashwood', '10108ad2d318': 'dune-oni', '06df0dccbad4': 'fallen-star',
});

/** No old id is longer than this, or shorter: nothing else is hashed. */
const LONGEST = 40, SHORTEST = 6;
const known = new Map<string, string>();

/** An id as it is now: itself, or what it was renamed to. */
export function currentId(id: string): string;
export function currentId(id: unknown): unknown;
export function currentId(id: unknown): unknown {
  if (typeof id !== 'string' || id.length > LONGEST || id.length < SHORTEST) return id;
  let now = known.get(id);
  if (now === undefined) {
    now = RENAMED_IDS[sha256(id).slice(0, 12)] ?? id;
    if (known.size > 4096) known.clear();
    known.set(id, now);
  }
  return now;
}

/** Saved data with every renamed id in it - a string, an object's key, at any depth - as it is now. Objects and arrays
 *  are changed in place; the result is the value to keep. Of two keys that become one, the one already under the new id
 *  stays. Only for data made of ids and numbers: free text (a username, a label) is never passed through it. */
export function currentSaved<T>(value: T): T {
  return walk(value) as T;
}

function walk(value: unknown): unknown {
  if (typeof value === 'string') return currentId(value);
  if (Array.isArray(value)) { for (let i = 0; i < value.length; i++) value[i] = walk(value[i]); return value; }
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    for (const key of Object.keys(object)) {
      const now = currentId(key), inner = walk(object[key]);
      if (now === key) { object[key] = inner; continue; }
      delete object[key];
      if (!Object.hasOwn(object, now)) object[now] = inner;
    }
    return object;
  }
  return value;
}

/** An account as it is now: its items and gifts by their ids, what it wears, its feats and its stats (its name, label,
 *  codes and match ids are left as they are). Changed in place; true if anything was renamed. */
export function currentAccount(account: Account): boolean {
  const before = JSON.stringify([account.items, account.refunded, account.worn, account.feats, account.stats, account.day, account.week]);
  account.items = currentSaved(account.items);
  if (account.refunded) account.refunded = currentSaved(account.refunded);
  account.worn = currentSaved(account.worn);
  account.feats = currentSaved(account.feats);
  account.stats = currentSaved(account.stats);
  account.day = currentSaved(account.day);
  account.week = currentSaved(account.week);
  return JSON.stringify([account.items, account.refunded, account.worn, account.feats, account.stats, account.day, account.week]) !== before;
}

/** The keys this browser keeps whose text is free (a name typed): read as they are. */
const FREE_TEXT = /name|label|login|token|error/i;

/** This browser's own records (localStorage), read through the table once, as the page starts: a key whose name holds a
 *  renamed id (a Forge draft's body) moves to the new name, and a value that is an id, or JSON holding ids, is rewritten
 *  (an account's own copy through currentAccount). How many keys changed. */
export function currentStorage(store: Pick<Storage, 'length' | 'key' | 'getItem' | 'setItem' | 'removeItem'>): number {
  const keys: string[] = [];
  for (let i = 0; i < store.length; i++) { const key = store.key(i); if (key !== null) keys.push(key); }
  let changed = 0;
  for (const key of keys) {
    if (FREE_TEXT.test(key)) continue;
    const value = store.getItem(key);
    if (value === null) continue;
    const name = key.split(/([:/.|])/).map(part => currentId(part)).join('');
    let next = value;
    if (currentId(value) !== value) next = currentId(value);
    else if (/^\s*[[{]/.test(value)) {
      try {
        const data = JSON.parse(value) as unknown;
        if (data && typeof data === 'object' && 'account' in data && (data as { account?: unknown }).account && typeof (data as { account: unknown }).account === 'object') {
          const kept = data as { account: Account };
          if (currentAccount(kept.account)) next = JSON.stringify(data);
        } else {
          const text = JSON.stringify(currentSaved(data));
          if (text !== JSON.stringify(JSON.parse(value))) next = text;
        }
      } catch { /* not JSON: kept as it is */ }
    }
    if (name === key && next === value) continue;
    if (name !== key) { store.removeItem(key); if (store.getItem(name) !== null) { changed++; continue; } }
    store.setItem(name, next); changed++;
  }
  return changed;
}
