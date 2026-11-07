// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import type { Ability,AbilityCastContext } from '../Ability';
import { groundTarget } from '../elemental/ElementalVisuals';
import { WRING_OUT } from './WringOutConfig';
import { WringOutEffect } from './WringOutEffect';
export class WringOut implements Ability {
  readonly id='wring-out';readonly name='WRING OUT';readonly subtitle='PLANETARY COLLAPSE';readonly element='GRAVITY / COSMIC FORCE';readonly color='#a18ae4';readonly icon='wring-out';readonly cooldown = WRING_OUT.cooldown; readonly range = WRING_OUT.range;
  cast(context:AbilityCastContext):boolean{const target=groundTarget(context,WRING_OUT.range);if(!target)return false;context.effectManager.add(new WringOutEffect(context,target));return true;}
}
