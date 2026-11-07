import type { StageId } from './stages';

/** The feel pass, iteration ten: the places whose floor is a liquid - the Mirror Mere's fight stands in the lake's
 *  shallows. Where a foot, a dash, a landing or a
 *  blow would kick up dust anywhere else, it splashes there (render/vfx/VfxKit.ts `splash`) and is heard to
 *  (audio/CombatAudio.ts `step`). Presentation only: the simulation's floor is the same flat floor either way.
 *
 *  `level` is the surface's height: a body standing up on a rock or a ridge in it is on stone, not in the
 *  liquid. `lit` and `shade` are the spray's two cel tones. */
export interface LiquidFloor { kind: 'water' | 'blood'; level: number; lit: number; shade: number }
export const LIQUID_FLOORS: Partial<Record<StageId, LiquidFloor>> = {
  'ashfall-weir': { kind: 'water', level: 0, lit: 0xf4fbff, shade: 0x86b7dc },
  'mirror-mere': { kind: 'water', level: 0, lit: 0x8a90c8, shade: 0x2a2c50 },
};
/** How far off the surface a foot may be and still be in it (m). */
export const LIQUID_REACH = .25;
export function onLiquid(floor: LiquidFloor | undefined, y: number) { return !!floor && Math.abs(y - floor.level) < LIQUID_REACH; }
