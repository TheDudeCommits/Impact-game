/* The economy's book in the economy world's store (kv.ts): every account, its tokens and logins, usernames, what has
 * been sold, completions, and a ledger, a key each, read when a call needs it and written before the call answers.
 * It is src/server/economy/book.ts's Book with its maps turned into keys: no call loads the whole book (PlayerTwo
 * gives a call 100 ms of CPU), and nothing is kept in memory between calls (a world's code starts again with each new
 * build, and its machine may change; room.store is what lasts).
 *
 * The keys (the migration writes the same ones: importer.ts):
 *   a/<pk>              the account (src/game/economy/account.ts), whole
 *   t/<sha256(token)>   the account a token opens (tokens are kept hashed, as on the match server)
 *   tp/<pk>/<hash>      the tokens of an account (to move them at a fold, or drop them at a deletion)
 *   d/<login>           the account a login is kept under: PlayerTwo's p2:<id>, or a Privy did
 *   dp/<pk>/<login>     the logins of an account
 *   n/<nameKey>         a username's holder
 *   c/<matchId>:<pk>    a completion (a match's pay, settled once)
 *   cp/<pk>/<matchId>   the completions of an account
 *   dt/<pk>             when its on-device results were paid (the last hour's, and the last: deviceReports.ts)
 *   r/<code id>         how many accounts have redeemed a code
 *   m/<into>/<gone>     a guest account folded into another (a deletion takes those too)
 *   x/<pk>              an account deleted at its owner's word: never brought back (an import skips it)
 *   L/<pk>/<seq>        the ledger: a line a change, as the server's (the account after it), under its account, so a
 *                       deletion takes its lines with it; <seq> 12 digits, in order
 *   sold                copies sold of each counted item ({ id: n })
 *   seq                 the ledger's last number
 * Beside them (economy.ts): p/<pk> progress, f/ fo/ forged fighters, rv/ rivalries, rk/ rkt/ ball RANKED, tr/ trophies
 * given, cfg the world's switches, imp/ the import's own. */
import { newAccount, type Account } from '../game/economy/account';
import { nameKey } from '../game/economy/names';
import { sha256 } from '../engine/sim/hash';
import type { Completion } from '../server/economy/completions';
import { dropAll, type KV } from './kv';

