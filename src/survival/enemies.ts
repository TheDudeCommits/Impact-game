/** Arcade survival's enemies: what each one is, what it throws and how its
 *  model's clips map onto the simulation's actions.
 *
 *  Data only, with no renderer or DOM dependencies: the local simulation reads
 *  the moves, hit points and brains, the renderer reads the models and clips,
 *  and both read the same table. Every enemy is an ordinary actor in
 *  `ArenaSimulation` (see `addCombatant`), so a fighter's whole kit - rush
 *  strings, launches, juggles, chases, beams, time stop - lands on a horde
 *  exactly as it lands on a rival.
 *
 *  Move timings come from the clips themselves: `scripts/survival/clip_sheet.py`
 *  renders each clip and reports where its furthest forward reach falls, and a
 *  move's contact is set on that frame so the blow lands when it is seen to.
 */
import { CLEAN_ATTACKS, CLEAN_INTROS } from './bossAttacks'; // the bosses' clean attack clips
import type { MoveDefinition, SlotMoves } from '../game/moves';
import type { AttackSlot, FighterId } from '../game/types';

export type EnemyRole = 'fodder' | 'gunner' | 'brute' | 'elite' | 'boss';
export type BrainKind = 'swarm' | 'gunner' | 'brute' | 'boss';

/** One of an enemy's moves: a simulation move, the slot it is thrown from
 *  (which decides what it breaks and how hard it stops time on impact), the
 *  clip that plays it, and what the brain needs to know to choose it. */
export interface EnemyMove extends MoveDefinition {
  slot: AttackSlot;
  /** Clip name patterns, tried in order against the model's clips. */
  clip: string[];
  /** The clip's length in seconds, when it is played at the move's own
   *  duration rather than at its natural speed. */
  clipSeconds?: number;
  /** A move cut into several clips in the source - a wind-up, a loop and a
   *  release - played end to end across the move's duration, each in
   *  proportion to its length. Replaces `clip` when the parts are found. */
  chain?: string[];
  /** Where the brain will throw it from, centre to centre, in metres. */
  minRange?: number;
  maxRange?: number;
  /** How often the brain picks it, against the others in range. */
  weight?: number;
  /** A boss move comes out of this phase on (0 = from the start). */
  phase?: number;
  /** Seconds before the same boss move is picked again. */
  rest?: number;
  /** A warning drawn on the floor ahead of the blow. */
  telegraph?: 'ring' | 'cone' | 'line' | 'target';
  /** Announced across the screen when a boss throws it. */
  callout?: boolean;
  show?: RegExp;
  conceal?: RegExp;
  /** Visual flavour for the renderer's effects. */
  element?: 'steel' | 'fire' | 'magma' | 'light' | 'ice' | 'lightning' | 'dark' | 'ki' | 'sound' | 'blood' | 'void-ray' | 'jade';
  /** A rain: while the move plays, `count` strikes fall around its target,
   *  one every `every` seconds from `start`, each warned on the floor `lead`
   *  seconds before it lands. The first falls where the target stands; the
   *  rest scatter within `spread` of wherever they are by then, so the rain
   *  follows them and standing still is the one answer that never works.
   *  See SurvivalGame.hazards. */
  rain?: Rain;
}

export interface Rain { count: number; every: number; lead: number; spread: number; radius: number; damage: number; start?: number; knockback?: number }

export interface EnemyClips {
  idle: string[];
  run: string[];
  walk?: string[];
  hit: string[];
  /** Knocked down, played once and held on its last frame. */
  down: string[];
  getup: string[];
  stun?: string[];
  /** Flying from a launch or a big knockback. */
  blown?: string[];
  /** Hitting the floor out of a launch. */
  land?: string[];
  death?: string[];
  dash?: string[];
  jump?: string[];
  fall?: string[];
  /** Roar or rally: played while the brain holds it still to show off. */
  taunt?: string[];
  guard?: string[];
  /** The entrance: a boss's intro pose. */
  intro?: string[];
}

export interface EnemyDefinition {
  id: string;
  name: string;
  /** A boss's epithet, printed under the name on its card. */
  title?: string;
  series: string;
  role: EnemyRole;
  brain: BrainKind;
  model: string;
  /** Height in metres the model is normalised to. */
  height: number;
  /** Hit volume and pushbox against a fighter's (1). */
  size?: number;
  /** Rotates a source that does not face +Z, in radians. */
  yaw?: number;
  hp: number;
  /** Damage it absorbs before it staggers. Fodder has none. */
  poise?: number;
  /** Ground speed against a fighter's 7.5 m/s. */
  speed: number;
  /** Damage taken and dealt against the move tables. */
  damageIn?: number;
  knockbackIn?: number;
  stunIn?: number;
  /** A combo breaker after BREAK_CASTS: off for fodder, on for anything that
   *  must not be juggled from full health. */
  breaker?: boolean;
  moves: EnemyMove[];
  clips: EnemyClips;
  /** What killing it is worth, and what it costs a wave's budget. */
  xp: number;
  score: number;
  cost: number;
  /** Accent colour for its health bar, portal and hit sparks. */
  color: number;
  /** Multiplies the model's own colours: one model, several ranks. */
  tint?: number;
  /** Clip playback speed for locomotion, per metre a second of travel. */
  runSpeed?: number;
  hide?: RegExp;
  /** Closes the distance in a flash - a step, light speed, ASHSTEP -
   *  at most every `every` seconds, when its target is more than `beyond`
   *  metres off: gone, and at their back. */
  blink?: { every: number; beyond: number };
  /** Too big to throw: blows never launch it (Kurobi). */
  anchored?: boolean;
  /** Its pushbox radius in metres, when the body is far bigger than its hit
   *  volume: fighters are held at a giant's flank instead of inside it. */
  girth?: number;
  /** A boss with a second form: felled, it rises again as `into`, with a
   *  bar of its own, and only that form's fall ends the act. */
  transform?: { into: string };
  /** A roster fighter the rift has turned against the player: the arena's
   *  own bot drives it with its whole kit, its voice and its effects, and
   *  the client draws it as the fighter it is (see SurvivalGame.spawn). It
   *  has no model or moves of its own. */
  rival?: FighterId;
  /** Rigged to Meshy's humanoid skeleton with no clips of its own: it plays
   *  the horde's motion library (render/horde/motion.ts), by these names. */
  motion?: 'humanoid';
}

const melee = (name: string, slot: AttackSlot, clip: string[], duration: number, contact: number, damage: number, extra: Partial<EnemyMove> = {}): EnemyMove => ({
  name, slot, clip, duration, contacts: [contact], damage, range: 1.8, radius: .55, stamina: 0,
  cooldown: .2, stun: .32, knockback: 3.2, style: 'melee', lunge: 2.6, minRange: 0, maxRange: 2.4, weight: 1, ...extra,
});
const shot = (name: string, slot: AttackSlot, clip: string[], duration: number, contact: number, damage: number, extra: Partial<EnemyMove> = {}): EnemyMove => ({
  name, slot, clip, duration, contacts: [contact], damage, range: 18, radius: .45, stamina: 0,
  cooldown: .2, stun: .35, knockback: 4, style: 'projectile', speed: 26, minRange: 4, maxRange: 16, weight: 1, ...extra,
});

const brClips = (extra: Partial<EnemyClips> = {}): EnemyClips => ({
  idle: ['_idle_a', '_idle'], run: ['_run'], hit: ['_damage'], down: ['_down'], getup: ['_down_end'],
  stun: ['_stun'], blown: ['_blownback_lp'], land: ['_blownback_end', '_slammed'], dash: ['_boost', '_dodge'],
  jump: ['_jump'], fall: ['_jump_lp'], taunt: ['_boost'], ...extra,
});

const TRIBUNAL_GUARD_CREDIT = 'Tribunal guard: original body (Tripo image-to-3D from its own concept), on the horde\'s shared skeleton and motion library.';

export const ENEMIES: Record<string, EnemyDefinition> = {
  // The rank and file at Wreckers' Causeway. A musket with a bayonet: a thrust, a
  // butt slam and, from the riflemen, a shot.
  'tribunal-guard': {
    id: 'tribunal-guard', name: 'Tribunal Guard', series: 'Dust Sea', role: 'fodder', brain: 'swarm',
    model: '/assets/survival/enemies/tribunal-guard.glb', height: 1.72, hp: 120, speed: .6,
    moves: [
      melee('Bayonet Thrust', 'light', ['_combo_b'], 1.23, .64, 22, { range: 2.1, cooldown: 1.2, knockback: 3.6 }),
      melee('Rifle Butt', 'heavy', ['_combo_c'], 1.8, .6, 34, { range: 1.9, cooldown: 3, knockback: 5.5, stun: .45, weight: .35 }),
    ],
    clips: brClips(), xp: 1, score: 40, cost: 1, color: 0x3d6fb8,
  },
  'tribunal-rifleman': {
    id: 'tribunal-rifleman', name: 'Tribunal Rifleman', series: 'Dust Sea', role: 'gunner', brain: 'gunner',
    model: '/assets/survival/enemies/tribunal-guard.glb', height: 1.72, hp: 95, speed: .56,
    moves: [
      shot('Musket Volley', 'special', ['_combo_a'], 2.5, 1.5, 24, { cooldown: 4.2, element: 'steel' }),
      melee('Bayonet Thrust', 'light', ['_combo_b'], 1.23, .64, 20, { range: 2.1, cooldown: 1.4, maxRange: 2.2 }),
    ],
    clips: brClips(), xp: 2, score: 60, cost: 2, color: 0x6b8fcf, tint: 0xd8e4ff,
  },
  // A lieutenant: the same body a head taller, in no hurry, and hard to move.
  'tribunal-lieutenant': {
    id: 'tribunal-lieutenant', name: 'Tribunal Lieutenant', series: 'Dust Sea', role: 'brute', brain: 'brute',
    model: '/assets/survival/enemies/tribunal-guard.glb', height: 2.25, size: 1.3, hp: 520, poise: 160, speed: .5,
    knockbackIn: .5, stunIn: .8, breaker: true,
    moves: [
      melee('Crushing Butt', 'heavy', ['_combo_c'], 1.95, .7, 60, { range: 2.5, radius: .8, cooldown: 2.4, knockback: 8, stun: .6, guardBreak: true, lunge: 3.2, maxRange: 2.9 }),
      melee('Bayonet Thrust', 'light', ['_combo_b'], 1.3, .68, 44, { range: 2.6, cooldown: 1.6, knockback: 5, lunge: 4.5, maxRange: 3.4 }),
    ],
    clips: brClips(), xp: 6, score: 240, cost: 4, color: 0x1f3f7a, tint: 0x8a93b8,
  },
};

