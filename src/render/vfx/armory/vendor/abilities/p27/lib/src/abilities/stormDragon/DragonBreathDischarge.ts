// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { Vector3, Group } from "three";
import { StormElectricArcs } from "./StormElectricArcs";
import type { StormDragon } from "./StormDragon";
export class DragonBreathDischarge {
  readonly arcs = new StormElectricArcs();
  private readonly a = new Vector3();
  private readonly b = new Vector3();
  private readonly c = new Vector3();
  update(
    t: number,
    charge: number,
    breath: number,
    mouth: Vector3,
    dragon: StormDragon,
    frame: Group,
    detail: number,
  ): void {
    this.arcs.begin(Math.floor(t * 31) * 977);
    if (charge > 0.05) {
      for (let i = 0; i < 4; i++) {
        this.a.copy(dragon.anchors[i]);
        frame.worldToLocal(this.a);
        this.arcs.arc(this.a, mouth, i < 2 ? 0.17 : 0.09, 28, 0.55);
      }
    }
    if (breath > 0.05) {
      for (let i = 0; i < 3 + detail * 3; i++) {
        const f = 0.15 + (i / (4 + detail * 3)) * 0.7;
        this.a.copy(mouth).multiplyScalar(1 - f);
        this.b.copy(mouth).multiplyScalar(1 - Math.min(1, f + 0.15));
        this.b.add(
          this.c.set(
            Math.cos(i * 2.4 + t * 3) * 2,
            Math.sin(i * 1.7 + t * 3) * 1.5,
            Math.sin(i * 2.4) * 2,
          ),
        );
        this.arcs.arc(this.a, this.b, 0.15, 16, 0.6);
      }
    }
    this.arcs.end(t, Math.max(charge, breath) * 0.7, detail);
  }
  dispose(): void {
    this.arcs.dispose();
  }
}
