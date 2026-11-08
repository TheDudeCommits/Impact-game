import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { STAGE_PROPS } from '../../game/stageProps';
import { STAGE_LANDMARKS } from '../../game/environmentLayout';
import type { DressContext } from '../../render/stages/dressing';
import { placeProps, stageMaterial, stoneShapes } from '../../render/stages/build';
import { heroAir, mountainRidges } from '../../render/stages/hero';
import { Beacons } from '../../render/stages/glow';
import { ashBanner } from './craterWreck';
import { Forge, detail, noise2 } from './forge';
import { drawn, rand, tinted } from './remake';

/** The painted sky's turn that stands its sun (u .627) in the breach, 3 degrees west of north. */
const SUN_TURN = Math.PI * 2 * (.627 - .5) + THREE.MathUtils.degToRad(3);
/** The weir's face (z) at the breach, its back, its crest and the breach's sill and sides. */
const FACE = -87, BACK = -97, CREST = 40, SILL = 27.5, NOTCH = [-14.6, 9.4] as const;
/** The sluice temple's towers either side of the breach. */
const TOWERS = [-46, 42] as const;
/** The weir's steps: how many, how tall, how far each stands out from the one over it; and its half-length across the valley. */
const STEPS = 6, RISE = (CREST + 3) / STEPS, TREAD = 3.4, SPAN = 130;
/** The weir curves downstream at its ends: its face's z at x. */
const faceZ = (x: number) => FACE + (x / SPAN) ** 2 * 26;
/** The river's half-width at z (the bounds' is 18 m): its banks start here. */
const riverHalf = (z: number) => 27 + Math.sin(z * .021 + .6) * 4 + (z < -70 ? (-70 - z) * .5 : 0);
const hills = noise2(5101), lumps = noise2(5102);
/** The valley floor's height: the river's bed under the water, low banks of ash rising beside it, hills beyond. */
function height(x: number, z: number) {
  const rw = riverHalf(z), ax = Math.abs(x);
  if (ax < rw) return -1.4;
  const bank = THREE.MathUtils.smoothstep(ax, rw, rw + 26) * (3.5 + lumps(x, z, 14) * 3);
  const far = THREE.MathUtils.smoothstep(ax, 70, 190) * (30 + hills(x, z, 90) * 46);
  return -1.4 + Math.min(1, (ax - rw) / 3) * 1.6 + bank + far;
}

/** The Ashfall Weir: a broad shallow river at first light between low banks of grey ash, reeds and burnt trees, and at its
 *  head a colossal weir - a curved terrace of great stone steps across the valley, thin falls pouring down every step, the
 *  ruined sluice temple on its crest - breached in the middle where a broken blade stands wedged and the river bursts
 *  through. Ash falls like snow. The cover stands in its boxes; the river the fight stands in is the ground's
 *  (src/originals/grounds.ts). */
