// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
export const SPECTRAL = { cooldown: 10, range: 85, lifetime: 9, release: 1.05, arrival: 1.65, impact: 3.72, radius: 22 } as const;
export const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
export function smooth(a: number, b: number, v: number): number { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); }
export function envelope(a: number, b: number, c: number, d: number, t: number): number { return smooth(a, b, t) * (1 - smooth(c, d, t)); }