const CLEAN_STATES = ['hit', 'down', 'getup', 'stun', 'blown', 'land', 'death', 'dash', 'jump', 'fall', 'taunt'] as const;
const withClean = (c: EnemyClips): EnemyClips => ({
  ...c, idle: ['clean_idle', ...c.idle], run: ['clean_run', ...c.run], walk: ['clean_walk', ...(c.walk ?? c.run)],
  ...Object.fromEntries(CLEAN_STATES.map(state => [state, [`clean_${state}`, ...(c[state] ?? [])]])),
});
const multi = (base: EnemyMove, contacts: number[], finisherDamage?: number): EnemyMove => ({ ...base, contacts, finisherDamage });

// LANTERN_GUARD, who hold Wreckers' Causeway: three champions who come one at a time.
ENEMIES.harrow = {
  id: 'harrow', name: 'Harrow', title: 'The Gravehound Monk', series: 'Dust Sea', role: 'elite', brain: 'boss',
  model: '/assets/survival/enemies/harrow.glb', height: 2.05, size: 1.15, hp: 1300, poise: 200, speed: .82, knockbackIn: .45, stunIn: .7, breaker: true,
  moves: [
    melee('Shackle Fist', 'light', ['_combo_a'], 1.13, .55, 46, { range: 2.1, lunge: 4, knockback: 4, maxRange: 2.8, rest: .4 }),
    melee('Grave Rake', 'heavy', ['_combo_c'], 1.37, .8, 66, { range: 2.4, radius: .75, lunge: 5.5, knockback: 7, maxRange: 3.4, rest: 1.5 }),
    melee('Gravehound Lunge', 'special', ['_skill_b'], 1.5, .62, 84, { range: 2.5, radius: .8, lunge: 8, close: 8, knockback: 9, guardBreak: true, telegraph: 'cone', minRange: 2, maxRange: 8, rest: 4 }),
  ],
  clips: withClean(brClips({ intro: ['_opening'], death: ['_lose'] })), xp: 14, score: 1500, cost: 6, color: 0xb03028,
};
ENEMIES.kanuki = {
  id: 'kanuki', name: 'Kanuki', title: 'The Lockwarden', series: 'Dust Sea', role: 'elite', brain: 'boss',
  model: '/assets/survival/enemies/kanuki.glb', height: 2.2, size: 1.15, hp: 1400, poise: 260, speed: .7, knockbackIn: .4, stunIn: .7, breaker: true,
  moves: [
    melee('Padlock Jab', 'light', ['_combo_a'], .97, .42, 40, { range: 2.1, lunge: 3.5, maxRange: 2.7, rest: .3 }),
    melee('Bolt-Bar Kick', 'heavy', ['_combo_c'], 1.17, .47, 58, { range: 2.3, lunge: 8, close: 8, knockback: 6, maxRange: 7, minRange: 1.5, rest: 2.5, telegraph: 'line' }),
    melee('Prison Door Slam', 'special', ['_combo_b'], 1.23, .56, 72, { range: 2.4, radius: .9, knockback: 8, guardBreak: true, maxRange: 3, rest: 3.5, telegraph: 'cone' }),
  ],
  clips: withClean(brClips({ intro: ['_opening'], death: ['_lose'] })), xp: 14, score: 1500, cost: 6, color: 0xe07a2a,
};
ENEMIES.takane = {
  id: 'takane', name: 'Takane', title: 'The Knife Bride', series: 'Dust Sea', role: 'elite', brain: 'boss',
  model: '/assets/survival/enemies/takane.glb', height: 1.95, size: 1.05, hp: 1200, poise: 180, speed: .84, knockbackIn: .45, stunIn: .7, breaker: true,
  moves: [
    melee('Veil Cut', 'light', ['_combo_b'], .93, .5, 42, { range: 2.3, lunge: 4.5, maxRange: 2.9, rest: .3 }),
    melee('Cartwheel of Knives', 'heavy', ['_combo_c'], 1.33, .55, 60, { range: 2.2, knockback: 7, lunge: 4, maxRange: 2.8, rest: 1.8 }),
    multi(melee('Hundred-Knife Waltz', 'special', ['_skill_a_lp'], 2.2, .5, 34, { range: .2, radius: 2.3, knockback: 5, lunge: 0, maxRange: 2.6, rest: 5, telegraph: 'ring', clipSeconds: 2.2 }), [.5, .9, 1.3, 1.7], 60),
  ],
  clips: withClean(brClips({ intro: ['_boost'], death: ['_lose'] })), xp: 14, score: 1500, cost: 6, color: 0xc02a3a,
};
// Kade, awakened: the leopard that ends Wreckers' Causeway.
ENEMIES.kade = {
  id: 'kade', name: 'Kade', title: 'The Silk Stalker', series: 'Dust Sea', role: 'boss', brain: 'boss',
  model: '/assets/survival/enemies/kade.glb', height: 2.3, size: 1.3, hp: 6000, poise: 480, speed: .92, knockbackIn: .25, stunIn: .6, breaker: true,
  blink: { every: 8, beyond: 9 },
  moves: [
    melee('Wrist-Blade Rake', 'light', ['_combo_a'], 1.13, .5, 64, { range: 2.4, radius: .7, lunge: 5, knockback: 4, maxRange: 3.2, rest: .2 }),
    melee('Silk Step', 'heavy', ['_combo_b'], 1.13, .45, 82, { range: 2.6, radius: .75, lunge: 9, close: 10, knockback: 7, maxRange: 10, minRange: 2.5, rest: 2.2, telegraph: 'line' }),
    multi(shot('Cut Threads', 'special', ['_skill_b'], 1.83, .55, 58, { speed: 30, range: 22, radius: .75, knockback: 5, minRange: 4.5, maxRange: 20, rest: 4.5, element: 'steel', callout: true }), [.55, .8, 1.05], 58),
    melee('Stilling Palm', 'ultimate', ['_skill_a'], 1.63, .9, 190, { range: 2.8, radius: 1.5, knockback: 13, lunge: 3, guardBreak: true, telegraph: 'cone', maxRange: 3.6, rest: 7, callout: true, element: 'sound' }),
    multi(melee('Needle Silk', 'heavy', ['_combo_c'], 1.1, .3, 30, { range: 2.3, lunge: 5, knockback: 2, maxRange: 3, rest: 3, phase: 1 }), [.3, .46, .62], 70),
  ],
  clips: withClean(brClips({ intro: ['_victory'], death: ['_down'], taunt: ['_victory'] })), xp: 60, score: 12000, cost: 0, color: 0xd9a33a,
};

// ---- Act II: Dry Harbour ---------------------------------------------------
// The war at the navy's headquarters. Two of the three stand in each run's way
// as champions; Caldera ends it. A champion here is half a head again over a
// fighter and moves like one: Lumen is simply somewhere else.
const MAGMA_ARMS = /arms_magma|hand_fist_magma|body_magma/;
const PLAIN_ARMS = /\b[lr]_arms_pl_|\b[lr]_hand_(fist|open)_pl_/;
ENEMIES.lumen = {
  id: 'lumen', name: 'Lumen', title: 'The Glare Widow', series: 'Dust Sea', role: 'elite', brain: 'boss',
  model: '/assets/survival/enemies/lumen.glb', height: 2.7,
  size: 1.2, hp: 1900, poise: 260, speed: .88, knockbackIn: .4, stunIn: .7, breaker: true,
  blink: { every: 5.5, beyond: 6.5 },
  moves: [
    melee('Mirror Kick', 'light', ['_combo_a'], 1.37, .48, 50, { range: 2.3, lunge: 5, knockback: 4, maxRange: 3, rest: .3, element: 'light', show: /light_(leg|shoes)/ }),
    melee("Widow's Flash", 'heavy', ['_combo_b'], 1.17, .55, 74, { range: 2.5, radius: .8, lunge: 10, close: 11, knockback: 9, minRange: 2.5, maxRange: 11, rest: 2.5, telegraph: 'line', element: 'light', show: /light_(leg|shoes)/ }),
    multi(shot('Halo Shards', 'special', ['_skill_b'], 2.4, .8, 24, { clipSeconds: 4.97, speed: 48, range: 24, radius: .45, knockback: 2, stun: .25, minRange: 3.5, maxRange: 20, rest: 4.5, element: 'light', show: /hand_hundred_lights/ }), [.8, 1, 1.2, 1.4, 1.6, 1.8], 44),
    melee('Mourning Light', 'ultimate', ['_skill_a'], 2, .73, 40, { range: 1.2, radius: 1.9, lunge: 0, knockback: 6, maxRange: 16, rest: 9, telegraph: 'ring', element: 'light', callout: true,
      rain: { count: 12, every: .13, lead: .8, spread: 5, radius: 1.5, damage: 34, start: .35 } }),
  ],
  clips: withClean(brClips({ intro: ['_opening'], death: ['_lose'], taunt: ['_victory'] })), xp: 18, score: 2400, cost: 6, color: 0xffd21e,
};
ENEMIES.rime = {
  id: 'rime', name: 'Rime', title: 'The Glacier Hermit', series: 'Dust Sea', role: 'elite', brain: 'boss',
  model: '/assets/survival/enemies/rime.glb', height: 2.79,
  size: 1.2, hp: 2100, poise: 300, speed: .78, knockbackIn: .4, stunIn: .7, breaker: true,
  moves: [
    melee('Icicle Rake', 'light', ['_combo_a'], 1.3, .53, 50, { range: 2.6, radius: .7, lunge: 4, knockback: 4, maxRange: 3.2, rest: .3, element: 'ice' }),
    melee('Glacier Crescent', 'heavy', ['_combo_c'], 1.7, .77, 70, { range: 2.8, radius: .9, lunge: 5, knockback: 8, maxRange: 3.4, rest: 1.8, element: 'ice' }),
    melee('Hoarfrost Breath', 'special', ['_skill_a'], 2.37, 1.38, 92, { range: 6.5, radius: 2.2, lunge: 0, knockback: 5, stun: 1.2, maxRange: 7.5, rest: 6, telegraph: 'cone', element: 'ice', callout: true }),
    shot('Calving Glacier', 'ultimate', ['_skill_b'], 2.6, 1.25, 130, { clipSeconds: 4.3, speed: 20, range: 26, radius: 1.5, knockback: 12, stun: .8, guardBreak: true, minRange: 4, maxRange: 22, rest: 8, telegraph: 'line', element: 'ice', callout: true }),
  ],
  hide: /\b[lr]_arm_pl_/,
  clips: withClean(brClips({ intro: ['_opening'], death: ['_lose'], taunt: ['_victory'] })), xp: 18, score: 2400, cost: 6, color: 0x7fd8ff,
};
ENEMIES.gantry = {
  id: 'gantry', name: 'Gantry', title: 'The Chain Abbot', series: 'Dust Sea', role: 'elite', brain: 'boss',
  model: '/assets/survival/enemies/gantry.glb', height: 2.77,
  size: 1.35, hp: 2400, poise: 380, speed: .66, knockbackIn: .3, stunIn: .6, breaker: true,
  moves: [
    melee('Gauntlet Cleave', 'light', ['_combo_a'], 1.3, .53, 56, { range: 2.7, radius: .9, lunge: 3.5, knockback: 5, maxRange: 3.3, rest: .4 }),
    melee('Millstone Palm', 'heavy', ['_combo_c'], 1.37, .6, 88, { range: 2.5, radius: 1, lunge: 4.5, knockback: 13, stun: .7, guardBreak: true, maxRange: 3.2, rest: 3, telegraph: 'cone', callout: true }),
    melee('Bell-Tower Slam', 'special', ['_skill_a'], 2.4, 1.05, 104, { range: 1.6, radius: 2.8, lunge: 6, close: 7, knockback: 9, maxRange: 8, rest: 5, telegraph: 'ring' }),
  ],
  hide: /\bweapon_pl|[lr]_weapon|hand_weapon|wood_pl|icosphere/i,
  clips: withClean(brClips({ intro: ['_opening'], death: ['_lose'], taunt: ['_victory'] })), xp: 18, score: 2400, cost: 6, color: 0xc0903a,
};
// Caldera: judgement in a magma fist. Final Sentence: Brimstone Rain comes
// out once he is enraged.
ENEMIES.caldera = {
  id: 'caldera', name: 'Caldera', title: 'The Molten Monk', series: 'Dust Sea', role: 'boss', brain: 'boss',
  model: '/assets/survival/enemies/caldera.glb', height: 2.5, size: 1.35, hp: 7200, poise: 560, speed: .8, knockbackIn: .22, stunIn: .55, breaker: true,
  moves: [
    melee('Charred Fist', 'light', ['_combo_a'], 1.37, .45, 66, { range: 2.5, radius: .8, lunge: 5, knockback: 5, maxRange: 3.2, rest: .2, element: 'magma' }),
    melee('Rising Cinder', 'light', ['_combo_b'], 1.33, .47, 72, { range: 2.4, radius: .8, lunge: 4.5, knockback: 6, maxRange: 3, rest: 1.2, element: 'magma' }),
    melee('Lava Tears', 'heavy', ['_combo_c'], 2.13, 1.12, 104, { range: 2.8, radius: 1, lunge: 7, close: 8, knockback: 11, guardBreak: true, minRange: 1.5, maxRange: 8, rest: 3, telegraph: 'line', element: 'magma', show: MAGMA_ARMS, conceal: PLAIN_ARMS }),
    shot('Rosary Burst', 'special', ['_skill_a'], 2.6, 1.07, 150, { speed: 24, range: 26, radius: 1.7, knockback: 12, stun: .9, minRange: 3.5, maxRange: 22, rest: 5, telegraph: 'line', element: 'magma', callout: true, show: MAGMA_ARMS, conceal: PLAIN_ARMS }),
    melee('Rain of Embers', 'ultimate', ['_skill_b'], 2.07, .55, 60, { range: .5, radius: 2.8, lunge: 0, knockback: 9, maxRange: 18, rest: 9, telegraph: 'ring', element: 'magma', callout: true, phase: 1, show: MAGMA_ARMS, conceal: PLAIN_ARMS,
      rain: { count: 14, every: .16, lead: 1, spread: 6, radius: 1.9, damage: 72, start: .5, knockback: 8 } }),
  ],
  clips: withClean(brClips({ intro: ['_opening'], death: ['_lose'], taunt: ['_victory'] })), xp: 70, score: 16000, cost: 0, color: 0xff3a0a,
};

