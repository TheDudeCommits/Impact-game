import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { STAGE_PROPS } from '../../game/stageProps';
import type { DressContext } from '../../render/stages/dressing';
import { placeProps, stageMaterial } from '../../render/stages/build';
import { Beacons, LightPools } from '../../render/stages/glow';
import { heroAir } from '../../render/stages/hero';
import { addShaderPatch } from '../../render/look/shaderPatch';
import { rand, tinted } from './remake';
import { Forge, detail } from './forge';
import { surfaces } from './cc0';
import { CHEERING, KNEELING, STANDING, fires as fireSpots, inlay, people, ringSpots, type P3 } from './richness';
import { crater } from './battleScars';

/** The summit's rim, metres from its middle. */
const RIM = 55;

/** The Sunward Summit: the paved top of the last peak over a sea of cloud at sundown, the Last Sun's temple on its far half
 *  (three stepped tiers of pale stone trimmed in gold under a colossal golden sun-disc) filling the temple's boxes, fire
 *  obelisks, a sandstone parapet round the rim with bronze sun standards and banners, the festival's pieces round it and two
 *  Sun-Kings rising out of the cloud sea. Everything new in the play square stands in one of its boxes. */
export async function dress(c: DressContext) {
  const { kit, ambient } = c;
  kit.grade = (material, piece) => {
    if (piece === 'own/summit-temple' || piece === 'own/summit-tower' || piece === 'own/summit-obelisk') {
      heroAir(material, .08, .1);
      if (material.map) { material.emissive.setRGB(1, .8, .6); material.emissiveMap = material.map; material.emissiveIntensity = .3; material.needsUpdate = true; }
      return;
    }
    if (piece !== 'own/summit-sunking') return;
    heroAir(material, .1, .12);
    material.color.multiply(new THREE.Color(0xffb878));
    if (material.map) { material.emissive.setRGB(1, .55, .25); material.emissiveMap = material.map; material.emissiveIntensity = .14; material.needsUpdate = true; }
  };
  await Promise.all([
    c.sky({ url: '/assets/environment/br/sky-sunward-summit.webp', rotation: Math.PI, drift: 0, exposure: 1 }),
    kit.load(['br/tree-place', 'br/pot', 'br/grass', 'own/summit-temple', 'own/summit-obelisk', 'own/summit-tower', ...FESTIVAL_PIECES, ...EPIC_PIECES]),
  ]);
  await summitTop(c);
  temple(c);
  kit.grade = (material, piece) => {
    if (piece === 'br/grass') material.color.multiply(new THREE.Color(0xd8b060));
    if (piece === 'br/tree-place') material.color.multiply(new THREE.Color(0xe8b890));
  };

  const props = STAGE_PROPS['sunward-summit'] ?? [];
  placeProps(kit, props);
  const glow = new Beacons(c.root, 48, ambient.time);
  const fires: { x: number; y: number; z: number; size: number }[] = [];
  const stone = stageMaterial(c.stage, 'Sunward stone', { color: 0xffffff, vertexColors: true, roughness: .92, flatShading: true });
  const bronze = stageMaterial(c.stage, 'Sunward bronze', { color: 0xffffff, vertexColors: true, roughness: .55 });
  const stones: THREE.BufferGeometry[] = [], metal: THREE.BufferGeometry[] = [];

  const rings = props.filter(p => p.piece === 'br/tree-place');
  const r = rand(512);
  for (const p of rings) {
    for (let k = 0; k < 7; k++) { const a = r() * 6.28, d = 1 + r() * 1.6; kit.place('br/grass', { x: p.x + Math.cos(a) * d, z: p.z + Math.sin(a) * d, y: .38, rot: r() * 6.3, scale: 1.4 + r() * .8 }); }
    stones.push(tinted(new THREE.CylinderGeometry(.42, .5, 2.6, 8).translate(p.x, 1.3, p.z), 0xc89a7c));
    metal.push(tinted(new THREE.CylinderGeometry(.75, .35, .6, 10, 1, true).translate(p.x, 2.9, p.z), 0x6a4a2a));
    fires.push({ x: p.x, y: 3.3, z: p.z, size: .9 }, { x: p.x, y: 3.7, z: p.z, size: .6 });
    glow.add(p.x, 3.5, p.z, 2.6, 0xff9a40, -1, (p.x * .13) % 1, 1);
  }
  fires.push({ x: 0, y: 1.9, z: 36, size: 1.2 }, { x: 0, y: 2.4, z: 36, size: .8 });
  glow.add(0, 2.2, 36, 3, 0xffa040, -1, .4, 1);

  const lampPlinths = props.filter(p => p.piece === 'none' && p.solid !== true && p.solid?.halfY === .8).map(p => [p.x, p.z] as const);
  for (const [x, z] of [[22, -28.75], [-22, -28.75], [22, -19.25], [-22, -19.25], ...lampPlinths] as const) obelisk(x, z);
  function obelisk(x: number, z: number) {
    kit.place('own/summit-obelisk', { x, z, width: 3.4, sy: 2.35, rot: Math.atan2(-x, -z), shadow: false });
    fires.push({ x, y: 17.3, z, size: 1.3 }, { x, y: 17.9, z, size: .9 });
    glow.add(x, 17.6, z, 3.4, 0xffa040, -1, (x * .07 + z * .03) % 1 + .5, 1);
  }

  const banner = bannerTexture();
  for (let i = 0; i < 15; i++) {
    const a = i / 15 * Math.PI * 2;
    const x = Math.sin(a) * RIM, z = Math.cos(a) * RIM;
    if (z < -30 && Math.abs(x) < 26) continue;
    standard(x, z, 8, 0, 1.15);
    ambient.cloth(banner, { x: x * .985, y: 7.2, z: z * .985, width: 1.3, height: 5, rot: Math.atan2(-x, -z), wind: .45, lit: .4 });
  }
  function standard(x: number, z: number, h: number, plinth: number, y0 = 0) {
    if (plinth) stones.push(tinted(new THREE.BoxGeometry(3.2, plinth, 3.2).translate(x, plinth / 2, z), 0xc0907a));
    metal.push(tinted(new THREE.CylinderGeometry(.22, .3, h, 8).translate(x, y0 + plinth + h / 2, z), 0x5a3e24));
    const top = y0 + plinth + h + .9;
    metal.push(tinted(new THREE.CylinderGeometry(1.1, 1.1, .16, 20).rotateX(Math.PI / 2).rotateY(Math.atan2(x, z)).translate(x, top, z), 0xf0b040));
    for (let k = 0; k < 8; k++) {
      const ray = new THREE.BoxGeometry(.14, .7, .1).translate(0, 1.5, 0).rotateZ(k / 8 * Math.PI * 2).rotateY(Math.atan2(x, z)).translate(x, top, z);
      metal.push(tinted(ray, 0xe8a030));
    }
    glow.add(x, top, z, 2.2, 0xffc060, -1, (x * .07 + z * .03) % 1, .6);
  }

  for (const x of [-10.25, 10.25]) {
    stones.push(tinted(new THREE.CylinderGeometry(.45, .7, 11.5, 6).translate(x, 5.75, 34.75), 0xd8a882));
    stones.push(tinted(new THREE.BoxGeometry(1.8, .6, 1.8).translate(x, .3, 34.75), 0xa87a62));
    metal.push(tinted(new THREE.CylinderGeometry(1.4, 1.4, .2, 24).rotateX(Math.PI / 2).translate(x, 12.9, 34.75), 0xf4bc48));
    glow.add(x, 12.9, 34.75, 3.4, 0xffc868, -1, x > 0 ? .2 : .7, .8);
  }
  for (const [x, z] of [[-37.75, 36.5], [37.75, 36.5], [38, -37], [-38.25, -36.5]] as const) {
    const g = new THREE.BoxGeometry(2.6, 7.2, 2.2, 1, 3, 1);
    const p = g.getAttribute('position') as THREE.BufferAttribute;
    for (let k = 0; k < p.count; k++) { const t = (p.getY(k) + 3.6) / 7.2; p.setX(k, p.getX(k) * (1 - t * .35) + (r() - .5) * .2); p.setZ(k, p.getZ(k) * (1 - t * .3) + (r() - .5) * .2); }
    stones.push(tinted(g.rotateY(r() * 3).rotateZ((r() - .5) * .08).translate(x, 3.6, z), 0xa87c66));
  }
  for (let i = 0; i < 96; i++) {
    if (BREACHES.has(i)) continue;
    const a0 = i / 96 * Math.PI * 2, a1 = (i + 1) / 96 * Math.PI * 2, am = (a0 + a1) / 2;
    const len = RIM * (a1 - a0) + .05;
    stones.push(tinted(new THREE.BoxGeometry(len, 1.1, .9).rotateY(am + Math.PI / 2).translate(Math.sin(am) * RIM, .55, Math.cos(am) * RIM), i % 2 ? 0xc8806a : 0xbc7660));
  }

  for (const [list, material, name] of [[stones, stone, 'sunward stone'], [metal, bronze, 'sunward bronze']] as const) {
    const mesh = new THREE.Mesh(mergeGeometries(list.map(g => g.index ? g.toNonIndexed() : g)), material);
    list.forEach(g => g.dispose());
    mesh.name = name; mesh.castShadow = false; mesh.receiveShadow = true;
    c.root.add(mesh);
  }
  ambient.puffs({ spots: fires, color: 0xffc060, shade: 0xff5a14, opacity: .6, life: 1.1, rise: 2.2, grow: .6, additive: true, seed: 71, order: 1 });
  glow.finish('sunward fires', 2);

  c.root.add(peaks(c));
  clouds(c);
  ambient.birds({ centre: [0, 0, -20], count: 10, radius: 40, height: 32, spread: 10, speed: 9, size: .4, color: 0x2a1c26, seed: 73 });
  ambient.motes({ min: [-46, 0, -46], max: [46, 14, 46], count: 110, velocity: [.2, .45, .1], size: .06, color: 0xffd088, color2: 0xffa050, opacity: .8, additive: true, twinkle: .6, wobble: 1.2, seed: 74 });
  festival(c, lampPlinths);
  epic(c);
  kit.flush(c.stage);
}

