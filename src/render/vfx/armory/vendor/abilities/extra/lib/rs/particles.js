// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
/*!
 * rollshade-gl / particles — CPU-simulated billboard particles, 12 kinds.
 *
 * A direct port of rollshade's `src/runtime/particles.ts` (simulation kept
 * line-for-line) with its TSL node material rewritten as a GLSL ShaderMaterial.
 *
 * MIT License — Copyright (c) 2026 tsuyatt (https://github.com/tsuyatt/rollshade).
 * GLSL port for the VFX Armory "extra" pack.
 */
import {
  AdditiveBlending,
  NormalBlending,
  DoubleSide,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
  Vector2,
  Vector3
} from 'three';
import { NOISE_PERIOD, noiseTexture, RS_COMMON } from './noise.js';

export const KINDS = ['glow', 'spark', 'star', 'flare', 'flame', 'smoke', 'mote', 'shard', 'bubble', 'glyph', 'mist', 'haze'];
const CURVES = ['linear', 'burst', 'pop', 'late', 'bell', 'hold', 'flash'];

function curve(id, t) {
  switch (id) {
    case 1:
      return 1 - Math.pow(2, -10 * t);
    case 2:
      return t < 0.15 ? 1.25 * (1 - Math.pow(1 - t / 0.15, 3)) : 1.25 - 0.25 * Math.min((t - 0.15) / 0.2, 1);
    case 3:
      return t * t * t;
    case 4:
      return Math.sin(Math.PI * Math.min(t, 1));
    case 5:
      return t < 0.7 ? 1 : 1 - Math.pow((t - 0.7) / 0.3, 2);
    case 6:
      return Math.exp(-t * 7);
    default:
      return t;
  }
}

const HOOKS = [];
const hookRefs = new Map();

function hookSlot(h) {
  let slot = HOOKS.indexOf(h);
  if (slot < 0) {
    slot = HOOKS.indexOf(null);
    if (slot < 0) slot = HOOKS.push(null) - 1;
    HOOKS[slot] = h;
  }
  hookRefs.set(h, (hookRefs.get(h) ?? 0) + 1);
  return slot + 1;
}

function dropHook(slot) {
  const h = HOOKS[slot];
  if (!h) return;
  const n = (hookRefs.get(h) ?? 1) - 1;
  if (n > 0) hookRefs.set(h, n);
  else {
    hookRefs.delete(h);
    HOOKS[slot] = null;
  }
}

const events = [];

export function flushParticleEvents() {
  const list = events.splice(0);
  for (const e of list) e.fn(e.p, e.v);
}

const fieldAt = new Vector3();
const fieldAxis = new Vector3();
const UPV = new Vector3(0, 1, 0);

function applyFields(fields, x, y, z, vx, vy, vz, dt, out) {
  out[0] = vx;
  out[1] = vy;
  out[2] = vz;
  for (const fl of fields) {
    const c = typeof fl.at === 'number' ? anchors[fl.at] : fl.at ?? fieldAt.set(0, 0, 0);
    const ax = fl.axis ?? UPV;
    let dx = x - c.x;
    let dy = y - c.y;
    let dz = z - c.z;
    if (fl.shape === 'tube') {
      const along = dx * ax.x + dy * ax.y + dz * ax.z;
      dx -= ax.x * along;
      dy -= ax.y * along;
      dz -= ax.z * along;
    }
    const d = Math.hypot(dx, dy, dz) + 1e-5;
    const min = fl.min ?? 0;
    const max = fl.max ?? Infinity;
    if (d < min || d > max) continue;
    const att = (fl.power * dt) / Math.pow(d - min + 1, fl.falloff ?? 1);
    if (fl.kind === 'vortex') {
      fieldAxis.set(ax.y * dz - ax.z * dy, ax.z * dx - ax.x * dz, ax.x * dy - ax.y * dx).divideScalar(d);
      out[0] += fieldAxis.x * att;
      out[1] += fieldAxis.y * att;
      out[2] += fieldAxis.z * att;
    } else if (fl.kind === 'attract') {
      out[0] -= (dx / d) * att;
      out[1] -= (dy / d) * att;
      out[2] -= (dz / d) * att;
    } else if (fl.kind === 'wind') {
      out[0] += ax.x * att;
      out[1] += ax.y * att;
      out[2] += ax.z * att;
    } else {
      const k = Math.max(1 - att, 0);
      out[0] *= k;
      out[1] *= k;
      out[2] *= k;
    }
  }
}

const fieldOut = [0, 0, 0];
const seekTmp = new Vector3();

export const anchors = [];
const freeAnchors = [];