export async function dress(c: DressContext) {
  const { kit, ambient } = c;
  const props = STAGE_PROPS['ashfall-weir'] ?? [];
  await Promise.all([
    c.sky({ rotation: SUN_TURN, drift: 0 }),
    kit.load(['br/rock-b', 'br/rock-c', 'br/podest', 'br/reeds', 'own/weir-blade', 'own/weir-temple', 'own/weir-tree']),
  ]);
  kit.grade = (material, piece) => {
    if (piece === 'br/reeds') material.color.multiply(new THREE.Color(0x9a9480));
    if (piece === 'own/weir-temple' || piece === 'own/weir-tree') heroAir(material, .2, .3);
  };
  placeProps(kit, props);
  const ashlarMap = ashlar();
  const shapes = stoneShapes(props, heroAir(stageMaterial(c.stage, 'Weir cover stone', { map: ashlarMap, color: 0xb8b4ac, roughness: .95 }), .1), 3);
  if (shapes) c.root.add(shapes);
  const rr = rand(5103);
  for (let i = 0; i < 46; i++) {
    const z = -70 + rr() * 200, s = rr() < .5 ? -1 : 1, x = s * (riverHalf(z) + .5 + rr() * 4);
    kit.place('br/reeds', { x, z, y: height(x, z) - .1, rot: rr() * 6, scale: 1 + rr() * .8 });
  }

  const f = new Forge(c, 'weir');
  f.mat('bank', { map: detail.gravel(5104), tile: 5, roughness: 1, air: .2, wear: { key: 'ashfall-weir', scale: 1.6, light: [.85, 1.08], patch: 0x4a4644, patchAmount: .35 } });
  f.mat('stone', { map: ashlarMap, tile: 8, roughness: .95, air: .2 });
  f.mat('rock', { map: detail.rock(5105), tile: 6, roughness: .95, air: .15, flat: true });
  f.mat('char', { map: detail.rock(5106), tile: 3, roughness: 1, emissive: 0xff5a14, emissiveIntensity: 0 });
  f.mat('roof', { roughness: .8, flat: true, air: .2 });
  f.mat('ember', { basic: true });
  f.terrain('bank', -420, -250, 420, 420, 6, height, (x, y) => y < .2 ? 0x3a3a3c : y > 14 ? 0x6a6466 : 0x7c7674);
  weir(f);
  boulders(f);
  const embers = trees(c);
  const rk = rand(5111);
  for (let i = 0; i < 40; i++) { const z = -80 + rk() * 220, sd = i % 2 ? 1 : -1, x = sd * (riverHalf(z) + 1 + rk() * 40), sz = .8 + rk() * 2.6; f.rock('rock', x, height(x, z) - .4, z, sz * 1.3, sz, sz, 0x6a6460, 5150 + i); }
  f.done();
  for (const tx of TOWERS) ambient.cloth(ashBanner(), { x: tx, y: CREST + 20, z: faceZ(tx) + 5.4, width: 3.2, height: 9, wind: .5, lit: .5 });
  for (const tx of TOWERS) kit.place('own/weir-temple', { x: tx, z: faceZ(tx) - 3, y: CREST - 1.5, width: 34, rot: 0, shadow: false });
  await blade(c);
  c.root.add(cleaved(c));
  falls(c);
  firstLight(c);
  const glow = new Beacons(c.root, embers.length + 4, ambient.time);
  for (const e of embers) glow.add(e.x, e.y, e.z, .9, 0xff6a20, -1, (e.x * .37 % 1 + 1) % 1, 1);
  glow.finish('weir embers', 1.6);
  ambient.motes({ min: [-70, 0, -80], max: [70, 34, 90], count: 900, velocity: [.3, -.7, .5], size: .08, color: 0xb0aca8, color2: 0xe8e2dc, opacity: .85, wobble: 1.6, seed: 5107 });
  ambient.motes({ min: [-40, 0, -60], max: [40, 16, 60], count: 120, velocity: [.2, 1, .3], size: .06, color: 0xff7a2a, color2: 0xffc060, opacity: .9, additive: true, twinkle: .8, wobble: 1.2, seed: 5108 });
  const smoke: { x: number; y: number; z: number; size: number }[] = [];
  for (let k = 0; k < 16; k++) { const s = k % 2 ? 1 : -1, z = -60 + k * 14, x = s * (riverHalf(z) + 30 + (k * 13) % 40); smoke.push({ x, y: height(x, z) + 6, z, size: 18 + (k % 4) * 6 }); }
  ambient.puffs({ spots: smoke, color: 0x4a4246, shade: 0x1e1a1e, opacity: .38, life: 18, rise: 40, drift: [2, 0, 1], grow: 2.2, seed: 5109, order: 0 });
  ambient.foam({ y: .05, opacity: .8, spots: [
    { x: -2.6, z: -80, radius: 14 }, ...STAGE_LANDMARKS['ashfall-weir'].map(b => ({ x: b.x, z: b.z, radius: Math.max(b.halfX, b.halfZ) * 1.5 })),
  ] });
  c.root.add(mountainRidges({ radius: 460, count: 22, seed: 57, base: 10, height: [60, 120], far: 0x6a6070, near: 0x3e3a46, crest: 0xc89070 }));
  kit.flush(c.stage);
}

/** Ashlar: courses of grey stone blocks with dark joints, tiling every 4 m by 2 m. */
function ashlar() {
  return drawn(512, 256, (g, w, h) => {
    const r = rand(77);
    g.fillStyle = '#3a3a38'; g.fillRect(0, 0, w, h);
    for (let row = 0; row < 4; row++) {
      const y = row * h / 4, off = row % 2 ? w / 8 : 0;
      for (let k = -1; k < 4; k++) {
        const x = off + k * w / 4, t = 150 + r() * 40;
        g.fillStyle = `rgb(${t},${t + 2},${t - 4})`; g.fillRect(x + 3, y + 3, w / 4 - 6, h / 4 - 6);
        g.fillStyle = 'rgba(255,255,255,.07)'; g.fillRect(x + 3, y + 3, w / 4 - 6, 6);
        for (let s = 0; s < 14; s++) { g.fillStyle = `rgba(0,0,0,${.04 + r() * .06})`; g.fillRect(x + 3 + r() * (w / 4 - 12), y + 3 + r() * (h / 4 - 12), 4 + r() * 10, 3 + r() * 6); }
      }
    }
  }, { repeat: true });
}

