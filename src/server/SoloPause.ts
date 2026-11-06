import type { Client } from 'colyseus';
import type { PauseView } from '../game/types';

/**
 * Round 5 (SOLOPAUSE): a real pause for a room with one human in it.
 *
 * The blind UX critic, 6 October: BR VS BOTS - "OFFLINE / Pause any time" on its card - went on behind the menu, and
 * the critic was knocked out reading the move list. A room is paused here, on the server, the only place a pause can
 * be real: while it is frozen the room does not step at all - no tick, no bot's thought, no countdown, no projectile -
 * so nothing has moved when it thaws, and every clock simply carries on from where it stood.
 *
 * Who may pause: the room's one human (bots never count), in a room whose phase allows it (`PauseRoom.open`). A room
 * with two or more humans never pauses, and one that gains a second human lets go of a pause at once.
 *
 * The commands already on their way when the player asked are honoured, not dropped: a pause is taken once the
 * human's queued commands are played out (the client sends nothing after asking, and a WebSocket keeps order, so an
 * empty queue means everything it sent before the request has been played), or after PAUSE_FENCE_TICKS at most. The
 * world the room freezes is then the one the player's own prediction had reached, and nothing jumps under the menu.
 *
 * No input is accepted while frozen (the room drops it), a pause needs PAUSE_REARM_TICKS of play behind it before it
 * takes (so pause and resume pressed in turn cannot step the fight a frame at a time), and a room is let go of a pause
 * after PAUSE_LIMIT_MS. Requests carry a serial (`n`), echoed back as PauseView.ack, so the client can tell a snapshot
 * written before the server heard its latest request from one written after.
 */
/** Ticks of play a pause needs behind it before it takes: three quarters of a second. */
export const PAUSE_REARM_TICKS = 45;
/** The most ticks a pause waits for the human's commands in flight to be played. */
export const PAUSE_FENCE_TICKS = 30;
/** A pause is let go of after this long, so a menu left open does not hold a room for ever. */
export const PAUSE_LIMIT_MS = 15 * 60 * 1000;
/** A frozen room still sends its snapshot this often, so its player's link reads as alive. */
export const PAUSE_BEAT_MS = 250;

/** What a room tells its pause. */
export interface PauseRoom {
  /** The session id of the room's one human (connected, or holding a reconnection), or undefined when it has none or
   *  more than one. Bots never count. */
  solo(): string | undefined;
  /** Whether the room's phase allows a pause now (a fight, or a solo room's countdown; never a lobby). */
  open(): boolean;
  /** Commands of this human's still waiting in the room's input queue. */
  queued(id: string): number;
  /** The room has frozen: drop whatever is queued and tell the client now. */
  frozen(): void;
  /** The room has thawed after `ms` milliseconds frozen: shift any wall-clock timer and tell the client now. */
  thawed(ms: number): void;
  /** While frozen, every PAUSE_BEAT_MS: send the (unchanged) snapshot. */
  beat(): void;
}

const serial = (raw: unknown) => {
  const n = typeof raw === 'object' && raw !== null ? (raw as { n?: unknown }).n : raw;
  return typeof n === 'number' && Number.isSafeInteger(n) && n > 0 ? n : undefined;
};

export class SoloPause {
  /** The room is held: it must not step. */
  frozen = false;
  /** A pause taken and waiting for the human's commands in flight. */
  private pending = false;
  /** The serial of the last request handled. */
  private ack = 0;
  private waited = 0;
  /** Ticks played since the room last thawed. */
  private live = Infinity;
  private since = 0;
  private beatAt = 0;
  /** Wall-clock milliseconds this room has spent frozen, all told. */
  frozenMs = 0;
  constructor(private readonly room: PauseRoom) {}

  /** The room would freeze for its one human now. */
  get pausable() { return this.room.solo() !== undefined && this.room.open(); }

  /** `pause` or `resume` from a client, `{ n }` its serial. Only the room's one human is heard. */
  request(client: Pick<Client, 'sessionId'>, raw: unknown, pause: boolean, now = Date.now()) {
    const n = serial(raw);
    if (n === undefined || n <= this.ack || client.sessionId !== this.room.solo()) return;
    this.ack = n;
    if (!pause) { this.release(now); return; }
    if (this.frozen || this.pending || !this.room.open()) return;
    this.pending = true; this.waited = 0;
  }

  /** Called ahead of every fixed step: true means hold - do not step, do not read the input queues. */
  hold(now = Date.now()): boolean {
    if ((this.frozen || this.pending) && !this.pausable) this.release(now);
    if (this.pending) {
      const id = this.room.solo()!;
      if (this.live < PAUSE_REARM_TICKS || (this.room.queued(id) > 0 && this.waited < PAUSE_FENCE_TICKS)) {
        this.waited++; this.live++;
        return false;
      }
      this.freeze(now);
      return true;
    }
    if (this.frozen) {
      if (now - this.since >= PAUSE_LIMIT_MS) { this.release(now); this.live++; return false; }
      if (now - this.beatAt >= PAUSE_BEAT_MS) { this.beatAt = now; this.room.beat(); }
      return true;
    }
    if (this.live !== Infinity) this.live++;
    return false;
  }

  /** The human's connection dropped: in a room that would pause for them, it holds while they reconnect (the queue is
   *  already cleared and nothing of theirs is in flight). */
  drop(id: string, now = Date.now()) {
    if (!this.frozen && id === this.room.solo() && this.room.open()) this.freeze(now);
  }

  view(): PauseView {
    return { paused: this.frozen, ...(this.pending ? { pausing: true } : {}), pausable: this.pausable, ack: this.ack };
  }

  private freeze(now: number) {
    this.frozen = true; this.pending = false; this.since = this.beatAt = now;
    this.room.frozen();
  }

  private release(now: number) {
    this.pending = false;
    if (!this.frozen) return;
    this.frozen = false; this.live = 0;
    const ms = Math.max(0, now - this.since);
    this.frozenMs += ms;
    this.room.thawed(ms);
  }
}
