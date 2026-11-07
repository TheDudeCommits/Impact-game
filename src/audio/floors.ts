import { FIGHTERS } from '../config';
import { AWAKENINGS } from '../game/awakening';
import { onLiquid, type LiquidFloor } from '../game/footing';
import type { StageId } from '../game/stages';
import type { FighterId, PlayerState } from '../game/types';
import type { AudioCue } from './cueTypes';

export type Surface = 'stone' | 'wood' | 'sand' | 'grass' | 'water' | 'snow' | 'metal';

export const FLOORS: Readonly<Record<StageId, Surface>> = {
  // ---- the main game's places (render/ground/index.ts GROUND_DECISIONS)
  harbor: 'stone',                      // cobbles and quays
  'wreckers-causeway': 'stone',
  'ash-colosseum': 'grass',              // a grass field inside the stadium wall
  'sunfall-arena': 'stone',   // the ring is stone; its lawn is past the edge the bounds hold the fight inside
  'zenith-coliseum': 'stone',
  'proving-hall': 'wood',           // indoors: the Proving Hall's floor
  'sunward-summit': 'stone',
  'ashfall-weir': 'water',
  'mirror-mere': 'water',         // a lake of blood
  'hollowmere-quarry': 'stone',
  'cinder-flats': 'sand',                // the white desert
  'warlords-roof': 'stone',                  // the roof of the warlord's hall: tiles
  'drifting-isle': 'metal',                // the isle's metal arena
  'thornwood-ward': 'stone',
  'kuroyuki-hall': 'stone',
  'rift-war': 'grass', 'blood-citadel': 'stone', 'hidden-ash': 'stone',
  'rift-village': 'stone', 'rift-swords': 'water', 'rift-fortress': 'stone', 'rift-eclipse': 'stone', 'rift-frost': 'snow',
  'rift-grove': 'grass', 'rift-wastes': 'sand', 'rift-harbor': 'wood',
  'dry-harbour': 'stone',
  'starfall-crater': 'sand',               // the crater's loose, swept earth
  'scrap-pit': 'stone',
};

/** What is under a foot at height `y` in `stage`: the place's floor; in a place whose floor is a liquid, the liquid
 *  at its surface and stone above it. No stage (a mode with its own beds, a test): stone, as every floor was. */
export function surfaceAt(stage: StageId | undefined, liquid: LiquidFloor | undefined, y: number): Surface {
  const floor = stage ? FLOORS[stage] ?? 'stone' : 'stone';
  return floor === 'water' && liquid && !onLiquid(liquid, y) ? 'stone' : floor;
}

export const STEPS: Readonly<Record<Surface, { readonly takes: readonly [AudioCue, AudioCue]; readonly gain: number }>> = {
  stone: { takes: ['fx-step-stone-1', 'fx-step-stone-2'], gain: .13 },
  wood: { takes: ['fx-step-wood-1', 'fx-step-wood-2'], gain: .12 },
  sand: { takes: ['fx-step-sand-1', 'fx-step-sand-2'], gain: .1 },
  grass: { takes: ['fx-step-grass-1', 'fx-step-grass-2'], gain: .1 },
  water: { takes: ['fx-step-water-1', 'fx-step-water-2'], gain: .07 },
  snow: { takes: ['fx-step-snow-1', 'fx-step-snow-2'], gain: .1 },
  metal: { takes: ['fx-step-metal-1', 'fx-step-metal-2'], gain: .1 },
};

/** How heavy a body is on the floor, 0 (the lightest of the roster) to 1 (a giant): from its height, and awakened from
 *  the form it stands in. Lanthorn at 1.55 m is 0, a fighter of 1.8 m about 0.2, Haldor and Barrow about 0.9,
 *  Gorai and the awakened fox 1. */
export function weightOf(fighter: FighterId, awakened = false): number {
  const height = FIGHTERS[fighter]?.height ?? 1.8, form = awakened ? AWAKENINGS[fighter]?.formScale ?? 1 : 1;
  // (A summon towers over its fighter without being the body on the floor: a Guardian's wearer steps as themself.)
  const stands = height * (awakened && AWAKENINGS[fighter]?.kind !== 'summon' && AWAKENINGS[fighter]?.kind !== 'spirit' ? Math.min(form, 2) : 1);
  return Math.max(0, Math.min(1, (stands - 1.55) / 1.45 + (BUILD[fighter] ?? 0)));
}
/** Height alone makes a tall, lean fighter a giant and a broad one of the same height no heavier: where a body's build
 *  says otherwise, added to its weight. A suit of armour, a mountain of a man, a fish-man; and the other way an Empress
 *  on long legs, a god of the sky islands, a string-man who walks on air. */
const BUILD: Readonly<Partial<Record<FighterId, number>>> = {
  barrow: .3, haldor: .3, shakugo: .15, oyashio: .2, 'full-beam': .15, shanxiao: .2, 'shibuichi': .3, gaunt: .15, 'ovid': .15, onigawara: .1, highsun: .1, jirenga: .15,
  'basilissa': -.3, adad: -.25, strappado: -.2, tokan: -.1, senko: -.1, sorayomi: -.05, 'psyche': -.05,
};
/** A player's weight now. */
export const weightNow = (p: Pick<PlayerState, 'fighter' | 'awakened'>) => weightOf(p.fighter, !!p.awakened);

/** A heavy body's sounds are lower and fuller, a light one's quicker and thinner: the playback rate and the level a
 *  weight gives a movement sound (a step, a landing, a dash). 1 and 1 at the roster's middle (about 0.2). */
export const weightRate = (weight: number) => 1.08 - .36 * weight;
export const weightGain = (weight: number) => .88 + .6 * weight;
/** From this weight a step shakes the floor: a low thud is laid under it. */
export const GIANT = .6;
