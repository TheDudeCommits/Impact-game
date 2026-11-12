import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CASTLE_PILLARS, STAGE_PROPS } from '../../game/stageProps';
import type { DressContext } from '../../render/stages/dressing';
import { stageMaterial } from '../../render/stages/build';
import { Beacons } from '../../render/stages/glow';
import { heroAir, mountainRidges } from '../../render/stages/hero';
import { detail, Forge, fromTris, noise2 } from './forge';
import { drawn, rand, tinted } from './remake';
import { surfaces } from './cc0';
import { forged, smooth, worldFloor } from './finish';
import { basketPost, flames, ironBasket, type FireAt, type FireMats } from './standingFire';

/** The play square's half (the camera's walls), the terrace's edge east, west and south, the lodge's front. */
const HALF = 38, EDGE = 52, NORTH = -54;
/** The lodge's ground, behind the forecourt (x0, x1, z0, z1). */
const LOT = [-62, 58, -76, NORTH] as const;
const SLATE = 0x646a74, SLATE_DARK = 0x3e434c, GRANITE = 0xb8bcc2, STONE = 0x6e7078, STONE_DARK = 0x4a4c54, TIMBER = 0x24201e,
  TIMBER_LIT = 0x3a332e, IRON = 0x2a2c30, RENDER = 0xd2d0c8, ROOF = 0x3a3e46, SNOW = 0xe8ecf2, OAK = 0x6a4a30,
  /** places-epic-a: the fortress's red lacquer and gold, and its firelight's warm gold. */
  LACQUER = 0x8a1c16, GOLD = 0xc8962e, FIRELIGHT = 0xffb458;
const MASTS = CASTLE_PILLARS.map(([x, z]) => ({ x, z, a: Math.atan2(z, x) })).sort((p, q) => p.a - q.a);

/** Metres outside the terrace and the lodge's ground (0 on them). */
function outside(x: number, z: number) {
  const inT = Math.abs(x) <= EDGE && z >= NORTH && z <= EDGE, inL = x >= LOT[0] && x <= LOT[1] && z >= LOT[2] && z <= LOT[3];
  if (inT || inL) return 0;
  const dT = Math.hypot(Math.max(0, Math.abs(x) - EDGE), Math.max(0, NORTH - z, z - EDGE));
  const dL = Math.hypot(Math.max(0, LOT[0] - x, x - LOT[1]), Math.max(0, LOT[2] - z, z - LOT[3]));
  return Math.min(dT, dL);
}
const rough = noise2(41), fine = noise2(42);
/** The massif behind the lodge: how far it has risen at (x, z). */
function massif(x: number, z: number) {
  const m = Math.max(0, LOT[2] - z), k = Math.exp(-(((x + 20) / 260) ** 2));
  const fall = 1 - THREE.MathUtils.smoothstep(m, 220, 340);
  return k * fall * (60 * (1 - Math.exp(-m / 12)) + 270 * (1 - Math.exp(-m / 160)) + (rough(x, z, 40) - .5) * 50 * Math.min(1, m / 40));
}
/** The mountainside's height: under the terrace hidden, falling from its walls toward the valley 130 m down, the massif
 *  rising behind the lodge. */
function ground(x: number, z: number) {
  const d = outside(x, z);
  if (d === 0) return -18;
  const down = -18 - 115 * (1 - Math.exp(-d / 90)) - (rough(x, z, 28) - .5) * 14 * Math.min(1, d / 30) - fine(x, z, 7) * 2;
  return Math.max(-130, down + massif(x, z));
}
const slope = (x: number, z: number) => Math.hypot(ground(x + 2, z) - ground(x - 2, z), ground(x, z + 2) - ground(x, z - 2)) / 4;

