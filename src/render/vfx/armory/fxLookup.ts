import type { AttackSlot, CombatEvent, FighterId } from '../../../game/types';
import type { Fighter } from '../../Fighter';
import { moveSource, presentationKit } from '../../../engine/client/forgeLive';
import { pickSource, type ForgeFx } from '../../../engine/sim/forge';

/**
 * Which Forge effect (kit v2 `fx`) draws a move, as the effect modules see moves (forgeFx.ts, fxStage.ts).
 *
 * The kit is a body's: its slots are the body's (a slot may hold another fighter's move), and each slot's `fx` draws
 * whatever move sits in it. The modules see moves as the move transplant presents them (src/engine/client/
 * transplant.ts): a borrowed move's events name the move's own fighter and slot, and the throwing body in `body`, and
 * while it is thrown the body's `state` reads as the move's fighter. So the kit is found by the body the Fighter was
 * built as (`bodyFighter`) and the player's `forge`, and a borrowed move's slot by matching the kit's picks.
 */

/** The area slot's look is played by src/render/AreaTelegraph.ts at its strike; listed here so a kit's pick for it is
 *  fetched ahead like any slot's. */
export const MOVE_SLOTS: readonly AttackSlot[] = ['light', 'heavy', 'special', 'ultimate', 'area'];

/** A player as its kit knows it: the body's own fighter (not a borrowed move's) and its forged kit's hash, if any. */
export function kitOwner(f: Fighter | undefined): { fighter: FighterId; forge?: string } | undefined {
  const state = f?.state;
  if (!state || state.enemy) return undefined;
  return { fighter: (f as Fighter & { bodyFighter?: FighterId }).bodyFighter ?? state.fighter, forge: state.forge };
}

/** The body slot an event's move sits in: its own slot, or for a borrowed move's event (`body` set) the slot whose pick
 *  is that move. Never a combo ender's or a rush's later stage (the body's own moves, which a slot's fx does not draw). */
export function bodySlotOf(owner: { fighter: FighterId; forge?: string }, event: CombatEvent): AttackSlot | undefined {
  if (!event.slot || event.branch !== undefined || (event.slot === 'light' && (event.chain ?? 0) > 0)) return undefined;
  if (!event.body || event.body === event.fighter) return event.slot;
  const kit = presentationKit(owner);
  if (!kit) return undefined;
  for (const slot of MOVE_SLOTS) {
    const pick = kit.slots[slot];
    if (!pick) continue;
    const source = pickSource(slot, pick);
    if (source.fighter === event.fighter && source.slot === event.slot) return slot;
  }
  return undefined;
}

/** The effect an event's move is drawn with, by its thrower's kit; undefined: none (the move's own look). */
export function eventFx(event: CombatEvent, fighters: ReadonlyMap<string, Fighter> | undefined): ForgeFx | undefined {
  const owner = kitOwner(fighters?.get(event.actorId));
  if (!owner) return undefined;
  const slot = bodySlotOf(owner, event);
  return slot ? presentationKit(owner)?.slots[slot]?.fx : undefined;
}

/** A body's aura from its kit. */
export function auraFx(f: Fighter | undefined): ForgeFx | undefined {
  const owner = kitOwner(f);
  return owner ? presentationKit(owner)?.aura : undefined;
}

/** Each slot a player's kit draws with an effect, as the events name its move (`fighter:slot`: the move's own fighter
 *  and slot, a borrowed one's included), with the effect. */
export function* kitSlots(f: Fighter): Generator<{ key: string; fx: ForgeFx }> {
  const owner = kitOwner(f);
  const kit = owner ? presentationKit(owner) : undefined;
  if (!owner || !kit) return;
  for (const slot of MOVE_SLOTS) {
    const fx = kit.slots[slot]?.fx;
    if (!fx) continue;
    const source = moveSource(owner, slot);
    yield { key: source ? `${source.fighter}:${source.slot}` : `${owner.fighter}:${slot}`, fx };
  }
}
