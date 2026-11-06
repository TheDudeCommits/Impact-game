import { MESSAGE_MAX, scrub } from '../../game/errorReport';

/** Counts by the minute over the last day: a fixed 1,440 slots, so a flood (a throw every tick, thirty a second)
 *  costs no memory, only a bigger number. */
export class Tally {
  private readonly minute = new Float64Array(1440).fill(-1);
  private readonly count = new Float64Array(1440);
  add(at: number, n = 1) {
    const m = Math.floor(at / 60_000), slot = ((m % 1440) + 1440) % 1440;
    if (this.minute[slot] > m) return;   // (a day older than the slot's minute: out of the window already)
    if (this.minute[slot] !== m) { this.minute[slot] = m; this.count[slot] = 0; }
    this.count[slot] += n;
  }
  /** How many in the last `minutes` minutes (this minute included). */
  since(now: number, minutes: number) {
    const m = Math.floor(now / 60_000); let total = 0;
    for (let slot = 0; slot < 1440; slot++) if (this.minute[slot] > m - minutes && this.minute[slot] <= m) total += this.count[slot];
    return total;
  }
}

export interface ServerErrorEvent { at: number; kind: string; message: string }

/** An error in one line a log can carry: its name and its first line, scrubbed as a page's report is. */
export function describeError(error: unknown): string {
  const text = error instanceof Error ? `${error.name}: ${error.message}` : typeof error === 'string' ? error : (() => { try { return JSON.stringify(error) ?? String(error); } catch { return String(error); } })();
  const line = scrub(String(text).split('\n', 1)[0].slice(0, MESSAGE_MAX * 4)).trim();
  return line.length > MESSAGE_MAX ? `${line.slice(0, MESSAGE_MAX - 1)}…` : line || 'unknown';
}

export class ServerErrors {
  static readonly RECENT = 20;
  readonly recent: ServerErrorEvent[] = [];
  private readonly tally = new Tally();
  /** Where an event goes: here (`take`), unless a worker process sends it to the one that answers /health. */
  sink: (event: ServerErrorEvent) => void = event => this.take(event);
  constructor(private readonly now: () => number = Date.now) {}
  /** One error: never throws into the handler that reports it. */
  record(kind: string, error: unknown) {
    try { this.sink({ at: this.now(), kind: String(kind).slice(0, 40), message: describeError(error) }); } catch { /* a counter must not become the next error */ }
  }
  take(event: ServerErrorEvent) {
    if (!event || typeof event.at !== 'number' || !Number.isFinite(event.at)) return;
    this.tally.add(event.at);
    this.recent.push({ at: event.at, kind: String(event.kind).slice(0, 40), message: String(event.message).slice(0, MESSAGE_MAX) });
    if (this.recent.length > ServerErrors.RECENT) this.recent.shift();
  }
  counts(now = this.now()) { return { lastHour: this.tally.since(now, 60), lastDay: this.tally.since(now, 1440) }; }
}

/** The process's one recorder. */
export const serverErrors = new ServerErrors();
export const recordServerError = (kind: string, error: unknown) => serverErrors.record(kind, error);

export interface ClientCounts { lastHour: number; lastDay: number; groupsLastDay: number }
/** The pages' counts, lent by the reports' store when it is mounted (errorReports.ts); none until then. */
export const clientCounts: { read: (now: number) => ClientCounts } = { read: () => ({ lastHour: 0, lastDay: 0, groupsLastDay: 0 }) };

/** What /health says of errors: counts only. */
export function errorCounts(now = Date.now()) {
  return { client: clientCounts.read(now), server: serverErrors.counts(now) };
}
