// Dev tool, not in the game's build: the ball modes' faces (render/ball/ballFaces.ts) - each body's head close up, drawn
// by the game's own Fighter standing in its idle, at rest and in each of the four poses held full, a row a body.
//   /tools/ball_faces_sheet.html?ids=kenzo,kosho&cell=200[&form=1][&turn=0][&poses=rest,focus,shout,grin,hurt][&seen=rest,shout]
//     [&span=2.6]    how many eye bone spacings the map shows from top to bottom
//     [&map=1]       the face as its texture paints it, flat from the front in the face's own units (eye spacings), with
//                    the fit drawn on it: the eyes' centres, the mouth's line and width (yellow), the chin (red)
//     [&measure=1]   the fit measured off that map for bodies the table does not have (the table's own otherwise)
//     [&weights=1]   the weights given to the face's bones drawn over the rest column (eyes green and blue, the mouth red)
//     [&wire=1]      the mesh's edges over every column
//     [&frame=5.2]   how many of the face's own units (the painted eyes' spacing) the head's frame is high
// `seen`: the pose as the goal's close-up frames it (BallCeremony.closeUp: 3.3 body heights off at its middle, a 34 degree
// lens) on a 1280 x 720 page, the head's pixels as they are, drawn three times as big. `window.sheetData` returns each body's
// measured fit, the table's, and why a body was refused.
import * as THREE from 'three';
import { FighterLibrary, type Fighter } from '../src/render/Fighter';
import { FIGHTERS } from '../src/config';
import { FACE_FIT, faceFitOf, faceOf, faceRefusals, holdFace, tryFit, type FaceFit, type FaceKey } from '../src/render/ball/ballFaces';
import type { FighterId, PlayerState } from '../src/game/types';

const params = new URLSearchParams(location.search);
const ids = (params.get('ids') ?? 'kenzo').split(',').filter(Boolean) as FighterId[];
const form = params.get('form') === '1', cell = Number(params.get('cell') ?? 200), label = 130;
const turns = (params.get('turn') ?? '0').split(',').map(Number);
const poses = (params.get('poses') ?? 'rest,focus,shout,grin,hurt').split(',').filter(Boolean) as (FaceKey | 'rest')[];
const seen = (params.get('seen') ?? '').split(',').filter(Boolean) as (FaceKey | 'rest')[];
const showDepth = params.get('depth') === '1', showMap = params.get('map') === '1' || showDepth, measure = params.get('measure') === '1', showWeights = params.get('weights') === '1', wire = params.get('wire') === '1';
const mapSpan = Number(params.get('span') ?? 2.6);
const status = (s: string) => { document.title = s; return s; };

/** The face as its texture paints it, flat from the front: for each point of a grid in the face's units, the colour of
 *  the front-most triangle of the head under it (bind pose), or none. */
