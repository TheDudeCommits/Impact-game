import type { StageId } from '../game/stages';

type ClosableMode = 'arcade' | 'last-stand' | 'bad-blood';

export const SERVER_GATE = {
  /** The place a room is fought in (a Duel's when `duel`). */
  roomStage: (stage: StageId, _duel = false): StageId => stage,
  /** The place a room moves to once its field is known (a royale's dominant series' place), or where it stays. */
  movedStage: (stage: StageId | undefined, current: StageId): StageId => stage ?? current,
  /** Why a room of this mode is refused, in words a player can read; nothing when it is open. */
  closedMode: (_mode: ClosableMode): string | undefined => undefined,
  /** Whether a party may choose and launch this mode (src/game/social/party.ts: 'survival' is Arcade's co-op). */
  partyModeAllowed: (_mode: string): boolean => true,
};

export const roomStage = (stage: StageId, duel = false) => SERVER_GATE.roomStage(stage, duel);
export const movedStage = (stage: StageId | undefined, current: StageId) => SERVER_GATE.movedStage(stage, current);
export const closedMode = (mode: ClosableMode) => SERVER_GATE.closedMode(mode);
export const partyModeAllowed = (mode: string) => SERVER_GATE.partyModeAllowed(mode);