export function claimAnchor(p) {
  const i = freeAnchors.pop() ?? anchors.length;
  anchors[i] = p.clone();
  return i;
}

export function releaseAnchor(i) {
  freeAnchors.push(i);
}

const ORBITS = [];
const orbitRefs = new Map();

function dropOrbit(slot) {
  const orb = ORBITS[slot];
  if (!orb) return;
  const n = (orbitRefs.get(orb) ?? 1) - 1;
  if (n > 0) orbitRefs.set(orb, n);
  else {
    orbitRefs.delete(orb);
    ORBITS[slot] = null;
  }
}

export function curlAt(x, y, z, t, k, out) {
  let cx = 0;
  let cy = 0;
  let cz = 0;
  let amp = 1;
  let f = k;
  for (let o = 0; o < 2; o++) {
    const ax = f * x;
    const ay = f * y;
    const az = f * z;
    const s1 = Math.sin(ay + t * 0.7 + 1.3 + o * 5.1);
    const c1 = Math.cos(ay + t * 0.7 + 1.3 + o * 5.1);
    const s2 = Math.sin(0.9 * az + 2.1 + o * 1.7);
    const c2 = Math.cos(0.9 * az + 2.1 + o * 1.7);
    const s3 = Math.sin(az + t * 0.6 + 4.1 + o * 3.3);
    const c3 = Math.cos(az + t * 0.6 + 4.1 + o * 3.3);
    const s4 = Math.sin(1.1 * ax + 0.5 + o * 2.9);
    const c4 = Math.cos(1.1 * ax + 0.5 + o * 2.9);
    const s5 = Math.sin(ax + t * 0.8 + 2.7 + o * 4.4);
    const c5 = Math.cos(ax + t * 0.8 + 2.7 + o * 4.4);
    const s6 = Math.sin(0.8 * ay + 3.3 + o * 0.9);
    const c6 = Math.cos(0.8 * ay + 3.3 + o * 0.9);
    const dzdy = s5 * -s6 * 0.8;
    const dydz = c3 * c4;
    const dxdz = s1 * -s2 * 0.9;
    const dzdx = c5 * c6;
    const dydx = s3 * -s4 * 1.1;
    const dxdy = c1 * c2;
    cx += (dzdy - dydz) * amp;
    cy += (dxdz - dzdx) * amp;
    cz += (dydx - dxdy) * amp;
    amp *= 0.5;
    f *= 2.3;
  }
  out[0] = cx;
  out[1] = cy;
  out[2] = cz;
}

const curlOut = [0, 0, 0];
const FIELDS = 48;

const pick = (r, fallback) => {
  if (r === undefined) return fallback;
  if (typeof r === 'number') return r;
  if (typeof r === 'function') return r();
  return r[0] + Math.random() * (r[1] - r[0]);
};

const tmp = new Vector3();
const tmpDir = new Vector3();

export function randomDir(out = new Vector3()) {
  const z = Math.random() * 2 - 1;
  const a = Math.random() * Math.PI * 2;
  const r = Math.sqrt(1 - z * z);
  return out.set(r * Math.cos(a), z, r * Math.sin(a));
}

export function coneDir(dir, spread, out = new Vector3()) {
  if (spread >= 1) return randomDir(out);
  randomDir(tmpDir);
  return out.copy(dir).normalize().lerp(tmpDir, spread).normalize();
}

/** Shared view-dependent uniforms, refreshed by the runtime each frame. */
export function particleUniforms() {
  return {
    uScreenCap: { value: 0.5 },
    uTanHalfFov: { value: Math.tan((45 * Math.PI) / 360) },
    uNearFade: { value: new Vector2(0.4, 1.4) },
    uHotWhite: { value: 0.2 },
    uBright: { value: 1 }
  };
}

export class ParticleSystem {
  /**
   * @param {string} kind
   * @param {number} max
   * @param {object} look   runtime look block ({ particles, smoke, ... })
   * @param {object} shared uniforms from particleUniforms()
   */
  constructor(kind, max, look, shared) {
    this.kind = kind;
    this.max = max;
    this.look = look;
    this.count = 0;
    this.data = new Float32Array(max * FIELDS);
    this.soft = kind === 'smoke' || kind === 'mist' || kind === 'flame' || kind === 'haze';
    const make = () => {
      const attr = new InstancedBufferAttribute(new Float32Array(max * 4), 4);
      attr.setUsage(DynamicDrawUsage);
      return attr;
    };
    this.a = make();
    this.b = make();
    this.c = make();
    this.d = make();
    const quad = new PlaneGeometry(2, 2);
    this.geometry = new InstancedBufferGeometry();
    this.geometry.index = quad.index;
    this.geometry.setAttribute('position', quad.getAttribute('position'));
    this.geometry.setAttribute('uv', quad.getAttribute('uv'));
    this.geometry.setAttribute('aA', this.a);
    this.geometry.setAttribute('aB', this.b);
    this.geometry.setAttribute('aC', this.c);
    this.geometry.setAttribute('aD', this.d);
    this.geometry.instanceCount = 0;
    this.material = particleMaterial(kind, shared);
    this.mesh = new Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.matrixAutoUpdate = false;
    this.mesh.renderOrder = kind === 'smoke' || kind === 'haze' ? 21 : 22;
  }

