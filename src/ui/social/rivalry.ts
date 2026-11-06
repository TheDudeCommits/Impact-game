import { FIGHTERS } from '../../config';
import type { GameSnapshot, PlayerState, RivalView } from '../../game/types';

export function rivalryWords(rival: RivalView, rivalName: string): string {
  const name = (rivalName.trim() || 'YOUR RIVAL').toUpperCase();
  if (rival.won === rival.lost) return `${name} · ALL SQUARE ${rival.won}–${rival.lost}`;
  return rival.won > rival.lost ? `YOU LEAD ${name} ${rival.won}–${rival.lost}` : `${name} LEADS ${rival.lost}–${rival.won}`;
}
/** A player's name as the cards print it: what they go by, else their fighter's (MatchResults' rule). */
const nameOf = (p: Pick<PlayerState, 'name' | 'fighter'>) => p.name && p.name !== 'Fighter' ? p.name : FIGHTERS[p.fighter]?.name ?? 'Rival';
/** The line for the VS splash and the results: `self`'s record against the others in the room they have met, the rival a
 *  Duel is against first, at most `most` of them (a friends' royale can hold eleven). Empty: no record to tell. */
export function rivalryLine(snapshot: Pick<GameSnapshot, 'rivals' | 'players'>, selfId: string, most = 2): string {
  const rivals = snapshot.rivals ?? [];
  const lines = rivals.flatMap(rival => { const p = snapshot.players.find(each => each.id === rival.id && each.id !== selfId); return p ? [rivalryWords(rival, nameOf(p))] : []; });
  return lines.slice(0, most).join(' · ');
}
