export const HOLD_AHEAD = 12;
export const HOLD_MAX = 25;

export class QueueHold {
  private base: number | null = null;
  private until = -Infinity;
  /** A lone page asked to hold: `start` is the room's start now (none: nothing to hold). */
  ask(now: number, start: number | null) {
    if (start === null || !Number.isFinite(start)) return;
    this.base ??= start;
    this.until = Math.min(this.base + HOLD_MAX, Math.max(this.until, now + HOLD_AHEAD));
  }
  /** The start as held. */
  apply<T extends number | null>(start: T): T { return (start === null ? start : Math.max(start, this.until)) as T; }
  /** The room's countdown stopped or ended: the next lone wait is held afresh. */
  reset() { this.base = null; this.until = -Infinity; }
  get held() { return this.until > -Infinity; }
}
