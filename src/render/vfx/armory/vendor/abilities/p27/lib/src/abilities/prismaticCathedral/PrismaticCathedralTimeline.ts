// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import {ease,clamp01} from '../elemental/ElementalVisuals';
export function cathedralTimeline(t:number){
  return {field:ease((t-.3)/.6)*(1-ease((t-6.6)/1.4)),energy:ease((t-3.6)/1.1)*(1-ease((t-5.1)/2.2)),burst:ease((t-4.8)/.07)*(1-ease((t-5.2)/1.8)),fade:1-ease((t-7.1)/.9),sink:ease((t-6.4)/1.6)};
}
/** Accelerating growth followed by a soft stop, with a fixed schedule across quality tiers. */
export function crystalGrowth(t:number,start:number,duration:number):number{const p=clamp01((t-start)/duration);return ease(p*p);}
