import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { PROGRESS_LIMITS, anything, applyReport, cleanCareer, cleanRift, emptyState, fold, forward, plausibleFacts, plausibleMatch, readReport, type ProgressState, type SyncAnswer, type SyncBody } from '../../game/progress/rules';

export const PROGRESS_CLOCK = {
  /** Seconds of play taken for each second of the wall clock since the last. */
  slack: 1.2,
  /** Seconds allowed past the account's age, for its first (a run begins as the account is opened). */
  first: 120,
  /** The most play a clock holds in hand, seconds: a month away is not a month of runs to send at once. */
  hold: 24 * 3600,
} as const;
/** Records kept in memory (a file holds the rest). */
const CACHED = 500;

interface Kept { v: 1; pk: string; state: ProgressState; base: ProgressState; ids: string[]; clock: { run: number; match: number }; at: number }

const fresh = (pk: string, created: number): Kept => {
  const start = created - PROGRESS_CLOCK.first / PROGRESS_CLOCK.slack * 1000;
  return { v: 1, pk, state: emptyState(), base: emptyState(), ids: [], clock: { run: start, match: start }, at: 0 };
};
/** A file written whole: to a file beside it, synced, swapped in (a crash leaves the old or the new). */
function writeWhole(file: string, text: string) {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, text, { flush: true } as fs.WriteFileOptions);
  fs.renameSync(tmp, file);
}

export class ProgressStore {
  private readonly cache = new Map<string, Kept>();
  private readonly folder?: string;

  /** `dir`: the economy's folder on the volume (none: memory only, as a test or a server with no volume). */
  constructor(dir?: string, private readonly now: () => number = Date.now) {
    // (The folder is made with the first file: a server whose players never sent any has none.)
    if (dir) this.folder = path.join(dir, 'progress');
  }
  private made = false;
  private file(pk: string) {
    const name = /^[A-Za-z0-9_-]{1,64}$/.test(pk) ? pk : crypto.createHash('sha256').update(pk).digest('hex');
    return path.join(this.folder!, `${name}.json`);
  }
  private read(pk: string): Kept | undefined {
    const hit = this.cache.get(pk);
    if (hit) { this.cache.delete(pk); this.cache.set(pk, hit); return hit; }
    if (!this.folder) return undefined;
    let kept: Kept;
    try { kept = JSON.parse(fs.readFileSync(this.file(pk), 'utf8')) as Kept; } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') console.error(`[progress] ${pk}'s file does not read; it starts again from what the page sends`, error);
      return undefined;
    }
    if (kept?.v !== 1 || kept.pk !== pk || !kept.state || !kept.base) return undefined;
    this.remember(kept);
    return kept;
  }
  private remember(kept: Kept) {
    this.cache.delete(kept.pk); this.cache.set(kept.pk, kept);
    // (Memory only: the cache is all there is, and nothing is let go.)
    if (this.folder) while (this.cache.size > CACHED) this.cache.delete(this.cache.keys().next().value!);
  }
  private write(kept: Kept) {
    kept.at = this.now();
    // (The matches a career has counted, by id: the page's own career keeps them to refuse a match twice; the last few are plenty.)
    kept.state.career.seen = kept.state.career.seen.slice(-64);
    kept.base.career.recent = []; kept.base.career.seen = [];
    if (this.folder) {
      if (!this.made) { fs.mkdirSync(this.folder, { recursive: true }); this.made = true; }
      writeWhole(this.file(kept.pk), JSON.stringify(kept));
    }
    this.remember(kept);
  }
  private drop(pk: string) {
    this.cache.delete(pk);
    if (this.folder) fs.rmSync(this.file(pk), { force: true });
  }

  /** An account's progress as it stands (none yet: an empty one). */
  get(pk: string): ProgressState { return structuredClone(this.read(pk)?.state ?? emptyState()); }

  /** A page's import and reports for account `pk` (opened by its token; `created`: when it was): taken in, and the
   *  progress as it now stands, the reports dealt with, and how long the rest should wait. */
  sync(pk: string, created: number, raw: unknown): SyncAnswer {
    const body = (raw && typeof raw === 'object' ? raw : {}) as SyncBody, now = this.now();
    const had = this.read(pk), kept = had ? structuredClone(had) : fresh(pk, Number.isFinite(created) ? created : now);
    let changed = false;
    if (body.import && typeof body.import === 'object') {
      const brought = { rift: cleanRift(body.import.rift), career: cleanCareer(body.import.career, now) };
      if (anything(brought)) { kept.state = forward(kept.state, brought); kept.base = forward(kept.base, brought); changed = true; }
    }
    const done: string[] = [];
    let wait: number | undefined;
    for (const each of Array.isArray(body.reports) ? (body.reports as unknown[]).slice(0, PROGRESS_LIMITS.perSync) : []) {
      const report = readReport(each), id = (each as { id?: unknown } | null)?.id;
      // (One that does not read never will: it is let go, so it holds up nothing after it.)
      if (!report) { if (typeof id === 'string' && id.length <= 64) done.push(id); continue; }
      if (kept.ids.includes(report.id)) { done.push(report.id); continue; }
      const clock = report.kind === 'run' ? 'run' : report.kind === 'match' ? 'match' : undefined;
      if (clock) {
        const seconds = (report.kind === 'run' ? plausibleFacts(report.facts)?.seconds : report.kind === 'match' ? plausibleMatch(report.match)?.seconds : 0) ?? 0;
        const from = Math.max(kept.clock[clock], now - PROGRESS_CLOCK.hold * 1000), allowed = Math.max(0, now - from) / 1000 * PROGRESS_CLOCK.slack;
        // Too long for the time since the last: it waits, and what came after it (in order: a node bought with its shards).
        if (seconds > allowed) { wait = Math.ceil((seconds - allowed) / PROGRESS_CLOCK.slack); break; }
        kept.clock[clock] = from + seconds / PROGRESS_CLOCK.slack * 1000;
      }
      applyReport(kept.state, report, now);
      kept.ids = [...kept.ids, report.id].slice(-PROGRESS_LIMITS.ids);
      done.push(report.id); changed = true;
    }
    if (changed && (had || anything(kept.state))) this.write(kept);
    return { pk, rift: kept.state.rift, career: kept.state.career, done, ...(wait !== undefined ? { wait } : {}) };
  }

  /** Account `gone` folded into `into` (Book.retire: a guest's taken in at sign-in): their progress made one (rules.ts
   *  fold), and `gone`'s file goes. */
  fold(gone: string, into: string) {
    const from = this.read(gone);
    if (!from || gone === into) return;
    const was = this.read(into), next = was ? structuredClone(was) : fresh(into, this.now());
    next.state = fold(next.state, from.state, from.base);
    next.base = forward(next.base, from.base);
    next.ids = [...next.ids, ...from.ids.filter(id => !next.ids.includes(id))].slice(-PROGRESS_LIMITS.ids);
    next.clock = { run: Math.max(next.clock.run, from.clock.run), match: Math.max(next.clock.match, from.clock.match) };
    this.write(next);
    this.drop(gone);
  }
  /** An account deleted (Book.forget): its progress goes with it. */
  forget(pk: string) { this.drop(pk); }
}