  emit(n, o) {
    const amount = this.look.particles;
    const scaled =
      this.kind === 'star' || this.kind === 'flare' || (n === 1 && (this.kind === 'glow' || this.kind === 'mist')) ? n : n * amount;
    const total = Math.floor(scaled) + (Math.random() < scaled - Math.floor(scaled) ? 1 : 0);
    for (let k = 0; k < total; k++) {
      let i;
      if (this.count < this.max) i = this.count++;
      else {
        i = Math.floor(Math.random() * this.max);
        const old = this.data[i * FIELDS + 43];
        if (old) dropOrbit(old - 1);
        const oldHook = this.data[i * FIELDS + 47];
        if (oldHook) dropHook(oldHook - 1);
      }
      const f = i * FIELDS;
      const d = this.data;
      const p = typeof o.p === 'function' ? o.p() : o.p ?? tmp.set(0, 0, 0);
      const j = o.jitter ?? 0;
      d[f] = p.x + (Math.random() * 2 - 1) * j;
      d[f + 1] = p.y + (Math.random() * 2 - 1) * j;
      d[f + 2] = p.z + (Math.random() * 2 - 1) * j;
      let v;
      if (o.v) v = o.v();
      else {
        v = o.dir ? coneDir(o.dir, o.spread ?? 0.3, tmpDir) : randomDir(tmpDir);
        v.multiplyScalar(pick(o.speed, 1));
      }
      d[f + 3] = v.x;
      d[f + 4] = v.y;
      d[f + 5] = v.z;
      d[f + 6] = -pick(o.delay, 0);
      d[f + 7] = Math.max(pick(o.life, 0.6), 0.01);
      d[f + 8] = pick(o.size, 0.1);
      d[f + 9] = pick(o.grow, 1);
      d[f + 10] = Math.random() * Math.PI * 2;
      d[f + 11] = pick(o.spin, 0);
      d[f + 12] = o.gravity ?? 0;
      d[f + 13] = pick(o.drag, 0);
      const cols = o.colors ?? WHITE_LIST;
      const c0 = cols[0];
      const c1 = cols[Math.min(1, cols.length - 1)];
      const c2 = cols[cols.length - 1];
      d[f + 14] = c0.r;
      d[f + 15] = c0.g;
      d[f + 16] = c0.b;
      d[f + 17] = c1.r;
      d[f + 18] = c1.g;
      d[f + 19] = c1.b;
      d[f + 20] = c2.r;
      d[f + 21] = c2.g;
      d[f + 22] = c2.b;
      d[f + 23] = pick(o.bright, 1);
      d[f + 24] = o.fadeIn ?? 0.05;
      d[f + 25] = o.fadePow ?? 1.5;
      d[f + 26] = o.stretch ?? 0;
      d[f + 27] = o.flicker ?? 0;
      d[f + 28] = o.bounce ?? -1;
      d[f + 29] = o.turb ?? 0;
      d[f + 30] = o.swirl ?? 0;
      d[f + 31] = o.attract ?? 0;
      const c = o.center ?? p;
      d[f + 32] = c.x;
      d[f + 33] = c.y;
      d[f + 34] = c.z;
      d[f + 35] = Math.random();
      d[f + 36] = 0;
      d[f + 37] = 0;
      d[f + 38] = 0;
      d[f + 43] = 0;
      d[f + 44] = Math.min(Math.max(o.dissolve ?? 0, 0), 0.95);
      d[f + 45] = o.sizeCurve ? CURVES.indexOf(o.sizeCurve) : 0;
      d[f + 46] = o.alphaCurve ? CURVES.indexOf(o.alphaCurve) : 0;
      d[f + 47] = o.hook ? hookSlot(o.hook) : 0;
      if (o.orbit) {
        const orb = o.orbit;
        const cx = orb.anchor !== undefined ? anchors[orb.anchor] : c;
        const dx = d[f] - cx.x;
        const dz = d[f + 2] - cx.z;
        d[f + 36] = Math.atan2(dz, dx);
        d[f + 37] = d[f + 1] - cx.y;
        d[f + 38] = Math.hypot(dx, dz);
        let slot = ORBITS.indexOf(orb);
        if (slot < 0) {
          slot = ORBITS.indexOf(null);
          if (slot < 0) slot = ORBITS.push(null) - 1;
          ORBITS[slot] = orb;
          orbitRefs.set(orb, 0);
        }
        orbitRefs.set(orb, (orbitRefs.get(orb) ?? 0) + 1);
        d[f + 43] = slot + 1;
      }
      d[f + 39] = o.floor ?? -1e9;
      d[f + 40] = o.curl ?? 0;
      d[f + 41] = o.curlScale ?? 1.4;
      d[f + 42] = o.variant ?? 0;
    }
  }

