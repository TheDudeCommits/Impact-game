// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { BufferGeometry, BufferAttribute, Mesh, DynamicDrawUsage } from "three";
import { createLightningMaterial } from "./LightningMaterials";
import type { LightningPath } from "./LightningPath";

/** World-space thick camera-facing segments: one draw contains white core, channel and halo. */
export class LightningRenderer {
  readonly material = createLightningMaterial();
  readonly mesh: Mesh;
  readonly geometry = new BufferGeometry();
  private readonly starts: Float32Array;
  private readonly ends: Float32Array;
  private readonly width: Float32Array;
  private readonly reveal: Float32Array;
  private readonly phase: Float32Array;
  private readonly group: Float32Array;
  segmentCount = 0;
  private readonly dynamicAttributes: BufferAttribute[] = [];
  constructor(readonly capacity: number) {
    const vertices = capacity * 6;
    this.starts = new Float32Array(vertices * 3);
    this.ends = new Float32Array(vertices * 3);
    this.width = new Float32Array(vertices);
    this.reveal = new Float32Array(vertices);
    this.phase = new Float32Array(vertices);
    this.group = new Float32Array(vertices);
    const uv = new Float32Array(vertices * 2),
      pattern = [0, 0, 1, 0, 0, 1, 1, 0, 1, 1, 0, 1];
    for (let i = 0; i < capacity; i++) uv.set(pattern, i * 12);
    this.geometry.setAttribute(
      "position",
      new BufferAttribute(new Float32Array(vertices * 3), 3),
    );
    this.geometry.setAttribute("uv", new BufferAttribute(uv, 2));
    for (const [name, array, size] of [
      ["aStart", this.starts, 3],
      ["aEnd", this.ends, 3],
      ["aWidth", this.width, 1],
      ["aReveal", this.reveal, 1],
      ["aPhase", this.phase, 1],
      ["aGroup", this.group, 1],
    ] as const) {
      const attribute = new BufferAttribute(array, size).setUsage(
        DynamicDrawUsage,
      );
      this.dynamicAttributes.push(attribute);
      this.geometry.setAttribute(name, attribute);
    }
    this.mesh = new Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
  }
  upload(path: LightningPath): void {
    this.segmentCount = Math.min(path.count, this.capacity);
    const d = path.data;
    for (let i = 0; i < this.segmentCount; i++) {
      const k = i * 10;
      for (let v = 0; v < 6; v++) {
        const j = i * 6 + v;
        this.starts[j * 3] = d[k];
        this.starts[j * 3 + 1] = d[k + 1];
        this.starts[j * 3 + 2] = d[k + 2];
        this.ends[j * 3] = d[k + 3];
        this.ends[j * 3 + 1] = d[k + 4];
        this.ends[j * 3 + 2] = d[k + 5];
        this.width[j] = d[k + 6];
        this.reveal[j] = d[k + 7];
        this.phase[j] = d[k + 8];
        this.group[j] = d[k + 9];
      }
    }
    if (this.segmentCount > 0)
      for (const attribute of this.dynamicAttributes) {
        attribute.clearUpdateRanges();
        attribute.addUpdateRange(0, this.segmentCount * 6 * attribute.itemSize);
        attribute.needsUpdate = true;
      }
    this.geometry.setDrawRange(0, this.segmentCount * 6);
  }
  update(
    time: number,
    opacity: number,
    reveal = 1.1,
    pulse = 1,
    detail = 1,
  ): void {
    const u = this.material.uniforms;
    u.uViewportHeight.value =
      typeof window === "undefined" ? 720 : window.innerHeight;
    u.uTime.value = time;
    u.uOpacity.value = opacity;
    u.uReveal.value = reveal;
    u.uPulse.value = pulse;
    u.uDetail.value = detail;
    this.mesh.visible = opacity > 0.0001 && this.segmentCount > 0;
  }
  dispose(): void {
    this.mesh.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
  }
}
