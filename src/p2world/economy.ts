/* Impact's economy in its PlayerTwo world: the routes the match server's economy answers (src/server/economy/api.ts Economy), the same rules (src/game/economy, the progress rules, the Forge's
 * checks), over the world's store (book.ts) instead of files. Each method is api.ts's own, line for line where it
 * can be, with three differences that come from where it runs:
 *
 * - Who is asking comes from the seat: PlayerTwo's id for the player (room.players[i].id, trusted, the same `sub` its
 *   signed identity carried) and their kind. A PlayerTwo player's account is the one kept under their login (p2:<id>),
 *   whatever token the page sends; a token is used for a guest's account, as before, and never opens an account kept
 *   under another PlayerTwo player's login (a browser two players share). `p2-signin` takes the seat as its identity:
 *   no JWT, no fetch of PlayerTwo's keys.
 * - No network: Privy can't be asked (its sign-in and the codes bound to an email are refused here), trophies go out
 *   through room.trophy (PlayerTwo carries them), and the operator's grants come as notes signed with P2ROOM_KEY.
 * - Every change is made after the call's last await, so its writes are one (kv.ts).
 *
 * Answers are api.ts's own: { status, body }, the body what the HTTP route answers (a 400 { error } in words a player
 * can read, 401 for a token that opens nothing, 429 for too soon), so the page's clients read them unchanged. */
import { buy, buyBundle, credit, merge, roll, settle, wear, type Account } from '../game/economy/account';
import { ITEM, KINDS, isBundle, type ItemKind } from '../game/economy/catalog';
import { plausible, type Report } from '../game/economy/earn';
import { DEVICE_MODES, isDeviceId } from '../game/economy/device';
import { nameFreeAt, nameKey, nameProblem } from '../game/economy/names';
import { NAME_FALLBACK } from '../game/displayName';
import { currentId, currentSaved } from '../game/savedIds';
import { sha256 } from '../engine/sim/hash';
import { PROGRESS_LIMITS, anything, applyReport, cleanCareer, cleanRift, creditRoomMatch, emptyState, fold, forward, plausibleFacts, plausibleMatch, readReport, type ProgressState, type SyncAnswer, type SyncBody } from '../game/progress/rules';
import { decodeForge, forgeProblems, type ForgeKit } from '../engine/sim/forge';
import { shortForgeHash } from '../engine/sim/forgedKits';
import { RANKED, RANKED_MODES, freshRating, intoSeason, isRankedMode, seasonOf, tierOf, type RankedAnswer, type RankedBoard, type RankedBoardRow, type RankedMode, type Rating } from '../game/ball/ranked';
import type { FighterId } from '../game/types';
import { blockedName } from '../server/economy/names';
import { displayName, heldKeys, refusedName } from '../server/displayName';
import { ALL_ACCESS_MIN, CODES, normalCode, type CodeDef } from '../server/economy/codes';
import type { Completion } from '../server/economy/completions';
import { DEVICE_LIMITS } from '../server/economy/deviceReports';
import { PASS_MS, seal, unseal, type Done, type PassAccount, type RankNote, type RivalNote } from '../server/economy/p2roomSigned';
import { K, StoreBook } from './book';
import { dropAll, type KV } from './kv';

/** A seat in the world: PlayerTwo's id for the player and their kind (room.players[i]: trusted, PlayerTwo set it). */
export interface Seat { id: string; kind?: string }
export interface Answer { status: number; body: unknown }

export const p2Login = (id: string) => `p2:${id}`;
export const p2Of = (login: string) => /^p2:([A-Za-z0-9_-]{16,64})$/.exec(login)?.[1];
/** A seat of a player with a PlayerTwo account (full, demo or test): their login is theirs. A guest's is not kept. */
export const hasP2Account = (seat: Seat | undefined): seat is Seat => !!seat && typeof seat.id === 'string' && seat.kind !== 'guest' && !!p2Of(p2Login(seat.id));

class Refusal extends Error { constructor(message: string, readonly status: 400 | 401 | 429 | 503 = 400, readonly need?: 'identity') { super(message); } }
const refuse = (message: string, status: 400 | 401 | 429 | 503 = 400, need?: 'identity'): never => { throw new Refusal(message, status, need); };

const PAY_OFF = 'off' as const;
const CODE_MISSES = 10, NEW_PER_HOUR = 30, DELETES_PER_HOUR = 5;
/** The names roomName gives a typed name, by length (economyLink NAME_SIZES). */
export const NAME_SIZES = [18, 20] as const;
const day = (ms: number) => new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
/** A code's hash, as codes.ts makes it (SHA-256 of its words, hex), with no node:crypto. */
export const codeHashOf = (code: unknown) => sha256(`jump-code:${normalCode(code)}`);

/** The world's switches (cfg), set by the operator's signed notes: open (pages are answered: false until the import is
 *  checked), rooms (matches on PlayerTwo's rooms: P2ROOMS' twin), and the codes it knows (hashes only). */
export interface WorldConfig { open?: boolean; rooms?: boolean; codes?: CodeDef[]; run?: string; at?: number }

/** What a route is answered with when the world isn't open yet: the page asks the match server instead (p2Economy.ts). */
export const NOT_OPEN = 'not-open';
/** The world's switches' key (under ~: the world's own, never imported or digested). */
export const CFG = '~cfg';

