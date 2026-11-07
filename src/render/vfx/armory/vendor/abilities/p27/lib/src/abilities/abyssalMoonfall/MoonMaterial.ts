// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { MeshStandardMaterial } from 'three';
import { frostNoise } from '../frostLance/FrostLanceNoise';
import type { MoonfallConfig } from './AbyssalMoonfallConfig';

/** Existing MIT/Ashima noise utility is reused; all lunar masks and choreography are original. */
export function createMoonMaterial(kind:'shell'|'rock'|'ring') {
  const uniforms={uMoonTime:{value:0},uAssembly:{value:0},uBreakup:{value:0},uFall:{value:0},uFractureProgress:{value:0},uFractureGlow:{value:1.8},uDensity:{value:1},uRockRoughness:{value:.79},uMoonFade:{value:1},uTier:{value:0}};
  const material=new MeshStandardMaterial({color:'#ffffff',roughness:.79,metalness:.22,flatShading:true,fog:false});
  material.onBeforeCompile=s=>{
    Object.assign(s.uniforms,uniforms);
    s.vertexShader=s.vertexShader.replace('#include <common>',`#include <common>
      varying vec3 vMoonLocal;varying float vMoonSurface;
      ${kind==='shell'?'attribute vec3 aPlate;attribute float aIdentity,aSurface;uniform float uAssembly,uBreakup,uFall;':''}`)
      .replace('#include <begin_vertex>',`#include <begin_vertex>
      vMoonLocal=position;vMoonSurface=${kind==='shell'?'aSurface':'1.'};
      ${kind==='shell'?`float detached=step(.6,aIdentity);float spread=uAssembly*(.75+aIdentity*.4)+uBreakup*detached*.6;
        transformed+=aPlate*spread;transformed.y-=uFall*detached*(.3+aIdentity)*1.6;`:''}`);
    s.fragmentShader=s.fragmentShader.replace('#include <common>',`#include <common>
      varying vec3 vMoonLocal;varying float vMoonSurface;
      uniform float uMoonTime,uFractureProgress,uFractureGlow,uDensity,uRockRoughness,uMoonFade,uTier;
      ${frostNoise}
      float lunarFault(vec3 p){
        vec3 n=normalize(p);float warp=snoise(n*6.)*.021;
        float primary=min(abs(dot(n,normalize(vec3(1.,.25,.12)))+warp),abs(dot(n,normalize(vec3(-.2,1.,.4)))+warp));
        float secondary=abs(snoise(n*5.3*uDensity))*.085;
        float gate=smoothstep(.15,.85,uFractureProgress);
        return min(primary,secondary+(.025*(1.-gate)));
      }
      float stroke(vec2 p,vec2 a,vec2 b){vec2 d=b-a;return length(p-a-d*clamp(dot(p-a,d)/dot(d,d),0.,1.));}`)
      .replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
        roughnessFactor=clamp(uRockRoughness+snoise(vMoonLocal*36.)*.09,.38,.98);`)
      .replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
        vec3 p=vMoonLocal;float grain=uTier<.5?snoise(p*7.):fbm3(p*12.);
        float ridge=uTier>1.5?ridged(p*5.,3):abs(grain);
        float mineral=smoothstep(.48,.7,grain+ridge*.28);
        vec3 rock=mix(vec3(.014,.017,.026),vec3(.16,.185,.22),clamp(.37+grain*.6,0.,1.));
        rock+=vec3(.11,.13,.16)*mineral;
        float f=lunarFault(p),cut=1.-smoothstep(.003,.015,f);
        float growth=smoothstep(-.1,.15,uFractureProgress-(normalize(p).y*.38+.48));
        float seam=(1.-smoothstep(.001,.0045,f))*growth;
        float pulse=.7+.3*sin(uMoonTime*3.-p.y*12.+grain*2.);
        ${kind==='ring'?`vec2 g=vec2(p.x*.45+.5,p.z*.85+.5);
          float glyph=min(stroke(g,vec2(.5,.1),vec2(.5,.9)),min(stroke(g,vec2(.22,.32),vec2(.78,.68)),stroke(g,vec2(.25,.7),vec2(.5,.4))));
          seam=1.-smoothstep(.016,.04,glyph);cut=seam;growth=1.;`:''}
        rock*=1.-cut*.8;
        rock=mix(rock,mix(vec3(.02,.017,.03),vec3(.14,.12,.18),clamp(.4+grain*.6,0.,1.)),1.-vMoonSurface);
        diffuseColor.rgb*=rock;
        totalEmissiveRadiance+=vec3(.32,.19,.75)*seam*uFractureGlow*(.2+uFractureProgress)*pulse;
        totalEmissiveRadiance+=vec3(.03,.025,.06)*(1.-vMoonSurface)*uFractureProgress*.25;
        float rim=pow(1.-max(0.,dot(normal,normalize(vViewPosition))),3.);
        totalEmissiveRadiance+=vec3(.025,.033,.06)*rim;
        if(fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453)>uMoonFade)discard;`);
  };
  material.customProgramCacheKey=()=>`abyssal-moonfall-${kind}-v1`;
  return {material,uniforms,sync(c:Readonly<MoonfallConfig>,time:number,progress:number,tier:number,fade=1){
    uniforms.uMoonTime.value=time;uniforms.uFractureProgress.value=progress;uniforms.uFractureGlow.value=c.fractureBrightness;
    uniforms.uDensity.value=c.fractureDensity;uniforms.uRockRoughness.value=c.rockRoughness;uniforms.uTier.value=tier;uniforms.uMoonFade.value=fade;
  }};
}
