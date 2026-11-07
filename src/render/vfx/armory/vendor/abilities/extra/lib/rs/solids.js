// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
/*!
 * rollshade-gl / solids — instanced rocks, rock spikes and ice crystals.
 *
 * Ported from rollshade's `src/runtime/solids.ts` (https://github.com/tsuyatt/rollshade):
 * same procedural geometry and simulation; the node materials become
 * MeshStandardMaterial with a small onBeforeCompile patch for the crystal glow.
 *
 * MIT License — Copyright (c) 2026 tsuyatt. GLSL port for the VFX Armory "extra" pack.
 */
import {
  BufferGeometry,
  Color,
  DodecahedronGeometry,
  DynamicDrawUsage,
  Euler,
  Float32BufferAttribute,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Vector3
} from 'three';
import { LAYER } from '../../../../core/Layers.js';

const m4 = new Matrix4();
const s3 = new Vector3();
const dq = new Quaternion();
const outBack = (t) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);

class Solids {
  constructor(geometry, material, max) {
    this.max = max;
    this.list = [];
    this.floorY = 0;
    this.mesh = new InstancedMesh(geometry, material, max);
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.setColorAt(0, new Color(1, 1, 1));
    this.mesh.instanceColor.setUsage(DynamicDrawUsage);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.layers.set(LAYER.VFX);
  }

