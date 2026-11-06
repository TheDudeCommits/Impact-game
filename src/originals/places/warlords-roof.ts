import * as THREE from 'three';
import type { DressContext } from '../../render/stages/dressing';
import { stageMaterial } from '../../render/stages/build';
import { seeded } from '../../render/stages/ambient';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Bolt } from '../../render/rift/bolt';
import { Beacons } from '../../render/stages/glow';
import { Forge } from './forge';
import { surfaces } from './cc0';
import { forged, smooth, worldFloor } from './finish';

const STONE = 0x6e6a76, DARK = 0x46424e, FLAG = 0x8e8a96, // places-gen: lighter (the deck read black)
   IRON = 0x2a282c, COPPER = 0x4a8a72, BRONZE = 0xc89848;
/** The parapet's line (x/z), the deck's edge, the keep's foot under the cloud. */
const R = 39.4, EDGE = 41.5, FOOT = -140;

export async function dress(c: DressContext) {
  const [, , cc0] = await Promise.all([c.kit.load(['own/roof-turret', 'own/roof-brazier', 'own/roof-warlord']),
    c.sky({ url: '/assets/environment/br/sky-warlords-roof-storm.webp', rotation: 0, drift: .00006 }),
    surfaces(c, ['stone-tiles', 'slate-wall', 'flagstone'] as const)]);
  const f = new Forge(c, 'warlord');
  // places-finish (5 November 2026): the deck read as flat brown slabs (the playtest: "a flat brown floor of big polygon slabs
  // with little behind it"): its flags and the keep's stone were painted detail maps near white. They are photographed now
  // with their relief and roughness (Poly Haven Rock Tile Floor for the deck's dressed flags, Monastery Stone Floor's worn
  // stones let into them in patches where the storms have broken the dressing, Castle Wall Slates for the parapet, the
  // turrets' shafts and the keep's walls), the deck's damp kept; the shafts smoothed round.
  const deckMat = f.mat('deck', { tile: 4.4, roughness: .7, wear: { key: 'warlord-roof', scale: 1, light: [.8, 1.05], patch: 0x2a2834, patchAmount: .4, damp: .6, dampTint: 0x4a5068 } }) as THREE.MeshStandardMaterial;
  worldFloor(deckMat, cc0['stone-tiles'], 4.4, { normalScale: 1.3,
    over: { surface: cc0.flagstone, tile: 3.2, amount: .14, edge: [26, 40], edgeAmount: .5, cracks: .2, scale: 8, tint: 0xd8d0d8 } });
  f.mat('stone', { ...cc0['slate-wall'], tile: 3.4, shadow: true, lift: .35 });
  f.mat('masonry', { ...cc0['slate-wall'], tile: 4.2, air: .35, lift: .35 });
  f.mat('iron', { roughness: .5, metalness: .5 });
  f.mat('glow', { basic: true });
  deck(f);
  parapet(f);
  turrets(f);
  spire(f);
  walls(f);
  keeps(f);
  f.done();
  { const m = forged(f.meshes, 'masonry'); if (m) smooth(m.geometry, 30); }
  lamps(c);
  banners(c);
  braziers(c);
  warlords(c);
  storm(c);
  // Rain driving across the roof (r7). places-epic-a: the storm at its height by night, the rain heavy and cold.
  c.ambient.motes({ min: [-60, 0, -60], max: [60, 34, 60], count: 1500, velocity: [3.4, -18, 1.4], size: .055, color: 0xb8c0e8, color2: 0xe0e4ff, opacity: .5, wobble: .1, seed: 79 });
  await greatKeep(c);
  c.kit.flush(c.stage);
}

/** The deck: stone flags to the parapet, the Thunderhead's two rings of gilded stone inlaid round the middle (flush with the
 *  flags), iron gutters along the parapet's foot. */
function deck(f: Forge) {
  f.add('deck', new THREE.PlaneGeometry(2 * EDGE, 2 * EDGE).rotateX(-Math.PI / 2), FLAG);
  f.add('stone', new THREE.RingGeometry(9.4, 10, 72, 1).rotateX(-Math.PI / 2).translate(0, .012, 0), BRONZE);
  f.add('stone', new THREE.RingGeometry(10.8, 11.1, 72, 1).rotateX(-Math.PI / 2).translate(0, .012, 0), BRONZE);
  for (let k = 0; k < 4; k++) {
    const turn = k * Math.PI / 2;
    f.add('iron', new THREE.BoxGeometry(2 * R - 2, .06, .5).translate(0, .03, R - 1.2).rotateY(turn), IRON);
  }
}

