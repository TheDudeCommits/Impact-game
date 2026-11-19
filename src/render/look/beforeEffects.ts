import type * as THREE from 'three';

/** Work a frame does right before its scene's effects and bodies are drawn (the scene pass, look/filmPaint.ts), while
 *  the frame's own target is not yet bound: whatever draws into a target of its own here (render/vfx/armory/lighter.ts
 *  HALF: a screen-filling volume marched at half resolution) costs no break in the multisampled frame's pass. Drawn in
 *  the middle of that pass instead, the same small march cost Tsubute's G 13-23 ms more than it saved: the frame's
 *  multisampled target was stored and loaded again around it. */
export type BeforeEffects = (renderer: THREE.WebGLRenderer, camera: THREE.Camera, target: THREE.WebGLRenderTarget | null) => void;
const work = new Set<BeforeEffects>();

/** Adds `fn` to every frame's work before its effects; answers a function that takes it off again. */
export function onBeforeEffects(fn: BeforeEffects): () => void {
  work.add(fn);
  return () => { work.delete(fn); };
}

/** The scene pass: everything added, with the camera and the target the effects are about to be drawn with. */
export function runBeforeEffects(renderer: THREE.WebGLRenderer, camera: THREE.Camera, target: THREE.WebGLRenderTarget | null) {
  for (const fn of work) {
    try { fn(renderer, camera, target); } catch (error) { console.warn('before effects', error); }
  }
}
