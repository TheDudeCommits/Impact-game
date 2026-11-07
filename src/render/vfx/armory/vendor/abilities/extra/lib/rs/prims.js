// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
/*!
 * rollshade-gl / prims — every drawable primitive a move is built from.
 *
 * Ported from rollshade's `src/runtime/prims.ts`, `shapes.ts` and `shaders.ts`
 * (https://github.com/tsuyatt/rollshade). The batched quad primitives (ring,
 * decal, crescent, magic circle, sphere, band, speed lines, hit marks) keep
 * rollshade's one-InstancedMesh-per-type design; their TSL node materials are
 * rewritten as GLSL that reads the per-instance fields from interleaved
 * instance attributes. The one-off meshes (blade arc, ribbon, bolt, beam, void
 * sphere, lathe) are ShaderMaterials with plain uniforms.
 *
 * Two primitives are additions for this sandbox, standing in for rollshade's
 * post pass: `wave` writes a refraction ring into the sandbox's distortion
 * buffer (LAYER.DISTORTION), and `invert` is the black-and-white impact frame.
 *
 * MIT License — Copyright (c) 2026 tsuyatt. GLSL port for the VFX Armory "extra" pack.
 */
import {
  AdditiveBlending,
  NormalBlending,
  CustomBlending,
  OneMinusDstColorFactor,
  ZeroFactor,
  AddEquation,
  BufferAttribute,
  BufferGeometry,
  CylinderGeometry,
  DoubleSide,
  FrontSide,
  DynamicDrawUsage,
  InstancedInterleavedBuffer,
  InterleavedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Mesh,
  Object3D,
  PlaneGeometry,
  ShaderMaterial,
  SphereGeometry,
  Color,
  Vector3
} from 'three';
import { noiseTexture, RS_COMMON } from './noise.js';
import { LAYER } from '../../../../core/Layers.js';

export const RIBBON_LENGTH = 20;
const TAU = Math.PI * 2;

/* ------------------------------------------------------------------ */
/* Batched quads                                                       */
/* ------------------------------------------------------------------ */

const quad = () => new PlaneGeometry(2, 2);

const BASIC_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}
`;

const SPHERE_VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vNormalV;
varying vec3 vViewPos;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  vViewPos = mv.xyz;
  vNormalV = normalize(normalMatrix * (mat3(instanceMatrix) * normal));
  gl_Position = projectionMatrix * mv;
}
`;

/* ---- the magic circle (shaders.ts → patternCircle) ---- */
const CIRCLE_GLSL = /* glsl */ `
float oneMinus(float x) { return 1.0 - x; }
float wrapA(float a) { return a - floor(a / TAU) * TAU; }
float circleLine(float x, float center, float width) {
  return oneMinus(smoothstep(width * 0.5, width * 0.5 + 0.006, abs(x - center)));
}
float circleRunes(float angle, float r, float inner, float outer, float count, float seed) {
  float u = angle / TAU * count;
  float cell = floor(u);
  float x = (fract(u) - 0.5) * 2.0;
  float y = (r - (inner + outer) / 2.0) / ((outer - inner) / 2.0);
  float h = rsHash(cell + seed * 131.0 + 7.0) * 64.0;
  #define RBIT(k) step(0.5, fract(h / pow(2.0, float(k))))
  float w = 0.16;
  float stem = oneMinus(smoothstep(w, w + 0.08, abs(x - (RBIT(0) - 0.5) * 0.6)));
  float bar = oneMinus(smoothstep(w, w + 0.08, abs(y - (RBIT(1) - 0.5) * 0.8))) * RBIT(2);
  float slant = oneMinus(smoothstep(w, w + 0.08, abs(x - y * (RBIT(3) * 2.0 - 1.0) * 0.7))) * RBIT(4);
  float blob = oneMinus(smoothstep(0.18, 0.28, length(vec2(x - (RBIT(5) - 0.5) * 0.9, y + 0.45)))) * (RBIT(1) * RBIT(4));
  float inside = step(abs(x), 0.62) * step(abs(y), 0.8);
  return max(max(stem, bar), max(slant, blob)) * inside;
}
float segDist(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a; vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-5), 0.0, 1.0);
  return length(pa - ba * h);
}
float starPolygon(vec2 c, float turn, float sides, float skip, float radius, float width) {
  float best = 9.0;
  float st = TAU / max(sides, 1.0);
  for (int i = 0; i < 9; i++) {
    float fi = float(i);
    float a0 = turn + st * fi;
    float a1 = turn + st * (skip + fi);
    float d = segDist(c, vec2(cos(a0), sin(a0)) * radius, vec2(cos(a1), sin(a1)) * radius);
    best = min(best, d + step(sides - 0.5, fi) * 9.0);
  }
  return oneMinus(smoothstep(width * 0.5, width * 0.5 + 0.006, best)) * step(0.5, sides);
}
float patternCircle(vec2 uv, float turn, float reveal, float mode) {
  vec2 c = uv * 2.0 - 1.0;
  float r = length(c);
  float base = atan(c.y, c.x);
  float outer = base + turn;
  float inner = base - turn * 2.0;
  float lines = circleLine(r, 0.955, 0.03) + circleLine(r, 0.86, 0.012) + circleLine(r, 0.835, 0.008);
  float runeOuter = step(0.5, fract(U_runes / 2.0));
  float runeInner = step(1.5, U_runes);
  lines += circleRunes(wrapA(outer), r, 0.865, 0.95, 40.0, 3.0) * 0.9 * runeOuter;
  float tickAt = wrapA(outer) / TAU * 120.0;
  float tickLong = step(fract(floor(tickAt) / 5.0), 0.1);
  float ticks = oneMinus(smoothstep(0.1, 0.22, abs(fract(tickAt) - 0.5))) * step(r, 0.83) * step(mix(0.795, 0.765, tickLong), r);
  lines += ticks * 0.8 * U_ticks;
  float star = 0.64;
  lines += circleLine(r, star, 0.014);
  float insideS = step(r, star + 0.01);
  lines += starPolygon(c, -turn * 2.0 + PI / 2.0, U_sidesA, U_skipA, star, 0.014) * insideS;
  lines += starPolygon(c, -turn * 2.0 + U_rotB + PI / 2.0, U_sidesB, U_skipB, star, 0.012) * insideS;
  float sp = max(U_spokes, 1.0);
  float cell = fract(outer / TAU * sp + 0.5) - 0.5;
  float arc = abs(cell) * TAU / sp * r;
  float spokeBand = step(0.36, r) * step(r, 0.62);
  lines += oneMinus(smoothstep(0.006, 0.012, arc)) * spokeBand * step(0.5, U_spokes);
  #define BAR(rb, len) (oneMinus(smoothstep(0.005, 0.011, abs(r - rb))) * step(arc, len))
  lines += (BAR(0.47, 0.05) + BAR(0.55, 0.035)) * step(0.5, U_spokes) * U_branch;
  float sa = max(U_spiral, 1.0);
  float spiralCell = fract((inner - log(r + 0.02) * 2.4) / TAU * sa) - 0.5;
  float spiralLine = oneMinus(smoothstep(0.02, 0.045, abs(spiralCell))) * step(0.13, r) * step(r, 0.62);
  lines += spiralLine * step(0.5, U_spiral) * 0.9;
  float wv = max(U_waves, 1.0);
  #define WAVE(rad, amp) circleLine(r - sin(outer * wv) * amp, rad, 0.01)
  lines += (WAVE(0.74, 0.025) + WAVE(0.45, 0.02)) * step(0.5, U_waves);
  float dn = max(U_dots, 1.0);
  float da = floor(inner / TAU * dn + 0.5) * TAU / dn;
  vec2 dp = vec2(cos(da - (inner - base)), sin(da - (inner - base))) * star;
  float dd = length(c - dp);
  lines += (circleLine(dd, 0.06, 0.012) + oneMinus(smoothstep(0.02, 0.028, dd)) * 0.8) * step(0.5, U_dots);
  float pet = r - mix(0.2, 0.52, abs(cos(inner * max(U_petals, 1.0) * 0.5)));
  lines += oneMinus(smoothstep(0.006, 0.013, abs(pet))) * step(r, 0.53) * step(0.5, U_petals);
  lines += circleLine(r, 0.34, 0.012) + circleRunes(wrapA(inner), r, 0.25, 0.33, 18.0, 8.0) * 0.8 * runeInner + circleLine(r, 0.24, 0.008);
  lines += circleLine(r, 0.12, 0.012) + circleLine(r, 0.06, 0.01);
  float glow = pow(max(oneMinus(r), 0.0), 3.0) * 0.25 + oneMinus(smoothstep(0.9, 1.0, r)) * 0.06;
  float shape = clamp(lines, 0.0, 1.0) * step(r, 1.0) + glow;
  float at = wrapA(base + PI / 2.0) / TAU;
  float angular = step(at, reveal * 1.02);
  float angularPen = oneMinus(smoothstep(0.0, 0.05, abs(at - reveal))) * step(reveal, 0.999) * step(r, 0.97) * step(0.82, r) * 1.5;
  float front = reveal * 1.1;
  float radialOut = step(r, front);
  float radialOutPen = oneMinus(smoothstep(0.0, 0.03, abs(r - front))) * step(reveal, 0.999) * 1.4;
  float radialIn = step(1.0 - front, r);
  float radialInPen = oneMinus(smoothstep(0.0, 0.03, abs(r - (1.0 - front)))) * step(reveal, 0.999) * 1.4;
  float m0 = step(mode, 0.5);
  float m1 = step(0.5, mode) * step(mode, 1.5);
  float m2 = step(1.5, mode);
  return shape * (angular * m0 + radialOut * m1 + radialIn * m2) + angularPen * m0 + radialOutPen * m1 + radialInPen * m2;
}
`;

