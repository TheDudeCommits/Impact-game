// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import type {Ability,AbilityCastContext} from '../Ability';
import {groundTarget} from '../elemental/ElementalVisuals';
import {SHADOW_COLOSSUS} from './ShadowColossusConfig';
import {ShadowColossusEffect} from './ShadowColossusEffect';
export class ShadowColossus implements Ability{
  readonly id='shadow-colossus';readonly name='SHADOW COLOSSUS';readonly subtitle='ABYSSAL GRASP';readonly element='SHADOW / DARKNESS / ABYSSAL MAGIC';readonly color='#a477df';readonly icon='shadow-colossus';readonly cooldown = SHADOW_COLOSSUS.cooldown; readonly range = SHADOW_COLOSSUS.range;
  cast(context:AbilityCastContext):boolean{if(![context.origin.x,context.origin.y,context.origin.z].every(Number.isFinite))return false;const target=groundTarget(context,SHADOW_COLOSSUS.range);if(!target)return false;context.effectManager.add(new ShadowColossusEffect(context,target));return true;}
}
