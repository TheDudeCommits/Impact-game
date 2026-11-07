// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import {ease} from '../elemental/ElementalVisuals';
export function shadowTimeline(t:number){
  return {left:ease((t-.8)/1.05),right:ease((t-1.3)/1.08),open:ease((t-2)/1.2),target:ease((t-3)/1.2),grasp:ease((t-4)/1.1),crush:ease((t-5.1)/.45),release:ease((t-6)/1.1),dissolve:ease((t-6.4)/1.85),sink:ease((t-7.2)/1.45),fade:1-ease((t-8)/1),energy:ease((t-2)/2)*(1-ease((t-6)/2))};
}
export type ShadowPose=ReturnType<typeof shadowTimeline>;
