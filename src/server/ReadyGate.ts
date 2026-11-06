import type { Client, Room } from 'colyseus';

/**
 * Round 5 (SOLOPAUSE): who has the fight on screen.
 *
 * The blind UX critic, 6 October: in BR VS BOTS it had already taken damage by its first frame, after a 13 s load;
 * in the arcade it was hit inside its first second. The asset barrier (social/AssetGate.ts) says a page has the
 * room's models; this says its player can see the room: a page that joined with `readyGate: true` sends `ready` once
 * its loading screen has gone and a frame of the fight has been drawn behind it (main.ts). A solo room starts its
 * READY hold from that moment (READY_SECONDS, then FIGHT); a room of several humans holds its kickoff for a page that
 * came up late (LATE_HOLD_SECONDS after it). Capped: a page that never says it - a hidden tab, an older build that
 * does not know the message - is counted as up READY_WAIT_SECONDS after the room began waiting on it, so nobody can
 * stall a match. Times are on the room's own clock (the simulation's), which a pause holds still.
 */
/** The READY hold a solo room runs from its player's screen coming up to FIGHT: the VS splash's length
 *  (MatchIntro.INTRO_SECONDS 2.7 s) and a breath. */
export const READY_SECONDS = 3;
/** The least a room of several humans holds its kickoff after the last of their screens came up. */
export const LATE_HOLD_SECONDS = 2;
/** The longest a room waits on a page's `ready` once nothing else holds it back. */
export const READY_WAIT_SECONDS = 5;

export class ReadyGate {
  private readonly expected = new Set<string>();
  /** When each gated page said its fight was on screen. */
  private readonly shown = new Map<string, number>();
  /** When the room first stood waiting on nothing but these screens. */
  private waitingSince: number | null = null;
  constructor(room: Pick<Room, 'onMessage'>, private readonly clock: () => number) {
    room.onMessage('ready', (client: Client) => this.mark(client.sessionId));
  }
  /** A joining page: gated only if it asked to be (`readyGate: true`, src/network.ts). */
  add(client: Pick<Client, 'sessionId'>, enabled: unknown) { if (enabled === true) this.expected.add(client.sessionId); }
  remove(id: string) { this.expected.delete(id); this.shown.delete(id); }
  gated(id: string) { return this.expected.has(id); }
  mark(id: string) { if (this.expected.has(id) && !this.shown.has(id)) this.shown.set(id, this.clock()); }
  /** Every gated page among `ids` has its fight on screen, or the room has waited READY_WAIT_SECONDS on them (each
   *  then counts as up from now). */
  ready(ids: readonly string[]) {
    if (!ids.some(id => this.expected.has(id) && !this.shown.has(id))) { this.waitingSince = null; return true; }
    const now = this.clock();
    this.waitingSince ??= now;
    if (now - this.waitingSince < READY_WAIT_SECONDS) return false;
    for (const id of ids) if (this.expected.has(id) && !this.shown.has(id)) this.shown.set(id, now);
    this.waitingSince = null;
    return true;
  }
  /** When the last gated page among `ids` came on screen, or -Infinity. */
  lastShown(ids: readonly string[]) {
    let at = -Infinity;
    for (const id of ids) { const t = this.shown.get(id); if (t !== undefined && t > at) at = t; }
    return at;
  }
}
