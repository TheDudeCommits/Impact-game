// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import type { QualityConfig } from "../../quality/QualityPreset";
export const WORLDREND = {
  cooldown: 12,
  range: 55,
  lifetime: 11,
  height: 18,
  width: 8.4,
  shock: 7.55,
  radius: 18,
} as const;
export interface VoidQuality {
  detail: number;
  levels: number;
  depths: number;
  shards: number;
  fragments: number;
  particles: number;
  filaments: number;
  haze: number;
  light: number;
}
export function voidQuality(c: Readonly<QualityConfig>): VoidQuality {
  const d =
    c.effectParticleBudget <= 150 ? 0 : c.effectParticleBudget <= 400 ? 1 : 2;
  return {
    detail: d,
    levels: [18, 28, 40][d],
    depths: [3, 5, 8][d],
    shards: [14, 34, 64][d],
    fragments: [80, 200, 420][d],
    particles: [150, 480, 1100][d],
    filaments: [6, 14, 28][d],
    haze: [6, 14, 28][d],
    light: [110, 220, 320][d],
  };
}
export function smooth(a: number, b: number, t: number): number {
  const x = Math.max(0, Math.min(1, (t - a) / (b - a)));
  return x * x * (3 - 2 * x);
}
export function riftPhase(t: number) {
  const collapse = smooth(5.5, 7.4, t);
  return {
    open: smooth(1.2, 2.65, t) * (1 - collapse),
    stretch: smooth(0.72, 1.65, t) * (1 - smooth(6.7, 7.5, t)),
    collapse,
    repair: smooth(7.7, 8.1, t) * (1 - smooth(8.3, 10.25, t)),
    alive: smooth(0.6, 0.95, t) * (1 - smooth(10.2, 11, t)),
    shock: smooth(WORLDREND.shock, 8.35, t),
  };
}
