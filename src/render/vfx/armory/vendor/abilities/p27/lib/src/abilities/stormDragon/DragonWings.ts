// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  Vector3,
} from "three";
import { sweep } from "./DragonGeometry";
import type { DragonMaterials } from "./DragonMaterials";
export class DragonWing {
  readonly shoulder = new Group();
  readonly elbow = new Group();
  readonly wrist = new Group();
  readonly tips: Vector3[] = [];
  constructor(m: DragonMaterials, side: number) {
    this.shoulder.position.set(side * 2, 2, 1);
    this.shoulder.scale.x = side;
    this.elbow.position.set(4, 0.8, 0.3);
    this.wrist.position.set(3.5, 0.4, 1);
    this.shoulder.add(
      new Mesh(
        sweep(
          [new Vector3(), new Vector3(2, 0.4, 0.1), new Vector3(4, 0.8, 0.3)],
          0.52,
          12,
          16,
        ),
        m.body,
      ),
      this.elbow,
    );
    this.elbow.add(
      new Mesh(
        sweep(
          [new Vector3(), new Vector3(2, 0.3, 0.65), new Vector3(3.5, 0.4, 1)],
          0.32,
          10,
          16,
        ),
        m.horn,
      ),
      this.wrist,
    );
    const ends = [
      new Vector3(8, 0.1, 3),
      new Vector3(7.4, -0.2, -0.4),
      new Vector3(5.8, -0.6, -4),
      new Vector3(3.8, -1, -6.7),
      new Vector3(0.5, -1.7, -7.8),
    ];
    for (const tip of ends) {
      this.tips.push(tip);
      this.wrist.add(
        new Mesh(
          sweep(
            [
              new Vector3(),
              new Vector3(tip.x * 0.5, tip.y + 0.5, tip.z * 0.4),
              tip,
            ],
            0.17,
            8,
            14,
          ),
          m.horn,
        ),
      );
    }
    const p: number[] = [],
      uv: number[] = [],
      indices: number[] = [];
    // Dense curved membrane sectors, inset scalloped trailing edges and raised finger ridges.
    for (let sector = 0; sector < ends.length - 1; sector++) {
      const start = p.length / 3,
        a = ends[sector],
        b = ends[sector + 1],
        N = 14,
        R = 10;
      for (let r = 0; r <= R; r++)
        for (let j = 0; j <= N; j++) {
          const f = j / N,
            k = r / R,
            inset = 1 - 0.16 * Math.sin(f * Math.PI) * k * k;
          p.push(
            (a.x * (1 - f) + b.x * f) * k * inset,
            (a.y * (1 - f) + b.y * f) * k -
              0.7 * Math.sin(f * Math.PI) * Math.sin(k * Math.PI),
            (a.z * (1 - f) + b.z * f) * k * inset,
          );
          uv.push((sector + f) / 4, k);
        }
      for (let r = 0; r < R; r++)
        for (let j = 0; j < N; j++) {
          const a0 = start + r * (N + 1) + j,
            b0 = a0 + N + 1;
          indices.push(a0, b0, a0 + 1, a0 + 1, b0, b0 + 1);
        }
    }
    // Inner web continues from the wrist to the shoulder and flank, so the wing is a full sail.
    const inner = [
      new Vector3(-7.5, -1.2, -1.3),
      new Vector3(-3.5, -0.4, -1),
      new Vector3(0, 0, 0),
      new Vector3(0.5, -1.7, -7.8),
      new Vector3(-3.5, -2, -6.2),
      new Vector3(-7.5, -2.4, -5),
    ];
    const center = new Vector3(-3.5, -1.1, -3.5);
    for (let sector = 0; sector < inner.length; sector++) {
      const base = p.length / 3,
        a = inner[sector],
        b = inner[(sector + 1) % inner.length],
        R = 8,
        N = 8;
      for (let r = 0; r <= R; r++)
        for (let j = 0; j <= N; j++) {
          const f = j / N,
            k = r / R;
          p.push(
            center.x + (a.x * (1 - f) + b.x * f - center.x) * k,
            center.y +
              (a.y * (1 - f) + b.y * f - center.y) * k -
              0.3 * Math.sin(k * Math.PI),
            center.z + (a.z * (1 - f) + b.z * f - center.z) * k,
          );
          uv.push(f * 0.2 + sector * 0.12, k);
        }
      for (let r = 0; r < R; r++)
        for (let j = 0; j < N; j++) {
          const a0 = base + r * (N + 1) + j,
            b0 = a0 + N + 1;
          indices.push(a0, b0, a0 + 1, a0 + 1, b0, b0 + 1);
        }
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(p, 3));
    g.setAttribute("uv", new Float32BufferAttribute(uv, 2));
    g.setIndex(indices);
    g.computeVertexNormals();
    g.computeBoundingSphere();
    this.wrist.add(new Mesh(g, m.wing));
  }
  animate(
    t: number,
    extension: number,
    stable: number,
    bank: number,
    side: number,
  ): void {
    // Fast power stroke, brief lower hold, slower recovery; distinct elbow and tip lag.
    const phase = ((t - 4.125) * Math.PI * 2) / 1.15,
      stroke = Math.tanh(Math.sin(phase) * 2),
      lag = Math.tanh(Math.sin(phase - 0.5) * 1.7);
    this.shoulder.rotation.z =
      side * (0.02 + (1 - extension) * 1.05 + stroke * 0.15 * (1 - stable)) +
      bank * 0.25;
    this.elbow.rotation.z = lag * 0.18 * (1 - stable) + (1 - extension) * 0.5;
    this.elbow.rotation.y = 0.08 * Math.sin(phase - 0.25) * (1 - stable);
    this.wrist.rotation.z = Math.sin(phase - 0.8) * 0.12 * (1 - stable);
    this.wrist.rotation.y =
      0.09 * Math.sin(phase - 1.1) * (1 - stable) + (1 - extension) * 0.35;
  }
}
