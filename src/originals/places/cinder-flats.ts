import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { DressContext } from '../../render/stages/dressing';
import { stageMaterial } from '../../render/stages/build';
import { heroAir } from '../../render/stages/hero';
import { detail, Forge, noise2 } from './forge';
import { Beacons } from '../../render/stages/glow';
import { rand, tinted } from './remake';

/** The floor is flat out to FLAT (the play square's half is 26 m; the camera sees past the bounds). */
const FLAT = 42;
const CINDER = 0x463e3e, CINDER_LIT = 0x645852, // places-gen: lighter (the flat read black)
   BASALT = 0x1e1a1a, STONE = 0x3a3434, STONE_LIT = 0x5a504a, IRON = 0x2a2420, GLASS = 0x6a3aa0;
const dunes = noise2(301), ripple = noise2(302);
/** The cinder's height: flat out to FLAT, dunes rising beyond, a lava channel's bed sunk along its line. */
function height(x: number, z: number) {
  const d = Math.max(Math.abs(x), Math.abs(z));
  if (d < FLAT) return 0;
  const t = THREE.MathUtils.smoothstep(d, FLAT, FLAT + 40);
  return t * (dunes(x, z, 48) * 14 + dunes(x + 300, z, 15) * 4 + ripple(x, z, 3) * .4) - channel(x, z) * 2.2;
}
/** The lava channel: a winding line through the dunes, east to south-west, outside the flat. */
function channel(x: number, z: number) {
  const line = 70 + Math.sin(x * .012) * 30 + Math.sin(x * .031 + 1) * 10;
  return Math.max(0, 1 - Math.abs(z - line) / 5) * (Math.max(Math.abs(x), Math.abs(z)) > FLAT + 8 ? 1 : 0);
}