const cinderRequiemClips = (extra: Partial<EnemyClips> = {}): EnemyClips => ({
  idle: ['idle'], run: ['run'], hit: ['strike_1'], down: ['back', 'die'], getup: ['idle'], stun: ['strike_1'],
  blown: ['back'], land: ['back'], death: ['die'], dash: ['run'], jump: ['run'], fall: ['back'], taunt: ['stay_show'], intro: ['stay_show'], ...extra,
});
const WITS = (name: string) => `${name} by witsanusuperball, CC Attribution`;
// The rank and file: generated for this game (Meshy), rigged and animated.
const hollowClips = (extra: Partial<EnemyClips> = {}): EnemyClips => ({
  idle: ['idle'], run: ['run'], walk: ['walk'], hit: ['hit'], down: ['knockdown'], getup: ['getup'], stun: ['hit'],
  blown: ['knockdown'], land: ['knockdown'], death: ['die'], dash: ['run'], jump: ['run'], fall: ['knockdown'], taunt: ['roar'], ...extra,
});
const GRUNT_BODY = "The horde's own body (generated for Rift Arena with Meshy), playing its motion library";
const HOLLOW_CREDIT = GRUNT_BODY;
ENEMIES['ash-wraith'] = {
  id: 'ash-wraith', name: 'Ash Wraith', series: 'Cinder Requiem', role: 'fodder', brain: 'swarm',
  model: '/assets/survival/motion/grunt-rift-spawn.glb', motion: 'humanoid', height: 1.95, hp: 150, speed: .7,
  moves: [
    melee('Snow Swipe', 'light', ['claw'], 1.2, .59, 26, { clipSeconds: 2.23, range: 2.1, cooldown: 1.2, knockback: 3.8, element: 'blood' }),
    multi(melee('Frenzy', 'heavy', ['combo'], 1.6, .69, 22, { clipSeconds: 2.33, range: 2.2, cooldown: 3, knockback: 5.5, stun: .45, weight: .35, element: 'blood' }), [.69, .93], 30),
  ],
  clips: hollowClips(), xp: 1, score: 45, cost: 1, color: 0x1a1a22,
};
ENEMIES['ash-caster'] = {
  id: 'ash-caster', name: 'Wraith Caster', series: 'Cinder Requiem', role: 'gunner', brain: 'gunner',
  model: '/assets/survival/motion/grunt-rift-spawn.glb', motion: 'humanoid', height: 1.95, hp: 115, speed: .62,
  moves: [
    shot('Ash Lance', 'special', ['roar'], 2.2, 1.54, 26, { clipSeconds: 2.43, speed: 30, radius: .6, cooldown: 4.2, element: 'void-ray' }),
    melee('Snow Swipe', 'light', ['claw'], 1.2, .59, 22, { clipSeconds: 2.23, range: 2.1, cooldown: 1.4, maxRange: 2.2, element: 'blood' }),
  ],
  clips: hollowClips(), xp: 2, score: 70, cost: 2, color: 0xff1e3c, tint: 0xffd0d8,
};
// A Great Wraith: the same body, grown huge and slow.
ENEMIES['hollow-great-wraith'] = {
  id: 'hollow-great-wraith', name: 'Great Wraith', series: 'Cinder Requiem', role: 'brute', brain: 'brute',
  model: '/assets/survival/motion/grunt-rift-spawn.glb', motion: 'humanoid', height: 3.1, size: 1.55, hp: 640, poise: 200, speed: .45,
  knockbackIn: .4, stunIn: .7, breaker: true,
  moves: [
    melee('Crushing Claw', 'heavy', ['combo'], 1.9, 1.1, 60, { clipSeconds: 2.33, range: 3, radius: 1, cooldown: 2.4, knockback: 9, stun: .6, guardBreak: true, lunge: 3, maxRange: 3.4, telegraph: 'cone', element: 'blood' }),
    shot('Great Ash Lance', 'special', ['roar'], 2.6, 1.82, 56, { clipSeconds: 2.43, speed: 24, radius: 1.1, cooldown: 5, minRange: 4, maxRange: 18, telegraph: 'line', element: 'void-ray' }),
  ],
  clips: hollowClips(), xp: 7, score: 280, cost: 4, color: 0x2a2a3a, tint: 0xb8b8c8,
};
ENEMIES.zarek = {
  id: 'zarek', name: 'Zarek', title: 'The Obsidian Panther', series: 'Cinder Requiem', role: 'elite', brain: 'boss',
  model: '/assets/survival/enemies/zarek.glb', height: 2.05, size: 1.1, hp: 2300, poise: 300, speed: .98, knockbackIn: .4, stunIn: .7, breaker: true,
  blink: { every: 6, beyond: 7 },
  moves: [
    multi(melee('Glass Claws', 'light', ['CommonAttack'], 2, .55, 30, { range: 2.4, radius: .7, lunge: 5, knockback: 3, maxRange: 3, rest: .3, element: 'fire' }), [.55, 1.07], 44),
    melee('Obsidian Pounce', 'heavy', ['attack_3'], 2.03, 1.03, 78, { range: 2.6, radius: .8, lunge: 8, close: 10, knockback: 9, minRange: 2, maxRange: 10, rest: 2.2, telegraph: 'line', element: 'fire' }),
    multi(shot('Shard Volley', 'special', ['skill_3_3'], 2.8, 1.2, 28, { chain: ['skill_3_1', 'skill_3_2', 'skill_3_3'], speed: 42, radius: .5, knockback: 2, stun: .25, minRange: 3.5, maxRange: 20, rest: 5, element: 'fire', callout: true }), [1.2, 1.36, 1.52, 1.68, 1.84], 44),
    multi(melee('Magma-Vein Rend', 'ultimate', ['skill_4_3'], 2.8, 1, 30, { chain: ['skill_4_1', 'skill_4_2', 'skill_4_3'], range: 4, radius: 2, lunge: 4, knockback: 4, guardBreak: true, maxRange: 5, rest: 9, telegraph: 'cone', element: 'fire', callout: true }), [1, 1.2, 1.4, 1.6, 1.8], 80),
  ],
  clips: withClean(cinderRequiemClips()), xp: 20, score: 2800, cost: 6, color: 0xff5a14,
};
ENEMIES.nihil = {
  id: 'nihil', name: 'Nihil', title: 'The Faceless Seraph', series: 'Cinder Requiem', role: 'elite', brain: 'boss',
  model: '/assets/survival/enemies/nihil.glb', height: 2.38,
  size: 1.1, hp: 2400, poise: 320, speed: .85, knockbackIn: .4, stunIn: .7, breaker: true,
  blink: { every: 5, beyond: 7 },
  moves: [
    melee('Wing Lash', 'light', ['CommonAttack'], 1.83, .7, 52, { range: 2.9, radius: .8, lunge: 4, knockback: 5, maxRange: 3.4, rest: .3, element: 'dark' }),
    { ...shot('Halo Ray', 'heavy', ['attack_3'], 1.7, .93, 96, { range: 20, radius: .9, knockback: 10, minRange: 3, maxRange: 18, rest: 3.5, telegraph: 'line', element: 'dark' }), style: 'beam' },
    multi(shot('Falling Spikes', 'special', ['skill_1'], 3.2, 1.2, 40, { clipSeconds: 5.07, speed: 34, radius: .7, knockback: 5, minRange: 3, maxRange: 20, rest: 5, element: 'dark' }), [1.2, 1.7, 2.2], 60),
    { ...shot("Seraph's Spear", 'ultimate', ['skill_3_3'], 3.2, 2.2, 170, { chain: ['skill_3_1', 'skill_3_2', 'skill_3_3'], speed: 30, range: 26, radius: 3, knockback: 13, guardBreak: true, minRange: 4, maxRange: 22, rest: 9, telegraph: 'target', element: 'dark', callout: true }), style: 'bomb' },
  ],
  clips: withClean(cinderRequiemClips()), xp: 20, score: 2800, cost: 6, color: 0x8a6cff,
};
ENEMIES.rakshasa = {
  id: 'rakshasa', name: 'Rakshasa', title: 'The Oni Unchained', series: 'Cinder Requiem', role: 'elite', brain: 'boss',
  model: '/assets/survival/enemies/rakshasa.glb', height: 2.25, size: 1.2, hp: 2800, poise: 420, speed: .82, knockbackIn: .3, stunIn: .6, breaker: true,
  moves: [
    melee('Wild Slash', 'light', ['CommonAttack'], 1.15, .5, 58, { clipSeconds: 1, range: 2.9, radius: .9, lunge: 5, knockback: 5, maxRange: 3.4, rest: .2, element: 'light' }),
    multi(melee('Unchained Flurry', 'heavy', ['skill_1_6'], 2.2, .35, 30, { chain: ['skill_1_1', 'skill_1_2', 'skill_1_3', 'skill_1_4', 'skill_1_5', 'skill_1_6', 'skill_1_7'], range: 2.8, radius: 1, lunge: 6, close: 7, knockback: 3, maxRange: 6, rest: 3, element: 'light' }), [.35, .7, 1.05, 1.4, 1.75], 70),
    melee('Oni Cleave', 'special', ['skill_3'], 2.3, 1.25, 150, { clipSeconds: 2.03, range: 7, radius: 2.1, lunge: 2, knockback: 13, stun: .8, guardBreak: true, maxRange: 7.5, rest: 7, telegraph: 'cone', element: 'light', callout: true }),
  ],
  clips: cinderRequiemClips(), xp: 20, score: 2800, cost: 6, color: 0xffd21e,
};
ENEMIES['nightfall'] = {
  id: 'nightfall', name: 'Nightfall', title: 'The Starless Edge', series: 'Cinder Requiem', role: 'elite', brain: 'boss',
  model: '/assets/survival/enemies/nightfall.glb', height: 2.0, size: 1.05, hp: 2200, poise: 280, speed: .95, knockbackIn: .45, stunIn: .7, breaker: true,
  blink: { every: 6, beyond: 8 },
  moves: [
    multi(melee('Nightfall Rush', 'light', ['CommonAttack'], 1.87, .6, 32, { range: 2.7, radius: .8, lunge: 5, knockback: 3, maxRange: 3.2, rest: .3, element: 'blood' }), [.6, 1.1], 46),
    melee('Blink Cleave', 'heavy', ['attack_3'], 1.7, .9, 80, { range: 2.8, radius: .9, lunge: 8, close: 9, knockback: 9, minRange: 2, maxRange: 9, rest: 2.4, telegraph: 'line', element: 'blood' }),
    shot('Black Crescent', 'special', ['skill_3_3'], 2.2, 1.1, 115, { clipSeconds: 2.83, speed: 32, range: 26, radius: 1.3, knockback: 10, minRange: 3.5, maxRange: 22, rest: 5, telegraph: 'line', element: 'blood', callout: true }),
    { ...shot('Dusk Ray', 'ultimate', ['skill_1_3'], 2.8, 1.45, 150, { clipSeconds: 4.47, range: 22, radius: 1.1, knockback: 12, guardBreak: true, minRange: 3, maxRange: 20, rest: 9, telegraph: 'line', element: 'void-ray', callout: true }), style: 'beam' },
  ],
  clips: withClean(cinderRequiemClips()), xp: 20, score: 2800, cost: 6, color: 0xe0142e,
};
// Shiun, fused with pale seraph: the Blade's master ends the desert.
ENEMIES.shiun = {
  id: 'shiun', name: 'Shiun', title: 'Conductor of the Cinder Requiem', series: 'Cinder Requiem', role: 'boss', brain: 'boss',
  model: '/assets/survival/enemies/shiun.glb', height: 2.2, size: 1.25, hp: 7800, poise: 620, speed: .74, knockbackIn: .22, stunIn: .55, breaker: true,
  blink: { every: 4.5, beyond: 6 },
  moves: [
    melee('Mirage Cut', 'light', ['CommonAttack'], 1.67, .8, 72, { range: 2.7, radius: .8, lunge: 5, knockback: 6, maxRange: 3.3, rest: .2, element: 'dark' }),
    melee('Blink Cut', 'heavy', ['attack_1'], 1.67, .78, 96, { range: 2.8, radius: .9, lunge: 9, close: 10, knockback: 10, minRange: 2, maxRange: 10, rest: 2.6, telegraph: 'line', element: 'dark' }),
    multi(shot('Wing Blades', 'special', ['skill_1_3'], 3.4, 1.3, 34, { chain: ['skill_1_1', 'skill_1_2', 'skill_1_3'], speed: 36, radius: .6, knockback: 3, stun: .3, minRange: 3, maxRange: 22, rest: 5, element: 'dark', callout: true }), [1.3, 1.5, 1.7, 1.9, 2.1, 2.3], 60),
    { ...melee('Sealed Night', 'ultimate', ['skill_3_3'], 3.4, 2.4, 190, { chain: ['skill_3_1', 'skill_3_2', 'skill_3_3'], range: 24, radius: 2.4, knockback: 12, stun: 1, guardBreak: true, minRange: 2, maxRange: 20, rest: 10, telegraph: 'target', element: 'dark', callout: true }), style: 'field' },
    melee('Thousand Lights', 'special', ['skill_1_2'], 2.4, .5, 40, { chain: ['skill_1_1', 'skill_1_2', 'stay_show'], range: .5, radius: 2.6, knockback: 8, maxRange: 18, rest: 10, telegraph: 'ring', element: 'light', callout: true, phase: 1,
      rain: { count: 16, every: .12, lead: .9, spread: 6, radius: 1.4, damage: 64, start: .4, knockback: 7 } }),
  ],
  clips: withClean(cinderRequiemClips({ intro: ['stay_show'], taunt: ['stay_show'] })), xp: 80, score: 20000, cost: 0, color: 0x7a3cff,
};

