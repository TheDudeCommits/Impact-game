import * as THREE from 'three';
import type { DressContext } from '../../render/stages/dressing';
import { Beacons } from '../../render/stages/glow';
import { stageMaterial } from '../../render/stages/build';
import { Forge } from './forge';
import { keyLit, surfaces } from './cc0';
import { rand } from './remake';
import { ashMark } from './mark';

/** Tints over the scanned surfaces (near white: the photograph gives the colour). places-gen: the walls and piers pale
 *  limestone, the beams red lacquer. */
const ASH = 0xfff8ee, DARKSTONE = 0xd8cfc2, SLATE = 0xf0e8de, PALE = 0xfff6ea, TIMBER = 0xd8c4b0, LACQUER = 0xc0402c, IRON = 0x34302c;
/** The piers' line (x), the outer walls (x), the hall's ends (z), the aisles' and the nave's heights. */
const PIERS = 7.6, WALL = 10.6, FAR = -13.5, NEAR = 12, AISLE = 6.2, EAVES = 8.6, RIDGE = 11.4;
/** The piers' stations down the hall (z). */
const BAYS = [-10.5, -7, -3.5, 0, 3.5, 7, 10.5];
/** The dais's top step (y), and the Warden's station on it (z). */
const DAIS = .6, WARDEN_Z = FAR + 1.75;
/** places-gen: the far wall's two tall windows (x, bottom, top, width) and the round window in its gable (y, radius). */
const LANCET = { x: 6.1, y0: 3.1, y1: 7.5, w: 1.5 }, OCULUS = { y: 10.15, r: 1.05 };

export async function dress(c: DressContext) {
  const [S] = await Promise.all([
    surfaces(c, ['flagstone', 'ashlar-grey', 'planks-dark', 'sandstone-pale'] as const),
    c.kit.load(['cc0/lantern-wood', 'cc0/chandelier-lantern', 'cc0/barrels', 'cc0/crate', 'cc0/bucket',
      'own/proving-warden', 'own/proving-kneeler', 'own/proving-brazier', 'own/proving-rack', 'own/proving-post']),
  ]);
  const f = new Forge(c, 'proving hall');
  f.mat('floor', { ...S['sandstone-pale'], tile: 4.4, roughness: 1, gain: 1.05, normalScale: .45, wear: { key: 'proving-hall', scale: 1.4, light: [.9, 1.04], patch: 0x8a7a68, patchAmount: .18, damp: 0 } });
  f.mat('ring', { ...S['ashlar-grey'], tile: 2.4, roughness: 1, gain: 1.35 });
  f.mat('stone', { ...S['sandstone-pale'], tile: 3.4, roughness: 1, shadow: true, gain: 1.25 });
  f.mat('plinth', { ...S['ashlar-grey'], tile: 3, roughness: 1, shadow: true, gain: 1.45 });
  f.mat('timber', { ...S['planks-dark'], tile: 2.2, roughness: 1, gain: 1.7 });
  f.mat('lacquer', { ...S['planks-dark'], tile: 2.2, roughness: .7, lift: .55, gain: 1.6 });
  f.mat('daylight', { basic: true });
  f.mat('iron', { roughness: .45, metalness: .55 });
  f.mat('glow', { basic: true });

  floor(f);
  piers(f);
  walls(f);
  roof(f);
  dais(f);
  doors(f);
  f.done();
  props(c);
  banners(c);
  lights(c);
  c.ambient.motes({ min: [-5, .5, -6], max: [5, 9, 6], count: 120, velocity: [.05, .12, .04], size: .03, color: 0xfff0d0, color2: 0xffe0a0, opacity: .7, additive: true, twinkle: .6, wobble: 1, seed: 71 });
  c.ambient.fire([...BRAZIERS.map(([x, z], i) => ({ x, y: BRAZIER_H - .12, z, size: .75, smoke: .2, seed: i * .17 + .1 })), { x: 0, y: .9, z: FAR + 4.1, size: 1.2, smoke: .35, seed: .5 }]);
}

/** places-gen: where the bronze braziers stand (x, z): at the dais's foot, and between the piers either side of the ring. */
const BRAZIERS: readonly (readonly [number, number])[] = [[-3.7, FAR + 4.3], [3.7, FAR + 4.3], [-PIERS, -1.75], [PIERS, -1.75], [-PIERS, 1.75], [PIERS, 1.75], [-PIERS, 5.25], [PIERS, 5.25]];
const BRAZIER_H = 1.45;

