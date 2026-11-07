import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { DressContext } from '../../render/stages/dressing';
import { stageMaterial } from '../../render/stages/build';
import { Beacons, LightPools } from '../../render/stages/glow';
import { drawn, rand, tinted, type Recolor } from './remake';
import { Forge, detail } from './forge';
import { STANDING, CHEERING, inlay, people, ringSpots } from './richness';
import { heroAir } from '../../render/stages/hero';
import { crater } from './battleScars';

/** The Scrap Pit: a bounty ring of riveted steel deck plate at the bottom of a pit dug into a mountain of scrap - terraced
 *  walls of crushed cars, containers and girders all round, broken open at the far end where a dead war-machine kneels -
 *  under floodlight towers throwing hard white beams through the smog, a crane's arm over the ring, the crowd on the
 *  terraces. Nothing in the play square but decals. */
export async function dress(c: DressContext) {
  c.kit.grade = (material, piece) => {
    if (piece !== 'own/scrap-wall' && piece !== 'own/scrap-floodlight') return;
    heroAir(material, .12, .25);
    material.color.multiply(new THREE.Color(0xc8c8cc));
  };
  await Promise.all([c.sky({ rotation: 0, drift: .0002 }), c.kit.load(['own/scrap-wall', 'own/scrap-floodlight'])]);
  pit(c);
  walls(c);
  floods(c);
  c.root.add(scrap(c));
  yardAtWork(c);
  crowd(c);
  await deadMachine(c);
}

/** The pit's floor under the ring's top (the fight's floor), and the ring's half-width. */
const PIT_FLOOR = -1.5, RING = 14;
/** The ring - a block of riveted deck plate 1.5 m over the pit's floor, its rim hazard-striped, two steps down each side -
 *  and the floor round it, packed grit and oil out to the walls. */
function pit(c: DressContext) {
  const f = new Forge(c, 'scrap pit ring');
  f.mat('plate', { map: drawn(512, 512, (g, w, h) => {
    const img = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const [r, gg, b] = deckPlate(0, 0, 0, x, y); img.data.set([r, gg, b, 255], (y * w + x) * 4); }
    g.putImageData(img, 0, 0);
  }, { repeat: true }), tile: 12, roughness: .5, metalness: .35 });
  f.mat('hazard', { map: drawn(128, 128, (g, w, h) => { const img = g.createImageData(w, h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const [r, gg, b] = hazard(0, 0, 0, x, y); img.data.set([r, gg, b, 255], (y * w + x) * 4); } g.putImageData(img, 0, 0); }, { repeat: true }), tile: 1.6, roughness: .6 });
  f.mat('grit', { map: detail.gravel(7101), tile: 4, roughness: 1, wear: { key: 'scrap-pit', scale: 1.4, light: [.8, 1.05], patch: 0x1a1816, patchAmount: .45 } });
  f.mat('steel', { map: detail.plate(7102), tile: 3, roughness: .6, metalness: .3 });
  f.box('plate', 0, PIT_FLOOR, 0, RING * 2, -PIT_FLOOR, RING * 2, 0xffffff);
  for (const [w, d, x, z] of [[RING * 2 + 1.6, .8, 0, RING + .4], [RING * 2 + 1.6, .8, 0, -RING - .4], [.8, RING * 2, RING + .4, 0], [.8, RING * 2, -RING - .4, 0]] as const)
    f.box('hazard', x, PIT_FLOOR, z, w, -PIT_FLOOR + .06, d, 0xffffff);
  for (let k = 0; k < 2; k++) {
    const o = RING + .8 + k * .9 + .45, h = -PIT_FLOOR * (2 - k) / 3;
    for (const [w, d, x, z] of [[o * 2, .9, 0, o], [o * 2, .9, 0, -o], [.9, o * 2, o, 0], [.9, o * 2, -o, 0]] as const) f.box('steel', x, PIT_FLOOR, z, w, h, d, 0x6a6c72);
  }
  f.add('grit', new THREE.CircleGeometry(40, 64).rotateX(-Math.PI / 2).translate(0, PIT_FLOOR - .01, 0).toNonIndexed(), 0x5a5652);
  f.done();
}

