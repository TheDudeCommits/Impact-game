import type { AreaAnim, AreaSpec, MoveDefinition } from '../../game/moves';
import type { CoreSlot, FighterId } from '../../game/types';
import { elementKitsOf, type ElementKitId } from './archetypes';
import { FORGE_STATUSES } from './tune';
import { AREA_LOOKS, onLook } from './areaDamage';
import authored from './areaMoves.json';

export const AREA_DEFAULTS = { range: 14, radius: 4, telegraph: .75, cooldown: 12, height: 4, aim: 8 } as const;

/** One fighter's entry in areaMoves.json. */
export type AreaEntry = Partial<Omit<MoveDefinition, 'area'>> & { area?: Partial<AreaSpec>; element?: ElementKitId };

export const AREA_BASE: Readonly<MoveDefinition> = Object.freeze({
  name: 'Area Strike', duration: .62, contacts: [.38], damage: 200, range: AREA_DEFAULTS.range, radius: AREA_DEFAULTS.radius,
  stamina: 18, cooldown: AREA_DEFAULTS.cooldown, stun: .7, knockback: 8, style: 'field', detached: true,
  area: { telegraph: AREA_DEFAULTS.telegraph, look: 'burst' },
} as MoveDefinition);

const burn = FORGE_STATUSES.burn, slow = FORGE_STATUSES.slow, freeze = FORGE_STATUSES.freeze;
export const AREA_BY_ELEMENT: Readonly<Record<ElementKitId, AreaEntry>> = {
  fire: { name: 'Flame Pillar', damage: 184, outcome: 'launch', knockback: 8, status: { ...burn }, area: { look: 'pillar' } },
  blackflame: { name: 'Black Flame Bloom', damage: 176, outcome: 'crumple', knockback: 3, status: { ...burn }, area: { look: 'zone', card: 'Black Flame' } },
  explosion: { name: 'Detonation', damage: 224, outcome: 'launch', knockback: 12, area: { look: 'burst' } },
  ice: { name: 'Frost Bloom', damage: 160, outcome: 'stagger', knockback: 2, status: { ...freeze }, area: { look: 'zone' } },
  lightning: { name: 'Thunder Strike', damage: 204, outcome: 'stagger', knockback: 4, area: { look: 'pillar' } },
  beam: { name: 'Sky Beam', damage: 212, outcome: 'launch', knockback: 9, area: { look: 'pillar' } },
  will: { name: 'Will Crash', damage: 208, outcome: 'crumple', knockback: 5, area: { look: 'burst' } },
  slash: { name: 'Blade Storm', damage: 224, outcome: 'spin', knockback: 6, area: { look: 'zone' } },
  domain: { name: 'Cursed Ground', damage: 172, outcome: 'stagger', knockback: 2, status: { ...slow }, area: { look: 'zone' } },
  gravity: { name: 'Grave Pull', damage: 192, outcome: 'crumple', knockback: 2, area: { look: 'zone' } },
  summon: { name: 'Summoned Crash', damage: 216, outcome: 'launch', knockback: 10, area: { look: 'burst' } },
  windwater: { name: 'Cyclone', damage: 212, outcome: 'launch', knockback: 7, area: { look: 'zone' } },
  earth: { name: 'Earth Spikes', damage: 208, outcome: 'launch', knockback: 8, area: { look: 'pillar' } },
  strings: { name: 'Thread Cage', damage: 168, outcome: 'stagger', knockback: 2, status: { ...slow }, area: { look: 'zone' } },
  mecha: { name: 'Orbital Strike', damage: 228, outcome: 'knockdown', knockback: 10, area: { look: 'pillar' } },
  strength: { name: 'Ground Shatter', damage: 220, outcome: 'knockdown', knockback: 9, area: { look: 'burst' } },
};

const ENTRIES = authored as Readonly<Partial<Record<FighterId, AreaEntry>>>;
/** A fighter's own entry in areaMoves.json, if it has one. */
export const areaEntry = (fighter: FighterId): AreaEntry | undefined => ENTRIES[fighter];
/** Every fighter with an entry of its own (the review's progress). */
export const authoredAreaFighters = (): FighterId[] => Object.keys(ENTRIES) as FighterId[];

/** The element a fighter's area move starts from: its entry's, else its first element kit's, else raw strength. */
export function areaElement(fighter: FighterId): ElementKitId {
  const named = ENTRIES[fighter]?.element;
  return named && named in AREA_BY_ELEMENT ? named : elementKitsOf(fighter)[0] ?? 'strength';
}

/** A fighter's own area move: the base, its element's default, then its entry. */
export function areaMoveOf(fighter: FighterId): MoveDefinition {
  return areaMoveFrom(AREA_BY_ELEMENT[areaElement(fighter)], ENTRIES[fighter] ?? {}, AREA_LOOKS[fighter]?.[0]);
}
/** An area move from an entry: the base, an element's default, then the entry, timed to a look. A fighter's own
 *  (areaMoveOf), and an awakened form's that is another body's (the YUGE's Rumbling: game/awakening.ts). */
export function areaMoveFrom(element: AreaEntry, entry: AreaEntry, look: string | undefined): MoveDefinition {
  const { element: _named, area: own, ...fields } = entry;
  const move = { ...structuredClone(AREA_BASE), ...structuredClone(element), ...structuredClone(fields) } as MoveDefinition & { element?: string };
  delete move.element;
  move.area = { ...AREA_BASE.area!, ...element.area, ...own } as AreaSpec;
  // A move named for itself keeps no card from its element's default name (AreaSpec.card).
  if (fields.name !== undefined && own?.card === undefined) delete move.area.card;
  // Timed to its look (round 3): the fighter's first area look, its total laid across that look's strikes.
  return onLook(move, look);
}

/** Each element's word for the stamp's ring where an area move has no Japanese name of its own (AreaSpec.ja). */
export const ELEMENT_JA: Readonly<Record<ElementKitId, string>> = {
  fire: '炎', blackflame: '黒炎', explosion: '爆', ice: '氷', lightning: '雷', beam: '光', will: '覇気', slash: '斬',
  domain: '領域', gravity: '重力', summon: '召喚', windwater: '風', earth: '地', strings: '糸', mecha: '機', strength: '力',
};
/** The Japanese the stamp's ring carries for a fighter's area move: its own name, else its element's word. */
export const areaJaOf = (fighter: FighterId, move: MoveDefinition | undefined): string => move?.area?.ja ?? ELEMENT_JA[areaElement(fighter)];
/** The name an area move's G card carries (presentation only): its short card name (AreaSpec.card), else its name. The
 *  cast banner and the seal's ring keep the full name. */
export const areaCardOf = (move: Pick<MoveDefinition, 'name' | 'area'>): string => move.area?.card ?? move.name;

/** How an area cast is drawn (AreaSpec.anim), read: whose take (the caster's own, or the fighter it borrows from),
 *  which of its slots or which of its own clips by name, and whether whole or cut at the release. */
export interface AreaAnimOf { fighter: FighterId; slot: CoreSlot; clip?: string; full: boolean }
export function areaAnimOf(owner: FighterId, move: MoveDefinition | undefined): AreaAnimOf {
  const anim: AreaAnim | string | undefined = move?.area?.anim;
  if (typeof anim === 'string') return { fighter: owner, slot: anim as CoreSlot, full: false };
  return { fighter: anim?.from ?? owner, slot: anim?.slot ?? 'special', ...(anim?.clip ? { clip: anim.clip } : {}), full: !!anim?.full };
}
