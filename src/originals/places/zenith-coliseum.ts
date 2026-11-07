import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { DressContext } from '../../render/stages/dressing';
import { stageMaterial } from '../../render/stages/build';
import { seeded } from '../../render/stages/ambient';
import { Beacons } from '../../render/stages/glow';
import { heroAir } from '../../render/stages/hero';
import { Forge, detail, noise2 } from './forge';
import { crater } from './battleScars';
import { surfaces } from './cc0';
import { rand } from './remake';

/** The sixteen columns' heights round their 19.5 m circle; the whole ones (over 9 m) carry a capital. */
const HEIGHTS = [11, 5.5, 8.5, 3.8, 10.5, 6.2, 4.4, 9.6, 11, 4.9, 7.4, 3.2, 10.2, 5.8, 8.8, 4.1];
const RING = 19.5;
/** How far the build sits below the old rim, so the floor's top is the simulation's floor (0); the plinths' tops are the shafts' feet. */
const DOWN = .25, FOOT = .8 - DOWN;
/** The walk round the kerb, from the kerb's outside to the spire's edge, where a parapet runs round it. */
const WALK_IN = 16.72, EDGE = 27;

/** The Zenith Coliseum: a duelling floor on the flat top of a spire of rock over a sea of cloud, where the sky runs out.
 *  Sixteen columns stand round it, five whole with fire burning on their capitals and banners down them; the stands lie
 *  shattered and adrift in a broken ring; a winged guardian kneels on a pinnacle to the north and a colossal broken ring of
 *  stone frames the setting sun to the south. Everything stands outside the play square (10.5 m): nothing boxed. */
