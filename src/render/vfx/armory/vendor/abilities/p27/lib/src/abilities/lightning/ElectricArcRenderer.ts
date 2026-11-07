// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { LightningRenderer } from "./LightningRenderer";
import { LightningPath } from "./LightningPath";

/** Small-arc API shared by hand feedback, conduction veins and residual node connections. */
export class ElectricArcRenderer extends LightningRenderer {
  readonly path: LightningPath;
  constructor(capacity: number) {
    super(capacity);
    this.path = new LightningPath(capacity);
  }
  commit(): void {
    this.upload(this.path);
  }
}
