import type { FighterId } from '../game/types';

export const SOCIAL_PROTOCOL = 1;
type RoomLike = { send(type: string, message?: unknown): void; connection: { isOpen: boolean } };
type Who = { id: string; name?: string; fighter: FighterId };

let room: RoomLike | undefined;
let roster: () => readonly Who[] = () => [];
let emoteListener: ((hero: string, place: number, who: Who | undefined) => void) | undefined;

/** The room's welcome (network.ts): a room that understands the extras is told this page listens for them. */
export function socialWelcome(joined: RoomLike, welcome: unknown, players: () => readonly Who[]) {
  const level = welcome && typeof welcome === 'object' ? (welcome as { social?: unknown }).social : undefined;
  if (typeof level !== 'number' || level < 1) return;
  room = joined; roster = players;
  if (joined.connection.isOpen) joined.send('social', SOCIAL_PROTOCOL);
}
/** The page left `left` (network.ts): nothing more is sent to it. */
export function socialLeft(left: unknown) { if (room === left) { room = undefined; roster = () => []; } }
/** The room this page is in, if it understands the extras and is open. */
export function socialRoom(): RoomLike | undefined { return room?.connection.isOpen ? room : undefined; }

/** Another player's emote, from the room (`emote` { id, place }). */
export function roomEmote(raw: unknown) {
  if (!raw || typeof raw !== 'object') return;
  const { id, place } = raw as { id?: unknown; place?: unknown };
  if (typeof id !== 'string' || typeof place !== 'number' || !Number.isInteger(place)) return;
  emoteListener?.(id, place, roster().find(each => each.id === id));
}
/** Who letters another player's emote over their fighter (ui/shop/boot.ts). */
export function onRoomEmote(listener: typeof emoteListener) { emoteListener = listener; }
