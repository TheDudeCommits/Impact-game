/** Hand-drawn impact flipbooks (scripts/vfx/build_ink_impacts.py): an 8x8 grid of 256 px cells in /assets/vfx/ink-impacts.png.
 *  R fill, G heat, B ink, A coverage. Directional sequences point their blow along +X. */
export const INK_IMPACT_URL = '/assets/vfx/ink-impacts.png';
export const INK_IMPACT_GRID = 8;
export const INK_IMPACTS = {
  /** Main hit starburst: ragged white-hot core, thick tapered spikes longest ahead (+X), stubby behind. f0 pop-in,
   *  f1-3 full reach (~95% of the cell radius ahead), f4-7 spikes snap into flying shards as the core shrinks and cools,
   *  f8-11 scattered shards and a thin broken ink ring, then nearly empty. */
  burst: { start: 0, frames: 12, directional: true },
  /** Alternate hit: fewer, fatter barbed spikes around a cross-shaped white flash (long arm along +X); cracks into
   *  chunky angular debris that tumbles outward, then sparse debris and ink splats. */
  burst2: { start: 12, frames: 12, directional: true },
  /** Blade-hit spark: a thick bright crescent (convex toward +X) sweeping upper-left to lower-right, with a fan of
   *  needle sparks thrown along +X; f0-2 the arc grows thick and hot, f3-7 it thins and breaks into dashes. */
  slash: { start: 24, frames: 8, directional: true },
  /** Round special/ultimate finisher: white core, fireball with curling flame tongues and swirling heat separations,
   *  a jagged shockwave ring that detaches from f3 and races out, debris flecks; smoke-ish puffs (low G) by f9-11. */
  blast: { start: 32, frames: 12, directional: false },
  /** 4-point "kira" glint with thinner diagonal rays, almost all heat (white-hot centre), no ink; f0 small, f1 largest,
   *  f2-3 shrinking. */
  flash: { start: 44, frames: 4, directional: false },
  /** Brush shockwave ring (fill band + ink, with breaks) and radial speed lines, expanding r 30 -> 118 px and thinning. */
  ring: { start: 48, frames: 8, directional: false },
} as const;
export type InkImpact = keyof typeof INK_IMPACTS;
