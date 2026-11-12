import * as THREE from 'three';
import { STAGE_LANDMARKS } from '../../game/environmentLayout';
import { propColliders, STAGE_PROPS } from '../../game/stageProps';
import type { DressContext } from '../../render/stages/dressing';
import { placeProps } from '../../render/stages/build';
import { Beacons } from '../../render/stages/glow';
import { mountainRidges } from '../../render/stages/hero';
import { ashBanner, charredPosts } from './craterWreck';
import { detail, Forge, noise2 } from './forge';
import { rand } from './remake';

/** The crater's profile: the floor flat to FLAT, rising to the wall's foot at FOOT, the wall to its lip at LIP, the rim. */
const FLAT = 56, FOOT = 118, LIP = 150, WALL_H = 33;
/** places-epic-a: the fallen star in the north rim, where r7's meteor lay: its foot's centre and its height. */
const STAR = { x: 10, y: -22, z: -192, h: 150 };
const n1 = noise2(131), n2 = noise2(132);
const smooth = (t: number) => { const k = Math.min(1, Math.max(0, t)); return k * k * (3 - 2 * k); };
/** The ground's height at a point: floor, slope, wall in strata steps, rim, the ejecta blanket, the hills. */
export function craterHeight(x: number, z: number) {
  const r = Math.hypot(x, z), a = Math.atan2(z, x), wob = (n1(Math.cos(a) * 3 + 5, Math.sin(a) * 3 + 5) - .5) * 10;
  const rr = r + wob * (r > FLAT + 10 ? 1 : 0);
  if (rr < FLAT) return 0;
  if (rr < FOOT) return 5 * smooth((rr - FLAT) / (FOOT - FLAT));
  if (rr < LIP) {
    const t = (rr - FOOT) / (LIP - FOOT), steps = Math.floor(t * 6) / 6, within = t * 6 - Math.floor(t * 6);
    return 5 + WALL_H * (steps + smooth(within * 1.6) / 6) + (n2(x * .05, z * .05) - .5) * 2;
  }
  const rim = 5 + WALL_H + 4 * Math.exp(-(((rr - LIP - 10) / 12) ** 2));
  const blanket = Math.max(0, rr - LIP - 10) * .12;
  return rim - Math.min(blanket, 14) + (n2(x * .012, z * .012) - .5) * Math.min(30, Math.max(0, rr - 200) * .25);
}