function parapet(f: Forge) {
  const H = 1.2;
  for (let side = 0; side < 4; side++) {
    const turn = side * Math.PI / 2;
    f.add('stone', new THREE.BoxGeometry(2 * R + 1.2, H, 1.1).translate(0, H / 2, R).rotateY(turn), DARK);
    for (let k = -16; k <= 16; k++) {
      f.add('stone', new THREE.BoxGeometry(1.3, 1.1, 1.2).translate(k * 2.4, H + .55, R).rotateY(turn), STONE);
      f.add('iron', new THREE.BoxGeometry(1.4, .12, 1.3).translate(k * 2.4, H + 1.16, R).rotateY(turn), COPPER);
    }
    // The machicolation: the outer face carried out on corbels, the gaps between them dark.
    f.add('stone', new THREE.BoxGeometry(2 * EDGE + 2, 1.6, 1.4).translate(0, -1, EDGE + .2).rotateY(turn), STONE);
    for (let k = -17; k <= 17; k++) f.add('stone', new THREE.BoxGeometry(.8, 1.8, 1.6).translate(k * 2.4, -2.6, EDGE - .1).rotateY(turn), DARK);
  }
}

/** The corner turrets: squat round towers from the keep's face, crenellated over the deck, iron caps and lightning rods;
 *  chains slung between their caps. */
function turrets(f: Forge) {
  const tops: THREE.Vector3[] = [];
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
    const x = sx * (EDGE + 1), z = sz * (EDGE + 1);
    // places-gen: the turret over the deck is the generated one (warlords()); r8's shaft carries it.
    f.cyl('masonry', x, FOOT, z, 6.4, 7.4, -FOOT + .2, STONE, { sides: 18 });
    tops.push(new THREE.Vector3(x, 18, z));
  }
  return chains(f, tops);
}

/** Chains from each cap to the next, sagging over the parapet (well above the fight: 11 m at their lowest). */
function chains(f: Forge, tops: THREE.Vector3[]) {
  for (let k = 0; k < 4; k++) {
    const a = tops[k], b = tops[(k + 1) % 4];
    const at = (t: number) => a.clone().lerp(b, t).add(new THREE.Vector3(0, -Math.sin(t * Math.PI) * 5.5, 0));
    for (let i = 0; i < 18; i++) f.beam('iron', at(i / 18), at((i + 1) / 18), .14, IRON);
  }
}

function spire(f: Forge) {
  const z = -EDGE - 9, base = 8;
  f.box('masonry', 0, FOOT, z, 14, base - FOOT, 14, STONE);
  f.box('stone', 0, base, z, 15.4, 1.4, 15.4, DARK);
  for (let k = -2; k <= 2; k++) for (const [dx, dz] of [[k * 3, -7.4], [k * 3, 7.4], [-7.4, k * 3], [7.4, k * 3]] as const) f.box('stone', dx, base + 1.4, z + dz, 1.6, 1.2, 1.6, DARK);
  const top = 70, legs = [[-5.5, -5.5], [5.5, -5.5], [5.5, 5.5], [-5.5, 5.5]] as const;
  for (const [dx, dz] of legs) f.beam('iron', [dx, base + 1.4, z + dz], [dx * .08, top, z + dz * .08], .5, IRON);
  for (let y = base + 6, k = 0; y < top - 4; y += 6, k++) {
    const t = (y - base - 1.4) / (top - base - 1.4), w = 5.5 * (1 - t * .92);
    for (let i = 0; i < 4; i++) {
      const [ax, az] = legs[i], [bx, bz] = legs[(i + 1) % 4], s = w / 5.5;
      f.beam('iron', [ax * s, y, z + az * s], [bx * s, y, z + bz * s], .22, IRON);
      if (k % 2 === 0) f.beam('iron', [ax * s, y, z + az * s], [bx * s * .9, y + 6, z + bz * s * .9], .12, IRON);
    }
  }
  f.add('iron', new THREE.SphereGeometry(1.8, 14, 10).translate(0, top + 1.6, z), COPPER);
  f.pipe('iron', [0, top + 3, z], [0, top + 12, z], .18, IRON, { r2: .04 });
  for (const sx of [-1, 1]) f.beam('iron', [0, top - 20, z], [sx * (EDGE + 1), 17, -(EDGE + 1)], .1, IRON);
}

/** The keep's walls, dropping sheer from the deck into the cloud: coursed stone, a string course every 18 m, buttresses,
 *  and slit windows lit warm. */
