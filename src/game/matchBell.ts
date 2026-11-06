import type { GameSnapshot } from './types';

export class MatchBell {
  /** The status the last snapshot of a match room that is not a Duel carried; '' outside one. */
  private from = '';
  /** Once per kickoff: true for the first snapshot of the fight. Hand it every snapshot, in order. */
  rang(snapshot: Pick<GameSnapshot, 'roomMode' | 'status' | 'duel'>): boolean {
    if (snapshot.roomMode !== 'match' || snapshot.duel) { this.from = ''; return false; }
    const rang = snapshot.status === 'active' && this.from === 'waiting';
    this.from = snapshot.status;
    return rang;
  }
  /** The room is left: the next one's first snapshot is nobody's bell. */
  reset() { this.from = ''; }
}