export async function dress(c: DressContext) {
  const { kit, ambient } = c;
  const props = (STAGE_PROPS['starfall-crater'] ?? []).filter(p => p.piece !== 'none');
  const [, , starGlow] = await Promise.all([c.sky({ url: '/assets/environment/br/sky-starfall-twilight.webp', rotation: 0, drift: .00005 }),
    kit.load([...new Set(props.map(p => p.piece)), 'own/star-meteor', 'own/star-crystals', 'own/star-crystal', ...RUINS]),
    c.texture('/assets/environment/own/star-crystal-glow.webp')]);
  placeProps(kit, props);
  generated(c);
  ruins(c);
  // places-epic-a: the fallen star itself, where r7's black meteor lay in the north rim.
  kit.place('own/star-crystal', { x: STAR.x, y: STAR.y, z: STAR.z, height: STAR.h, rot: .6, shadow: false });
  kit.shadows.add('br/kenney-town-wall-wood-broken').add('br/kenney-town-cart-high').add('br/meshy-rubble');
  kit.flush(c.stage);
  starGlow.flipY = false; starGlow.colorSpace = THREE.SRGBColorSpace; starGlow.needsUpdate = true;
  for (const m of kit.pieceMaterials('own/star-crystal') as THREE.MeshStandardMaterial[]) {
    m.emissiveMap = starGlow; m.emissive.set(0x70ffd0); m.emissiveIntensity = 2.4; m.needsUpdate = true;
    ambient.onUpdate(t => { m.emissiveIntensity = 2.4 * (.85 + .15 * Math.sin(t * .9) * Math.sin(t * .37 + 2)); });
  }
  charredPosts(c);

  const f = new Forge(c, 'starfall');
  f.mat('earth', { map: detail.gravel(133), tile: 9, roughness: 1, wear: { key: 'starfall-floor', scale: 1, light: [.86, 1.08], patch: 0x9a8c78, patchAmount: .25 } });
  f.mat('wall', { map: detail.rock(134), tile: 12, flat: true, roughness: .95 });
  f.mat('land', { map: detail.gravel(135), tile: 30, roughness: 1, air: .55 });
  f.mat('star', { map: detail.rock(136), tile: 4, flat: true, roughness: .35, metalness: .25, shadow: true });
  f.mat('glass', { flat: true, roughness: .25, emissive: 0x0a3a24, emissiveIntensity: 1, air: .2 });
  f.mat('lava', { basic: true });
  f.mat('char', { map: detail.rock(138), tile: 3, roughness: .95, air: .4 });
  floor(f);
  wall(f);
  cover(f);
  cracks(f);
  crystals(f);
  flattened(f);
  f.done();
  hangingShards(c);
  c.root.add(mountainRidges({ radius: 520, count: 22, seed: 101, base: 10, height: [80, 150], far: 0x8a9cba, near: 0x5a6a5a, crest: 0xdce4f2 }));
  banners(c);

  // places-epic-a: the star's green light on the rim and the air over it; smoke columns rising off the rim all round.
  const glow = new Beacons(c.root, 4, ambient.time);
  glow.add(STAR.x, STAR.y + STAR.h * .45, STAR.z + STAR.h * .3, 160, 0x40e0a0, -1, .4, 1);
  glow.add(STAR.x, STAR.y + STAR.h * .2, STAR.z + STAR.h * .45, 90, 0x80ffd0, -1, .7, 1);
  glow.finish('starfall star glow', 1.2);
  const r = rand(55), smoke: { x: number; y: number; z: number; size: number }[] = [];
  for (const [a, d] of [[-1.3, 175], [-.4, 190], [.6, 185], [1.5, 200], [2.4, 180], [3.3, 195], [4.4, 185]] as const) {
    const x = Math.sin(a) * d, z = -Math.cos(a) * d;
    for (let k = 0; k < 9; k++) smoke.push({ x: x + Math.sin(k) * 6 + k * 2, y: craterHeight(x, z) + 6 + k * 13, z: z + Math.cos(k) * 6, size: 16 + k * 5 });
  }
  ambient.puffs({ spots: smoke, color: 0x4a4660, shade: 0x1c1a2a, opacity: .62, life: 14, rise: 70, drift: [3, 0, 1], grow: 2.4, seed: 56, order: 0 });
  ambient.motes({ min: [STAR.x - 70, 0, STAR.z - 40], max: [STAR.x + 70, 110, STAR.z + 70], count: 260, velocity: [.2, 1.4, .3], size: .35, color: 0x80ffd0, color2: 0xc8fff0, opacity: .9, additive: true, twinkle: .7, wobble: 1.4, seed: 57 });
  ambient.motes({ min: [-50, 0, -50], max: [50, 12, 50], count: 120, velocity: [.2, .3, .1], size: .05, color: 0x9af0c8, color2: 0xc8f0ff, opacity: .7, additive: true, twinkle: .7, wobble: 1, seed: 58 });
}

