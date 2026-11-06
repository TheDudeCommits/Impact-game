import * as THREE from 'three';
import { STAGE_LANDMARKS } from '../../game/environmentLayout';
import { propColliders, SHRINE_RIBS, SHRINE_TABLETS, STAGE_PROPS } from '../../game/stageProps';
import type { DressContext } from '../../render/stages/dressing';
import { Beacons } from '../../render/stages/glow';
import { Forge } from './forge';
import { keyLit, surfaces } from './cc0';
import { forged, smooth } from './finish';
import { drawn, rand } from './remake';

const TORII_POSTS = [-2.7, -1.48, 1.48, 2.7];
const BASALT = 0x2e2c32;
/** places-epic-a: the hex's light (violet-white), its deeper violet, the obsidian. */
const HEX = 0xd8c8ff, VIOLET = 0x8a60ff, OBSIDIAN = 0x24222c, IRON = 0x3a3840;
/** The hex: its foot's centre past the bounds' north end (z -42), its height, its width and depth at the foot. */
const HEX_X = .3, HEX_Z = -70, HEX_H = 92, HEX_W = 30, HEX_D = 15, HEX_TURN = 0;
/** The anchor stones the hex's four great chains are slung to, out in the lake past the bounds. */
const ANCHORS = [[-46, -44], [48, -46], [-40, -98], [42, -100]] as const;
/** places-epic-a: the sealed shard past the south end: its foot, its height; and its two anchor stones. */
const SHARD = { x: -8, z: 66, h: 36 }, SHARD_ANCHORS = [[-36, 54], [22, 58]] as const;
/** Limestone by night: green-black at the waterline, a moonlit lilac grey above it. */
const lime = (_x: number, y: number) => y < .4 ? 0x2a3038 : 0x9c98ae;

