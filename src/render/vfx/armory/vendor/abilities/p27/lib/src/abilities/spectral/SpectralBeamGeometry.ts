// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { BufferGeometry, Float32BufferAttribute } from 'three';
/** Parameter grid: u runs down the beam; v wraps around its complete 3D cross section. */
export function spectralSurface(axial = 144, radial = 48): BufferGeometry {
  const p: number[] = [], uv: number[] = [], indices: number[] = [];
  for (let i = 0; i <= axial; i++) for (let j = 0; j <= radial; j++) { p.push(0, 0, 0); uv.push(i / axial, j / radial); }
  for (let i = 0; i < axial; i++) for (let j = 0; j < radial; j++) { const a = i * (radial + 1) + j, b = a + radial + 1; indices.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new BufferGeometry(); g.setAttribute('position', new Float32BufferAttribute(p, 3)); g.setAttribute('uv', new Float32BufferAttribute(uv, 2)); g.setIndex(indices); return g;
}
export function spectralStrip(segments = 64): BufferGeometry {
  const p: number[] = [], uv: number[] = [], indices: number[] = [];
  for (let i = 0; i <= segments; i++) for (let j = 0; j < 2; j++) { p.push(0, 0, 0); uv.push(i / segments, j); }
  for (let i = 0; i < segments; i++) { const a = i * 2; indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const g = new BufferGeometry(); g.setAttribute('position', new Float32BufferAttribute(p, 3)); g.setAttribute('uv', new Float32BufferAttribute(uv, 2)); g.setIndex(indices); return g;
}
