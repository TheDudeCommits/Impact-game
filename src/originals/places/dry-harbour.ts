import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { STAGE_PROPS } from '../../game/stageProps';
import type { DressContext } from '../../render/stages/dressing';
import { placeProps, stageMaterial } from '../../render/stages/build';
import { Beacons } from '../../render/stages/glow';
import { heroAir } from '../../render/stages/hero';
import { STAGE_LANDMARKS } from '../../game/environmentLayout';
import { dustSeaFlag } from './dustSea';
import { rand, tinted } from './remake';
import { Forge, detail, noise2 } from './forge';
import { surfaces } from './cc0';
import { CHEERING, KNEELING, STANDING, bunting, inlay, people } from './richness';
import { crater } from './battleScars';

/** The Dry Harbour: the Dust Sea's harbour years after the sea went out - the plaza and the old quay's parapet, the dry bay a
 *  cracked salt flat, a town of sun-bleached sandstone terraced up the red bluff behind, a stepped stone crane in the
 *  platform's boxes, and out on the old seabed two colossal broken stone hands that once held the harbour's chain across its
 *  mouth, the chain still slung between them. Golden hour, a dust storm coming. Nothing new stands in the field but the
 *  cover in its boxes and a flat crater. */
export async function dress(c: DressContext) {
  const { kit } = c;
  const props = STAGE_PROPS['dry-harbour'] ?? [];
  const [, , S] = await Promise.all([
    c.sky({ url: '/assets/environment/br/sky-dry-harbour.webp', rotation: 0, drift: 0 }),
    kit.load(['harbor/crate', 'harbor/barrel', 'harbor/crate-bottles', 'br/kenney-pirate-cannon-mobile', 'br/kenney-pirate-cannon', 'br/meshy-rubble', 'own/harbour-hand', 'own/harbour-town', 'own/harbour-crane', ...MARKET_PIECES]),
    surfaces(c, ['flagstone'] as const),
  ]);
  kit.grade = (material, piece) => {
    if (piece === 'own/harbour-hand' || piece === 'own/harbour-town' || piece === 'own/harbour-crane') {
      heroAir(material, .12, .15);
      if (material.map) { material.emissive.setRGB(1, .7, .45); material.emissiveMap = material.map; material.emissiveIntensity = .2; material.needsUpdate = true; }
      return;
    }
    material.color.multiply(new THREE.Color(0xf0dcc0));
  };
  placeProps(kit, props);
  kit.shadows.add('harbor/crate').add('harbor/barrel').add('harbor/crate-bottles').add('br/kenney-pirate-cannon-mobile').add('br/meshy-rubble');
  market(c);
  harbour(c, S.flagstone);
  townPieces(c);
  epic(c);
  kit.flush(c.stage);
  spar(c, props);
  flags(c);
  dust(c);
  flats(c);
}

const salts = noise2(8101);
/** The ground's height: the bluff rising behind the plaza, the salt flat gently uneven far out. */
function saltHeight(x: number, z: number) {
  if (z < -60) return THREE.MathUtils.smoothstep(-z, 60, 95) * (24 + salts(x, z, 30) * 16) + THREE.MathUtils.smoothstep(-z, 95, 170) * (30 + salts(x + 500, z, 60) * 30);
  const far = Math.max(Math.abs(x) - 60, z - 60, 0);
  return Math.min(1, far / 60) * (salts(x, z, 26) - .5) * 2.2 - .02;
}
/** The harbour: the plaza's flagstones north of the old quay's line, the parapet in its four lengths (their boxes), the salt
 *  flat out to the horizon, the heaved salt plates in their boxes, the bluff and the town wall, and the crane. One draw a
 *  material. */
