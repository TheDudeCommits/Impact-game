/** An online match kept across the reload a lost graphics context forces (the stability pass, 2 November 2026: 156
 *  context losses on the live log, mostly iPhones mid-match). boot/pageLife.ts reloads a page whose context has not
 *  come back after five seconds on screen; the player came back to the home, and their fighter stood idle in the room
 *  until it let them go.
 *
 *  Now, just before that reload, the room's reconnection token and the start that joined it are kept in sessionStorage
 *  (this tab only; gone with it), and the room is not left: the page closing drops the socket, and the room holds the
 *  seat (ArenaRoom and ObjectiveRoom 15 s, RiftRoom and SurvivalRoom 20 s). The reloaded page takes them back at once and
 *  starts the same match by reconnecting with the token (network.ts `resumeWith`) instead of joining anew. A token
 *  older than REJOIN_WINDOW is not tried: the room has let the seat go. */

const KEY = 'jump-rejoin';
/** The longest any room holds a dropped seat (RiftRoom, SurvivalRoom). */
export const REJOIN_WINDOW = 20_000;

export interface Rejoin { token: string; start: unknown[]; at: number }
type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const session = (): Store | undefined => { try { return typeof sessionStorage === 'object' ? sessionStorage : undefined; } catch { return undefined; } };

/** Kept for the reload: the token and the start's arguments (fighter, mode, name, access). */
export function saveRejoin(token: string, start: readonly unknown[], store = session(), now = Date.now()): boolean {
  try { store?.setItem(KEY, JSON.stringify({ token, start, at: now })); return store?.getItem(KEY) !== null && store?.getItem(KEY) !== undefined; } catch { return false; }
}

/** What was kept, taken (once), if it is whole and young enough to try. */
export function takeRejoin(store = session(), now = Date.now()): Rejoin | undefined {
  let raw: string | null | undefined;
  try { raw = store?.getItem(KEY); store?.removeItem(KEY); } catch { return undefined; }
  if (!raw) return undefined;
  try {
    const kept = JSON.parse(raw) as Partial<Rejoin> | null;
    if (!kept || typeof kept.token !== 'string' || !kept.token || !Array.isArray(kept.start) || typeof kept.start[0] !== 'string' || typeof kept.at !== 'number') return undefined;
    if (now - kept.at > REJOIN_WINDOW || now < kept.at - 1000) return undefined;
    // (JSON keeps an absent access as null: the start's defaults want it undefined.)
    return { token: kept.token, start: kept.start.map(value => value === null ? undefined : value), at: kept.at };
  } catch { return undefined; }
}

/** What a reconnect that failed says (a plain Error: the player's to read, not a fault to report). */
export const REJOIN_FAILED = 'The match ended while the graphics reset. Press PLAY for another.';