export async function dress(c: DressContext) {
  const [, cc0] = await Promise.all([c.sky({ url: '/assets/environment/br/sky-kuroyuki-night.webp', rotation: 0, drift: .00004, exposure: 1 }),
    surfaces(c, ['slate-patterned', 'slate-wall', 'planks-dark', 'snow'] as const)]);
  const f = new Forge(c, 'kuroyuki');
  // places-finish (5 November 2026): the terrace read flat cold grey (the playtest: "flat cold-grey cracked slabs and black
  // pillars"): its flags, walls, timber and snow were painted detail maps near white, every face flat. They are photographed
  // surfaces now with their relief and roughness (Poly Haven Patterned Slate Tiles, Castle Wall Slates, Dark Wooden Planks,
  // Snow 02), snow lying in the flags' joints and drifting in from the parapets (finish.ts worldFloor), the drifts, the snow
  // on things and the mountainside smoothed. Same terrace, masts, huts and lodge; the light keeps its cold overcast.
  const floorMat = f.mat('floor', { tile: 3.2, roughness: .9, lift: .25, wear: { key: 'kuroyuki-terrace', scale: 1.4, light: [.86, 1.08], patch: 0xdfe4ea, patchAmount: .42 } }) as THREE.MeshStandardMaterial;
  worldFloor(floorMat, cc0['slate-patterned'], 3.2, { normalScale: 1.3,
    over: { surface: cc0.snow, tile: 3, amount: .24, edge: [26, 46], edgeAmount: .7, cracks: .7, scale: 4, tint: 0xf4f6fa } });
  floorMat.color.setScalar(1.08); // places-epic-a: darker by night (1.3 under the overcast), so the firelight's gold reads on it
  // (One material a kind: the granite is the stone's, the windbreaks' slate the roofs', the snow and the ice the render's.)
  f.mat('stone', { ...cc0['slate-wall'], tile: 2.6, roughness: .9, shadow: true, lift: .4 });
  f.mat('roof', { ...cc0['slate-patterned'], tile: 1.8, roughness: .85, lift: .3 });
  // (The logs, casks and ironwork are the timber's: a dark tint on its grain.)
  f.mat('timber', { ...cc0['planks-dark'], tile: 1.8, roughness: .85, shadow: true, lift: .3 });
  f.mat('render', { ...cc0.snow, tile: 4, roughness: .97, lift: .75 });
  f.mat('land', { map: detail.rock(40), tile: 40, roughness: 1, air: .6 });
  // places-epic-a: the fortress's red lacquer and gold (the masts, the parapet's posts), glossy, no grain.
  f.mat('lacquer', { roughness: .42, metalness: .08 });
  f.mat('glow', { basic: true }); // The embers in the parapet's fire baskets

  floor(f);
  const fires: { x: number; y: number; z: number; size: number }[] = [];
  masts(f, fires);
  for (const p of STAGE_PROPS['kuroyuki-hall'] ?? []) {
    if (p.draw === 'andon' && Math.hypot(p.x, p.z) < 20) crib(f, p.x, p.z);
    else if (p.draw === 'fusuma') windbreak(f, p.x, p.z, (p.solid as { halfX: number }).halfX > 1);
    else if (p.draw === 'dais') oilStore(f, p.x, p.z);
  }
  for (const side of [-1, 1]) hut(f, side, fires);
  edges(f);
  // places-epic-a: the lodge is gone; the fortress's gate-tower and halls stand on its ground and up the massif (fortress()).
  const halls = hallLayout(), posts = parapetPosts();
  const postFires = forecourt(f, posts);
  outworks(f);
  f.terrain('land', -420, -420, 420, 420, 8, ground, (x, y, z) => {
    const s = slope(x, z) + (fine(x, z, 13) - .5) * .5, n = fine(x, z, 9);
    if (y < -125) return n > .5 ? 0xe4e8ee : 0xd8dee6;
    return s > 1.3 ? (n > .5 ? 0x2c2e34 : 0x3a3c42) : s > .85 ? 0x9aa0a8 : n > .55 ? 0xe8ecf2 : 0xd6dce4;
  });
  f.done();
  for (const [key, crease] of [['render', 60], ['land', 60]] as const) { const m = forged(f.meshes, key); if (m) smooth(m.geometry, crease); }
  c.root.add(valley(c));
  streamers(c);
  const lights = await fortress(c, halls, postFires);

  const glow = new Beacons(c.root, 24, c.ambient.time);
  for (const [i, s] of fires.entries()) glow.add(s.x, s.y + .6, s.z, s.size * 2.6, 0xff8a3a, -1, (i * .23) % 1, 1);
  glow.finish('kuroyuki fires', 1.9);
  // places-epic-a: the fortress's lights, the parapet's and the valley town's, one draw (each a fire).
  const lamps = new Beacons(c.root, lights.glows.length + 8, c.ambient.time);
  for (const [i, l] of lights.glows.entries()) lamps.add(l.x, l.y, l.z, l.size, l.colour ?? FIRELIGHT, -1, (i * .137) % 1, 1);
  lamps.finish('kuroyuki firelight', 2.5);
  // Flames over the fires near enough to see them (the parapet's baskets, the gate's braziers and torches), licking puffs
  // as over the masts (no fire field: it would pool its glow on the floor under a post).
  flames(c, lights.near, 65);
  // The flames (a fire field's, burning up out of the baskets, without its pool - it would lay one on the floor 16 m
  // under a mast).
  flames(c, fires, 61, { smoke: 0 });
  // The beacons' smoke leaning downwind and the lodge's chimneys, one draw.
  c.ambient.puffs({ spots: fires.filter(f2 => f2.size > 1).map(s2 => ({ x: s2.x, y: s2.y + 2, z: s2.z, size: s2.size * 1.6 })),
    color: 0x4a4a50, shade: 0x22222a, opacity: .3, life: 8, rise: 11, drift: [1.6, 0, .6], grow: 2, seed: 62 });
  blackSnow(c);
}

/** The terrace: slate flags at random, a granite ring through the masts' feet with iron at its edges, an iron star at the
 *  heart and iron strips out to the masts, snow lying in the lee of things; the lodge's ground flagged too. */
function floor(f: Forge) {
  const n = noise2(51);
  f.add('floor', new THREE.PlaneGeometry(2 * EDGE, EDGE - NORTH, 52, 53).rotateX(-Math.PI / 2).translate(0, 0, (EDGE + NORTH) / 2),
    (x, _y, z) => { const k = n(x, z, 9); return k > .7 ? 0x767c86 : k < .25 ? SLATE_DARK : SLATE; });
  f.add('floor', new THREE.PlaneGeometry(LOT[1] - LOT[0], LOT[3] - LOT[2]).rotateX(-Math.PI / 2).translate((LOT[0] + LOT[1]) / 2, 0, (LOT[2] + LOT[3]) / 2), SLATE_DARK);
  f.add('stone', new THREE.RingGeometry(15.8, 18.2, 96, 1).rotateX(-Math.PI / 2).translate(0, .012, 0), GRANITE);
  for (const r of [15.72, 18.28]) f.add('timber', new THREE.RingGeometry(r - .09, r + .09, 96, 1).rotateX(-Math.PI / 2).translate(0, .02, 0), IRON);
  f.add('stone', new THREE.CircleGeometry(3.4, 32).rotateX(-Math.PI / 2).translate(0, .012, 0), GRANITE);
  f.add('timber', new THREE.RingGeometry(3.3, 3.48, 48, 1).rotateX(-Math.PI / 2).translate(0, .02, 0), IRON);
  // A compass of iron at the heart: eight slim points, the long ones toward the masts.
  const star: [number, number][] = [];
  for (let k = 0; k < 16; k++) { const a = MASTS[0].a + k * Math.PI / 8, r = k % 2 ? .38 : 1.9; star.push([Math.cos(a) * r, Math.sin(a) * r]); }
  f.slab('timber', star, .024, 0x8a8e96);
  for (const m of MASTS) {
    const ux = Math.cos(m.a), uz = Math.sin(m.a), w = .08;
    f.slab('timber', [[ux * 3.5 - uz * w, uz * 3.5 + ux * w], [ux * 15.6 - uz * w, uz * 15.6 + ux * w], [ux * 15.6 + uz * w, uz * 15.6 - ux * w], [ux * 3.5 + uz * w, uz * 3.5 - ux * w]], .022, IRON);
  }
  // Snow lying flat in the lee of the masts and the windbreaks (the wind is from the north-west), never proud of the floor.
  const r = rand(52);
  const patch = (cx: number, cz: number, rx: number, rz: number) => {
    const pts: [number, number][] = [];
    for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI * 2, j = .7 + r() * .45; pts.push([cx + Math.cos(a) * rx * j, cz + Math.sin(a) * rz * j]); }
    f.slab('render', pts, .018, SNOW);
  };
  // places-finish: only the lee of the masts keeps a slab of its own; the rest of the snow lies in the flags' joints and drifts
  // in from the parapets (worldFloor's snow), where 30 more flat white cut-outs lay on the floor.
  for (const m of MASTS) patch(m.x + 1.3, m.z + 1.6, 1.5, 1.9);
}