/** The weir: a terrace of great stone steps right across the valley, curving downstream at its ends, buttressed between bays,
 *  merlons along its crest; breached in the middle down to the sill, its blocks tumbled into the pool at its foot. */
function weir(f: Forge) {
  const [n0, n1] = NOTCH, BREACH = 22, rb = rand(97);
  const wet = (x: number, y: number) => { const streak = .8 + .2 * Math.sin(x * 1.7) * Math.sin(x * .37 + 1); return y < 3 ? 0x4a5048 : new THREE.Color().setScalar(streak * .82).getHex(); };
  const top = (x: number) => {
    if (x > n0 && x < n1) return SILL;
    const d = x < n0 ? n0 - x : x - n1;
    return d > BREACH ? CREST : SILL - 4 + (CREST - SILL + 4) * Math.pow(d / BREACH, .9) + (rb() - .5) * 3;
  };
  for (let x = -SPAN; x < SPAN; x += 4) {
    const xm = x + 2, z0 = faceZ(xm), h = Math.min(CREST, top(xm));
    f.box('stone', xm, -3, z0 - 5, 4.02, h + 3, 10, wet);
    for (let k = 0; k < STEPS; k++) {
      const y1 = Math.min(h, (k + 1) * RISE - 3);
      if (y1 <= -3 + .1) continue;
      f.box('stone', xm, -3, z0 + (STEPS - k) * TREAD / 2, 4.02, y1 + 3, (STEPS - k) * TREAD, wet);
    }
    if (h >= CREST - .1 && Math.round(x / 4) % 2 === 0) f.box('stone', xm, CREST, z0 - 1, 1.6, 1.6, 1.2, 0x9a988e);
  }
  for (let x = -SPAN + 16; x < SPAN - 8; x += 16) {
    if (x > n0 - BREACH - 3 && x < n1 + BREACH + 3) continue;
    const z0 = faceZ(x);
    for (let k = 0; k < STEPS; k++) f.box('stone', x, -3, z0 + (STEPS - k) * TREAD + .6, 2.4, (k + 1) * RISE - 1.5, 1.4, 0x8a887e);
  }
  for (let k = 0; k < 30; k++) {
    const x = n0 - BREACH * .8 + rb() * (n1 - n0 + BREACH * 1.6), s = 1.6 + rb() * 3, z = faceZ(x) + STEPS * TREAD + 1 + rb() * 12, y = -3 + rb() * 6;
    if (x > n0 + 2 && x < n1 - 2 && z < faceZ(x) + STEPS * TREAD + 4) continue;
    f.box('stone', x, y, z, s * 2, s * 1.2, s * 1.6, 0x8a887e, { rot: rb() * 3, tilt: (rb() - .5) * .8, roll: (rb() - .5) * .6 });
  }
}

/** The cover's boulders standing in the river, each filling its box (src/game/environmentLayout.ts). */
function boulders(f: Forge) {
  STAGE_LANDMARKS['ashfall-weir'].forEach((b, k) => {
    if (b.halfY > 1.6) return;
    f.rock('rock', b.x, -.6, b.z, b.halfX * 1.1, b.halfY * 2 + .5, b.halfZ * 1.1, (_x, y) => y < .25 ? 0x3e4a44 : 0x7a7670, 5120 + k);
  });
}

/** Burnt dead trees along the banks, embers in their cracks (own/weir-tree.glb, one instanced draw); their embers returned
 *  for the glow. */
function trees(c: DressContext) {
  const r = rand(5130), embers: { x: number; y: number; z: number }[] = [];
  for (let i = 0; i < 16; i++) {
    const z = -78 + r() * 210, s = i % 2 ? 1 : -1, x = s * (riverHalf(z) + 5 + r() * 26), y = height(x, z) - .3, h = 8 + r() * 9;
    c.kit.place('own/weir-tree', { x, z, y, height: h, rot: r() * 6.3, shadow: false });
    for (let k = 0; k < 2; k++) embers.push({ x: x + (r() - .5) * .6, y: y + h * (.25 + r() * .4), z: z + (r() - .5) * .6 });
  }
  return embers;
}

/** The colossal broken blade wedged deep in the weir beside the breach, leaning over it (own/weir-blade.glb). */
async function blade(c: DressContext) {
  c.kit.place('own/weir-blade', { x: NOTCH[1] + 9, y: CREST - 30, z: FACE - 2, height: 82, rot: .35, roll: .42, tilt: -.12, shadow: false });
}

