import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { DressContext } from '../../render/stages/dressing';
import { stageMaterial, wearGround } from '../../render/stages/build';
import { heroAir } from '../../render/stages/hero';
import { cellEdge, drawn, rand } from './remake';

type V3 = THREE.Vector3 | readonly [number, number, number];
const v3 = (p: V3) => p instanceof THREE.Vector3 ? p.clone() : new THREE.Vector3(p[0], p[1], p[2]);
export type Tint = number | ((x: number, y: number, z: number) => number);

export interface ForgeMaterial {
  map?: THREE.Texture | null; tile?: number; roughness?: number; metalness?: number; emissive?: number; emissiveIntensity?: number;
  /** stages-old (4 November 2026): a photographed surface's relief and roughness (src/originals/places/cc0.ts `surface`),
   *  laid with the map by the same world-metre mapping. */
  normalMap?: THREE.Texture | null; roughnessMap?: THREE.Texture | null; normalScale?: number;
  /** stages-old: the pieces' tints taken this share of the way to white (a photographed surface brings its own colour; the
   *  tints written for r8's near-white painted maps would sink it). */
  lift?: number;
  /** stages-old: the material's colour scaled by this (a photographed surface is darker on average than a painted detail map
   *  near white: the gain brings the pieces' tints back to the brightness they were written for). */
  gain?: number;
  flat?: boolean; side?: THREE.Side; air?: number; shadow?: boolean; transparent?: boolean; opacity?: number; fog?: boolean;
  /** Ground wear (render/stages/build.ts wearGround) on this material, by key. */
  wear?: Parameters<typeof wearGround>[1];
  /** Unlit (a glow, a lamp's glass). */
  basic?: boolean;
}

interface Bucket { material: THREE.Material; tile: number; geoms: THREE.BufferGeometry[]; shadow: boolean; lift: number }

export class Forge {
  private readonly buckets = new Map<string, Bucket>();
  readonly meshes: THREE.Mesh[] = [];
  constructor(readonly c: DressContext, readonly name: string) {}

  /** A material, by key: its detail map tiled every `tile` metres by each face's facing, its colour the vertex colours. */
  mat(key: string, o: ForgeMaterial = {}) {
    let material: THREE.Material;
    if (o.basic) {
      material = new THREE.MeshBasicMaterial({ name: `${this.name} ${key}`, vertexColors: true, map: o.map ?? null, transparent: !!o.transparent, opacity: o.opacity ?? 1,
        side: o.side ?? THREE.FrontSide, fog: o.fog ?? true, depthWrite: !o.transparent, toneMapped: false });
    } else {
      const m = stageMaterial(this.c.stage, `${this.name} ${key}`, { map: o.map ?? null, color: 0xffffff, vertexColors: true, roughness: o.roughness ?? .9,
        metalness: o.metalness ?? 0, flatShading: !!o.flat, side: o.side ?? THREE.FrontSide, emissive: o.emissive ?? 0x000000, emissiveIntensity: o.emissiveIntensity ?? 1,
        transparent: !!o.transparent, opacity: o.opacity ?? 1,
        ...(o.normalMap ? { normalMap: o.normalMap, normalScale: new THREE.Vector2(o.normalScale ?? 1, o.normalScale ?? 1) } : {}),
        ...(o.roughnessMap ? { roughnessMap: o.roughnessMap } : {}) });
      if (o.gain) m.color.setScalar(o.gain);
      if (o.wear) wearGround(m, o.wear);
      material = o.air !== undefined ? heroAir(m, o.air) : m;
    }
    this.buckets.set(key, { material, tile: o.tile ?? 4, geoms: [], shadow: !!o.shadow, lift: o.lift ?? 0 });
    return material;
  }

