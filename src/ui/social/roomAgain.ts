import { FIGHTERS } from '../../config';
import type { GameSnapshot } from '../../game/types';

export function roomAgainOn(snapshot: GameSnapshot | null | undefined): snapshot is GameSnapshot & { lobby: NonNullable<GameSnapshot['lobby']> } {
  return !!snapshot?.lobby?.again && snapshot.lobby.visibility === 'private' && !snapshot.lobby.duel && !snapshot.duel && snapshot.roomMode === 'match' && snapshot.status === 'finished';
}
/** PLAY AGAIN in such a room (main.ts hud.onPlayAgain): sent, and nothing else to do. False: not such a room, or gone. */
export function askRoomAgain(snapshot: GameSnapshot | null | undefined, room: { send(type: string): void; connection?: { isOpen: boolean } } | null | undefined): boolean {
  if (!roomAgainOn(snapshot) || !room?.connection?.isOpen) return false;
  room.send('room-again');
  return true;
}
const nameOf = (p: { name?: string; fighter: keyof typeof FIGHTERS }) => (p.name && p.name !== 'Fighter' ? p.name : FIGHTERS[p.fighter]?.name ?? 'Fighter').toUpperCase();

/** The results' PLAY AGAIN and its line, for `selfId`: what pressing it does now, and who is in. */
export function againCard(snapshot: GameSnapshot, selfId: string): { label: string; sub: string; disabled: boolean; note: string } {
  const lobby = snapshot.lobby!, ins = lobby.again?.ids ?? [], host = lobby.hostId === selfId, mine = ins.includes(selfId);
  const humans = snapshot.players.filter(p => !p.isBot), others = ins.filter(id => id !== selfId).length;
  const named = humans.filter(p => ins.includes(p.id)).map(p => p.id === selfId ? 'YOU' : nameOf(p));
  // (The others still deciding: whoever reads the card knows whether they have said so themselves.)
  const deciding = humans.filter(p => !ins.includes(p.id) && p.id !== selfId).length;
  const note = named.length ? `IN FOR THE NEXT MATCH: ${named.join(', ')}${deciding ? ` · ${deciding} DECIDING` : ''}` : 'NEXT MATCH IN THIS ROOM · PLAY AGAIN SAYS YOU\'RE IN';
  if (host) return { label: 'NEXT MATCH', sub: others ? `START · ${others + 1} OF ${humans.length} IN` : mine ? 'WAITING FOR FRIENDS' : 'SAME ROOM · YOU START IT', disabled: false, note };
  return mine ? { label: 'NEXT MATCH', sub: "YOU'RE IN · HOST STARTS", disabled: true, note } : { label: 'NEXT MATCH', sub: "I'M IN · SAME ROOM", disabled: false, note };
}