function harbour(c: DressContext, flag: Awaited<ReturnType<typeof surfaces>>['flagstone']) {
  const f = new Forge(c, 'dry harbour');
  f.mat('salt', { map: saltMap(), tile: 9, roughness: 1, wear: { key: 'dry-harbour', scale: 1.8, light: [.9, 1.05], patch: 0xb8a080, patchAmount: .2 } });
  f.mat('plaza', { ...flag, tile: 3, lift: .5, gain: 1.3, roughness: .95 });
  f.mat('stone', { map: detail.ashlar(8102, 56), tile: 2.6, roughness: .92, air: .15 });
  f.mat('rock', { map: detail.rock(8103), tile: 12, roughness: .96, air: .2, flat: true });
  f.mat('roof', { roughness: .85, air: .15 });
  f.mat('dark', { roughness: .9, air: .15 });
  f.terrain('rock', -500, -380, 500, 600, 8, saltHeight, (_x, y, z) => z < -60 ? (y > 30 ? 0xc0704a : 0xa85a3a) : 0xf2e2c8);
  f.add('plaza', new THREE.PlaneGeometry(150, 50).rotateX(-Math.PI / 2).translate(0, .01, -35).toNonIndexed(), 0xfff4e4);
  f.add('salt', new THREE.PlaneGeometry(240, 230).rotateX(-Math.PI / 2).translate(0, .006, 105).toNonIndexed(), 0xffffff);
  for (const b of STAGE_LANDMARKS['dry-harbour']) {
    if (Math.abs(b.halfY - .65) < .01) { f.box('stone', b.x, 0, b.z, b.halfX * 2, 1.3, b.halfZ * 2, 0xe8d4b8); f.box('stone', b.x, 1.3, b.z, b.halfX * 2 + .3, .18, b.halfZ * 2 + .3, 0xd8c0a0); }
    else if (b.y < 1.2 && b.halfY > .6 && b.halfY < 1.2 && b.z > -10) {
      const r = rand(Math.round(b.x * 13 + b.z * 7));
      f.box('salt', b.x, -.6, b.z, b.halfX * 2, b.halfY * 2 + .6, b.halfZ * 2, 0xf4e8d4, { rot: r() * .6 - .3, tilt: (r() - .5) * .3, roll: (r() - .5) * .35 });
    }
  }
  for (const [x0, x1, z] of [[-60, -36.5, -6.5], [-27.5, -20, -11], [-11.5, 11.5, -14.5], [20, 27.5, -11], [36.5, 60, -6.5]] as const) f.box('stone', (x0 + x1) / 2, -.6, z, x1 - x0, .64, 1.6, 0xd8c4a6);
  crane(f);
  town(f);
  f.done();
}

/** The harbour crane where the platform's boxes stand (its two steps, its tower to 20 m and its deck 21 m up): a stepped
 *  plinth, a tapering tower of sandstone blocks, its deck, and a timber jib with its chain and hook swung out over the plaza. */
function crane(f: Forge) {
  const x = -27, z = -32.6;
  f.box('stone', x, 0, z, 10, 1.2, 10, 0xe0c8a8);
  f.box('stone', x, 1.2, z, 8.4, 1.2, 8.4, 0xead6b8);
  f.add('stone', new THREE.CylinderGeometry(3.1, 3.5, 18, 4, 1).rotateY(Math.PI / 4).translate(x, 2.4 + 9, z), 0xf0dcc0);
  for (const y of [7, 13, 19]) f.box('stone', x, y, z, 7.2 - y * .05, .4, 7.2 - y * .05, 0xc8a882);
  f.box('dark', x, 4.5, z + 3.55, 1.6, 2.8, .2, 0x3a2a20);
  f.box('stone', x, 20.3, z, 10.4, 1.2, 10.4, 0xd8bc98);
  f.beam('roof', [x - 2, 21.5, z], [x - 2, 30, z], .6, 0x6a4a30);
  f.beam('roof', [x - 2, 29, z], [x + 13, 25, z + 6], .55, 0x6a4a30);
  f.beam('roof', [x - 2, 22, z], [x + 10, 25.6, z + 4.8], .4, 0x6a4a30);
  f.pipe('dark', [x + 13, 25, z + 6], [x + 13, 14, z + 6], .06, 0x2a2420);
  f.add('dark', new THREE.TorusGeometry(.7, .18, 5, 12, Math.PI * 1.4).rotateZ(Math.PI * .8).translate(x + 13, 13.4, z + 6), 0x3a3028);
  f.add('roof', new THREE.TorusGeometry(2, .25, 6, 16).rotateY(Math.PI / 2).translate(x + 3.6, 23.4, z), 0x5a3a24);
}