export interface WorldEconomyOptions {
  /** P2ROOM_KEY (built into the bundle). */
  key: string;
  now?: () => number;
  /** A trophy for a PlayerTwo player (room.trophy). */
  trophy?: (player: string, feat: string) => void;
  /** Where a failure is told (room.log: the sandbox's console doesn't reach PlayerTwo's logs; room.log comes out there as
   *  "[room.js impact <build>] ..."). */
  log?: (...args: unknown[]) => void;
}

export class WorldEconomy {
  readonly book: StoreBook;
  private readonly now: () => number;
  private readonly key: string;
  private readonly trophy?: (player: string, feat: string) => void;
  /* (in memory, as the match server keeps them: they start again with the code) */
  private readonly opened = new Map<string, number[]>();
  private readonly misses = new Map<string, number[]>();
  private readonly deletes = new Map<string, number[]>();
  private readonly forgeSaves = new Map<string, number[]>();

  private readonly log: (...args: unknown[]) => void;
  constructor(readonly kv: KV, options: WorldEconomyOptions) {
    this.now = options.now ?? Date.now;
    this.key = options.key;
    this.trophy = options.trophy;
    this.log = options.log ?? ((...a: unknown[]) => console.error(...a));
    this.book = new StoreBook(kv, this.now);
    this.book.onRetire = (gone, into) => this.foldProgress(gone, into);
    this.book.onForget = pk => { this.kv.delete(K.progress(pk)); dropAll(this.kv, `fo/${pk}/`); this.offBoards(pk); };
  }
  config(): WorldConfig { return this.kv.get<WorldConfig>(CFG) ?? {}; }
  private codes(): readonly CodeDef[] { return [...(this.config().codes ?? []), ...CODES]; }

  private answer(account: Account, more: Record<string, unknown> = {}) {
    return { account, signedIn: this.book.hasLogin(account.pk), sold: this.book.sold(), config: { privy: undefined, pay: PAY_OFF }, ...more };
  }
  /** The account this seat opens with this token: a PlayerTwo player's own (kept under their login), or the token's,
   *  unless the token's account is kept under another PlayerTwo player's login. */
  resolve(seat: Seat | undefined, token: unknown): Account | undefined {
    if (hasP2Account(seat)) { const own = this.book.byLogin(p2Login(seat.id)); if (own) return own; }
    const account = this.book.find(token);
    if (!account) return undefined;
    const players = this.book.loginsOf(account.pk).map(p2Of).filter(Boolean);
    if (players.length && !(seat && players.includes(seat.id))) return undefined;
    return account;
  }
  private open(seat: Seat | undefined, token: unknown): Account {
    const account = this.resolve(seat, token) ?? refuse('That account is not known here. Reload the game.', 401);
    roll(account, this.now());
    return account;
  }
  private trophiesFor(account: Account) {
    if (!this.trophy || !account.feats.length) return;
    for (const login of this.book.loginsOf(account.pk)) {
      const player = p2Of(login); if (!player) continue;
      const key = `tr/${player}`, given = new Set(this.kv.get<string[]>(key) ?? []), more = account.feats.filter(feat => /^[a-z0-9-]{1,40}$/.test(feat) && !given.has(feat));
      if (!more.length) continue;
      for (const feat of more) { this.trophy(player, feat); given.add(feat); }
      this.kv.set(key, [...given]);
    }
  }
  private recent(map: Map<string, number[]>, key: string, within = 3600_000) { const from = this.now() - within; return (map.get(key) ?? []).filter(at => at > from); }

  hello(seat: Seat | undefined, token: unknown) {
    const known = this.resolve(seat, token);
    if (known) { roll(known, this.now()); return this.answer(known); }
    const address = seat?.id ?? '', recent = this.recent(this.opened, address);
    if (recent.length >= NEW_PER_HOUR) refuse('Too many new accounts from here. Try again in an hour.', 429);
    this.opened.set(address, [...recent, this.now()]);
    const made = this.book.create(this.now());
    roll(made.account, this.now());
    return this.answer(made.account, { token: made.token });
  }

