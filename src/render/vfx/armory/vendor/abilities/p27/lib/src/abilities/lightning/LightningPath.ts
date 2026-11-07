// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { Vector3 } from "three";
import { SeededRandom } from "./verdictConfig";

/** Bounded segment storage, reusable for bolts, streamers, hand arcs and surface conduction. */
export class LightningPath {
  readonly data: Float32Array;
  count = 0;
  private readonly random = new SeededRandom();
  private readonly direction = new Vector3();
  private readonly side = new Vector3();
  private readonly up = new Vector3();
  private readonly reference = new Vector3();
  constructor(readonly capacity: number) {
    this.data = new Float32Array(capacity * 10);
  }
  clear(seed: number): void {
    this.count = 0;
    this.random.reset(seed);
  }
  segment(
    ax: number,
    ay: number,
    az: number,
    bx: number,
    by: number,
    bz: number,
    width: number,
    reveal: number,
    phase: number,
    group: number,
  ): boolean {
    if (this.count >= this.capacity) return false;
    const i = this.count++ * 10;
    const d = this.data;
    d[i] = ax;
    d[i + 1] = ay;
    d[i + 2] = az;
    d[i + 3] = bx;
    d[i + 4] = by;
    d[i + 5] = bz;
    d[i + 6] = width;
    d[i + 7] = reveal;
    d[i + 8] = phase;
    d[i + 9] = group;
    return true;
  }
  /** Correlated macro bends plus bounded high-frequency detail; endpoints are always exact. */
  channel(
    start: Readonly<Vector3>,
    end: Readonly<Vector3>,
    segments: number,
    width: number,
    jaggedness: number,
    group = 0,
    revealStart = 0,
    revealEnd = 1,
  ): void {
    if (
      ![start.x, start.y, start.z, end.x, end.y, end.z].every(Number.isFinite)
    )
      return;
    this.direction.subVectors(end, start);
    const length = this.direction.length();
    if (length < 0.0001) return;
    this.direction.divideScalar(length);
    this.reference.set(
      Math.abs(this.direction.y) > 0.85 ? 1 : 0,
      Math.abs(this.direction.y) > 0.85 ? 0 : 1,
      0,
    );
    this.side.crossVectors(this.direction, this.reference).normalize();
    this.up.crossVectors(this.side, this.direction).normalize();
    const phase = this.random.next() * 6.28318,
      bend = (this.random.next() - 0.5) * 2;
    let ax = start.x,
      ay = start.y,
      az = start.z;
    for (let j = 1; j <= segments && this.count < this.capacity; j++) {
      const t = j / segments,
        envelope = Math.sin(Math.PI * t);
      const lateral =
        (Math.sin(t * 11 + phase) * 0.7 +
          Math.sin(t * 27 + phase * 2) * 0.28 +
          (this.random.next() - 0.5) * 0.6) *
        jaggedness *
        envelope;
      const vertical =
        (Math.sin(t * 15 + phase * 3) * 0.35 +
          (this.random.next() - 0.5) * 0.35 +
          bend * Math.sin(t * 4)) *
        jaggedness *
        envelope;
      const bx =
        start.x +
        (end.x - start.x) * t +
        this.side.x * lateral +
        this.up.x * vertical;
      const by =
        start.y +
        (end.y - start.y) * t +
        this.side.y * lateral +
        this.up.y * vertical;
      const bz =
        start.z +
        (end.z - start.z) * t +
        this.side.z * lateral +
        this.up.z * vertical;
      this.segment(
        ax,
        ay,
        az,
        bx,
        by,
        bz,
        width * (1 - t * 0.24),
        revealStart + (revealEnd - revealStart) * t,
        phase,
        group,
      );
      ax = bx;
      ay = by;
      az = bz;
    }
  }
  randomValue(): number {
    return this.random.next();
  }
}
