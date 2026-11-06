
export const PATHS = ['treasure', 'spring', 'trial', 'cursed', 'ward', 'night'] as const;
export type PathKind = (typeof PATHS)[number];
export type RecoveryNeed = 'healthy' | 'hurt' | 'critical';

export interface PathDefinition {
  name: string;
  kanji: string;
  /** What it promises, on its marker. */
  line: string;
  /** Its portal's colour. */
  color: number;
}

export const PATH_INFO: Record<PathKind, PathDefinition> = {
  treasure: { name: 'TREASURE PATH', kanji: '宝', line: 'Three chests lie in the next place', color: 0xffc23a },
  spring: { name: 'HEALING SPRING', kanji: '泉', line: 'Everyone healed whole and back on their feet', color: 0x3ae88a },
  trial: { name: 'ELITE TRIAL', kanji: '試', line: 'More elite packs - each leader carries treasure', color: 0xff3a4a },
  cursed: { name: 'CURSED DOOR', kanji: '呪', line: 'A harder round - double score and two bonus skill points', color: 0xa050ff },
  ward: { name: 'THE WARD', kanji: '守', line: 'Hold the ward against them all - a chest for each of you', color: 0x4ab8ff },
  night: { name: 'THE LONG NIGHT', kanji: '夜', line: 'Survive a minute of all of them - double experience', color: 0xff8a2a },
};
/** The doors that change what the round is: its bar filled by a ward held, or by a clock. */
export const TIMED_PATHS: ReadonlySet<PathKind> = new Set(['ward', 'night']);

/** What each path does to the round it leads to. */
export const PATH_RULES = {
  /** Treasure: chests laid out in the place, to be found. */
  chests: 3,
  /** Trial: this many more elite packs (on top of the rank's), and each one's leader drops a chest. */
  elites: 2,
  /** Cursed: the horde's health and blows, the boss's, the score, and the points at the end. */
  cursedHorde: 1.3, cursedBoss: 1.22, cursedScore: 2, cursedPoints: 2,
  /** The ward: its circle, the seconds it is to be held (it gives back a quarter as fast
   *  while no one stands in it), and the chests it pays - one a fighter. */
  wardRadius: 6, wardSeconds: 40,
  /** The long night: its seconds, the horde that much thicker, and the experience it pays. */
  nightSeconds: 60, nightCrowd: 1.45, nightXp: 2,
} as const;

/** How long the rifts wait for the party, and how close counts as walking in. */
export const PATH_SECONDS = 24;
export const PATH_REACH = 1.8;

export function drawPaths(round: number, springs: boolean, previous: PathKind | undefined, recovery: RecoveryNeed, random: () => number): PathKind[] {
  const choose = (pool: readonly PathKind[]) => {
    const fresh = pool.length > 1 ? pool.filter(kind => kind !== previous) : pool;
    return fresh[Math.min(fresh.length - 1, Math.floor(random() * fresh.length))];
  };
  // Boss-clear healing can fill the whole party. A recovery door would then
  // spend one of only three choices on no benefit, so offer supplies instead.
  const utility: readonly PathKind[] = springs && recovery !== 'healthy' ? ['treasure', 'spring'] : ['treasure'];
  const result: PathKind[] = [
    springs && recovery === 'critical' ? 'spring' : choose(utility),
    choose(round >= 2 ? ['trial', 'cursed'] : ['trial']),
    choose(['ward', 'night']),
  ];
  // Positions vary too: a familiar reward is not always the left-hand door.
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(random() * (i + 1)));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
