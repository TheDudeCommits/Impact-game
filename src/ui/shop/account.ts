import type { Account, Settlement } from '../../game/economy/account';
import type { ItemKind } from '../../game/economy/catalog';
import type { Report } from '../../game/economy/earn';

/** What the server offers: sign-in, when it has a Privy app (its id). (Sumi is earned only: nothing is sold for money.) */
export interface ShopConfig { privy?: string }
export interface Wallet {
  account?: Account;
  /** The account is kept under a login (the server says so; one that does not, from before 8 October 2026, is told by
   *  this browser's token: a signed-in session's starts s_). */
  signedIn?: boolean;
  /** Copies sold of the items whose copies are counted. */
  sold: Record<string, number>;
  config: ShopConfig;
  /** The server has answered this session (until then the account is the one remembered). */
  live: boolean;
}
/** What a code unlocked, as the server says it: its line, and what it gave. */
export interface Redeemed { says: string; allAccess: boolean; items: string[]; sumi: number }
interface Answer { account: Account; signedIn?: boolean; sold: Record<string, number>; config: ShopConfig; token?: string; settlement?: Settlement; redeemed?: Redeemed }

/** The server said no, in words for the player. `need`: what to bring to try again (`identity`: Privy's identity token). */
export class Refused extends Error { need?: string }
/** A request as the server answers it: its status and its JSON. Throws if the server cannot be reached. */
export type Poster = (path: string, body: unknown) => Promise<{ status: number; body: unknown }>;
export interface Store { get(key: string): string | undefined; set(key: string, value: string | undefined): void }

const KEY = { token: 'jump-account-token', account: 'jump-account', pending: 'jump-account-pending', login: 'jump-account-login' } as const;
const isSession = (token: string | undefined) => !!token?.startsWith('s_');

export function maskEmail(email: string): string {
  const [name = '', domain = ''] = email.trim().split('@'), parts = domain.split('.'), end = parts.length > 1 ? parts.pop()! : '';
  return `${Array.from(name)[0] ?? ''}•••@${Array.from(parts.join('.'))[0] ?? ''}•••${end ? `.${end}` : ''}`;
}
/** Results kept for later at most, and the seconds between two of them sent (the server takes one every eight). */
const KEEP = 12, GAP = 9;

const env = (typeof import.meta !== 'undefined' ? (import.meta as { env?: Record<string, string | undefined> }).env : undefined) ?? {};
/** Where the economy's API is: the match server, unless VITE_ECONOMY_SERVER names another. */
export const economyServer = () => (env.VITE_ECONOMY_SERVER || env.VITE_MATCH_SERVER || `${location.protocol === 'https:' ? 'https' : 'http'}://${location.hostname}:2567`).replace(/^ws/, 'http').replace(/\/+$/, '');