const BATCH_SPECS = () => ({
  ring: {
    layout: [['k', 1], ['thick', 1, 0.08], ['core', 3], ['main', 3], ['bright', 1, 1], ['seed', 1]],
    geometry: quad(),
    cap: 96,
    frag: `vec2 q = vUv * 2.0 - 1.0; float d = length(q);
      float r = 1.0 - pow(1.0 - U_k, 3.0);
      float w = U_thick * (1.0 - U_k * 0.6);
      float x = (d - r) / w;
      float band = exp(-x * x) + exp(x * x * -0.08) * 0.12 * smoothstep(r, r * 0.3, d);
      float ang = atan(q.y, q.x);
      float n = tnoise(vec2(ang / TAU * 4.0, d * 0.75) + seedShift(U_seed)).r;
      float fade = pow(1.0 - U_k, 1.5);
      float b = band * (n * 0.9 + 0.45) * fade * smoothstep(1.0, 0.96, d);
      gl_FragColor = vec4(mix(U_main, U_core, clamp(b * b * 0.8, 0.0, 1.0)) * b * U_bright * uBright, 1.0);`
  },
  decal: {
    layout: [['k', 1], ['heat', 1, 1], ['ember', 3], ['tint', 3], ['seed', 1], ['glow', 1, 1], ['crackScale', 1, 4.5], ['crackWidth', 1, 0.08], ['alpha', 1, 0.9], ['core', 1, 0.6]],
    geometry: quad(),
    cap: 32,
    renderOrder: 2,
    blending: 'normal',
    polygonOffset: true,
    frag: `vec2 q = vUv * 2.0 - 1.0; float d = length(q);
      vec4 tn = tnoise(q * 0.55 + seedShift(U_seed));
      float n = tn.r * 2.0 - 1.0;
      float mask = smoothstep(1.0, 0.35, d + n * 0.35);
      float erode = tnoise(q * 0.775 + seedShift(U_seed + 7.0)).g;
      float alive = smoothstep(U_k * 1.6 - 0.35, U_k * 1.6 - 0.2, erode);
      float crack = smoothstep(U_crackWidth, 0.0, abs(tnoise(q * (U_crackScale * 0.25) + seedShift(U_seed + 3.0)).a * 2.0 - 1.0)) * smoothstep(0.95, 0.1, d);
      float hot = crack * U_heat + smoothstep(0.55, 0.0, d) * U_heat * U_heat * U_core;
      vec3 col = mix(U_tint, U_ember * U_glow, clamp(hot, 0.0, 1.0)) + U_ember * hot * U_glow;
      gl_FragColor = vec4(col * mix(1.0, uBright, clamp(hot, 0.0, 1.0)), mask * alive * U_alpha);`
  },
  crescent: {
    layout: [['k', 1], ['core', 3], ['main', 3], ['bright', 1, 1], ['bend', 1, 0.35]],
    geometry: quad(),
    cap: 32,
    renderOrder: 25,
    depthTest: false,
    frag: `vec2 q = vUv * 2.0 - 1.0;
      float x2 = q.x * q.x;
      float yc = U_bend * (1.0 - x2) - U_bend * 0.5;
      float th = 0.1 * pow(clamp(1.0 - x2, 0.0, 1.0), 1.3) + 0.004;
      float y = (q.y - yc) / th;
      float line = exp(-y * y);
      float halo = exp(y * y * -0.06) * 0.18 * clamp(1.0 - x2, 0.0, 1.0);
      float fade = smoothstep(1.0, 0.55, U_k);
      gl_FragColor = vec4(mix(U_main, U_core, line) * (line * 1.4 + halo) * fade * U_bright * uBright, 1.0);`
  },
  circle: {
    layout: [
      ['turn', 1], ['reveal', 1, 1], ['fade', 1, 1], ['core', 3], ['main', 3], ['accent', 3], ['bright', 1, 1], ['mode', 1],
      ['sidesA', 1, 6], ['skipA', 1, 1], ['sidesB', 1], ['skipB', 1, 1], ['rotB', 1], ['spokes', 1], ['branch', 1], ['spiral', 1],
      ['waves', 1], ['dots', 1], ['petals', 1], ['runes', 1, 3], ['ticks', 1, 1]
    ],
    geometry: quad(),
    cap: 16,
    extra: CIRCLE_GLSL,
    frag: `float shape = patternCircle(vUv, U_turn, U_reveal, U_mode);
      vec2 q = vUv * 2.0 - 1.0;
      vec3 col = mix(U_accent, U_main, clamp(shape, 0.0, 1.0)) * shape + U_core * smoothstep(0.6, 1.4, shape);
      gl_FragColor = vec4(col * U_fade * U_bright * uBright * smoothstep(1.0, 0.98, length(q)), 1.0);`
  },
  sphere: {
    layout: [['k', 1], ['core', 3], ['main', 3], ['accent', 3], ['bright', 1, 1], ['seed', 1]],
    geometry: new SphereGeometry(1, 40, 24),
    cap: 16,
    vert: SPHERE_VERT,
    side: FrontSide,
    varyings: 'varying vec3 vNormalV; varying vec3 vViewPos;',
    frag: `float fres = max(1.0 - abs(dot(normalize(vNormalV), normalize(-vViewPos))), 0.0);
      float n = tnoise(vec2(vUv.x * 2.0, vUv.y * 0.75 + U_k * 0.5) + seedShift(U_seed)).r;
      float inner = pow(1.0 - fres, 1.5);
      float dens = inner * (n * 0.8 + 0.5) + pow(fres, 3.0) * 0.3;
      float fade = pow(1.0 - U_k, 2.0);
      vec3 col = mix(mix(U_accent, U_main, clamp(dens * 1.4, 0.0, 1.0)), U_core, smoothstep(0.6, 1.1, dens) * (1.0 - U_k));
      gl_FragColor = vec4(col * dens * fade * U_bright * uBright, 1.0);`
  },
  band: {
    layout: [['k', 1], ['a0', 1], ['span', 1, TAU], ['inner', 1, 0.6], ['fadeS', 1, 0.2], ['fadeE', 1, 0.2], ['hard', 1], ['noise', 1, 1], ['cIn', 3], ['cMid', 3], ['cOut', 3], ['bright', 1, 1], ['seed', 1]],
    geometry: quad(),
    cap: 48,
    frag: `vec2 q = vUv * 2.0 - 1.0; float d = length(q);
      float ang = atan(q.y, q.x) / TAU;
      float spanN = clamp(U_span / TAU, 0.001, 1.0);
      float t = fract(ang - U_a0 / TAU);
      float tt = t / spanN;
      float within = step(tt, 1.0);
      float angFade = spanN > 0.999 ? 1.0 : smoothstep(0.0, max(U_fadeS, 0.001), tt) * smoothstep(1.0, 1.0 - max(U_fadeE, 0.001), tt) * within;
      float n = tnoise(vec2(ang * 5.0, d + U_k * 0.5) + seedShift(U_seed)).r;
      float x = (d - U_inner) / max(1.0 - U_inner, 0.001) + (n - 0.5) * 0.35 * U_noise * U_hard;
      float soft = mix(0.45, 0.03, U_hard);
      float radial = smoothstep(0.0, soft, x) * smoothstep(1.0, 1.0 - soft, x);
      float xs = mix(x, floor(x * 3.0) / 2.0, U_hard);
      vec3 col = xs < 0.5 ? mix(U_cIn, U_cMid, clamp(xs * 2.0, 0.0, 1.0)) : mix(U_cMid, U_cOut, clamp(xs * 2.0 - 1.0, 0.0, 1.0));
      float streak = mix(1.0, n * 1.1 + 0.3, U_noise * (1.0 - U_hard));
      float fade = pow(1.0 - U_k, mix(1.5, 0.6, U_hard));
      float hardCut = mix(1.0, step(0.35, radial * fade * angFade), U_hard);
      gl_FragColor = vec4(col * radial * streak * angFade * fade * hardCut * U_bright * uBright * smoothstep(1.0, 0.98, d), 1.0);`
  },
  lines: {
    layout: [['k', 1], ['count', 1, 48], ['inner', 1, 0.35], ['width', 1, 0.18], ['density', 1, 0.7], ['mode', 1], ['reach', 1, 1], ['core', 3], ['main', 3], ['bright', 1, 1], ['seed', 1]],
    geometry: quad(),
    cap: 16,
    renderOrder: 26,
    depthTest: false,
    frag: `vec2 q = vUv * 2.0 - 1.0; float d = length(q);
      float ang = atan(q.y, q.x) / TAU + 0.5;
      bool radialMode = U_mode < 0.5;
      float coord = radialMode ? ang * U_count : (q.y * 0.5 + 0.5) * U_count;
      float ci = floor(coord);
      float f = fract(coord);
      float h1 = rsHash(ci + U_seed);
      float h2 = rsHash(ci * 1.71 + U_seed + 3.1);
      float h3 = rsHash(ci * 2.37 + U_seed + 7.7);
      float present = step(h3, U_density);
      float start = mix(U_inner, 0.92, h1 * h1);
      float startK = start + (1.0 - start) * U_k;
      float wR = U_width * (h2 * 0.8 + 0.4) * smoothstep(startK, 1.0, d);
      float offset = (h2 - 0.5) * 0.5;
      float dxR = abs(f - 0.5 - offset);
      float reachR = mix(start, 1.0, U_reach);
      float insideR = step(startK, d) * step(d, reachR);
      float lineR = (1.0 - smoothstep(wR * 0.7, wR, dxR)) * insideR * smoothstep(1.0, 0.93, d);
      float len = h2 * 0.8 + 0.35;
      float x0 = h1 * 2.6 - 1.3 - U_k * 1.2 * (h3 + 0.6);
      float along = abs(q.x - x0) / (len * 0.5);
      float taper = clamp(1.0 - along, 0.0, 1.0);
      float wP = U_width * 0.9 * taper * (h2 * 0.8 + 0.4);
      float lineP = (1.0 - smoothstep(wP * 0.6, wP, abs(f - 0.5))) * step(along, 1.0) * smoothstep(1.0, 0.8, abs(q.x));
      float line = (radialMode ? lineR : lineP) * present;
      float fade = smoothstep(1.0, 0.8, U_k);
      vec3 col = mix(U_main, U_core, radialMode ? smoothstep(start, 1.0, d) : taper);
      gl_FragColor = vec4(col * line * fade * U_bright * uBright, 1.0);`
  },
  hitmark: {
    layout: [['k', 1], ['spikes', 1, 12], ['inner', 1, 0.35], ['sharp', 1, 1], ['hard', 1, 1], ['core', 3], ['main', 3], ['accent', 3], ['bright', 1, 1], ['seed', 1], ['alpha', 1, 1], ['boost', 1], ['hole', 1]],
    geometry: quad(),
    cap: 24,
    renderOrder: 27,
    depthTest: false,
    blending: 'normal',
    frag: `vec2 q = vUv * 2.0 - 1.0; float d = length(q);
      float ang = atan(q.y, q.x) / TAU + 0.5 + U_seed * 0.013;
      float cf = ang * U_spikes;
      float ci = floor(cf);
      float f = fract(cf);
      float dirA = ((ci + 0.5) / U_spikes - 0.5 - U_seed * 0.013) * TAU;
      float len = mix(0.45, 1.0, rsHash(ci + U_seed)) * (1.0 + U_boost * pow(abs(cos(dirA)), 6.0));
      float tri = 1.0 - abs(f * 2.0 - 1.0);
      float R = U_inner * len + len * (1.0 - U_inner) * pow(tri, U_sharp);
      float shape = d / max(R, 0.001);
      float hole = U_hole;
      float aa = max(fwidth(shape) * 1.5, 0.004);
      float inside = smoothstep(1.0, 1.0 - aa, shape) * smoothstep(hole, hole + aa, shape);
      float soft = 1.0 - U_hard;
      float zCore = mix(step(shape, 0.52), smoothstep(0.7, 0.35, shape), soft);
      float zMid = mix(step(shape, 0.8), smoothstep(0.95, 0.6, shape), soft);
      vec3 col = mix(U_accent, mix(U_main, U_core, zCore), zMid);
      float fade = step(U_k, 0.999);
      gl_FragColor = vec4(col * U_bright * uBright, inside * fade * U_alpha);`
  }
});

