/* The room bundle's private codes (src/server/privateCodes.ts): a private room's code is PlayerTwo's (p2.rooms.create),
 * which its host's page sends with its join (room.ts sets `nextCode` before the room is made). */
export const PRIVATE_WAIT_SECONDS = 15 * 60;
export const p2code = { next: '' };
export const privateCodes = { allocate: () => p2code.next || 'ROOM00', release: (_code: string) => {} };