/** The harbour wall along the bluff's foot behind the plaza. */
function town(f: Forge) {
  f.box('stone', 0, -.5, -61, 160, 6.5, 3, 0xd8bc98);
}
/** The town on the bluff (own/harbour-town.glb, one instanced draw) and two old harbour cranes on the quay's ends
 *  (own/harbour-crane.glb), their jibs over the dry bay. */
function townPieces(c: DressContext) {
  for (const [x, z, w, rot] of [[-125, -84, 70, .3], [-58, -92, 76, -.1], [8, -88, 70, .15], [72, -94, 74, -.25], [136, -82, 66, .4], [-95, -132, 90, .1], [40, -136, 96, -.2]] as const)
    c.kit.place('own/harbour-town', { x, z, y: saltHeight(x, z) - 8, width: w, rot, shadow: false });
  for (const [x, z, rot] of [[-64, -14, .3], [62, -12, -.4]] as const) c.kit.place('own/harbour-crane', { x, z, height: 24, rot, shadow: false });
}

/** The salt: cream and pale ochre, split by a net of dark cracks into plates. */
function saltMap() {
  return drawnSalt();
}
function drawnSalt() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const g = canvas.getContext('2d')!, r = rand(8120);
  g.fillStyle = '#ece0c8'; g.fillRect(0, 0, 512, 512);
  for (let k = 0; k < 900; k++) { g.fillStyle = `rgba(${200 + r() * 40},${180 + r() * 40},${150 + r() * 40},.25)`; g.fillRect(r() * 512, r() * 512, 4 + r() * 20, 4 + r() * 20); }
  g.strokeStyle = 'rgba(110,88,66,.75)'; g.lineWidth = 2.4; g.lineJoin = 'round';
  for (let k = 0; k < 26; k++) {
    let x = r() * 512, y = r() * 512, a = r() * 6.28;
    g.beginPath(); g.moveTo(x, y);
    for (let s = 0; s < 18; s++) { a += (r() - .5) * 1.1; x += Math.cos(a) * 14; y += Math.sin(a) * 14; g.lineTo(x, y); }
    g.stroke();
    for (const [ox, oy] of [[512, 0], [-512, 0], [0, 512], [0, -512]]) { g.save(); g.translate(ox, oy); g.stroke(); g.restore(); }
  }
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}

/** The market's and the dry bay's pieces. */
const MARKET_PIECES = ['br/meshy-stall', 'br/umbrella', 'br/cart', 'br/pot', 'cc0/ship-hulk', 'harbor/boat-row-large', 'harbor/boat-row-small', 'cc0/barrels', 'cc0/crate', 'br/kenney-town-wheel'];
/** The market along the plaza's north edge with its stalls, umbrellas, carts and stores, and the sea's leavings on the dry bay:
 *  a hull on her side, rowing boats where the water left them, wheels. */
