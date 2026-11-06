import ownNames from './ownNames.json';

export const OWN_NAMES: readonly string[] = ownNames.names;

export const NAME_MIN = 3, NAME_MAX = 16;
/** Letters, digits and _ (plain ASCII: no look-alike letters from other scripts). */
export const NAME_SHAPE = /^[A-Za-z0-9_]{3,16}$/;
/** Days a username stays before it can change again. The first claim waits on nothing, and a change of case is free. */
export const NAME_EVERY_DAYS = 30;
const DAY = 86_400_000;

/** A name as the book indexes it: its case does not count, so "Thunder Hawk" and "thunder-hawk" are one name. */
export const nameKey = (name: string) => name.toLowerCase();
/** What a name is under its dressing: lower case, no underscores, no digits at either end ("_Admin_01" is "admin"). */
export const bareName = (name: string) => name.toLowerCase().replace(/_/g, '').replace(/^\d+|\d+$/g, '');

/** Names no player may take: the game's own, its staff's and its services', and what would pass for them. */
const RESERVED = new Set(['admin', 'admins', 'administrator', 'mod', 'mods', 'moderator', 'moderators', 'impact', 'impactgame', 'system', 'sysop',
  'official', 'staff', 'support', 'help', 'helpdesk', 'owner', 'dev', 'devs', 'developer', 'developers', 'team', 'root', 'server', 'bot', 'bots', 'guest', 'guests',
  'fighter', 'player', 'null', 'undefined', 'nan', 'none', 'nobody', 'anonymous', 'anon', 'everyone', 'all', 'here', 'gamemaster', 'privy', 'sumi', 'rift',
  'riftarena', 'shop', 'store', 'account', 'accounts', 'security', 'signin', 'login', 'logout', 'claude', 'anthropic',
  'thedude', 'dude', ...OWN_NAMES]);
/** ...and any name with one of these in it ("SuperAdmin", "official_impact"). */
const RESERVED_PARTS = ['admin', 'moderator', 'official', 'impactgame', 'gamemaster', 'thedude'];

/** Why `raw` cannot be a username, or nothing if it can: its length, its letters, and the reserved names. (The server
 *  also asks its block-list, and whether another account has it.) */
export function nameProblem(raw: unknown): string | undefined {
  const name = typeof raw === 'string' ? raw.trim() : '';
  if (name.length < NAME_MIN) return `A username has at least ${NAME_MIN} characters.`;
  if (name.length > NAME_MAX) return `A username has at most ${NAME_MAX} characters.`;
  if (!NAME_SHAPE.test(name)) return 'A username is letters (A-Z), digits and _ only.';
  const bare = bareName(name);
  if (RESERVED.has(bare) || RESERVED_PARTS.some(part => bare.includes(part))) return 'That username is reserved.';
  return undefined;
}

/** When an account may next change its username (ms since 1970), or 0 if it may now: a first claim waits on nothing. */
export function nameFreeAt(account: { name?: string; nameAt?: number } | undefined): number {
  return account?.name && account.nameAt ? account.nameAt + NAME_EVERY_DAYS * DAY : 0;
}
