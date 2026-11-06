import type { FighterId } from '../types';
import { MOVES } from '../moves';
import { AURAS, CHALLENGES, UNLOCKS, buy, emptyProgress, masteryOf, settle, type AuraId, type RiftProgress, type RunFacts } from '../../survival/progress';
import { FINAL_ROUND, LOCATIONS } from '../../survival/locations';
import { RANKS, loopOf, rankFor, type Rank } from '../../survival/bosses';
import { CAREER_MODES, emptyTotals, newCareer, readCareer, recordCareer, titleUnlocked, type Career, type CareerMatch, type CareerTotals } from '../social/career';

export interface ProgressState { rift: RiftProgress; career: Career }
export type ProgressReport =
  | { id: string; kind: 'run'; facts: RunFacts }
  | { id: string; kind: 'buy'; node: string }
  | { id: string; kind: 'aura'; fighter: FighterId; aura: AuraId }
  | { id: string; kind: 'match'; match: CareerMatch }
  | { id: string; kind: 'title'; title: string };
/** What the page sends, and what the server answers (`pk`: the account it is; `done`: the reports it has dealt with -
 *  taken, already taken, or refused for good; `wait`: seconds before the rest are worth sending again). */
export interface SyncBody { import?: ProgressState; reports?: ProgressReport[] }
export interface SyncAnswer extends ProgressState { pk: string; done: string[]; wait?: number }

export const PROGRESS_LIMITS = {
  // ---- a report (a run, as earn.ts plausible() holds an on-device run) ----
  /** A run's longest. */
  runSeconds: 3 * 3600,
  /** A round is its horde and its boss: forty seconds is faster than any is cleared. */
  secondsPerRound: 40,
  round: 200,
  /** Score a second of a run may make (a sealed run makes about 6,000), and to start with. */
  scorePerSecond: 50_000, scoreFloor: 100_000,
  killsPerSecond: 12,
  // ---- a match for the career ----
  matchSeconds: 3 * 3600,
  damagePerSecond: 20_000,
  // ---- an import: totals no run count could pass ----
  runs: 20_000,
  /** Mastery experience a run gives (a sealed run about 355: round 14, 14 bosses, 25 minutes). */
  xpPerRun: 1_000,
  /** Shards a run pays, before its challenges (a sealed run about 450). */
  shardsPerRun: 1_000,
  bossesPerRun: 60,
  codex: 200,
  bestScore: 2e9,
  matches: 100_000,
  /** Reports taken in one sync, ids remembered (a page keeps fewer than this), and the most a body holds. */
  perSync: 40, ids: 128,
} as const;

const L = PROGRESS_LIMITS;
const num = (v: unknown, max: number) => typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(max, v)) : 0;
const int = (v: unknown, max: number) => Math.floor(num(v, max));
const isId = (v: unknown, max = 48): v is string => typeof v === 'string' && v.length <= max && /^[a-z0-9][a-z0-9_-]*$/i.test(v);
const isFighter = (v: unknown): v is FighterId => typeof v === 'string' && Object.hasOwn(MOVES, v);
const union = (a: readonly string[], b: readonly string[]) => { const out = [...a]; for (const each of b) if (!out.includes(each)) out.push(each); return out; };
const PLACES = new Set(LOCATIONS.map(place => place.id)), CHALLENGE_IDS = new Set(CHALLENGES.map(c => c.id));
/** Shards the nodes bought cost. */
export const costOf = (unlocked: readonly string[]) => unlocked.reduce((sum, node) => sum + (UNLOCKS.find(u => u.node === node)?.cost ?? 0), 0);

export const emptyState = (): ProgressState => ({ rift: emptyProgress(), career: newCareer(0) });
/** Whether a state holds anything at all (an empty one is not worth keeping). */
export const anything = (s: ProgressState) => s.rift.runs > 0 || s.rift.earned > 0 || s.rift.unlocked.length > 0 || s.career.totals.matches > 0 || s.career.title !== 'newcomer';

// ---- a report, as far as it is believed ----------------------------------------------------------------------------
/** A run's facts held to what its length allows - its rounds by time, its bosses by its rounds, its score and its
 *  knockouts by time, a seal only past the last round - or undefined (no fighter of this game). An honest run's facts
 *  come back as they went in, so the server's settle() is the page's. */
