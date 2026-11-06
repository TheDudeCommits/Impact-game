/** Rift Depth (the overhaul's Phase 5, item 1; the first ten, item 9):
 *  "Sealing the rift opens depth 1, and so on to 15. Each adds a rule - more
 *  affixes, less healing, two bosses sooner - and pays something only it pays."
 *
 *  A run is fought at a depth chosen before it; the rule of every depth down
 *  to it holds. Sealing the rift (beating rank S) at the deepest depth open
 *  opens the next. A run pays more shards and Sumi the deeper it is, and each
 *  depth sealed is a seal of its own on the profile.
 *
 *  Data and arithmetic only (the match server reads it too). */

export const MAX_DEPTH = 15;

export interface DepthRule {
  /** Its name, and what it does, as the picker and the profile say it. */
  name: string;
  line: string;
}

/** Depth n's own rule is DEPTH_RULES[n - 1]; all those under it hold with it. */
export const DEPTH_RULES: readonly DepthRule[] = [
  { name: 'SHARPER TEETH', line: 'The horde hits 10% harder.' },
  { name: 'THICKER HIDES', line: 'The horde has 15% more health.' },
  { name: 'THE HUNT QUICKENS', line: 'One more elite pack comes each round.' },
  { name: 'THIN BLOOD', line: 'Every heal is 20% weaker.' },
  { name: 'IRON MASTERS', line: 'Bosses have 15% more health.' },
  { name: 'SWIFT DEAD', line: 'The horde moves 8% faster.' },
  { name: 'DRY ROAD', line: 'No healing springs at the fork.' },
  { name: 'RELENTLESS', line: 'Bosses throw their set pieces 20% more often.' },
  { name: 'THE HORDE THICKENS', line: 'The field is 15% more crowded.' },
  { name: 'CRUEL MASTERS', line: 'Bosses hit 15% harder.' },
  { name: 'NO QUARTER', line: 'No health back between rounds.' },
  { name: 'TWO MASTERS', line: 'From rank A the Rift sends its bosses two at a time.' },
  { name: 'EARLY WRATH', line: 'Bosses awaken at two-thirds of their health.' },
  { name: 'ELITE LEGION', line: 'Elites among the horde are twice as common.' },
  { name: 'THE ABYSS', line: 'Everything in the Rift hits 15% harder again.' },
];

/** What a depth changes, all its rules folded together. */
export interface DepthMods {
  hordeHp: number; hordeDamage: number; hordeSpeed: number; crowd: number;
  bossHp: number; bossDamage: number;
  /** Every heal, multiplied (health orbs, lifesteal, the breaths between rounds). */
  heal: number;
  /** Elite packs more each round, and how much more often an elite walks in the crowd. */
  elites: number; eliteChance: number;
  springs: boolean;
  /** Seconds between a boss's set pieces, multiplied. */
  sigPace: number;
  /** Health back between rounds. */
  roundHeal: boolean;
  /** Bosses two at a time from this rank's index (RANKS) on; 99 never before the Rift's own loops. */
  doubleFrom: number;
  /** The share of health a boss awakens at. */
  awaken: number;
}

export function depthMods(depth: number): DepthMods {
  const d = Math.max(0, Math.min(MAX_DEPTH, Math.floor(depth)));
  const at = (n: number) => d >= n;
  const abyss = at(15) ? 1.15 : 1;
  return {
    hordeDamage: (at(1) ? 1.1 : 1) * abyss, hordeHp: at(2) ? 1.15 : 1, hordeSpeed: at(6) ? 1.08 : 1, crowd: at(9) ? 1.15 : 1,
    bossHp: at(5) ? 1.15 : 1, bossDamage: (at(10) ? 1.15 : 1) * abyss,
    heal: at(4) ? .8 : 1, elites: at(3) ? 1 : 0, eliteChance: at(14) ? 2 : 1,
    springs: !at(7), sigPace: at(8) ? .8 : 1, roundHeal: !at(11), doubleFrom: at(12) ? 5 : 99, awaken: at(13) ? 2 / 3 : .5,
  };
}

/** What a run at `depth` pays, as a multiple of what it would at the surface. */
export const depthPay = (depth: number) => 1 + .15 * Math.max(0, Math.min(MAX_DEPTH, Math.floor(depth)));

/** The depths open to a player whose deepest seal is `sealed` (-1: never sealed): the surface, and one below each seal. */
export const openDepth = (sealed: number) => Math.max(0, Math.min(MAX_DEPTH, Math.floor(sealed) + 1));
/** A depth asked for, held to what is open. */
export const clampDepth = (depth: unknown, sealed: number) => typeof depth === 'number' && Number.isFinite(depth) ? Math.max(0, Math.min(openDepth(sealed), Math.floor(depth))) : 0;
