// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { Vector3 } from "three";
import { LightningPath } from "./LightningPath";
import type { LightningQuality } from "./verdictConfig";
import { VERDICT } from "./verdictConfig";

/** Iterative, bounded branching. Child channels attach to real parent segment endpoints. */
export class LightningBranchGenerator {
  readonly path = new LightningPath(1400);
  private readonly start = new Vector3();
  private readonly end = new Vector3();
  private readonly trunks = new Float32Array(65 * 3);
  private readonly forkStarts = new Uint16Array(12);
  generate(seed: number, q: LightningQuality, revision = 0): LightningPath {
    const p = this.path;
    p.clear(seed);
    this.start.set(0, VERDICT.height, 0);
    this.end.set(0, 0.06, 0);
    // The connected precursor and discharge retain the same macro trunk across re-strikes.
    p.channel(this.start, this.end, q.subdivisions, 1.15, 1.75, 0);
    for (let i = 0; i < q.subdivisions; i++) {
      const j = i * 10;
      this.trunks[i * 3] = p.data[j + 3];
      this.trunks[i * 3 + 1] = p.data[j + 4];
      this.trunks[i * 3 + 2] = p.data[j + 5];
    }
    p.clear(seed + revision * 431); // Preserve trunk coordinates, vary its fine branches.
    let ax: number = 0,
      ay: number = VERDICT.height,
      az: number = 0;
    for (let i = 0; i < q.subdivisions; i++) {
      const k = i * 3,
        bx = this.trunks[k],
        by = this.trunks[k + 1],
        bz = this.trunks[k + 2];
      p.segment(
        ax,
        ay,
        az,
        bx,
        by,
        bz,
        1.15 * (1 - (i / q.subdivisions) * 0.2),
        (i + 1) / q.subdivisions,
        0,
        0,
      );
      ax = bx;
      ay = by;
      az = bz;
    }
    for (let i = 0; i < q.major; i++) {
      // Bias substantial forks into the lower channel so close gameplay cameras still see
      // a branching silhouette. Stratified heights/azimuths prevent one-sided outlier casts.
      const node = Math.floor(
        (0.16 +
          Math.sqrt((i + 0.25 + p.randomValue() * 0.5) / q.major) * 0.68) *
          (q.subdivisions - 1),
      );
      this.start.fromArray(this.trunks, node * 3);
      const angle =
          ((seed % 4096) / 4096) * Math.PI * 2 +
          i * 2.399963 +
          (p.randomValue() - 0.5) * 0.7,
        radius = 3 + p.randomValue() * 5.5;
      this.end.set(
        this.start.x + Math.cos(angle) * radius,
        Math.max(0.12, this.start.y - (3 + p.randomValue() * 8)),
        this.start.z + Math.sin(angle) * radius,
      );
      this.forkStarts[i] = p.count;
      p.channel(this.start, this.end, 16, 0.54, 0.95, 1, 0.1, 0.98);
    }
    for (let i = 0; i < q.minor; i++) {
      const parent = i % q.major,
        segment =
          this.forkStarts[parent] + Math.floor(p.randomValue() * 12) + 2;
      this.start.fromArray(p.data, segment * 10 + 3);
      const angle = p.randomValue() * Math.PI * 2,
        length = 1.1 + p.randomValue() * 3.2;
      this.end.set(
        this.start.x + Math.cos(angle) * length,
        Math.max(0.08, this.start.y - (0.6 + p.randomValue() * 3)),
        this.start.z + Math.sin(angle) * length,
      );
      p.channel(this.start, this.end, 9, 0.22, 0.43, 2, 0.25, 1);
    }
    for (let i = 0; i < q.micro; i++) {
      const parent = Math.floor(p.randomValue() * Math.max(1, p.count));
      this.start.fromArray(p.data, parent * 10 + 3);
      this.end.set(
        this.start.x + (p.randomValue() - 0.5) * 2.0,
        Math.max(0.04, this.start.y - p.randomValue() * 1.9),
        this.start.z + (p.randomValue() - 0.5) * 2.0,
      );
      p.channel(this.start, this.end, 5, 0.095, 0.18, 3, 0.3, 1);
    }
    return p;
  }
}
