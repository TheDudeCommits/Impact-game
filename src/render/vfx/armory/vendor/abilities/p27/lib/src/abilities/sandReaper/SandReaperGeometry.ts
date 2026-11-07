// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { BufferGeometry, Float32BufferAttribute, Vector3 } from 'three';
import type { SandReaperConfig } from './SandReaperConfig';

export const sandHash = (n: number): number => { const x = Math.sin(n * 127.1 + 31.7) * 43758.5453; return x - Math.floor(x); };
/** Original closed sweep: six-sided blade section, knife edges, thick spine, single apex at each end. */
export function createSandReaperGeometry(c: Readonly<SandReaperConfig>, segments: number): BufferGeometry {
  const rings: Vector3[][] = [], values: number[] = [], fractions: number[] = [];
  const radius = c.bladeLength / (2 * Math.sin(c.crescentCurvature));
  const center = (t: number) => new Vector3(radius * (Math.cos((t * 2 - 1) * c.crescentCurvature) - .22), radius * Math.sin((t * 2 - 1) * c.crescentCurvature), 0);
  const section = [[.5, 0], [.16, .5], [-.3, .36], [-.5, 0], [-.3, -.36], [.16, -.5]];
  for (let i = 1; i < segments; i++) {
    const t = i / segments, angle = (t * 2 - 1) * c.crescentCurvature, p = center(t);
    const taper = Math.pow(Math.sin(Math.PI * t), .72), ring: Vector3[] = [];
    for (let j = 0; j < section.length; j++) {
      const grain = (sandHash(i * 13 + j * 3.17) - .5) * c.facetRoughness;
      const radial = section[j][0] * c.bladeWidth * taper * (1 + grain);
      const z = section[j][1] * c.bladeThickness * taper * (1 + grain * 2);
      ring.push(new Vector3(p.x + Math.cos(angle) * radial, p.y + Math.sin(angle) * radial, z));
    }
    rings.push(ring);
  }
  // Outward winding is derived from the ring's CCW cross-section and the increasing arc tangent.
  const tri = (a: Vector3, b: Vector3, d: Vector3, ta: number, tb: number, td: number) => {
    values.push(a.x, a.y, a.z, d.x, d.y, d.z, b.x, b.y, b.z); fractions.push(ta, td, tb);
  };
  for (let i = 0; i < rings.length - 1; i++) for (let j = 0; j < 6; j++) {
    const n = (j + 1) % 6, a = rings[i][j], b = rings[i][n], d = rings[i + 1][j], e = rings[i + 1][n];
    const t = (i + 1) / segments, next = (i + 2) / segments;
    // Alternate diagonals create broad facets without changing the watertight surface.
    if ((i + j) % 2) { tri(a, b, d, t, t, next); tri(b, e, d, t, next, next); }
    else { tri(a, b, e, t, t, next); tri(a, e, d, t, next, next); }
  }
  const first = center(0), last = center(1);
  for (let j = 0; j < 6; j++) { const n = (j + 1) % 6; tri(first, rings[0][n], rings[0][j], 0, 1 / segments, 1 / segments); tri(last, rings.at(-1)![j], rings.at(-1)![n], 1, (segments - 1) / segments, (segments - 1) / segments); }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(values, 3));
  geometry.setAttribute('aAlong', new Float32BufferAttribute(fractions, 1));
  geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return geometry;
}

/** Four original closed angular shard solids; no rounded primitive or runtime tessellation. */
export function createSandFragmentGeometry(variant: number): BufferGeometry {
  const shapes = [
    [[-.12, -.6, -.09], [.15, -.5, -.1], [.12, .5, -.07], [-.07, .8, .01], [-.08, -.35, .14], [.15, .28, .09]],
    [[-.5, -.3, -.22], [.55, -.3, -.18], [.3, .3, -.12], [-.35, .6, .04], [-.3, -.1, .26], [.2, .15, .3]],
    [[-.24, -.5, -.16], [.36, -.32, -.2], [.07, .85, -.05], [-.17, .42, .08], [-.3, -.16, .22], [.24, .25, .2]],
    [[-.5, -.4, -.12], [.34, -.4, -.1], [.6, .4, -.04], [-.2, .6, .06], [-.14, -.2, .2], [.44, .18, .14]],
  ];
  const vertices = shapes[variant % 4].map(p => new Vector3(...p as [number, number, number]));
  const faces = [[0, 1, 2], [0, 2, 3], [0, 4, 5], [0, 5, 1], [1, 5, 2], [2, 5, 3], [3, 5, 4], [3, 4, 0]];
  const centroid = vertices.reduce((a, b) => a.add(b), new Vector3()).multiplyScalar(1 / vertices.length);
  const values: number[] = [], ab = new Vector3(), ac = new Vector3(), outward = new Vector3();
  for (const [i, j, k] of faces) {
    const a = vertices[i], b = vertices[j], c = vertices[k];
    const normal = ab.subVectors(b, a).cross(ac.subVectors(c, a));
    outward.copy(a).add(b).add(c).multiplyScalar(1 / 3).sub(centroid);
    const face = normal.dot(outward) >= 0 ? [a, b, c] : [a, c, b];
    for (const p of face) values.push(p.x, p.y, p.z);
  }
  const g = new BufferGeometry(); g.setAttribute('position', new Float32BufferAttribute(values, 3));
  g.setAttribute('aAlong', new Float32BufferAttribute(new Float32Array(values.length / 3).fill(.5), 1));
  g.computeVertexNormals(); g.computeBoundingBox(); g.computeBoundingSphere(); return g;
}
