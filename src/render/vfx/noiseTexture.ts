import * as THREE from 'three';

/** Tileable value noise at four scales, one per channel, built once.
 *
 *  The effect shaders used to evaluate 3D simplex noise for every pixel of
 *  every dust puff, ring, beam and scorch mark. A puff two metres across near
 *  the camera is a third of the screen, and a dozen of them overlapping made
 *  the fill cost of one heavy blow worth more than the fighters. A filtered
 *  texture lookup is a fraction of that, and the look - soft cel breakup - is
 *  the same. R is 4 cells across the tile, G 8, B 16 and A 32.
 */
let shared: THREE.DataTexture | undefined;
export function noiseTexture() {
  if (shared) return shared;
  const size = 128, data = new Uint8Array(size * size * 4);
  const hash = (x: number, y: number, s: number) => { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
  const smooth = (t: number) => t * t * (3 - 2 * t);
  [4, 8, 16, 32].forEach((cells, channel) => {
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const fx = x / size * cells, fy = y / size * cells, ix = Math.floor(fx), iy = Math.floor(fy), tx = smooth(fx - ix), ty = smooth(fy - iy);
      const a = hash(ix % cells, iy % cells, channel), b = hash((ix + 1) % cells, iy % cells, channel), c = hash(ix % cells, (iy + 1) % cells, channel), d = hash((ix + 1) % cells, (iy + 1) % cells, channel);
      data[(y * size + x) * 4 + channel] = Math.round(((a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty) * 255);
    }
  });
  shared = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  shared.wrapS = shared.wrapT = THREE.RepeatWrapping; shared.magFilter = shared.minFilter = THREE.LinearFilter;
  shared.generateMipmaps = false; shared.colorSpace = THREE.NoColorSpace; shared.needsUpdate = true;
  return shared;
}

/** The sampler, for shaders that include it: `uniform sampler2D uNoise;`. */
export const NOISE_GLSL = /* glsl */`
uniform sampler2D uNoise;
vec4 tnoise(vec2 p){ return texture2D(uNoise, p); }
float hash1(float n){ return fract(sin(n) * 43758.5453123); }
`;
