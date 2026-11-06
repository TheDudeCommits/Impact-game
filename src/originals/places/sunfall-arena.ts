import * as THREE from 'three';
import type { DressContext } from '../../render/stages/dressing';
import { Beacons } from '../../render/stages/glow';
import { crowdCards, figureAtlas, type CrowdSpot } from '../../render/stages/crowd';
import { mountainRidges } from '../../render/stages/hero';
import { Forge, fromTris, noise2 } from './forge';
import { surfaces } from './cc0';
import { drawn, rand } from './remake';

/** The dial's radius, the sand's level round it, the galleries' first face (x) and each gallery's step back and rise. */
const DIAL = 20, SAND = -.5, CLIFF = 29, STEP = 4.2, RISE = 5.6; // places-gen: the galleries 4 m nearer the dial (33 m), their crowd in the fight's frame
/** The canyon's length (z) between its mouths. */
const Z0 = -50, Z1 = 38;
const ROSE = 0xd89a78, RED = 0xa8543a, BRONZE = 0xc8923e, SANDY = 0xe0b07a;

/** The galleries' face line at z: a shallow arc, concave to the dial. */
const face = (k: number, z: number) => CLIFF + k * STEP + .0035 * z * z;
const ledge = (k: number) => RISE * (k + 1) - 1.6;

export async function dress(c: DressContext) {
  const { ambient } = c;
  const [S] = await Promise.all([
    surfaces(c, ['sandstone-red', 'sandstone-cracked', 'sand-red'] as const),
    c.kit.load(['cc0/cliff-a', 'cc0/cliff-b', 'cc0/boulder-a', 'cc0/boulder-b', 'cc0/desert-tree', 'cc0/dead-trunk',
      'own/sunfall-king', 'own/sunfall-lion', 'own/sunfall-gate', 'own/sunfall-pavilion', 'own/sunfall-brazier', 'own/sunfall-jars']),
    c.sky({ url: '/assets/environment/br/sky-sunfall-arena.webp', rotation: 0, drift: .0002 }),
  ]);
  const f = new Forge(c, 'sunfall');
  f.mat('dial', { map: dialMap(), tile: 2 * DIAL, roughness: .8, metalness: .08, normalMap: tiled(S['sandstone-red'].normalMap, 2 * DIAL / 3.2), roughnessMap: tiled(S['sandstone-red'].roughnessMap, 2 * DIAL / 3.2), normalScale: .8, wear: { key: 'sunfall-dial', scale: .9, light: [.88, 1.04], patch: 0xd8b088, patchAmount: .25 } });
  f.mat('stone', { ...S['sandstone-red'], tile: 3.2, roughness: 1, shadow: true, lift: .55 });
  f.mat('rock', { ...S['sandstone-cracked'], tile: 7, roughness: 1, lift: .45 });
  f.mat('sand', { ...S['sand-red'], tile: 5, roughness: 1, air: .45, lift: .6 });
  f.mat('bronze', { roughness: .38, metalness: .62, shadow: true });
  f.mat('cloth', { roughness: 1, side: THREE.DoubleSide });
  f.mat('dark', { roughness: 1 });
  f.mat('glow', { basic: true });
  dial(f);
  gnomon(f);
  const galleries = cliffs(f);
  sunRing(f);
  const fires = [...obelisks(f), ...SUN_BRAZIERS.map(([x, z]) => ({ x, y: SAND + 3.15, z, size: 1 }))];
  sand(f);
  f.done();
  monuments(c);
  rocks(c);
  c.root.add(mountainRidges({ radius: 460, count: 18, seed: 64, base: -8, height: [40, 90], far: 0x9a5a4a, near: 0x6a3a30, crest: 0xe8a070 }));
  crowd(c, galleries);
  banners(c);

  const glow = new Beacons(c.root, 32, ambient.time);
  for (const s of fires) glow.add(s.x, s.y + .5, s.z, 2.4, 0xff9040, -1, (s.x * .013 + s.z * .007 + 1) % 1, 1);
  glow.finish('sunfall fires', 2);
  ambient.puffs({ spots: fires, color: 0xffc060, shade: 0xff5014, opacity: .6, life: 1.1, rise: 2, grow: .6, additive: true, seed: 51, order: 1 });
  // Sand on the wind, low; heat's motes of light; vultures over the canyon.
  ambient.motes({ min: [-60, -1, -60], max: [60, 4, 60], count: 260, velocity: [2.2, .05, .6], size: .05, color: 0xd8a870, color2: 0xf0c890, opacity: .6, wobble: .4, seed: 52 });
  ambient.motes({ min: [-40, 0, -40], max: [40, 12, 40], count: 80, velocity: [.2, .5, .1], size: .05, color: 0xffd090, color2: 0xff9a50, opacity: .7, additive: true, twinkle: .6, wobble: 1, seed: 53 });
  ambient.birds({ centre: [0, 0, 10], count: 6, radius: 60, height: 55, spread: 10, speed: 6, size: 1.4, color: 0x1a100c, seed: 54 });
}