export async function dress(c: DressContext) {
  const { ambient } = c;
  await c.sky({ url: '/assets/environment/br/sky-cinder-ember.webp', rotation: 0, drift: .00005 });
  const f = new Forge(c, 'cinder');
  f.mat('cinder', { map: detail.gravel(303), tile: 4, roughness: 1, wear: { key: 'cinder-flats', scale: 1.2, light: [.82, 1.1], patch: 0x1a1414, patchAmount: .4 } });
  f.mat('stone', { map: detail.ashlar(304, 60), tile: 2.8, roughness: .92, air: .25 });
  f.mat('rock', { map: detail.rock(305), tile: 10, roughness: .95, air: .35 });
  f.mat('iron', { roughness: .5, metalness: .6 });
  f.mat('glow', { basic: true });
  f.mat('far', { map: detail.rock(306), tile: 30, roughness: 1, air: .8 });
  // places-epic-a: the beast's charred bone, its cracks glowing (the cracks' map as its glow, the world-metre mapping laying
  // them along every rib).
  const bone = f.mat('bone', { map: detail.rock(320), tile: 7, roughness: .82 }) as THREE.MeshStandardMaterial;
  bone.emissiveMap = emberCracks(); bone.emissive.set(0xff6420); bone.emissiveIntensity = 1.6;

  f.terrain('cinder', -600, -600, 600, 600, 10, height, (x, y, z) => channel(x, z) > .35 ? 0x1a1010 : y > 9 ? CINDER_LIT : CINDER);
  // The channel's lava glowing through its crust.
  const lava: [number, number][] = [];
  for (let x = -600; x <= 600; x += 12) lava.push([x, 70 + Math.sin(x * .012) * 30 + Math.sin(x * .031 + 1) * 10]);
  for (let i = 0; i + 1 < lava.length; i++) {
    const [x0, z0] = lava[i], [x1, z1] = lava[i + 1];
    if (Math.max(Math.abs(x0), Math.abs(z0)) < FLAT + 10) continue;
    f.slab('glow', [[x0, z0 - 1.6], [x1, z1 - 1.6], [x1, z1 + 1.6], [x0, z0 + 1.6]], height(x0, z0) + .3, i % 3 ? 0xe05a14 : 0xff9040);
  }
  flows(f);
  city(f);
  ribcage(f);
  f.done();
  await generated(c);
  c.root.add(fissures(c));
  const rock = [columns(), volcano()], merged = mergeGeometries(rock)!;
  rock.forEach(g => g.dispose());
  const mesh = new THREE.Mesh(merged, heroAir(stageMaterial(c.stage, 'Cinder rock', { color: 0xffffff, vertexColors: true, roughness: .92, flatShading: true, emissive: 0x1a0602, emissiveIntensity: .5 }), .35));
  mesh.name = 'cinder rock';
  c.root.add(mesh);

  const plume: { x: number; y: number; z: number; size: number }[] = [];
  // places-epic-a: the eruption's ash column out of the nearer, larger volcano (its crater at 177 m, 460 m north).
  for (let k = 0; k < 22; k++) plume.push({ x: VX + Math.sin(k) * 10 + k * 3, y: 190 + k * 18, z: VZ + Math.cos(k * 1.3) * 10, size: 60 + k * 9 });
  // ...and its fire: a column of flame and glowing ash over the crater, additive.
  const fire: { x: number; y: number; z: number; size: number }[] = [];
  for (let k = 0; k < 24; k++) fire.push({ x: VX + Math.sin(k * 2.1) * 14, y: 172 + k * 10, z: VZ + Math.cos(k * 1.7) * 14, size: 70 - k * 2 });
  ambient.puffs({ spots: fire, color: 0xffa040, shade: 0xff3a10, opacity: .8, life: 2.6, rise: 60, grow: .9, additive: true, seed: 43, order: 1 });
  // The crater's glow and the lava's on the cloud of ash over it.
  const crater = new Beacons(c.root, 3, ambient.time);
  crater.add(VX, 186, VZ, 150, 0xff6a20, -1, .2, 1); crater.add(VX, 300, VZ, 260, 0xc83a10, -1, .7, 1);
  crater.finish('cinder crater', 1.4);
  // The dead city's smoke, and steam off the vents among the wreck.
  for (let k = 0; k < 8; k++) plume.push({ x: 300 + Math.sin(k) * 20, y: 90 + k * 16, z: -380 + Math.cos(k) * 20, size: 40 + k * 6 });
  const r = rand(307);
  for (let i = 0; i < 10; i++) { const a = r() * Math.PI * 2, d = FLAT + 6 + r() * 40, x = Math.cos(a) * d, z = Math.sin(a) * d; for (let k = 0; k < 3; k++) plume.push({ x, y: height(x, z) + 1 + k * 2.5, z, size: 2.5 + k * 1.6 }); }
  // places-epic-a: the smoke and ash dark against the red sky, lit red underneath; ash falling, embers rising.
  ambient.puffs({ spots: plume, color: 0x5a2a20, shade: 0x1a0c0a, opacity: .6, life: 16, rise: 60, drift: [6, 0, 2], grow: 2, seed: 41, order: 0 });
  ambient.motes({ min: [-70, 0, -70], max: [70, 30, 70], count: 900, velocity: [.5, -1, .25], size: .09, color: 0x2a2222, color2: 0x5a4a44, opacity: .8, wobble: 1.4, seed: 42 });
  ambient.motes({ min: [-60, 0, -60], max: [60, 26, 60], count: 260, velocity: [.2, 1.1, .1], size: .07, color: 0xff7a2a, color2: 0xffc060, opacity: .9, additive: true, twinkle: .8, wobble: 1.2, seed: 44 });
}

/** Tongues of cooled lava lying over the dunes past the flat: low ropy lobes of black rock, their crust cracked. */
function flows(f: Forge) {
  const r = rand(311);
  for (let i = 0; i < 9; i++) {
    const a = r() * Math.PI * 2, d = FLAT + 12 + r() * 90;
    let x = Math.cos(a) * d, z = Math.sin(a) * d;
    const dir = a + Math.PI + (r() - .5) * 1.2;
    for (let k = 0; k < 7; k++) {
      x += Math.cos(dir + Math.sin(k) * .3) * 5; z += Math.sin(dir + Math.sin(k) * .3) * 5;
      if (Math.max(Math.abs(x), Math.abs(z)) < FLAT + 4) break;
      f.rock('rock', x, height(x, z) - .5, z, 4 - k * .3, .9, 3 - k * .2, (_x, y) => y > height(x, z) + .6 ? 0x2a2222 : BASALT, i * 20 + k, { rough: .3, rot: dir });
    }
  }
}

