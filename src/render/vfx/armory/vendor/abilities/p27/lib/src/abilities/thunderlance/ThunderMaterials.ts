// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import {AdditiveBlending,ShaderMaterial} from 'three';
export function thunderMaterial(outer=false):ShaderMaterial{
  return new ShaderMaterial({transparent:true,depthWrite:false,side:2,blending:AdditiveBlending,
    uniforms:{uTime:{value:0},uGrowth:{value:0},uFade:{value:1},uOuter:{value:outer?1:0},uEnergy:{value:1}},
    vertexShader:`varying vec3 vP;varying vec3 vW,vN;void main(){vP=position;vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;vN=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*viewMatrix*w;}`,
    fragmentShader:`varying vec3 vP,vW,vN;uniform float uTime,uGrowth,uFade,uOuter,uEnergy;void main(){if((vP.z+4.)/8.>uGrowth)discard;float flow=pow(max(0.,sin(vP.z*15.-uTime*24.+vP.x*14.)),7.);float fres=pow(1.-abs(dot(normalize(vN),normalize(cameraPosition-vW))),2.);vec3 col=mix(vec3(.22,.6,1.),vec3(.95,.99,1.),.65+flow*.25);if(uOuter>.5)col=mix(vec3(.1,.22,.72),vec3(.29,.55,1.),fres);gl_FragColor=vec4(col*(.75+uEnergy*.5),uFade*(uOuter>.5?.16+fres*.16:.78));}`});
}
export function electricRibbonMaterial():ShaderMaterial{
  return new ShaderMaterial({transparent:true,depthWrite:false,side:2,blending:AdditiveBlending,uniforms:{uTime:{value:0},uGrowth:{value:0},uFade:{value:1}},
    vertexShader:`varying vec2 vUv;uniform float uTime,uGrowth;void main(){vUv=uv;float a=uv.x*29.-uTime*9.,r=.2+sin(uv.x*3.14159)*.24+(uv.y-.5)*.08;vec3 p=vec3(cos(a)*r,sin(a)*r,uv.x*8.-4.);gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
    fragmentShader:`varying vec2 vUv;uniform float uTime,uGrowth,uFade;void main(){if(vUv.x>uGrowth)discard;float edge=pow(max(0.,1.-abs(vUv.y*2.-1.)),2.);gl_FragColor=vec4(mix(vec3(.13,.43,.95),vec3(.7,.95,1.),edge),edge*uFade*(.4+.4*sin(vUv.x*60.-uTime*18.)*sin(vUv.x*60.-uTime*18.)));}`});
}
