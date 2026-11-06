import type { GameSnapshot } from './types';

export class AutoLock {
  /** The round the player let go of the lock in ('' for none). */
  private declined = '';

  /** The round a 1v1 fight is in, or '' when this is not one or its fight is not on: a Duel's set and round, Training's
   *  session (`session`: main.ts's start epoch, new with every start). */
  static round(snapshot: GameSnapshot | null | undefined, session: number): string {
    if (!snapshot || snapshot.status !== 'active') return '';
    if (snapshot.duel) return snapshot.duel.phase === 'playing' ? `${session}:duel:${snapshot.duel.set}:${snapshot.duel.round}` : '';
    return snapshot.roomMode === 'training' ? `${session}:training` : '';
  }

  /** The one opponent there is for `selfId`, alive: never a horde's enemy nor a teammate; undefined for none or several. */
  static rival(snapshot: GameSnapshot, selfId: string): string | undefined {
    const self = snapshot.players.find(p => p.id === selfId);
    if (!self?.alive) return undefined;
    let rival: string | undefined;
    for (const p of snapshot.players) {
      if (p.id === selfId || !p.alive || p.enemy || (self.team !== undefined && p.team === self.team)) continue;
      if (rival) return undefined;
      rival = p.id;
    }
    return rival;
  }

  /** Whom to lock onto now, or undefined: the rival of a 1v1 round whose fight is on, unless the lock is already on or
   *  the player let go of it in this round. */
  want(snapshot: GameSnapshot | null | undefined, selfId: string, session: number, locked: boolean): string | undefined {
    if (locked || !snapshot || !selfId) return undefined;
    const round = AutoLock.round(snapshot, session);
    if (!round || round === this.declined) return undefined;
    return AutoLock.rival(snapshot, selfId);
  }

  /** The player let go of the lock: it stays off for the rest of this round. */
  decline(snapshot: GameSnapshot | null | undefined, session: number) { this.declined = AutoLock.round(snapshot, session); }

  reset() { this.declined = ''; }
}
