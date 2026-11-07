// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import {clamp01,ease,hash} from '../elemental/ElementalVisuals';
/** Interleaved stable IDs cover every rain phase even when the quality budget is reduced. */
export function rainSpawnTime(index:number):number{
  if(index%12===0)return .82+hash(index+701)*.6;
  if(index%3===0)return 3.4+hash(index+411)*1.3;
  return 1.6+Math.sqrt(hash(index+91))*2.4;
}
export function delugeTimeline(t:number){return {fade:1-ease((t-8.2)/.8),field:ease((t-.3)/.6)*(1-ease((t-8)/1)),gates:ease((t-.3)/.6)*(1-ease((t-6.7)/.7)),rain:clamp01((t-1.4)/2.5),ring:ease((t-5.8)/.5),pulse:ease((t-7.24)/.08)*(1-ease((t-7.6)/1.4))};}
export function fallProgress(age:number,duration:number):number{return Math.pow(clamp01(age/duration),2.15);}