/** A copy of a scanned surface's map laid `times` over the dial's one picture (the dial's colour is painted once across it;
 *  its relief and wear repeat at the sandstone's own scale). */
function tiled(map: THREE.Texture, times: number) {
  const t = map.clone();
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(times, times); t.needsUpdate = true;
  return t;
}

/** The sundial's face, painted in its own colours (the material's tint is white): rings of rose sandstone flags with radial
 *  joints, each flag its own shade, a bronze rim, twelve bronze hour lines with a lozenge at each end, an inner ring and the
 *  Last Sun's mark in the middle (a half-sun over three bars), drifted sand and scuffs. No lettering. */
function dialMap() {
  const t = drawn(1024, 1024, (g, w, h) => {
    const r = rand(65), cx = w / 2, cy = h / 2, R = w / 2;
    g.fillStyle = '#8a6a50'; g.fillRect(0, 0, w, h);
    // Rings of flags: each ring cut into flags of about the same length, a dark joint between.
    const rings = [.18, .27, .36, .45, .54, .63, .72, .81, .9, .955];
    for (let i = rings.length - 1; i >= 0; i--) {
      const outer = rings[i] * R, inner = (i ? rings[i - 1] : 0) * R, n = Math.max(6, Math.round(outer * Math.PI * 2 / 70));
      for (let k = 0; k < n; k++) {
        const a0 = k / n * Math.PI * 2 + i * .21, a1 = (k + 1) / n * Math.PI * 2 + i * .21, shade = r();
        // places-gen: pale cream limestone flags (the rose sandstone sank the fight in orange), every other flag of one ring
        // glazed turquoise.
        const blue = i === 6 && k % 2 === 0, cr = blue ? 60 + shade * 30 : 226 + shade * 24, cg = blue ? 168 + shade * 30 : 204 + shade * 26, cb = blue ? 168 + shade * 24 : 172 + shade * 26;
        g.fillStyle = `rgb(${cr | 0},${cg | 0},${cb | 0})`;
        g.beginPath(); g.arc(cx, cy, outer - 1.5, a0 + .004, a1 - .004); g.arc(cx, cy, inner + 1.5, a1 - .004, a0 + .004, true); g.closePath(); g.fill();
      }
    }
    const bronze = (width: number) => { g.strokeStyle = '#a8742e'; g.lineWidth = width; };
    // The rim, the inner ring, and the twelve hour lines between them, a lozenge at each line's outer end.
    bronze(14); g.beginPath(); g.arc(cx, cy, .975 * R, 0, Math.PI * 2); g.stroke();
    bronze(7); g.beginPath(); g.arc(cx, cy, .2 * R, 0, Math.PI * 2); g.stroke();
    bronze(4); g.beginPath(); g.arc(cx, cy, .62 * R, 0, Math.PI * 2); g.stroke();
    for (let k = 0; k < 12; k++) {
      const a = k / 12 * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      bronze(k % 3 ? 4 : 7); g.beginPath(); g.moveTo(cx + ca * .2 * R, cy + sa * .2 * R); g.lineTo(cx + ca * .93 * R, cy + sa * .93 * R); g.stroke();
      const lx = cx + ca * .9 * R, ly = cy + sa * .9 * R, s = k % 3 ? 10 : 18;
      g.fillStyle = '#b8823a'; g.beginPath(); g.moveTo(lx + ca * s * 1.6, ly + sa * s * 1.6); g.lineTo(lx - sa * s, ly + ca * s); g.lineTo(lx - ca * s * 1.6, ly - sa * s * 1.6); g.lineTo(lx + sa * s, ly - ca * s); g.closePath(); g.fill();
    }
    // The Last Sun's mark: a half-sun with its rays over three bars of horizon, in bronze on dark stone.
    g.fillStyle = '#4a2a20'; g.beginPath(); g.arc(cx, cy, .19 * R, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#c8923e';
    g.beginPath(); g.arc(cx, cy + 6, 46, Math.PI, 0); g.fill();
    for (let k = 0; k < 9; k++) { const a = Math.PI + (k + .5) / 9 * Math.PI; g.save(); g.translate(cx + Math.cos(a) * 56, cy + 6 + Math.sin(a) * 56); g.rotate(a + Math.PI / 2); g.fillRect(-3, -14, 6, 20); g.restore(); }
    for (const [y, bw] of [[18, 120], [34, 90], [50, 60]] as const) g.fillRect(cx - bw / 2, cy + y, bw, 9);
    // Drifted sand in soft fans, scuffs, speckle.
    for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(236,196,140,${.05 + r() * .12})`; g.beginPath(); g.ellipse(r() * w, r() * h, 30 + r() * 90, 10 + r() * 30, r() * 3, 0, 7); g.fill(); }
    for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(60,30,20,${r() * .12})`; g.fillRect(r() * w, r() * h, 2 + r() * 14, 1 + r() * 2); }
    for (let i = 0; i < 6000; i++) { g.fillStyle = r() < .5 ? 'rgba(0,0,0,.06)' : 'rgba(255,240,220,.06)'; g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2); }
  }, { repeat: false });
  t.offset.set(.5, .5);
  return t;
}

