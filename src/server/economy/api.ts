import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buy, buyBundle, credit, merge, roll, settle, wear, type Account } from '../../game/economy/account';
import { ITEM, KINDS, isBundle, type ItemKind } from '../../game/economy/catalog';
import type { Report } from '../../game/economy/earn';
import { refundRelevant, refundWhy, refundsDue, type LedgerLine } from '../../game/economy/refunds';
import { Book } from './book';
import { PrivyVerifier } from './privy';
import { PlayerTwoVerifier, p2Login, p2Of, type PlayerTwoOptions } from './playertwo';
import { PlayerTwoTrophies, type TrophyOptions } from './playertwoTrophies';
import { ALL_ACCESS_MIN, CODES, codeHash, envCodes, normalCode, type CodeDef } from './codes';
import { blockedName } from './names';
import { displayName, heldKeys } from '../displayName';
import { NAME_FALLBACK } from '../../game/displayName';
import { nameFreeAt, nameKey, nameProblem } from '../../game/economy/names';
import { isDeviceId } from '../../game/economy/device';
import { DeviceReports } from './deviceReports';
import { ForgeRefusal, ForgeStore } from '../forge/ForgeStore';
import { remoteEconomy, type RoomEconomy } from '../cluster/economyLink';
import { ProgressStore } from '../progress/ProgressStore';
import { currentId, currentSaved } from '../../game/savedIds';

const PAY_OFF = 'off' as const;

export interface EconomyOptions {
  /** Where the book is kept (`DATA_DIR`). None: a folder under the system's temp (a developer's machine). `false`: memory only. */
  dir?: string | false;
  privyAppId?: string;
  adminToken?: string;
  now?: () => number;
  fetcher?: typeof fetch;
  /** The codes this server knows (codes.ts, and the all-access code from the ALL_ACCESS_CODE variable; a test brings its own). */
  codes?: readonly CodeDef[];
  /** Player Two's identities (playertwo.ts): the game's slug there (P2_GAME) and where its keys are (P2_KEYS). */
  playerTwo?: PlayerTwoOptions;
  /** Feats given as Player Two trophies (playertwoTrophies.ts): the game key (P2_GAME_KEY) and Player Two (P2_SITE). */
  trophies?: TrophyOptions;
}
/** A refusal, and how it is answered: 400 (the player is told why), 401 (the token opens nothing:
 *  the browser asks for an account again), 429 (too soon: the browser keeps it and tries later).
 *  `need`: what the browser can bring to try again - `identity`, Privy's identity token for its login. */
class Refusal extends Error { constructor(message: string, readonly status: 400 | 401 | 429 = 400, readonly need?: 'identity') { super(message); } }
const refuse = (message: string, status: 400 | 401 | 429 = 400, need?: 'identity'): never => { throw new Refusal(message, status, need); };

/** Codes one account, or one address, may get wrong in an hour before it waits. */
const CODE_MISSES = 10;
/** A date as a refusal says it: 7 November 2026. */
const day = (ms: number) => new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/** Seconds a player must leave between two results (a match is longer than this). */

/** New guest accounts one address may open in an hour. */
const NEW_PER_HOUR = 30;
/** Accounts one address may delete in an hour (DELETE ACCOUNT). */
const DELETES_PER_HOUR = 5;
/** Seconds between two writes of the whole book (the ledger holds everything in between). */
const SAVE_EVERY = 20;

export class Economy {
  readonly book: Book;
  readonly privy: PrivyVerifier;
  /** Sign-in with Player Two, whose player frames the copy it hosts (playertwo.ts). */
  readonly p2: PlayerTwoVerifier;
  /** Feats given as Player Two trophies, to accounts kept under a Player Two login (playertwoTrophies.ts). */
  readonly trophies: PlayerTwoTrophies;
  private readonly now: () => number;
  private readonly opened = new Map<string, number[]>();
  /** Matches played on players' devices, paid within their caps (deviceReports.ts). */
  private devices?: DeviceReports;
  private readonly codes: readonly CodeDef[];
  /** Codes got wrong lately, by account and by address. */
  private readonly misses = new Map<string, number[]>();
  /** Accounts deleted lately, by address. */
  private readonly deletes = new Map<string, number[]>();
  private readonly timer?: ReturnType<typeof setInterval>;
  readonly forge: ForgeStore;
  /** Arcade progress and the career kept with accounts (src/server/progress/ProgressStore.ts), in files of their own beside the book. */
  readonly progress: ProgressStore;

