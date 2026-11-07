// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
/*!
 * rollshade-gl / noise — the shared tileable noise texture and GLSL helpers.
 *
 * Ported from rollshade (https://github.com/tsuyatt/rollshade) `src/runtime/noise.ts`
 * and the TSL helper nodes it uses, to plain WebGL GLSL for the Armory sandbox.
 *
 * MIT License — Copyright (c) 2026 tsuyatt. See rollshade's LICENSE.
 * GLSL port for the VFX Armory "extra" pack.
 */
import {
  DataTexture,
  RGBAFormat,
  UnsignedByteType,
  RepeatWrapping,
  LinearFilter,
  LinearMipmapLinearFilter,
  NoColorSpace
} from 'three';

const SIZE = 256;
export const NOISE_PERIOD = 4;

function lattice(seed) {
  return (x, y) => {
    let h = Math.imul(x * 374761393 + y * 668265263 + seed * 2246822519, 3266489917) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
    const a = ((h ^ (h >>> 16)) / 4294967296) * Math.PI * 2;
    return [Math.cos(a), Math.sin(a)];
  };
}

function periodicNoise(seed) {
  const grad = lattice(seed);
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  return (x, y, period) => {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    const wrap = (i) => ((i % period) + period) % period;
    const dot = (ix, iy, dx, dy) => {
      const g = grad(wrap(ix), wrap(iy));
      return g[0] * dx + g[1] * dy;
    };
    const n00 = dot(x0, y0, fx, fy);
    const n10 = dot(x0 + 1, y0, fx - 1, fy);
    const n01 = dot(x0, y0 + 1, fx, fy - 1);
    const n11 = dot(x0 + 1, y0 + 1, fx - 1, fy - 1);
    const u = fade(fx);
    const v = fade(fy);
    return (n00 + (n10 - n00) * u + (n01 - n00) * v + (n00 - n10 - n01 + n11) * u * v) * 1.4;
  };
}

function fbm(seed, octaves) {
  const noise = periodicNoise(seed);
  return (u, v) => {
    let sum = 0;
    let amp = 1;
    let period = NOISE_PERIOD;
    for (let o = 0; o < octaves; o++) {
      sum += noise(u * period, v * period, period) * amp;
      amp *= 0.5;
      period *= 2;
    }
    return sum * 0.5 + 0.5;
  };
}

let shared = null;

/** R,G: two fBm fields · B: emboss light · A: low-octave field. Repeats. */
export function noiseTexture() {
  if (shared) return shared;
  const a = fbm(11, 4);
  const b = fbm(29, 4);
  const c = fbm(47, 2);
  const data = new Uint8Array(SIZE * SIZE * 4);
  const R = new Float32Array(SIZE * SIZE);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) R[y * SIZE + x] = a(x / SIZE, y / SIZE);
  const dx = Math.round((0.12 / NOISE_PERIOD) * SIZE);
  const dy = Math.round((0.18 / NOISE_PERIOD) * SIZE);
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v * 255)));
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      const i = y * SIZE + x;
      const r = R[i];
      const shifted = R[((y + dy) % SIZE) * SIZE + ((x + dx) % SIZE)];
      const light = Math.max(0.25, Math.min(1.3, (r - shifted) * 3 + 0.65)) / 1.3;
      data[i * 4] = clamp(r);
      data[i * 4 + 1] = clamp(b(x / SIZE, y / SIZE));
      data[i * 4 + 2] = clamp(light);
      data[i * 4 + 3] = clamp(c(x / SIZE, y / SIZE));
    }
  const tex = new DataTexture(data, SIZE, SIZE, RGBAFormat, UnsignedByteType);
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.magFilter = LinearFilter;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.colorSpace = NoColorSpace;
  tex.needsUpdate = true;
  shared = tex;
  return tex;
}

/**
 * GLSL shared by every rollshade-gl material: the noise sampler, the seed
 * shift, three's TSL `hash()` (PCG) and a 3D gradient noise standing in for
 * MaterialX `mx_noise_float` (same role: smooth signed noise, ~[-1, 1]).
 */
export const RS_COMMON = /* glsl */ `
uniform sampler2D uNoise;
#define TAU 6.283185307179586
#define PI 3.141592653589793
// TSL's smoothstep is used with reversed edges all over rollshade; GLSL leaves
// that undefined, so every rollshade-gl shader goes through this explicit one.
float rsSS(float a, float b, float x) {
  if (abs(b - a) < 1e-6) return 0.0;
  float t = clamp((x - a) / (b - a), 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}
#define smoothstep rsSS
vec4 tnoise(vec2 uv) { return texture2D(uNoise, uv); }
vec2 seedShift(float s) { return vec2(s * 0.1373, s * 0.2917); }
float rsHash(float seed) {
  uint state = uint(max(seed, 0.0)) * 747796405u + 2891336453u;
  uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return float((word >> 22u) ^ word) * (1.0 / 4294967296.0);
}
vec3 rsHash3(vec3 p) {
  p = vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}
float rsNoise3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  return mix(mix(mix(dot(rsHash3(i), f), dot(rsHash3(i + vec3(1, 0, 0)), f - vec3(1, 0, 0)), u.x),
                 mix(dot(rsHash3(i + vec3(0, 1, 0)), f - vec3(0, 1, 0)), dot(rsHash3(i + vec3(1, 1, 0)), f - vec3(1, 1, 0)), u.x), u.y),
             mix(mix(dot(rsHash3(i + vec3(0, 0, 1)), f - vec3(0, 0, 1)), dot(rsHash3(i + vec3(1, 0, 1)), f - vec3(1, 0, 1)), u.x),
                 mix(dot(rsHash3(i + vec3(0, 1, 1)), f - vec3(0, 1, 1)), dot(rsHash3(i + vec3(1, 1, 1)), f - vec3(1, 1, 1)), u.x), u.y), u.z) * 1.6;
}
`;
