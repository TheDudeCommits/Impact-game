// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import type { QualityConfig } from "../../quality/QualityPreset";

export const VERDICT = {
  cooldown: 4,
  range: 45,
  lifetime: 6.2,
  strike: 1.02,
  height: 22,
  discharge: 0.24,
  afterimage: 0.11,
} as const;
export interface LightningQuality {
  subdivisions: number;
  major: number;
  minor: number;
  micro: number;
  precursors: number;
  secondary: number;
  nodes: number;
  particles: number;
  mist: number;
  clouds: number;
  detail: number;
  light: number;
}
export function lightningQuality(
  config: Readonly<QualityConfig>,
): LightningQuality {
  if (config.effectParticleBudget <= 150)
    return {
      subdivisions: 32,
      major: 4,
      minor: 10,
      micro: 8,
      precursors: 3,
      secondary: 2,
      nodes: 6,
      particles: 150,
      mist: 6,
      clouds: 3,
      detail: 0,
      light: 650,
    };
  if (config.effectParticleBudget <= 400)
    return {
      subdivisions: 48,
      major: 8,
      minor: 22,
      micro: 18,
      precursors: 6,
      secondary: 4,
      nodes: 10,
      particles: 360,
      mist: 14,
      clouds: 6,
      detail: 1,
      light: 1100,
    };
  return {
    subdivisions: 64,
    major: 12,
    minor: 42,
    micro: 36,
    precursors: 10,
    secondary: 7,
    nodes: 16,
    particles: 840,
    mist: 24,
    clouds: 10,
    detail: 2,
    light: 1700,
  };
}
export const smooth = (a: number, b: number, value: number): number => {
  const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
export function pulse(age: number, start: number, duration: number): number {
  const t = (age - start) / duration;
  return t >= 0 && t < 1 ? Math.pow(1 - t, 2) : 0;
}
export function dischargeIntensity(age: number): number {
  const t = age - VERDICT.strike;
  return (
    pulse(t, 0, 0.068) +
    pulse(t, 0.081, 0.051) * 0.78 +
    pulse(t, 0.169, 0.068) * 0.9
  );
}
export class SeededRandom {
  private state = 1;
  reset(seed: number): void {
    this.state = seed >>> 0 || 1;
  }
  next(): number {
    this.state = (Math.imul(this.state, 1664525) + 1013904223) >>> 0;
    return this.state / 4294967296;
  }
}