/** The dial: its face flush at the floor, a drum of cut stone under it, one low kerb ring stepping down to the sand. */
function dial(f: Forge) {
  f.add('dial', new THREE.CircleGeometry(DIAL, 96).rotateX(-Math.PI / 2), 0xffffff);
  f.cyl('stone', 0, SAND - .3, 0, DIAL, DIAL, -SAND + .28, 0xb87a5c, { sides: 96 });
  f.cyl('stone', 0, SAND - .3, 0, DIAL + 1.1, DIAL + 1.1, .55, 0x9a5e46, { sides: 96 });
}

/** The gnomon north of the dial: a bronze blade 2.4 m thick, its sloped edge rising from 27 m out to 44 m up at 74 m,
 *  turned a little to the dial, on a plinth of three steps; its foot banded. */
function gnomon(f: Forge) {
  const yaw = .32, cz = 50, ca = Math.cos(yaw), sa = Math.sin(yaw);
  const plinth = (w: number, d: number, y: number, h: number, tint: number) => f.box('stone', 0, y, cz, w, h, d, tint, { rot: yaw });
  plinth(18, 54, SAND, 1.2, 0xb07454); plinth(14, 50, SAND + 1.2, 1.2, 0xc0845e); plinth(10, 46, SAND + 2.4, 1.2, 0xb07454);
  const base = SAND + 3.6, t = 1.2;
  // The blade's side profile (u along its length from the dial, v up): the low end, the high end, the top's chamfer;
  // extruded across its thickness, then laid along the plinth.
  const shape = new THREE.Shape([new THREE.Vector2(-22, 0), new THREE.Vector2(22, 0), new THREE.Vector2(22, 41), new THREE.Vector2(19, 44)]);
  const blade = new THREE.ExtrudeGeometry(shape, { depth: 2 * t, bevelEnabled: false }).translate(0, 0, -t).rotateY(yaw - Math.PI / 2).translate(0, base, cz);
  f.add('bronze', blade, (_x: number, y: number) => y < base + 3 ? 0x4a321a : y > base + 38 ? 0xa8742e : 0x6a4422);
  // Bands round its foot and a bronze sun on its high end.
  for (const u of [-14, -4, 6, 16]) f.box('bronze', sa * u, base, cz + ca * u, 3.4, .7, 1.4, 0x8a6430, { rot: yaw });
  f.add('bronze', new THREE.TorusGeometry(3.2, .5, 8, 24).rotateY(yaw + Math.PI / 2).translate(sa * 20.5, base + 46, cz + ca * 20.5), 0xd8a040);
}