function market(c: DressContext) {
  const { kit } = c, r = rand(771);
  for (let x = -16; x <= 16; x += 8) {
    kit.place('br/meshy-stall', { x, z: -43.5 - (Math.abs(x) % 2), height: 3.4, rot: Math.PI + (r() - .5) * .2, tint: 0xf0e0c8 });
    kit.place('br/pot', { x: x + 2.6, z: -42.2, height: .9, rot: r() * 6, tint: 0xd8a070 });
  }
  for (const [x, z] of [[-34, -44], [34, -44], [-38, -30], [38, -30]] as const) kit.place('br/umbrella', { x, z, height: 3.6, rot: r() * 6 });
  for (const [x, z, rot] of [[-27, -46, .4], [28, -45, -.6], [-40, -20, 1.6], [41, -18, -1.4]] as const) kit.place('br/cart', { x, z, height: 1.9, rot });
  for (const [x, z] of [[-40.5, -36], [40.5, -34], [-23, -47], [23, -47.5], [-41, -8], [41, -6]] as const) {
    kit.place('cc0/barrels', { x, z, height: 1.1, rot: r() * 6 });
    kit.place('cc0/crate', { x: x + 1.4, z: z + .8, height: .9, rot: r() * 6 });
  }
  kit.place('cc0/ship-hulk', { x: -78, z: 70, y: -2.2, rot: 2.1, roll: .55, width: 38, tint: 0xb8a48a });
  for (const [piece, x, z, rot, roll] of [['harbor/boat-row-large', -46, 46, .8, .35], ['harbor/boat-row-small', 50, 44, 2.2, -.4], ['harbor/boat-row-large', 62, 58, -1.1, .25],
    ['harbor/boat-row-small', -58, 52, 2.9, .5], ['harbor/boat-row-large', 14, 52, 1.7, -.3], ['harbor/boat-row-small', -22, 61, .3, .45]] as const)
    kit.place(piece, { x, z, y: -.15, rot, roll, scale: 1.7, tint: 0xc0a888 });
  for (const [x, z] of [[44, 40.5], [-41, 41]] as const) kit.place('br/kenney-town-wheel', { x, z, height: 1.4, rot: x, tilt: 1.45, tint: 0x9a8a74 });
}

/** The harbour lived in again: the ribs of a wreck half sunk in the salt, anchors and their chains, the masts of buried hulls,
 *  laundry and rag pennants between the flag poles, the scavengers at the market and on the flats, cart ruts across the salt
 *  under the fight, gulls, a dust devil, the salt glinting. */