function props(c: DressContext) {
  const { kit } = c;
  kit.place('own/proving-warden', { x: 0, y: DAIS, z: WARDEN_Z, height: 9.3 });
  for (const s of [-1, 1]) kit.place('own/proving-kneeler', { x: s * 5, y: DAIS, z: FAR + 1.55, height: 3.7, rot: -s * .35 });
  for (const s of [-1, 1]) kit.place('own/proving-kneeler', { x: s * 4.6, z: NEAR - 1.2, height: 2.8, rot: Math.PI + s * .3 });
  for (const [x, z] of BRAZIERS) kit.place('own/proving-brazier', { x, z, height: BRAZIER_H, rot: x * .7 + z });
  for (const s of [-1, 1]) for (const z of [-8.75, 5.25]) kit.place('own/proving-rack', { x: s * (WALL - .42), z, height: 2.3, rot: -s * Math.PI / 2 });
  for (const [x, z, rot] of [[-9.1, 1.9, 1.2], [9.1, -5.2, -1.9], [-9.1, -5.3, 1.7], [9.2, 2, -1.4]] as const) kit.place('own/proving-post', { x, z, height: 1.95, rot });
  for (const s of [-1, 1]) for (const z of BAYS.slice(0, -1)) kit.place('cc0/lantern-wood', { x: s * (WALL - .42), y: 1.62, z: z + 1.75, height: .62, rot: s * Math.PI / 2 });
  for (const z of [-10.5, -7, 7, 10.5]) for (const x of [-3.4, 3.4]) kit.place('cc0/chandelier-lantern', { x, y: EAVES - 2.05, z, height: 1.3, rot: z * .3 });
  const r = rand(91);
  for (const [x, z, rot] of [[-9.2, -12.2, .4], [9.3, 10.6, 2.2], [9.4, -3.6, 1.1]] as const) kit.place('cc0/barrels', { x, z, rot, width: 2.2 });
  for (const [x, z, rot] of [[-9.6, 10.9, .1], [-9.5, 9.9, .3], [9.6, -12.3, 1.5], [-9.7, -3.2, 1.6]] as const) kit.place('cc0/crate', { x, z, rot, width: 1.1 + r() * .2 });
  kit.place('cc0/crate', { x: -9.6, z: 10.4, y: .62, rot: .9, width: 1 });
  for (const [x, z] of [[-8.6, 9.6], [8.7, -11.6], [8.5, 3.9], [-8.6, -4.1]] as const) kit.place('cc0/bucket', { x, z, rot: r() * 6, height: .42 });
  kit.flush(c.stage);
  // The statues lit from the cameras' side as well as by the windows behind them (cc0.ts keyLit), or they read as cut-outs.
  keyLit(kit.pieceMaterials('own/proving-warden'), new THREE.Color(1, .92, .8).multiplyScalar(.7));
  keyLit(kit.pieceMaterials('own/proving-kneeler'), new THREE.Color(1, .92, .8).multiplyScalar(.35));
  wardenPlaque(c);
}

/** The plinth's front panel under the Warden (x +/-1.7, y 1.55-3.5, its face at z -10.42 as placed): a stone plaque
 *  laid over it, the village's mark cut into it (mark.ts) in place of the model's own carving. */
function wardenPlaque(c: DressContext) {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 288;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#b9a47f'; g.fillRect(0, 0, 512, 288);
  const r = rand(97);
  for (let k = 0; k < 900; k++) { g.fillStyle = `rgba(${90 + r() * 60},${76 + r() * 50},${52 + r() * 40},${.05 + r() * .08})`; g.fillRect(r() * 512, r() * 288, 2 + r() * 6, 2 + r() * 4); }
  g.strokeStyle = 'rgba(92,72,46,.55)'; g.lineWidth = 6; g.strokeRect(14, 14, 484, 260);
  ashMark(g, 256, 144, 104, 'rgba(84,62,38,.85)');
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8;
  const plaque = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.8, .1), stageMaterial(c.stage, 'proving hall warden plaque', { map, roughness: 1 }));
  plaque.position.set(0, 2.52, -10.38);
  plaque.name = 'proving hall warden plaque'; plaque.receiveShadow = true;
  c.root.add(plaque);
  keyLit([plaque.material], new THREE.Color(1, .92, .8).multiplyScalar(.3));
}