  spawn(o) {
    if (this.list.length >= this.max) this.list.shift();
    const size = typeof o.size === 'number' ? new Vector3(o.size, o.size, o.size) : o.size.clone();
    this.list.push({
      p: o.p.clone(),
      v: o.v?.clone() ?? new Vector3(),
      size,
      q: o.quat?.clone() ?? new Quaternion().setFromEuler(new Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6)),
      axis: new Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(),
      spin: o.spin ?? 0,
      age: 0,
      life: o.life,
      grow: o.grow ?? 0,
      shrink: o.shrink ?? 0.25,
      gravity: o.gravity ?? 0,
      bounce: o.bounce ?? 0.3,
      onLand: o.onLand,
      drive: o.drive,
      color: o.color?.clone() ?? new Color(1, 1, 1)
    });
  }

  update(dt) {
    let n = 0;
    this.list = this.list.filter((s) => (s.age += dt) < s.life);
    for (const s of this.list) {
      if (s.drive && !s.drive(s.p, s.v, s.age, dt)) s.drive = undefined;
      if (!s.drive && (s.gravity || s.v.lengthSq() > 0)) {
        s.v.y -= s.gravity * dt;
        s.p.addScaledVector(s.v, dt);
        const bottom = this.floorY + s.size.y * 0.3;
        if (s.gravity && s.p.y < bottom && s.v.y < 0) {
          const speed = -s.v.y;
          s.p.y = bottom;
          s.v.y = speed * s.bounce;
          s.v.x *= 0.6;
          s.v.z *= 0.6;
          s.spin *= 0.6;
          if (speed > 2.5) s.onLand?.(s.p, speed);
          if (speed < 0.8) s.v.set(0, 0, 0);
        }
      }
      if (s.spin) s.q.multiply(dq.setFromAxisAngle(s.axis, s.spin * dt));
      const k = s.age / s.life;
      let scale = 1;
      if (s.grow > 0 && s.age < s.grow) scale = Math.max(outBack(s.age / s.grow), 0.001);
      if (k > 1 - s.shrink) scale *= Math.max((1 - k) / s.shrink, 0.001);
      m4.compose(s.p, s.q, s3.copy(s.size).multiplyScalar(scale));
      this.mesh.setMatrixAt(n, m4);
      this.mesh.setColorAt(n, s.color);
      n++;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
  }

  clear() {
    this.list = [];
    this.mesh.count = 0;
  }

  get size() {
    return this.list.length;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}

function rand(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function finish(g) {
  const flat = g.index ? g.toNonIndexed() : g;
  flat.computeVertexNormals();
  return flat;
}

function column(rings, sides, tip, r, jag) {
  const pos = [];
  const ringPts = rings.map(({ y, r: rad }, j) => {
    const twist = r() * Math.PI * 2;
    return Array.from({ length: sides }, (_, i) => {
      const a = twist * (j ? 0.15 : 0) + (i / sides) * Math.PI * 2 + (r() - 0.5) * 0.5;
      const rr = rad * (1 - jag * 0.5 + r() * jag);
      return new Vector3(Math.cos(a) * rr, y + (r() - 0.5) * jag * 0.15, Math.sin(a) * rr);
    });
  });
  const tri = (a, b, c) => pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  for (let j = 0; j < ringPts.length - 1; j++) {
    const lo = ringPts[j];
    const hi = ringPts[j + 1];
    for (let i = 0; i < sides; i++) {
      const i2 = (i + 1) % sides;
      tri(lo[i], hi[i], lo[i2]);
      tri(lo[i2], hi[i], hi[i2]);
    }
  }
  const top = ringPts[ringPts.length - 1];
  for (let i = 0; i < sides; i++) tri(top[i], tip, top[(i + 1) % sides]);
  const bottom = ringPts[0];
  const c = new Vector3(0, rings[0].y, 0);
  for (let i = 0; i < sides; i++) tri(bottom[(i + 1) % sides], c, bottom[i]);
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  return finish(g);
}

export function crystalGeometries(count = 4) {
  return Array.from({ length: count }, (_, k) => {
    const r = rand(1000 + k * 77);
    const sides = 4 + Math.floor(r() * 4);
    const body = 0.45 + r() * 0.35;
    const w = 0.42 + r() * 0.16;
    const rings = [
      { y: 0, r: w * (0.85 + r() * 0.2) },
      { y: body * (0.5 + r() * 0.2), r: w * (0.95 + r() * 0.15) },
      { y: body, r: w * (0.8 + r() * 0.15) }
    ];
    const tip = new Vector3((r() - 0.5) * 0.25, 1, (r() - 0.5) * 0.25);
    return column(rings, sides, tip, r, 0.25);
  });
}

export function rockSpikeGeometries(count = 4) {
  return Array.from({ length: count }, (_, k) => {
    const r = rand(2000 + k * 131);
    const sides = 5 + Math.floor(r() * 3);
    const rings = [
      { y: -0.1, r: 0.62 + r() * 0.1 },
      { y: 0.25 + r() * 0.1, r: 0.46 + r() * 0.1 },
      { y: 0.55 + r() * 0.1, r: 0.3 + r() * 0.08 },
      { y: 0.8 + r() * 0.05, r: 0.14 + r() * 0.06 }
    ];
    const tip = new Vector3((r() - 0.5) * 0.3, 1, (r() - 0.5) * 0.3);
    return column(rings, sides, tip, r, 0.4);
  });
}

export function rockGeometries(count = 4) {
  return Array.from({ length: count }, (_, k) => {
    const r = rand(3000 + k * 53);
    const g = k % 2 ? new IcosahedronGeometry(1, 0) : new DodecahedronGeometry(1, 0);
    const pos = g.getAttribute('position');
    const sx = 0.75 + r() * 0.5;
    const sy = 0.5 + r() * 0.45;
    const sz = 0.75 + r() * 0.5;
    const seen = new Map();
    for (let i = 0; i < pos.count; i++) {
      const key = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
      if (!seen.has(key)) seen.set(key, 0.7 + r() * 0.55);
      const f = seen.get(key);
      pos.setXYZ(i, pos.getX(i) * f * sx, pos.getY(i) * f * sy, pos.getZ(i) * f * sz);
    }
    return finish(g);
  });
}

export class SolidSet {
  constructor(geometries, material, max) {
    const per = Math.ceil(max / geometries.length);
    this.sets = geometries.map((g) => new Solids(g, material(), per));
  }

  set floorY(y) {
    for (const s of this.sets) s.floorY = y;
  }

  spawn(o, variant) {
    const i = variant ?? Math.floor(Math.random() * this.sets.length);
    this.sets[i % this.sets.length].spawn(o);
  }

  update(dt) {
    for (const s of this.sets) s.update(dt);
  }

  clear() {
    for (const s of this.sets) s.clear();
  }

  get size() {
    return this.sets.reduce((n, s) => n + s.size, 0);
  }

  get meshes() {
    return this.sets.map((s) => s.mesh);
  }

  dispose() {
    for (const s of this.sets) s.dispose();
  }
}

export function rockMaterial() {
  const m = new MeshStandardMaterial({ roughness: 0.9, metalness: 0, flatShading: true });
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vRsY;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRsY = position.y;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vRsY;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= mix(0.7, 1.0, vRsY * 0.5 + 0.5);');
  };
  m.customProgramCacheKey = () => 'rs-rock';
  return m;
}

export function crystalMaterial() {
  const m = new MeshStandardMaterial({ roughness: 0.15, metalness: 0.1, flatShading: true, transparent: true, opacity: 0.92, color: 0x8c8c8c });
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vRsY;\nvarying vec3 vRsTint;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRsY = position.y;\n#ifdef USE_INSTANCING_COLOR\nvRsTint = instanceColor;\n#else\nvRsTint = vec3(1.0);\n#endif');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vRsY;\nvarying vec3 vRsTint;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = vec3(0.55);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += (vRsY * 0.9 + 0.15) * 0.9 * vRsTint;');
  };
  m.customProgramCacheKey = () => 'rs-crystal';
  return m;
}