/** The Last Sun's festival pieces (own/sunfall-*.glb). */
const FESTIVAL_PIECES = ['own/sunfall-brazier', 'own/sunfall-lion', 'own/sunfall-king', 'own/sunfall-pavilion', 'own/sunfall-drum', 'own/sunfall-jars'];
/** The summit on the evening of the Last Sun's festival: two Sun-Kings either side of the temple, the royal pavilions with
 *  sun-lions before them, sun-braziers, drums and painted jars round the rim past the play square, long banners down the
 *  obelisks, pilgrims at the parapet, a sun inlaid in the paving under the fight, sparks rising out of the cloud sea. */
function festival(c: DressContext, lampPlinths: readonly (readonly [number, number])[]) {
  const { kit, ambient } = c;
  const face = (x: number, z: number, turn = 0) => Math.atan2(-x, -z) + turn;
  for (const s of [-1, 1]) kit.place('own/sunfall-king', { x: s * 31, z: -42.5, height: 13.5, rot: face(s * 31, -42.5) });
  for (const s of [-1, 1]) {
    kit.place('own/sunfall-pavilion', { x: s * 48, z: 0, height: 5.4, rot: face(s * 48, 0) });
    for (const e of [-1, 1]) kit.place('own/sunfall-lion', { x: s * 42.5, z: e * 6.5, height: 3.4, rot: face(s * 42.5, e * 6.5) });
    kit.place('own/sunfall-lion', { x: s * 6.5, z: 42, height: 3.4, rot: face(s * 6.5, 42) });
    for (const e of [-1, 1]) kit.place('own/sunfall-drum', { x: s * 45.5, z: e * 11, height: 2.4, rot: face(s * 45.5, e * 11, e * .6) });
    kit.place('own/sunfall-drum', { x: s * 13.5, z: 44.5, height: 2.4, rot: face(s * 13.5, 44.5, s * .5) });
    for (const [x, z] of [[s * 49, 21], [s * 49, -21], [s * 25, 47.5], [s * 30, -45.5]] as const) kit.place('own/sunfall-jars', { x, z, height: 1.5, rot: x * .3 + z });
  }
  for (const [x, z] of [[-28, 22], [28, 22], [-22, 34], [22, 34]] as const) for (const k of [0, 1]) kit.place('own/sunfall-jars', { x: x + (k ? 1.7 : -1.6), z: z + (k ? -1.2 : 1.1), y: .9, height: 1.1, rot: x + k * 2 });
  const long = longBanner();
  for (const [x, z] of [[22, -28.75], [-22, -28.75], [22, -19.25], [-22, -19.25], ...lampPlinths] as const)
    ambient.cloth(long, { x: x + Math.sign(-x || 1) * .35, y: 15.6, z, width: 1.5, height: 8, rot: Math.atan2(-x, -z), wind: .4, lit: .4 });
  const braziers: [number, number][] = [[-22, 45], [22, 45], [-44, 16], [44, 16], [-44, -16], [44, -16], [-36, -40], [36, -40], [0, 47]];
  for (const [x, z] of braziers) kit.place('own/sunfall-brazier', { x, z, height: 3.6, rot: x + z });
  const pools = new LightPools(c.root, 16), glow = new Beacons(c.root, 24, ambient.time);
  fireSpots(c, braziers.map(([x, z]) => ({ x, y: 3.2, z, size: 1 })), { glow, pools, floor: 0, pool: 7, smoke: .15, seed: 81 });
  glow.finish('sunward festival fires', 2);
  pools.finish('sunward festival pools');
  ambient.puffs({ spots: braziers.map(([x, z]) => ({ x, y: 4.6, z, size: 1.4 })), color: 0xe8d8d0, shade: 0x9a7a8a, opacity: .22, life: 7, rise: 9, grow: 2.6, drift: [.5, 0, .2], seed: 82, order: 1 });

  const palette = { robes: ['#b02a24', '#e8a028', '#f2ead8', '#2a9a96', '#3a3a8c', '#d8a040', '#c8483a', '#e8dcc4'], wraps: ['#e8dcc4', '#9a2420', '#d8a040', '#3a3a5a'] };
  const outside = (x: number, z: number) => Math.max(Math.abs(x), Math.abs(z)) > 39.5;
  const spots = [
    ...ringSpots({ r0: 49.5, r1: 53, count: 46, y: 0, height: 1.75, arc: (_, x, z) => z > 40 && outside(x, z), poses: [KNEELING, KNEELING, STANDING], seed: 101 }),
    ...ringSpots({ r0: 44, r1: 53, count: 70, y: 0, height: 1.75, arc: (_, x, z) => Math.abs(x) > 40 && Math.abs(z) < 30 && outside(x, z) && Math.hypot(Math.abs(x) - 48, z) > 4.2, poses: [STANDING, CHEERING, STANDING, KNEELING], seed: 102 }),
    ...ringSpots({ r0: 47, r1: 53, count: 18, y: 0, height: 1.75, arc: (_, x, z) => z < -38 && Math.abs(x) > 26 && outside(x, z), poses: [KNEELING, STANDING], seed: 103 }),
  ];
  people(c, spots, palette, { name: 'sunward pilgrims', shade: .95, sway: .04 });

  inlay(c, (g, s) => {
    const m = s / 2, u = s / 80;
    g.translate(m, m);
    const q = rand(107);
    for (const [px, pz, n] of [[-28, 22, 700], [28, 22, 700], [-22, 34, 600], [22, 34, 600], [0, 36, 500], [0, 0, 900]] as const)
      for (let k = 0; k < n; k++) {
        const a = q() * Math.PI * 2, d = (px || pz ? 3.6 : 6.6) + Math.abs(q() + q() - 1) * (px || pz ? 5 : 9);
        g.globalAlpha = .55 + q() * .4;
        g.fillStyle = q() < .7 ? '#f0a020' : q() < .5 ? '#e05a18' : '#f8d850';
        g.beginPath(); g.ellipse((px + Math.cos(a) * d) * u, (pz + Math.sin(a) * d) * u, .1 * u, .06 * u, q() * 3, 0, Math.PI * 2); g.fill();
      }
    g.globalAlpha = .34;
    for (let k = 0; k < 32; k++) {
      const a = k / 32 * Math.PI * 2, long = k % 2 === 0, r0 = 6.2 * u, r1 = (long ? 13 : 10.2) * u, w = (long ? .9 : .6) * u;
      g.save(); g.rotate(a);
      g.beginPath(); g.moveTo(-w, r0); g.lineTo(0, r1); g.lineTo(w, r0); g.closePath();
      g.fillStyle = long ? '#d89a3a' : '#b4583a'; g.fill(); g.restore();
    }
    g.globalAlpha = .45;
    for (const r of [26.6, 30.4]) { g.lineWidth = .3 * u; g.strokeStyle = '#a4583c'; g.beginPath(); g.arc(0, 0, r * u, 0, Math.PI * 2); g.stroke(); }
    for (let k = 0; k < 48; k++) {
      const a0 = k / 48 * Math.PI * 2, a1 = (k + .82) / 48 * Math.PI * 2;
      g.beginPath(); g.arc(0, 0, 30 * u, a0, a1); g.arc(0, 0, 27 * u, a1, a0, true); g.closePath();
      g.fillStyle = k % 4 === 0 ? '#d89a3a' : k % 2 ? '#2a8a84' : '#b4583a'; g.fill();
    }
  }, { size: 80, px: 2048, y: .014, roughness: .8, name: 'sunward sun inlay' });

  ambient.motes({ min: [-220, -70, -220], max: [220, 95, 220], count: 120, velocity: [.35, 1.1, .2], size: .3, color: 0xffa648, color2: 0xffd27a, opacity: .9, additive: true, twinkle: .6, wobble: 2.5, seed: 104 });
  ambient.birds({ centre: [0, 0, 6], count: 12, radius: 30, height: 11, spread: 5, speed: 12, size: .32, color: 0x2a1c26, seed: 105 });
  ambient.birds({ centre: [0, -20, 0], count: 16, radius: 150, height: 0, spread: 30, speed: 10, size: .9, color: 0x3a2434, seed: 106 });
}

