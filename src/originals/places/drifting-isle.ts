import * as THREE from 'three';
import type { DressContext } from '../../render/stages/dressing';
import { stageMaterial } from '../../render/stages/build';
import { detail, Forge, fromTris, noise2 } from './forge';
import { rand } from './remake';
import { surfaces } from './cc0';
import { forged, smooth, worldFloor } from './finish';

/** The play square's half (the camera's walls) and the court's edge. */
const HALF = 23;
const TURF = 0x6a8a44, TURF_LIT = 0x84a050, EARTH = 0x6a5440, ROCK = 0x7a6c5c, ROCK_DARK = 0x54493e, SAND = 0xc8b48c, SAND_DARK = 0xa8946e,
  FLAG = 0xb8ae98, BRONZE = 0x9a6a2e, TIMBER = 0x6a5038, LEAF = 0x4e7a34, WATER = 0x8ac0d8;
const n1 = noise2(201), n2 = noise2(202);

/** The island's lip: three lobes (north, south-east, south-west), never inside the play square's corners. */
function lip(a: number) {
  return Math.max(35, 39 + 6 * Math.cos(3 * (a + Math.PI / 2)) + 2 * Math.sin(7 * a + 1) + 1.2 * Math.sin(11 * a + 3));
}
/** How far out the play square (and 2 m more) reaches at angle a. */
const square = (a: number, more = 2) => (HALF + more) / Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a)));
/** The turf's height: flat over the play square and 2 m round it (nothing in it is boxed: the floor is flat), rising toward
 *  the lip. */
function top(r: number, a: number) {
  const s = square(a), e = lip(a), t = THREE.MathUtils.clamp((r - s) / Math.max(1, e - s), 0, 1);
  return t * t * (1.4 + .9 * Math.sin(2 * a + .5)) + (n1(Math.cos(a) * r, Math.sin(a) * r, 5) - .5) * .5 * t;
}

