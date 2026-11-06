/** Night cap (12 October 2026): what a player reads when the match server turns a new room away because it is full or
 *  falling behind (src/server/capacity.ts: ROOM_CAP, LOAD_SHED). The words are shared so the page can recognise them
 *  whatever else wraps the error (Colyseus' ServerError, Rift War's HTTP answer, a party's launch) and show them as they are
 *  (joinFailure in src/network.ts). Only a NEW room is refused: a player joining a room that is already open is never
 *  turned away, and a match already running is never touched. Training, Arcade and Bot Duel run on the player's device, so
 *  the words point there. */
export const ARENAS_FULL_MESSAGE = 'The arenas are full right now. Training, Arcade and Bot Duel run on your device, or try again in a minute.';
/** True for an error (or a bare message) that carries the refusal. */
export function isArenasFull(error: unknown): boolean {
  const text = typeof error === 'string' ? error : error && typeof error === 'object' && typeof (error as { message?: unknown }).message === 'string' ? (error as { message: string }).message : '';
  return text.includes(ARENAS_FULL_MESSAGE);
}
