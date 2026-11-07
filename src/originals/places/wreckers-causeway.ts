import * as THREE from 'three';
import { STAGE_PROPS } from '../../game/stageProps';
import type { DressContext } from '../../render/stages/dressing';
import { placeProps } from '../../render/stages/build';
import { Beacons, LightPools } from '../../render/stages/glow';
import { heroAir } from '../../render/stages/hero';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { crater } from './battleScars';
import { Forge, detail, noise2 } from './forge';
import { surfaces } from './cc0';
import { rand } from './remake';
import { KNEELING, STANDING, CHEERING, bunting, fires, inlay, people, type P3 } from './richness';

const TAR = 0x4a3c34, PLANK = 0x7a6a5a, WET = 0x5a5a62, ROPE = 0x8a7a5a, IRON = 0x3a3430, ROCK = 0x4a4a54, WHITE = 0xd8d4c8;
/** The sea's surface, metres under the deck. */
const SEA = -7;

/** The Wreckers' Causeway: a deck of tarred timber on pile bents and stone piers over a black sea in a storm, iron fire
 *  baskets on its mast posts, three arches of a wreck's ribs high over the fight, salvage platforms off its sides, and at its
 *  far end the Wreckers' Pyre - a hooded giant of black basalt on its sea stack raising the signal fire over the storm.
 *  Nothing new stands on the deck inside the bounds but the cover in its boxes. */
export async function dress(c: DressContext) {
  const { kit } = c;
  const props = STAGE_PROPS['wreckers-causeway'] ?? [];
  const hulk: Promise<THREE.Texture | null> = HULK_CARD ? new THREE.TextureLoader().loadAsync(HULK_CARD) : Promise.resolve(null);
  const [, , S] = await Promise.all([
    c.sky({ rotation: 0, drift: 0 }),
    kit.load(['harbor/crate', 'harbor/barrel', 'harbor/crate-bottles', 'br/kenney-pirate-cannon-mobile', 'harbor/boat-row-large', 'harbor/boat-row-small',
      'cc0/ship-hulk', 'own/causeway-wrecker', ...SALVAGE_PIECES]),
    surfaces(c, ['planks-weathered', 'planks-dark', 'ashlar-grey', 'rock-sea'] as const),
  ]);
  kit.grade = (material, piece) => {
    if (piece === 'own/causeway-wrecker') {
      heroAir(material, .15, .3);
      if (material.map) { material.emissive.setRGB(1, .55, .25); material.emissiveMap = material.map; material.emissiveIntensity = .22; material.needsUpdate = true; }
      return;
    }
    material.color.multiply(new THREE.Color(0xb8bccc));
  };
  placeProps(kit, props);
  kit.shadows.add('harbor/crate').add('harbor/barrel').add('harbor/crate-bottles').add('br/kenney-pirate-cannon-mobile');
  for (const [piece, x, z, rot] of [['harbor/boat-row-large', -19, -30, .3], ['harbor/boat-row-small', 18.5, 8, 2.9], ['harbor/boat-row-large', 20, -44, 3.4], ['harbor/boat-row-small', -18, 26, .1]] as const)
    kit.place(piece, { x, z, y: SEA + .1, rot, scale: 1.7, tint: 0x8a8a90 });
  for (const [x, z, rot, roll, len] of [[-62, -20, .4, .38, 40], [70, 30, 2.6, -.32, 46], [-90, 120, 1.2, .42, 36], [120, -110, -.6, .26, 52],
    [-58, PYRE.z + 34, 1.9, .5, 44], [64, PYRE.z + 20, -1.1, -.44, 50], [22, PYRE.z + 62, .7, .36, 34]] as const)
    kit.place('cc0/ship-hulk', { x, z, y: SEA - 2.6, rot: rot + Math.PI / 2, roll, width: len, tint: 0x7a7470 });
  salvage(c);
  kit.flush(c.stage);

  const f = new Forge(c, 'causeway');
  f.mat('deck', { ...S['planks-weathered'], tile: 3, roughness: 1, lift: .64 , wear: { key: 'causeway', scale: 1.2, light: [.8, 1.05], patch: 0x5a5a64, patchAmount: .22, damp: .35, dampTint: 0x6a7080 } });
  f.mat('timber', { ...S['planks-dark'], tile: 2.4, roughness: 1, shadow: true, lift: .5 });
  f.mat('wood', { ...S['planks-dark'], tile: 2.4, roughness: 1, lift: .5 });
  f.mat('stone', { ...S['ashlar-grey'], tile: 3, roughness: 1, lift: .5 });
  f.mat('rock', { ...S['rock-sea'], tile: 8, roughness: 1, air: .12, lift: .5 });
  f.mat('iron', { roughness: .6, metalness: .4 });
  f.mat('sea', { roughness: .18, metalness: .2, air: .25 });
  f.mat('glow', { basic: true });

  deck(f);
  ribs(f);
  platforms(f);
  stack(f);
  approach(f);
  reefs(f);
  f.done();
  hulkCard(c, await hulk.catch(() => null));
  lights(c);
  c.ambient.motes({ min: [-14, .5, -50], max: [14, 6, 50], count: 90, velocity: [.2, .3, .1], size: .04, color: 0xffd090, color2: 0xfff0c0, opacity: .8, additive: true, twinkle: .7, wobble: 1.2, seed: 42 });
  c.ambient.puffs({ spots: Array.from({ length: 18 }, (_, i) => ({ x: (i % 2 ? 1 : -1) * (30 + (i * 37) % 90), y: SEA + 1.5, z: -150 + i * 18, size: 22 })), color: 0x6a7488, shade: 0x2a3040, opacity: .2, life: 0, flat: true, drift: [.8, 0, .3], seed: 43, order: 1 });
  wreckersNight(c);
  await storm(c);
}