/** The canyon's cliffs, east and west: three galleries cut back into the rock (a face, a ledge with a low parapet where the
 *  crowd stands, an awning over it), rock-cut doorways and pilasters in each face (the natural cliff over them and the
 *  boulders at its ends are photographed rock: rocks). Returns each gallery's ledge (side, tier) for the crowd. */
function cliffs(f: Forge) {
  const galleries: { s: number; k: number }[] = [];
  const segs = 12, dz = (Z1 - Z0) / segs;
  for (const s of [-1, 1]) {
    for (let k = 0; k < 3; k++) {
      const y = ledge(k), y0 = k ? ledge(k - 1) : SAND;
      // The tier's rock, its plan the arc in front and the cliff's back behind.
      const path: [number, number][] = [];
      for (let i = 0; i <= segs; i++) { const z = Z0 + i * dz; path.push([s * face(k, z), z]); }
      path.push([s * 90, Z1], [s * 90, Z0]);
      f.slab('rock', path, y, k % 2 ? RED : 0xb05c40, y - SAND + .5);
      // Doorways and pilasters along the face.
      for (let i = 0; i < segs; i++) {
        const z = Z0 + (i + .5) * dz, x = s * (face(k, z) - .05), rot = Math.atan(s * .007 * z);
        const hh = y - y0;
        if (i % 2 === 0 || k === 0) {
          const dw = k === 0 && i % 4 === 2 ? 3.4 : 1.8, dh = Math.min(hh - 1.2, k === 0 && i % 4 === 2 ? 4.2 : 2.8);
          f.box('dark', x, y0, z, .2, dh, dw, 0x1a0e0a, { rot });
          f.box('stone', x - s * .12, y0 + dh, z, .35, .5, dw + .9, 0xc88a64, { rot });
          for (const e of [-1, 1]) f.box('stone', x - s * .12, y0, z + e * (dw / 2 + .25), .35, dh, .45, 0xb87a58, { rot });
        }
        f.box('stone', x - s * .15, y0, z + dz / 2, .5, hh, .7, 0xa86a4c, { rot });
      }
      // The ledge's front: a low parapet; the awning's poles along it and the awning sloping back to the face over it.
      {
        for (let i = 0; i < segs; i++) {
          const za = Z0 + i * dz, zb = za + dz, xa = s * (face(k, za) + .4), xb = s * (face(k, zb) + .4);
          f.beam('stone', [xa, y + .45, za], [xb, y + .45, zb], .45, 0xb87a58, .9);
          // places-gen: no awning where the Champions' Gate and the royal pavilion over it rise.
          if (k < 2 && Math.abs((za + zb) / 2 - GATE_Z) > 6) {
            const fa = s * face(k + 1, za), fb = s * face(k + 1, zb), top = ledge(k + 1) - .3;
            const tint = AWNINGS[(i + k * 2 + (s > 0 ? 1 : 0)) % AWNINGS.length];
            f.add('cloth', fromTris([[xa, y + 3.1, za + .2], [xb, y + 3.1, zb - .2], [fb, top, zb - .2], [fa, top, za + .2]], [[0, 1, 2], [0, 2, 3]]), tint);
            f.pipe('stone', [xa, y, za], [xa, y + 3.2, za], .1, 0x4a3020);
          }
        }
        galleries.push({ s, k });
      }
    }
  }
  return galleries;
}

/** places-gen: the festival's awnings, in turn (crimson, saffron, turquoise, indigo, white, rose). */
const AWNINGS = [0xb02a24, 0xe8a028, 0x1a9a96, 0x3a3a8c, 0xf0e4d0, 0xd0583a];
/** places-gen: where the Champions' Gates stand in the galleries (z), the royal pavilions over them, and the sun-braziers round
 *  the dial's kerb (x, z: eight, clear of the lions on the Duel's line). */
