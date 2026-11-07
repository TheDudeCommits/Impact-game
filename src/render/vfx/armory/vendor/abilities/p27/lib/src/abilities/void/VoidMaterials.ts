// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { AdditiveBlending, DoubleSide, GLSL3, RawShaderMaterial } from "three";
import type { IUniform } from "three";
/** Emissive GLSL3 materials have stable programs independent of transient scene lights. */
export function voidMaterial(
  vertex: string,
  fragment: string,
  uniforms: Record<string, IUniform>,
  additive = true,
  opaque = false,
): RawShaderMaterial {
  return new RawShaderMaterial({
    glslVersion: GLSL3,
    vertexShader:
      "precision highp float;uniform mat4 projectionMatrix,modelViewMatrix;in vec3 position;in vec2 uv;" +
      vertex.replaceAll("attribute ", "in ").replaceAll("varying ", "out "),
    fragmentShader:
      "precision highp float;out vec4 fragColor;" +
      fragment
        .replaceAll("varying ", "in ")
        .replaceAll("gl_FragColor", "fragColor"),
    uniforms,
    transparent: !opaque,
    depthWrite: opaque,
    depthTest: true,
    side: DoubleSide,
    ...(additive ? { blending: AdditiveBlending } : {}),
  });
}
export const noiseGLSL = `float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1)),f.x),f.y);}float fbm(vec2 p){return noise(p)*.57+noise(p*2.03)*.28+noise(p*4.11)*.15;}`;
export const planeVertex =
  "varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}";
export const riftVertex = `attribute float aDepth;uniform float uTime,uOpen,uStretch,uRepair;varying vec2 vUv;varying float vDepth;varying vec3 vPosition;
 void main(){vUv=uv;vDepth=aDepth;vec3 p=position;float width=max(.006,uOpen)*(1.+.025*sin(uTime*2.1+p.y*1.9));float height=max(uStretch,uRepair);p.x*=width;p.y=9.-smoothstep(6.6,7.5,uTime)*6.4+(p.y-9.)*height;if(uRepair>.001)p.y=.3+position.y*uRepair*.65;p.z*=max(.08,uOpen);p.x+=sin(p.y*3.+uTime*9.)*.035*uOpen;p.x+=(uv.x-.5)*.22*uRepair;p.y+=.18;vPosition=p;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`;
