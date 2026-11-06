import * as THREE from 'three';
import type { StageId } from '../../game/stages';
import { addShaderPatch, replaceOnce } from './shaderPatch';
import { COOKIE_GLSL, cookieUniforms } from './lightCookie';
import type { LookPreset } from './stageLooks';

/** Painted backdrops that ship inside a stage GLB: sky domes, cloud cards and
 *  distant scenery. They were authored as emissive art, so they stay unlit and
 *  outside the fog - lit, they took the sun's shading and the fighters'
 *  shadows across the sky. */
const BACKDROP = /(^|_)(sky|skybox|clouds?|background)(_|$)/i;

/** Scenery the look leaves out. The colosseum's grass is hundreds of flat
 *  triangles textured from the tree atlas; unlit they passed for tufts, but in
 *  a raking sunset they read as yellow shards strewn across the field, which
 *  is exactly the noise the concept frames do not have. The ground they stood
 *  on is painted grass already. Drawing only - nothing collides with them. */
const HIDDEN: Partial<Record<StageId, RegExp>> = {
  // Round 4b (MAPS): and Material.086, flat cards of the same tree atlas laid
  // on the field - a blind critic's "flat purple patches on the floor".
  'ash-colosseum': /^Material\.0(41|70|71|77|78|79|81|83|84|85|86)$/,
};
export function hiddenByLook(stage: StageId, materialName: string) {
  return HIDDEN[stage]?.test(materialName) ?? false;
}

/** Every stage's lit surfaces answer to the same key light, with the per-stage
 *  image light for their ambient. Unlit source materials (some models ship
 *  every material as KHR_materials_unlit) are converted to lit ones - keeping
 *  their maps, colour and alpha - and toned down by `baked`, because an unlit
 *  mobile texture already has its lighting painted in, and lit on top of that
 *  it blew out to white. */
export function lookStageMaterial(material: THREE.Material, stage: StageId, meshName: string, options: { doubleSided?: boolean; baked?: number } = {}): THREE.Material {
  const name = `${meshName} ${material.name}`;
  if (BACKDROP.test(material.name) || BACKDROP.test(meshName)) {
    const src = material as THREE.MeshBasicMaterial;
    const basic = material instanceof THREE.MeshBasicMaterial ? material : new THREE.MeshBasicMaterial({ name: material.name, map: src.map ?? null, color: src.color, transparent: material.transparent, opacity: material.opacity, alphaTest: material.alphaTest, side: material.side });
    basic.fog = false;
    basic.userData.lookBackdrop = true;
    if (basic !== material) material.dispose();
    return basic;
  }
  let lit = material as THREE.MeshStandardMaterial;
  if (material instanceof THREE.MeshBasicMaterial) {
    lit = new THREE.MeshStandardMaterial({
      name: material.name, map: material.map, color: material.color.clone().multiplyScalar(options.baked ?? .7),
      transparent: material.transparent, opacity: material.opacity, alphaTest: material.alphaTest, alphaHash: material.alphaHash,
      side: material.side, vertexColors: material.vertexColors, roughness: .92, metalness: 0,
    });
    material.dispose();
  }
  if (!(lit instanceof THREE.MeshStandardMaterial)) return material;
  lit.metalness = 0;
  lit.roughness = Math.max(.75, lit.roughness);
  if (options.doubleSided) lit.side = THREE.DoubleSide;
  for (const value of Object.values(lit)) if (value instanceof THREE.Texture) value.anisotropy = 8;
  installAlbedoGrade(lit);
  installStageLight(lit);
  if (stage === 'proving-hall' && /Mesh5_/.test(name)) installWindowGlow(lit);
  return lit;
}

/** The stage's albedo grade, shared by every stage material: set per stage
 *  from the look, identity where a stage does not ask for one. The room's
 *  exposure rides on the tint - everything the room reflects, from the key,
 *  the fill and the image light alike, scales with its albedo - so the room
 *  darkens without touching the fighters, the sky, the shafts or the panes. */
export const albedoUniforms = { uAlbedoSaturation: { value: 1 }, uAlbedoTint: { value: new THREE.Color(1, 1, 1) },
  /** The floor's own grade (LookPreset.ground; the floors round, 25 October 2026): its hue (unit luminance, so it
   *  never darkens), its exposure on its own paint with the room's albedo taken back (`gain` / room.albedo), the
   *  linear albedo it eases toward but never passes, and how much of it applies. */
  uGroundTint: { value: new THREE.Color(1, 1, 1) }, uGroundGain: { value: 1 }, uGroundMax: { value: 1 }, uGroundAmount: { value: 0 } };
/** The share of the key light the room takes: the lit floor bands and the
 *  window pools, on top of the room's exposure. */