  constructor(private readonly options: EconomyOptions = {}) {
    this.now = options.now ?? Date.now;
    let dir = options.dir === false ? undefined : options.dir ?? path.join(os.tmpdir(), 'jump-economy');
    // A folder that cannot be written (no volume, the wrong owner) must not take the match server
    // down with it: the book is kept in memory, and the log says so loudly.
    let book: Book;
    try { book = new Book(dir); } catch (error) { console.error(`[economy] THE BOOK CANNOT BE KEPT in ${dir}: accounts will not outlive this process.`, error); dir = undefined; book = new Book(undefined); }
    this.book = book; this.kept = dir;
    this.forge = new ForgeStore(dir, this.now);
    this.progress = new ProgressStore(dir, this.now);
    this.book.onRetire = (gone, into) => this.progress.fold(gone, into);
    this.book.onForget = pk => this.progress.forget(pk);
    this.privy = new PrivyVerifier(options.privyAppId ?? '', options.fetcher);
    this.p2 = new PlayerTwoVerifier({ game: process.env.P2_GAME, keys: process.env.P2_KEYS, now: this.now, ...options.playerTwo });
    this.trophies = new PlayerTwoTrophies({ key: process.env.P2_GAME_KEY, site: process.env.P2_SITE, dir, now: this.now, ...options.trophies });
    this.codes = options.codes ?? [...envCodes(), ...CODES];
    if (!options.codes && normalCode(process.env.ALL_ACCESS_CODE) && !envCodes().length)
      console.warn(`[economy] ALL_ACCESS_CODE is shorter than ${ALL_ACCESS_MIN} characters: the all-access code is off.`);
    if (dir) this.refundPriceDrops(dir);
    if (dir) { this.timer = setInterval(() => this.save(), SAVE_EVERY * 1000); this.timer.unref?.(); }
    console.log(`[economy] ${this.book.accounts.size} account(s)${dir ? ` in ${dir}` : ' (memory only)'}; sign-in ${this.privy.enabled ? 'on' : 'off'}; all-access code ${this.codes.some(each => each.grants.allAccess) ? 'on' : 'off'}`);
  }
  /** Where the book is kept, if it is. */
  readonly kept?: string;
  /** The shop's price drops (8 October 2026, src/game/economy/refunds.ts, the shop stream's; 28 October 2026, the
   *  fighters halved): what each account paid above today's price, less what it was paid back before - worked out from
   *  this ledger's own purchase and refund lines, each paid as a line of its own. The account's own tally (`refunded`)
   *  must not be ahead of the ledger's: where it is, nothing is paid (the two disagree, and paying twice is worse). */
  private refundPriceDrops(dir: string) {
    const lines = fs.readdirSync(dir).filter(name => /^ledger.*\.jsonl$/.test(name)).flatMap(name => fs.readFileSync(path.join(dir, name), 'utf8').split('\n')
      .filter(refundRelevant).flatMap(raw => { try { return [JSON.parse(raw) as LedgerLine]; } catch { return []; } }));
    for (const due of refundsDue(lines)) {
      const account = this.book.accounts.get(due.pk);
      if (!account || (account.refunded?.[due.item] ?? 0) > due.before) continue;
      const next = structuredClone(account); credit(next, due.amount); next.refunded = { ...next.refunded, [due.item]: (next.refunded?.[due.item] ?? 0) + due.amount };
      try { this.book.record('grant', next, { amount: due.amount, why: refundWhy(due.item) }); this.book.accounts.set(due.pk, next); }
      catch (error) { console.error('[economy] a refund could not be written; it is paid at the next start', error); return; }
    }
  }
  /** The book written, if it has changed (a disk that refuses is logged, not thrown: this runs on a timer). */
  save() { try { this.book.save(); } catch (error) { console.error('[economy] the book could not be written', error); } }
  close() { if (this.timer) clearInterval(this.timer); this.trophies.close(); try { this.book.close(); } catch (error) { console.error('[economy] the book could not be closed', error); } }
  /** An account's feats offered to Player Two as trophies, for each Player Two login it is kept under (queued: this
   *  returns at once, and settlement never waits on Player Two). */
  private trophiesFor(account: Account) {
    if (!this.trophies.enabled || !account.feats.length) return;
    for (const login of this.book.loginsOf(account.pk)) { const player = p2Of(login); if (player) this.trophies.offer(player, account.feats); }
  }

