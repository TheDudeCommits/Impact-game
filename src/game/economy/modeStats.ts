/** An account's lifetime numbers beyond Arcade (2 November 2026): the modes' wins, Rift War's structures, Last Stand's
 *  best stand, and the matches played with friends and on the couch - what the feats past Arcade are tested against
 *  (feats.ts). Kept in `AccountStats.modes`, which an account settled before then has not got: it starts empty, so
 *  nothing played before counts. */
import type { Report } from './earn';

export interface ModeStats {
  /** Wins: Duel sets, Battle Royales (a field of three or more), Bad Blood and Rift War. */
  duelWins: number; royaleWins: number; badBloodWins: number; riftWins: number;
  /** Rift War structures brought down (towers, barracks, guardians, the core). */
  towers: number;
  /** The most waves cleared in one Last Stand. */
  bestWaves: number;
  /** Matches (and runs) played with a friend - in a private or party room, or on the couch - and on the couch, and couch wins. */
  friends: number; couch: number; couchWins: number;
}
const COUNTS = ['duelWins', 'royaleWins', 'badBloodWins', 'riftWins', 'towers', 'friends', 'couch', 'couchWins'] as const;
export const noModes = (): ModeStats => ({ duelWins: 0, royaleWins: 0, badBloodWins: 0, riftWins: 0, towers: 0, bestWaves: 0, friends: 0, couch: 0, couchWins: 0 });
/** An account's, as its feats read them: none yet reads as all nothing. */
export const modesOf = (stats: { modes?: ModeStats }): ModeStats => ({ ...noModes(), ...stats.modes });

/** A settled match counted into an account's numbers. A win is the missions' win: first place, a run at rank B. */
export function tallyModes(stats: { modes?: ModeStats }, report: Report) {
  const m = stats.modes = modesOf(stats);
  const won = report.mode === 'survival' ? !!report.sealed || report.rank >= 4 : report.place === 1;
  if (report.friends) m.friends++;
  if (report.couch) { m.couch++; if (won) m.couchWins++; }
  if (report.mode === 'survival') return;
  if (won && report.mode === 'duel') m.duelWins++;
  if (won && report.mode === 'bad-blood') m.badBloodWins++;
  if (won && report.mode === 'rift-war') m.riftWins++;
  if (won && (report.mode === 'match' || report.mode === 'bots' || report.mode === 'private') && report.players > 2) m.royaleWins++;
  if (report.mode === 'rift-war') m.towers += report.towers ?? 0;
  if (report.mode === 'last-stand') m.bestWaves = Math.max(m.bestWaves, report.rounds ?? 0);
}

/** Two accounts made one (account.ts merge): counts added, the best stand kept. */
export function mergeModes(into: { modes?: ModeStats }, from: { modes?: ModeStats }) {
  if (!into.modes && !from.modes) return;
  const a = modesOf(into), b = modesOf(from);
  for (const key of COUNTS) a[key] += b[key];
  a.bestWaves = Math.max(a.bestWaves, b.bestWaves);
  into.modes = a;
}
