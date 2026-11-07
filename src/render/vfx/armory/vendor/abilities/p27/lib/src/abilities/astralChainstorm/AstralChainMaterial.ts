// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { Color, MeshStandardMaterial } from 'three';
import { frostNoise } from '../frostLance/FrostLanceNoise';
import type { AstralChainstormConfig } from './AstralChainstormConfig';
/** Opaque metal with local engraved strokes. Only the narrow rune masks emit light. */
export function createAstralChainMaterial() {
  const uniforms={uTime:{value:0},uRune:{value:.75},uPulseSpeed:{value:.7},uRoughness:{value:.29},uScratchScale:{value:28},uCharge:{value:0},uImpact:{value:0},uFade:{value:1},uTier:{value:0},uRuneColor:{value:new Color('#38d8ff')}};
  const material=new MeshStandardMaterial({color:'#ffffff',metalness:.92,roughness:.29,flatShading:true});
  material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,uniforms);
    shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
      attribute vec3 aChainData;varying vec3 vChainLocal,vChainData;varying vec2 vChainUv;`)
      .replace('#include <begin_vertex>',`#include <begin_vertex>
      vChainLocal=transformed;vChainData=aChainData;vChainUv=uv;`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
      varying vec3 vChainLocal,vChainData;varying vec2 vChainUv;
      uniform float uTime,uRune,uPulseSpeed,uRoughness,uScratchScale,uCharge,uImpact,uFade,uTier;uniform vec3 uRuneColor;
      ${frostNoise}
      float runeStroke(vec2 p,vec2 a,vec2 b){vec2 d=b-a;return length(p-a-d*clamp(dot(p-a,d)/dot(d,d),0.,1.));}
      float runeMask(vec2 p,float seed){
        float stem=runeStroke(p,vec2(.5,.15),vec2(.5,.85));
        float cut=min(runeStroke(p,vec2(.5,.25),vec2(.78,.42)),runeStroke(p,vec2(.5,.5),vec2(.22,.68)));
        if(seed>.5)cut=min(cut,runeStroke(p,vec2(.22,.3),vec2(.78,.65)));
        return 1.-smoothstep(.016,.042,min(stem,cut));
      }`)
      .replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
        float wear=snoise(vChainLocal*uScratchScale);
        roughnessFactor=clamp(uRoughness+wear*.055,.16,.5);`)
      .replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
        vec3 p=vChainLocal;float grain=uTier<.5?snoise(p*9.):fbm3(p*9.);
        float scratches=pow(max(0.,sin(p.y*uScratchScale*13.+snoise(p*4.)*2.)),24.);
        float pits=uTier>1.5?ridged(p*18.,2):grain*.5+.5;
        vec3 steel=mix(vec3(.015,.026,.037),vec3(.15,.2,.245),clamp(.65+grain*.12-pits*.06,0.,1.));
        steel+=vec3(.1,.14,.17)*scratches*.18;
        vec2 rp=vec2(fract(vChainUv.x*4.),fract(vChainUv.y*2.));
        float face=1.-smoothstep(.1,.21,abs(fract(vChainUv.y*2.)-.5));
        float rune=runeMask(rp,vChainData.z)*face;
        diffuseColor.rgb*=mix(steel,vec3(.006,.023,.035),rune*.65);
        float pulse=exp(-pow(fract(vChainData.x-uTime*uPulseSpeed+vChainData.y*.19)-.5,2.)*150.);
        float sheen=pow(max(0.,dot(normalize(normal),normalize(vec3(-.4,.7,.6)))),8.);
        // Modest directional steel response supplements direct lights when scene.environment is absent.
        totalEmissiveRadiance+=steel*.12+vec3(.16,.23,.29)*sheen*.7;
        totalEmissiveRadiance+=uRuneColor*rune*uRune*(.14+uCharge*.25+pulse*(1.3+uImpact*2.));
        if(fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453)>uFade)discard;`);
  };
  material.customProgramCacheKey=()=> 'astral-forged-steel-v1';
  const sync=(c:Readonly<AstralChainstormConfig>,time:number,charge:number,impact:number,fade:number,tier:number)=>{
    uniforms.uTime.value=time;uniforms.uCharge.value=charge;uniforms.uImpact.value=impact;uniforms.uFade.value=fade;
    uniforms.uRune.value=c.runeBrightness;uniforms.uPulseSpeed.value=c.runePulseSpeed;uniforms.uRoughness.value=c.metalRoughness;uniforms.uScratchScale.value=c.scratchScale;uniforms.uTier.value=tier;
  };
  return {material,uniforms,sync};
}