export async function dress(c: DressContext) {
  c.kit.grade = (material, piece) => {
    if (piece !== 'own/zenith-guardian' && piece !== 'own/zenith-tiers') return;
    heroAir(material, .2, .3);
    if (material.map) { material.emissive.setRGB(1, .86, .7); material.emissiveMap = material.map; material.emissiveIntensity = piece === 'own/zenith-guardian' ? .32 : .18; material.needsUpdate = true; }
  };
  const [, , stone] = await Promise.all([
    c.sky({ url: '/assets/environment/br/sky-zenith-coliseum.webp', rotation: Math.PI / 2, drift: .0002, exposure: 1.1 }),
    c.kit.load(['br/pot', 'own/sunfall-brazier', 'own/zenith-guardian', 'own/zenith-tiers']),
    surfaces(c, ['flagstone', 'ashlar-grey'] as const),
  ]);
  const columns = HEIGHTS.map((h, i) => {
    const a = (i + .5) / 16 * Math.PI * 2;
    return { x: Math.cos(a) * RING, z: -Math.sin(a) * RING, h, whole: h > 9, a };
  });
  const whole = columns.filter(col => col.whole);
  const flames: { x: number; y: number; z: number; size: number }[] = [];
  const glow = new Beacons(c.root, 96, c.ambient.time);
  for (const { x, z, h } of whole) {
    const top = FOOT + h + .7;
    c.kit.place('br/pot', { x, z, y: top, scale: 1.6, tint: 0xb08a5a });
    for (let k = 0; k < 3; k++) flames.push({ x, y: top + .9 + k * .5, z, size: 1.5 - k * .35 });
    glow.add(x, top + 1.3, z, 5, 0xffa040, -1, (x * .37) % 1, 1);
  }

  const banner = bannerTexture();
  for (const { x, z, h } of whole) {
    const r = Math.hypot(x, z), facing = Math.atan2(-x, -z);
    c.ambient.cloth(banner, { x: x - x / r * 1.0, y: FOOT + h - .2, z: z - z / r * 1.0, width: 1.5, height: 6, rot: facing, wind: .35, lit: .45 });
  }

  for (let i = 0; i < 24; i++) {
    const a = i / 24 * Math.PI * 2;
    glow.add(Math.cos(a) * 16.4, .42, Math.sin(a) * 16.4, .6, 0xffc070, -1, i * .13 % 1, 1);
  }

  const f = new Forge(c, 'zenith');
  f.mat('floor', { ...stone.flagstone, tile: 2.6, lift: .5, gain: 1.25, roughness: .85, wear: { key: 'zenith-coliseum', scale: 1.4, light: [.9, 1.08], patch: 0xb0a4b8, patchAmount: .18 } });
  f.mat('flags', { ...stone.flagstone, tile: 3.2, lift: .1, gain: 1.15, roughness: .92 });
  f.mat('ashlar', { ...stone['ashlar-grey'], tile: 2.4, lift: .05, gain: 1.1, roughness: .9 });
  f.mat('rock', { map: detail.rock(4401), tile: 12, roughness: .95, air: .3, flat: true });
  f.mat('bronze', { roughness: .38, metalness: .6, emissive: 0x2a1606, emissiveIntensity: .6 });
  floor(f);
  spire(f);
  walk(f, columns);
  columnsOf(f, columns);
  inlay(f);
  f.done();
  crater(c, { size: 30, x: 0, z: 0, cx: .6, cz: 1.2, radius: 2.4, reach: 11, seed: 4402, cracks: 15, lit: -Math.PI / 2, width: .5,
    ember: 0xffb040, strength: .4, heart: 0, litStone: 'rgba(236,226,212,.85)', darkStone: 'rgba(70,56,80,.85)', name: 'zenith crater' });

  const brazierFire: { x: number; y: number; z: number; size: number }[] = [];
  for (let k = 0; k < 10; k++) {
    const a = (k + .5) / 10 * Math.PI * 2 + .16, x = Math.cos(a) * 23.4, z = -Math.sin(a) * 23.4;
    if (z / 23.4 > .82) continue;
    c.kit.place('own/sunfall-brazier', { x, y: 0, z, height: 3.4, rot: a * 1.7 });
    for (let j = 0; j < 2; j++) brazierFire.push({ x, y: 3.45 + j * .45, z, size: 1.1 - j * .3 });
    glow.add(x, 3.7, z, 3.6, 0xffa848, -1, (k * .29) % 1, 1);
  }
  glow.finish('zenith fires', 2.2);
  c.ambient.puffs({ spots: [...flames, ...brazierFire], color: 0xffc060, shade: 0xff5a14, opacity: .6, life: 1.1, rise: 2.6, grow: .6, additive: true, seed: 81, order: 1 });

  tiers(c);
  guardian(c);

  const rnd = seeded(808), shards: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 14; i++) {
    const a = rnd() * Math.PI * 2, r = 70 + rnd() * 70, s = 1.2 + rnd() * 3.2;
    const g = new THREE.ConeGeometry(s, s * (2.2 + rnd() * 1.4), 7, 2).rotateX(Math.PI);
    const p = g.getAttribute('position') as THREE.BufferAttribute;
    for (let k = 0; k < p.count; k++) { const n = .8 + rnd() * .35; p.setXYZ(k, p.getX(k) * n, p.getY(k), p.getZ(k) * n); }
    g.rotateY(rnd() * 6).rotateX((rnd() - .5) * .4).translate(Math.sin(a) * r, -20 + rnd() * 30, Math.cos(a) * r);
    g.deleteAttribute('uv');
    shards.push(g.toNonIndexed());
  }
  const islets = isletsOf(shards);
  const geometry = mergeGeometries(shards);
  shards.forEach(g => g.dispose());
  geometry.computeVertexNormals();
  const drift = new THREE.Mesh(geometry, heroAir(stageMaterial(c.stage, 'Zenith shards', { color: 0x6a6078, roughness: .95, flatShading: true }), .3));
  drift.name = 'zenith shards';
  const ruins = new THREE.Mesh(islets, heroAir(stageMaterial(c.stage, 'Zenith ruins', { color: 0xb8b0c4, roughness: .9 }), .3));
  ruins.name = 'zenith islet ruins';
  drift.add(ruins);
  c.root.add(drift);
  c.ambient.onUpdate(t => { drift.rotation.y = t * .006; drift.position.y = Math.sin(t * .2) * .8; });
  c.ambient.motes({ min: [-40, -20, -40], max: [40, 18, 40], count: 140, velocity: [.05, .35, .04], size: .06, color: 0xffd890, color2: 0x9fe8ff,
    opacity: .7, additive: true, twinkle: .6, wobble: 1.4, seed: 82 });
  const cloud: { x: number; y: number; z: number; size: number }[] = [];
  const rc = rand(4403);
  for (let i = 0; i < 70; i++) { const a = rc() * Math.PI * 2, d = 40 + rc() * 300; cloud.push({ x: Math.cos(a) * d, y: -70 - rc() * 30, z: Math.sin(a) * d, size: 50 + rc() * 70 }); }
  c.ambient.puffs({ spots: cloud, color: 0xb88ab8, shade: 0x3a2a5a, opacity: .5, life: 0, flat: true, drift: [.6, 0, .2], seed: 4404, order: 0 });
  sunRing(c);
  c.kit.flush(c.stage);
}