/** places-gen: the generated pieces (Tripo; own/cinder-*), each where r10 built its own: the nave north-west of the flat
 *  along r10's line, the spire's tip south-east, the bell north-east, the markers east, west and south, and basalt clusters
 *  round the flat's edge. */
async function generated(c: DressContext) {
  const { kit } = c, r = rand(312);
  await kit.load(['own/cinder-nave', 'own/cinder-spire', 'own/cinder-bell', 'own/cinder-markers', 'own/cinder-columns']);
  kit.place('own/cinder-nave', { x: -34, y: height(-34, -60) - 2.5, z: -60, height: 26, rot: Math.PI / 2 + .35 });
  kit.place('own/cinder-spire', { x: 60, y: height(60, 26) - 2, z: 26, height: 14, rot: .7 });
  kit.place('own/cinder-bell', { x: 30, y: height(30, -54) - 1, z: -54, height: 9, rot: Math.atan2(-30, -54) });
  for (const [cx, cz] of [[FLAT + 12, -10], [-FLAT - 14, 16], [-8, FLAT + 14], [10, FLAT + 12]] as const)
    kit.place('own/cinder-markers', { x: cx, y: height(cx, cz) - .3, z: cz, height: 2.8 + r() * .8, rot: Math.atan2(-cx, -cz) + (r() - .5) * .4 });
  for (let k = 0; k < 5; k++) {
    const a = k / 5 * Math.PI * 2 + .4, d = FLAT + 4 + r() * 10, x = Math.cos(a) * d, z = Math.sin(a) * d;
    kit.place('own/cinder-columns', { x, y: height(x, z) - .5, z, height: 5 + r() * 5, rot: r() * 6.3 });
  }
  kit.flush(c.stage);
}

/** The dead city on the north-east horizon: black needle spires crowding a ridge, violet glass glinting in their windows. */
function city(f: Forge) {
  const r = rand(313), cx = 300, cz = -380;
  f.rock('far', cx, -10, cz, 160, 30, 70, 0x1a1616, 9, { rough: .2, rot: .6 });
  for (let i = 0; i < 46; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 110, x = cx + Math.cos(a) * d * 1.6, z = cz + Math.sin(a) * d * .6, h = 30 + r() * (d < 40 ? 110 : 60), w = 4 + r() * 6;
    f.box('far', x, 0, z, w, h * .7, w, 0x161214, { rot: r() * 3 });
    f.add('far', new THREE.ConeGeometry(w * .75, h * .45, 6).translate(x, h * .7 + h * .225, z), 0x161214);
    if (r() < .6) f.add('glow', new THREE.PlaneGeometry(w * .4, h * .12).rotateY(Math.atan2(-x, -z)).translate(x - Math.sin(Math.atan2(x, z)) * (w * .55), h * .5, z - Math.cos(Math.atan2(x, z)) * (w * .55)), GLASS);
  }
}

/** r7's fissures: branching cracks glowing with the heat under the plain, laid flat a hair over it (nothing to trip on),
 *  brighter where they are wide. One additive draw. */
