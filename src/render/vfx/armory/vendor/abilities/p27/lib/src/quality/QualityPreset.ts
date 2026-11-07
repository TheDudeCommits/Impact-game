// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
export type QualityPreset = 'LOW' | 'MEDIUM' | 'MAX';
export interface QualityConfig {
  pixelRatio: number;
  particles: number;
  waterSegments: number;
  waterDetail: number;
  bloom: number;
  shadows: boolean;
  shadowMapSize: number;
  effectParticleBudget: number;
}
export const QUALITY_PRESETS: Record<QualityPreset, Readonly<QualityConfig>> = {
  LOW: { pixelRatio: 0.85, particles: 100, waterSegments: 32, waterDetail: 1, bloom: 0, shadows: false, shadowMapSize: 512, effectParticleBudget: 150 },
  MEDIUM: { pixelRatio: 1.25, particles: 300, waterSegments: 96, waterDetail: 2, bloom: 0.18, shadows: true, shadowMapSize: 1024, effectParticleBudget: 400 },
  MAX: { pixelRatio: 1.75, particles: 650, waterSegments: 160, waterDetail: 3, bloom: 0.27, shadows: true, shadowMapSize: 2048, effectParticleBudget: 900 },
};
