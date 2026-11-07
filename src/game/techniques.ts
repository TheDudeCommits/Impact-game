import type { FighterId } from './types';
import { HITSTOP, MOVES, type MoveDefinition } from './moves';
import { bodyTypeOf, type BodyType } from '../engine/sim/archetypes';

export type TechniqueKey = 'rush' | 'rise' | 'slip' | 'hh' | 'hhh' | 'charge' | 'counter' | 'delay' | 'airRush' | 'dashStrike' | 'wakeUp' | 'airRise';
export const TECHNIQUE_KEYS: readonly TechniqueKey[] = ['rush', 'rise', 'slip', 'hh', 'hhh', 'charge', 'counter', 'delay', 'airRush', 'dashStrike', 'wakeUp', 'airRise'];
export const isTechnique = (key: unknown): key is TechniqueKey => typeof key === 'string' && (TECHNIQUE_KEYS as readonly string[]).includes(key);
/** The techniques thrown from neutral, each on its own cooldown (the heavy string and the Delayed Strike are a string's). */
export const NEUTRAL_TECHNIQUES: ReadonlySet<TechniqueKey> = new Set<TechniqueKey>(['rush', 'rise', 'slip', 'charge', 'counter', 'airRush', 'dashStrike', 'wakeUp', 'airRise']);
/** Which button throws each (and whose cooldown a technique from neutral spends). */
export const TECHNIQUE_SLOT: Readonly<Record<TechniqueKey, 'light' | 'heavy'>> = {
  rush: 'light', rise: 'light', slip: 'light', hh: 'heavy', hhh: 'heavy', charge: 'heavy', counter: 'heavy', delay: 'light', airRush: 'light',
  dashStrike: 'light', wakeUp: 'light', airRise: 'light',
};
/** How each is thrown, for the move list (`{light}` and the rest are the player's own keys: ui/prompts.ts). */
export const TECHNIQUE_INPUTS: Readonly<Record<TechniqueKey, string>> = {
  rush: 'TOWARD + {light}', rise: 'AWAY + {light}', slip: 'SIDEWAYS + {light}', hh: '{heavy} {heavy}', hhh: '{heavy} {heavy} {heavy}',
  charge: 'TOWARD + {heavy}', counter: 'AWAY + {heavy}', delay: '{light} {light} · PAUSE · {light}', airRush: 'IN THE AIR: TOWARD + {light}',
  dashStrike: '{dash} THEN {light}', wakeUp: '{light} AS YOU GET UP', airRise: 'IN THE AIR: AWAY + {light}',
};
/** The buttons each is pressed with, in order, without the stick (Training's trials: ui/hud/trainingTrials.ts). */
export const TECHNIQUE_BUTTONS: Readonly<Record<TechniqueKey, readonly ('light' | 'heavy' | 'jump' | 'dash')[]>> = {
  rush: ['light'], rise: ['light'], slip: ['light'], hh: ['heavy', 'heavy'], hhh: ['heavy', 'heavy', 'heavy'], charge: ['heavy'],
  counter: ['heavy'], delay: ['light', 'light', 'light'], airRush: ['jump', 'light'], dashStrike: ['dash', 'light'], wakeUp: ['light'], airRise: ['jump', 'light'],
};
/** What each does, for the move list. */
export const TECHNIQUE_ROLES: Readonly<Record<TechniqueKey, string>> = {
  rush: 'Rush in · opens the string', rise: 'Launcher from neutral', slip: 'Evades, then strikes', hh: 'Heavy string 2',
  hhh: 'Breaks guard · blows back', charge: 'Armoured · breaks guard', counter: 'Answers a blow', delay: 'Crumples · breaks guard',
  airRush: 'Chases through the air', dashStrike: 'Out of a dash', wakeUp: 'Reversal · slips as it rises', airRise: 'Air launcher',
};

/** The stick at a press, against the line to the opponent: neutral, toward, away, or across. */
export type StickDir = 'n' | 'f' | 'b' | 's';
/** How far the stick must be pushed to count (a run is full; the drift of a pad's stick at rest is not), and how close to
 *  the line to the opponent (cosine) it must point to be toward or away rather than across. */
export const STICK_PUSH = .45, STICK_ALONG = .55;
/** The stick (world metres a second, as PlayerInput carries it) against the way to the opponent (`toX`, `toZ`), or the
 *  fighter's own facing when nobody is held. */
