/** The size the scene is drawn at, for whatever sizes itself in the scene's pixels (the effects' resolution, the
 *  cosmetics' line widths, Last Stand's glow). Since the upscale (look/upscale.ts) a desktop's canvas holds the
 *  screen's own pixels while the scene is drawn at the quality's pixel ratio times the governor's share, so the
 *  drawing buffer is no longer the scene's size there. GameRenderer says what the scene's ratio is. */
import type * as THREE from 'three';

let main: THREE.WebGLRenderer | undefined, ratio = 1;

/** GameRenderer: the scene is drawn at `sceneRatio` pixels a CSS pixel on `renderer`. */
export function setSceneRatio(renderer: THREE.WebGLRenderer, sceneRatio: number) { main = renderer; ratio = sceneRatio; }

/** The scene's drawing size on `renderer`: its drawing buffer's, unless the game's renderer upscales to the screen. */
export function sceneDrawingSize(renderer: THREE.WebGLRenderer, target: THREE.Vector2) {
  renderer.getDrawingBufferSize(target);
  if (renderer === main) {
    const pr = renderer.getPixelRatio();
    if (pr > ratio) target.set(Math.max(1, Math.floor(target.x * ratio / pr)), Math.max(1, Math.floor(target.y * ratio / pr)));
  }
  return target;
}
