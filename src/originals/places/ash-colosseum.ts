import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { STAGE_PROPS } from '../../game/stageProps';
import type { DressContext } from '../../render/stages/dressing';
import { placeProps } from '../../render/stages/build';
import { Beacons } from '../../render/stages/glow';
import { crowdCards, figureAtlas, type CrowdSpot } from '../../render/stages/crowd';
import { mountainRidges } from '../../render/stages/hero';
import { ashBanner } from './craterWreck';
import { detail, Forge, noise2 } from './forge';
import { drawn, rand } from './remake';
import { bunting, fires as fireSpots, inlay, type P3 } from './richness';
import { crater } from './battleScars';

/** The court's walls (just past the bounds' 48 m), the podium's height, the benches' tiers. */
const W = 48.6, PODIUM = 8, TIER_UP = 1.05, TIER_BACK = 1.7, TIERS = 5;
const BASALT = 0x3a3634, BASALT_LIT = 0x5a524c, BAND = 0x8a6a4a, ASH = 0xd4ccc0, TIMBER = 0x3e2e24;
/** The old trees' boxes, the fire towers' now (environmentLayout.ts), and whether a lattice hangs round each. */
const TOWERS: readonly (readonly [number, number, number, number])[] = [[33.9, 32.3, 4.15, 4.0], [-40.8, -40.45, 3.65, 2.75], [-40.7, 31.8, 3.0, 4.5], [34.3, -40.7, 4.25, 3.25]];
/** The lattices at 7 m (x0, x1, z0, z1, underside): over the jump's roofs round the north-east, south-west and south-east
 *  towers, and the boxes and the balcony on the walls. */
const LATTICES: readonly (readonly [number, number, number, number, number])[] = [
  [28.2, 39.8, 27.2, 40.8, 7.2], [-47.8, -33.2, -46.8, -33.2, 6.9], [28.2, 44.8, -47.8, -35.2, 7.1],
  [12, 15.4, -48, -46, 7.4], [-48, -45, 7.2, 20.8, 7.3], [-15.8, -6.2, 44.2, 48, 7.2],
];

export async function dress(c: DressContext) {
  const { kit, ambient } = c;
  // places-epic-b: the torch-bearers' basalt darker and their lava cracks glowing (the picture's own orange as the glow), the
  // colossal pair's and those on the fire towers and the podium, so they stand black and burning against the red air (set
  // before the kit loads: a grade runs as the materials are made).
  kit.grade = (material, piece) => {
    if (piece !== 'own/ash-torchbearer') return;
    material.color.multiply(new THREE.Color(0x8a7a76));
    if (material.map) { material.emissive.setRGB(1, .42, .12); material.emissiveMap = material.map; material.emissiveIntensity = 1.1; material.needsUpdate = true; }
  };
  const props = (STAGE_PROPS['ash-colosseum'] ?? []).filter(p => p.piece !== 'br/wall-column' && p.piece !== 'column');
  await Promise.all([c.sky({ url: '/assets/environment/br/sky-ash-eruption.webp', rotation: -2.85, drift: .0003, tint: 0x9a8c8c }),
    kit.load([...new Set(props.map(p => p.piece)), 'own/ash-gatehouse', 'own/ash-torchbearer', 'own/ash-judges', 'own/proving-brazier', 'own/proving-rack', 'own/proving-post'])]);
  placeProps(kit, props);
  for (const p of props) kit.shadows.add(p.piece);
  const podiumFires = generated(c);
  podiumRacks(c);
  guardians(c);
  kit.flush(c.stage);

  const f = new Forge(c, 'ash colosseum');
  f.mat('ash', { map: raked(), tile: 6, roughness: 1, wear: { key: 'ash-colosseum', scale: 1.1, light: [.88, 1.1], patch: 0x8a8278, patchAmount: .3 } });
  f.mat('basalt', { map: detail.ashlar(91, 72), tile: 3.6, roughness: .9, shadow: true });
  f.mat('rock', { map: detail.rock(92), tile: 8, flat: true, roughness: .95, shadow: true });
  f.mat('bench', { map: detail.ashlar(93, 48), tile: 2.4, roughness: .9 });
  f.mat('timber', { map: detail.planks(94, 36), tile: 2.4, roughness: .85, shadow: true });
  f.mat('cloth', { roughness: 1, side: THREE.DoubleSide });
  f.mat('bronze', { roughness: .4, metalness: .6 });
  f.mat('dark', { roughness: 1 });
  f.mat('far', { map: detail.ashlar(95, 60), tile: 6, flat: true, roughness: .9, air: .5 });
  f.mat('mountain', { map: detail.rock(96), tile: 40, flat: true, roughness: 1, air: .7 });
  f.mat('glow', { basic: true });
  f.add('ash', new THREE.PlaneGeometry(2 * W + 2, 2 * W + 2).rotateX(-Math.PI / 2), ASH);
  const benches = walls(f);
  const fires = towers(f);
  lattices(f);
  cover(f);
  beyond(f);
  f.done();
  c.root.add(mountainRidges({ radius: 520, count: 20, seed: 83, base: -10, height: [90, 170], far: 0x4a4246, near: 0x2e2a2e, crest: 0xc88a5a }));
  crowd(c, benches);
  banners(c);

  fires.push(...podiumFires);
  const glow = new Beacons(c.root, 24, ambient.time);
  for (const s of fires) glow.add(s.x, s.y + .8, s.z, s.size * 2.4, 0xff8a3a, -1, (s.x * .1 + 1) % 1, 1);
  glow.add(0, 62, 110, 22, 0xff7a2a, -1, .3, 1);
  glow.finish('ash colosseum fires', 2);
  ambient.fire(fires.map((s, i) => ({ ...s, smoke: .6, seed: i * .21 })));
  ambient.puffs({ spots: [0, 1, 2, 3].map(k => ({ x: 0, y: 58 + k * 2, z: 110, size: 6 - k * 1.2 })), color: 0xffb050, shade: 0xff4a10, opacity: .6, life: 1.2, rise: 3, grow: .7, additive: true, seed: 81, order: 1 });
  // The mountain's smoke, and ash falling.
  const r = rand(84), smoke: { x: number; y: number; z: number; size: number }[] = [];
  for (let k = 0; k < 10; k++) smoke.push({ x: -170 + r() * 20, y: 220 + k * 18, z: 380 + r() * 20, size: 40 + k * 9 });
  ambient.puffs({ spots: smoke, color: 0x4a4040, shade: 0x1a1616, opacity: .6, life: 18, rise: 80, drift: [4, 0, 1], grow: 1.8, seed: 85, order: 0 });
  ambient.motes({ min: [-48, 0, -48], max: [48, 18, 48], count: 200, velocity: [.4, -.6, .2], size: .07, color: 0x8a8480, color2: 0xb0a8a0, opacity: .7, wobble: 1.2, seed: 86 });
  festival(c);
  eruption(c);
}

