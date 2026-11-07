// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { Group, Mesh, Vector3 } from "three";
import { loft, sweep } from "./DragonGeometry";
import type { DragonMaterials } from "./DragonMaterials";
export class DragonLimbs {
  readonly root = new Group();
  readonly joints: Group[] = [];
  constructor(m: DragonMaterials) {
    for (const z of [1.3, -3])
      for (const side of [-1, 1]) {
        const leg = new Group();
        leg.position.set(side * (z > 0 ? 2 : 1.25), -0.3, z);
        leg.add(
          new Mesh(
            loft(
              [
                { x: 0, y: 0, z: 0.1, rx: 0.65, ry: 0.65 },
                { x: side * 0.2, y: -1.4, z: 0, rx: 0.6, ry: 0.55 },
                { x: side * 0.3, y: -2.4, z: -0.7, rx: 0.35, ry: 0.4 },
              ],
              12,
            ),
            m.body,
          ),
        );
        const lower = new Group();
        lower.position.set(side * 0.3, -2.35, -0.6);
        lower.add(
          new Mesh(
            loft(
              [
                { x: 0, y: 0, z: 0, rx: 0.38, ry: 0.35 },
                { x: 0, y: -1.2, z: 0.5, rx: 0.25, ry: 0.28 },
                { x: 0, y: -1.65, z: 1.1, rx: 0.55, ry: 0.22 },
                { x: 0, y: -1.65, z: 1.6, rx: 0.4, ry: 0.16 },
              ],
              12,
            ),
            m.body,
          ),
        );
        for (let k = 0; k < 3; k++)
          lower.add(
            new Mesh(
              sweep(
                [
                  new Vector3((k - 1) * 0.3, -1.6, 1.3),
                  new Vector3((k - 1) * 0.32, -1.9, 1.7),
                  new Vector3((k - 1) * 0.32, -2, 2),
                ],
                0.13,
                6,
                8,
              ),
              m.horn,
            ),
          );
        leg.add(lower);
        this.root.add(leg);
        this.joints.push(leg, lower);
      }
  }
  animate(t: number, charge: number): void {
    for (let i = 0; i < this.joints.length; i++) {
      this.joints[i].rotation.x =
        0.1 * Math.sin(t * 1.2 + i * 0.6) +
        (i % 2 ? charge * 0.25 : charge * -0.15);
      this.joints[i].rotation.z = 0.03 * Math.sin(t + i);
    }
  }
}
