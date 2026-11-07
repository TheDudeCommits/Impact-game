// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
export const CATACLYSM = {
  cooldown: 25,
  range: 70,
  lifetime: 18,
  radius: 30,
  breath: 8.8,
  impact: 9.2,
  surge: 12.65,
} as const;
export function smooth(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
export function envelope(
  a: number,
  b: number,
  c: number,
  d: number,
  t: number,
): number {
  return smooth(a, b, t) * (1 - smooth(c, d, t));
}
export function random(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
