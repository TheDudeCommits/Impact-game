import type { FighterId } from '../game/types';
import type { RunResult } from './SurvivalGame';
import { LOCATIONS } from './locations';
import { SKILL_TREE } from './skillTree';

export interface RiftProgress {
  version: 1;
  /** Shards to spend, and ever earned. */
  shards: number; earned: number;
  /** Mastery experience by fighter. */
  mastery: Partial<Record<FighterId, number>>;
  /** The aura each fighter wears (AURAS), once unlocked. */
  aura: Partial<Record<FighterId, AuraId>>;
  /** Every boss beaten: how often, how often finished, the fastest fight. */
  codex: Record<string, { beaten: number; finished: number; fastest?: number }>;
  /** Places ever fought in, challenges done, nodes bought. */
  places: string[]; challenges: string[]; unlocked: string[];
  runs: number; best: { round: number; score: number };
}

/** What of a run the progress reads: everything settle() and the challenges look at, and nothing else. A run is sent
 *  to the account as these (src/game/progress/rules.ts), and the server settles it with the same settle(); a new
 *  challenge that reads another field of the run must add it here (the type refuses it until it does). */
export type RunFacts = Pick<RunResult, 'fighter' | 'round' | 'score' | 'seconds' | 'bosses' | 'kills' | 'bestRank' | 'rank'>
  & Partial<Pick<RunResult, 'sealed' | 'finishers' | 'teamUltimates' | 'ownKills' | 'places' | 'breaks' | 'flawless' | 'cursed' | 'loop'>>
  & { bossLog?: readonly { id: string; finished: boolean; seconds: number }[] };
/** A run's facts, and only those (a run's result carries much more: its picks, relics, damage by source...). */
export function factsOf(r: RunResult): RunFacts {
  const facts: RunFacts = { fighter: r.fighter, round: r.round, score: r.score, seconds: r.seconds, bosses: r.bosses, kills: r.kills, bestRank: r.bestRank, rank: r.rank };
  for (const key of ['sealed', 'finishers', 'teamUltimates', 'ownKills', 'breaks', 'flawless', 'cursed', 'loop'] as const) if (r[key] !== undefined) (facts as Record<string, unknown>)[key] = r[key];
  if (r.places) facts.places = [...r.places];
  if (r.bossLog) facts.bossLog = r.bossLog.map(boss => ({ id: boss.id, finished: boss.finished, seconds: boss.seconds }));
  return facts;
}

export const emptyProgress = (): RiftProgress => ({ version: 1, shards: 0, earned: 0, mastery: {}, aura: {}, codex: {}, places: [], challenges: [], unlocked: [], runs: 0, best: { round: 0, score: 0 } });

// ---- mastery -----------------------------------------------------------------------
/** Experience each level needs (level 1 at 0). */
export const MASTERY_XP = [0, 60, 150, 280, 450, 670, 940, 1260, 1640, 2080] as const;
export const MAX_MASTERY = MASTERY_XP.length;
export function masteryOf(xp = 0) {
  let level = 1;
  while (level < MAX_MASTERY && xp >= MASTERY_XP[level]) level++;
  const from = MASTERY_XP[level - 1], to = level < MAX_MASTERY ? MASTERY_XP[level] : from;
  return { level, into: xp - from, span: Math.max(1, to - from), max: level >= MAX_MASTERY };
}

export type AuraId = 'rift' | 'ki' | 'blood' | 'void' | 'gold';
/** A fighter's frame: warm white to start (the viewer's own, SELF_COLOUR), the rest earned. */
export const AURAS: Record<AuraId, { name: string; color: number; level: number }> = {
  rift: { name: 'RIFT WHITE', color: 0xfff0c8, level: 1 },
  ki: { name: 'KI BLUE', color: 0x5ab8ff, level: 3 },
  blood: { name: 'BLOOD RED', color: 0xff2a3a, level: 6 },
  void: { name: 'VOID VIOLET', color: 0xa050ff, level: 9 },
  gold: { name: 'LEGEND GOLD', color: 0xffc23a, level: 10 },
};
export const MASTERY_REWARDS: readonly { level: number; title?: string; aura?: AuraId; points?: number }[] = [
  { level: 2, title: 'RIFT WALKER' },
  { level: 3, aura: 'ki' },
  { level: 4, points: 1 },
  { level: 5, title: 'HORDE BREAKER' },
  { level: 6, aura: 'blood' },
  { level: 7, points: 1 },
  { level: 8, title: 'BOSS SLAYER' },
  { level: 9, aura: 'void' },
  { level: 10, title: 'RIFT LEGEND', aura: 'gold' },
];
/** What a level is worth, said on a card. */
export function rewardText(level: number) {
  const r = MASTERY_REWARDS.find(each => each.level === level);
  if (!r) return '';
  return [r.title && `TITLE: ${r.title}`, r.aura && `AURA: ${AURAS[r.aura].name}`, r.points && `+${r.points} SKILL POINT EVERY RUN`].filter(Boolean).join(' · ');
}
/** The title a fighter wears at a level, and the skill points they start a run with. */
export function titleAt(level: number) { return [...MASTERY_REWARDS].reverse().find(r => r.level <= level && r.title)?.title ?? 'NEWCOMER'; }
export function startPointsAt(level: number) { return MASTERY_REWARDS.reduce((n, r) => n + (r.level <= level ? r.points ?? 0 : 0), 0); }
export function aurasAt(level: number): AuraId[] { return (Object.keys(AURAS) as AuraId[]).filter(id => AURAS[id].level <= level); }
export function auraOf(progress: RiftProgress, fighter: FighterId) {
  const level = masteryOf(progress.mastery[fighter]).level, chosen = progress.aura[fighter];
  return chosen && AURAS[chosen].level <= level ? chosen : 'rift';
}

