import { account as browserAccount, economyServer, type AccountClient, type Poster, type Store } from '../shop/account';
import { emptyState, importOf, replay, type ProgressReport, type ProgressState, type SyncAnswer, type SyncBody } from '../../game/progress/rules';
import { adoptProgress, loadProgress, riftEvents, type RiftEvent } from '../../survival/progressStore';
import { careerEvents, deviceCareer, type CareerEvent } from '../../game/social/career';

const KEY = 'jump-progress-sync';
/** Reports kept for later at most (past it, the copy is imported again instead: it holds them all), and a body's most. */
export const KEEP = 64, BODY = 12_000;
/** Seconds: a report's wait before it is sent (more come with it); the first and longest wait after a failure; how
 *  long a page that came back into view goes before it asks again; the wait for a server that has no such route. */
const SOON = 2, RETRY = 15, LONGEST = 300, FRESH = 60, MISSING = 900;

/** What this browser remembers: the account it last synced with, that account's progress as the server answered, the
 *  reports it has not taken yet - and `again`: the copy is to be imported again (it holds what the reports would). */
interface Kept { pk: string; server: ProgressState; pending: ProgressReport[]; again?: boolean }

export interface ProgressSyncDeps {
  post: Poster;
  /** This browser's storage (what is remembered, above). */
  store: Store;
  /** This browser's copy of the progress (progressStore.ts and career.ts). */
  local: { read(): ProgressState; write(state: ProgressState): void };
  /** The account as the account client has it: its token, its id, and whether the server has answered this visit. */
  account: { token(): string | undefined; pk(): string | undefined; live(): boolean };
  /** A call later, and how to call it off. */
  later(seconds: number, run: () => void): () => void;
  id(): string;
  now(): number;
}

export class ProgressSync {
  private busy?: Promise<void>;
  private again = false;
  private cancel?: () => void;
  private due = Infinity;
  private fails = 0;
  /** Reports noted this visit (a sync that was answered while one came knows its answer is behind). */
  private noted = 0;
  private last = 0;

  constructor(private readonly deps: ProgressSyncDeps) {}

  private read(): Kept | undefined {
    try { const kept = JSON.parse(this.deps.store.get(KEY) ?? 'null') as Kept | null; return kept && typeof kept.pk === 'string' && kept.server && Array.isArray(kept.pending) ? kept : undefined; } catch { return undefined; }
  }
  private write(kept: Kept) { this.deps.store.set(KEY, JSON.stringify(kept)); }
  /** The reports not taken yet (none before the first sync with this account: its copy goes as the import). */
  pending(): ProgressReport[] { const kept = this.read(); return kept && !kept.again && kept.pk === this.deps.account.pk() ? kept.pending : []; }

  /** Something changed here (this browser's copy is written already): a report for the account, sent shortly. */
  note(event: RiftEvent | CareerEvent) {
    this.noted++;
    const kept = this.read();
    if (kept && !kept.again && kept.pk === this.deps.account.pk()) {
      kept.pending.push({ ...event, id: this.deps.id() } as ProgressReport);
      // (A long time offline: past KEEP, the copy itself is sent, which holds every one of them.)
      if (kept.pending.length > KEEP) { kept.pending = []; kept.again = true; }
      this.write(kept);
    }
    this.soon(SOON);
  }

  /** DELETE ACCOUNT: this browser's copy goes with the account (nothing of it is imported into the guest that follows). */
  forget() {
    this.deps.store.set(KEY, undefined);
    this.deps.local.write(emptyState());
  }

  /** A sync in `seconds` (or sooner, if one is due sooner already). */
  soon(seconds: number) {
    const at = this.deps.now() + seconds * 1000;
    if (this.cancel && at >= this.due) return;
    this.cancel?.();
    this.due = at;
    this.cancel = this.deps.later(seconds, () => { this.cancel = undefined; this.due = Infinity; void this.sync(); });
  }
  /** The page came back into view: asked again if it has been a while (another device may have played). */
  woke() { if (this.deps.now() - this.last > FRESH * 1000) this.soon(0); }

  /** One sync now (one at a time: one asked for meanwhile follows it). Never throws. */
  sync(): Promise<void> {
    if (this.busy) { this.again = true; return this.busy; }
    const run = this.busy = (async () => {
      try { await this.once(); } catch (error) { console.warn('[progress] sync failed', error); this.retry(); }
      finally { this.busy = undefined; }
      if (this.again) { this.again = false; await this.sync(); }
    })();
    return run;
  }

  private retry(seconds = Math.min(LONGEST, RETRY * 2 ** this.fails++)) { this.soon(seconds); }

