import fs from 'node:fs';
import path from 'node:path';

export interface TrophyOptions {
  /** The game's key on Player Two (P2_GAME_KEY, p2g_...). None: nothing is sent. */
  key?: string;
  site?: string;
  /** Where p2-trophies.json is kept (the book's folder). None: memory only. */
  dir?: string;
  fetcher?: typeof fetch;
  now?: () => number;
  log?: (line: string) => void;
}
interface Due { player: string; feat: string; tries: number; at: number }
/** Waits before a try again, by the number of tries so far: a minute, doubling, at most an hour. */
const backoff = (tries: number) => Math.min(3600_000, 60_000 * 2 ** Math.max(0, tries - 1));
const PLAYER = /^[A-Za-z0-9_-]{16,64}$/, FEAT = /^[a-z0-9-]{1,40}$/, TRIES = 30;

export class PlayerTwoTrophies {
  readonly enabled: boolean;
  private readonly key: string;
  private readonly site: string;
  private readonly file?: string;
  private readonly fetcher: typeof fetch;
  private readonly now: () => number;
  private readonly log: (line: string) => void;
  /** Per Player Two player, the feats Player Two has taken. */
  private readonly given = new Map<string, Set<string>>();
  private readonly queue: Due[] = [];
  private sending?: Promise<void>;
  private timer?: ReturnType<typeof setTimeout>;
  /** The key was refused: nothing is sent until then. */
  private heldUntil = 0;

  constructor(options: TrophyOptions = {}) {
    this.key = options.key?.trim() ?? '';
    this.enabled = /^p2g_[A-Za-z0-9_-]{20,64}$/.test(this.key);
    this.site = (options.site?.trim() || 'https://playertwo.lol').replace(/\/+$/, '');
    this.fetcher = options.fetcher ?? fetch;
    this.now = options.now ?? Date.now;
    this.log = options.log ?? (line => console.log(line));
    if (this.key && !this.enabled) this.log('[p2] P2_GAME_KEY is not a Player Two game key (p2g_...): trophies are off');
    if (!options.dir) return;
    this.file = path.join(options.dir, 'p2-trophies.json');
    try {
      const kept = JSON.parse(fs.readFileSync(this.file, 'utf8')) as { given?: Record<string, string[]> };
      for (const [player, feats] of Object.entries(kept.given ?? {})) this.given.set(player, new Set(feats));
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') this.log(`[p2] p2-trophies.json does not read; every feat is offered again: ${String(error)}`); }
  }

  /** The feats a Player Two player holds that Player Two has not taken yet, queued to be given. Returns at once. */
  offer(player: string, feats: readonly string[]) {
    if (!this.enabled || !PLAYER.test(player)) return;
    const given = this.given.get(player);
    for (const feat of feats) {
      if (!FEAT.test(feat) || given?.has(feat) || this.queue.some(due => due.player === player && due.feat === feat)) continue;
      this.queue.push({ player, feat, tries: 0, at: this.now() });
    }
    this.soon(0);
  }
  /** What is still to give (a test's view, and /health's if it is ever wanted). */
  get pending() { return this.queue.length; }

  /** Sends whatever is due now, one at a time. Resolves when nothing more is due now (a test awaits it). */
  flush(): Promise<void> {
    // (Cleared once it has settled, never before it is kept: a send with nothing to do settles at once.)
    this.sending ??= this.send().finally(() => { this.sending = undefined; });
    return this.sending;
  }
  private async send() {
    try {
      for (let due = this.next(); due; due = this.next()) await this.give(due);
    } catch (error) { this.log(`[p2] trophies: ${String(error)}`); }
    const wake = this.queue.length ? Math.max(this.heldUntil, Math.min(...this.queue.map(due => due.at))) - this.now() : undefined;
    if (wake !== undefined) this.soon(Math.max(1000, wake));
  }
  close() { if (this.timer) clearTimeout(this.timer); this.timer = undefined; }

  private soon(ms: number) {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.timer = undefined; void this.flush(); }, ms);
    this.timer.unref?.();
  }
  private next(): Due | undefined {
    const now = this.now();
    return now < this.heldUntil ? undefined : this.queue.find(due => due.at <= now);
  }
  private drop(due: Due) { const at = this.queue.indexOf(due); if (at >= 0) this.queue.splice(at, 1); }
  /** Tried again later - for about a day, then let go (the player's next settlement or sign-in offers it again). */
  private later(due: Due) { due.tries++; due.at = this.now() + backoff(due.tries); if (due.tries > TRIES) { this.drop(due); this.log(`[p2] ${due.feat}: not taken after ${TRIES} tries; offered again at the player's next settlement`); } }

  /** One trophy given, and what Player Two answered acted on. */
  private async give(due: Due) {
    let response: Response | undefined;
    try {
      response = await this.fetcher(`${this.site}/api/v1/sdk/server/trophies/${encodeURIComponent(due.feat)}`, {
        method: 'POST', headers: { authorization: `Bearer ${this.key}`, 'content-type': 'application/json' }, body: JSON.stringify({ player: due.player }), signal: AbortSignal.timeout(10_000),
      });
    } catch { this.later(due); return; }
    if (response.ok) {
      this.drop(due);
      const given = this.given.get(due.player) ?? new Set<string>();
      given.add(due.feat); this.given.set(due.player, given);
      this.keep();
      return;
    }
    const answer = await response.json().catch(() => ({})) as { code?: string; error?: string };
    if (response.status === 401) { this.heldUntil = this.now() + 3600_000; this.log(`[p2] Player Two refused the game key (401): trophies wait an hour. ${answer.error ?? ''}`); return; }
    // Busy, away, or a trophy not defined there yet (scripts/p2/trophies.mjs not run): tried again later.
    if (response.status === 429 || response.status >= 500 || answer.code === 'unknown-trophy' || answer.code === 'unknown-player') {
      if (due.tries === 0 && response.status < 500) this.log(`[p2] ${due.feat}: ${response.status} ${answer.code ?? ''} ${answer.error ?? ''}; tried again later`);
      this.later(due); return;
    }
    // Anything else (a demo player's, a refusal of the request itself) is not Player Two's to take: dropped, and
    // offered again only at a later settlement.
    this.log(`[p2] ${due.feat}: ${response.status} ${answer.code ?? ''} ${answer.error ?? ''}; dropped`);
    this.drop(due);
  }

  /** p2-trophies.json written whole (to a file beside it, then swapped in). */
  private keep() {
    if (!this.file) return;
    try {
      const tmp = `${this.file}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify({ given: Object.fromEntries([...this.given].map(([player, feats]) => [player, [...feats]])) }));
      fs.renameSync(tmp, this.file);
    } catch (error) { this.log(`[p2] p2-trophies.json could not be written: ${String(error)}`); }
  }
}