function walls(f: Forge) {
  // places-gen: the storm-warlords' bastions either side of the spire's tower (warlords()).
  for (const s of [-1, 1]) { f.box('masonry', s * 21, FOOT, -EDGE - 8, 14, -FOOT, 12, STONE); f.box('stone', s * 21, -.6, -EDGE - 8, 14.6, .6, 12.6, DARK); }
  for (let side = 0; side < 4; side++) {
    const turn = side * Math.PI / 2;
    f.add('masonry', new THREE.BoxGeometry(2 * EDGE, -FOOT - 1.8, 2).translate(0, (FOOT - 1.8) / 2, EDGE - .9).rotateY(turn), STONE);
    for (let y = -20; y > FOOT; y -= 18) f.add('masonry', new THREE.BoxGeometry(2 * EDGE + 1, .8, 2.8).translate(0, y, EDGE - .9).rotateY(turn), DARK);
    for (const x of [-20, 0, 20]) f.add('masonry', new THREE.BoxGeometry(3, -FOOT - 6, 3).translate(x, (FOOT - 6) / 2, EDGE + .6).rotateY(turn), DARK);
    for (let y = -10; y > -90; y -= 9) for (const x of [-30, -10, 10, 30]) f.add('glow', new THREE.BoxGeometry(.5, 1.8, .1).translate(x + ((y / 9) % 2) * 3, y, EDGE + .12).rotateY(turn), (Math.abs(x * 7 + y) % 3) ? 0x2a2026 : 0xffa848);
  }
}

/** The fortress's other keeps round the roof, 110-230 m out, their tops 6-40 m under the deck: square stone towers with
 *  battlements, iron caps, lightning rods, lit slits; chain bridges slung from the keep's walls to the nearest. */
function keeps(f: Forge) {
  const rnd = seeded(91);
  for (let i = 0; i < 11; i++) {
    const a = i / 11 * Math.PI * 2 + rnd() * .3, d = 110 + rnd() * 120, x = Math.sin(a) * d, z = Math.cos(a) * d;
    const w = 14 + rnd() * 12, top = -6 - rnd() * 34, rot = rnd() * Math.PI;
    if (Math.hypot(x - TOWER.x, z - TOWER.z) < 60) continue; // places-epic-a: the storm-bell tower stands there
    f.box('masonry', x, FOOT, z, w, top - FOOT, w, i % 2 ? STONE : 0x4e4a56, { rot });
    f.box('masonry', x, top, z, w + 1.4, 1.4, w + 1.4, DARK, { rot });
    for (let k = -2; k <= 2; k++) for (const s of [-1, 1]) {
      const ox = Math.cos(rot) * k * w / 5, oz = -Math.sin(rot) * k * w / 5, nx = Math.sin(rot) * s * (w / 2 + .3), nz = Math.cos(rot) * s * (w / 2 + .3);
      f.box('masonry', x + ox + nx, top + 1.4, z + oz + nz, 1.6, 1.3, 1, DARK, { rot });
    }
    f.roof('iron', x, top + 1.4, z, w * .8, w * .8, w * .55, IRON, rot, w * .4);
    f.pipe('iron', [x, top + 1.4 + w * .55, z], [x, top + 1.4 + w * .55 + 10, z], .12, IRON, { r2: .05 });
    for (let y = top - 8; y > top - 60; y -= 10) f.box('glow', x + Math.sin(rot) * (w / 2 + .05), y, z + Math.cos(rot) * (w / 2 + .05), 1.4, 2, .1, (i + y) % 3 ? 0x2a2026 : 0xffa848, { rot });
    // A chain bridge from the keep's wall to the nearer ones.
    if (d < 170) {
      const from = new THREE.Vector3(Math.sin(a) * (EDGE + 1), -26, Math.cos(a) * (EDGE + 1)), to = new THREE.Vector3(x, top - 2, z).lerp(from, 6 / d);
      const at = (t: number) => from.clone().lerp(to, t).add(new THREE.Vector3(0, -Math.sin(t * Math.PI) * 9, 0));
      for (let k = 0; k < 16; k++) { const p = at(k / 16), q = at((k + 1) / 16); f.beam('iron', p, q, 1.6, 0x3a3236, .25); }
      for (const s of [-1, 1]) for (let k = 0; k < 16; k++) { const side = new THREE.Vector3(Math.cos(a) * s * .9, 1.2, -Math.sin(a) * s * .9); f.beam('iron', at(k / 16).add(side), at((k + 1) / 16).add(side), .08, IRON); }
    }
  }
}

