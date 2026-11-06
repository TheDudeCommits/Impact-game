import { LIQUID_FLOORS } from '../../../game/footing';
import type { GroundPlan } from '../build';
import type { WaterPlan } from '../water';

/** The lake the fight stands in: the stretch of it the waves are simulated over - the fight's square and its
 *  margins - open water on every side (the lake runs on to the horizon). Slow waves that settle soon. */
export const SHRINE_WATER: Omit<WaterPlan, 'walls' | 'look' | 'source'> = {
  name: 'mere water',
  level: LIQUID_FLOORS['mirror-mere']!.level,
  sim: { x0: -44, z0: -50, x1: 44, z1: 48 },
  open: [true, true, true, true],
  speed: 5, damping: .5,
  slope: 2.5,
};

/** The lake's water itself is laid by src/originals/grounds.ts (GROUND_CHANGES), on a surface of its own. */
export const SHRINE_GROUND: GroundPlan = {};