/** The summit's top: a disc of pale cream paving to the rim, its kerb, the rings of its pattern and the soil of the four
 *  garden beds; its sides fall to the peak's rock (peaks()). */
async function summitTop(c: DressContext) {
  const S = await surfaces(c, ['flagstone'] as const);
  const f = new Forge(c, 'sunward top');
  f.mat('paving', { ...S.flagstone, tile: 3.2, lift: .7, gain: 1.6, roughness: .9, wear: { key: 'sunward-summit', scale: 1.5, light: [.88, 1.06], patch: 0xb89a84, patchAmount: .2 } });
  f.mat('kerb', { map: detail.ashlar(6101, 64), tile: 2.4, roughness: .9 });
  f.mat('soil', { map: detail.gravel(6102), tile: 2, roughness: 1 });
  f.add('paving', new THREE.CircleGeometry(RIM + 1.2, 128).rotateX(-Math.PI / 2).toNonIndexed(), 0xfff2e2);
  f.add('kerb', new THREE.CylinderGeometry(RIM + 1.2, RIM + 1.6, 3, 128, 1, true).translate(0, -1.5, 0).toNonIndexed(), 0xb08a74);
  for (const [a, b] of [[RIM - 4, RIM - 3.2], [44, 44.6], [31, 31.5]] as const) f.add('kerb', new THREE.RingGeometry(a, b, 128, 1).rotateX(-Math.PI / 2).translate(0, .008, 0).toNonIndexed(), 0xc89a80);
  for (const [x, z] of [[-28, 22], [28, 22], [-22, 34], [22, 34]] as const) f.add('soil', new THREE.CircleGeometry(3.1, 24).rotateX(-Math.PI / 2).translate(x, .34, z).toNonIndexed(), 0x6a4a30);
  f.done();
}

