// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import type {Ability,AbilityCastContext} from '../Ability';
import {groundTarget} from '../elemental/ElementalVisuals';
import {SOLAR_NOVA} from './SolarNovaConfig';
import {SolarNovaEffect} from './SolarNovaEffect';
export class SolarNova implements Ability{
  readonly id='solar-nova';readonly name='SOLAR NOVA';readonly subtitle='DAWNSTAR';readonly element='LIGHT / RADIANCE / SOLAR MAGIC';readonly color='#fff0b3';readonly icon='solar-nova';readonly cooldown = SOLAR_NOVA.cooldown; readonly range = SOLAR_NOVA.range;
  cast(context:AbilityCastContext):boolean{if(![context.origin.x,context.origin.y,context.origin.z].every(Number.isFinite))return false;const target=groundTarget(context,SOLAR_NOVA.range);if(!target)return false;context.effectManager.add(new SolarNovaEffect(context,target));return true;}
}
