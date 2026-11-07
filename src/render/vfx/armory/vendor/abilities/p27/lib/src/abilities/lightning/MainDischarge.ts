// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { Group, Vector3 } from "three";
import { LightningRenderer } from "./LightningRenderer";
import { LightningBranchGenerator } from "./LightningBranchGenerator";
import { LightningPath } from "./LightningPath";
import { dischargeIntensity, pulse, smooth, VERDICT } from "./verdictConfig";
import type { LightningQuality } from "./verdictConfig";

/** Connected leaders, three main re-strikes and asynchronous subordinate sky strikes. */
export class MainDischarge {
  readonly root = new Group();
  readonly main = new LightningRenderer(1400);
  readonly precursors = new LightningRenderer(320);
  readonly secondary = new LightningRenderer(380);
  private readonly generator = new LightningBranchGenerator();
  private readonly precursorPath = new LightningPath(320);
  private readonly secondaryPath = new LightningPath(380);
  private readonly start = new Vector3();
  private readonly end = new Vector3();
  private q!: LightningQuality;
  private seed = 1;
  private revision = -1;
  private secondaryMask = -1;
  readonly secondaryPositions = new Float32Array(7 * 3);
  readonly secondaryTimes = new Float32Array([
    0.09, 0.18, 0.32, 0.47, 0.56, 0.63, 0.74,
  ]);
  constructor() {
    this.root.add(this.main.mesh, this.precursors.mesh, this.secondary.mesh);
  }
  configure(seed: number, q: LightningQuality): void {
    this.seed = seed;
    this.q = q;
    this.revision = -1;
    this.secondaryMask = -1;
    this.main.upload(this.generator.generate(seed, q));
    const path = this.precursorPath;
    path.clear(seed + 710);
    // One searching leader shares the future trunk; it never reaches the surface before connection.
    const source = this.generator.path;
    for (let i = 0; i < q.subdivisions; i++) {
      const j = i * 10;
      path.segment(
        source.data[j],
        source.data[j + 1],
        source.data[j + 2],
        source.data[j + 3],
        source.data[j + 4],
        source.data[j + 5],
        0.16,
        source.data[j + 7],
        source.data[j + 8],
        0,
      );
    }
    for (let i = 1; i < q.precursors; i++) {
      const angle = path.randomValue() * Math.PI * 2,
        r = 1.5 + path.randomValue() * 3.5;
      const upward = i % 3 === 0;
      this.start.set(
        Math.cos(angle) * r,
        upward ? 0.1 : VERDICT.height - 1,
        Math.sin(angle) * r,
      );
      this.end.set(
        this.start.x * 0.35,
        upward ? 2 + path.randomValue() * 3 : 6 + path.randomValue() * 5,
        this.start.z * 0.35,
      );
      const forkStart = path.count;
      path.channel(
        this.start,
        this.end,
        18,
        0.09 + path.randomValue() * 0.09,
        0.7,
        1,
      );
      this.start.fromArray(path.data, (forkStart + 8) * 10 + 3);
      this.end.set(
        this.start.x + (path.randomValue() - 0.5) * 2.0,
        Math.max(0.12, this.start.y + (upward ? 1.2 : -2.0)),
        this.start.z + (path.randomValue() - 0.5) * 2.0,
      );
      path.channel(this.start, this.end, 7, 0.075, 0.3, 2, 0.35, 1);
    }
    this.precursors.upload(path);
    path.clear(seed + 948);
    for (let i = 0; i < 7; i++) {
      const angle = path.randomValue() * 6.28318,
        r = 3.1 + path.randomValue() * 3.8;
      this.secondaryPositions[i * 3] = Math.cos(angle) * r;
      this.secondaryPositions[i * 3 + 1] = 0.06;
      this.secondaryPositions[i * 3 + 2] = Math.sin(angle) * r;
    }
  }
  update(age: number): void {
    const strikeAge = age - VERDICT.strike;
    const revision = strikeAge < 0.081 ? 0 : strikeAge < 0.169 ? 1 : 2;
    if (
      strikeAge >= 0 &&
      strikeAge < VERDICT.discharge &&
      revision !== this.revision
    ) {
      this.revision = revision;
      this.main.upload(this.generator.generate(this.seed, this.q, revision));
    }
    const flash = dischargeIntensity(age);
    const after =
      strikeAge >= VERDICT.discharge
        ? pulse(strikeAge, VERDICT.discharge, VERDICT.afterimage) * 0.035
        : 0;
    this.main.update(
      age,
      flash * 0.95 + after,
      1.1,
      1.6 + flash * 1.4,
      this.q.detail,
    );
    const leader =
      smooth(0.65, 0.78, age) *
      (1 - smooth(0.97, 1.04, age)) *
      (0.28 + pulse(age, 0.78, 0.045) * 0.4 + pulse(age, 0.94, 0.04) * 0.6);
    this.precursors.update(
      age,
      leader,
      smooth(0.65, 0.99, age) * 0.83 +
        smooth(0.995, VERDICT.strike, age) * 0.22,
      0.8,
      this.q.detail,
    );
    let mask = 0;
    for (let i = 0; i < this.q.secondary; i++)
      if (pulse(strikeAge, this.secondaryTimes[i], 0.115) > 0) mask |= 1 << i;
    if (mask !== this.secondaryMask) {
      this.secondaryMask = mask;
      const p = this.secondaryPath;
      p.clear(this.seed + 381 + mask);
      for (let i = 0; i < this.q.secondary; i++) {
        if (!(mask & (1 << i))) continue;
        this.end.fromArray(this.secondaryPositions, i * 3);
        this.start.set(
          this.end.x * 0.3,
          VERDICT.height * (0.68 + (i % 3) * 0.055),
          this.end.z * 0.3,
        );
        p.channel(this.start, this.end, 32, 0.34, 1.0, 0);
        this.start.lerp(this.end, 0.55);
        this.end.x += 1.1;
        this.end.z -= 0.8;
        p.channel(this.start, this.end, 12, 0.12, 0.4, 1);
      }
      this.secondary.upload(p);
    }
    this.secondary.update(age, mask ? 0.7 : 0, 1.1, 1.8, this.q.detail);
  }
  dispose(): void {
    this.main.dispose();
    this.precursors.dispose();
    this.secondary.dispose();
  }
}
