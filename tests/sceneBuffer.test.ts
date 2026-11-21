import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { sceneDrawingSize, setSceneRatio } from '../src/render/look/sceneBuffer';

/** A renderer as far as the scene's size needs one: a CSS size and a pixel ratio. */
function fakeRenderer(w: number, h: number, pr: number) {
  return { getPixelRatio: () => pr, getDrawingBufferSize: (t: THREE.Vector2) => t.set(Math.floor(w * pr), Math.floor(h * pr)) } as unknown as THREE.WebGLRenderer;
}

describe('the scene\'s drawing size (look/sceneBuffer.ts)', () => {
  it('is the scene\'s, not the canvas\'s, while the game\'s renderer upscales to the screen', () => {
    const main = fakeRenderer(1920, 1080, 2);
    setSceneRatio(main, 1.2);
    const size = sceneDrawingSize(main, new THREE.Vector2());
    expect(size.x).toBe(2304); expect(size.y).toBe(1296);
  });
  it('is the drawing buffer\'s when the scene fills the canvas, and for any other renderer', () => {
    const main = fakeRenderer(1920, 1080, 1.2), other = fakeRenderer(800, 600, 2);
    setSceneRatio(main, 1.2);
    expect(sceneDrawingSize(main, new THREE.Vector2()).toArray()).toEqual([2304, 1296]);
    expect(sceneDrawingSize(other, new THREE.Vector2()).toArray()).toEqual([1600, 1200]);
  });
});