/** The duelling floor: a disc of pale flagstones to the kerb, the kerb a ring of stone a hand high; the floor's top is the
 *  simulation's floor (0). */
function floor(f: Forge) {
  f.add('floor', new THREE.CircleGeometry(16.1, 96).rotateX(-Math.PI / 2).toNonIndexed(), 0xe8e2ee);
  const kerb = new THREE.CylinderGeometry(WALK_IN, WALK_IN, .4, 96, 1, false).translate(0, .2 - .4, 0);
  f.add('ashlar', kerb.toNonIndexed(), 0xb8b0c4);
  f.add('ashlar', new THREE.RingGeometry(16.1, WALK_IN, 96, 1).rotateX(-Math.PI / 2).translate(0, .2, 0).toNonIndexed(), 0xd0c8da);
  f.add('ashlar', new THREE.CylinderGeometry(16.1, 16.1, .2, 96, 1, true).translate(0, .1, 0).toNonIndexed(), 0xa8a0b4);
}

/** The spire the floor stands on: its top's rim, then rock tapering down a quarter of a kilometre into the sea of cloud,
 *  torn by ledges. */
function spire(f: Forge) {
  const n = noise2(4410);
  f.add('ashlar', new THREE.CylinderGeometry(EDGE, EDGE - .4, 1.6, 64, 1, true).translate(0, -.8, 0).toNonIndexed(), 0x9a92a8);
  const g = new THREE.CylinderGeometry(EDGE - .6, 5, 240, 26, 14, true).translate(0, -1.6 - 120, 0);
  const p = g.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x), top = y > -2;
    const k = top ? 1 : 1 + (n(a * 4, y * .05, 3) - .5) * .5 + Math.sin(y * .12) * .06;
    p.setXYZ(i, x * k, y, z * k);
  }
  f.add('rock', g, (_x, y) => y > -30 ? 0x6e6680 : y > -120 ? 0x5a5270 : 0x4a4262);
  const r = rand(4411);
  for (let k = 0; k < 16; k++) {
    const a = r() * Math.PI * 2, y = -6 - r() * 90, rr = (EDGE - 2) * (1 - (-y) / 260) + 1;
    f.rock('rock', Math.cos(a) * rr, y, Math.sin(a) * rr, 3 + r() * 4, 2 + r() * 3, 3 + r() * 4, 0x625a76, 4412 + k);
  }
}

/** The sixteen columns round the floor: a plinth, a shaft, the five whole ones crowned with a capital (the fire bowls stand on
 *  it), the broken ones ending in a torn stump. */
function columnsOf(f: Forge, columns: { x: number; z: number; h: number; whole: boolean; a: number }[]) {
  const r = rand(4420);
  for (const col of columns) {
    f.box('ashlar', col.x, 0, col.z, 2, FOOT, 2, 0xb0a8bc, { rot: -col.a });
    f.cyl('flags', col.x, FOOT, col.z, .8, .86, col.h - (col.whole ? 0 : .6), 0xd8d0e0, { sides: 16 });
    if (col.whole) {
      f.box('ashlar', col.x, FOOT + col.h, col.z, 2.3, .7, 2.3, 0xc8c0d4, { rot: -col.a });
    } else {
      const top = FOOT + col.h - .6;
      f.add('flags', new THREE.CylinderGeometry(.35 + r() * .2, .8, 1.1, 9, 1).rotateZ((r() - .5) * .4).rotateX((r() - .5) * .4).translate(col.x, top + .5, col.z).toNonIndexed(), 0xc8c0d4);
    }
  }
}

/** A colossal broken ring of stone standing half sunk in the sea of cloud past the open south, framing the setting sun: stone
 *  arcs banded with bronze, three breaks with their fallen blocks hanging in the air beside them, the sun's glow through it. */
