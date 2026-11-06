import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { liveQuality } from '../liveQuality';
import { addShaderPatch } from '../look/shaderPatch';
import { lookStageMaterial } from '../look/stageMaterials';
import { stageMaterial } from './build';
import type { DressContext } from './dressing';

/**
 * The look plan, stream E: near scenery round the built places. A fight
 * reads best in a pocket of scenery - boulders, trunks and branches 10-30 m
 * off on every side and overhead, the floor worn - where ours opened onto
 * wide, bare floors. These are the pieces each place's dressing
 * builds that pocket from, every one a single draw however many copies it
 * holds:
 *
 *  - wear on the hard floors near the fight (`wearDecals`): cracks, an
 *    impact's crater, soot and old stains, scorch, dust, stone chips,
 *    splinters and drag marks, off one atlas (scripts/framing/wear_decals.py);
 *  - lines strung overhead (`ropes`) and what hangs off them
 *    (`hangingCloth`): washing, bunting, signal flags, paper streamers,
 *    stirring in the wind (`flutter`);
 *  - timber (`beams`): masts, barricades, scaffolds, posts;
 *  - awnings (`awnings`): sloped striped canvas with a scalloped valance.
 *
 * What a fighter could run into is boxed in src/game/stageProps.ts like the
 * rest of the places' props; everything here is drawn only. Every material is
 * in the stage's look and carries the camera cutaway and stage fade (whatever
 * stands between the lens and the fight dithers away), and the loose detail
 * - decals, washing, bunting - thins with the quality setting (`nearShare`).
 */
export type V3 = readonly [number, number, number];

/** The share of the loose detail a quality setting draws. */
export function nearShare(quality: 'high' | 'medium' | 'low' = currentQuality()) {
  return quality === 'high' ? 1 : quality === 'medium' ? .55 : .25;
}
/** The quality drawn at now (render/liveQuality.ts), not the saved one: a phone left on AUTO is on LOW. */
function currentQuality(): 'high' | 'medium' | 'low' { return liveQuality(); }
/** A share of a list, spread evenly through it: a cut thins the detail, it
 *  never leaves one side bare. */
export function thin<T>(list: readonly T[], share: number): T[] {
  if (share >= 1) return [...list];
  const keep = Math.round(list.length * Math.max(0, share));
  if (!keep) return [];
  return Array.from({ length: keep }, (_, i) => list[Math.floor((i + .5) * list.length / keep)]);
}

/** The atlas's cells (4 x 4, read left to right from the top). */
export const WEAR = {
  crack: [0, 1, 2, 3], crater: [4, 5], scorch: [6], stain: [7, 8, 9], dust: [10, 11], chips: [12, 13], splinters: [14], scuff: [15],
} as const;
export type WearKind = keyof typeof WEAR;

export interface Decal {
  x: number; z: number;
  /** The floor's height here (the decal lies a hair above it). */
  y: number;
  /** Metres across. */
  size: number;
  rot: number;
  cell: number;
  /** Multiplied into the mark's own colour (sRGB hex). */
  tint?: number;
  opacity?: number;
}

/** Marks scattered over a floor: `count` of each kind (scaled by the quality
 *  share), placed off `rng` where `where` accepts them, `size` metres across
 *  (a range), tinted per kind. */
export function scatterWear(rng: () => number, o: {
  kinds: Partial<Record<WearKind, { count: number; size: [number, number]; tint?: number | readonly number[]; opacity?: [number, number] }>>;
  /** A candidate spot: x and z, or undefined to stop trying. */
  spot: () => [number, number];
  /** The floor's height at a spot, or undefined where there is no floor to mark. */
  floor: (x: number, z: number) => number | undefined;
  share?: number;
}): Decal[] {
  const out: Decal[] = [];
  const share = o.share ?? nearShare();
  for (const [kind, k] of Object.entries(o.kinds) as [WearKind, NonNullable<(typeof o.kinds)[WearKind]>][]) {
    const want = Math.round(k.count * share);
    for (let n = 0, tries = 0; n < want && tries < want * 8; tries++) {
      const [x, z] = o.spot();
      const y = o.floor(x, z);
      if (y === undefined) continue;
      const cells = WEAR[kind];
      const tints = k.tint === undefined ? undefined : typeof k.tint === 'number' ? [k.tint] : k.tint;
      const [o0, o1] = k.opacity ?? [.75, 1];
      out.push({ x, z, y, size: k.size[0] + rng() * (k.size[1] - k.size[0]), rot: rng() * Math.PI * 2, cell: cells[Math.floor(rng() * cells.length)],
        tint: tints?.[Math.floor(rng() * tints.length)], opacity: o0 + rng() * (o1 - o0) });
      n++;
    }
  }
  return out;
}

