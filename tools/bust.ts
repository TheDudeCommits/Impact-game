// Dev tool, not in the game's build (vite builds index.html only): a fighter's bust for the Sparking HUD skin
// (src/ui/hud/protos/proto.ts), drawn by the game's own Fighter with the game's lights, on a transparent background.
// A capture script can open /tools/bust.html?id=<fighter>[&form=1] for each fighter and save the canvas.
//   ?id=taisei    the fighter     ?form=1   their awakened body     ?size=640   the square's side, px
//   ?turn=.55   how far the camera stands round to the fighter's left, radians
//   ?lift=.1    the camera's height over the framing's middle, a share of the frame (below 0: from under a bowed head)
import * as THREE from 'three';
import { FighterLibrary } from '../src/render/Fighter';
import { FIGHTERS } from '../src/config';
import type { FighterId, PlayerState } from '../src/game/types';

const params = new URLSearchParams(location.search);
const id = (params.get('id') ?? 'taisei') as FighterId, form = params.get('form') === '1';
const size = Number(params.get('size') ?? 640), turn = Number(params.get('turn') ?? .5), lift = Number(params.get('lift') ?? .1);
const status = (s: string) => { document.title = s; (window as unknown as { bust: string }).bust = s; };

async function main() {
  if (!FIGHTERS[id]) { status('error: unknown fighter'); return; }
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.setSize(size, size);
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.NoToneMapping;
  renderer.setClearColor(0x000000, 0);
  document.body.append(renderer.domElement);
  const scene = new THREE.Scene();
  // The arena's lights (GameRenderer), the sun brought round to light the face.
  scene.add(new THREE.HemisphereLight(0xd7eaff, 0x324c70, .85));
  const sun = new THREE.DirectionalLight(0xfff0d6, 2.7); sun.position.set(2.5, 4, 4); scene.add(sun);
  const fill = new THREE.DirectionalLight(0x8bbbff, .3); fill.position.set(-3, 2, -2); scene.add(fill);
  const library = new FighterLibrary();
  await library.ensure([id]);
  const state = {
    id: 'bust', name: 'Bust', fighter: id, x: 0, y: 0, z: 0, yaw: 0, hp: 1000, maxHp: 1000, stamina: 100, maxStamina: 100, ultimate: 0,
    action: 'idle', actionStarted: 0, actionDuration: 0, actionTime: 0, target: null, alive: true, isBot: false, grounded: true,
    guarding: false, cooldowns: { light: 0, heavy: 0, special: 0, ultimate: 0 }, ...(form ? { awakened: true, awakenedUntil: 1e9 } : {}),
  } as PlayerState;
  const fighter = library.create(state);
  scene.add(fighter.group);
  // Settle into the idle a moment (the springs, the feet), then stop on a calm frame.
  for (let i = 0; i < 50; i++) fighter.update(1 / 60, { ...state }, false, 1 / 60);
  fighter.group.updateMatrixWorld(true);
  // The head: its bone, else the top of the body.
  let head: THREE.Object3D | undefined;
  const body = form ? (fighter as unknown as { gear4?: { group: THREE.Object3D } }).gear4?.group ?? fighter.group : fighter.group;
  body.traverse(o => { if (!head && (o as THREE.Bone).isBone && /(^|[_:])head$|^head|defhead|Head$/i.test(o.name) && !/end|top|nub/i.test(o.name)) head = o; });
  // Sized on the fighter's own height (FIGHTERS.height; a box would take in swords, capes and scrolls), and framed as
  // the reference's busts are: the head in the upper half, cut at the chest; a long lens.
  // A body much taller or shorter than the fighter's listed height (an awakened giant, a model scaled up) is measured
  // off its head bone instead: the head stands about nine tenths of the way up.
  const box = new THREE.Box3().setFromObject(body), listed = FIGHTERS[id].height ?? Math.min(2.2, box.max.y - box.min.y);
  const at = head ? head.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3(0, box.min.y + listed * .9, 0);
  const measured = head ? (at.y - box.min.y) / .9 : listed;
  const height = form || Math.abs(measured / listed - 1) > .15 ? measured : listed;
  const span = height * Number(params.get('span') ?? .34);
  const camera = new THREE.PerspectiveCamera(22, 1, .05, 100);
  const distance = span / (2 * Math.tan(THREE.MathUtils.degToRad(11)));
  const look = at.clone().add(new THREE.Vector3(0, -span * .06, 0));
  camera.position.set(look.x + Math.sin(turn) * distance, look.y + span * lift, look.z + Math.cos(turn) * distance);
  camera.lookAt(look);
  renderer.render(scene, camera);
  status('ready');
}
main().catch(error => status('error: ' + String(error).slice(0, 200)));