const GATE_Z = -6, SUN_BRAZIERS = [35, 75, 105, 145, -35, -75, -105, -145].map(d => [Math.sin(d * Math.PI / 180) * 22.4, Math.cos(d * Math.PI / 180) * 22.4] as const);

function monuments(c: DressContext) {
  const { kit } = c;
  for (const end of [1, -1]) for (const s of [-1, 1]) {
    kit.place('own/sunfall-king', { x: s * 14.5, y: SAND, z: end * 28, height: 15, rot: end > 0 ? Math.PI + s * .25 : -s * .25 });
    kit.place('own/sunfall-lion', { x: s * 6.8, y: SAND, z: end * 23.4, height: 3.6, rot: end > 0 ? Math.PI + s * .2 : -s * .2 });
  }
  for (const [x, z] of SUN_BRAZIERS) kit.place('own/sunfall-brazier', { x, y: SAND, z, height: 3.6, rot: x + z });
  for (const s of [-1, 1]) {
    const x = s * (face(0, GATE_Z) + .9), rot = -s * Math.PI / 2;
    kit.place('own/sunfall-gate', { x, y: SAND, z: GATE_Z, height: 10.4, rot });
    kit.place('own/sunfall-pavilion', { x: s * (face(1, GATE_Z) + 2.2), y: ledge(1), z: GATE_Z, height: 5, rot });
    for (const z of [-30, 9, 22]) kit.place('own/sunfall-jars', { x: s * (face(0, z) - 1.4), y: SAND, z, height: 1.5, rot: rot + z * .1 });
  }
}

/** The photographed rock (Poly Haven's scanned cliffs and boulders, CC0), reddened to the canyon's stone: the natural cliff
 *  over each side's galleries, ragged against the sky, boulders heaped at the canyon's mouths and strewn on the sand past
 *  the dial, quiver trees and dead trunks on the dunes. */
function rocks(c: DressContext) {
  const { kit } = c, r = rand(166), n = noise2(167);
  for (const s of [-1, 1]) {
    // places-gen (the perf census: stage triangles are drawn three times): six wider cliffs a side where ten stood, three
    // pieces to each mouth's heap where five did, fewer boulders and trees; the scanned pieces decimated (packed/cc0).
    for (let i = 0; i <= 5; i++) {
      const z = Z0 - 6 + i * (Z1 - Z0 + 12) / 5, x = s * (face(2, z) + STEP + 3 + r() * 4), h = 24 + n(z * .05, s) * 18;
      kit.place(i % 3 ? 'cc0/cliff-b' : 'cc0/cliff-a', { x, y: ledge(2) - 3, z, height: h, sx: 1.9, rot: -s * Math.PI / 2 + (r() - .5) * .5, tint: i % 2 ? 0xe09a78 : 0xd08868 });
    }
    for (const z of [Z0 - 4, Z1 + 4]) for (let k = 0; k < 3; k++) {
      const x = s * (CLIFF - 2 + k * 6 + r() * 3);
      kit.place(k % 2 ? 'cc0/cliff-a' : 'cc0/boulder-a', { x, y: SAND - .4, z: z + (z > 0 ? 1 : -1) * r() * 6, height: 5 + k * 3 + r() * 4, rot: r() * 6.3, tint: 0xd89070 });
    }
  }
  for (let i = 0; i < 14; i++) {
    const a = r() * Math.PI * 2, d = DIAL + 6 + r() * 30, x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (Math.abs(x) > CLIFF - 3) continue;
    kit.place(r() < .5 ? 'cc0/boulder-b' : 'cc0/boulder-a', { x, y: SAND - .2, z, height: .6 + r() * 1.6, rot: r() * 6.3, tint: 0xe0a080 });
  }
  for (let i = 0; i < 10; i++) {
    const north = i % 2 === 0, x = (r() - .5) * 120, z = north ? Z1 + 14 + r() * 50 : Z0 - 14 - r() * 40;
    if (Math.abs(x) < 10 && !north) continue;
    kit.place(r() < .65 ? 'cc0/desert-tree' : 'cc0/dead-trunk', { x, y: SAND, z, height: 4 + r() * 4, rot: r() * 6.3, tint: 0xf0d8c0 });
  }
  kit.flush(c.stage);
}

