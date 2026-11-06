import type { MeshToonMaterial } from 'three';
import { addShaderPatch } from '../look/shaderPatch';
/** Cosmic Hagure's native stars are authored albedo. The general dark-texture ink
 * pass otherwise flattens that entire dark body during a cinematic. Retain a
 * source-texture exposure floor after the final cinematic silhouette composition;
 * an outgoingLight floor before opaque_fragment is overwritten by that pass.
 * The downstream technique grade and cinematic contrast crush low linear values,
 * so the native luminous starfield receives fourfold exposure. Black source
 * pixels remain black; source hues and spatial detail are unchanged.
 * This creates no light, texture, animation, allocation or gameplay update. */
export const HAGURE_COSMIC_TEXTURE_FLOOR = 4;
const floors = new WeakMap<MeshToonMaterial, {value:number}>();
export function applyHagureCosmicLook(material: MeshToonMaterial, fighter: string, isForm: boolean, strength=HAGURE_COSMIC_TEXTURE_FLOOR) {
  if (fighter !== 'hagure' || !isForm || material.name !== 'Cosmic' || !material.map) return false;
  let floor=floors.get(material);
  if(!floor){floor={value:strength};floors.set(material,floor);}
  floor.value=Math.max(0,Math.min(4,Number.isFinite(strength)?strength:HAGURE_COSMIC_TEXTURE_FLOOR));
  addShaderPatch(material, 'hagure-native-cosmic-texture-v2', shader => {
    shader.uniforms.hagureNativeTextureFloor=floor;
    shader.fragmentShader='uniform float hagureNativeTextureFloor;\n'+shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <premultiplied_alpha_fragment>', `
#ifdef USE_MAP
  vec3 hagureNativeLight = texture2D(map, vMapUv).rgb * hagureNativeTextureFloor;
  #if defined(TONE_MAPPING)
    hagureNativeLight = toneMapping(hagureNativeLight);
  #endif
  hagureNativeLight = linearToOutputTexel(vec4(hagureNativeLight, 1.0)).rgb;
  gl_FragColor.rgb = max(gl_FragColor.rgb, hagureNativeLight);
#endif
#include <premultiplied_alpha_fragment>`);
  });
  return true;
}