const ZERO = new Matrix4().makeScale(0, 0, 0);
const tmpM = new Matrix4();

class Batch {
  constructor(type, spec, shared) {
    this.type = type;
    this.spec = spec;
    this.slots = [];
    this.order = [];
    this.free = [];
    this.offsets = [];
    let at = 0;
    for (const [name, size, def] of spec.layout) {
      this.offsets.push({ name, size, at, def: def ?? 0 });
      at += size;
    }
    const vecs = Math.ceil(at / 4);
    this.stride = vecs * 4;
    this.buffer = new InstancedInterleavedBuffer(new Float32Array(spec.cap * this.stride), this.stride);
    this.buffer.setUsage(DynamicDrawUsage);
    const geometry = spec.geometry;
    let attrDecl = '';
    let varyDecl = '';
    let varyAssign = '';
    for (let i = 0; i < vecs; i++) {
      geometry.setAttribute(`i${i}`, new InterleavedBufferAttribute(this.buffer, 4, i * 4));
      attrDecl += `attribute vec4 i${i};\n`;
      varyDecl += `varying vec4 v${i};\n`;
      varyAssign += `v${i} = i${i};\n`;
    }
    const comp = (i) => `v${Math.floor(i / 4)}.${'xyzw'[i % 4]}`;
    let defines = '';
    for (const o of this.offsets) {
      defines +=
        o.size === 1
          ? `#define U_${o.name} ${comp(o.at)}\n`
          : `#define U_${o.name} vec3(${comp(o.at)}, ${comp(o.at + 1)}, ${comp(o.at + 2)})\n`;
    }
    const vertBase = spec.vert ?? BASIC_VERT;
    const vertexShader = `${attrDecl}${varyDecl}\n${vertBase.replace('void main() {', `void main() {\n${varyAssign}`)}`;
    const fragmentShader = `${RS_COMMON}\nuniform float uBright;\n${varyDecl}varying vec2 vUv;\n${spec.varyings ?? ''}\n${defines}${spec.extra ?? ''}\nvoid main() {\n${spec.frag}\n}\n`;
    const normal = spec.blending === 'normal';
    const material = new ShaderMaterial({
      uniforms: { uNoise: { value: noiseTexture() }, uBright: shared.uBright },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: spec.depthTest !== false,
      blending: normal ? NormalBlending : AdditiveBlending,
      side: spec.side ?? DoubleSide,
      fog: false
    });
    if (spec.polygonOffset) {
      material.polygonOffset = true;
      material.polygonOffsetFactor = -2;
      material.polygonOffsetUnits = -2;
    }
    this.mesh = new InstancedMesh(geometry, material, spec.cap);
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.renderOrder = spec.renderOrder ?? 23;
    this.mesh.layers.set(LAYER.VFX);
  }

  acquire() {
    let i = this.free.pop();
    if (i === undefined) {
      if (this.slots.length < this.spec.cap) i = this.slots.length;
      else {
        this.release(this.order[0]);
        i = this.free.pop();
      }
    }
    const u = {};
    for (const o of this.offsets) u[o.name] = { value: o.size === 1 ? o.def : new Color(o.def, o.def, o.def) };
    const prim = { mesh: new Object3D(), u };
    prim.mesh.userData.type = this.type;
    prim.mesh.userData.slot = i;
    this.slots[i] = prim;
    this.order.push(prim);
    return prim;
  }

  release(prim) {
    if (!prim) return;
    const i = prim.mesh.userData.slot;
    if (this.slots[i] !== prim) return;
    this.slots[i] = null;
    this.free.push(i);
    const k = this.order.indexOf(prim);
    if (k >= 0) this.order.splice(k, 1);
  }

  sync() {
    let hi = 0;
    const arr = this.buffer.array;
    for (let i = 0; i < this.slots.length; i++) {
      const prim = this.slots[i];
      if (!prim) {
        this.mesh.setMatrixAt(i, ZERO);
        continue;
      }
      hi = i + 1;
      const m = prim.mesh;
      m.updateMatrix();
      this.mesh.setMatrixAt(i, tmpM.copy(m.matrix));
      const base = i * this.stride;
      for (const o of this.offsets) {
        const v = prim.u[o.name].value;
        if (o.size === 1) arr[base + o.at] = v;
        else {
          arr[base + o.at] = v.r;
          arr[base + o.at + 1] = v.g;
          arr[base + o.at + 2] = v.b;
        }
      }
    }
    this.mesh.count = hi;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.buffer.needsUpdate = true;
  }

  get live() {
    return this.order.length;
  }

  clear() {
    for (const p of [...this.order]) this.release(p);
    this.sync();
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}

/* ------------------------------------------------------------------ */
/* One-off meshes                                                      */
/* ------------------------------------------------------------------ */

const STRIP_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

const VIEW_VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vNormalV;
varying vec3 vViewPos;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vViewPos = mv.xyz;
  vNormalV = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * mv;
}
`;

function makeMaterial(uniforms, vert, frag, shared, opts = {}) {
  const u = {};
  for (const [k, v] of Object.entries(uniforms)) u[k] = { value: v };
  u.uNoise = { value: noiseTexture() };
  u.uBright = shared.uBright;
  const decl = Object.entries(uniforms)
    .map(([k, v]) => `uniform ${v instanceof Color ? 'vec3' : 'float'} u_${k};`)
    .join('\n');
  const mat = new ShaderMaterial({
    uniforms: Object.fromEntries(Object.entries(u).map(([k, v]) => [k in uniforms ? `u_${k}` : k, v])),
    vertexShader: `${decl}\n${vert}`,
    fragmentShader: `${RS_COMMON}\nuniform float uBright;\n${decl}\nvarying vec2 vUv;\n${opts.varyings ?? ''}\n${frag}`,
    transparent: true,
    depthWrite: false,
    blending: opts.normal ? NormalBlending : AdditiveBlending,
    side: opts.side ?? DoubleSide,
    fog: false
  });
  const view = {};
  for (const k of Object.keys(uniforms)) view[k] = mat.uniforms[`u_${k}`];
  return { mat, u: view };
}

function boltLike(shared, kind) {
  if (kind === 'arc') {
    const { mat, u } = makeMaterial(
      { head: 0, lag: 0.35, fade: 1, core: new Color(), main: new Color(), accent: new Color(), bright: 1, seed: 0, time: 0 },
      STRIP_VERT,
      `void main() {
        float s = vUv.x; float v = vUv.y;
        float rel = (u_head - s) / u_lag;
        float inside = smoothstep(-0.02, 0.01, rel) * smoothstep(1.0, 0.75, rel);
        float trail = pow(clamp(1.0 - rel, 0.0, 1.0), 1.6);
        float n = tnoise(vec2(s * 2.25 - u_time * 0.5, v * 0.625) + seedShift(u_seed)).r;
        float edgeX = (v - 0.93) / 0.035;
        float edge = exp(-edgeX * edgeX);
        float body = pow(smoothstep(0.05, 0.92, v), 2.2) * smoothstep(1.0, 0.95, v);
        float streak = smoothstep(0.35, 0.8, n) * body;
        float dissolve = smoothstep(rel - 0.25, rel + 0.05, n + 0.25);
        float glow = (body * 0.7 + streak * 1.1) * dissolve;
        vec3 col = mix(u_accent, u_main, clamp(glow * 1.5, 0.0, 1.0)) * glow + mix(u_main, u_core, trail) * edge * 1.6 * (trail + 0.2);
        gl_FragColor = vec4(col * inside * (trail * 0.8 + 0.2) * u_fade * u_bright * uBright, 1.0);
      }`,
      shared
    );
    const mesh = new Mesh(new BufferGeometry(), mat);
    return { mesh, u };
  }
  if (kind === 'ribbon') {
    const { mat, u } = makeMaterial(
      { core: new Color(), main: new Color(), accent: new Color(), bright: 1, time: 0, seed: 0, fade: 1 },
      STRIP_VERT,
      `void main() {
        float s = vUv.x; float v = vUv.y * 2.0 - 1.0;
        float n = tnoise(vec2(s * 1.5 - u_time * 1.25, v * 0.375) + seedShift(u_seed)).r;
        float w = 1.0 - s * 0.6;
        float prof = exp(-(v * v) / (w * w * 0.25));
        float core = exp(-(v * v) / (w * w * 0.02)) * pow(1.0 - s, 2.0);
        float along = pow(1.0 - s, 1.4) * (smoothstep(0.0, 0.04, s) * 0.5 + 0.5);
        float dens = prof * (n * 1.2 + 0.2) * along;
        vec3 col = (mix(u_accent, u_main, clamp(dens * 2.0, 0.0, 1.0)) * dens + u_core * core * 1.2) * u_bright * u_fade;
        gl_FragColor = vec4(col * uBright, 1.0);
      }`,
      shared
    );
    return { mesh: new Mesh(new BufferGeometry(), mat), u };
  }
  // bolt
  const { mat, u } = makeMaterial(
    { core: new Color(), main: new Color(), bright: 1, fade: 1 },
    STRIP_VERT,
    `void main() {
      float v = vUv.y * 2.0 - 1.0;
      float along = vUv.x;
      float core = exp(-(v * v) / 0.012);
      float glow = exp(v * v * -3.5) * 0.35;
      float taper = smoothstep(0.0, 0.04, along) * (smoothstep(1.0, 0.9, along) * 0.6 + 0.4);
      gl_FragColor = vec4(mix(u_main, u_core, core) * (core * 2.2 + glow) * taper * u_bright * u_fade * uBright, 1.0);
    }`,
    shared
  );
  return { mesh: new Mesh(new BufferGeometry(), mat), u };
}

const beamGeo = new CylinderGeometry(1, 1, 1, 32, 1, true).translate(0, 0.5, 0);
const sphereGeo = new SphereGeometry(1, 40, 24);

function beamPrim(shared) {
  const { mat, u } = makeMaterial(
    { time: 0, len: 1, core: new Color(), main: new Color(), accent: new Color(), bright: 1, fade: 1, flow: 6, inner: 0 },
    VIEW_VERT,
    `void main() {
      float y = vUv.y;
      float edge = max(1.0 - abs(dot(normalize(vNormalV), normalize(-vViewPos))), 0.0);
      float center = 1.0 - edge;
      float n = tnoise(vec2(vUv.x * 2.0, (y * u_len * 1.4 - u_time * u_flow) * 0.25)).r;
      float n2 = tnoise(vec2(vUv.x * 4.0, (y * u_len * 3.0 - u_time * u_flow * 1.7) * 0.25) + 0.37).a;
      float ends = smoothstep(0.0, 0.04, y) * smoothstep(1.0, 0.9, y);
      float dens = pow(center, 1.4) * (n * 0.9 + n2 * 0.5 + 0.1) + pow(edge, 4.0) * 0.15;
      float hot = mix(smoothstep(0.55, 1.1, dens), pow(center, 6.0), u_inner);
      vec3 col = mix(mix(u_accent, u_main, clamp(dens * 1.6, 0.0, 1.0)), u_core, hot);
      gl_FragColor = vec4(col * (dens + hot) * ends * u_bright * u_fade * uBright, 1.0);
    }`,
    shared,
    { varyings: 'varying vec3 vNormalV; varying vec3 vViewPos;' }
  );
  const mesh = new Mesh(beamGeo, mat);
  mesh.userData.sharedGeometry = true;
  return { mesh, u };
}

function voidPrim(shared) {
  const { mat, u } = makeMaterial(
    { k: 0, main: new Color(), accent: new Color(), bright: 1, time: 0 },
    VIEW_VERT,
    `void main() {
      float edge = max(1.0 - abs(dot(normalize(vNormalV), normalize(-vViewPos))), 0.0);
      float n = tnoise(vec2(vUv.x * 3.0, vUv.y * 1.2 - u_time * 0.25)).r;
      float rim = pow(edge, 3.0) * (n * 1.2 + 0.4);
      vec3 col = mix(u_accent * 0.02, u_main * u_bright, clamp(rim, 0.0, 1.0)) + u_main * rim * u_bright;
      gl_FragColor = vec4(col, mix(0.97, 1.0, rim) * (1.0 - pow(u_k, 3.0)));
    }`,
    shared,
    { varyings: 'varying vec3 vNormalV; varying vec3 vViewPos;', normal: true, side: FrontSide }
  );
  const mesh = new Mesh(sphereGeo, mat);
  mesh.userData.sharedGeometry = true;
  return { mesh, u };
}

/* ---- lathe (shapes.ts) ---- */
export const latheGeometry = new PlaneGeometry(1, 1, 72, 40);

const LATHE_UNIFORMS = () => ({
  mode: 0, r0: 1, r1: 1, curve: 1, bulge: 0, height: 1, a0: 0, span: TAU, t0: -Math.PI / 2, t1: Math.PI / 2,
  twist: 0, spin: 0, flow: 0, tilesA: 3, tilesV: 2, erode: 0, edge: 0.08, rim: 0, wobble: 0, fadeLo: 0.15, fadeHi: 0.3,
  streak: 0.5, bendX: 0, turn: 0, erodeTilt: 0, bendZ: 0, sway: 0, swayF: 2,
  core: new Color(), main: new Color(), accent: new Color(), bright: 1, fade: 1, time: 0, seed: 0
});

const LATHE_VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vNormalV;
varying vec3 vViewPos;
${RS_COMMON}
void main() {
  vUv = uv;
  float U = uv.x;
  float V = clamp(uv.y, 0.0005, 1.0);
  float a = u_a0 + U * u_span;
  bool tube = u_mode < 0.5;
  float rT = mix(u_r0, u_r1, pow(V, u_curve)) + u_bulge * sin(V * PI);
  float yT = V * u_height;
  float th = mix(u_t0, u_t1, V);
  float rS = cos(th) * u_r0;
  float yS = sin(th) * u_height;
  float r = tube ? rT : rS;
  float y = tube ? yT : yS;
  float wob = rsNoise3(vec3(cos(a) * 1.7, sin(a) * 1.7, V * 3.0 - u_time * 1.4 + u_seed)) * u_wobble;
  float rr = max(r * (1.0 + wob), 0.0);
  float drdV = (u_r1 - u_r0) * u_curve * pow(V, u_curve - 1.0) + u_bulge * PI * cos(V * PI);
  vec3 nT = vec3(cos(a), -drdV / max(u_height, 0.001), sin(a));
  vec3 nS = vec3(cos(th) * cos(a), sin(th), cos(th) * sin(a));
  vec3 nLocal = normalize(tube ? nT : nS);
  vNormalV = normalize((viewMatrix * modelMatrix * vec4(nLocal, 0.0)).xyz);
  float bend = V * V;
  float sw = u_sway * V;
  float ph = V * 2.4 - u_time * u_swayF + u_seed;
  float ox = u_bendX * bend + sw * sin(ph);
  float oz = u_bendZ * bend + sw * cos(ph * 0.8);
  vec4 mv = modelViewMatrix * vec4(cos(a) * rr + ox, y, sin(a) * rr + oz, 1.0);
  vViewPos = mv.xyz;
  gl_Position = projectionMatrix * mv;
}
`;

function lathePrim(shared, smoke) {
  const { mat, u } = makeMaterial(
    LATHE_UNIFORMS(),
    LATHE_VERT,
    `void main() {
      float U = vUv.x; float V = vUv.y;
      float aF = u_a0 + U * u_span + u_twist * V + u_time * u_spin + u_turn;
      float along = V * u_tilesV - u_time * u_flow;
      float sa = mix(1.0, 0.1, u_streak);
      float k1 = max(floor(u_tilesA * 0.5 + 0.5), 1.0);
      float k2 = max(floor(u_tilesA * 0.3 + 0.5), 1.0);
      float a01 = aF / TAU;
      float n1 = tnoise(vec2(a01 * k1, along * sa * 0.25) + seedShift(u_seed)).r;
      float n2 = tnoise(vec2(a01 * k2, along * 0.15) + seedShift(u_seed + 11.0)).g;
      float lo = mix(0.2, 0.42, u_streak);
      float dens = smoothstep(lo, 0.95, n1 * 0.75 + n2 * 0.4);
      float facing = abs(dot(normalize(vNormalV), normalize(-vViewPos)));
      float rimF = max(1.0 - facing, 0.0);
      float rimTerm = u_rim >= 0.0 ? mix(1.0, pow(rimF, 1.5) * 1.8 + 0.05, u_rim) : mix(1.0, pow(facing, 1.5), -u_rim);
      float ends = smoothstep(0.0, max(u_fadeLo, 0.001), V) * smoothstep(1.0, 1.0 - max(u_fadeHi, 0.001), V);
      float angM = u_span < TAU - 0.01 ? smoothstep(0.0, 0.12, U) * smoothstep(1.0, 0.88, U) : 1.0;
      float cut = n2 + n1 * 0.35 - u_erode * 1.4 - u_erodeTilt * (V - 0.5);
      bool eroding = u_erode > 0.001 || u_erodeTilt > 0.001;
      float alive = eroding ? smoothstep(0.0, 0.04, cut) : 1.0;
      float band = eroding ? alive * (1.0 - smoothstep(0.0, max(u_edge, 0.001), cut)) : 0.0;
      float mask = ends * angM * alive;
      ${
        smoke
          ? `vec3 col = mix(u_accent, u_main, clamp(dens * 1.3, 0.0, 1.0)) * u_bright + u_core * band;
             gl_FragColor = vec4(col, clamp(dens * rimTerm * mask * u_fade + band * u_fade, 0.0, 1.0));`
          : `vec3 col = mix(mix(u_accent, u_main, clamp(dens * 1.4, 0.0, 1.0)), u_core, smoothstep(0.7, 1.1, dens * rimTerm));
             gl_FragColor = vec4((col * dens * rimTerm * mask + mix(u_main, u_core, 0.5) * band * 1.3) * u_bright * u_fade * uBright, 1.0);`
      }
    }`,
    shared,
    { varyings: 'varying vec3 vNormalV; varying vec3 vViewPos;', normal: smoke }
  );
  const mesh = new Mesh(latheGeometry, mat);
  mesh.userData.sharedGeometry = true;
  return { mesh, u };
}

/* ---- sandbox additions: refraction ring + impact frame ---- */
function wavePrim(shared) {
  // Writes the sandbox's distortion buffer: rg = screen dir * 0.5 + 0.5,
  // b = magnitude, a = coverage. Camera-facing quad on LAYER.DISTORTION.
  const { mat, u } = makeMaterial(
    { k: 0, strength: 1, roll: 0 },
    STRIP_VERT,
    `void main() {
      vec2 q = vUv * 2.0 - 1.0;
      float d = length(q);
      float r = 1.0 - pow(1.0 - u_k, 3.0);
      float w = 0.16 * (1.0 - u_k * 0.5);
      float x = (d - r) / w;
      float ring = exp(-x * x) * pow(1.0 - u_k, 1.2) * smoothstep(1.0, 0.92, d);
      float c = cos(u_roll); float s = sin(u_roll);
      vec2 dir = d > 1e-4 ? q / d : vec2(0.0);
      dir = vec2(c * dir.x - s * dir.y, s * dir.x + c * dir.y);
      float mag = ring * u_strength;
      gl_FragColor = vec4(dir * 0.5 + 0.5, mag, clamp(ring * 2.0, 0.0, 1.0));
    }`,
    shared,
    { normal: true }
  );
  mat.depthTest = false;
  const mesh = new Mesh(new PlaneGeometry(2, 2), mat);
  mesh.layers.set(LAYER.DISTORTION);
  return { mesh, u };
}

function invertPrim(shared) {
  // Full-screen inversion: (1 - dst) — a one-frame black/white impact frame.
  const { mat, u } = makeMaterial(
    { amount: 0 },
    `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy * 2.0, 0.0, 1.0); }`,
    `void main() { gl_FragColor = vec4(vec3(u_amount), 1.0); }`,
    shared
  );
  mat.blending = CustomBlending;
  mat.blendEquation = AddEquation;
  mat.blendSrc = OneMinusDstColorFactor;
  mat.blendDst = ZeroFactor;
  mat.depthTest = false;
  const mesh = new Mesh(new PlaneGeometry(1, 1), mat);
  mesh.renderOrder = 999;
  return { mesh, u };
}

const FACTORIES = {
  arc: (s) => boltLike(s, 'arc'),
  helix: (s) => boltLike(s, 'arc'),
  ribbon: (s) => boltLike(s, 'ribbon'),
  bolt: (s) => boltLike(s, 'bolt'),
  beam: beamPrim,
  void: voidPrim,
  lathe: (s) => lathePrim(s, false),
  latheSmoke: (s) => lathePrim(s, true),
  wave: wavePrim,
  invert: invertPrim
};

/* ------------------------------------------------------------------ */
/* The pool                                                            */
/* ------------------------------------------------------------------ */

export class PrimPool {
  constructor(root, shared) {
    this.root = root;
    this.shared = shared;
    this.free = new Map();
    this.using = new Map();
    this.batches = {};
    for (const [type, spec] of Object.entries(BATCH_SPECS())) {
      const b = new Batch(type, spec, shared);
      this.batches[type] = b;
      root.add(b.mesh);
    }
  }