function flats(c: DressContext) {
  const { ambient } = c, r = rand(773);
  const f = new Forge(c, 'dry harbour leavings');
  f.mat('timber', { roughness: .95 });
  f.mat('iron', { roughness: .7, metalness: .3 });
  f.mat('dark', { roughness: 1 });
  f.mat('cloth', { roughness: 1, side: THREE.DoubleSide, emissive: 0x2a1c10, emissiveIntensity: .35 });
  for (let k = 0; k < 7; k++) {
    const z = 52 + k * 2.6, w = 6.5 - Math.abs(k - 3) * .5;
    let prev: THREE.Vector3 | null = null;
    for (let i = 0; i <= 10; i++) {
      const a = i / 10 * Math.PI, p = new THREE.Vector3(34 - Math.cos(a) * w, Math.sin(a) ** .7 * (5.5 - Math.abs(k - 3) * .35) - .6, z);
      if (prev && !(k % 3 === 2 && i > 6)) f.beam('timber', prev, p, .42, 0x8a7458);
      prev = p;
    }
  }
  f.beam('timber', [34, -.2, 50], [34, .2, 70], .7, 0x7a6448);
  for (const [x, z, a] of [[-44, 58, .6], [58, 40.5, -1.1], [-62, 41, 2.2]] as const) {
    const dx = Math.cos(a), dz = Math.sin(a);
    f.beam('iron', [x, .25, z], [x + dx * 4.2, .25, z + dz * 4.2], .32, 0x4a3e36);
    f.add('iron', new THREE.TorusGeometry(1.5, .2, 6, 14, Math.PI).rotateX(-Math.PI / 2).rotateY(-a + Math.PI / 2).translate(x, .25, z), 0x4a3e36);
    f.add('iron', new THREE.TorusGeometry(.55, .1, 6, 12).rotateY(-a).translate(x + dx * 4.6, .4, z + dz * 4.6), 0x4a3e36);
    for (let k = 0; k < 9; k++) f.add('iron', new THREE.TorusGeometry(.32, .08, 4, 8).rotateY(-a + (k % 2) * Math.PI / 2).translate(x + dx * (5.2 + k * .55), .15, z + dz * (5.2 + k * .55) + Math.sin(k) * .4), 0x3a302a);
  }
  for (const [x, z, h, lean] of [[-52, 72, 16, .18], [68, 88, 22, -.14], [-30, 96, 13, .3], [40, 132, 19, .1], [-96, 128, 24, -.22]] as const) {
    f.pipe('timber', [x, -.5, z], [x + lean * h, h, z + lean * h * .4], .45, 0x7a6448, { r2: .3 });
    f.beam('timber', [x + lean * h * .7 - 3, h * .72, z], [x + lean * h * .7 + 3, h * .72 + .3, z], .25, 0x6a5440);
  }
  const rags = [0xe8dcc4, 0xc8483a, 0x3a8a8a, 0xe8b860, 0xb8a8d8, 0xf4f0e8];
  for (const [a, b] of [[[-46, 9, -40], [-24, 9, -48]], [[46, 9, -40], [24, 9, -48]], [[-24, 9, -48], [24, 9, -48]], [[-46, 9, -40], [-46, 9, -12]], [[46, 9, -40], [46, 9, -12]]] as const)
    bunting(f, a, b, { colours: rags, size: 1, gap: 1.25, sag: 1.6, seed: Math.round(a[0] + b[2]) });
  f.done();
  const spots = [
    ...Array.from({ length: 34 }, () => { const x = -28 + r() * 56; return { x, y: 0, z: -40.5 - r() * 7, cell: [STANDING, STANDING, CHEERING, KNEELING][Math.floor(r() * 4)] + Math.floor(r() * 8), height: 1.72 + r() * .12, flip: r() < .5 }; }),
    ...Array.from({ length: 14 }, () => { const a = r() * Math.PI - Math.PI / 2, d = 46 + r() * 30; return { x: Math.sin(a) * d * 1.2, y: 0, z: 30 + Math.cos(a) * d * .6 + 12, cell: [STANDING, KNEELING][Math.floor(r() * 2)] + Math.floor(r() * 8), height: 1.72, flip: r() < .5 }; })
      .filter(p => Math.max(Math.abs(p.x), Math.abs(p.z)) > 40),
  ];
  people(c, spots, { robes: ['#c8a878', '#8a6a48', '#e8dcc4', '#6a7a6a', '#a8583a', '#d8c098', '#4a5a6a', '#b89060'], wraps: ['#f0e8d8', '#c8483a', '#3a6a6a', '#d8b060'] }, { name: 'dry harbour scavengers', shade: 1, sway: .03 });
  inlay(c, (g, s) => {
    const u = s / 80;
    g.translate(s / 2, s / 2);
    g.strokeStyle = 'rgba(110,86,60,.28)'; g.lineCap = 'round';
    for (const off of [-.8, .8]) {
      g.lineWidth = .32 * u; g.beginPath();
      for (let t = 0; t <= 1.0001; t += .02) { const x = (-40 + t * 80) * u, z = (Math.sin(t * 3.1 + .4) * 9 + off + 6) * u; t === 0 ? g.moveTo(x, z) : g.lineTo(x, z); }
      g.stroke();
    }
    g.fillStyle = 'rgba(96,74,52,.22)';
    for (let k = 0; k < 140; k++) { const t = k / 140, x = (-36 + t * 60) * u + (k % 2 ? 1 : -1) * .18 * u, z = (-8 + t * 44 + Math.sin(t * 7) * 3) * u; g.beginPath(); g.ellipse(x, z, .13 * u, .24 * u, .9, 0, Math.PI * 2); g.fill(); }
    g.strokeStyle = 'rgba(255,250,240,.5)'; g.lineWidth = .6 * u;
    for (let k = 0; k < 6; k++) { const rr = (30 + k * 1.6) * u; g.beginPath(); for (let a = .25; a <= Math.PI - .25; a += .05) { const q = rr + Math.sin(a * 7 + k) * 1.2 * u; const x = Math.cos(a) * q, z = Math.sin(a) * q; a === .25 ? g.moveTo(x, z) : g.lineTo(x, z); } g.stroke(); }
  }, { size: 80, px: 2048, y: .03, roughness: 1, name: 'dry harbour ruts' });
  ambient.birds({ centre: [0, 0, -30], count: 10, radius: 34, height: 16, spread: 6, speed: 8, size: .5, color: 0xf0ece4, seed: 774 });
  const devil: { x: number; y: number; z: number; size: number }[] = [];
  for (let k = 0; k < 10; k++) devil.push({ x: 52 + Math.sin(k * 1.3) * (.6 + k * .35), y: k * 2.2, z: 50 + Math.cos(k * 1.3) * (.6 + k * .35), size: 2 + k });
  ambient.puffs({ spots: devil, color: 0xe0c8a0, shade: 0xa08060, opacity: .38, life: 3.5, rise: 5, drift: [1.2, 0, -.3], grow: 1.5, seed: 775, order: 1 });
  ambient.motes({ min: [-70, .02, -40], max: [70, .3, 90], count: 420, velocity: [.05, 0, .05], size: .07, color: 0xffffff, color2: 0xfff4d8, opacity: .9, additive: true, twinkle: 1, seed: 776 });
}