  update(dt, time) {
    const d = this.data;
    const A = this.a.array;
    const B = this.b.array;
    const C = this.c.array;
    const D = this.d.array;
    let n = this.count;
    let out = 0;
    for (let i = 0; i < n; i++) {
      const f = i * FIELDS;
      d[f + 6] += dt;
      const age = d[f + 6];
      const life = d[f + 7];
      if (age >= life) {
        if (d[f + 43]) dropOrbit(d[f + 43] - 1);
        const hs = d[f + 47];
        if (hs) {
          const h = HOOKS[hs - 1];
          if (h?.onDie) events.push({ fn: h.onDie, p: new Vector3(d[f], d[f + 1], d[f + 2]), v: new Vector3(d[f + 3], d[f + 4], d[f + 5]) });
          dropHook(hs - 1);
        }
        n--;
        if (i !== n) d.copyWithin(f, n * FIELDS, n * FIELDS + FIELDS);
        i--;
        continue;
      }
      if (age < 0) continue;
      const x0 = d[f];
      const y0 = d[f + 1];
      const z0 = d[f + 2];
      let vx = d[f + 3];
      let vy = d[f + 4];
      let vz = d[f + 5];
      const drag = Math.exp(-d[f + 13] * dt);
      vx *= drag;
      vy = vy * drag - d[f + 12] * dt;
      vz *= drag;
      const tb = d[f + 29];
      if (tb) {
        const s = d[f + 35] * 17.3;
        vx += Math.sin(time * 3.1 + y0 * 2.3 + s) * tb * dt;
        vy += Math.sin(time * 2.7 + z0 * 2.1 + s * 1.3) * tb * 0.5 * dt;
        vz += Math.cos(time * 2.9 + x0 * 2.2 + s * 0.7) * tb * dt;
      }
      const sw = d[f + 30];
      const at = d[f + 31];
      if (sw || at) {
        const dx = x0 - d[f + 32];
        const dz = z0 - d[f + 34];
        const dy = y0 - d[f + 33];
        const r = Math.hypot(dx, dy, dz) + 1e-4;
        if (sw) {
          vx += -dz * sw * dt;
          vz += dx * sw * dt;
        }
        if (at) {
          vx -= (dx / r) * at * dt;
          vy -= (dy / r) * at * dt;
          vz -= (dz / r) * at * dt;
        }
      }
      const hs = d[f + 47];
      const hook = hs ? HOOKS[hs - 1] : null;
      if (hook) {
        if (hook.fields) {
          applyFields(hook.fields, x0, y0, z0, vx, vy, vz, dt, fieldOut);
          vx = fieldOut[0];
          vy = fieldOut[1];
          vz = fieldOut[2];
        }
        if (hook.seek) {
          const sk = hook.seek;
          const tg = typeof sk.target === 'number' ? anchors[sk.target] : typeof sk.target === 'function' ? sk.target() : sk.target;
          seekTmp.set(tg.x - x0, tg.y - y0, tg.z - z0);
          const dist = seekTmp.length();
          if (dist < (sk.arrive ?? 0.15)) {
            d[f + 6] = life;
            d[f + 3] = vx;
            d[f + 4] = vy;
            d[f + 5] = vz;
            continue;
          }
          seekTmp.multiplyScalar(sk.speed / Math.max(dist, 1e-5));
          const k = Math.min(sk.steer * dt, 1);
          vx += (seekTmp.x - vx) * k;
          vy += (seekTmp.y - vy) * k;
          vz += (seekTmp.z - vz) * k;
        }
      }
      let x = x0 + vx * dt;
      let y = y0 + vy * dt;
      let z = z0 + vz * dt;
      const os = d[f + 43];
      if (os) {
        const orb = ORBITS[os - 1];
        if (orb) {
          const cx = orb.anchor !== undefined ? anchors[orb.anchor] : null;
          const ox = cx ? cx.x : d[f + 32];
          const oy = cx ? cx.y : d[f + 33];
          const oz = cx ? cx.z : d[f + 34];
          let r = d[f + 38];
          const hh = d[f + 37] + (orb.rise * (0.7 + 0.6 * d[f + 35]) + vy) * dt;
          const k = Math.min(Math.max(hh / orb.h, 0), 1);
          const target = (orb.r0 + (orb.r1 - orb.r0) * Math.pow(k, 1.5)) * (0.75 + 0.5 * d[f + 35]) + Math.max(hh - orb.h, 0) * 2.5;
          r += (target - r) * Math.min((orb.pull ?? 3) * dt, 1);
          const th = d[f + 36] + (orb.w * dt * Math.sqrt(Math.max(orb.r1, 0.2) / Math.max(r, 0.2))) / (0.8 + 0.4 * d[f + 35]);
          d[f + 36] = th;
          d[f + 37] = hh;
          d[f + 38] = r;
          x = ox + Math.cos(th) * r;
          y = oy + hh;
          z = oz + Math.sin(th) * r;
        }
      }
      const cu = d[f + 40];
      if (cu) {
        curlAt(x0, y0, z0, time, d[f + 41], curlOut);
        const ramp = Math.min(age * 4, 1) * cu * dt;
        x += curlOut[0] * ramp;
        y += curlOut[1] * ramp;
        z += curlOut[2] * ramp;
      }
      const floor = d[f + 39];
      if (this.soft && floor > -1e8) {
        const lift = floor + d[f + 8] * (1 + (d[f + 9] - 1) * Math.min(age / life, 1)) * 0.8;
        if (y < lift) y = lift;
      }
      if (hook && (hook.onFloor || hook.floorKill) && y < floor && y0 >= floor) {
        if (hook.onFloor) events.push({ fn: hook.onFloor, p: new Vector3(x, floor, z), v: new Vector3(vx, vy, vz) });
        if (hook.floorKill) {
          d[f + 6] = life;
          y = floor;
        }
      }
      if (d[f + 28] >= 0 && y < floor) {
        y = floor + (floor - y);
        vy = -vy * d[f + 28];
        vx *= 0.7;
        vz *= 0.7;
      }
      d[f] = x;
      d[f + 1] = y;
      d[f + 2] = z;
      d[f + 3] = vx;
      d[f + 4] = vy;
      d[f + 5] = vz;
      d[f + 10] += d[f + 11] * dt;
      const t = age / life;
      const fin = d[f + 24];
      const ac = d[f + 46];
      let alpha = (fin > 0 ? Math.min(age / fin, 1) : 1) * (ac ? curve(ac, t) : Math.pow(1 - t, d[f + 25]));
      const fl = d[f + 27];
      if (fl) alpha *= 1 - fl + fl * (0.5 + 0.5 * Math.sin(time * 40 + d[f + 35] * 60));
      const sc = d[f + 45];
      const size = d[f + 8] * (sc === 4 ? curve(4, t) * d[f + 9] : 1 + (d[f + 9] - 1) * (sc ? curve(sc, t) : t));
      if (floor > -1e8) alpha *= Math.min(Math.max((y - floor) / (size * 0.6) + 0.35, 0), 1);
      const u = t < 0.5 ? t * 2 : (t - 0.5) * 2;
      const o0 = t < 0.5 ? 14 : 17;
      const o1 = t < 0.5 ? 17 : 20;
      const bright = d[f + 23];
      const st = d[f + 26];
      const mv = st && dt > 0 ? st / dt : 0;
      const q = out * 4;
      A[q] = x;
      A[q + 1] = y;
      A[q + 2] = z;
      A[q + 3] = size;
      B[q] = (x - x0) * mv;
      B[q + 1] = (y - y0) * mv;
      B[q + 2] = (z - z0) * mv;
      B[q + 3] = d[f + 10];
      C[q] = (d[f + o0] + (d[f + o1] - d[f + o0]) * u) * bright;
      C[q + 1] = (d[f + o0 + 1] + (d[f + o1 + 1] - d[f + o0 + 1]) * u) * bright;
      C[q + 2] = (d[f + o0 + 2] + (d[f + o1 + 2] - d[f + o0 + 2]) * u) * bright;
      C[q + 3] = alpha;
      D[q] = t;
      D[q + 1] = d[f + 35];
      D[q + 2] = age;
      D[q + 3] = d[f + 42] + d[f + 44];
      out++;
    }
    this.count = n;
    this.geometry.instanceCount = out;
    // When paused (dt = 0) the streak vectors above would collapse to zero;
    // keep the previous ones so a frozen frame still shows its streaks.
    if (dt <= 0) return;
    for (const attr of [this.a, this.b, this.c, this.d]) {
      attr.clearUpdateRanges();
      attr.addUpdateRange(0, Math.max(out, 1) * 4);
      attr.needsUpdate = true;
    }
  }

