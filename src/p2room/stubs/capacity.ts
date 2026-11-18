/* The room bundle's capacity (src/server/capacity.ts): PlayerTwo decides how many rooms there are (500 open at once a
 * game), so a room here is never turned away by this server's night cap. */
import { ARENAS_FULL_MESSAGE } from '../../game/arenasFull';
export class ArenasFullError extends Error { readonly code = 503; constructor() { super(ARENAS_FULL_MESSAGE); } }
export const capacity = { shedding: false, rooms: 0, admit(_room: unknown) {}, release(_room: unknown) {} };