export async function dress(c: DressContext) {
  const { ambient } = c;
  const [, cc0] = await Promise.all([c.sky({ url: '/assets/environment/br/sky-drifting-isle.webp', rotation: 0, drift: .0006 }),
    surfaces(c, ['grass-leafy', 'stone-path', 'sandstone-pale', 'rock-sea'] as const)]);
  const f = new Forge(c, 'isle');
  // places-finish (5 November 2026): the isle read as a placeholder (the playtest: "grey polygon flagstones, flat green
  // patches"): its turf, flags, kerbs and rock were painted detail maps near white, every face flat. They are photographed
  // surfaces now with their relief (Poly Haven Leafy Grass, Grey Stone Path, White Sandstone Blocks 02, Seaside Rock), the
  // turf creeping into the flags' joints and over their ragged edge in soft patches (finish.ts worldFloor) where r10's
  // flat green slabs lay, the rock and the turf's swells smoothed.
  f.mat('turf', { ...cc0['grass-leafy'], tile: 2.8, roughness: 1, lift: .55, gain: 1.35 });
  const flags = f.mat('flags', { tile: 3.6, roughness: .92 }) as THREE.MeshStandardMaterial;
  worldFloor(flags, cc0['stone-path'], 3.6, { normalScale: 1.2,
    over: { surface: cc0['grass-leafy'], tile: 2.4, amount: .3, edge: [15, 25], edgeAmount: .75, cracks: .9, scale: 4.5, tint: new THREE.Color(.95, 1.15, .7) } });
  // The photographed path is a dark grey: lifted to the old sun-bleached flags the court was (r10's FLAG on its vertices).
  flags.color.setScalar(1.75);
  f.mat('stone', { ...cc0['sandstone-pale'], tile: 2.6, roughness: .9, shadow: true, lift: .35 });
  // (Lifted: the islets' undersides face away from every light and read as flat dark panels against the sky.)
  f.mat('rock', { ...cc0['rock-sea'], tile: 7, roughness: 1, air: .3, lift: .45, gain: 1.6 });
  f.mat('wood', { map: detail.planks(206, 34), tile: 1.6, roughness: .9 });
  f.mat('bronze', { roughness: .35, metalness: .7 });
  f.mat('leaf', { ...cc0['grass-leafy'], tile: 1.4, roughness: 1, lift: .3 });
  f.mat('water', { roughness: .1, metalness: .2 });

  island(f, 0, 0, 0, lip, top, 1, 46);
  court(f);
  // places-gen: the sun-tower and the cloister's arcade are the generated ones (generated()).
  spring(f, 30.5, 19);
  const trees = edgeLife(f);
  const { to: bridgeTo, trees: isletTrees } = islets(f);
  bridge(f, bridgeTo);
  f.done();
  for (const [key, crease] of [['turf', 40], ['rock', 60], ['leaf', 70], ['stone', 45]] as const) { const m = forged(f.meshes, key); if (m) smooth(m.geometry, crease); }
  await generated(c, trees, isletTrees);
  await archipelago(c);
  orrery(c);

  // Falls off the south-east lobe from the spring, and off two lower lips; their mist; the cloud sea below.
  const falls: [number, number][] = [[Math.atan2(19, 30.5) + .06, 5], [.95, 4], [3.4, 3.5]];
  const mist: { x: number; y: number; z: number; size: number }[] = [];
  for (const [a, w] of falls) {
    const e = lip(a) + .3, x = Math.cos(a) * e, z = Math.sin(a) * e;
    ambient.waterfall({ x, y: top(e - .3, a) - 16, z, width: w, height: 32, rot: Math.atan2(x, z), color: 0xd8ecf8, speed: .7, curve: .3 });
    for (let k = 0; k < 4; k++) mist.push({ x: x * 1.06, y: -32 - k * 6, z: z * 1.06, size: 8 + k * 3 });
  }
  const r = rand(208);
  for (let i = 0; i < 64; i++) { const a = r() * Math.PI * 2, d = 60 + r() * 520; mist.push({ x: Math.sin(a) * d, y: -78 - r() * 26, z: Math.cos(a) * d, size: 60 + r() * 70 }); } // places-epic-a: the cloud sea thicker, wider
  ambient.puffs({ spots: mist, color: 0xffffff, shade: 0xb8c8e4, opacity: .85, life: 0, drift: [1, 0, .3], seed: 22, order: 0 });
  ambient.birds({ centre: [0, 0, 0], count: 12, radius: 50, height: 22, spread: 10, speed: 8, size: .5, color: 0xf4f4f8, seed: 23 });
  ambient.birds({ centre: [40, 30, -120], count: 18, radius: 90, height: 40, spread: 30, speed: 9, size: .8, color: 0xf8f8fc, seed: 25 });
  ambient.motes({ min: [-40, 0, -40], max: [40, 10, 40], count: 80, velocity: [.6, -.1, .3], size: .06, color: 0xfff8d8, color2: 0xe8ffd0, opacity: .7, wobble: 1.2, seed: 24 });
}

/** An island: turf over a polar grid out to its lip (`edge` by angle, `height` by radius and angle), a band of earth at the
 *  lip, its underside a ragged cone of rock down to `depth` m, at (x, y, z), scaled. */
function island(f: Forge, x: number, y: number, z: number, edge: (a: number) => number, height: (r: number, a: number) => number, scale: number, depth: number) {
  const seg = 96, rings = 14, under = 9;
  const P = (r: number, a: number, h: number): number[] => [x + Math.cos(a) * r * scale, y + h * scale, z + Math.sin(a) * r * scale];
  const topPts: number[][] = [], tris: number[][] = [];
  for (let k = 0; k <= rings; k++) for (let i = 0; i < seg; i++) {
    const a = i / seg * Math.PI * 2, e = edge(a), r = k === 0 ? 0 : e * (k / rings) ** .8;
    topPts.push(P(r, a, height(r, a)));
  }
  const id = (k: number, i: number) => k * seg + (i % seg);
  for (let k = 0; k < rings; k++) for (let i = 0; i < seg; i++) { tris.push([id(k, i), id(k + 1, i + 1), id(k + 1, i)]); tris.push([id(k, i), id(k, i + 1), id(k + 1, i + 1)]); }
  f.add('turf', fromTris(topPts, tris), (_x, py) => py - y > .9 * scale ? TURF_LIT : TURF);
  // The lip and the underside: rings going in and down, earth near the top, rock below.
  const low: number[][] = [], lt: number[][] = [];
  for (let j = 0; j <= under; j++) for (let i = 0; i < seg; i++) {
    const a = i / seg * Math.PI * 2, e = edge(a), t = j / under;
    const r = j === 0 ? e : e * (1 - t) ** 1.25 * (.92 + n2(Math.cos(a) * 40, Math.sin(a) * 40 + j * 9, 6) * .2);
    const h = j === 0 ? height(e, a) : -1.2 - t * depth - (n1(Math.cos(a) * 30 + j, Math.sin(a) * 30, 4) - .5) * depth * .13 * (1 - t);
    low.push(P(r, a, h));
  }
  for (let j = 0; j < under; j++) for (let i = 0; i < seg; i++) { lt.push([j * seg + i, (j + 1) * seg + ((i + 1) % seg), j * seg + ((i + 1) % seg)]); lt.push([j * seg + i, (j + 1) * seg + i, (j + 1) * seg + ((i + 1) % seg)]); }
  f.add('rock', fromTris(low, lt), (_x, py) => py - y > -3 * scale ? EARTH : py - y > -14 * scale ? ROCK : ROCK_DARK);
}