/** The nave's slate floor to the walls, the ring of pale stone let into it round the fight, its kerb flush. */
function floor(f: Forge) {
  f.add('floor', new THREE.PlaneGeometry(2 * WALL, NEAR - FAR).rotateX(-Math.PI / 2).translate(0, 0, (NEAR + FAR) / 2), SLATE);
  // The ring: a band of pale stone 1 m wide round a 12.4 m circle, and a disc of slightly paler slate inside it (just over
  // the floor: no step).
  f.add('ring', new THREE.RingGeometry(6.2, 7.2, 64, 1).rotateX(-Math.PI / 2).translate(0, .012, 0), 0xb8a898);
  f.add('ring', new THREE.RingGeometry(1.1, 1.5, 32, 1).rotateX(-Math.PI / 2).translate(0, .012, 0), 0xb8a898);
  for (let k = 0; k < 8; k++) {
    const a = k / 8 * Math.PI * 2, x = Math.cos(a), z = Math.sin(a);
    f.beam('ring', [x * 1.5, .006, z * 1.5], [x * 6.2, .006, z * 6.2], .14, 0xa89888, .012);
  }
}

/** The piers down both sides: square ash-stone shafts on plinths, capitals, the aisles' beams resting on them; the aisles'
 *  ceilings of boards on joists. */
function piers(f: Forge) {
  for (const s of [-1, 1]) for (const z of BAYS) {
    const x = s * PIERS;
    f.box('plinth', x, 0, z, 1.3, .5, 1.3, DARKSTONE);
    f.box('stone', x, .5, z, 1, AISLE - 1, 1, ASH);
    f.box('plinth', x, AISLE - .5, z, 1.4, .5, 1.4, DARKSTONE);
  }
  for (const s of [-1, 1]) {
    // The plate along the piers' tops, beams across the aisle to the wall, the aisle's ceiling.
    f.box('lacquer', s * PIERS, AISLE, (NEAR + FAR) / 2, .9, .7, NEAR - FAR, LACQUER);
    for (const z of BAYS) f.box('timber', s * (PIERS + WALL) / 2, AISLE, z, WALL - PIERS + .6, .55, .5, TIMBER);
    f.box('timber', s * (PIERS + WALL) / 2, AISLE + .55, (NEAR + FAR) / 2, WALL - PIERS, .1, NEAR - FAR, 0xd8c8b8);
    // The wall above the aisle roof up to the nave's eaves, over the piers (a clerestory of small slits, unlit).
    f.box('stone', s * PIERS, AISLE + .7, (NEAR + FAR) / 2, .8, EAVES - AISLE - .7, NEAR - FAR, ASH);
    // places-gen: the clerestory's slits are lit, small windows of daylight over the aisles' roofs.
    for (const z of BAYS.slice(0, -1)) {
      f.box('daylight', s * (PIERS - .42), AISLE + 1.05, z + 1.75, .02, 1.3, .5, 0xfff0d8);
      f.box('plinth', s * (PIERS - .44), AISLE + .95, z + 1.75, .1, .12, .8, DARKSTONE);
    }
  }
}

/** The outer walls round the aisles and the ends, coursed ash-stone; a niche in each bay with a lantern burning in it. */
function walls(f: Forge) {
  const h = EAVES + 1;
  for (const s of [-1, 1]) {
    f.box('stone', s * (WALL + .4), 0, (NEAR + FAR) / 2, .8, AISLE + .7, NEAR - FAR + 1.6, ASH);
    f.box('stone', s * (WALL - .05), 0, (NEAR + FAR) / 2, .2, .6, NEAR - FAR, DARKSTONE);
    for (const z of BAYS.slice(0, -1)) {
      const nz = z + 1.75;
      f.box('stone', s * (WALL - .12), 1.6, nz, .1, 1.8, 1.2, 0x2e2a28);
      f.box('stone', s * (WALL - .25), 1.5, nz, .4, .12, 1.4, DARKSTONE);
    }
  }
  // The ends, closed to the roof: the far wall behind the dais and the near wall round the doors.
  for (const z of [FAR - .4, NEAR + .4]) {
    f.box('stone', 0, 0, z, 2 * WALL + 1.6, h, .8, ASH);
    f.roof('stone', 0, h, z, .8, 2 * PIERS + .8, RIDGE - h + .6, ASH, Math.PI / 2);
  }
  f.box('plinth', 0, 0, FAR - .02, 2 * WALL, .6, .2, DARKSTONE);
  // places-gen: the far wall's windows - two tall lancets either side of the Warden and a round window in the gable over
  // him - their daylight the shafts of the place's look (src/originals/looks.ts); deep stone reveals, a sill, mullions.
  const z = FAR + .03;
  for (const s of [-1, 1]) {
    const { x: lx, y0, y1, w } = LANCET, x = s * lx;
    f.box('daylight', x, y0, z, w, y1 - y0, .02, 0xfff2dc);
    f.add('daylight', new THREE.CircleGeometry(w / 2, 16, 0, Math.PI).translate(x, y1, z), 0xfff2dc);
    f.box('plinth', x, y0 - .3, z + .15, w + .7, .3, .5, DARKSTONE);
    for (const e of [-1, 1]) f.box('plinth', x + e * (w / 2 + .17), y0, z + .12, .34, y1 - y0 + .1, .3, DARKSTONE);
    f.add('plinth', new THREE.TorusGeometry(w / 2 + .17, .17, 6, 16, Math.PI).translate(x, y1, z + .12), DARKSTONE);
    f.box('lacquer', x, y0, z + .05, .09, y1 - y0 + w / 2, .08, 0x5a3a28);
    for (const y of [y0 + 1.5, y0 + 3]) f.box('lacquer', x, y, z + .05, w, .08, .08, 0x5a3a28);
  }
  f.add('daylight', new THREE.CircleGeometry(OCULUS.r, 24).translate(0, OCULUS.y, z), 0xfff2dc);
  f.add('plinth', new THREE.TorusGeometry(OCULUS.r + .18, .2, 6, 24).translate(0, OCULUS.y, z + .12), DARKSTONE);
  for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI; f.beam('lacquer', [-Math.cos(a) * OCULUS.r, OCULUS.y - Math.sin(a) * OCULUS.r, z + .05], [Math.cos(a) * OCULUS.r, OCULUS.y + Math.sin(a) * OCULUS.r, z + .05], .07, 0x5a3a28); }
}

