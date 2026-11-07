// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { Color, MeshStandardMaterial } from 'three';
// Reuse the attributed, already compiled simplex/fbm/ridged utility; no donor engine is imported.
import { frostNoise } from '../frostLance/FrostLanceNoise';
import type { SandReaperConfig } from './SandReaperConfig';

export function createSandReaperMaterial(fragment = false) {
  const uniforms = {
    uTime: { value: 0 }, uStoneColor: { value: new Color('#38271d') }, uSandColor: { value: new Color('#c99b5c') },
    uCrackColor: { value: new Color('#ffe7a5') }, uCrackIntensity: { value: .65 }, uNoiseScale: { value: 3.3 },
    uErosion: { value: .45 }, uRoughness: { value: .84 }, uFacetContrast: { value: .36 }, uEdgeHighlight: { value: .17 },
    uChargeProgress: { value: fragment ? 1 : 0 }, uImpactProgress: { value: 0 }, uOpacity: { value: 1 }, uGlow: { value: .65 }, uDetail: { value: 1 },
  };
  const material = new MeshStandardMaterial({ color: '#ffffff', roughness: .84, metalness: .06, flatShading: true });
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
      attribute float aAlong; varying vec3 vSandLocal,vSandWorld; varying float vSandAlong;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vSandLocal=transformed;vSandAlong=aAlong;
        vec4 sandPosition=vec4(transformed,1.);
        #ifdef USE_INSTANCING
        sandPosition=instanceMatrix*sandPosition;
        #endif
        vSandWorld=(modelMatrix*sandPosition).xyz;`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vSandLocal,vSandWorld; varying float vSandAlong;
      uniform vec3 uStoneColor,uSandColor,uCrackColor;
      uniform float uTime,uCrackIntensity,uNoiseScale,uErosion,uRoughness,uFacetContrast,uEdgeHighlight,uChargeProgress,uImpactProgress,uOpacity,uGlow,uDetail;
      ${frostNoise}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor=clamp(uRoughness+.08*snoise(vSandLocal*19.),.55,.97);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        vec3 sp=vSandLocal*uNoiseScale;
        float grain=uDetail<.5?snoise(sp*3.):fbm3(sp*3.);
        float strata=sin(sp.y*8.+snoise(sp*.7)*3.)*.5+.5;
        float vein=abs(snoise(sp*.75+vec3(.0,3.,7.)));
        float fissure=(1.-smoothstep(.006,.022,vein))*smoothstep(-.2,.3,snoise(sp*.32+vec3(13.)));
        float pits=smoothstep(.4,.8,snoise(sp*22.));
        float mineral=uDetail>1.5?smoothstep(.73,.86,ridged(sp*1.6,4)):smoothstep(.42,.7,grain);
        vec3 stone=mix(uStoneColor,uSandColor,clamp(.48+grain*.23+strata*.16,0.,1.));
        stone=mix(stone,vec3(.05,.027,.017),pits*uErosion*.5);
        stone=mix(stone,uSandColor,mineral*.23);
        float facing=abs(dot(normalize(normal),normalize(vViewPosition)));
        stone*=1.-uFacetContrast*.45+facing*uFacetContrast;
        float rim=pow(1.-facing,3.);
        diffuseColor.rgb*=stone;
        // Solid mineral strata remain local. Only loose sand flowing through seams samples world time.
        float flow=.8+.2*snoise(vSandWorld*2.+vec3(uTime*1.5,0.,uTime));
        float pulse=.9+.1*sin(uTime*6.);
        totalEmissiveRadiance+=stone*.16+uCrackColor*(fissure*uCrackIntensity*flow*pulse*(.4+.6*uChargeProgress+uImpactProgress*2.)+rim*uEdgeHighlight)*uGlow;
        ${fragment ? '' : 'if(abs(vSandAlong-.5)>.505*max(.01,uChargeProgress))discard;'}
        if(uOpacity<.001)discard;
      `);
  };
  material.customProgramCacheKey = () => `sand-reaper-stone-v1-${fragment}`;
  const sync = (c: Readonly<SandReaperConfig>, time: number, charge: number, impact: number, detail: number) => {
    uniforms.uTime.value = time; uniforms.uChargeProgress.value = charge; uniforms.uImpactProgress.value = impact;
    uniforms.uNoiseScale.value = c.noiseFrequency; uniforms.uCrackIntensity.value = c.mineralGlow;
    uniforms.uGlow.value = c.mineralGlow; uniforms.uDetail.value = detail;
  };
  return { material, uniforms, sync };
}
