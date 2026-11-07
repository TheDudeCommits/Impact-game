// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { NORMAL_TRANSFORM_GLSL } from '../../effects/NormalTransform';
import {AdditiveBlending,DoubleSide,ShaderMaterial} from 'three';
export const prismPalette=`vec3 prism(float p){return .58+.42*cos(vec3(0.,2.1,4.2)+p*6.28318);}`;
/** Pale gemstone body, glossy facet glints, angle-dependent interference, and traveling internal seams. */
export function crystalMaterial(role:0|1|2):ShaderMaterial{
  return new ShaderMaterial({transparent:true,depthWrite:role===0,side:DoubleSide,...(role===2?{blending:AdditiveBlending}:{}),
    uniforms:{uTime:{value:0},uDetail:{value:2},uRole:{value:role}},
    vertexShader:`${NORMAL_TRANSFORM_GLSL}attribute vec4 aCrystal;varying vec3 vP,vW,vN;varying vec2 vUv;varying float vFade,vEnergy,vSeed;void main(){vP=position;vUv=uv;vFade=aCrystal.y;vEnergy=aCrystal.z;vSeed=aCrystal.w;vec3 p=position;p.y*=max(.001,aCrystal.x);vec4 w=modelMatrix*instanceMatrix*vec4(p,1.);vW=w.xyz;vec3 n=normal/vec3(1.,max(.001,aCrystal.x),1.);vN=normalize(normalForTransform(modelMatrix,normalForTransform(instanceMatrix,n)));gl_Position=projectionMatrix*viewMatrix*w;}`,
    fragmentShader:`varying vec3 vP,vW,vN;varying vec2 vUv;varying float vFade,vEnergy,vSeed;uniform float uTime,uDetail,uRole;${prismPalette}
      void main(){vec3 n=normalize(vN);if(uDetail>1.5){n=normalize(cross(dFdx(vW),dFdy(vW)));if(!gl_FrontFacing)n=-n;}vec3 eye=normalize(cameraPosition-vW);float incidence=abs(dot(n,eye));float fres=pow(1.-incidence,3.);vec3 film=prism(incidence*1.45+vSeed*.2+uTime*.035);vec3 l=normalize(vec3(-.45,.83,.32));float spec=pow(max(0.,dot(reflect(-l,n),eye)),70.);float micro=.92+.08*sin(vP.y*43.+vP.x*17.)*sin(vP.z*39.);float veins=1.-smoothstep(.018,.055,abs(sin(vP.y*24.+vP.x*7.+sin(vP.z*11.)*.55)));float moving=pow(max(0.,sin(vP.y*16.-uTime*3.+vSeed*7.)),12.);vec3 reflection=reflect(-eye,n);float horizon=pow(max(0.,1.-abs(reflection.y-.28)),40.);vec3 pale=mix(vec3(.035,.065,.11),vec3(.27,.4,.52),.3+.6*max(0.,dot(n,l)));pale+=vec3(.2,.27,.34)*horizon;vec3 col=pale*micro+film*fres*(.22+uDetail*.07)+vec3(.9,.96,1.)*spec*.95;col+=mix(vec3(.72,.89,.96),film,.38)*veins*(.025+vEnergy*.2)+film*moving*vEnergy*.08;col+=vec3(.3,.38,.41)*fres*.3;
        float alpha=(uRole<.5?.78+fres*.17:uRole<1.5?.52+fres*.35:.55+fres*.3)*vFade;
        if(uRole>1.5)col=mix(vec3(.76,.88,.94),film,.35)*(.85+moving*.4+vEnergy*.3);
        gl_FragColor=vec4(col,alpha);}`});
}
export function prismWaveMaterial():ShaderMaterial{
  return new ShaderMaterial({transparent:true,depthWrite:false,side:DoubleSide,blending:AdditiveBlending,uniforms:{uTime:{value:0},uFade:{value:1},uDetail:{value:2}},
    vertexShader:`varying vec2 vUv;varying vec3 vW;uniform float uTime;void main(){vUv=uv;vec3 p=position*(1.+sin(uv.x*43.+uTime)*sin(uv.y*13.)*.018);vec4 w=modelMatrix*vec4(p,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,
    fragmentShader:`varying vec2 vUv;varying vec3 vW;uniform float uTime,uFade,uDetail;${prismPalette}void main(){vec3 n=normalize(cross(dFdx(vW),dFdy(vW)));float rim=pow(1.-abs(dot(n,normalize(cameraPosition-vW))),2.);float facets=pow(max(0.,sin(vUv.x*50.+sin(vUv.y*18.)*.4)),14.);float bands=pow(max(0.,sin(vUv.y*71.-uTime*7.)),14.);vec3 col=mix(vec3(.84,.94,1.),prism(vUv.x+uTime*.045),.38+.22*rim);gl_FragColor=vec4(col,uFade*(rim*.4+bands*.2+facets*.035*uDetail));}`});
}