// ---- Gilded Ruin: LORD ORO -----------------------------------------
// (The fifth list: "bosses for the series that have none".) The roster's own
// LORD ORO, in the rift's boss body: his model carries every clip a boss needs -
// the punches, the knives, the barrage, MIDNIGHT - and his signature stops
// time (signatures.ts).
const oroClips = (extra: Partial<EnemyClips> = {}): EnemyClips => ({
  idle: ['_Idle'], run: ['Run'], walk: ['Walk'], hit: ['Hit 01'], down: ['Die fall'], getup: ['down_end'], stun: ['stun'],
  blown: ['slammed'], land: ['down_end'], death: ['Die fall'], dash: ['Dash'], jump: ['jump'], fall: ['Jump Fall'], guard: ['Block'], taunt: ['shake'], intro: ['MIDNIGHT'], ...extra,
});
ENEMIES.oro = {
  id: 'oro', name: 'Lord ORO', title: 'The Gilded Hour · Lord of the Clock Tower', series: 'Gilded Ruin', role: 'boss', brain: 'boss',
  model: '/assets/fighters/oro-tr1.glb', height: 2.25, size: 1.15, hp: 7000, poise: 560, speed: .9, knockbackIn: .3, stunIn: .6, breaker: true,
  blink: { every: 5, beyond: 7 },
  moves: [
    melee('Gilded Punch', 'light', ['Gilded Punch'], .83, .38, 64, { range: 2.7, radius: .8, lunge: 5, knockback: 6, maxRange: 3.3, rest: .25, element: 'light' }),
    multi(melee('NOROMA NOROMA Barrage', 'heavy', ['Noroma! Barrage'], 3.08, .5, 24, { range: 2.9, radius: 1, lunge: 7, close: 8, knockback: 3, stun: .25, maxRange: 6, rest: 3.2, telegraph: 'cone', element: 'light', callout: true }), [.5, .78, 1.06, 1.34, 1.62, 1.9, 2.18], 92),
    multi(shot('Clock-Hand Knives', 'special', ['Clock-Hand Knives'], 1.33, .55, 34, { speed: 38, radius: .5, knockback: 3, stun: .3, minRange: 3, maxRange: 20, rest: 4, element: 'steel', callout: true }), [.55, .7, .85], 48),
    { ...melee('MIDNIGHT', 'ultimate', ['MIDNIGHT'], 4.79, 2.7, 190, { range: 5, radius: 4.4, knockback: 13, stun: 1, guardBreak: true, maxRange: 9, rest: 9, telegraph: 'ring', element: 'light', callout: true }), style: 'field' },
  ],
  clips: oroClips(), xp: 80, score: 20000, cost: 0, color: 0xf2c94c,
};

