// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { Vector3, Object3D } from "three";
import { StormElectricArcs } from "./StormElectricArcs";
import type { StormDragon } from "./StormDragon";
export class DragonLightning {
  readonly arcs = new StormElectricArcs();
  private readonly a = new Vector3();
  private readonly b = new Vector3();
  update(
    t: number,
    strength: number,
    charge: number,
    count: number,
    dragon: StormDragon,
    frame: Object3D,
  ): void {
    this.arcs.begin(Math.floor(t * 17) * 719);
    const anchors = dragon.anchors;
    for (let i = 0; i < count; i++) {
      if (Math.sin(t * 19 + i * 4.1) < 0.55) continue;
      this.a.copy(anchors[i % 6]);
      this.b.copy(anchors[(i + 1) % 6]);
      frame.worldToLocal(this.a);
      frame.worldToLocal(this.b);
      if (i >= 2 || charge < 0.1) {
        this.b.lerp(this.a, 0.87);
        this.b.y += Math.sin(i * 3.1) * 0.6;
      }
      this.arcs.arc(
        this.a,
        this.b,
        i < 2 ? 0.075 + charge * 0.08 : 0.04,
        14,
        0.22,
      );
    }
    this.arcs.end(t, strength * 0.45, charge > 0 ? 2 : 1);
  }
  dispose(): void {
    this.arcs.dispose();
  }
}
