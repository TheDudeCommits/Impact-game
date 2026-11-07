// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { AdditiveBlending, DoubleSide, RawShaderMaterial } from "three";
import type { ShaderMaterial } from "three";
import type { IUniform } from "three";

export const electricalNoise = `float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1)),f.x),f.y);}float fbm(vec2 p){return noise(p)*0.57+noise(p*2.03)*0.28+noise(p*4.11)*0.15;}`;
export const surfaceVertex = `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;
export function electricalMaterial(
  vertexShader: string,
  fragmentShader: string,
  uniforms: Record<string, IUniform>,
  additive = true,
): ShaderMaterial {
  // These emissive shaders do not consume scene lights. Explicit raw declarations keep their
  // programs stable when transient PointLights alter Three's standard shader cache keys.
  const vertexHeader =
    "precision highp float; uniform mat4 projectionMatrix, modelViewMatrix; attribute vec3 position; attribute vec2 uv;";
  const fragmentHeader = "precision highp float; uniform vec3 cameraPosition;";
  return new RawShaderMaterial({
    vertexShader: vertexHeader + vertexShader,
    fragmentShader: fragmentHeader + fragmentShader,
    uniforms,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: DoubleSide,
    ...(additive ? { blending: AdditiveBlending } : {}),
  });
}
export function createLightningMaterial(): ShaderMaterial {
  return electricalMaterial(
    `attribute vec3 aStart,aEnd;attribute float aWidth,aReveal,aPhase,aGroup;varying vec2 vUv;varying float vReveal,vPhase,vGroup,vWidthPixels;
    uniform float uTime,uViewportHeight;
    void main(){vUv=uv;vReveal=aReveal;vPhase=aPhase;vGroup=aGroup;
      vec4 a=modelViewMatrix*vec4(aStart,1.0),b=modelViewMatrix*vec4(aEnd,1.0);
      vec2 delta=b.xy-a.xy;vec2 normal=vec2(-delta.y,delta.x)/max(length(delta),0.00001);
      vec4 p=mix(a,b,uv.x);p.xy+=normal*(uv.y-0.5)*aWidth;
      p.xy+=delta/max(length(delta),0.00001)*(uv.x*2.0-1.0)*aWidth*0.025;
      vWidthPixels=max(1.0,aWidth*projectionMatrix[1][1]*uViewportHeight*0.5/max(1.0,-p.z));
      gl_Position=projectionMatrix*p;}`,
    `varying vec2 vUv;varying float vReveal,vPhase,vGroup,vWidthPixels;uniform float uTime,uOpacity,uReveal,uDetail,uPulse;
    void main(){float x=abs(vUv.y*2.0-1.0);float minimum=min(0.22,0.6/vWidthPixels);
      float core=exp(-x*x/max(0.00091,minimum*minimum)),hot=exp(-x*x/max(0.0091,minimum*minimum*1.7)),halo=pow(max(0.0,1.0-x),3.2);
      float pattern=fract(sin(floor(uTime*43.0)+vPhase*13.1)*43758.5453);float branch=vGroup<0.5?1.0:mix(0.18,1.0,step(0.18,pattern));
      float reveal=1.0-smoothstep(uReveal,uReveal+0.025,vReveal);
      float endSoft=0.94+0.06*sin(vUv.x*3.14159);
      vec3 color=vec3(1.0,0.96,0.91)*core*7.0+vec3(0.36,0.64,1.0)*hot*2.5+vec3(0.025,0.18,0.63)*halo*(0.55+uDetail*0.23);
      gl_FragColor=vec4(color*uPulse,halo*uOpacity*branch*reveal*endSoft);}`,
    {
      uTime: { value: 0 },
      uViewportHeight: { value: 720 },
      uOpacity: { value: 0 },
      uReveal: { value: 1.1 },
      uDetail: { value: 1 },
      uPulse: { value: 1 },
    },
  );
}
