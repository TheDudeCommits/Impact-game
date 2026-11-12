import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { KIT_SIZE, STAGE_PROPS } from '../../game/stageProps';
import type { DressContext } from '../../render/stages/dressing';
import { leafGreen, placeProps, stageMaterial } from '../../render/stages/build';
import { Forge, detail } from './forge';
import { heroAir } from '../../render/stages/hero';
import { Beacons } from '../../render/stages/glow';
import { drawn, rand, repaint, tinted, type Recolor } from './remake';
import { fireBowl } from './standingFire';
import { surfaces, type Surface } from './cc0';
import { worldFloor } from './finish';
import { STAGE_LANDMARKS } from '../../game/environmentLayout';

/** Thornwood Ward: a city block the hex gave back to the forest, at night - a wide cracked plaza taken back by grass and
 *  roots, ruined concrete towers round it half swallowed by vines (the three corner blocks in their boxes), a moss-wrapped
 *  kiosk, a caved-in stairway, dead poles wrapped in creepers, wrecks under old tarps in the cars' boxes, and the Hex - a
 *  colossal black thorn-tree burst up through a split tower over the north block, its sigils glowing violet. */
export async function dress(c: DressContext) {
  const { kit, ambient } = c;
  let roadSurfaces!: Record<'asphalt-cracked' | 'grass-leafy', Surface>;
  kit.grade = (material, piece) => {
    if (piece === 'asian/ume' && /Ume/.test(material.name)) leafGreen(material, [0x1c3a1e, 0x6a9a48]);
    if (piece === 'cc0/covered-car') {
      const map = repaint(material.map, tarp);
      if (map) { material.map = map; material.needsUpdate = true; }
      material.normalScale.multiplyScalar(2.4);
      material.roughness = .9;
    }
  };
  await Promise.all([
    c.sky({ url: '/assets/environment/br/sky-thornwood-night.webp', rotation: 0, drift: .00005 }),
    kit.load(['cc0/covered-car', 'cc0/utility-box', 'br/meshy-rubble', 'asian/ume', 'asian/bush', 'own/thorn-tree', 'own/thorn-tower', 'own/thorn-kiosk', 'own/thorn-stair']), // No stone lamp
    surfaces(c, ['asphalt-cracked', 'grass-leafy'] as const).then(s => { roadSurfaces = s; }),
  ]);
  ground(c, roadSurfaces);
  blocks(c);
  street(c);

  const props = STAGE_PROPS['thornwood-ward'] ?? [];
  placeProps(kit, props.filter(p => !/^thornwood-ward\//.test(p.piece)));
  for (const p of props) {
    const size = /^thornwood-ward\//.test(p.piece) ? (KIT_SIZE as Record<string, readonly number[]>)[p.piece] : undefined;
    if (!size) continue;
    if (p.piece === 'thornwood-ward/vending') { kit.place('cc0/utility-box', { x: p.x, z: p.z, y: p.y, rot: p.rot, width: size[0] * (p.scale ?? 1), tint: 0x8a9488 }); continue; }
    const length = size[2] * (p.scale ?? 1), cars = Math.max(1, Math.round(length / 4.6)), rot = p.rot ?? 0;
    for (let k = 0; k < cars; k++) {
      const along = (k - (cars - 1) / 2) * length / cars;
      kit.place('cc0/covered-car', { x: p.x + Math.sin(rot) * along, z: p.z + Math.cos(rot) * along, y: p.y, rot: rot + (k % 2 ? .06 : -.04), width: size[0] * (p.scale ?? 1) * .92, tint: TARPS[(k + Math.round(p.x)) % TARPS.length] });
    }
  }
  for (const p of props) {
    // (The square's monument is a cold stone fire bowl on its plinth: monument().)
    if (p.draw === 'tree') kit.place('asian/ume', { x: p.x, z: p.z, y: .25, rot: p.x * 1.7, scale: .8 + (Math.abs(p.z * 7.3) % 1) * .2 });
  }
  const train = props.find(p => p.draw === 'train-car');
  if (train) c.root.add(container(c, train.x, train.z));
  const r = rand(4040);
  for (let i = 0; i < 40; i++) {
    const a = r() * Math.PI * 2, d = 44 + r() * 26, x = Math.sin(a) * d, z = Math.cos(a) * d;
    if (Math.abs(x) < 40 && Math.abs(z) < 40) continue;
    if (r() < .55) kit.place('asian/ume', { x, z, rot: r() * 6.3, scale: .9 + r() * .6 });
    else kit.place('asian/bush', { x, z, rot: r() * 6.3, scale: 3 + r() * 2.5 });
  }
  kit.shadows.add('cc0/covered-car').add('br/meshy-rubble');
  kit.flush(c.stage);

  await theHex(c);
  afterRain(c);
  ambient.motes({ min: [-50, 0, -50], max: [50, 20, 50], count: 160, velocity: [.6, -.4, .3], size: .1, color: 0x5a6a30, color2: 0x8a7a3a, opacity: .85, wobble: 1.6, seed: 91 });
  ambient.motes({ min: [-40, 0, -40], max: [40, 14, 40], count: 220, velocity: [.1, .25, .05], size: .06, color: 0xd080ff, color2: 0x8a60ff, opacity: .75, additive: true, twinkle: .7, wobble: 1, seed: 92 });
  signs(c);
  ambient.birds({ centre: [0, 0, -30], count: 16, radius: 34, height: 40, spread: 12, speed: 7, size: .6, color: 0x060508, seed: 93 });
  const haze: { x: number; y: number; z: number; size: number }[] = [];
  for (let i = 0; i < 18; i++) { const a = r() * Math.PI * 2, d = 40 + r() * 80; haze.push({ x: Math.sin(a) * d, y: 1 + r() * 4, z: Math.cos(a) * d, size: 20 + r() * 20 }); }
  ambient.puffs({ spots: haze, color: 0x3a3a52, shade: 0x161a1c, opacity: .2, life: 0, flat: true, drift: [.3, 0, .15], seed: 94, order: 1 });
}

/** The tarps' colours, faded by years of sun. */
const TARPS = [0xc4cca8, 0xa8b8c0, 0xdcd0b0, 0xb8b8a0];
/** A canvas tarp from the cover's picture: its folds' light and shade on a bleached canvas ramp, moss and grime in the creases,
 *  a fine weave and the sun's blotches. */
const tarp: Recolor = (r, g, b, x, y) => {
  const l = Math.min(1, Math.max(0, ((r * .299 + g * .587 + b * .114) - 18) / 96));
  const weave = ((x & 1) ^ (y & 1)) ? 5 : -5;
  const blotch = Math.sin(x * .031 + Math.sin(y * .023) * 2) * Math.sin(y * .037 - x * .011) * 16;
  const base = 96 + l * 132 + weave + blotch;
  const moss = Math.max(0, .34 - l) * 2.2;
  return [base * (1 - moss) + 58 * moss, base * .985 * (1 - moss) + 82 * moss, base * .9 * (1 - moss) + 40 * moss];
};

/** A rusted freight container in the train car's box (12.2 x 4.1 x 2.9 m), ribbed, mossed on top. */
function container(c: DressContext, x: number, z: number) {
  const parts: THREE.BufferGeometry[] = [tinted(new THREE.BoxGeometry(12.2, 4.1, 2.9).translate(0, 2.05, 0), 0x7a3a24)];
  for (let k = -5.6; k <= 5.6; k += .8) for (const s of [-1, 1]) parts.push(tinted(new THREE.BoxGeometry(.14, 3.9, .1).translate(k, 2.05, s * 1.48), 0x5a2a1a));
  parts.push(tinted(new THREE.BoxGeometry(12.3, .2, 3).translate(0, 4.15, 0), 0x3a4a28));
  const mesh = new THREE.Mesh(mergeGeometries(parts.map(g => g.toNonIndexed())), stageMaterial(c.stage, 'Thornwood container', { color: 0xffffff, vertexColors: true, roughness: .9, flatShading: true }));
  parts.forEach(g => g.dispose());
  mesh.position.set(x, 0, z); mesh.name = 'thornwood container'; mesh.receiveShadow = true;
  return mesh;
}

/** Free ground (nothing boxed within `pad` m): the play square's cover and landmarks stay clear of the dressing. */
function freeGround(pad: number) {
  const boxes = STAGE_LANDMARKS['thornwood-ward'] ?? [];
  return (x: number, z: number) => boxes.every(b => Math.abs(x - b.x) > b.halfX + pad || Math.abs(z - b.z) > b.halfZ + pad);
}

/** The road after the rain: puddles holding the Hex's violet in its dips, and grass and weeds in tufts out of its cracks,
 *  thicker toward the kerbs (one draw; low enough to wade through). */
function afterRain(c: DressContext) {
  const r = rand(5150), free = freeGround(.6), puddles: THREE.BufferGeometry[] = [], wet: THREE.BufferGeometry[] = [], spots: [number, number, number][] = [];
  for (let i = 0; i < 90 && puddles.length < 30; i++) {
    const x = (r() - .5) * 70, z = (r() - .5) * 70, sx = 1.2 + r() * 3.2, sz = .8 + r() * 1.8;
    if (!free(x, z) || Math.hypot(x, z) < 6 && r() < .7) continue;
    const g = new THREE.CircleGeometry(1, 28);
    const p = g.getAttribute('position') as THREE.BufferAttribute, k0 = r() * 6, k1 = r() * 6;
    for (let k = 1; k < p.count; k++) {
      const a = Math.atan2(p.getY(k), p.getX(k)), n = .78 + Math.sin(a * 3 + k0) * .12 + Math.sin(a * 5 + k1) * .08;
      p.setXY(k, p.getX(k) * n, p.getY(k) * n);
    }
    const turn = r() * Math.PI;
    wet.push(g.clone().rotateX(-Math.PI / 2).scale(sx * 1.14, 1, sz * 1.18).rotateY(turn).translate(x, -.021, z));
    g.rotateX(-Math.PI / 2).scale(sx, 1, sz).rotateY(turn).translate(x, -.015, z);
    puddles.push(g);
    spots.push([x, z, Math.max(sx, sz)]);
  }
  const water = new THREE.Mesh(mergeGeometries(puddles), stageMaterial(c.stage, 'Thornwood puddles', { color: 0x1a1c26, roughness: .05, metalness: .4,
    emissive: 0x3a1a6a, emissiveIntensity: .55, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  puddles.forEach(g => g.dispose());
  water.name = 'thornwood puddles'; water.receiveShadow = true;
  c.root.add(water);
  const damp = new THREE.Mesh(mergeGeometries(wet), stageMaterial(c.stage, 'Thornwood wet asphalt', { color: 0x40424a, roughness: .3, metalness: .06,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
  wet.forEach(g => g.dispose());
  damp.name = 'thornwood wet asphalt'; damp.receiveShadow = true;
  c.root.add(damp);

  const blades = drawn(128, 128, (g, w, h) => {
    const q = rand(41);
    g.clearRect(0, 0, w, h);
    for (let k = 0; k < 26; k++) {
      const x0 = w * (.2 + q() * .6), lean = (q() - .5) * 46, top = h * (.05 + q() * .45), tone = 60 + q() * 90;
      g.strokeStyle = `rgb(${tone * .62},${tone + 26},${tone * .4})`; g.lineWidth = 3 + q() * 4; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x0, h); g.quadraticCurveTo(x0 + lean * .3, h * .55, x0 + lean, top); g.stroke();
    }
  }, { repeat: false });
  const tufts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 2400 && tufts.length < 760; i++) {
    const x = (r() - .5) * 78, z = (r() - .5) * 78, edge = Math.max(Math.abs(x), Math.abs(z));
    if (r() > .18 + Math.max(0, edge - 22) * .05 || !free(x, z) || spots.some(([px, pz, s]) => Math.hypot(x - px, z - pz) < s)) continue;
    const hgt = .22 + r() * .32 + Math.max(0, edge - 26) * .02, wid = hgt * 1.4, turn = r() * Math.PI;
    for (const a of [0, Math.PI / 2]) tufts.push(new THREE.PlaneGeometry(wid, hgt).translate(0, hgt / 2 - .03, 0).rotateY(turn + a).translate(x, 0, z));
  }
  const grass = new THREE.Mesh(mergeGeometries(tufts), stageMaterial(c.stage, 'Thornwood tufts', { map: blades, alphaTest: .45, side: THREE.DoubleSide, roughness: .95, color: 0x6a7a5c  }));
  tufts.forEach(g => g.dispose());
  grass.name = 'thornwood tufts';
  c.root.add(grass);
}

/** The Hex: the colossal thorn-tree (own/thorn-tree.glb) burst up through an office tower in the north block, its sigils
 *  glowing violet and pulsing (own/thorn-tree-glow.webp); the tower split open round it, its two halves leaning apart, their
 *  windows lit violet. */
async function theHex(c: DressContext) {
  const { kit } = c, X = -8, Z = -74;
  const glowMap = await c.texture('/assets/environment/own/thorn-tree-glow.webp');
  glowMap.flipY = false; glowMap.colorSpace = THREE.SRGBColorSpace; glowMap.needsUpdate = true;
  kit.place('own/thorn-tree', { x: X, y: -3, z: Z, height: 118, rot: .4, shadow: false });
  kit.flush(c.stage);
  for (const m of kit.pieceMaterials('own/thorn-tree') as THREE.MeshStandardMaterial[]) {
    m.emissiveMap = glowMap; m.emissive.set(0xc060ff); m.emissiveIntensity = 2.6; m.needsUpdate = true;
    c.ambient.onUpdate(t => { m.emissiveIntensity = 2.6 * (.7 + .3 * Math.sin(t * 1.1) * Math.sin(t * .43 + 1)); });
  }
  const windows = drawn(256, 256, (g, w, h) => {
    g.fillStyle = '#3a3a3e'; g.fillRect(0, 0, w, h);
    const r = rand(707);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const lit = r() < .22, v = lit ? (r() < .5 ? '#b070ff' : '#7a4ad8') : (r() < .5 ? '#121214' : '#1c1c22');
      g.fillStyle = v; g.fillRect(x * 32 + 5, y * 32 + 6, 22, 18);
    }
  });
  const glow = drawn(256, 256, (g, w, h) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    const r = rand(707);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const lit = r() < .22, pick = r(); if (lit) { g.fillStyle = pick < .5 ? '#b070ff' : '#7a4ad8'; g.fillRect(x * 32 + 5, y * 32 + 6, 22, 18); } }
  });
  const parts: THREE.BufferGeometry[] = [], rr = rand(708);
  for (const side of [-1, 1]) {
    for (let k = 0; k < 7; k++) {
      const h = 9, y0 = k * h, w = 13 - (k > 4 ? rr() * 4 : 0), d = 28 - (k > 4 ? rr() * 8 : 0);
      if (k === 6 && rr() < .5) continue;
      const g = new THREE.BoxGeometry(w, h, d).translate(side * (w / 2 + 3.2), y0 + h / 2, 0);
      g.rotateZ(-side * .045 * (k / 6)).translate(X, -2, Z + 6);
      parts.push(g.toNonIndexed());
    }
  }
  const geometry = mergeGeometries(parts);
  parts.forEach(g => g.dispose());
  const p = geometry.getAttribute('position') as THREE.BufferAttribute, n = (geometry.computeVertexNormals(), geometry.getAttribute('normal')), uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i));
    const u = ax > .5 ? p.getZ(i) : p.getX(i), v = ay > .5 ? p.getZ(i) : p.getY(i);
    uv[i * 2] = u / 32; uv[i * 2 + 1] = v / 24;
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  windows.wrapS = windows.wrapT = glow.wrapS = glow.wrapT = THREE.RepeatWrapping;
  const material = stageMaterial(c.stage, 'Thornwood split tower', { map: windows, emissiveMap: glow, emissive: 0xffffff, emissiveIntensity: 1.4, roughness: .85 });
  const tower = new THREE.Mesh(geometry, heroAir(material, .2));
  tower.name = 'thornwood split tower';
  c.root.add(tower);
}

/** A few old signs still flickering on the blocks' faces, blank panels of violet, teal and rose light (no lettering), each
 *  blinking on its own beat. */
function signs(c: DressContext) {
  const r = rand(717), colours = [0xb060ff, 0x40e0d0, 0xff5aa8, 0x8a70ff], parts: THREE.BufferGeometry[] = [];
  const glow = new Beacons(c.root, 24, c.ambient.time);
  for (let i = 0; i < 16; i++) {
    const a = r() * Math.PI * 2, d = 46 + r() * 10, x = Math.sin(a) * d, z = Math.cos(a) * d;
    if (Math.abs(x) < 40 && Math.abs(z) < 40) continue;
    const y = 6 + r() * 18, w = 1.6 + r() * 2.4, h = 3 + r() * 5, col = colours[i % colours.length], face = Math.atan2(-x, -z);
    const g = new THREE.PlaneGeometry(w, h).rotateY(face).translate(x, y, z);
    parts.push(tinted(g.toNonIndexed(), col));
    glow.add(x, y, z, Math.max(w, h) * 1.8, col, r() < .4 ? 1.5 + r() * 3 : -1, r(), .6 + r() * .35);
  }
  glow.finish('thornwood signs', 1.6);
  if (!parts.length) return;
  const panels = new THREE.Mesh(mergeGeometries(parts), new THREE.MeshBasicMaterial({ name: 'thornwood sign panels', vertexColors: true, side: THREE.DoubleSide, toneMapped: false }));
  parts.forEach(g => g.dispose());
  panels.name = 'thornwood signs';
  c.root.add(panels);
}

/** The ward's ground: one floor of cracked asphalt with leafy grass taking it back along the cracks and toward the kerbs,
 *  and the blocks' pavements a step up past the square. */
function ground(c: DressContext, S: Record<'asphalt-cracked' | 'grass-leafy', Surface>) {
  const road = stageMaterial(c.stage, 'Thornwood road', { color: 0xffffff, roughness: 1 });
  worldFloor(road, S['asphalt-cracked'], 4.2, { normalScale: 1.2,
    over: { surface: S['grass-leafy'], tile: 2.6, amount: .3, edge: [12, 32], edgeAmount: .6, cracks: .75, scale: 6, tint: new THREE.Color(.34, .5, .32) } });
  road.color.setRGB(.95, 1.04, 1.32);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(260, 260, 1, 1).rotateX(-Math.PI / 2), road);
  floor.name = 'thornwood road'; floor.receiveShadow = true;
  c.root.add(floor);
  const f = new Forge(c, 'thornwood pavements');
  f.mat('slab', { map: detail.flags(9101, 80), tile: 2.4, roughness: .95 });
  for (const [x, z, w, d] of [[0, -46, 120, 8], [0, 46, 120, 8], [-46, 0, 8, 84], [46, 0, 8, 84]] as const) f.box('slab', x, 0, z, w, .16, d, 0x8a8e84);
  f.done();
}

