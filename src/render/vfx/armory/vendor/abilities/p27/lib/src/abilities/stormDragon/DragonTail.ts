// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { Group, Mesh, Vector3 } from "three";
import { loft, sweep } from "./DragonGeometry";
import type { DragonMaterials } from "./DragonMaterials";
export class DragonTail {
  readonly root = new Group();
  readonly joints: Group[] = [];
  constructor(m: DragonMaterials) {
    this.root.position.set(0, 0.3, -4.3);
    let parent = this.root;
    for (let i = 0; i < 12; i++) {
      const joint = new Group(),
        r = 1.05 * (1 - i / 12) ** 0.8;
      joint.position.z = i === 0 ? 0 : -1.35;
      joint.add(
        new Mesh(
          loft(
            [
              { x: 0, y: 0, z: 0.15, rx: r, ry: r },
              { x: 0, y: 0, z: -0.7, rx: r * 0.96, ry: r * 0.9 },
              {
                x: 0,
                y: 0,
                z: -1.4,
                rx: Math.max(0.04, r * 0.87),
                ry: Math.max(0.04, r * 0.81),
              },
            ],
            12,
          ),
          m.body,
        ),
      );
      if (i % 2 === 0)
        joint.add(
          new Mesh(
            sweep(
              [
                new Vector3(0, r * 0.85, -0.4),
                new Vector3(0, r + 1 - i * 0.05, -1.05),
                new Vector3(0, r * 0.7, -1.65),
              ],
              0.21,
              7,
              10,
            ),
            m.horn,
          ),
        );
      parent.add(joint);
      this.joints.push(joint);
      parent = joint;
    }
  }
  animate(t: number, bank: number, surge: number): void {
    for (let i = 0; i < this.joints.length; i++) {
      const j = this.joints[i];
      j.rotation.y =
        Math.sin(t * 1.3 - i * 0.32) * (0.055 + i * 0.005) +
        bank * 0.065 +
        surge * Math.sin(i * 0.3) * 0.055;
      j.rotation.x = Math.sin(t * 0.9 - i * 0.35) * 0.028;
    }
  }
}
