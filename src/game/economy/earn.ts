import { FINAL_ROUND } from '../../survival/locations';

/** An Arcade Survival run, solo or co-op, as its result screen has it. */
export interface SurvivalReport {
  /** Unique to the run (the server refuses a second report of it). */
  id: string;
  mode: 'survival';
  coop?: boolean;
  fighter: string;
  seconds: number;
  /** The round the run ended in, and its rank's place in F E D C B A S (0-6). */
  round: number; rank: number;
  bosses: number; finishers: number;
  sealed?: boolean;
  score: number; kills: number;
  /** The best style grade reached: its place in D C B A S SS SSS (0-6). */
  style: number;
  /** Co-op: friends stood back up. */
  revives?: number;
  /** S-rank bosses beaten, and the quickest any boss fell (seconds). */
  sBosses?: number; fastBoss?: number;
  friends?: boolean;
  /** Two seats on one device, one account: the couch. */
  couch?: boolean;
}
/** A match against players or bots, as its result has it. */
export interface MatchReport {
  id: string;
  mode: 'match' | 'bots' | 'private' | 'duel' | 'last-stand' | 'bad-blood' | 'rift-war';
  practice?: boolean; rounds?: number; revives?: number; repairs?: number; bossDamage?: number; assists?: number; rescues?: number; supplies?: number;
  /** Played with a friend, and on the couch, as a run's report has them (SurvivalReport). */
  friends?: boolean; couch?: boolean;
  /** Rift War: the structures this fighter brought down (towers, barracks, guardians, the core). */
  towers?: number;
  /** A ball match (game/ball): which, what this fighter scored (goals; Sky Spike's kills and aces), and their saves (Goal
   *  Rush's saves; Sky Spike's blocks and digs). Its place is its side's: 1 won, 2 lost - never a royale's. */
  ball?: 'goal-rush' | 'sky-spike'; scored?: number; saves?: number;
  fighter: string;
  seconds: number;
  /** Where this fighter finished (1 the winner) among how many, and their knockouts. */
  place: number; players: number; kos: number;
}
export type Report = SurvivalReport | MatchReport;
export interface PayLine { label: string; amount: number }

export const PAY = {
  survival: { run: 5, round: 1.5, boss: 2, finisher: 2, rank: [0, 0, 3, 6, 10, 18, 30], seal: 60, revive: 2, revives: 6 },
  match: { played: 8, place: [20, 12, 8], topHalf: 4, ko: 2, kos: 10 },
  /** Rift War (2 November 2026): five against five, about twelve minutes a war - three royales' length, so about two
   *  matches' pay. Completion, victory, knockouts (up to 12), assists (up to 10), structures brought down (up to 16). */
  rift: { played: 15, win: 20, ko: 2, kos: 12, assist: 1, assists: 10, tower: 4, towers: 16 },
  /** Bots and private rooms: the same, halved - unless a friend played in it (`friend`). */
  practice: .5,
  friend: 5,
  firstOfDay: 25,
  /** Match pay is whole up to this much a day, then this share of it. */
  dailyCap: 200, past: .2,
  /** A week of coming back, a day at a time (then it starts again). */
  streak: [10, 15, 20, 25, 30, 40, 60],
  /** An account level reached. */
  level: (level: number) => 40 + 5 * level,
  /** Experience a match gives: this, and its pay. */
  xp: 15,
} as const;
/** The shortest an unverified result (a match played on the player's device) is paid for. Authoritative rooms enforce
 *  participation and their own minimum duration. */
export const MIN_SECONDS = { survival: 90, match: 60 } as const;

/** Rounds a run has cleared: every one before the one it fell in, or all of them if it sealed the rift. */
export const roundsCleared = (report: SurvivalReport) => Math.max(0, report.sealed ? report.round : report.round - 1);

/** Who a match was played with, as a report carries it: only what is said (an old report has neither), the couch a friend. */
const company = (raw: { friends?: unknown; couch?: unknown }) => ({ ...(raw.friends || raw.couch ? { friends: true } : {}), ...(raw.couch ? { couch: true } : {}) });

