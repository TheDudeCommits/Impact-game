import * as THREE from 'three';
import type { Sculpt } from '../../render/rift/sculpt';
import type { FireSpot } from '../../render/rift/fire';
import type { RiftProp } from '../../game/riftLayouts';
import { chain, rig, seeded, smooth } from './riftKit';
import type { Beyond } from './drownedArmoury';

const GLASS = 0x1c1618, GLASS_LIT = 0x3a3034, CRUST = 0x262020, CRUST_DARK = 0x141010, HOT = 0xffb46a, EMBER = 0xff6a2a;
const CHAIN = 0x4a3428, IRON = 0x2a2422, STONE = 0x6a5e58, STONE_DARK = 0x4a403c;

/** The star: where it lies (its centre sunk below the rim at the crater's north end), and how big it is. */
export const STAR = { x: 0, y: 5, z: 106, r: 50 } as const;
/** The crater: its floor out to FLOOR metres from the middle, its wall up to the rim at RIM, RIM_H high. */
const FLOOR = 52, RIM = 80, RIM_H = 20;
const wobble = smooth(61), lumps = smooth(67);

/** The ground: the crater's floor over the field and round it, its wall rising to the rim, the rim falling away outside. */
export function starGround(x: number, z: number, halfX: number, halfZ: number) {
  const inField = Math.abs(x) <= halfX + 3 && Math.abs(z) <= halfZ + 3;
  if (inField) return -.002;
  const a = Math.atan2(z, x), d = Math.hypot(x, z) + (wobble(Math.cos(a) * 3 + 9, Math.sin(a) * 3 + 9) - .5) * 10;
  if (d < FLOOR) return 0;
  const lump = (lumps(x * .06, z * .06) - .5) * 3;
  if (d < RIM) { const t = (d - FLOOR) / (RIM - FLOOR); return RIM_H * (t * t * (3 - 2 * t)) + lump * t; }
  return Math.max(4, RIM_H - (d - RIM) * .22) + lump;
}

// ---- the field's props ---------------------------------------------------------------------------------------------

/** A shard of the star or the glass, up its frame's y: two or three blades of black glass at their leans, a sliver of the
 *  star's light down the main one. About `h` high. */
function shard(k: Sculpt, x: number, y: number, z: number, h: number, w: number, seed: number, hot = true) {
  const r = seeded(seed * 9973 + 7), yaw = r() * 6;
  const g = rig(k, x, y - .3, z, (r() - .5) * .3, yaw, (r() - .5) * .3);
  g.use('dark', GLASS, .1).cone(w, h + .3, 4);
  for (let i = 0; i < 2; i++) {
    const a = i * 2.4 + r(), lean = .35 + r() * .3;
    g.at(Math.cos(a) * w * .5, 0, Math.sin(a) * w * .5, Math.sin(a) * lean, 0, -Math.cos(a) * lean).use('dark', i ? GLASS_LIT : GLASS, .1).cone(w * .55, h * (.45 + r() * .25), 4);
  }
  if (hot) g.at(w * .32, .2, w * .32, 0, Math.PI / 4).use('glow', r() < .5 ? HOT : EMBER, .1).box(w * .14, h * .62, .04);
}