/** The falls: the torrent bursting through the breach, and thin falls down the steps all along the weir, each with its spray. */
function falls(c: DressContext) {
  const { ambient } = c, [n0, n1] = NOTCH, mid = (n0 + n1) / 2;
  ambient.waterfall({ x: mid, y: SILL / 2 - 1.5, z: FACE + STEPS * TREAD * .55, width: n1 - n0 + 2, height: SILL + 2, color: 0x9ab0c4, speed: .55, curve: .8 });
  ambient.waterfall({ x: mid, y: SILL / 2 - 1.5, z: FACE + STEPS * TREAD * .55 + .8, width: n1 - n0 - 2, height: SILL + 1, color: 0xb4c6d4, speed: .78, curve: .6 });
  const spray: { x: number; y: number; z: number; size: number }[] = [];
  for (let x = -SPAN + 10; x < SPAN - 10; x += 13) {
    if (x > n0 - 26 && x < n1 + 26) continue;
    const w = 1.6 + ((x * 7) % 3 + 3) % 3 * .6, z = faceZ(x) + STEPS * TREAD * .5 + .6;
    ambient.waterfall({ x, y: CREST / 2 - 2, z, width: w, height: CREST + 2, color: 0xa8bccc, speed: .6, curve: .3 });
    spray.push({ x, y: .8, z: faceZ(x) + STEPS * TREAD + 1.5, size: 3.5 });
  }
  for (let i = 0; i < 18; i++) spray.push({ x: mid + (i % 6 - 2.5) * 4, y: 1 + (i % 3) * 1.6, z: FACE + STEPS * TREAD + 2 + (i % 4) * 2, size: 7 + (i % 5) * 1.8 });
  ambient.puffs({ spots: spray, color: 0xf2eae4, shade: 0xa8a8b8, opacity: .3, life: 6, rise: 7, drift: [0, 0, 1.4], grow: 1.8, seed: 5140 });
}

/** Boulders in the river past the bounds' ends, each cleaved clean in two, the halves a little apart. */
function cleaved(c: DressContext) {
  const r = rand(131), parts: THREE.BufferGeometry[] = [];
  void r;
  for (const [x, z, s, turn] of [[-9, -62, 5, .4], [8, -70, 6.5, 1.1], [-6, 58, 5.5, 2], [10, 66, 4.5, .7]] as const) {
    for (const side of [-1, 1]) {
      const g = new THREE.IcosahedronGeometry(1, 2), p = g.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        let px = p.getX(i), py = p.getY(i), pz = p.getZ(i);
        const k = 1 + .14 * Math.sin(px * 4 + x) * Math.cos(pz * 3 + z) + .08 * Math.sin(py * 6 + s);
        px *= k; py *= k * .8; pz *= k;
        if (px * side < 0) px = 0;
        p.setXYZ(i, px * s + side * s * .18, Math.max(py * s, -s * .2) + s * .55, pz * s);
      }
      g.rotateY(turn + side * .05).translate(x, -.6, z);
      parts.push(tinted(g.toNonIndexed(), (y) => y < .4 ? 0x3a4a44 : 0x7a7c78));
    }
  }
  const mesh = new THREE.Mesh(mergeGeometries(parts), heroAir(stageMaterial(c.stage, 'Weir cleaved boulders', { color: 0xffffff, vertexColors: true, roughness: .9, flatShading: true }), .2));
  parts.forEach(g => g.dispose());
  mesh.name = 'ashfall cleaved boulders';
  return mesh;
}

/** The painted sun's glow behind the breach through the smoke, the mist lit orange off the falls. */
function firstLight(c: DressContext) {
  const glow = new Beacons(c.root, 3, c.ambient.time);
  glow.add(-2.6, CREST + 10, BACK - 40, 170, 0xff5a24, -1, .2, 1);
  glow.add(-2.6, SILL + 2, FACE - 4, 30, 0xffa070, -1, .6, 1);
  glow.finish('weir first light', 1.1);
  const mist: { x: number; y: number; z: number; size: number }[] = [];
  const r = rand(141);
  for (let k = 0; k < 26; k++) mist.push({ x: -2.6 + (r() - .5) * 34, y: 1 + r() * 18, z: FACE + 10 + r() * 18, size: 9 + r() * 12 });
  c.ambient.puffs({ spots: mist, color: 0xffb490, shade: 0x6a5a60, opacity: .3, life: 6, rise: 6, drift: [.4, 0, 1.2], grow: 1.6, seed: 142, order: 1 });
}