export const stageLightUniforms = { uStageKey: { value: 1 } };
/** The look's own room exposure, under any dim (setRoomDim). */
const room = { tint: new THREE.Color(1, 1, 1), key: 1, dim: 0 };
/** What the floor's grade does to one linear albedo colour, as the shader below does it: the hue, the exposure, then
 *  the shoulder. `roomAlbedo` is the room's exposure the colour arrives with (it rides on uAlbedoTint). */
export function gradeGround(rgb: readonly [number, number, number], ground: NonNullable<LookPreset['ground']>, roomAlbedo = 1): [number, number, number] {
  const tint = groundHue(ground.tint), gain = groundGain(ground, roomAlbedo);
  const c = rgb.map((v, i) => v * roomAlbedo * tint[i] * gain) as [number, number, number];
  const l = .2126 * c[0] + .7152 * c[1] + .0722 * c[2], s = groundShoulder(l, ground.max) / Math.max(l, 1e-5);
  return c.map((v, i) => { const graded = v * s, plain = rgb[i] * roomAlbedo; return plain + (graded - plain) * ground.amount; }) as [number, number, number];
}
/** The tint as a hue only: its own luminance divided out. */
export function groundHue(hex: number): [number, number, number] {
  const c = new THREE.Color(hex), l = .2126 * c.r + .7152 * c.g + .0722 * c.b;
  return [c.r / l, c.g / l, c.b / l];
}
/** The floor's exposure on its paint. The room's albedo is divided back out, so a floor is darkened once, by its own
 *  grade - not by the room's exposure and then its grade on top. */
export const groundGain = (ground: NonNullable<LookPreset['ground']>, roomAlbedo: number) => (ground.gain ?? 1) / Math.max(roomAlbedo, 1e-3);
/** The shoulder (linear luminance): untouched up to GROUND_KNEE of the ceiling, then easing toward the ceiling and never
 *  reaching it, with no kink - so pale paint stays above mid paint, and only near-white is held off white. */
export const GROUND_KNEE = .55;
export function groundShoulder(l: number, max: number) {
  const knee = max * GROUND_KNEE, span = max - knee;
  return l <= knee ? l : knee + span * (1 - Math.exp((knee - l) / span));
}
export function setAlbedoLook(look: LookPreset) {
  albedoUniforms.uAlbedoSaturation.value = look.albedo?.saturation ?? 1;
  room.tint.setHex(look.albedo?.tint ?? 0xffffff).multiplyScalar(look.room?.albedo ?? 1);
  room.key = look.room?.key ?? 1;
  setRoomDim(room.dim);
  const ground = look.ground;
  albedoUniforms.uGroundTint.value.setRGB(...(ground ? groundHue(ground.tint) : [1, 1, 1] as [number, number, number]), THREE.LinearSRGBColorSpace);
  albedoUniforms.uGroundGain.value = ground ? groundGain(ground, look.room?.albedo ?? 1) : 1;
  albedoUniforms.uGroundMax.value = ground?.max ?? 1;
  albedoUniforms.uGroundAmount.value = ground?.amount ?? 0;
}
/** The power-up pass: a power-up darkens the place, 0..1 - everything the room reflects and its share of the key -
 *  while the fighters and the effects keep their light, so the flame is the brightest thing on screen. */
export function setRoomDim(k: number) {
  room.dim = k;
  albedoUniforms.uAlbedoTint.value.copy(room.tint).multiplyScalar(1 - .62 * k);
  stageLightUniforms.uStageKey.value = room.key * (1 - .75 * k);
}
function installAlbedoGrade(material: THREE.MeshStandardMaterial) {
  addShaderPatch(material, 'look-albedo-v3', shader => {
    Object.assign(shader.uniforms, albedoUniforms);
    shader.fragmentShader = 'uniform float uAlbedoSaturation;\nuniform vec3 uAlbedoTint;\nuniform vec3 uGroundTint;\nuniform float uGroundGain;\nuniform float uGroundMax;\nuniform float uGroundAmount;\n' + shader.fragmentShader;
    shader.fragmentShader = replaceOnce(shader.fragmentShader, '#include <map_fragment>', `#include <map_fragment>
	diffuseColor.rgb = max( mix( vec3( dot( diffuseColor.rgb, vec3( .2126, .7152, .0722 ) ) ), diffuseColor.rgb, uAlbedoSaturation ), 0. ) * uAlbedoTint;
	#ifndef FLAT_SHADED
	// The floor, graded once . Up-facing
	// surfaces take the room's albedo back (uGroundGain) and the floor's own exposure instead, a hue that keeps their
	// luminance, and a shoulder in place of the old clamp: pale stone stays above mid stone and eases toward the
	// ceiling, so it reads pale without going paper-white (gradeGround is this, on the CPU).
	if ( uGroundAmount > 0.0 ) {
		float lookUp = smoothstep( .55, .85, dot( normalize( vNormal ), normalize( ( viewMatrix * vec4( 0.0, 1.0, 0.0, 0.0 ) ).xyz ) ) );
		vec3 lookGround = diffuseColor.rgb * uGroundTint * uGroundGain;
		float lookGroundL = dot( lookGround, vec3( .2126, .7152, .0722 ) );
		float lookKnee = uGroundMax * ${GROUND_KNEE.toFixed(3)}, lookSpan = uGroundMax - lookKnee;
		float lookShoulder = lookGroundL <= lookKnee ? lookGroundL : lookKnee + lookSpan * ( 1. - exp( ( lookKnee - lookGroundL ) / lookSpan ) );
		lookGround *= lookShoulder / max( lookGroundL, 1e-5 );
		diffuseColor.rgb = mix( diffuseColor.rgb, lookGround, lookUp * uGroundAmount );
	}
	#endif`, 'albedo grade');
  });
}

