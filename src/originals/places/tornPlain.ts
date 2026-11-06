import * as THREE from 'three';
import type { DressContext } from '../../render/stages/dressing';
import type { Placement } from '../../render/stages/StageKit';
import type { StageAmbient } from '../../render/stages/ambient';
import { stageMaterial } from '../../render/stages/build';
import { laneRibbon, pointNearPath } from '../../render/moba/palette';
import { RIFT_PATHS } from '../../game/moba/map';
import { detail, Forge, noise2 } from './forge';
import { rand } from './remake';

export const TORN_SKY = '/assets/environment/sky/ash-dusk.webp';
export const TORN_NAME = 'Rift War · The Torn Plain';

const BUILT_HERE = new Set(['asian/pagoda', 'asian/torii', 'asian/building-grand', 'asian/wall-tall', 'asian/lantern', 'asian/ume', 'asian/ivy',
  'asian/building-courtyard', 'br/stone-lamp', 'br/reeds']);
export const tornPlainKit = (pieces: string[]) => pieces.filter(piece => !BUILT_HERE.has(piece));

const STONE = 0xa8a294, STONE_DARK = 0x7a7468, WHITE = 0xe8e2d4, GOLD = 0xc8a04a, BLACK = 0x221e26, BLACK_LIT = 0x3a3442;
const PINE = 0x1e3424, PINE_DARK = 0x16281c, BARK = 0x3a2c22, ROOF = 0x4a4a52, RIFT = 0x1a1426, RIFT_EDGE = 0x2e2638;
const VIOLET = 0xb27cff, VIOLET_HOT = 0xe2c8ff;

const forges = new WeakMap<THREE.Object3D, Forge>();
/** The map's forge: its materials, one draw each for everything built here. */
function forgeOf(root: THREE.Object3D) {
  let f = forges.get(root);
  if (!f) {
    f = new Forge({ stage: 'rift-war', root } as unknown as DressContext, 'torn plain');
    f.mat('stone', { map: detail.ashlar(301, 56), tile: 3.2, roughness: .9 });
    f.mat('white', { map: detail.ashlar(302, 48), tile: 2.6, roughness: .7 });
    f.mat('dark', { map: detail.rock(303), tile: 6, flat: true, roughness: .85 });
    f.mat('pine', { flat: true, roughness: 1 });
    f.mat('roof', { map: detail.slate(304), tile: 2.4, roughness: .7 });
    f.mat('gold', { roughness: .35, metalness: .6 });
    f.mat('glow', { basic: true, fog: false });
    forges.set(root, f);
  }
  return f;
}

export function tornPlainPlace(root: THREE.Object3D, piece: string, at: Placement): boolean {
  if (!BUILT_HERE.has(piece)) return false;
  const f = forgeOf(root), { x, z } = at, y = at.y ?? 0, rot = at.rot ?? 0, w = at.width ?? 4, h = at.height ?? 4;
  const seed = Math.abs(Math.round(x * 13.1 + z * 7.7 + w * 3));
  switch (piece) {
    case 'asian/ume': {
      const r = rand(seed), n = w > 14 ? 4 : w > 10 ? 2 : 3;
      for (let i = 0; i < n; i++) {
        const a = r() * Math.PI * 2, d = i ? w * (.12 + r() * .14) : 0;
        pine(f, x + Math.cos(a) * d, Math.max(y, -.4), z + Math.sin(a) * d, h * (.75 + r() * .35) * (i ? .8 : 1));
      }
      return true;
    }
    case 'asian/torii': arch(f, x, y, z, w, h, rot, seed); return true;
    case 'asian/wall-tall': {
      // A stretch of the plain's old wall: dressed stone, a coping, merlons, a gap where it fell.
      const r = rand(seed), dx = Math.cos(rot), dz = -Math.sin(rot), parts = Math.max(2, Math.round(w / 2.4));
      for (let i = 0; i < parts; i++) {
        const u = (i + .5) / parts * w - w / 2;
        if (r() < .1) continue;
        const hh = h * (r() < .15 ? .45 : 1) + .6;
        f.box('stone', x + dx * u, -.2, z + dz * u, w / parts + .02, hh, 1.5, r() < .5 ? STONE : STONE_DARK, { rot });
        if (i % 2 === 0 && hh > h) f.box('stone', x + dx * u, hh - .2, z + dz * u, w / parts * .6, .9, 1.5, STONE, { rot });
      }
      return true;
    }
    case 'asian/pagoda': watchtower(f, x, y, z, w * .42, h * .6, rot, seed); return true;
    case 'asian/building-grand': case 'asian/building-courtyard':
      // Inside the field (the outposts' solids, 6.6 m square): a stone watch-house; past it, a ruined hall of the plain.
      if (w < 14) watchHouse(f, x, y, z, Math.min(w, 7.6), Math.max(h, 7), rot, seed);
      else hall(f, x, y, z, w * .8, h * .7, rot, seed);
      return true;
    case 'asian/lantern': case 'br/stone-lamp': brazier(f, x, y, z, h, piece === 'br/stone-lamp'); return true;
    case 'br/reeds': {
      // The rift's bank: shards of its dark glass, low, a violet glint in some.
      const r = rand(seed);
      for (let i = 0; i < 3; i++) {
        const a = r() * 6, d = r() * w * .4, sx = x + Math.cos(a) * d, sz = z + Math.sin(a) * d, tall = .35 + r() * .7;
        f.add('dark', new THREE.ConeGeometry(.28 + r() * .3, tall, 4).translate(0, tall / 2, 0).rotateZ((r() - .5) * .6).rotateY(r() * 6).translate(sx, -.1, sz), RIFT_EDGE);
        if (r() < .4) f.add('glow', new THREE.ConeGeometry(.07, tall * .7, 3).translate(sx + .1, tall * .35, sz), VIOLET);
      }
      return true;
    }
    default: return true;
  }
}

