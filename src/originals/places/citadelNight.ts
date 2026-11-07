import * as THREE from 'three';
import type { DressContext } from '../../render/stages/dressing';
import { StageAmbient } from '../../render/stages/ambient';
import { StageKit } from '../../render/stages/StageKit';
import { Beacons, LightPools } from '../../render/stages/glow';
import { Forge } from './forge';
import { fires, inlay, lanternString } from './richness';
import { rand } from './remake';
import { crater } from './battleScars';

/** The courtyard wall's piers (BloodCitadel.boundary: x +/-31, every 7.6 m from z -23), its top 1.7 m. */
const PIERS = Array.from({ length: 7 }, (_, i) => -23 + i * 7.6);

export async function citadelNight(root: THREE.Group, objective: { update(time: number): void }) {
  const ambient = new StageAmbient('blood-citadel'), kit = new StageKit(root, 'blood-citadel');
  const c = { stage: 'blood-citadel', root, ambient, kit } as unknown as DressContext;
  // The citadel's own clock drives these too (its ambience is what BloodCitadel.update ticks).
  const tick = objective.update.bind(objective);
  objective.update = (time: number) => { tick(time); ambient.update(time); };
  await kit.load(['cc0/boulder-a', 'cc0/boulder-b', 'br/stone-lamp', 'br/meshy-rubble', 'harbor/rocks-b']);
  kit.grade = material => material.color.multiply(new THREE.Color(0x8a96a8));
  const r = rand(901);
  // Rubble past the walls: boulders, fallen blocks, a broken stone lantern at each corner of the court.
  for (const s of [-1, 1]) {
    for (let k = 0; k < 6; k++) kit.place(k % 2 ? 'cc0/boulder-a' : 'cc0/boulder-b', { x: s * (34 + r() * 5), z: -20 + k * 8 + r() * 3, height: .9 + r() * 1.6, rot: r() * 6 });
    for (let k = 0; k < 2; k++) kit.place('br/meshy-rubble', { x: -16 + k * 30 + r() * 3, z: s * (28 + r() * 3), scale: .5 + r() * .3, rot: r() * 6, tint: 0xb8c0cc });
    for (let k = 0; k < 4; k++) kit.place(k % 2 ? 'cc0/boulder-b' : 'cc0/boulder-a', { x: -24 + k * 15 + r() * 3, z: s * (29 + r() * 3), height: .7 + r() * 1.2, rot: r() * 6 });
    for (const e of [-1, 1]) kit.place('br/stone-lamp', { x: s * 34.5, z: e * 27.5, height: 2.6, rot: r() * .4, roll: e * s * .12 });
    kit.place('harbor/rocks-b', { x: s * 37, z: s * 12, height: 1.4, rot: r() * 6 });
  }
  kit.flush('blood-citadel');

  const f = new Forge(c, 'citadel night');
  f.mat('dark', { roughness: 1 });
  f.mat('iron', { roughness: .6, metalness: .4 });
  f.mat('glow', { basic: true });
  const glow = new Beacons(root, 80, ambient.time), pools = new LightPools(root, 24);
  // Torches on alternate piers of both walls, an iron basket on a bracket.
  const torches: { x: number; y: number; z: number; size: number }[] = [];
  for (const s of [-1, 1]) for (const z of PIERS.filter((_, i) => i % 2 === 0)) {
    f.pipe('iron', [s * 31, 1.9, z], [s * 31, 3.1, z], .07, 0x1e2228);
    f.cyl('iron', s * 31, 3, z, .32, .18, .36, 0x1e2228, { sides: 7 });
    torches.push({ x: s * 31, y: 3.35, z, size: .55 });
  }
  fires(c, torches, { glow, pools, floor: -.025, pool: 7, smoke: .3, seed: 41 });
  // Paper lanterns slung across the court from the banner poles (x +/-32, z -13 and 19, 11 m), and corner to corner.
  for (const z of [-13, 19]) lanternString(f, glow, [-32, 10.6, z], [32, 10.6, z], { gap: 3, sag: 2.6, colour: 0xff7a40, bodyTint: 0xff9a5a, seed: z + 70 });
  lanternString(f, glow, [-32, 10.6, -13], [32, 10.6, 19], { gap: 3.2, sag: 3, colour: 0xff8a48, bodyTint: 0xffa868, size: .9, seed: 72 });
  lanternString(f, glow, [32, 10.6, -13], [-32, 10.6, 19], { gap: 3.2, sag: 3, colour: 0xff8a48, bodyTint: 0xffa868, size: .9, seed: 73 });
  f.done();
  glow.finish('citadel lanterns and torches', 2.2);
  pools.finish('citadel torch pools');
  // The feud's banners down the courtyard wall's outer face, between the piers.
  const banner = feudBanner();
  for (const s of [-1, 1]) for (const z of PIERS.slice(0, -1).map(z => z + 3.8)) ambient.cloth(banner, { x: s * 31.8, y: 1.6, z, width: 1.5, height: 3.4, rot: s * Math.PI / 2, wind: .35, lit: .25 });
  for (const s of [-1, 1]) for (const x of [-21, -7, 7, 21]) ambient.cloth(banner, { x, y: 1.6, z: s * 25.8, width: 1.5, height: 3.4, rot: s > 0 ? 0 : Math.PI, wind: .35, lit: .25 });
  // Puddles holding the moon on the paving, petals blown across it from the cherry trees.
  inlay(c, (g, n) => {
    const u = n / 64, q = rand(905);
    g.translate(n / 2, n / 2);
    for (let k = 0; k < 16; k++) {
      const x = (q() - .5) * 56 * u, z = (q() - .5) * 46 * u, rx = (1.2 + q() * 2.6) * u, rz = rx * (.4 + q() * .4), a = q() * 3;
      if (Math.hypot(x, z) < 8 * u) continue;
      g.fillStyle = 'rgba(28,40,58,.55)'; g.beginPath(); g.ellipse(x, z, rx, rz, a, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(190,210,235,.35)'; g.lineWidth = .08 * u; g.beginPath(); g.ellipse(x, z, rx * .92, rz * .88, a, Math.PI * 1.1, Math.PI * 1.7); g.stroke();
    }
    for (let k = 0; k < 900; k++) {
      const side = q() < .5 ? -1 : 1, x = side * (14 + q() * 16) * u, z = (q() - .5) * 46 * u;
      g.fillStyle = `rgba(${226 + q() * 20},${150 + q() * 40},${170 + q() * 30},${.5 + q() * .4})`;
      g.beginPath(); g.ellipse(x, z, .09 * u, .05 * u, q() * 3, 0, Math.PI * 2); g.fill();
    }
  }, { size: 64, px: 2048, y: -.012, roughness: .25, name: 'citadel puddles and petals' });
  // Mist in the ruins and over the wall; crows round the keeps; embers off the torches; petals on the wind.
  const mist: { x: number; y: number; z: number; size: number }[] = [];
  for (let k = 0; k < 26; k++) { const a = r() * Math.PI * 2, d = 36 + r() * 60; mist.push({ x: Math.cos(a) * d, y: .8 + r() * 2, z: Math.sin(a) * d * .9, size: 16 + r() * 18 }); }
  ambient.puffs({ spots: mist, color: 0x8a9ab8, shade: 0x3a4a64, opacity: .22, life: 0, flat: true, drift: [.6, 0, .2], seed: 906, order: 1 });
  ambient.birds({ centre: [0, 0, 60], count: 12, radius: 46, height: 44, spread: 14, speed: 7, size: .7, color: 0x0e1018, seed: 907 });
  ambient.motes({ min: [-33, 3, -26], max: [33, 12, 26], count: 90, velocity: [.15, .8, .1], size: .05, color: 0xffa050, color2: 0xffd090, opacity: .9, additive: true, twinkle: .8, wobble: .8, seed: 908 });
  ambient.motes({ min: [-60, 0, -40], max: [60, 9, 40], count: 220, velocity: [1.2, -.3, .4], size: .08, color: 0xf0b0c4, color2: 0xffd8e4, opacity: .85, wobble: 1.4, seed: 909 });
  brokenMoon(c);
  ambient.finish();
  root.add(ambient.root);
}

/** The feud's banner: deep crimson, edged black, a broken moon (a crescent split by a crack) in pale silver, torn at its foot. */
function feudBanner() {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 576;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#5a1418'; g.fillRect(0, 0, 256, 576);
  g.fillStyle = '#16100e'; g.fillRect(0, 0, 256, 26); g.fillRect(0, 0, 12, 576); g.fillRect(244, 0, 12, 576);
  g.fillStyle = '#d8dce6';
  g.beginPath(); g.arc(128, 200, 74, 0, Math.PI * 2); g.arc(150, 180, 64, 0, Math.PI * 2, true); g.fill('evenodd');
  g.strokeStyle = '#5a1418'; g.lineWidth = 9;
  g.beginPath(); g.moveTo(70, 150); g.lineTo(104, 196); g.lineTo(86, 224); g.lineTo(118, 268); g.stroke();
  g.save(); g.globalCompositeOperation = 'destination-out';
  g.beginPath(); g.moveTo(0, 576); g.lineTo(40, 520); g.lineTo(84, 562); g.lineTo(128, 500); g.lineTo(176, 560); g.lineTo(214, 516); g.lineTo(256, 576); g.closePath(); g.fill();
  g.restore();
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

const MOON = { bearing: Math.PI / 3, distance: 320, elevation: 7, radius: 16 };
function brokenMoon(c: DressContext) {
  const root = c.root;
  // The sky is the night under the broken moon (public/assets/environment/sky/citadel-night.webp, loaded by
  // src/render/objectives/BloodCitadel.ts), its crimson glow turned to the moon's bearing.
  // The moon: a halo and the wound's light bleeding out behind (additive), the disc before it.
  const { bearing, distance: d } = MOON, el = THREE.MathUtils.degToRad(MOON.elevation);
  const x = Math.sin(bearing) * d, z = -Math.cos(bearing) * d, y = 2 + Math.tan(el) * d, radius = d * Math.tan(THREE.MathUtils.degToRad(MOON.radius));
  const card = (map: THREE.Texture, size: number, additive: boolean, order: number, push: number, name: string, bright = 1) => {
    const material = new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, fog: false, toneMapped: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
    material.color.setScalar(bright); material.name = name;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), material);
    const k = (d + push) / d;
    mesh.position.set(x * k, 2 + (y - 2) * k, z * k); mesh.lookAt(0, mesh.position.y, 0);
    mesh.name = name; mesh.renderOrder = order; mesh.frustumCulled = false;
    root.add(mesh);
  };
  card(moonHalo(), radius * 5.2, true, 2, 20, 'Citadel broken moon: halo', .9);
  card(moonDisc(), radius * 2.3, false, 3, 0, 'Citadel broken moon', .82);
  // A crater in the court, off its middle, its cracks glowing the moon's red.
  crater(c, { size: 34, cx: 3, cz: -2.5, radius: 4.2, reach: 14, seed: 1311, strokes: [[[-14, 9], [9, -12]]], lit: Math.atan2(-Math.cos(bearing), Math.sin(bearing)),
    ember: 0xff2a3c, strength: 1.1, litStone: 'rgba(200,150,170,.8)', darkStone: 'rgba(30,20,30,.85)', name: 'citadel crater' });
}