  report(seat: Seat | undefined, token: unknown, report: Report) {
    const account = this.open(seat, token);
    if (typeof report?.id !== 'string') refuse('A completed server match is required.');
    if (isDeviceId(report.id)) {
      const paid = this.deviceSettle(account, report, this.now());
      if ('refused' in paid) return refuse(paid.refused, paid.status);
      this.trophiesFor(paid.account);
      return this.answer(paid.account, { settlement: paid.completion.settlement });
    }
    const completion = this.book.completion(`${report.id}:${account.pk}`);
    if (!completion) refuse('No completed server match was found for this account.');
    return this.answer(account, { settlement: completion!.settlement });
  }
  /** deviceReports.ts DeviceReports.settle, its times kept under dt/<pk>. */
  private deviceSettle(account: Account, raw: Report, now: number): { completion: Completion; account: Account } | { refused: string; status: 400 | 429 } {
    const key = `${raw.id}:${account.pk}`, known = this.book.completion(key);
    if (known) return { completion: known, account };
    const checked = plausible(raw, false);
    if ('refused' in checked) return { refused: checked.refused, status: 400 };
    if (!DEVICE_MODES.includes(checked.report.mode)) return { refused: 'That match is not played on a device.', status: 400 };
    const { friends: _friends, couch, ...told } = checked.report, company = couch ? { friends: true, couch: true } : {};
    const report: Report = told.mode === 'survival' ? { ...told, coop: false, revives: 0, ...company } : { ...told, practice: true, ...company };
    const times = this.kv.get<number[]>(K.device(account.pk)) ?? [], hour = now - 3600_000;
    if (times.filter(at => at > hour).length >= DEVICE_LIMITS.perHour) return { refused: `That is more than ${DEVICE_LIMITS.perHour} matches on this device in an hour.`, status: 429 };
    const last = times.length ? times[times.length - 1] : undefined, since = last ?? (Number.isFinite(account.created) ? account.created : now);
    const allowed = Math.max(0, now - since) / 1000 * DEVICE_LIMITS.slack + (last === undefined ? DEVICE_LIMITS.first : 0);
    if (report.seconds > allowed) return { refused: 'That result is too long for the time since your last one.', status: 429 };
    const next = structuredClone(account), settlement = settle(next, report, now, false, 0);
    if (settlement.refused) return { refused: settlement.refused, status: 400 };
    const completion: Completion = { matchId: report.id, pk: account.pk, completedAt: now, report, settlement };
    this.book.record('earn', next, { amount: settlement.total, why: `device:${report.mode}:${report.id}`, completion });
    this.book.keepCompletion(completion);
    this.kv.set(K.device(account.pk), [...times.filter(at => at > hour), now]);
    return { completion, account: next };
  }

  /** A match's completion (RoomRewards, carried signed from a PlayerTwo room by the player's page): once per match and
   *  account, as Economy.complete. */
  complete(pk: string, report: Report): Completion | undefined {
    const key = `${report.id}:${pk}`, known = this.book.completion(key);
    if (known) return known;
    const current = this.book.account(pk); if (!current) return undefined;
    const next = structuredClone(current), now = this.now();
    const settlement = settle(next, report, now, true);
    if (settlement.refused) throw new Error(settlement.refused);
    const completion: Completion = { matchId: report.id, pk, completedAt: now, report: structuredClone(report), settlement };
    this.book.record('earn', next, { amount: settlement.total, why: `verified:${report.mode}:${report.id}`, completion });
    this.book.keepCompletion(completion);
    this.trophiesFor(next);
    this.roomMastery(pk, next.created, report);
    return completion;
  }
  /** A room's match paid into its fighter's mastery (progress rules.ts creditRoomMatch: what the room saw), with its
   *  completion and as once as it: the account's progress (p/<pk>) written beside the book. */
  private roomMastery(pk: string, created: number, report: Report) {
    const had = this.readProgress(pk), kept = had ? structuredClone(had) : freshProgress(pk, Number.isFinite(created) ? created : this.now());
    if (creditRoomMatch(kept.state, report)) this.writeProgress(kept);
  }

  buy(seat: Seat | undefined, token: unknown, id: unknown) {
    const account = this.open(seat, token), item = String(id ?? '');
    if (isBundle(item)) {
      const result = buyBundle(account, item, this.now());
      if ('refused' in result) return refuse(result.refused);
      this.book.record('buy', account, { item, amount: -result.price, why: result.owned.join(',') });
      return this.answer(account, { bought: item, items: result.owned });
    }
    const result = buy(account, item, this.book.soldOf(item), this.now());
    if ('refused' in result) return refuse(result.refused);
    if (result.owned.serial) this.book.setSold(item, result.owned.serial);
    this.book.record('buy', account, { item, amount: -result.price, serial: result.owned.serial });
    return this.answer(account, { bought: item });
  }

  wear(seat: Seat | undefined, token: unknown, kind: unknown, id: unknown) {
    const account = this.open(seat, token);
    if (typeof kind !== 'string' || !(kind in KINDS)) refuse('That is not a kind of item.');
    const result = wear(account, kind as ItemKind, typeof id === 'string' && id ? id : undefined);
    if ('refused' in result) return refuse(result.refused);
    this.book.record('wear', account);
    return this.answer(account);
  }