/** The beacon masts in the pillars' boxes: a granite plinth, black timber banded in iron, a cap, an iron basket of fire; iron
 *  chains slung from each to the next, high over the fight. */
function masts(f: Forge, fires: { x: number; y: number; z: number; size: number }[]) {
  for (const { x, z } of MASTS) {
    f.box('stone', x, 0, z, 1.9, .9, 1.9, STONE_DARK);
    f.box('stone', x, .9, z, 1.96, .16, 1.96, GRANITE);
    f.box('lacquer', x, 1.06, z, 1.1, 14, 1.1, LACQUER); // places-epic-a: red lacquer banded in gold
    for (const y of [3.2, 6.4, 9.6, 12.8]) f.box('lacquer', x, y, z, 1.26, .24, 1.26, GOLD);
    f.box('timber', x, 15.06, z, 1.6, .5, 1.6, TIMBER_LIT);
    f.cyl('timber', x, 15.5, z, 1.15, .55, .55, IRON, { sides: 10 });
    // The basket's bars are short and flared, open at the top (a closed cage of bars round the glow reads as a lantern's
    // glass), the embers in the bowl and the fire burning up out of it (its glow and flames over the rim).
    for (let k = 0; k < 10; k++) {
      const a = k / 10 * Math.PI * 2;
      f.pipe('timber', [x + Math.cos(a) * 1.1, 16, z + Math.sin(a) * 1.1], [x + Math.cos(a) * 1.5, 16.75, z + Math.sin(a) * 1.5], .05, IRON, { sides: 4 });
    }
    f.cyl('glow', x, 15.98, z, 1.08, 1.08, .06, 0xff6a20, { sides: 12 });
    fires.push({ x, y: 16.85, z, size: 1.5 });
    // An iron arm for the streamer, on the outer side.
    const d = Math.hypot(x, z), ux = x / d, uz = z / d;
    f.beam('timber', [x + ux * .5, 14.3, z + uz * .5], [x + ux * 1.6, 14.3, z + uz * 1.6], .1, IRON);
  }
  for (let i = 0; i < MASTS.length; i++) {
    const a = MASTS[i], b = MASTS[(i + 1) % MASTS.length], dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz);
    const ux = dx / len, uz = dz / len, top = 14.7, sag = 3.2, steps = 9;
    const at = (t: number): [number, number, number] => [a.x + ux * .6 + (dx - ux * 1.2) * t, top - sag * 4 * t * (1 - t), a.z + uz * .6 + (dz - uz * 1.2) * t];
    for (let k = 0; k < steps; k++) f.pipe('timber', at(k / steps), at((k + 1) / steps), .07, IRON, { sides: 4 });
    // (No bells hung off the chains.)
  }
}

/** A crib of split firewood in a lantern's box: four courses crossing, snow on top. */
function crib(f: Forge, x: number, z: number) {
  for (let k = 0; k < 4; k++) for (const s of [-1, 1]) {
    const y = .15 + k * .27, along = k % 2 === 0;
    const a: [number, number, number] = along ? [x - .52, y, z + s * .26] : [x + s * .26, y, z - .52];
    const b: [number, number, number] = along ? [x + .52, y, z + s * .26] : [x + s * .26, y, z + .52];
    f.pipe('timber', a, b, .15, k % 2 ? OAK : 0x5a4028, { sides: 6 });
  }
  f.rock('render', x, 1.12, z, .5, .1, .5, SNOW, 300 + Math.round(x * 7 + z * 3), { detail: 1, rough: .2, sink: .2 });
}

/** A dry-stone windbreak of slate in a partition's box: courses of flat stones, a timber cap with snow on it, end posts,
 *  icicles, snow drifted against its windward face (never out past its box). */