/** The court: old flagstones worn into the turf, its edge ragged; a worn path off toward each lobe. */
function court(f: Forge) {
  // Squarish, over the play square and a metre or two past it, its edge ragged where the turf has taken it back.
  const pts: [number, number][] = [];
  for (let i = 0; i < 96; i++) {
    const a = i / 96 * Math.PI * 2, r = square(a, 1) + (n2(Math.cos(a) * 9, Math.sin(a) * 9, 2) - .35) * 2.2 + .6 * Math.sin(9 * a);
    pts.push([Math.cos(a) * Math.max(square(a, 0) + .3, r), Math.sin(a) * Math.max(square(a, 0) + .3, r)]);
  }
  f.slab('flags', pts, .015, FLAG);
  // The Last Sun's bronze disc let into its heart. (places-finish: the turf creeping back over the flags is the flags' own
  // material now, worldFloor's grass in their joints and over their edge, where r10 laid 34 flat green slabs.)
  const INLAY = 0x6a5232;
  f.add('bronze', new THREE.RingGeometry(2.6, 2.9, 48, 1).rotateX(-Math.PI / 2).translate(0, .03, 0), INLAY);
  f.add('bronze', new THREE.CircleGeometry(.9, 24).rotateX(-Math.PI / 2).translate(0, .03, 0), INLAY);
  for (let k = 0; k < 12; k++) {
    const a = k / 12 * Math.PI * 2, w = k % 2 ? .1 : .18, l0 = 1.35, l1 = k % 2 ? 2.2 : 2.5, ux = Math.cos(a), uz = Math.sin(a);
    f.slab('bronze', [[ux * l0 - uz * w, uz * l0 + ux * w], [ux * l1, uz * l1], [ux * l0 + uz * w, uz * l0 - ux * w]], .03, INLAY);
  }
}

/** The spring on the south-east lobe: a pool in a stone kerb, water spilling over the lip where the fall goes down. */
function spring(f: Forge, x: number, z: number) {
  const y0 = top(Math.hypot(x, z), Math.atan2(z, x));
  f.add('water', new THREE.CircleGeometry(3.6, 20).rotateX(-Math.PI / 2).translate(x, y0 + .2, z), WATER);
  f.add('stone', new THREE.TorusGeometry(3.8, .35, 4, 20).rotateX(Math.PI / 2).translate(x, y0 + .25, z), SAND_DARK);
  // The channel out to the lip.
  f.box('stone', x + 2.6, y0 + .05, z + 1.4, 3.6, .35, 1.4, SAND_DARK, { rot: -Math.atan2(2.5, 4.6) });
  f.add('water', new THREE.PlaneGeometry(3.4, 1).rotateX(-Math.PI / 2).rotateY(-Math.atan2(2.5, 4.6)).translate(x + 2.8, y0 + .42, z + 1.5), WATER);
}