/** The decal sheet, when this checkout carries it. */
const WEAR_DECALS: string | null = null;
/** The wear decals, one draw: flat cards a hair over the floor, blended over
 *  it in the stage's look (the floor's own grade), taking the fighters'
 *  shadows. */
export async function wearDecals(c: DressContext, decals: readonly Decal[], name = 'wear') {
  // (The decal sheet is held back from the public repository: README.md. No wear is drawn without it.)
  if (!decals.length || !WEAR_DECALS) return undefined;
  const map = await c.texture(WEAR_DECALS, { anisotropy: 8 });
  map.wrapS = map.wrapT = THREE.ClampToEdgeWrapping;
  const material = lookStageMaterial(new THREE.MeshStandardMaterial({
    name: 'Wear decals', map, transparent: true, depthWrite: false, roughness: 1, metalness: 0,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
  }), c.stage, name) as THREE.MeshStandardMaterial;
  addShaderPatch(material, 'near-decal-v1', shader => {
    shader.vertexShader = 'attribute vec3 aDecal;\nvarying float vDecalAlpha;\n' + shader.vertexShader.replace('#include <uv_vertex>', `#include <uv_vertex>
      #ifdef USE_MAP
        vMapUv = ( vMapUv + aDecal.xy ) * .25;
      #endif
      vDecalAlpha = aDecal.z;`);
    shader.fragmentShader = 'varying float vDecalAlpha;\n' + shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      diffuseColor.a *= vDecalAlpha;`);
  });
  const geometry = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const cells = new Float32Array(decals.length * 3);
  decals.forEach((d, i) => cells.set([d.cell % 4, 3 - Math.floor(d.cell / 4), d.opacity ?? 1], i * 3));
  geometry.setAttribute('aDecal', new THREE.InstancedBufferAttribute(cells, 3));
  const mesh = new THREE.InstancedMesh(geometry, material, decals.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), s = new THREE.Vector3(), p = new THREE.Vector3(), colour = new THREE.Color();
  decals.forEach((d, i) => {
    mesh.setMatrixAt(i, m.compose(p.set(d.x, d.y + .012, d.z), q.setFromAxisAngle(up, d.rot), s.set(d.size, 1, d.size)));
    mesh.setColorAt(i, colour.setHex(d.tint ?? 0xffffff));
  });
  mesh.name = `${c.stage}:${name}`;
  mesh.receiveShadow = true; mesh.castShadow = false;
  // Before the other blended things (mist, motes), which may lie over it.
  mesh.renderOrder = -1;
  mesh.computeBoundingBox(); mesh.computeBoundingSphere();
  c.root.add(mesh);
  return mesh;
}

/** A line strung between two points, sagging `sag` metres at its middle. */
export interface Line { a: V3; b: V3; sag?: number }

/** A point on a line, `t` 0..1 from `a` to `b`. */
export function linePoint(l: Line, t: number, out = new THREE.Vector3()) {
  return out.set(l.a[0] + (l.b[0] - l.a[0]) * t, l.a[1] + (l.b[1] - l.a[1]) * t - (l.sag ?? 0) * 4 * t * (1 - t), l.a[2] + (l.b[2] - l.a[2]) * t);
}

/** The lines as thin ropes: one geometry. */
export function ropes(lines: readonly Line[], o: { radius?: number; sides?: number; segments?: number } = {}) {
  const radius = o.radius ?? .03, sides = o.sides ?? 4, segments = o.segments ?? 14;
  const positions: number[] = [], normals: number[] = [], uvs: number[] = [], index: number[] = [];
  const p = new THREE.Vector3(), next = new THREE.Vector3(), tangent = new THREE.Vector3(), side = new THREE.Vector3(), up = new THREE.Vector3(), n = new THREE.Vector3();
  for (const line of lines) {
    const base = positions.length / 3;
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      linePoint(line, t, p);
      linePoint(line, Math.min(1, t + .01), next);
      if (t >= 1) { linePoint(line, t - .01, next); tangent.subVectors(p, next); } else tangent.subVectors(next, p);
      tangent.normalize();
      side.set(-tangent.z, 0, tangent.x);
      if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
      side.normalize();
      up.crossVectors(side, tangent).normalize();
      for (let k = 0; k < sides; k++) {
        const a = k / sides * Math.PI * 2;
        n.copy(side).multiplyScalar(Math.cos(a)).addScaledVector(up, Math.sin(a));
        positions.push(p.x + n.x * radius, p.y + n.y * radius, p.z + n.z * radius);
        normals.push(n.x, n.y, n.z);
        uvs.push(k / sides, t * 8);
      }
    }
    for (let i = 0; i < segments; i++) for (let k = 0; k < sides; k++) {
      const a = base + i * sides + k, b = base + i * sides + (k + 1) % sides, c = a + sides, d = b + sides;
      index.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(index);
  return g;
}

/** Something hung off a line: washing, a pennant, a flag, a paper streamer,
 *  `width` along the line and `height` down from it, at `t` along it; `cell`
 *  is its picture in the atlas (`cols` x `rows`, read from the top left). */
export interface Hang { line: Line; t: number; width: number; height: number; cell: number }

/** The hung things as one geometry, each a card three rows deep in the
 *  plane of its line, its top on the rope. `aHang` (0 at the rope, 1 at the
 *  hem) and `aSeed` drive `flutter`. */
export function hangingCloth(items: readonly Hang[], cols: number, rows: number) {
  const positions: number[] = [], normals: number[] = [], uvs: number[] = [], hang: number[] = [], seeds: number[] = [], index: number[] = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), along = new THREE.Vector3(), n = new THREE.Vector3();
  const ROWS = 3;
  items.forEach((item, k) => {
    const l = item.line;
    const length = Math.hypot(l.b[0] - l.a[0], l.b[2] - l.a[2]) || 1;
    const dt = item.width / 2 / length;
    linePoint(l, Math.max(0, item.t - dt), a);
    linePoint(l, Math.min(1, item.t + dt), b);
    along.subVectors(b, a);
    n.set(-along.z, 0, along.x).normalize();
    const u0 = (item.cell % cols) / cols, u1 = u0 + 1 / cols;
    const v1 = 1 - Math.floor(item.cell / cols) / rows, v0 = v1 - 1 / rows;
    const base = positions.length / 3, seed = (k * .618034) % 1;
    for (let r = 0; r <= ROWS; r++) {
      const f = r / ROWS, drop = item.height * f;
      for (const [p, u] of [[a, u0], [b, u1]] as [THREE.Vector3, number][]) {
        positions.push(p.x, p.y - drop, p.z);
        normals.push(n.x, n.y, n.z);
        uvs.push(u, v1 - (v1 - v0) * f);
        hang.push(f); seeds.push(seed);
      }
    }
    for (let r = 0; r < ROWS; r++) {
      const i = base + r * 2;
      index.push(i, i + 2, i + 1, i + 1, i + 2, i + 3);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setAttribute('aHang', new THREE.Float32BufferAttribute(hang, 1));
  g.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 1));
  g.setIndex(index);
  return g;
}

/** Cloth that stirs: each card's hem swings across its line, more the lower
 *  it hangs, on the stage's clock. */
export function flutter(material: THREE.Material, time: { value: number }, amount = .18) {
  addShaderPatch(material, `near-flutter-${amount.toFixed(2)}`, shader => {
    shader.uniforms.uNearTime = time;
    shader.vertexShader = 'uniform float uNearTime;\nattribute float aHang;\nattribute float aSeed;\n' + shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      float nearGust = .65 + .35 * sin( uNearTime * .41 + aSeed * 11. );
      transformed += objectNormal * aHang * aHang * ${amount.toFixed(3)} * nearGust * ( sin( uNearTime * 2.3 + aSeed * 37. ) + .45 * sin( uNearTime * 4.1 + aSeed * 13. + aHang * 2. ) );`);
  });
  return material;
}