  /** Signed in with PlayerTwo: the seat is the identity (api.ts signInPlayerTwo, with PlayerTwo's id from the seat
   *  instead of a JWT checked against its keys). */
  signInPlayerTwo(seat: Seat | undefined, token: unknown) {
    if (!seat?.id) refuse('Sign in with PlayerTwo first.');
    if (seat!.kind === 'guest' || !hasP2Account(seat)) {
      const own = this.resolve(seat, token);
      if (own) { roll(own, this.now()); return this.answer(own, { guest: true }); }
      const made = this.book.create(this.now());
      roll(made.account, this.now());
      return this.answer(made.account, { token: made.token, guest: true });
    }
    const login = p2Login(seat.id), presented = this.book.find(token), known = this.book.byLogin(login);
    if (known && presented?.pk === known.pk) { roll(known, this.now()); return this.answer(known); }
    const guest = presented && !this.book.hasLogin(presented.pk) ? presented : undefined;
    let account = known ?? guest ?? this.book.create(this.now()).account;
    if (known && guest) { merge(known, guest); this.book.retire(guest, known); account = known; }
    roll(account, this.now());
    const session = this.book.link(account, login);
    this.trophiesFor(account);
    return this.answer(account, { token: session });
  }
  signOut(seat: Seat | undefined, token: unknown) {
    if (typeof token === 'string') this.book.revoke(token);
    return this.hello(seat, undefined);
  }
  deleteAccount(seat: Seat | undefined, token: unknown, confirm: unknown) {
    if (confirm !== 'DELETE') refuse('Confirm the deletion first: it cannot be undone.');
    const address = seat?.id ?? '', recent = this.recent(this.deletes, address);
    if (recent.length >= DELETES_PER_HOUR) refuse('Too many deletions from here. Try again in an hour.', 429);
    this.deletes.set(address, [...recent, this.now()]);
    const account = this.resolve(seat, token);
    if (account) { this.book.forget(account.pk); this.misses.delete(`pk:${account.pk}`); }
    try { return { deleted: true, ...this.hello(seat, undefined) }; }
    catch (error) { if (error instanceof Refusal) return { deleted: true }; throw error; }
  }

  redeem(seat: Seat | undefined, token: unknown, code: unknown) {
    const account = this.open(seat, token), typed = normalCode(code);
    if (!typed) refuse('Type a code first.');
    const signedIn = this.book.hasLogin(account.pk), hash = typed.length <= 64 ? codeHashOf(typed) : '', codes = this.codes();
    if (!signedIn && !(hash && codes.some(each => !!each.guests && each.hash === hash))) refuse('Sign in first: a code is kept with your login, not with this browser.');
    const keys = [`pk:${account.pk}`, `at:${seat?.id ?? ''}`];
    if (keys.some(key => this.recent(this.misses, key).length >= CODE_MISSES)) refuse('Too many codes tried. Try again in an hour.', 429);
    const def = hash ? codes.find(each => each.hash === hash) : undefined;
    if (!def) { for (const key of keys) this.misses.set(key, [...this.recent(this.misses, key), this.now()]); return refuse('That code is not known. Check its spelling.'); }
    if (account.redeemed?.[def.id]) refuse('You have already redeemed that code.');
    if (def.limit !== undefined && this.book.redemptions(def.id) >= def.limit) refuse('That code has been used up.');
    /* (a code bound to an email asks Privy who the login is: no network here) */
    if (def.email) refuse('That code can only be redeemed on the game\'s own site.');
    const next = structuredClone(account), now = this.now(), grants = def.grants, items: string[] = [];
    if (grants.allAccess) next.allAccess = true;
    for (const id of grants.items ?? []) if (ITEM.has(id) && !next.items[id]) { next.items[id] = { at: now }; items.push(id); }
    if (grants.sumi) credit(next, grants.sumi);
    next.redeemed = { ...next.redeemed, [def.id]: now };
    this.book.record('redeem', next, { code: def.id, amount: grants.sumi || undefined, why: items.join(',') || undefined });
    this.book.redeemed(def.id);
    return this.answer(next, { redeemed: { says: def.says, allAccess: !!grants.allAccess, items, sumi: grants.sumi ?? 0 } });
  }

  claimName(seat: Seat | undefined, token: unknown, raw: unknown) {
    const account = this.open(seat, token), name = typeof raw === 'string' ? raw.trim() : '';
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
    this.book.keepName(next, before);
    return this.answer(next);
  }

  /** The name a player goes by in a match room (api.ts roomName), against the world's usernames. */
  roomName(account: Account | undefined, typed: unknown, max = 20): string {
    if (account?.name) return account.name;
    const name = displayName(typed, max);
    if (name === NAME_FALLBACK) return name;
    return heldKeys(name).some(key => { const holder = this.book.nameHolder(key); return holder && holder !== account?.pk; }) ? NAME_FALLBACK : name;
  }

  // ---- Impact's match rooms on PlayerTwo (p2room.ts, from the world) ----
  async p2roomPass(seat: Seat | undefined, token: unknown, typed: unknown) {
    if (!this.key || this.config().rooms === false) return { rooms: false };
    const account = this.resolve(seat, token);
    if (!account) return { rooms: true, pass: null };
    const names: Record<number, string> = {};
    for (const size of NAME_SIZES) names[size] = this.roomName(account, typed, size);
    const ranked: Record<string, { rating: number; games: number }> = {};
    for (const mode of RANKED_MODES) { const r = this.rating(account.pk, mode); ranked[mode] = { rating: r.rating, games: r.games }; }
    /* (signed: the account has a login - the ranked Duel is a signed-in player's: game/duel/ranked.ts) */
    const pass = await seal(this.key, { k: 'pass', pk: account.pk, account: slimAccount(account), names, ranked, rivals: this.rivalsOf(account.pk), signed: this.book.hasLogin(account.pk), exp: this.now() + PASS_MS });
    return { rooms: true, pass };
  }
  /** A signed note checked (its kind), or a refusal. */
  async note<T extends { k: string; exp?: number }>(token: unknown, kind: string): Promise<T> {
    if (!this.key) refuse('Rooms on PlayerTwo are off.');
    const note = await unseal<T>(this.key, token, this.now());
    if (!note || note.k !== kind) refuse('That note is not one of ours.');
    return note!;
  }
  async p2roomComplete(done: unknown) {
    /* (a ranked result or a rivalry result, carried the same way: room.ts stubs/ranked.ts, stubs/rivalries.ts) */
    const kind = this.key ? (await unseal<{ k?: string; exp?: number }>(this.key, done, this.now()))?.k : undefined;
    if (kind === 'rank') { const n = await this.note<RankNote>(done, 'rank'); this.applyRanked(n.pk, n.mode, n.delta, n.won, n.id, n.name); return { completion: null }; }
    if (kind === 'rival') { const n = await this.note<RivalNote>(done, 'rival'); this.recordRival(n.winner, n.loser, n.id); return { completion: null }; }
    const note = await this.note<Done>(done, 'done');
    if (typeof note.pk !== 'string' || !note.report || typeof note.report !== 'object') refuse('That result is not one of ours.');
    return { completion: this.complete(note.pk, note.report as Report) ?? null };
  }