interface FaceMap { x0: number; y0: number; step: number; w: number; h: number; rgb: Float32Array; hit: Uint8Array; depth: Float32Array }
const MAP = { x0: -2, x1: 2, y0: 1.2, y1: -3.4, step: .02 };
async function faceMap(model: THREE.Object3D): Promise<FaceMap | string> {
  const face = faceOf(model);
  if (typeof face === 'string') return face;
  const mesh = face.skinned, geometry = mesh.geometry, material = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial;
  const image = material.map?.image as (CanvasImageSource & { width: number; height: number }) | undefined;
  if (!image) return 'no texture';
  const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!; ctx.drawImage(image, 0, 0);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const flip = material.map!.flipY;
  const positions = geometry.getAttribute('position'), uvs = geometry.getAttribute('uv'), ids = geometry.getAttribute('skinIndex'), amounts = geometry.getAttribute('skinWeight');
  const index = geometry.index;
  if (!uvs) return 'no uv';
  const inHead = new Set(face.at);
  const toFace = face.frameInverse.clone().multiply(mesh.bindMatrix);
  const n = positions.count, P = new Float32Array(n * 3), headish = new Uint8Array(n), v = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    v.fromBufferAttribute(positions, i).applyMatrix4(toFace); P[i * 3] = v.x; P[i * 3 + 1] = v.y; P[i * 3 + 2] = v.z;
    let w = 0; for (let j = 0; j < 4; j++) if (inHead.has(ids.getComponent(i, j))) w += amounts.getComponent(i, j);
    headish[i] = w > .5 ? 1 : 0;
  }
  const w = Math.round((MAP.x1 - MAP.x0) / MAP.step) + 1, h = Math.round((MAP.y0 - MAP.y1) / MAP.step) + 1;
  const depth = new Float32Array(w * h).fill(-Infinity), rgb = new Float32Array(w * h * 3), hit = new Uint8Array(w * h);
  const tri = index ? index.count / 3 : n / 3;
  for (let t = 0; t < tri; t++) {
    const a = index ? index.getX(t * 3) : t * 3, b = index ? index.getX(t * 3 + 1) : t * 3 + 1, c = index ? index.getX(t * 3 + 2) : t * 3 + 2;
    if (!headish[a] || !headish[b] || !headish[c]) continue;
    const ax = P[a * 3], ay = P[a * 3 + 1], az = P[a * 3 + 2], bx = P[b * 3], by = P[b * 3 + 1], bz = P[b * 3 + 2], cx = P[c * 3], cy = P[c * 3 + 1], cz = P[c * 3 + 2];
    if (Math.max(az, bz, cz) < -.6) continue;
    const det = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
    if (Math.abs(det) < 1e-9) continue;
    const i0 = Math.max(0, Math.ceil((Math.min(ax, bx, cx) - MAP.x0) / MAP.step)), i1 = Math.min(w - 1, Math.floor((Math.max(ax, bx, cx) - MAP.x0) / MAP.step));
    const j0 = Math.max(0, Math.ceil((MAP.y0 - Math.max(ay, by, cy)) / MAP.step)), j1 = Math.min(h - 1, Math.floor((MAP.y0 - Math.min(ay, by, cy)) / MAP.step));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = MAP.x0 + i * MAP.step, y = MAP.y0 - j * MAP.step;
      const l1 = ((by - cy) * (x - cx) + (cx - bx) * (y - cy)) / det, l2 = ((cy - ay) * (x - cx) + (ax - cx) * (y - cy)) / det, l3 = 1 - l1 - l2;
      if (l1 < -1e-4 || l2 < -1e-4 || l3 < -1e-4) continue;
      const z = l1 * az + l2 * bz + l3 * cz, k = j * w + i;
      if (z <= depth[k]) continue;
      depth[k] = z; hit[k] = 1;
      let u = l1 * uvs.getX(a) + l2 * uvs.getX(b) + l3 * uvs.getX(c), vv = l1 * uvs.getY(a) + l2 * uvs.getY(b) + l3 * uvs.getY(c);
      u -= Math.floor(u); vv -= Math.floor(vv); if (flip) vv = 1 - vv;
      const px = Math.min(canvas.width - 1, Math.floor(u * canvas.width)), py = Math.min(canvas.height - 1, Math.floor(vv * canvas.height)), o = (py * canvas.width + px) * 4;
      rgb[k * 3] = pixels[o] / 255; rgb[k * 3 + 1] = pixels[o + 1] / 255; rgb[k * 3 + 2] = pixels[o + 2] / 255;
    }
  }
  return { x0: MAP.x0, y0: MAP.y0, step: MAP.step, w, h, rgb, hit, depth };
}
const lum = (m: FaceMap, k: number) => .3 * m.rgb[k * 3] + .59 * m.rgb[k * 3 + 1] + .11 * m.rgb[k * 3 + 2];

/** The fit read off the map, a first guess judged on the sheet:
 *  - the skin's plane: the median depth of the cheeks (under each eye bone, where no fringe reaches); anything a third of
 *    an eye spacing in front of it is hair (or a hat) and is not read;
 *  - each eye: the lowest row nearly as dark as the darkest down a band through its bone (the lashes are the last dark
 *    line above the cheek; a brow or a fringe higher up is as dark), and the dark's middle across that row;
 *  - the chin: where the middle of the face ends or falls back toward the neck under the eyes;
 *  - the mouth: the darkest stretch across the middle between the nose and the chin, its width where that line stays
 *    darker than skin. */
