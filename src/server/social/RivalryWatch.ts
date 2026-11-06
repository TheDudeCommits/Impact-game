import type { GameSnapshot, RivalView } from '../../game/types';
import { sharedEconomy } from '../economy/api';
import type { RoomEconomy } from '../cluster/economyLink';
import { rivalries, type Record2, type Rivalries } from './Rivalries';

const pairKey = (a: string, b: string) => a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`;

/** Who won a decided match and whom they beat (arena ids), or nothing to record: a Duel's set won on rounds by one of its
 *  two players (a set ended because the rival left is not counted: a dropped link is not a loss), a friends' royale won
 *  by a player (every other player still in the room at its end lost to them; a bot's win or a timed draw is nobody's). */
export function decided(snapshot: GameSnapshot): { winner: string; losers: string[] } | undefined {
  const humans = snapshot.players.filter(p => !p.isBot && !p.enemy);
  if (snapshot.duel) {
    const d = snapshot.duel;
    if (d.phase !== 'complete' || !d.winner || humans.length !== 2 || snapshot.players.length !== 2) return undefined;
    if ((d.scores[d.winner] ?? 0) < d.firstTo) return undefined;
    return { winner: d.winner, losers: humans.filter(p => p.id !== d.winner).map(p => p.id) };
  }
  if (snapshot.roomMode !== 'match' || snapshot.status !== 'finished' || !snapshot.winnerId) return undefined;
  if (!humans.some(p => p.id === snapshot.winnerId) || humans.length < 2) return undefined;
  return { winner: snapshot.winnerId, losers: humans.filter(p => p.id !== snapshot.winnerId).map(p => p.id) };
}

/**
 * A room's side of the rivalries (Rivalries.ts): the account each seat plays as, the records between the players in the
 * room (asked once a pair, as they meet), a decided match recorded once (`key`: the room's match id), and each page's
 * own lines on the snapshot. The ids are the economy's; a page only ever sees arena ids and counts.
 */
export class RivalryWatch {
  private readonly accounts = new Map<string, string>();
  private readonly known = new Map<string, Record2>();
  private readonly asked = new Set<string>();
  private readonly recorded = new Set<string>();
  constructor(private readonly mode: string, private readonly service: () => Rivalries | undefined = rivalries, private readonly economy: () => RoomEconomy | undefined = sharedEconomy) {}
  /** The account a seat plays as (the join's token, or the page's `account` message). */
  bind(id: string, token: unknown) { const pk = this.economy()?.book.find(token)?.pk; if (pk) this.accounts.set(id, pk); }
  leave(id: string) { this.accounts.delete(id); }
  /** After a snapshot: the records of pairs newly in the room are asked for, and a decided match is recorded (once). */
  observe(snapshot: GameSnapshot, key: string) {
    const service = this.service(); if (!service) return;
    const humans = snapshot.players.filter(p => !p.isBot && !p.enemy && this.accounts.has(p.id)).map(p => this.accounts.get(p.id)!);
    for (let i = 0; i < humans.length; i++) for (let j = i + 1; j < humans.length; j++) {
      const a = humans[i], b = humans[j], pair = pairKey(a, b);
      if (a === b || this.asked.has(pair)) continue;
      this.asked.add(pair);
      void service.between(a, b).then(record => { if (!this.known.has(pair)) this.known.set(pair, a < b ? record : [record[1], record[0]]); }, () => this.asked.delete(pair));
    }
    if (this.recorded.has(key)) return;
    const result = decided(snapshot); if (!result) return;
    this.recorded.add(key);
    const winner = this.accounts.get(result.winner); if (!winner) return;
    for (const id of result.losers) {
      const loser = this.accounts.get(id); if (!loser || loser === winner) continue;
      service.record(winner, loser, this.mode);
      const pair = pairKey(winner, loser), kept = this.known.get(pair);
      // Counted here at once, so the results already say it; a record not yet heard from is asked for again.
      if (kept) kept[winner < loser ? 0 : 1]++; else this.asked.delete(pair);
    }
  }
  /** `id`'s record against each other player in the room they have met (sent before and after a fight, not during it). */
  views(snapshot: GameSnapshot, id: string): RivalView[] | undefined {
    const own = this.accounts.get(id); if (!own || snapshot.status === 'active') return undefined;
    const views: RivalView[] = [];
    for (const p of snapshot.players) {
      const other = p.isBot ? undefined : this.accounts.get(p.id);
      if (!other || p.id === id || other === own) continue;
      const kept = this.known.get(pairKey(own, other)); if (!kept || kept[0] + kept[1] === 0) continue;
      const [won, lost] = own < other ? kept : [kept[1], kept[0]];
      views.push({ id: p.id, won, lost });
    }
    return views.length ? views : undefined;
  }
  forOwner<T extends GameSnapshot>(snapshot: T, id: string): T { const rivals = this.views(snapshot, id); return rivals ? { ...snapshot, rivals } : snapshot; }
}