  // ---- progress (ProgressStore, its record under p/<pk>) ----
  progressSync(seat: Seat | undefined, token: unknown, raw: unknown): SyncAnswer {
    const account = this.open(seat, token);
    return this.progress(account.pk, account.created, raw);
  }
  progress(pk: string, created: number, raw: unknown): SyncAnswer {
    const body = (raw && typeof raw === 'object' ? raw : {}) as SyncBody, now = this.now();
    const had = this.readProgress(pk), kept = had ? structuredClone(had) : freshProgress(pk, Number.isFinite(created) ? created : now);
    let changed = false;
    if (body.import && typeof body.import === 'object') {
      const career = cleanCareer(body.import.career, now), brought = { rift: cleanRift(body.import.rift, career.totals.matches), career };
      if (anything(brought)) { kept.state = forward(kept.state, brought); kept.base = forward(kept.base, brought); changed = true; }
    }
    const done: string[] = [];
    let wait: number | undefined;
    for (const each of Array.isArray(body.reports) ? (body.reports as unknown[]).slice(0, PROGRESS_LIMITS.perSync) : []) {
      const report = readReport(each), id = (each as { id?: unknown } | null)?.id;
      if (!report) { if (typeof id === 'string' && id.length <= 64) done.push(id); continue; }
      if (kept.ids.includes(report.id)) { done.push(report.id); continue; }
      const clock = report.kind === 'run' ? 'run' : report.kind === 'match' ? 'match' : undefined;
      if (clock) {
        const seconds = (report.kind === 'run' ? plausibleFacts(report.facts)?.seconds : report.kind === 'match' ? plausibleMatch(report.match)?.seconds : 0) ?? 0;
        const from = Math.max(kept.clock[clock], now - PROGRESS_CLOCK.hold * 1000), allowed = Math.max(0, now - from) / 1000 * PROGRESS_CLOCK.slack;
        if (seconds > allowed) { wait = Math.ceil((seconds - allowed) / PROGRESS_CLOCK.slack); break; }
        kept.clock[clock] = from + seconds / PROGRESS_CLOCK.slack * 1000;
      }
      applyReport(kept.state, report, now);
      kept.ids = [...kept.ids, report.id].slice(-PROGRESS_LIMITS.ids);
      done.push(report.id); changed = true;
    }
    if (changed && (had || anything(kept.state))) this.writeProgress(kept);
    return { pk, rift: kept.state.rift, career: kept.state.career, done, ...(wait !== undefined ? { wait } : {}) };
  }
  private readProgress(pk: string): KeptProgress | undefined {
    const kept = this.kv.get<KeptProgress>(K.progress(pk));
    if (kept?.v !== 1 || kept.pk !== pk || !kept.state || !kept.base) return undefined;
    kept.state = currentSaved(kept.state); kept.base = currentSaved(kept.base);
    return kept;
  }
  private writeProgress(kept: KeptProgress) {
    kept.at = this.now();
    kept.state.career.seen = kept.state.career.seen.slice(-64);
    kept.base.career.recent = []; kept.base.career.seen = [];
    this.kv.set(K.progress(kept.pk), kept);
  }
  private foldProgress(gone: string, into: string) {
    const from = this.readProgress(gone);
    if (!from || gone === into) return;
    const was = this.readProgress(into), next = was ? structuredClone(was) : freshProgress(into, this.now());
    next.state = fold(next.state, from.state, from.base);
    next.base = forward(next.base, from.base);
    next.ids = [...next.ids, ...from.ids.filter(id => !next.ids.includes(id))].slice(-PROGRESS_LIMITS.ids);
    next.clock = { run: Math.max(next.clock.run, from.clock.run), match: Math.max(next.clock.match, from.clock.match) };
    this.writeProgress(next);
    this.kv.delete(K.progress(gone));
  }