export async function dress(c: DressContext) {
  const { ambient } = c;
  const [, stone] = await Promise.all([c.sky({ url: '/assets/environment/br/sky-mirror-mere-night.webp', rotation: 0, drift: .00004, exposure: 1 }),
    surfaces(c, ['limestone-rock', 'rock-sea'] as const)]);
  const f = new Forge(c, 'mirror mere');
  // places-finish (5 November 2026): photographed stone with its relief and roughness (Poly Haven Marble Rock 01, Seaside Rock),
  // smoothed across the soft edges (finish.ts smooth), the blocks' corners kept sharp.
  f.mat('lime', { ...stone['limestone-rock'], tile: 4.5, roughness: .9, shadow: true, lift: .3, normalScale: 1.2 });
  f.mat('basalt', { ...stone['rock-sea'], tile: 3.5, roughness: .85, shadow: true, lift: .2, normalScale: 1.2 });
  // places-epic-a: the anchor chains' and the ropes' iron; the karst's stone, with little of the air on it (silhouettes in the
  // fog's indigo, where the haze's wine browned them).
  f.mat('iron', { roughness: .45, metalness: .55 });
  f.mat('karst', { ...stone['limestone-rock'], tile: 9, roughness: .95, lift: .1, air: .12 });
  // The lake's bed under its surface (the ground's water, src/originals/grounds.ts), black under the black water.
  f.add('basalt', new THREE.PlaneGeometry(420, 420, 1, 1).rotateX(-Math.PI / 2).translate(0, -.5, 0), 0x0c0e14);
  sealStone(f);
  limestone(f);
  karst(f);
  const crack = hex(f);
  const runes = runeStones(f);
  sealRopes(f, runes);
  f.done();
  for (const [key, crease] of [['lime', 64], ['basalt', 40]] as const) { const m = forged(f.meshes, key); if (m) smooth(m.geometry, crease); }
  await generated(c);
  await theHex(c);

  const pulse = { value: 1 };
  ambient.onUpdate(t => { pulse.value = .78 + .22 * Math.sin(t * 1.3) * Math.sin(t * .47 + 1) + .08 * Math.sin(t * 7.1); });
  lightOfTheHex(c, crack, pulse);
  sealCircles(c, pulse);
  runeLight(c, runes, pulse);
  hangingSeals(c, runes);
  driftingSeals(c);

  const glow = new Beacons(c.root, 64, ambient.time);
  for (const p of STAGE_PROPS['mirror-mere'] ?? []) {
    if (p.piece === 'br/stone-lamp') glow.add(p.x, 2.35, p.z, 1.4, HEX, -1, (p.x * .17 + p.z * .07 + 2) % 1, 1);
    if (p.piece === 'br/pot') glow.add(p.x, 1.8, p.z, 2.2, VIOLET, -1, .5, 1);
  }
  // The seal-stone's split, lit by the hex behind it.
  for (let k = 0; k < 4; k++) glow.add(-.2, 3 + k * 5, -31.2, 4.4 - k * .5, HEX, -1, k * .21, 1);
  // The hex's crack, foot to crown, and the rune-stones' crowns.
  for (const [y, size] of [[2, 16], [HEX_H * .5, 9], [HEX_H * .97, 14]] as const) glow.add(HEX_X, y, HEX_Z + HEX_D * .3, size, VIOLET, -1, y * .01, 1);
  for (const r of runes) glow.add(r.x, r.h + 1.4, r.z, 3.6, VIOLET, -1, (r.x * .1) % 1, 1);
  // The sealed shard's light, past the south end.
  glow.add(SHARD.x, SHARD.h * .45, SHARD.z - 3, 10, VIOLET, -1, .5, 1); glow.add(SHARD.x, 1, SHARD.z, 14, VIOLET, -1, .8, 1);
  glow.finish('mere lights', 2.1);

  // Mist banks low on the water, violet in the hex's light; motes of it rising off the crack and over the lake.
  const r = rand(31), mist: { x: number; y: number; z: number; size: number }[] = [];
  for (let i = 0; i < 34; i++) { const a = r() * Math.PI * 2, d = 34 + r() * 110; mist.push({ x: Math.sin(a) * d, y: .5 + r() * 2.4, z: Math.cos(a) * d - 10, size: 16 + r() * 18 }); }
  ambient.puffs({ spots: mist, color: 0x6a58b0, shade: 0x241c48, opacity: .2, life: 0, flat: true, drift: [.35, 0, .15], seed: 31, order: 1 });
  ambient.motes({ min: [HEX_X - 18, 0, HEX_Z - 6], max: [HEX_X + 18, HEX_H, HEX_Z + 14], count: 260, velocity: [0, 1.6, 0], size: .38, color: HEX, color2: 0xb090ff, opacity: .9, additive: true, twinkle: .7, wobble: 1.4, seed: 32 });
  ambient.motes({ min: [-60, 0, -60], max: [60, 18, 60], count: 220, velocity: [0, .35, 0], size: .06, color: 0xc8b8ff, color2: 0x9a80ff, opacity: .75, additive: true, twinkle: .8, wobble: 1, seed: 33 });
  ambient.motes({ min: [SHARD.x - 10, 0, SHARD.z - 8], max: [SHARD.x + 10, SHARD.h, SHARD.z + 8], count: 70, velocity: [0, 1.2, 0], size: .3, color: HEX, color2: 0xb090ff, opacity: .9, additive: true, twinkle: .7, wobble: 1.2, seed: 35 });
}

/** The seal-stone: the two tall boxes on the north side hold the generated seal-stone (generated()); its chips in the two low
 *  boxes before it; a drowned stair of three steps behind, going down into the water toward the hex. */
function sealStone(f: Forge) {
  const boxes = STAGE_LANDMARKS['mirror-mere'].slice(0, 4);
  const [, , chipA, chipB] = boxes;
  for (const [b, s] of [[chipA, 3], [chipB, 4]] as const) f.rock('basalt', b.x, -.3, b.z, b.halfX * .95, b.halfY * 1.15, b.halfZ * .95, BASALT, s, { rough: .3, sink: .1, detail: 2 });
  for (let k = 0; k < 3; k++) f.box('basalt', 0, -.6, -52 - k * 2.4, 34 - k * 4, 1.1 + k * .9, 15 - k * 2.4, k % 2 ? 0x4a4a52 : 0x3c3c44);
  for (const s of [-1, 1]) f.box('basalt', s * 13, 1.7, -56, 2.2, 6, 2.2, 0x4a4a52);
}

/** r7's limestone: outcrops in the ridges' boxes, pinnacles from the ribs' roots, cairns where the tablets stood, stone
 *  basins in the props' boxes (the gates' trilithons and the lamps are generated pieces). */
