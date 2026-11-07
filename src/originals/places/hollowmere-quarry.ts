import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { DressContext } from '../../render/stages/dressing';
import { STAGE_PROPS } from '../../game/stageProps';
import { placeProps, roundedRect, stageMaterial } from '../../render/stages/build';
import { heroAir } from '../../render/stages/hero';
import { drawn, rand, tinted } from './remake';
import { Beacons } from '../../render/stages/glow';
import { Forge, detail } from './forge';
import { surfaces } from './cc0';
import { fires } from './richness';
import { crater } from './battleScars';

/** Hollowmere Quarry: a miners' town of dark stone and timber at the bottom of the iron pit - the cobbled square, its houses
 *  (the three in their boxes) and the rows round it, the cover in its boxes - under the pit's benched walls climbing to a
 *  far ring of sky, the headframe and the cable lift, a colossal drill in the north wall pouring molten ore down the
 *  benches, the bucket-wheel digger at the west wall. */
export async function dress(c: DressContext) {
  const { kit } = c;
  const props = STAGE_PROPS['hollowmere-quarry'] ?? [];
  kit.grade = (material, piece) => {
    if (/^own\/quarry-(house|headframe)/.test(piece)) {
      if (material.map) { material.emissive.setRGB(1, .82, .66); material.emissiveMap = material.map; material.emissiveIntensity = .3; material.needsUpdate = true; }
      material.color.multiplyScalar(1.25);
      return;
    }
    material.color.multiply(new THREE.Color(0xc8c4cc));
  };
  const [, , S] = await Promise.all([
    c.sky({ rotation: 0, drift: .0003 }),
    kit.load([...new Set(props.map(p => p.piece).filter(p => p !== 'none' && p !== 'column' && p !== 'stump' && p !== 'block' && p !== 'br/kenney-town-lantern')), 'own/quarry-house-a', 'own/quarry-house-b', 'own/quarry-house-c', 'own/quarry-headframe']),
    surfaces(c, ['flagstone', 'planks-dark'] as const),
  ]);
  placeProps(kit, props.filter(p => p.piece !== 'br/kenney-town-lantern'));
  kit.shadows.add('harbor/crate').add('harbor/barrel').add('br/meshy-stall');
  square(c, S.flagstone);
  houses(c, S['planks-dark']);
  kitHouses(c);
  yard(c, props);
  kit.flush(c.stage);

  c.root.add(cliffs(c));
  c.root.add(works(c));
  dusk(c);
  molten(c);
  await digger(c);
}

/** The town's ground: cobbles over the square, the avenue and the streets round the rows, a gutter of setts round the
 *  square's edge. */
function square(c: DressContext, flag: Awaited<ReturnType<typeof surfaces>>['flagstone']) {
  const f = new Forge(c, 'hollowmere square');
  f.mat('cobbles', { ...flag, tile: 1.7, lift: .1, gain: .95, roughness: .95, wear: { key: 'hollowmere-quarry', scale: 1.4, light: [.82, 1.06], patch: 0x2a2624, patchAmount: .35 } });
  f.mat('setts', { map: detail.ashlar(9201, 40), tile: 1.2, roughness: .95 });
  f.add('cobbles', new THREE.PlaneGeometry(300, 300).rotateX(-Math.PI / 2).toNonIndexed(), 0x8a8a96);
  for (const [x, z, w, d] of [[0, -40.5, 82, 1], [0, 40.5, 82, 1], [-40.5, 0, 1, 80], [40.5, 0, 1, 80]] as const) f.box('setts', x, -.02, z, w, .06, d, 0x5a5660);
  f.done();
}

/** The miners' houses (own/quarry-house-a/b/c.glb): the square's three in their boxes, rows round the square past the bounds
 *  and up the avenue, each front to the street; timber headframes over the old shafts at the pit floor's edge
 *  (own/quarry-headframe.glb). */
