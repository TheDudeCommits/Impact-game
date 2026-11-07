// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import type {Ability,AbilityCastContext} from '../Ability';
import {groundTarget} from '../elemental/ElementalVisuals';
import {HEAVENLY_ARSENAL} from './HeavenlyArsenalConfig';
import {HeavenlyArsenalEffect} from './HeavenlyArsenalEffect';
export class HeavenlyArsenal implements Ability{
  readonly id='heavenly-arsenal';readonly name='HEAVENLY ARSENAL';readonly subtitle='JUDGMENT OF LIGHT';readonly element='LIGHT / CELESTIAL SWORD MAGIC';readonly color='#fff0bc';readonly icon='heavenly-arsenal';readonly cooldown = HEAVENLY_ARSENAL.cooldown; readonly range = HEAVENLY_ARSENAL.range;
  cast(context:AbilityCastContext):boolean{if(![context.origin.x,context.origin.y,context.origin.z].every(Number.isFinite))return false;const target=groundTarget(context,HEAVENLY_ARSENAL.range);if(!target)return false;context.effectManager.add(new HeavenlyArsenalEffect(context,target));return true;}
}