  /** A geometry already in world metres, in the material `key`, coloured `tint`. */
  add(key: string, geometry: THREE.BufferGeometry, tint: Tint = 0xffffff) {
    const bucket = this.buckets.get(key);
    if (!bucket) throw new Error(`Forge ${this.name}: no material ${key}`);
    let g = geometry.index ? geometry.toNonIndexed() : geometry;
    if (g !== geometry) geometry.dispose();
    for (const name of Object.keys(g.attributes)) if (name !== 'position') g.deleteAttribute(name);
    g.computeVertexNormals();
    worldUv(g, bucket.tile);
    paint(g, tint, bucket.lift);
    bucket.geoms.push(g);
    return g;
  }

  /** A box `w` x `h` x `d`, its base centre at x, y, z, turned `rot` about y (and leant `tilt` about x, `roll` about z). */
  box(key: string, x: number, y: number, z: number, w: number, h: number, d: number, tint: Tint = 0xffffff, o: { rot?: number; tilt?: number; roll?: number } = {}) {
    const g = new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0);
    if (o.tilt) g.rotateX(o.tilt);
    if (o.roll) g.rotateZ(o.roll);
    if (o.rot) g.rotateY(o.rot);
    return this.add(key, g.translate(x, y, z), tint);
  }

  /** A square beam `w` thick from a to b (`d` deep, if not square). */
  beam(key: string, a: V3, b: V3, w: number, tint: Tint = 0xffffff, d = w) {
    const A = v3(a), B = v3(b), dir = new THREE.Vector3().subVectors(B, A), len = dir.length();
    const g = new THREE.BoxGeometry(w, len, d).translate(0, len / 2, 0);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()));
    return this.add(key, g.translate(A.x, A.y, A.z), tint);
  }

  /** A round post or pipe from a to b, radius `r` (`r2` at b). */
  pipe(key: string, a: V3, b: V3, r: number, tint: Tint = 0xffffff, o: { r2?: number; sides?: number } = {}) {
    const A = v3(a), B = v3(b), dir = new THREE.Vector3().subVectors(B, A), len = dir.length();
    const g = new THREE.CylinderGeometry(o.r2 ?? r, r, len, o.sides ?? 8, 1).translate(0, len / 2, 0);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()));
    return this.add(key, g.translate(A.x, A.y, A.z), tint);
  }

  /** A standing cylinder (a tank, a tower, a stack), its base at y. */
  cyl(key: string, x: number, y: number, z: number, rTop: number, rBottom: number, h: number, tint: Tint = 0xffffff, o: { sides?: number; rot?: number; open?: boolean } = {}) {
    const g = new THREE.CylinderGeometry(rTop, rBottom, h, o.sides ?? 12, 1, !!o.open).translate(0, h / 2, 0);
    if (o.rot) g.rotateY(o.rot);
    return this.add(key, g.translate(x, y, z), tint);
  }

  /** A pitched roof: a prism `w` along its ridge, `d` across, `h` from eaves to ridge, its eaves at y; turned `rot`. With
   *  `hip`, the ridge is shortened by that much at each end (a hipped roof). */
  roof(key: string, x: number, y: number, z: number, w: number, d: number, h: number, tint: Tint = 0xffffff, rot = 0, hip = 0) {
    const hw = w / 2, hd = d / 2, rw = Math.max(0, hw - hip);
    const p = [[-hw, 0, -hd], [hw, 0, -hd], [hw, 0, hd], [-hw, 0, hd], [-rw, h, 0], [rw, h, 0]];
    const tris = [[0, 4, 5], [0, 5, 1], [2, 5, 4], [2, 4, 3], [1, 5, 2], [3, 4, 0], [0, 1, 2], [0, 2, 3]];
    const g = fromTris(p, tris).rotateY(rot).translate(x, y, z);
    return this.add(key, g, tint);
  }

  /** A shed roof (one pitch), `w` x `d`, rising `h` toward -z before it is turned `rot`. */
  lean(key: string, x: number, y: number, z: number, w: number, d: number, h: number, tint: Tint = 0xffffff, rot = 0, thick = .2) {
    const g = new THREE.BoxGeometry(w, thick, Math.hypot(d, h)).rotateX(Math.atan2(h, d)).translate(0, h / 2, 0).rotateY(rot).translate(x, y, z);
    return this.add(key, g, tint);
  }

  /** A rough rock: a squashed icosphere `sx` x `sy` x `sz` (half sizes), its points pushed by a seeded noise; base at y. */
  rock(key: string, x: number, y: number, z: number, sx: number, sy: number, sz: number, tint: Tint = 0xffffff, seed = 1, o: { detail?: number; rot?: number; rough?: number; sink?: number } = {}) {
    const g = new THREE.IcosahedronGeometry(1, o.detail ?? 1);
    const p = g.getAttribute('position') as THREE.BufferAttribute, r = rand(seed * 7919 + 13), rough = o.rough ?? .28;
    const bumps = Array.from({ length: 5 }, () => [new THREE.Vector3(r() - .5, r() - .5, r() - .5).normalize(), (r() - .3) * rough * 2] as const);
    const q = new THREE.Vector3();
    // (Shared corners move together: the noise is a function of the point.)
    for (let i = 0; i < p.count; i++) {
      q.fromBufferAttribute(p, i);
      let k = 1;
      for (const [d, a] of bumps) k += a * Math.max(0, q.dot(d)) ** 2;
      k += (Math.sin(q.x * 5.1 + seed) * Math.sin(q.y * 4.3 + seed * 2) * Math.sin(q.z * 3.7)) * rough * .5;
      p.setXYZ(i, q.x * k * sx, Math.max(q.y * k * sy, -sy * (o.sink ?? .3)), q.z * k * sz);
    }
    if (o.rot) g.rotateY(o.rot);
    g.translate(x, y + sy * (o.sink ?? .3), z);
    return this.add(key, g, tint);
  }

  /** A wall standing on a path (x, z points), `h` tall from y, `t` thick (centred on the path). */
  wall(key: string, path: readonly (readonly [number, number])[], y: number, h: number, t: number, tint: Tint = 0xffffff, closed = false) {
    const n = path.length, segs = closed ? n : n - 1;
    for (let i = 0; i < segs; i++) {
      const [x0, z0] = path[i], [x1, z1] = path[(i + 1) % n], len = Math.hypot(x1 - x0, z1 - z0);
      if (len < 1e-3) continue;
      this.box(key, (x0 + x1) / 2, y, (z0 + z1) / 2, len + t * .5, h, t, tint, { rot: -Math.atan2(z1 - z0, x1 - x0) });
    }
  }

  /** A flat polygon (x, z points, wound either way) at height y, facing up: a deck, a plaza, a pool. */
  slab(key: string, path: readonly (readonly [number, number])[], y: number, tint: Tint = 0xffffff, thick = 0) {
    const shape = new THREE.Shape(path.map(([x, z]) => new THREE.Vector2(x, -z)));
    const g = thick > 0 ? new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false }) : new THREE.ShapeGeometry(shape);
    g.rotateX(-Math.PI / 2).translate(0, y - (thick > 0 ? thick : 0) + (thick > 0 ? 0 : 0), 0);
    if (thick > 0) g.translate(0, 0, 0);
    return this.add(key, g, tint);
  }

  /** A height field over a rectangle: a hill, a dune field, a cliff's skirt. `height(x, z)` in metres; `res` metres a cell. */
  terrain(key: string, x0: number, z0: number, x1: number, z1: number, res: number, height: (x: number, z: number) => number, tint: Tint = 0xffffff) {
    const nx = Math.max(1, Math.round((x1 - x0) / res)), nz = Math.max(1, Math.round((z1 - z0) / res));
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0, nx, nz).rotateX(-Math.PI / 2).translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
    const p = g.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) p.setY(i, height(p.getX(i), p.getZ(i)));
    return this.add(key, g, tint);
  }

  /** Every material's pieces as one mesh each, added to the place's root. Returns them. */
  done() {
    for (const [key, bucket] of this.buckets) {
      if (!bucket.geoms.length) continue;
      const geometry = mergeGeometries(bucket.geoms, false);
      bucket.geoms.forEach(g => g.dispose());
      bucket.geoms.length = 0;
      if (!geometry) continue;
      geometry.computeBoundingSphere(); geometry.computeBoundingBox();
      const mesh = new THREE.Mesh(geometry, bucket.material);
      mesh.name = `${this.c.stage}:${this.name} ${key}`;
      mesh.receiveShadow = !(bucket.material instanceof THREE.MeshBasicMaterial);
      mesh.castShadow = false;
      if (bucket.shadow) mesh.userData.placeCaster = true;
      this.c.root.add(mesh);
      this.meshes.push(mesh);
    }
    return this.meshes;
  }
}

