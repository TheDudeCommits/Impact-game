import type { MoveDefinition } from '../../game/moves';
import type { AttackSlot, FighterId } from '../../game/types';
import { capArea, onLook } from './areaDamage';

/** How far each tune may push a borrowed move, as a multiplier: power scales its damage, reach its range, speed its
 *  timing (faster plays the whole move, contacts and all, in less time; the cooldown is the slot's own, and an area
 *  move's telegraph stays what it is: its counterplay is not tunable). */
export const TUNE_LIMITS = { power: [0.8, 1.2], reach: [0.8, 1.2], speed: [0.85, 1.15] } as const;
export type TuneKey = keyof typeof TUNE_LIMITS;

/** The statuses the Forge offers (VOL.3 part two), each one fixed preset so kits stay comparable. */
export const FORGE_STATUSES = {
  burn: { kind: 'burn', seconds: 3, dps: 10 },
  slow: { kind: 'slow', seconds: 2.5, factor: .65 },
  freeze: { kind: 'freeze', seconds: .6 },
} as const satisfies Record<string, NonNullable<MoveDefinition['status']>>;
export type ForgeStatus = keyof typeof FORGE_STATUSES;

/** A VFX Armory effect worn by a slot or the body (kit v2): which effect, and its look. Cosmetic - the simulation and
 *  the server ignore it beyond its shape - except in the area slot, where the effect's strikes time the move's (round
 *  3, areaDamage.ts); the page's cue director plays it (src/engine/client/forgeLive.ts). */
export interface ForgeFx {
  /** A catalogue id (src/engine/vfx/armory/catalog.json) or an engine kit's own effect (`ice/crystal-field`). */
  effect: string;
  /** The effect's own settings, by its parameter names (the Armory's inspector). */
  settings?: Record<string, number | string | boolean>;
  /** Its size against the move's (1: as cast). */
  scale?: number;
  /** A hue turn in degrees (0: its own colours). */
  hue?: number;
}
export interface SlotPick {
  from: FighterId;
  /** Which of `from`'s slots the move comes from (kit v2); the slot it sits in when absent. */
  fromSlot?: AttackSlot;
  tune?: Partial<Record<TuneKey, number>>;
  status?: ForgeStatus;
  /** The slot's Armory effect (kit v2): cosmetic, except in the area slot, whose strikes land when its look's do. */
  fx?: ForgeFx;
}
/** Where a slot's move comes from: the fighter, and which of its slots. */
export const pickSource = (slot: AttackSlot, pick: SlotPick): { fighter: FighterId; slot: AttackSlot } => ({ fighter: pick.from, slot: pick.fromSlot ?? slot });

const clampTune = (key: TuneKey, value: number | undefined) => {
  const [lo, hi] = TUNE_LIMITS[key];
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(hi, Math.max(lo, value)) : 1;
};
const round = (value: number, places = 3) => +value.toFixed(places);

export function tuneMove(source: MoveDefinition, pick: Pick<SlotPick, 'tune' | 'status' | 'fx'>): MoveDefinition {
  const power = clampTune('power', pick.tune?.power), reach = clampTune('reach', pick.tune?.reach), speed = clampTune('speed', pick.tune?.speed);
  const move = structuredClone(source) as MoveDefinition;
  if (move.area && pick.fx?.effect) onLook(move, pick.fx.effect);
  if (power !== 1) {
    move.damage = Math.round(move.damage * power);
    if (move.finisherDamage !== undefined) move.finisherDamage = Math.round(move.finisherDamage * power);
    if (move.schedule) move.schedule = move.schedule.map(each => Math.round(each * power));
  }
  if (reach !== 1) move.range = round(move.range * reach, 2);
  if (pick.status && FORGE_STATUSES[pick.status]) move.status = { ...FORGE_STATUSES[pick.status] };
  if (speed !== 1) {
    const time = (t: number) => round(t / speed);
    move.duration = time(move.duration);
    move.contacts = move.contacts.map(time);
    if (move.lungeDelay !== undefined) move.lungeDelay = time(move.lungeDelay);
    if (move.active !== undefined) move.active = time(move.active);
    if (move.teleport) move.teleport = { ...move.teleport, vanish: time(move.teleport.vanish), appear: time(move.teleport.appear) };
    if (move.confirm) move.confirm = { recovery: time(move.confirm.recovery) };
  }
  return move.area ? capArea(move) : move;
}