function measureFit(m: FaceMap): FaceFit & { notes: string } {
  const at = (x: number, y: number) => { const i = Math.round((x - m.x0) / m.step), j = Math.round((m.y0 - y) / m.step); return i >= 0 && i < m.w && j >= 0 && j < m.h && m.hit[j * m.w + i] ? j * m.w + i : -1; };
  const median = (list: number[], fallback: number) => { if (!list.length) return fallback; list.sort((a, b) => a - b); return list[Math.floor(list.length / 2)]; };
  const notes: string[] = [];
  // The skin: down the middle of the face between the eyes and the mouth (the nose and the cheeks beside it), where a
  // fringe or a side lock seldom reaches.
  const midZ: number[] = [], skin: number[] = [];
  for (let y = -.35; y > -.7; y -= m.step) for (let x = -.3; x <= .3 + 1e-6; x += m.step) { const k = at(x, y); if (k >= 0) { midZ.push(m.depth[k]); skin.push(lum(m, k)); } }
  const plane = median(midZ, 0), skinL = median(skin, .7), proud = plane + .33;
  const deep = (k: number) => k >= 0 && m.depth[k] < proud;
  // The eyes: down a band through each eye bone, the lowest row nearly as dark as the darkest (a brow or a fringe above
  // is as dark; the eye's lashes are the last dark line before the cheek), then the dark's middle across that row.
  const band = (side: number, y: number) => { let d = 0, c = 0; for (let x = .25; x <= .75 + 1e-6; x += m.step) { const k = at(side * x, y); if (deep(k)) { d += Math.max(0, skinL - lum(m, k)); c++; } } return c >= 4 ? d / c : 0; };
  const eyeAt = (side: number) => {
    const rows: { y: number; d: number }[] = [];
    for (let y = .4; y > -.95; y -= m.step) rows.push({ y, d: (band(side, y + m.step) + band(side, y) * 2 + band(side, y - m.step)) / 4 });
    const most = Math.max(...rows.map(r => r.d));
    if (most < .08) return { x: side * .5, y: 0, w: 0 };
    let pick = rows[0];
    for (let i = 1; i < rows.length - 1; i++) if (rows[i].d >= .6 * most && rows[i].d >= rows[i - 1].d && rows[i].d >= rows[i + 1].d) pick = rows[i];
    let sx = 0, sw = 0;
    for (let y = pick.y + .06; y > pick.y - .07; y -= m.step) for (let x = .12; x <= .95; x += m.step) { const k = at(side * x, y); if (!deep(k)) continue; const d = Math.max(0, skinL - .1 - lum(m, k)); sx += d * side * x; sw += d; }
    return { x: sw > 0 ? sx / sw : side * .5, y: pick.y, w: most };
  };
  const l = eyeAt(1), r = eyeAt(-1);
  const eyeY = l.w && r.w ? (l.y + r.y) / 2 : l.w ? l.y : r.w ? r.y : 0;
  // The chin: down the middle from under the eyes, the last row before the head's front ends or falls back toward the neck.
  let chin = eyeY - 1.2, above = Infinity;
  for (let y = eyeY - .3; y > MAP.y1; y -= m.step) {
    const k = at(0, y);
    if (k < 0 || m.depth[k] < above - .15) break;
    chin = y; above = m.depth[k];
  }
  // The mouth: the darkest stretch across the middle between the nose and the chin.
  let mouth = (eyeY + chin) / 2, best = -Infinity;
  for (let y = eyeY - .4; y > chin + .06; y -= m.step) {
    let dark = 0, count = 0;
    for (let x = -.2; x <= .2 + 1e-6; x += m.step) { const k = at(x, y); if (!deep(k)) continue; dark += Math.max(0, skinL - lum(m, k)); count++; }
    if (count < 5) continue;
    if (dark / count > best) { best = dark / count; mouth = y; }
  }
  let wide = .15;
  for (let x = .04; x < .9; x += m.step) {
    let dark = false;
    for (const dy of [-m.step, 0, m.step]) for (const sx of [1, -1]) { const k = at(sx * x, mouth + dy); if (deep(k) && skinL - lum(m, k) > .1) dark = true; }
    if (!dark) break; wide = x;
  }
  if (params.get('profile') === '1') {
    const rows: string[] = [];
    for (let y = .4; y > -2; y -= .04) {
      const k = at(0, y), side = [1, -1].map(sd => { let d = 0, c = 0; for (let x = .3; x <= .7; x += m.step) { const q = at(sd * x, y); if (deep(q)) { d += Math.max(0, skinL - lum(m, q)); c++; } } return c ? (d / c).toFixed(2) : ' -  '; });
      rows.push(`${y.toFixed(2)} z ${k >= 0 ? m.depth[k].toFixed(2) : '  - '} L ${k >= 0 ? lum(m, k).toFixed(2) : '  - '} eyes ${side.join(' ')}`);
    }
    notes.push('\n' + rows.join('\n'));
  }
  notes.push(`plane ${plane.toFixed(2)} skin ${skinL.toFixed(2)} mouth ${best.toFixed(3)} eyes ${l.w.toFixed(2)}/${r.w.toFixed(2)}`);
  const round = (x: number) => Math.round(x * 100) / 100;
  return { eye: round(eyeY), apart: round(l.w && r.w ? Math.max(.3, Math.min(.7, (l.x - r.x) / 2)) : .5), mouth: round(mouth), wide: round(Math.max(.15, Math.min(.6, wide))), chin: round(chin), notes: notes.join('; ') };
}