/** The sun temple over the boxes on the far half: its middle's z, its width and its height. */
const TEMPLE = { z: -27, w: 31.5, h: 31.1 };
/** The sun temple (own/summit-temple.glb): three stepped tiers of pale stone trimmed in gold, a broad stair down toward the
 *  floor, crowned by a golden sun-disc with blades of light; two slender towers with golden caps behind it on the rim. */
function temple(c: DressContext) {
  c.kit.place('own/summit-temple', { x: 0, z: TEMPLE.z, y: 0, width: TEMPLE.w, rot: 0, shadow: false });
  for (const s of [-1, 1]) c.kit.place('own/summit-tower', { x: s * 19, z: -47, height: 27, rot: 0, shadow: false });
  const glow = new Beacons(c.root, 3, c.ambient.time);
  glow.add(0, TEMPLE.h * .82, TEMPLE.z + 2, 16, 0xffc060, -1, .3, .3);
  glow.add(0, TEMPLE.h * .82, TEMPLE.z, 44, 0xff9040, -1, .7, .18);
  glow.finish('sunward temple sun', 1.4);
}

/** The summit under the floor - dark rock falling 260 m from the rim into the cloud sea, its faces lit gold toward the sun -
 *  and nine more peaks standing out of the sea round it. */
function peaks(c: DressContext) {
  const r = rand(919), parts: THREE.BufferGeometry[] = [];
  const mountain = (x: number, z: number, top: number, profile: [number, number][], seed: number, segs = 40) => {
    const g = new THREE.LatheGeometry(profile.map(([rad, y]) => new THREE.Vector2(rad, y)), segs);
    const p = g.getAttribute('position') as THREE.BufferAttribute, n = rand(seed);
    const bumps = Array.from({ length: 7 }, () => [n() * 6.28, .05 + n() * .12, 1 + Math.floor(n() * 5)] as const);
    for (let k = 0; k < p.count; k++) {
      const px = p.getX(k), py = p.getY(k), pz = p.getZ(k), rad = Math.hypot(px, pz);
      if (rad < 1e-3 || py > -2) continue;
      const a = Math.atan2(pz, px);
      let s = 1;
      for (const [ph, amp, f] of bumps) s += amp * Math.sin(a * f + ph + py * .02);
      p.setXYZ(k, px * s, py, pz * s);
    }
    g.translate(x, top, z);
    tinted(g, (y, gx, gz) => {
      const sun = Math.max(0, (gz - z) / Math.max(1, Math.hypot(gx - x, gz - z)));
      const fall = Math.min(1, Math.max(0, (top - y) / 260));
      return new THREE.Color(0x5a3440).lerp(new THREE.Color(0xd08858), sun * .75 * (1 - fall * .5)).lerp(new THREE.Color(0x3a2440), fall * .5).getHex();
    });
    parts.push(g.toNonIndexed());
  };
  mountain(0, 0, 0, [[0, -2], [56, -2], [57.5, -10], [62, -24], [74, -50], [96, -90], [130, -150], [190, -230], [240, -300]], 31, 48);
  for (let i = 0; i < 9; i++) {
    const a = (i + r() * .5) / 9 * Math.PI * 2, d = 260 + r() * 420, h = 40 + r() * 120, w = 30 + r() * 50;
    mountain(Math.sin(a) * d, Math.cos(a) * d, -60 + h, [[0, 0], [w * .12, -h * .25], [w * .5, -h * .6], [w, -h], [w * 1.6, -h - 120]], 40 + i, 18);
  }
  const geometry = mergeGeometries(parts);
  parts.forEach(g => g.dispose());
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, heroAir(stageMaterial(c.stage, 'Sunward peaks', { color: 0xffffff, vertexColors: true, roughness: .96, flatShading: true }), .3));
  mesh.name = 'sunward peaks'; mesh.receiveShadow = false;
  return mesh;
}