function sunRing(c: DressContext) {
  const R = 122, T = 10, Z = 272, Y = 8, r = rand(271), parts: THREE.BufferGeometry[] = [];
  const breaks = [1.15, 2.6, 4.9], gap = .16;
  const colour = (g: THREE.BufferGeometry) => {
    const p = g.getAttribute('position') as THREE.BufferAttribute, col = new Float32Array(p.count * 3), cc = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const rr = Math.hypot(p.getX(i), p.getY(i)), z = p.getZ(i);
      cc.set(Math.abs(rr - R) < T * .32 && Math.abs(z) > T * .5 ? 0xe0a040 : (Math.abs(rr - R) > T * .8 ? 0x6a5e64 : 0x8e8088));
      col.set([cc.r, cc.g, cc.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  };
  let a0 = breaks[breaks.length - 1] + gap - Math.PI * 2;
  for (const b of breaks) {
    const arc = b - a0 - gap;
    parts.push(colour(new THREE.TorusGeometry(R, T, 8, Math.round(arc * 30), arc).rotateZ(a0 + gap / 2).toNonIndexed()));
    for (let k = 0; k < 5; k++) {
      const a = b - gap * .2 + (r() - .5) * gap * 1.4, rr = R + (r() - .5) * 26, s = 2.4 + r() * 4;
      const g = new THREE.BoxGeometry(s, s * (.6 + r() * .6), s * (.7 + r() * .5)).rotateX(r() * 3).rotateY(r() * 3).translate(Math.cos(a) * rr, Math.sin(a) * rr, (r() - .5) * 14);
      parts.push(colour(g.toNonIndexed()));
    }
    a0 = b;
  }
  const geometry = mergeGeometries(parts);
  parts.forEach(g => g.dispose());
  geometry.computeVertexNormals();
  const ring = new THREE.Mesh(geometry, heroAir(stageMaterial(c.stage, 'Zenith sun ring', { vertexColors: true, roughness: .8, metalness: .2, emissive: 0x2a1408, emissiveIntensity: .7 }), .25));
  ring.name = 'zenith sun ring';
  ring.position.set(0, Y, Z);
  c.root.add(ring);
  c.ambient.onUpdate(t => { ring.rotation.z = Math.sin(t * .05) * .01; });
  const glow = new Beacons(c.root, 4, c.ambient.time);
  glow.add(0, Y + 6, Z + 20, 170, 0xffa040, -1, .3, 1);
  glow.add(0, Y + 2, Z - 10, 70, 0xffe0a0, -1, .6, 1);
  glow.finish('zenith sun ring glow', .9);
}

/** The walk of flagstones round the kerb out to the spire's edge, a low parapet round it over the void, and the fallen
 *  columns' drums and capitals lying on it with stone chips. */
function walk(f: Forge, columns: { x: number; z: number; h: number; whole: boolean; a: number }[]) {
  f.add('flags', new THREE.RingGeometry(WALK_IN, EDGE, 160, 2).rotateX(-Math.PI / 2).translate(0, -.004, 0).toNonIndexed(), 0xc4bccc);
  const edge: [number, number][] = [];
  for (let i = 0; i <= 96; i++) { const a = i / 96 * Math.PI * 2; edge.push([Math.cos(a) * (EDGE - .3), Math.sin(a) * (EDGE - .3)]); }
  f.wall('ashlar', edge, -.02, .95, .55, 0xb4acbe);
  for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; f.box('ashlar', Math.cos(a) * (EDGE - .3), -.02, Math.sin(a) * (EDGE - .3), 1, 1.25, 1, 0xa8a0b4, { rot: -a }); }
  const r = rand(311);
  for (const col of columns) {
    if (col.whole) continue;
    const out = { x: col.x / RING, z: col.z / RING }, side = { x: -out.z, z: out.x };
    const drums = col.h < 5 ? 2 : 1;
    for (let k = 0; k < drums; k++) {
      const s = (k ? -1 : 1) * (1.6 + r() * 1.2), o = .6 + r() * 1.6, len = 1 + r() * .7;
      const x = col.x + side.x * s + out.x * o, z = col.z + side.z * s + out.z * o;
      if (Math.hypot(x, z) < WALK_IN + .9 || Math.hypot(x, z) > EDGE - 1.2) continue;
      const drum = new THREE.CylinderGeometry(.84, .86, len, 14, 1).rotateZ(Math.PI / 2).rotateY(r() * Math.PI)
        .rotateX((r() - .5) * .08).translate(x, .8 - r() * .06, z);
      f.add('ashlar', drum.toNonIndexed(), 0xb0a8bc);
    }
    if (col.h < 6) {
      const x = col.x + side.x * (r() - .5) * 2 + out.x * 2.2, z = col.z + side.z * (r() - .5) * 2 + out.z * 2.2;
      if (Math.hypot(x, z) < EDGE - 1.4) f.box('ashlar', x, -.05, z, 2.1, .7, 2.1, 0xa8a0b4, { rot: r() * 3, tilt: (r() - .5) * .25, roll: (r() - .5) * .3 });
    }
    for (let k = 0; k < 4; k++) {
      const x = col.x + side.x * (r() - .5) * 5 + out.x * (r() * 3 - .5), z = col.z + side.z * (r() - .5) * 5 + out.z * (r() * 3 - .5);
      const d = Math.hypot(x, z);
      if (d < WALK_IN + .5 || d > EDGE - .8) continue;
      f.rock('ashlar', x, 0, z, .25 + r() * .35, .18 + r() * .2, .25 + r() * .35, 0x9c94a8, 40 + k, { sink: .05 });
    }
  }
}

/** Two rings and the hours inlaid in bronze in the floor's margin, outside the fighters' square, and the Last Sun's mark at
 *  each quarter. */
function inlay(f: Forge) {
  const y = .012;
  for (const [a, b] of [[14.62, 14.84], [12.12, 12.24]] as const) f.add('bronze', new THREE.RingGeometry(a, b, 192, 1).rotateX(-Math.PI / 2).translate(0, y, 0).toNonIndexed(), 0xd8a858);
  for (let i = 0; i < 24; i++) {
    const a = i / 24 * Math.PI * 2, quarter = i % 6 === 0;
    for (const [r0, r1, w] of (quarter ? [[12.4, 12.95, .2], [14.1, 14.42, .2]] : [[13.1, 14.42, .1]]) as [number, number, number][]) {
      const tick = new THREE.PlaneGeometry(w, r1 - r0).rotateX(-Math.PI / 2).translate(0, y, -(r0 + r1) / 2).rotateY(a);
      f.add('bronze', tick.toNonIndexed(), 0xd8a858);
    }
  }
  for (let q = 0; q < 4; q++) {
    const rot = q * Math.PI / 2, at = 13.55;
    const sun = new THREE.CircleGeometry(.42, 24, 0, Math.PI).rotateX(-Math.PI / 2).translate(0, y, -at - .04);
    f.add('bronze', sun.rotateY(rot).toNonIndexed(), 0xe8b860);
    for (const [k, w] of [[0, .9], [1, .66], [2, .42]] as const) {
      const bar = new THREE.PlaneGeometry(w, .08).rotateX(-Math.PI / 2).translate(0, y, -at + .14 + k * .16);
      f.add('bronze', bar.rotateY(rot).toNonIndexed(), 0xe8b860);
    }
  }
}

/** The coliseum's stands, shattered and adrift round the floor in a broken ring: seven blocks of tiers (own/zenith-tiers.glb,
 *  one instanced draw), each turned to face the floor and tilted a little, clear of the guardian to the north and the ring to
 *  the south. */
function tiers(c: DressContext) {
  const r = rand(4432);
  const blocks = [[.05, .55, 36, 4], [.66, .45, 46, 15], [2.45, .5, 46, 16], [3.05, .58, 37, 5], [3.68, .5, 44, -4], [-2.5, .48, 40, 11], [-.6, .42, 50, 22]] as const;
  for (const [mid, span, R0, Y] of blocks) {
    const R = R0 + 7, x = Math.cos(mid) * R, z = -Math.sin(mid) * R;
    c.kit.place('own/zenith-tiers', { x, z, y: Y - 7, width: span * R * 1.25, rot: Math.atan2(-x, -z), tilt: (r() - .5) * .2, roll: (r() - .5) * .2, shadow: false });
  }
  c.ambient.motes({ min: [-70, -10, -70], max: [70, 30, 40], count: 50, velocity: [.05, .12, .03], size: .7, color: 0x8a82a0, color2: 0xb0a8c0, opacity: 1, wobble: .4, seed: 4433 });
}

/** Where the winged guardian kneels, at the far north of the duel's line (inside the 340 m far plane). */
const GUARD = { x: 0, z: -205, y: 6 };
/** The Last Sun's winged guardian, kneeling on its pinnacle out of the sea of cloud: white stone veined with gold, its wings
 *  spread, both hands on the hilt of its snapped sword (own/zenith-guardian.glb), facing the floor. */
function guardian(c: DressContext) {
  const f = new Forge(c, 'zenith guardian');
  f.mat('rock', { map: detail.rock(4441), tile: 14, roughness: .95, air: .35, flat: true });
  const { x: X, z: Z, y: B } = GUARD, n = noise2(4442);
  const pin = new THREE.CylinderGeometry(24, 40, 150, 18, 10).translate(X, B - 40 - 75, Z);
  { const p = pin.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i) - X, y = p.getY(i), z = p.getZ(i) - Z, k = 1 + (n(Math.atan2(z, x) * 3, y * .04, 4) - .5) * .5; p.setXYZ(i, X + x * k, y, Z + z * k); } }
  f.add('rock', pin, 0x5a5270);
  f.done();
  c.kit.place('own/zenith-guardian', { x: X, z: Z, y: B - 48, height: 190, rot: 0, shadow: false });
  const glow = new Beacons(c.root, 4, c.ambient.time);
  glow.add(X, B + 60, Z + 18, 40, 0xffb040, -1, .2, .3);
  glow.add(X, B + 90, Z, 120, 0x8a6ad0, -1, .6, .22);
  glow.finish('zenith guardian glow', 1);
}
/** Five islets of the arena's rock adrift far out, each with the stubs of a colonnade on its flat top: the rock joins the
 *  shards (pushed to `shards`), the stubs come back as one geometry. */
