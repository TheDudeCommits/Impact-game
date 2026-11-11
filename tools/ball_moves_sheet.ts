// Dev tool, not in the game's build: the ball modes' sports moves (render/ball/ballMoves.ts) on one fighter, drawn by the
// game's own Fighter through the same hook a match uses - each take fitted to the body, retimed onto the move's contact
// and played on its clock - a row of frames each from one fixed camera, the fighter's own light and heavy on top to judge
// them against. The ball is drawn where the striking foot, head or hands are on the contact frame (framed in yellow).
// Under each frame: the striking point ahead of the hips and over the floor (body heights). `window.sheetData` returns
// the numbers, the contact against the frame the striking point moves fastest (`peakMs`, the hit-frame check) and the fits.
//   /tools/ball_moves_sheet.html?id=kosho&frames=7&cell=170[&moves=GR.pass,SS.dig][&view=side][&own=0][&take=GR.power:cand K.simple][&compact=1][&kit=0]
// (The sport kit: every row draws its kit take, as `?ballmoves` does; `kit=0` the prototypes, as SHOOT's
// quick strike ships. The football takes: their rows draw them though their switches are off - nothing in a match does
// until the SPORT mode's rules ask - and a running take is played through at its own pace, as on the run, its contact
// checked where its extras put it.)
import * as THREE from 'three';
import { FighterLibrary, type Fighter } from '../src/render/Fighter';
import { FIGHTERS } from '../src/config';
import { BALL_MOVES, ballMoveReport, ballFitCost, ballMovesReady, fitBallMove, forceBallMove, installBallMoves, takeOf } from '../src/render/ball/ballMoves';
import type { BallMoveKey } from '../src/render/ball/ballMoveChoice';
import type { FighterId, PlayerState } from '../src/game/types';

const params = new URLSearchParams(location.search);
const id = (params.get('id') ?? 'kosho') as FighterId;
const frames = params.get('compact') ? 3 : Number(params.get('frames') ?? 7), cell = Number(params.get('cell') ?? 170), label = 150;
const status = (s: string) => { document.title = s; return s; };
/** Each move: the action it is thrown as, in the air or not, the limb that meets the ball, and the ball's radius.
 *  (The sport kit: a take played through - a guard's, a celebration's on the victory pose, the carry's run,
 *  the dive's dash and its get-up - is drawn across `span` seconds, with no hit-frame check: no rule's contact times it.) */
