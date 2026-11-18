/* Which of a page's joins go to PlayerTwo's rooms (src/network/p2Room.ts), and what each asks for.
 *
 * Inside PlayerTwo's player every online match is seated in PlayerTwo's
 * rooms, near the player: the royale, the Duels, private royales, the ball modes (all but RANKED), Rift War, Last Stand,
 * Bad Blood, co-op Arcade and online Training. Ball RANKED, and every page outside PlayerTwo, play on the match server. Three ways back to the match server:
 * - the server's own switch: P2ROOMS=0 in its variables (the pass's answer says rooms: false), with no new build;
 * - `?server` in the address (a test, or a player told to);
 * - PlayerTwo's rooms refusing for a reason of their own (off, stopped, unreachable): that join goes to the server.
 */
import { playerTwo, inPlayerTwo } from '../boot/playerTwo';
import { economyPost } from './p2Economy';
import type { NetworkAccess } from '../network';
import type { RoomMode } from '../game/types';
import { CAPACITY as OBJECTIVE_SEATS } from '../game/objectives/model';
import { RIFT_RULES } from '../game/moba/model';
import { MAX_PARTY as COOP_SEATS } from '../survival/SurvivalGame';
import { isP2Code, type P2Ask, type P2Rooms } from './p2Room';
import { economyRoute } from './p2Economy';
import { P2_KINDS, type P2Kind } from '../p2room/protocol';
import { PARTY_MAX } from '../game/social/party';

/** PlayerTwo's errors that mean its rooms can't have this match now: the match server takes it. */
const ELSEWHERE = new Set(['rooms-off', 'rooms-hosted-only', 'rooms-stopped', 'offline', 'too-many-rooms']);
export const p2Elsewhere = (error: unknown) => !!error && typeof error === 'object' && ELSEWHERE.has(String((error as { code?: unknown }).code));

/** The SDK's rooms, when this page may use them. */
async function sdkRooms(): Promise<P2Rooms | undefined> {
  if (import.meta.env?.VITE_P2_ROOMS === '0' || !inPlayerTwo()) return undefined;
  if (typeof location === 'object' && new URLSearchParams(location.search).has('server')) return undefined;
  const api = await playerTwo() as unknown as { rooms?: P2Rooms } | undefined;
  return api?.rooms && typeof api.rooms.join === 'function' ? api.rooms : undefined;
}

/* (to the economy world inside PlayerTwo once it is on, to the match server otherwise: src/network/p2Economy.ts) */
async function post(path: string, body: unknown, ms = 5000): Promise<{ status: number; ok: boolean; json(): Promise<unknown> }> {
  const r = await economyPost(path, body, ms);
  return { status: r.status, ok: r.status >= 200 && r.status < 300, json: async () => r.body };
}

/** The economy's pass for this page's account, and whether its matches go to PlayerTwo at all. An economy that can't be
 *  reached (it is the match server, so it is down too) leaves the match to PlayerTwo with no pass: the fighter must be
 *  one anyone may play, and nothing is paid. A server from before the switch (404) keeps the match. */
async function passFor(token: string | undefined, name: string): Promise<{ rooms: boolean; pass?: string }> {
  try {
    const r = await post('p2room-pass', { token, name });
    if (r.status === 404) return { rooms: false };
    if (!r.ok) return { rooms: true };
    const a = await r.json() as { rooms?: unknown; pass?: unknown };
    return { rooms: a.rooms === true, ...(typeof a.pass === 'string' ? { pass: a.pass } : {}) };
  } catch { return { rooms: true }; }
}

/** A room's signed completion, settled by the economy: the settlement for the results card. */
export async function settleWithEconomy(done: string): Promise<unknown> {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const r = await post('p2room-complete', { done }, 8000);
      if (r.ok) return ((await r.json()) as { completion?: unknown }).completion ?? null;
      if (r.status >= 400 && r.status < 500) return null;
    } catch { /* again */ }
    await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1)));
  }
  return null;
}

/** A party's own room on PlayerTwo (social/PartyClient.ts): by a PlayerTwo code, or the player's PlayerTwo party's (a
 *  private room of their own when they are in none). Undefined: the match server's, as before. */
export async function p2PartyRoute(code: string | undefined, options: Record<string, unknown>, token: string | undefined, name: string)
  : Promise<{ rooms: P2Rooms; ask: P2Ask } | undefined> {
  if (code && !isP2Code(code)) return undefined;
  const rooms = await sdkRooms();
  if (!rooms) return undefined;
  const { rooms: on, pass } = await passFor(token, name);
  if (!on) return undefined;
  return { rooms, ask: { kind: 'party', how: code ? { code } : { party: true }, size: PARTY_MAX, options, ...(pass ? { pass } : {}) } };
}

/** A party member's ticket to the party's match on PlayerTwo (PartyRoom's launch, p2room/colyseus.ts): the leader's
 *  opens it (the first, with no code yet), the others' join it by the code the leader's page sent back. */