function canvas(size: number, draw: (g: CanvasRenderingContext2D, s: number) => void) {
  const el = document.createElement('canvas');
  el.width = el.height = size;
  draw(el.getContext('2d')!, size);
  const t = new THREE.CanvasTexture(el);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

/** The moon's halo and the light out of its wound: a deep red glow, and crimson streaks fanning from the break. */
function moonHalo() {
  return canvas(1024, (g, s) => {
    const m = s / 2;
    const halo = g.createRadialGradient(m, m, s * .08, m, m, m);
    halo.addColorStop(0, 'rgba(255,90,90,.75)'); halo.addColorStop(.25, 'rgba(210,30,50,.42)'); halo.addColorStop(.55, 'rgba(140,10,30,.16)'); halo.addColorStop(1, 'rgba(90,0,20,0)');
    g.fillStyle = halo; g.fillRect(0, 0, s, s);
    // Streaks along the wound's line (it runs from the upper right to the lower left), both ways out of the disc.
    const q = rand(1321);
    g.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 26; k++) {
      const side = k % 2 ? 1 : -1, a = -Math.PI / 4 + (side > 0 ? 0 : Math.PI) + (q() - .5) * .9, len = s * (.22 + q() * .3), w = s * (.004 + q() * .012);
      g.save(); g.translate(m, m); g.rotate(a);
      const streak = g.createLinearGradient(s * .12, 0, s * .12 + len, 0);
      streak.addColorStop(0, `rgba(255,70,80,${.35 + q() * .3})`); streak.addColorStop(1, 'rgba(255,40,60,0)');
      g.fillStyle = streak; g.beginPath(); g.moveTo(s * .12, -w); g.lineTo(s * .12 + len, 0); g.lineTo(s * .12, w); g.closePath(); g.fill();
      g.restore();
    }
  });
}