/** A report as the rules will take it - its numbers whole, in range, and no more than its
 *  length allows - or the reason it is refused. */
export function plausible(raw: Report, verified = false): { report: Report } | { refused: string } {
  const int = (v: unknown, max: number) => Math.max(0, Math.min(max, Math.floor(Number(v) || 0)));
  if (typeof raw?.id !== 'string' || !/^[A-Za-z0-9_-]{6,48}$/.test(raw.id)) return { refused: 'That result has no name.' };
  const fighter = String(raw.fighter ?? '').slice(0, 24), seconds = int(raw.seconds, 3 * 3600);
  if (raw.mode === 'survival') {
    if (!verified && seconds < MIN_SECONDS.survival) return { refused: 'A run that short earns nothing.' };
    // A round is its horde and its boss: forty seconds is faster than any is cleared.
    const round = Math.max(1, Math.min(int(raw.round, 99), verified ? 99 : Math.floor(seconds / 40) + 1));
    const bosses = Math.min(int(raw.bosses, 200), round * 2 + 1), sealed = !!raw.sealed && round >= FINAL_ROUND;
    return { report: { id: raw.id, mode: 'survival', coop: !!raw.coop, fighter, seconds, round, rank: Math.min(int(raw.rank, 6), Math.floor((round - 1) / 2)), bosses,
      finishers: Math.min(int(raw.finishers, 200), bosses), sealed, score: int(raw.score, 1e9), kills: Math.min(int(raw.kills, 1e6), seconds * 12), style: int(raw.style, 6),
      revives: raw.coop ? int(raw.revives, 40) : 0, sBosses: Math.min(int(raw.sBosses, 20), round >= 13 ? bosses : 0), fastBoss: raw.fastBoss ? Math.max(3, Number(raw.fastBoss) || 0) : undefined, ...company(raw) } };
  }
  if (raw.mode === 'match' || raw.mode === 'bots' || raw.mode === 'private' || raw.mode === 'duel' || raw.mode === 'last-stand' || raw.mode === 'bad-blood' || raw.mode === 'rift-war') {
    if (!verified && seconds < MIN_SECONDS.match) return { refused: 'A match that short earns nothing.' };
    const players = Math.max(2, int(raw.players, 12));
    // Unverified (a match on the player's device): no more knockouts than the field has fighters to knock out (one life
    // each in a royale, a duel's three rounds) and none quicker than one every five seconds; and a Last Stand wave no
    // quicker than ten seconds (its break alone is six).
    const kos = verified ? int(raw.kos, 1000000) : Math.min(int(raw.kos, 40), players * 3, Math.floor(seconds / 5), raw.mode === 'bots' ? players - 1 : raw.mode === 'duel' ? 3 : 40);
    const rounds = verified || raw.mode !== 'last-stand' ? int(raw.rounds, 100) : Math.min(int(raw.rounds, 100), Math.floor(seconds / 10) + 1);
    // Rift War: a side has twelve structures, and none falls quicker than one every twenty seconds.
    const towers = raw.mode !== 'rift-war' ? undefined : verified ? int(raw.towers, 24) : Math.min(int(raw.towers, 12), Math.floor(seconds / 20));
    // A ball match: no goal quicker than one every eight seconds, no Sky Spike point than one every four, no save than one
    // every three.
    const ball = raw.mode !== 'rift-war' && (raw.ball === 'goal-rush' || raw.ball === 'sky-spike') ? raw.ball : undefined;
    const scored = ball ? verified ? int(raw.scored, 200) : Math.min(int(raw.scored, 60), Math.floor(seconds / (ball === 'goal-rush' ? 8 : 4))) : undefined;
    const saves = ball ? verified ? int(raw.saves, 200) : Math.min(int(raw.saves, 60), Math.floor(seconds / 3)) : undefined;
    return { report: { id: raw.id, mode: raw.mode, fighter, seconds, players, practice: !!raw.practice, rounds, revives: int(raw.revives, 20), repairs: int(raw.repairs, 100000), bossDamage: int(raw.bossDamage, 1e7), assists: int(raw.assists, 1000), rescues: int(raw.rescues, 20), supplies: int(raw.supplies, 20), place: Math.max(1, Math.min(players, int(raw.place, 12) || players)), kos,
      ...company(raw), ...(towers !== undefined ? { towers } : {}), ...(ball ? { ball, scored, saves } : {}) } };
  }
  return { refused: 'That is not a match this game plays.' };
}