/** The salvage piled on the platforms: chests, a fence of lashed planks, barrels, crates, buckets. */
const SALVAGE_PIECES = ['harbor/chest', 'harbor/structure-fence', 'cc0/barrels', 'cc0/crate', 'cc0/bucket'];
/** The Dust Sea's colours, for its pennants. */
const DUST_SEA = [0x2a4a6a, 0xd8c8a0, 0x8a2a24, 0x3a6a5a, 0xc89a40];
/** The platforms' salvage (past the rails) and the boats moored past them. */
function salvage(c: DressContext) {
  const { kit } = c, r = rand(311);
  for (const [s, z, w, d] of [[1, -22, 9, 14], [-1, 14, 10, 16], [1, 40, 8, 12], [-1, -50, 9, 12]] as const) {
    const cx = s * (13.8 + w / 2);
    kit.place('cc0/barrels', { x: cx + s * (w / 2 - 2.2), z: z + d / 2 - 2, y: -.3, height: 1.2, rot: r() * 6 });
    kit.place('harbor/chest', { x: cx - s * 1.2, z: z - d / 2 + 1.6, y: -.3, scale: 1.3, rot: r() * 6, tint: 0x9a8a7a });
    for (let k = 0; k < 3; k++) kit.place('cc0/crate', { x: cx + (r() - .5) * (w - 3), z: z + (r() - .5) * (d - 4), y: -.3, height: .9 + r() * .4, rot: r() * 6 });
    kit.place('cc0/bucket', { x: cx + s * 1.5, z: z + d / 2 - 1.2, y: -.3, height: .45, rot: r() * 6 });
    kit.place('harbor/structure-fence', { x: cx, z: z + d / 2 - .3, y: -.3, width: w - 1, rot: 0, tint: 0x8a7a6a });
  }
  for (const [piece, x, z, rot] of [['harbor/boat-row-large', 26, -6, 1.4], ['harbor/boat-row-small', -27, 32, -1.2], ['harbor/boat-row-large', -25, -12, 1.9], ['harbor/boat-row-small', 24, 58, -1.7]] as const)
    kit.place(piece, { x, z, y: SEA + .1, rot, scale: 1.6, tint: 0x7a7a84 });
}

/** The causeway on a working night: the Dust Sea's pennants along the rails, the platforms' braziers and the wreckers round
 *  them, nets hung to dry, the compass rose flown from every mast post and painted on the deck, foam at the piles, gulls
 *  round the stack. */
function wreckersNight(c: DressContext) {
  const { ambient } = c, r = rand(313);
  const f = new Forge(c, 'causeway festoons');
  f.mat('dark', { roughness: 1 });
  f.mat('glow', { basic: true });
  f.mat('cloth', { roughness: 1, side: THREE.DoubleSide, emissive: 0x141820, emissiveIntensity: .8 });
  const glow = new Beacons(c.root, 260, ambient.time), pools = new LightPools(c.root, 40);
  for (const s of [-1, 1]) for (let z = -66; z < 72; z += 12) bunting(f, [s * 13.35, 4.6, z], [s * 13.35, 4.6, z + 12], { colours: DUST_SEA, size: .7, gap: .95, sag: .9, seed: z * s + 600 });
  const plat = [[1, -22, 9, 14], [-1, 14, 10, 16], [1, 40, 8, 12], [-1, -50, 9, 12]] as const;
  const fireAt = plat.map(([s, z, w]) => ({ x: s * (13.8 + w / 2) + s * .5, y: .4, z: z + 2.5, size: .9 }));
  for (const p of fireAt) f.cyl('dark', p.x, -.3, p.z, .55, .35, .75, 0x2a2420, { sides: 8 });
  fires(c, fireAt, { glow, pools, floor: -.3, pool: 6, smoke: .4, seed: 61 });
  const crowd = plat.flatMap(([s, z, w, d], k) => Array.from({ length: 9 }, (_, i) => {
    const x = s * (13.8 + w / 2) + (r() - .5) * (w - 2), zz = z + (r() - .5) * (d - 2);
    return { x, y: -.3, z: zz, cell: [STANDING, STANDING, CHEERING, KNEELING][(i + k) % 4] + Math.floor(r() * 8), height: 1.72 + r() * .12, flip: r() < .5 };
  }));
  people(c, crowd, { robes: ['#3a4250', '#5a4a3a', '#2a3440', '#6a5a48', '#4a3a34', '#3a4a44', '#7a6a50', '#2e2a2a'], wraps: ['#8a2a24', '#c8b890', '#2a2a30', '#5a6a7a'] }, { name: 'causeway wreckers', shade: .62, sway: .02 });
  const net = netTexture();
  for (const s of [-1, 1]) for (let z = -63; z <= 69; z += 12) if ((z + s * 6) % 24 !== 3) ambient.cloth(net, { x: s * 13.55, y: 1.25, z, width: 4.2, height: 2.4, rot: s * Math.PI / 2, wind: .35, color: 0x8a8a78, lit: .15 });
  const rose = roseFlag();
  for (const s of [-1, 1]) for (let z = -66; z <= 72; z += 12) ambient.cloth(rose, { x: s * 13.35, y: 6.9, z: z + .05, width: 1.6, height: 1.2, rot: s > 0 ? -Math.PI / 2 : Math.PI / 2, wind: .6, readable: true, lit: .25 });
  inlay(c, (g, n) => { g.translate(n / 2, n / 2); compass(g, n * .46, 'rgba(226,214,186,.5)', 'rgba(140,40,32,.42)'); }, { size: 12, y: .012, px: 1024, roughness: .9, name: 'causeway compass' });
  f.done();
  glow.finish('causeway platform fires', 2.2);
  pools.finish('causeway festoon pools');
  const foam: { x: number; z: number; radius: number }[] = [];
  for (let z = -72; z <= 78; z += 6) for (const x of z % 24 === 0 ? [-14.5, -7, 0, 7, 14.5] : [-12.5, -6, 0, 6, 12.5]) foam.push({ x, z, radius: z % 24 === 0 ? 2.2 : .9 });
  ambient.foam({ spots: foam, y: SEA + .04, color: 0xd8e4f0, opacity: .55 });
  ambient.motes({ min: [-160, SEA + .05, -120], max: [160, SEA + .25, 200], count: 520, velocity: [.15, 0, .4], size: .32, color: 0xc8d8ff, color2: 0xffffff, opacity: .9, additive: true, twinkle: 1, wobble: .3, seed: 314 });
  ambient.birds({ centre: [0, 40, 110], count: 9, radius: 26, height: 6, spread: 8, speed: 7, size: .5, color: 0xb8c0d0, seed: 315 });
}

