// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import type { QualityConfig } from "../../quality/QualityPreset";
export interface StormDragonQuality {
  mist: number;
  detail: number;
  clouds: number;
  rain: number;
  particles: number;
  arcs: number;
  strikes: number;
  tornadoes: number;
  helices: number;
  scales: number;
  lights: number;
}
const tiers: readonly StormDragonQuality[] = [
  {
    detail: 0,
    mist: 8,
    clouds: 24,
    rain: 120,
    particles: 600,
    arcs: 6,
    strikes: 5,
    tornadoes: 2,
    helices: 2,
    scales: 72,
    lights: 1,
  },
  {
    detail: 1,
    mist: 20,
    clouds: 48,
    rain: 420,
    particles: 1600,
    arcs: 16,
    strikes: 10,
    tornadoes: 3,
    helices: 4,
    scales: 180,
    lights: 2,
  },
  {
    detail: 2,
    mist: 36,
    clouds: 80,
    rain: 900,
    particles: 3200,
    arcs: 32,
    strikes: 18,
    tornadoes: 5,
    helices: 7,
    scales: 360,
    lights: 3,
  },
];
export function stormDragonQuality(
  c: Readonly<QualityConfig>,
): StormDragonQuality {
  return tiers[
    c.effectParticleBudget <= 150 ? 0 : c.effectParticleBudget <= 400 ? 1 : 2
  ];
}
