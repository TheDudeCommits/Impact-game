import type { MoveDefinition } from '../game/moves';
import type { FighterId } from '../game/types';
import { displayMove } from './apply';
import { ORIGINALS } from './roster';

/** A move as shown: the same definition, renamed for the fighter throwing it. */
export function shownMove<M extends MoveDefinition | undefined>(fighter: FighterId, move: M): M {
  if (!move || !ORIGINALS[fighter]) return move;
  const name = displayMove(fighter, move.name);
  return name === move.name ? move : { ...move, name } as M;
}

/** A table of definitions keyed by fighter whose `name` is shown, with each original's renamed. */
export function shownNames<T extends { name: string }>(table: Record<FighterId, T>): Record<FighterId, T> {
  const out = { ...table };
  for (const id of Object.keys(ORIGINALS) as FighterId[]) {
    if (out[id]) out[id] = { ...out[id], name: displayMove(id, out[id].name) };
  }
  return out;
}