/** A net hung to dry: knotted mesh the alpha test cuts out, a cork float line along its top. */
function netTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 256;
  const g = canvas.getContext('2d')!;
  g.strokeStyle = 'rgba(214,206,176,1)'; g.lineWidth = 3;
  for (let k = -256; k < 512; k += 22) {
    g.beginPath(); g.moveTo(k, 0); g.lineTo(k + 256, 256); g.stroke();
    g.beginPath(); g.moveTo(k + 256, 0); g.lineTo(k, 256); g.stroke();
  }
  g.fillStyle = '#c8783a';
  for (let x = 10; x < 256; x += 32) { g.beginPath(); g.ellipse(x, 10, 10, 7, 0, 0, Math.PI * 2); g.fill(); }
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

/** The Dust Sea's compass rose: an eight-pointed star in two colours in a ring. No lettering. */
function compass(g: CanvasRenderingContext2D, R: number, light: string, dark: string) {
  g.lineWidth = R * .035; g.strokeStyle = light;
  g.beginPath(); g.arc(0, 0, R * .78, 0, Math.PI * 2); g.stroke();
  g.lineWidth = R * .015; g.beginPath(); g.arc(0, 0, R * .7, 0, Math.PI * 2); g.stroke();
  for (let k = 0; k < 8; k++) {
    const a = k / 8 * Math.PI * 2, len = k % 2 ? R * .62 : R, w = k % 2 ? R * .1 : R * .14;
    for (const side of [-1, 1]) {
      g.save(); g.rotate(a);
      g.beginPath(); g.moveTo(0, 0); g.lineTo(side * w, -w); g.lineTo(0, -len); g.closePath();
      g.fillStyle = side > 0 ? light : dark; g.fill(); g.restore();
    }
  }
  g.fillStyle = dark; g.beginPath(); g.arc(0, 0, R * .07, 0, Math.PI * 2); g.fill();
}

