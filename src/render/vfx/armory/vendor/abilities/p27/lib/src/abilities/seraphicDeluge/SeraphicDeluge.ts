// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import type {Ability,AbilityCastContext} from '../Ability';
import {groundTarget} from '../elemental/ElementalVisuals';
import {SERAPHIC_DELUGE} from './SeraphicDelugeConfig';
import {SeraphicDelugeEffect} from './SeraphicDelugeEffect';
export class SeraphicDeluge implements Ability{
  readonly id='seraphic-deluge';readonly name='SERAPHIC DELUGE';readonly subtitle='MILLENNIUM BLADEFALL';readonly element='LIGHT / CELESTIAL SWORD RAIN';readonly color='#fff0bd';readonly icon='seraphic-deluge';readonly cooldown = SERAPHIC_DELUGE.cooldown; readonly range = SERAPHIC_DELUGE.range;
  cast(context:AbilityCastContext):boolean{if(![context.origin.x,context.origin.y,context.origin.z].every(Number.isFinite))return false;const target=groundTarget(context,SERAPHIC_DELUGE.range);if(!target)return false;context.effectManager.add(new SeraphicDelugeEffect(context,target));return true;}
}