/** What a (plausible) report pays before the day's cap: a line for each thing that paid. */
export function payFor(report: Report): PayLine[] {
  const lines: PayLine[] = [], add = (label: string, amount: number) => { if (amount > 0) lines.push({ label, amount }); };
  // (The couch is a friend, whether or not a report says both.)
  const friends = !!(report.friends || report.couch);
  if (report.mode === 'survival') {
    const p = PAY.survival, cleared = roundsCleared(report);
    add('Run fought', p.run);
    add(`${cleared} round${cleared === 1 ? '' : 's'} cleared`, cleared * p.round);
    add(`${report.bosses} boss${report.bosses === 1 ? '' : 'es'} beaten`, report.bosses * p.boss);
    add(`${report.finishers} finisher${report.finishers === 1 ? '' : 's'}`, report.finishers * p.finisher);
    add(`Rank ${'FEDCBAS'[report.rank]} reached`, p.rank[report.rank]);
    if (report.sealed) add('The rift sealed', p.seal);
    if (report.revives) add('Friends stood back up', Math.min(p.revives, report.revives * p.revive));
    if (friends) add('Played with a friend', PAY.friend);
    return lines;
  }
  if (report.mode === 'rift-war') {
    const p = PAY.rift, k = report.practice && !friends ? PAY.practice : 1;
    add('War fought', p.played * k);
    if (report.place === 1) add('War won', p.win * k);
    add(`${report.kos} knockout${report.kos === 1 ? '' : 's'}`, Math.min(p.kos, report.kos * p.ko) * k);
    add(`${report.assists ?? 0} assist${report.assists === 1 ? '' : 's'}`, Math.min(p.assists, (report.assists ?? 0) * p.assist) * k);
    add(`${report.towers ?? 0} structure${report.towers === 1 ? '' : 's'} brought down`, Math.min(p.towers, (report.towers ?? 0) * p.tower) * k);
    if (friends) add('Played with a friend', PAY.friend);
    return lines;
  }
  if (report.mode === 'duel' || report.mode === 'last-stand' || report.mode === 'bad-blood') {
    const k = report.practice && !friends ? PAY.practice : 1;
    add(report.mode === 'duel' ? 'Best-of-three set completed' : report.mode === 'last-stand' ? 'Village defence completed' : 'Team battle completed', 8 * k);
    if (report.place === 1) add(report.mode === 'duel' ? 'Set victory' : 'Team victory', 12 * k);
    if (report.mode === 'last-stand') add(`${report.rounds ?? 0} waves cleared`, Math.min(30, (report.rounds ?? 0) * 2));
    add(`${report.kos} knockouts`, Math.min(10, report.kos) * k);
    add(`${report.revives ?? 0} teammate rescue${report.revives === 1 ? '' : 's'}`, Math.min(12, (report.revives ?? 0) * 3));
    add(`${report.repairs ?? 0} village health repaired`, Math.min(12, Math.floor((report.repairs ?? 0) / 200)));
    add(`${report.bossDamage ?? 0} boss damage`, Math.min(15, Math.floor((report.bossDamage ?? 0) / 200)));
    add(`${report.assists ?? 0} teamwork assists`, Math.min(10, report.assists ?? 0) * k);
    add(`${report.rescues ?? 0} civilian rescues`, Math.min(8, (report.rescues ?? 0) * 4));
    add(`${report.supplies ?? 0} supply recoveries`, Math.min(8, (report.supplies ?? 0) * 4));
    if (friends) add('Played with a friend', PAY.friend);
    return lines;
  }
  // A ball match (Goal Rush, Sky Spike): a team battle's pay, and what this fighter scored and saved.
  if (report.ball) {
    const k = report.mode === 'match' || friends ? 1 : PAY.practice, goal = report.ball === 'goal-rush', scored = report.scored ?? 0, saves = report.saves ?? 0;
    add(`${goal ? 'Goal Rush' : 'Sky Spike'} match completed`, 8 * k);
    if (report.place === 1) add('Team victory', 12 * k);
    add(goal ? `${scored} goal${scored === 1 ? '' : 's'}` : `${scored} point${scored === 1 ? '' : 's'} of your own`, Math.min(10, scored * (goal ? 3 : 1)) * k);
    add(goal ? `${saves} save${saves === 1 ? '' : 's'}` : `${saves} block${saves === 1 ? '' : 's'} and digs`, Math.min(6, saves) * k);
    if (friends) add('Played with a friend', PAY.friend);
    return lines;
  }
  const p = PAY.match, k = report.mode === 'match' || friends ? 1 : PAY.practice;
  add(report.mode === 'match' ? 'Match played' : report.couch ? 'Couch match' : report.mode === 'bots' ? 'Match against bots' : 'Private match', p.played * k);
  const placed = report.place <= p.place.length ? p.place[report.place - 1] : report.place <= Math.ceil(report.players / 2) ? p.topHalf : 0;
  add(report.place === 1 ? 'Won' : `Placed ${report.place} of ${report.players}`, placed * k);
  add(`${report.kos} knockout${report.kos === 1 ? '' : 's'}`, Math.min(p.kos, report.kos * p.ko) * k);
  if (friends) add('Played with a friend', PAY.friend);
  return lines;
}

