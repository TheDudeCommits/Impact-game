// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { BufferGeometry, Float32BufferAttribute } from "three";
/** Stable seeded outline. Different left/right spans and depth offsets avoid a flat portal disc. */
export function outlinePoint(
  t: number,
  side: number,
  seed: number,
): [number, number, number] {
  const h = Math.pow(Math.max(0, Math.sin(t * Math.PI)), 0.7);
  const center =
    0.58 * Math.sin(t * 9 + seed * 0.013) + 0.27 * Math.sin(t * 21);
  const tooth =
    0.74 +
    0.12 * Math.sin(t * 52 + side * 7 + seed * 0.07) +
    0.065 * Math.sin(t * 89 + side * 3);
  return [
    center + side * (0.045 + 4.2 * h * tooth),
    t * 18,
    0.42 * Math.sin(t * 35 + side * 3) + 0.22 * Math.cos(t * 15),
  ];
}
export function makeRiftGeometry(
  levels: number,
  depths: number,
  seed: number,
  boundary = false,
  boundaryWidth = 0.3,
): BufferGeometry {
  const pos: number[] = [],
    uv: number[] = [],
    depth: number[] = [],
    idx: number[] = [];
  if (boundary) {
    for (const side of [-1, 1]) {
      const start = pos.length / 3;
      for (let j = 0; j <= levels; j++)
        for (const width of [-1, 1]) {
          const t = j / levels,
            p = outlinePoint(t, side, seed);
          pos.push(p[0] + width * boundaryWidth, p[1], p[2] + 0.025);
          uv.push(width * 0.5 + 0.5, t);
          depth.push(0);
        }
      for (let j = 0; j < levels; j++) {
        const k = start + j * 2;
        idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
      }
    }
  } else {
    // Recessed asymmetric tunnel walls, followed by a curved dark back surface.
    for (const side of [-1, 1]) {
      const start = pos.length / 3;
      for (let d = 0; d <= depths; d++)
        for (let j = 0; j <= levels; j++) {
          const t = j / levels,
            p = outlinePoint(t, side, seed),
            z = d / depths;
          pos.push(
            p[0] * (1 - z * 0.63) + z * 0.35 * Math.sin(t * 12),
            p[1],
            p[2] * (1 - z) - z * 7.5,
          );
          uv.push((side < 0 ? 0.0 : 1) * (1 - z * 0.65) + z * 0.325, t);
          depth.push(z);
        }
      for (let d = 0; d < depths; d++)
        for (let j = 0; j < levels; j++) {
          const k = start + d * (levels + 1) + j;
          idx.push(
            k,
            k + 1,
            k + levels + 1,
            k + 1,
            k + levels + 2,
            k + levels + 1,
          );
        }
    }
    const start = pos.length / 3;
    for (let j = 0; j <= levels; j++)
      for (let x = 0; x <= 8; x++) {
        const t = j / levels,
          a = outlinePoint(t, -1, seed),
          b = outlinePoint(t, 1, seed),
          f = x / 8;
        pos.push(
          (a[0] * (1 - f) + b[0] * f) * 0.37 + 0.35 * Math.sin(t * 12),
          t * 18,
          -7.5 - Math.sin(f * Math.PI) * 1.3,
        );
        uv.push(0.325 + f * 0.35, t);
        depth.push(1);
      }
    for (let j = 0; j < levels; j++)
      for (let x = 0; x < 8; x++) {
        const k = start + j * 9 + x;
        idx.push(k, k + 1, k + 9, k + 1, k + 10, k + 9);
      }
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new Float32BufferAttribute(uv, 2));
  g.setAttribute("aDepth", new Float32BufferAttribute(depth, 1));
  g.setIndex(idx);
  g.computeBoundingBox();
  return g;
}