const libraryClips = (extra: Partial<EnemyClips> = {}): EnemyClips => ({
  idle: ['idle'], run: ['run'], walk: ['walk'], hit: ['hit'], down: ['knockdown'], getup: ['getup'], stun: ['hit'],
  blown: ['knockdown'], land: ['knockdown'], death: ['die'], dash: ['run-sprint'], jump: ['run'], fall: ['knockdown'], taunt: ['roar'], intro: ['roar2'], ...extra,
});
ENEMIES.magatsu = {
  id: 'magatsu', name: 'Magatsu', title: 'The Calamity of Hex Fallout', series: 'Hex Fallout', role: 'boss', brain: 'boss',
  model: '/assets/survival/enemies/magatsu.glb', height: 2.2, size: 1.15, hp: 7600, poise: 600, speed: .92, knockbackIn: .28, stunIn: .55, breaker: true,
  blink: { every: 5, beyond: 7 },
  moves: [
    melee('Hex Cut', 'light', ['hand-slash', 'jab'], 1, .4, 62, { clipSeconds: 1.58, range: 2.8, radius: .9, lunge: 5, knockback: 5, maxRange: 3.3, rest: .25, element: 'blood' }),
    multi(melee('Rending Hex', 'heavy', ['combo'], 1.7, .73, 58, { clipSeconds: 2.3, range: 3.2, radius: 1.2, lunge: 6, close: 7, knockback: 8, maxRange: 5, rest: 2.6, telegraph: 'cone', element: 'blood', callout: true }), [.73, .99], 70),
    multi(shot('Hex Slashes', 'special', ['sweep', 'claw'], 1.6, .78, 40, { clipSeconds: 1.54, speed: 44, radius: .8, knockback: 4, stun: .3, minRange: 3, maxRange: 20, rest: 4.5, element: 'blood', callout: true }), [.78, .95, 1.12], 56),
    { ...shot('Pyre Arrow', 'ultimate', ['bow-shot', 'roar'], 2.6, 1.82, 200, { clipSeconds: 3, speed: 22, range: 26, radius: 1.6, knockback: 13, stun: .9, guardBreak: true, minRange: 4, maxRange: 22, rest: 9, telegraph: 'line', element: 'fire', callout: true }), style: 'bomb' },
  ],
  clips: libraryClips(), xp: 80, score: 20000, cost: 0, color: 0xd81f3a,
};
ENEMIES.vesper = {
  id: 'vesper', name: 'Vesper', title: 'The Uncrowned', series: 'Grave Hound', role: 'boss', brain: 'boss',
  model: '/assets/survival/enemies/vesper.glb', height: 2.15, size: 1.1, hp: 6800, poise: 540, speed: 1, knockbackIn: .32, stunIn: .6, breaker: true,
  blink: { every: 4.5, beyond: 6 },
  moves: [
    melee('Quill Thrust', 'light', ['thrust', 'jab'], .95, .38, 60, { clipSeconds: 1.35, range: 3, radius: .7, lunge: 6, knockback: 5, maxRange: 3.5, rest: .2, element: 'steel' }),
    multi(melee('Feather Flurry', 'heavy', ['combo'], 1.6, .69, 36, { clipSeconds: 2.3, range: 3, radius: 1, lunge: 7, close: 8, knockback: 4, stun: .3, maxRange: 5, rest: 2.4, telegraph: 'cone', element: 'steel', callout: true }), [.69, .93, 1.17], 72),
    melee('Wing Dive', 'special', ['charged-slash', 'kick'], 1.4, .58, 110, { clipSeconds: 3, range: 3, radius: 1.2, lunge: 12, close: 12, knockback: 11, stun: .6, minRange: 3, maxRange: 12, rest: 5, telegraph: 'line', element: 'light', callout: true }),
    { ...melee('Night of Wings', 'ultimate', ['spell', 'roar2'], 3, 1.95, 190, { clipSeconds: 1.31, range: 5, radius: 4.8, knockback: 12, stun: 1, guardBreak: true, maxRange: 8, rest: 10, telegraph: 'ring', element: 'dark', callout: true }), style: 'field' },
  ],
  clips: libraryClips({ idle: ['parry', 'idle'] }), xp: 80, score: 20000, cost: 0, color: 0xdfe8ff,
};
ENEMIES.imago = {
  id: 'imago', name: 'Imago', title: 'The Swarm Sovereign', series: 'Salvage Wilds', role: 'boss', brain: 'boss',
  model: '/assets/survival/enemies/imago.glb', height: 2.45, size: 1.25, hp: 8000, poise: 640, speed: .95, knockbackIn: .25, stunIn: .5, breaker: true,
  blink: { every: 4, beyond: 6 },
  moves: [
    melee('Stinger Lash', 'light', ['roundhouse', 'claw'], 1.15, .57, 66, { clipSeconds: 2.12, range: 3.4, radius: 1.1, lunge: 4, knockback: 6, maxRange: 3.8, rest: .3, element: 'jade' }),
    melee('Royal Strike', 'heavy', ['uppercut'], 1.2, .7, 120, { clipSeconds: 1.03, range: 2.9, radius: 1, lunge: 7, close: 8, knockback: 12, stun: .6, guardBreak: true, maxRange: 5, rest: 2.8, telegraph: 'line', element: 'jade', callout: true }),
    multi(melee('Tail Lance', 'special', ['blade-spin', 'combo'], 1.7, .73, 44, { clipSeconds: 1.86, range: 4.6, radius: 1, lunge: 3, knockback: 5, stun: .35, maxRange: 5.5, rest: 4, telegraph: 'cone', element: 'jade', callout: true }), [.73, .99, 1.25], 80),
    { ...melee("Ashwing's Decree", 'ultimate', ['judgment', 'roar'], 2.6, 1.82, 200, { clipSeconds: 1.57, range: 5, radius: 5.2, knockback: 14, stun: 1.1, guardBreak: true, maxRange: 9, rest: 10, telegraph: 'ring', element: 'jade', callout: true }), style: 'field' },
  ],
  clips: libraryClips({ idle: ['stance', 'idle'] }), xp: 80, score: 20000, cost: 0, color: 0x3ae88a,
};

const szClips = (extra: Partial<EnemyClips> = {}): EnemyClips => ({
  idle: ['stand_loop'], run: ['float_loop'], hit: ['hurt_in'], down: ['hurt_down'], getup: ['hurt_getup', 'stand_loop'], stun: ['hurt_in'],
  blown: ['hurt_down'], land: ['hurt_down'], death: ['hurt_down'], dash: ['float_loop'], jump: ['float_loop'], fall: ['float_loop'], taunt: ['pose_loop'], intro: ['pose_loop'], ...extra,
});
const rush = (n: number) => [`rush_${n}_in`, `rush_${n}_hit`];
const RUSH = [...rush(1), ...rush(2), ...rush(3), ...rush(4), ...rush(5), 'rush_5_out'];
const smash = (move: string) => [`${move}_1_in`, `${move}_2_charge`, `${move}_3_hit`, `${move}_4_out`];
const BLAST = ['blast_1_in', 'blast_2_charge', 'blast_3_hit', 'blast_6_out'];
// The brood: small, quick and many.
ENEMIES['brood-spawn'] = {
  id: 'brood-spawn', name: 'Brood Spawn', series: 'Last Sun', role: 'fodder', brain: 'swarm',
  model: '/assets/survival/motion/grunt-husk.glb', motion: 'humanoid', height: 1.45, size: .9, hp: 140, speed: .82,
  moves: [
    multi(melee('Brood Rush', 'light', ['jab'], .95, .12, 14, { range: 1.9, cooldown: 1.1, knockback: 2.5, element: 'ki' }), [.12, .4], 22),
    melee('Hammer Smash', 'heavy', ['uppercut'], 1.25, .64, 36, { range: 2, cooldown: 3, knockback: 6, stun: .45, weight: .4, element: 'ki' }),
  ],
  clips: hollowClips(), xp: 1, score: 50, cost: 1, color: 0x7fb84a,
};
ENEMIES['brood-blaster'] = {
  id: 'brood-blaster', name: 'Brood Blaster', series: 'Last Sun', role: 'gunner', brain: 'gunner',
  model: '/assets/survival/motion/grunt-husk.glb', motion: 'humanoid', height: 1.45, size: .9, hp: 110, speed: .7,
  moves: [
    shot('Spirit Blast', 'special', ['roar'], 2.2, 1.3, 20, { speed: 36, radius: .55, cooldown: 4.2, element: 'ki' }),
    multi(melee('Brood Rush', 'light', ['jab'], .95, .12, 12, { range: 1.9, cooldown: 1.4, maxRange: 2.1, element: 'ki' }), [.12, .4], 18),
  ],
  clips: hollowClips(), xp: 2, score: 75, cost: 2, color: 0x3a9cff, tint: 0xd8ecff,
};
// The eldest of the brood, grown to a man's height and more.
ENEMIES['elder-brood'] = {
  id: 'elder-brood', name: 'Elder Brood', series: 'Last Sun', role: 'brute', brain: 'brute',
  model: '/assets/survival/motion/grunt-husk.glb', motion: 'humanoid', height: 2.5, size: 1.4, hp: 620, poise: 190, speed: .55,
  knockbackIn: .45, stunIn: .75, breaker: true,
  moves: [
    melee('Crushing Smash', 'heavy', ['uppercut'], 1.5, .78, 52, { range: 2.7, radius: 1, cooldown: 2.4, knockback: 9, stun: .6, guardBreak: true, lunge: 3.5, maxRange: 3.2, telegraph: 'cone', element: 'ki' }),
    shot('Brood Beam', 'special', ['roar'], 2.8, 1.7, 58, { speed: 30, radius: 1, cooldown: 5, minRange: 4, maxRange: 18, telegraph: 'line', element: 'ki' }),
  ],
  clips: hollowClips(), xp: 7, score: 300, cost: 4, color: 0x2e6a2a, tint: 0xa8c098,
};
ENEMIES['wuming'] = {
  id: 'wuming', name: 'Wuming', title: 'The Lightless Sage', series: 'Last Sun', role: 'elite', brain: 'boss',
  model: '/assets/survival/enemies/wuming.glb', height: 2.0, size: 1.1, hp: 2600, poise: 320, speed: .92, knockbackIn: .4, stunIn: .7, breaker: true,
  blink: { every: 5, beyond: 6.5 },
  moves: [
    multi(melee('Dusk Rush', 'light', ['rush_1_hit'], 2, .12, 26, { chain: RUSH, range: 2.4, radius: .8, lunge: 4, knockback: 2, maxRange: 3, rest: .3, element: 'dark' }), [.12, .46, .8, 1.14, 1.5], 50),
    melee('Violent Rush', 'heavy', ['violent_3_finish'], 1.2, .7, 92, { chain: ['violent_1_in', 'violent_2_charge', 'violent_3_finish', 'violent_4_out'], range: 2.6, radius: .9, lunge: 9, close: 10, knockback: 10, minRange: 2, maxRange: 10, rest: 2.6, telegraph: 'line', element: 'dark' }),
    melee('Divine Blade', 'special', ['skill_2_hit'], 2.15, 1.12, 120, { chain: ['skill_2_in', 'skill_2_hit', 'skill_2_out'], range: 3.6, radius: 1.5, lunge: 5, knockback: 11, guardBreak: true, maxRange: 4.4, rest: 6, telegraph: 'cone', element: 'dark', callout: true }),
    { ...shot('Black Sun Beam', 'ultimate', ['blast_3_hit'], 3.4, 1.7, 170, { chain: BLAST, range: 22, radius: 1.2, knockback: 13, guardBreak: true, minRange: 3, maxRange: 20, rest: 9, telegraph: 'line', element: 'dark', callout: true }), style: 'beam' },
  ],
  clips: withClean(szClips()), xp: 22, score: 3200, cost: 6, color: 0xe86ad8,
};
ENEMIES['jinlin'] = {
  id: 'jinlin', name: 'Emperor Jinlin', title: 'The Dragon-Gate Tyrant', series: 'Last Sun', role: 'elite', brain: 'boss',
  model: '/assets/survival/enemies/jinlin.glb', height: 1.95, size: 1.05, hp: 2500, poise: 300, speed: .9, knockbackIn: .4, stunIn: .7, breaker: true,
  blink: { every: 5.5, beyond: 7 },
  moves: [
    multi(melee("Tyrant's Rush", 'light', ['rush_1_hit'], 1.6, .08, 26, { chain: RUSH, range: 2.3, radius: .8, lunge: 4, knockback: 2, maxRange: 3, rest: .3, element: 'fire' }), [.08, .34, .6, .96, 1.24], 48),
    melee('Tail Smash', 'heavy', ['smash_3_hit'], 1.2, .62, 84, { chain: smash('smash'), range: 2.6, radius: .9, lunge: 5, knockback: 11, guardBreak: true, maxRange: 3.2, rest: 2.2, telegraph: 'cone', element: 'fire' }),
    multi(shot('Needle Ray', 'special', ['skill_2_hit'], 2.1, 1.1, 40, { chain: ['skill_2_in', 'skill_2_hit', 'skill_2_out'], speed: 64, radius: .35, knockback: 3, stun: .4, minRange: 3, maxRange: 22, rest: 4.5, element: 'dark', callout: true }), [1.1, 1.28, 1.46], 60),
    { ...shot('Doom Sphere', 'ultimate', ['blast_3_hit'], 3.2, 1.9, 190, { chain: BLAST, speed: 13, range: 24, radius: 3.4, knockback: 14, guardBreak: true, minRange: 4, maxRange: 20, rest: 10, telegraph: 'target', element: 'fire', callout: true }), style: 'bomb' },
  ],
  clips: withClean(szClips()), xp: 22, score: 3200, cost: 6, color: 0xffc21e,
};
ENEMIES.jirenga = {
  id: 'jirenga', name: 'Jirenga', title: 'The Stone Guardian', series: 'Last Sun', role: 'boss', brain: 'boss',
  model: '/assets/survival/enemies/gandang.glb', height: 2.35, size: 1.3, hp: 8600, poise: 700, speed: .8, knockbackIn: .2, stunIn: .5, breaker: true,
  blink: { every: 4, beyond: 6 },
  moves: [
    multi(melee('Colossus Rush', 'light', ['rush_1_hit'], 1.8, .1, 30, { chain: RUSH, range: 2.5, radius: .8, lunge: 4, knockback: 2, maxRange: 3.2, rest: .2, element: 'blood' }), [.1, .35, .6, 1.0, 1.35], 60),
    melee('Power Smash', 'heavy', ['smash_3_hit'], 1.2, .62, 110, { chain: smash('smash'), range: 2.8, radius: 1, lunge: 6, knockback: 12, guardBreak: true, maxRange: 3.6, rest: 2.4, telegraph: 'cone', element: 'blood' }),
    melee('Dash Smash', 'heavy', ['dash_strike_3_hit'], 1.55, .9, 120, { chain: smash('dash_strike'), range: 2.8, radius: 1, lunge: 10, close: 12, knockback: 13, minRange: 3, maxRange: 12, rest: 3, telegraph: 'line', element: 'blood' }),
    melee('Glare', 'special', ['glare_3_hit'], 2.3, 1.25, 90, { chain: smash('glare'), range: .5, radius: 4, lunge: 0, knockback: 12, guardBreak: true, maxRange: 4.2, rest: 6, telegraph: 'ring', element: 'blood', callout: true }),
    { ...shot('Colossus Impact', 'ultimate', ['blast_3_hit'], 3.4, 1.6, 200, { chain: BLAST, speed: 30, range: 26, radius: 2.6, knockback: 14, guardBreak: true, minRange: 3, maxRange: 22, rest: 9, telegraph: 'target', element: 'blood', callout: true }), style: 'bomb' },
    melee('Endless Rush', 'special', ['rush_3_hit'], 2.4, .5, 40, { chain: [...RUSH], range: .5, radius: 2.4, knockback: 8, maxRange: 18, rest: 10, telegraph: 'ring', element: 'blood', callout: true, phase: 1,
      rain: { count: 14, every: .14, lead: .85, spread: 5.5, radius: 1.6, damage: 70, start: .3, knockback: 8 } }),
  ],
  // He is found meditating, as he was in the tournament.
  clips: withClean(szClips({ intro: ['skill_2_hit'] })), xp: 90, score: 24000, cost: 0, color: 0xe0142e,
};