/** The flag on each mast post: the compass rose in pale gold on the Dust Sea's deep blue, edged rust. */
function roseFlag() {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 192;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#1e3a56'; g.fillRect(0, 0, 256, 192);
  g.fillStyle = '#8a3a2a'; g.fillRect(0, 0, 256, 12); g.fillRect(0, 180, 256, 12);
  g.translate(128, 96); compass(g, 74, '#e8d8a8', '#c8a050');
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

/** The deck, its piles and piers, rails, mast posts with their fire baskets; the sea round it. */
function deck(f: Forge) {
  const sea = new THREE.Shape().moveTo(-1500, -1500).lineTo(1500, -1500).lineTo(1500, 1500).lineTo(-1500, 1500).closePath();
  sea.holes.push(new THREE.Path().absarc(WHIRL.x, -WHIRL.z, WHIRL.r, 0, Math.PI * 2, true));
  f.add('sea', new THREE.ShapeGeometry(sea, 48).rotateX(-Math.PI / 2).translate(0, SEA, 0), 0x0c1420);
  f.box('deck', 0, -.35, 4, 27, .35, 150, 0xb4a48e);
  for (const s of [-1, 1]) f.box('wood', s * 13.6, -1.1, 4, .5, 1.1, 150, TAR);
  for (let z = -72; z <= 78; z += 6) {
    if (z % 24 === 0) {
      f.box('stone', 0, SEA - 4, z, 29, -.35 - (SEA - 4), 4, 0x6a6a72);
      continue;
    }
    for (const x of [-12.5, -6, 0, 6, 12.5]) f.pipe('wood', [x, SEA - 3, z], [x, -1.1, z], .32, 0x3a302a);
    f.beam('wood', [-12.5, -2.4, z], [12.5, -2.4, z], .3, 0x3a302a);
    f.beam('wood', [-12.5, SEA + .5, z], [0, -2.6, z], .2, 0x3a302a);
    f.beam('wood', [12.5, SEA + .5, z], [0, -2.6, z], .2, 0x3a302a);
  }
  for (const s of [-1, 1]) {
    const x = s * 13.35;
    for (let z = -70; z <= 76; z += 3) f.box('timber', x, 0, z, .26, 1.25, .26, TAR);
    f.box('timber', x, 1.1, 4, .2, .18, 146, PLANK);
    f.box('timber', x, .6, 4, .14, .12, 146, PLANK);
    for (let z = -66; z <= 72; z += 12) {
      f.pipe('timber', [x, 0, z], [x, 5.4, z], .2, 0x5a4a3e, { r2: .15 });
      basket(f, x, 5.4, z, 1);
    }
    for (let z = -69; z < 76; z += 3) for (let k = 0; k < 4; k++) {
      const a = z + k * .75, b = a + .75, sag = (t: number) => .35 - Math.sin(t * Math.PI) * .12;
      f.beam('wood', [x, sag(k / 4), a], [x, sag((k + 1) / 4), b], .05, ROPE);
    }
  }
}

/** Three arches of a great wreck's ribs over the deck, high over the fight (their tops 14-17 m up, their feet past the
 *  rails): curved frames of black timber, a keelson along each arch's crown. */
function ribs(f: Forge) {
  for (const [z0, n, h] of [[-30, 5, 15], [6, 4, 17], [38, 5, 14]] as const) {
    for (let k = 0; k < n; k++) {
      const z = z0 + k * 2.4, w = 17 + Math.sin(k) * .6;
      let prev: THREE.Vector3 | null = null;
      for (let i = 0; i <= 12; i++) {
        const a = i / 12 * Math.PI, p = new THREE.Vector3(-Math.cos(a) * w, Math.sin(a) ** .8 * h - 1.4, z + Math.sin(a * 2) * .3);
        if (prev) f.beam('wood', prev, p, .62, 0x2e2622, .5);
        prev = p;
      }
    }
    f.beam('wood', [0, h - 1.6, z0 - 1.2], [0, h - 1.4, z0 + (n - 1) * 2.4 + 1.2], .8, 0x2a221e);
  }
}

/** Salvage platforms off the deck's sides (past the rails): decks on piles, a crane each, nets hung to dry, stacked timber
 *  and crates. */
function platforms(f: Forge) {
  const r = rand(77);
  for (const [s, z, w, d] of [[1, -22, 9, 14], [-1, 14, 10, 16], [1, 40, 8, 12], [-1, -50, 9, 12]] as const) {
    const cx = s * (13.8 + w / 2);
    f.box('deck', cx, -.6, z, w, .3, d, 0x6a5e52);
    for (const dx of [-w / 2 + .5, w / 2 - .5]) for (const dz of [-d / 2 + .5, 0, d / 2 - .5]) f.pipe('wood', [cx + dx, SEA - 2, z + dz], [cx + dx, -.6, z + dz], .25, 0x3a302a);
    const mx = cx + s * (w / 2 - 1.2);
    f.pipe('timber', [mx, -.3, z], [mx, 9, z], .28, 0x4a3e34);
    f.beam('timber', [mx, 2, z], [mx + s * 7, 8.6, z], .22, 0x4a3e34);
    f.beam('iron', [mx, 9, z], [mx + s * 7, 8.6, z], .05, ROPE);
    f.beam('iron', [mx + s * 7, 8.6, z], [mx + s * 7, 3.4, z], .05, ROPE);
    f.box('wood', mx + s * 7, 2.4, z, 1, 1, 3, 0x6a5a4a);
    for (let k = 0; k < 2; k++) {
      const nz = z - d / 2 + 2 + k * 4;
      f.pipe('wood', [cx - s * (w / 2 - .6), -.3, nz], [cx - s * (w / 2 - .6), 3.6, nz], .1, 0x4a3e34);
      f.pipe('wood', [cx - s * (w / 2 - .6), -.3, nz + 3], [cx - s * (w / 2 - .6), 3.6, nz + 3], .1, 0x4a3e34);
      f.box('wood', cx - s * (w / 2 - .6), .2, nz + 1.5, .04, 3.2, 3, 0x6a6a5a);
    }
    for (let y = -.3, k = 0; y < 1.4; y += .3, k++) f.box('wood', cx, y, z + d / 4, 3, .28, .4 + (k % 2) * 2.6, 0x5a4a3e, { rot: k % 2 ? 0 : Math.PI / 2 });
    for (let k = 0; k < 3; k++) f.box('wood', cx + (r() - .5) * 3, -.3, z - d / 4 + (r() - .5) * 2, 1.2, 1.1, 1.2, 0x6a5848, { rot: r() });
  }
}

/** The sea stack at the +z end: the winch house and its landing where the deck meets it, and on its top a squat tower of
 *  black stone with a great iron fire basket, the wreckers' false light. */
function stack(f: Forge) {
  const n = noise2(3);
  const z0 = 96;
  const g = new THREE.CylinderGeometry(16, 26, 48, 18, 6).translate(0, 24 + SEA - 6, z0 + 14);
  const p = g.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 1 + (n(x, y + z, 6) - .5) * .5; p.setX(i, x * k); p.setZ(i, z0 + 14 + (z - z0 - 14) * k); }
  f.add('rock', g, (_, y) => y > 30 ? 0x5a5a5a : ROCK);
  for (let k = 0; k < 6; k++) f.rock('rock', (k - 2.5) * 9, SEA - 2, z0 - 2 + (k % 2) * 6, 5, 3 + k % 3, 4, ROCK, 30 + k);
  f.box('stone', 0, SEA, 80, 30, -SEA - .35, 12, 0x5a5a62);
  for (let k = 0; k < 8; k++) f.box('stone', -9, -.35 + k * 1.2, 84 + k * 1.4, 6, 1.2, 1.4, 0x6a6a72);
  f.box('stone', 8, -.35, 82, 9, 5.2, 7, 0x6a6a72);
  f.roof('wood', 8, 4.85, 82, 9.6, 7.6, 2.4, TAR);
  f.add('iron', new THREE.TorusGeometry(2.2, .2, 6, 18).rotateY(Math.PI / 2).translate(3.3, 3, 80), IRON);
  const top = 24 + SEA - 6 + 24;
  for (let k = 0; k < 4; k++) f.cyl('stone', 0, top + k * 5, z0 + 14, 4.4 - (k + 1) * .35, 4.4 - k * .35, 5, k % 2 ? 0x4a4650 : 0x5a5660, { sides: 12 });
  basket(f, 0, top + 20, z0 + 14, 4.2);
}
/** The top of the stack's beacon tower (lights()). */
const STACK_FIRE: P3 = [0, 24 + SEA - 6 + 24 + 20 + 1.6, 110];