function isletsOf(shards: THREE.BufferGeometry[]) {
  const rnd = seeded(919), stubs: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 5; i++) {
    const a = (i + rnd() * .6) / 5 * Math.PI * 2 + 1.1, r = 120 + rnd() * 60, y = -8 + rnd() * 22, s = 7 + rnd() * 5;
    const x = Math.sin(a) * r, z = Math.cos(a) * r;
    const cone = new THREE.ConeGeometry(s, s * 2.6, 9, 3).rotateX(Math.PI);
    const p = cone.getAttribute('position') as THREE.BufferAttribute;
    for (let k = 0; k < p.count; k++) { const n = .82 + rnd() * .3; p.setXYZ(k, p.getX(k) * n, p.getY(k), p.getZ(k) * n); }
    cone.rotateY(rnd() * 6).translate(x, y - s * 1.3, z);
    cone.deleteAttribute('uv');
    shards.push(cone.toNonIndexed());
    const n = 3 + Math.floor(rnd() * 3), ring = s * .55;
    for (let k = 0; k < n; k++) {
      const b = k / n * Math.PI * 2 + rnd(), h = 1.5 + rnd() * 5;
      stubs.push(new THREE.CylinderGeometry(.6, .66, h, 10).translate(x + Math.cos(b) * ring, y + h / 2, z + Math.sin(b) * ring).toNonIndexed());
      stubs.push(new THREE.BoxGeometry(1.7, .5, 1.7).translate(x + Math.cos(b) * ring, y + .25, z + Math.sin(b) * ring).toNonIndexed());
    }
  }
  const merged = mergeGeometries(stubs);
  stubs.forEach(g => g.dispose());
  merged.computeVertexNormals();
  return merged;
}

/** The Last Sun's banner: deep violet edged in gold, its mark - a sun going down behind three bars of horizon - in gold,
 *  swallowtailed. No lettering. */
function bannerTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 1024;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#2e1a4a'; g.fillRect(0, 0, 256, 1024);
  g.fillStyle = '#e2b450'; g.fillRect(0, 0, 14, 1024); g.fillRect(242, 0, 14, 1024); g.fillRect(0, 0, 256, 22);
  g.beginPath(); g.arc(128, 330, 70, Math.PI, 0); g.fill();
  for (const [y, w] of [[352, 160], [384, 120], [416, 80]] as const) g.fillRect(128 - w / 2, y, w, 16);
  g.save(); g.globalCompositeOperation = 'destination-out';
  g.beginPath(); g.moveTo(0, 1024); g.lineTo(128, 880); g.lineTo(256, 1024); g.closePath(); g.fill();
  g.restore();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8;
  return texture;
}