const httpPost: Poster = async (path, body) => {
  const response = await fetch(`${economyServer()}/api/economy/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(5000) });
  let json: unknown;
  try { json = await response.json(); } catch { json = undefined; }
  return { status: response.status, body: json };
};
const browserStore = (): Store => ({
  get: key => { try { return localStorage.getItem(key) ?? undefined; } catch { return undefined; } },
  set: (key, value) => { try { if (value === undefined) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch { /* Private browsing: the account lasts the visit. */ } },
});

/** The longest wait between two tries of a result the server asks to send again later, again and again (an on-device
 *  result past its hour or its wall clock: src/server/economy/deviceReports.ts). */
const LONGEST = 300;

export class AccountClient {
  wallet: Wallet = { sold: {}, config: {}, live: false };
  private token?: string;
  private readonly listeners = new Set<(wallet: Wallet) => void>();
  /** One call at a time, in order: two at once could open two accounts. */
  private chain: Promise<unknown> = Promise.resolve();
  private flushing?: Promise<void>;

  constructor(private readonly post: Poster = httpPost, private readonly store: Store = browserStore(), private readonly wait = (seconds: number) => new Promise<void>(done => setTimeout(done, seconds * 1000))) {
    this.token = store.get(KEY.token);
    try { const kept = JSON.parse(store.get(KEY.account) ?? 'null') as { account?: Account; config?: ShopConfig; signedIn?: boolean } | null; if (kept?.account && this.token) this.wallet = { ...this.wallet, account: kept.account, signedIn: kept.signedIn ?? isSession(this.token), config: { privy: kept.config?.privy } }; } catch { /* A remembered account that does not read is asked for again. */ }
  }

  /** Told of every change (and once, now). Returns how to stop. */
  on(listener: (wallet: Wallet) => void) { this.listeners.add(listener); listener(this.wallet); return () => { this.listeners.delete(listener); }; }
  private emit() { for (const listener of this.listeners) listener(this.wallet); }
  get account() { return this.wallet.account; }
  /** Whether this browser has an account at all. */
  get known() { return !!this.token; }
  /** The token that opens the account: handed to a co-op room on this server, which reads what the account wears. */
  secret() { return this.token; }
  /** How this browser's sign-in reads on screen, masked ("as a•••@g•••.com", "with Google"): kept in this browser only,
   *  from Privy's own session as it signed in, and never sent to the server. */
  get login() { return this.wallet.signedIn ? this.store.get(KEY.login) : undefined; }

  private take(answer: Answer) {
    if (answer.token) { this.token = answer.token; this.store.set(KEY.token, answer.token); }
    this.wallet = { account: answer.account, signedIn: answer.signedIn ?? isSession(this.token), sold: answer.sold ?? {}, config: { privy: answer.config?.privy }, live: true };
    this.store.set(KEY.account, JSON.stringify({ account: answer.account, config: this.wallet.config, signedIn: this.wallet.signedIn }));
    this.emit();
    return answer;
  }
  /** One request, with this browser's token. 401 (the token opens nothing any more): an account is asked for, and it is tried once more. */
  private async ask(path: string, body: Record<string, unknown>, again = true): Promise<Answer> {
    const { status, body: json } = await this.post(path, { ...body, token: this.token });
    const answer = json as (Answer & { error?: string }) | undefined;
    if (status === 200 && answer?.account) return this.take(answer);
    if (status === 401 && again && path !== 'hello') { await this.ask('hello', {}, false); return this.ask(path, body, false); }
    if (status === 429) throw Object.assign(new Refused(answer?.error ?? 'Too soon.'), { later: true });
    if (status >= 400 && status < 500) throw Object.assign(new Refused(answer?.error ?? 'The server said no.'), { need: (answer as { need?: string } | undefined)?.need });
    throw new Error(answer?.error ?? `The server answered ${status}.`);
  }
  private queued<T>(work: () => Promise<T>): Promise<T> {
    const run = this.chain.then(work, work);
    this.chain = run.catch(() => undefined);
    return run;
  }

  /** On load: the account this browser already has, if it has one - and whatever results were kept for later. */
  start() { return this.queued(async () => { if (this.token) await this.ask('hello', {}); }).then(() => { void this.flush(); }, () => undefined); }
  /** The account, opened if this browser has none yet. */
  open() { return this.queued(async () => { if (!this.token || !this.wallet.live) await this.ask('hello', {}); return this.wallet; }); }

  /** A match's result, to be paid: what it paid - or that it is kept for later (the server could not be reached, or asked to
   *  wait: `later` says why, and it is tried again in this visit), or why it was refused. */
  async report(report: Report): Promise<{ settlement?: Settlement; kept?: boolean; later?: string; refused?: string }> {
    try { return { settlement: (await this.queued(async () => { if (!this.token) await this.ask('hello', {}); return this.ask('report', { report }); })).settlement }; }
    catch (error) {
      if (error instanceof Refused && !(error as { later?: boolean }).later) return { refused: error.message };
      this.keep(report);
      if (error instanceof Refused) { void this.flush(); return { kept: true, later: error.message }; }
      return { kept: true };
    }
  }
  private pending(): Report[] { try { const list = JSON.parse(this.store.get(KEY.pending) ?? '[]') as Report[]; return Array.isArray(list) ? list : []; } catch { return []; } }
  private keep(report: Report) { const list = this.pending().filter(each => each.id !== report.id); this.store.set(KEY.pending, JSON.stringify([...list, report].slice(-KEEP))); }
  /** The results kept for later, sent one at a time. Stops at the first the server cannot be reached with. */
  flush(): Promise<void> {
    return this.flushing ??= (async () => {
      try {
        for (let list = this.pending(), waits = 0; list.length; list = this.pending()) {
          const [next] = list;
          try { await this.queued(async () => { if (!this.token) await this.ask('hello', {}); return this.ask('report', { report: next }); }); }
          catch (error) { if (!(error instanceof Refused)) return; if ((error as { later?: boolean }).later) { await this.wait(Math.min(LONGEST, GAP * 2 ** waits++)); continue; } }
          waits = 0;
          this.store.set(KEY.pending, JSON.stringify(this.pending().filter(each => each.id !== next.id)));
          if (this.pending().length) await this.wait(GAP);
        }
      } finally { this.flushing = undefined; }
    })();
  }

  buy(item: string) { return this.queued(() => this.ask('buy', { item })); }
  /** An item put on, or (with no id) its slot cleared. An emote goes on the wheel, or comes off it. */
  wear(kind: ItemKind, item: string | undefined) { return this.queued(() => this.ask('wear', { kind, item })); }
  /** A code typed in ACCOUNT, and - for a code bound to one login's email - Privy's identity token of this login.
   *  Resolves with what it unlocked; a refusal says why (and `need: 'identity'` asks for the identity token). */
  async redeem(code: string, identity?: string): Promise<Redeemed> {
    return (await this.queued(() => this.ask('redeem', { code, ...(identity ? { identity } : {}) }, false))).redeemed!;
  }
  /** A username claimed, or changed. */
  claimName(name: string) { return this.queued(() => this.ask('name', { name }, false)); }
  /** Signed in with Privy: this device now opens the login's account. `shown`: how the login reads on this screen, masked
   *  (kept here, for the ACCOUNT tab; the server is sent only Privy's token). */
  signIn(access: string, shown?: string) { return this.queued(async () => { const answer = await this.ask('signin', { access }, false); this.store.set(KEY.login, shown); this.emit(); return answer; }); }
  /** Signed in with Player Two, in its player: its identity for this game (the server checks it against Player Two's
   *  keys), and this browser's guest folded in. `shown`: how it reads on the ACCOUNT tab ("with Player Two as @handle"). */
  signInPlayerTwo(identity: string, shown?: string) { return this.queued(async () => { const answer = await this.ask('p2-signin', { identity }, false); this.store.set(KEY.login, shown); this.emit(); return answer; }); }
  /** Signed out on this device: the server forgets this device's session and a fresh guest account takes its place.
   *  It always signs out: if the server cannot be reached (or will not open a guest just now), this browser forgets the
   *  session all the same - it opens nothing here any more - and a guest account is opened the next time it is needed. */
  signOut(): Promise<void> {
    return this.queued(async () => { this.store.set(KEY.login, undefined); try { await this.ask('signout', {}, false); } catch { this.forget(); } });
  }
  /** DELETE ACCOUNT (8 October 2026): the server deletes the account this browser opens - signed in or a guest - and this
   *  browser forgets it (its token, what it remembered, results kept for later) and takes the fresh guest account the
   *  server opened for it, if it opened one. Rejects, forgetting nothing, if the server could not be reached or said no. */
  deleteAccount(): Promise<void> {
    return this.queued(async () => {
      if (this.token) {
        const { status, body } = await this.post('delete', { token: this.token, confirm: 'DELETE' });
        const answer = body as (Partial<Answer> & { deleted?: boolean; error?: string }) | undefined;
        if (status === 404) throw new Refused('This server cannot delete accounts yet. Email Hello@Dude.work and it will be done for you.');
        if (status !== 200 || !answer?.deleted) throw status >= 400 && status < 500 ? new Refused(answer?.error ?? 'The server said no.') : new Error(answer?.error ?? `The server answered ${status}.`);
        this.store.set(KEY.pending, undefined);
        this.forget();
        if (answer.account && answer.token) this.take(answer as Answer);
      } else this.forget();
    });
  }
  /** This browser holds no account now: no token, nothing remembered. */
  private forget() {
    this.token = undefined;
    this.store.set(KEY.token, undefined); this.store.set(KEY.account, undefined); this.store.set(KEY.login, undefined);
    this.wallet = { sold: this.wallet.sold, config: this.wallet.config, live: false };
    this.emit();
  }
}

/** This browser's account. */
export const account = new AccountClient();
