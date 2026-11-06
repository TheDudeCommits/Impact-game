import * as THREE from 'three';
import { DREAM_IMPACT } from '../dreamFlag';

const STONE = [0x8c8172, 0xa0968a, 0x6e665a, 0xb3a894, 0x7b7466];
const GRAVITY = 13.5;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _dq = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _axis = new THREE.Vector3(), _c = new THREE.Color();

/** A low-poly rock: an icosahedron with its corners pushed about, so twenty
 *  flat faces catch the toon light as a chipped stone rather than a ball. */
function rockGeometry() {
  const geometry = new THREE.IcosahedronGeometry(1, 0), position = geometry.attributes.position as THREE.BufferAttribute;
  const offsets = new Map<string, number>();
  for (let i = 0; i < position.count; i++) {
    const key = `${position.getX(i).toFixed(3)},${position.getY(i).toFixed(3)},${position.getZ(i).toFixed(3)}`;
    let push = offsets.get(key);
    if (push === undefined) { push = .72 + ((offsets.size * 7919) % 97) / 97 * .5; offsets.set(key, push); }
    position.setXYZ(i, position.getX(i) * push, position.getY(i) * push * .78, position.getZ(i) * push);
  }
  geometry.computeVertexNormals();
  return geometry;
}

/** The colour pass, iteration eight: a chunk thrown at the lens is drawn smaller the nearer it comes, and gone
 *  before it reaches it - a stone a metre from the camera filled a quarter of the frame as one flat brown polygon.
 *  Scaled about its own centre, on the GPU, from wherever the camera is (the fight's, a finisher's cut): full size from
 *  NEAR[1] metres out, nothing at NEAR[0]. */
export const DEBRIS_NEAR = [1, 3.2] as const;
const NEAR_GLSL = `{
  vec4 debrisCentre = modelMatrix * instanceMatrix * vec4( 0.0, 0.0, 0.0, 1.0 );
  transformed *= smoothstep( ${DEBRIS_NEAR[0].toFixed(2)}, ${DEBRIS_NEAR[1].toFixed(2)}, distance( debrisCentre.xyz, cameraPosition ) );
}`;

const toonRamp = new THREE.DataTexture(new Uint8Array([96, 170, 255]), 3, 1, THREE.RedFormat);
toonRamp.minFilter = toonRamp.magFilter = THREE.NearestFilter; toonRamp.generateMipmaps = false; toonRamp.needsUpdate = true;

/** The dream loop, round 75: each stone cut its own way - a slab (`slab` of them), a long shard (`shard`), or else a
 *  chunk - by a scale along its own axes within these ranges, about the same volume as the chunk it was (its scales'
 *  product near one). A blind critic, of the slam: "identical hexagon rocks", where it wanted "irregular, asymmetric cel
 *  shards": one stone shape, the same for every one, read as stock geometry. With the switch off, every stone as it was. */
export const STONE_CUT = { slab: .4, shard: .3, slabFlat: [.42, .62], slabWide: [1.12, 1.45], shardLong: [1.35, 1.75], shardThin: [.62, .82], chunk: [.85, 1.15] } as const;
/** A stone's own numbers, off a count of the stones cut so far rather than Math.random: the fight's other effects draw
 *  the same numbers they did, so a fixed-clock film of it differs in its stones alone. */
function cutHash(n: number) { let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16; return (x >>> 0) / 4294967296; }
const span = (r: readonly [number, number], u: number) => r[0] + u * (r[1] - r[0]);

/** Rock chunks thrown out of a floor or a wall by a heavy blow.
 *
 *  A bounded pool of instanced low-poly stones with a plain ballistic step:
 *  gravity, a bounce that loses most of its speed, friction on the floor, and
 *  a shrink into the ground at the end of their life instead of a fade, so
 *  they stay opaque and never need sorting. Each chunk carries an inverted
 *  ink hull - the second mesh shares the first's instance matrices - so the
 *  stones are outlined like everything else in the frame.
 */
