// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { Vector3 } from "three";
import { StormElectricArcs } from "./StormElectricArcs";
import { envelope } from "./StormDragonConfig";
export class ThunderfallSequence {
  readonly arcs = new StormElectricArcs();
  private readonly a = new Vector3();
  private readonly b = new Vector3();
  update(t: number, count: number, storm: number): void {
    this.arcs.begin(Math.floor(t * 24) * 431);
    for (let i = 0; i < count; i++) {
      const strike = 10.65 + (i / count) * 2.25,
        age = t - strike;
      if (age >= 0 && age < 0.3) {
        const angle = i * 2.3999,
          r = 5 + (i % 5) * 3.6;
        this.a.set(Math.cos(angle) * r + 3, 32, Math.sin(angle) * r);
        this.b.set(Math.cos(angle) * r, 0.08, Math.sin(angle) * r);
        this.arcs.arc(this.a, this.b, 0.7 * (1 - age / 0.3), 28, 1.4);
      }
    }
    const cloudFlash = Math.sin(t * 11.3) * Math.sin(t * 23.8);
    if (cloudFlash > 0.6 && t < 14) {
      this.a.set(-19, 28, -15);
      this.b.set(16, 33, -10);
      this.arcs.arc(this.a, this.b, 0.4, 32, 2.4);
    }
    if (t > 9.2) {
      for (let i = 0; i < 6; i++) {
        if (Math.sin(t * (t < 14 ? 20 : 5) + i * 3) < 0.65) continue;
        this.a.set(0, 0.08, 0);
        const a = i * 2.399 + t * 0.05;
        this.b.set(Math.cos(a) * (8 + i * 2), 0.09, Math.sin(a) * (8 + i * 2));
        this.arcs.arc(this.a, this.b, 0.16, 24, 1.1);
      }
    }
    this.arcs.end(t, storm * envelope(1.5, 2, 17, 18, t), 2);
  }
  dispose(): void {
    this.arcs.dispose();
  }
}
