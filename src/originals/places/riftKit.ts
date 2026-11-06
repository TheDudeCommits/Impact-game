import * as THREE from 'three';
import type { Bucket, Sculpt } from '../../render/rift/sculpt';

const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _e = new THREE.Euler();
const _m = new THREE.Matrix4();

/** A frame to build in: its shapes go into the Sculpt at the frame's place. Turns are yaw (y), then pitch (x), then roll
 *  (z), as Sculpt's own. */
export class Rig {
  constructor(readonly k: Sculpt, readonly m = new THREE.Matrix4()) {}
  /** A frame at (x, y, z) in this one, turned (rx, ry, rz), scaled `s`. */
  at(x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, s = 1) {
    _m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz, 'YXZ')), _s.set(s, s, s));
    return new Rig(this.k, this.m.clone().multiply(_m));
  }
  use(bucket: Bucket, hex: number, jitter = .08) { this.k.use(bucket, hex, jitter); return this; }
  private place() {
    this.m.decompose(_p, _q, _s);
    _e.setFromQuaternion(_q, 'YXZ');
    return { x: _p.x, y: _p.y, z: _p.z, rx: _e.x, ry: _e.y, rz: _e.z, s: _s.x };
  }
  /** A box `w` x `h` x `d`, its base centred on this frame's origin. */
  box(w: number, h: number, d: number) { const t = this.place(); this.k.box(t.x, t.y, t.z, w * t.s, h * t.s, d * t.s, t.ry, t.rx, t.rz); return this; }
  /** A cylinder up this frame's y (radius `r` at its foot, `r * top` at its head). */
  cyl(r: number, h: number, sides = 10, top = 1) { const t = this.place(); this.k.cylinder(t.x, t.y, t.z, r * t.s, h * t.s, sides, t.ry, t.rx, t.rz, top); return this; }
  cone(r: number, h: number, sides = 8) { return this.cyl(r, h, sides, 0); }
  /** A ball (Sculpt's are not turned: `sy` squashes it along the world's up). */
  sphere(r: number, sy = 1) { const t = this.place(); this.k.sphere(t.x, t.y, t.z, r * t.s, sy); return this; }
  /** A geometry of this kit's own (its base at its origin), scaled (sx, sy, sz). */
  add(geometry: THREE.BufferGeometry, sx = 1, sy = 1, sz = 1) { const t = this.place(); this.k.add(geometry, t.x, t.y, t.z, t.rx, t.ry, t.rz, sx * t.s, sy * t.s, sz * t.s); return this; }
}

/** A frame in the world. */
export const rig = (k: Sculpt, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, s = 1) => new Rig(k).at(x, y, z, rx, ry, rz, s);

/** A heater shield, one metre wide and 1.25 high, its point at the origin and its face toward +z, dished a little. */
export const SHIELD = (() => {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.quadraticCurveTo(.46, .32, .5, .9); s.lineTo(.5, 1.18); s.quadraticCurveTo(0, 1.27, -.5, 1.18); s.lineTo(-.5, .9);
  s.quadraticCurveTo(-.46, .32, 0, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: .07, bevelEnabled: false, curveSegments: 6 });
  g.translate(0, 0, -.035);
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) - p.getX(i) * p.getX(i) * .3);
  g.computeVertexNormals();
  return g;
})();

/** A round shield: a disc a metre across, a hand deep, its face toward +z, its rim at the origin's level (base at y 0). */
export const ROUNDEL = (() => {
  const g = new THREE.CylinderGeometry(.5, .5, .08, 18, 1).rotateX(Math.PI / 2).translate(0, .5, 0);
  g.computeVertexNormals();
  return g;
})();

/** One link of a chain: an oval ring two units long, one across, lying in its xy plane. */
export const LINK = (() => {
  const g = new THREE.TorusGeometry(.5, .16, 5, 12);
  g.scale(1.45, 1, 1);
  g.computeVertexNormals();
  return g;
})();

/** A chain from a to b (world metres), links `size` long, sagging `sag` metres at its middle, each link turned a quarter
 *  from the last. Sculpt's current bucket and colour. */
export function chain(k: Sculpt, a: THREE.Vector3, b: THREE.Vector3, size: number, sag = 0) {
  const span = a.distanceTo(b), n = Math.max(2, Math.round(span / (size * .78)));
  const at = (t: number) => new THREE.Vector3().lerpVectors(a, b, t).add(new THREE.Vector3(0, -sag * 4 * t * (1 - t), 0));
  const dir = new THREE.Vector3(), q = new THREE.Quaternion(), twist = new THREE.Quaternion(), x = new THREE.Vector3(1, 0, 0);
  for (let i = 0; i < n; i++) {
    const p0 = at(i / n), p1 = at((i + 1) / n), mid = p0.clone().add(p1).multiplyScalar(.5);
    dir.subVectors(p1, p0).normalize();
    q.setFromUnitVectors(x, dir).multiply(twist.setFromAxisAngle(x, i % 2 ? Math.PI / 2 : 0));
    _e.setFromQuaternion(q, 'YXZ');
    k.add(LINK, mid.x, mid.y, mid.z, _e.x, _e.y, _e.z, size / 1.45 * 1.25, size / 1.45 * 1.25, size / 1.45 * 1.25);
  }
}

/** A seeded random, 0-1. */
export function seeded(seed: number) {
  let s = Math.floor(seed) % 2147483646 + 1;
  return () => { s = s * 16807 % 2147483647; return (s - 1) / 2147483646; };
}

/** A smooth value noise, 0-1. */
export function smooth(seed: number) {
  const h = (x: number, z: number) => { const v = Math.sin(x * 127.1 + z * 311.7 + seed * 17.3) * 43758.5453; return v - Math.floor(v); };
  return (x: number, z: number) => {
    const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j, u = fx * fx * (3 - 2 * fx), w = fz * fz * (3 - 2 * fz);
    return (h(i, j) * (1 - u) + h(i + 1, j) * u) * (1 - w) + (h(i, j + 1) * (1 - u) + h(i + 1, j + 1) * u) * w;
  };
}