function kitHouses(c: DressContext) {
  const { kit } = c;
  kit.place('own/quarry-house-c', { x: 10.25, z: -12.5, width: 6.3, rot: -Math.PI / 2 });
  kit.place('own/quarry-house-b', { x: -15, z: 8, width: 12, rot: Math.PI / 2 });
  kit.place('own/quarry-house-a', { x: 16, z: 30, height: 11, rot: Math.PI });
  const r = rand(9230);
  const row = (x0: number, z0: number, x1: number, z1: number, toward: (x: number, z: number) => number) => {
    const len = Math.hypot(x1 - x0, z1 - z0); let t = 0;
    while (t < len - 3) {
      const pick = r(), [piece, along, o] = pick < .4 ? ['own/quarry-house-b', 11 + r() * 2, { width: 0 }] as const : pick < .7 ? ['own/quarry-house-c', 7, {}] as const : ['own/quarry-house-a', 4.6, {}] as const;
      void o;
      const mid = (t + along / 2) / len, x = x0 + (x1 - x0) * mid, z = z0 + (z1 - z0) * mid, rot = toward(x, z);
      if (piece === 'own/quarry-house-b') kit.place(piece, { x, z, width: along, rot });
      else if (piece === 'own/quarry-house-c') kit.place(piece, { x, z, width: 6.6, rot: rot - Math.PI / 2 });
      else kit.place(piece, { x, z, height: 10 + r() * 2, rot });
      t += along + .4 + r() * .8;
    }
  };
  const square = (x: number, z: number) => Math.atan2(-x, -z);
  row(-38, -46, -14, -46, square); row(14, -46, 38, -46, square);
  row(-38, 46, 38, 46, square); row(46, -38, 46, 38, square); row(-46, -38, -46, 38, square);
  row(-12.5, -50, -12.5, -80, () => Math.PI / 2); row(12.5, -50, 12.5, -80, () => -Math.PI / 2);
  for (const [x, z, h] of [[-104, -62, 34], [108, -48, 30], [-96, 92, 28], [100, 96, 32]] as const) kit.place('own/quarry-headframe', { x, z, height: h, rot: Math.atan2(-x, -z), shadow: false });
}

/** The far rows of houses: a ground floor of dark stone, timber framing above, a steep slate roof and chimneys, small
 *  windows, a few lit. One draw a material. */
function houses(c: DressContext, planks: Awaited<ReturnType<typeof surfaces>>['planks-dark']) {
  const f = new Forge(c, 'hollowmere houses');
  f.mat('stone', { map: detail.ashlar(9210, 48), tile: 2.2, roughness: .95, air: .15 });
  f.mat('timber', { ...planks, tile: 2.4, lift: .2, roughness: 1, air: .15 });
  f.mat('slate', { map: detail.slate(9211), tile: 1.6, roughness: .85, air: .15, flat: true });
  f.mat('dark', { roughness: .9, air: .15 });
  f.mat('lit', { basic: true });
  const r = rand(9212);
  const house = (x: number, z: number, w: number, d: number, h: number, rot: number, tone = 0) => {
    const m = new THREE.Matrix4().makeRotationY(rot).setPosition(x, 0, z);
    const put = (key: string, g: THREE.BufferGeometry, tint: number) => f.add(key, g.applyMatrix4(m), tint);
    const ground = Math.min(4, h * .38);
    put('stone', new THREE.BoxGeometry(w, ground, d).translate(0, ground / 2, 0), [0x9a96a2, 0x8e8a96, 0xa29ca6][tone % 3]);
    put('timber', new THREE.BoxGeometry(w - .2, h - ground, d - .2).translate(0, ground + (h - ground) / 2, 0), [0x6a5a50, 0x76645a, 0x5e5048][tone % 3]);
    for (const sd of [-1, 1]) {
      for (let k = 0; k <= Math.floor(w / 2.2); k++) put('dark', new THREE.BoxGeometry(.22, h - ground, .12).translate(-w / 2 + .1 + k * (w - .2) / Math.floor(w / 2.2), ground + (h - ground) / 2, sd * (d / 2 - .04)), 0x1a1614);
      put('dark', new THREE.BoxGeometry(w, .22, .14).translate(0, ground + (h - ground) * .5, sd * (d / 2 - .03)), 0x1a1614);
      for (let k = 0; k < Math.floor(w / 2.6); k++) {
        const wx = -w / 2 + 1.3 + k * 2.6;
        put(r() < .3 ? 'lit' : 'dark', new THREE.BoxGeometry(.9, 1.1, .1).translate(wx, ground + (h - ground) * .72, sd * (d / 2 + .02)), r() < .5 ? 0xff9a40 : 0x16121a);
        if (k % 2 === 0) put(r() < .25 ? 'lit' : 'dark', new THREE.BoxGeometry(.9, 1.1, .1).translate(wx, ground * .55, sd * (d / 2 + .02)), r() < .6 ? 0xffb050 : 0x16121a);
      }
    }
    const rh = d * .7;
    const tri = new THREE.Shape().moveTo(-(d / 2 + .4), 0).lineTo(d / 2 + .4, 0).lineTo(0, rh).closePath();
    const roof = new THREE.ExtrudeGeometry(tri, { depth: w + 1, bevelEnabled: false }).rotateY(Math.PI / 2).translate(-(w + 1) / 2, h, 0);
    put('slate', roof, 0x3a3e4a);
    for (let k = 0; k < Math.max(1, Math.floor(w / 6)); k++) put('stone', new THREE.BoxGeometry(.9, rh * .9 + 1.4, .9).translate(-w / 2 + 1.6 + k * 5.4, h + rh * .45 + .7, d * .2), 0x5a5660);
  };
  const row = (x0: number, z0: number, x1: number, z1: number, face: number, scale = 1) => {
    const len = Math.hypot(x1 - x0, z1 - z0); let t = 0;
    while (t < len - 4) {
      const w = (6 + r() * 7) * scale, d = (6 + r() * 3) * scale, h = (6 + r() * 5) * scale, mid = (t + w / 2) / len;
      house(x0 + (x1 - x0) * mid, z0 + (z1 - z0) * mid, w, d, h, face, Math.floor(r() * 3));
      t += w + .3 + r() * .8;
    }
  };
  row(-62, -62, -16, -62, 0, 1.2); row(16, -62, 62, -62, 0, 1.2); row(-62, 64, 62, 64, Math.PI, 1.2);
  row(64, -55, 64, 60, -Math.PI / 2, 1.2); row(-64, -55, -64, 60, Math.PI / 2, 1.2);
  row(-90, -82, 90, -82, 0, 1.3); row(-90, 86, 90, 86, Math.PI, 1.3); row(90, -76, 90, 82, -Math.PI / 2, 1.3); row(-90, -76, -90, 82, Math.PI / 2, 1.3);
  f.done();
}