//  (`at`: played through at the take's own length, its contact checked at the take's own - the football takes.)
const ROWS: Record<BallMoveKey, { action: 'light' | 'heavy' | 'guard' | 'dash' | 'run' | 'victory'; air?: boolean; limb: string[]; r: number; span?: number; at?: boolean }> = {
  'GR.pass': { action: 'light', limb: ['RightFoot'], r: .8 }, 'GR.power': { action: 'heavy', limb: ['RightFoot'], r: .8 },
  'GR.volley': { action: 'light', air: true, limb: ['RightFoot'], r: .8 }, 'GR.head': { action: 'light', limb: ['Head'], r: .8 },
  'GR.headAir': { action: 'light', air: true, limb: ['Head'], r: .8 }, 'GR.keeper': { action: 'guard', limb: ['LeftHand', 'RightHand'], r: .8 },
  'SS.dig': { action: 'light', limb: ['LeftHand', 'RightHand'], r: .5 }, 'SS.set': { action: 'light', limb: ['LeftHand', 'RightHand'], r: .5 },
  'SS.setAir': { action: 'light', air: true, limb: ['LeftHand', 'RightHand'], r: .5 }, 'SS.spike': { action: 'heavy', air: true, limb: ['RightHand'], r: .5 },
  'SS.wall': { action: 'guard', air: true, limb: ['LeftHand', 'RightHand'], r: .5 },
  'GR.drive': { action: 'heavy', limb: ['RightFoot'], r: .8 }, 'GR.bicycle': { action: 'light', air: true, limb: ['RightFoot'], r: .8 },
  'GR.trap': { action: 'guard', limb: ['RightFoot'], r: .8, span: 1.1 }, 'GR.carry': { action: 'run', limb: ['RightFoot'], r: .8, span: .8 },
  'GR.shoulder': { action: 'light', limb: ['RightShoulder'], r: .8 }, 'GR.slide': { action: 'light', limb: ['RightFoot'], r: .8 },
  'GR.diveL': { action: 'guard', limb: ['LeftHand'], r: .8, span: 1.1 }, 'GR.diveR': { action: 'guard', limb: ['RightHand'], r: .8, span: 1.1 },
  'GR.parry': { action: 'guard', limb: ['LeftHand', 'RightHand'], r: .8, span: 1.1 },
  'SS.pancake': { action: 'dash', limb: ['RightHand'], r: .5, span: .22 }, 'SS.pancakeUp': { action: 'victory', limb: ['RightHand'], r: .5, span: .9 },
  'SS.backSet': { action: 'light', limb: ['LeftHand', 'RightHand'], r: .5 }, 'SS.tip': { action: 'light', air: true, limb: ['RightHand'], r: .5 },
  'SS.spikeCut': { action: 'heavy', air: true, limb: ['RightHand'], r: .5 }, 'SS.spikeRoll': { action: 'heavy', air: true, limb: ['RightHand'], r: .5 },
  'SS.float': { action: 'light', limb: ['RightHand'], r: .5 }, 'SS.jumpServe': { action: 'heavy', air: true, limb: ['RightHand'], r: .5 },
  'C.slide': { action: 'victory', limb: ['Hips'], r: .8, span: 2.4 }, 'C.pump': { action: 'victory', limb: ['RightHand'], r: .8, span: 2.9 },
  'C.flex': { action: 'victory', limb: ['LeftHand', 'RightHand'], r: .8, span: 2.2 }, 'C.point': { action: 'victory', limb: ['LeftHand', 'RightHand'], r: .8, span: 2.2 },
  'C.leap': { action: 'victory', limb: ['RightHand'], r: .8, span: 1.6 }, 'C.bow': { action: 'victory', limb: ['Head'], r: .8, span: 3.3 },
  'GR.stridePass': { action: 'victory', limb: ['RightFoot'], r: .8, at: true }, 'GR.strideShot': { action: 'victory', limb: ['RightFoot'], r: .8, at: true },
  'GR.poke': { action: 'light', limb: ['RightFoot'], r: .8 }, 'GR.catch': { action: 'victory', limb: ['LeftHand', 'RightHand'], r: .8, at: true },
  'GR.slideUp': { action: 'victory', limb: ['Hips'], r: .8, span: .7 },
};
const kit = params.get('kit') !== '0';
/** A running step's time, about (the football takes' strides: 0.25-0.33 s a step). */
const STEP_S = .25;
const moves = (params.get('moves')?.split(',').filter(Boolean) ?? Object.keys(ROWS).filter(k => kit || !BALL_MOVES[k as BallMoveKey].take.startsWith('K.') && !k.startsWith('C.'))) as BallMoveKey[];
// `take=GR.power:cand K.simple`: a row's take swapped for another of the file's (choosing the kicks' cuts).
for (const spec of params.get('take')?.split(';').filter(Boolean) ?? []) { const [key, take] = spec.split(':'); Object.assign((BALL_MOVES as Record<string, { take: string; kit?: string }>)[key], { take, kit: take }); }
const own = params.get('own') !== '0';
// `cands=K.front,K.high`: a row each for the file's whole candidate kicks (`cand <take>`), thrown as GR.power (or
// GR.volley in the air, `cands=air:K.flying`): choosing the kicks' cuts, on a file packed with its candidates.
const cands = (params.get('cands')?.split(',').filter(Boolean) ?? []).map(c => c.startsWith('air:') ? { key: 'GR.volley' as BallMoveKey, take: `cand ${c.slice(4)}` } : { key: 'GR.power' as BallMoveKey, take: `cand ${c}` });