function windbreak(f: Forge, x: number, z: number, alongX: boolean) {
  const rot = alongX ? 0 : Math.PI / 2, r = rand(1500 + Math.round(x * 13 + z * 7));
  const at = (u: number, v: number): [number, number] => alongX ? [x + u, z + v] : [x + v, z - u];
  for (let k = 0; k < 6; k++) {
    let u = -3.9 + (k % 2) * .35;
    while (u < 3.9) {
      const len = Math.min(3.9 - u, .9 + r() * 1.5), t = .64 - k * .018 + (r() - .5) * .04, [px, pz] = at(u + len / 2, (r() - .5) * .04);
      const k2 = r(), tint = k2 < .3 ? 0x3c4048 : k2 < .7 ? 0x484c54 : 0x545860;
      f.box('stone', px, k * .47, pz, len - .04, .45, t, tint, { rot });
      u += len;
    }
  }
  { const [px, pz] = at(0, 0); f.box('timber', px, 2.82, pz, 8.1, .18, .74, TIMBER, { rot }); f.box('render', px, 3, pz, 7.9, .16, .66, SNOW, { rot }); }
  for (const e of [-1, 1]) { const [px, pz] = at(e * 4.06, 0); f.box('timber', px, 0, pz, .3, 3.16, .3, TIMBER, { rot }); }
  for (const v of [-.36, .36]) for (let u = -3.8; u < 3.8; u += .3 + r() * .2) {
    const len = .12 + r() * .45, [px, pz] = at(u, v);
    f.add('render', new THREE.ConeGeometry(.035, len, 4).rotateX(Math.PI).translate(px, 2.82 - len / 2, pz), 0xd8ecff);
  }
  // The drift: up the windward face (north for a wall along x, west for one along z), down to the floor 0.3 m out.
  const side = -1, d0 = .33, d1 = .64, n = noise2(Math.round(x + z) + 60);
  if (alongX) f.terrain('render', x - 3.9, z + side * d1, x + 3.9, z + side * d0, .3, (px, pz) => { const t = (Math.abs(pz - z) - d0) / (d1 - d0); return Math.max(0, (1 - t) * (.35 + n(px, 0, 1.4) * .3)); }, SNOW);
  else f.terrain('render', x + side * d1, z - 3.9, x + side * d0, z + 3.9, .3, (px, pz) => { const t = (Math.abs(px - x) - d0) / (d1 - d0); return Math.max(0, (1 - t) * (.35 + n(0, pz, 1.4) * .3)); }, SNOW);
}

/** A cask: a barrel lathed in oak, two iron hoops, its ends closed; lying along z, or standing. */
function cask(f: Forge, x: number, y: number, z: number, radius: number, length: number, lying: boolean) {
  const pts = Array.from({ length: 7 }, (_, i) => { const t = i / 6; return new THREE.Vector2(radius * (.86 + .14 * Math.sin(Math.PI * t)), t * length); });
  const parts = [new THREE.LatheGeometry(pts, 8), new THREE.CircleGeometry(radius * .86, 8).rotateX(-Math.PI / 2).translate(0, length, 0),
    new THREE.CircleGeometry(radius * .86, 8).rotateX(Math.PI / 2)].map(g => g.toNonIndexed());
  let g = mergeGeometries(parts)!;
  parts.forEach(p => p.dispose());
  g.translate(0, -length / 2, 0);
  if (lying) g = g.rotateX(Math.PI / 2);
  g.translate(x, y, z);
  f.add('timber', g, (px, py, pz) => {
    const t = Math.abs(lying ? pz - z : py - y) / (length / 2);
    return (t > .68 && t < .8) || (t > .16 && t < .26) ? IRON : 0x7a5434;
  });
}

/** The beacons' oil store on a dais: a stone platform with a step, a timber rack of casks on their sides along its back (the
 *  screen's box), two casks standing (the lanterns' boxes), oil jars and a coil of rope at its front. */
function oilStore(f: Forge, x: number, z: number) {
  f.box('stone', x, 0, z, 6.2, .5, 5.2, STONE_DARK);
  f.box('stone', x, .5, z, 6.3, .12, 5.3, GRANITE);
  f.box('stone', x, 0, z + 2.78, 2.4, .3, .3, GRANITE);
  const back = z - 2.2;
  for (const u of [-2.95, 0, 2.95]) f.box('timber', x + u, .62, back, .2, 2.2, .7, TIMBER);
  for (const y of [.62, 1.4, 2.18]) {
    f.box('timber', x, y, back, 6.1, .08, .7, TIMBER_LIT);
    if (y > 2) continue;
    for (let k = 0; k < 7; k++) cask(f, x - 2.55 + k * .85, y + .42, back, .33, .92, true);
  }
  for (const u of [-2.4, 2.4]) cask(f, x + u, 1.12, z + 1.6, .3, 1, false);
  for (const [u, v] of [[-.9, 1.7], [-.4, 1.9], [1.1, 1.8]] as const) f.cyl('timber', x + u, .62, z + v, .12, .18, .3, 0x8a6a4a, { sides: 8 });
  f.add('timber', new THREE.TorusGeometry(.32, .07, 4, 12).rotateX(Math.PI / 2).translate(x + .4, .7, z + 1.4), 0x9a8a6a);
}

/** A watch hut in a corner room's boxes: two log walls with their corner crossed, a post, a slate roof under snow on the jump's
 *  ceiling (3.3 m), icicles, firewood stacked along the inside, gear on pegs, a brazier in the lantern's box. */