/** r7's bronze sun-ring on its two pylons at the canyon's south mouth, framing the swollen sun: 46 m across, rays round it. */
function sunRing(f: Forge) {
  const rz = -66, ry = 31, R = 23;
  f.add('bronze', new THREE.TorusGeometry(R, 1.6, 8, 64).translate(0, ry, rz), BRONZE);
  f.add('bronze', new THREE.TorusGeometry(R - 3, .5, 6, 64).translate(0, ry, rz), 0x8a5a24);
  for (let k = 0; k < 24; k++) {
    const a = k / 24 * Math.PI * 2, long = k % 2 ? 3.5 : 6.5;
    f.add('bronze', new THREE.BoxGeometry(.9, long, .6).translate(0, R + 1.6 + long / 2, 0).rotateZ(a).translate(0, ry, rz), 0xd8a040);
  }
  for (const s of [-1, 1]) {
    const x = s * R * .62, h = ry - R + 4 - SAND;
    f.box('stone', x, SAND, rz, 5.4, h, 5.4, 0xa86a4a);
    for (let y = 2; y < h; y += 3) f.box('stone', x, SAND + y, rz, 5.7, .35, 5.7, 0xd8a078);
    f.cyl('bronze', x, SAND + h, rz, 3.2, 3.6, 1.2, 0x6a4026, { sides: 8 });
  }
}

/** Obelisks at the dial's four quarters (on the sand past its kerb), each on a plinth with four bronze bowls of fire. */
function obelisks(f: Forge) {
  const fires: { x: number; y: number; z: number; size: number }[] = [];
  for (const [x, z] of [[-18, -18], [18, -18], [18, 18], [-18, 18]] as const) {
    f.box('stone', x, SAND, z, 4, 1.2, 4, 0x8a5038);
    f.add('stone', new THREE.CylinderGeometry(.9, 1.5, 15, 4, 1).rotateY(Math.PI / 4).translate(x, SAND + 1.2 + 7.5, z), ROSE);
    f.add('bronze', new THREE.ConeGeometry(.92, 1.6, 4).rotateY(Math.PI / 4).translate(x, SAND + 17, z), 0xe0b050);
    for (const [dx, dz] of [[2.6, 0], [-2.6, 0], [0, 2.6], [0, -2.6]] as const) {
      f.cyl('bronze', x + dx, SAND + .9, z + dz, .9, .4, .7, 0x8a5a24, { sides: 10 });
      f.pipe('bronze', [x + dx, SAND, z + dz], [x + dx, SAND + .9, z + dz], .12, 0x5a3a1a);
      fires.push({ x: x + dx, y: SAND + 1.6, z: z + dz, size: .8 });
    }
  }
  return fires;
}

/** The canyon's floor of sand and the dunes past its mouths: rippled, banked up against the cliffs' feet, rising north and
 *  south into dune ridges. */
function sand(f: Forge) {
  const n = noise2(68);
  f.terrain('sand', -130, -170, 130, 230, 6, (x, z) => {
    const d = Math.hypot(x, z);
    if (d < DIAL + .8) return SAND - .6;
    const mouth = Math.max(0, z - Z1 + 6) + Math.max(0, Z0 + 6 - z), wide = Math.max(0, Math.abs(x) - 70);
    const ridge = Math.sin(x * .045 + z * .018 + n(x * .01, z * .01) * 3) * .5 + .5;
    const dunes = (mouth * .09 + wide * .12) * (.5 + ridge) + n(x * .02, z * .02) * Math.min(14, mouth * .2);
    const bank = Math.max(0, Math.abs(x) - CLIFF + 5) * .35;
    return SAND - .05 + Math.min(dunes, 34) + Math.min(bank, 3) + Math.sin(x * .7 + z * .3) * .04;
  }, SANDY);
}

/** The Last Sun's people in the galleries: robed, headwrapped, painted in code (their light in them), some with an arm up,
 *  two rows to a ledge behind its parapet. */