export function plausibleFacts(raw: unknown): RunFacts | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  if (!isFighter(r.fighter)) return undefined;
  const seconds = num(r.seconds, L.runSeconds);
  const round = Math.max(1, Math.min(int(r.round, L.round), Math.floor(seconds / L.secondsPerRound) + 1));
  const most = round * 2 + 1, top = RANKS.indexOf(rankFor(round));
  const log = Array.isArray(r.bossLog) ? (r.bossLog as unknown[]).flatMap(b => {
    const boss = b as { id?: unknown; finished?: unknown; seconds?: unknown } | null;
    return boss && isId(boss.id) ? [{ id: boss.id, finished: boss.finished === true, seconds: num(boss.seconds, seconds) }] : [];
  }).slice(0, most) : undefined;
  const bosses = Math.min(int(r.bosses, most), most), kills = Math.min(int(r.kills, 1e7), Math.ceil(seconds * L.killsPerSecond));
  const rank = RANKS.includes(r.rank as Rank) && RANKS.indexOf(r.rank as Rank) <= top ? r.rank as Rank : rankFor(round);
  const facts: RunFacts = { fighter: r.fighter, round, score: Math.min(num(r.score, L.bestScore), seconds * L.scorePerSecond + L.scoreFloor), seconds, bosses, kills, bestRank: int(r.bestRank, 6), rank };
  if (r.sealed !== undefined) facts.sealed = r.sealed === true && round >= FINAL_ROUND;
  // (A champion of the horde can be finished too, and is not in the boss log: finishers are held to the rounds, not the log.)
  if (r.finishers !== undefined) facts.finishers = int(r.finishers, most * 2);
  if (r.flawless !== undefined) facts.flawless = int(r.flawless, most * 2);
  if (r.breaks !== undefined) facts.breaks = int(r.breaks, most * 4);
  if (r.teamUltimates !== undefined) facts.teamUltimates = int(r.teamUltimates, 1000);
  if (r.ownKills !== undefined) facts.ownKills = Math.min(int(r.ownKills, 1e7), kills);
  if (r.cursed !== undefined) facts.cursed = Math.min(int(r.cursed, round), round);
  if (r.loop !== undefined) facts.loop = Math.min(int(r.loop, 100), loopOf(round));
  if (Array.isArray(r.places)) facts.places = union([], (r.places as unknown[]).filter((p): p is string => typeof p === 'string' && PLACES.has(p)));
  if (log) facts.bossLog = log;
  return facts;
}

/** A match for the career held to what its length allows, or undefined (not a match career.ts would take). */
export function plausibleMatch(raw: unknown, now = Infinity): CareerMatch | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const m = raw as Record<string, unknown>;
  if (typeof m.id !== 'string' || m.id.length > 120 || !Object.hasOwn(CAREER_MODES, m.mode as string) || !isFighter(m.fighter) || !['win', 'loss', 'draw', 'left'].includes(m.outcome as string)) return undefined;
  const seconds = num(m.seconds, L.matchSeconds);
  return { id: m.id, at: Math.min(num(m.at, 1e15), now), mode: m.mode as CareerMatch['mode'], fighter: m.fighter, outcome: m.outcome as CareerMatch['outcome'],
    kills: Math.min(int(m.kills, 1e6), Math.max(20, Math.ceil(seconds))), damage: Math.min(num(m.damage, 1e9), seconds * L.damagePerSecond + 20_000), seconds,
    bosses: Math.min(int(m.bosses, 10_000), Math.floor(seconds / 10) + 3), capture: Math.min(num(m.capture, 3600), seconds), score: num(m.score, 1e9), round: int(m.round, 10_000) };
}

/** A report as it was sent, if it reads as one (its kind, its id, the shape of what it carries). */
export function readReport(raw: unknown): ProgressReport | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'string' || !/^[A-Za-z0-9_-]{6,64}$/.test(r.id)) return undefined;
  if (r.kind === 'run' && r.facts && typeof r.facts === 'object') return { id: r.id, kind: 'run', facts: r.facts as RunFacts };
  if (r.kind === 'buy' && isId(r.node)) return { id: r.id, kind: 'buy', node: r.node };
  if (r.kind === 'aura' && isFighter(r.fighter) && typeof r.aura === 'string' && Object.hasOwn(AURAS, r.aura)) return { id: r.id, kind: 'aura', fighter: r.fighter, aura: r.aura as AuraId };
  if (r.kind === 'match' && r.match && typeof r.match === 'object') return { id: r.id, kind: 'match', match: r.match as CareerMatch };
  if (r.kind === 'title' && isId(r.title)) return { id: r.id, kind: 'title', title: r.title };
  return undefined;
}