/** The cloud sea round the summit's foot and out to the horizon, rose and gold, drifting. */
function clouds(c: DressContext) {
  const r = rand(616), sea: { x: number; y: number; z: number; size: number }[] = [];
  for (let i = 0; i < 34; i++) { const a = r() * Math.PI * 2, d = 90 + r() * 420; sea.push({ x: Math.sin(a) * d, y: -48 - r() * 18, z: Math.cos(a) * d, size: 60 + r() * 60 }); }
  for (let i = 0; i < 10; i++) { const a = r() * Math.PI * 2, d = 70 + r() * 30; sea.push({ x: Math.sin(a) * d, y: -70 - r() * 30, z: Math.cos(a) * d, size: 40 + r() * 30 }); }
  const puffs = c.ambient.puffs({ spots: sea, color: 0xffb08a, shade: 0x6a3a78, opacity: .92, life: 0, drift: [1, 0, .3], seed: 75, order: 0 });
  heroAir(puffs.material as THREE.Material, .35);
}

/** The festival's long banner: saffron, a crimson sun going down over three bars, a turquoise hem, swallowtailed. No lettering. */
function longBanner() {
  const canvas = document.createElement('canvas');
  canvas.width = 192; canvas.height = 1024;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#e09a2a'; g.fillRect(0, 0, 192, 1024);
  g.fillStyle = '#2a8a84'; g.fillRect(0, 0, 192, 28); g.fillRect(0, 760, 192, 30);
  g.fillStyle = '#8a1e1e'; g.fillRect(0, 0, 10, 1024); g.fillRect(182, 0, 10, 1024);
  g.beginPath(); g.arc(96, 300, 56, Math.PI, 0); g.fill();
  for (const [y, w] of [[318, 128], [344, 96], [370, 64]] as const) g.fillRect(96 - w / 2, y, w, 13);
  g.save(); g.globalCompositeOperation = 'destination-out';
  g.beginPath(); g.moveTo(0, 1024); g.lineTo(96, 900); g.lineTo(192, 1024); g.closePath(); g.fill();
  g.restore();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8;
  return texture;
}

/** The Last Sun's banner: deep crimson edged in gold, its mark - a sun going down behind three bars of horizon - in gold,
 *  swallowtailed. No lettering. */
function bannerTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 1024;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#6a1a22'; g.fillRect(0, 0, 256, 1024);
  g.fillStyle = '#e8b450'; g.fillRect(0, 0, 14, 1024); g.fillRect(242, 0, 14, 1024); g.fillRect(0, 0, 256, 22);
  g.beginPath(); g.arc(128, 330, 70, Math.PI, 0); g.fill();
  for (const [y, w] of [[352, 160], [384, 120], [416, 80]] as const) g.fillRect(128 - w / 2, y, w, 16);
  g.save(); g.globalCompositeOperation = 'destination-out';
  g.beginPath(); g.moveTo(0, 1024); g.lineTo(128, 880); g.lineTo(256, 1024); g.closePath(); g.fill();
  g.restore();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8;
  return texture;
}