/** A geometry from points and triangles. */
export function fromTris(points: readonly (readonly number[])[], tris: readonly (readonly number[])[]) {
  const pos: number[] = [];
  for (const t of tris) for (const i of t) pos.push(points[i][0], points[i][1], points[i][2]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return g;
}

/** Each triangle mapped by its own facing: the two world axes across its normal, over `tile` metres. */
function worldUv(g: THREE.BufferGeometry, tile: number) {
  const p = g.getAttribute('position') as THREE.BufferAttribute, uv = new Float32Array(p.count * 2);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
  for (let t = 0; t + 2 < p.count; t += 3) {
    a.fromBufferAttribute(p, t); b.fromBufferAttribute(p, t + 1); c.fromBufferAttribute(p, t + 2);
    n.subVectors(c, b).cross(b.clone().sub(a)).normalize();
    const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
    for (let k = 0; k < 3; k++) {
      const x = p.getX(t + k), y = p.getY(t + k), z = p.getZ(t + k);
      const [u, v] = ay >= ax && ay >= az ? [x, z] : ax >= az ? [z, y] : [x, y];
      uv[(t + k) * 2] = u / tile; uv[(t + k) * 2 + 1] = v / tile;
    }
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

function paint(g: THREE.BufferGeometry, tint: Tint, lift = 0) {
  const p = g.getAttribute('position') as THREE.BufferAttribute, col = new Float32Array(p.count * 3), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    c.set(typeof tint === 'number' ? tint : tint(p.getX(i), p.getY(i), p.getZ(i)));
    if (lift) c.lerp(WHITE, lift);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
}

const WHITE = new THREE.Color(1, 1, 1);

/** A smooth seeded value noise, 0..1, of a point in metres (`scale` metres a cell). */
export function noise2(seed: number) {
  const h = (x: number, z: number) => { const s = Math.sin(x * 127.1 + z * 311.7 + seed * 17.3) * 43758.5453; return s - Math.floor(s); };
  return (x: number, z: number, scale = 1) => {
    x /= scale; z /= scale;
    const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j, u = fx * fx * (3 - 2 * fx), w = fz * fz * (3 - 2 * fz);
    return (h(i, j) * (1 - u) + h(i + 1, j) * u) * (1 - w) + (h(i, j + 1) * (1 - u) + h(i + 1, j + 1) * u) * w;
  };
}

/** Painted detail maps, near white, so the vertex colours give the hue. Seeded, tiling, no lettering. */
export const detail = {
  /** Cut stone in courses: blocks of a few lengths, mortar joints, each block its own shade, chips and speckle. */
  ashlar(seed = 1, course = 64) {
    return drawn(512, 512, (g, w, h) => {
      const r = rand(seed);
      g.fillStyle = '#8c8680'; g.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += course) {
        let x = -r() * course;
        while (x < w) {
          const len = course * (1 + Math.floor(r() * 3) * .5), k = 200 + Math.floor(r() * 50);
          g.fillStyle = `rgb(${k},${k - 4},${k - 10})`; g.fillRect(x + 2, y + 2, len - 4, course - 4);
          g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(x + 2, y + 2, len - 4, 4);
          g.fillStyle = 'rgba(0,0,0,.1)'; g.fillRect(x + 2, y + course - 7, len - 4, 5);
          x += len;
        }
      }
      speckle(g, w, h, r, 2600, .07);
    });
  },
  /** Boards: long planks with grain, joints and nail heads. */
  planks(seed = 2, width = 42, vertical = false) {
    return drawn(512, 512, (g, w, h) => {
      const r = rand(seed);
      if (vertical) { g.translate(w, 0); g.rotate(Math.PI / 2); }
      for (let y = 0; y < h; y += width) {
        const k = 190 + Math.floor(r() * 55);
        g.fillStyle = `rgb(${k},${k - 10},${k - 22})`; g.fillRect(0, y, w, width);
        for (let i = 0; i < 9; i++) { g.strokeStyle = `rgba(60,40,20,${.08 + r() * .1})`; g.lineWidth = 1 + r() * 1.5; g.beginPath(); const yy = y + r() * width; g.moveTo(0, yy); g.bezierCurveTo(w * .3, yy + (r() - .5) * 8, w * .7, yy + (r() - .5) * 8, w, yy + (r() - .5) * 6); g.stroke(); }
        g.fillStyle = 'rgba(30,20,10,.5)'; g.fillRect(0, y, w, 2);
        const joint = r() * w; g.fillRect(joint, y, 2, width);
        g.fillStyle = 'rgba(40,30,20,.6)'; for (const x of [joint - 8, joint + 10]) { g.beginPath(); g.arc(x, y + width * .3, 2, 0, 7); g.arc(x, y + width * .7, 2, 0, 7); g.fill(); }
      }
    });
  },
  /** Corrugated sheet iron: ridges, sheet joints, rust running down. */
  corrugated(seed = 3) {
    return drawn(512, 512, (g, w, h) => {
      const r = rand(seed);
      for (let x = 0; x < w; x += 8) { const k = 170 + Math.round(Math.sin(x / 8 * Math.PI) * 40); g.fillStyle = `rgb(${k},${k},${k + 4})`; g.fillRect(x, 0, 4, h); g.fillStyle = `rgb(${k - 50},${k - 50},${k - 46})`; g.fillRect(x + 4, 0, 4, h); }
      for (let y = 0; y < h; y += 128) { g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, y, w, 3); }
      for (let i = 0; i < 60; i++) { const x = r() * w, y = r() * h, len = 20 + r() * 120; const grad = g.createLinearGradient(0, y, 0, y + len); grad.addColorStop(0, 'rgba(150,70,30,.55)'); grad.addColorStop(1, 'rgba(150,70,30,0)'); g.fillStyle = grad; g.fillRect(x, y, 3 + r() * 10, len); }
    });
  },
  /** Riveted steel deck plate: tread, seams, rivets, scuffs. */
  plate(seed = 4) {
    return drawn(512, 512, (g, w, h) => {
      const r = rand(seed);
      g.fillStyle = '#c8c8c8'; g.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 16) for (let x = (y / 16) % 2 ? 8 : 0; x < w; x += 16) { g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x + 3, y + 6, 9, 3); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x + 3, y + 9, 9, 2); }
      g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(0, 0, w, 4); g.fillRect(0, 0, 4, h); g.fillRect(0, h / 2, w, 3); g.fillRect(w / 2, 0, 3, h);
      g.fillStyle = 'rgba(30,30,30,.7)'; for (let k = 12; k < w; k += 32) for (const y of [10, h / 2 + 10, h / 2 - 8, h - 8]) { g.beginPath(); g.arc(k, y, 3, 0, 7); g.fill(); g.beginPath(); g.arc(y, k, 3, 0, 7); g.fill(); }
      for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(120,60,30,${.08 + r() * .15})`; g.beginPath(); g.ellipse(r() * w, r() * h, 10 + r() * 40, 6 + r() * 20, r() * 3, 0, 7); g.fill(); }
      speckle(g, w, h, r, 1500, .08);
    });
  },
  /** Brick in stretcher bond. */
  brick(seed = 5) {
    return drawn(512, 512, (g, w, h) => {
      const r = rand(seed), bh = 24, bw = 64;
      g.fillStyle = '#9a948c'; g.fillRect(0, 0, w, h);
      for (let y = 0, row = 0; y < h; y += bh, row++) for (let x = row % 2 ? -bw / 2 : 0; x < w; x += bw) {
        const k = 185 + Math.floor(r() * 60); g.fillStyle = `rgb(${k},${k - 18},${k - 30})`; g.fillRect(x + 2, y + 2, bw - 4, bh - 4);
      }
      speckle(g, w, h, r, 2000, .08);
    });
  },
  /** Packed earth and gravel: grit at three sizes, pebbles, darker wraiths. */
  gravel(seed = 6) {
    return drawn(512, 512, (g, w, h) => {
      const r = rand(seed);
      g.fillStyle = '#c4beb4'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(${r() < .5 ? '90,80,70' : '230,224,214'},${.05 + r() * .08})`; g.beginPath(); g.ellipse(r() * w, r() * h, 20 + r() * 70, 14 + r() * 50, r() * 3, 0, 7); g.fill(); }
      for (let i = 0; i < 1300; i++) { const k = 120 + Math.floor(r() * 120); g.fillStyle = `rgba(${k},${k - 6},${k - 14},.8)`; g.beginPath(); g.arc(r() * w, r() * h, .8 + r() * 3.2, 0, 7); g.fill(); }
      speckle(g, w, h, r, 5000, .1);
    });
  },
  /** Flagstones: cells with dark joints, each its own shade. */
  flags(seed = 7, size = 96) {
    return drawn(512, 512, (g, w, h) => {
      const img = g.createImageData(w, h), d = img.data;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const { edge, shade } = cellEdge(x, y, size, seed);
        const n = Math.sin(x * .9) * Math.sin(y * 1.3) * 6;
        const k = edge < 3 ? 110 : 196 + shade * 50 + n;
        const i = (y * w + x) * 4; d[i] = k; d[i + 1] = k - 4; d[i + 2] = k - 10; d[i + 3] = 255;
      }
      // (cellEdge is not periodic: the joints at the tile's edges are drawn in.)
      g.putImageData(img, 0, 0);
      g.fillStyle = 'rgba(60,56,50,.8)'; g.fillRect(0, 0, w, 2); g.fillRect(0, 0, 2, h);
    });
  },
  /** Slate or tile roofing in rows. */
  slate(seed = 8) {
    return drawn(512, 512, (g, w, h) => {
      const r = rand(seed), rh = 32, tw = 40;
      for (let y = 0, row = 0; y < h; y += rh, row++) for (let x = row % 2 ? -tw / 2 : 0; x < w; x += tw) {
        const k = 160 + Math.floor(r() * 70); g.fillStyle = `rgb(${k},${k},${k + 6})`; g.fillRect(x + 1, y, tw - 2, rh - 2);
        g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(x + 1, y + rh - 6, tw - 2, 4);
      }
    });
  },
  /** Rough rock: strata, cracks, lichen spots. */
  rock(seed = 9) {
    return drawn(512, 512, (g, w, h) => {
      const r = rand(seed);
      for (let y = 0; y < h;) { const band = 8 + r() * 40, k = 160 + Math.floor(r() * 70); g.fillStyle = `rgb(${k},${k - 6},${k - 14})`; g.fillRect(0, y, w, band); y += band; }
      for (let i = 0; i < 30; i++) { g.strokeStyle = 'rgba(30,24,20,.35)'; g.lineWidth = 1 + r() * 1.5; g.beginPath(); let x = r() * w, y = r() * h; g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (r() - .5) * 40; y += 6 + r() * 24; g.lineTo(x, y); } g.stroke(); }
      speckle(g, w, h, r, 4000, .1);
    });
  },
  /** Plain plaster or concrete: soft blotches, stains running down. */
  render(seed = 10) {
    return drawn(512, 512, (g, w, h) => {
      const r = rand(seed);
      g.fillStyle = '#dcd8d0'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(${r() < .5 ? '120,110,100' : '250,248,240'},${.04 + r() * .07})`; g.beginPath(); g.ellipse(r() * w, r() * h, 20 + r() * 80, 10 + r() * 60, r() * 3, 0, 7); g.fill(); }
      for (let i = 0; i < 30; i++) { const x = r() * w, grad = g.createLinearGradient(0, 0, 0, h); grad.addColorStop(0, 'rgba(70,60,50,.16)'); grad.addColorStop(1, 'rgba(70,60,50,0)'); g.fillStyle = grad; g.fillRect(x, 0, 2 + r() * 8, h * (.3 + r() * .7)); }
      speckle(g, w, h, r, 2500, .06);
    });
  },
};

function speckle(g: CanvasRenderingContext2D, w: number, h: number, r: () => number, n: number, alpha: number) {
  for (let i = 0; i < n; i++) { g.fillStyle = r() < .5 ? `rgba(0,0,0,${alpha})` : `rgba(255,255,255,${alpha})`; g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2); }
}

/** A ship's hull, local: its keel along +z from the stern (z = -L/2, a square transom) to the bow (z = L/2, pointed), `B`
 *  across, `D` from the keel up to the deck (y = 0 at the deck), its sheer rising to bow and stern; the deck closed. */
export function hullGeometry(L: number, B: number, D: number, stations = 14, around = 9) {
  const rings: THREE.Vector3[][] = [];
  for (let i = 0; i <= stations; i++) {
    const t = i / stations, s = t * 2 - 1;
    const w = B / 2 * Math.max(.02, t > .5 ? Math.sqrt(1 - ((t - .5) / .5) ** 2.2) : .72 + .28 * Math.sqrt(1 - ((.5 - t) / .5) ** 2));
    const d = D * (1 - .25 * s * s), sheer = .12 * D * s * s + (t > .8 ? (t - .8) * D * .6 : 0);
    const ring: THREE.Vector3[] = [];
    for (let k = 0; k <= around; k++) {
      const a = k / around * Math.PI, c = Math.cos(a), sn = Math.sin(a);
      ring.push(new THREE.Vector3(w * Math.sign(c) * Math.abs(c) ** .55, sheer - d * sn ** .8, (t - .5) * L));
    }
    rings.push(ring);
  }
  const pos: number[] = [], push = (...v: THREE.Vector3[]) => { for (const p of v) pos.push(p.x, p.y, p.z); };
  for (let i = 0; i < stations; i++) for (let k = 0; k < around; k++) {
    const a = rings[i][k], b = rings[i + 1][k], c = rings[i + 1][k + 1], d = rings[i][k + 1];
    push(a, c, b, a, d, c);
  }
  // The deck and the transom.
  for (let i = 0; i < stations; i++) { const a = rings[i][0], b = rings[i + 1][0], c = rings[i + 1][around], d = rings[i][around]; push(a, b, c, a, c, d); }
  const st = rings[0], mid = new THREE.Vector3(0, st[0].y, st[0].z);
  for (let k = 0; k < around; k++) push(mid, st[k], st[k + 1]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return g;
}

/** Points round an ellipse (or a circle), `n` of them, starting at angle `a0`. */
export function ring(cx: number, cz: number, rx: number, rz: number, n: number, a0 = 0): [number, number][] {
  return Array.from({ length: n }, (_, i) => { const a = a0 + i / n * Math.PI * 2; return [cx + Math.cos(a) * rx, cz + Math.sin(a) * rz]; });
}