  get alive() {
    return this.count;
  }

  clear() {
    for (let i = 0; i < this.count; i++) {
      if (this.data[i * FIELDS + 43]) dropOrbit(this.data[i * FIELDS + 43] - 1);
      if (this.data[i * FIELDS + 47]) dropHook(this.data[i * FIELDS + 47] - 1);
    }
    this.count = 0;
    this.geometry.instanceCount = 0;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}

const WHITE_LIST = [{ r: 1, g: 1, b: 1 }];

/* ------------------------------------------------------------------ */
/* Material                                                            */
/* ------------------------------------------------------------------ */

const VERT = /* glsl */ `
attribute vec4 aA;
attribute vec4 aB;
attribute vec4 aC;
attribute vec4 aD;
uniform float uScreenCap;
uniform float uTanHalfFov;
uniform vec2 uNearFade;
varying vec4 vCol;
varying vec4 vInfo;
varying float vDepth;
varying vec2 vUv;
void main() {
  vec4 center = viewMatrix * vec4(aA.xyz, 1.0);
  vec2 sv = (viewMatrix * vec4(aB.xyz, 0.0)).xy;
  float len = length(sv);
  vec2 axis = len > 1e-5 ? sv / max(len, 1e-5) : vec2(cos(aB.w), sin(aB.w));
  vec2 perp = vec2(-axis.y, axis.x);
  vec2 corner = position.xy;
  float depth = -center.z;
  float cap = uScreenCap * depth * uTanHalfFov;
  float nearK = smoothstep(uNearFade.x, uNearFade.y, depth);
  float size = min(max(aA.w, 0.0), cap) * step(0.001, nearK);
  float stretch = min(len * 0.5, cap * 2.0);
  vec2 off = axis * (corner.x * (size + stretch)) + perp * (corner.y * size);
  gl_Position = projectionMatrix * vec4(center.xy + off, center.z, 1.0);
  vCol = aC;
  vInfo = aD;
  vDepth = depth;
  vUv = uv;
}
`;

function fragment(kind) {
  const additive = kind !== 'smoke' && kind !== 'haze';
  const P = NOISE_PERIOD.toFixed(1);
  let body;
  switch (kind) {
    case 'glow':
      body = `float g = exp(d2 * -4.5) * smoothstep(1.0, 0.75, dist);
      rgb = mix(col.rgb, peak(col.rgb), exp(d2 * -30.0) * 0.6) * g; alpha = col.a;`;
      break;
    case 'mote':
      body = `float g = (exp(d2 * -9.0) + exp(d2 * -60.0) * 1.5) * smoothstep(1.0, 0.6, dist);
      rgb = mix(col.rgb, peak(col.rgb), exp(d2 * -40.0)) * g; alpha = col.a;`;
      break;
    case 'spark':
      body = `float g = pow(smoothstep(1.0, 0.0, dist), 2.2);
      rgb = mix(col.rgb, peak(col.rgb) * 1.2, smoothstep(0.55, 0.0, dist)) * g; alpha = col.a;`;
      break;
    case 'flare':
      body = `float ay = abs(q.y);
      float g = (exp(ay * -38.0) * exp(q.x * q.x * -2.5) + exp(d2 * -25.0) * 0.5) * smoothstep(1.0, 0.8, abs(q.x));
      rgb = mix(col.rgb, peak(col.rgb), exp(d2 * -80.0)) * g; alpha = col.a;`;
      break;
    case 'shard':
      body = `float h1 = fract(sin(vInfo.y * 91.3) * 43758.5453);
      float h2 = fract(sin(vInfo.y * 47.1 + 3.1) * 24634.6345);
      vec2 qs = vec2(q.x + q.y * (h2 - 0.5) * 0.9, q.y * mix(0.7, 1.6, h1));
      float m = max(abs(qs.x) + abs(qs.y), abs(qs.x * 0.6 + qs.y * (h1 - 0.5)) * 1.6);
      float bodyM = smoothstep(1.0, 0.86, m);
      float facet = qs.x * (qs.y + h2 - 0.5) > 0.0 ? 1.0 : 0.4;
      float edge = smoothstep(0.78, 0.97, m) * bodyM;
      rgb = mix(col.rgb * facet, peak(col.rgb) * 1.3, edge + exp(d2 * -20.0) * 0.5) * bodyM; alpha = col.a;`;
      break;
    case 'bubble':
      body = `float x = (dist - 0.78) / 0.09;
      float ring = exp(-x * x);
      vec2 hq = q - vec2(-0.35, 0.38);
      float hl = exp(dot(hq, hq) * -40.0);
      float g = ring + hl * 1.5 + smoothstep(0.85, 0.0, dist) * 0.08;
      rgb = mix(col.rgb, peak(col.rgb), hl) * g; alpha = col.a;`;
      break;
    case 'glyph':
      body = `float h = fract(sin(vInfo.y * 78.233 + 1.7) * 43758.5453) * 64.0;
      #define BIT(k) step(0.5, fract(h / pow(2.0, float(k))))
      #define LINE(dd) smoothstep(0.1, 0.03, abs(dd))
      float ring = LINE(dist - 0.72) * (BIT(0) * 0.8 + 0.2);
      float vv = LINE(q.x - (BIT(1) - 0.5) * 0.5) * step(abs(q.y), 0.55);
      float hbar = LINE(q.y - (BIT(2) - 0.5) * 0.6) * step(abs(q.x), 0.5) * BIT(3);
      float diag = LINE(q.x - q.y * (BIT(4) * 2.0 - 1.0)) * step(dist, 0.55) * BIT(5);
      float dotM = smoothstep(0.16, 0.08, length(q - vec2(0.0, 0.3))) * (BIT(2) * BIT(5));
      float rune = max(max(ring, vv), max(max(hbar, diag), dotM)) + exp(d2 * -5.0) * 0.25;
      vec2 sq = vec2(q.x * 1.05, -q.y);
      float cran = smoothstep(0.6, 0.55, length(sq - vec2(0.0, -0.15)));
      float jaw = smoothstep(0.03, 0.0, max(abs(sq.x) - 0.3, abs(sq.y - 0.38) - 0.2));
      float eyeL = smoothstep(0.19, 0.14, length(sq - vec2(-0.22, -0.08)));
      float eyeR = smoothstep(0.19, 0.14, length(sq - vec2(0.22, -0.08)));
      float nose = smoothstep(0.09, 0.05, length(sq - vec2(0.0, 0.17)));
      float teeth = step(0.3, sq.y) * smoothstep(0.03, 0.0, abs(fract(sq.x * 5.0 + 0.5) - 0.5) - 0.06);
      float skullFill = max(cran, jaw) * (1.0 - max(max(eyeL, eyeR), max(nose, teeth)));
      float skull = skullFill * 0.55 + max(eyeL, eyeR) * max(cran, jaw) * 1.4 + exp(d2 * -3.0) * 0.15;
      #define ARM(a, b) (smoothstep(0.2, 0.12, abs(a)) * smoothstep(0.72, 0.6, abs(b)))
      float plus = max(ARM(q.x, q.y), ARM(q.y, q.x)) + exp(d2 * -4.0) * 0.25;
      vec2 lq = vec2(q.x * 0.7071 - q.y * 0.7071, q.x * 0.7071 + q.y * 0.7071);
      float lens = smoothstep(0.05, 0.0, abs(lq.x) * 2.2 - (0.62 - lq.y * lq.y * 0.62));
      float rib = smoothstep(0.05, 0.015, abs(lq.x)) * step(abs(lq.y), 0.7);
      float leaf = lens * 0.75 + rib * 0.6 + exp(d2 * -4.0) * 0.15;
      float vt = floor(vInfo.w);
      float g = vt > 2.5 ? leaf : (vt > 1.5 ? plus : (vt > 0.5 ? skull : rune));
      rgb = mix(col.rgb, peak(col.rgb), 0.35) * g; alpha = col.a;`;
      break;
    case 'haze':
      body = `float nn = noiseAt(1.2, 0.4).a;
      float shape = exp(d2 * -2.2) * (nn * 1.1 + 0.15) * smoothstep(1.0, 0.55, dist);
      rgb = col.rgb * (0.75 + q.y * -0.25);
      alpha = clamp(shape * col.a, 0.0, 1.0);`;
      break;
    case 'mist':
      body = `float nn = evolving(1.4, 0.6);
      float g = exp(d2 * -2.6) * (nn * 1.3 + 0.1) * smoothstep(1.0, 0.6, dist);
      rgb = col.rgb * g; alpha = col.a;`;
      break;
    case 'star':
      body = `float ax = abs(q.x); float ay = abs(q.y);
      float rays = max(exp(ax * -22.0) * exp(ay * -2.2), exp(ay * -22.0) * exp(ax * -2.2));
      float diag = (exp(abs(q.x + q.y) * -26.0) * exp(abs(q.x - q.y) * -3.0) + exp(abs(q.x - q.y) * -26.0) * exp(abs(q.x + q.y) * -3.0)) * 0.35;
      float g = (rays + diag + exp(d2 * -18.0) * 0.8) * smoothstep(1.0, 0.7, dist);
      rgb = mix(col.rgb, peak(col.rgb), exp(d2 * -60.0)) * g; alpha = col.a;`;
      break;
    case 'flame':
      body = `float t = vInfo.x;
      float nn = evolving(1.3, 1.6);
      float bodyF = 1.0 - dist;
      float dens = clamp(bodyF * 1.25 + (nn - 0.5) * 1.1 - t * 0.75, 0.0, 1.0);
      float shape = smoothstep(0.02, 0.3, dens) * smoothstep(1.0, 0.72, dist);
      float hot = smoothstep(0.25, 0.75, dens) * (1.0 - t);
      rgb = mix(col.rgb * 0.55, mix(col.rgb, peak(col.rgb), 0.55) * 1.6, hot) * shape; alpha = col.a;`;
      break;
    default: // smoke
      body = `float t = vInfo.x;
      float nn = evolving(1.1, 0.5);
      float bodyF = 1.0 - dist;
      float dens = clamp(bodyF * 1.1 + (nn - 0.5) * 1.2 - t * 0.45, 0.0, 1.0);
      float shape = smoothstep(0.02, 0.45, dens) * smoothstep(1.0, 0.7, dist);
      float lightN = noiseAt(1.1, 0.5).b * 1.3;
      rgb = col.rgb * lightN;
      alpha = shape * col.a * 0.85;`;
  }
  const dissolve =
    kind !== 'spark' && kind !== 'mote' && kind !== 'star' && kind !== 'flare'
      ? `{
      float amount = fract(vInfo.w);
      float nd = texture2D(uNoise, q * 0.575 + offs * 1.7).a * 0.8 + dist * 0.25;
      float thr = amount * smoothstep(0.1, 1.0, vInfo.x) * 1.25;
      bool on = amount > 0.001;
      float alive = on ? smoothstep(thr, thr + 0.03, nd) : 1.0;
      float rim = on ? alive * (1.0 - smoothstep(thr + 0.02, thr + 0.1, nd)) * step(0.02, thr) : 0.0;
      rgb = rgb * alive + peak(col.rgb) * rim * ${additive ? '1.6' : '0.8'};
      alpha = alpha * max(alive, rim);
    }`
      : '';
  return /* glsl */ `
${RS_COMMON}
uniform float uHotWhite;
uniform float uBright;
uniform vec2 uNearFade;
varying vec4 vCol;
varying vec4 vInfo;
varying float vDepth;
varying vec2 vUv;
vec3 peak(vec3 c) { return mix(c, vec3(max(max(c.x, c.y), c.z)), uHotWhite); }
vec2 q; vec2 offs;
vec4 noiseAt(float scale, float drift) {
  return texture2D(uNoise, q * (scale / ${P}) + offs + vec2(0.7, 0.45) * (vInfo.z * drift / ${P}));
}
float evolving(float scale, float drift) {
  vec4 a = noiseAt(scale, drift);
  vec4 b = texture2D(uNoise, q * ((scale * 1.07) / ${P}) + offs.yx + vec2(-0.5, 0.8) * (vInfo.z * drift / ${P}) + 0.37);
  return (a.r + b.g) * 0.5 * 1.4 - 0.5 * 1.4 + 0.5;
}
void main() {
  vec4 col = vCol;
  col.rgb *= uBright;
  q = vUv * 2.0 - 1.0;
  float d2 = dot(q, q);
  float dist = sqrt(d2);
  offs = vec2(fract(vInfo.y * 7.13), fract(vInfo.y * 3.71));
  vec3 rgb; float alpha;
  ${body}
  ${dissolve}
  alpha *= smoothstep(uNearFade.x, uNearFade.y, vDepth);
  ${additive ? 'gl_FragColor = vec4(rgb * alpha, 1.0);' : 'gl_FragColor = vec4(rgb, alpha);'}
}
`;
}

function particleMaterial(kind, shared) {
  const additive = kind !== 'smoke' && kind !== 'haze';
  return new ShaderMaterial({
    uniforms: { ...shared, uNoise: { value: noiseTexture() } },
    vertexShader: VERT,
    fragmentShader: fragment(kind),
    transparent: true,
    depthWrite: false,
    blending: additive ? AdditiveBlending : NormalBlending,
    side: DoubleSide,
    fog: false
  });
}