  sync() {
    for (const b of Object.values(this.batches)) b.sync();
  }

  acquire(type) {
    const batch = this.batches[type];
    if (batch) return batch.acquire();
    const list = this.free.get(type);
    let prim = list?.pop();
    if (!prim) {
      prim = FACTORIES[type](this.shared);
      prim.mesh.frustumCulled = false;
      if (prim.mesh.layers.mask === 1) prim.mesh.layers.set(LAYER.VFX);
      prim.mesh.renderOrder = prim.mesh.renderOrder || 24;
    }
    prim.mesh.visible = true;
    prim.mesh.userData.type = type;
    this.root.add(prim.mesh);
    if (!this.using.has(type)) this.using.set(type, new Set());
    this.using.get(type).add(prim);
    return prim;
  }

  inUse(type) {
    return this.using.get(type)?.size ?? 0;
  }

  get busy() {
    for (const b of Object.values(this.batches)) if (b.live) return true;
    for (const s of this.using.values()) if (s.size) return true;
    return false;
  }

  release(prim) {
    const batch = this.batches[prim.mesh.userData.type];
    if (batch) {
      batch.release(prim);
      return;
    }
    prim.mesh.removeFromParent();
    prim.mesh.position.set(0, 0, 0);
    prim.mesh.quaternion.identity();
    prim.mesh.scale.set(1, 1, 1);
    const type = prim.mesh.userData.type;
    if (!this.free.has(type)) this.free.set(type, []);
    const list = this.free.get(type);
    if (list.includes(prim)) return;
    list.push(prim);
    this.using.get(type)?.delete(prim);
  }