async function main() {
  for (const id of ids) if (!FIGHTERS[id]) { status(`error: unknown fighter ${id}`); return; }
  const columns = (showMap ? 1 : 0) + poses.length * turns.length + seen.length;
  const width = label + columns * cell, height = ids.length * cell + 18;
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.setSize(width, height);
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.setScissorTest(true);
  renderer.domElement.style.cssText = 'position:absolute;left:0;top:0';
  document.body.append(renderer.domElement);
  renderer.setClearColor(0x2a3140, 1); renderer.clear();
  const flat = document.createElement('canvas'); flat.width = width; flat.height = height;
  flat.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none';
  document.body.append(flat);
  const paint = flat.getContext('2d')!; paint.imageSmoothingEnabled = false;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x2a3140);
  // The arena's lights (GameRenderer), as the moves sheet and the busts have them.
  scene.add(new THREE.HemisphereLight(0xd7eaff, 0x324c70, .85));
  const sun = new THREE.DirectionalLight(0xfff0d6, 2.7); sun.position.set(2.5, 4, 4); scene.add(sun);
  const fill = new THREE.DirectionalLight(0x8bbbff, .3); fill.position.set(-3, 2, -2); scene.add(fill);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(6, 32), new THREE.MeshLambertMaterial({ color: 0x3b4a3a }));
  floor.rotation.x = -Math.PI / 2; scene.add(floor);
  const overlay = document.createElement('div');
  overlay.style.cssText = `position:absolute;left:0;top:0;width:${width}px;height:${height}px;font:11px/1.25 monospace;color:#fff;pointer-events:none`;
  document.body.append(overlay);
  const note = (x: number, y: number, text: string, color = '#fff', size = 11) => {
    const d = document.createElement('div'); d.textContent = text;
    d.style.cssText = `position:absolute;left:${x}px;top:${y}px;color:${color};font-size:${size}px;white-space:pre;text-shadow:0 1px 2px #000`;
    overlay.append(d);
  };
  const heads = [...(showMap ? ['map'] : []), ...poses.flatMap(p => turns.map(t => `${p}${turns.length > 1 ? ` ${t}` : ''}`)), ...seen.map(p => `${p} as seen`)];
  heads.forEach((h, c) => note(label + c * cell + 4, 2, h, '#ffd76b', 12));
  // The close-up's frame, drawn at a 1280 x 720 page's size (its head's pixels cropped from it).
  const page = new THREE.WebGLRenderTarget(1280, 720, { samples: 4, colorSpace: THREE.SRGBColorSpace });
  const library = new FighterLibrary();
  const data: unknown[] = [];
  for (let r = 0; r < ids.length; r++) {
    const id = ids[r], top = 18 + r * cell, glTop = height - top - cell;
    status(`loading ${id}`);
    await library.ensure([id]);
    const state = {
      id: 'sheet', name: 'Sheet', fighter: id, x: 0, y: 0, z: 0, yaw: 0, hp: 1000, maxHp: 1000, stamina: 100, maxStamina: 100, ultimate: 0,
      action: 'idle', actionStarted: 0, actionDuration: 0, actionTime: 0, target: null, alive: true, isBot: false, grounded: true,
      guarding: false, cooldowns: { light: 0, heavy: 0, special: 0, ultimate: 0 }, ...(form ? { awakened: true, awakenedUntil: 1e9 } : {}),
    } as PlayerState;
    const fighter: Fighter = library.create(state);
    scene.add(fighter.group);
    for (let i = 0; i < 50; i++) fighter.update(1 / 60, { ...state }, false, 1 / 60);
    fighter.group.updateMatrixWorld(true);
    const body = fighter.shownBody as Fighter, model = (body as unknown as { model: THREE.Object3D }).model;
    const row: Record<string, unknown> = { id, form };
    // The map, and the fit: the table's, else (measure=1) the map's.
    const map = await faceMap(model);
    let fit = faceFitOf(id, form);
    if (typeof map === 'string') row.map = map;
    else if (measure && !fit) { const measured = measureFit(map); row.measured = measured; const { notes: _, ...f } = measured; fit = f; tryFit(id, form, fit); }
    row.fit = fit ?? null;
    if (showMap && typeof map !== 'string') {
      const image = paint.createImageData(map.w, map.h);
      // (depth=1: how far out of the face each point stands, a quarter of an eye spacing a band, the eyes' plane mid grey.)
      for (let i = 0; i < map.w * map.h; i++) {
        const o = i * 4, d = map.depth[i], band = Math.floor(d / .25), shade = THREE.MathUtils.clamp(.5 + d * .35, 0, 1) * (band % 2 ? .85 : 1);
        if (showDepth) { image.data[o] = image.data[o + 1] = shade * 255; image.data[o + 2] = (band === 0 ? .9 : shade) * 255; }
        else { image.data[o] = map.rgb[i * 3] * 255; image.data[o + 1] = map.rgb[i * 3 + 1] * 255; image.data[o + 2] = map.rgb[i * 3 + 2] * 255; }
        image.data[o + 3] = map.hit[i] ? 255 : 40;
      }
      const holder = document.createElement('canvas'); holder.width = map.w; holder.height = map.h; holder.getContext('2d')!.putImageData(image, 0, 0);
      // The window shown: `span` eye bone spacings high (2.6: from .6 above the eyes' line to 2 below), filling the cell.
      const unit = cell / mapSpan, x0 = label + cell / 2 - (0 - map.x0) * unit, y0 = top - (map.y0 - .6 * mapSpan / 2.6) * unit;
      paint.save(); paint.beginPath(); paint.rect(label, top, cell, cell); paint.clip();
      paint.drawImage(holder, x0, y0, map.w * map.step * unit, map.h * map.step * unit);
      const sx = (x: number) => x0 + (x - map.x0) * unit, sy = (y: number) => y0 + (map.y0 - y) * unit;
      paint.lineWidth = 1;
      // A grid in eye spacings: a line every quarter, the eyes' line (0) and every whole one brighter.
      paint.font = '9px monospace'; paint.fillStyle = 'rgba(160,220,255,.9)';
      for (let g = -20; g <= 6; g++) { const y = g / 10; paint.strokeStyle = g % 10 === 0 ? 'rgba(120,200,255,.6)' : g % 5 === 0 ? 'rgba(120,200,255,.32)' : 'rgba(120,200,255,.13)'; paint.beginPath(); paint.moveTo(label, sy(y)); paint.lineTo(label + cell, sy(y)); paint.stroke(); if (g % 5 === 0) paint.fillText(y.toFixed(1), label + 2, sy(y) - 2); }
      for (let g = -11; g <= 11; g++) { const x = g / 10; paint.strokeStyle = g % 5 === 0 ? 'rgba(120,200,255,.35)' : 'rgba(120,200,255,.1)'; paint.beginPath(); paint.moveTo(sx(x), top); paint.lineTo(sx(x), top + cell); paint.stroke(); }
      if (fit) {
        paint.strokeStyle = '#7dffb0'; for (const side of [1, -1]) { paint.beginPath(); paint.arc(sx(side * fit.apart), sy(fit.eye), 3, 0, 7); paint.stroke(); }
        paint.strokeStyle = fit.mouthless ? '#888' : '#ffd76b'; paint.beginPath(); paint.moveTo(sx(-fit.wide), sy(fit.mouth)); paint.lineTo(sx(fit.wide), sy(fit.mouth)); paint.stroke();
        paint.strokeStyle = '#ff6b6b'; paint.beginPath(); paint.moveTo(sx(-.3), sy(fit.chin)); paint.lineTo(sx(.3), sy(fit.chin)); paint.stroke();
      }
      paint.restore();
    }
    // The poses, front on (and from each turn asked for).
    const eyesAt = () => { let f: THREE.Object3D | undefined; model.traverse(o => { if (!f && o.name === 'FacialBone') f = o; }); return f?.getWorldPosition(new THREE.Vector3()); };
    const at = eyesAt() ?? new THREE.Vector3(0, 1.6, 0);
    // Framed on the face itself: its painted eyes' spacing in the world (an awakened giant's is a giant's), and the body
    // as tall as its eyes stand over the floor (for the close-up's lens).
    const named = (name: string) => { let found: THREE.Object3D | undefined; model.traverse(o => { if (!found && o.name === name) found = o; }); return found?.getWorldPosition(new THREE.Vector3()); };
    const eyeL = named('L_Eye'), eyeR = named('R_Eye'), unit = eyeL && eyeR ? eyeL.distanceTo(eyeR) * (fit?.apart ?? .5) / .5 : .07;
    const tall = Math.max(.8, (at.y - fighter.group.position.y) / .9), span = unit * Number(params.get('frame') ?? 5.2);
    const camera = new THREE.PerspectiveCamera(18, 1, .02, 100), distance = span / (2 * Math.tan(THREE.MathUtils.degToRad(9)));
    const wires: THREE.Object3D[] = [];
    const overlayMesh = (make: (mesh: THREE.SkinnedMesh) => THREE.Material | null) => {
      const made: THREE.Object3D[] = [];
      model.traverse(o => {
        const mesh = o as THREE.SkinnedMesh;
        if (!mesh.isSkinnedMesh || !mesh.visible || /-ink$/.test(mesh.name)) return;
        const material = make(mesh); if (!material) return;
        const w = new THREE.SkinnedMesh(mesh.geometry, material);
        w.bind(mesh.skeleton, mesh.bindMatrix); w.bindMode = mesh.bindMode; mesh.parent!.add(w); w.position.copy(mesh.position); w.quaternion.copy(mesh.quaternion); w.scale.copy(mesh.scale); made.push(w);
      });
      return made;
    };
    let col = showMap ? 1 : 0;
    const okay = holdFace(body, state, null);
    if (!okay) row.refused = faceRefusals.get(`${id}${form ? ':form' : ''}`);
    for (const pose of poses) {
      if (okay) holdFace(body, state, pose === 'rest' ? null : pose);
      let shown: THREE.Object3D[] = [];
      if (wire) shown = overlayMesh(() => new THREE.MeshBasicMaterial({ color: 0x00ffaa, wireframe: true, transparent: true, opacity: .3 }));
      if (showWeights && pose === 'rest' && okay) {
        // The face bones' weights as colours: the left eye green, the right blue, the mouth red.
        const face = faceOf(model);
        if (typeof face !== 'string') shown.push(...overlayMesh(mesh => {
          if (mesh.skeleton !== face.skeleton) return null;
          const g = mesh.geometry, ids2 = g.getAttribute('skinIndex'), amounts = g.getAttribute('skinWeight'), colours = new Float32Array(ids2.count * 4);
          for (let i = 0; i < ids2.count; i++) for (let j = 0; j < 4; j++) {
            const b = ids2.getComponent(i, j), w = amounts.getComponent(i, j);
            if (b === face.at[0]) colours[i * 4] += w; else if (b === face.at[1]) colours[i * 4 + 1] += w; else if (b === face.at[2]) colours[i * 4 + 2] += w;
            colours[i * 4 + 3] = Math.min(1, colours[i * 4] + colours[i * 4 + 1] + colours[i * 4 + 2]) * .85;
          }
          g.setAttribute('faceDebug', new THREE.BufferAttribute(colours, 4));
          const m = new THREE.ShaderMaterial({ transparent: true, depthTest: true, depthWrite: false,
            vertexShader: '#include <common>\n#include <skinning_pars_vertex>\nattribute vec4 faceDebug;varying vec4 vC;void main(){vC=faceDebug;\n#include <skinbase_vertex>\n#include <begin_vertex>\n#include <skinning_vertex>\n#include <project_vertex>\n}',
            fragmentShader: 'varying vec4 vC;void main(){gl_FragColor=vec4(vC.rgb,vC.a);}' });
          return m;
        }));
      }
      for (const turn of turns) {
        const look = at.clone().add(new THREE.Vector3(0, -span * .12, 0));
        camera.position.set(look.x + Math.sin(turn) * distance, look.y + span * .06, look.z + Math.cos(turn) * distance);
        camera.lookAt(look);
        const x = label + col * cell;
        renderer.setViewport(x, glTop, cell, cell); renderer.setScissor(x, glTop, cell, cell);
        renderer.render(scene, camera);
        col++;
      }
      for (const w of shown) w.removeFromParent();
    }
    // As the goal's close-up frames it, at a 1280 x 720 page's size: three times as big, pixel for pixel.
    for (const pose of seen) {
      if (okay) holdFace(body, state, pose === 'rest' ? null : pose);
      const lens = new THREE.PerspectiveCamera(34, 1280 / 720, .1, 200), base = fighter.group.position;
      lens.position.set(base.x + 0, base.y + 1.55 * tall / 1.75, base.z + 3.3 * tall / 1.75);
      lens.lookAt(base.x, base.y + 1.35 * tall / 1.75, base.z);
      renderer.setRenderTarget(page); renderer.setViewport(0, 0, 1280, 720); renderer.setScissor(0, 0, 1280, 720); renderer.render(scene, lens); renderer.setRenderTarget(null);
      const p = at.clone().project(lens), cx = Math.round((p.x + 1) / 2 * 1280), cy = Math.round((p.y + 1) / 2 * 720), crop = Math.floor(cell / 3);
      const buffer = new Uint8Array(crop * crop * 4);
      renderer.readRenderTargetPixels(page, Math.max(0, cx - crop / 2), Math.max(0, cy - crop * .6), crop, crop, buffer);
      const image = paint.createImageData(crop, crop);
      for (let j = 0; j < crop; j++) image.data.set(buffer.subarray((crop - 1 - j) * crop * 4, (crop - j) * crop * 4), j * crop * 4);
      const holder = document.createElement('canvas'); holder.width = crop; holder.height = crop; holder.getContext('2d')!.putImageData(image, 0, 0);
      paint.drawImage(holder, label + col * cell, top, crop * 3, crop * 3);
      col++;
    }
    if (okay) holdFace(body, state, null);
    note(6, top + 6, `${id}${form ? ' form' : ''}`, '#7dffb0', 13);
    note(6, top + 24, `${tall.toFixed(2)} m`, '#9fb4d0', 10);
    if (fit) note(6, top + 40, `eye ${fit.eye} apart ${fit.apart}\nmouth ${fit.mouth} wide ${fit.wide}\nchin ${fit.chin}${fit.mouthless ? '\nno mouth' : ''}`, '#9fb4d0', 10);
    note(6, top + 92, row.measured ? 'measured' : FACE_FIT[form ? `${id}:form` : id] ? 'ON' : String(row.refused ?? row.map ?? 'off'), row.measured ? '#ff9f6b' : FACE_FIT[form ? `${id}:form` : id] ? '#7dffb0' : '#ff6b6b', 11);
    data.push(row);
    for (const w of wires) w.removeFromParent();
    scene.remove(fighter.group); fighter.dispose();
  }
  (window as unknown as { sheetData: unknown }).sheetData = data;
  status('ready');
}
main().catch(error => status('error: ' + String(error).slice(0, 300)));