/** A timber (or any square-cut length) from `a` to `b`, `w` by `d` thick. */
export interface Beam { a: V3; b: V3; w: number; d?: number }

/** Beams as one geometry, the map laid along each length every `tile` metres. */
export function beams(list: readonly Beam[], tile = 2) {
  const parts: THREE.BufferGeometry[] = [];
  const y = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3(), q = new THREE.Quaternion(), m = new THREE.Matrix4();
  for (const beam of list) {
    dir.set(beam.b[0] - beam.a[0], beam.b[1] - beam.a[1], beam.b[2] - beam.a[2]);
    const length = dir.length();
    if (length < 1e-3) continue;
    const box = new THREE.BoxGeometry(beam.w, length, beam.d ?? beam.w);
    const uv = box.getAttribute('uv') as THREE.BufferAttribute, normal = box.getAttribute('normal') as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) {
      const cap = Math.abs(normal.getY(i)) > .5;
      uv.setXY(i, uv.getX(i) * (cap ? beam.w : Math.max(beam.w, beam.d ?? beam.w)) / tile, uv.getY(i) * (cap ? (beam.d ?? beam.w) : length) / tile);
    }
    q.setFromUnitVectors(y, dir.normalize());
    box.applyMatrix4(m.compose(new THREE.Vector3((beam.a[0] + beam.b[0]) / 2, (beam.a[1] + beam.b[1]) / 2, (beam.a[2] + beam.b[2]) / 2), q, new THREE.Vector3(1, 1, 1)));
    parts.push(box.toNonIndexed());
    box.dispose();
  }
  if (!parts.length) return undefined;
  const merged = mergeGeometries(parts);
  parts.forEach(g => g.dispose());
  return merged;
}

