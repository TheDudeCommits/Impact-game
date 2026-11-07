// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import {ease,clamp01} from '../elemental/ElementalVisuals';
/** Absolute cast-age choreography; no timers and no quality-dependent launch timestamps. */
export function swordLaunchTime(index:number):number{
  if(index<4)return 1.9+index*.19;
  const order=Math.floor((index-4)/2);return (index-4)%2===0?2.8+order*.027:3.55+order*.012;
}
export function arsenalTimeline(t:number){
  return {fade:1-ease((t-7.2)/.8),executionGrowth:ease((t-3.8)/.85),executionFlight:clamp01((t-4.7)/.55),shock:ease((t-5.25)/.08)*(1-ease((t-5.6)/1.7)),aftermath:ease((t-5.4)/.7)*(1-ease((t-7.1)/.9))};
}
