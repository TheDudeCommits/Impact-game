// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { Group, PointLight, Vector3 } from "three";
export class StormLighting {
  readonly lights = [
    new PointLight("#8f70ff", 0, 100, 2),
    new PointLight("#7bccff", 0, 110, 2),
    new PointLight("#8771ff", 0, 100, 2),
  ];
  update(
    root: Group,
    count: number,
    t: number,
    strength: number,
    flash: number,
    mouth: Vector3,
    player: Vector3,
  ): void {
    for (let i = 0; i < 3; i++) {
      const l = this.lights[i];
      if (i < count && t < 17) {
        if (!l.parent) root.add(l);
        l.position.copy(i === 0 ? player : i === 1 ? mouth : ZERO);
        if (i === 0) l.position.y += 2;
        if (i === 2) l.position.y = 4;
        l.intensity =
          i === 0
            ? 4 * strength + flash * 40
            : i === 1
              ? strength * 45 + flash * 140
              : flash * 250;
      } else l.removeFromParent();
    }
  }
  reset(): void {
    for (const l of this.lights) {
      l.removeFromParent();
      l.intensity = 0;
    }
  }
  dispose(): void {
    this.reset();
    for (const l of this.lights) l.dispose();
  }
}
const ZERO = new Vector3();
