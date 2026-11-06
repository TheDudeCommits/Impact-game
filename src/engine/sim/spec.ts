import type { AwakeningDefinition } from '../../game/awakening';
import type { MoveDefinition, RushShape } from '../../game/moves';
import type { ComboKey } from '../../game/combos';
import type { TourStyle } from '../../game/timeStopBarrage';
import type { AttackSlot, CoreSlot, FighterId } from '../../game/types';
import type { BodyType, ElementKitId } from './archetypes';

/** Bumped when a spec's shape changes in a way an older reader can't follow. */
export const SPEC_VERSION = 1 as const;

export const ATTACK_SLOTS: readonly AttackSlot[] = ['light', 'heavy', 'special', 'ultimate', 'area'];
export const CORE_SLOTS: readonly CoreSlot[] = ['light', 'heavy', 'special', 'ultimate'];

export interface KitSpec {
  slots: Record<AttackSlot, MoveDefinition>;
  /** The light rush string's follow-ups, stages 1.. (moves.ts RUSH; stage 0 is the light slot itself, as rushMove has it). */
  rush: readonly MoveDefinition[];
  rushShape: RushShape;
  /** Names of the air string's three blows, where the fighter has its own (moves.ts AIR_RUSH). */
  airRush?: readonly (string | undefined)[];
  /** The six combo enders (combos.ts), as the simulation resolves them. */
  combos: Partial<Record<ComboKey, MoveDefinition>>;
  awakening: AwakeningDefinition;
  /** What the awakening changes, slot by slot and rush stage by rush stage; only what differs from the base kit. */
  awakened: { slots: Partial<Record<AttackSlot, MoveDefinition>>; rush: readonly (MoveDefinition | null)[]; combos: Partial<Record<ComboKey, MoveDefinition>> };
  /** A time-stop ultimate's tour of its victims (timeStopBarrage.ts), where it has one. */
  timeStopTour?: TourStyle;
}

/** The body as the simulation sees it: reach, size and jump. */
export interface BodySimSpec {
  /** Centre-to-centre gap a melee blow lands at (moves.ts CONTACT_GAP). */
  contactGap: number;
  /** Body size against the roster's 1 (moves.ts BODY_SIZE). */
  bodySize: number;
  /** Jump height against the roster's 1 (moves.ts JUMP_SCALE). */
  jumpScale: number;
}

export interface ArchetypeSpec { body: BodyType; elements: readonly ElementKitId[] }

export interface SimFighterSpec {
  spec: typeof SPEC_VERSION;
  id: FighterId;
  /** The content pack it belongs to. Every fighter today is the base pack's. */
  pack: 'jump';
  series: string;
  /** Its side in Bad Blood and the Rift War (objectives/model.ts). */
  faction: 'heroes' | 'villains';
  availability: { released: boolean; laboratory: boolean };
  archetype: ArchetypeSpec;
  body: BodySimSpec;
  kit: KitSpec;
}
