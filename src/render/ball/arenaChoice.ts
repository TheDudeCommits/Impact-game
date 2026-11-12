import {BALL_ARENAS, isBallArena, type BallArenaId} from '../../game/ball/arenas';
import {CLASSIC_COURT, VOLLEY_COURT, sameCourt, type SpikeCourt} from '../../game/ball/model';
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

/** The court Sky Spike's stage is built for - the match's (its ball's `court`: volleyball's for three a side), else
 *  the classic's. main.ts sets it as the arena; StageEnvironment builds the stage again when it changes. */
let court: SpikeCourt = CLASSIC_COURT;
export function setBallCourt(c: SpikeCourt | undefined) { court = !c || sameCourt(c, CLASSIC_COURT) ? CLASSIC_COURT : sameCourt(c, VOLLEY_COURT) ? VOLLEY_COURT : {...c}; }
export const ballCourtFor = (): SpikeCourt => court;

if (typeof location === 'object' && ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) {
  const asked = new URLSearchParams(location.search).get('ballarena');
  if (isBallArena(asked)) setBallArena(asked);
}