  /** What every answer carries: the account, whether it is kept under a login (worked out, never stored: no login's
   *  email or handle is kept since 8 October 2026), the copies sold of what is counted, and what this server offers. */
  private answer(account: Account, more: Record<string, unknown> = {}) {
    return { account, signedIn: this.book.hasLogin(account.pk), sold: Object.fromEntries(this.book.sold), config: { privy: this.privy.enabled ? this.privy.appId : undefined, pay: PAY_OFF }, ...more };
  }
  private open(token: unknown): Account {
    const account = this.book.find(token) ?? refuse('That account is not known here. Reload the game.', 401);
    roll(account, this.now());
    return account;
  }

  /** The account a browser's token opens - or, with none (or one not known), a new guest account and its token. */
  hello(token: unknown, address = '') {
    const known = this.book.find(token);
    if (known) { roll(known, this.now()); return this.answer(known); }
    const hour = this.now() - 3600_000, recent = (this.opened.get(address) ?? []).filter(at => at > hour);
    if (recent.length >= NEW_PER_HOUR) refuse('Too many new accounts from here. Try again in an hour.', 429);
    this.opened.set(address, [...recent, this.now()]);
    const made = this.book.create(this.now());
    roll(made.account, this.now());
    return this.answer(made.account, { token: made.token });
  }

  report(token: unknown, report: Report) {
    const account = this.open(token);
    if (typeof report?.id !== 'string') refuse('A completed server match is required.');
    if (isDeviceId(report.id)) {
      if (!this.kept && this.options.dir !== false) refuse('Results cannot be kept just now.', 429);
      const paid = (this.devices ??= new DeviceReports(this.book)).settle(account, report, this.now());
      if ('refused' in paid) return refuse(paid.refused, paid.status);
      this.trophiesFor(paid.account);
      return this.answer(paid.account, { settlement: paid.completion.settlement });
    }
    const completion = this.book.completions.get(`${report.id}:${account.pk}`);
    if (!completion) refuse('No completed server match was found for this account.');
    return this.answer(account, { settlement: completion!.settlement });
  }

  /** Called by authoritative room lifecycle code only. Account and receipt share
   * one synced ledger entry, so a retry or restart returns the original payment. */
  complete(pk: string, report: Report) {
    if (!this.kept && this.options.dir !== false) throw new Error('Verified rewards require a writable economy ledger.');
    const key = `${report.id}:${pk}`, known = this.book.completions.get(key);
    if (known) return known;
    const current = this.book.accounts.get(pk); if (!current) return undefined;
    const next = structuredClone(current), now = this.now();
    const settlement = settle(next, report, now, true);
    if (settlement.refused) throw new Error(settlement.refused);
    const completion = { matchId: report.id, pk, completedAt: now, report: structuredClone(report), settlement };
    this.book.record('earn', next, { amount: settlement.total, why: `verified:${report.mode}:${report.id}`, completion });
    this.book.accounts.set(pk, next); this.book.completions.set(key, completion);
    this.trophiesFor(next);
    return completion;
  }

  buy(token: unknown, id: unknown) {
    const account = this.open(token), item = String(id ?? '');
    // A set: what is still to buy of it, at the set's price (catalog.ts BUNDLES).
    if (isBundle(item)) {
      const result = buyBundle(account, item, this.now());
      if ('refused' in result) return refuse(result.refused);
      this.book.record('buy', account, { item, amount: -result.price, why: result.owned.join(',') });
      return this.answer(account, { bought: item, items: result.owned });
    }
    const result = buy(account, item, this.book.sold.get(item) ?? 0, this.now());
    if ('refused' in result) return refuse(result.refused);
    if (result.owned.serial) this.book.sold.set(item, result.owned.serial);
    this.book.record('buy', account, { item, amount: -result.price, serial: result.owned.serial });
    return this.answer(account, { bought: item });
  }

