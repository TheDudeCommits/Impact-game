// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { Group, Mesh, Vector3, InstancedMesh, Object3D } from "three";
import { bodyGeometry, loft, sweep } from "./DragonGeometry";
import { DragonMaterials, disposeMeshes } from "./DragonMaterials";
import { DragonHead } from "./DragonHead";
import { DragonWing } from "./DragonWings";
import { DragonTail } from "./DragonTail";
import { DragonLimbs } from "./DragonLimbs";
import { batchAnatomy } from "./DragonMeshBatch";
import { DragonNeck } from "./DragonNeck";
export class StormDragon {
  readonly neckDeformation: DragonNeck;
  readonly root = new Group();
  readonly materials = new DragonMaterials();
  readonly neck = new Group();
  readonly head = new DragonHead(this.materials);
  readonly wings = [
    new DragonWing(this.materials, -1),
    new DragonWing(this.materials, 1),
  ];
  readonly tail = new DragonTail(this.materials);
  readonly limbs = new DragonLimbs(this.materials);
  readonly scales: InstancedMesh;
  readonly mouthWorld = new Vector3();
  readonly anchors = [
    new Vector3(),
    new Vector3(),
    new Vector3(),
    new Vector3(),
    new Vector3(),
    new Vector3(),
  ];
  constructor() {
    const m = this.materials;
    this.root.name = "Storm Dragon / articulated manifestation";
    this.root.add(new Mesh(bodyGeometry(), m.body));
    this.neck.position.set(0, 0.7, 3);
    this.neck.add(
      new Mesh(
        loft(
          [
            { x: 0, y: 0, z: 0, rx: 1.3, ry: 1.5 },
            { x: 0, y: 1, z: 1.3, rx: 1.15, ry: 1.3 },
            { x: 0, y: 2, z: 2.6, rx: 0.95, ry: 1.2 },
            { x: 0, y: 2.8, z: 4.3, rx: 0.8, ry: 1.05 },
            { x: 0, y: 3, z: 5.7, rx: 0.8, ry: 0.85 },
            { x: 0, y: 2.8, z: 6.3, rx: 0.85, ry: 0.85 },
          ],
          24,
        ),
        m.body,
      ),
    );
    this.head.root.position.set(0, 2.8, 6.2);
    this.neck.add(this.head.root);
    this.root.add(
      this.neck,
      this.tail.root,
      this.limbs.root,
      ...this.wings.map((w) => w.shoulder),
    );
    this.neckDeformation = new DragonNeck(
      (this.neck.children[0] as Mesh).geometry,
      this.head.root,
    );
    for (let i = 0; i < 8; i++)
      this.root.add(
        new Mesh(
          sweep(
            [
              new Vector3(0, 2.8, -4 + i),
              new Vector3(0, 4.1, -4.4 + i),
              new Vector3(0, 3.2, -5 + i),
            ],
            0.23,
            8,
            10,
          ),
          m.horn,
        ),
      );
    this.scales = new InstancedMesh(
      sweep(
        [
          new Vector3(0, 0, 0),
          new Vector3(0, 0.35, -0.2),
          new Vector3(0, 0.1, -0.45),
        ],
        0.14,
        5,
        4,
      ),
      m.horn,
      360,
    );
    const dummy = new Object3D();
    for (let i = 0; i < 360; i++) {
      const row = Math.floor(i / 18),
        a = ((i % 18) / 18) * Math.PI * 2,
        z = -3.8 + row * 0.32,
        r = 1.7 + Math.sin(((z + 4) / 7) * Math.PI) * 0.85;
      dummy.position.set(Math.cos(a) * r, 0.65 + Math.sin(a) * (r + 0.1), z);
      dummy.rotation.set(a, 0, Math.PI * 0.5);
      dummy.updateMatrix();
      this.scales.setMatrixAt(i, dummy.matrix);
    }
    this.root.add(this.scales);
    batchAnatomy(this.root);
  }
  updateAnchors(): void {
    this.root.updateWorldMatrix(true, true);
    this.head.mouth.getWorldPosition(this.mouthWorld);
    this.head.root.localToWorld(this.anchors[0].set(-1.55, 2.9, -3.1));
    this.head.root.localToWorld(this.anchors[1].set(1.55, 2.9, -3.1));
    this.wings[0].wrist.localToWorld(
      this.anchors[2].copy(this.wings[0].tips[0]),
    );
    this.wings[1].wrist.localToWorld(
      this.anchors[3].copy(this.wings[1].tips[0]),
    );
    this.root.localToWorld(this.anchors[4].set(0, 3, 0));
    this.tail.joints[11].localToWorld(this.anchors[5].set(0, 0, -1));
  }
  dispose(): void {
    this.root.removeFromParent();
    disposeMeshes(this.root);
    this.scales.dispose();
    this.materials.dispose();
    this.root.clear();
  }
}
