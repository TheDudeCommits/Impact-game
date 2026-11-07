// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { IcosahedronGeometry } from 'three';
import { hash } from '../elemental/ElementalVisuals';
/** Coordinate-based displacement preserves coincident vertices and a closed jagged rock. */
export function earthGeometry(seed: number, detail = 1): IcosahedronGeometry {
  const g = new IcosahedronGeometry(1, detail), p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const rough = .77 + .27 * Math.sin(x * 7 + seed) * Math.cos(z * 9 - y * 5 + seed) + .17 * hash(Math.round((x + y * 2 + z * 3) * 1000) + seed);
    p.setXYZ(i, x * rough * (1 + seed % 3 * .12), y * rough * .92, z * rough);
  }
  g.computeVertexNormals(); return g;
}