// ---- Act V: Warlord's Roof -----------------------------------------------------
// The finale: the warlord's roof. Gifters by the hundred, Ashwing, Mirabel
// and Kuromitsu as champions, and Gorai - who, felled, rises again as the
// half-wyrm and has to be felled a second time.
const beastGraftClips = (extra: Partial<EnemyClips> = {}): EnemyClips => ({
  idle: ['idle'], run: ['run'], walk: ['walk'], hit: ['hit'], down: ['knockdown'], getup: ['getup'], stun: ['hit'],
  blown: ['knockdown'], land: ['knockdown'], death: ['die'], dash: ['run'], jump: ['run'], fall: ['knockdown'], taunt: ['roar'], ...extra,
});
const BEAST_GRAFT_CREDIT = GRUNT_BODY;
ENEMIES['beast-graft'] = {
  id: 'beast-graft', name: 'Beast-Graft', series: 'Dust Sea', role: 'fodder', brain: 'swarm',
  model: '/assets/survival/motion/grunt-rift-spawn.glb', motion: 'humanoid', height: 2, hp: 170, speed: .66,
  moves: [
    melee('Iron Kick', 'light', ['kick'], 1.2, .5, 28, { clipSeconds: 1.43, range: 2.1, cooldown: 1.2, knockback: 4.5 }),
    melee('Horn Uppercut', 'heavy', ['uppercut'], 1.2, .7, 40, { clipSeconds: 1.03, range: 2, cooldown: 3, knockback: 6.5, stun: .5, weight: .35 }),
  ],
  clips: beastGraftClips(), xp: 1, score: 50, cost: 1, color: 0x5a2a6a,
};
// A gift that made the voice a weapon: a roar that carries.
ENEMIES['roaring-graft'] = {
  id: 'roaring-graft', name: 'Roaring Graft', series: 'Dust Sea', role: 'gunner', brain: 'gunner',
  model: '/assets/survival/motion/grunt-rift-spawn.glb', motion: 'humanoid', height: 2, hp: 130, speed: .6,
  moves: [
    shot('Beast Roar', 'special', ['roar'], 2.2, 1.7, 24, { clipSeconds: 2.6, speed: 26, radius: .7, cooldown: 4.2, element: 'sound' }),
    melee('Iron Kick', 'light', ['kick'], 1.2, .5, 24, { clipSeconds: 1.43, range: 2.1, cooldown: 1.4, maxRange: 2.2 }),
  ],
  clips: beastGraftClips(), xp: 2, score: 80, cost: 2, color: 0xe86ad8, tint: 0xf0d0ff,
};
ENEMIES['giant-graft'] = {
  id: 'giant-graft', name: 'Giant Graft', series: 'Dust Sea', role: 'brute', brain: 'brute',
  model: '/assets/survival/motion/grunt-rift-spawn.glb', motion: 'humanoid', height: 3.2, size: 1.6, hp: 700, poise: 220, speed: .45,
  knockbackIn: .4, stunIn: .7, breaker: true,
  moves: [
    melee('Crushing Knuckle', 'heavy', ['uppercut'], 1.8, 1.05, 62, { clipSeconds: 1.03, range: 3, radius: 1.1, cooldown: 2.4, knockback: 10, stun: .6, guardBreak: true, lunge: 3, maxRange: 3.4, telegraph: 'cone' }),
    melee('Stomp', 'heavy', ['kick'], 1.6, .8, 52, { clipSeconds: 1.47, range: 1.2, radius: 2.6, cooldown: 3.5, knockback: 8, maxRange: 3, telegraph: 'ring' }),
  ],
  clips: beastGraftClips(), xp: 7, score: 320, cost: 4, color: 0x3a1a4a, tint: 0xc0a8c8,
};
ENEMIES.ashwing = {
  id: 'ashwing', name: 'Ashwing', title: 'The Pyre Knight', series: 'Dust Sea', role: 'elite', brain: 'boss',
  model: '/assets/survival/enemies/ashwing.glb', height: 3.18,
  size: 1.35, hp: 2900, poise: 400, speed: .82, knockbackIn: .35, stunIn: .65, breaker: true,
  blink: { every: 7, beyond: 9 },
  hide: /\b[lr]_arm_sp|hand_(close_)?sp_/,
  moves: [
    melee('Coal-Seam Cut', 'light', ['_combo_a'], .97, .38, 62, { range: 2.8, radius: .9, lunge: 5, knockback: 5, maxRange: 3.4, rest: .3, element: 'fire' }),
    melee('Pyre Blade', 'heavy', ['_combo_c'], 1, .45, 84, { range: 3, radius: 1, lunge: 7, close: 8, knockback: 9, maxRange: 7, rest: 2.2, telegraph: 'line', element: 'fire' }),
    shot('Cinder Gale', 'special', ['_skill_a'], 1.8, .7, 110, { speed: 24, radius: 1.4, range: 24, knockback: 10, minRange: 3.5, maxRange: 20, rest: 5, telegraph: 'line', element: 'fire', callout: true }),
    { ...melee('Iron-Feather Dive', 'ultimate', ['_skill_b'], 2.3, 1.1, 150, { range: 22, radius: 2.6, knockback: 13, guardBreak: true, minRange: 3, maxRange: 18, rest: 8, telegraph: 'target', element: 'fire', callout: true }), style: 'field' },
  ],
  clips: withClean(brClips({ intro: ['_opening'], death: ['_lose'], taunt: ['_victory'] })), xp: 24, score: 3600, cost: 6, color: 0xff6a1e,
};
ENEMIES.mirabel = {
  id: 'mirabel', name: 'Mother Mirabel', title: 'The Storm Dowager', series: 'Dust Sea', role: 'elite', brain: 'boss',
  model: '/assets/survival/enemies/mirabel.glb', height: 3, size: 1.42, hp: 3400, poise: 480, speed: .7, knockbackIn: .3, stunIn: .6, breaker: true,
  hide: /hand_sp/,
  moves: [
    melee("Dowager's Blade", 'light', ['_combo_a'], 1.13, .45, 66, { range: 3, radius: 1, lunge: 4, knockback: 6, maxRange: 3.5, rest: .3, element: 'fire' }),
    melee('Locket Snatch', 'heavy', ['_combo_c'], 1.6, .9, 92, { range: 3, radius: 1.3, lunge: 5, knockback: 10, guardBreak: true, maxRange: 3.6, rest: 2.6, telegraph: 'cone', element: 'dark' }),
    shot('Ball Lightning', 'special', ['_skill_a'], 1.97, 1, 120, { speed: 18, radius: 1.8, range: 24, knockback: 11, minRange: 3.5, maxRange: 20, rest: 5, telegraph: 'line', element: 'fire', callout: true }),
    { ...melee('Crown of Storms', 'ultimate', ['_skill_b'], 1.9, 1.2, 130, { clipSeconds: 1.57, range: 22, radius: 2.4, knockback: 12, stun: .9, guardBreak: true, minRange: 2, maxRange: 18, rest: 8, telegraph: 'target', element: 'lightning', callout: true }), style: 'field' },
  ],
  clips: withClean(brClips({ intro: ['_opening'], death: ['_lose'], taunt: ['_victory'] })), xp: 24, score: 3600, cost: 6, color: 0x8ad0ff,
};
ENEMIES.kuromitsu = {
  id: 'kuromitsu', name: 'Kuromitsu', title: 'The Tar Oracle', series: 'Dust Sea', role: 'elite', brain: 'boss',
  model: '/assets/survival/enemies/kuromitsu.glb', height: 3.11,
  size: 1.35, hp: 3000, poise: 420, speed: .86, knockbackIn: .35, stunIn: .65, breaker: true,
  blink: { every: 6, beyond: 8 },
  hide: /donut|power_mochi|spear_0/,
  moves: [
    melee('Tar-Fork Thrust', 'light', ['_combo_a'], 1, .42, 64, { range: 3.2, radius: .8, lunge: 5, knockback: 5, maxRange: 3.8, rest: .3 }),
    melee('Pitch Whirl', 'heavy', ['_combo_c'], 1.5, .87, 86, { range: 1.2, radius: 2.8, lunge: 2, knockback: 9, maxRange: 3.2, rest: 2.4, telegraph: 'ring' }),
    melee('Tar-Spike Cleave', 'special', ['_skill_a'], 2, 1.27, 124, { range: 3.2, radius: 1.3, lunge: 9, close: 11, knockback: 12, guardBreak: true, minRange: 2, maxRange: 11, rest: 5, telegraph: 'line', callout: true, show: /power_mochi/ }),
    multi(melee('Twelve-Eyed Barrage', 'ultimate', ['_skill_b'], 1.9, .7, 44, { clipSeconds: 1.67, range: 3.4, radius: 1.8, lunge: 6, close: 8, knockback: 4, guardBreak: true, maxRange: 8, rest: 8, telegraph: 'cone', callout: true }), [.7, .95, 1.2, 1.45], 90),
  ],
  clips: withClean(brClips({ intro: ['_opening'], death: ['_lose'], taunt: ['_victory'] })), xp: 24, score: 3600, cost: 6, color: 0xe0a040,
};
// Gorai: the strongest of the warlords, twice over.
ENEMIES.gorai = {
  id: 'gorai', name: 'Gorai', title: 'The Thunderhead · Tide King of the Dust Sea', series: 'Dust Sea', role: 'boss', brain: 'boss',
  model: '/assets/survival/enemies/gorai.glb', height: 3.2, size: 1.5, hp: 7000, poise: 700, speed: .74, knockbackIn: .18, stunIn: .5, breaker: true,
  transform: { into: 'gorai-wyrm' },
  moves: [
    melee('Iron Club Swing', 'light', ['_combo_a'], 1.1, .5, 80, { range: 3.2, radius: 1.2, lunge: 5, knockback: 7, maxRange: 3.8, rest: .2, element: 'dark' }),
    melee('Overhead Ruin', 'heavy', ['_combo_b'], 1, .45, 110, { clipSeconds: .8, range: 3.2, radius: 1.3, lunge: 9, close: 11, knockback: 12, guardBreak: true, minRange: 2.5, maxRange: 11, rest: 2.6, telegraph: 'line', element: 'dark' }),
    { ...melee('Tyrant Leap', 'special', ['_skill_a'], 2.3, 1.45, 130, { range: 22, radius: 3, knockback: 13, stun: .8, minRange: 3, maxRange: 18, rest: 6, telegraph: 'target', element: 'dark', callout: true }), style: 'field' },
    melee('Thunderclap Club', 'ultimate', ['_skill_b'], 2.8, 2.2, 210, { range: 1.5, radius: 3.4, lunge: 3, knockback: 16, stun: 1, guardBreak: true, maxRange: 4.5, rest: 8, telegraph: 'ring', element: 'lightning', callout: true }),
  ],
  clips: withClean(brClips({ intro: ['_opening'], death: ['_lose'], taunt: ['_victory'] })), xp: 60, score: 16000, cost: 0, color: 0x6a3cff,
};
ENEMIES['gorai-wyrm'] = {
  id: 'gorai-wyrm', name: 'Gorai', title: 'Storm Wyrm', series: 'Dust Sea', role: 'boss', brain: 'boss',
  model: '/assets/survival/enemies/gorai-wyrm.glb', height: 3.5, size: 1.62, hp: 8000, poise: 800, speed: .82, knockbackIn: .15, stunIn: .45, breaker: true,
  blink: { every: 7, beyond: 10 },
  hide: /c_mast_breaker/,
  moves: [
    melee('Storm Tail', 'light', ['_combo_a'], 1, .36, 84, { clipSeconds: .9, range: 1, radius: 3, lunge: 2, knockback: 9, maxRange: 3.6, rest: .4, telegraph: 'ring', element: 'dark' }),
    melee('Dragon Rush', 'heavy', ['_combo_b'], 1.05, .45, 110, { clipSeconds: .93, range: 3.4, radius: 1.4, lunge: 10, close: 12, knockback: 12, guardBreak: true, minRange: 2.5, maxRange: 12, rest: 2.4, telegraph: 'line', element: 'dark' }),
    melee('Thunderclap Club', 'heavy', ['_combo_c'], 1.6, .8, 150, { clipSeconds: 1.57, range: 3.4, radius: 1.8, lunge: 4, knockback: 15, guardBreak: true, maxRange: 4.2, rest: 4, telegraph: 'cone', element: 'lightning' }),
    { ...shot('Azure Breath', 'ultimate', ['_opening'], 3, 1.7, 180, { clipSeconds: 2.97, range: 24, radius: 1.6, knockback: 14, guardBreak: true, minRange: 3, maxRange: 22, rest: 8, telegraph: 'line', element: 'fire', callout: true }), style: 'beam' },
    melee('Fire Rain', 'special', ['_skill_a_end'], 2.3, .6, 60, { range: .5, radius: 3, knockback: 9, maxRange: 20, rest: 9, telegraph: 'ring', element: 'fire', callout: true,
      rain: { count: 18, every: .13, lead: .95, spread: 6.5, radius: 1.9, damage: 76, start: .4, knockback: 9 } }),
  ],
  clips: withClean(brClips({ intro: ['_opening'], death: ['_lose'], taunt: ['_victory'] })), xp: 100, score: 30000, cost: 0, color: 0x3a6aff,
};