  wear(token: unknown, kind: unknown, id: unknown) {
    const account = this.open(token);
    if (typeof kind !== 'string' || !(kind in KINDS)) refuse('That is not a kind of item.');
    const result = wear(account, kind as ItemKind, typeof id === 'string' && id ? id : undefined);
    if ('refused' in result) return refuse(result.refused);
    this.book.record('wear', account);
    return this.answer(account);
  }

  /** Signed in with Privy: the login's own account if it has one (a guest's pay and items folded into it),
   *  or this guest account, kept under the login from now on. Answers with a session token for this device.
   *  Only Privy's id for the login is kept: a label a page sends (pages from before 8 October 2026 send its email or
   *  handle) is not read. */
  async signIn(token: unknown, access: unknown) {
    const did = await this.privy.verify(String(access ?? '')).catch((error: Error) => refuse(error.message));
    const guest = this.book.find(token), known = this.book.byLogin(did);
    let account = known ?? guest ?? this.book.create(this.now()).account;
    // (Only a guest is folded in: an account kept under another login keeps its own name and codes.)
    if (known && guest && guest !== known && !this.book.hasLogin(guest.pk)) { merge(known, guest); this.book.retire(guest, known); account = known; this.trophiesFor(account); }
    roll(account, this.now());
    const session = this.book.link(account, did);
    return this.answer(account, { token: session });
  }
  async signInPlayerTwo(token: unknown, identity: unknown) {
    const player = await this.p2.verify(String(identity ?? '')).catch((error: Error) => refuse(error.message));
    // A guest, playing from the game's card on X: no Player Two account, so nothing is kept under a login (no trophies,
    // no `p2:` login). The browser keeps its own account, a guest's as anywhere else (or a new one); when the guest signs
    // in on Player Two later, the game's storage the card kept (this browser's token in it) comes along to the account
    // they sign in with, and the guest's account folds in there as any guest's does.
    if (player.kind === 'guest') {
      const own = this.book.find(token);
      if (own) { roll(own, this.now()); return this.answer(own, { guest: true }); }
      const made = this.book.create(this.now());
      roll(made.account, this.now());
      return this.answer(made.account, { token: made.token, guest: true });
    }
    const login = p2Login(player.id), presented = this.book.find(token), known = this.book.byLogin(login);
    if (known && presented === known) { roll(known, this.now()); return this.answer(known); }
    const guest = presented && !this.book.hasLogin(presented.pk) ? presented : undefined;
    let account = known ?? guest ?? this.book.create(this.now()).account;
    if (known && guest) { merge(known, guest); this.book.retire(guest, known); account = known; }
    roll(account, this.now());
    const session = this.book.link(account, login);
    // (Linked: the feats the account holds already become the player's trophies, once.)
    this.trophiesFor(account);
    return this.answer(account, { token: session });
  }
  /** Signed out on this device: the session opens nothing now, and a fresh guest account takes its place. */
  signOut(token: unknown, address = '') {
    if (typeof token === 'string') this.book.revoke(token);
    return this.hello(undefined, address);
  }
  deleteAccount(token: unknown, confirm: unknown, address = '') {
    if (confirm !== 'DELETE') refuse('Confirm the deletion first: it cannot be undone.');
    const hour = this.now() - 3600_000, recent = (this.deletes.get(address) ?? []).filter(at => at > hour);
    if (recent.length >= DELETES_PER_HOUR) refuse('Too many deletions from here. Try again in an hour.', 429);
    this.deletes.set(address, [...recent, this.now()]);
    const account = this.book.find(token);
    if (account) {
      const lines = this.book.forget(account.pk);
      this.misses.delete(`pk:${account.pk}`);
      console.log(`[economy] an account was deleted at its owner's word (${lines} ledger line(s) removed)`);
    }
    // (A fresh guest for this device; if none may be opened just now, the page opens one later, as it does on a first visit.)
    try { return { deleted: true, ...this.hello(undefined, address) }; }
    catch (error) { if (error instanceof Refusal) return { deleted: true }; throw error; }
  }