/** A prop of the field, drawn as the Fallen Star's. False for those main draws itself (the bones, the dead). */
export function starProp(k: Sculpt, p: RiftProp, fires: FireSpot[]): boolean {
  const r = p.seed;
  switch (p.kind) {
    case 'stone':
      // The ring: shards of the star thrust up out of the glass round its heart, filling the pillars the sacrificed stood on.
      shard(k, p.x, 0, p.z, p.h + .6, .62, r * 100 + p.x);
      return true;
    case 'altar': {
      // The crater's heart: a mound of black glass, split open, the star's fire still in the cleft.
      const g = rig(k, p.x, 0, p.z, 0, p.rot);
      g.use('dark', GLASS, .1).cyl(p.w / 2, p.h * .7, 9, .78);
      for (let i = 0; i < 7; i++) {
        const a = i / 7 * Math.PI * 2 + r, d = p.w * .36;
        g.at(Math.cos(a) * d, 0, Math.sin(a) * d, Math.sin(a) * .5, 0, -Math.cos(a) * .5).use('dark', i % 2 ? GLASS_LIT : GLASS, .1).cone(.7 + (i % 3) * .2, p.h * 1.3 + (i % 2) * .5, 4);
      }
      g.use('glow', HOT, .05).at(0, p.h * .55, 0, 0, .4).box(p.w * .7, .1, .26);
      g.at(0, p.h * .55, 0, 0, 1.9).box(p.w * .5, .1, .2);
      fires.push({ x: p.x, y: p.h * .7, z: p.z, size: 1.6, smoke: .6, seed: r * 10 });
      return true;
    }
    case 'stake': {
      // An iron peg the chains were made fast to, driven into the glass, a few links still on it.
      k.use('metal', IRON, .1).cylinder(p.x, -.2, p.z, .11, p.h * .7, 6, 0, (r - .5) * .25, (r - .5) * .25, .5);
      k.use('metal', CHAIN, .14);
      chain(k, new THREE.Vector3(p.x, p.h * .62, p.z), new THREE.Vector3(p.x + Math.cos(r * 9) * 1.6, .1, p.z + Math.sin(r * 9) * 1.6), .42, .2);
      return true;
    }
    case 'rock':
      // A chunk of the glass the fall threw up.
      k.use('dark', r < .5 ? GLASS : GLASS_LIT, .12).rock(p.x, -.1, p.z, p.w, p.h * 1.2, p.d, p.rot);
      if (r > .6) k.use('glow', EMBER, .1).box(p.x, .05, p.z, p.w * .5, .05, .08, p.rot + 1);
      return true;
    case 'grave':
      // A sliver of it standing in the floor.
      shard(k, p.x, 0, p.z, p.h + .3, .22, r * 50 + p.z, r > .7);
      return true;
    default: return false;
  }
}

// ---- the crater and the star ----------------------------------------------------------------------------------------

/** Everything round the field: the crater's wall of glass, the broken pillars round its rim (they come down as the fight
 *  worsens), the star with its cracks and its chains, and what burns. */
