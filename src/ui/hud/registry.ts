import {createRiftWarHud} from './RiftWarHud';
import type { HudLayoutId, ModeHudFactory } from './modeHud';
import { createDuelHud } from './DuelHud';
import { createRoyaleHud } from './RoyaleHud';
import { createTrainingHud } from './TrainingHud';
import { createArcadeHud } from './ArcadeHud';
import { createLastStandHud } from './LastStandHud';
import { createBadBloodHud } from './BadBloodHud';
import { createBallHud } from './BallHud';

/** Round 5 (UX): one HUD module per mode (modeHud.ts). WP2 owns Duel, Royale and Training; WP3 owns Arcade, Last
 *  Stand and Bad Blood. Each package edits only its own module and stylesheet; this table does not change. */
export const MODE_HUDS: Readonly<Record<HudLayoutId, ModeHudFactory>> = {
  'rift-war':createRiftWarHud, duel: createDuelHud, royale: createRoyaleHud, training: createTrainingHud,
  arcade: createArcadeHud, 'last-stand': createLastStandHud, 'bad-blood': createBadBloodHud,
  'goal-rush': createBallHud, 'sky-spike': createBallHud,
};