function hut(f: Forge, side: number, fires: { x: number; y: number; z: number; size: number }[]) {
  const cx = side * 28.5, cz = 28.5, wx = side * 31.7, wz = 31.7, px = side * 25.3, pz = 25.3;
  for (let k = 0; k < 7; k++) {
    const y = .2 + k * .4;
    f.pipe('timber', [wx, y, 25], [wx, y, 32], .2, k % 2 ? 0x4a3826 : 0x3e2e20, { sides: 7 });
    f.pipe('timber', [side * 25, y + .2, wz], [side * 32, y + .2, wz], .2, k % 2 ? 0x3e2e20 : 0x4a3826, { sides: 7 });
  }
  f.box('timber', px, 0, pz, .32, 3.3, .32, TIMBER);
  f.beam('timber', [px, 3.2, pz], [wx, 3.2, pz], .22, TIMBER);
  f.beam('timber', [px, 3.2, pz], [px, 3.2, wz], .22, TIMBER);
  f.box('roof', cx, 3.3, cz, 8.4, .4, 8.4, ROOF);
  f.box('render', cx + side * .1, 3.7, cz + .1, 8.2, .3, 8.2, SNOW);
  const r = rand(side > 0 ? 71 : 72);
  for (let t = .3; t < 8; t += .28 + r() * .2) {
    const l1 = .1 + r() * .35, l2 = .1 + r() * .35;
    f.add('render', new THREE.ConeGeometry(.035, l1, 4).rotateX(Math.PI).translate(cx - side * 4.15 + side * t, 3.3 - l1 / 2, cz - 4.15), 0xd8ecff);
    f.add('render', new THREE.ConeGeometry(.035, l2, 4).rotateX(Math.PI).translate(cx - side * 4.15, 3.3 - l2 / 2, cz - 4.15 + t), 0xd8ecff);
  }
  // Firewood along the long wall's inside face, gear on pegs on the other.
  for (let row = 0; row < 4; row++) for (let k = 0; k < 9; k++) {
    const y = .15 + row * .29, zz = 26.4 + k * .48 + (row % 2) * .1;
    f.pipe('timber', [side * 31.32, y, zz - .22], [side * 31.32, y, zz + .22], .14, (row + k) % 3 ? OAK : 0x5a4028, { sides: 6 });
  }
  f.box('timber', side * 27.2, 1, wz - .3, .55, .95, .08, 0x2e2a2a);
  f.box('timber', side * 28.2, 1.1, wz - .3, .5, .85, .08, 0x3a2a22);
  f.add('timber', new THREE.TorusGeometry(.28, .06, 4, 12).translate(side * 29.4, 1.8, wz - .32), 0x9a8a6a);
  // The brazier on its tripod.
  const bx = side * 26.7, bz = 26.7;
  for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2; f.pipe('timber', [bx + Math.cos(a) * .32, 0, bz + Math.sin(a) * .32], [bx + Math.cos(a) * .18, .62, bz + Math.sin(a) * .18], .035, IRON, { sides: 4 }); }
  f.cyl('timber', bx, .6, bz, .44, .24, .34, IRON, { sides: 10 });
  fires.push({ x: bx, y: .95, z: bz, size: .42 });
}

/** The terrace's edges: retaining walls down into the mountainside with buttresses, a stone parapet with granite coping and
 *  snow on it (open in the south for the lookout), drifts along its foot. */
function edges(f: Forge) {
  const outline: [number, number][] = [[-EDGE, EDGE], [EDGE, EDGE], [EDGE, NORTH], [LOT[1], NORTH], [LOT[1], LOT[2]], [LOT[0], LOT[2]], [LOT[0], NORTH], [-EDGE, NORTH]];
  f.wall('stone', outline, -26, 25.98, 1.6, (_x, y) => y < -12 ? STONE_DARK : STONE, true);
  for (let i = 0; i < outline.length; i++) {
    const [x0, z0] = outline[i], [x1, z1] = outline[(i + 1) % outline.length], len = Math.hypot(x1 - x0, z1 - z0);
    const nx = -(z1 - z0) / len, nz = (x1 - x0) / len;
    for (let t = 5; t < len - 2; t += 10) {
      const x = x0 + (x1 - x0) * t / len + nx * 1.4, z = z0 + (z1 - z0) * t / len + nz * 1.4;
      f.box('stone', x, -26, z, Math.abs(nx) > .5 ? 2.6 : 2.2, 22, Math.abs(nx) > .5 ? 2.2 : 2.6, STONE_DARK);
    }
  }
  const P = EDGE - .6, LP = LOT[1] - .6, WP = LOT[0] + .6;
  for (const path of [[[3.5, P], [P, P], [P, NORTH + .6], [LP, NORTH + .6], [LP, LOT[2]]], [[-3.5, P], [-P, P], [-P, NORTH + .6], [WP, NORTH + .6], [WP, LOT[2]]]] as [number, number][][]) {
    f.wall('stone', path, 0, 1.1, .9, STONE);
    f.wall('stone', path, 1.1, .14, 1.04, GRANITE);
    f.wall('render', path, 1.24, .18, .86, SNOW);
  }
  // Drifts along the parapet's foot, outside the play square.
  const r = rand(81), drift = (x: number, z: number, w: number, h: number, d: number, yaw: number) =>
    f.add('render', new THREE.SphereGeometry(1, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2).scale(w, h, d).rotateY(yaw).translate(x, -.04, z), SNOW);
  for (let t = -EDGE + 3; t < EDGE - 3; t += 2.4 + r() * 2.2) {
    // (Not in the lookout's opening, the woodshed or under the gantry.)
    if (Math.abs(t) > 6) drift(t, P - .9 - r() * .5, 1.4 + r() * 1.6, .3 + r() * .5, .9 + r() * .6, 0);
    if (Math.abs(t - 12) > 4.5) drift(P - .9 - r() * .5, t, .9 + r() * .6, .3 + r() * .5, 1.4 + r() * 1.6, 0);
    if (t < -25 || t > -5) drift(-P + .9 + r() * .5, t, .9 + r() * .6, .3 + r() * .5, 1.4 + r() * 1.6, 0);
  }
}