/** What stands in the cover's boxes that no kit piece fills (stageProps.ts `draw`): the timber barricade, the watchtower,
 *  the masts with the miners' guild's banners, and iron fire baskets on posts. */
function yard(c: DressContext, props: typeof STAGE_PROPS['hollowmere-quarry']) {
  const f = new Forge(c, 'hollowmere yard');
  f.mat('wood', { roughness: .95 });
  f.mat('iron', { roughness: .6, metalness: .45 });
  const glow = new Beacons(c.root, 12, c.ambient.time), flames: { x: number; y: number; z: number; size: number }[] = [];
  const banner = guildBanner();
  for (const p of props ?? []) {
    if (p.draw === 'barricade') {
      for (let k = 0; k < 5; k++) f.box('wood', p.x + (k - 2) * 1.05, 0, p.z, .9, 1.5 + (k % 2) * .2, .3, 0x5a4434, { tilt: (k % 2 ? .1 : -.08) });
      f.beam('wood', [p.x - 2.6, .4, p.z + .4], [p.x + 2.6, 1.2, p.z + .4], .2, 0x4a3a2c);
    } else if (p.draw === 'tower') {
      for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) f.pipe('wood', [p.x + dx * 1.4, 0, p.z + dz * 1.4], [p.x + dx * 1.1, 8.4, p.z + dz * 1.1], .14, 0x4a3a2c);
      f.box('wood', p.x, 6.4, p.z, 3, .3, 3, 0x5a4434);
      f.box('wood', p.x, 6.7, p.z, 3, 1, .12, 0x4a3a2c);
      f.add('wood', new THREE.ConeGeometry(2.5, 1.6, 4).rotateY(Math.PI / 4).translate(p.x, 9.2, p.z), 0x3a3e4a);
    } else if (p.draw === 'mast') {
      f.cyl('wood', p.x, 0, p.z, .16, .22, 11, 0x4a3a2c, { sides: 7 });
      f.beam('wood', [p.x - .9, 10.4, p.z], [p.x + .9, 10.4, p.z], .1, 0x4a3a2c);
      c.ambient.cloth(banner, { x: p.x, y: 10.3, z: p.z, width: 1.7, height: 4.6, rot: Math.atan2(-p.x, -p.z), wind: .5, lit: .4 });
    } else if (p.piece === 'br/kenney-town-lantern') {
      f.cyl('iron', p.x, 0, p.z, .12, .16, 3.8, 0x2a2622, { sides: 8 });
      f.cyl('iron', p.x, 3.8, p.z, .5, .2, .45, 0x2a2622, { sides: 10 });
      flames.push({ x: p.x, y: 4.3, z: p.z, size: .7 });
    }
  }
  f.done();
  fires(c, flames, { glow, smoke: .3, seed: 9220 });
  glow.finish('hollowmere fire baskets', 2);
}