export const TORN_RIVER_HIDDEN = true;

export function tornPlainDone(root: THREE.Object3D) {
  forgeOf(root).done();
  forges.delete(root);
}

export function tornPlainAir(ambient: StageAmbient) {
  ambient.motes({ min: [-80, 0, -80], max: [80, 9, 80], count: 160, velocity: [0, .7, 0], size: .12, color: VIOLET, color2: VIOLET_HOT, opacity: .8, wobble: .6, additive: true, twinkle: .6, seed: 307 });
}

// ---- the backdrop: the rift, the plain round the map, the two strongholds ------------------------------------------

const along = (x: number, z: number) => (x + z) / Math.SQRT2, across = (x: number, z: number) => (x - z) / Math.SQRT2;
const hills = noise2(311), crag = noise2(313);

export async function tornPlainBackdrop(root: THREE.Object3D) {
  const f = new Forge({ stage: 'rift-war', root } as unknown as DressContext, 'torn plain backdrop');
  f.mat('grass', { map: detail.gravel(321), tile: 12, roughness: 1 });
  f.mat('rock', { map: detail.rock(322), tile: 8, flat: true, roughness: .95 });
  f.mat('dark', { map: detail.rock(325), tile: 5, flat: true, roughness: .8 });
  f.mat('white', { map: detail.ashlar(323, 48), tile: 2.6, roughness: .7 });
  f.mat('black', { map: detail.rock(324), tile: 5, flat: true, roughness: .6, metalness: .2 });
  f.mat('gold', { roughness: .35, metalness: .6 });
  f.mat('pine', { flat: true, roughness: 1 });
  f.mat('glow', { basic: true, fog: false });
  f.mat('veil', { basic: true, fog: false, transparent: true, opacity: .32, side: THREE.DoubleSide });
  plain(f);
  rift(f, root);
  citadel(f, -150, 150);
  spires(f, 152, -152);
  f.done();
  return true;
}

/** The plain past the map's walls: rolling grassland rising to low hills, the rift's gorge cut through it on the diagonal,
 *  dark pines in drifts. (Under the map's own floor inside: it lies below it.) */