/** The blocks round the plaza, ruined concrete towers with dark windows, their tops broken off, vines and moss swallowing
 *  them: the three corner buildings fill their boxes exactly, six ruined towers (own/thorn-tower.glb) and more blocks stand
 *  along the streets beyond. */
function blocks(c: DressContext) {
  const f = new Forge(c, 'thornwood blocks');
  f.mat('concrete', { map: windowsMap(), tile: 12, roughness: .92, air: .2 });
  f.mat('moss', { map: detail.rock(9110), tile: 3, roughness: 1, air: .2, flat: true });
  const ivy: THREE.BufferGeometry[] = [];
  const r = rand(9111), tones = [0x9a9c94, 0x8a8e88, 0xa4a49a, 0x7e827c, 0x949890];
  const tower = (x0: number, z0: number, x1: number, z1: number, h: number, tone: number) => {
    const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    f.box('concrete', cx, 0, cz, w, h, d, tone);
    for (let k = 0; k < 3; k++) f.box('concrete', cx + (r() - .5) * w * .5, h, cz + (r() - .5) * d * .5, w * (.3 + r() * .3), 2 + r() * 4, d * (.3 + r() * .3), tone, { tilt: (r() - .5) * .2, roll: (r() - .5) * .2 });
    for (let k = 0; k < 4; k++) f.rock('moss', cx + (r() - .5) * w, -.3, cz + (r() - .5) * d, 1.5 + r() * 2, .8 + r(), 1.5 + r() * 2, 0x3a5a30, 9120 + Math.round(cx + cz) + k);
    for (const [nx, nz, len, ox, oz] of [[1, 0, d, x1, cz], [-1, 0, d, x0, cz], [0, 1, w, cx, z1], [0, -1, w, cx, z0]] as const) {
      for (let k = 0; k < Math.max(1, Math.floor(len / 9)); k++) {
        if (r() < .35) continue;
        const along = (r() - .5) * (len - 4), vw = 3 + r() * 5, vh = h * (.4 + r() * .6), vx = ox + nx * .2 + (nz ? along : 0), vz = oz + nz * .2 + (nx ? along : 0);
        ivy.push(new THREE.PlaneGeometry(vw, vh).translate(0, h - vh / 2 + .5, 0).rotateY(Math.atan2(nx, nz)).translate(vx, 0, vz));
      }
    }
  };
  tower(-75, -75, -35.8, -35.2, 38, tones[0]);
  tower(32.6, -75, 75, -35.1, 46, tones[1]); tower(35.1, -35.1, 75, -30, 46, tones[1]); tower(32.6, -35.1, 35.1, -32.6, 46, tones[1]);
  tower(-75, 30, -36, 75, 30, tones[2]); tower(-36, 36.1, -30, 75, 30, tones[2]); tower(-36, 33, -33, 36.1, 30, tones[2]);
  for (const [x, z, h, rot] of [[-62, 8, 52, .4], [64, -6, 58, 2.1], [-20, 70, 46, 1.2], [26, 72, 54, -.6], [70, 44, 44, 2.8], [-70, -50, 50, -1.9]] as const)
    c.kit.place('own/thorn-tower', { x, z, height: h, rot, shadow: false });
  for (let i = 0; i < 18; i++) {
    const a = r() * Math.PI * 2, d = 58 + r() * 50, x = Math.sin(a) * d, z = Math.cos(a) * d, w = 14 + r() * 16, dd = 14 + r() * 16, h = 18 + r() * 40;
    if (Math.abs(x) < 50 && Math.abs(z) < 50) continue;
    if (Math.abs(x + 8) < 30 && z < -50) continue;
    tower(x - w / 2, z - dd / 2, x + w / 2, z + dd / 2, h, tones[i % tones.length]);
  }
  f.done();
  const vines = new THREE.Mesh(mergeGeometries(ivy), heroAir(stageMaterial(c.stage, 'Thornwood ivy', { map: ivyMap(), alphaTest: .45, side: THREE.DoubleSide, roughness: .9, color: 0x9ac080 }), .2));
  ivy.forEach(g => g.dispose());
  vines.name = 'thornwood ivy';
  c.root.add(vines);
}

