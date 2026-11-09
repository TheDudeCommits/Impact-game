import { DRILLS, medalFor, type DrillId, type Medal } from '../../game/ball/drills';

/** The training drills' medals (game/ball/drills.ts), kept by this browser as the mode sheet's other choices are
 *  (ui/modes/prefs.ts): the most balls each drill has been done right with. No feats and no rewards - a drill is FREE
 *  PLAY's - so nothing here goes to the server.
 *    rift-ball-drills   { drillId: best }   */
export const DRILLS_KEY = 'rift-ball-drills';
const read = (): Record<string, number> => { try { const raw = globalThis.localStorage?.getItem(DRILLS_KEY); const v = raw ? JSON.parse(raw) as unknown : {}; return v && typeof v === 'object' ? v as Record<string, number> : {}; } catch { return {}; } };
const write = (value: Record<string, number>) => { try { globalThis.localStorage?.setItem(DRILLS_KEY, JSON.stringify(value)); } catch { /* The session forgets it. */ } };

/** The most balls done right in a drill so far (0: never played). */
export function drillBest(id: DrillId): number { const n = Number(read()[id]); return Number.isFinite(n) ? Math.max(0, Math.min(DRILLS[id].balls, Math.floor(n))) : 0; }
/** The best medal won in a drill, or none. */
export const drillMedal = (id: DrillId): Medal | null => medalFor(id, drillBest(id));
/** A drill finished with `done` balls right: kept if it is the best. Says whether it was, and the medal it is now. */
export function recordDrill(id: DrillId, done: number): { best: number; improved: boolean; medal: Medal | null } {
  const all = read(), before = drillBest(id), improved = done > before;
  if (improved) { all[id] = done; write(all); }
  return { best: Math.max(before, done), improved, medal: medalFor(id, Math.max(before, done)) };
}
export const MEDAL_MARK: Record<Medal, string> = { bronze: '銅', silver: '銀', gold: '金' };