/** The miners' guild's banner: soot black edged in rust, a crossed pick and a winding wheel in molten orange. No lettering. */
function guildBanner() {
  return drawn(256, 768, (g, w, h) => {
    g.fillStyle = '#1e1a1c'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#8a3a1e'; g.fillRect(0, 0, 14, h); g.fillRect(w - 14, 0, 14, h); g.fillRect(0, 0, w, 20);
    g.translate(w / 2, 260);
    g.strokeStyle = '#e8782a'; g.lineWidth = 14;
    g.beginPath(); g.arc(0, 0, 62, 0, Math.PI * 2); g.stroke();
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * 62, Math.sin(a) * 62); g.lineWidth = 6; g.stroke(); }
    g.lineWidth = 16; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-80, 110); g.lineTo(80, -110); g.stroke();
    g.beginPath(); g.moveTo(40, -130); g.quadraticCurveTo(100, -100, 110, -50); g.stroke();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'destination-out';
    g.beginPath(); g.moveTo(0, h); g.lineTo(w / 2, h - 120); g.lineTo(w, h); g.closePath(); g.fill();
  }, { repeat: false });
}

/** Sparks and cinders blown up off the smelters, ravens over the pit. */
function dusk(c: DressContext) {
  c.ambient.motes({ min: [-80, 2, -110], max: [80, 40, -40], count: 160, velocity: [.6, 1.6, .3], size: .08, color: 0xffa040, color2: 0xffd080, opacity: .9, additive: true, twinkle: .9, wobble: 1.5, seed: 312 });
  c.ambient.birds({ centre: [0, 0, -20], count: 10, radius: 70, height: 50, spread: 14, speed: 6, size: .9, color: 0x1a1412, seed: 313 });
}

/** Quarried rock: strata of ochre, rust and grey in courses, cut marks, cracks. */
function strata() {
  return drawn(512, 512, (g, w, h) => {
    const r = rand(311);
    for (let y = 0; y < h;) {
      const band = 10 + r() * 34, tones = [[176, 132, 88], [150, 104, 70], [128, 116, 104], [190, 150, 100], [120, 84, 60]], t = tones[Math.floor(r() * tones.length)];
      const k = .85 + r() * .25;
      g.fillStyle = `rgb(${t[0] * k},${t[1] * k},${t[2] * k})`; g.fillRect(0, y, w, band);
      g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, y + band - 2, w, 2);
      y += band;
    }
    for (let i = 0; i < 14; i++) { g.fillStyle = `rgba(0,0,0,${.05 + r() * .05})`; const x = r() * w; g.fillRect(x, r() * h, 2 + r() * 2, 10 + r() * 30); }
    for (let i = 0; i < 26; i++) {
      g.strokeStyle = 'rgba(30,20,14,.35)'; g.lineWidth = 1.5; g.beginPath();
      let x = r() * w, y = r() * h; g.moveTo(x, y);
      for (let k = 0; k < 6; k++) { x += (r() - .5) * 30; y += 8 + r() * 20; g.lineTo(x, y); }
      g.stroke();
    }
  });
}

/** The pit's cliffs round the town: quarried rock in benches stepping up and back to a far ring of sky, the ring pushed in and
 *  out by its own lie of rock, notched low to the south-east where a cutting runs out of the pit. One mesh, faceted. */