/** Fruit trees, bushes and long grass round the lips, all outside the play square. */
function edgeLife(f: Forge) {
  const r = rand(212);
  // places-gen: the trees are the generated fruit tree (generated()); this keeps their spots.
  const trees: [number, number, number][] = [];
  const tree = (x: number, z: number, s: number) => { trees.push([x, z, s]); };
  for (let i = 0; i < 26; i++) {
    const a = r() * Math.PI * 2, d = lip(a) - 2 - r() * 6, x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (Math.abs(x) < HALF + 2 && Math.abs(z) < HALF + 2) continue;
    if (Math.hypot(x, z + 38.5) < 8 || Math.hypot(x + 30, z - 21.5) < 9 || Math.hypot(x - 30.5, z - 19) < 6) continue;
    if (r() < .45) tree(x, z, .8 + r() * .5);
    else f.rock('leaf', x, top(d, a) - .1, z, .9 + r(), .5 + r() * .4, .9 + r(), r() < .5 ? LEAF : 0x5a8a3a, i + 300, { rough: .4 });
  }
  return trees;
}

/** places-gen: the generated pieces (Tripo): the Last Sun's broken sun-tower and the cloister's arcade where r10's stood,
 *  the fruit trees at the lips' spots, the Sunfall Arena's sun-lions on the court's north side and sun-braziers at its
 *  corners (all past the play square). */
async function generated(c: DressContext, trees: [number, number, number][], isletTrees: [number, number, number, number][]) {
  const { kit } = c, ground = (x: number, z: number) => top(Math.hypot(x, z), Math.atan2(z, x));
  await kit.load(['own/isle-tower', 'own/isle-arcade', 'own/isle-tree', 'own/sunfall-lion', 'own/sunfall-brazier']);
  kit.place('own/isle-tower', { x: 0, y: ground(0, -38.5) - .4, z: -38.5, height: 21 });
  kit.place('own/isle-arcade', { x: -30, y: ground(-30, 21.5) - .3, z: 21.5, height: 8.5, rot: Math.atan2(30, -21.5) });
  for (const [x, z, s] of trees.slice(0, 8)) kit.place('own/isle-tree', { x, y: ground(x, z) - .2, z, height: 4.6 * s, rot: x * 3 + z });
  // places-finish: the islets' trees are the generated fruit tree too, where r10's were a ball on a stick.
  for (const [x, y, z, s] of isletTrees) kit.place('own/isle-tree', { x, y: y - .2, z, height: 3.8 * s, rot: x + z * 2 });
  for (const e of [-1, 1]) kit.place('own/sunfall-lion', { x: e * 6.5, y: ground(e * 6.5, -27), z: -27, height: 3.2, rot: e * .15 });
  for (const [x, z] of [[-26, -26], [26, -26], [-26, 26], [26, 26]] as const) kit.place('own/sunfall-brazier', { x, y: ground(x, z), z, height: 3.2, rot: x });
  kit.flush(c.stage);
}

/** Islets adrift round the isle, turf and a tree or two on each, at their own heights; returns the one the bridge goes to. */
function islets(f: Forge) {
  const r = rand(213), list: [number, number, number, number][] = [[62, -2, 5, 6], [-70, -40, 10, 9], [-48, 72, -12, 7], [90, 64, 16, 11], [20, -96, 22, 8], [-130, 30, -30, 14], [140, -70, -8, 12]];
  const trees: [number, number, number, number][] = [];
  for (const [i, [x, z, y, s]] of list.entries()) {
    const edge = (a: number) => 1 + .18 * Math.sin(3 * a + i) + .1 * Math.sin(5 * a + i * 2);
    island(f, x, y, z, edge, (rr) => rr * rr * .12, s, 1.1);
    const count = 1 + Math.floor(r() * 3);
    for (let k = 0; k < count; k++) {
      const a = r() * Math.PI * 2, d = r() * s * .5, tx = x + Math.cos(a) * d, tz = z + Math.sin(a) * d, ts = .7 + r() * .6;
      if (trees.length < 10) trees.push([tx, y, tz, ts]);
    }
  }
  return { to: list[0], trees };
}