  // ---- forged fighters (ForgeStore: f/<hash> the kit, fo/<owner>/<hash> its owner's) ----
  forgeSave(seat: Seat | undefined, token: unknown, code: unknown) {
    const account = this.open(seat, token);
    if (!this.book.hasLogin(account.pk)) refuse('Sign in to keep a forged fighter: it is kept with your login.');
    if (typeof code !== 'string' || code.length > 4096) refuse("That isn't a Forge code.");
    let kit: ForgeKit;
    try { kit = decodeForge(code as string); } catch (error) { return refuse((error as Error).message); }
    const { errors } = forgeProblems(kit, { availability: 'released' });
    if (errors.length) refuse(`That forged fighter can't be kept: ${errors[0]}`);
    if (refusedName(kit.name.trim())) refuse('That name is not allowed.');
    const hash = shortForgeHash(kit), kept = this.kv.get<StoredKit>(`f/${hash}`);
    if (kept && kept.owner === account.pk) return { kept };
    if (this.kv.keys(`fo/${account.pk}/`, FORGE_KEEP).length >= FORGE_KEEP) refuse(`You keep ${FORGE_KEEP} forged fighters already: remove one first.`);
    const recent = this.recent(this.forgeSaves, account.pk, 86400_000);
    if (recent.length >= FORGE_SAVES_PER_DAY) refuse('That is enough forging for today. Try again tomorrow.');
    this.forgeSaves.set(account.pk, [...recent, this.now()]);
    const stored: StoredKit = { hash, code: code as string, owner: account.pk, name: kit.name.trim(), body: kit.body, at: this.now() };
    if (kept) this.kv.delete(`fo/${kept.owner}/${hash}`);
    this.kv.set(`f/${hash}`, stored); this.kv.set(`fo/${account.pk}/${hash}`, 1);
    return { kept: stored };
  }
  forgeMine(seat: Seat | undefined, token: unknown) {
    const account = this.open(seat, token), at = `fo/${account.pk}/`;
    const kits = this.kv.keys(at, 1000).map(key => this.kv.get<StoredKit>(`f/${key.slice(at.length)}`)).filter((kit): kit is StoredKit => !!kit && kit.owner === account.pk);
    return { kept: kits.sort((a, b) => b.at - a.at).map(withoutOwner) };
  }
  forgeGet(hash: unknown) {
    const kit = typeof hash === 'string' && /^[0-9a-f]{16}$/.test(hash) ? this.kv.get<StoredKit>(`f/${hash}`) : undefined;
    return { kit: kit ? withoutOwner(kit) : refuse('There is no forged fighter at that link (it may have been removed).') };
  }
  forgeRemove(seat: Seat | undefined, token: unknown, hash: unknown) {
    const account = this.open(seat, token);
    if (typeof hash !== 'string' || this.kv.get<StoredKit>(`f/${hash}`)?.owner !== account.pk) refuse('That forged fighter is not yours to remove.');
    this.kv.delete(`f/${hash}`); this.kv.delete(`fo/${account.pk}/${hash}`);
    return this.forgeMine(seat, token);
  }

  // ---- RANKED (ranked.ts RankedBook: rk/<season>/<mode>/<pk> a standing, rkt/<id>/<pk> a result taken, rkb/<season>/<mode>
  //      the season's board: the ball modes' 3 v 3 and the Duel's 1 v 1) ----
  rating(pk: string, mode: RankedMode): Rating {
    const season = seasonOf(this.now()).n, kept = this.kv.get<Rating>(`rk/${season}/${mode}/${pk}`);
    if (kept) return { ...kept };
    const last = this.kv.get<Rating>(`rk/${season - 1}/${mode}/${pk}`);
    return last ? intoSeason(last) : freshRating();
  }
  ranked(seat: Seat | undefined, token: unknown): RankedAnswer {
    const season = seasonOf(this.now()), account = this.resolve(seat, token), modes: RankedAnswer['modes'] = {};
    if (account) for (const mode of RANKED_MODES) modes[mode] = this.rating(account.pk, mode);
    return { season: season.n, ends: season.end, modes };
  }
  /** A rated result (a ranked match's end), once per match and account. The Duel's only for an account with a login (a
   *  ranked Duel room seats no guest: this is the world's own word on it). `name`: the name the room showed them by,
   *  for the season's board. */
  applyRanked(pk: unknown, mode: unknown, delta: unknown, won: unknown, id: unknown, name?: unknown): Rating | undefined {
    if (!sane(pk) || !isRankedMode(mode) || typeof delta !== 'number' || !Number.isFinite(delta) || !sane(id)) return undefined;
    const m = mode, taken = `rkt/${id}/${pk}`;
    if (this.kv.get(taken)) return this.rating(pk, m);
    if (m === 'duel' && !this.book.hasLogin(pk)) return undefined;
    const before = this.rating(pk, m), rating = Math.round(before.rating + Math.max(-100, Math.min(100, delta)));
    const after: Rating = { rating, games: before.games + 1, wins: before.wins + (won === true ? 1 : 0), peak: Math.max(before.peak, rating) };
    const season = seasonOf(this.now()).n;
    this.kv.set(`rk/${season}/${m}/${pk}`, after); this.kv.set(taken, this.now());
    this.onBoard(season, m, pk, after, name);
    return { ...after };
  }
  /** The season's board for a mode: one key, its rows by rating (BOARD_KEEP of them; a row once the placements are
   *  played), each a standing and the name the account goes by (its username, else the name it last played ranked as,
   *  as roomName gives it). Kept as each result is applied: no call reads more than this one key. */
  private onBoard(season: number, mode: RankedMode, pk: string, r: Rating, typed?: unknown) {
    const key = `rkb/${season}/${mode}`, rows = (this.kv.get<BoardRow[]>(key) ?? []).filter(row => row.pk !== pk);
    if (r.games >= RANKED.placements) rows.push({ pk, name: this.roomName(this.book.account(pk), typed, 18), rating: r.rating, games: r.games, wins: r.wins });
    rows.sort((a, b) => b.rating - a.rating || b.wins - a.wins || a.games - b.games);
    this.kv.set(key, rows.slice(0, BOARD_KEEP));
  }
  /** An account's rows taken off this season's boards (its deletion). */
  private offBoards(pk: string) {
    const season = seasonOf(this.now()).n;
    for (const mode of RANKED_MODES) {
      const key = `rkb/${season}/${mode}`, rows = this.kv.get<BoardRow[]>(key);
      if (rows?.some(row => row.pk === pk)) this.kv.set(key, rows.filter(row => row.pk !== pk));
    }
  }
  /** A season's board as a page reads it: the top BOARD_SHOWN (names, standings, stamps; never an account's id), and the
   *  asker's own place when they are on it. */
  rankedBoard(seat: Seat | undefined, token: unknown, mode: unknown): RankedBoard {
    const season = seasonOf(this.now()), m: RankedMode = isRankedMode(mode) ? mode : 'duel';
    const rows = this.kv.get<BoardRow[]>(`rkb/${season.n}/${m}`) ?? [], me = this.resolve(seat, token)?.pk;
    const place = me ? rows.findIndex(row => row.pk === me) : -1;
    const shown = (row: BoardRow, i: number): RankedBoardRow => ({ place: i + 1, name: row.name, rating: row.rating, games: row.games, wins: row.wins, tier: tierOf(row)?.id ?? null, ...(row.pk === me ? { you: true as const } : {}) });
    return { season: season.n, ends: season.end, mode: m, top: rows.slice(0, BOARD_SHOWN).map(shown), ...(place >= BOARD_SHOWN ? { me: shown(rows[place], place) } : {}) };
  }