function cliffs(c: DressContext) {
  const path = roundedRect(-136, -116, 136, 118, 40, 9);
  const ring: { x: number; z: number; nx: number; nz: number; s: number }[] = [];
  let total = 0;
  const seg = path.map((p, i) => { const q = path[(i + 1) % path.length], l = Math.hypot(q[0] - p[0], q[1] - p[1]); total += l; return l; });
  const n = Math.round(total / 4);
  for (let k = 0; k < n; k++) {
    let d = k / n * total, i = 0;
    while (d > seg[i]) d -= seg[i++];
    const [x0, z0] = path[i], [x1, z1] = path[(i + 1) % path.length], t = d / seg[i];
    const x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t, l = Math.hypot(x, z);
    ring.push({ x, z, nx: x / l, nz: z / l, s: k / n });
  }
  const wave = (s: number, f: number, ph: number) => Math.sin(s * Math.PI * 2 * f + ph);
  const crest = (s: number, a: number) => {
    let h = 252 + 22 * wave(s, 3, .4) + 12 * wave(s, 7, 1.9) + 6 * wave(s, 17, 4.1);
    const cut = Math.exp(-(((Math.atan2(Math.sin(a - .75), Math.cos(a - .75))) / .09) ** 2));
    return h * (1 - cut * .75);
  };
  const levels: [number, number][] = [[-1, 0], [19, 0], [19, 7], [38, 7], [38, 14], [57, 14], [57, 21], [76, 21], [76, 28], [95, 28],
    [95, 40], [124, 40], [124, 54], [153, 54], [153, 70], [182, 70], [182, 88], [211, 88], [211, 108], [240, 108], [240, 130], [269, 130], [269, 154], [292, 154]];
  const pos: number[] = [], uv: number[] = [];
  const at = (k: number, j: number) => {
    const p = ring[k % n], a = Math.atan2(p.z, p.x), top = crest(p.s, a);
    const [ly, lo] = levels[j];
    const y = Math.min(ly, top), push = 6 * wave(p.s, 5, .7) + 3 * wave(p.s, 13, 2.2) + 2.4 * Math.sin(k * .31 + j * 2.3) * Math.sin(k * .113 + j);
    const out = lo + push + Math.max(0, ly - top) * .3;
    return [p.x + p.nx * out, y, p.z + p.nz * out, p.s * total / 14, y / 14] as const;
  };
  for (let k = 0; k < n; k++) for (let j = 0; j + 1 < levels.length; j++) {
    const a = at(k, j), b = at(k + 1, j), cc = at(k + 1, j + 1), d = at(k, j + 1);
    for (const v of [a, b, cc, a, cc, d]) { pos.push(v[0], v[1], v[2]); uv.push(v[3], v[4]); }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.computeVertexNormals();
  tinted(geometry, (y) => [18.9, 37.9, 56.9, 75.9].some(l => Math.abs(y - l) < .2) ? 0x8a8070 : y > 150 ? 0x8a8896 : y > 76 ? 0x9a98a4 : 0xaaa6ac);
  const mesh = new THREE.Mesh(geometry, heroAir(stageMaterial(c.stage, 'Quarry cliffs', { map: strata(), color: 0xe0d0c0, vertexColors: true, roughness: .96, flatShading: true, side: THREE.DoubleSide, emissive: 0x2a1a14, emissiveIntensity: .6 }), .16, .45));
  mesh.name = 'hollowmere cliffs'; mesh.receiveShadow = true;
  return mesh;
}

/** The mine's works: the headframe over the shaft, its winding house, cables to the rim, the cable lift across the pit with
 *  its buckets, and timber scaffolds and ladders up the cliff faces. One draw. */
function works(c: DressContext) {
  const parts: THREE.BufferGeometry[] = [], r = rand(808);
  const iron = 0x6a3020, rust = 0x8a4428, wood = 0x5a4030, dark = 0x2a2420;
  const beam = (a: THREE.Vector3, b: THREE.Vector3, w: number, color: number) => {
    const d = new THREE.Vector3().subVectors(b, a), len = d.length();
    const g = new THREE.BoxGeometry(w, len, w).translate(0, len / 2, 0);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())).translate(a.x, a.y, a.z);
    parts.push(tinted(g.toNonIndexed(), color));
  };
  const hx = 0, hz = -92, top = 48;
  const wheel = new THREE.Vector3(hx, top, hz);
  for (const s of [-1, 1]) {
    const foot = new THREE.Vector3(hx + s * 11, 0, hz + 4), back = new THREE.Vector3(hx + s * 6, 0, hz - 16);
    beam(foot, new THREE.Vector3(hx + s * 2.4, top - 1, hz), 1.1, iron);
    beam(back, new THREE.Vector3(hx + s * 2.4, top - 2, hz - 1), .9, iron);
    for (let k = 1; k < 6; k++) {
      const t0 = (k - 1) / 6, t1 = k / 6;
      const p0 = foot.clone().lerp(new THREE.Vector3(hx + s * 2.4, top - 1, hz), t0), p1 = foot.clone().lerp(new THREE.Vector3(hx + s * 2.4, top - 1, hz), t1);
      const q0 = foot.clone().setX(hx - s * 11).lerp(new THREE.Vector3(hx - s * 2.4, top - 1, hz), t1);
      beam(p0, q0, .35, rust); beam(p1, p1.clone().setX(hx - p1.x + hx), .4, rust);
    }
  }
  const ring = new THREE.TorusGeometry(5.5, .45, 6, 28).translate(wheel.x, wheel.y, wheel.z);
  parts.push(tinted(ring.toNonIndexed(), iron));
  for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI; beam(wheel.clone().add(new THREE.Vector3(Math.cos(a) * -5.4, Math.sin(a) * -5.4, 0)), wheel.clone().add(new THREE.Vector3(Math.cos(a) * 5.4, Math.sin(a) * 5.4, 0)), .25, rust); }
  parts.push(tinted(new THREE.BoxGeometry(18, 10, 12).translate(hx, 5, hz - 22).toNonIndexed(), 0x6a5444));
  parts.push(tinted(new THREE.CylinderGeometry(8.2, 8.2, 18.6, 3, 1).rotateZ(Math.PI / 2).scale(1, .45, .9).translate(hx, 12.3, hz - 22).toNonIndexed(), 0x2e2a2c));
  parts.push(tinted(new THREE.CylinderGeometry(.9, 1.1, 14, 8).translate(hx + 6, 17, hz - 26).toNonIndexed(), dark));
  beam(wheel.clone().add(new THREE.Vector3(0, -5.4, 0)), new THREE.Vector3(hx, 0, hz), .12, dark);
  beam(wheel.clone().add(new THREE.Vector3(0, 5.2, -.4)), new THREE.Vector3(hx, 76, hz - 40), .12, dark);
  const north = new THREE.Vector3(-30, 76, -130), south = new THREE.Vector3(40, 76, 132);
  for (const end of [north, south]) { beam(end.clone().setY(57), end, .8, wood); beam(end.clone().setY(57).add(new THREE.Vector3(3, 0, 0)), end, .6, wood); }
  const sag = (t: number) => north.clone().lerp(south, t).add(new THREE.Vector3(0, -Math.sin(t * Math.PI) * 14, 0));
  for (let k = 0; k < 16; k++) beam(sag(k / 16), sag((k + 1) / 16), .12, dark);
  for (const t of [.22, .47, .73]) {
    const p = sag(t);
    beam(p, p.clone().add(new THREE.Vector3(0, -3, 0)), .1, dark);
    parts.push(tinted(new THREE.CylinderGeometry(1.2, .8, 1.6, 8).translate(p.x, p.y - 3.8, p.z).toNonIndexed(), rust));
  }
  const path = roundedRect(-131, -110, 131, 112, 34, 7);
  for (let i = 0; i < 18; i++) {
    const [x, z] = path[Math.floor(r() * path.length)];
    const n = new THREE.Vector3(-x, 0, -z).normalize(), tan = new THREE.Vector3(-n.z, 0, n.x), base = new THREE.Vector3(x, 0, z).addScaledVector(n, 1.6);
    const h = r() < .5 ? 19 : 38, w = 6 + r() * 6;
    for (const s of [-1, 1]) for (const d of [0, 2.4]) beam(base.clone().addScaledVector(tan, s * w / 2).addScaledVector(n, d), base.clone().addScaledVector(tan, s * w / 2).addScaledVector(n, d).setY(h), .3, wood);
    for (let y = 6; y < h; y += 6.3) parts.push(tinted(new THREE.BoxGeometry(w, .25, 2.6).rotateY(Math.atan2(tan.x, tan.z) + Math.PI / 2).translate(base.x + n.x * 1.2, y, base.z + n.z * 1.2).toNonIndexed(), wood));
    const lx = base.clone().addScaledVector(tan, w / 2 + 1);
    beam(lx, lx.clone().setY(h + 1), .14, wood); beam(lx.clone().addScaledVector(tan, .7), lx.clone().addScaledVector(tan, .7).setY(h + 1), .14, wood);
  }
  const geometry = mergeGeometries(parts.map(g => { for (const key of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(key)) g.deleteAttribute(key); return g; }));
  parts.forEach(g => g.dispose());
  const mesh = new THREE.Mesh(geometry, heroAir(stageMaterial(c.stage, 'Quarry works', { color: 0xffffff, vertexColors: true, roughness: .8, flatShading: true }), .25));
  mesh.name = 'hollowmere works';
  return mesh;
}

