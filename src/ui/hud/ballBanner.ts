/**
 * The ball HUD's one banner slot and the one line under the score. Without them the
 * banner landed on Sky Spike's net and on Goal Rush's goal mouth, a newer banner wiped the one that mattered (a PERFECT
 * STRIKE's over the GOAL it scored), and a ticker and a chat feed stacked more text beside it. Now each of the two is a
 * `Slot`: one thing shown at a time, chosen by what it is worth, the rest dropped rather than stacked.
 *
 * - **The banner** (`BANNER_RULES`): a moment worth as much as the one up, or more, takes its place at once (a GOAL over
 *   a PERFECT STRIKE, the next count over the last); a lesser one waits - one at most, the best of those that came - and
 *   is shown briefly when the slot frees, if it is still news by then; everything else is dropped. The kickoff's count
 *   is `urgent`: it is shown on its beat or not at all.
 * - **The line under the score** (`LINE_RULES`): who did what - the scorer, the assist, the shot's speed. Nothing waits:
 *   the newest line takes the place of the last, except that a lesser line leaves a better one its first second.
 *
 * Where the two stand is ballHud.css's (`--bh-*`, the top stack: the score bug, the line, the banner, each directly
 * under the last); ballBanner.test.ts reads those numbers and checks the banner against the net and the goal mouths as
 * the default cameras frame them.
 */
export interface Shown {
  /** What it is worth (BANNER_RANK, LINE_RANK): the higher takes the slot. */
  priority: number;
  /** How long it is up, ms. */
  ms: number;
  /** Shown on its beat or not at all: it never waits (the kickoff's count). */
  urgent?: boolean;
}
export interface SlotRules {
  /** A lesser item waits for the slot (one at most) instead of being dropped. */
  wait?: boolean;
  /** A waiting item older than this (ms) when the slot frees is no longer news: dropped. */
  fresh?: number;
  /** The longest a waited item is up (ms): it comes late, so it is short. */
  brief?: number;
  /** An item up this long (ms) gives way to a lesser one. Without it, only to one worth as much or more. */
  yieldAfter?: number;
}
export const BANNER_RULES: SlotRules = { wait: true, fresh: 1500, brief: 1100 };
export const LINE_RULES: SlotRules = { yieldAfter: 1000 };

/** What each banner is worth. The match's end over everything; the count on its beat over a celebration still up; a
 *  goal or a point over the play that made it; then the turns of a match, the duels, the stops, the fights, the skills. */
export const BANNER_RANK = { win: 100, count: 95, score: 90, turn: 80, duel: 70, stop: 60, fight: 50, skill: 40 } as const;
/** What each line is worth: a moment with a name (an accolade, the post, a super shot) over a fight's, over a strike's. */
export const LINE_RANK = { named: 3, fight: 2, strike: 1 } as const;

/** One place on screen, one thing in it at a time. Pure: the HUD offers items as the room's events come and asks each
 *  tick what is up (`frame`), writing the DOM only when that changes. Nothing is allocated in a tick. */
export class Slot<T extends Shown> {
  private up: T | null = null; private upAt = 0; private upUntil = 0;
  private next: T | null = null; private nextAt = 0;
  constructor(private readonly rules: SlotRules = {}) {}

  /** A new item: true when it is up at once, false when it waits or is dropped. */
  offer(item: T, now: number): boolean {
    this.frame(now);
    const up = this.up;
    if (!up || item.priority >= up.priority || (this.rules.yieldAfter !== undefined && now - this.upAt >= this.rules.yieldAfter)) {
      this.up = item; this.upAt = now; this.upUntil = now + item.ms;
      return true;
    }
    // A lesser one: the best of those that came waits (the newest of equals), the rest are dropped.
    if (this.rules.wait && !item.urgent && (!this.next || item.priority >= this.next.priority)) { this.next = item; this.nextAt = now; }
    return false;
  }
  /** What is up now, or null: the one up ends on its time, and the one waiting takes the slot if it is still news. */
  frame(now: number): T | null {
    if (this.up && now >= this.upUntil) this.up = null;
    if (!this.up && this.next) {
      const item = this.next; this.next = null;
      if (now - this.nextAt <= (this.rules.fresh ?? Infinity)) { this.up = item; this.upAt = now; this.upUntil = now + Math.min(item.ms, this.rules.brief ?? item.ms); }
    }
    return this.up;
  }
  /** The one up let go now (a replay begins); the one waiting is dropped with it. */
  clear() { this.up = this.next = null; }
}