/** An iron fire basket at x, y (its foot), z: a shallow bowl on a collar, eight bars flaring up round it and an iron ring
 *  round their tops, `s` times a post's. The fire in it is lights()'s. */
function basket(f: Forge, x: number, y: number, z: number, s: number) {
  f.cyl('iron', x, y, z, .28 * s, .16 * s, .3 * s, IRON, { sides: 8 });
  f.cyl('iron', x, y + .3 * s, z, .46 * s, .3 * s, .22 * s, IRON, { sides: 10 });
  for (let k = 0; k < 8; k++) {
    const a = k / 8 * Math.PI * 2, c = Math.cos(a), d = Math.sin(a);
    f.beam('iron', [x + c * .4 * s, y + .45 * s, z + d * .4 * s], [x + c * .56 * s, y + 1.05 * s, z + d * .56 * s], .045 * s, IRON);
  }
  f.add('iron', new THREE.TorusGeometry(.56 * s, .035 * s, 4, 16).rotateX(Math.PI / 2).translate(x, y + 1.02 * s, z), IRON);
}

/** The causeway run on past the fight's -z end over the sea to the pyre's rock: the same deck on stone piers, its rails and
 *  mast posts, their fire baskets a line of fire into the storm. */
function approach(f: Forge) {
  const z0 = -71, z1 = APPROACH_END, L = z0 - z1, zc = (z0 + z1) / 2;
  f.box('deck', 0, -.35, zc, 27, .35, L, 0xa49480);
  for (const s of [-1, 1]) f.box('wood', s * 13.6, -1.1, zc, .5, 1.1, L, TAR);
  for (let z = -72 - 24; z > z1; z -= 24) f.box('stone', 0, SEA - 4, z, 29, -.35 - (SEA - 4), 4, 0x5e5e66);
  for (let z = -72 - 12; z > z1; z -= 24) for (const x of [-12.5, 0, 12.5]) f.pipe('wood', [x, SEA - 3, z], [x, -1.1, z], .4, 0x3a302a);
  for (const s of [-1, 1]) {
    const x = s * 13.35;
    for (let z = -74; z > z1; z -= 4) f.box('timber', x, 0, z, .26, 1.25, .26, TAR);
    f.box('timber', x, 1.1, zc, .2, .18, L, PLANK);
    f.box('timber', x, .6, zc, .14, .12, L, PLANK);
    for (let z = -78; z >= z1 + 6; z -= 12) {
      f.pipe('timber', [x, 0, z], [x, 5.4, z], .2, 0x5a4a3e, { r2: .15 });
      basket(f, x, 5.4, z, 1);
    }
  }
  f.box('stone', 0, SEA - 2, z1 - 4, 34, -SEA + 2 - .35, 12, 0x4a4a52);
  for (let k = 0; k < 6; k++) f.box('stone', 0, -.35 + k * 1.1, z1 - 10 - k * 1.6, 12, 1.1, 1.6, 0x55555e);
}
/** Where the approach ends at the pyre's rock (the deck's -z end, metres). */
const APPROACH_END = -290;

/** The storm: the pyre, a whirlpool off the deck's east side, rain driving across the deck, forked lightning flashing the
 *  sky, and the fight's scar in the planks, still smouldering. Nothing new in the play square but the flat scar. */