/** The great smelter on the north wall tapped: molten iron pouring down the benches in a falling river of fire to the pit's
 *  floor, sparks where it lands, steam and smoke rolling off it; the square split by the fight's crater. Everything stands
 *  outside the bounds but the flat crater. */
function molten(c: DressContext) {
  const { ambient } = c, r = rand(1601);
  c.root.traverse(o => { if (o.name === 'Painted sky') ((o as THREE.Mesh).material as THREE.ShaderMaterial).uniforms.uTint.value.set(0xc8b8bc); });
  const sx = 34, top = 153, zf = -116 - 54;
  const f = new Forge(c, 'hollowmere smelter');
  f.mat('iron', { roughness: .7, metalness: .3, air: .3 });
  f.mat('glow', { basic: true, fog: false });
  f.box('iron', sx, top, zf - 16, 46, 30, 26, 0x3a2a24);
  f.box('iron', sx, top + 30, zf - 18, 30, 10, 18, 0x4a3428);
  for (const dx of [-14, 0, 14]) f.cyl('iron', sx + dx, top + 40, zf - 22, 2.6, 3.2, 34, 0x2e2420, { sides: 10 });
  f.box('glow', sx, top + 8, zf - 2.8, 12, 9, .6, 0xffc060);
  const benches = [[153, 54], [124, 40], [95, 28], [76, 21], [57, 14], [38, 7], [19, 0], [-1, 0]] as const;
  const glow = new Beacons(c.root, 40, ambient.time);
  const falls: { x: number; y: number; z: number; w: number; h: number }[] = [];
  let x = sx, z = zf - 1;
  for (let k = 0; k + 1 < benches.length; k++) {
    const [y0] = benches[k], [y1, out1] = benches[k + 1], z1 = -116 - out1 - .6;
    f.beam('glow', [x, y0 + .4, z], [x + (r() - .5) * 4, y0 + .4, z1], 5 + k * .5, 0xffa030, .8);
    x += (r() - .5) * 4; z = z1;
    falls.push({ x, y: (y0 + y1) / 2, z: z + .4, w: 9 + k * .8, h: y0 - y1 });
    glow.add(x, y1 + 2, z + 2, 24 + k * 2, 0xff7a20, -1, k * .19, 1);
  }
  f.done();
  const sheets: THREE.BufferGeometry[] = [];
  for (const fl of falls) sheets.push(new THREE.PlaneGeometry(fl.w, fl.h, 1, 4).translate(fl.x, fl.y, fl.z));
  const geometry = mergeGeometries(sheets);
  sheets.forEach(g => g.dispose());
  const material = new THREE.ShaderMaterial({
    name: 'hollowmere molten falls', transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
    uniforms: { uTime: ambient.time },
    vertexShader: `varying vec2 vUv; varying vec3 vPos; void main() { vUv = uv; vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }`,
    fragmentShader: `
      uniform float uTime; varying vec2 vUv; varying vec3 vPos;
      void main() {
        float edge = smoothstep( 0.0, .25, vUv.x ) * smoothstep( 1.0, .75, vUv.x );
        float flow = .55 + .45 * sin( vPos.y * .9 + uTime * 9.0 + sin( vPos.x * 2.1 ) * 2.0 );
        vec3 hot = mix( vec3( 1.0, .3, .04 ), vec3( 1.0, .7, .3 ), flow * edge );
        gl_FragColor = vec4( hot * ( .85 + .45 * flow ), edge * .95 );
      }`,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'hollowmere molten falls'; mesh.renderOrder = 2; mesh.frustumCulled = false;
  c.root.add(mesh);
  glow.add(sx, top + 10, zf - 2, 60, 0xffa040, -1, .5, 1);
  glow.finish('hollowmere molten glow', 1.8);
  const last = falls[falls.length - 1];
  ambient.motes({ min: [last.x - 14, 0, last.z - 6], max: [last.x + 14, 16, last.z + 14], count: 160, velocity: [.4, 3.2, .6], size: .09, color: 0xffb040, color2: 0xffe8a0, opacity: 1, additive: true, twinkle: 1, wobble: 2, seed: 1602 });
  ambient.motes({ min: [sx - 30, 20, zf - 10], max: [sx + 30, 170, zf + 30], count: 140, velocity: [.6, 2.4, .8], size: .12, color: 0xff8a30, color2: 0xffd080, opacity: .95, additive: true, twinkle: 1, wobble: 2, seed: 1603 });
  const steam = falls.map(fl => ({ x: fl.x, y: fl.y - fl.h / 2 + 2, z: fl.z + 6, size: 14 + fl.w }));
  ambient.puffs({ spots: steam, color: 0xc89a84, shade: 0x4a3434, opacity: .5, life: 9, rise: 10, grow: 2.4, drift: [1.4, 0, 1], cel: true, seed: 1604, order: 0 });
  ambient.puffs({ spots: [0, 1, 2, 3, 4, 5].map(k => ({ x: sx + (k - 2.5) * 6, y: top + 76 + k * 12, z: zf - 22, size: 24 + k * 8 })), color: 0x5a4440, shade: 0x1a1214, opacity: .8, life: 18, rise: 9, grow: 2.2, drift: [3, 0, 1], cel: true, seed: 1605, order: 0 });
  crater(c, { size: 36, cx: -3, cz: 6, x: -3, z: 6, radius: 3.4, reach: 12, heart: 0, seed: 1606, strokes: [[[-18, 18], [10, -8]]], lit: Math.PI / 2,
    ember: 0xff7a24, strength: .5, litStone: 'rgba(210,180,150,.85)', darkStone: 'rgba(50,36,30,.85)', name: 'hollowmere crater' });
}

/** The bucket-wheel digger at the foot of the west wall (own/quarry-digger.glb), its work lights lit, and the colossal drill
 *  embedded in the north wall, molten ore pouring from its broken seams (own/quarry-drill.glb). */
async function digger(c: DressContext) {
  const { kit } = c, prev = kit.grade;
  kit.grade = (material, piece) => {
    prev?.(material, piece);
    if (piece === 'own/quarry-drill') {
      heroAir(material, .15, .2);
      if (material.map) { material.emissive.setRGB(1, .55, .2); material.emissiveMap = material.map; material.emissiveIntensity = .5; material.needsUpdate = true; }
    }
    if (piece === 'own/quarry-digger') {
      heroAir(material, .12, .2); material.color.multiply(new THREE.Color(0xd89870));
      if (material.map) { material.emissive.setRGB(1, .5, .25); material.emissiveMap = material.map; material.emissiveIntensity = .25; material.needsUpdate = true; }
    }
  };
  await kit.load(['own/quarry-digger', 'own/quarry-drill']);
  kit.place('own/quarry-digger', { x: -120, z: 30, y: 0, height: 60, rot: DIGGER_ROT });
  kit.place('own/quarry-drill', { x: -6, z: -168, y: 58, width: 84, rot: 0, tilt: .26, shadow: false });
  kit.flush(c.stage);
  const glow = new Beacons(c.root, 8, c.ambient.time);
  for (const [x, y, z] of [[-86, 22, 30], [-84, 38, 26], [-88, 54, 32], [-104, 30, 30], [-130, 40, 30]] as const) glow.add(x, y, z, 6, 0xffd090, -1, y * .03, 1);
  glow.finish('hollowmere digger lamps', 1.6);
}
/** The digger's turn: its wheel toward the west wall. */
const DIGGER_ROT = -Math.PI / 2;
