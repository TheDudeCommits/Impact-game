import { comboMove as gameComboMove, type ComboKey } from '../game/combos';
import type { FighterId } from '../game/types';
import { shownMove } from './shown';

export * from '../game/combos';
export function comboMove(fighter: FighterId, key: ComboKey, awakened = false) { return shownMove(fighter, gameComboMove(fighter, key, awakened)); }
