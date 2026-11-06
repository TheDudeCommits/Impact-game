import type * as THREE from 'three';
import { replaceOnce } from '../render/look/shaderPatch';

const LENS_NORMALS = new Set<string>(['ampere', 'kubiwa']); // (cloth4: Kubiwa's coat, hung from her shoulders, folds over in a throw)

export const lensFacingNormals = (fighter: string) => LENS_NORMALS.has(fighter);

/** Put after three's `normal_fragment_maps` chunk: the normal every light and the look's finish then read. */
export const LENS_NORMAL_GLSL = '{ vec3 lensV = normalize( vViewPosition ); float lensD = dot( normal, lensV ); if ( lensD < 0.0 ) normal -= 2.0 * lensD * lensV; }';

/** The shader edit (addShaderPatch's), for a toon material of a body in LENS_NORMALS. */
export function lensNormalPatch(shader: THREE.WebGLProgramParametersWithUniforms) {
  shader.fragmentShader = replaceOnce(shader.fragmentShader, '#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${LENS_NORMAL_GLSL}`, 'lens normal');
}
