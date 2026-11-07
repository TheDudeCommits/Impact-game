// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import {
  BufferGeometry,
  BufferAttribute,
  Object3D,
  DynamicDrawUsage,
} from "three";
/** Continuous bend of the original loft, with a matching skull attachment. The torso end stays fixed. */
export class DragonNeck {
  private readonly rest: Float32Array;
  private readonly positions: BufferAttribute;
  constructor(
    readonly geometry: BufferGeometry,
    private readonly head: Object3D,
  ) {
    this.positions = geometry.getAttribute("position") as BufferAttribute;
    this.positions.setUsage(DynamicDrawUsage);
    this.rest = new Float32Array(this.positions.array);
  }
  bend(angle: number): void {
    for (let i = 0; i < this.positions.count; i++) {
      const k = i * 3,
        x = this.rest[k],
        y = this.rest[k + 1],
        z = this.rest[k + 2],
        a = angle * Math.max(0, Math.min(1, z / 6.3)) * 0.65,
        c = Math.cos(a),
        s = Math.sin(a);
      this.positions.setXYZ(i, x, y * c - z * s, y * s + z * c);
    }
    this.positions.needsUpdate = true;
    this.geometry.computeVertexNormals();
    const a = angle * 0.65,
      c = Math.cos(a),
      s = Math.sin(a);
    this.head.position.set(0, 2.8 * c - 6.2 * s, 2.8 * s + 6.2 * c);
    this.head.rotation.x = angle;
  }
}
