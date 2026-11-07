// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import type { QualityConfig } from '../../quality/QualityPreset';
export interface SpectralQuality { detail: number; layers: number; ribbons: number; fractures: number; rings: number; particles: number; lights: number; waterSources: number; }
export function spectralQuality(c: Readonly<QualityConfig>): SpectralQuality {
  const d = c.effectParticleBudget >= 900 ? 2 : c.effectParticleBudget >= 400 ? 1 : 0;
  return { detail: d, layers: [3, 5, 7][d], ribbons: [3, 7, 12][d], fractures: [4, 10, 18][d], rings: [3, 6, 10][d], particles: [240, 720, 1600][d], lights: [1, 2, 3][d], waterSources: [4, 7, 10][d] };
}
