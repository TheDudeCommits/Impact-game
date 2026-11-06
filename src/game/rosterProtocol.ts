/** Shared client/server roster identity. Bump whenever playable fighter IDs or their
 * wire-visible combat definitions change. A missing value is an old tab, never an
 * opt-out: even an original fighter can face a newly released opponent or bot. */
// v22 (1 November 2026): lock combat online - every fighter's light string plays it in the server's rooms.
// v24 (6 November 2026): the originals' own fighter ids on the wire (the clean): a tab of the old roster is refused.
export const ROSTER_PROTOCOL = 'roster-v24';
export const ROSTER_REFRESH_MESSAGE = 'Refresh the page to load the updated fighter roster.';
export interface RosterProtocolOptions { rosterProtocol?: unknown; }
export function requireRosterProtocol(value: unknown): void {
  if (value !== ROSTER_PROTOCOL) throw new Error(ROSTER_REFRESH_MESSAGE);
}