// ---- Act II: the Hidden Ash ---------------------------------------------
// The Fox Spirit loose in the village, the White Pale Sapling army pouring out of the
// rift, and the village's own fighters turned against the player (shadow
// rivals, below). Kurobi is a giant: drawn six metres tall, but with a hit
// volume a fighter's swing can still reach (`size` 2.2 - past about 2.6 the
// centre of a body is higher than a grounded swing can connect with).
const PALE_SAPLING_CREDIT = GRUNT_BODY;
const paleSaplingClips = (extra: Partial<EnemyClips> = {}): EnemyClips => ({
  idle: ['idle'], run: ['run'], walk: ['walk'], hit: ['hit'], down: ['knockdown'], getup: ['getup'], stun: ['hit'],
  blown: ['knockdown'], land: ['knockdown'], death: ['die'], dash: ['run'], jump: ['run'], fall: ['knockdown'], taunt: ['roar'], ...extra,
});
ENEMIES['pale-sapling'] = {
  id: 'pale-sapling', name: 'Pale Sapling', series: 'Hidden Ash', role: 'fodder', brain: 'swarm',
  model: '/assets/survival/motion/grunt-husk.glb', motion: 'humanoid', height: 1.8, hp: 130, speed: .72,
  moves: [
    melee('Grasping Strike', 'light', ['punch'], 1.2, .59, 24, { clipSeconds: 2.2, range: 2, cooldown: 1.2, knockback: 3.8 }),
    melee('Wood Kick', 'heavy', ['kick'], 1.2, .5, 34, { clipSeconds: 1.43, range: 2.1, cooldown: 3, knockback: 6, stun: .45, weight: .35 }),
  ],
  clips: paleSaplingClips(), xp: 1, score: 45, cost: 1, color: 0xe8f0e0,
};
ENEMIES['spore-sapling'] = {
  id: 'spore-sapling', name: 'Spore Sapling', series: 'Hidden Ash', role: 'gunner', brain: 'gunner',
  model: '/assets/survival/motion/grunt-husk.glb', motion: 'humanoid', height: 1.8, hp: 105, speed: .64,
  moves: [
    shot('Ash Spore', 'special', ['roar'], 2.2, 1.54, 22, { clipSeconds: 2.4, speed: 24, radius: .6, cooldown: 4.2, element: 'jade' }),
    melee('Grasping Strike', 'light', ['punch'], 1.2, .59, 20, { clipSeconds: 2.2, range: 2, cooldown: 1.4, maxRange: 2.2 }),
  ],
  clips: paleSaplingClips(), xp: 2, score: 70, cost: 2, color: 0x7affb8, tint: 0xd8ffe0,
};
ENEMIES['giant-sapling'] = {
  id: 'giant-sapling', name: 'Giant Sapling', series: 'Hidden Ash', role: 'brute', brain: 'brute',
  model: '/assets/survival/motion/grunt-husk.glb', motion: 'humanoid', height: 3.1, size: 1.55, hp: 620, poise: 200, speed: .46,
  knockbackIn: .4, stunIn: .7, breaker: true,
  moves: [
    melee('Crushing Grasp', 'heavy', ['punch'], 1.9, 1.05, 58, { clipSeconds: 2.2, range: 3, radius: 1.1, cooldown: 2.4, knockback: 9, stun: .6, guardBreak: true, lunge: 3, maxRange: 3.4, telegraph: 'cone' }),
    melee('Stomp', 'heavy', ['kick'], 1.6, .8, 50, { clipSeconds: 1.43, range: 1.2, radius: 2.6, cooldown: 3.5, knockback: 8, maxRange: 3, telegraph: 'ring' }),
  ],
  clips: paleSaplingClips(), xp: 7, score: 280, cost: 4, color: 0x9ab88a, tint: 0xc8d8c0,
};
const KUROBI = (clip: string) => [`Armature|${clip}`, clip];
// ---- The rift's later ranks ---------------------------------------------------
// Haldor: the power that splits the ground, a bisento the length of a mast.
ENEMIES.haldor = {
  id: 'haldor', name: 'Haldor', title: 'The Old Quake', series: 'Dust Sea', role: 'boss', brain: 'boss',
  model: '/assets/survival/enemies/haldor.glb', height: 3.3, size: 1.48, hp: 7400, poise: 720, speed: .7, knockbackIn: .16, stunIn: .5, breaker: true,
  moves: [
    melee('Glaive Sweep', 'light', ['_combo_a'], 1.13, .57, 80, { range: 3.4, radius: 1.3, lunge: 4, knockback: 8, maxRange: 4, rest: .3, element: 'steel' }),
    melee('Cloudsplitter', 'heavy', ['_combo_b'], 1.33, .73, 108, { range: 3.8, radius: 1.8, lunge: 5, knockback: 12, guardBreak: true, maxRange: 4.6, rest: 2.2, telegraph: 'cone', element: 'steel' }),
    melee('Quake Punch', 'heavy', ['_combo_c'], 1.63, .63, 124, { range: 1.5, radius: 3.4, lunge: 2, knockback: 15, stun: .8, maxRange: 4, rest: 3.4, telegraph: 'ring', element: 'sound' }),
    { ...shot('Tidal Quake', 'special', ['_skill_a'], 2.3, 1.17, 150, { speed: 30, range: 24, radius: 1.8, knockback: 13, stun: .9, minRange: 3.5, maxRange: 22, rest: 5, telegraph: 'line', element: 'sound', callout: true }), style: 'beam' },
    melee('Island-Splitter', 'ultimate', ['_skill_b'], 3.13, 1.33, 70, { range: .5, radius: 3, lunge: 0, knockback: 10, maxRange: 20, rest: 9, telegraph: 'ring', element: 'sound', callout: true, phase: 1,
      rain: { count: 14, every: .17, lead: 1, spread: 7, radius: 2.3, damage: 82, start: .6, knockback: 10 } }),
  ],
  clips: withClean(brClips({ intro: ['_opening'], death: ['_lose'], taunt: ['_victory'] })), xp: 68, score: 17000, cost: 0, color: 0xf4f0e2,
};
// Barrow: darkness that swallows, and the quake he stole.
ENEMIES.barrow = {
  id: 'barrow', name: 'Barrow', title: 'Tide King · The Swallowing Dark', series: 'Dust Sea', role: 'boss', brain: 'boss',
  model: '/assets/survival/enemies/barrow.glb', height: 2.9, size: 1.36, hp: 6400, poise: 560, speed: .78, knockbackIn: .22, stunIn: .55, breaker: true,
  moves: [
    melee('Darkness Grab', 'light', ['_combo_a'], 1, .35, 62, { range: 3, radius: 1, lunge: 6, knockback: 5, maxRange: 3.6, rest: .3, element: 'dark' }),
    melee('Swallowing Rush', 'heavy', ['_combo_b'], 1.17, .5, 92, { range: 3.2, radius: 1.3, lunge: 8, close: 9, knockback: 11, guardBreak: true, minRange: 2, maxRange: 9, rest: 2.4, telegraph: 'line', element: 'dark' }),
    melee('Stolen Quake', 'heavy', ['_combo_c'], 1.3, .6, 110, { range: 1.4, radius: 2.9, lunge: 3, knockback: 13, stun: .7, maxRange: 3.8, rest: 3.2, telegraph: 'ring', element: 'sound' }),
    melee('Night Maw', 'special', ['_skill_a'], 2.57, 1.1, 130, { range: .5, radius: 4.4, lunge: 0, knockback: 6, stun: 1, maxRange: 4.4, rest: 6, telegraph: 'ring', element: 'dark', callout: true }),
    melee('Disgorge', 'ultimate', ['_skill_b'], 2.8, 1.2, 60, { range: .5, radius: 2.8, lunge: 0, knockback: 9, maxRange: 18, rest: 9, telegraph: 'ring', element: 'dark', callout: true, phase: 1,
      rain: { count: 16, every: .14, lead: .95, spread: 7, radius: 2, damage: 70, start: .5, knockback: 8 } }),
  ],
  clips: withClean(brClips({ intro: ['_opening'], death: ['_lose'], taunt: ['_victory'] })), xp: 62, score: 15000, cost: 0, color: 0x2a0a3a,
};
// Akagane: the war-fan, great fire, and a meteor out of a clear sky.
ENEMIES.akagane = {
  id: 'akagane', name: 'Akagane', title: 'The Copper Tyrant, Risen from the Ember Tomb', series: 'Hidden Ash', role: 'boss', brain: 'boss',
  model: '/assets/survival/enemies/akagane.glb', height: 2.3, size: 1.2, hp: 6800, poise: 560, speed: .86, knockbackIn: .25, stunIn: .55, breaker: true,
  blink: { every: 8, beyond: 11 },
  moves: [
    melee('War Fan Strike', 'light', ['_atk01'], 1.83, .87, 72, { clipSeconds: 1.83, range: 2.8, radius: 1, lunge: 4.5, knockback: 7, maxRange: 3.4, rest: .5, element: 'steel' }),
    { ...shot('Ash Tide Flame', 'special', ['_skl01'], 2, .9, 140, { clipSeconds: 2, speed: 22, range: 22, radius: 2, knockback: 12, stun: .8, minRange: 3, maxRange: 20, rest: 5, telegraph: 'line', element: 'fire', callout: true }), style: 'beam' },
    melee('Falling Star', 'ultimate', ['_skl02'], 3.17, 1.33, 70, { clipSeconds: 3.17, range: .5, radius: 3, lunge: 0, knockback: 12, maxRange: 20, rest: 10, telegraph: 'ring', element: 'fire', callout: true,
      rain: { count: 8, every: .3, lead: 1.25, spread: 7, radius: 3, damage: 110, start: .5, knockback: 13 } }),
  ],
  clips: withClean({ idle: ['_idle'], run: ['_run'], hit: ['_hit01'], down: ['_back'], getup: ['_go'], stun: ['_hit02'], blown: ['_back'], land: ['_back'],
    death: ['_die'], dash: ['_run'], jump: ['_run'], fall: ['_back'], taunt: ['_show'], intro: ['_show'] }),
  xp: 64, score: 16000, cost: 0, color: 0xc01020,
};
ENEMIES.kurobi = {
  id: 'kurobi', name: 'Kurobi', title: 'The Ember in the Ash', series: 'Hidden Ash', role: 'boss', brain: 'boss',
  model: '/assets/fighters/kurobi-tr1.glb', height: 3.8, size: 1.85, girth: 2.4, hp: 9000, poise: 800, speed: .62, knockbackIn: .12, stunIn: .4, breaker: true, anchored: true,
  moves: [
    melee('Demon Claw', 'light', ['Kurobi light'], 1.8, .75, 90, { range: 4.5, radius: 2, lunge: 4, knockback: 10, maxRange: 5.5, rest: .4, element: 'fire' }),
    multi(melee('Stinger Storm', 'heavy', ['Kurobi heavy'], 2.8, .8, 44, { range: 1, radius: 6, lunge: 0, knockback: 9, maxRange: 6.5, rest: 4, telegraph: 'ring', element: 'fire' }), [.8, 1.3, 1.8, 2.3], 90),
    melee('Fox Pounce', 'special', ['Kurobi special'], 2, .85, 130, { range: 4.5, radius: 2.4, lunge: 12, close: 14, knockback: 13, guardBreak: true, minRange: 4, maxRange: 14, rest: 5, telegraph: 'line', element: 'fire', callout: true }),
    { ...shot('Black Flame Orb', 'ultimate', ['Kurobi ultimate'], 3.3, 2.2, 230, { speed: 20, range: 28, radius: 5.5, knockback: 15, guardBreak: true, minRange: 5, maxRange: 26, rest: 10, telegraph: 'target', element: 'dark', callout: true }), style: 'bomb' },
    melee('Ember Storm', 'special', ['Kurobi ultimate'], 2.4, .6, 50, { range: .5, radius: 5, knockback: 9, maxRange: 20, rest: 10, telegraph: 'ring', element: 'fire', callout: true, phase: 1,
      rain: { count: 16, every: .13, lead: .9, spread: 7, radius: 2.2, damage: 70, start: .4, knockback: 9 } }),
  ],
  // (Kurobi's own body and clips: round 1's fox recoloured, playing the roster fox's.)
  clips: { idle: ['_Idle', 'Armature|wait'], run: ['Run'], hit: ['Hit 01'], down: ['Die fall'], getup: ['shake'], stun: ['Hit 01'],
    blown: ['Hit 01'], land: ['Hit 01'], death: ['Die fall'], dash: ['Dash'], jump: ['jump'], fall: ['Jump Fall'], taunt: ['shake'], intro: ['shake'] },
  xp: 80, score: 20000, cost: 0, color: 0xff7a1e, runSpeed: 9,
};