function limestone(f: Forge) {
  const r = rand(2718), landmarks = STAGE_LANDMARKS['mirror-mere'], props = propColliders('mirror-mere');
  for (const b of landmarks.slice(4, landmarks.length - props.length)) {
    const g = new THREE.IcosahedronGeometry(1, 3), p = g.getAttribute('position') as THREE.BufferAttribute, seed = r() * 10;
    for (let i = 0; i < p.count; i++) {
      let px = p.getX(i), py = p.getY(i), pz = p.getZ(i);
      const k = 1 + .12 * Math.sin(px * 3 + seed) * Math.cos(pz * 3 - seed) + .06 * Math.sin(py * 7 + seed);
      px *= k; pz *= k; py = Math.max(-.2, py) * (py > .5 ? .8 : 1);
      p.setXYZ(i, b.x + px * b.halfX * 1.05, (py + .2) / 1.2 * b.halfY * 2, b.z + pz * b.halfZ * 1.05);
    }
    f.add('lime', g, lime);
  }
  for (const [x, z] of SHRINE_RIBS) {
    const h = 10 + r() * 8, g = new THREE.CylinderGeometry(.15, 1, h, 6, 4).translate(x, h / 2 - .3, z), p = g.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) p.setX(i, p.getX(i) + Math.sin(p.getY(i) * .7 + x) * .25);
    f.add('lime', g, lime);
  }
  for (const [x, z] of SHRINE_TABLETS) for (let k = 0; k < 4; k++) f.cyl('lime', x + (r() - .5) * .2, k * .55, z, .9 - k * .16, 1 - k * .16, .55, lime, { sides: 7 });
  for (const p of STAGE_PROPS['mirror-mere'] ?? []) {
    if (p.piece === 'br/pot') f.cyl('lime', p.x, 0, p.z, 1.1, .8, 1.6, lime, { sides: 10 });
  }
}

/** places-gen: the generated pieces (own/mere-*): the seal-stone across the two tall boxes, a trilithon on each pair of the
 *  gates' posts, the obelisk lamps in the lamps' boxes. (places-epic-a: the ring of trilithons out on the water is a ring of
 *  rune-stones now, runeStones().) */
async function generated(c: DressContext) {
  const { kit } = c;
  await kit.load(['own/mere-seal', 'own/mere-trilithon', 'own/mere-lamp']);
  kit.place('own/mere-seal', { x: .3, y: -.4, z: -33.6, height: 22.5, sx: 1.8 });
  for (const [z, s] of [[33, 2.4], [-20, 1.25]] as const) {
    const h = (s === 2.4 ? 6.7 : 3.6) + .4, wide = (TORII_POSTS[3] - TORII_POSTS[2] + .45) * s;
    for (const e of [-1, 1]) kit.place('own/mere-trilithon', { x: e * (TORII_POSTS[2] + TORII_POSTS[3]) / 2 * s, y: -.3, z, height: h, sx: wide / h, sz: .9 * s / h * 1.6, rot: e * .04 });
  }
  for (const p of STAGE_PROPS['mirror-mere'] ?? []) if (p.piece === 'br/stone-lamp') kit.place('own/mere-lamp', { x: p.x, y: -.1, z: p.z, height: 2.8, rot: p.x + p.z });
  kit.flush(c.stage);
  // The seal-stone lit from the hex behind it and the cameras' side: a cold violet key.
  keyLit(kit.pieceMaterials('own/mere-seal'), new THREE.Color(.62, .55, 1).multiplyScalar(.5));
}

/** A rough slab: a box tapering to `top` of its width, its faces pushed by a seeded noise, its crown broken jagged. */
function slab(w: number, h: number, d: number, top: number, seed: number, jag: number) {
  const g = new THREE.BoxGeometry(w, h, d, 4, 18, 3).translate(0, h / 2, 0), p = g.getAttribute('position') as THREE.BufferAttribute, r = rand(seed);
  const crown = Array.from({ length: 9 }, () => r());
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), t = y / h, k = 1 - (1 - top) * t;
    const n = Math.sin(y * .23 + seed) * Math.cos(x * .41 - seed * 2) * .9 + Math.sin(z * .37 + y * .11 + seed * 3) * .6;
    let yy = y;
    if (y > h - .01) yy = h - jag * crown[Math.min(8, Math.floor((x / w + .5) * 8.99))] * (.6 + .4 * Math.abs(z / d * 2));
    p.setXYZ(i, x * k + n * .4, yy, z * k + n * .35);
  }
  return g;
}

/** The hex's foot and its anchor chains (the monolith itself is the generated piece, theHex()): broken black rock heaped
 *  round it in the water, four great chains slung from its chained middle down to anchor stones in the lake, sagging.
 *  Returns the crack's line, for its light. */
