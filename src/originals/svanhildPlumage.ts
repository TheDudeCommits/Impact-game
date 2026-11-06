import * as THREE from 'three';
import { addShaderPatch } from '../render/look/shaderPatch';

const clock = { value: 0 };
const STREAKS = /* glsl */ `
uniform float uPlumeTime;
float plumeFlow(vec2 uv) {
  float across = abs(uv.x - .5) * 2.;
  float run = sin((uv.y * 7. - uPlumeTime * 1.6 - across * 1.8) * 6.2832);
  return smoothstep(.55, 1., run) * smoothstep(.0, .12, uv.y) * (1. - smoothstep(.72, .98, uv.y)) * (1. - .5 * across);
}
`;

/** True for the plumage's material (by the name the build gives it). */
export const isSvanhildPlumage = (name: string | undefined) => /^glow_svanhild_plumage/.test(name ?? '');

/** The streaks laid on the plumage's toon material (its map's UVs: across the plume, root to tip). */
export function svanhildPlumageFlow(material: THREE.MeshToonMaterial) {
  addShaderPatch(material, 'svanhild-plume-flow-v1', shader => {
    shader.uniforms.uPlumeTime = clock;
    shader.fragmentShader = STREAKS + shader.fragmentShader
      .replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.), plumeFlow(vMapUv) * .5);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(.75, .92, 1.) * plumeFlow(vMapUv) * .55;');
  });
  material.onBeforeRender = () => { clock.value = performance.now() / 1000 % 1000; };
}
