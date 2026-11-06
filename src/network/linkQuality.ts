/** A gap between two snapshots longer than this is a stall (a snapshot comes every 33 ms). */
export const STALL_MS = 250;
/** A frame at least this long is the page not keeping up: the part of a silence it covers is the page's, not the link's.
 *  (A weak device's ordinary frames, 50-80 ms, stay under it, so a stall there is still the link's.) */
export const PAGE_FRAME_MS = 100;
export const LAG_SHOW_MS = 350;
export const LAG_HIDE_MS = 300;
/** A stall is worth a word if it was this long and this recent. */
export const STALL_NOTE_MS = 500;
export const STALL_NOTE_AGE_MS = 10_000;
/** Stalls are remembered this long. */
const STALL_KEEP_MS = 30_000;

export class LinkQuality {
  /** Smoothed round trip in milliseconds; NaN until the first pong. */
  rtt = NaN;
  /** Smoothed deviation of the round trip, milliseconds. */
  jitter = 0;
  /** Lowest round trip seen (the link's floor). */
  best = Infinity;
  pings = 0;
  pongs = 0;
  private lastHeard = 0;
  private stalls: { at: number; ms: number }[] = [];
  /** Silences the page's own frames accounted for (the evidence: a report of lag says the page froze, not the link). */
  private holds: { at: number; ms: number }[] = [];
  private lagging = false;
  /** The last animation frame's time, and how much of the silence since `lastHeard` the page's long frames have covered. */
  private lastFrame = 0;
  private held = 0;

  reset() { this.rtt = NaN; this.jitter = 0; this.best = Infinity; this.pings = this.pongs = 0; this.lastHeard = 0; this.stalls.length = 0; this.holds.length = 0; this.held = 0; this.lagging = false; }

  /** The game loop's animation frame, at `now` (main.ts `frame`, every frame, before anything can return early). */
  frame(now: number) {
    if (this.lastFrame && now > this.lastFrame) this.held += this.pageShare(this.lastFrame, now);
    this.lastFrame = now;
  }

  /** How much of the silence since the last snapshot the frame from `start` to `end` covers, if it was a long one. */
  private pageShare(start: number, end: number) {
    const from = Math.max(start, this.lastHeard);
    return end - start >= PAGE_FRAME_MS && end > from ? end - from : 0;
  }

  /** A ping is about to be sent; the value is the `clientTime` it carries and the room echoes. */
  ping(now: number) { this.pings++; return now; }

  /** The room's pong. `clientTime` is what the ping carried; a stale or forged echo is ignored. */
  pong(clientTime: unknown, now: number) {
    if (typeof clientTime !== 'number' || !Number.isFinite(clientTime)) return;
    const sample = now - clientTime;
    if (!(sample >= 0 && sample < 60_000)) return;
    this.pongs++;
    this.best = Math.min(this.best, sample);
    if (!Number.isFinite(this.rtt)) this.rtt = sample;
    else { this.jitter += (Math.abs(sample - this.rtt) - this.jitter) * .25; this.rtt += (sample - this.rtt) * .25; }
  }

  /** Something arrived from the room (a snapshot, a frame) at `now`. A long silence before it was a stall, less what the
   *  page's own long frames inside it account for: the ones the game loop has handed in, and the one still open (a long
   *  task this message waited behind, its frame not yet drawn). A hidden page draws no frames, so it judges no silence. */
  heard(now: number) {
    if (this.lastHeard && now - this.lastHeard >= STALL_MS) {
      const gap = now - this.lastHeard, page = Math.min(gap, this.held + (this.lastFrame ? this.pageShare(this.lastFrame, now) : 0));
      if (gap - page >= STALL_MS) keep(this.stalls, now, gap - page);
      if (page >= STALL_MS) keep(this.holds, now, page);
    }
    this.lastHeard = now;
    this.held = 0;
  }

  /** The longest stall of the last `within` milliseconds, or 0. */
  stalled(now: number, within = STALL_KEEP_MS) {
    let longest = 0;
    for (const s of this.stalls) if (now - s.at <= within && s.ms > longest) longest = s.ms;
    return longest;
  }

  /** The words for the HUD, or undefined while the link is good. */
  note(now: number) {
    const stall = this.stalled(now, STALL_NOTE_AGE_MS);
    if (stall >= STALL_NOTE_MS) return `UNSTABLE CONNECTION · ${(stall / 1000).toFixed(1)} S STALL`;
    if (Number.isFinite(this.rtt)) {
      if (this.lagging ? this.rtt < LAG_HIDE_MS : this.rtt >= LAG_SHOW_MS) this.lagging = !this.lagging;
      if (this.lagging) return `LAG · ${Math.round(this.rtt)} MS`;
    }
    return undefined;
  }

  /** One line for the bug report's connection field: what the link has been doing, so a report of lag says whose it was. */
  summary(now: number) {
    const v = this.view(now);
    if (v.rtt === null) return '';
    return ` · ping ${v.rtt} ms (best ${v.best}, jitter ${v.jitter})${v.stalls ? ` · ${v.stalls} stall${v.stalls === 1 ? '' : 's'} in 30 s, longest ${v.longestStall} ms` : ''}${v.pageHolds ? ` · page froze ${v.pageHolds} time${v.pageHolds === 1 ? '' : 's'}, longest ${v.longestPageHold} ms` : ''}`;
  }

  /** For the evidence probes. */
  view(now: number) {
    const holds = this.holds.filter(s => now - s.at <= STALL_KEEP_MS);
    return { rtt: Number.isFinite(this.rtt) ? Math.round(this.rtt) : null, jitter: Math.round(this.jitter), best: Number.isFinite(this.best) ? Math.round(this.best) : null,
      pings: this.pings, pongs: this.pongs, stalls: this.stalls.filter(s => now - s.at <= STALL_KEEP_MS).length, longestStall: Math.round(this.stalled(now)),
      pageHolds: holds.length, longestPageHold: Math.round(holds.reduce((longest, s) => Math.max(longest, s.ms), 0)) };
  }
}

function keep(list: { at: number; ms: number }[], at: number, ms: number) {
  list.push({ at, ms });
  while (list.length && at - list[0].at > STALL_KEEP_MS) list.shift();
}
