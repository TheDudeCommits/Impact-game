import { BufferGeometry, Float32BufferAttribute, MeshBasicMaterial, type Sphere } from 'three';
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';

/** The fist's surface, worked out once a page (taimatsuGeometry). */
let built: { position: Float32Array; normal: Float32Array; sphere: Sphere } | undefined;

/** One continuous volume: palm, folded fingers, thumb and tapered wrist. It is the same shape every time, and it was worked out
 *  every time it was asked for: twice at every start (CombatEffects and GummyEffects build theirs as the page loads), 89 ms of a
 *  desktop's 477 ms of script before PLAY could be pressed (a phone's four times that). Now once, on the first ask, with
 *  Math.sqrt for Math.hypot (the same 26,928 floats, compared one by one); each caller still gets a geometry of its own, over
 *  copies of the arrays, to dispose of as it likes. (The performance sweep, 24 October 2026.) */
export function taimatsuGeometry() {
  built ??= build();
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(built.position.slice(), 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(built.normal.slice(), 3));
  geometry.boundingSphere = built.sphere.clone();
  return geometry;
}

function build() {
  const material = new MeshBasicMaterial();
  const surface = new MarchingCubes(48, material, false, false, 16000);
  surface.isolation = 0;
  const lobes = [
    [0, -.1, -.2, .68, .47, .78],
    ...Array.from({ length: 4 }, (_, i) => [(i - 1.5) * .32, .18, .43, .20, .31, .39]),
    [.59, -.20, .02, .25, .25, .52],
    [0, -.10, -1.03, .40, .35, .73],
  ];
  const size = 48, extent = 2.2, count = lobes.length;
  // Each lobe's term along each axis, (p - c) / s, is the same number for every cell of a row: worked out once a row here
  // instead of in every cell (774,144 divisions, and as many destructurings of a lobe), the field is the same float for
  // float - the same operations on the same numbers - and the boot's build of it went from ~75 ms to ~12 ms on the M4
  // (round 2 of the performance sweep; tests/taimatsuGeometry.test.ts holds it to the first build, float for float).
  const ax = new Float64Array(count * size), ay = new Float64Array(count * size), az = new Float64Array(count * size), least = new Float64Array(count);
  for (let l = 0; l < count; l++) {
    const [cx, cy, cz, sx, sy, sz] = lobes[l];
    least[l] = Math.min(sx, sy, sz);
    for (let i = 0; i < size; i++) { const p = (i / size * 2 - 1) * extent; ax[l * size + i] = (p - cx) / sx; ay[l * size + i] = (p - cy) / sy; az[l * size + i] = (p - cz) / sz; }
  }
  for (let z = 0; z < size; z++) for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let distance = 10;
    for (let l = 0; l < count; l++) {
      const tx = ax[l * size + x], ty = ay[l * size + y], tz = az[l * size + z];
      const d = (Math.sqrt(tx * tx + ty * ty + tz * tz) - 1) * least[l];
      const blend = Math.max(.08 - Math.abs(distance - d), 0) / .08;
      distance = Math.min(distance, d) - blend * blend * .08 * .25;
    }
    surface.field[x + y * size + z * size * size] = -distance;
  }
  surface.update();
  const geometry = new BufferGeometry();
  for (const name of ['position', 'normal']) {
    const attribute = surface.geometry.getAttribute(name);
    geometry.setAttribute(name, new Float32BufferAttribute(attribute.array.slice(0, surface.count * 3), 3));
  }
  geometry.scale(extent, extent, extent);
  geometry.computeBoundingSphere();
  surface.geometry.dispose(); material.dispose();
  return { position: geometry.getAttribute('position').array as Float32Array, normal: geometry.getAttribute('normal').array as Float32Array, sphere: geometry.boundingSphere! };
}