/** The colossus rising out of the cloud sea (own/summit-sunking.glb). */
const EPIC_PIECES = ['own/summit-sunking'];
/** The parapet's segments (of 96, from +z) knocked out. */
const BREACHES = new Set([9, 10, 33, 57, 58, 81]);
/** The sun's bearing, 21.6 degrees east of south: the key light's and the painted sky's sun. */
const SUN_BEARING = .377;

/** The summit as a battlefield at sundown: two Sun-Kings 270 m tall rising out of the cloud sea either side of the temple,
 *  raising the sun, the Last Sun sinking into a bank of cloud, shafts of light, the fight's scars and debris. Nothing new
 *  stands in the play square but the flat crater. No lettering. */
function epic(c: DressContext) {
  const { kit, ambient } = c;
  const glow = new Beacons(c.root, 8, ambient.time);
  const r = rand(1201), bank: { x: number; y: number; z: number; size: number }[] = [];
  for (const s of [-1, 1]) {
    const a = s * .6, x = Math.sin(a) * 900, z = -Math.cos(a) * 900, toward = Math.atan2(-x, -z);
    kit.place('own/summit-sunking', { x, z, y: -62, height: 270, rot: toward });
    glow.add(x + Math.sin(toward) * 12, -62 + 270 * .885, z + Math.cos(toward) * 12, 110, 0xffb050, -1, s > 0 ? .3 : .8, 1);
    for (let k = 0; k < 18; k++) { const b = r() * Math.PI * 2, d = 30 + r() * 120; bank.push({ x: x + Math.cos(b) * d, y: -74 + r() * 30, z: z + Math.sin(b) * d * .6, size: 60 + r() * 50 }); }
  }
  glow.finish('sunward kings\' discs', 1.6);
  heroAir(ambient.puffs({ spots: bank, color: 0xffb08a, shade: 0x6a3a78, opacity: .95, life: 0, drift: [.5, 0, .2], seed: 1202, order: 0 }).material as THREE.Material, .3);
  sunCard(c);
  shafts(c);
  scars(c);
  debris(c);
  ambient.motes({ min: [-60, 0, -60], max: [60, 18, 60], count: 220, velocity: [.6, .9, .2], size: .07, color: 0xff8a3a, color2: 0xffd27a, opacity: .9, additive: true, twinkle: .8, wobble: 1.6, seed: 1203 });
}

/** A canvas texture, sRGB. */
function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  draw(canvas.getContext('2d')!);
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

/** The Last Sun low on its bearing: a disc in three cel tones in a broad halo, bright enough for the bloom, and before it a
 *  bank of cloud it is sinking into, gold along every top. */
function sunCard(c: DressContext) {
  const d = 800, sx = Math.sin(SUN_BEARING), sz = Math.cos(SUN_BEARING), y = 2 + Math.tan(THREE.MathUtils.degToRad(2.5)) * d;
  const disc = canvasTexture(1024, 1024, g => {
    const m = 512, R = 174;
    const halo = g.createRadialGradient(m, m, R * .9, m, m, 512);
    halo.addColorStop(0, 'rgba(255,196,110,.62)'); halo.addColorStop(.3, 'rgba(255,128,60,.3)'); halo.addColorStop(.62, 'rgba(230,70,50,.1)'); halo.addColorStop(1, 'rgba(200,40,60,0)');
    g.fillStyle = halo; g.fillRect(0, 0, 1024, 1024);
    for (const [k, col] of [[1, '#ff8a2c'], [.86, '#ffbe58'], [.66, '#ffe9a8'], [.44, '#fffbea']] as const) { g.fillStyle = col; g.beginPath(); g.arc(m, m, R * k, 0, Math.PI * 2); g.fill(); }
  });
  const sunMaterial = new THREE.MeshBasicMaterial({ map: disc, transparent: true, depthWrite: false, fog: false, toneMapped: false });
  sunMaterial.color.setScalar(1.7); sunMaterial.name = 'Sunward sun';
  const size = 2 * d * Math.tan(THREE.MathUtils.degToRad(4.5)) / (174 / 512);
  const sun = new THREE.Mesh(new THREE.PlaneGeometry(size, size), sunMaterial);
  sun.position.set(sx * d, y, sz * d); sun.lookAt(0, y, 0); sun.name = 'Sunward sun'; sun.renderOrder = 2; sun.frustumCulled = false;
  c.root.add(sun);
  const r = rand(1211);
  const bank = canvasTexture(2048, 512, g => {
    const tops: [number, number, number][] = [];
    for (let k = 0; k < 64; k++) { const x = r() * 2048, rr = 26 + r() * 70; tops.push([x, 150 + r() * 90 + (Math.abs(x - 1024) / 1024) * 40, rr]); }
    const shape = () => { g.beginPath(); g.rect(0, 260, 2048, 252); for (const [x, yy, rr] of tops) { g.moveTo(x + rr, yy); g.arc(x, yy, rr, 0, Math.PI * 2); } };
    g.save(); shape(); g.clip();
    const body = g.createLinearGradient(0, 120, 0, 512); body.addColorStop(0, '#c04a50'); body.addColorStop(.45, '#8a2c58'); body.addColorStop(1, '#4a1e4e');
    g.fillStyle = body; g.fillRect(0, 0, 2048, 512);
    g.restore();
    g.lineWidth = 7;
    for (const [x, yy, rr] of tops) {
      const near = Math.max(0, 1 - Math.abs(x - 1024) / 900);
      g.strokeStyle = `rgba(255,${190 + near * 50},${100 + near * 60},${.35 + near * .6})`;
      g.beginPath(); g.arc(x, yy, rr - 3, Math.PI * 1.08, Math.PI * 1.92); g.stroke();
    }
    g.globalCompositeOperation = 'destination-out';
    const foot = g.createLinearGradient(0, 400, 0, 512); foot.addColorStop(0, 'rgba(0,0,0,0)'); foot.addColorStop(1, 'rgba(0,0,0,1)');
    g.fillStyle = foot; g.fillRect(0, 400, 2048, 112);
  });
  const bankMaterial = new THREE.MeshBasicMaterial({ map: bank, transparent: true, depthWrite: false, fog: false, toneMapped: false });
  bankMaterial.name = 'Sunward sun cloud bank';
  const bw = 950, bh = bw / 4, bd = d - 8;
  const cloud = new THREE.Mesh(new THREE.PlaneGeometry(bw, bh), bankMaterial);
  cloud.position.set(sx * bd, 2 + Math.tan(THREE.MathUtils.degToRad(1)) * bd - bh * (.5 - 200 / 512), sz * bd); cloud.lookAt(0, cloud.position.y, 0);
  cloud.name = 'Sunward sun cloud bank'; cloud.renderOrder = 3; cloud.frustumCulled = false;
  c.root.add(cloud);
}