const ASH_PENNANTS = [0x8e2620, 0xd8d0c4, 0xc8862e, 0x2a2624, 0xb03a24];
/** places-b: the Proving Hall's weapon racks and training posts on the podium's top, between its braziers (past the bounds). */
function podiumRacks(c: DressContext) {
  for (let side = 0; side < 4; side++) {
    const t = side * Math.PI / 2, ca = Math.cos(t), sa = Math.sin(t), gate = side === 0 ? 10 : side === 2 ? 14 : undefined;
    for (const u of [-40, -14, 14, 40]) {
      if (gate !== undefined && Math.abs(u - gate) < 20) continue;
      if (side === 1 && Math.abs(u) < 6) continue;
      const v = W + 1.2, x = u * ca + v * sa, z = -u * sa + v * ca;
      c.kit.place('own/proving-rack', { x, y: PODIUM, z, height: 2, rot: t + Math.PI });
      const v2 = W + .9, x2 = (u + 4) * ca + v2 * sa, z2 = -(u + 4) * sa + v2 * ca;
      c.kit.place('own/proving-post', { x: x2, y: PODIUM, z: z2, height: 2.1, rot: u });
    }
  }
}
function festival(c: DressContext) {
  const { ambient } = c;
  const f = new Forge(c, 'ash colosseum festival');
  f.mat('dark', { roughness: 1 });
  f.mat('cloth', { roughness: 1, side: THREE.DoubleSide, emissive: 0x2a1006, emissiveIntensity: .5 });
  f.mat('timber', { roughness: .9 });
  f.mat('bronze', { roughness: .4, metalness: .6 });
  const PARAPET_V = W + 2 + TIERS * TIER_BACK + .5, PARAPET_Y = PODIUM + TIERS * TIER_UP + 1.4;
  const banner = ashBanner(), braziers: { x: number; y: number; z: number; size: number }[] = [];
  for (let side = 0; side < 4; side++) {
    const turn = side * Math.PI / 2, ca = Math.cos(turn), sa = Math.sin(turn), gate = side === 0 ? 10 : side === 2 ? 14 : undefined;
    for (let k = 0, u = -W + 6; u <= W - 6; u += 8, k++) {
      if (gate !== undefined && Math.abs(u - gate) < 9) continue;
      const x = u * ca + PARAPET_V * sa, z = -u * sa + PARAPET_V * ca;
      f.pipe('timber', [x, PARAPET_Y, z], [x, PARAPET_Y + 7.5, z], .09, 0x3a2a20);
      ambient.cloth(banner, { x: x - sa * .15, y: PARAPET_Y + 7.2, z: z - ca * .15, width: 1.5, height: 4.2, rot: turn + Math.PI, wind: .55, lit: .35 });
      if (k % 2 === 0) {
        f.cyl('bronze', x - sa * 1.2, PARAPET_Y, z - ca * 1.2, .55, .3, .7, 0x5a3a22, { sides: 8 });
        braziers.push({ x: x - sa * 1.2, y: PARAPET_Y + .75, z: z - ca * 1.2, size: .8 });
      }
    }
  }
  // Fire sconces on the podium's buttresses, 5 m up the wall's face, all round the court.
  for (let side = 0; side < 4; side++) {
    const turn = side * Math.PI / 2, ca = Math.cos(turn), sa = Math.sin(turn), gate = side === 0 ? 10 : side === 2 ? 14 : undefined;
    for (let u = -W + 4; u < W - 2; u += 16) {
      if (gate !== undefined && Math.abs(u - gate) < 9) continue;
      const v = W - .75, x = u * ca + v * sa, z = -u * sa + v * ca;
      f.beam('bronze', [u * ca + (W - .3) * sa, 4.6, -u * sa + (W - .3) * ca], [x, 4.9, z], .1, 0x3a2a1a);
      f.cyl('bronze', x, 4.9, z, .34, .2, .4, 0x4a3420, { sides: 8 });
      braziers.push({ x, y: 5.35, z, size: .6 });
    }
  }
  // The village's banners down the podium's face in the bays banners() leaves bare, between the sconces.
  for (let side = 0; side < 4; side++) {
    const turn = side * Math.PI / 2, ca = Math.cos(turn), sa = Math.sin(turn), gate = side === 0 ? 10 : side === 2 ? 14 : undefined;
    for (const u of [-40, -24, -8, 8, 32]) {
      if (gate !== undefined && Math.abs(u - gate) < 10) continue;
      const v = W - .1;
      ambient.cloth(banner, { x: u * ca + v * sa, y: PODIUM - .4, z: -u * sa + v * ca, width: 2.2, height: 3.4, rot: turn + Math.PI, wind: .25, lit: .35 });
    }
  }
  const glow = new Beacons(c.root, 96, ambient.time);
  fireSpots(c, braziers, { glow, smoke: .45, seed: 121 });
  // Pennants from tower to tower over the court's sides (the guardians' plinths, 19 m), and out to the corner bastions.
  const tops = TOWERS.map(([x, z]) => [x, 19, z] as P3);
  const order = [0, 2, 1, 3];
  for (let k = 0; k < 4; k++) bunting(f, tops[order[k]], tops[order[(k + 1) % 4]], { colours: ASH_PENNANTS, size: 1.1, gap: 1.3, sag: 6.5, seed: 130 + k });
  for (const [x, z] of TOWERS) bunting(f, [x, 18.6, z], [Math.sign(x) * (W + 7), 18.4, Math.sign(z) * (W + 7)], { colours: ASH_PENNANTS, size: 1, gap: 1.2, sag: 2.4, seed: 140 + x });
  f.done();
  glow.finish('ash colosseum parapet fires', 2);
  // The ash raked into rings: round the centre, the column stubs, the fallen column and the rocks (their boxes'), all on one
  // picture laid over the court (one draw).
  const SIZE = 2 * W, spots: [number, number, number, number][] = [[0, 0, 13, 15]];
  for (const p of STAGE_PROPS['ash-colosseum'] ?? []) {
    const rr = p.piece === 'column' ? 6.5 : p.piece === 'br/wall-column' ? 3 : 4.6;
    spots.push([p.x, p.z, rr, Math.round(rr * 1.4)]);
  }
  inlay(c, (g, s) => {
    const u = s / SIZE;
    g.translate(s / 2, s / 2);
    for (const [x, z, rr, n] of spots) for (let k = 0; k < n; k++) {
      const r0 = (rr * (k + .5) / n) * u, fade = 1 - (k / n) ** 3, step = u * rr / n;
      g.lineWidth = step * .38; g.strokeStyle = `rgba(255,252,246,${.34 * fade})`; g.beginPath(); g.arc(x * u, z * u, r0, 0, Math.PI * 2); g.stroke();
      g.lineWidth = step * .22; g.strokeStyle = `rgba(40,34,30,${.3 * fade})`; g.beginPath(); g.arc(x * u, z * u, r0 + step * .32, 0, Math.PI * 2); g.stroke();
    }
  }, { size: SIZE, px: 2048, y: .012, roughness: 1, name: 'ash colosseum raked rings' });
  ambient.birds({ centre: [0, 0, 0], count: 11, radius: 62, height: 34, spread: 10, speed: 7, size: .75, color: 0x1a1414, seed: 131 });
  ambient.puffs({ spots: [0, 1, 2, 3, 4, 5].map(k => ({ x: 0, y: 66 + k * 9, z: 110, size: 9 + k * 4 })), color: 0x6a5a54, shade: 0x2a2220, opacity: .4, life: 14, rise: 40, drift: [3, 0, 1], grow: 2, seed: 132, order: 0 });
}