/** Outside the play square: the cable gantry east and its cable down to the valley, the woodshed west, the lookout south. */
function outworks(f: Forge) {
  // The gantry: an A-frame straddling the parapet, a winding drum, the cable falling away east-south-east with a basket on it.
  const gx = EDGE + .4, gz = 12;
  for (const dz of [-3, 3]) {
    f.beam('timber', [gx - 2.6, 0, gz + dz], [gx + .3, 9.2, gz + dz * .25], .34, TIMBER);
    f.beam('timber', [gx + 7, ground(gx + 7, gz + dz) - 1, gz + dz], [gx + .3, 9.2, gz + dz * .25], .34, TIMBER);
  }
  f.beam('timber', [gx + .3, 9.2, gz - 1], [gx + .3, 9.2, gz + 1], .4, TIMBER);
  f.add('timber', new THREE.CylinderGeometry(1.1, 1.1, .5, 14).rotateX(Math.PI / 2).translate(gx + .3, 8.4, gz), IRON);
  const end = new THREE.Vector3(360, -127, 110), start = new THREE.Vector3(gx + 1.3, 8.2, gz);
  for (const dz of [-.35, .35]) f.pipe('timber', [start.x, start.y, start.z + dz], [end.x, end.y + 6, end.z + dz], .1, 0x202226, { sides: 4 });
  { const p = start.clone().lerp(end, .16); f.box('timber', p.x, p.y - 2.4, p.z, 1.2, 1, 1.2, OAK); for (const [dx, dz] of [[-.5, -.5], [.5, -.5], [-.5, .5], [.5, .5]]) f.beam('timber', [p.x + dx, p.y - 1.4, p.z + dz], [p.x, p.y + 5.9 - 6, p.z], .03, IRON); }
  f.box('timber', end.x, end.y - 3, end.z, 6, 9, 5, TIMBER);
  f.roof('render', end.x, end.y + 6, end.z, 7, 6, 2.4, SNOW);
  // The woodshed along the west parapet: posts, a lean-to of slate, the stacked rounds' ends facing the terrace.
  for (let z = -24; z <= -6; z += 4.5) f.box('timber', -46.2, 0, z, .28, 2.6, .28, TIMBER);
  f.lean('roof', -48.5, 2.55, -15, 19, 5, .9, ROOF, Math.PI / 2);
  f.lean('render', -48.4, 2.8, -15, 18.6, 4.6, .82, SNOW, Math.PI / 2);
  for (let row = 0; row < 6; row++) for (let z = -23.6; z < -6.4; z += .38) f.pipe('timber', [-50.4, .2 + row * .34, z + (row % 2) * .19], [-47.4, .2 + row * .34, z + (row % 2) * .19], .17, (row * 7 + Math.round(z * 3)) % 4 ? OAK : 0x5a4028, { sides: 6 });
  // The lookout on its stilts over the drop.
  f.box('timber', 0, -.25, 57.3, 10.4, .25, 12, TIMBER_LIT);
  for (const x of [-5, -2.5, 0, 2.5, 5]) f.box('timber', x, 0, 63.1, .2, 1.1, .2, TIMBER);
  for (let z = 52.5; z <= 63; z += 2.6) for (const x of [-5.1, 5.1]) f.box('timber', x, 0, z, .2, 1.1, .2, TIMBER);
  f.box('timber', 0, 1.05, 63.1, 10.4, .14, .2, TIMBER); for (const x of [-5.1, 5.1]) f.box('timber', x, 1.05, 57.4, .2, .14, 11.6, TIMBER);
  for (const x of [-4.6, 0, 4.6]) for (const z of [53.5, 58.4, 62.6]) {
    const y0 = ground(x, z) - 1.5;
    f.box('timber', x, y0, z, .5, -.25 - y0, .5, TIMBER);
    if (z < 62) f.beam('timber', [x, y0 + 2, z], [x, -.6, z + 4.9], .22, TIMBER);
  }
  for (const z of [53.5, 58.4, 62.6]) f.box('timber', 0, -.6, z, 10, .35, .35, TIMBER);
  f.box('timber', 4.6, 0, 62.6, .22, 6.5, .22, TIMBER);
}

/** The Watch's streamers, one from each mast's arm: charcoal cloth, a band of ember red, a pale snowflake round an ember. */
function streamers(c: DressContext) {
  const map = drawn(128, 512, (g, w, h) => {
    g.fillStyle = '#1e1c1e'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#8a2a18'; g.fillRect(0, 0, w, 40); g.fillRect(0, h - 120, w, 14);
    const cx = w / 2, cy = 150;
    g.strokeStyle = '#d8dce2'; g.lineWidth = 7; g.lineCap = 'round';
    for (let k = 0; k < 6; k++) {
      const a = k * Math.PI / 3, ex = cx + Math.cos(a) * 46, ey = cy + Math.sin(a) * 46;
      g.beginPath(); g.moveTo(cx, cy); g.lineTo(ex, ey); g.stroke();
      for (const s of [-1, 1]) { const bx = cx + Math.cos(a) * 28, by = cy + Math.sin(a) * 28; g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + Math.cos(a + s * .8) * 15, by + Math.sin(a + s * .8) * 15); g.stroke(); }
    }
    const ember = g.createRadialGradient(cx, cy, 0, cx, cy, 16); ember.addColorStop(0, '#ffd08a'); ember.addColorStop(.6, '#f06a20'); ember.addColorStop(1, '#8a2a10');
    g.fillStyle = ember; g.beginPath(); g.arc(cx, cy, 15, 0, Math.PI * 2); g.fill();
    // Torn tails.
    g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(i * 34 - 4, h); g.lineTo(i * 34 + 14, h - 70 - (i % 2) * 40); g.lineTo(i * 34 + 30, h); g.fill(); }
    g.globalCompositeOperation = 'source-over';
  }, { repeat: false });
  for (const { x, z } of MASTS) {
    const d = Math.hypot(x, z), ux = x / d, uz = z / d;
    c.ambient.cloth(map, { x: x + ux * 1.5, y: 14.2, z: z + uz * 1.5, width: .85, height: 4.4, rot: Math.atan2(x, z), wind: .5, lit: .3 });
  }
}

/** Far below: r7's valley of snow, its black pines on the slopes under the terrace and over the valley floor, and the near
 *  ridges between the painted ranges and the valley. */