/** The fight's scars: a crater where the festival's sun was inlaid, two cleaving strokes across the floor, a felled standard,
 *  the parapet broken through, its stones about. */
function scars(c: DressContext) {
  const r = rand(1221);
  crater(c, { size: 40, cx: 0, cz: 0, radius: 5.4, reach: 17, seed: 1222, strokes: [[[-17, 12], [6, -15]], [[-12, -16], [17, 9]]],
    lit: Math.PI / 2 - SUN_BEARING, ember: 0xff6a20, strength: .25, heart: 0, name: 'sunward crater' });
  const bronze: THREE.BufferGeometry[] = [], stone: THREE.BufferGeometry[] = [];
  const a0 = new THREE.Vector3(41.5, .3, 15), a1 = new THREE.Vector3(53.2, .9, 25.5), dir = a1.clone().sub(a0), len = dir.length();
  bronze.push(tinted(new THREE.CylinderGeometry(.22, .3, len, 8).rotateZ(Math.PI / 2).rotateY(-Math.atan2(dir.z, dir.x)).translate((a0.x + a1.x) / 2, (a0.y + a1.y) / 2, (a0.z + a1.z) / 2), 0x5a3e24));
  bronze.push(tinted(new THREE.CylinderGeometry(1.1, 1.1, .16, 20).rotateX(.25).translate(a1.x + .8, .55, a1.z + .9), 0xf0b040));
  stone.push(tinted(new THREE.BoxGeometry(3.2, 1.1, 3.2).rotateY(.3).rotateZ(.08).translate(a0.x - 1.2, .45, a0.z - .8), 0xb8886e));
  bronze.push(tinted(new THREE.CylinderGeometry(.3, .3, 1.6, 8).rotateZ(.5).translate(a0.x - 1.1, 1.5, a0.z - .7), 0x5a3e24));
  for (const i of BREACHES) {
    const am = (i + .5) / 96 * Math.PI * 2;
    for (let k = 0; k < 7; k++) {
      const d = RIM + (r() - .4) * 7, side = (r() - .5) * 3.2, x = Math.sin(am) * d + Math.cos(am) * side, z = Math.cos(am) * d - Math.sin(am) * side;
      if (Math.max(Math.abs(x), Math.abs(z)) < 39.5) continue;
      stone.push(tinted(new THREE.BoxGeometry(.7 + r() * 1.1, .5 + r() * .5, .5 + r() * .5).rotateY(r() * 3).rotateX((r() - .5) * .6).translate(x, .25 + r() * .2, z), r() < .5 ? 0xc8806a : 0xbc7660));
    }
  }
  const material = stageMaterial(c.stage, 'Sunward scars', { color: 0xffffff, vertexColors: true, roughness: .8, flatShading: true });
  const mesh2 = new THREE.Mesh(mergeGeometries([...bronze, ...stone].map(g => g.index ? g.toNonIndexed() : g)), material);
  [...bronze, ...stone].forEach(g => g.dispose());
  mesh2.name = 'sunward scars'; mesh2.receiveShadow = true;
  c.root.add(mesh2);
}

/** Slabs of the summit torn up by the fight and hanging in the air past its edge, turning slowly and bobbing: one draw, moved
 *  in the vertex shader. */
