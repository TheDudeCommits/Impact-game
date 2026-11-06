import type { GameSnapshot, PauseView } from './types';

/** A request not heard back about in this long is sent again (a link that dropped and came back). */
export const PAUSE_RETRY_MS = 1000;

export interface PauseRequest { type: 'pause' | 'resume'; n: number }

/**
 * Round 5 (SOLOPAUSE): this page's half of a room's pause (src/server/SoloPause.ts).
 *
 * main.ts says what the page wants each frame - the menu, a clip or a bug report open, or the tab hidden - and the
 * link turns it into the requests the room needs (`update`), numbered so that a snapshot written before the room heard
 * the newest one is not mistaken for its answer. While the room is frozen, or about to be for this page, the page
 * sends no commands (`holding`) and so predicts none: the room plays out what was already sent and freezes on the
 * world the page's own prediction had reached. On RESUME the page carries on from its next command; the commands
 * follow the request down the same ordered link, so the room has thawed by the time they arrive.
 *
 * The UI reads `state` (through hud.modes.paused, main.ts): 'paused' only once the room has said it is frozen.
 */
export class PauseLink {
  private view?: PauseView;
  /** The serial of the newest request sent, what it asked for, and when. */
  private n = 0;
  private asked: PauseRequest['type'] | null = null;
  private sentAt = -Infinity;

  /** A new room (or none): its serials start again. */
  reset() { this.view = undefined; this.n = 0; this.asked = null; this.sentAt = -Infinity; }

  /** Every snapshot of the room (a room that cannot pause sends no view). */
  observe(snapshot: Pick<GameSnapshot, 'pause'> | null | undefined) {
    this.view = snapshot?.pause;
    // A room that has handled more than this page knows of: the next request is numbered past it.
    if (this.view && this.view.ack > this.n) this.n = this.view.ack;
  }

  /** The room has handled the newest request this page sent. */
  private get heard() { return !!this.view && this.view.ack >= this.n; }

  /** The page must send no command now: the room is frozen, or freezing for this page, or has been asked to. */
  get holding() {
    const view = this.view;
    if (!view) return false;
    if (!this.heard) return this.asked === 'pause';
    return view.paused || !!view.pausing;
  }

  /** What the player is shown: 'paused' once the room has said it is frozen, 'pausing' while it plays out what was
   *  already sent (or is yet to hear the request), 'live' otherwise. */
  get state(): 'live' | 'pausing' | 'paused' {
    if (!this.holding) return 'live';
    return this.heard && this.view!.paused ? 'paused' : 'pausing';
  }

  /** The room would freeze for this page now (it is the room's one human, in a fight). */
  get pausable() { return !!this.view?.pausable; }

  /** The request to send now, if any, for the room to do what the page wants. */
  update(want: boolean, now: number): PauseRequest | undefined {
    const view = this.view;
    if (!view) return;
    const holding = this.holding;
    const desired = want && (view.pausable || holding);
    if (desired !== holding) return this.send(desired ? 'pause' : 'resume', now);
    // Unanswered for a second (a link that dropped as it went): asked again.
    if (!this.heard && this.asked && now - this.sentAt >= PAUSE_RETRY_MS) return this.send(this.asked, now);
    return undefined;
  }

  private send(type: PauseRequest['type'], now: number): PauseRequest {
    this.asked = type; this.sentAt = now;
    return { type, n: ++this.n };
  }
}
