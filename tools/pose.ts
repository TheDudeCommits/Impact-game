// Dev tool, not in the game's build (vite builds index.html only): a fighter drawn whole by the game's own Fighter, with
// the game's lights, in a moment of one of its moves, on a transparent background. For the pictures that are rendered
// from a model rather than painted (Scout Hawser's move
// cards, roster portrait and home page frames). tools/bust.ts is the same idea for the HUD's busts.
//   /tools/pose.html?id=hawser&w=870&h=1450        the page; then, from the script, for each picture:
//   await window.pose({ form, action, chain, branch, t, turn, lift, span, at, side, fov })   -> 'ready' | 'error: ...'
//     form     the awakened body                     action   idle | light | heavy | special | ultimate | area | awaken | guard
//     chain    the light string's stage (0-3)        branch   a combo ender's key (lh, llh, ...), with action heavy or special
//     t        seconds into the action (an idle: seconds stood)
//     turn     how far round to the fighter's left the camera stands, radians (0: in front of them)
//     lift     the camera's height over what it looks at, as a share of the span
//     span     metres of the world the frame is tall      at   how high the camera looks, metres
//     side     the look point moved to the picture's right, metres      fov   degrees (default 22: a long lens)
import * as THREE from 'three';
import { FighterLibrary, type Fighter } from '../src/render/Fighter';
import { FIGHTERS } from '../src/config';
import { moveFor, rushMove, AWAKENING_ENTRY } from '../src/game/awakening';
import { comboMove, type ComboKey } from '../src/game/combos';
import type { ActionKind, AttackSlot, FighterId, PlayerState } from '../src/game/types';

interface Shot { form?: boolean; action?: string; chain?: number; branch?: ComboKey; t?: number; turn?: number; lift?: number; span?: number; at?: number; side?: number; fov?: number; }
const params = new URLSearchParams(location.search);
const id = (params.get('id') ?? 'taisei') as FighterId;
const width = Number(params.get('w') ?? 640), height = Number(params.get('h') ?? 960);
const status = (s: string) => { document.title = s; return s; };

async function main() {
  if (!FIGHTERS[id]) { status('error: unknown fighter'); return; }
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.setSize(width, height);
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.NoToneMapping;
  renderer.setClearColor(0x000000, 0);
  document.body.append(renderer.domElement);
  const scene = new THREE.Scene();
  // The arena's lights (GameRenderer), the sun brought round to light the front of the body: tools/bust.ts.
  scene.add(new THREE.HemisphereLight(0xd7eaff, 0x324c70, .85));
  const sun = new THREE.DirectionalLight(0xfff0d6, 2.7); sun.position.set(2.5, 4, 4); scene.add(sun);
  const fill = new THREE.DirectionalLight(0x8bbbff, .3); fill.position.set(-3, 2, -2); scene.add(fill);
  const library = new FighterLibrary();
  await library.ensure([id]);
  const base = (form: boolean): PlayerState => ({
    id: 'pose', name: 'Pose', fighter: id, x: 0, y: 0, z: 0, yaw: 0, hp: 1000, maxHp: 1000, stamina: 100, maxStamina: 100, ultimate: 0,
    action: 'idle', actionStarted: 0, actionDuration: 0, actionTime: 0, target: null, alive: true, isBot: false, grounded: true,
    guarding: false, cooldowns: { light: 0, heavy: 0, special: 0, ultimate: 0 }, ...(form ? { awakened: true, awakenedUntil: 1e9 } : {}),
  } as PlayerState);
  let fighter: Fighter | undefined;
  const STEP = 1 / 120;
  (window as unknown as { pose: (shot: Shot) => string }).pose = shot => {
    try {
      const form = !!shot.form, action = shot.action ?? 'idle', t = shot.t ?? 0;
      if (fighter) { scene.remove(fighter.group); fighter.dispose(); }
      const rest = base(form);
      fighter = library.create(rest); scene.add(fighter.group);
      (window as unknown as { poseFighter?: Fighter }).poseFighter = fighter;
      // Somebody to cut at: an opponent's chest a sword's length in front, as a match gives every blow.
      fighter.targetPoint = new THREE.Vector3(0, form ? 2.2 : 1.2, form ? 4.2 : 2.6); fighter.targetDistance = form ? 4.2 : 2.6;
      // Settled in the stance first (the springs, the feet), as a move starts from it in a match.
      const stood = action === 'idle' ? Math.max(.5, t) : .5;
      for (let s = 0; s < stood; s += STEP) fighter.update(STEP, { ...rest }, true);
      if (action !== 'idle') {
        const slot = action as AttackSlot;
        const move = action === 'awaken' || action === 'guard' ? undefined
          : shot.branch ? comboMove(id, shot.branch, form) : slot === 'light' && shot.chain ? rushMove(id, shot.chain, form) : moveFor(id, slot, form);
        const duration = action === 'awaken' ? AWAKENING_ENTRY : move?.duration ?? 1;
        const state: PlayerState = action === 'guard' ? { ...rest, action: 'guard', guarding: true }
          : { ...rest, action: action as ActionKind, actionStarted: 10, actionSeq: 2, actionDuration: duration, ...(shot.chain ? { chain: shot.chain } : {}), ...(shot.branch ? { branch: shot.branch } : {}),
            ...(action === 'awaken' ? { awakened: true, awakenedUntil: 1e9 } : {}) };
        for (let s = 0; s < t + STEP; s += STEP) fighter.update(STEP, { ...state, actionTime: Math.min(.999, Math.min(t, s) / duration) }, true);
      }
      // A cut-out has no floor: the pool of shade under the feet (the body's own and its form's) is left out.
      for (const body of [fighter, (fighter as unknown as { gear4?: Fighter }).gear4]) { const shade = (body as unknown as { contactShadow?: THREE.Object3D } | undefined)?.contactShadow; if (shade) shade.visible = false; }
      fighter.group.updateMatrixWorld(true);
      const span = shot.span ?? 2.1, fov = shot.fov ?? 22, turn = shot.turn ?? .5, lift = shot.lift ?? .08;
      const camera = new THREE.PerspectiveCamera(fov, width / height, .05, 200);
      const distance = span / (2 * Math.tan(THREE.MathUtils.degToRad(fov / 2)));
      // `side` moves the look point along the picture's own right.
      const right = new THREE.Vector3(Math.cos(turn), 0, -Math.sin(turn));
      const look = new THREE.Vector3(0, shot.at ?? 1, 0).addScaledVector(right, shot.side ?? 0);
      camera.position.set(look.x + Math.sin(turn) * distance, look.y + span * lift, look.z + Math.cos(turn) * distance);
      camera.lookAt(look);
      renderer.render(scene, camera);
      return status('ready');
    } catch (error) { return status('error: ' + String(error).slice(0, 300)); }
  };
  status('loaded');
}
main().catch(error => status('error: ' + String(error).slice(0, 200)));