  /** A code typed in ACCOUNT (codes.ts), for this account: what it grants, granted once, in one ledger line. A code
   *  bound to an email asks for Privy's identity token of this account's own login, and that login's verified email
   *  must be the code's (`need: 'identity'` asks the browser for it). */
  async redeem(token: unknown, code: unknown, identity: unknown, address = '') {
    const account = this.open(token), typed = normalCode(code);
    if (!typed) refuse('Type a code first.');
    const signedIn = this.book.hasLogin(account.pk), guestCode = (each: CodeDef) => !!each.guests && each.hash === codeHash(typed);
    if (!signedIn && !(typed.length <= 64 && this.codes.some(guestCode))) refuse('Sign in first: a code is kept with your login, not with this browser.');
    const hour = this.now() - 3600_000, keys = [`pk:${account.pk}`, `at:${address}`];
    const recent = (key: string) => (this.misses.get(key) ?? []).filter(at => at > hour);
    if (keys.some(key => recent(key).length >= CODE_MISSES)) refuse('Too many codes tried. Try again in an hour.', 429);
    const def = typed.length <= 64 ? this.codes.find(each => each.hash === codeHash(typed)) : undefined;
    if (!def) { for (const key of keys) this.misses.set(key, [...recent(key), this.now()]); return refuse('That code is not known. Check its spelling.'); }
    if (account.redeemed?.[def.id]) refuse('You have already redeemed that code.');
    if (def.limit !== undefined && this.book.redemptions(def.id) >= def.limit) refuse('That code has been used up.');
    if (def.email) {
      if (typeof identity !== 'string' || !identity) refuse('This code checks who you are signed in as. Confirm your sign-in.', 400, 'identity');
      const login = await this.privy.identity(identity as string).catch((error: Error) => refuse(error.message));
      if (this.book.byLogin(login.did)?.pk !== account.pk) refuse('That sign-in is not this account\'s. Sign out, sign in again and try once more.');
      if (!login.emails.includes(def.email.toLowerCase())) refuse('That code belongs to another account.');
    }
    // (After the wait for Privy's keys: the account as it stands now, checked again, then changed in one synced line.)
    const current = this.book.accounts.get(account.pk) ?? refuse('That account is not known here. Reload the game.', 401);
    if (current.redeemed?.[def.id]) refuse('You have already redeemed that code.');
    const next = structuredClone(current), now = this.now(), grants = def.grants, items: string[] = [];
    if (grants.allAccess) next.allAccess = true;
    for (const id of grants.items ?? []) if (ITEM.has(id) && !next.items[id]) { next.items[id] = { at: now }; items.push(id); }
    if (grants.sumi) credit(next, grants.sumi);
    next.redeemed = { ...next.redeemed, [def.id]: now };
    this.book.record('redeem', next, { code: def.id, amount: grants.sumi || undefined, why: items.join(',') || undefined });
    this.book.accounts.set(next.pk, next);
    return this.answer(next, { redeemed: { says: def.says, allAccess: !!grants.allAccess, items, sumi: grants.sumi ?? 0 } });
  }

  progressSync(token: unknown, body: Record<string, unknown>) {
    const account = this.open(token);
    // (As results are: a server whose book cannot be kept takes nothing a restart would lose. The page keeps its copy.)
    if (!this.kept && this.options.dir !== false) refuse('Progress cannot be kept just now.', 429);
    return this.progress.sync(account.pk, account.created, body);
  }

  /** A forged fighter kept on a signed-in account (VOL.6): checked whole, a hash to share it by. */
  async forgeSave(token: unknown, code: unknown) {
    const account = this.open(token);
    if (!this.book.hasLogin(account.pk)) refuse('Sign in to keep a forged fighter: it is kept with your login.');
    return { kept: this.forged(() => this.forge.save(account.pk, code)) };
  }
  /** The account's kept forged fighters, newest first (none for a guest). */
  forgeMine(token: unknown) { const account = this.open(token); return { kept: this.forge.mine(account.pk).map(({ owner: _owner, ...kit }) => kit) }; }
  /** One kept forged fighter by its hash, anyone's: what a share link opens. */
  forgeGet(hash: unknown) { return { kit: this.forge.get(hash) ?? refuse('There is no forged fighter at that link (it may have been removed).') }; }
  forgeRemove(token: unknown, hash: unknown) {
    const account = this.open(token);
    this.forged(() => this.forge.remove(account.pk, hash));
    return this.forgeMine(token);
  }
  /** The store's refusals, in the economy's own (a 400 with words a player can read). */
  private forged<T>(work: () => T): T { try { return work(); } catch (error) { if (error instanceof ForgeRefusal) refuse(error.message); throw error; } }