/** The topmast lying in the field (its box, stageProps.ts `mast`): a spar and a yard's stub, sun-greyed timber. */
function spar(c: DressContext, props: typeof STAGE_PROPS['dry-harbour']) {
  const parts: THREE.BufferGeometry[] = [];
  for (const p of (props ?? []).filter(p => p.draw === 'mast')) {
    const len = p.length ?? 8;
    parts.push(tinted(new THREE.CylinderGeometry(.42, .5, len, 8).rotateZ(Math.PI / 2).rotateY(p.rot ?? 0).translate(p.x, .45, p.z).toNonIndexed(), 0x8a7a66));
    parts.push(tinted(new THREE.CylinderGeometry(.22, .26, 3.4, 6).rotateX(Math.PI / 2).translate(p.x + len / 2 - 1, .3, p.z).toNonIndexed(), 0x7a6a56));
  }
  if (!parts.length) return;
  const mesh = new THREE.Mesh(mergeGeometries(parts), stageMaterial(c.stage, 'Harbour spar', { color: 0xffffff, vertexColors: true, roughness: .95 }));
  parts.forEach(g => g.dispose());
  mesh.name = 'dry harbour spar'; mesh.receiveShadow = true;
  c.root.add(mesh);
}

/** The Dust Sea's flags on tall poles round the plaza, out of the field. */
function flags(c: DressContext) {
  const flag = dustSeaFlag(), parts: THREE.BufferGeometry[] = [];
  for (const [x, z] of [[-46, -40], [46, -40], [-46, -12], [46, -12], [-24, -48], [24, -48]] as const) {
    parts.push(tinted(new THREE.CylinderGeometry(.16, .22, 14, 6).translate(x, 7, z).toNonIndexed(), 0x6a5a48));
    c.ambient.cloth(flag, { x: x + .1, y: 13.6, z, width: 3.2, height: 2, rot: Math.PI / 2, wind: 1.1, readable: true, lit: .3 });
  }
  const mesh = new THREE.Mesh(mergeGeometries(parts), stageMaterial(c.stage, 'Harbour poles', { color: 0xffffff, vertexColors: true }));
  parts.forEach(g => g.dispose());
  mesh.name = 'dry harbour poles';
  c.root.add(mesh);
}

