// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { InstancedBufferAttribute, Vector3 } from "three";
import { MEGIDDO } from "./MegiddoConfig";
/** Ordered score: center, side pair, rear accent, triple cadence, outer echoes, central seal.
 * Lower presets preserve this rhythm through a curated subset, rather than random omissions. */
const SCORE = [
  [0, 0, 1.3, 0.34, 1.35],
  [-3.8, 1.5, 1.53, 0.23, 0.65],
  [3.4, -0.8, 1.59, 0.25, 0.7],
  [0, -4.4, 1.83, 0.31, 1.0],
  [-2.5, -2.6, 2.06, 0.22, 0.65],
  [2.4, 3, 2.13, 0.23, 0.75],
  [-0.8, 4.5, 2.2, 0.25, 0.82],
  [4.8, -3.6, 2.3, 0.2, 0.5],
  [-5, -2, 1.69, 0.19, 0.44],
  [5, 2.9, 1.97, 0.21, 0.5],
  [-4, 4.3, 2.25, 0.2, 0.45],
  [0, 0, 2.46, 0.26, 0.7],
] as const;
const SUBSETS = [
  [0, 1, 2, 3, 11],
  [0, 1, 2, 3, 4, 5, 6, 11],
  SCORE.map((_, i) => i),
];
export class BeamStrikeSequence {
  readonly offsets = new Float32Array(12 * 3);
  readonly timings = new Float32Array(12 * 4);
  readonly offsetAttribute = new InstancedBufferAttribute(this.offsets, 3);
  readonly timingAttribute = new InstancedBufferAttribute(this.timings, 4);
  count = 0;
  configure(detail: number, seed: number): void {
    const angle = ((seed % 997) / 997) * Math.PI * 2,
      c = Math.cos(angle),
      s = Math.sin(angle);
    const indices = SUBSETS[detail];
    this.count = indices.length;
    for (let i = 0; i < this.count; i++) {
      const row = SCORE[indices[i]];
      this.offsets.set(
        [row[0] * c - row[1] * s, 0, row[0] * s + row[1] * c],
        i * 3,
      );
      this.timings.set(
        [row[2], row[3], row[4], MEGIDDO.height + (i % 3) * 1.4],
        i * 4,
      );
    }
    this.offsetAttribute.needsUpdate = this.timingAttribute.needsUpdate = true;
  }
  getFlash(age: number, out = new Vector3()): number {
    let brightest = 0;
    for (let i = 0; i < this.count; i++) {
      const t = age - this.timings[i * 4];
      const flash =
        t >= 0 && t < 0.45 ? Math.exp(-t * 14) * this.timings[i * 4 + 2] : 0;
      if (flash > brightest) {
        brightest = flash;
        out.fromArray(this.offsets, i * 3);
      }
    }
    return brightest;
  }
}