/** Ash raked in straight furrows: ridges and troughs across the tile, broken here and there, grit in them. */
function raked() {
  return drawn(512, 512, (g, w, h) => {
    const r = rand(97);
    g.fillStyle = '#c8c4bc'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 16) {
      const grad = g.createLinearGradient(0, y, 0, y + 16);
      grad.addColorStop(0, 'rgba(255,255,255,.22)'); grad.addColorStop(.45, 'rgba(255,255,255,0)'); grad.addColorStop(.55, 'rgba(0,0,0,.16)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad; g.fillRect(0, y, w, 16);
    }
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(${r() < .5 ? '80,74,68' : '230,226,220'},${.05 + r() * .08})`; g.beginPath(); g.ellipse(r() * w, r() * h, 20 + r() * 60, 10 + r() * 30, r() * 3, 0, 7); g.fill(); }
    for (let i = 0; i < 2600; i++) { const k = 110 + Math.floor(r() * 120); g.fillStyle = `rgba(${k},${k - 4},${k - 8},.7)`; g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2); }
  });
}

/** The four walls: the podium of basalt ashlar with buttress pilasters and a coping, the benches stepping back over it to
 *  a parapet, a bastion at each corner, a gatehouse in the north and south walls. Returns the benches (side, tier) for the
 *  crowd. */
function walls(f: Forge) {
  const benches: { side: number; tier: number }[] = [];
  for (let side = 0; side < 4; side++) {
    const turn = side * Math.PI / 2, ca = Math.cos(turn), sa = Math.sin(turn);
    const at = (u: number, v: number) => [u * ca + v * sa, -u * sa + v * ca] as const;
    const gate = side === 0 ? 10 : side === 2 ? 14 : undefined;
    const run = (u0: number, u1: number, v: number, y: number, h: number, d: number, key: string, tint: number) => {
      const [x, z] = at((u0 + u1) / 2, v + d / 2);
      f.box(key, x, y, z, u1 - u0, h, d, tint, { rot: turn });
    };
    const span = gate === undefined ? [[-W, W]] : [[-W, gate - 7], [gate + 7, W]];
    for (const [u0, u1] of span) {
      run(u0, u1, W, -.5, PODIUM + .5, 3, 'basalt', BASALT);
      run(u0, u1, W - .25, PODIUM - .6, .6, .5, 'basalt', BAND);
      for (let t = 0; t < TIERS; t++) run(u0, u1, W + 2 + t * TIER_BACK, PODIUM, (t + 1) * TIER_UP, TIER_BACK + .1, 'bench', t % 2 ? 0x6a625a : 0x5a544e);
      run(u0, u1, W + 2 + TIERS * TIER_BACK, PODIUM, TIERS * TIER_UP + 1.4, 1, 'basalt', BASALT_LIT);
      for (let u = u0 + 4; u < u1 - 2; u += 8) { const [x, z] = at(u, W - .3); f.box('basalt', x, -.5, z, 1.4, PODIUM, .7, BASALT_LIT, { rot: turn }); }
    }
    for (let t = 0; t < TIERS; t++) benches.push({ side, tier: t });
    // places-gen: the gatehouse is the generated one (generated()), standing in the wall's gap.
  }
  // The corner bastions, a brazier on each (lit with the towers').
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
    f.box('basalt', sx * (W + 7), -.5, sz * (W + 7), 13, 17, 13, BASALT);
    f.box('basalt', sx * (W + 7), 16.5, sz * (W + 7), 14, 1.2, 14, BAND);
    f.cyl('bronze', sx * (W + 7), 17.7, sz * (W + 7), 2.2, 1.4, 1.4, 0x6a4a2a, { sides: 10 });
  }
  return benches;
}

/** places-gen: where the gates stand (the wall's side, the gate's place along it: walls()'s gaps). */
const GATES = [[0, 10], [2, 14]] as const;
/** places-gen: the generated pieces (Tripo; own/ash-*): a gatehouse in each wall's gap, torch-bearing guardians on the podium
 *  either side of it, the judges' stand on the east wall, bronze braziers along the podium's top (their fires returned). */
function generated(c: DressContext) {
  const { kit } = c, fires: { x: number; y: number; z: number; size: number }[] = [];
  const at = (side: number, u: number, v: number) => { const t = side * Math.PI / 2, ca = Math.cos(t), sa = Math.sin(t); return [u * ca + v * sa, -u * sa + v * ca] as const; };
  const facing = (side: number) => side * Math.PI / 2 + Math.PI;
  // On each fire tower's top a guardian 10 m high raising the village's fire toward the court (her bowl's fire is the
  // tower's now: her right hand, about 12% of her height to her right and near her top).
  for (const [x, z] of TOWERS) {
    const rot = Math.atan2(-x, -z), h = 10, lx = -.12 * h, lz = .05 * h;
    kit.place('own/ash-torchbearer', { x, y: 19.3, z, height: h, rot });
    fires.push({ x: x + lx * Math.cos(rot) + lz * Math.sin(rot), y: 19.3 + .96 * h, z: z - lx * Math.sin(rot) + lz * Math.cos(rot), size: 1.6 });
  }
  for (const [side, gate] of GATES) {
    const [x, z] = at(side, gate, W + 7.6);
    kit.place('own/ash-gatehouse', { x, y: -.5, z, height: 23, rot: facing(side) });
    for (const e of [-1, 1]) { const [sx, sz] = at(side, gate + e * 16, W + 1.9); kit.place('own/ash-torchbearer', { x: sx, y: PODIUM, z: sz, height: 9.5, rot: facing(side) }); }
  }
  { const [x, z] = at(1, 0, W + 3.4); kit.place('own/ash-judges', { x, y: PODIUM, z, height: 6.5, rot: facing(1) }); }
  for (let side = 0; side < 4; side++) for (const u of [-30, 30]) {
    const [x, z] = at(side, u, W + 1);
    kit.place('own/proving-brazier', { x, y: PODIUM, z, height: 1.8, rot: u });
    fires.push({ x, y: PODIUM + 1.65, z, size: .8 });
  }
  return fires;
}

/** The fire towers in the old trees' boxes: banded basalt 20 m up, a bronze bowl of fire on each. */
function towers(f: Forge) {
  const fires: { x: number; y: number; z: number; size: number }[] = [];
  for (const [x, z, hx, hz] of TOWERS) {
    f.box('basalt', x, -.3, z, hx * 2, 18.6, hz * 2, (_x, y) => y > 18 ? BASALT_LIT : BASALT);
    for (const y of [3, 7.6, 12, 16.4]) f.box('basalt', x, y, z, hx * 2 + .4, .6, hz * 2 + .4, BAND);
    f.box('basalt', x, 18.3, z, hx * 2 + 1.2, 1, hz * 2 + 1.2, BASALT_LIT);
    // places-gen: the village's fire is held up by a guardian statue on each tower's top now (generated()).
  }
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) fires.push({ x: sx * (W + 7), y: 18.8, z: sz * (W + 7), size: 1.6 });
  return fires;
}

/** The timber lattices at 7 m over the jump's roofs: beams one way under joists the other, carried on raking brackets from
 *  the nearest tower or wall, ash-cloths hung over some bays. */
function lattices(f: Forge) {
  const r = rand(98);
  for (const [x0, x1, z0, z1, y] of LATTICES) {
    const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, along = w > d;
    for (let k = 0; ; k++) {
      const t = .6 + k * 2.2; if (t > (along ? d : w) - .3) break;
      if (along) f.box('timber', cx, y, z0 + t, w, .45, .4, TIMBER); else f.box('timber', x0 + t, y, cz, .4, .45, d, TIMBER);
    }
    for (let k = 0; ; k++) {
      const t = .3 + k * 1.1; if (t > (along ? w : d) - .2) break;
      if (along) f.box('timber', x0 + t, y + .45, cz, .2, .22, d, 0x4a3a2c); else f.box('timber', cx, y + .45, z0 + t, w, .22, .2, 0x4a3a2c);
    }
    for (let i = 0; i < Math.max(1, Math.round(w * d / 60)); i++) {
      const bx = x0 + 1 + r() * (w - 3), bz = z0 + 1 + r() * (d - 3);
      f.box('cloth', bx, y + .7, bz, 2.4 + r() * 2, .04, 2 + r() * 2, r() < .5 ? 0x8a7a64 : 0x6a5a4a, { rot: r() * .3 });
    }
    // Brackets: from the nearest support (a tower in it, else the wall behind it) out under the lattice's edges.
    const tower = TOWERS.find(([tx, tz]) => tx > x0 && tx < x1 && tz > z0 && tz < z1);
    const sx = tower ? tower[0] : Math.abs(x0) > 44 ? Math.sign(x0) * W : cx, sz = tower ? tower[1] : Math.abs(z0) > 44 || Math.abs(z1) > 44 ? Math.sign(cz) * W : cz;
    for (const [ex, ez] of [[x0 + .3, cz], [x1 - .3, cz], [cx, z0 + .3], [cx, z1 - .3]] as const) {
      if (Math.hypot(ex - sx, ez - sz) < 1.5) continue;
      f.beam('timber', [sx + Math.sign(ex - sx) * Math.min(Math.abs(ex - sx), 1.2), y - 1.8, sz + Math.sign(ez - sz) * Math.min(Math.abs(ez - sz), 1.2)], [ex, y, ez], .35, TIMBER);
    }
  }
}

/** The cover in its boxes: three basalt column stubs where the wall's columns stood, a fallen column. */
function cover(f: Forge) {
  for (const p of STAGE_PROPS['ash-colosseum'] ?? []) {
    if (p.piece === 'br/wall-column') {
      f.cyl('basalt', p.x, -.2, p.z, .55, .62, 2.4, BASALT, { sides: 6 });
      f.cyl('basalt', p.x, 2.2, p.z, .7, .7, .3, BAND, { sides: 6 });
    } else if (p.piece === 'column') {
      const len = p.length ?? 5.5, rad = p.radius ?? .55, a = p.rot ?? 0, dx = Math.cos(a) * len / 2, dz = -Math.sin(a) * len / 2;
      f.pipe('basalt', [p.x - dx, rad, p.z - dz], [p.x + dx, rad, p.z + dz], rad, BASALT, { sides: 6 });
    }
  }
}

/** Past the walls: r7's stepped pyramid north with the eternal fire, the smoking mountain north-west, a caldera's ridges. */
function beyond(f: Forge) {
  const pz = 110;
  for (let k = 0; k < 6; k++) f.box('far', 0, k * 9, pz, 64 - k * 10, 9, (64 - k * 10) * .7, k % 2 ? 0x5a504a : 0x4a423e);
  f.cyl('far', 0, 54, pz, 4.5, 5.5, 3, 0x3a302a);
  const n = noise2(99), x = -170, z = 380, H = 220, R = 260, rim = 40;
  const g = new THREE.CylinderGeometry(rim, R, H, 40, 8, true);
  const p = g.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const px = p.getX(i), py = p.getY(i), pz2 = p.getZ(i), a = Math.atan2(pz2, px), t = (py + H / 2) / H, k = 1 + (n(a * 3, t * 4) - .5) * .18 * (1 - t * .5);
    p.setXYZ(i, px * k, py, pz2 * k);
  }
  f.add('mountain', g.translate(x, H / 2 - 12, z), (_x, y) => y > H - 50 ? 0x4a3a34 : 0x2e2a2e);
  f.add('glow', new THREE.CircleGeometry(rim * .85, 24).rotateX(-Math.PI / 2).translate(x, H - 12.5, z), 0xff7a2a);
}

/** The Hidden Ash on the benches: grey and ochre coats, ash-dusted hoods, painted in code, a few with an arm up. */
function crowd(c: DressContext, benches: { side: number; tier: number }[]) {
  const r = rand(100);
  const coats = ['#5a524a', '#8a6a3a', '#3a3a40', '#7a3a2a', '#6a6a5a', '#4a3a30', '#9a8a6a', '#2e2e34'];
  const atlas = figureAtlas(8, 2, 96, 192, (g, i, w, h) => {
    const cx = w / 2, ink = '#14100e', coat = coats[i % coats.length], skin = ['#e0b896', '#c08a66', '#8a6040', '#f0d0b0'][i % 4];
    g.lineWidth = 3; g.strokeStyle = ink; g.lineJoin = 'round';
    const shape = (fill: string, path: () => void) => { g.beginPath(); path(); g.fillStyle = fill; g.fill(); g.stroke(); };
    shape('#2a2624', () => { g.rect(cx - 14, h * .6, 12, h * .38); g.rect(cx + 2, h * .6, 12, h * .38); });
    shape(coat, () => { g.moveTo(cx - 19, h * .3); g.lineTo(cx + 19, h * .3); g.lineTo(cx + 23, h * .7); g.lineTo(cx - 23, h * .7); g.closePath(); });
    shape('#8e2620', () => g.rect(cx - 19, h * .5, 38, 5));
    if (i >= 8) { g.lineWidth = 11; g.beginPath(); g.moveTo(cx + 15, h * .33); g.lineTo(cx + 23, h * .08); g.stroke(); g.lineWidth = 6; g.strokeStyle = coat; g.stroke(); g.lineWidth = 3; g.strokeStyle = ink; }
    shape(skin, () => g.arc(cx, h * .2, 13, 0, Math.PI * 2));
    if (i % 2 === 0) shape(coat, () => { g.arc(cx, h * .19, 15, Math.PI * 1.02, -Math.PI * .02); g.lineTo(cx + 16, h * .28); g.lineTo(cx - 16, h * .28); g.closePath(); });
  });
  const spots: CrowdSpot[] = [];
  for (const { side, tier } of benches) {
    const turn = side * Math.PI / 2, ca = Math.cos(turn), sa = Math.sin(turn), gate = side === 0 ? 10 : side === 2 ? 14 : undefined;
    // places-b: packed (every .7-1.1 m, one seat in sixteen empty; it was .85-1.35 m, one in four).
    for (let u = -W + 3; u < W - 3; u += .7 + r() * .4) {
      if (r() < .06 || (gate !== undefined && Math.abs(u - gate) < 11.5)) continue;
      // places-gen: none behind the guardians on the podium, nor under the judges' stand.
      if ((gate !== undefined && tier < 2 && Math.abs(Math.abs(u - gate) - 16) < 2.4) || (side === 1 && tier < 4 && Math.abs(u) < 4)) continue;
      const v = W + 2 + tier * TIER_BACK + .7, y = PODIUM + (tier + 1) * TIER_UP;
      spots.push({ x: u * ca + v * sa, y, z: -u * sa + v * ca, cell: Math.floor(r() * 16), height: 1.65 + r() * .2, flip: r() < .5 });
    }
  }
  crowdCards(c, atlas, 8, 2, spots, { name: 'ash colosseum crowd', aspect: .5, shade: .85, sway: .05 });
}

/** The Hidden Ash's banners down the podium's face between the buttresses. */
function banners(c: DressContext) {
  const banner = ashBanner();
  for (let side = 0; side < 4; side++) {
    const turn = side * Math.PI / 2, ca = Math.cos(turn), sa = Math.sin(turn);
    for (const u of [-32, -16, 24, 40]) {
      const v = W - .1;
      c.ambient.cloth(banner, { x: u * ca + v * sa, y: PODIUM - .4, z: -u * sa + v * ca, width: 2.4, height: 3.6, rot: turn + Math.PI, wind: .25, lit: .35 });
    }
  }
}

/** The guardians: either side of the pyramid (its foot 64 m wide at z 110), facing the court; their bowls at 0.94 of their
 *  height, a seventh of it out to their right hand. Placed before the kit is flushed. */
function guardians(c: DressContext) {
  const { kit, ambient } = c, H = 46;
  const glow = new Beacons(c.root, 4, ambient.time);
  const bowls: { x: number; y: number; z: number; size: number }[] = [];
  for (const s of [-1, 1]) {
    const x = s * 46, z = 104;
    kit.place('own/ash-torchbearer', { x, z, y: 0, height: H, rot: Math.PI });
    const bx = x + .145 * H, bz = z - .05 * H, by = .94 * H;
    bowls.push({ x: bx, y: by + 1, z: bz, size: 3.2 });
    glow.add(bx, by + 2.5, bz, 26, 0xff8a30, -1, s > 0 ? .2 : .7, 1);
  }
  glow.finish('ash colosseum guardians\' fire', 1.8);
  ambient.fire(bowls.map((b, i) => ({ ...b, smoke: .8, seed: 1.7 + i })));
}

function eruption(c: DressContext) {
  const { ambient } = c, r = rand(1501);
  const glow = new Beacons(c.root, 40, ambient.time);
  // The mountain (ash-colosseum beyond(): a cone at -170, 380, its crater rim 40 m across 208 m up).
  const mx = -170, mz = 380, top = 208;
  const f = new Forge(c, 'ash colosseum eruption');
  f.mat('lava', { basic: true, fog: false });
  // Rivers of lava from the rim down the flanks: ribbons laid on the cone, wandering, wider as they fall.
  for (let k = 0; k < 9; k++) {
    let a = (k / 9) * Math.PI * 2 + r() * .4, prev: THREE.Vector3 | null = null;
    const pts: THREE.Vector3[] = [];
    for (let t = 0; t <= 1.0001; t += .05) {
      a += (r() - .5) * .08;
      const rad = 40 + (260 - 40) * t * .92, y = top - t * 205 + 2.5;
      pts.push(new THREE.Vector3(mx + Math.cos(a) * rad * 1.02, y, mz + Math.sin(a) * rad * 1.02));
    }
    for (const p of pts) { if (prev) f.beam('lava', [prev.x, prev.y, prev.z], [p.x, p.y, p.z], 3 + (p.y < 100 ? 4 : 1.5), k % 3 ? 0xff6a1a : 0xffa030, 1.2); prev = p; }
    glow.add(pts[6].x, pts[6].y + 4, pts[6].z, 30, 0xff5a1a, -1, k * .13, 1);
  }
  f.done();
  // (Kept small: a glow a hundred metres across laid an orange veil over the whole court and overflowed the grade.)
  glow.add(mx, top + 10, mz, 80, 0xff6a20, -1, .4, 1);
  glow.add(mx, top + 60, mz, 110, 0xff3a10, -1, .6, 1);
  // The column of ash: rolling up out of the crater a kilometre, lit red from below, spreading as it rises and drifting
  // east on the wind; the fire in its throat.
  const column = Array.from({ length: 22 }, (_, k) => ({ x: mx + k * 6 + (r() - .5) * 20, y: top + 20 + k * 38, z: mz - k * 2 + (r() - .5) * 20, size: 70 + k * 16 }));
  ambient.puffs({ spots: column, color: 0x5a3a36, shade: 0x140c0e, opacity: .92, life: 26, rise: 14, grow: 1.6, drift: [5, 0, -1], cel: true, seed: 1502, order: 0 });
  ambient.puffs({ spots: column.slice(0, 6).map(s => ({ ...s, size: s.size * .8 })), color: 0xff7a30, shade: 0xa02a10, opacity: .55, life: 4, rise: 30, grow: 1.2, additive: true, seed: 1503, order: 0 });
  lightning(c, mx, top + 260, mz);
  // The court split by a crater, its cracks glowing with the mountain's fire.
  crater(c, { size: 40, cx: -6, cz: 5, x: -6, z: 5, radius: 5.2, reach: 18, seed: 1504, strokes: [[[-24, -6], [8, 22]], [[-20, 18], [14, -14]]], lit: Math.atan2(.55, .8),
    ember: 0xff5a1a, strength: .4, litStone: 'rgba(200,180,160,.85)', darkStone: 'rgba(36,30,30,.85)', name: 'ash colosseum crater' });
  // Ash and embers coming down over the court.
  ambient.motes({ min: [-60, 0, -60], max: [60, 30, 60], count: 260, velocity: [.8, -.9, .3], size: .08, color: 0x6a5a56, color2: 0x9a8a84, opacity: .75, wobble: 1.4, seed: 1505 });
  ambient.motes({ min: [-60, 0, -60], max: [60, 22, 60], count: 160, velocity: [.6, .7, .2], size: .06, color: 0xff6a20, color2: 0xffc060, opacity: .95, additive: true, twinkle: .9, wobble: 1.4, seed: 1506 });
  glow.finish('ash colosseum eruption glow', 1.1);
}

function lightning(c: DressContext, x: number, y: number, z: number) {
  const r = rand(1511), cards: THREE.BufferGeometry[] = [];
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 1024;
  const g = canvas.getContext('2d')!;
  g.strokeStyle = '#ffffff'; g.lineCap = 'round'; g.lineJoin = 'round';
  g.shadowColor = 'rgba(255,190,140,1)'; g.shadowBlur = 16;
  const bolt = (x0: number, y0: number, w: number, depth: number) => {
    let px = x0, py = y0;
    g.lineWidth = w; g.beginPath(); g.moveTo(px, py);
    while (py < 1000) { px += (r() - .5) * 60; py += 30 + r() * 50; px = Math.max(10, Math.min(246, px)); g.lineTo(px, py); if (depth && r() < .18) { g.stroke(); bolt(px, py, w * .55, depth - 1); g.lineWidth = w; g.beginPath(); g.moveTo(px, py); } }
    g.stroke();
  };
  bolt(128, 0, 7, 2);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  for (let k = 0; k < 4; k++) {
    const a = r() * Math.PI * 2, px = x + Math.cos(a) * 60, pz = z + Math.sin(a) * 60, py = y + (r() - .5) * 120, h = 260 + r() * 140;
    const card = new THREE.PlaneGeometry(h / 4, h).translate(0, 0, 0);
    card.lookAt(new THREE.Vector3(-px, 0, -pz));
    card.translate(px, py, pz);
    const f0 = k * 1.37 + r(), f1 = 2.5 + r() * 3;
    card.setAttribute('aFlash', new THREE.Float32BufferAttribute([f0, f1, f0, f1, f0, f1, f0, f1], 2));
    cards.push(card);
  }
  const geometry = mergeGeometries(cards);
  const material = new THREE.ShaderMaterial({
    name: 'ash colosseum lightning', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: { uMap: { value: map }, uTime: c.ambient.time },
    vertexShader: /* glsl */`
      attribute vec2 aFlash; uniform float uTime; varying vec2 vUv; varying float vOn;
      void main() {
        vUv = uv;
        float t = mod( uTime + aFlash.x * 3.0, aFlash.y );
        vOn = t < .08 ? 1.0 : t < .14 ? .2 : t < .22 ? .9 : 0.0;
        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D uMap; varying vec2 vUv; varying float vOn;
      void main() { float a = texture2D( uMap, vUv ).a; gl_FragColor = vec4( vec3( 1.0, .82, .7 ) * a * vOn * 2.2, 1.0 ); }`,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'ash colosseum lightning'; mesh.frustumCulled = false; mesh.renderOrder = 2;
  c.root.add(mesh);
}