function crowd(c: DressContext, galleries: { s: number; k: number }[]) {
  const r = rand(69);
  const robes = ['#b02a24', '#e8a028', '#f2ead8', '#2a9a96', '#3a3a8c', '#d8a040', '#c8483a', '#e8dcc4'];
  const atlas = figureAtlas(8, 2, 96, 192, (g, i, w, h) => {
    const cx = w / 2, ink = '#1a0e0a', robe = robes[i % robes.length], skin = ['#c88a60', '#a86a44', '#e0b08a', '#7a4a30'][i % 4];
    g.lineWidth = 3; g.strokeStyle = ink; g.lineJoin = 'round';
    const shape = (fill: string, path: () => void) => { g.beginPath(); path(); g.fillStyle = fill; g.fill(); g.stroke(); };
    shape(robe, () => { g.moveTo(cx - 16, h * .3); g.lineTo(cx + 16, h * .3); g.lineTo(cx + 26, h * .98); g.lineTo(cx - 26, h * .98); g.closePath(); });
    shape('rgba(0,0,0,.18)', () => { g.moveTo(cx - 3, h * .32); g.lineTo(cx + 3, h * .32); g.lineTo(cx + 5, h * .98); g.lineTo(cx - 5, h * .98); g.closePath(); });
    if (i >= 8) { g.lineWidth = 11; g.beginPath(); g.moveTo(cx + 14, h * .34); g.lineTo(cx + 22, h * .08); g.stroke(); g.lineWidth = 6; g.strokeStyle = robe; g.stroke(); g.lineWidth = 3; g.strokeStyle = ink; }
    shape(skin, () => g.arc(cx, h * .2, 13, 0, Math.PI * 2));
    const wrap = ['#e8dcc4', '#9a2420', '#d8a040', '#3a3a5a'][(i >> 1) % 4];
    shape(wrap, () => { g.arc(cx, h * .18, 15, Math.PI * 1.05, -Math.PI * .05); g.lineTo(cx + 15, h * .21); g.lineTo(cx - 15, h * .21); g.closePath(); });
    if (i % 3 === 0) shape(wrap, () => { g.moveTo(cx + 12, h * .2); g.lineTo(cx + 20, h * .42); g.lineTo(cx + 12, h * .42); g.closePath(); });
  });
  const spots: CrowdSpot[] = [];
  for (const { s, k } of galleries) for (let row = 0; row < 3; row++) {
    for (let z = Z0 + 2; z < Z1 - 2; z += .7 + r() * .35) {
      if (r() < .08) continue;
      // places-gen: none where the Champions' Gate rises through the first gallery, or where the royal pavilion stands.
      if ((k === 0 && Math.abs(z - GATE_Z) < 6) || (k === 1 && Math.abs(z - GATE_Z) < 3.6)) continue;
      const x = s * (face(k, z) + 1.1 + row * 1.05 + (r() - .5) * .25);
      spots.push({ x, y: ledge(k) + row * .3, z, cell: Math.floor(r() * 16), height: 1.7 + r() * .15, flip: r() < .5 });
    }
  }
  crowdCards(c, atlas, 8, 2, spots, { name: 'sunfall crowd', aspect: .5, shade: .92, sway: .05 });
}

/** The Last Sun's banners hung down the galleries' faces: deep crimson edged in gold, a sun going down behind three bars of
 *  horizon, swallowtailed. */
function banners(c: DressContext) {
  const banner = bannerTexture();
  for (const s of [-1, 1]) for (const z of [-34, -20, -6, 14, 26]) {
    const x = s * (face(1, z) - .3);
    c.ambient.cloth(banner, { x, y: ledge(1) - .3, z, width: 2, height: 5.2, rot: s > 0 ? -Math.PI / 2 : Math.PI / 2, wind: .3, lit: .4 });
  }
  // stages-old: and down the lowest galleries' faces, between the doorways.
  for (const s of [-1, 1]) for (const z of [-27, -13, 4, 20]) {
    const x = s * (face(0, z) - .3);
    c.ambient.cloth(banner, { x, y: ledge(0) - .4, z, width: 1.6, height: 3.8, rot: s > 0 ? -Math.PI / 2 : Math.PI / 2, wind: .3, lit: .4 });
  }
}

function bannerTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 1024;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#7a1c1a'; g.fillRect(0, 0, 256, 1024);
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
