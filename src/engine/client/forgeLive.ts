import type { AttackSlot, FighterId } from '../../game/types';
import { FORGE_VERSION, kitPick, pickSource, type ForgeFx, type ForgeKit, type KitSlots, type SlotPick } from '../sim/forge';
import { forgedKit } from '../sim/forgedKits';
import { authoredSource, houseKit, housePick, ownPick } from '../sim/houseKits';
import { ATTACK_SLOTS } from '../sim/spec';

/* ---------------------------------------------------------------- the kit in play */

const active = new Map<FighterId, ForgeKit>();
const listeners = new Set<(body: FighterId, kit: ForgeKit | undefined) => void>();

/** Puts a kit in play for its body, offline (ForgeSession does), or takes a body's away (`undefined`, `body`). */
export function setActiveKit(kit: ForgeKit | undefined, body: FighterId | undefined = kit?.body) {
  if (!body) return;
  if (kit) active.set(body, kit); else active.delete(body);
  for (const listener of listeners) listener(body, kit);
}
/** The kit in play offline for a body, if any. */
export const activeKit = (body: FighterId) => active.get(body);
/** Called whenever a body's kit changes (the transplant re-prepares, the cue director re-reads). Returns its remover. */
export function onKitChange(listener: (body: FighterId, kit: ForgeKit | undefined) => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }

/** The player's own kit, if it brings one: online the forged kit its state names by hash; offline the active kit of its
 *  fighter (the simulation plays that kit for every player of that fighter: MOVES is the body's). */
export function playerKit(state: { fighter: FighterId; forge?: string }): ForgeKit | undefined {
  return state.forge ? forgedKit(state.forge) : active.get(state.fighter);
}

const merged = new WeakMap<ForgeKit, ForgeKit>(), houseOnly = new Map<FighterId, ForgeKit>();
/** A player's kit over its fighter's house kit (src/engine/sim/houseKits.ts), as the page draws it. Slot by slot: the
 *  player's pick, unless it is the fighter's own move ("ORIGINAL"), which is the house pick, wearing the player's
 *  effect if it gives one. Every source is the authored move it really plays: a borrowed slot whose source has a house
 *  pick of its own names that pick's source (once: house picks never chain). */
function overHouse(fighter: FighterId, own: ForgeKit | undefined): ForgeKit {
  const house = houseKit(fighter)!;
  const slots = {} as KitSlots;
  for (const slot of ATTACK_SLOTS) {
    const pick: SlotPick = own ? kitPick(own, slot) : { from: fighter };
    const kept = housePick(fighter, slot);
    const from = ownPick(fighter, slot, pick) ? authoredSource(fighter, slot) : authoredSource(pick.from, pickSource(slot, pick).slot);
    const fx = pick.fx ?? (ownPick(fighter, slot, pick) ? kept?.fx : undefined);
    slots[slot] = { ...pick, from: from.fighter, ...(from.slot !== slot ? { fromSlot: from.slot } : { fromSlot: undefined }), ...(fx ? { fx } : { fx: undefined }) };
    if (slots[slot]!.fromSlot === undefined) delete slots[slot]!.fromSlot;
    if (slots[slot]!.fx === undefined) delete slots[slot]!.fx;
  }
  const aura = own?.aura ?? house.aura;
  return { forge: FORGE_VERSION, name: own?.name ?? fighter, body: own?.body ?? fighter, slots, ...(aura ? { aura } : {}) };
}

/** The kit a player's moves are drawn and heard from: its own kit (playerKit) over its fighter's house kit, when either
 *  exists; undefined for a fighter with neither, which plays its own moves as authored. */
export function presentationKit(state: { fighter: FighterId; forge?: string }): ForgeKit | undefined {
  const own = playerKit(state);
  if (!houseKit(state.fighter)) return own;
  if (!own) { let kit = houseOnly.get(state.fighter); if (!kit) houseOnly.set(state.fighter, kit = overHouse(state.fighter, undefined)); return kit; }
  let kit = merged.get(own);
  if (!kit) merged.set(own, kit = overHouse(state.fighter, own));
  return kit;
}
/** Whose move a player's slot plays, and from which of its slots; undefined when it is the fighter's own move in that
 *  slot. Combo enders and later rush stages are always the body's own (the simulation's rule). */
export function moveSource(state: { fighter: FighterId; forge?: string }, slot: AttackSlot): { fighter: FighterId; slot: AttackSlot } | undefined {
  const kit = presentationKit(state);
  if (!kit) return undefined;
  const source = pickSource(slot, kitPick(kit, slot));
  return source.fighter === state.fighter && source.slot === slot ? undefined : source;
}
/** A slot's Armory effect, or the body's aura (`'body'`), when the kit (or the house kit) gives one. */
export function slotFx(state: { fighter: FighterId; forge?: string }, slot: AttackSlot | 'body'): ForgeFx | undefined {
  const kit = presentationKit(state);
  return slot === 'body' ? kit?.aura : kit?.slots[slot]?.fx;
}

/* ---------------------------------------------------------------- the runtimes */

export interface TransplantRuntime {
  /** Makes `from`'s `fromSlot` move ready to play in `body`'s: its model and clips loaded and retargeted, its effects'
   *  files fetched. Resolves when the next throw will show it. */
  prepare(body: FighterId, from: FighterId, fromSlot: AttackSlot): Promise<void>;
  /** Starts fetching what all of `from`'s moves need (its take pack), without making any ready: for a fighter the player
   *  is likely to try next (its row hovered, the rows in view as the Forge opens). Cheap and safe to call often. */
  prefetch?(from: FighterId): void;
}
/** One thing the Armory's inspector lets a player turn on an effect, with its range. */
export interface ArmoryEssential { key: string; label: string; min: number; max: number; step: number; value: number }
export interface ArmoryEffectInfo {
  id: string;
  label: string;
  /** The Armory's school, and the game's element kit when it has one (src/engine/vfx/tags.ts). */
  school: string;
  kit?: string;
  cast: 'line' | 'zone';
  /** A small picture of it (packaged with the game). */
  thumb: string;
  essentials: readonly ArmoryEssential[];
}
export interface ArmoryRuntime {
  /** Every effect the game may play: the catalogue's, cleared to ship. */
  effects(): readonly ArmoryEffectInfo[];
  /** Loads an effect's code and files, so its first play is instant. */
  prepare(id: string): Promise<void>;
  /** Plays an effect from a player now, aimed at its target, without assigning it to anything. */
  preview(playerId: string, fx: ForgeFx): void;
}

let transplant: TransplantRuntime | undefined, armory: ArmoryRuntime | undefined;
export const registerTransplant = (runtime: TransplantRuntime) => { transplant = runtime; };
export const registerArmory = (runtime: ArmoryRuntime) => { armory = runtime; };
/** The move transplant, once its module has registered it. */
export const transplantRuntime = () => transplant;
/** The VFX Armory runtime, once its module has registered it. */
export const armoryRuntime = () => armory;
