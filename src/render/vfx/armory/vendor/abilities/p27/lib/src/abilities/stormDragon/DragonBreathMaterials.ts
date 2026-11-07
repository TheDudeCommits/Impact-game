// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { stormMaterial, noiseGLSL } from "./StormShaderLibrary";
export function breathMaterial(kind: number) {
  return stormMaterial(
    `uniform float uTime,uLength,uRadius,uReveal;varying vec2 vUv;varying vec3 vP;void main(){vUv=uv;float a=uv.x*6.283;float radius=uRadius*(.65+uv.y*.55)*(1.+.08*sin(uv.y*41.-uTime*28.+a*3.));vec3 p=vec3(cos(a)*radius,uv.y*uLength*uReveal,sin(a)*radius);vP=p;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
    `varying vec2 vUv;varying vec3 vP;uniform float uTime,uOpacity,uKind,uDetail;${noiseGLSL}void main(){float flow=fbm(vec2(vUv.x*16.+uTime*2.,vUv.y*45.-uTime*22.));float braid=pow(max(0.,sin(vUv.x*25.+vUv.y*65.-uTime*19.)),8.);float ends=smoothstep(0.,.03,vUv.y)*(1.-smoothstep(.94,1.,vUv.y));vec3 c=mix(vec3(.15,.035,.55),vec3(.4,.65,1.2),flow);float a=(.15+flow*.45+braid*.25)*uOpacity*ends;if(uKind<.5){c=vec3(.35,.65,.95)*(1.+flow);a*=1.6;}if(uKind>1.5){c=vec3(.07,.025,.22);a*=.24*(1.+uDetail);}gl_FragColor=vec4(c,a);}`,
    {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uLength: { value: 1 },
      uRadius: { value: 1 },
      uReveal: { value: 1 },
      uKind: { value: kind },
      uDetail: { value: 0 },
    },
  );
}