  // ---- rivalries (Rivalries.ts RivalryBook: rv/<a>/<b>, a < b, [a's wins, b's]) ----
  recordRival(winner: unknown, loser: unknown, id?: unknown) {
    if (!sane(winner) || !sane(loser) || winner === loser) return;
    if (id !== undefined) { if (!sane(id) || this.kv.get(`rvt/${id}`)) return; this.kv.set(`rvt/${id}`, this.now()); }
    const [a, b] = winner < loser ? [winner, loser] : [loser, winner], key = `rv/${a}/${b}`, kept = this.kv.get<[number, number]>(key) ?? [0, 0];
    kept[winner < loser ? 0 : 1]++;
    this.kv.set(key, kept); this.kv.set(`rvo/${b}/${a}`, 1);
  }
  /** Every head-to-head record of an account (rv/<pk>/<b>, and rvo/<pk>/<a> for those kept under the other), its own
   *  wins first, the 64 most played. */
  rivalsOf(pk: string): Record<string, [number, number]> {
    const out: [string, [number, number]][] = [];
    for (const key of this.kv.keys(`rv/${pk}/`, 500)) { const other = key.slice(`rv/${pk}/`.length); out.push([other, this.between(pk, other)]); }
    for (const key of this.kv.keys(`rvo/${pk}/`, 500)) { const other = key.slice(`rvo/${pk}/`.length); out.push([other, this.between(pk, other)]); }
    return Object.fromEntries(out.sort((x, y) => (y[1][0] + y[1][1]) - (x[1][0] + x[1][1])).slice(0, 64));
  }
  between(a: unknown, b: unknown): [number, number] {
    if (!sane(a) || !sane(b) || a === b) return [0, 0];
    const kept = this.kv.get<[number, number]>(a < b ? `rv/${a}/${b}` : `rv/${b}/${a}`) ?? [0, 0];
    return a < b ? [kept[0], kept[1]] : [kept[1], kept[0]];
  }

  // ---- the operator's hand: notes signed with P2ROOM_KEY ----
  async admin(token: unknown) {
    const note = await this.note<AdminNote>(token, 'admin');
    const cfg = this.config();
    switch (note.op) {
      case 'open': this.kv.set(CFG, { ...cfg, open: note.on !== false, at: this.now() }); return { cfg: this.config() };
      case 'rooms': this.kv.set(CFG, { ...cfg, rooms: note.on !== false }); return { cfg: this.config() };
      case 'codes': this.kv.set(CFG, { ...cfg, codes: Array.isArray(note.codes) ? note.codes.filter(c => c && typeof c.hash === 'string' && typeof c.id === 'string' && c.grants) : [] }); return { codes: (this.config().codes ?? []).length };
      case 'grant': {
        const account = this.book.account(String(note.pk ?? '')) ?? refuse('No such account.');
        const n = Math.floor(Number(note.amount) || 0), id = typeof note.item === 'string' ? currentId(note.item) : undefined;
        if (n) credit(account, n);
        if (id) { if (!ITEM.has(id)) refuse('There is no such item.'); account.items[id] ??= { at: this.now() }; }
        this.book.record('grant', account, { amount: n || undefined, item: id, why: 'admin' });
        return this.answer(account);
      }
      default: return refuse('That is not something the operator can ask.');
    }
  }

