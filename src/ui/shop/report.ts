/** The account reward watcher reads authoritative completion receipts from
 * snapshots. Legacy local report helpers remain for local summaries and tests;
 * the live account path ignores snapshots without a server match ID. */
import type { RunResult } from '../../survival/SurvivalGame';
import { RANKS } from '../../survival/bosses';
import type { MatchReport, SurvivalReport, Report } from '../../game/economy/earn';

/** A name for a result, the server's to refuse a second time. */
export function resultId() {
  try { return crypto.randomUUID().replace(/-/g, ''); }
  catch { return Array.from({ length: 4 }, () => Math.random().toString(36).slice(2, 10).padEnd(8, '0')).join(''); }
}

/** A run's result as a report - or nothing for a probe's run, which earns nothing. */
export function survivalReport(result: RunResult): SurvivalReport | undefined {
  if (result.probe) return undefined;
  const log = result.bossLog ?? [];
  return { id: resultId(), mode: 'survival', coop: (result.party ?? 1) > 1, fighter: result.fighter, seconds: Math.round(result.seconds), round: result.round, rank: Math.max(0, RANKS.indexOf(result.rank)),
    bosses: result.bosses, finishers: result.finishers ?? log.filter(boss => boss.finished).length, sealed: !!result.sealed, score: Math.round(result.score), kills: result.ownKills ?? result.kills, style: result.bestRank,
    sBosses: log.filter(boss => boss.rank === 'S').length, fastBoss: log.length ? Math.min(...log.map(boss => boss.seconds)) : undefined };
}

/** What the watcher reads of a match's snapshot. */
export interface MatchSight {
  matchId?: string; reward?: {report: Report};
  status: 'waiting' | 'active' | 'finished'; roomMode: string; winnerId: string | null;
  lobby?: { visibility?: string };
  players: { id: string; fighter: string; alive: boolean; isBot: boolean; kills?: number }[];
}

/** One match at a time, from its snapshots: this fighter's result, once, when it is decided. */
export class MatchWatcher {
  /** Round 5 (UX): the place the results card shows (src/ui/results/placement.ts), when it knows it. */
  constructor(private readonly placeOf?: (sight: MatchSight, self: string) => number | undefined) {}
  private paid = new Set<string>();
  private began = 0;
  private fought = false;
  private told = false;

  /** A look at the match now (`seconds`: any steady clock). Returns the result the moment there is one. */
  look(sight: MatchSight | undefined, self: string, seconds: number): Report | undefined {
    if (sight?.matchId) {
      const report = sight.reward?.report;
      if (!report || this.paid.has(report.id)) return undefined;
      this.paid.add(report.id); if(this.paid.size>64)this.paid.delete(this.paid.values().next().value!);
      return report;
    }
    if (!sight || sight.status === 'waiting' || sight.roomMode !== 'match') { this.began = 0; this.fought = false; this.told = false; return undefined; }
    const me = sight.players.find(player => player.id === self);
    if (!me) return undefined;
    if (sight.status === 'active') {
      if (!this.began) this.began = seconds;
      if (me.alive) this.fought = true;
    }
    // Decided: fallen, or the match over. (Someone who arrived to a match already lost to them was never in it.)
    if (this.told || !this.fought || (me.alive && sight.status !== 'finished')) return undefined;
    this.told = true;
    const standing = sight.players.filter(player => player.alive).length;
    const place = this.placeOf?.(sight, self) ?? (sight.winnerId === me.id ? 1 : me.alive ? Math.max(2, standing) : standing + 1);
    const others = sight.players.filter(player => player.id !== self);
    return { id: resultId(), mode: sight.lobby?.visibility === 'private' ? 'private' : others.length && others.every(player => player.isBot) ? 'bots' : 'match', fighter: me.fighter,
      seconds: Math.round(seconds - this.began), place, players: sight.players.length, kos: me.kills ?? 0 };
  }
}
