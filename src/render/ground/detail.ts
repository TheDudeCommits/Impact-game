import * as THREE from 'three';

/** How many metres one repeat of the detail texture spans. */
export const DETAIL_TILE = 12;

let shared: THREE.DataTexture | undefined;

/** Smooth value noise on a lattice `period` cells a side that wraps, at (u, v) in 0..1. */
function tileNoise(lattice: Float32Array, period: number, u: number, v: number) {
  const x = u * period, y = v * period, i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const at = (a: number, b: number) => lattice[((b % period + period) % period) * period + ((a % period + period) % period)];
  const a = at(i, j), b = at(i + 1, j), c = at(i, j + 1), d = at(i + 1, j + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/**
 * The ground sheet's small-scale detail as one tiling texture, read once a
 * pixel instead of working out value noise there (the sheet runs under the
 * whole field, so its pixels were the ground's dearest): four smooth noises
 * that wrap every DETAIL_TILE metres, at about 0.38 m (R), 0.19 m (G), 0.75 m
 * (B) and 1.5 m (A). Made once and shared by every place.
 */
export function detailTexture() {
  if (shared) return shared;
  const size = 256, data = new Uint8Array(size * size * 4);
  const periods = [32, 64, 16, 8];
  let seed = 7;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const lattices = periods.map(p => Float32Array.from({ length: p * p }, random));
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = (x + .5) / size, v = (y + .5) / size, k = (y * size + x) * 4;
    for (let c = 0; c < 4; c++) data[k + c] = Math.round(tileNoise(lattices[c], periods[c], u, v) * 255);
  }
  shared = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
  shared.wrapS = shared.wrapT = THREE.RepeatWrapping;
  shared.magFilter = THREE.LinearFilter; shared.minFilter = THREE.LinearMipmapLinearFilter; shared.generateMipmaps = true;
  shared.name = 'ground detail';
  shared.needsUpdate = true;
  return shared;
}