/** Dust blown low across the field and the flats, haze over the dry bay, dust devils turning out on it. */
function dust(c: DressContext) {
  const { ambient } = c, r = rand(4242);
  ambient.motes({ min: [-70, -1, -50], max: [70, 5, 90], count: 320, velocity: [2.4, .1, .8], size: .06, color: 0xd8b888, color2: 0xf0dcb4, opacity: .65, wobble: .5, seed: 61 });
  const haze: { x: number; y: number; z: number; size: number }[] = [];
  for (let i = 0; i < 24; i++) { const a = r() * Math.PI - Math.PI / 2, d = 60 + r() * 160; haze.push({ x: Math.sin(a) * d, y: 2 + r() * 6, z: 40 + Math.cos(a) * d, size: 26 + r() * 24 }); }
  ambient.puffs({ spots: haze, color: 0xe8d0a8, shade: 0xa88a64, opacity: .22, life: 0, flat: true, drift: [1.4, 0, .4], seed: 62, order: 1 });
  const devils: { x: number; y: number; z: number; size: number }[] = [];
  for (const [x, z] of [[-70, 110], [60, 150], [130, 60], [-140, 70]] as const) for (let k = 0; k < 8; k++) devils.push({ x: x + Math.sin(k * 1.3) * (1 + k * .4), y: k * 3.2, z: z + Math.cos(k * 1.3) * (1 + k * .4), size: 3 + k * 1.2 });
  ambient.puffs({ spots: devils, color: 0xd8b890, shade: 0x9a7a58, opacity: .45, life: 4, rise: 6, drift: [1.6, 0, .4], grow: 1.6, seed: 63, order: 1 });
  ambient.birds({ centre: [0, 0, -40], count: 6, radius: 80, height: 70, spread: 12, speed: 6, size: 1.1, color: 0x2a1e18, seed: 64 });
}

/** The Duel's line (stages.ts duelAxis): its south seat looks out to the hands. */
const DUEL_BEARING = .45;
/** The hands on the old seabed where the Duel's south seat looks, dust drifting round them, the storm's front rolling in on
 *  the horizon, and the fight's crater in the salt. */
function epic(c: DressContext) {
  const { ambient } = c;
  const x = Math.sin(DUEL_BEARING) * 210, z = Math.cos(DUEL_BEARING) * 210;
  hands(c);
  const r = rand(1401), drift: { x: number; y: number; z: number; size: number }[] = [];
  for (let k = 0; k < 18; k++) { const t = (r() - .5) * 240, side = (r() - .5) * 50; drift.push({ x: x + Math.cos(DUEL_BEARING) * t + Math.sin(DUEL_BEARING) * side, y: 2 + r() * 10, z: z - Math.sin(DUEL_BEARING) * t + Math.cos(DUEL_BEARING) * side, size: 24 + r() * 30 }); }
  ambient.puffs({ spots: drift, color: 0xf0c890, shade: 0xa87450, opacity: .3, life: 0, flat: true, drift: [2.4, 0, .8], seed: 1402, order: 1 });
  const front: { x: number; y: number; z: number; size: number }[] = [];
  for (let k = 0; k < 26; k++) { const a = DUEL_BEARING + (r() - .5) * 1.6, dd = 520 + r() * 300; front.push({ x: Math.sin(a) * dd, y: 10 + r() * 40, z: Math.cos(a) * dd, size: 90 + r() * 110 }); }
  ambient.puffs({ spots: front, color: 0xd8a070, shade: 0x6a4030, opacity: .7, life: 0, drift: [3, 0, -1], cel: true, seed: 1403, order: 0 });
  crater(c, { size: 34, cx: -5, cz: 9, x: -5, z: 9, radius: 4.6, reach: 15, seed: 1404, strokes: [[[-18, 22], [9, -4]]], lit: Math.atan2(-.67, -.6),
    ember: 0xff9a40, strength: .7, litStone: 'rgba(250,236,210,.85)', darkStone: 'rgba(110,86,60,.85)', name: 'dry harbour crater' });
  ambient.motes({ min: [-80, 0, -60], max: [80, 14, 100], count: 360, velocity: [3.2, .2, 1], size: .08, color: 0xe8c08a, color2: 0xf8dcb0, opacity: .6, wobble: .8, seed: 1405 });
}