/** The room's share of the key light, and on a stage with a cookie the key
 *  reaches a surface only through its windows. On every stage material, so a
 *  stage change is uniforms only; the cookie test returns at once where the
 *  look has none. */
function installStageLight(material: THREE.MeshStandardMaterial) {
  addShaderPatch(material, 'look-stage-light-v1', shader => {
    Object.assign(shader.uniforms, cookieUniforms, stageLightUniforms);
    shader.vertexShader = 'varying vec3 vLookWorld;\n' + shader.vertexShader;
    shader.vertexShader = replaceOnce(shader.vertexShader, '#include <project_vertex>', 'vLookWorld = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;\n#include <project_vertex>', 'cookie world position');
    shader.fragmentShader = 'varying vec3 vLookWorld;\nuniform float uStageKey;\n' + COOKIE_GLSL + '\n' + shader.fragmentShader;
    const lights = replaceOnce(THREE.ShaderChunk.lights_fragment_begin, 'getDirectionalLightInfo( directionalLight, directLight );',
      'getDirectionalLightInfo( directionalLight, directLight );\n\t\tif ( UNROLLED_LOOP_INDEX == 0 ) directLight.color *= uStageKey * lookCookie( vLookWorld );', 'stage key light');
    shader.fragmentShader = replaceOnce(shader.fragmentShader, '#include <lights_fragment_begin>', lights, 'cookie lights');
  });
}

/** The training hall's windows are painted onto its far wall, which faces away
 *  from a sun placed behind it - so they rendered as the darkest thing in the
 *  room. The blue-grey panes are picked out of the texture by colour and lit
 *  from behind in the key light's colour, bright enough to bloom. */
export const windowGlow = { uPaneGlow: { value: new THREE.Color(0, 0, 0) } };
function installWindowGlow(material: THREE.MeshStandardMaterial) {
  addShaderPatch(material, 'look-window-glow-v1', shader => {
    Object.assign(shader.uniforms, windowGlow);
    shader.fragmentShader = 'uniform vec3 uPaneGlow;\n' + shader.fragmentShader;
    // Measured on the painted colour, before the albedo grade desaturates it:
    // this edit is added after the grade, and each edit's code lands directly
    // under the include, so it runs first.
    shader.fragmentShader = replaceOnce(shader.fragmentShader, '#include <map_fragment>', `#include <map_fragment>
	float lookPane = smoothstep( .015, .06, diffuseColor.b - diffuseColor.r ) * smoothstep( .16, .32, dot( diffuseColor.rgb, vec3( .2126, .7152, .0722 ) ) );`, 'window pane mask');
    // Round 2 of the stages: the panes cut into small lights by muntins (world metres on the far wall), each window
    // four across and four up, and the pane's mask held firm, so the windows read as glazing in frames, not as flat
    // cream quads blotched by the painted grime (two blind critics).
    shader.fragmentShader = replaceOnce(shader.fragmentShader, '#include <emissivemap_fragment>', `#include <emissivemap_fragment>
	vec2 lookLight = fract( vec2( vLookWorld.x / .55, vLookWorld.y / .66 ) );
	float lookMuntin = step( .1, lookLight.x ) * step( .1, lookLight.y );
	// The sky through them: a pale blue toward each window's top, the sun's warm glow toward its foot (the panes
	// read as blank white, "no sky").
	float lookSkyUp = smoothstep( 2.6, 6.0, vLookWorld.y );
	vec3 lookSky = mix( vec3( 1.0, .86, .64 ), vec3( .46, .62, .96 ), lookSkyUp );
	// And the Forest of Death's canopy along their feet, dark against the glow.
	float lookCanopy = smoothstep( .0, .06, 3.15 + .22 * sin( vLookWorld.x * 2.3 ) + .14 * sin( vLookWorld.x * 5.7 + 1.3 ) - vLookWorld.y );
	lookSky = mix( lookSky, vec3( .1, .17, .13 ), lookCanopy * .85 );
	totalEmissiveRadiance += lookSky * dot( uPaneGlow, vec3( .2126, .7152, .0722 ) ) * smoothstep( .3, .65, lookPane ) * lookMuntin;`, 'window panes');
  });
}