function hex(f: Forge) {
  const r = rand(77);
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * Math.PI * 2 + r() * .3, d = HEX_W * .5 + r() * 6;
    f.rock('basalt', HEX_X + Math.cos(a) * d, -1.2, HEX_Z + Math.sin(a) * d * .7, 3 + r() * 5, 2 + r() * 4, 3 + r() * 4, 0x24262e, 40 + i, { rough: .35, detail: 1 });
  }
  const link = (at: THREE.Vector3, dir: THREE.Vector3, turn: number, size: number) => {
    const g = new THREE.TorusGeometry(size, size * .3, 5, 10).scale(1, 1.55, 1);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    g.rotateY(turn).applyQuaternion(q).translate(at.x, at.y, at.z);
    f.add('iron', g, IRON);
  };
  for (const [ax, az] of ANCHORS) {
    const from = new THREE.Vector3(HEX_X + Math.sign(ax) * HEX_W * .3, HEX_H * .46, HEX_Z + Math.sign(az - HEX_Z) * HEX_D * .25);
    const to = new THREE.Vector3(ax, 3.2, az), len = from.distanceTo(to), n = Math.round(len / 2.6);
    let last = from.clone();
    for (let i = 1; i <= n; i++) {
      const t = i / n, p = from.clone().lerp(to, t);
      p.y -= Math.sin(t * Math.PI) * len * .12;
      link(last.clone().lerp(p, .5), p.clone().sub(last), i % 2 ? Math.PI / 2 : 0, 1.25);
      last = p;
    }
    f.rock('basalt', ax, -1, az, 4.2, 4.6, 4.2, 0x2a2c34, Math.abs(ax + az), { rough: .3, detail: 1 });
    f.box('iron', ax - .6, 3, az - .6, 1.2, 1.4, 1.2, IRON);
  }
  // The shard's chains to its two anchor stones, and the black rock round its foot.
  for (const [ax, az] of SHARD_ANCHORS) {
    const from = new THREE.Vector3(SHARD.x + Math.sign(ax - SHARD.x) * 4, SHARD.h * .5, SHARD.z), to = new THREE.Vector3(ax, 2.4, az);
    const len = from.distanceTo(to), n = Math.round(len / 1.9);
    let last = from.clone();
    for (let i = 1; i <= n; i++) {
      const t = i / n, p = from.clone().lerp(to, t);
      p.y -= Math.sin(t * Math.PI) * len * .1;
      link(last.clone().lerp(p, .5), p.clone().sub(last), i % 2 ? Math.PI / 2 : 0, .9);
      last = p;
    }
    f.rock('basalt', ax, -1, az, 3, 3.4, 3, 0x2a2c34, Math.abs(ax * 3 + az), { rough: .3, detail: 1 });
  }
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * Math.PI * 2, d = 7 + r() * 4;
    f.rock('basalt', SHARD.x + Math.cos(a) * d, -1, SHARD.z + Math.sin(a) * d * .8, 2 + r() * 3, 1.4 + r() * 2.4, 2 + r() * 2.4, 0x24262e, 90 + i, { rough: .35, detail: 1 });
  }
  return { x: HEX_X, z: HEX_Z + HEX_D / 2 - .4, h: HEX_H * .95 };
}

async function theHex(c: DressContext) {
  const { kit } = c;
  const [glowMap] = await Promise.all([c.texture('/assets/environment/own/mere-hex-glow.webp'), kit.load(['own/mere-hex'])]);
  glowMap.flipY = false; glowMap.colorSpace = THREE.SRGBColorSpace; glowMap.needsUpdate = true;
  kit.place('own/mere-hex', { x: HEX_X, y: -3, z: HEX_Z, height: HEX_H, rot: HEX_TURN, shadow: false });
  // places-epic-a (the lead: "so no heading is a dark empty lake"): a shard of the hex broken off and sealed apart, out on the
  // water past the south end (the same piece, smaller, leaning, its crack toward the lake's heart), so the fights that face
  // away from the monolith have the hex's light before them too.
  kit.place('own/mere-hex', { x: SHARD.x, y: -2.5, z: SHARD.z, height: SHARD.h, rot: Math.PI + .35, roll: .12, shadow: false });
  kit.flush(c.stage);
  for (const m of kit.pieceMaterials('own/mere-hex') as THREE.MeshStandardMaterial[]) {
    m.emissiveMap = glowMap; m.emissive.set(HEX); m.emissiveIntensity = 2.6; m.needsUpdate = true;
    const base = m.emissiveIntensity;
    c.ambient.onUpdate(t => { m.emissiveIntensity = base * (.75 + .25 * Math.sin(t * 1.3) * Math.sin(t * .47 + 1) + .1 * Math.sin(t * 7.1)); });
  }
}

