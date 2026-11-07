// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
export {
  voidMaterial as stormMaterial,
  noiseGLSL,
  planeVertex,
} from "../void/VoidMaterials";
export const softFragment = `varying vec2 vUv;uniform float uTime,uOpacity;${"float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}"} void main(){vec2 p=vUv*2.-1.;float a=exp(-dot(p,p)*3.)*(1.-smoothstep(.6,1.,length(p)));gl_FragColor=vec4(.28,.18,.55,a*uOpacity);}`;
