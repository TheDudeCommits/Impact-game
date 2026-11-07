// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { NORMAL_TRANSFORM_GLSL } from '../../effects/NormalTransform';
import {ShaderMaterial,AdditiveBlending,DoubleSide} from 'three';
const solarNoise=`float sh(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}float sn(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(sh(i),sh(i+vec3(1,0,0)),f.x),mix(sh(i+vec3(0,1,0)),sh(i+vec3(1,1,0)),f.x),f.y),mix(mix(sh(i+vec3(0,0,1)),sh(i+vec3(1,0,1)),f.x),mix(sh(i+vec3(0,1,1)),sh(i+vec3(1,1,1)),f.x),f.y),f.z);}`;
export function solarMaterial(kind:0|1|2|3):ShaderMaterial{
  return new ShaderMaterial({transparent:true,depthWrite:kind===0,side:DoubleSide,...(kind>=2?{blending:AdditiveBlending}:{}),uniforms:{uTime:{value:0},uFade:{value:1},uEnergy:{value:0},uDetail:{value:2},uKind:{value:kind}},
    vertexShader:`${NORMAL_TRANSFORM_GLSL}varying vec3 vP,vW,vN;uniform float uTime,uKind;void main(){vP=position;vec3 displaced=position;if(uKind<2.5)displaced*=1.+sin(position.y*8.+uTime*2.)*sin(position.x*7.-uTime)*.018;vec4 p=vec4(displaced,1.);vec3 n=normal;
      #ifdef USE_INSTANCING
      p=instanceMatrix*p;n=normalForTransform(instanceMatrix,n);
      #endif
      vec4 w=modelMatrix*p;vW=w.xyz;vN=normalize(normalForTransform(modelMatrix,n));gl_Position=projectionMatrix*viewMatrix*w;}`,
    fragmentShader:`varying vec3 vP,vW,vN;uniform float uTime,uFade,uEnergy,uDetail,uKind;${solarNoise}
      void main(){vec3 n=normalize(vN),eye=normalize(cameraPosition-vW);float fres=pow(1.-abs(dot(n,eye)),2.5);vec3 p=vP*3.+vec3(0.,uTime*.18,-uTime*.15);float warp=sn(p*.7+vec3(uTime*.1));float flow=sn(p+vec3(warp*2.,warp,-warp));if(uDetail>1.5)flow=flow*.72+sn(p*2.1-vec3(warp))* .28;if(uDetail>2.5)flow=flow*.85+sn(p*4.2)*.15;float lanes=pow(max(0.,sin(vP.y*18.+warp*8.-uTime*2.)),9.);vec3 gold=mix(vec3(.45,.32,.1),vec3(.95,.85,.47),smoothstep(.2,.8,flow));vec3 col=gold+vec3(.5,.48,.32)*lanes*.45+vec3(.25,.22,.16)*fres;float alpha=uFade;
        if(uKind<.5)col=vec3(1.08,1.02,.86)+flow*.12;
        else if(uKind<1.5)col*=.85+uEnergy*.18;
        else if(uKind<2.5){col=mix(vec3(.58,.43,.16),vec3(.92,.89,.65),flow)+fres*.3;alpha*=pow(fres,1.4)*(.38+flow*.5);}
        else {col=mix(vec3(.75,.58,.23),vec3(.99,.98,.84),flow*.6+fres*.25);alpha*=.65+fres*.3;}
        gl_FragColor=vec4(col,alpha);}`});
}
export function novaWaveMaterial():ShaderMaterial{
  return new ShaderMaterial({transparent:true,depthWrite:false,side:DoubleSide,blending:AdditiveBlending,uniforms:{uTime:{value:0},uFade:{value:1}},
    vertexShader:`${NORMAL_TRANSFORM_GLSL}varying vec2 vUv;varying vec3 vW;uniform float uTime;void main(){vUv=uv;vec3 p=position*(1.+sin(uv.x*41.+uTime*4.)*sin(uv.y*22.)*.025);vec4 w=modelMatrix*vec4(p,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,
    fragmentShader:`varying vec2 vUv;varying vec3 vW;uniform float uTime,uFade;void main(){vec3 n=normalize(cross(dFdx(vW),dFdy(vW)));float edge=pow(1.-abs(dot(n,normalize(cameraPosition-vW))),2.);float bands=pow(max(0.,sin(vUv.y*71.-uTime*5.+sin(vUv.x*18.)*.6)),12.);float rays=pow(max(0.,cos(vUv.x*79.+uTime)),18.);vec3 col=mix(vec3(.62,.45,.13),vec3(1.,.98,.82),edge*.7+bands*.3);gl_FragColor=vec4(col,(edge*.46+bands*.18+rays*.04)*uFade);}`});
}