/** Ropes slung from rune-stone to rune-stone round the mere, sagging (a barrier of seals; the seals are cloth,
 *  hangingSeals()). */
function sealRopes(f: Forge, stones: { x: number; z: number; h: number }[]) {
  for (let i = 0; i < stones.length; i++) {
    const a = stones[i], b = stones[(i + 1) % stones.length];
    if (Math.hypot(a.x - b.x, a.z - b.z) > 45) continue;
    const A = new THREE.Vector3(a.x, a.h * .82, a.z), B = new THREE.Vector3(b.x, b.h * .82, b.z), n = 14;
    let last = A.clone();
    for (let k = 1; k <= n; k++) {
      const t = k / n, p = A.clone().lerp(B, t); p.y -= Math.sin(t * Math.PI) * 4.5;
      f.pipe('iron', last, p, .16, 0x5a4a3a, { sides: 5 });
      last = p;
    }
  }
}

/** The ring of rune-stones out on the water round the mere (past the bounds, where places-gen stood a ring of trilithons):
 *  tall black stones, tapering, each with a column of runes on its face toward the lake's heart. */
function runeStones(f: Forge) {
  const out: { x: number; z: number; h: number; w: number; rot: number }[] = [], r = rand(919);
  for (let k = 0; k < 12; k++) {
    const a = (k + .5) / 12 * Math.PI * 2, x = Math.sin(a) * 62, z = Math.cos(a) * 64 - 8;
    if (z < -50 && Math.abs(x) < 26) continue; // the hex's foot
    const h = 11 + r() * 7 + (k % 3) * 2, w = 2.6 + r() * .8, rot = Math.atan2(-x, -6 - z); // its runes face the lake's heart
    const g = slab(w, h, w * .62, .62, 300 + k, 1.8).rotateY(rot).translate(x, -1, z);
    f.add('basalt', g, (_x, y) => y < 0 ? 0x161820 : 0x2c2e38);
    out.push({ x, z, h: h - 1.8, w, rot });
  }
  return out;
}

function runeTexture() {
  return drawn(64, 512, (g, w, h) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    const r = rand(5150);
    g.strokeStyle = '#fff'; g.lineWidth = 4; g.lineCap = 'round'; g.shadowColor = '#fff'; g.shadowBlur = 8;
    for (let y = 26; y < h - 20; y += 44) {
      const cx = w / 2, kind = Math.floor(r() * 5);
      g.beginPath();
      if (kind === 0) { g.arc(cx, y, 11, 0, Math.PI * 2); g.moveTo(cx, y - 18); g.lineTo(cx, y + 18); }
      else if (kind === 1) { g.moveTo(cx - 12, y - 14); g.lineTo(cx + 12, y + 14); g.moveTo(cx + 12, y - 14); g.lineTo(cx, y); }
      else if (kind === 2) { g.moveTo(cx, y - 16); g.lineTo(cx - 12, y + 12); g.lineTo(cx + 12, y + 12); g.closePath(); }
      else if (kind === 3) { g.arc(cx, y + 2, 12, Math.PI, 0); g.moveTo(cx - 12, y + 2); g.lineTo(cx - 12, y + 14); g.moveTo(cx + 12, y + 2); g.lineTo(cx + 12, y + 14); }
      else { g.moveTo(cx - 13, y); g.lineTo(cx + 13, y); g.moveTo(cx - 6, y - 14); g.lineTo(cx - 6, y + 14); g.moveTo(cx + 7, y - 9); g.lineTo(cx + 7, y + 9); }
      g.stroke();
    }
  }, { repeat: false });
}

