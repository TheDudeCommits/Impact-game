// Dev tool, not in the game's build: one fighter's twelve techniques (game/techniques.ts) drawn by the game's own
// Fighter - the takes fitted to the body as a match fits them (engine/client/styleMoves.ts) - a row of frames each, from
// one fixed camera, with the body's own heavy on top to judge them against. Under each frame, what the pose measures:
// how far the back leans off upright, the head's height over the hips (a share of the stance's), and how far the chest
// turns from the opponent. `window.sheetData` returns the numbers.
//   /tools/technique_sheet.html?id=nigo&frames=7&cell=180
import * as THREE from 'three';
import { FighterLibrary, type Fighter } from '../src/render/Fighter';
import { FIGHTERS } from '../src/config';
import { moveFor } from '../src/game/awakening';
import { TECHNIQUE_KEYS, TECHNIQUE_SLOT, techniqueMove, techniqueName, styleOf, type TechniqueKey } from '../src/game/techniques';
import { installStyleMoves, stylesReady, styleTake, styleReport, fitTake } from '../src/engine/client/styleMoves';
import { Fighter as FighterClass } from '../src/render/Fighter';
import { resolveSkeleton } from '../src/render/skeleton';
import type { FighterId, PlayerState } from '../src/game/types';

const params = new URLSearchParams(location.search);
const id = (params.get('id') ?? 'taisei') as FighterId;
const frames = Number(params.get('frames') ?? 7), cell = Number(params.get('cell') ?? 180), label = 190;
// `takes=rise:blade-rise@.53,rush:fists-rush@.5`: a row each for those takes, thrown as those techniques - a style's
// candidates side by side on one body - instead of the fighter's own twelve.
const forced = (params.get('takes')?.split(',').filter(Boolean) ?? []).map(spec => { const [key, rest] = spec.split(':'); const [take, contact] = rest.split('@'); return { key: key as TechniqueKey, take, contact: Number(contact ?? .5) }; });
const keys = (forced.length ? forced.map(f => f.key) : params.get('keys')?.split(',') ?? TECHNIQUE_KEYS) as TechniqueKey[];
const status = (s: string) => { document.title = s; return s; };
interface Row { key: string; name: string; take: string; contact?: number; frames: { t: number; lean: number; head: number; turn: number; drop: number; reach: number }[] }