/** A report applied to a state, by the rules the page applied it with: true if it changed anything (a node that cannot
 *  be bought, an aura not earned, a match already counted change nothing). `now`: the server's clock, which a match's
 *  date may not pass. */
export function applyReport(state: ProgressState, report: ProgressReport, now = Infinity): boolean {
  switch (report.kind) {
    case 'run': { const facts = plausibleFacts(report.facts); if (!facts) return false; state.rift = settle(state.rift, facts).progress; return true; }
    case 'buy': { const after = buy(state.rift, report.node); if (!after) return false; state.rift = after; return true; }
    case 'aura': {
      if (!Object.hasOwn(AURAS, report.aura) || AURAS[report.aura].level > masteryOf(state.rift.mastery[report.fighter]).level) return false;
      state.rift = { ...state.rift, aura: { ...state.rift.aura, [report.fighter]: report.aura } };
      return true;
    }
    case 'match': { const match = plausibleMatch(report.match, now); return !!match && recordCareer(state.career, match); }
    case 'title': { if (!titleUnlocked(state.career, report.title)) return false; state.career.title = report.title; return true; }
  }
  return false;
}
/** A state with reports applied over it, on a copy (the page: the server's answer, and what it has not taken yet). */
export function replay(state: ProgressState, reports: readonly ProgressReport[]): ProgressState {
  const next = structuredClone(state);
  for (const report of reports) applyReport(next, report);
  return next;
}

// ---- an import, held to plausible totals ---------------------------------------------------------------------------
/** A profile from a browser, read field by field and held to what its runs could have earned: every count to so much a
 *  run, nodes only as far as the shards earned paid for them, ids only of this game's places, challenges and nodes. */
export function cleanRift(raw: unknown): RiftProgress {
  const p = emptyProgress();
  if (!raw || typeof raw !== 'object') return p;
  const r = raw as Record<string, unknown>;
  p.runs = int(r.runs, L.runs);
  const xp = p.runs * L.xpPerRun;
  if (r.mastery && typeof r.mastery === 'object') {
    for (const [fighter, value] of Object.entries(r.mastery)) if (isFighter(fighter) && num(value, xp) > 0) p.mastery[fighter] = num(value, xp);
    const total = Object.values(p.mastery).reduce((sum, v) => sum + (v ?? 0), 0);
    if (total > xp) for (const fighter of Object.keys(p.mastery) as FighterId[]) p.mastery[fighter] = Math.floor(p.mastery[fighter]! * xp / total);
  }
  if (r.aura && typeof r.aura === 'object') for (const [fighter, aura] of Object.entries(r.aura)) if (isFighter(fighter) && typeof aura === 'string' && Object.hasOwn(AURAS, aura)) p.aura[fighter] = aura as AuraId;
  if (r.codex && typeof r.codex === 'object') for (const [id, value] of Object.entries(r.codex).slice(0, L.codex)) {
    const c = value as { beaten?: unknown; finished?: unknown; fastest?: unknown } | null;
    if (!isId(id) || !c || typeof c !== 'object') continue;
    const beaten = int(c.beaten, p.runs * L.bossesPerRun);
    if (!beaten) continue;
    p.codex[id] = { beaten, finished: Math.min(int(c.finished, beaten), beaten), ...(typeof c.fastest === 'number' && c.fastest > 0 ? { fastest: num(c.fastest, L.runSeconds) } : {}) };
  }
  const ids = (v: unknown, known: (id: string) => boolean) => Array.isArray(v) ? union([], v.filter((x): x is string => typeof x === 'string' && known(x))) : [];
  p.places = p.runs ? ids(r.places, id => PLACES.has(id)) : [];
  p.challenges = p.runs ? ids(r.challenges, id => CHALLENGE_IDS.has(id)) : [];
  const bonus = p.challenges.reduce((sum, id) => sum + (CHALLENGES.find(c => c.id === id)?.reward ?? 0), 0);
  p.earned = Math.min(num(r.earned, 1e9), p.runs * L.shardsPerRun + bonus);
  // (A node is kept only as far as what was earned pays for it, in the order bought.)
  for (const node of ids(r.unlocked, id => UNLOCKS.some(u => u.node === id))) if (costOf([...p.unlocked, node]) <= p.earned) p.unlocked.push(node);
  p.shards = Math.max(0, p.earned - costOf(p.unlocked));
  const best = (r.best ?? {}) as { round?: unknown; score?: unknown };
  p.best = p.runs ? { round: int(best.round, L.round), score: num(best.score, L.bestScore) } : { round: 0, score: 0 };
  return p;
}