export function starBeyond(k: Sculpt, b: Beyond) {
  const { halfX, halfZ, fires, piece, at } = b, edge = Math.max(halfX, halfZ), r = seeded(4421);
  k.tag(0);
  // The crater's wall: slabs and blades of black glass thrown up and out by the fall, thickest on the wall, raked outward.
  for (let i = 0; i < 150; i++) {
    const a = r() * Math.PI * 2, d = FLOOR - 4 + r() * (RIM - FLOOR + 10), x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (Math.max(Math.abs(x), Math.abs(z)) < edge + 9) continue;
    if (Math.hypot(x - STAR.x, z - STAR.z) < STAR.r + 4) continue;
    const y = at(x, z), tall = 5 + r() * 10 * (d > RIM - 10 ? 1.4 : 1), out = .2 + r() * .35;
    const g = rig(k, x, y - 2.6, z, Math.sin(a) * out, r() * 6, -Math.cos(a) * out);
    g.use('dark', r() < .6 ? GLASS : GLASS_LIT, .12).cone(1.2 + r() * 2.2, tall + 2.6, 4);
    if (r() < .25) g.at(.6, .5, 0).use('glow', EMBER, .1).box(.12, tall * .4, .05);
  }
  // Smaller glass on the floor round the field: chunks and slivers, a few still glowing.
  for (let i = 0; i < 90; i++) {
    const a = r() * Math.PI * 2, d = edge + 5 + r() * (FLOOR - edge - 2), x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (Math.max(Math.abs(x), Math.abs(z)) < edge + 4) continue;
    if (r() < .5) k.use('dark', GLASS, .12).rock(x, -.1, z, 1 + r() * 2, .6 + r() * 1.4, 1 + r() * 2, r() * 6);
    else shard(k, x, 0, z, 1.5 + r() * 3, .3 + r() * .4, i + 300, r() < .4);
  }
  // The fissures the fall split across the floor, out from the field toward the star and round it, still glowing.
  k.use('glow', EMBER, .1);
  for (let f = 0; f < 18; f++) {
    let a = f / 18 * Math.PI * 2 + r() * .2, d = edge + 4, x = Math.cos(a) * d, z = Math.sin(a) * d;
    const steps = 4 + Math.floor(r() * 5);
    for (let s = 0; s < steps && d < FLOOR; s++) {
      const len = 3 + r() * 4, na = a + (r() - .5) * .5, nx = x + Math.cos(na) * len, nz = z + Math.sin(na) * len;
      k.box((x + nx) / 2, .01, (z + nz) / 2, .22 + r() * .25, .03, len, Math.atan2(nx - x, nz - z));
      x = nx; z = nz; a = na; d = Math.hypot(x, z);
    }
  }
  // Broken pillars round the rim: what stood here before the star came down, most snapped, a few still carrying a lintel.
  for (let i = 0; i < 26; i++) {
    const a = i / 26 * Math.PI * 2 + (r() - .5) * .12, d = RIM - 3 + r() * 8, x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (Math.hypot(x - STAR.x, z - STAR.z) < STAR.r + 2) continue;
    const y = at(x, z) - .4, tall = 6 + r() * 12, broken = r() < .65;
    piece(x, z, a + (r() - .5) * .8, 2.6, tall, true, y);
    const g = rig(k, x, y, z, (r() - .5) * .06, r() * 6, (r() - .5) * .06);
    g.use('stone', STONE_DARK, .08).cyl(1.6, .9, 10).at(0, .9, 0).use('stone', STONE, .1).cyl(1.15, broken ? tall * .6 : tall, 12, .94);
    if (!broken) g.use('stone', STONE_DARK, .06).at(0, tall + .9, 0).box(3.2, .9, 3.2);
    else g.use('stone', STONE_DARK, .08).at(0, tall * .6 + .9, 0, .4, 0, .3).cyl(1.05, .8, 7, .7);
    k.tag(0);
    // Its fallen drum beside it.
    if (broken && r() < .6) k.use('stone', STONE, .1).cylinder(x + Math.cos(a + 1.6) * 3, y + 1, z + Math.sin(a + 1.6) * 3, 1.05, tall * .3, 10, a, 0, Math.PI / 2);
  }
  star(k, r);
  // The chains: from the star down to great iron stakes driven into the crater's wall and its floor, and two bands over it.
  const surface = (dx: number, dy: number, dz: number, out = 1) => { const v = new THREE.Vector3(dx, dy, dz).normalize(); return new THREE.Vector3(STAR.x + v.x * STAR.r * out, STAR.y + v.y * STAR.r * out, STAR.z + v.z * STAR.r * out); };
  const anchors: [ax: number, az: number, dx: number, dy: number, dz: number][] = [
    [-60, 30, -.72, .42, -.55], [62, 36, .74, .4, -.54], [-80, 72, -.95, .3, -.1], [82, 80, .96, .26, -.05], [-62, 150, -.6, .35, .7], [66, 146, .62, .34, .7],
  ];
  for (const [ax, az, dx, dy, dz] of anchors) {
    const ay = at(ax, az), top = new THREE.Vector3(ax, ay + 9, az), toward = Math.atan2(STAR.x - ax, STAR.z - az);
    // The stake: a pillar of black iron leaning back from the pull, a collar at its head.
    const g = rig(k, ax, ay - 2, az, -.3, toward, 0);
    g.use('metal', IRON, .08).cyl(2.2, 13, 8, .7).at(0, 11, 0).use('metal', CHAIN, .1).cyl(2.4, 1.4, 8);
    k.use('metal', CHAIN, .12);
    chain(k, top, surface(dx, dy, dz, 1.01), 5.2, 7);
  }
  for (const [tilt, from, to] of [[-.25, -1.1, 1.15], [.4, -.95, 1.0]] as const) {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 10; i++) {
      const t = from + (to - from) * i / 10, dir = new THREE.Vector3(Math.sin(t), Math.cos(t), 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), tilt);
      pts.push(surface(dir.x, dir.y, dir.z - .2, 1.02));
    }
    for (let i = 0; i < pts.length - 1; i++) { if (pts[i].y < 2 && pts[i + 1].y < 2) continue; chain(k, pts[i], pts[i + 1], 5.2, 0); }
  }
  // What burns: the floor round the field as the fight goes on, the crater's wall, and fires on the star's crust.
  for (let i = 0; i < 18; i++) {
    const a = r() * Math.PI * 2, d = edge + 4 + r() * 18, x = Math.cos(a) * d, z = Math.sin(a) * d;
    fires.push({ x, y: Math.max(0, at(x, z)), z, size: 2 + r() * 2.5, smoke: 1, seed: r() * 80, from: i < 4 ? 0 : i < 11 ? .5 : .95 });
  }
  for (let i = 0; i < 8; i++) {
    const a = -Math.PI / 2 + (r() - .5) * 2.2, up = .2 + r() * .7, v = new THREE.Vector3(Math.cos(a) * Math.cos(up), Math.sin(up), Math.sin(a) * Math.cos(up));
    fires.push({ x: STAR.x + v.x * STAR.r, y: STAR.y + v.y * STAR.r, z: STAR.z + v.z * STAR.r, size: 4 + r() * 4, smoke: 1, seed: r() * 70, from: i < 3 ? 0 : i < 6 ? .5 : .95 });
  }
}