async function storm(c: DressContext) {
  const { ambient } = c;
  pyre(c);
  whirlpool(c);
  rain(c);
  const flash = lightning(c);
  const sky = c.root.getObjectByName('Painted sky') as THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial> | undefined;
  if (sky) ambient.onUpdate(t => { sky.material.uniforms.uExposure.value = 1 + 1.6 * flash(t); });
  crater(c, { size: 24, cx: 2, cz: -8, x: 2, z: -8, radius: 3.2, reach: 10, seed: 1701, cracks: 18, strokes: [[[-9, -20], [8, 6]]], lit: Math.atan2(-.5, .5),
    ember: 0xff8a30, strength: .5, litStone: 'rgba(200,176,140,.85)', darkStone: 'rgba(40,30,26,.9)', name: 'causeway blast' });
  ambient.motes({ min: [-6, .2, -16], max: [10, 3, 0], count: 60, velocity: [.6, .9, .2], size: .05, color: 0xff8a30, color2: 0xffd080, opacity: 1, additive: true, twinkle: 1, wobble: 1, seed: 1702 });
}
/** Where the Wreckers' Pyre stands, the stack's top and the giant's height. */
const PYRE = { x: 0, z: -345, top: 34, h: 170 };
/** The Wreckers' Pyre: a sea stack of black basalt out of the storm, and on it a hooded giant of the same stone raising an
 *  iron fire basket over its head (own/causeway-wrecker.glb), the signal fire roaring in it and lighting the storm's
 *  underside, ships broken on the reefs round its foot. */
function pyre(c: DressContext) {
  const { ambient } = c, n = noise2(1801), r = rand(1802);
  const f = new Forge(c, 'causeway pyre');
  f.mat('basalt', { map: detail.rock(1803), tile: 9, roughness: .95, air: .16, emissive: 0x1c0c06, emissiveIntensity: .6 });
  const X = PYRE.x, Z = PYRE.z, T = PYRE.top;
  const lit = (_x: number, y: number) => y > T ? 0x403a40 : 0x34343c;
  const stack = new THREE.CylinderGeometry(30, 46, T - SEA + 8, 22, 8).translate(X, (T + SEA - 8) / 2, Z);
  { const p = stack.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i) - X, y = p.getY(i), z = p.getZ(i) - Z, k = 1 + (n(x * 2 + y, z * 2 - y, 9) - .5) * .45;
      p.setXYZ(i, X + x * k, y + (y > T - .5 ? (n(x, z, 6) - .5) * 3 : 0), Z + z * k); } }
  f.add('basalt', stack, lit);
  for (let k = 0; k < 14; k++) {
    const a = r() * Math.PI * 2, d = 40 + r() * 34, h = 14 + r() * 40, w = 3 + r() * 6;
    f.add('basalt', new THREE.ConeGeometry(w, h, 6, 3).rotateY(r() * 3).rotateZ((r() - .5) * .25).translate(X + Math.cos(a) * d, SEA - 3 + h / 2, Z + Math.sin(a) * d * .8 - 10), lit);
  }
  f.done();
  c.kit.place('own/causeway-wrecker', { x: X, z: Z, y: T - 4, height: PYRE.h, rot: 0, shadow: false });
  c.kit.flush(c.stage);
  const fireY = T - 4 + PYRE.h * .93, spots: { x: number; y: number; z: number; size: number }[] = [];
  for (let k = 0; k < 12; k++) spots.push({ x: X + Math.cos(k * 2.4) * (k ? 7 : 0), y: fireY + (k % 4) * 5, z: Z + Math.sin(k * 2.4) * (k ? 6 : 0), size: 12 + (k % 4) * 3 });
  ambient.fire(spots.map((p, i) => ({ ...p, smoke: .6, seed: 1810 + i * 1.7 })));
  const glow = new Beacons(c.root, 8, ambient.time);
  glow.add(X, fireY + 10, Z, 60, 0xffa040, -1, .2, .6);
  glow.add(X, fireY + 40, Z, 200, 0xff5a14, -1, .7, .3);
  glow.add(X, SEA + 2, Z + 70, 70, 0xff6a20, -1, .4, .12);
  glow.finish('causeway pyre glow', 1.4);
  ambient.motes({ min: [X - 40, fireY - 6, Z - 30], max: [X + 40, fireY + 100, Z + 30], count: 160, velocity: [1.5, 6, .5], size: .9, color: 0xff7a2a, color2: 0xffd070,
    opacity: .95, additive: true, twinkle: .9, wobble: 2, seed: 1811 });
}
/** The whirlpool off the deck's east side: its centre and radius (the sea's hole) and its funnel's depth. */
const WHIRL = { x: 56, z: -62, r: 34, depth: 16 };

/** The whirlpool: a funnel of black water dropping through the sea's hole, arms of foam spiralling into it (one draw, timed
 *  in the shader). */