function valley(c: DressContext) {
  const group = new THREE.Group();
  group.name = 'kuroyuki valley';
  const field = new THREE.Mesh(new THREE.CircleGeometry(900, 48).rotateX(-Math.PI / 2).translate(0, -130.4, 0),
    stageMaterial(c.stage, 'Kuroyuki snowfield', { color: 0xe4e8ee, roughness: 1 }));
  field.name = 'kuroyuki snowfield';
  group.add(field);
  const cone = (r: number, h: number, y: number) => new THREE.ConeGeometry(r, h, 7, 1).translate(0, y, 0);
  const tree = mergeGeometries([cone(1, 2.2, 2.6), cone(.75, 1.8, 3.9), cone(.45, 1.3, 5), new THREE.CylinderGeometry(.12, .16, 1.6, 5).translate(0, .8, 0)].map(g => g.toNonIndexed()))!;
  tinted(tree, (y) => y > 5.2 ? 0xe8eef2 : y > 1.5 ? 0x18221e : 0x241a14);
  const pines = new THREE.InstancedMesh(tree, heroAir(stageMaterial(c.stage, 'Kuroyuki pines', { color: 0xffffff, vertexColors: true, roughness: .95, flatShading: true }), .35), 850);
  const r = rand(4711), m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  let n = 0;
  for (let tries = 0; n < pines.count && tries < 40000; tries++) {
    const x = (r() - .5) * 1100, z = (r() - .5) * 1100, d = outside(x, z);
    if (d < 14 || Math.hypot(x, z) > 560) continue;
    const y = Math.abs(x) < 420 && Math.abs(z) < 420 ? ground(x, z) : -130;
    if (y > -24 || massif(x, z) > 50 || (Math.abs(x) < 420 && Math.abs(z) < 420 && slope(x, z) > 1)) continue;
    if (Math.sin(x * .021 + z * .013) + Math.sin(x * .007 - z * .019) < -.5 && r() < .8) continue;
    const s = 3.4 + r() * 5;
    q.setFromAxisAngle(up, r() * 6.28);
    pines.setMatrixAt(n++, m.compose(new THREE.Vector3(x, y - .4, z), q, new THREE.Vector3(s, s * (1.1 + r() * .5), s)));
  }
  pines.count = n;
  pines.name = 'kuroyuki pines'; pines.frustumCulled = false;
  group.add(pines);
  const ridges = mountainRidges({ radius: 760, count: 16, seed: 29, base: -140, height: [150, 260], far: 0x6a7280, near: 0x30363e, crest: 0xc4ccd6 });
  ridges.material.fog = true;
  group.add(ridges);
  return group;
}

/** The black snow: ash-dark flakes falling slowly over the terrace and out over the drop (one draw). */
function blackSnow(c: DressContext) {
  c.ambient.motes({ min: [-90, -10, -90], max: [90, 40, 90], count: 2200, velocity: [.45, -1.2, .22], size: .2,
    color: 0x141418, color2: 0x6a4a40, opacity: .9, wobble: 1.4, seed: 63 });
  // places-epic-a: the flakes that fall through the firelight before the gate-tower, lit gold.
  c.ambient.motes({ min: [-60, -4, -110], max: [60, 60, -40], count: 700, velocity: [.4, -1.1, .2], size: .26,
    color: 0xffc888, color2: 0x8a5a40, opacity: .8, wobble: 1.4, additive: true, seed: 64 });
}

/** places-epic-a: a hall's foot: its front on the slope, its back built into the mountain. */
const seat = (x: number, z: number, h: number) => Math.min(ground(x - h * .3, z + h * .42), ground(x, z + h * .45), ground(x + h * .3, z + h * .42)) - 1.2;

/** places-epic-a: where the fortress's halls stand up the massif: rows climbing behind the gate-tower, staggered, each on
 *  the highest ground under it. */
function hallLayout() {
  const r = rand(808), out: { x: number; y: number; z: number; h: number; rot: number }[] = [];
  const rows = [
    { z: -104, xs: [-74, -4, 66], h: 30 }, { z: -138, xs: [-112, -40, 30, 102], h: 34 }, { z: -176, xs: [-84, -8, 72], h: 40 },
    { z: -214, xs: [-130, -40, 70], h: 44 }, { z: -262, xs: [-100, 84], h: 52 },
  ];
  for (const row of rows) for (const x0 of row.xs) {
    const x = x0 + (r() - .5) * 10, z = row.z + (r() - .5) * 8, h = row.h * (.9 + r() * .2);
    out.push({ x, y: seat(x, z, h), z, h, rot: (r() - .5) * .2 });
  }
  // The great keeps on the axis behind the gate-tower, towering over it: the fortress's climbing heart.
  for (const [x, z, h] of [[0, -128, 72], [-12, -236, 96]] as const) {
    out.push({ x, y: seat(x, z, h), z, h, rot: 0 });
  }
  return out;
}

/** places-epic-a: the fortress's towers on the mountain's shoulders east and west, each a three-tier hall on a tall stone
 *  plinth rising out of the slope past the parapet, so the fortress's lights stand in every heading. */
const TOWERS = [{ x: -118, z: -24, h: 36, base: 6 }, { x: 122, z: -10, h: 38, base: 4 }, { x: -104, z: 64, h: 30, base: -2 }, { x: 110, z: 76, h: 32, base: -4 }];

/** places-epic-a: the posts round the parapet (not in the lookout's opening), each with a fire basket. */
function parapetPosts() {
  const P = EDGE - .6, out: [number, number][] = [];
  for (let t = -P + 4; t <= P - 4; t += 8.5) out.push([t, P], [P, t], [-P, t]);
  return out.filter(([x, z]) => !(Math.abs(x) < 6 && z > 0));
}

/** places-epic-a: the lodge's ground cleared to a forecourt before the gate-tower (steps up to its stair), the towers'
 *  plinths on the shoulders, the parapet's red posts, each with an iron fire basket on its top; their fires returned. */
function forecourt(f: Forge, posts: [number, number][]): FireAt[] {
  for (let k = 0; k < 3; k++) f.box('stone', 0, k * .3, -57.2 - k * 1.1, 26 - k * 2, .3, 1.4, k % 2 ? STONE : STONE_DARK);
  for (const t of TOWERS) {
    const low = Math.min(ground(t.x - 14, t.z), ground(t.x + 14, t.z), ground(t.x, t.z - 14), ground(t.x, t.z + 14)) - 4;
    f.box('stone', t.x, low, t.z, t.h * 1.05, t.base - low, t.h * 1.05, STONE_DARK);
    f.box('stone', t.x, t.base - .6, t.z, t.h * 1.12, .6, t.h * 1.12, STONE);
  }
  const iron: FireMats = { iron: 'timber', glow: 'glow' };
  return posts.map(([x, z]) => {
    f.box('lacquer', x, 1.2, z, .2, 3.1, .2, LACQUER);
    f.box('lacquer', x, 4.3, z, .26, .08, .26, GOLD);
    return ironBasket(f, iron, x, 4.38, z, .3, { tint: IRON });
  });
}