/** The runes on the rune-stones, one draw: a strip of glowing marks on each stone's face toward the hex. */
function runeLight(c: DressContext, stones: { x: number; z: number; h: number; w: number; rot: number }[], pulse: { value: number }) {
  const parts = stones.map(s => new THREE.PlaneGeometry(s.w * .42, s.h * .78).translate(0, s.h * .5, s.w * .62 * .5 + .25).rotateY(s.rot).translate(s.x, -1, s.z));
  const geometry = mergeAll(parts);
  const material = new THREE.MeshBasicMaterial({ name: 'mere runes', map: runeTexture(), color: new THREE.Color(VIOLET).multiplyScalar(2.4), transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false });
  const base = material.color.clone();
  c.ambient.onUpdate(() => material.color.copy(base).multiplyScalar(pulse.value));
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'mere runes'; mesh.renderOrder = 2;
  c.root.add(mesh);
}

/** The light in the hex's crack: a sheet of violet-white light in the split, brightest at its core, flickering in bands. */
function lightOfTheHex(c: DressContext, crack: { x: number; z: number; h: number }, pulse: { value: number }) {
  const map = drawn(64, 512, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, 'rgba(0,0,0,0)'); grad.addColorStop(.32, 'rgba(120,80,255,.5)'); grad.addColorStop(.5, 'rgba(255,250,255,1)');
    grad.addColorStop(.68, 'rgba(120,80,255,.5)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    const r = rand(66);
    g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(0,0,0,${.15 + r() * .35})`; g.fillRect(0, r() * h, w, 2 + r() * 10); }
  }, { repeat: false });
  const material = new THREE.MeshBasicMaterial({ name: 'hex crack', map, color: new THREE.Color(HEX).multiplyScalar(3), transparent: true, blending: THREE.AdditiveBlending,
    depthWrite: false, toneMapped: false, fog: false, side: THREE.DoubleSide });
  const base = material.color.clone();
  c.ambient.onUpdate(() => material.color.copy(base).multiplyScalar(.7 + .5 * pulse.value));
  // (The generated hex lights its own cracks, theHex(); here only the glow off it and its light on the water.)
  // A wider, fainter glow round it, and the crack's light laid down the water toward the fight (its reflection in the
  // black mirror).
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(60, crack.h * 1.15).translate(crack.x, crack.h * .55, HEX_Z - HEX_D * .6), material.clone());
  (halo.material as THREE.MeshBasicMaterial).color.copy(new THREE.Color(VIOLET).multiplyScalar(.5));
  const reflection = new THREE.Mesh(new THREE.PlaneGeometry(9, 44).rotateX(-Math.PI / 2).translate(crack.x, .03, crack.z + 22), material.clone());
  (reflection.material as THREE.MeshBasicMaterial).color.copy(new THREE.Color(HEX).multiplyScalar(.5));
  halo.renderOrder = reflection.renderOrder = 2;
  c.root.add(halo, reflection);
}

/** The seal's circle drawn on the water: rings, a band of runes, nine small rings on spokes, violet, breathing with the hex. */
function sealTexture() {
  return drawn(2048, 2048, (g, w) => {
    const c = w / 2, r = rand(9090);
    g.fillStyle = '#000'; g.fillRect(0, 0, w, w);
    g.strokeStyle = '#fff'; g.lineCap = 'round'; g.shadowColor = '#fff'; g.shadowBlur = 14;
    const ring = (rad: number, width: number) => { g.lineWidth = width; g.beginPath(); g.arc(c, c, rad, 0, Math.PI * 2); g.stroke(); };
    ring(c * .98, 10); ring(c * .93, 4); ring(c * .74, 8); ring(c * .7, 3); ring(c * .3, 6);
    // The band of runes between the outer rings.
    g.lineWidth = 7;
    for (let i = 0; i < 72; i++) {
      const a = i / 72 * Math.PI * 2, rad = c * .835;
      g.save(); g.translate(c + Math.cos(a) * rad, c + Math.sin(a) * rad); g.rotate(a + Math.PI / 2);
      g.beginPath();
      const kind = Math.floor(r() * 4);
      if (kind === 0) { g.arc(0, 0, 16, 0, Math.PI * 2); g.moveTo(0, -30); g.lineTo(0, 30); }
      else if (kind === 1) { g.moveTo(-18, -26); g.lineTo(18, 26); g.moveTo(18, -26); g.lineTo(0, 0); }
      else if (kind === 2) { g.moveTo(0, -28); g.lineTo(-20, 22); g.lineTo(20, 22); g.closePath(); }
      else { g.moveTo(-22, 0); g.lineTo(22, 0); g.moveTo(-10, -26); g.lineTo(-10, 26); g.moveTo(12, -16); g.lineTo(12, 16); }
      g.stroke(); g.restore();
    }
    // Nine small rings round the inner ring, each on a spoke, and a ring of short marks inside (no star figure).
    g.lineWidth = 5;
    for (let i = 0; i < 9; i++) {
      const a = i / 9 * Math.PI * 2 - Math.PI / 2, x = c + Math.cos(a) * c * .52, y = c + Math.sin(a) * c * .52;
      g.beginPath(); g.arc(x, y, c * .07, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.moveTo(c + Math.cos(a) * c * .3, c + Math.sin(a) * c * .3); g.lineTo(c + Math.cos(a) * c * .45, c + Math.sin(a) * c * .45);
      g.moveTo(c + Math.cos(a) * c * .59, c + Math.sin(a) * c * .59); g.lineTo(c + Math.cos(a) * c * .7, c + Math.sin(a) * c * .7); g.stroke();
    }
    g.lineWidth = 4;
    for (let i = 0; i < 36; i++) { const a = i / 36 * Math.PI * 2; g.beginPath(); g.moveTo(c + Math.cos(a) * c * .2, c + Math.sin(a) * c * .2); g.lineTo(c + Math.cos(a) * c * (i % 2 ? .24 : .27), c + Math.sin(a) * c * (i % 2 ? .24 : .27)); g.stroke(); }
  }, { repeat: false });
}

/** The seal's circles on the water: a bright one round the hex's foot, a faint one under the whole fight (flat, a few
 *  centimetres over the water: nothing stands in the bounds). */
function sealCircles(c: DressContext, pulse: { value: number }) {
  const map = sealTexture(); map.anisotropy = 16;
  const make = (radius: number, x: number, z: number, y: number, colour: THREE.Color, turn: number) => {
    const material = new THREE.MeshBasicMaterial({ name: 'mere seal circle', map, color: colour, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      toneMapped: false, fog: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2, radius * 2).rotateX(-Math.PI / 2), material);
    mesh.position.set(x, y, z); mesh.name = 'mere seal circle'; mesh.renderOrder = 1;
    const base = colour.clone();
    c.ambient.onUpdate(t => { material.color.copy(base).multiplyScalar(pulse.value); mesh.rotation.y = t * turn; });
    c.root.add(mesh);
  };
  make(34, HEX_X, HEX_Z, .035, new THREE.Color(VIOLET).multiplyScalar(1.6), .012); // its edge at the bounds' north end
  make(40, 0, -1, .025, new THREE.Color(VIOLET).multiplyScalar(.075), -.006);
  make(16, SHARD.x, SHARD.z, .035, new THREE.Color(VIOLET).multiplyScalar(1.3), -.015); // round the sealed shard past the south end
}

function sealPaper(burning: boolean) {
  return drawn(128, 512, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#ece4d4'; g.fillRect(8, 0, w - 16, h - (burning ? 40 : 6));
    g.strokeStyle = '#7a1a2a'; g.lineWidth = 5; g.strokeRect(18, 10, w - 36, h - (burning ? 64 : 26));
    const r = rand(burning ? 404 : 303);
    g.strokeStyle = '#1a1420'; g.lineWidth = 7; g.lineCap = 'round';
    for (let y = 44; y < h - 80; y += 52) {
      g.beginPath(); const cx = w / 2;
      g.moveTo(cx - 20 + r() * 8, y); g.lineTo(cx + 20 - r() * 8, y + 4);
      g.moveTo(cx - 4 + r() * 8, y - 16); g.lineTo(cx + 2 - r() * 6, y + 20);
      if (r() > .5) { g.moveTo(cx + 10, y - 10); g.arc(cx, y + 6, 12, -.5, 2.4); }
      g.stroke();
    }
    if (burning) {
      const grad = g.createLinearGradient(0, h - 70, 0, h);
      grad.addColorStop(0, 'rgba(60,20,10,0)'); grad.addColorStop(.45, 'rgba(40,10,6,.95)'); grad.addColorStop(.62, 'rgba(255,120,40,1)'); grad.addColorStop(1, 'rgba(255,200,120,0)');
      g.fillStyle = grad; g.fillRect(8, h - 70, w - 16, 70);
    }
  }, { repeat: false });
}

/** Paper seals hung off the ropes between the rune-stones, swaying (cloth: one draw), some burning at their ends. */
function hangingSeals(c: DressContext, stones: { x: number; z: number; h: number }[]) {
  const maps = [sealPaper(false), sealPaper(true)], r = rand(5511);
  for (let i = 0; i < stones.length; i++) {
    const a = stones[i], b = stones[(i + 1) % stones.length];
    if (Math.hypot(a.x - b.x, a.z - b.z) > 45) continue;
    for (let k = 1; k < 6; k++) {
      const t = k / 6, x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t, y = a.h * .82 + (b.h - a.h) * .82 * t - Math.sin(t * Math.PI) * 4.5;
      c.ambient.cloth(maps[r() < .3 ? 1 : 0], { x, y: y - .1, z, width: .9, height: 2.6 + r() * .8, rot: Math.atan2(b.x - a.x, b.z - a.z) + Math.PI / 2, color: 0xd0c8e4, wind: .9, lit: .5 });
    }
  }
}

/** Seals torn loose and drifting on the air over the lake and up round the hex: one instanced draw, each turning slowly. */
function driftingSeals(c: DressContext) {
  const N = 64, r = rand(8080);
  const material = new THREE.MeshBasicMaterial({ name: 'drifting seals', map: sealPaper(false), color: new THREE.Color(0xb8b0d0), side: THREE.DoubleSide,
    alphaTest: .4, toneMapped: true, fog: true });
  const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(.42, 1.6), material, N);
  mesh.name = 'drifting seals'; mesh.frustumCulled = false;
  const seeds = Array.from({ length: N }, (_, i) => {
    const near = i < 22, a = r() * Math.PI * 2, d = near ? 18 + r() * 22 : 42 + r() * 50;
    return { x: near ? HEX_X + Math.cos(a) * d : Math.cos(a) * d, z: near ? HEX_Z + Math.sin(a) * d * .7 : Math.sin(a) * d - 10, y0: near ? r() * HEX_H : 6 + r() * 22,
      span: near ? HEX_H : 30, rise: near ? 1.2 + r() * 1 : .4 + r() * .4, spin: (r() - .5) * 1.2, sway: r() * 6.28, size: near ? 2.2 + r() * 1.6 : .9 + r() * .5 };
  });
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3();
  const place = (t: number) => {
    for (let i = 0; i < N; i++) {
      const k = seeds[i], y = (k.y0 + t * k.rise) % k.span + (k.span === HEX_H ? 0 : 6);
      p.set(k.x + Math.sin(t * .4 + k.sway) * 2.2, y, k.z + Math.cos(t * .33 + k.sway) * 1.6);
      e.set(Math.sin(t * .9 + k.sway) * .5, t * k.spin + k.sway, Math.sin(t * .7 + k.sway * 2) * .4);
      m.compose(p, q.setFromEuler(e), s.setScalar(k.size));
      mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
  };
  place(0);
  c.ambient.onUpdate(place);
  c.root.add(mesh);
}

/** Karst towers far out on the water round the mere, 160-420 m off, tall and steep: silhouettes against the hex's glow. */
function karst(f: Forge) {
  const r = rand(4141);
  for (let i = 0; i < 26; i++) {
    // places-epic-a: taller and spired, so they stand as pinnacles against the hex's glow, not as slabs.
    const a = i / 26 * Math.PI * 2 + r() * .2, d = 160 + r() * 260, h = 60 + r() * 110, w = 10 + r() * 14, cx = Math.sin(a) * d, cz = Math.cos(a) * d;
    const g = new THREE.CylinderGeometry(w * .18, w, h, 6, 5).translate(cx, h / 2 - 4, cz), p = g.getAttribute('position') as THREE.BufferAttribute;
    for (let k = 0; k < p.count; k++) { const s = .8 + r() * .4, lean = (p.getY(k) / h) * w * .5 * Math.sin(i * 1.7); p.setX(k, cx + (p.getX(k) - cx) * s + lean); p.setZ(k, cz + (p.getZ(k) - cz) * s); }
    f.add('karst', g, (_x, y) => y > h - 12 ? 0x262c2a : 0x2c2a3a);
  }
}

function mergeAll(parts: THREE.BufferGeometry[]) {
  const out = new THREE.BufferGeometry(), pos: number[] = [], uv: number[] = [];
  for (const g of parts) {
    const n = g.index ? g.toNonIndexed() : g, p = n.getAttribute('position'), u = n.getAttribute('uv');
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); uv.push(u.getX(i), u.getY(i)); }
  }
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return out;
}