function fissures(c: DressContext) {
  const r = rand(1313), parts: THREE.BufferGeometry[] = [];
  const crack = (x: number, z: number, a: number, len: number, w: number, depth: number) => {
    for (let s = 0; s < len; s += 1.4) {
      const nx = x + Math.cos(a) * 1.4, nz = z + Math.sin(a) * 1.4;
      const q = new THREE.PlaneGeometry(1.5, w).rotateX(-Math.PI / 2).rotateY(-a).translate((x + nx) / 2, .03 + depth * .002 + height((x + nx) / 2, (z + nz) / 2), (z + nz) / 2);
      tinted(q, w > .4 ? 0xffa040 : 0xc84a10);
      parts.push(q);
      x = nx; z = nz; a += (r() - .5) * .7; w *= .97;
      if (depth < 2 && r() < .08) crack(x, z, a + (r() < .5 ? 1 : -1) * (.6 + r() * .6), len * .4, w * .7, depth + 1);
    }
  };
  for (let i = 0; i < 26; i++) { const a = r() * Math.PI * 2, d = 8 + r() * 34; crack(Math.cos(a) * d, Math.sin(a) * d, r() * 6.28, 10 + r() * 24, .25 + r() * .5, 0); }
  const geometry = mergeGeometries(parts)!;
  parts.forEach(g => g.dispose());
  const material = new THREE.MeshBasicMaterial({ name: 'Cinder fissures', vertexColors: true, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false, // places-epic-a: brighter
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'cinder fissures'; mesh.renderOrder = 2;
  return mesh;
}

/** r7's clusters of basalt columns standing out of the dunes past the floor: hexagonal prisms of many heights. */
function columns() {
  const r = rand(77), parts: THREE.BufferGeometry[] = [];
  for (let k = 0; k < 14; k++) {
    const a = k / 14 * Math.PI * 2 + r() * .3, d = 62 + r() * 90, cx = Math.cos(a) * d, cz = Math.sin(a) * d, n = 8 + Math.floor(r() * 14);
    for (let i = 0; i < n; i++) {
      const rr = 1.1 + r() * .5, h = 3 + r() * (d > 100 ? 26 : 14), x = cx + (r() - .5) * 9, z = cz + (r() - .5) * 9, y0 = height(x, z) - 1;
      parts.push(tinted(new THREE.CylinderGeometry(rr, rr * 1.04, h, 6).translate(x, y0 + h / 2, z).toNonIndexed(), y => y > y0 + h - 1.3 ? 0x3a3432 : BASALT));
    }
  }
  const geometry = mergeGeometries(parts)!;
  parts.forEach(g => g.dispose());
  return geometry;
}

/** r7's volcano on the north horizon: a broad cone of dark rock, its crater glowing, lava runs down its face. places-epic-a:
 *  erupting, nearer (460 m) and half as large again. */
const VX = -60, VZ = -460, VS = 1.5;
function volcano() {
  const g = new THREE.LatheGeometry([[0, 118], [34, 118], [40, 112], [90, 60], [170, 10], [240, -20]].map(([x, y]) => new THREE.Vector2(x * VS, y * VS)), 36).translate(VX, 0, VZ);
  const p = g.getAttribute('position') as THREE.BufferAttribute, r = rand(9);
  for (let i = 0; i < p.count; i++) if (p.getY(i) < 116 * VS) { const k = .92 + r() * .16; p.setX(i, VX + (p.getX(i) - VX) * k); p.setZ(i, VZ + (p.getZ(i) - VZ) * k); }
  const flat = g.toNonIndexed();
  g.dispose();
  flat.deleteAttribute('uv'); flat.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(flat.getAttribute('position').count * 2), 2));
  tinted(flat, (y, x, z) => {
    const a = Math.atan2(z - VZ, x - VX), run = Math.abs(Math.sin(a * 5)) < .08 && y > 20;
    return y > 115 * VS ? 0xffa040 : run ? 0xff5a10 : 0x241c1c;
  });
  return flat;
}


/** places-epic-a: the cracks glowing in the beast's charred bone, drawn in code: branching lines of ember on black (tiles). */
function emberCracks() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
  const g = canvas.getContext('2d')!, r = rand(321);
  g.fillStyle = '#000'; g.fillRect(0, 0, 512, 512);
  g.lineCap = 'round'; g.shadowColor = '#ff8030'; g.shadowBlur = 6;
  const crack = (x: number, y: number, a: number, len: number, w: number, depth: number) => {
    g.strokeStyle = depth ? '#c84a10' : '#ffb050'; g.lineWidth = w;
    g.beginPath(); g.moveTo(x, y);
    for (let s = 0; s < len; s += 8) {
      a += (r() - .5) * .6; x += Math.cos(a) * 8; y += Math.sin(a) * 8; g.lineTo(x, y);
      if (depth < 2 && r() < .06) { g.stroke(); crack(x, y, a + (r() < .5 ? 1 : -1) * (.5 + r() * .7), len * .45, w * .6, depth + 1); g.beginPath(); g.moveTo(x, y); g.strokeStyle = depth ? '#c84a10' : '#ffb050'; g.lineWidth = w; }
    }
    g.stroke();
  };
  for (let i = 0; i < 6; i++) crack(r() * 512, r() * 512, r() * 6.28, 120 + r() * 200, 2.2 + r() * 1.8, 0);
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}

