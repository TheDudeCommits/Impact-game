// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import type {Ability,AbilityCastContext} from '../Ability';
import {groundTarget} from '../elemental/ElementalVisuals';
import {PRISMATIC_CATHEDRAL} from './PrismaticCathedralConfig';
import {PrismaticCathedralEffect} from './PrismaticCathedralEffect';
export class PrismaticCathedral implements Ability{
  readonly id='prismatic-cathedral';readonly name='PRISMATIC CATHEDRAL';readonly subtitle='AURORA SPIRES';readonly element='CRYSTAL / PRISM / IRIDESCENT LIGHT';readonly color='#d9d9ff';readonly icon='prismatic-cathedral';readonly cooldown = PRISMATIC_CATHEDRAL.cooldown; readonly range = PRISMATIC_CATHEDRAL.range;
  cast(context:AbilityCastContext):boolean{if(![context.origin.x,context.origin.y,context.origin.z].every(Number.isFinite))return false;const target=groundTarget(context,PRISMATIC_CATHEDRAL.range);if(!target)return false;context.effectManager.add(new PrismaticCathedralEffect(context,target));return true;}
}