export function stickDir(moveX: number, moveZ: number, toX: number, toZ: number): StickDir {
  const push = Math.hypot(moveX, moveZ), span = Math.hypot(toX, toZ);
  if (!(push >= STICK_PUSH) || !(span > 1e-6)) return 'n';
  const along = (moveX * toX + moveZ * toZ) / (push * span);
  return along >= STICK_ALONG ? 'f' : along <= -STICK_ALONG ? 'b' : 's';
}

/** The Delayed Strike's beat: a light pressed this long after the string's second blow has finished (past RUSH_WINDOW,
 *  where a press still carries the string on) and no later. Mashing never reaches it; waiting a breath does. */
export const DELAY_FROM = .3, DELAY_TO = .7;
/** The heavy string: a heavy pressed into a heavy that has landed, or inside this long after it ended. */
export const HEAVY_CHAIN_WINDOW = .32;
/** The counter stance answers what meets it with this much more than the stance's own blow, and stuns them this long. */
export const COUNTER_DAMAGE = 2.1, COUNTER_STUN = .95, COUNTER_DELAY = .1;
/** The Wake-up Strike: a light pressed this long at most after getting up off the floor (or buffered in the getting up). */
export const WAKE_WINDOW = .25;

/** The roster's template, before a style's shape and a fighter's tempo. Measured against the kit around it: a light is
 *  20-23 over 0.46-0.5 s, a heavy about 58 over 0.9 s on a 1.2 s cooldown, an ender 40-64. */
const TEMPLATE: Readonly<Record<TechniqueKey, MoveDefinition>> = {
  rush: { name: '', duration: .56, contacts: [.24], damage: 30, range: 2.4, radius: .8, stamina: 14, cooldown: .9, stun: .5, knockback: 1.8,
    style: 'melee', lunge: 9, close: 5.5, outcome: 'stagger', hitstop: HITSTOP.light },
  rise: { name: '', duration: .64, contacts: [.23], damage: 34, range: 2.2, radius: .85, stamina: 16, cooldown: 1.6, stun: .6, knockback: 1.4,
    style: 'melee', lunge: 4, outcome: 'launch', lift: 9, hitstop: HITSTOP.heavy },
  slip: { name: '', duration: .6, contacts: [.3], damage: 30, range: 2.4, radius: .9, stamina: 16, cooldown: 1.3, stun: .55, knockback: 2.4,
    style: 'melee', lunge: 3, outcome: 'spin', evade: .3, hitstop: HITSTOP.light },
  hh: { name: '', duration: .78, contacts: [.3], damage: 50, range: 2.5, radius: .9, stamina: 16, cooldown: 0, stun: .62, knockback: 3,
    style: 'melee', lunge: 5, outcome: 'stagger', hitstop: HITSTOP.heavy },
  hhh: { name: '', duration: .95, contacts: [.4], damage: 68, range: 2.6, radius: 1, stamina: 20, cooldown: 0, stun: .8, knockback: 9,
    style: 'melee', lunge: 6, outcome: 'wallBounce', guardBreak: true, hitstop: HITSTOP.heavy },
  charge: { name: '', duration: 1, contacts: [.5], damage: 58, range: 2.6, radius: 1, stamina: 22, cooldown: 2.4, stun: .7, knockback: 7,
    style: 'melee', lunge: 10, close: 6, outcome: 'knockdown', knock: 'slide', guardBreak: true, armoured: true, hitstop: HITSTOP.heavy },
  counter: { name: '', duration: .95, contacts: [.62], damage: 30, range: 2.3, radius: .95, stamina: 14, cooldown: 2.2, stun: .5, knockback: 3,
    style: 'melee', lunge: 0, outcome: 'stagger', stance: { from: .04, to: .56 }, hitstop: HITSTOP.heavy },
  delay: { name: '', duration: .66, contacts: [.26], damage: 42, range: 2.3, radius: .9, stamina: 12, cooldown: 0, stun: .9, knockback: 1,
    style: 'melee', lunge: 5, outcome: 'crumple', guardBreak: true, hitstop: HITSTOP.heavy },
  airRush: { name: '', duration: .55, contacts: [.2], damage: 30, range: 2.3, radius: .9, stamina: 12, cooldown: 1, stun: .5, knockback: 1.5,
    style: 'melee', lunge: 10, close: 5, hitstop: HITSTOP.light },
  // Wave 2: out of a dash, out of a fall, and back up in the air.
  dashStrike: { name: '', duration: .6, contacts: [.22], damage: 34, range: 2.4, radius: .85, stamina: 12, cooldown: 1, stun: .55, knockback: 3.5,
    style: 'melee', lunge: 8, close: 4, outcome: 'stagger', hitstop: HITSTOP.light },
  wakeUp: { name: '', duration: .62, contacts: [.24], damage: 36, range: 2.3, radius: 1, stamina: 10, cooldown: 2.5, stun: .6, knockback: 6,
    style: 'melee', lunge: 3, outcome: 'stagger', evade: .22, hitstop: HITSTOP.heavy },
  airRise: { name: '', duration: .55, contacts: [.2], damage: 30, range: 2.2, radius: .9, stamina: 12, cooldown: 1.6, stun: .5, knockback: 1,
    style: 'melee', lunge: 3, outcome: 'launch', lift: 7.5, hitstop: HITSTOP.light },
};