function plain(f: Forge) {
  const height = (x: number, z: number) => {
    const d = Math.max(Math.abs(x), Math.abs(z));
    if (d < 120) return -.6;
    const t = Math.min(1, (d - 120) / 320), lift = t * t * (5 + hills(x * .006, z * .006) * 15) + (hills(x * .03, z * .03) - .5) * 2.4 * Math.min(1, (d - 120) / 20);
    // The gorge the rift opens past the map: walls dropping away either side of its line, deeper the further it runs.
    const c = Math.abs(across(x, z)), deep = Math.min(1, Math.max(0, Math.abs(along(x, z)) - 165) / 50);
    const gorge = c < 18 ? (1 - c / 18) ** 1.4 * (8 + 34 * deep) : 0;
    return lift - gorge;
  };
  f.terrain('grass', -460, -460, 460, 460, 10, height, (x, y, z) => {
    const c = Math.abs(across(x, z));
    if (c < 14 && y < -2) return 0x2a2232;
    return (hills(x * .05, z * .05) > .55 ? 0x55663a : 0x4a5a34) + (y > 30 ? 0x0a0a06 : 0);
  });
  const r = rand(331);
  for (let i = 0; i < 520; i++) {
    const x = (r() - .5) * 760, z = (r() - .5) * 760, d = Math.max(Math.abs(x), Math.abs(z));
    if (d < 124 || Math.abs(across(x, z)) < 22 || hills(x * .012 + 4, z * .012) < .45) continue;
    pine(f, x, height(x, z) - .4, z, 9 + r() * 10, 'pine');
  }
}

function rift(f: Forge, root: THREE.Object3D) {
  // The scar: broken slabs of dark stone along the river's line, each its own width and lean, so its banks are ragged.
  const r = rand(342), onLane = (x: number, z: number) => Object.values(RIFT_PATHS).some(p => pointNearPath(x, z, p, 6.4));
  const floor = new THREE.Mesh(laneRibbon([{ x: -122, z: -122 }, { x: 122, z: 122 }], 8, -.014), stageMaterial('rift-war', 'torn plain rift scar',
    { color: RIFT, roughness: .7, map: detail.rock(341), emissive: 0x2a1048, emissiveIntensity: .6 }));
  floor.receiveShadow = true; floor.name = 'rift-war:torn plain rift scar'; root.add(floor);
  for (let u = -170; u < 170; u += 2.2 + r() * 1.6) {
    const c = (r() - .5) * 2, w = 9 + r() * 6, len = 3 + r() * 2.5, x = (u + c) / Math.SQRT2, z = (u - c) / Math.SQRT2;
    f.box('dark', x, -.04, z, w, .04, len, r() < .5 ? RIFT_EDGE : 0x221c2c, { rot: Math.PI / 4 + (r() - .5) * .35 });
  }
  // The seams: a wandering burning line down the scar's middle in a halo of its light, cracks branching off it (each
  // stopping short of the causeways, which bridge it).
  let u = -172, v = 0;
  while (u < 172) {
    const len = 1.6 + r() * 2.4, nv = Math.max(-2.6, Math.min(2.6, v + (r() - .5) * 2)), nu = u + len;
    const [x0, z0] = [(u + v) / Math.SQRT2, (u - v) / Math.SQRT2], [x1, z1] = [(nu + nv) / Math.SQRT2, (nu - nv) / Math.SQRT2];
    if (!onLane((x0 + x1) / 2, (z0 + z1) / 2)) {
      seam(f, x0, z0, x1, z1, 3.4 + r() * 1.6, 0x5a2a9a, -.006);
      seam(f, x0, z0, x1, z1, 1.1 + r() * .9, VIOLET_HOT, -.002);
      if (r() < .45) {
        const a = Math.atan2(z1 - z0, x1 - x0) + (r() < .5 ? 1 : -1) * (.6 + r() * .7), l = 2.5 + r() * 4, ex = x1 + Math.cos(a) * l, ez = z1 + Math.sin(a) * l;
        if (!onLane(ex, ez)) seam(f, x1, z1, ex, ez, .35 + r() * .3, VIOLET);
      }
    }
    u = nu; v = nv;
  }
  // Past each corner, the gorge: its broken walls, and the light standing up out of it in sheets.
  for (const sign of [-1, 1]) {
    for (let i = 0; i < 90; i++) {
      const a = 172 + r() * 170, side = r() < .5 ? -1 : 1, c = side * (6 + r() * 10), x = sign * (a + c) / Math.SQRT2, z = sign * (a - c) / Math.SQRT2;
      const tall = 6 + r() * 12 + Math.min(20, (a - 172) * .1);
      f.rock('rock', x, -12 - Math.min(26, (a - 172) * .2), z, 2 + r() * 4, tall, 2 + r() * 4, r() < .5 ? RIFT_EDGE : 0x3e3548, 400 + i + (sign > 0 ? 200 : 0), { rough: .45 });
    }
    for (let k = 0; k < 7; k++) {
      const a = 176 + k * 24, x = sign * a / Math.SQRT2, z = sign * a / Math.SQRT2;
      const g = new THREE.PlaneGeometry(14, 30 + k * 4).translate(0, 15 + k * 2 - 10, 0).rotateY(Math.PI / 4).translate(x, -12 - k * 2, z);
      f.add('veil', g, k % 2 ? VIOLET : VIOLET_HOT);
      seam(f, x - 3, z - 3, x + 3, z + 3, 2.6, VIOLET_HOT, -8 - k * 3);
    }
  }
}