async function main() {
  if (!FIGHTERS[id]) { status('error: unknown fighter'); return; }
  installBallMoves(() => undefined, kit);
  const rows: { key: string; move?: BallMoveKey; take?: string }[] = [...(own ? [{ key: 'own light' }, { key: 'own heavy' }] : []),
    ...(params.get('moves') === '' || cands.length && !params.get('moves') ? [] : moves.map(move => ({ key: move, move }))), ...cands.map(c => ({ key: c.take, move: c.key, take: c.take }))];
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
  const floor = new THREE.Mesh(new THREE.CircleGeometry(4, 32), new THREE.MeshLambertMaterial({ color: 0x3b4a3a }));
  floor.rotation.x = -Math.PI / 2; scene.add(floor);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshLambertMaterial({ color: 0xffe6a0, transparent: true, opacity: .55 }));
  scene.add(ball);
  const library = new FighterLibrary();
  await library.ensure([id]);
  await ballMovesReady();
  const base: PlayerState = {
    id: 'sheet', name: 'Sheet', fighter: id, x: 0, y: 0, z: 0, yaw: 0, hp: 1000, maxHp: 1000, stamina: 100, maxStamina: 100, ultimate: 0,
    action: 'idle', actionStarted: 0, actionDuration: 0, actionTime: 0, target: null, alive: true, isBot: false, grounded: true,
    guarding: false, cooldowns: { light: 0, heavy: 0, special: 0, ultimate: 0 },
  } as PlayerState;
  const STEP = 1 / 120;
  let fighter = library.create(base); scene.add(fighter.group);
  const at = (body: Fighter, name: string) => body.drawnJoint(name)?.getWorldPosition(new THREE.Vector3()) ?? new THREE.Vector3();
  const settle = (body: Fighter, state: PlayerState) => { for (let s = 0; s < .6; s += STEP) body.update(STEP, { ...state }, true); body.group.updateMatrixWorld(true); };
  const fresh = (state: PlayerState) => {
    scene.remove(fighter.group); fighter.dispose();
    fighter = library.create(state); scene.add(fighter.group);
    fighter.targetPoint = new THREE.Vector3(0, 1.2 + state.y, 2.6); fighter.targetDistance = 2.6;
    settle(fighter, state);
    return fighter;
  };
  fresh(base);
  const head0 = at(fighter, 'Head'), tall = Math.max(.6, Math.min(8, head0.y * 1.1));
  const span = tall * 1.9, fov = 24, distance = span / (2 * Math.tan(THREE.MathUtils.degToRad(fov / 2)));
  const camera = new THREE.PerspectiveCamera(fov, 1, .05, 400);
  // From behind the fighter, a little to its left and above (the game's camera); `view=side` from its left side.
  const yaw = params.get('view') === 'side' ? Math.PI / 2 : Math.PI - .55;
  const shoot = (row: number, col: number, y: number) => {
    const look = new THREE.Vector3(0, y + tall * .5, .35 * tall);
    camera.position.set(look.x + Math.sin(yaw) * distance, look.y + span * .14, look.z + Math.cos(yaw) * distance);
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
  const data: unknown[] = [];
  const takes = Object.fromEntries(Object.entries(BALL_MOVES).map(([k, v]) => [k, { take: v.take, kit: v.kit, on: true }]));
  rows.forEach(({ key, move, take }, r) => {
    if (move) Object.assign((BALL_MOVES as Record<string, { take: string; kit?: string; on: boolean }>)[move], take ? { take, kit: take, on: true } : takes[move]);
    const spec = move ? ROWS[move] : { action: key === 'own light' ? 'light' as const : 'heavy' as const, limb: ['RightHand'], r: .8 };
    forceBallMove(move ?? null);
    const air = !!(move && ROWS[move].air), y = air ? tall * .7 : 0;
    const rest: PlayerState = { ...base, y, grounded: !air };
    const body = fresh(rest);
    let through = move ? ROWS[move].span : undefined, own: number | undefined;
    // (A take played through with its contact: its own length and its own contact, as the fit has them.)
    if (move && ROWS[move].at) {
      const read = body.take({ ...rest, action: 'idle' }), fit = fitBallMove(read.scene, read.clips, move, id, kit);
      if (fit) { through = fit.clip.duration / (BALL_MOVES[move].pace ?? 1); own = fit.take.contact; }
    }
    const held = spec.action === 'guard' || through !== undefined, checked = !held || own !== undefined;
    const span = through ?? 1.2;
    const m = held ? undefined : body.movePlayed({ ...rest, action: spec.action, actionDuration: 1, actionTime: 0, chain: 0 } as PlayerState);
    const duration = held ? span : m!.duration, contact = own ?? (held ? .5 : Math.min(.9, Math.max(.1, m!.contacts[0] / duration)));
    // (`compact=1`: three frames - the wind-up, the blow, the follow-through - for the many-body contact sheet.)
    const times = params.get('compact') ? (!checked ? [.25, .5, .75] : [contact * .55, contact, contact + (1 - contact) * .4])
      : !checked ? Array.from({ length: frames }, (_, i) => (i + .5) / frames) : [.04, contact * .45, contact * .8, contact, contact + (1 - contact) * .3, contact + (1 - contact) * .62, .97].slice(0, frames);
    // (The dash runs on its own clock, across its 0.22 s; a guard, a run and the victory pose on the body's.)
    const timed = spec.action === 'dash';
    const state: PlayerState = { ...rest, action: spec.action, actionStarted: 10 + r, actionSeq: 2 + r, actionDuration: held && !timed ? 0 : duration, chain: 0, guarding: spec.action === 'guard' } as PlayerState;
    // The striking point through the whole move (every step), for the hit-frame check: where it moves fastest.
    const limb = () => spec.limb.map(n => at(body, n)).reduce((a, b) => a.add(b), new THREE.Vector3()).multiplyScalar(1 / spec.limb.length);
    const track: { t: number; p: THREE.Vector3 }[] = [];
    const row = { key, take: move ? takeOf(BALL_MOVES[move], kit) : '-', duration: +duration.toFixed(3), contact: +contact.toFixed(3), frames: [] as unknown[], peakMs: 0, atContact: [0, 0] as number[], clip: '' };
    let col = 0, s = 0;
    for (const share of times) {
      for (; s < share * duration; s += STEP) {
        body.update(STEP, { ...state, actionTime: held && !timed ? 0 : Math.min(.999, s / duration) }, true);
        body.group.updateMatrixWorld(true);
        track.push({ t: s, p: limb() });
      }
      body.group.updateMatrixWorld(true);
      const hips = at(body, 'Hips'), p = limb();
      const ahead = (p.z - hips.z) / tall, up = (p.y - y) / tall;
      row.frames.push({ t: +share.toFixed(2), ahead: +ahead.toFixed(2), up: +up.toFixed(2) });
      const isContact = checked && share === contact;
      // The ball, on the contact frame: touching the striking point from in front.
      ball.visible = isContact && !!move;
      if (ball.visible) { const rr = spec.r * (move === 'GR.head' || move === 'GR.headAir' ? 1 : 1); ball.scale.setScalar(rr); ball.position.copy(p).add(new THREE.Vector3(0, move === 'SS.spike' ? rr * .3 : move?.startsWith('GR.head') ? rr * .6 : 0, rr * .8)); }
      if (isContact) row.atContact = [+ahead.toFixed(2), +up.toFixed(2)];
      shoot(r, col, y);
      note(label + col * cell + 3, r * cell + cell - 15, `a${ahead.toFixed(2)} u${up.toFixed(2)}`, '#cfe3ff', 10);
      if (isContact) { const box = document.createElement('div'); box.style.cssText = `position:absolute;left:${label + col * cell}px;top:${r * cell}px;width:${cell - 4}px;height:${cell - 4}px;border:2px solid #ffd76b`; overlay.append(box); }
      col++;
    }
    ball.visible = false;
    row.clip = body.motionEvidence().clip ?? '';
    if (checked) {
      // The striking point's fastest step inside the blow's half of the move, against the contact (milliseconds).
      // (A running take swings each foot through every stride: its blow is looked for within a step of the contact -
      // STEP_S - and its fastest anywhere is given beside, `peakAnyMs`.)
      let best = 0, bestT = 0, any = 0, anyT = 0;
      const c = contact * duration, lo = own !== undefined ? c - STEP_S : c * .4, hi = own !== undefined ? c + STEP_S : c + .25 * duration;
      for (let i = 1; i < track.length; i++) {
        const v = track[i].p.distanceTo(track[i - 1].p) / Math.max(1e-6, track[i].t - track[i - 1].t);
        if (track[i].t > lo && track[i].t < hi && v > best) { best = v; bestT = track[i].t; }
        if (v > any) { any = v; anyT = track[i].t; }
      }
      row.peakMs = Math.round((bestT - c) * 1000);
      if (own !== undefined) Object.assign(row, { peakAnyMs: Math.round((anyT - c) * 1000), peakSpeed: +best.toFixed(1), anySpeed: +any.toFixed(1) });
    }
    data.push(row);
    note(6, r * cell + 8, key, '#ffd76b', 13);
    note(6, r * cell + 26, row.take, '#9fb4d0', 10);
    note(6, r * cell + 40, `${spec.action}${air ? ' air' : ''} ${held && !checked ? 'held' : duration.toFixed(2) + ' s'}`, '#9fb4d0', 10);
    note(6, r * cell + 54, row.clip.slice(0, 20), '#9fb4d0', 10);
    if (checked) note(6, r * cell + 68, `peak ${row.peakMs} ms`, Math.abs(row.peakMs) > 60 ? '#ff6b6b' : '#7dffb0', 10);
  });
  forceBallMove(null);
  note(6, 2, `${id} ${tall.toFixed(2)} m`, '#7dffb0', 12);
  (window as unknown as { sheetData: unknown }).sheetData = { id, tall, rows: data, fits: ballMoveReport(), cost: { ...ballFitCost } };
  status('ready');
}
main().catch(error => status('error: ' + String(error).slice(0, 300)));
