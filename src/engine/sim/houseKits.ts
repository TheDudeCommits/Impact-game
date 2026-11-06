import type { MoveDefinition } from '../../game/moves';
import type { TourStyle } from '../../game/timeStopBarrage';
import type { AttackSlot, FighterId } from '../../game/types';
import { pickSource, tuneMove, type ForgeFx, type SlotPick } from './tune';
import data from './houseKits.json';

/** One fighter's house kit: any of its slots, and an aura. `why` is a note for whoever reads the data. */
export interface HouseKit { slots?: Partial<Record<AttackSlot, SlotPick>>; aura?: ForgeFx; why?: string }

export const HOUSE_KITS: Readonly<Partial<Record<FighterId, HouseKit>>> = data as Partial<Record<FighterId, HouseKit>>;
/** A fighter's house kit, if it has one. */
export const houseKit = (fighter: FighterId): HouseKit | undefined => HOUSE_KITS[fighter];
/** A fighter's house pick for a slot, if it has one. */
export const housePick = (fighter: FighterId, slot: AttackSlot): SlotPick | undefined => HOUSE_KITS[fighter]?.slots?.[slot];
/** Whether a pick names the fighter's own move in that very slot. */
export const ownPick = (fighter: FighterId, slot: AttackSlot, pick: SlotPick) => { const from = pickSource(slot, pick); return from.fighter === fighter && from.slot === slot; };
/** Whose authored move a fighter throws in a slot: its house pick's source, else its own. Once, never further: a house
 *  pick is applied from the authored tables. */
export function authoredSource(fighter: FighterId, slot: AttackSlot): { fighter: FighterId; slot: AttackSlot } {
  const pick = housePick(fighter, slot);
  return pick && !ownPick(fighter, slot, pick) ? pickSource(slot, pick) : { fighter, slot };
}

/** Puts every house kit into the move tables, in place (game/moves.ts calls it once, as they load). Each pick is made
 *  from the authored tables as they stood before the first one, so the order never matters. A borrowed time stop
 *  brings its own fighter's tour, as forgeMoves' does. Returns what it changed, `fighter.slot`. */
export function applyHouseKits(moves: Record<FighterId, Record<AttackSlot, MoveDefinition>>, tours: Partial<Record<FighterId, TourStyle>> = {},
  kits: Readonly<Partial<Record<FighterId, HouseKit>>> = HOUSE_KITS): string[] {
  const authored = new Map<FighterId, Record<AttackSlot, MoveDefinition>>();
  for (const id of Object.keys(moves) as FighterId[]) authored.set(id, { ...moves[id] });
  const changed: string[] = [];
  for (const [id, house] of Object.entries(kits) as [FighterId, HouseKit][]) {
    if (!moves[id] || !house?.slots) continue;
    for (const [slot, pick] of Object.entries(house.slots) as [AttackSlot, SlotPick][]) {
      const from = pick ? pickSource(slot, pick) : undefined, source = from ? authored.get(from.fighter)?.[from.slot] : undefined;
      // A pick naming nobody, or a slot its source lacks, is left out here and reported by tests/houseKits.test.ts.
      if (!from || !source || !(slot in moves[id])) continue;
      const move = tuneMove(source, pick);
      const tour = tours[from.fighter];
      if (move.timeStop && !move.timeStop.tour && tour && (from.fighter !== id || from.slot !== slot)) move.timeStop = { ...move.timeStop, tour };
      moves[id][slot] = move;
      changed.push(`${id}.${slot}`);
    }
  }
  return changed;
}