/** The turrets' slits and the keep's lit windows given a soft glow; the lightning rods' tips. */
function lamps(c: DressContext) {
  const glow = new Beacons(c.root, 8, c.ambient.time);
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) glow.add(sx * (EDGE + 1), 30.4, sz * (EDGE + 1), 1.2, 0xc8dcff, 2.5, (sx + sz + 2) * .2, .12);
  glow.add(0, 82, -EDGE - 9, 2.6, 0xc8dcff, 1.6, .5, .1);
  glow.finish('warlord rods', 1.4);
}

/** Iron braziers burning along the roof's edge, inside the battlements and outside the play square (33-34 m out). */
function braziers(c: DressContext) {
  const spots: [number, number][] = [];
  for (const s of [-1, 1]) for (const t of [-18, 0, 18]) spots.push([t, s * 34], [s * 34, t]);
  for (const [x, z] of spots) c.kit.place('own/roof-brazier', { x, z, height: 2.4, rot: Math.atan2(x, z) });
  c.ambient.puffs({ spots: spots.flatMap(([x, z]) => [0, 1, 2].map(k => ({ x, y: 1.8 + k * .45, z, size: 1.1 - k * .25 }))),
    color: 0xffb050, shade: 0xff4a10, opacity: .55, life: 1.2, rise: 2.4, grow: .6, additive: true, seed: 76, order: 1 });
  c.ambient.puffs({ spots: spots.map(([x, z]) => ({ x, y: 3, z, size: 2.4 })), color: 0x3a3036, shade: 0x1a1418, opacity: .18, life: 6, rise: 7,
    drift: [1.2, 0, .4], grow: 2.2, seed: 77 });
}

/** places-gen: the generated turrets on the four corner shafts, and the storm-warlord in bronze either side of the spire's
 *  tower on bastions of his own (built here, rising from the cloud like the keep's walls), facing the deck. */
function warlords(c: DressContext) {
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const)
    c.kit.place('own/roof-turret', { x: sx * (EDGE + 1), y: -.2, z: sz * (EDGE + 1), height: 25, rot: Math.atan2(-sx, -sz) });
  for (const s of [-1, 1]) c.kit.place('own/roof-warlord', { x: s * 21, y: 0, z: -EDGE - 8, height: 24, rot: -s * .25 });
}

/** The Thunderhead's war banners: tall black poles at the roof's corners and the middle of each side, inside the
 *  battlements, each flying a long banner. */
function banners(c: DressContext) {
  const map = bannerAtlas();
  const spots: [number, number][] = [[-35, -35], [35, -35], [35, 35], [-35, 35], [0, -37], [37, 0], [0, 37], [-37, 0]];
  const TOP = 14, poles: THREE.BufferGeometry[] = [];
  spots.forEach(([x, z], i) => {
    poles.push(new THREE.CylinderGeometry(.16, .22, TOP, 8).translate(x, TOP / 2, z).toNonIndexed());
    poles.push(new THREE.ConeGeometry(.32, .9, 8).translate(x, TOP + .45, z).toNonIndexed());
    const facing = Math.atan2(-x, -z);
    c.ambient.cloth(map, { x: x + Math.sin(facing) * .25, y: TOP - .5, z: z + Math.cos(facing) * .25, width: 2.2, height: 8.5, rot: facing,
      uv: [(i % 2) / 2, 0, (i % 2 + 1) / 2, 1], wind: 1.1, lit: .35 });
  });
  const mesh = new THREE.Mesh(mergeGeometries(poles.map(g => { g.deleteAttribute('uv'); return g; })),
    stageMaterial(c.stage, 'Warlord banner poles', { color: 0x1a1618, roughness: .6, metalness: .2 }));
  mesh.name = 'warlord banner poles'; mesh.castShadow = true;
  c.root.add(mesh);
}

/** Two banners side by side: black with a copper bolt through a ring, and storm-red with a black one; copper-edged,
 *  swallowtailed. No lettering. */
