// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import {
  BufferGeometry,
  Float32BufferAttribute,
  Vector3,
  CatmullRomCurve3,
} from "three";
export interface Section {
  z: number;
  y: number;
  x: number;
  rx: number;
  ry: number;
}
/** Continuous elliptical loft, capped with tapered end sections. All parts share the same anatomical construction. */
export function loft(sections: readonly Section[], sides = 20): BufferGeometry {
  const p: number[] = [],
    uv: number[] = [],
    idx: number[] = [];
  for (let j = 0; j < sections.length; j++) {
    const s = sections[j];
    for (let i = 0; i <= sides; i++) {
      const a = (i / sides) * Math.PI * 2;
      p.push(s.x + Math.cos(a) * s.rx, s.y + Math.sin(a) * s.ry, s.z);
      uv.push(i / sides, j / (sections.length - 1));
    }
  }
  for (let j = 0; j < sections.length - 1; j++)
    for (let i = 0; i < sides; i++) {
      const a = j * (sides + 1) + i,
        b = a + sides + 1;
      idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(p, 3));
  g.setAttribute("uv", new Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}
/** Swept curved horn/bone mesh; not a straight cone. */
export function sweep(
  points: Vector3[],
  radius: number,
  sides = 8,
  segments = 24,
): BufferGeometry {
  const curve = new CatmullRomCurve3(points),
    frames = curve.computeFrenetFrames(segments, false),
    p: number[] = [],
    uv: number[] = [],
    idx: number[] = [];
  for (let j = 0; j <= segments; j++) {
    const c = curve.getPoint(j / segments),
      r = Math.max(0.005, radius * (1 - j / segments) ** 0.75);
    for (let i = 0; i <= sides; i++) {
      const a = (i / sides) * Math.PI * 2,
        n = frames.normals[j],
        b = frames.binormals[j];
      p.push(
        c.x + r * (Math.cos(a) * n.x + Math.sin(a) * b.x),
        c.y + r * (Math.cos(a) * n.y + Math.sin(a) * b.y),
        c.z + r * (Math.cos(a) * n.z + Math.sin(a) * b.z),
      );
      uv.push(i / sides, j / segments);
    }
  }
  for (let j = 0; j < segments; j++)
    for (let i = 0; i < sides; i++) {
      const a = j * (sides + 1) + i,
        b = a + sides + 1;
      idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(p, 3));
  g.setAttribute("uv", new Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}
export function bodyGeometry(): BufferGeometry {
  return loft(
    [
      { x: 0, y: 0.1, z: -5, rx: 0.04, ry: 0.04 },
      { x: 0, y: 0.2, z: -4, rx: 1.1, ry: 1.5 },
      { x: 0, y: 0.4, z: -2.8, rx: 1.6, ry: 1.7 },
      { x: 0, y: 0.65, z: -1.3, rx: 2.35, ry: 2.35 },
      { x: 0, y: 0.8, z: 0, rx: 2.8, ry: 2.8 },
      { x: 0, y: 0.9, z: 1.5, rx: 2.5, ry: 2.7 },
      { x: 0, y: 0.9, z: 2.7, rx: 1.7, ry: 2 },
      { x: 0, y: 0.7, z: 3.5, rx: 1.25, ry: 1.4 },
    ],
    32,
  );
}