/** The harbour's great anchor chains run out from the quay across the salt to the hands, sagging into it and out again. */
function chains(c: DressContext) {
  const f = new Forge(c, 'dry harbour chains');
  f.mat('iron', { roughness: .65, metalness: .35 });
  const r = rand(1411);
  for (const [x0, z0, x1, z1] of [[-30, 44, HANDS[0].x - 6, HANDS[0].z - 14], [26, 44, HANDS[1].x - 4, HANDS[1].z - 16]] as const) {
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.floor(len / 2.6), yaw = Math.atan2(x1 - x0, z1 - z0);
    for (let k = 0; k < n; k++) {
      const t = k / n, x = x0 + (x1 - x0) * t + Math.sin(t * 9) * 3, z = z0 + (z1 - z0) * t;
      const y = .2 + Math.sin(t * 13 + 1) * .9 - t * 1.2;
      if (y < -1.4) continue;
      const link = new THREE.TorusGeometry(1.3, .32, 5, 10).scale(1, 1.6, 1);
      if (k % 2) link.rotateY(Math.PI / 2);
      link.rotateX(Math.PI / 2).rotateZ((r() - .5) * .3).rotateY(yaw).translate(x, y + 1.2, z);
      f.add('iron', link, k % 3 ? 0x5a4636 : 0x6a5240);
    }
  }
  f.done();
}

/** Where the two hands rise from the salt (either side of the Duel's south line, about 200 m out), their height, their turn
 *  (palms toward each other), and which is the left. */
const HANDS = [
  { x: Math.sin(DUEL_BEARING - .32) * 195, z: Math.cos(DUEL_BEARING - .32) * 195, h: 86, yaw: DUEL_BEARING - .32 + Math.PI / 2 + .5, left: true },
  { x: Math.sin(DUEL_BEARING + .3) * 230, z: Math.cos(DUEL_BEARING + .3) * 230, h: 96, yaw: DUEL_BEARING + .3 - Math.PI / 2 - .5, left: false },
] as const;

/** The two colossal stone hands out on the seabed, each a forearm rising out of the salt, broken and crusted with dead coral,
 *  its fingers curled as if still gripping (own/harbour-hand.glb), and the harbour's great chain slung between them. */
function hands(c: DressContext) {
  const f = new Forge(c, 'dry harbour hands');
  f.mat('stone', { map: detail.rock(8130), tile: 6, roughness: .95, air: .22, emissive: 0x2a1408, emissiveIntensity: .35 });
  f.mat('iron', { roughness: .65, metalness: .35, air: .22 });
  const r = rand(8132), SHADE = 0xc0a07a;
  for (const hd of HANDS) {
    c.kit.place('own/harbour-hand', { x: hd.x, z: hd.z, y: -4, height: hd.h, rot: hd.yaw, shadow: false });
    for (let k = 0; k < 10; k++) { const a = r() * Math.PI * 2, d = (10 + r() * 14) * hd.h / 62; f.rock('stone', hd.x + Math.cos(a) * d, -1, hd.z + Math.sin(a) * d, (2 + r() * 4), (1.5 + r() * 3), (2 + r() * 4), SHADE, 8170 + k); }
  }
  const [a, b] = HANDS.map(hd => new THREE.Vector3(hd.x, hd.h * .8, hd.z));
  const len = a.distanceTo(b), n = Math.floor(len / 3.4);
  for (let k = 0; k <= n; k++) {
    const t = k / n, p = a.clone().lerp(b, t);
    p.y = THREE.MathUtils.lerp(a.y, b.y, t) - Math.sin(t * Math.PI) * (Math.min(a.y, b.y) - 6);
    const link = new THREE.TorusGeometry(1.7, .42, 5, 10).scale(1, 1.6, 1);
    if (k % 2) link.rotateY(Math.PI / 2);
    const dir = b.clone().sub(a);
    link.rotateZ(Math.PI / 2).rotateY(Math.atan2(dir.x, dir.z) + Math.PI / 2).translate(p.x, p.y, p.z);
    f.add('iron', link, k % 3 ? 0x5a4636 : 0x6a5240);
  }
  f.done();
}