function whirlpool(c: DressContext) {
  const rings = 40, spokes = 96, R = WHIRL.r, outer = 1.3, pos: number[] = [], uv: number[] = [], index: number[] = [];
  for (let i = 0; i <= rings; i++) {
    const t = i / rings, rr = t * R * outer, y = rr < R ? -WHIRL.depth * (1 - rr / R) ** 2.4 : .05;
    for (let j = 0; j <= spokes; j++) {
      const a = j / spokes * Math.PI * 2;
      pos.push(WHIRL.x + Math.cos(a) * rr, SEA + y, WHIRL.z + Math.sin(a) * rr);
      uv.push(j / spokes, t * outer);
    }
  }
  for (let i = 0; i < rings; i++) for (let j = 0; j < spokes; j++) {
    const a = i * (spokes + 1) + j, b = a + spokes + 1;
    index.push(a, a + 1, b, b, a + 1, b + 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(index);
  const material = new THREE.ShaderMaterial({
    name: 'causeway whirlpool', transparent: true, fog: true, side: THREE.DoubleSide,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 } }]),
    vertexShader: `
      #include <common>
      #include <fog_pars_vertex>
      varying vec2 vP;
      void main() {
        vP = uv;
        vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      #include <common>
      #include <fog_pars_fragment>
      uniform float uTime; varying vec2 vP;
      void main() {
        float r = vP.y, a = vP.x * 6.2831853, lr = log( max( r, .03 ) );
        float s = a * 3.0 + lr * 5.5 + uTime * ( 1.0 + 2.4 * ( 1.0 - min( r, 1.0 ) ) );
        float arm = .5 + .5 * sin( s ), fine = .5 + .5 * sin( a * 11.0 + lr * 17.0 - uTime * 2.0 ), broken = .6 + .4 * sin( a * 5.0 - lr * 9.0 + uTime * .7 );
        float foam = smoothstep( .6, .92, arm ) * ( .35 + .65 * fine ) * broken * smoothstep( .05, .3, r );
        vec3 col = mix( vec3( .002, .01, .013 ), vec3( .02, .07, .08 ), smoothstep( .0, 1.0, r ) );
        col = mix( col, vec3( .34, .48, .48 ), foam * ( 1.0 - smoothstep( 1.0, 1.3, r ) ) );
        col *= mix( .2, 1.0, smoothstep( .0, .7, r ) );
        float alpha = r < 1.0 ? 1.0 : foam * ( 1.0 - smoothstep( 1.0, 1.28, r ) ) * .85;
        gl_FragColor = vec4( col, alpha );
        #include <fog_fragment>
      }`,
  });
  material.uniforms.uTime = c.ambient.time;
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'causeway whirlpool'; mesh.renderOrder = 1;
  c.root.add(mesh);
  c.ambient.puffs({ spots: Array.from({ length: 10 }, (_, i) => { const a = i / 10 * Math.PI * 2; return { x: WHIRL.x + Math.cos(a) * R * .8, y: SEA + 1, z: WHIRL.z + Math.sin(a) * R * .8, size: 9 }; }),
    color: 0x9ab8bc, shade: 0x2a3e44, opacity: .22, life: 6, rise: 3, grow: 1.6, drift: [1.6, 0, .6], seed: 1711, order: 1 });
}

/** Rain driving across the deck and the sea round it: streaks falling slant on the wind (one draw, timed in the shader). */
function rain(c: DressContext) {
  const r = rand(1721), n = 3200, pos = new Float32Array(n * 6), seed = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const x = (r() - .5) * 120, z = -110 + r() * 200, p = r();
    pos.set([x, 0, z, x, 0, z], i * 6);
    seed.set([p, 0, p, 1], i * 4);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geometry.setAttribute('aRain', new THREE.BufferAttribute(seed, 2));
  const material = new THREE.ShaderMaterial({
    name: 'causeway rain', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: { uTime: c.ambient.time },
    vertexShader: `
      attribute vec2 aRain; uniform float uTime; varying float vA;
      void main() {
        float y = 40.0 - mod( aRain.x * 48.0 + uTime * 26.0, 48.0 ) + aRain.y * 1.7;
        vec3 p = position; p.y = y; p.x += y * .22;
        vA = 1.0 - aRain.y;
        gl_Position = projectionMatrix * modelViewMatrix * vec4( p, 1.0 );
      }`,
    fragmentShader: `
      varying float vA;
      void main() { gl_FragColor = vec4( vec3( .46, .6, .64 ) * ( .25 + .75 * vA ) * .42, 1.0 ); }`,
  });
  const lines = new THREE.LineSegments(geometry, material);
  lines.name = 'causeway rain'; lines.frustumCulled = false; lines.renderOrder = 3;
  c.root.add(lines);
}

/** Forked lightning out over the sea: jagged forks on cards facing the causeway, each flashing for a few frames every few
 *  seconds (one draw, timed in the shader); returns the flash at a time, for the sky. */