/** A token as it is kept: its SHA-256, hex (as the match server's Book keeps it). */
export const hashToken = (token: string) => sha256(token);
export const isGuestToken = (t: unknown): t is string => typeof t === 'string' && /^[a-f0-9]{32}$/.test(t);
export const isSessionToken = (t: unknown): t is string => typeof t === 'string' && /^s_[A-Za-z0-9_-]{32}$/.test(t);
const hex = (bytes: Uint8Array) => [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
const b64url = (bytes: Uint8Array) => { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const random = (n: number) => crypto.getRandomValues(new Uint8Array(n));
export const seqKey = (seq: number) => String(seq).padStart(12, '0');

/** The key names, one place for the book, the economy and the importer. */
export const K = {
  account: (pk: string) => `a/${pk}`,
  token: (hash: string) => `t/${hash}`,
  tokensOf: (pk: string) => `tp/${pk}/`,
  login: (did: string) => `d/${did}`,
  loginsOf: (pk: string) => `dp/${pk}/`,
  name: (name: string) => `n/${nameKey(name)}`,
  completion: (key: string) => `c/${key}`,
  completionsOf: (pk: string) => `cp/${pk}/`,
  device: (pk: string) => `dt/${pk}`,
  redeemed: (code: string) => `r/${code}`,
  merged: (into: string) => `m/${into}/`,
  deleted: (pk: string) => `x/${pk}`,
  ledger: (pk: string) => `L/${pk}/`,
  progress: (pk: string) => `p/${pk}`,
  sold: 'sold',
  seq: 'seq',
} as const;

export type LineKind = 'new' | 'earn' | 'buy' | 'wear' | 'grant' | 'link' | 'revoke' | 'merge' | 'redeem' | 'name' | 'import';
/** A line of the world's ledger: the match server's shape (book.ts Line), less the token and the login (neither is needed to
 *  read an account's history, and neither is kept where it need not be). */
export interface Line { seq: number; at: number; t: LineKind; pk: string; after?: Account; completion?: Completion; code?: string; item?: string; serial?: number; amount?: number; why?: string; into?: string }

export class StoreBook {
  /** Told of an account folded into another, and of one deleted: its progress goes with it (economy.ts). */
  onRetire?: (gone: string, into: string) => void;
  onForget?: (pk: string) => void;
  constructor(readonly kv: KV, private readonly now: () => number = Date.now) {}

  account(pk: string): Account | undefined { return typeof pk === 'string' && pk ? this.kv.get<Account>(K.account(pk)) : undefined; }
  put(account: Account) { this.kv.set(K.account(account.pk), account); }
  /** The account a token opens, if it opens one. */
  find(token: unknown): Account | undefined {
    if (!isGuestToken(token) && !isSessionToken(token)) return undefined;
    const pk = this.kv.get<string>(K.token(hashToken(token)));
    return pk ? this.account(pk) : undefined;
  }
  /** The account a token opens's id, without reading the account. */
  pkOf(token: unknown): string | undefined {
    if (!isGuestToken(token) && !isSessionToken(token)) return undefined;
    return this.kv.get<string>(K.token(hashToken(token)));
  }
  private keepToken(hash: string, pk: string) { this.kv.set(K.token(hash), pk); this.kv.set(K.tokensOf(pk) + hash, 1); }
  /** A new guest account, and the token that opens it. */
  create(now: number): { token: string; account: Account } {
    const token = hex(random(16)), account = newAccount(hex(random(8)), now);
    this.keepToken(hashToken(token), account.pk);
    this.record('new', account);
    return { token, account };
  }
  byLogin(did: string): Account | undefined { const pk = this.kv.get<string>(K.login(did)); return pk ? this.account(pk) : undefined; }
  hasLogin(pk: string): boolean { return this.kv.keys(K.loginsOf(pk), 1).length > 0; }
  loginsOf(pk: string): string[] { const at = K.loginsOf(pk); return this.kv.keys(at, 64).map(key => key.slice(at.length)); }
  nameHolder(name: string): string | undefined { return this.kv.get<string>(K.name(name)); }
  keepName(account: Account, before: string | undefined) {
    if (before && this.nameHolder(before) === account.pk) this.kv.delete(K.name(before));
    if (account.name) this.kv.set(K.name(account.name), account.pk);
  }
  redemptions(code: string): number { return this.kv.get<number>(K.redeemed(code)) ?? 0; }
  redeemed(code: string) { this.kv.set(K.redeemed(code), this.redemptions(code) + 1); }
  /** A login tied to an account, and a session token for it on this device (as Book.link). */
  link(account: Account, did: string): string {
    const token = `s_${b64url(random(24))}`;
    const had = this.kv.get<string>(K.login(did));
    if (had && had !== account.pk) this.kv.delete(K.loginsOf(had) + did);
    this.kv.set(K.login(did), account.pk); this.kv.set(K.loginsOf(account.pk) + did, 1);
    this.keepToken(hashToken(token), account.pk);
    delete account.label;
    this.record('link', account);
    return token;
  }
  /** A token that opens nothing any more (signed out). */
  revoke(token: string) {
    const h = hashToken(token), pk = this.kv.get<string>(K.token(h)), account = pk ? this.account(pk) : undefined;
    if (!pk) return;
    this.kv.delete(K.token(h)); this.kv.delete(K.tokensOf(pk) + h);
    if (account) this.record('revoke', account);
  }
  sold(): Record<string, number> { return this.kv.get<Record<string, number>>(K.sold) ?? {}; }
  soldOf(item: string): number { return this.sold()[item] ?? 0; }
  setSold(item: string, n: number) { this.kv.set(K.sold, { ...this.sold(), [item]: n }); }
  completion(key: string): Completion | undefined { return this.kv.get<Completion>(K.completion(key)); }
  keepCompletion(c: Completion) {
    this.kv.set(K.completion(`${c.matchId}:${c.pk}`), c);
    this.kv.set(K.completionsOf(c.pk) + c.matchId, 1);
  }

  /** A line in the ledger, and the account as it stands after it (both written in this call). */
  record(t: LineKind, account: Account, detail: Partial<Line> = {}) {
    const seq = (this.kv.get<number>(K.seq) ?? 0) + 1;
    this.kv.set(K.seq, seq);
    const line: Line = { seq, at: this.now(), t, pk: account.pk, ...(t === 'merge' || t === 'revoke' ? {} : { after: account }), ...detail };
    this.kv.set(K.ledger(account.pk) + seqKey(seq), line);
    if (t !== 'merge' && t !== 'revoke') this.put(account);
  }

  /** An account folded into another and gone: its tokens open the other now, its completions are the other's. */
  retire(gone: Account, into: Account) {
    if (gone.name && this.nameHolder(gone.name) === gone.pk) this.kv.delete(K.name(gone.name));
    this.moveCompletions(gone.pk, into.pk);
    const at = K.tokensOf(gone.pk);
    for (let batch = this.kv.keys(at, 1000); batch.length; batch = this.kv.keys(at, 1000)) for (const key of batch) {
      const h = key.slice(at.length);
      this.kv.delete(key);
      this.keepToken(h, into.pk);
    }
    const device = this.kv.get<number[]>(K.device(gone.pk));
    if (device) this.kv.delete(K.device(gone.pk));
    this.kv.delete(K.account(gone.pk));
    this.kv.set(K.merged(into.pk) + gone.pk, 1);
    this.record('merge', gone, { into: into.pk });
    this.record('grant', into, { why: `merged ${gone.pk}` });
    try { this.onRetire?.(gone.pk, into.pk); } catch (error) { console.error('[economy] what is kept beside the book did not follow a folded account', error); }
  }
  private moveCompletions(from: string, into: string) {
    const at = K.completionsOf(from);
    for (let batch = this.kv.keys(at, 1000); batch.length; batch = this.kv.keys(at, 1000)) for (const key of batch) {
      const matchId = key.slice(at.length), c = this.completion(`${matchId}:${from}`);
      this.kv.delete(key); this.kv.delete(K.completion(`${matchId}:${from}`));
      if (c) this.keepCompletion({ ...c, pk: into });
    }
  }
  /** DELETE ACCOUNT (as Book.forget): the account and every guest account once folded into it, gone for good: their
   *  tokens and logins, usernames, completions, device times, ledger lines, and (onForget) their progress. Returns how
   *  many ledger lines went. */
  forget(pk: string): number {
    const gone = new Set([pk]);
    for (const queue = [pk]; queue.length;) {
      const into = queue.pop()!, at = K.merged(into);
      for (const key of this.kv.keys(at, 1000)) { const each = key.slice(at.length); if (!gone.has(each)) { gone.add(each); queue.push(each); } }
    }
    let lines = 0;
    for (const each of gone) {
      this.kv.set(K.deleted(each), this.now());
      const account = this.account(each);
      if (account?.name && this.nameHolder(account.name) === each) this.kv.delete(K.name(account.name));
      this.kv.delete(K.account(each));
      const tokens = K.tokensOf(each);
      for (let batch = this.kv.keys(tokens, 1000); batch.length; batch = this.kv.keys(tokens, 1000)) for (const key of batch) { this.kv.delete(K.token(key.slice(tokens.length))); this.kv.delete(key); }
      const logins = K.loginsOf(each);
      for (let batch = this.kv.keys(logins, 1000); batch.length; batch = this.kv.keys(logins, 1000)) for (const key of batch) { const did = key.slice(logins.length); if (this.kv.get(K.login(did)) === each) this.kv.delete(K.login(did)); this.kv.delete(key); }
      const done = K.completionsOf(each);
      for (let batch = this.kv.keys(done, 1000); batch.length; batch = this.kv.keys(done, 1000)) for (const key of batch) { this.kv.delete(K.completion(`${key.slice(done.length)}:${each}`)); this.kv.delete(key); }
      this.kv.delete(K.device(each));
      dropAll(this.kv, K.merged(each));
      lines += dropAll(this.kv, K.ledger(each));
      try { this.onForget?.(each); } catch (error) { console.error('[economy] what is kept beside the book for a deleted account did not go', error); }
    }
    return lines;
  }
  isDeleted(pk: string) { return this.kv.get(K.deleted(pk)) !== undefined; }
}