/** A rope bridge from the east lip to the nearest islet: planks on two ropes sagging between posts, hand ropes. */
function bridge(f: Forge, [ix, iz, iy, is]: [number, number, number, number]) {
  const a0 = Math.atan2(iz, ix), e = lip(a0), sx = Math.cos(a0) * (e - 1.5), sz = Math.sin(a0) * (e - 1.5), sy = top(e - 1.5, a0);
  const ex = ix - Math.cos(a0) * is * .7, ez = iz - Math.sin(a0) * is * .7, ey = iy + .2;
  const len = Math.hypot(ex - sx, ez - sz), ux = (ex - sx) / len, uz = (ez - sz) / len, vx = -uz, vz = ux, steps = 24;
  const at = (t: number, w: number, lift = 0): [number, number, number] => [sx + (ex - sx) * t + vx * w, sy + (ey - sy) * t - 2.2 * 4 * t * (1 - t) + lift, sz + (ez - sz) * t + vz * w];
  for (const [x, y, z] of [[sx, sy, sz], [ex, ey, ez]]) for (const w of [-.8, .8]) f.pipe('wood', [x + vx * w, y - .3, z + vz * w], [x + vx * w, y + 1.4, z + vz * w], .1, TIMBER, { sides: 5 });
  for (let k = 0; k < steps; k++) {
    const t0 = k / steps, t1 = (k + 1) / steps;
    for (const w of [-.8, .8]) { f.pipe('wood', at(t0, w, 1.1), at(t1, w, 1.1), .03, 0xb8a078, { sides: 3 }); f.pipe('wood', at(t0, w), at(t1, w), .035, 0xb8a078, { sides: 3 }); }
    const [px, py, pz] = at((t0 + t1) / 2, 0);
    f.box('wood', px, py, pz, .28, .06, 1.5, TIMBER, { rot: -Math.atan2(uz, ux) });
  }
}

/** places-epic-a: the archipelago: islands adrift round the isle at many heights, near and far, each the generated island
 *  (a ruined arch, bushes, roots and a fall off its lip; one instanced draw), with their waterfalls pouring into the cloud and
 *  great chains slung between them and from the isle's lips. */
const ISLANDS: readonly (readonly [number, number, number, number])[] = [
  // (x, the island's foot y, z, its height): most at or below the isle's level so their turf and ruins show, a few above.
  [-110, -26, -90, 34], [96, -14, -120, 38], [170, -44, -30, 46], [-180, -8, 20, 44], [60, 28, -230, 50], [-90, -60, -230, 44],
  [230, -20, 80, 54], [-250, -48, -130, 60], [140, 30, 170, 40], [-150, 2, 160, 42], [20, -4, 250, 54], [290, 52, -200, 62], [-60, 40, 120, 30],
];
async function archipelago(c: DressContext) {
  const { kit, ambient } = c;
  await kit.load(['own/isle-island']);
  const r = rand(231), near = ISLANDS.map(([x, , z], i) => [Math.hypot(x, z), i]).sort((a, b) => a[0] - b[0]).slice(0, 5).map(([, i]) => i);
  for (const [i, [x, y, z, s]] of ISLANDS.entries()) {
    const rot = Math.atan2(-x, -z) + (r() - .5) * 1.2;
    kit.place('own/isle-island', { x, y, z, height: s, rot, shadow: false });
    // Its fall off the lip, long, dissolving into the cloud (the model's own fall is short).
    const fa = rot + Math.PI * .5, fx = x + Math.sin(fa) * s * .42, fz = z + Math.cos(fa) * s * .42;
    // (Each fall is a draw: the five nearest islands carry one; the model's own short fall is on every island.)
    if (near.includes(i)) ambient.waterfall({ x: fx, y: y - s * 1.6, z: fz, width: s * .12, height: s * 1.4, rot: fa, color: 0xe4f2fc, speed: .6, curve: .2 });
  }
  kit.flush(c.stage);
  // Lit by the bright sky all round (their own picture given back as light), so their rock reads earth and stone, not black.
  for (const m of kit.pieceMaterials('own/isle-island') as THREE.MeshStandardMaterial[]) {
    if (!m.map) continue;
    m.emissiveMap = m.map; m.emissive.set(0xfff4e0); m.emissiveIntensity = .55; m.needsUpdate = true;
  }
  // Chains: from the isle's lips to the nearest islands, and island to island, sagging.
  const f = new Forge(c, 'isle chains');
  f.mat('iron', { roughness: .45, metalness: .6 });
  const link = (at: THREE.Vector3, dir: THREE.Vector3, turn: number, size: number) => {
    const g = new THREE.TorusGeometry(size, size * .28, 4, 8).scale(1, 1.6, 1);
    g.rotateY(turn).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize())).translate(at.x, at.y, at.z);
    f.add('iron', g, 0x4a4440);
  };
  const chain = (A: THREE.Vector3, B: THREE.Vector3, size: number, sag: number) => {
    const len = A.distanceTo(B), n = Math.round(len / (size * 2.6));
    let last = A.clone();
    for (let i = 1; i <= n; i++) {
      const t = i / n, p = A.clone().lerp(B, t); p.y -= Math.sin(t * Math.PI) * sag;
      link(last.clone().lerp(p, .5), p.clone().sub(last), i % 2 ? Math.PI / 2 : 0, size);
      last = p;
    }
  };
  const lipAt = (a: number) => new THREE.Vector3(Math.cos(a) * (lip(a) - 1), top(lip(a) - 1, a) - 1, Math.sin(a) * (lip(a) - 1));
  const I = ISLANDS.map(([x, y, z, s]) => new THREE.Vector3(x, y + s * .62, z));
  chain(lipAt(Math.atan2(-70, -92)), I[0], .8, 10);
  chain(lipAt(Math.atan2(-104, 78)), I[1], .8, 12);
  chain(lipAt(Math.atan2(-40, 150)), I[2], .9, 14);
  chain(I[0], I[5], 1, 16); chain(I[1], I[4], 1, 18); chain(I[2], I[6], 1.1, 20); chain(I[3], I[9], 1, 18); chain(I[4], I[11], 1.2, 24);
  f.done();
}