/** The pit's walls: the scrap mountain cut back in four terraces round the floor, each face stacked with crushed car bodies,
 *  rusted containers and girders, their tops heaped scrap; open at the far end (-z). One draw a material. */
function walls(c: DressContext) {
  const f = new Forge(c, 'scrap pit walls');
  f.mat('scrap', { map: detail.rock(7110), tile: 5, roughness: .9, flat: true, air: .15 });
  f.mat('box', { map: detail.corrugated(7111), tile: 2.4, roughness: .7, metalness: .25, air: .12 });
  f.mat('car', { map: detail.plate(7112), tile: 2, roughness: .6, metalness: .3, air: .12 });
  f.mat('girder', { roughness: .6, metalness: .45 });
  const r = rand(7113), rusts = [0x7a4a36, 0x5e5650, 0x4a525c, 0x7a6a4a, 0x5a3a30, 0x6e6e6a, 0x445248, 0x845a3e], heaps = [0x3a3430, 0x4a3e36, 0x34363a, 0x40382e, 0x2e2c2a];
  const open = (x: number, z: number) => Math.abs(x) < 17 + (-z - 20) * .2 && z < -18;
  for (let t = 0; t < 4; t++) {
    const R = 24 + t * 9, top = (t + 1) * 8 + PIT_FLOOR, y0 = t * 8 + PIT_FLOOR;
    const n = 72;
    for (let k = 0; k < n; k++) {
      const a = k / n * Math.PI * 2, x = Math.cos(a) * (R + 4), z = Math.sin(a) * (R + 4);
      if (open(x, z)) continue;
      f.rock('scrap', x, y0 - 1, z, 4 + r() * 1.5, top - y0 + 1 + r() * 1.5, 4 + r() * 1.5, heaps[k % heaps.length], 7120 + t * 100 + k);
    }
    for (let k = 0; t > 0 && k < 2 * Math.PI * R / 4.6; k++) {
      const a = (k + r() * .4) / (2 * Math.PI * R / 4.6) * Math.PI * 2, x = Math.cos(a) * R, z = Math.sin(a) * R;
      if (open(x, z)) continue;
      const rot = -a + Math.PI / 2;
      if (r() < .3) {
        f.box('box', x, y0, z, 6 + r() * 6, 2.6, 2.5, rusts[Math.floor(r() * rusts.length)], { rot, roll: (r() - .5) * .1 });
        if (r() < .5) f.box('box', x + (r() - .5), y0 + 2.6, z, 6 + r() * 4, 2.6, 2.5, rusts[Math.floor(r() * rusts.length)], { rot: rot + (r() - .5) * .3 });
      } else {
        const hgt = 3 + Math.floor(r() * 3);
        for (let j = 0; j < hgt; j++) f.box('car', x + (r() - .5) * .4, y0 + j * 1.05, z + (r() - .5) * .4, 4.2 + r() * .5, 1, 1.9, rusts[Math.floor(r() * rusts.length)], { rot: rot + (r() - .5) * .25 });
      }
    }
    for (let k = 0; k < 10; k++) {
      const a = r() * Math.PI * 2, x = Math.cos(a) * (R + 2), z = Math.sin(a) * (R + 2);
      if (open(x, z)) continue;
      f.beam('girder', [x, top - 1, z], [x * (1 - .12 - r() * .1), top + 3 + r() * 5, z * (1 - .12 - r() * .1)], .35, 0x5a3a2a);
    }
  }
  f.done();
}

/** Floodlight towers on the top terrace (own/scrap-floodlight.glb) with banks of lamps throwing hard white beams down on the
 *  ring, their pools on the plate; the scrap wall round the lowest terrace (own/scrap-wall.glb); the crane on the third
 *  terrace with its arm swung out over the ring. Floodlights on masts: nothing hung. */
