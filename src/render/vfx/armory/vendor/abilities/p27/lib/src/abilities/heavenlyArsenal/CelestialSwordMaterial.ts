// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { NORMAL_TRANSFORM_GLSL } from '../../effects/NormalTransform';
import {AdditiveBlending,ShaderMaterial,DoubleSide} from 'three';
export function celestialSwordMaterial(halo=false):ShaderMaterial{
  return new ShaderMaterial({transparent:true,depthWrite:false,side:DoubleSide,blending:AdditiveBlending,
    uniforms:{uTime:{value:0},uDetail:{value:2},uHalo:{value:halo?1:0},uFade:{value:1}},
    vertexShader:`${NORMAL_TRANSFORM_GLSL}attribute float aPart,aVariant;attribute vec4 aLife;varying vec3 vP,vW,vN;varying float vOpacity,vEnergy,vVariant,vPart;uniform float uHalo;
      void main(){vec3 p=position;vec3 shape=vec3(1.);vP=position;vPart=aPart;vVariant=aVariant;vOpacity=aLife.x;vEnergy=aLife.w;if(aPart<.5)shape.y=max(.007,aLife.y);else if(aPart<1.5||aPart>2.5){shape.xz=vec2(max(.006,aLife.z));shape.y=max(.02,aLife.y);}else shape=vec3(.5+aLife.z*.5);p*=shape;
        if(uHalo>.5){shape*=vec3(2.6,1.025,2.6);p=position*shape;}
        vec4 w=modelMatrix*instanceMatrix*vec4(p,1.);vW=w.xyz;vN=normalize(normalForTransform(modelMatrix,normalForTransform(instanceMatrix,normal/shape)));gl_Position=projectionMatrix*viewMatrix*w;}`,
    fragmentShader:`varying vec3 vP,vW,vN;varying float vOpacity,vEnergy,vVariant,vPart;uniform float uTime,uDetail,uHalo,uFade;
      void main(){float pulse=.94+.06*sin(uTime*3.+vVariant*6.283);float flow=pow(max(0.,sin(vP.y*16.-uTime*11.+vVariant*7.)),8.);float fres=pow(1.-abs(dot(normalize(vN),normalize(cameraPosition-vW))),2.);float center=exp(-vP.y*vP.y*10.);vec3 white=vec3(1.,.98,.88),gold=vec3(.93,.72,.25);vec3 col=mix(gold,white,.68+center*.3)+vec3(.18,.15,.09)*flow*min(uDetail,2.);float alpha=vOpacity*uFade;
        if(uHalo>.5){col=mix(vec3(.53,.3,.07),vec3(.96,.79,.35),fres*.55+center*.3);alpha*=.13+fres*.22;}
        else{col*=pulse*(1.+vEnergy*.18);col+=center*vec3(.26,.26,.21)*(1.+vEnergy*.3);alpha*=.86;}
        gl_FragColor=vec4(col,alpha);}`});
}
