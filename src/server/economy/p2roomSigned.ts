/* Signed notes between the economy (the match server's /p2room routes, p2room.ts beside this) and a PlayerTwo
 * room's code (room.ts), carried by the player's own page: a room's code has no network of its own (PlayerTwo's rooms).
 *
 * - A pass: what the economy knows of the page's account (its public id, a slim copy of what rooms read of it, the names
 *   roomName gives the name the page typed), so the room can check a locked fighter, an outfit, an emote, the room name.
 * - A result: a match completion the room worked out (RoomRewards), for the economy to settle (Economy.complete).
 *
 * Both are HMAC-SHA256 with one key: P2ROOM_KEY in the match server's variables, and the same key built into the room
 * bundle (build.mjs). A room bundle is never served to players (PlayerTwo takes room/ out of the build), so the key never
 * reaches a page. Web Crypto only: the same code runs in Node and in a Worker.
 */
const enc = new TextEncoder(), dec = new TextDecoder();
const b64url = (bytes: Uint8Array) => { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64url = (text: string) => { const s = atob(text.replace(/-/g, '+').replace(/_/g, '/')); const out = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i); return out; };

const keys = new Map<string, Promise<CryptoKey>>();
function keyOf(secret: string) {
  let k = keys.get(secret);
  if (!k) { k = crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']); keys.set(secret, k); }
  return k;
}

/** `payload` signed: "<body>.<mac>", both base64url. */
export async function seal(secret: string, payload: unknown): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', await keyOf(secret), enc.encode(body)));
  return `${body}.${b64url(mac)}`;
}

/** What `token` says, if it was signed with `secret` and has not expired (`exp`, ms since 1970); undefined otherwise. */
export async function unseal<T extends { exp?: number }>(secret: string, token: unknown, now = Date.now()): Promise<T | undefined> {
  if (typeof token !== 'string' || token.length > 32_000) return undefined;
  const dot = token.indexOf('.'); if (dot < 1) return undefined;
  const body = token.slice(0, dot), mac = token.slice(dot + 1);
  try {
    if (!(await crypto.subtle.verify('HMAC', await keyOf(secret), unb64url(mac), enc.encode(body)))) return undefined;
    const payload = JSON.parse(dec.decode(unb64url(body))) as T;
    if (typeof payload?.exp === 'number' && payload.exp < now) return undefined;
    return payload;
  } catch { return undefined; }
}

/** A pass's account: what rooms read of one (owns, lockedOut, worn outfits and emotes, the name), and nothing else. */
export interface PassAccount { pk: string; name?: string; xp: number; items: Record<string, { at: number }>; allAccess?: boolean; worn: unknown }
export interface Pass {
  k: 'pass'; pk: string; account: PassAccount; names: Record<number, string>; exp: number;
  /** (from the economy world) the player's ball RANKED standings this season, by mode, and their head-to-head records
   *  (opponent's account id -> [their wins, the opponent's]): what a room on PlayerTwo reads instead of the server's disk */
  ranked?: Record<string, { rating: number; games: number }>;
  rivals?: Record<string, [number, number]>;
  /** (from the economy world) the account has a login - a signed-in PlayerTwo player's, not a guest's:
   *  only such an account plays the ranked Duel (game/duel/ranked.ts). */
  signed?: boolean;
}
/** A room's result for the economy world, carried by a player's page like a completion: a ranked match's change for one
 *  account (once per match and account), or a rivalry result (once per id). */
export interface RankNote { k: 'rank'; pk: string; mode: string; delta: number; won: boolean; id: string; exp: number;
  /** The name the room showed them by (the pass's own: roomName's), for the season's board. */
  name?: string }
export interface RivalNote { k: 'rival'; winner: string; loser: string; id: string; exp: number }
export interface Done { k: 'done'; pk: string; report: unknown; exp: number }
/** How long a pass is good for: a page asks for one as it joins a room. */
export const PASS_MS = 10 * 60_000;
/** How long a result is good for: the page sends it on at once, and again for a while if the economy was away. */
export const DONE_MS = 24 * 3600_000;