/** places-epic-a: the colossal dead beast lying on its side over the flat: its spine half sunk in the cinder past the west
 *  edge, nine ribs rising from it and arching 50 m high over the whole flat to dig in past the east edge (the play square's
 *  half is 26 m: the ribs stand clear of it and pass far over the fight), spurs along them, the end ribs broken short. */
function ribcage(f: Forge) {
  const r = rand(331), SPINE_X = -54, TIP_X = 47;
  // The spine: vertebrae half sunk along the west, each with its spur.
  for (let k = 0; k < 15; k++) {
    const z = -70 + k * 10, s = 3.2 + Math.sin(k / 14 * Math.PI) * 1.6;
    f.rock('bone', SPINE_X + (r() - .5) * 2, -s * .5, z, s * 1.2, s, s * 1.1, 0x2a2220, 400 + k, { rough: .25, detail: 1 });
    f.add('bone', new THREE.ConeGeometry(s * .45, s * 2.6, 6).rotateZ(.5).translate(SPINE_X - s * .8, s * 1.2, z), 0x241c1a);
  }
  for (let k = 0; k < 9; k++) {
    const z = -56 + k * 14 + (r() - .5) * 5, tall = Math.sin((k + .5) / 9 * Math.PI), H = 30 + tall * 22 + (r() - .5) * 6, lean = (k - 4) * 1.6;
    const broken = k === 0 || k === 8 || k === 5;
    const pts = [[SPINE_X + 2, 0], [SPINE_X + 5, H * .45], [SPINE_X + 18, H * .86], [-8, H], [14, H * .9], [32, H * .58], [TIP_X - 2, H * .2], [TIP_X, -3]]
      .slice(0, broken ? (k === 5 ? 6 : 4) : 8)
      .map(([x, y], i) => new THREE.Vector3(x, y, z + lean * i / 7 + Math.sin(i * 1.3 + k) * .8));
    const curve = new THREE.CatmullRomCurve3(pts), segs = 44, radial = 9;
    const g = new THREE.TubeGeometry(curve, segs, 1, radial, false), p = g.getAttribute('position') as THREE.BufferAttribute;
    const c = new THREE.Vector3(), v = new THREE.Vector3();
    for (let i = 0; i <= segs; i++) {
      // Flat bone, thick at the spine, a knob at its root and at its joints, thinning to the tip.
      const t = i / segs, rad = (2.6 - t * (broken ? .8 : 1.6)) * (1 + .1 * Math.sin(t * 19 + k) + (t < .06 ? (.06 - t) * 9 : 0) + .16 * Math.exp(-(((t - .46) / .03) ** 2)));
      curve.getPointAt(t, c);
      for (let j = 0; j <= radial; j++) {
        const idx = i * (radial + 1) + j;
        v.fromBufferAttribute(p, idx).sub(c);
        v.z *= .5; v.x *= 1.3; v.y *= 1.3;
        v.multiplyScalar(rad).add(c);
        p.setXYZ(idx, v.x, v.y, v.z);
      }
    }
    f.add('bone', g, (_x, y) => y < 1 ? 0x1c1614 : 0x2e2624);
    // Spurs along its outer side.
    for (let t = .12; t < (broken ? .8 : .92); t += .09 + r() * .05) {
      curve.getPointAt(t, c); const tan = curve.getTangentAt(t), out = new THREE.Vector3(-tan.y, tan.x, 0).normalize();
      const len = 2 + r() * 3.5, cone = new THREE.ConeGeometry(.5, len, 5);
      cone.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), out)).translate(c.x + out.x * (2 + len / 2), c.y + out.y * (2 + len / 2), c.z);
      f.add('bone', cone, 0x261e1c);
    }
    // A broken rib's jagged end.
    if (broken) { const end = pts[pts.length - 1]; f.rock('bone', end.x, end.y - 1.2, end.z, 2, 1.6, 2, 0x2a2220, 500 + k, { rough: .5, detail: 0 }); }
  }
}
