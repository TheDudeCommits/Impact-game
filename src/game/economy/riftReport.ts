/** A Rift War seat's result as its report (2 November 2026: Rift War pays), built the same way by the server's room
 *  (src/server/economy/RoomRewards.ts) and by a war on the player's own device (device.ts). Its numbers are the war's
 *  own: the seat's knockouts, assists and structures brought down, first place for the side whose core stood. */
import type { GameSnapshot } from '../types';
import { riftOf, type RiftSeat } from '../moba/model';
import type { MatchReport } from './earn';

/** Whether a seat did anything in the war besides moving: a knockout, an assist, a structure, a unit last-hit. */
export const riftContributed = (seat: RiftSeat | undefined) => !!seat && (seat.kills > 0 || seat.assists > 0 || seat.structures > 0 || seat.lastHits > 0);

export function riftReport(snapshot: GameSnapshot, self: string, id: string, seconds: number, how: { practice: boolean; friends?: boolean; couch?: boolean }): MatchReport | undefined {
  const rift = riftOf(snapshot), seat = rift?.seats.find(each => each.id === self);
  if (!rift || !seat) return undefined;
  return { id, mode: 'rift-war', fighter: seat.fighter, seconds: Math.floor(Math.max(0, seconds)), practice: how.practice,
    place: rift.winner === seat.team ? 1 : 2, players: rift.seats.length, kos: seat.kills, assists: seat.assists, towers: seat.structures,
    ...(how.friends || how.couch ? { friends: true } : {}), ...(how.couch ? { couch: true } : {}) };
}