/** The street furniture in its boxes: the kiosk (own/thorn-kiosk.glb), the caved-in stairway (own/thorn-stair.glb), rusted
 *  barriers, dead poles wrapped in creepers with nothing lit on them, one pole bent over. */
function street(c: DressContext) {
  const f = new Forge(c, 'thornwood street');
  f.mat('concrete', { map: detail.render(9130), tile: 2, roughness: .95 });
  f.mat('steel', { roughness: .6, metalness: .35 });
  f.mat('vine', { map: detail.rock(9131), tile: 1.5, roughness: 1, flat: true });
  f.mat('dark', { roughness: .9 });
  const boxes = STAGE_LANDMARKS['thornwood-ward'] ?? [];
  for (const b of boxes) {
    if (b.halfY > 2.4 && b.halfY < 2.8 && b.halfX > 2) {
      c.kit.place('own/thorn-kiosk', { x: b.x, z: b.z, width: b.halfX * 2 - .3, rot: Math.PI, shadow: false });
    } else if (b.halfY > 1.4 && b.halfY < 1.8 && b.halfZ > 2) {
      c.kit.place('own/thorn-stair', { x: b.x, z: b.z, width: b.halfX * 2 + .4, rot: 0, shadow: false });
    } else if (b.halfX < .3 && b.halfY > 2.5) {
      const top = b.halfY * 2 + .2;
      f.cyl('steel', b.x, 0, b.z, .12, .16, top, 0x4a504a, { sides: 8 });
      f.beam('steel', [b.x, top - .4, b.z], [b.x * .94, top - .1, b.z * .94], .1, 0x4a504a);
      for (let k = 0; k < 7; k++) { const a = k * 1.9; f.rock('vine', b.x + Math.cos(a) * .12, .3 + k * top / 8, b.z + Math.sin(a) * .12, .17, top / 14, .17, 0x355a2a, 9140 + k + Math.round(b.x * 3)); }
    } else if (b.halfY < .6 && (b.halfX < 1.1 || b.halfZ < 1.1)) {
      f.box('steel', b.x, 0, b.z, b.halfX * 2, b.halfY * 2, b.halfZ * 2, 0x8a5a3a);
    } else if (b.halfX < .3 && b.halfY < 1.5) {
      f.cyl('steel', b.x, 0, b.z, .14, .16, 2.6, 0x4a504a, { sides: 8 });
      f.beam('steel', [b.x, 2.5, b.z], [b.x + 4.5, 5.2, b.z - 2.5], .14, 0x4a504a);
    }
  }
  // The square's monument in its box (1.9 m square, 2.3 m high): a cold stone fire bowl on a stepped plinth, nothing lit
  // in it.
  const monument = (STAGE_PROPS['thornwood-ward'] ?? []).find(p => p.draw === 'monument');
  if (monument) {
    const { x, z } = monument;
    f.box('concrete', x, 0, z, 1.8, .34, 1.8, 0x7a8070, { rot: -2.2 });
    f.box('concrete', x, .34, z, 1.36, .26, 1.36, 0x7a8070, { rot: -2.2 });
    fireBowl(f, { iron: 'concrete', stone: 'concrete', glow: 'dark' }, x, .6, z, .62, 1.55, { tint: 0x7a8070, cold: true });
  }
  f.done();
}