const TOTALS = Object.keys(emptyTotals()) as (keyof CareerTotals)[];
/** A career from a browser, read as career.ts reads its own, and held to plausible totals for its matches. */
export function cleanCareer(raw: unknown, now = Date.now()): Career {
  let c: Career;
  try { c = readCareer(JSON.stringify(raw ?? null)); } catch { return newCareer(0); }
  const cap = (t: CareerTotals, matches: number) => {
    const out = emptyTotals(), m = Math.min(int(t.matches, L.matches), matches);
    out.matches = m;
    for (const key of ['wins', 'losses', 'draws', 'left'] as const) out[key] = Math.min(int(t[key], m), m);
    out.seconds = Math.min(num(t.seconds, 1e12), m * L.matchSeconds); out.kills = Math.min(int(t.kills, 1e12), m * 1000);
    out.damage = Math.min(num(t.damage, 1e15), m * L.matchSeconds * L.damagePerSecond); out.bosses = Math.min(int(t.bosses, 1e12), m * L.bossesPerRun);
    out.capture = Math.min(num(t.capture, 1e12), out.seconds);
    return out;
  };
  const totals = cap(c.totals, L.matches), each = <K extends string>(o: Partial<Record<K, CareerTotals>>) =>
    Object.fromEntries(Object.entries(o).map(([k, v]) => { const t = cap(v as CareerTotals, totals.matches); for (const key of TOTALS) t[key] = Math.min(t[key], totals[key]); return [k, t]; })) as Partial<Record<K, CareerTotals>>;
  const recent = c.recent.map(m => plausibleMatch(m, now)).filter((m): m is CareerMatch => !!m).slice(0, 30);
  const career: Career = { version: 1, since: Math.min(c.since, now), totals, modes: each(c.modes), fighters: each(c.fighters), recent, seen: union(c.seen, recent.map(m => m.id)).slice(-256), title: 'newcomer' };
  if (titleUnlocked(career, c.title)) career.title = c.title;
  return career;
}
/** What a page sends as its import: its profile and its career as they are, but for the ids of matches long counted
 *  (the server keeps the recent ones' ids) - and, should it still not fit the route's 64 KB, without the recent matches. */
export function importOf(s: ProgressState): ProgressState {
  const sent = { rift: s.rift, career: { ...s.career, seen: [] } };
  return JSON.stringify(sent).length > 48_000 ? { ...sent, career: { ...sent.career, recent: [] } } : sent;
}

// ---- merges ---------------------------------------------------------------------------------------------------------
const since = (a: number, b: number) => a > 0 && b > 0 ? Math.min(a, b) : a || b;
function sets(into: RiftProgress, from: RiftProgress) {
  into.places = union(into.places, from.places); into.challenges = union(into.challenges, from.challenges); into.unlocked = union(into.unlocked, from.unlocked);
  into.best = { round: Math.max(into.best.round, from.best.round), score: Math.max(into.best.score, from.best.score) };
  into.aura = { ...from.aura, ...into.aura };
  for (const [id, c] of Object.entries(from.codex)) {
    const mine = into.codex[id] ??= { beaten: 0, finished: 0 };
    const fastest = [mine.fastest, c.fastest].filter((s): s is number => typeof s === 'number' && s > 0);
    if (fastest.length) mine.fastest = Math.min(...fastest);
  }
}
/** One player's profile seen twice, made one: the higher count, the union of sets, the fastest boss, `a`'s aura where
 *  both chose one. Shards: what was earned less what the bought nodes cost (never below none). */
