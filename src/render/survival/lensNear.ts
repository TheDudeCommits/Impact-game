/** Nothing small of the arcade's fills the lens: a drop, a chest, a drop of
 *  blood is gone within 1.8 m of the camera and grows back to its size by
 *  4.8 m. Measured in the vertex shader, from the camera as it draws - the
 *  effects' own update ran before the camera moved that frame, so a cut or
 *  an entrance orbit swinging through them put a crystal the height of the
 *  screen in the one frame a still caught. */
import type * as THREE from 'three';

/** GLSL: how much of a thing centred at `centre` (world space) is drawn. */
export const LENS_NEAR = /* glsl */`
float lensNear( vec3 centre ) { return clamp( ( distance( centre, cameraPosition ) - 1.8 ) / 3.0, 0.0, 1.0 ); }`;

/** The same for a built-in material on an instanced mesh: each instance
 *  shrinks about its own origin. */
export function shrinkNearLens<M extends THREE.Material>(material: M): M {
  material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', `${LENS_NEAR}\nvoid main() {`)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n\ttransformed *= lensNear( ( modelMatrix * instanceMatrix * vec4( 0.0, 0.0, 0.0, 1.0 ) ).xyz );');
  };
  material.customProgramCacheKey = () => 'survival-lens-near';
  return material;
}