/** Concrete with rows of dark windows, 4 m by 3 m a window, a few holding a dim violet. */
function windowsMap() {
  return drawn(256, 256, (g, w, h) => {
    g.fillStyle = '#8c8e88'; g.fillRect(0, 0, w, h);
    const r = rand(9150);
    for (let k = 0; k < 400; k++) { g.fillStyle = `rgba(${40 + r() * 40},${50 + r() * 40},${40 + r() * 30},.12)`; g.fillRect(r() * w, r() * h, 2 + r() * 12, 4 + r() * 30); }
    for (let y = 0; y < 4; y++) for (let x = 0; x < 3; x++) {
      const v = r() < .12 ? '#2a1e3a' : r() < .5 ? '#16181a' : '#202326';
      g.fillStyle = v; g.fillRect(x * 85 + 12, y * 64 + 14, 60, 38);
    }
  }, { repeat: true });
}
/** Ivy: leaves in strands, on clear. */
function ivyMap() {
  return drawn(256, 512, (g, w, h) => {
    const r = rand(17);
    g.clearRect(0, 0, w, h);
    for (let s = 0; s < 9; s++) {
      const x0 = r() * w, len = h * (.45 + r() * .55);
      for (let k = 0; k < 90; k++) {
        const t = k / 90, y = t * len, x = x0 + Math.sin(t * 9 + s) * 14 + (r() - .5) * 26;
        const tone = 40 + r() * 60;
        g.fillStyle = `rgb(${tone * .55},${tone + 30},${tone * .45})`;
        g.beginPath(); g.ellipse(x, y, 7 + r() * 8, 5 + r() * 6, r() * 3, 0, Math.PI * 2); g.fill();
      }
    }
  }, { repeat: false });
}