// ---- unlocks -------------------------------------------------------------------------
/** Nodes of the tree that are bought, once, with shards (skillTree.ts `unlock`). */
export const UNLOCKS: readonly { node: string; cost: number }[] = SKILL_TREE.filter(node => node.unlock).map(node => ({ node: node.id, cost: node.unlock! }));

// ---- challenges -----------------------------------------------------------------------
export interface Challenge { id: string; name: string; line: string; reward: number; done(result: RunFacts, progress: RiftProgress): boolean }
export const CHALLENGES: readonly Challenge[] = [
  { id: 'first-blood', name: 'FIRST BLOOD', line: 'Beat a boss', reward: 5, done: r => (r.bossLog?.length ?? 0) > 0 },
  { id: 'finisher', name: 'FINISH IT', line: 'Land a finisher', reward: 5, done: r => (r.finishers ?? 0) > 0 },
  { id: 'executioner', name: 'EXECUTIONER', line: 'Five finishers in one run', reward: 15, done: r => (r.finishers ?? 0) >= 5 },
  { id: 'breaker', name: 'BREAK THEIR WILL', line: 'Break a boss\'s charge', reward: 10, done: r => (r.breaks ?? 0) > 0 },
  { id: 'untouchable', name: 'UNTOUCHABLE', line: 'Beat a boss without taking a blow', reward: 15, done: r => (r.flawless ?? 0) > 0 },
  { id: 'teamwork', name: 'TEAM ULTIMATE', line: 'Land an ultimate with a friend\'s', reward: 10, done: r => (r.teamUltimates ?? 0) > 0 },
  { id: 'cursed', name: 'THROUGH THE CURSE', line: 'Clear a cursed round', reward: 10, done: r => (r.cursed ?? 0) > 0 },
  { id: 'horde-breaker', name: 'HORDE BREAKER', line: '1,000 knockouts in one run', reward: 10, done: r => (r.ownKills ?? r.kills) >= 1000 },
  { id: 'legend', name: 'SHŌNEN LEGEND', line: 'Reach an SSS style rank', reward: 10, done: r => r.bestRank >= 6 },
  { id: 'rank-s', name: 'THE STRONGEST', line: 'Reach rank S', reward: 20, done: r => r.rank === 'S' || (r.loop ?? 0) > 0 },
  { id: 'sealed', name: 'SEAL THE RIFT', line: 'Seal the rift', reward: 40, done: r => !!r.sealed },
  { id: 'deep', name: 'INTO THE DEEP', line: 'Reach the Rift\'s second depth', reward: 30, done: r => (r.loop ?? 0) >= 2 },
  { id: 'wanderer', name: 'EVERY PLACE', line: 'Fight in all eight places', reward: 15, done: (_r, p) => LOCATIONS.every(l => p.places.includes(l.id)) },
  { id: 'collector', name: 'BOSS COLLECTOR', line: 'Beat 15 different bosses', reward: 25, done: (_r, p) => Object.keys(p.codex).length >= 15 },
];

// ---- a run settled ----------------------------------------------------------------------
/** Shards a run pays: its score, its bosses, its finishers, how far it went. */
export function shardsFor(r: RunFacts) {
  return Math.max(1, Math.round(r.score / 25000 + (r.bossLog?.length ?? r.bosses) * 3 + (r.finishers ?? 0) * 2 + r.round + (r.sealed ? 20 : 0)));
}
export function masteryXpFor(r: RunFacts) { return Math.round(r.round * 12 + (r.bossLog?.length ?? r.bosses) * 8 + r.seconds / 20); }

export interface Settled {
  progress: RiftProgress;
  shards: number; xp: number; from: number; to: number;
  /** Challenges this run completed (their ids), and the shards they paid. */
  challenges: string[]; bonus: number;
  record: boolean;
}
/** A run into the progress: a new progress (the old one untouched). */
export function settle(before: RiftProgress, r: RunFacts): Settled {
  const p: RiftProgress = JSON.parse(JSON.stringify(before));
  p.runs++;
  const record = r.score > p.best.score;
  if (record) p.best = { round: r.round, score: r.score };
  else if (r.round > p.best.round) p.best.round = r.round;
  for (const place of r.places ?? []) if (!p.places.includes(place)) p.places.push(place);
  for (const boss of r.bossLog ?? []) {
    const entry = p.codex[boss.id] ?? { beaten: 0, finished: 0 };
    entry.beaten++; if (boss.finished) entry.finished++;
    if (boss.seconds > 0) entry.fastest = Math.min(entry.fastest ?? Infinity, boss.seconds);
    p.codex[boss.id] = entry;
  }
  const from = masteryOf(p.mastery[r.fighter]).level, xp = masteryXpFor(r);
  p.mastery[r.fighter] = (p.mastery[r.fighter] ?? 0) + xp;
  const to = masteryOf(p.mastery[r.fighter]).level;
  const shards = shardsFor(r);
  const challenges = CHALLENGES.filter(c => !p.challenges.includes(c.id) && c.done(r, p));
  const bonus = challenges.reduce((n, c) => n + c.reward, 0);
  p.challenges.push(...challenges.map(c => c.id));
  p.shards += shards + bonus; p.earned += shards + bonus;
  return { progress: p, shards, xp, from, to, challenges: challenges.map(c => c.id), bonus, record };
}

/** A node bought: false when it cannot be (not enough shards, bought already). */
export function buy(p: RiftProgress, node: string): RiftProgress | undefined {
  const unlock = UNLOCKS.find(u => u.node === node);
  if (!unlock || p.unlocked.includes(node) || p.shards < unlock.cost) return undefined;
  return { ...p, shards: p.shards - unlock.cost, unlocked: [...p.unlocked, node] };
}