  /** A username claimed, or changed (names.ts): a signed-in account's, unique whatever its case, not reserved or
   *  blocked, and changed at most once in NAME_EVERY_DAYS (a change of case only is free). */
  claimName(token: unknown, raw: unknown) {
    const account = this.open(token), name = typeof raw === 'string' ? raw.trim() : '';
    if (!this.book.hasLogin(account.pk)) refuse('Sign in to claim a username.');
    const problem = nameProblem(name);
    if (problem) refuse(problem);
    if (blockedName(name)) refuse('That username is not allowed.');
    if (account.name === name) refuse('That is already your username.');
    const holder = this.book.nameHolder(name);
    if (holder && holder !== account.pk) refuse('That username is taken.');
    const caseOnly = !!account.name && nameKey(account.name) === nameKey(name), freeAt = nameFreeAt(account);
    if (!caseOnly && freeAt > this.now()) refuse(`You can change your username again on ${day(freeAt)}.`);
    const next = structuredClone(account), before = account.name;
    next.name = name;
    if (!caseOnly) next.nameAt = this.now();
    this.book.record('name', next, { why: before ? `was ${before}` : undefined });
    this.book.accounts.set(next.pk, next); this.book.keepName(next, before);
    return this.answer(next);
  }

  grant(bearer: unknown, pk: unknown, amount: unknown, item: unknown) {
    if (!this.options.adminToken || bearer !== `Bearer ${this.options.adminToken}`) refuse('Not allowed.');
    const account = this.book.accounts.get(String(pk ?? '')) ?? refuse('No such account.');
    const n = Math.floor(Number(amount) || 0), id = typeof item === 'string' ? item : undefined;
    if (n) credit(account, n);
    if (id) { if (!ITEM.has(id)) refuse('There is no such item.'); account.items[id] ??= { at: this.now() }; }
    this.book.record('grant', account, { amount: n || undefined, item: id, why: 'admin' });
    return this.answer(account);
  }
}

// ---- over HTTP ---------------------------------------------------------------------------------
interface Req { method?: string; headers: Record<string, string | string[] | undefined>; body?: unknown; socket?: { remoteAddress?: string }; on(event: string, listener: (chunk?: Buffer) => void): unknown }
interface Res { statusCode: number; setHeader(name: string, value: string): unknown; removeHeader?(name: string): unknown; end(body?: string): unknown }
interface App { use(path: string, handler: (req: Req, res: Res, next: () => void) => void): unknown; post(path: string, handler: (req: Req, res: Res) => void): unknown }

/** Origins the API answers: a developer's machine, and every origin named in ECONOMY_ORIGINS (comma-separated, exact:
 *  `https://game.example.com,https://other.example.com`), which a deployment sets to the site that serves the game. */
const ORIGINS = [/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/];
const allowed = (origin: string, extra: readonly string[]) => ORIGINS.some(each => each.test(origin)) || extra.includes(origin);
/** (The pages' error reports answer the same origins: src/server/ops/errorReports.ts.) */
export { allowed as allowedOrigin };

async function bodyOf(req: Req, limit = 16384): Promise<Record<string, unknown>> {
  if (req.body && typeof req.body === 'object') return req.body as Record<string, unknown>;
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []; let size = 0;
    req.on('data', chunk => { if (!chunk) return; size += chunk.length; if (size > limit) reject(new Refusal('That is too much to send.')); else chunks.push(chunk); });
    req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown> : {}); } catch { reject(new Refusal('That was not JSON.')); } });
    req.on('error', () => reject(new Refusal('The request broke off.')));
  });
}

let shared: Economy | undefined;
export const sharedEconomy = (): RoomEconomy | undefined => shared ?? remoteEconomy();

export function roomName(token: unknown, typed: unknown, max = 20): string {
  const remote = shared ? undefined : remoteEconomy();
  if (remote) {
    // A room process: control worked the name out against the book when the seat was reserved (economyLink.ts).
    const known = remote.book.find(token)?.name;
    if (known) return known;
    const name = displayName(typed, max);
    return name === NAME_FALLBACK ? name : remote.name(token, typed, max) ?? NAME_FALLBACK;
  }
  const book = shared?.book, account = book?.find(token);
  if (account?.name) return account.name;
  const name = displayName(typed, max);
  if (name === NAME_FALLBACK || !book) return name;
  return heldKeys(name).some(key => { const holder = book.nameHolder(key); return holder && holder !== account?.pk; }) ? NAME_FALLBACK : name;
}

