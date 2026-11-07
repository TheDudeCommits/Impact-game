// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import type { QualityConfig } from '../../quality/QualityPreset';

/** Live scalar controls are read each frame. Shape controls rebuild only through configure(). */
export interface SandReaperConfig {
  bladeLength: number; bladeWidth: number; bladeThickness: number; crescentCurvature: number;
  bladeSpinSpeed: number; flightSpeed: number; facetRoughness: number; noiseFrequency: number;
  sandDensity: number; sandTurbulence: number; fragmentCount: number; fragmentSpeed: number;
  mineralGlow: number; dustOpacity: number; impactRadius: number;
}
export const SAND_REAPER_DEFAULTS: Readonly<SandReaperConfig> = Object.freeze({
  bladeLength: 3.8, bladeWidth: .84, bladeThickness: .48, crescentCurvature: 2.13,
  bladeSpinSpeed: 2.4, flightSpeed: 40, facetRoughness: .055, noiseFrequency: 3.3,
  sandDensity: 1, sandTurbulence: .7, fragmentCount: 88, fragmentSpeed: 12,
  mineralGlow: .65, dustOpacity: .12, impactRadius: 8.5,
});
export const SAND_CAST = Object.freeze({ cooldown: 6, range: 42, release: .62, residual: 2.8, maximumActive: 2 });
export interface SandQuality { segments: number; fragments: number; grains: number; dust: number; droplets: number; detail: number; light: boolean; }
export function sandQuality(q: Readonly<QualityConfig>): SandQuality {
  if (q.effectParticleBudget <= 150) return { segments: 16, fragments: 24, grains: 420, dust: 24, droplets: 28, detail: 0, light: false };
  if (q.effectParticleBudget <= 400) return { segments: 28, fragments: 48, grains: 1100, dust: 56, droplets: 60, detail: 1, light: true };
  return { segments: 40, fragments: 88, grains: 2400, dust: 100, droplets: 110, detail: 2, light: true };
}
/** Clamp every public control before it reaches a shader, buffer size or flight calculation. */
export function validatedSandConfig(patch: Partial<SandReaperConfig>, current: Readonly<SandReaperConfig> = SAND_REAPER_DEFAULTS): SandReaperConfig {
  const result = { ...current };
  const limits: Record<keyof SandReaperConfig, readonly [number, number]> = {
    bladeLength: [2, 7], bladeWidth: [.25, 1.4], bladeThickness: [.15, .9], crescentCurvature: [1.55, 2.4],
    bladeSpinSpeed: [0, 5], flightSpeed: [25, 65], facetRoughness: [0, .1], noiseFrequency: [.5, 9],
    sandDensity: [.2, 1.5], sandTurbulence: [0, 1.5], fragmentCount: [12, 90], fragmentSpeed: [4, 20],
    mineralGlow: [0, 1.5], dustOpacity: [0, .25], impactRadius: [3, 12],
  };
  for (const key of Object.keys(limits) as (keyof SandReaperConfig)[]) {
    const value = patch[key];
    if (value === undefined) continue;
    if (!Number.isFinite(value)) throw new RangeError(`Sand Reaper ${key} must be finite`);
    result[key] = Math.max(limits[key][0], Math.min(limits[key][1], value));
  }
  result.fragmentCount = Math.round(result.fragmentCount);
  return result;
}