/** The star: a crust of grey-black plates over a core still burning, the light showing through every seam between them and
 *  through the holes where plates fell in. The plates are an icosphere's triangles grouped round seventy points; a triangle
 *  that falls between two plates is left out, so the core shows in the seam. */
function star(k: Sculpt, r: () => number) {
  const { x, y, z, r: R } = STAR;
  const ball = new THREE.IcosahedronGeometry(1, 20), pos = ball.getAttribute('position');
  const seeds = Array.from({ length: 150 }, () => new THREE.Vector3(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1).normalize());
  const lift = seeds.map(() => 1 + (r() - .5) * .05), shade = seeds.map(() => r());
  const plateOf = (v: THREE.Vector3) => { let best = 0, d = -2; seeds.forEach((s, i) => { const t = s.dot(v); if (t > d) { d = t; best = i; } }); return best; };
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const crust: number[] = [], dark: number[] = [];
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, i + 1); c.fromBufferAttribute(pos, i + 2);
    const pa = plateOf(a), pb = plateOf(b), pc = plateOf(c);
    if (pa !== pb || pb !== pc) continue;
    if (a.y + b.y + c.y < -1.2) continue;
    const out = shade[pa] < .5 ? crust : dark, k2 = lift[pa];
    out.push(a.x * k2, a.y * k2, a.z * k2, b.x * k2, b.y * k2, b.z * k2, c.x * k2, c.y * k2, c.z * k2);
  }
  ball.dispose();
  const shell = (data: number[]) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(data, 3)); g.computeVertexNormals(); return g; };
  // (Squashed a little where it lies, as a body that fell soft.)
  k.use('dark', CRUST, .06).add(shell(crust), x, y, z, 0, .3, 0, R, R * .92, R);
  k.use('dark', CRUST_DARK, .06).add(shell(dark), x, y, z, 0, .3, 0, R, R * .92, R);
  // The core under the crust.
  k.use('glow', HOT, .02).add(new THREE.IcosahedronGeometry(1, 6), x, y, z, 0, 0, 0, R * .965, R * .965 * .92, R * .965);
  // Its slag heaped round its foot where it ploughed in.
  for (let i = 0; i < 30; i++) {
    const a = (r() - .5) * Math.PI * 1.3 - Math.PI / 2, d = R * (.95 + r() * .2), sx = x + Math.cos(a) * d, sz = z + Math.sin(a) * d;
    k.use('dark', r() < .5 ? GLASS : CRUST_DARK, .1).rock(sx, -2, sz, 8 + r() * 14, 6 + r() * 10, 8 + r() * 12, r() * 6);
  }
}

/** Where the sky is torn over the Fallen Star: high over the star, at the crater's far end. */
export const STAR_TEAR = { x: -24, y: 168, z: 262, yaw: Math.PI - .12, roll: .22 } as const;