/** A field over rings: `radii` out from the middle, `around` steps round, its height the crater's. */
function rings(radii: readonly number[], around: number) {
  const pos: number[] = [];
  const at = (r: number, i: number) => { const a = i / around * Math.PI * 2, x = Math.cos(a) * r, z = Math.sin(a) * r; return [x, craterHeight(x, z), z]; };
  for (let j = 0; j + 1 < radii.length; j++) for (let i = 0; i < around; i++) {
    const a = at(radii[j], i), b = at(radii[j], i + 1), c = at(radii[j + 1], i + 1), d = at(radii[j + 1], i);
    pos.push(...a, ...b, ...c, ...a, ...c, ...d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return g;
}

/** The floor, scorched, the impact's rays lighter streaks out from the middle; the slope to the wall's foot. */
function floor(f: Forge) {
  // One tint for the floor and the slope, so no seam shows where they meet: the rays fading out up the slope, fused glass at
  // the wall's foot.
  const tint = (x: number, y: number, z: number) => {
    const a = Math.atan2(z, x), r = Math.hypot(x, z);
    // places-gen: the scorched floor a lighter ash (it read black under the night's light), the rays paler, the glass greener.
    // polish3: pale ash and sand in the afternoon (Impact's crater floor is a bright ochre earth), the rays paler still, a
    // scorch toward the middle where the star struck.
    if (r > FOOT - 6) return 0x4a8a6a;
    const ray = Math.pow(Math.abs(Math.sin(a * 9 + Math.sin(a * 3) * 1.4)), 14) * Math.min(1, r / 30) * Math.max(0, 1 - Math.max(0, r - FLAT) / 30);
    const scorch = Math.max(0, 1 - r / 22) * .35;
    // places-epic-a: scorched dark ash at twilight, the impact's rays a paler ash, the scorch black toward the middle.
    return new THREE.Color(0x6a6670).lerp(new THREE.Color(0x76727a), Math.min(1, y / 5)).lerp(new THREE.Color(0x9a96a2), ray * .9 + n2(x * .1, z * .1) * .2)
      .lerp(new THREE.Color(0x3a3640), scorch).getHex();
  };
  f.add('earth', new THREE.CircleGeometry(FLAT, 72).rotateX(-Math.PI / 2), tint);
  f.add('earth', rings([FLAT, 62, 70, 80, 92, 104, 112, FOOT], 72), tint);
}

/** The wall in banded strata to its lip, the raised rim of ejecta, the blanket and the hills outside it. */
function wall(f: Forge) {
  const radii: number[] = [];
  for (let r = FOOT; r <= LIP + 30; r += 2.5) radii.push(r);
  f.add('wall', rings(radii, 160), (x, y, z) => {
    // polish3: the strata sandstone and ochre in the afternoon (they were plum and soot under the dusk), glass at the foot.
    if (y < 7) return 0x3e7a5e;
    const band = Math.floor((y + n1(x * .03, z * .03) * 3) / 2.6) % 3, r = Math.hypot(x, z);
    // places-epic-a: dark strata of scorched rock at twilight, plum, slate and soot.
    if (r > LIP + 4) return 0x4a4652;
    return [0x5a4e5a, 0x6e6270, 0x443c48][band];
  });
  const outer: number[] = [];
  for (let r = LIP + 30; r <= 560; r += r < 260 ? 10 : 30) outer.push(r);
  f.add('land', rings(outer, 96), (_x, y) => y > 34 ? 0x3e4240 : 0x343a36); // places-epic-a: the burnt hills
}

/** The cover in its boxes: the star's broken stone in the heaps' and plates' boxes, black and glassy, crystals of green
 *  glass standing out of it. */
function cover(f: Forge) {
  const heaps = STAGE_LANDMARKS['starfall-crater'].slice(0, STAGE_LANDMARKS['starfall-crater'].length - propColliders('starfall-crater').length);
  const r = rand(138);
  heaps.forEach((b, i) => {
    const top = b.halfY * 2;
    f.rock('star', b.x, -.2, b.z, b.halfX * .95, top / 1.3, b.halfZ * .95, i % 2 ? 0x2a2630 : 0x1e1c24, 140 + i, { rough: .4, detail: 1, sink: .15 });
    for (let k = 0; k < 3; k++) {
      const h = .5 + r() * .6, g = new THREE.ConeGeometry(.14 + r() * .14, h, 5).translate(0, h / 2, 0).rotateX((r() - .5) * .5).rotateZ((r() - .5) * .5)
        .translate(b.x + (r() - .5) * b.halfX * .9, top * .55, b.z + (r() - .5) * b.halfZ * .9);
      f.add('glass', g, (_x, y) => y > top * .55 + h * .5 ? 0xb8ffd8 : 0x3aa878);
    }
  });
  // Chips of the star thrown out over the floor past the fight and up the slope.
  for (let i = 0; i < 70; i++) {
    const a = r() * Math.PI * 2, d = 44 + r() * 70, x = Math.cos(a) * d, z = Math.sin(a) * d, s = .5 + r() * 1.6;
    if (Math.max(Math.abs(x), Math.abs(z)) < 40 + s) continue;
    f.rock('star', x, craterHeight(x, z) - .2, z, s, s * .6, s * .9, 0x1e1c24, 200 + i, { rough: .4, detail: 0, sink: .2 });
  }
}


/** The impact's cracks in the floor: jagged lines of fire running out from near the middle to the wall's foot, a glow
 *  flat on the ground (no height: the fight walks over them). */
function cracks(f: Forge) {
  const r = rand(141);
  for (let k = 0; k < 11; k++) {
    let a = k / 11 * Math.PI * 2 + r() * .3, d = 14 + r() * 8, x = Math.cos(a) * d, z = Math.sin(a) * d;
    const steps = 9 + Math.floor(r() * 6);
    for (let i = 0; i < steps; i++) {
      a += (r() - .5) * .35;
      const len = 5 + r() * 5, nx = x + Math.cos(a) * len, nz = z + Math.sin(a) * len, w = .35 * (1 - i / steps) + .08;
      const px = -Math.sin(a) * w * 1.3, pz = Math.cos(a) * w * 1.3, y0 = craterHeight(x, z) + .03, y1 = craterHeight(nx, nz) + .03;
      const g = new THREE.BufferGeometry();
      // (Wound to face up.)
      g.setAttribute('position', new THREE.Float32BufferAttribute([x - px, y0, z - pz, nx + px * .7, y1, nz + pz * .7, nx - px * .7, y1, nz - pz * .7, x - px, y0, z - pz, x + px, y0, z + pz, nx + px * .7, y1, nz + pz * .7], 3));
      f.add('lava', g, i < 3 ? 0xd8742c : 0x9a3c16);
      x = nx; z = nz;
      if (Math.hypot(x, z) > FOOT - 4) break;
    }
  }
}

/** Crystals of green glass grown out of the crater's walls where the heat fused them, clustered, leaning outward. */
function crystals(f: Forge) {
  const r = rand(77);
  for (let k = 0; k < 24; k++) {
    const a = r() * Math.PI * 2, d = k < 12 ? 46 + r() * 14 : FOOT - 6 + r() * 34, cx = Math.cos(a) * d, cz = Math.sin(a) * d, count = 3 + Math.floor(r() * 5);
    if (Math.max(Math.abs(cx), Math.abs(cz)) < 44) continue;
    if (cz < -110 && Math.abs(cx) < 80) continue;
    const base = craterHeight(cx, cz) - 1;
    for (let i = 0; i < count; i++) {
      const h = (d < 70 ? 2 : 4) + r() * (d < 70 ? 6 : 14), w = .6 + r() * 1.4;
      const g = new THREE.ConeGeometry(w, h, 5, 1).translate(0, h / 2, 0).rotateX((r() - .5) * .6).rotateZ((r() - .5) * .6).rotateY(r() * 6)
        .translate(cx + (r() - .5) * 6, base, cz + (r() - .5) * 6);
      f.add('glass', g, (_x, y) => y > base + h * .6 ? 0xb8ffd8 : 0x3aa878);
    }
  }
}

/** places-gen: the generated pieces (Tripo; own/star-*), placed with the kit (dress() flushes it): five great shards of the
 *  star on the floor's rise past the fight (black glass, veins of fire, green crystal), crystal clusters round the flat. */
function generated(c: DressContext) {
  const { kit } = c, r = rand(141);
  for (const [a, d, h] of [[.35, 58, 18], [1.6, 54, 13], [2.75, 60, 22], [4.1, 55, 14], [5.3, 59, 17]] as const) {
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    kit.place('own/star-meteor', { x, y: craterHeight(x, z) - h * .18, z, height: h, rot: a * 2.3, tilt: (r() - .5) * .3 });
  }
  for (let k = 0; k < 12; k++) {
    const a = k / 12 * Math.PI * 2 + r() * .3, d = 46 + r() * 12, x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (Math.max(Math.abs(x), Math.abs(z)) < 41) continue;
    kit.place('own/star-crystals', { x, y: craterHeight(x, z) - .4, z, height: 2.6 + r() * 3, rot: r() * 6.3 });
  }
}

const RUINS = ['own/ash-gatehouse', 'own/cinder-nave', 'own/cinder-columns', 'own/cinder-markers', 'own/proving-kneeler', 'own/ash-torchbearer', 'own/cinder-spire'] as const;
function ruins(c: DressContext) {
  const { kit } = c, at = (a: number, d: number) => [Math.cos(a) * d, Math.sin(a) * d] as const;
  const put = (piece: (typeof RUINS)[number], a: number, d: number, height: number, sink: number, more: { rot?: number; tilt?: number; roll?: number } = {}) => {
    const [x, z] = at(a, d);
    if (Math.max(Math.abs(x), Math.abs(z)) < 44) return;
    kit.place(piece, { x, y: craterHeight(x, z) - height * sink, z, height, rot: more.rot ?? a + Math.PI, tilt: more.tilt, roll: more.roll });
  };
  // The gatehouse, twice: one thrown down at the wall's foot, leaning; one half sunk on the far slope.
  put('own/ash-gatehouse', 1.05, 78, 16, .18, { roll: .35, tilt: .12 });
  put('own/ash-gatehouse', 3.95, 92, 18, .2, { tilt: -.22 });
  // The shrine's nave, crushed on the rise behind the fight's south-west.
  put('own/cinder-nave', 4.85, 66, 13, .15, { roll: .08 });
  // Its charred arches and markers round the floor, just past the fight.
  put('own/cinder-columns', 2.2, 52, 10, .1);
  put('own/cinder-columns', 5.6, 54, 11, .1, { roll: -.1 });
  put('own/cinder-columns', .55, 62, 9, .12, { roll: .14 });
  for (const [a, d, h] of [[.95, 50, 4.4], [1.9, 49, 3.8], [3.3, 51, 4.8], [4.3, 50, 4], [5.9, 49, 4.2], [2.6, 58, 3.6]] as const) put('own/cinder-markers', a, d, h, .1, { rot: a * 3.1 });
  // The spire fallen across the slope; a guardian toppled on its side, one still standing with its fire.
  put('own/cinder-spire', 2.85, 70, 11, .2, { rot: 1.1 });
  put('own/proving-kneeler', .1, 52, 6.5, .15, { roll: 1.35, rot: 2.2 });
  put('own/ash-torchbearer', 4.3, 60, 12, .04);
  kit.shadows.add('own/ash-gatehouse').add('own/cinder-columns').add('own/ash-torchbearer').add('own/cinder-nave');
}

/** Ashwood's banners on poles snapped and charred, round the floor past the fight. */
function banners(c: DressContext) {
  const banner = ashBanner();
  for (const [x, z] of [[-44, 12], [41, -20], [12, 45], [-26, -40], [40, 30]] as const) c.ambient.cloth(banner, { x, y: 4.2, z, width: 1.3, height: 1.9, rot: Math.atan2(-x, -z), wind: .5, lit: .35 });
  const f = new Forge(c, 'starfall poles');
  f.mat('timber', { map: detail.planks(139, 30, true), tile: 2, roughness: .9 });
  for (const [x, z] of [[-44, 12], [41, -20], [12, 45], [-26, -40], [40, 30]] as const) {
    f.pipe('timber', [x, 0, z], [x + .2, 4.6, z], .1, 0x1e1a18, { sides: 5 });
    f.box('timber', x, 4.2, z, 1.5, .1, .1, 0x2a2420, { rot: Math.atan2(-x, -z) });
  }
  f.done();
}

/** places-epic-a: the forest on the rim flattened by the blast: charred trunks lying on the outer slopes all round, each
 *  pointing away from the star, a few stumps still standing, their tops snapped. */
function flattened(f: Forge) {
  const r = rand(151);
  for (let i = 0; i < 340; i++) {
    // On the rim's crest and its inner lip, where they stand against the sky from the fight, and down the outer slope.
    const a = r() * Math.PI * 2, d = i < 220 ? LIP - 10 + r() * 22 : LIP + 12 + r() * 90, x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (Math.hypot(x - STAR.x, z - STAR.z) < STAR.h * .6) continue;
    const y = craterHeight(x, z), away = Math.atan2(x - STAR.x, z - STAR.z), len = 7 + r() * 10, rad = .3 + r() * .3;
    if (r() < .3) { // a trunk still standing, snapped, leaning away from the star
      const h = 5 + r() * 12, g = new THREE.CylinderGeometry(rad * .5, rad * 1.1, h, 6).translate(0, h / 2, 0).rotateX(.25 + r() * .35).rotateY(away).translate(x, y - .5, z);
      f.add('char', g, 0x1c181a); continue;
    }
    const g = new THREE.CylinderGeometry(rad * .6, rad, len, 6).translate(0, len / 2, 0).rotateX(Math.PI / 2 - .05).rotateY(away).translate(x, y + rad * .6, z);
    f.add('char', g, (_x, yy) => yy > y + rad ? 0x2a2426 : 0x1a1618);
  }
}

/** places-epic-a: shards of the star hanging in the air over the crater past the fight, turning slowly, glowing (one
 *  instanced draw, its own glass). */
function hangingShards(c: DressContext) {
  const N = 40, r = rand(161);
  const material = new THREE.MeshStandardMaterial({ name: 'star shards', color: 0x2a7a5a, emissive: 0x50f0b0, emissiveIntensity: 1.1, roughness: .2, metalness: .1, flatShading: true });
  const mesh = new THREE.InstancedMesh(new THREE.OctahedronGeometry(1, 0).scale(.55, 1.6, .55), material, N);
  mesh.name = 'star shards'; mesh.frustumCulled = false;
  const seeds = Array.from({ length: N }, (_, i) => {
    const near = i < 22, a = r() * Math.PI * 2, d = near ? STAR.h * .45 + r() * 50 : 60 + r() * 60;
    return { x: near ? STAR.x + Math.cos(a) * d : Math.cos(a) * d, z: near ? STAR.z + Math.abs(Math.sin(a)) * d * .8 : Math.sin(a) * d, y: near ? 20 + r() * 100 : 18 + r() * 40,
      size: near ? 2.5 + r() * 5 : 1 + r() * 2.2, spin: (r() - .5) * .5, bob: r() * 6.28 };
  });
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3();
  const place = (t: number) => {
    for (let i = 0; i < N; i++) {
      const k = seeds[i];
      p.set(k.x, k.y + Math.sin(t * .4 + k.bob) * 1.6, k.z);
      e.set(Math.sin(t * .2 + k.bob) * .4, t * k.spin + k.bob, Math.cos(t * .17 + k.bob) * .4);
      mesh.setMatrixAt(i, m.compose(p, q.setFromEuler(e), sc.setScalar(k.size)));
    }
    mesh.instanceMatrix.needsUpdate = true;
  };
  place(0);
  c.ambient.onUpdate(place);
  c.root.add(mesh);
}
