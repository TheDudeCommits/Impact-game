import {BALL_ARENAS, isBallArena, type BallArenaId} from '../../game/ball/arenas';
import type {BallStage} from './BallArena';

/** Which arena the ball stages are dressed as. The match says (its view's `arena`,
 *  set from main.ts before the stage is shown); StageEnvironment builds that one and rebuilds the stage when it changes.
 *  On this machine `?ballarena=<id>` picks one for checks and captures. */
const chosen: Record<BallStage, BallArenaId> = {'ball-pitch': 'ink-bowl', 'ball-court': 'sky-court'};

export function setBallArena(arena: BallArenaId | undefined) {
  if (!arena || !isBallArena(arena)) return;
  chosen[BALL_ARENAS[arena].mode === 'goal-rush' ? 'ball-pitch' : 'ball-court'] = arena;
}

export const ballArenaFor = (stage: BallStage): BallArenaId => chosen[stage];

if (typeof location === 'object' && ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) {
  const asked = new URLSearchParams(location.search).get('ballarena');
  if (isBallArena(asked)) setBallArena(asked);
}