/** The economy on the match server's HTTP app. */
export function mountEconomy(app: App, options: EconomyOptions = {}): Economy {
  const economy = shared = new Economy(options);
  const extra = (process.env.ECONOMY_ORIGINS ?? '').split(',').map(each => each.trim()).filter(Boolean);
  app.use('/api/economy', (req, res, next) => {
    // (The match server's own transport answers every origin before this runs: what it set is taken
    // back, and only the game's origins are let in. No cookie is involved - a token travels in the body.)
    const origin = String(req.headers.origin ?? '');
    for (const header of ['Access-Control-Allow-Origin', 'Access-Control-Allow-Credentials']) res.removeHeader?.(header);
    res.setHeader('Vary', 'Origin');
    if (origin && allowed(origin, extra)) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Access-Control-Allow-Headers', 'content-type, authorization'); res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS'); res.setHeader('Access-Control-Max-Age', '86400'); }
    if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }
    next();
  });
  /** `limit`: the most a body may hold, bytes (16 KB; a browser's progress, imported whole, may need more). */
  const route = (name: string, run: (body: Record<string, unknown>, req: Req, address: string) => unknown, limit?: number) => app.post(`/api/economy/${name}`, (req, res) => {
    const address = String(req.headers['x-forwarded-for'] ?? req.socket?.remoteAddress ?? '').split(',')[0].trim();
    res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store');
    void bodyOf(req, limit).then(body => run(body, req, address)).then(answer => { res.statusCode = 200; res.end(JSON.stringify(answer)); })
      .catch((error: unknown) => {
        if (!(error instanceof Refusal)) console.error(`[economy] ${name} failed`, error);
        res.statusCode = error instanceof Refusal ? error.status : 500;
        res.end(JSON.stringify(error instanceof Refusal ? { error: error.message, ...(error.need ? { need: error.need } : {}) } : { error: 'Something went wrong on the server.' }));
      });
  });
  route('hello', (body, _req, address) => economy.hello(body.token, address));
  // (A page from before some ids were renamed still sends them: read as they are now, src/game/savedIds.ts.)
  route('report', body => economy.report(body.token, currentSaved(body.report) as Report));
  route('buy', body => economy.buy(body.token, currentId(body.item)));
  route('wear', body => economy.wear(body.token, body.kind, currentId(body.item)));
  route('signin', body => economy.signIn(body.token, body.access));
  route('p2-signin', body => economy.signInPlayerTwo(body.token, body.identity));
  route('signout', (body, _req, address) => economy.signOut(body.token, address));
  route('delete', (body, _req, address) => economy.deleteAccount(body.token, body.confirm, address));
  route('grant', (body, req) => economy.grant(req.headers.authorization, body.pk, body.amount, currentId(body.item)));
  route('redeem', (body, _req, address) => economy.redeem(body.token, body.code, body.identity, address));
  route('name', body => economy.claimName(body.token, body.name));
  // Forged fighters kept on the account (VOL.6): signed-in to keep, anyone to open a share link.
  route('forge-save', body => economy.forgeSave(body.token, body.code));
  route('forge-mine', body => economy.forgeMine(body.token));
  route('forge-get', body => economy.forgeGet(body.hash));
  route('forge-remove', body => economy.forgeRemove(body.token, body.hash));
  // Arcade progress and the career, kept with the account (src/server/progress/ProgressStore.ts).
  route('progress', body => economy.progressSync(body.token, { ...body, ...(body.import ? { import: currentSaved(body.import) } : {}), ...(body.reports ? { reports: currentSaved(body.reports) } : {}) }), 64 * 1024);
  // The book is written as the server goes down: on the way out (the match server's own shutdown
  // ends the process), and at the signal itself in case nothing else answers it.
  for (const signal of ['SIGTERM', 'SIGINT'] as const) process.once(signal, () => { economy.save(); });
  process.once('exit', () => { economy.close(); });
  return economy;
}
