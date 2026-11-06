/** The cosmetics layer on the game's own scene: one for the page, hooked to
 *  the scene's render (before each frame is drawn - the fighters have their
 *  matrices for it by then, so what follows them does not lag a frame), with
 *  no line in the game's loop. Attached by the survival effects, which the
 *  game builds with its scene as it loads (render/SurvivalFx.ts); it works in
 *  every mode, since there is one scene.
 *
 *  It also knows, from that render, where a fighter's head is on the screen:
 *  emotes are lettered there (emotes.ts). */
import * as THREE from 'three';
import { Cosmetics } from './Cosmetics';
import { setSkinResolution } from './skins';
import { auraShared } from './auras';

let layer: Cosmetics | undefined;
let camera: THREE.Camera | undefined;
let canvas: HTMLCanvasElement | undefined;
let box: DOMRect | undefined;
let boxAt = 0;
const size = new THREE.Vector2(), _p = new THREE.Vector3();

/** The layer on the game's scene (once). */
export function attachCosmetics(scene: THREE.Scene): Cosmetics {
  if (layer) return layer;
  const cosmetics = layer = new Cosmetics(scene);
  const before = scene.onBeforeRender.bind(scene);
  let frame = -1, last = performance.now();
  // (A scene's is called with the render target where a mesh's has its geometry: the arguments pass through as they come.)
  scene.onBeforeRender = (renderer, s, eye, geometry, material, group) => {
    before(renderer, s, eye, geometry, material, group);
    // (Once a frame: a probe or a second pass of the same scene is not another frame.)
    if (renderer.info.render.frame === frame) return;
    frame = renderer.info.render.frame;
    camera = eye; canvas = renderer.domElement;
    if (!cosmetics.worn) return;
    const now = performance.now(), dt = Math.min(.1, (now - last) / 1000); last = now;
    renderer.getDrawingBufferSize(size);
    setSkinResolution(size.y); auraShared.uAuraHeight.value = size.y;
    cosmetics.update(now / 1000, dt);
  };
  return cosmetics;
}
/** The game's layer, once attached. */
export const gameCosmetics = () => layer;

/** Where a point in the world is on the page (CSS pixels), if it is in front of the camera. */
export function onScreen(point: THREE.Vector3): { x: number; y: number } | undefined {
  if (!camera || !canvas) return undefined;
  const now = performance.now();
  if (!box || now - boxAt > 500) { box = canvas.getBoundingClientRect(); boxAt = now; }
  _p.copy(point).project(camera);
  if (_p.z > 1 || _p.z < -1) return undefined;
  return { x: box.left + (_p.x + 1) / 2 * box.width, y: box.top + (1 - _p.y) / 2 * box.height };
}
