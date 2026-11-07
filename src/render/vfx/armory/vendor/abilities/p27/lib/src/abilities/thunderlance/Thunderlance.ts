// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import type {Ability,AbilityCastContext} from '../Ability';
import {groundTarget} from '../elemental/ElementalVisuals';
import {THUNDERLANCE} from './ThunderlanceConfig';
import {ThunderlanceEffect} from './ThunderlanceEffect';
export class Thunderlance implements Ability{
  readonly id='thunderlance';readonly name='THUNDERLANCE';readonly subtitle='STORMPIERCER';readonly element='LIGHTNING / ELECTRICITY';readonly color='#8be9ff';readonly icon='thunderlance';readonly cooldown = THUNDERLANCE.cooldown; readonly range = THUNDERLANCE.range;
  cast(context:AbilityCastContext):boolean{if(![context.origin.x,context.origin.y,context.origin.z].every(Number.isFinite))return false;const target=groundTarget(context,THUNDERLANCE.range);if(!target||target.distanceToSquared(context.origin)<.04)return false;context.effectManager.add(new ThunderlanceEffect(context,target));return true;}
}