function debris(c: DressContext) {
  const r = rand(1231), parts: THREE.BufferGeometry[] = [];
  for (let k = 0; k < 20; k++) {
    let a = 0;
    do a = r() * Math.PI * 2; while (Math.cos(a) < -.55 && Math.abs(Math.sin(a)) < .55);
    const d = 46 + r() * 20, x = Math.sin(a) * d, z = Math.cos(a) * d, y = 3 + r() * 13;
    const slab = r() < .6;
    const g = slab ? new THREE.BoxGeometry(1.4 + r() * 2.2, .35 + r() * .35, 1.2 + r() * 1.8, 1, 1, 1) : new THREE.DodecahedronGeometry(.7 + r() * 1.3, 0);
    const p = g.getAttribute('position') as THREE.BufferAttribute;
    const jit = (x: number, y: number, z: number, o: number) => .85 + .3 * ((Math.sin(x * 12.99 + y * 78.23 + z * 37.72 + o + k) * 43758.55) % 1 + 1) % 1;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); p.setXYZ(i, x * jit(x, y, z, 1), y * jit(x, y, z, 2), z * jit(x, y, z, 3)); }
    g.rotateX(r() * 3).rotateY(r() * 3).rotateZ(r() * 3);
    const flat = g.index ? g.toNonIndexed() : g;
    tinted(flat, (yy: number) => slab ? (yy > 0 ? 0xf0d8b8 : 0x8a6a5a) : 0x5a3440);
    flat.translate(x, y, z);
    const n = flat.getAttribute('position').count;
    flat.setAttribute('aCentre', new THREE.Float32BufferAttribute(Array.from({ length: n }, () => [x, y, z]).flat(), 3));
    flat.setAttribute('aSpin', new THREE.Float32BufferAttribute(Array.from({ length: n }, () => [k * 1.7, .08 + r() * .14, .4 + r() * .5]).flat(), 3));
    parts.push(flat);
  }
  const geometry = mergeGeometries(parts);
  parts.forEach(g => g.dispose());
  geometry.computeVertexNormals();
  const material = stageMaterial(c.stage, 'Sunward debris', { color: 0xffffff, vertexColors: true, roughness: .9, flatShading: true });
  const time = c.ambient.time;
  addShaderPatch(material, 'sunward-debris', shader => {
    shader.uniforms.uDebrisTime = time;
    const spin = `
      vec3 spinAbout( vec3 v, float a ) { float s = sin( a ), k = cos( a ); v.xz = mat2( k, -s, s, k ) * v.xz; float s2 = sin( a * .6 ), k2 = cos( a * .6 ); v.yz = mat2( k2, -s2, s2, k2 ) * v.yz; return v; }`;
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', `attribute vec3 aCentre; attribute vec3 aSpin; uniform float uDebrisTime;${spin}\nvoid main() {`)
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n  objectNormal = spinAbout( objectNormal, uDebrisTime * aSpin.y + aSpin.x );')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n  transformed = aCentre + spinAbout( transformed - aCentre, uDebrisTime * aSpin.y + aSpin.x ) + vec3( 0., sin( uDebrisTime * aSpin.z + aSpin.x ) * .6, 0. );');
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'sunward debris'; mesh.frustumCulled = false; mesh.castShadow = false;
  c.root.add(mesh);
  c.ambient.motes({ min: [-66, 1, -66], max: [66, 16, 66], count: 120, velocity: [.3, .5, .2], size: .12, color: 0xd8a888, color2: 0xf0c8a0, opacity: .55, wobble: 1, seed: 1232 });
}

/** Long soft shafts of gold slanting across the summit from the sun's quarter, over the fighters' heads (crossed cards, one
 *  draw, additive). */
function shafts(c: DressContext) {
  const r = rand(1241), parts: THREE.BufferGeometry[] = [];
  const el = THREE.MathUtils.degToRad(16), light = new THREE.Vector3(-Math.sin(SUN_BEARING) * Math.cos(el), -Math.sin(el), -Math.cos(SUN_BEARING) * Math.cos(el));
  const side = new THREE.Vector3(Math.cos(SUN_BEARING), 0, -Math.sin(SUN_BEARING));
  for (let k = 0; k < 7; k++) {
    const len = 110 + r() * 50, w = 4 + r() * 9, off = (k - 3) * 15 + (r() - .5) * 8;
    const start = new THREE.Vector3(Math.sin(SUN_BEARING) * 70, 34 + r() * 14, Math.cos(SUN_BEARING) * 70).addScaledVector(side, off);
    const mid = start.clone().addScaledVector(light, len / 2);
    for (const turn of [0, Math.PI / 2]) {
      const g = new THREE.PlaneGeometry(w, len).rotateY(turn);
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), light.clone().negate())).translate(mid.x, mid.y, mid.z);
      parts.push(g);
    }
  }
  const geometry = mergeGeometries(parts);
  parts.forEach(g => g.dispose());
  const map = canvasTexture(64, 256, g => {
    const across = g.createLinearGradient(0, 0, 64, 0);
    across.addColorStop(0, 'rgba(255,255,255,0)'); across.addColorStop(.5, 'rgba(255,255,255,1)'); across.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = across; g.fillRect(0, 0, 64, 256);
    g.globalCompositeOperation = 'destination-in';
    const along = g.createLinearGradient(0, 0, 0, 256);
    along.addColorStop(0, 'rgba(0,0,0,.9)'); along.addColorStop(.25, 'rgba(0,0,0,.7)'); along.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = along; g.fillRect(0, 0, 64, 256);
  });
  const material = new THREE.MeshBasicMaterial({ map, color: 0xff8a40, transparent: true, opacity: .07, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
  material.name = 'Sunward shafts';
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'sunward shafts'; mesh.renderOrder = 4;
  c.root.add(mesh);
}
