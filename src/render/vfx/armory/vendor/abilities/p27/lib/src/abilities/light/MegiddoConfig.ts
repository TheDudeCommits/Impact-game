// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import type { QualityConfig } from "../../quality/QualityPreset";
export const MEGIDDO = {
  cooldown: 8,
  range: 50,
  lifetime: 6.8,
  firstStrike: 1.3,
  height: 23,
  radius: 6.6,
} as const;
export interface RadiantQuality {
  strikes: number;
  particles: number;
  lenses: number;
  detail: number;
  light: number;
  mist: number;
}
export function radiantQuality(
  config: Readonly<QualityConfig>,
): RadiantQuality {
  const detail =
    config.effectParticleBudget <= 150
      ? 0
      : config.effectParticleBudget <= 400
        ? 1
        : 2;
  return {
    strikes: [5, 8, 12][detail],
    particles: [150, 400, 900][detail],
    lenses: [5, 8, 12][detail],
    detail,
    light: [280, 520, 760][detail],
    mist: [8, 16, 28][detail],
  };
}
export const smooth = (a: number, b: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
export const fade = (age: number): number =>
  1 - smooth(4.4, MEGIDDO.lifetime, age);
