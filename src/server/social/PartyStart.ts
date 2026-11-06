/** Seconds of the room's own count once a party is all in and loaded ("Everyone is here — the match starts in 3"). */
export const PARTY_COUNTDOWN = 3;
/** How long a party's room waits for everyone before the host's own START is shown again (today's manual start). The
 *  room still starts by itself if the last of them comes in after that. */
export const PARTY_GRACE_SECONDS = 45;

export class PartyStart {
  /** The members the party reserved seats for (0: not a party's room). */
  readonly seats: number;
  /** Still waiting to start the party's first match by itself. */
  private armed: boolean;
  constructor(raw: unknown, max: number, min = 1) {
    this.seats = typeof raw === 'number' && Number.isInteger(raw) && raw >= min && raw <= max ? raw : 0;
    this.armed = this.seats > 0;
  }
  get party() { return this.seats > 0; }
  get waiting() { return this.armed; }
  /** Everyone the party sent is in, and nobody is reconnecting. */
  complete(present: number, dropped: number) { return this.armed && present >= this.seats && dropped === 0; }
  /** The host's START is shown: the party's own start was given up, or it has waited long enough for it. */
  manual(now: number) { return !this.armed || now >= PARTY_GRACE_SECONDS; }
  /** A member left before the start: the host decides when to begin, as in any private room. */
  left() { this.armed = false; }
  /** The first match began (by itself, or by the host's START): what follows is the room's own. */
  started() { this.armed = false; }
  /** For the page (RoomLobby, ObjectiveView): a party's room, and whether it will start by itself (no START to press). */
  view(now: number): { party?: true; autoStart?: boolean } { return this.seats ? { party: true, autoStart: !this.manual(now) } : {}; }
}