/** Match pay under the day's cap: whole until the cap, a share of it after. `paidToday` is what the day has paid so far;
 *  `past`, the share paid past the cap - a fifth for a server room's match, none for a match on the player's device. */
export function underCap(amount: number, paidToday: number, past: number = PAY.past): number {
  const whole = Math.max(0, Math.min(amount, PAY.dailyCap - paidToday));
  return whole + (amount - whole) * past;
}

// ---- account level ---------------------------------------------------------------------
export const MAX_LEVEL = 60;
/** The level from which every level asks the same experience, and how much (8 October 2026, the shop streamlined:
 *  the road gives something every few levels to 60, so a level must not keep growing - about a day and a half of
 *  a regular player's matches each, unlocks.ts). Up to it the curve is the first one, unchanged. */
export const LEVEL_FLAT = { from: 14, xp: 360 } as const;
/** Experience a level is reached at (level 1 at none): about a day to 3, three to 8, two weeks to 15, then a day and a half a level. */
export const xpAt = (level: number): number => level <= LEVEL_FLAT.from ? 60 * (level - 1) + 12 * (level - 1) ** 2 : xpAt(LEVEL_FLAT.from) + LEVEL_FLAT.xp * (level - LEVEL_FLAT.from);
export function levelOf(xp: number) {
  let level = 1;
  while (level < MAX_LEVEL && xp >= xpAt(level + 1)) level++;
  const from = xpAt(level), to = level < MAX_LEVEL ? xpAt(level + 1) : from;
  return { level, into: xp - from, span: Math.max(1, to - from), max: level >= MAX_LEVEL };
}

// ---- days and weeks (UTC) ----------------------------------------------------------------
export const dayOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);
/** The ISO week a moment falls in, as 2026-W40. */
export function weekOf(ms: number) {
  const d = new Date(ms); d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7));
  const first = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  return `${d.getUTCFullYear()}-W${String(1 + Math.round(((d.getTime() - first.getTime()) / 86400000 - 3 + ((first.getUTCDay() + 6) % 7)) / 7)).padStart(2, '0')}`;
}