(window as unknown as { fighterIds: string[] }).fighterIds = Object.keys(FIGHTERS);
async function main() {
  if (!FIGHTERS[id]) { status('error: unknown fighter'); return; }
  installStyleMoves();
  const rows = forced.length ? forced.map((_, i) => `#${i}`) : ['own heavy', ...keys];
  let pinned: { key: TechniqueKey; take: string; contact: number } | undefined;
  if (forced.length) FighterClass.styleMove = (scene, clips, fighter, key) => fitTake(scene, clips, fighter, key, pinned && pinned.key === key ? pinned : styleTake(fighter, key));
  const width = label + frames * cell, height = rows.length * cell;
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.setSize(width, height);
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.setScissorTest(true);
  renderer.domElement.style.cssText = 'position:absolute;left:0;top:0';
  document.body.append(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x2a3140);
  scene.add(new THREE.HemisphereLight(0xd7eaff, 0x324c70, .85));
  const sun = new THREE.DirectionalLight(0xfff0d6, 2.7); sun.position.set(2.5, 4, 4); scene.add(sun);
  const fill = new THREE.DirectionalLight(0x8bbbff, .3); fill.position.set(-3, 2, -2); scene.add(fill);
  const library = new FighterLibrary();
  await library.ensure([id]);
  await stylesReady();
  const base: PlayerState = {
    id: 'sheet', name: 'Sheet', fighter: id, x: 0, y: 0, z: 0, yaw: 0, hp: 1000, maxHp: 1000, stamina: 100, maxStamina: 100, ultimate: 0,
    action: 'idle', actionStarted: 0, actionDuration: 0, actionTime: 0, target: null, alive: true, isBot: false, grounded: true,
    guarding: false, cooldowns: { light: 0, heavy: 0, special: 0, ultimate: 0 },
  } as PlayerState;
  const STEP = 1 / 120;
  let fighter = library.create(base); scene.add(fighter.group);
  // The joints the numbers are read off: the first skeleton in the body that resolves a back, a head and shoulders.
  const joint = (body: Fighter) => {
    const names: string[] = []; body.group.traverse(o => { if ((o as THREE.Bone).isBone) names.push(o.name); });
    const map = resolveSkeleton(names), find = (k: string) => { const n = map.get(k); let hit: THREE.Object3D | undefined; body.group.traverse(o => { if (!hit && (o as THREE.Bone).isBone && o.name === n) hit = o; }); return hit; };
    return { hips: find('Hips'), neck: find('Neck') ?? find('Head'), head: find('Head') ?? find('Neck'), l: find('LeftArm') ?? find('LeftShoulder'), r: find('RightArm') ?? find('RightShoulder'),
      ends: ['LeftHand', 'RightHand', 'LeftFoot', 'RightFoot'].map(find).filter((o): o is THREE.Object3D => !!o) };
  };
  const at = (o: THREE.Object3D | undefined) => o ? o.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3();
  const settle = (body: Fighter, state: PlayerState) => { for (let s = 0; s < .6; s += STEP) body.update(STEP, { ...state }, true); body.group.updateMatrixWorld(true); };
  const fresh = (state: PlayerState) => {
    scene.remove(fighter.group); fighter.dispose();
    fighter = library.create(state); scene.add(fighter.group);
    fighter.targetPoint = new THREE.Vector3(0, 1.2 + state.y, 2.6); fighter.targetDistance = 2.6;
    settle(fighter, state);
    return fighter;
  };
  // The stance, for the unit everything is measured in.
  fresh(base);
  const J0 = joint(fighter), hips0 = at(J0.hips), head0 = at(J0.head);
  // The body's height off its skeleton (a box round the group takes in its effects and props): the top of the head
  // is a head's length over the head joint.
  const tall = Math.max(.6, Math.min(8, head0.y + Math.max(.12, head0.y - at(J0.neck).y) * 1.6)), headOver0 = Math.max(.05, head0.y - hips0.y);
  const measure = (body: Fighter, y: number) => {
    const J = joint(body), hips = at(J.hips), neck = at(J.neck), head = at(J.head), l = at(J.l), r = at(J.r);
    const back = neck.clone().sub(hips), lean = back.lengthSq() > 1e-8 ? back.angleTo(new THREE.Vector3(0, 1, 0)) * 180 / Math.PI : 0;
    // The chest's forward: across the shoulders (left to right) crossed with up; the opponent stands at +z.
    const across = r.clone().sub(l), forward = new THREE.Vector3(0, 1, 0).cross(across).setY(0);
    const turn = forward.lengthSq() > 1e-8 ? Math.abs(Math.atan2(forward.x, forward.z)) * 180 / Math.PI : 0;
    // The hand or foot furthest out towards the opponent, ahead of the hips, in body heights.
    const reach = Math.max(...J.ends.map(o => (at(o).z - hips.z) / tall));
    return { lean: Math.round(lean), head: +((head.y - hips.y) / headOver0).toFixed(2), turn: Math.round(turn), drop: +((hips.y - y) / Math.max(.05, hips0.y)).toFixed(2), reach: +reach.toFixed(2) };
  };
  const span = tall * 1.6, fov = 24, distance = span / (2 * Math.tan(THREE.MathUtils.degToRad(fov / 2)));
  const camera = new THREE.PerspectiveCamera(fov, 1, .05, 400);
  // From behind the fighter and a little to its left and above, as the game's camera sees a player's fighter: a blow
  // thrown past the opponent reads at once. `view=side` films from the fighter's left side instead.
  const yaw = params.get('view') === 'side' ? .95 : Math.PI - .55;
  // The opponent: a grey post where a match's opponent stands.
  const post = new THREE.Mesh(new THREE.CylinderGeometry(.18 * tall, .18 * tall, tall * .9, 16), new THREE.MeshLambertMaterial({ color: 0x8890a0, transparent: true, opacity: .55 }));
  post.position.set(0, tall * .45, 1.3 * tall); scene.add(post);
  // Where the opponent stands: a red line on the floor from the fighter's feet towards them.
  const arrow = new THREE.Mesh(new THREE.BoxGeometry(.03 * tall, .01, .6 * tall), new THREE.MeshBasicMaterial({ color: 0xff4040 }));
  arrow.position.set(0, .005, .3 * tall); scene.add(arrow);
  const shoot = (row: number, col: number, y: number) => {
    const look = new THREE.Vector3(0, y + tall * .5, .45 * tall);
    arrow.position.y = y + .005; post.position.y = y + tall * .45;
    camera.position.set(look.x + Math.sin(yaw) * distance, look.y + span * .12, look.z + Math.cos(yaw) * distance);
    camera.lookAt(look);
    const x = label + col * cell, top = height - (row + 1) * cell;
    renderer.setViewport(x, top, cell, cell); renderer.setScissor(x, top, cell, cell);
    fighter.group.updateMatrixWorld(true);
    renderer.render(scene, camera);
  };
  const overlay = document.createElement('div');
  overlay.style.cssText = `position:absolute;left:0;top:0;width:${width}px;height:${height}px;font:11px/1.25 monospace;color:#fff;pointer-events:none`;
  document.body.append(overlay);
  const note = (x: number, y: number, text: string, color = '#fff', size = 11) => {
    const d = document.createElement('div'); d.textContent = text;
    d.style.cssText = `position:absolute;left:${x}px;top:${y}px;color:${color};font-size:${size}px;white-space:pre;text-shadow:0 1px 2px #000`;
    overlay.append(d);
  };
  const data: Row[] = [];
  rows.forEach((key, r) => {
    pinned = key.startsWith('#') ? forced[Number(key.slice(1))] : undefined;
    const technique = key === 'own heavy' ? undefined : pinned ? pinned.key : key as TechniqueKey;
    const air = technique === 'airRush' || technique === 'airRise';
    const y = air ? tall * .9 : 0;
    const slot = technique ? TECHNIQUE_SLOT[technique] : 'heavy';
    const move = technique ? techniqueMove(id, technique) : moveFor(id, 'heavy', false);
    const duration = move.duration, contact = Math.min(.9, Math.max(.1, (move.contacts?.[0] ?? duration * .5) / duration));
    // Seven moments: the start, the wind-up, the blow (framed in yellow) and the follow-through.
    const times = [.04, contact * .45, contact * .8, contact, contact + (1 - contact) * .3, contact + (1 - contact) * .62, .97].slice(0, frames);
    const rest: PlayerState = { ...base, y, grounded: !air };
    const body = fresh(rest);
    const state: PlayerState = { ...rest, action: slot, actionStarted: 10, actionSeq: 2, actionDuration: duration, ...(technique ? { branch: technique } : {}) } as PlayerState;
    const row: Row = { key, name: technique ? techniqueName(id, technique) : 'heavy', take: pinned ? pinned.take : technique ? styleTake(id, technique).take : '-', contact: +contact.toFixed(2), frames: [] };
    let col = 0, s = 0;
    for (const share of times) {
      for (; s < share * duration; s += STEP) body.update(STEP, { ...state, actionTime: Math.min(.999, s / duration) }, true);
      body.group.updateMatrixWorld(true);
      const m = measure(body, y);
      row.frames.push({ t: +share.toFixed(2), ...m });
      shoot(r, col, y);
      const bad = m.lean > 55 || m.head < .45 || m.turn > 120 || (share === contact && m.reach < .12);
      note(label + col * cell + 3, r * cell + cell - 15, `${m.lean}° h${m.head} t${m.turn} r${m.reach}`, bad ? '#ff6b6b' : '#cfe3ff', 10);
      if (share === contact) { const box = document.createElement('div'); box.style.cssText = `position:absolute;left:${label + col * cell}px;top:${r * cell}px;width:${cell - 4}px;height:${cell - 4}px;border:2px solid #ffd76b`; overlay.append(box); }
      col++;
    }
    data.push(row);
    note(6, r * cell + 8, `${technique ?? key}`, '#ffd76b', 13);
    note(6, r * cell + 26, `${row.name}`, '#fff', 11);
    note(6, r * cell + 42, `${row.take}`, '#9fb4d0', 10);
    note(6, r * cell + 56, `${duration.toFixed(2)} s ${slot}`, '#9fb4d0', 10);
  });
  note(6, 2, `${id} (${styleOf(id)})`, '#7dffb0', 12);
  (window as unknown as { sheetData: unknown }).sheetData = { id, style: styleOf(id), rows: data, fits: styleReport() };
  status('ready');
}
main().catch(error => status('error: ' + String(error).slice(0, 300)));
