// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { AdditiveBlending, DoubleSide, RawShaderMaterial, GLSL3 } from "three";
import type { IUniform, ShaderMaterial } from "three";
/** Emissive programs deliberately exclude scene-light cache variants. No scene-color grab or new composer pass. */
export function radiantMaterial(
  vertex: string,
  fragment: string,
  uniforms: Record<string, IUniform>,
  additive = true,
): ShaderMaterial {
  return new RawShaderMaterial({
    glslVersion: GLSL3,
    vertexShader:
      "precision highp float; uniform mat4 projectionMatrix,modelViewMatrix; in vec3 position; in vec2 uv;" +
      vertex.replaceAll("attribute ", "in ").replaceAll("varying ", "out "),
    fragmentShader:
      "precision highp float; out vec4 fragColor;" +
      fragment
        .replaceAll("varying ", "in ")
        .replaceAll("gl_FragColor", "fragColor"),
    uniforms,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: DoubleSide,
    ...(additive ? { blending: AdditiveBlending } : {}),
  });
}
export const planeVertex =
  "varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}";
export const holyNoise = `float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1)),f.x),f.y);}`;
export const envelope = `float ease(float a,float b,float x){return smoothstep(a,b,x);}float fade(float t){return 1.-smoothstep(4.4,6.8,t);}`;