export class Debris {
  readonly mesh: THREE.InstancedMesh;
  readonly ink: THREE.InstancedMesh;
  private geometry = rockGeometry();
  private px: Float32Array; private py: Float32Array; private pz: Float32Array;
  private vx: Float32Array; private vy: Float32Array; private vz: Float32Array;
  private floor: Float32Array; private age: Float32Array; private life: Float32Array; private size: Float32Array;
  private ax: Float32Array; private ay: Float32Array; private az: Float32Array; private spin: Float32Array;
  private rot: Float32Array;
  /** How much of gravity each chunk feels: 1 thrown, below 0 lifted (`lift`). */
  private weight: Float32Array;
  /** Round 75: each stone's scale along its own axes (STONE_CUT). */
  private cutX: Float32Array; private cutY: Float32Array; private cutZ: Float32Array;
  private columns: Float32Array[];
  private active = 0;
  constructor(scene: THREE.Scene, readonly capacity = 144) {
    const n = capacity, f = () => new Float32Array(n);
    this.px = f(); this.py = f(); this.pz = f(); this.vx = f(); this.vy = f(); this.vz = f(); this.floor = f(); this.age = f(); this.life = f(); this.size = f();
    this.ax = f(); this.ay = f(); this.az = f(); this.spin = f(); this.rot = new Float32Array(n * 4); this.weight = f();
    this.cutX = f().fill(1); this.cutY = f().fill(1); this.cutZ = f().fill(1);
    this.columns = [this.px, this.py, this.pz, this.vx, this.vy, this.vz, this.floor, this.age, this.life, this.size, this.ax, this.ay, this.az, this.spin, this.weight, this.cutX, this.cutY, this.cutZ];
    const stone = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: toonRamp });
    stone.name = 'DebrisStone';
    stone.onBeforeCompile = shader => { shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\n${NEAR_GLSL}`); };
    stone.customProgramCacheKey = () => 'debris-stone-near-v1';
    this.mesh = new THREE.InstancedMesh(this.geometry, stone, n);
    this.mesh.name = 'vfx-debris'; this.mesh.frustumCulled = false; this.mesh.count = 0;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.setColorAt(0, _c.setHex(STONE[0]));
    const hull = new THREE.MeshBasicMaterial({ color: 0x0b0d12, side: THREE.BackSide });
    hull.name = 'DebrisInk';
    // Pushed out along the normal in the stone's own space, so the line is a
    // fixed fraction of each chunk whatever size it was thrown at.
    // Shrunk near the lens with its stone, after the push, so the line stays the same fraction of it.
    hull.onBeforeCompile = shader => { shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\ntransformed += normal * .16;\n${NEAR_GLSL}`); };
    hull.customProgramCacheKey = () => 'debris-ink-near-v2';
    this.ink = new THREE.InstancedMesh(this.geometry, hull, n);
    this.ink.name = 'vfx-debris-ink'; this.ink.frustumCulled = false; this.ink.count = 0;
    this.ink.instanceMatrix = this.mesh.instanceMatrix;
    scene.add(this.mesh, this.ink);
  }

  /** One chunk. `floor` is the height it bounces on, `size` its radius. */
  spawn(x: number, y: number, z: number, vx: number, vy: number, vz: number, size: number, floor: number, life = 1.8) {
    let i = this.active;
    if (i >= this.capacity) {
      // Full: recycle the oldest rather than dropping the newest blow's rubble.
      let oldest = 0; for (let k = 1; k < this.capacity; k++) if (this.age[k] > this.age[oldest]) oldest = k; i = oldest;
    } else this.active++;
    this.px[i] = x; this.py[i] = Math.max(y, floor + size); this.pz[i] = z; this.vx[i] = vx; this.vy[i] = vy; this.vz[i] = vz;
    this.floor[i] = floor; this.age[i] = 0; this.life[i] = life * (.8 + Math.random() * .4); this.size[i] = size; this.weight[i] = 1;
    _axis.set(Math.random() - .5, Math.random() - .5, Math.random() - .5).normalize();
    this.ax[i] = _axis.x; this.ay[i] = _axis.y; this.az[i] = _axis.z; this.spin[i] = 6 + Math.random() * 14;
    _q.setFromAxisAngle(_axis, Math.random() * 6.28);
    this.rot[i * 4] = _q.x; this.rot[i * 4 + 1] = _q.y; this.rot[i * 4 + 2] = _q.z; this.rot[i * 4 + 3] = _q.w;
    this.mesh.setColorAt(i, _c.setHex(STONE[(Math.random() * STONE.length) | 0]));
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    // (Round 75: cut its own way, on its own numbers - cutHash.)
    if (DREAM_IMPACT) {
      const n = this.cuts++ * 4, pick = cutHash(n), u = cutHash(n + 1), v = cutHash(n + 2), w = cutHash(n + 3); let x: number, y: number, z: number;
      if (pick < STONE_CUT.slab) { x = span(STONE_CUT.slabWide, u); y = span(STONE_CUT.slabFlat, v); z = span(STONE_CUT.slabWide, w) * .85; }
      else if (pick < STONE_CUT.slab + STONE_CUT.shard) { y = span(STONE_CUT.shardLong, u); x = span(STONE_CUT.shardThin, v); z = span(STONE_CUT.shardThin, w); }
      else { x = span(STONE_CUT.chunk, u); y = span(STONE_CUT.chunk, v); z = span(STONE_CUT.chunk, w); }
      const k = 1 / Math.cbrt(x * y * z);
      this.cutX[i] = x * k; this.cutY[i] = y * k; this.cutZ[i] = z * k;
    } else { this.cutX[i] = this.cutY[i] = this.cutZ[i] = 1; }
    this.lastSpawned = i;
  }

  /** A ring or a cone of chunks out of a point on a surface. `nx,ny,nz` is
   *  the surface normal they are thrown along; `spread` how far off it. */
  burst(count: number, x: number, y: number, z: number, nx: number, ny: number, nz: number, speed: number, spread: number, size: number, floor: number, life = 1.8) {
    for (let k = 0; k < count; k++) {
      const a = Math.random() * Math.PI * 2, tilt = spread * (.35 + Math.random() * .65);
      // A direction in a cone about the normal.
      _axis.set(nx, ny, nz).normalize();
      const t1x = Math.abs(ny) < .99 ? -nz : 0, t1y = Math.abs(ny) < .99 ? 0 : nz, t1z = Math.abs(ny) < .99 ? nx : -ny;
      _p.set(t1x, t1y, t1z).normalize(); _s.crossVectors(_axis, _p);
      const c = Math.cos(tilt), s = Math.sin(tilt), u = Math.cos(a) * s, v = Math.sin(a) * s, sp = speed * (.55 + Math.random() * .6);
      const dx = _axis.x * c + _p.x * u + _s.x * v, dy = _axis.y * c + _p.y * u + _s.y * v, dz = _axis.z * c + _p.z * u + _s.z * v;
      this.spawn(x + dx * .15, y + dy * .15, z + dz * .15, dx * sp, dy * sp, dz * sp, size * (.55 + Math.random() * .7), floor, life);
    }
  }

  /** The power-up pass: the floor coming apart under a fighter powering up - chunks prised out of a ring round
   *  (x, z) that rise slowly, turning, and hang, until `blast` throws them or they sink back at the end of `life`.
   *  `rise` is their first climb, metres a second. */
  lift(count: number, x: number, z: number, inner: number, outer: number, size: number, floor: number, life: number, rise = 1.4) {
    for (let k = 0; k < count; k++) {
      const a = Math.random() * Math.PI * 2, r = inner + Math.random() * (outer - inner);
      this.spawn(x + Math.cos(a) * r, floor, z + Math.sin(a) * r, Math.cos(a) * .15, rise * (.5 + Math.random() * .8), Math.sin(a) * .15, size * (.4 + Math.random() * .8), floor, life);
      const i = this.lastSpawned;
      this.weight[i] = -.02 - Math.random() * .05; this.spin[i] = 1.2 + Math.random() * 2.6;
    }
  }
  /** Throw every lifted chunk within `radius` of (x, z) out and up: the power-up's release. */
  blast(x: number, y: number, z: number, radius: number, speed: number) {
    for (let i = 0; i < this.active; i++) {
      if (this.weight[i] >= 1) continue;
      const dx = this.px[i] - x, dz = this.pz[i] - z, d = Math.hypot(dx, dz);
      if (d > radius) continue;
      const k = speed * (.6 + Math.random() * .7) / Math.max(.3, d);
      this.weight[i] = 1; this.vx[i] = dx * k; this.vz[i] = dz * k; this.vy[i] = speed * (.35 + Math.random() * .5) + (this.py[i] - y) * .5;
      this.spin[i] = 8 + Math.random() * 12; this.life[i] = Math.max(this.life[i], this.age[i] + 1.2 + Math.random() * .6);
    }
  }
  private lastSpawned = 0;
  /** Round 75: how many stones have been cut (cutHash). */
  private cuts = 0;

  update(dt: number) {
    if (!this.active) { this.mesh.count = this.ink.count = 0; return; }
    const step = Math.min(dt, 1 / 30);
    for (let i = 0; i < this.active; i++) {
      this.age[i] += step;
      if (this.age[i] >= this.life[i]) { this.swap(i, --this.active); i--; continue; }
      const r = this.size[i] * .7, w = this.weight[i];
      this.vy[i] -= GRAVITY * w * step;
      // A lifted chunk hangs in the air the power holds it in rather than accelerating away.
      if (w < 0) { const hold = Math.exp(-step * 1.6); this.vx[i] *= hold; this.vy[i] *= hold; this.vz[i] *= hold; }
      this.px[i] += this.vx[i] * step; this.py[i] += this.vy[i] * step; this.pz[i] += this.vz[i] * step;
      if (this.py[i] - r < this.floor[i]) {
        this.py[i] = this.floor[i] + r;
        if (this.vy[i] < 0) {
          // A bounce that keeps a third of the fall, and a skid that keeps a
          // little over half of the run, until the stone is at rest.
          this.vy[i] = -this.vy[i] * .34; this.vx[i] *= .58; this.vz[i] *= .58; this.spin[i] *= .55;
          if (this.vy[i] < .7) this.vy[i] = 0;
        }
        const friction = Math.exp(-step * 5); this.vx[i] *= friction; this.vz[i] *= friction; this.spin[i] *= friction;
      }
      _q.set(this.rot[i * 4], this.rot[i * 4 + 1], this.rot[i * 4 + 2], this.rot[i * 4 + 3]);
      _axis.set(this.ax[i], this.ay[i], this.az[i]);
      _q.multiply(_dq.setFromAxisAngle(_axis, this.spin[i] * step));
      this.rot[i * 4] = _q.x; this.rot[i * 4 + 1] = _q.y; this.rot[i * 4 + 2] = _q.z; this.rot[i * 4 + 3] = _q.w;
      const left = this.life[i] - this.age[i], shrink = Math.min(1, left / .45) * Math.min(1, this.age[i] / .04 + .3);
      _s.setScalar(this.size[i] * shrink);
      if (DREAM_IMPACT) _s.set(_s.x * this.cutX[i], _s.y * this.cutY[i], _s.z * this.cutZ[i]);
      this.mesh.setMatrixAt(i, _m.compose(_p.set(this.px[i], this.py[i] - (1 - Math.min(1, left / .45)) * r, this.pz[i]), _q, _s));
    }
    this.mesh.count = this.ink.count = this.active;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  private swap(a: number, b: number) {
    if (a === b) return;
    for (const column of this.columns) column[a] = column[b];
    for (let k = 0; k < 4; k++) this.rot[a * 4 + k] = this.rot[b * 4 + k];
    if (this.mesh.instanceColor) { this.mesh.getColorAt(b, _c); this.mesh.setColorAt(a, _c); this.mesh.instanceColor.needsUpdate = true; }
  }

  get count() { return this.active; }
  clear() { this.active = 0; this.mesh.count = this.ink.count = 0; }
  dispose() { this.mesh.removeFromParent(); this.ink.removeFromParent(); this.geometry.dispose(); (this.mesh.material as THREE.Material).dispose(); (this.ink.material as THREE.Material).dispose(); this.mesh.dispose(); }
}