/** Each style's names for its techniques. */
export const STYLE_NAMES: Readonly<Record<BodyType, Readonly<Record<TechniqueKey, string>>>> = {
  fists: { rush: 'Dashing Strike', rise: 'Rising Uppercut', slip: 'Sidestep Hook', hh: 'Body Blow', hhh: 'Crushing Blow',
    charge: 'Charging Strike', counter: 'Counter Stance', delay: 'Delayed Haymaker', airRush: 'Falling Ember',
    dashStrike: 'Dashing Combo', wakeUp: 'Rising Counter', airRise: 'Air Uppercut' },
  blade: { rush: 'Lunging Thrust', rise: 'Rising Slash', slip: 'Sidestep Cut', hh: 'Follow-up Cleave', hhh: 'Crushing Cleave',
    charge: 'Charging Blade', counter: 'Iai Counter', delay: 'Delayed Cleave', airRush: 'Aerial Lunge',
    dashStrike: 'Dashing Slash', wakeUp: 'Rising Reap', airRise: 'Air Rising Slash' },
  kicks: { rush: 'Lunging Kick', rise: 'Rising Kick', slip: 'Sidestep Roundhouse', hh: 'Spinning Heel', hhh: 'Guillotine Kick',
    charge: 'Cannonball Kick', counter: 'Counter Spin Kick', delay: 'Delayed Spin Kick', airRush: 'Diving Kick',
    dashStrike: 'Dashing Kick', wakeUp: 'Rising Front Kick', airRise: 'Air Rising Kick' },
  polearm: { rush: 'Driving Thrust', rise: 'Rising Sweep', slip: 'Pivot Swing', hh: 'Wide Swing', hhh: 'Ground Breaker',
    charge: 'Battering Charge', counter: 'Staff Counter', delay: 'Delayed Smash', airRush: 'Plunging Strike',
    dashStrike: 'Dashing Sweep', wakeUp: 'Rising Swing', airRise: 'Air Rising Sweep' },
  caster: { rush: 'Blink Strike', rise: 'Uplift Burst', slip: 'Phase Step', hh: 'Force Palm', hhh: 'Crushing Wave',
    charge: 'Barrier Charge', counter: 'Reflect Stance', delay: 'Delayed Burst', airRush: 'Arcane Dive',
    dashStrike: 'Dashing Burst', wakeUp: 'Rising Ward', airRise: 'Air Uplift' },
  giant: { rush: 'Charging Ram', rise: 'Upheaval', slip: 'Heavy Sidestep', hh: 'Knot Hook', hhh: 'Colossus Slam',
    charge: 'Juggernaut Charge', counter: 'Iron Counter', delay: 'Delayed Slam', airRush: 'Meteor Drop',
    dashStrike: 'Dashing Ram', wakeUp: 'Rising Shove', airRise: 'Air Upheaval' },
};
/** How a style's body changes the template: a blade or a staff reaches further, a caster's heaviest blow is a wave about
 *  them, a giant is slower and hits harder. */