  clear() {
    for (const b of Object.values(this.batches)) b.clear();
    for (const set of this.using.values()) for (const p of [...set]) this.release(p);
  }

  dispose() {
    for (const list of this.free.values())
      for (const p of list) {
        if (!p.mesh.userData.sharedGeometry) p.mesh.geometry.dispose();
        p.mesh.material.dispose();
      }
    for (const b of Object.values(this.batches)) b.dispose();
  }
}

/* ------------------------------------------------------------------ */
/* CPU geometry builders (unchanged from prims.ts)                     */
/* ------------------------------------------------------------------ */

const _eye = new Vector3();
const _t = new Vector3();
const _side = new Vector3();
const _view = new Vector3();

export function stripGeometry(geometry, points, width, camera) {
  const n = points.length;
  let pos = geometry.getAttribute('position');
  if (!pos || pos.count !== n * 2) {
    pos = new BufferAttribute(new Float32Array(n * 6), 3);
    pos.setUsage(DynamicDrawUsage);
    const uvs = new Float32Array(n * 4);
    const idx = [];
    for (let i = 0; i < n; i++) {
      uvs.set([i / (n - 1), 0, i / (n - 1), 1], i * 4);
      if (i < n - 1) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    }
    geometry.setAttribute('position', pos);
    geometry.setAttribute('uv', new BufferAttribute(uvs, 2));
    geometry.setIndex(idx);
  }
  camera.getWorldPosition(_eye);
  const arr = pos.array;
  for (let i = 0; i < n; i++) {
    const p = points[i];
    _t.subVectors(points[Math.min(i + 1, n - 1)], points[Math.max(i - 1, 0)]);
    _side.crossVectors(_t, _view.copy(_eye).sub(p)).normalize().multiplyScalar(width(i) * 0.5);
    arr.set([p.x - _side.x, p.y - _side.y, p.z - _side.z, p.x + _side.x, p.y + _side.y, p.z + _side.z], i * 6);
  }
  pos.needsUpdate = true;
}

export function arcGeometry(geometry, pivot, e1, e2, a0, a1, r0, r1, segments = 64) {
  const existing = geometry.getAttribute('position');
  const reuse = existing && existing.count === (segments + 1) * 2;
  const pos = reuse ? existing.array : new Float32Array((segments + 1) * 2 * 3);
  const uvs = new Float32Array((segments + 1) * 2 * 2);
  const idx = [];
  const p = new Vector3();
  for (let i = 0; i <= segments; i++) {
    const s = i / segments;
    const a = a0 + (a1 - a0) * s;
    const c = Math.cos(a);
    const sn = Math.sin(a);
    for (let j = 0; j < 2; j++) {
      const r = j ? r1 : r0;
      p.copy(pivot).addScaledVector(e1, c * r).addScaledVector(e2, sn * r);
      const k = i * 2 + j;
      pos.set([p.x, p.y, p.z], k * 3);
      uvs.set([s, j], k * 2);
    }
    if (i < segments) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  }
  if (reuse) {
    existing.needsUpdate = true;
    return;
  }
  const attr = new BufferAttribute(pos, 3);
  attr.setUsage(DynamicDrawUsage);
  geometry.setAttribute('position', attr);
  geometry.setAttribute('uv', new BufferAttribute(uvs, 2));
  geometry.setIndex(idx);
}

export function helixGeometry(geometry, o) {
  const segments = o.segments ?? 96;
  const existing = geometry.getAttribute('position');
  const reuse = existing && existing.count === (segments + 1) * 2;
  const pos = reuse ? existing.array : new Float32Array((segments + 1) * 2 * 3);
  const axis = (o.axis ?? new Vector3(0, 1, 0)).clone().normalize();
  const e1 = new Vector3(1, 0, 0);
  if (Math.abs(axis.dot(e1)) > 0.9) e1.set(0, 0, 1);
  e1.sub(axis.clone().multiplyScalar(axis.dot(e1))).normalize();
  const e2 = axis.clone().cross(e1).normalize();
  const p = new Vector3();
  const phase = o.phase ?? 0;
  for (let i = 0; i <= segments; i++) {
    const s = i / segments;
    const a = phase + s * o.turns * TAU;
    const r = o.r0 + (o.r1 - o.r0) * s;
    for (let j = 0; j < 2; j++) {
      const h = s * o.height + (j - 0.5) * o.width;
      p.copy(o.center).addScaledVector(e1, Math.cos(a) * r).addScaledVector(e2, Math.sin(a) * r).addScaledVector(axis, h);
      pos.set([p.x, p.y, p.z], (i * 2 + j) * 3);
    }
  }
  if (reuse) {
    existing.needsUpdate = true;
    return;
  }
  const uvs = new Float32Array((segments + 1) * 2 * 2);
  const idx = [];
  for (let i = 0; i <= segments; i++) {
    uvs.set([i / segments, 0, i / segments, 1], i * 4);
    if (i < segments) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  }
  const attr = new BufferAttribute(pos, 3);
  attr.setUsage(DynamicDrawUsage);
  geometry.setAttribute('position', attr);
  geometry.setAttribute('uv', new BufferAttribute(uvs, 2));
  geometry.setIndex(idx);
}

export class RibbonTrail {
  constructor(prim, length = 28, width = 0.3) {
    this.prim = prim;
    this.length = length;
    this.width = width;
    this.points = [];
    const g = prim.mesh.geometry;
    const n = length;
    const existing = g.getAttribute('position');
    if (existing && existing.count === n * 2) {
      this.pos = existing;
      return;
    }
    this.pos = new BufferAttribute(new Float32Array(n * 2 * 3), 3);
    this.pos.setUsage(DynamicDrawUsage);
    const uvs = new Float32Array(n * 2 * 2);
    const idx = [];
    for (let i = 0; i < n; i++) {
      uvs.set([i / (n - 1), 0, i / (n - 1), 1], i * 4);
      if (i < n - 1) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    }
    g.setAttribute('position', this.pos);
    g.setAttribute('uv', new BufferAttribute(uvs, 2));
    g.setIndex(idx);
  }

  push(p) {
    this.points.unshift(p.clone());
    if (this.points.length > this.length) this.points.pop();
  }

  update(camera) {
    const pts = this.points;
    if (pts.length === 0) return;
    const arr = this.pos.array;
    camera.getWorldPosition(_eye);
    for (let i = 0; i < this.length; i++) {
      const p = pts[Math.min(i, pts.length - 1)];
      const a = pts[Math.max(Math.min(i - 1, pts.length - 1), 0)];
      const b = pts[Math.min(i + 1, pts.length - 1)];
      _t.subVectors(a, b);
      if (_t.lengthSq() < 1e-10) _t.set(1, 0, 0);
      _view.subVectors(_eye, p);
      _side.crossVectors(_t, _view).normalize().multiplyScalar(this.width * 0.5);
      arr.set([p.x - _side.x, p.y - _side.y, p.z - _side.z, p.x + _side.x, p.y + _side.y, p.z + _side.z], i * 6);
    }
    this.pos.needsUpdate = true;
  }
}