export function forwardRift(a: RiftProgress, b: RiftProgress): RiftProgress {
  const out: RiftProgress = structuredClone(a);
  out.runs = Math.max(a.runs, b.runs); out.earned = Math.max(a.earned, b.earned);
  for (const [fighter, xp] of Object.entries(b.mastery) as [FighterId, number][]) out.mastery[fighter] = Math.max(out.mastery[fighter] ?? 0, xp);
  sets(out, b);
  for (const [id, c] of Object.entries(b.codex)) { const mine = out.codex[id]; mine.beaten = Math.max(mine.beaten, c.beaten); mine.finished = Math.max(mine.finished, c.finished); }
  out.shards = Math.max(0, out.earned - costOf(out.unlocked));
  return out;
}
/** Two accounts' profiles made one: what `gone` imported (`goneBase`) as forward(), what its reports earned since added. */
export function foldRift(into: RiftProgress, gone: RiftProgress, goneBase: RiftProgress): RiftProgress {
  const out = forwardRift(into, goneBase), more = (a: number, b = 0) => Math.max(0, a - b);
  out.runs += more(gone.runs, goneBase.runs); out.earned += more(gone.earned, goneBase.earned);
  for (const [fighter, xp] of Object.entries(gone.mastery) as [FighterId, number][]) { const add = more(xp, goneBase.mastery[fighter]); if (add) out.mastery[fighter] = (out.mastery[fighter] ?? 0) + add; }
  sets(out, gone);
  for (const [id, c] of Object.entries(gone.codex)) { const mine = out.codex[id], base = goneBase.codex[id]; mine.beaten += more(c.beaten, base?.beaten); mine.finished += more(c.finished, base?.finished); }
  out.shards = Math.max(0, out.earned - costOf(out.unlocked));
  return out;
}

function totalsBy(a: CareerTotals, b: CareerTotals, how: (x: number, y: number) => number): CareerTotals {
  const out = emptyTotals();
  for (const key of TOTALS) out[key] = how(a[key], b[key]);
  return out;
}
function careerBy(a: Career, b: Career, how: (x: number, y: number) => number): Career {
  const zero = emptyTotals(), group = <K extends string>(x: Partial<Record<K, CareerTotals>>, y: Partial<Record<K, CareerTotals>>) => {
    const out = { ...x } as Partial<Record<K, CareerTotals>>;
    for (const [k, t] of Object.entries(y) as [K, CareerTotals][]) out[k] = totalsBy(x[k] ?? zero, t, how);
    return out;
  };
  const recent = [...a.recent, ...b.recent.filter(m => !a.recent.some(each => each.id === m.id))].sort((x, y) => y.at - x.at).slice(0, 30);
  const out: Career = { version: 1, since: since(a.since, b.since), totals: totalsBy(a.totals, b.totals, how), modes: group(a.modes, b.modes), fighters: group(a.fighters, b.fighters), recent, seen: union(a.seen, b.seen).slice(-256), title: a.title };
  if (!titleUnlocked(out, out.title) && titleUnlocked(out, b.title)) out.title = b.title;
  return out;
}
/** One player's career seen twice, made one: the higher of every count, the matches of both, `a`'s title. */
export const forwardCareer = (a: Career, b: Career) => careerBy(a, b, Math.max);
/** Two accounts' careers made one: what `gone` imported as forward(), its matches since added. */
export function foldCareer(into: Career, gone: Career, goneBase: Career): Career {
  const ahead = forwardCareer(into, goneBase), since = careerBy(gone, goneBase, (x, y) => Math.max(0, x - y));
  // (careerBy over gone and its base: what its reports added, by count; its matches and title ride along.)
  return careerBy(ahead, since, (x, y) => x + y);
}

export const forward = (a: ProgressState, b: ProgressState): ProgressState => ({ rift: forwardRift(a.rift, b.rift), career: forwardCareer(a.career, b.career) });
export const fold = (into: ProgressState, gone: ProgressState, goneBase: ProgressState): ProgressState => ({ rift: foldRift(into.rift, gone.rift, goneBase.rift), career: foldCareer(into.career, gone.career, goneBase.career) });