/** places-epic-a: the Last Sun's colossal broken orrery hung in the sky behind the sun-tower: rings of sandstone banded with
 *  gold, up to 150 m across, each broken in places, tilted on its own axis and turning slowly round a golden core. */
function orrery(c: DressContext) {
  const group = new THREE.Group();
  group.name = 'sun orrery'; group.position.set(0, 120, -330);
  const material = stageMaterial(c.stage, 'sun orrery', { vertexColors: true, roughness: .6, metalness: .35, emissive: 0x3a2a10, emissiveIntensity: .6 });
  const r = rand(241), all: THREE.BufferGeometry[] = [];
  for (const [radius, thick, tilt, yaw] of [[78, 5.4, .35, .1], [108, 6.4, -.5, .6], [142, 7.6, .2, -.4], [52, 4.2, 1.1, 1.3]] as const) {
    const parts: THREE.BufferGeometry[] = [];
    let a = r() * Math.PI * 2;
    const end = a + Math.PI * 2;
    while (a < end) {
      const arc = .5 + r() * 1.1, gap = r() < .45 ? .12 + r() * .35 : .02;
      const g = new THREE.TorusGeometry(radius, thick, 4, Math.max(6, Math.round(arc * 18)), Math.min(arc, end - a)).rotateZ(a).toNonIndexed(); // square-sectioned stone
      // Banded: sandstone with a gold band along its middle.
      const p = g.getAttribute('position') as THREE.BufferAttribute, col = new Float32Array(p.count * 3), cc = new THREE.Color();
      for (let i = 0; i < p.count; i++) {
        const v = new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i)), rr = Math.hypot(v.x, v.y);
        cc.set(Math.abs(rr - radius) < thick * .4 && Math.abs(v.z) > thick * .55 ? 0xe8b040 : (rr > radius ? 0xa88a62 : 0x9a7e58));
        col.set([cc.r, cc.g, cc.b], i * 3);
      }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      parts.push(g);
      a += arc + gap;
    }
    const merged = mergeAll(parts);
    merged.rotateX(tilt).rotateY(yaw);
    all.push(merged);
  }
  const mesh = new THREE.Mesh(mergeAll(all), material);
  mesh.name = 'sun orrery rings';
  group.add(mesh);
  // The golden core: a sphere of light the rings turn round.
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(16, 2), new THREE.MeshBasicMaterial({ name: 'orrery core', color: new THREE.Color(0xffe2a0).multiplyScalar(2.2), toneMapped: false }));
  group.add(core);
  c.root.add(group);
  c.ambient.onUpdate(t => { mesh.rotation.z = t * .004; mesh.rotation.y = Math.sin(t * .03) * .06; });
}

function mergeAll(parts: THREE.BufferGeometry[]) {
  const pos: number[] = [], col: number[] = [];
  for (const g of parts) {
    const p = g.getAttribute('position'), cAttr = g.getAttribute('color');
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); col.push(cAttr.getX(i), cAttr.getY(i), cAttr.getZ(i)); }
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  out.computeVertexNormals();
  return out;
}