function lightning(c: DressContext) {
  const r = rand(1731), cards: THREE.BufferGeometry[] = [], flashes: [number, number][] = [];
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 1024;
  const g = canvas.getContext('2d')!;
  g.strokeStyle = '#ffffff'; g.lineCap = 'round'; g.lineJoin = 'round';
  g.shadowColor = 'rgba(170,230,255,1)'; g.shadowBlur = 16;
  const bolt = (x0: number, y0: number, w: number, depth: number) => {
    let px = x0, py = y0;
    g.lineWidth = w; g.beginPath(); g.moveTo(px, py);
    while (py < 1000) { px += (r() - .5) * 64; py += 26 + r() * 46; px = Math.max(10, Math.min(246, px)); g.lineTo(px, py); if (depth && r() < .2) { g.stroke(); bolt(px, py, w * .55, depth - 1); g.lineWidth = w; g.beginPath(); g.moveTo(px, py); } }
    g.stroke();
  };
  bolt(128, 0, 7, 2);
  const map = new THREE.CanvasTexture(canvas);
  for (const [x, z, h] of [[-320, -760, 520], [260, -820, 560], [-120, -980, 600], [520, -420, 420], [-560, -260, 440], [640, 120, 420]] as const) {
    const card = new THREE.PlaneGeometry(h / 4, h);
    card.lookAt(new THREE.Vector3(-x, 0, -z));
    card.translate(x, SEA + h / 2 - 20, z);
    const f0 = r() * 7, f1 = 5 + r() * 6;
    flashes.push([f0, f1]);
    card.setAttribute('aFlash', new THREE.Float32BufferAttribute([f0, f1, f0, f1, f0, f1, f0, f1], 2));
    cards.push(card);
  }
  const material = new THREE.ShaderMaterial({
    name: 'causeway lightning', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: { uMap: { value: map }, uTime: c.ambient.time },
    vertexShader: `
      attribute vec2 aFlash; uniform float uTime; varying vec2 vUv; varying float vOn;
      void main() {
        vUv = uv;
        float t = mod( uTime + aFlash.x, aFlash.y );
        vOn = t < .08 ? 1.0 : t < .14 ? .2 : t < .22 ? .9 : 0.0;
        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
      }`,
    fragmentShader: `
      uniform sampler2D uMap; varying vec2 vUv; varying float vOn;
      void main() { float a = texture2D( uMap, vUv ).a; gl_FragColor = vec4( vec3( .8, .94, 1.0 ) * a * vOn * 2.4, 1.0 ); }`,
  });
  const mesh = new THREE.Mesh(mergeGeometries(cards), material);
  mesh.name = 'causeway lightning'; mesh.frustumCulled = false; mesh.renderOrder = 2;
  c.root.add(mesh);
  return (time: number) => {
    let on = 0;
    for (const [f0, f1] of flashes) { const t = ((time + f0) % f1 + f1) % f1; on = Math.max(on, t < .08 ? 1 : t < .14 ? .2 : t < .22 ? .9 : 0); }
    return on;
  };
}

/** The reefs' rocks either side of the causeway (the hulls aground on them are placed in dress()). */
function reefs(f: Forge) {
  for (let k = 0; k < 20; k++) {
    const a = k * 2.399, d = 50 + (k * 47) % 160, x = Math.cos(a) * d, z = Math.sin(a) * d;
    if ((Math.abs(x) < 24 && z < -60) || Math.hypot(x - WHIRL.x, z - WHIRL.z) < WHIRL.r + 8) continue;
    f.rock('rock', x, SEA - 2.5, z, 3 + (k % 4), 2 + (k % 3), 3 + (k % 5) * .6, ROCK, 60 + k);
  }
}

/** The picture of the wreck standing on her bow far out at sea, when this checkout carries one. */
const HULK_CARD: string | null = null;
/** A wreck's hull standing on her bow far out at sea, painted on a card and graded to the night; no picture, no card. */
function hulkCard(c: DressContext, map: THREE.Texture | null) {
  if (!map) return;
  map.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({ map, transparent: true, alphaTest: .4, color: 0x3a4660, fog: true, depthWrite: true, side: THREE.DoubleSide });
  material.name = 'causeway hulk';
  const card = new THREE.Mesh(new THREE.PlaneGeometry(110, 110), material);
  card.position.set(-175, SEA + 48, -235);
  card.rotation.y = Math.atan2(175, 235);
  card.name = 'causeway hulk';
  c.root.add(card);
}

/** The fire baskets on the posts, their light pooled on the deck and down the approach, the platforms' glow and the beacon
 *  on the stack. */
function lights(c: DressContext) {
  const glow = new Beacons(c.root, 160, c.ambient.time);
  const pools = new LightPools(c.root, 32), warm = new THREE.Color(.55, .34, .13);
  const deckFires: { x: number; y: number; z: number; size: number }[] = [];
  for (const s of [-1, 1]) for (let z = -66; z <= 72; z += 12) { deckFires.push({ x: s * 13.35, y: 5.95, z, size: .75 }); pools.add(s * 10.9, z, 8, warm, .06); }
  for (const s of [-1, 1]) for (let z = -78; z >= APPROACH_END + 6; z -= 12) deckFires.push({ x: s * 13.35, y: 5.95, z, size: .75 });
  fires(c, deckFires, { glow, smoke: .35, seed: 71 });
  for (const [x, z] of [[18, -22], [-19, 14], [17, 40], [-18, -50], [8, 86]] as const) glow.add(x, 2.6, z, 2.2, 0xffa850, -1, .3, 1);
  const [bx, by, bz] = STACK_FIRE;
  fires(c, [{ x: bx, y: by, z: bz, size: 3.2 }, { x: bx + .8, y: by + 1.6, z: bz - .5, size: 2.4 }], { glow, smoke: .5, seed: 73 });
  glow.add(bx, by + 3, bz, 18, 0xff9a40, -1, .2, .5);
  glow.finish('causeway fires', 2.2);
  pools.finish('causeway fire pools');
}