const STYLE_SHAPES: Readonly<Partial<Record<BodyType, Partial<Record<TechniqueKey | 'all', Partial<MoveDefinition>>>>>> = {
  blade: { all: { range: .3 } },
  kicks: { all: { range: .25 } },
  polearm: { all: { range: .5 }, hhh: { radius: 1.4 } },
  caster: { all: { range: .5 }, hhh: { style: 'field', radius: 2.2, lunge: 0 }, counter: { radius: 1.2 } },
  giant: { all: { range: .2, damage: 1.1 }, hhh: { radius: 1.3 } },
};
/** A fighter's own name for a technique, where one is theirs (the style's otherwise). */
export const OWN_NAMES: Readonly<Partial<Record<FighterId, Partial<Record<TechniqueKey, string>>>>> = {
  taisei: { rush: 'Redline Dash', rise: 'Monkey King Uppercut', counter: 'Empty Mind Counter' },
  ouga: { rush: 'Royal Charge', rise: 'Crown Uppercut', counter: 'Prince\'s Reprisal' },
  gummy: { rush: 'Bow Wave Rush', rise: 'Riptide Uppercut', counter: 'Rebound Counter' },
  konta: { rush: 'Foxpack Rush', rise: 'Gust Uppercut', counter: 'Kitsune Counter' },
  shiden: { rush: 'Storm Hawk Lunge', counter: 'Hawk-Eye Counter' },
  kenzo: { rush: 'Oni Lunge', counter: 'Iai Counter: Ronin' },
  nigo: { rush: 'Ember Step Thrust', counter: 'Nightfall Counter' },
  koko: { rush: 'Iron Rush', counter: 'Lullaby Counter' },
  oro: { rush: 'Gilded Rush', counter: 'Midnight Counter' },
  kosho: { rush: 'Service Rush', counter: 'Kitchen Counter' },
  shirokane: { rush: 'Scarecrow Dash', counter: 'Mirror Counter' },
  kuon: { rush: 'Gravity Blink', counter: 'Null Counter' },
  gaunt: { rush: 'Hound Lunge', counter: 'Ash Hound Counter' },
  setsu: { rush: 'Snowflash', counter: 'Instant Counter' },
  kagari: { rush: 'Wildfire Rush', counter: 'Ember Counter' },
  ward: { rush: 'Crossmatch Lunge', counter: 'Triage Counter' },
};

/** The fighter's style, for its techniques: its body type, fists where the map has none yet. */
export const styleOf = (fighter: FighterId): BodyType => bodyTypeOf(fighter) ?? 'fists';
export function techniqueName(fighter: FighterId, key: TechniqueKey) { return OWN_NAMES[fighter]?.[key] ?? STYLE_NAMES[styleOf(fighter)][key]; }

const cache = new Map<string, MoveDefinition>();
/** The technique as `fighter` throws it: the template, the style's shape, the fighter's tempo (its light against the
 *  roster's, as an ender's: combos.ts) and its name. */
export function techniqueMove(fighter: FighterId, key: TechniqueKey): MoveDefinition {
  const id = `${fighter}:${key}`;
  const known = cache.get(id); if (known) return known;
  const style = styleOf(fighter), t = TEMPLATE[key], shapes = STYLE_SHAPES[style];
  const all = shapes?.all ?? {}, own = shapes?.[key] ?? {};
  const k = Math.min(1.3, Math.max(.85, (MOVES[fighter]?.light.duration ?? .46) / .46)) * (style === 'giant' ? 1.08 : 1);
  const move: MoveDefinition = {
    ...t, ...own,
    name: techniqueName(fighter, key),
    duration: +((own.duration ?? t.duration) * k).toFixed(3),
    contacts: (own.contacts ?? t.contacts).map(c => +(c * k).toFixed(3)),
    range: (own.range ?? t.range) + (all.range ?? 0),
    damage: Math.round((own.damage ?? t.damage) * (all.damage ?? 1)),
    ...(t.stance ? { stance: { from: +(t.stance.from * k).toFixed(3), to: +(t.stance.to * k).toFixed(3) } } : {}),
    ender: true,
  };
  cache.set(id, move);
  return move;
}

/** The kinds of technique a combo can be built from, for its style (simulation.ts styleFor): a pure light string is one
 *  kind; a route through a launcher, the air and a crusher is four. */
export type ComboKind = 'string' | 'ender' | 'heavy' | 'opener' | 'counter' | 'delay' | 'air' | 'special' | 'ultimate' | 'area';
export function comboKind(slot: string, branch: string | undefined, airborne: boolean): ComboKind {
  if (branch === 'counter') return 'counter';
  if (branch === 'delay') return 'delay';
  if (branch === 'rush' || branch === 'rise' || branch === 'slip' || branch === 'charge' || branch === 'dashStrike' || branch === 'wakeUp') return 'opener';
  if (branch === 'airRush' || branch === 'airRise' || branch === 'airHeavy' || branch === 'airSpecial') return 'air';
  if (branch === 'hh' || branch === 'hhh') return 'heavy';
  if (branch) return 'ender';
  if (slot === 'light') return airborne ? 'air' : 'string';
  if (slot === 'heavy') return 'heavy';
  return slot === 'ultimate' ? 'ultimate' : slot === 'area' ? 'area' : 'special';
}
/** What a combo's variety is worth: each kind past the first adds STYLE_STEP to every blow that lands from then on, up
 *  to STYLE_MOST. Mashing one string stays at 1. */
export const STYLE_STEP = .1, STYLE_MOST = 1.4;
export const styleScale = (kinds: number) => Math.min(STYLE_MOST, 1 + STYLE_STEP * Math.max(0, kinds - 1));
