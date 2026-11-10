import {goalNetHit} from './hype';

/** The goal's hold, on the page's own clock from the moment the page draws the goal (the
 *  room's runs on: online the match never waits for a page). NET_PEAK after it the goal's net is at its furthest stretch
 *  (BallArena's net swings out over its first .07 s), and the picture holds there for HOLD seconds: the frame drawn then
 *  is kept on the screen over the canvas (BallShow.holdFrame), and the net's own clock (hype.ts `goalNetHit`, which the
 *  arena's goal celebration is timed by too) is held at its stretch, so the net springs back from where it held and the
 *  celebration starts as late as the hold was long. The goal's sequence is the room's and keeps its length
 *  (GOAL_RULES.goalSeconds, REPLAY.goalCeremony): the hold is inside its first half second, before the close-up. */
export const NET_PEAK = .07, HOLD = .12;

/** What this frame is to the hold (GoalHold.frame): nothing, the frame to keep, or a frame under the held picture. */
export type HoldFrame = 'none' | 'capture' | 'held';

/**
 * The hold, for BallCeremony: begun at a goal (a single lens's: not in a couch split), told every frame before anything
 * is drawn and once the frame is drawn (the canvas holds the frame until the page yields). Nothing allocates in a frame.
 */
export class GoalHold {
  private at = -Infinity; private heldAt = -Infinity; private released = true; private role: HoldFrame = 'none';
  /** For the checks: the last goal's hold (when it began and how long the picture held, page seconds). */
  readonly last = {heldAt: 0, held: 0};

  constructor(private readonly show: {holdFrame(canvas: HTMLCanvasElement | null): void}) {}

  /** A goal drawn now (page seconds `page`). */
  goal(page: number) {
    this.finish();
    this.at = page; this.heldAt = -Infinity; this.released = false;
  }

  /** Every frame before anything is drawn: what this frame is to the hold, and the net held at its stretch meanwhile. */
  frame(page: number): HoldFrame {
    if (this.released) return this.role = 'none';
    if (!Number.isFinite(this.heldAt)) return this.role = page - this.at < NET_PEAK - 1e-6 ? 'none' : 'capture';
    goalNetHit.value.w = page - NET_PEAK;
    if (page - this.heldAt >= HOLD - 1e-6) { this.release(page); return this.role = 'none'; }
    return this.role = 'held';
  }

  /** Once the frame is drawn: the one at the net's stretch kept as the held picture. */
  afterDraw(canvas: HTMLCanvasElement, page = performance.now() / 1000) {
    if (this.role !== 'capture') return;
    this.show.holdFrame(canvas);
    this.heldAt = page; this.last.heldAt = page; this.last.held = 0;
    goalNetHit.value.w = page - NET_PEAK;
  }

  get holding() { return this.role === 'held'; }

  private release(page: number) {
    if (this.released) return;
    this.released = true; this.role = 'none';
    if (Number.isFinite(this.heldAt)) { this.show.holdFrame(null); this.last.held = page - this.heldAt; goalNetHit.value.w = page - NET_PEAK; }
  }
  /** The hold let go (a new goal, leaving the match). */
  finish() { this.release(performance.now() / 1000); }
}