/** places-epic-a: the fortress: its gate-tower over the terrace's north end, its halls up the massif, lights along their
 *  fronts, up the stairs between them and round the parapet, and a town's lights far down in the valley. Returns every light
 *  for one Beacons draw, and the fires near enough for flames.
 *  Every one of them is fire, standing on something - the gate's braziers and torches on posts at its foot, the stairs'
 *  torches on posts, the baskets on the parapet's posts (forecourt()), the halls' torches set in their walls, the valley's
 *  hearths and watch fires; the gate-tower's middle bay is an open gateway. */
async function fortress(c: DressContext, halls: ReturnType<typeof hallLayout>, postFires: FireAt[]) {
  const { kit } = c;
  await kit.load(['own/kuro-gate', 'own/kuro-tiers']);
  const out: { x: number; y: number; z: number; size: number; colour?: number }[] = [], near: FireAt[] = [];
  const r = rand(809);
  const GATE_H = 36, GATE_Z = -67;
  kit.place('own/kuro-gate', { x: 0, y: 0, z: GATE_Z, height: GATE_H, rot: 0 });
  // The ironwork of the gate's fires and the stairs' torches, in a Forge of its own (the terrace's is done).
  const t = new Forge(c, 'kuroyuki standing fires');
  t.mat('iron', { roughness: .55, metalness: .45 });
  t.mat('stone', { roughness: .9 });
  t.mat('wood', { roughness: .85 });
  t.mat('glow', { basic: true });
  const m: FireMats = { iron: 'iron', stone: 'stone', wood: 'wood', glow: 'glow' };
  // The gate's fires at its foot: a great brazier on a granite plinth either side of the forecourt's steps, four torches
  // on red posts before them, their glows small enough (2.6 m and 1.6 m) that the flames show.
  for (const s of [-1, 1]) {
    t.box('stone', s * 14.6, 0, -57.6, 1.6, 1.1, 1.6, STONE_DARK);
    t.box('stone', s * 14.6, 1.1, -57.6, 1.76, .14, 1.76, GRANITE);
    const big = ironBasket(t, m, s * 14.6, 1.24, -57.6, .62);
    near.push(big); out.push({ x: big.x, y: big.y + .45, z: big.z, size: 2.6 });
    for (const x of [6.4, 10.4]) {
      const post = basketPost(t, m, s * x, -55.3, 3.2, .26, { post: 'wood', postTint: LACQUER, thick: .1 });
      near.push(post); out.push({ x: post.x, y: post.y + .2, z: post.z, size: 1.6 });
    }
  }
  const tiers = [...halls, ...TOWERS.map(t2 => ({ x: t2.x, y: t2.base, z: t2.z, h: t2.h, rot: Math.atan2(-t2.x, -t2.z) }))];
  for (const hall of tiers) {
    const { x, y, z, h, rot } = hall;
    kit.place('own/kuro-tiers', { x, y, z, height: h, rot });
    // A torch set in each tier's wall along its front (toward the terrace) and at its corners, a little uneven, under the
    // eaves: far enough off that its fire is its glow.
    const fx = Math.sin(rot), fz = Math.cos(rot), sx = Math.cos(rot), sz = -Math.sin(rot);
    for (const [ty, tw] of [[.2, .46], [.47, .38], [.7, .3]] as const) {
      for (let k = 0; k < 5; k++) {
        const along = (k / 4 - .5) * 2 * tw * h, out_ = h * .5 * (1 - ty * .4);
        out.push({ x: x + sx * along + fx * out_, y: y + ty * h - r() * .6, z: z + sz * along + fz * out_, size: (1.3 + h * .035) * (.8 + r() * .5), colour: r() < .3 ? 0xff8a3a : FIRELIGHT });
      }
    }
  }
  // The stairs climbing between the halls, a torch on a post either side every 7 m, its glow over the post's basket
  // (2.4 m over the step).
  for (const sx of [-30, 40, -95, 0]) {
    for (let z = -80; z > -300; z -= 7) {
      const x = sx + Math.sin(z * .045) * 12;
      for (const e of [-1, 1]) {
        const at = basketPost(t, m, x + e * 2, z, 2.15, .17, { y: ground(x + e * 2, z), post: 'wood', postTint: 0x2a1e18, thick: .07 });
        out.push({ x: at.x, y: at.y + .1, z, size: 1.5 });
      }
    }
  }
  // The parapet's posts: their baskets' fires (forecourt()).
  for (const p of postFires) { near.push(p); out.push({ x: p.x, y: p.y + .2, z: p.z, size: 1.6 }); }
  // Far down in the valley, the town's hearths and watch fires.
  for (let i = 0; i < 160; i++) {
    const a = (r() - .5) * Math.PI * 1.5 + Math.PI / 2, d = 180 + r() * 260, x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (outside(x, z) < 40) continue;
    out.push({ x, y: -128 + r() * 3, z, size: 2.4 + r() * 2.4, colour: r() < .2 ? 0xff8a40 : FIRELIGHT });
  }
  t.done();
  kit.flush(c.stage);
  // The halls and the gate-tower lit by their own fires: a share of their own picture given back as warm light, so the
  // red lacquer and the gold read against the night (their roofs stay dark).
  for (const [piece, share] of [['own/kuro-tiers', .75], ['own/kuro-gate', .62]] as const) {
    for (const mat of kit.pieceMaterials(piece) as THREE.MeshStandardMaterial[]) {
      if (!mat.map) continue;
      mat.emissiveMap = mat.map; mat.emissive.set(0xffc890); mat.emissiveIntensity = share; mat.needsUpdate = true;
    }
  }
  return { glows: out, near };
}