/** A burning seam from (x0, z0) to (x1, z1), `w` wide, lying on the ground (or at `y`). */
function seam(f: Forge, x0: number, z0: number, x1: number, z1: number, w: number, tint: number, y = -.005) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  f.box('glow', (x0 + x1) / 2, y, (z0 + z1) / 2, w, .02, len + w * .5, tint, { rot: Math.atan2(x1 - x0, z1 - z0) });
}

/** The Dawn's citadel past its corner: a curtain of white stone round a hill, round towers with gold cones, the great keep
 *  with its gold spire, and banners of the Dawn's ivory. */
function citadel(f: Forge, cx: number, cz: number) {
  const r = rand(351), g = 6;
  f.cyl('white', cx, g - 6, cz, 44, 50, 8, 0xd8d0c0, { sides: 24 });
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * Math.PI * 2, x = cx + Math.cos(a) * 40, z = cz + Math.sin(a) * 40;
    f.cyl('white', x, g, z, 4.2, 4.6, 18 + r() * 6, WHITE, { sides: 12 });
    f.add('gold', new THREE.ConeGeometry(5, 10, 12).translate(x, g + 29, z), GOLD);
    const b = (i + .5) / 10 * Math.PI * 2;
    f.box('white', cx + Math.cos(b) * 40, g, cz + Math.sin(b) * 40, 24, 12, 3, WHITE, { rot: -b + Math.PI / 2 });
  }
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2 + .3, x = cx + Math.cos(a) * 18, z = cz + Math.sin(a) * 18, t = 26 + r() * 14;
    f.cyl('white', x, g, z, 3.2, 3.6, t, WHITE, { sides: 12 });
    f.add('gold', new THREE.ConeGeometry(3.8, 12, 12).translate(x, g + t + 6, z), GOLD);
  }
  f.box('white', cx, g, cz, 20, 40, 20, 0xf0eadc);
  f.cyl('white', cx, g + 40, cz, 7, 8, 14, WHITE, { sides: 16 });
  f.add('gold', new THREE.ConeGeometry(8.5, 34, 16).translate(cx, g + 71, cz), GOLD);
  f.add('gold', new THREE.SphereGeometry(1.6, 10, 8).translate(cx, g + 89, cz), GOLD);
  for (const [dx, dz] of [[-10.2, 0], [10.2, 0], [0, -10.2], [0, 10.2]]) f.box('gold', cx + dx, g + 10, cz + dz, Math.abs(dx) ? .3 : 7, 22, Math.abs(dz) ? .3 : 7, 0xb89040);
}

/** The Offering's fortress past theirs: black spires raking up from a jagged keep, thorns on every edge, a violet light in
 *  its windows. */
function spires(f: Forge, cx: number, cz: number) {
  const r = rand(361), g = 4;
  f.cyl('black', cx, g - 6, cz, 40, 48, 10, BLACK, { sides: 9 });
  for (let i = 0; i < 16; i++) {
    const a = r() * Math.PI * 2, d = 8 + r() * 30, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d, t = 26 + r() * 56 * (1 - d / 44);
    const lean = [(r() - .5) * .18, (r() - .5) * .18];
    f.add('black', new THREE.ConeGeometry(2.6 + r() * 3.4, t, 5).translate(0, t / 2, 0).rotateX(lean[0]).rotateZ(lean[1]).translate(x, g + 2, z), r() < .5 ? BLACK : BLACK_LIT);
    for (let k = 0; k < 3; k++) {
      const h = g + t * (.3 + k * .18), s = 1.2 + r() * 1.6;
      f.add('black', new THREE.ConeGeometry(.6, s * 4, 4).translate(0, s * 2, 0).rotateZ((r() < .5 ? 1 : -1) * (.9 + r() * .4)).rotateY(r() * 6).translate(x, h, z), BLACK);
    }
  }
  f.add('black', new THREE.ConeGeometry(10, 110, 6).translate(cx, g + 55, cz), BLACK_LIT);
  f.box('black', cx, g, cz, 26, 34, 22, BLACK);
  for (let i = 0; i < 22; i++) {
    const y = g + 6 + r() * 26, side = Math.floor(r() * 4), u = (r() - .5) * 18;
    const [x, z] = [[cx + u, cz - 11.1], [cx + 13.1, cz + u], [cx + u, cz + 11.1], [cx - 13.1, cz + u]][side];
    f.box('glow', x, y, z, side % 2 ? .2 : 1.1, 2.4, side % 2 ? 1.1 : .2, VIOLET);
  }
}

