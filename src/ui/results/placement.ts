import type { GameSnapshot, PlayerState } from '../../game/types';
import { rankPlayers } from '../hudMath';

/**
 * Round 5 (UX), WP1 (issue 7): the one ranking a match's results and its payout share. The order fighters fell in,
 * seen every HUD tick (~70 ms) - the same rule Hud keeps for the results card (Hud.update: a fighter joins the order
 * the first tick it is seen down; two in one tick are split by damage, rankPlayers). The shop's payout watcher reads
 * its place from here (src/ui/shop/report.ts), so "Placed 2 of 4" can no longer sit over "#3 OF 4": it looked once a
 * second, and counted everyone who fell in that second as having outlived the player.
 */
export class FallOrder {
  private order: string[] = [];
  private startedAt: number | null = null;
  private endedAt: number | null = null;
  /** Each HUD tick of a main-game match (not training, an operation or a run). Like Hud's list, it starts again
   *  while the room waits, and on the way home (ModeHudHost.clear). */
  observe(snapshot: GameSnapshot) {
    if (snapshot.roomMode === 'training') return;
    if (snapshot.status === 'waiting') { this.reset(); return; }
    if (this.startedAt === null) this.startedAt = snapshot.serverTime;
    if (snapshot.status === 'finished' && this.endedAt === null) this.endedAt = snapshot.serverTime;
    for (const p of snapshot.players) if (!p.alive && !p.enemy && !this.order.includes(p.id)) this.order.push(p.id);
  }
  reset() { this.order.length = 0; this.startedAt = null; this.endedAt = null; }
  get fallen(): readonly string[] { return this.order; }
  /** The fighter's place in the match's ranking (1 is the winner), or undefined if they are not in it. */
  place(players: readonly PlayerState[], winnerId: string | null, self: string) {
    // Down since the last tick (the watcher can look between two): they fell most recently, so they outlast the rest.
    const order = [...this.order, ...players.filter(p => !p.alive && !p.enemy && !this.order.includes(p.id)).map(p => p.id)];
    const ranked = rankPlayers([...players], winnerId, order), at = ranked.findIndex(p => p.id === self);
    return at < 0 ? undefined : at + 1;
  }
  /** Seconds from the bell to the end (or to now). */
  seconds(now: number) { return this.startedAt === null ? 0 : Math.max(0, (this.endedAt ?? now) - this.startedAt); }
}
/** The page's one tracker: the mode HUD host feeds it; the results card and the payout read it. */
export const FALLS = new FallOrder();
