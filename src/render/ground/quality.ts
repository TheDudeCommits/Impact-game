import type { Settings } from '../../config';
import { liveQuality } from '../liveQuality';

export type GroundQuality = Settings['quality'];

/** What a quality setting draws of a place's ground. 'high' is everything,
 *  'medium' about half the work, 'low' the cheapest version that still reads:
 *  the painted ground cover and its decals, and a still water surface. */
export interface GroundTier {
  /** Grass: the share of each ring's clumps drawn (0 = no blades, the cover
   *  alone), and how far from the lens the blades reach (m). */
  blades: number;
  reach: number;
  /** Flowers and leaf litter, as a share of the place's count. */
  decals: number;
  /** The water's wave field: simulated on the GPU at `cell` metres a texel,
   *  stepped `rate` times a second; or none (a still, painted surface). */
  water: { sim: boolean; cell: number; rate: number };
  /** Footprints a loose floor keeps at once. */
  prints: number;
}

export const GROUND_TIERS: Record<GroundQuality, GroundTier> = {
  high: { blades: 1, reach: 34, decals: 1, water: { sim: true, cell: .3, rate: 60 }, prints: 384 },
  medium: { blades: .5, reach: 24, decals: .6, water: { sim: true, cell: .42, rate: 60 }, prints: 192 },
  low: { blades: 0, reach: 0, decals: .35, water: { sim: false, cell: 0, rate: 0 }, prints: 0 },
};

/** The quality the page is drawn at now (render/liveQuality.ts: the renderer's, AUTO's pick included - not the saved
 *  settings, which hold nothing for a player who never opened OPTIONS). */
export function readQuality(): GroundQuality { return liveQuality(); }

/** Follows the quality while a place is up: a menu's change, AUTO's pick or the watch's step down is read back within
 *  `every` frames without a hook into the renderer. */
export class QualityWatch {
  current: GroundQuality = readQuality();
  private frames = 0;
  constructor(private readonly every = 90) {}
  /** True on the frame the quality changed. */
  poll() {
    if (++this.frames % this.every) return false;
    const next = readQuality();
    if (next === this.current) return false;
    this.current = next;
    return true;
  }
}
