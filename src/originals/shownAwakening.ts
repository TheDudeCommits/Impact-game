import { AWAKENINGS as GAME_AWAKENINGS, moveFor as gameMoveFor, rushMove as gameRushMove } from '../game/awakening';
import type { AttackSlot, FighterId } from '../game/types';
import { shownMove, shownNames } from './shown';

export * from '../game/awakening';
export const AWAKENINGS = shownNames(GAME_AWAKENINGS);
export function moveFor(fighter: FighterId, slot: AttackSlot, awakened: boolean) { return shownMove(fighter, gameMoveFor(fighter, slot, awakened)); }
export function rushMove(fighter: FighterId, stage: number, awakened: boolean) { return shownMove(fighter, gameRushMove(fighter, stage, awakened)); }