function floods(c: DressContext) {
  const f = new Forge(c, 'scrap pit floods');
  f.mat('steel', { roughness: .55, metalness: .5 });
  f.mat('lamp', { basic: true });
  const glow = new Beacons(c.root, 64, c.ambient.time), pools = new LightPools(c.root, 6);
  const beams: THREE.BufferGeometry[] = [];
  for (const [a, R] of [[.6, 52], [2.55, 52], [3.75, 54], [5.6, 52], [-1.0, 60], [-2.15, 60]] as const) {
    const x = Math.cos(a) * R, z = Math.sin(a) * R, base = 30 + PIT_FLOOR, h = 26, topY = base + h;
    c.kit.place('own/scrap-floodlight', { x, z, y: base, height: h + 3, rot: Math.atan2(-x, -z), shadow: false });
    const face = Math.atan2(-x, -z);
    f.box('steel', x, topY, z, 4.6, 3, .5, 0x2a2a2e, { rot: face });
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
      const ox = (i - 1.5) * 1.05, oy = .5 + j * .95, cx = x + Math.cos(face) * ox, cz = z - Math.sin(face) * ox, nx = Math.sin(face) * .3, nz = Math.cos(face) * .3;
      f.box('lamp', cx + nx, topY + oy - .35, cz + nz, .8, .7, .08, 0xf4f8ff, { rot: face });
      glow.add(cx + nx * 2, topY + oy, cz + nz * 2, 2.2, 0xe8f0ff, -1, (i + j) * .13, .15);
    }
    const from = new THREE.Vector3(x, topY + 1.4, z), to = new THREE.Vector3(x * .1, 0, z * .1), len = from.distanceTo(to);
    const cone = new THREE.ConeGeometry(4, len, 18, 1, true).translate(0, -len / 2, 0);
    cone.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), to.clone().sub(from).normalize())).translate(from.x, from.y, from.z);
    beams.push(cone);
    pools.add(x * .1, z * .1, 9, new THREE.Color(.22, .24, .27), .04);
  }
  f.done();
  const beam = new THREE.Mesh(mergeGeometries(beams), new THREE.MeshBasicMaterial({ color: 0xe8f0ff, transparent: true, opacity: .018, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  beams.forEach(g => g.dispose());
  beam.name = 'scrap pit flood beams'; beam.renderOrder = 4;
  c.root.add(beam);
  glow.finish('scrap pit flood lamps', 2.2);
  for (let k = 0; k < 12; k++) {
    const a = (k + .5) / 12 * Math.PI * 2, x = Math.cos(a) * 25.5, z = Math.sin(a) * 25.5;
    if (Math.abs(x) < 20 && z < -15) continue;
    c.kit.place('own/scrap-wall', { x, z, y: PIT_FLOOR - .3, width: 14.5, rot: Math.atan2(-x, -z), shadow: false });
  }
  pools.finish('scrap pit flood pools');
  const g = new Forge(c, 'scrap pit crane');
  g.mat('steel', { roughness: .55, metalness: .45 });
  const [bx, bz] = [-30, 30], baseY = 3 * 8 + PIT_FLOOR, mast = 30;
  for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) g.pipe('steel', [bx + dx * 1.3, baseY, bz + dz * 1.3], [bx + dx * 1.3, baseY + mast, bz + dz * 1.3], .14, 0x8a6a2a);
  for (let y = baseY + 2; y < baseY + mast; y += 2.6) g.add('steel', new THREE.TorusGeometry(1.84, .07, 3, 4).rotateX(Math.PI / 2).rotateY(Math.PI / 4).translate(bx, y, bz), 0x8a6a2a);
  const jy = baseY + mast + 1;
  g.beam('steel', [bx + 8, jy, bz - 8], [0, jy - 1, 0], .9, 0x9a7a30);
  g.beam('steel', [bx, jy, bz], [bx - 9, jy, bz + 9], 1, 0x9a7a30);
  g.box('steel', bx - 9, jy - 2, bz + 9, 4, 3, 4, 0x3a3a3e);
  g.pipe('steel', [bx, jy + 7, bz], [0, jy - .5, 0], .05, 0x2a2622);
  g.pipe('steel', [bx, jy + 7, bz], [bx - 9, jy, bz + 9], .05, 0x2a2622);
  g.cyl('steel', bx, jy, bz, .6, 1.2, 7, 0x9a7a30, { sides: 6 });
  g.pipe('steel', [0, jy - 1, 0], [0, 23.5, 0], .04, 0x2a2622);
  g.done();
}

/** The bounty's crowd on the terraces' lips, standing and cheering, none at the open far end. */
function crowd(c: DressContext) {
  const palette = { robes: ['#3a3e46', '#5a4a3a', '#2a3440', '#7a5a3a', '#4a3a34', '#3a4a44', '#8a6a40', '#2e2a2a'], wraps: ['#c86a2a', '#e6b41e', '#2a2a30', '#5a6a7a'] };
  const spots = [0, 1, 2].flatMap(t => ringSpots({ r0: 24 + t * 9 + 1.2, r1: 24 + t * 9 + 3.2, count: 40 + t * 10, y: (t + 1) * 8 + PIT_FLOOR - .2, height: 1.75,
    arc: (_a, x, z) => !(Math.abs(x) < 22 && z < -15), poses: [STANDING, CHEERING, CHEERING], seed: 7130 + t }));
  people(c, spots, palette, { name: 'scrap pit crowd', shade: .7, sway: .06 });
}

/** The dead war-machine slumped on its knees in the pit's open far end (own/pit-warmachine.glb), its eyes still burning,
 *  sparks raining from its torn chest, smoke off its back; searchlights sweeping the smog; the ring's plate buckled into a
 *  scorched crater (a flat decal). */
async function deadMachine(c: DressContext) {
  const { kit, ambient } = c;
  const prev = kit.grade;
  kit.grade = (material, piece) => {
    if (piece !== 'own/pit-warmachine') return prev?.(material, piece);
    heroAir(material, .1, .3);
    material.color.multiply(new THREE.Color(0xc4beb8));
    if (material.map) { material.emissive.setRGB(.8, .86, 1); material.emissiveMap = material.map; material.emissiveIntensity = .22; material.needsUpdate = true; }
  };
  await kit.load(['own/pit-warmachine']);
  kit.place('own/pit-warmachine', { x: MACHINE.x, z: MACHINE.z, y: MACHINE.y, height: MACHINE.h, rot: 0 });
  kit.flush(c.stage);
  kit.grade = prev;
  const k = MACHINE.h / .729, at = (x: number, y: number, z: number) => [MACHINE.x + x * k, MACHINE.y + y * k, MACHINE.z + z * k] as const;
  const eyes = new Beacons(c.root, 8, ambient.time), halo = new Beacons(c.root, 2, ambient.time);
  for (const ex of [.014, .08]) { const [x, y, z] = at(ex, .556, .12); eyes.add(x, y, z, .9, 0xff3a1c, .23, .1, 1); eyes.add(x, y, z, 2.2, 0xff2010, .23, .1, 1); }
  for (const [sx, ph] of [[-1, 0], [1, .5]] as const) { const [x, y, z] = at(sx * .36, .68, .02); eyes.add(x, y, z, 1.4, 0xff3020, 1.1, ph, .45); }
  eyes.finish('scrap pit war-machine eyes', 3);
  { const [x, y, z] = at(.047, .556, .1); halo.add(x, y, z, 7, 0xff1a10, .23, .1, 1); }
  halo.finish('scrap pit war-machine eye glow', .7);
  const pools = new LightPools(c.root, 2);
  pools.add(MACHINE.x, MACHINE.z + 14, 12, new THREE.Color(.5, .06, .03), .03);
  pools.finish('scrap pit war-machine glow');
  { const [x, y, z] = at(.03, .38, .2); ambient.motes({ min: [x - 5, -1.5, z - 2], max: [x + 5, y, z + 3], count: 160, velocity: [.2, -4.2, .4], size: .07, color: 0xfff0c0, color2: 0xff7a30, opacity: 1, additive: true, twinkle: 1, wobble: .5, seed: 2041 }); }
  ambient.puffs({ spots: [[-8, .62, -.12], [6, .66, -.2], [0, .6, -.3]].map(([x, y, z]) => { const [px, py, pz] = at(x / k, y, z); return { x: px, y: py, z: pz, size: 5 }; }),
    color: 0x5a5c62, shade: 0x1c1e22, opacity: .35, life: 9, rise: 16, grow: 2.6, drift: [.6, 0, .2], seed: 2042, order: 2 });
  searchlights(c);
  crater(c, { size: 20, cx: 2, cz: -2, x: 1, z: -1, radius: 2.6, reach: 7.5, seed: 2043, cracks: 13, strokes: [[[-7, 5], [7, -7]]], lit: Math.atan2(-.6, -.5),
    ember: 0xff5a24, strength: .04, width: .4, heart: 0, litStone: 'rgba(200,204,212,.85)', darkStone: 'rgba(28,28,32,.9)', name: 'scrap pit crater', y: .03 });
}
/** The war-machine: where it kneels (its packed piece is .729 tall for 1 wide: k = h / .729 per unit) and how tall. */
const MACHINE = { x: 0, z: -43, y: -1.5, h: 34 };

/** Searchlights on the stands' rim either side of the far end, their beams sweeping the smog over the war-machine. */
function searchlights(c: DressContext) {
  const beams: THREE.Mesh[] = [];
  for (const [x, z, ph] of [[-34, -44, 0], [34, -44, 1.7], [-48, -10, 3.1], [48, -10, 4.4]] as const) {
    const beam = new THREE.Mesh(new THREE.ConeGeometry(9, 160, 20, 1, true).translate(0, 80, 0),
      new THREE.MeshBasicMaterial({ color: 0xe8f0ff, transparent: true, opacity: .05, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    beam.position.set(x, 36, z); beam.name = 'scrap pit searchlight'; beam.renderOrder = 4; beam.frustumCulled = false;
    beam.userData.phase = ph; beam.userData.lean = Math.atan2(-x, -z - 20);
    c.root.add(beam); beams.push(beam);
  }
  c.ambient.onUpdate(t => {
    for (const b of beams) { const p = b.userData.phase as number; b.rotation.set(.42 + Math.sin(t * .23 + p) * .18, (b.userData.lean as number) + Math.sin(t * .17 + p * 1.3) * .5, 0, 'YXZ'); }
  });
  const glow = new Beacons(c.root, 4, c.ambient.time);
  for (const b of beams) glow.add(b.position.x, b.position.y, b.position.z, 3, 0xf0f6ff, -1, .2, .2);
  glow.finish('scrap pit searchlight heads', 2);
}

/** The yard at work round the fight: tyre stacks and oil drums on the pit's floor, welders' arcs at the scrap stacks, steam
 *  off the grates, the bounty flags along the stands' rail, oil and scuffs on the ring's plate. Nothing on the ring. */
function yardAtWork(c: DressContext) {
  const { ambient } = c, r = rand(2026);
  const f = new Forge(c, 'scrap pit yard');
  f.mat('dark', { roughness: 1 });
  f.mat('rubber', { roughness: .95 });
  f.mat('steel', { roughness: .55, metalness: .4 });
  f.mat('glow', { basic: true });
  const glow = new Beacons(c.root, 120, ambient.time);
  for (const [x, z] of [[-17.5, 0], [17.5, 0], [0, -17.5], [0, 17.5], [-16, 9], [16, -9]] as const) {
    const n = 3 + Math.floor(r() * 3);
    for (let k = 0; k < n; k++) f.add('rubber', new THREE.TorusGeometry(.62, .26, 6, 14).rotateX(Math.PI / 2).translate(x + (r() - .5) * .2, -1.24 + k * .5, z + (r() - .5) * .2), 0x1e1c1c);
  }
  for (const [x, z] of [[-15.5, -8], [15.5, 8], [-8, 15.5], [8, -15.5], [-9, -16], [9, 16]] as const) for (let k = 0; k < 3; k++) {
    const dx = (k % 2) * .9 - .45, dz = Math.floor(k / 2) * .9 - .3;
    f.cyl('steel', x + dx, -1.5, z + dz, .42, .42, 1.25, [0x2a4a7a, 0x8a2a1e, 0x3a5a3a, 0x7a6a2a][(k + Math.round(x)) & 3], { sides: 10 });
  }
  f.done();
  for (const [sx, sz] of [[-1, -1], [1, 1], [1, -1]] as const) {
    const x = sx * 16, z = sz * 16;
    glow.add(x, 1.4, z, 1.6, 0xb8d8ff, 9, r(), .35);
    glow.add(x, 1.4, z, 3.2, 0x6a9aff, 4.5, r(), .5);
    ambient.motes({ min: [x - 1.6, -1.5, z - 1.6], max: [x + 1.6, 2.2, z + 1.6], count: 70, velocity: [.3, -3.2, .2], size: .05, color: 0xfff0b0, color2: 0xff9a30, opacity: 1, additive: true, twinkle: 1, wobble: .4, seed: 2030 + sx + sz * 3 });
  }
  glow.finish('scrap pit lamps and arcs', 2.4);
  ambient.puffs({ spots: [[-12, 15], [12, -15], [15, 12], [-15, -12]].map(([x, z]) => ({ x, y: -1.2, z, size: 1.4 })), color: 0xd8d0c8, shade: 0x6a6460, opacity: .3, life: 5, rise: 7, grow: 2.6, drift: [.3, 0, .1], seed: 2031, order: 2 });
  const flag = bountyFlag();
  for (let i = 0; i < 16; i++) {
    const a = (i + .5) / 16 * Math.PI * 2, x = Math.cos(a) * 22, z = Math.sin(a) * 22;
    if (Math.abs(x) < 17 && z < -15) continue;
    ambient.cloth(flag, { x: x * 1.12, y: 8 + PIT_FLOOR + 2.6, z: z * 1.12, width: 1.8, height: 2.6, rot: Math.atan2(-x, -z) + Math.PI, wind: .3, lit: .3 });
  }
  inlay(c, (g, n) => {
    const u = n / 26, q = rand(2032);
    g.translate(n / 2, n / 2);
    for (let k = 0; k < 14; k++) {
      const x = (q() - .5) * 22 * u, z = (q() - .5) * 22 * u, rr = (.5 + q() * 1.6) * u;
      const grad = g.createRadialGradient(x, z, 0, x, z, rr);
      grad.addColorStop(0, 'rgba(14,12,12,.55)'); grad.addColorStop(.7, 'rgba(30,24,20,.3)'); grad.addColorStop(1, 'rgba(30,24,20,0)');
      g.fillStyle = grad; g.beginPath(); g.ellipse(x, z, rr, rr * (.5 + q() * .5), q() * 3, 0, Math.PI * 2); g.fill();
    }
    g.strokeStyle = 'rgba(20,18,16,.35)'; g.lineCap = 'round';
    for (let k = 0; k < 40; k++) { const x = (q() - .5) * 24 * u, z = (q() - .5) * 24 * u, a = q() * 6.3, l = (.4 + q() * 1.8) * u; g.lineWidth = (.03 + q() * .06) * u; g.beginPath(); g.moveTo(x, z); g.lineTo(x + Math.cos(a) * l, z + Math.sin(a) * l); g.stroke(); }
  }, { size: 26, px: 1024, y: .02, roughness: .5, name: 'scrap pit oil' });
}

/** The pit's bounty flag: a cog over crossed spanners in rust orange on soot black, edged hazard yellow. No lettering. */
function bountyFlag() {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 384;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#1a1816'; g.fillRect(0, 0, 256, 384);
  for (let x = -384; x < 256; x += 32) { g.fillStyle = (x / 32) % 2 ? '#e6b41e' : '#1a1816'; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 16, 0); g.lineTo(x + 16 + 26, 26); g.lineTo(x + 26, 26); g.fill(); }
  g.translate(128, 190);
  g.strokeStyle = '#c86a2a'; g.lineWidth = 18; g.lineCap = 'round';
  for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * -70, 80); g.lineTo(s * 70, -80); g.stroke(); }
  g.fillStyle = '#d87a32';
  g.beginPath();
  for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2, rr = k % 2 ? 46 : 58; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  g.closePath(); g.fill();
  g.fillStyle = '#1a1816'; g.beginPath(); g.arc(0, 0, 20, 0, Math.PI * 2); g.fill();
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

/** The ring as riveted deck plate: steel grey, each plate its own wear, its seams dark, rivets along them, rust in patches. */
const deckPlate: Recolor = (r, g, b, x, y) => {
  const fx = x % 128, fy = y % 128, seam = fx < 3 || fy < 3, rivet = (fx % 32 > 13 && fx % 32 < 18 && fy > 6 && fy < 11) || (fy % 32 > 13 && fy % 32 < 18 && fx > 6 && fx < 11);
  const plate = ((Math.floor(x / 128) * 7 + Math.floor(y / 128) * 13) % 9) / 9;
  const rust = Math.max(0, Math.sin(x * .031 + y * .017) * Math.sin(y * .043 - x * .011) - .35) * 1.6;
  const l = (r + g + b) / 765, k = (.78 + plate * .18) * (.9 + l * .2);
  if (seam) return [40, 40, 42];
  if (rivet) return [150, 150, 150];
  return [154 * k * (1 - rust * .2) + rust * 70, 158 * k * (1 - rust * .3) + rust * 30, 166 * k * (1 - rust * .45)];
};
/** The ring's rim in hazard stripes, yellow and black. */
const hazard: Recolor = (_r, _g, _b, x, y) => ((x + y) % 64) < 32 ? [230, 180, 30] : [26, 24, 22];

/** The scrapyard round the pit's floor (outside the ring): crushed car bodies stacked at the corners, drums burning, a crane's
 *  hook over the ring on its chain. One draw, and the fires. */
function scrap(c: DressContext) {
  const r = rand(1984), parts: THREE.BufferGeometry[] = [], fires: { x: number; y: number; z: number; size: number }[] = [];
  const glow = new Beacons(c.root, 12, c.ambient.time);
  const pools = new LightPools(c.root, 4), fire = new THREE.Color(.5, .26, .08);
  const rusts = [0x7a3a22, 0x5a4a3a, 0x3a4a5a, 0x8a6a2a, 0x4a2a22, 0x6a6a64];
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
    const cx = sx * 17.5, cz = sz * 17.5;
    for (let k = 0; k < 5; k++) {
      const h = .9 + r() * .3;
      parts.push(tinted(new THREE.BoxGeometry(4.2 + r() * .6, h, 1.9 + r() * .3, 2, 1, 1).rotateY(r() * .5 - .25 + (sx * sz > 0 ? 0 : Math.PI / 2)).translate(cx + (r() - .5) * .6, k * h + h / 2 - 1.5, cz + (r() - .5) * .6).toNonIndexed(), rusts[Math.floor(r() * rusts.length)]));
    }
    const dx = cx - sx * 3.4, dz = cz + sz * .8;
    parts.push(tinted(new THREE.CylinderGeometry(.45, .45, 1.1, 10).translate(dx, -.95, dz).toNonIndexed(), 0x3a2a1e));
    fires.push({ x: dx, y: -.2, z: dz, size: .8 }, { x: dx, y: .2, z: dz, size: .5 });
    glow.add(dx, .1, dz, 3.2, 0xff8a30, -1, (dx * .1) % 1, 1);
    pools.add(dx, dz, 7, fire, -1.45);
  }
  const hy = 22;
  for (let k = 0; k < 20; k++) parts.push(tinted(new THREE.TorusGeometry(.22, .06, 4, 8).rotateY(k % 2 ? Math.PI / 2 : 0).translate(0, hy + 1 + k * .38, 0).toNonIndexed(), 0x2a2622));
  parts.push(tinted(new THREE.BoxGeometry(1.2, 1.4, .6).translate(0, hy + .4, 0).toNonIndexed(), 0xd8a020));
  parts.push(tinted(new THREE.TorusGeometry(.7, .18, 6, 14, Math.PI * 1.4).rotateZ(Math.PI * .8).translate(0, hy - .9, 0).toNonIndexed(), 0x3a3632));
  const geometry = mergeGeometries(parts);
  parts.forEach(g => g.dispose());
  const mesh = new THREE.Mesh(geometry, stageMaterial(c.stage, 'Scrap pit scrap', { color: 0xffffff, vertexColors: true, roughness: .8, flatShading: true }));
  mesh.name = 'scrap pit scrap'; mesh.receiveShadow = true;
  c.ambient.puffs({ spots: fires, color: 0xffb050, shade: 0xff4a10, opacity: .6, life: 1.1, rise: 2.2, grow: .6, additive: true, seed: 91, order: 1 });
  const smoke = fires.filter((_, i) => i % 2 === 0).map(f => ({ ...f, y: 3, size: 3 }));
  c.ambient.puffs({ spots: smoke, color: 0x3a3430, shade: 0x161412, opacity: .3, life: 8, rise: 14, drift: [.4, 0, .2], grow: 2.4, seed: 92, order: 2 });
  glow.finish('scrap pit fires', 1.8);
  pools.finish('scrap pit fire pools');
  return mesh;
}