// ---- the pieces --------------------------------------------------------------------------------------------------

/** A dark pine: a trunk and four stacked cones, `h` tall. */
function pine(f: Forge, x: number, y: number, z: number, h: number, key = 'pine') {
  f.cyl(key, x, y, z, .22, .35, h * .3, BARK, { sides: 5 });
  for (let k = 0; k < 4; k++) f.add(key, new THREE.ConeGeometry(h * (.27 - k * .05), h * .36, 7).translate(x, y + h * (.22 + k * .17) + h * .18, z), k % 2 ? PINE : PINE_DARK);
}

function arch(f: Forge, x: number, y: number, z: number, w: number, h: number, rot: number, seed: number) {
  const r = rand(seed), dx = Math.cos(rot), dz = -Math.sin(rot), half = w * .468, pier = Math.max(1.1, w * .1);
  for (const side of [-1, 1]) {
    f.box('stone', x + dx * half * side, y - .1, z + dz * half * side, pier * 1.5, .7, pier * 1.5, STONE_DARK, { rot });
    f.box('stone', x + dx * half * side, y + .6, z + dz * half * side, pier, h - .6, pier, STONE, { rot });
  }
  f.box('stone', x, y + h, z, w + pier * 1.2, pier * .9, pier * 1.3, STONE_DARK, { rot });
  f.roof('stone', x, y + h + pier * .9, z, w * .6, pier * 1.2, pier * 1.4, STONE, rot);
  if (r() < .5) f.box('stone', x + dx * half, y + h + pier * .9, z + dz * half, pier, pier * .6, pier, STONE, { rot: rot + .3 });
}

/** A square watchtower of the plain's wall: its shaft, a corbelled gallery, merlons, a slate cap. */
function watchtower(f: Forge, x: number, y: number, z: number, w: number, h: number, rot: number, seed: number) {
  const r = rand(seed);
  f.box('stone', x, y - .5, z, w, h, w, STONE, { rot });
  f.box('stone', x, y + h - .5, z, w * 1.22, 1.2, w * 1.22, STONE_DARK, { rot });
  for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const c = Math.cos(rot), s = Math.sin(rot), ox = (u * c + v * s) * w * .5, oz = (-u * s + v * c) * w * .5;
    f.box('stone', x + ox, y + h + .7, z + oz, 1.3, 1.6, 1.3, STONE, { rot });
  }
  f.roof('roof', x, y + h + .7, z, w * .9, w * .9, w * .8 + r() * 2, ROOF, rot, w * .45);
  f.box('glow', x + Math.cos(rot) * (w / 2 + .02), y + h * .7, z - Math.sin(rot) * (w / 2 + .02), .1, 1.6, .6, 0xffb060, { rot });
}