/** The nave's roof: tie-beam trusses over each pier pair, purlins and boards under the pitch, and the light-well's square
 *  lantern over the ring, open to the sky, the daylight falling through it. */
function roof(f: Forge) {
  // places-gen: no truss over the dais's bay, where the Warden's head rises past the eaves.
  for (const z of BAYS.slice(1)) {
    f.box('lacquer', 0, EAVES - .2, z, 2 * PIERS + .6, .6, .5, LACQUER);
    f.beam('timber', [-PIERS, EAVES + .3, z], [0, RIDGE - .2, z], .42, TIMBER);
    f.beam('timber', [PIERS, EAVES + .3, z], [0, RIDGE - .2, z], .42, TIMBER);
    f.beam('timber', [0, EAVES + .3, z], [0, RIDGE - .2, z], .3, TIMBER);
    for (const s of [-1, 1]) f.beam('timber', [s * PIERS * .5, EAVES + .3, z], [s * PIERS * .5, EAVES + (RIDGE - EAVES) * .5 + .1, z], .22, TIMBER);
  }
  // The pitch's boards (from below), each half a lean from the eaves to the ridge, its opening over the ring.
  const pitch = Math.atan2(RIDGE - EAVES, PIERS);
  for (const s of [-1, 1]) for (const [z0, z1] of [[FAR, -3.2], [3.2, NEAR]] as const) {
    const len = Math.hypot(PIERS, RIDGE - EAVES), mid = (z0 + z1) / 2;
    const g = new THREE.BoxGeometry(len + .4, .12, z1 - z0).rotateZ(-s * pitch).translate(s * PIERS / 2, (EAVES + RIDGE) / 2 + .55, mid);
    f.add('timber', g, 0xd0c0b0);
  }
  for (const s of [-1, 1]) {
    const len = Math.hypot(PIERS, RIDGE - EAVES) * .55;
    const g = new THREE.BoxGeometry(len, .12, 6.4).rotateZ(-s * pitch).translate(s * (PIERS - len * Math.cos(pitch) / 2), EAVES + len * Math.sin(pitch) / 2 + .55, 0);
    f.add('timber', g, 0xd0c0b0);
  }
  // The lantern: a square curb over the opening, posts, its own small roof floating over the gap (daylight between).
  const L = 3.2, top = RIDGE + .3;
  for (const [x, z, w, d] of [[0, -L, 2 * L + .4, .4], [0, L, 2 * L + .4, .4], [-L, 0, .4, 2 * L], [L, 0, .4, 2 * L]] as const) f.box('timber', x, top - 1.6, z, w, .6, d, TIMBER);
  for (const [x, z] of [[-L, -L], [L, -L], [L, L], [-L, L]] as const) f.box('timber', x, top - 1, z, .3, 1.8, .3, TIMBER);
  f.roof('timber', 0, top + .8, 0, 2 * L + 1.4, 2 * L + 1.4, 1.4, 0xa89888, 0, L + .7);
  f.box('glow', 0, top + .79, 0, 2 * L, .02, 2 * L, 0xdde8f0);
}