function bannerAtlas() {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 1024;
  const g = canvas.getContext('2d')!;
  ([['#121014', '#c8763a', '#e09a52'], ['#6e1a16', '#141012', '#c8763a']] as const).forEach(([cloth, mark, edge], i) => {
    const x0 = i * 128;
    g.fillStyle = cloth; g.fillRect(x0, 0, 128, 1024);
    g.fillStyle = edge; g.fillRect(x0, 0, 8, 1024); g.fillRect(x0 + 120, 0, 8, 1024); g.fillRect(x0, 0, 128, 14);
    // The ring and the bolt through it.
    const cx = x0 + 64, cy = 320;
    g.strokeStyle = mark; g.lineWidth = 9; g.beginPath(); g.arc(cx, cy, 42, 0, Math.PI * 2); g.stroke();
    g.fillStyle = mark; g.beginPath();
    g.moveTo(cx + 14, cy - 86); g.lineTo(cx - 20, cy + 6); g.lineTo(cx + 2, cy + 6); g.lineTo(cx - 16, cy + 92);
    g.lineTo(cx + 24, cy - 12); g.lineTo(cx + 2, cy - 12); g.lineTo(cx + 26, cy - 86); g.closePath(); g.fill();
    // Three storm scallops under it.
    g.lineWidth = 6;
    for (const [dx, dy] of [[-26, 470], [0, 500], [26, 470]] as const) { g.beginPath(); g.arc(cx + dx, dy, 18, Math.PI, 0); g.stroke(); }
    g.save(); g.globalCompositeOperation = 'destination-out';
    g.beginPath(); g.moveTo(x0, 1024); g.lineTo(x0 + 64, 900); g.lineTo(x0 + 128, 1024); g.closePath(); g.fill();
    g.restore();
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8;
  return texture;
}

/** Storm cloud round the roof and under its edge (cels: two tones, a hard edge), and lightning striking past the edge. */
function storm(c: DressContext) {
  const { ambient } = c, rnd = seeded(733);
  const high: { x: number; y: number; z: number; size: number }[] = [], low: typeof high = [];
  for (let i = 0; i < 24; i++) {
    const a = i / 24 * Math.PI * 2 + rnd() * .2, r = 240 + rnd() * 140;
    high.push({ x: Math.sin(a) * r, y: 4 + rnd() * 26, z: Math.cos(a) * r, size: 60 + rnd() * 50 });
  }
  for (let i = 0; i < 30; i++) {
    const a = i / 30 * Math.PI * 2 + rnd() * .15, r = 90 + rnd() * 150;
    low.push({ x: Math.sin(a) * r, y: -36 - rnd() * 28, z: Math.cos(a) * r, size: 46 + rnd() * 40 });
  }
  // places-epic-a: the storm's cloud slate and violet by night (it was the sundown's rose).
  ambient.puffs({ spots: high, color: 0x46425e, shade: 0x16141e, opacity: .7, life: 0, cel: true, drift: [1.6, 0, .6], seed: 74 });
  ambient.puffs({ spots: low, color: 0x34304a, shade: 0x100e16, opacity: .82, life: 0, cel: true, drift: [1.1, 0, .35], seed: 75 });

  // Lightning: a bolt out past the edge every few seconds, any way round, a double flicker.
  const bolt = new Bolt();
  c.root.add(bolt.mesh);
  const centre = new THREE.Vector3(), way = new THREE.Vector3();
  let next = 3, began = -10;
  ambient.onUpdate(t => {
    if (t >= next) {
      const a = Math.random() * Math.PI * 2;
      bolt.strike(centre, way.set(Math.sin(a), 0, Math.cos(a)));
      began = t; next = t + 2.2 + Math.random() * 4; // places-epic-a: the storm at its height
    }
    const s = t - began;
    bolt.flash = s < 0 || s > .5 ? 0 : s < .08 ? 1 : s < .16 ? .25 : s < .26 ? .85 : Math.max(0, .85 * (1 - (s - .26) / .24));
  });
}

const TOWER = { x: 150, z: -205, h: 290, foot: -70 };
async function greatKeep(c: DressContext) {
  const { kit } = c;
  const [glowMap] = await Promise.all([c.texture('/assets/environment/own/roof-belltower-glow.webp'), kit.load(['own/roof-belltower'])]);
  glowMap.flipY = false; glowMap.colorSpace = THREE.SRGBColorSpace; glowMap.needsUpdate = true;
  const { x, z, h, foot } = TOWER;
  kit.place('own/roof-belltower', { x, y: foot, z, height: h, rot: Math.atan2(-x, -z) + Math.PI / 2, shadow: false });
  for (const m of kit.pieceMaterials('own/roof-belltower') as THREE.MeshStandardMaterial[]) {
    m.emissiveMap = glowMap; m.emissive.set(0xff9a4a); m.emissiveIntensity = 2.4; m.needsUpdate = true;
    c.ambient.onUpdate(t => { m.emissiveIntensity = 2.4 * (.85 + .1 * Math.sin(t * 4.3) * Math.sin(t * 1.9 + 1)); });
  }
  // The storm's flash on the bell at its crown every few seconds, and the fire's glow on the cloud at its foot.
  const glow = new Beacons(c.root, 3, c.ambient.time);
  glow.add(x, foot + h * .92, z, 60, 0xd0c8ff, .28, .1, .08);
  glow.add(x * .97, -40, z * .97, 140, 0xff6a20, -1, .6, 1);
  glow.finish('storm-bell tower', 1.4);
}