  private async once() {
    const token = this.deps.account.token(), pk = this.deps.account.pk();
    if (!token || !pk || !this.deps.account.live()) return;
    const kept = this.read(), importing = !kept || kept.pk !== pk || !!kept.again, mark = this.noted;
    const body: SyncBody = {};
    if (importing) body.import = importOf(this.deps.local.read());
    else {
      // As many as a body holds, in order.
      const reports: ProgressReport[] = [];
      for (const report of kept.pending) { if (reports.length && JSON.stringify([...reports, report]).length > BODY) break; reports.push(report); }
      body.reports = reports;
    }
    let status: number, json: unknown;
    try { ({ status, body: json } = await this.deps.post('progress', { token, ...body })); } catch { this.retry(); return; }
    this.last = this.deps.now();
    // (A server from before this has no such route: asked again much later. A token it does not know: the account
    // client opens an account again, and this follows it.)
    if (status === 404) { this.retry(MISSING); return; }
    const answer = json as SyncAnswer | undefined;
    if (status !== 200 || !answer?.rift || !answer.career || typeof answer.pk !== 'string') { this.retry(); return; }
    // The account changed while it was asked (a sign-in folded this guest in, say): asked again, for the account it is
    // now. The same token opening another account (folded in from elsewhere): the account client has not heard yet, and
    // this waits for it, backing off.
    if (answer.pk !== this.deps.account.pk()) { if (this.deps.account.token() !== token) this.soon(0); else this.retry(); return; }
    this.fails = 0;
    const server: ProgressState = { rift: answer.rift, career: answer.career };
    if (importing) {
      // Something was played while the copy was on its way: the copy, which has it, is imported again.
      if (this.noted !== mark) { this.write({ pk, server, pending: [], again: true }); this.again = true; return; }
      this.write({ pk, server, pending: [] });
      this.deps.local.write(server);
      return;
    }
    const done = new Set(answer.done ?? []), now = this.read();
    if (!now || now.pk !== pk || now.again) { this.again = true; return; }
    // An account's progress only moves forward: an answer behind the last one means the server lost it (a volume
    // restored from a backup, a file gone). This browser's copy, which has it, is imported again rather than lost.
    if (behind(server, now.server)) { console.warn('[progress] the server is behind this browser: its copy is sent again'); this.write({ ...now, pending: [], again: true }); this.again = true; return; }
    const pending = now.pending.filter(report => !done.has(report.id));
    this.write({ pk, server, pending });
    this.deps.local.write(replay(server, pending));
    // The rest: after the wait the server asked for (a run longer than the time since the last), or at once if the body
    // could not hold them all - or, taking none and asking no wait, as after a failure.
    if (!pending.length) return;
    if (typeof answer.wait === 'number') this.soon(Math.max(5, Math.min(3600, answer.wait)));
    else if (done.size) this.soon(SOON);
    else this.retry();
  }
}

/** Whether `a` is behind `b`: fewer runs, shards earned or matches. */
const behind = (a: ProgressState, b: ProgressState) => a.rift.runs < b.rift.runs || a.rift.earned < b.rift.earned || a.career.totals.matches < b.career.totals.matches;

// ---- in the page -----------------------------------------------------------------------------------------------------
const httpPost: Poster = async (path, body) => {
  const response = await fetch(`${economyServer()}/api/economy/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(8000) });
  let json: unknown;
  try { json = await response.json(); } catch { json = undefined; }
  return { status: response.status, body: json };
};
const browserStore: Store = {
  get: key => { try { return localStorage.getItem(key) ?? undefined; } catch { return undefined; } },
  set: (key, value) => { try { if (value === undefined) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch { /* Kept for the visit. */ } },
};

let started: ProgressSync | undefined;
/** DELETE ACCOUNT went through (src/ui/shop/signin.ts): this browser's progress and career go too. */
export function forgetProgressHere() { started?.forget(); }
/** Progress kept with the account, from now on: once, when the account is (src/ui/shop/boot.ts). */
export function startProgressSync(client: Pick<AccountClient, 'on' | 'secret' | 'wallet'> = browserAccount): ProgressSync {
  if (started) return started;
  const sync = started = new ProgressSync({
    post: httpPost, store: browserStore,
    local: { read: () => ({ rift: loadProgress(), career: deviceCareer.read() }), write: state => { adoptProgress(state.rift); deviceCareer.write(state.career); } },
    account: { token: () => client.secret(), pk: () => client.wallet.account?.pk, live: () => client.wallet.live },
    later: (seconds, run) => { const timer = setTimeout(run, seconds * 1000); return () => clearTimeout(timer); },
    id: () => `r-${crypto.randomUUID()}`, now: () => Date.now(),
  });
  riftEvents.on = event => sync.note(event);
  careerEvents.on = event => sync.note(event);
  let pk: string | undefined;
  client.on(wallet => { const now = wallet.live ? wallet.account?.pk : undefined; if (now && now !== pk) { pk = now; sync.soon(0); } });
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => sync.soon(0));
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') sync.woke(); });
  }
  return sync;
}
