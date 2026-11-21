/* The room bundle's room.js (build.mjs's entry): PlayerTwo runs one room.js for every room of a build, so the match
 * rooms (room.ts) and Impact's economy world (src/p2world/world.ts: the world `economy`, kept for good) are told apart
 * here, by the room's id (a world's is w/<game>/<world>/<area>). Everything else is room.ts's, as it was. */
import * as matches from './room';
import * as world from '../p2world/world';

type Room = Parameters<typeof matches.onCreate>[0];
type W = Parameters<typeof world.onCreate>[0];
const isWorld = (room: unknown): room is W => world.isEconomyWorld(room as { id?: unknown });

export const tickRate = matches.tickRate;
export function onCreate(room: Room) { return isWorld(room) ? world.onCreate(room) : matches.onCreate(room); }
export function onStart(room: Room) { return isWorld(room) ? world.onStart(room) : matches.onStart(room); }
export function onJoin(room: Room, player: Parameters<typeof matches.onJoin>[1]) { return isWorld(room) ? world.onJoin(room, player) : matches.onJoin(room, player); }
export function onMessage(room: Room, player: Parameters<typeof matches.onMessage>[1], type: string, data: unknown) { return isWorld(room) ? world.onMessage(room, player, type, data) : matches.onMessage(room, player, type, data); }
export function onLeave(room: Room, player: Parameters<typeof matches.onLeave>[1], why: string) { return isWorld(room) ? world.onLeave(room, player) : matches.onLeave(room, player, why); }
export function onTick(room: Room) { return isWorld(room) ? world.onTick(room) : matches.onTick(room); }
