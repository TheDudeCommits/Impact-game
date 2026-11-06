import { AIR_RUSH as GAME_AIR_RUSH, airRushName as gameAirRushName } from '../game/moves';
import type { FighterId } from '../game/types';
import { displayMove } from './apply';
import { ORIGINALS } from './roster';

export * from '../game/moves';
export const AIR_RUSH: typeof GAME_AIR_RUSH = { ...GAME_AIR_RUSH };
for (const id of Object.keys(ORIGINALS) as FighterId[]) {
  const stages = GAME_AIR_RUSH[id];
  if (stages) AIR_RUSH[id] = [displayMove(id, stages[0]), displayMove(id, stages[1]), displayMove(id, stages[2])];
}
export function airRushName(fighter: FighterId, stage: number) { return displayMove(fighter, gameAirRushName(fighter, stage)); }