/** The broken moon: a pale disc in cel tones (its seas and craters), split from the upper right to the lower left by a jagged
 *  wound - the right half sunk a little off the left - glowing crimson to white-hot at its heart, shards breaking off it. */
function moonDisc() {
  return canvas(1024, (g, s) => {
    const m = s / 2, R = s * .43, q = rand(1331);
    // The wound's line: a jagged polyline across the disc.
    const wound: [number, number][] = [];
    for (let k = 0; k <= 14; k++) { const t = k / 14, along = (t - .5) * 2.3 * R; wound.push([m + along * .28 + (q() - .5) * R * .12, m - along * .96 + (q() - .5) * R * .06]); }
    const half = (side: number, dx: number, dy: number) => {
      g.save(); g.translate(dx, dy);
      g.beginPath();
      // The half-plane on one side of the wound, clipped to the disc.
      g.moveTo(wound[0][0], wound[0][1]); for (const [x, y] of wound) g.lineTo(x, y);
      const far = side > 0 ? [[s * 1.5, s * 1.5], [s * 1.5, -s * .5]] : [[-s * .5, -s * .5], [-s * .5, s * 1.5]];
      g.lineTo(far[0][0], far[0][1]); g.lineTo(far[1][0], far[1][1]); g.closePath(); g.clip();
      g.beginPath(); g.arc(m, m, R, 0, Math.PI * 2); g.clip();
      // Cel tones: the pale face, the seas, crater rings; a thin bright rim; the shade toward the lower left.
      g.fillStyle = '#e4dce4'; g.fillRect(0, 0, s, s);
      const r2 = rand(1340 + side);
      for (let k = 0; k < 9; k++) { g.fillStyle = 'rgba(150,132,150,.55)'; g.beginPath(); g.ellipse(m + (r2() - .5) * R * 1.5, m + (r2() - .5) * R * 1.5, R * (.12 + r2() * .22), R * (.08 + r2() * .16), r2() * 3, 0, Math.PI * 2); g.fill(); }
      for (let k = 0; k < 26; k++) { const cx = m + (r2() - .5) * R * 1.8, cy = m + (r2() - .5) * R * 1.8, cr = R * (.02 + r2() * .06); g.strokeStyle = 'rgba(120,100,120,.6)'; g.lineWidth = s * .004; g.beginPath(); g.arc(cx, cy, cr, 0, Math.PI * 2); g.stroke(); g.fillStyle = 'rgba(250,244,250,.5)'; g.beginPath(); g.arc(cx - cr * .25, cy - cr * .25, cr * .5, 0, Math.PI * 2); g.fill(); }
      const shade = g.createLinearGradient(m + R, m - R, m - R, m + R); shade.addColorStop(0, 'rgba(0,0,0,0)'); shade.addColorStop(.6, 'rgba(60,20,50,.1)'); shade.addColorStop(1, 'rgba(60,10,40,.5)');
      g.fillStyle = shade; g.fillRect(0, 0, s, s);
      g.restore();
    };
    // The wound's glow under both halves, then the halves (the right one sunk), then the white-hot seam.
    g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
    g.shadowColor = 'rgba(255,40,60,1)'; g.shadowBlur = s * .05;
    g.strokeStyle = 'rgba(255,40,56,1)'; g.lineWidth = s * .075; g.beginPath(); wound.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke();
    g.restore();
    half(-1, -s * .012, -s * .012);
    half(1, s * .02, s * .026);
    g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
    g.shadowColor = 'rgba(255,90,90,1)'; g.shadowBlur = s * .02;
    g.strokeStyle = 'rgba(255,210,200,1)'; g.lineWidth = s * .014; g.beginPath(); wound.forEach(([x, y], i) => i ? g.lineTo(x + s * .003, y + s * .005) : g.moveTo(x + s * .003, y + s * .005)); g.stroke();
    g.restore();
    // Shards breaking off the wound, drifting out from it, their broken edges lit red.
    for (let k = 0; k < 16; k++) {
      const [wx, wy] = wound[1 + Math.floor(q() * 12)], out = (q() < .5 ? -1 : 1) * (R * (.05 + q() * .25)), a = Math.PI / 4;
      const sx = wx + Math.cos(a) * out + (q() - .5) * R * .1, sy = wy + Math.sin(a) * out + (q() - .5) * R * .1, sr = R * (.012 + q() * .03);
      g.fillStyle = '#cfc4d0'; g.beginPath(); for (let v = 0; v < 5; v++) { const b = v / 5 * Math.PI * 2 + q(); g.lineTo(sx + Math.cos(b) * sr * (.6 + q() * .6), sy + Math.sin(b) * sr * (.6 + q() * .6)); } g.closePath(); g.fill();
      g.strokeStyle = 'rgba(255,60,70,.9)'; g.lineWidth = s * .002; g.stroke();
    }
  });
}