function watchHouse(f: Forge, x: number, y: number, z: number, w: number, h: number, rot: number, seed: number) {
  const r = rand(seed), c = Math.cos(rot), s = Math.sin(rot);
  /** A point `u` along the house's front and `v` out from its centre towards the front. */
  const at = (u: number, v: number): [number, number] => [x + u * c + v * s, z - u * s + v * c];
  const body = w * .88, wall = h * .6, top = y + .6 + wall, tone = r() < .5 ? STONE : 0xb0aa9c;
  f.box('stone', x, y - .3, z, w, .9, w, STONE_DARK, { rot });
  f.box('stone', x, y + .45, z, w * .94, .3, w * .94, STONE_DARK, { rot });
  f.box('stone', x, y + .6, z, body, wall, body, tone, { rot });
  // Quoins, proud of each corner; a string course at two thirds.
  for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const [qx, qz] = at(u * body * .47, v * body * .47);
    f.box('stone', qx, y + .6, qz, body * .14, wall, body * .14, STONE_DARK, { rot });
  }
  f.box('stone', x, y + .6 + wall * .64, z, body + .14, .26, body + .14, STONE_DARK, { rot });
  // The doorway on the front, its lintel and steps; a cloth hung over it.
  { const [dx0, dz0] = at(0, body / 2 + .03); f.box('dark', dx0, y + .6, dz0, 1.5, 2.3, .16, 0x15121a, { rot }); }
  { const [lx, lz] = at(0, body / 2 + .1); f.box('stone', lx, y + 2.9, lz, 2.3, .5, .3, STONE_DARK, { rot }); }
  { const [sx, sz] = at(0, body / 2 + .45); f.box('stone', sx, y + .15, sz, 2.2, .45, .9, STONE_DARK, { rot }); }
  { const [bx, bz] = at(0, body / 2 + .06); f.box('pine', bx, y + 3.3, bz, 1.25, 1.9, .05, 0xd9cdb0, { rot }); f.box('pine', bx, y + 3.3, bz, 1.25, .18, .07, 0x3a2a44, { rot }); }
  // Two lit slits on each face, high.
  for (const [u0, v0, turn] of [[0, 1, 0], [0, -1, 0], [1, 0, Math.PI / 2], [-1, 0, Math.PI / 2]] as const)
    for (const k of [-1, 1]) {
      const along = k * body * .22, [wx, wz] = at(u0 ? u0 * (body / 2 + .03) : along, v0 ? v0 * (body / 2 + .03) : along);
      f.box('glow', wx, y + .6 + wall * .72, wz, .16, 1.1, .16, 0xffb060, { rot: rot + turn });
    }
  // The hoarding: a jettied timber gallery on corbels, under the eaves.
  for (let i = -2; i <= 2; i++) for (const [u, v] of [[i / 2.4, 1], [i / 2.4, -1], [1, i / 2.4], [-1, i / 2.4]] as const) {
    const [cx, cz] = at(u * body * .5, v * body * .5);
    f.box('stone', cx, top - .55, cz, .32, .55, .32, STONE_DARK, { rot });
  }
  f.box('dark', x, top, z, body + .8, .9, body + .8, BARK, { rot });
  f.box('dark', x, top + .9, z, body + 1, .14, body + 1, 0x2a2018, { rot });
  f.roof('roof', x, top + 1.04, z, body + 1.3, body + 1.3, h * .45, ROOF, rot, (body + 1.3) / 2);
  f.add('gold', new THREE.ConeGeometry(.16, 1.3, 6).translate(x, top + 1.04 + h * .45 + .55, z), GOLD);
}

/** A ruined hall of the plain, past the map: walls of dressed stone, buttresses, a roof fallen in at one end. */
function hall(f: Forge, x: number, y: number, z: number, w: number, h: number, rot: number, seed: number) {
  void seed;
  const dx = Math.cos(rot), dz = -Math.sin(rot);
  f.box('stone', x, y - .3, z, w, h * .55, w * .5, STONE, { rot });
  f.roof('roof', x - dx * w * .15, y + h * .55 - .3, z - dz * w * .15, w * .72, w * .56, h * .4, ROOF, rot);
  for (let i = 0; i < 5; i++) { const u = (i / 4 - .5) * w; f.box('stone', x + dx * u, y - .3, z + dz * u, 1.4, h * .5, w * .5 + 2.4, STONE_DARK, { rot }); }
  f.box('stone', x + dx * w * .4, y + h * .55 - .3, z + dz * w * .4, w * .2, 2, w * .5, STONE_DARK, { rot, tilt: .2 });
}

/** An iron brazier on a stone post, its fire lit (a way-marker beside the causeways, a base's lights). */
function brazier(f: Forge, x: number, y: number, z: number, h: number, waystone: boolean) {
  const post = Math.max(1.1, h * (waystone ? .7 : .8));
  f.box('stone', x, y, z, waystone ? .55 : .45, post, waystone ? .55 : .45, STONE_DARK);
  f.cyl('stone', x, y + post, z, .42, .24, .32, 0x3a3634, { sides: 8 });
  f.add('glow', new THREE.ConeGeometry(.3, .55, 7).translate(x, y + post + .56, z), 0xffa040);
}