const RIVALS: readonly (readonly [FighterId, string, string])[] = [
  ['taisei', 'Taisei', 'Last Sun'], ['ouga', 'Ouga', 'Last Sun'], ['konta', 'Konta', 'Hidden Ash'],
  ['shiden', 'Shiden', 'Hidden Ash'], ['shirokane', 'Shirokane', 'Hidden Ash'], ['gummy', 'Gummy', 'Dust Sea'],
  ['kenzo', 'Kenzo', 'Dust Sea'], ['kosho', 'Kosho', 'Dust Sea'], ['kagari', 'Kagari', 'Dust Sea'], ['ward', 'Ward', 'Dust Sea'],
  ['nigo', 'Nigo', 'Cinder Requiem'], ['koko', 'KoKo', 'Gilded Ruin'], ['oro', 'Lord ORO', 'Gilded Ruin'], ['kuon', 'Kuon', 'Hex Fallout'],
  ['gaunt', 'Gaunt', 'Grave Hound'], ['setsu', 'Setsu', 'Salvage Wilds'],
];
for (const [fighter, name, series] of RIVALS) {
  ENEMIES[`shadow-${fighter}`] = {
    id: `shadow-${fighter}`, name: `Shadow ${name}`, title: 'Turned by the Rift', series, role: 'elite', brain: 'boss',
    model: '', height: 1.8, hp: 2300, speed: 1, moves: [], clips: brClips(), rival: fighter,
    xp: 22, score: 3200, cost: 6, color: 0x6a2aff,
  };
}
export const SHADOW_RIVALS = RIVALS.map(([fighter]) => `shadow-${fighter}`);

export const enemy = (id: string): EnemyDefinition => {
  const def = ENEMIES[id];
  if (!def) throw new Error(`Unknown enemy ${id}`);
  return def;
};

/** The four slots a combatant carries, filled from its move list: the first
 *  move of each slot, and a copy of the first move for any slot it lacks, so
 *  the simulation always has something to resolve. */
export function kitOf(def: EnemyDefinition): SlotMoves {
  const first = def.moves[0];
  const pick = (slot: AttackSlot) => def.moves.find(move => move.slot === slot) ?? { ...first, slot };
  return { light: pick('light'), heavy: pick('heavy'), special: pick('special'), ultimate: pick('ultimate') };
}

/** Every distinct model a set of enemies needs, for loading. A shadow rival
 *  wears its roster model, which the client has loaded already. */
export const modelsOf = (ids: readonly string[]) => [...new Set(ids.map(id => enemy(id).model).filter(Boolean))];

// A boss move with a clean clip of its own (bossAttacks.ts: each clip cut from clean sources on the move's own contacts and
// length) plays it, in front of the move's older clip names, which stay behind it for any body still carrying them. A chain is played as its one clean clip, on the same clock (the chain's whole length). Each
// `boss`-role entrance likewise. Timing, contacts, telegraphs, damage and ranges are the move's own, unchanged.
for (const def of Object.values(ENEMIES)) {
  const own = CLEAN_ATTACKS[def.id];
  if (own) for (const move of def.moves) {
    const clean = own[move.name];
    if (!clean) continue;
    move.clip = [clean[0], ...move.clip];
    if (move.chain) delete move.chain;
    if (move.clipSeconds !== undefined) move.clipSeconds = clean[1];
  }
  if (CLEAN_INTROS[def.id] && def.clips.intro) def.clips = { ...def.clips, intro: [CLEAN_INTROS[def.id], ...def.clips.intro] };
}