/** The hearth-dais at the far end: three steps up to the Ash Warden (props), the hearth set in its front. */
function dais(f: Forge) {
  const z0 = FAR + 3.6;
  for (let k = 0; k < 3; k++) f.box(k % 2 ? 'plinth' : 'stone', 0, k * .2, (FAR + z0 - k * .5) / 2, 2 * PIERS - 1.4 - k * .6, .2, z0 - FAR - k * .5, k % 2 ? DARKSTONE : ASH);
  // The hearth: a stone surround in the dais's front, its fire the ambient's.
  f.box('plinth', 0, 0, z0 + .2, 2.4, .9, .6, DARKSTONE);
  f.box('glow', 0, .15, z0 + .52, 1.8, .45, .02, 0xff7a2a);
}

/** The great doors at the near end: two leaves of tarred timber in a stone frame, iron straps, a bar across. */
function doors(f: Forge) {
  const z = NEAR - .02;
  f.box('stone', 0, 0, z, 6, 6.2, .3, DARKSTONE);
  for (const s of [-1, 1]) {
    f.box('timber', s * 1.25, 0, z - .2, 2.4, 5.4, .2, 0x9a8a7a);
    for (const y of [1, 2.6, 4.2]) f.box('iron', s * 1.25, y, z - .32, 2.2, .14, .04, IRON);
  }
  f.box('timber', 0, 2.2, z - .4, 4.6, .3, .3, TIMBER);
  for (const s of [-1, 1]) f.box('iron', s * 2, 2.05, z - .38, .12, .6, .12, IRON);
}

/** The Hidden Ash's banners (its own mark, mark.ts) down the piers' faces toward the nave. */
function banners(c: DressContext) {
  const map = ashBanner();
  for (const s of [-1, 1]) for (const z of [-7, 0, 7]) c.ambient.cloth(map, { x: s * (PIERS - .55), y: AISLE - .7, z, width: .9, height: 2.7, rot: -s * Math.PI / 2, wind: .05, lit: .25 });
  // places-gen: and two long ones on the far wall between the windows and the Warden, two on the near wall by the doors.
  for (const s of [-1, 1]) c.ambient.cloth(map, { x: s * 3.85, y: EAVES + .4, z: FAR + .12, width: 1.25, height: 4.2, wind: .04, lit: .35 });
  for (const s of [-1, 1]) c.ambient.cloth(map, { x: s * 4.6, y: EAVES - .2, z: NEAR - .12, width: 1.1, height: 3.6, rot: Math.PI, wind: .04, lit: .3 });
}

/** The lanterns' glow in the niches, the braziers' and the hearth's, the light-well's. */
function lights(c: DressContext) {
  const glow = new Beacons(c.root, 32, c.ambient.time);
  for (const s of [-1, 1]) for (const z of BAYS.slice(0, -1)) glow.add(s * (WALL - .4), 1.85, z + 1.75, .9, 0xffb060, -1, ((z + s) * .13 + 1) % 1, 1);
  for (const [x, z] of BRAZIERS) glow.add(x, BRAZIER_H + .25, z, 1.5, 0xff9a40, -1, ((x * .31 + z * .17) % 1 + 1) % 1, 1);
  for (const z of [-10.5, -7, 7, 10.5]) for (const x of [-3.4, 3.4]) glow.add(x, EAVES - 1.5, z, 1.1, 0xffb868, -1, ((x + z) * .11 + 2) % 1, 1);
  glow.add(0, .5, FAR + 4, 1.4, 0xff7a2a, -1, .1, 1);
  glow.finish('proving hall lamps', 1.5);
}

export function ashBanner() {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 768;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#7e2418'; g.fillRect(0, 0, 256, 768);
  g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, 0, 256, 30);
  g.strokeStyle = '#c8a25a'; g.lineWidth = 10; g.strokeRect(16, 16, 224, 736);
  g.lineWidth = 3; g.strokeRect(30, 30, 196, 708);
  ashMark(g, 128, 300, 78, '#f2e6cc');
  g.fillStyle = '#e08a3a';
  for (const dx of [-36, 0, 36]) { g.beginPath(); g.arc(128 + dx, 470, 9, 0, Math.PI * 2); g.fill(); }
  g.globalCompositeOperation = 'destination-out';
  g.beginPath(); g.moveTo(0, 768); g.lineTo(128, 690); g.lineTo(256, 768); g.closePath(); g.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8;
  return texture;
}
