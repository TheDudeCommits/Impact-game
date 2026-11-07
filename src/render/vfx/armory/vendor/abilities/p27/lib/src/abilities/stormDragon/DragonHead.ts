// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { Group, Mesh, Vector3, SphereGeometry } from "three";
import { loft, sweep } from "./DragonGeometry";
import type { DragonMaterials } from "./DragonMaterials";
export class DragonHead {
  readonly root = new Group();
  readonly jaw = new Group();
  readonly mouth = new Group();
  readonly horns: Mesh[] = [];
  constructor(m: DragonMaterials) {
    const skull = new Mesh(
      loft(
        [
          { x: 0, y: 0.2, z: -1, rx: 0.35, ry: 0.5 },
          { x: 0, y: 0.4, z: 0, rx: 1.45, ry: 1.1 },
          { x: 0, y: 0.35, z: 1.25, rx: 1.25, ry: 0.85 },
          { x: 0, y: 0.1, z: 2.8, rx: 0.7, ry: 0.48 },
          { x: 0, y: 0.05, z: 3.6, rx: 0.55, ry: 0.32 },
          { x: 0, y: 0.05, z: 3.7, rx: 0.03, ry: 0.03 },
        ],
        12,
      ),
      m.body,
    );
    this.root.add(skull);
    this.jaw.position.set(0, -0.5, 0);
    this.jaw.add(
      new Mesh(
        loft(
          [
            { x: 0, y: 0, z: 0, rx: 1.05, ry: 0.28 },
            { x: 0, y: 0, z: 1.7, rx: 0.8, ry: 0.22 },
            { x: 0, y: 0.1, z: 3.4, rx: 0.5, ry: 0.18 },
            { x: 0, y: 0.1, z: 3.5, rx: 0.02, ry: 0.02 },
          ],
          10,
        ),
        m.horn,
      ),
    );
    this.root.add(this.jaw);
    this.mouth.position.set(0, -0.12, 2.8);
    const throat = new Mesh(new SphereGeometry(0.58, 16, 12), m.mouth);
    throat.scale.set(0.9, 0.7, 1.4);
    this.mouth.add(throat);
    this.root.add(this.mouth);
    for (const side of [-1, 1]) {
      const horn = new Mesh(
        sweep(
          [
            new Vector3(side * 0.95, 0.9, 0.1),
            new Vector3(side * 1.4, 2.1, -0.7),
            new Vector3(side * 1.7, 2.75, -2.2),
            new Vector3(side * 1.55, 2.9, -3.1),
          ],
          0.43,
          10,
        ),
        m.horn,
      );
      this.horns.push(horn);
      this.root.add(horn);
      const eye = new Mesh(new SphereGeometry(0.18, 12, 8), m.eye);
      eye.position.set(side * 1.25, 0.5, 1.05);
      eye.scale.set(0.5, 0.65, 1.5);
      this.root.add(eye);
      this.root.add(
        new Mesh(
          sweep(
            [
              new Vector3(side * 1.3, 0.8, 0.8),
              new Vector3(side * 1.38, 0.9, 1.45),
              new Vector3(side * 0.8, 0.45, 2.4),
            ],
            0.25,
            8,
            12,
          ),
          m.horn,
        ),
      );
      for (let j = 0; j < 3; j++)
        this.root.add(
          new Mesh(
            sweep(
              [
                new Vector3(side * 1.1, 0.3, -j * 0.35),
                new Vector3(side * 1.7, 0.6, -1 - j * 0.6),
              ],
              0.23,
              7,
              8,
            ),
            m.horn,
          ),
        );
      for (let j = 0; j < 6; j++) {
        const tooth = new Mesh(
          sweep(
            [
              new Vector3(side * (0.85 - j * 0.05), -0.1, 1 + j * 0.35),
              new Vector3(side * (0.84 - j * 0.05), -0.45, 1 + j * 0.35),
            ],
            0.095,
            6,
            4,
          ),
          m.horn,
        );
        this.root.add(tooth);
      }
    }
  }
}
