import * as THREE from 'three';
import { applyToonShading } from '../look/toonShading';
import { addShaderPatch } from '../look/shaderPatch';
import { airUniforms } from '../look/air';
import { installCameraCutaway } from '../CameraCutaway';

type Shader = THREE.WebGLProgramParametersWithUniforms;

export const GROUND_ANSWERS = {
  uRimPeak: { value: 0 },
  uLookTech: { value: 0 },
  uLookSilhouette: { value: 0 },
  uCookieFighters: { value: 1 },
  uCloudFighters: { value: 1 },
  uToonFlatten: { value: 0 },
  // The fighters are pushed to be the most saturated thing in the frame, and
  // shed most of the key's colour so a costume keeps its own; the ground keeps
  // its own saturation and takes more of the light's colour, as the room does.
  uToonSaturation: { value: 1 },
  uToonNeutral: { value: .45 },
};

/** A material for a ground layer: the fighters' toon shading, the ground's
 *  answers above, then `edit` (the layer's own vertex and colour work), and no
 *  camera cutaway (see `optOutOfCutaway`). */
export function groundMaterial(name: string, key: string, edit: (shader: Shader) => void, params: THREE.MeshToonMaterialParameters = {}) {
  const material = new THREE.MeshToonMaterial({ name, ...params });
  applyToonShading(material, 'body');
  addShaderPatch(material, key, shader => {
    // The place's share of the air (look/air.ts), after the toon patch gave it
    // the fighters' third: the grass 20-60 m out takes the haze the trees and
    // stands beside it take.
    Object.assign(shader.uniforms, GROUND_ANSWERS, { uAirFog: airUniforms.uAirFog });
    edit(shader);
  });
  optOutOfCutaway(material);
  return material;
}

/** The camera cutaway and the stage fade (CameraCutaway.ts, StageFade.ts) drop
 *  whatever of the stage stands above the floor nearer the lens than the
 *  fight. On grass that is all of the foreground grass, the very grass that
 *  should stand in front of the fighters' feet. FollowCamera covers every
 *  stage material it finds without the cutaway (`coverStage`); a material it
 *  has already seen is passed by, so the ground's is marked as seen and keeps
 *  its own program. */
export function optOutOfCutaway(material: THREE.Material) {
  const compile = material.onBeforeCompile, key = material.customProgramCacheKey;
  installCameraCutaway(material);
  material.onBeforeCompile = compile;
  material.customProgramCacheKey = key;
  material.needsUpdate = true;
}

/** Replace `find` in a shader, and say so when it is missing. */
export function edit(source: string, find: string, replacement: string, label: string) {
  if (!source.includes(find)) {
    console.warn(`ground: shader edit "${label}" did not find ${find}`);
    return source;
  }
  return source.replace(find, replacement);
}

/** A zero `lookHead` per vertex (the toon shading's face weight): a program
 *  attribute with no buffer reads whatever generic value another program left
 *  at its location, which could be a whole face's softening. */
export function withLookHead<T extends THREE.BufferGeometry>(geometry: T): T {
  geometry.setAttribute('lookHead', new THREE.BufferAttribute(new Float32Array(geometry.getAttribute('position').count), 1));
  return geometry;
}