/** An awning: sloped canvas from its back edge (against a wall, `y` up) out
 *  `depth` metres, falling `drop` to its front, `width` wide, turned `rot`
 *  (its front faces the awning's +z turned by rot), with a valance hanging
 *  `valance` metres off the front. `cell` is its stripe in the atlas. */
export interface Awning { x: number; z: number; y: number; rot: number; width: number; depth: number; drop: number; cell: number; valance?: number }

/** Awnings as one geometry. The atlas cell's upper three quarters are the
 *  canvas (stripes running front to back), its lower quarter the valance,
 *  whose scallops are the alpha. */
export function awnings(list: readonly Awning[], cols: number, rows: number) {
  const parts: THREE.BufferGeometry[] = [];
  for (const a of list) {
    const u0 = (a.cell % cols) / cols, u1 = u0 + 1 / cols;
    const top = 1 - Math.floor(a.cell / cols) / rows, cellH = 1 / rows, split = top - cellH * .25;
    const w = a.width / 2, front = a.y - a.drop, hang = a.valance ?? .4;
    const positions = [
      -w, a.y, 0, w, a.y, 0, -w, front, a.depth, w, front, a.depth,
      -w, front, a.depth, w, front, a.depth, -w, front - hang, a.depth, w, front - hang, a.depth,
    ];
    const uvs = [u0, top, u1, top, u0, split, u1, split, u0, split, u1, split, u0, top - cellH, u1, top - cellH];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex([0, 2, 1, 1, 2, 3, 4, 6, 5, 5, 6, 7]);
    g.computeVertexNormals();
    g.rotateY(a.rot).translate(a.x, 0, a.z);
    parts.push(g);
  }
  if (!parts.length) return undefined;
  const merged = mergeGeometries(parts);
  parts.forEach(g => g.dispose());
  return merged;
}

/** A picture drawn cell by cell into one canvas texture (`cols` x `rows`
 *  cells of `cell` pixels, each clipped to its own square). */
export function canvasAtlas(cols: number, rows: number, cell: number, draw: (g: CanvasRenderingContext2D, index: number, size: number) => void) {
  const canvas = document.createElement('canvas');
  canvas.width = cols * cell; canvas.height = rows * cell;
  const g = canvas.getContext('2d')!;
  for (let i = 0; i < cols * rows; i++) {
    g.save();
    g.translate((i % cols) * cell, Math.floor(i / cols) * cell);
    g.beginPath(); g.rect(0, 0, cell, cell); g.clip();
    draw(g, i, cell);
    g.restore();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** Striped canvas for awnings: each cell two colours, the valance's scallops
 *  in its lower quarter. */
export function awningAtlas(stripes: readonly [string, string][], cols = 4) {
  const rows = Math.ceil(stripes.length / cols);
  return { cols, rows, map: canvasAtlas(cols, rows, 128, (g, i, size) => {
    const [a, b] = stripes[i % stripes.length];
    const body = size * .75, n = 7, band = size / n;
    for (let k = 0; k < n; k++) { g.fillStyle = k % 2 ? b : a; g.fillRect(k * band, 0, band + 1, body); }
    // Weathered: darker toward the front, a faint grain.
    const shade = g.createLinearGradient(0, 0, 0, body);
    shade.addColorStop(0, 'rgba(0,0,0,0)'); shade.addColorStop(1, 'rgba(0,0,0,.18)');
    g.fillStyle = shade; g.fillRect(0, 0, size, body);
    // The valance: a band, scalloped along its hem.
    const scallops = 5, r = size / scallops / 2;
    for (let k = 0; k < scallops; k++) {
      g.fillStyle = k % 2 ? b : a;
      g.fillRect(k * r * 2, body, r * 2 + 1, size * .25 - r);
      g.beginPath(); g.arc(k * r * 2 + r, size - r - 1, r, 0, Math.PI); g.fill();
    }
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, body, size, 3);
  }) };
}

/** A material for the near scenery, in the stage's look with the cutaway and
 *  fade: cloth (double sided, cut out by its alpha) or solid. */
export function nearMaterial(c: DressContext, name: string, params: THREE.MeshStandardMaterialParameters & { cloth?: boolean }) {
  const { cloth, ...rest } = params;
  return stageMaterial(c.stage, name, cloth ? { side: THREE.DoubleSide, alphaTest: .5, roughness: 1, ...rest } : rest);
}

/** Add a geometry to the stage as one mesh. */
export function addMesh(c: DressContext, geometry: THREE.BufferGeometry | null | undefined, material: THREE.Material, name: string, o: { shadow?: boolean } = {}) {
  if (!geometry) return undefined;
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = `${c.stage}:${name}`;
  mesh.castShadow = !!o.shadow; mesh.receiveShadow = true;
  geometry.computeBoundingSphere();
  c.root.add(mesh);
  return mesh;
}