export interface P2Ticket { kind: string; options: Record<string, unknown>; code?: string }
export async function p2TicketRoute(ticket: P2Ticket, token: string | undefined, name: string): Promise<{ rooms: P2Rooms; ask: P2Ask } | undefined> {
  if (!(P2_KINDS as readonly string[]).includes(ticket.kind)) return undefined;
  const rooms = await sdkRooms();
  if (!rooms) return undefined;
  const { pass } = await passFor(token, name);
  const size = Math.max(1, Math.min(64, Number(ticket.options.players) || SEATS[ticket.kind as P2Kind] || 12));
  return { rooms, ask: { kind: ticket.kind as P2Kind, how: ticket.code ? { code: ticket.code } : { create: true }, size, options: ticket.options, ...(pass ? { pass } : {}), settle: settleWithEconomy } };
}
/** A party match's seats by its room, when its options don't say (a Duel 2; a royale says `players`). */
const SEATS: Partial<Record<P2Kind, number>> = { private_duel: 2, ball_arena: 6, rift_war: RIFT_RULES.capacity, survival_arena: COOP_SEATS, objective_arena: 6, private_arena: 12 };

/** What a join asks of PlayerTwo's rooms, or undefined: it goes to the match server. `options`, the Colyseus join's. */
export async function p2Route(access: NetworkAccess, mode: RoomMode, options: Record<string, unknown>, token: string | undefined, name: string)
  : Promise<{ rooms: P2Rooms; ask: P2Ask } | undefined> {
  const shape = askFor(access, mode, options);
  if (!shape) return undefined;
  const rooms = await sdkRooms();
  if (!rooms) return undefined;
  const { rooms: on, pass } = await passFor(token, name);
  if (!on) return undefined;
  return { rooms, ask: { ...shape, ...(pass ? { pass } : {}), settle: settleWithEconomy } };
}

function askFor(access: NetworkAccess, mode: RoomMode, options: Record<string, unknown>): Omit<P2Ask, 'pass' | 'settle'> | undefined {
  const code = 'code' in access && typeof access.code === 'string' ? access.code.trim().toUpperCase() : '';
  switch (access.kind) {
    /* (online Training, a capture tool's: the royale's room in its own mode) */
    case 'public': return { kind: 'arena', how: { match: mode === 'match' ? [] : [mode] }, size: 12, options };
    case 'bots': return { kind: 'bot_arena', how: { create: true }, size: 1, options };
    case 'create-private': return { kind: 'private_arena', how: { create: true }, size: access.players ?? 12, options };
    case 'join-private': return isP2Code(code) ? { kind: 'private_arena', how: { code }, size: 12, options } : undefined;
    case 'duel':
      if (access.access === 'online') return { kind: 'duel_arena', how: { match: [] }, size: 2, options };
      if (access.access === 'host') return { kind: 'private_duel', how: { create: true }, size: 2, options };
      if (access.access === 'join' && isP2Code(code)) return { kind: 'private_duel', how: { code }, size: 2, options };
      return undefined;
    case 'ball':
      /* (RANKED only while this page's economy is the PlayerTwo world, where the ratings are: each pass carries them) */
      if (access.access === 'quick' && (options.queue !== 'ranked' || economyRoute().world)) return { kind: 'ball_arena', how: { match: [options.ball, options.queue, options.mutator] }, size: 6, options };
      if (access.access === 'host') return { kind: 'ball_arena', how: { create: true }, size: 6, options };
      if (access.access === 'join' && isP2Code(code)) return { kind: 'ball_arena', how: { code }, size: 6, options };
      return undefined;
    case 'rift-war':
      /* (a public war's faction full: the next of three pools, as the match server's queue opens a new room) */
      if (access.access === 'quick') return { kind: 'rift_war', how: { match: [] }, size: RIFT_RULES.capacity, pools: 3, options };
      if (access.access === 'host') return { kind: 'rift_war', how: { create: true }, size: RIFT_RULES.capacity, options };
      if (access.access === 'join' && isP2Code(code)) return { kind: 'rift_war', how: { code }, size: RIFT_RULES.capacity, options };
      return undefined;
    case 'objective': {
      const seats = OBJECTIVE_SEATS[access.objective] ?? 6;
      if (access.access === 'quick') return { kind: 'objective_arena', how: { match: [access.objective] }, size: seats, pools: 3, options };
      if (access.access === 'join') return isP2Code(code) ? { kind: 'objective_arena', how: { code }, size: seats, options } : undefined;
      /* (a room of its host's, or of one against bots: the match server's too) */
      return { kind: 'objective_arena', how: { create: true }, size: access.access === 'host' ? seats : 1, options };
    }
    case 'coop-create': return { kind: 'survival_arena', how: { create: true }, size: COOP_SEATS, options };
    case 'coop-join':
      if (access.quick) return { kind: 'survival_arena', how: { match: [] }, size: COOP_SEATS, options };
      return isP2Code(code) ? { kind: 'survival_arena', how: { code }, size: COOP_SEATS, options } : undefined;
    default: return undefined;
  }
}