  /** One route, as api.ts mounts it: its body as the HTTP route reads it, answered as HTTP would answer. */
  async route(seat: Seat | undefined, path: string, raw: unknown): Promise<Answer> {
    const body = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    try {
      const run = ROUTES[path];
      if (!run) return { status: 404, body: { error: 'There is no such call.' } };
      if (!this.config().open && !ALWAYS.has(path)) return { status: 503, body: { error: 'The shop is moving. Try again in a few minutes.', [NOT_OPEN]: true } };
      return { status: 200, body: await run(this, seat, body) };
    } catch (error) {
      if (error instanceof Refusal) return { status: error.status, body: { error: error.message, ...(error.need ? { need: error.need } : {}) } };
      this.log(`[economy] ${path} failed`, error instanceof Error ? `${error.message} ${(error.stack ?? '').split('\n').slice(1, 6).join(' | ')}` : String(error));
      return { status: 500, body: { error: 'Something went wrong on the server.' } };
    }
  }
}

/** The routes answered before the world is open: the operator's notes (the import's own messages are world.ts's). */
const ALWAYS = new Set(['admin']);
type Route = (e: WorldEconomy, seat: Seat | undefined, body: Record<string, unknown>) => unknown;
/** api.ts mountEconomy's routes (and /ball/ranked as `ranked`), by name. */
const ROUTES: Record<string, Route> = {
  hello: (e, s, b) => e.hello(s, b.token),
  report: (e, s, b) => e.report(s, b.token, currentSaved(b.report) as Report),
  buy: (e, s, b) => e.buy(s, b.token, currentId(b.item)),
  wear: (e, s, b) => e.wear(s, b.token, b.kind, currentId(b.item)),
  signin: () => refuse('Sign in with PlayerTwo here: its player knows who you are.'),
  'p2-signin': (e, s, b) => e.signInPlayerTwo(s, b.token),
  signout: (e, s, b) => e.signOut(s, b.token),
  delete: (e, s, b) => e.deleteAccount(s, b.token, b.confirm),
  grant: () => refuse('Not allowed.'),
  redeem: (e, s, b) => e.redeem(s, b.token, b.code),
  name: (e, s, b) => e.claimName(s, b.token, b.name),
  'forge-save': (e, s, b) => e.forgeSave(s, b.token, b.code),
  'forge-mine': (e, s, b) => e.forgeMine(s, b.token),
  'forge-get': (e, _s, b) => e.forgeGet(b.hash),
  'forge-remove': (e, s, b) => e.forgeRemove(s, b.token, b.hash),
  'p2room-pass': (e, s, b) => e.p2roomPass(s, b.token, b.name),
  'p2room-complete': (e, _s, b) => e.p2roomComplete(b.done),
  progress: (e, s, b) => e.progressSync(s, b.token, { ...b, ...(b.import ? { import: currentSaved(b.import) } : {}), ...(b.reports ? { reports: currentSaved(b.reports) } : {}) }),
  ranked: (e, s, b) => e.ranked(s, b.token),
  'ranked-board': (e, s, b) => e.rankedBoard(s, b.token, b.mode),
  admin: (e, _s, b) => e.admin(b.note),
};
export const WORLD_ROUTES = Object.keys(ROUTES);

interface AdminNote { k: 'admin'; op: 'open' | 'rooms' | 'codes' | 'grant'; on?: boolean; codes?: CodeDef[]; pk?: string; amount?: number; item?: string; exp: number }

/** What rooms read of an account (p2room.ts slimAccount, here so the bundle needn't carry the server's routes). */
export function slimAccount(account: Account): PassAccount {
  const items: Record<string, { at: number }> = {};
  for (const id of Object.keys(account.items ?? {})) items[id] = { at: 0 };
  return { pk: account.pk, ...(account.name ? { name: account.name } : {}), xp: account.xp ?? 0, items, ...(account.allAccess ? { allAccess: true } : {}), worn: account.worn };
}
const sane = (id: unknown): id is string => typeof id === 'string' && id.length > 0 && id.length <= 200;
/** A season's board: rows kept (by rating), and shown to a page. */
export const BOARD_KEEP = 100, BOARD_SHOWN = 10;
interface BoardRow { pk: string; name: string; rating: number; games: number; wins: number }

export const PROGRESS_CLOCK = { slack: 1.2, first: 120, hold: 24 * 3600 } as const;
interface KeptProgress { v: 1; pk: string; state: ProgressState; base: ProgressState; ids: string[]; clock: { run: number; match: number }; at: number }
const freshProgress = (pk: string, created: number): KeptProgress => {
  const start = created - PROGRESS_CLOCK.first / PROGRESS_CLOCK.slack * 1000;
  return { v: 1, pk, state: emptyState(), base: emptyState(), ids: [], clock: { run: start, match: start }, at: 0 };
};
export const FORGE_KEEP = 30, FORGE_SAVES_PER_DAY = 40;
export interface StoredKit { hash: string; code: string; owner: string; name: string; body: FighterId; at: number }
const withoutOwner = ({ owner: _owner, ...kit }: StoredKit) => kit;
/** The all-access code's shortest words (codes.ts), for the admin tool's check. */
export { ALL_ACCESS_MIN };
