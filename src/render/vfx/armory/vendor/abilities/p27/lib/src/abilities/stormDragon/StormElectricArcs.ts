// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { Vector3 } from "three";
import { LightningPath } from "../lightning/LightningPath";
import { LightningRenderer } from "../lightning/LightningRenderer";
/** Existing bounded thick lightning renderer, with connected branches and attached anatomical endpoints. */
export class StormElectricArcs {
  readonly path = new LightningPath(2400);
  readonly renderer = new LightningRenderer(2400);
  private readonly a = new Vector3();
  private readonly b = new Vector3();
  private readonly fork = new Vector3();
  begin(seed: number): void {
    this.path.clear(seed);
  }
  arc(a: Vector3, b: Vector3, width: number, segments = 18, jag = 0.7): void {
    const first = this.path.count;
    this.path.channel(a, b, segments, width, jag, 0);
    if (this.path.count > first + 8) {
      this.a.fromArray(this.path.data, (first + 7) * 10 + 3);
      this.b.copy(this.a).add(this.fork.set(1.5, -1.1, 0.8));
      this.path.channel(this.a, this.b, 6, width * 0.4, jag * 0.45, 1);
    }
  }
  end(t: number, opacity: number, detail: number): void {
    this.renderer.upload(this.path);
    this.renderer.update(t, opacity, 1.1, 1, detail);
  }
  dispose(): void {
    this.renderer.dispose();
  }
}
