// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { Vector3 } from 'three';
import type { Ability, AbilityCastContext } from '../Ability';
import { MOON_CAST, MOON_DEFAULTS, validateMoonConfig, type MoonfallConfig } from './AbyssalMoonfallConfig';
import { AbyssalMoonfallEffect } from './AbyssalMoonfallEffect';

export function moonfallTarget(ctx:AbilityCastContext):Vector3|null{
  if(!ctx.origin.toArray().every(Number.isFinite))return null;
  const source=ctx.groundTarget??ctx.targetPoint,target=new Vector3();
  if(source&&source.toArray().every(Number.isFinite))target.copy(source);
  else {const d=ctx.cameraForward;if(!d.toArray().every(Number.isFinite)||d.lengthSq()<1e-8)return null;target.copy(ctx.origin).addScaledVector(d.clone().normalize(),MOON_CAST.range);}
  const d=target.clone().sub(ctx.origin);d.y=0;const distance=d.length();if(!Number.isFinite(distance)||distance<.5)return null;
  if(distance>MOON_CAST.range)target.copy(ctx.origin).addScaledVector(d.normalize(),MOON_CAST.range);
  target.y=ctx.water?.getSurfaceHeight(target.x,target.z)??0;return target;
}
export class AbyssalMoonfall implements Ability {
  readonly id='abyssal-moonfall';readonly name='ABYSSAL MOONFALL';readonly subtitle='SHATTERED HEAVEN';readonly element='CELESTIAL / VOID';
  readonly icon='abyssal-moonfall';readonly color='#b2a0fa';readonly cooldown=MOON_CAST.cooldown;readonly range=MOON_CAST.range;
  readonly tags=['moon','celestial','void','crater','ultimate','fractured heaven'];
  private controls={...MOON_DEFAULTS};private effect?:AbyssalMoonfallEffect;
  get activeCount():number{return this.effect?.active?1:0;}
  get config():Readonly<MoonfallConfig>{return this.controls;}
  configure(patch:Partial<MoonfallConfig>):void{
    if(this.activeCount)throw new Error('Moonfall tuning applies between casts');
    const next=validateMoonConfig(patch,this.controls);
    const shape=next.craterDepth!==this.controls.craterDepth||next.displacementScale!==this.controls.displacementScale;
    if(shape){this.effect?.destroy();this.effect=undefined;}this.controls=next;
  }
  cast(ctx:AbilityCastContext):boolean{
    if(this.activeCount)return false;const target=moonfallTarget(ctx);if(!target)return false;
    this.effect??=new AbyssalMoonfallEffect(ctx,this.controls);ctx.player.visual.beginRightHandCast(1.5,1.4);
    this.effect.activate(ctx,target,this.controls);ctx.effectManager.add(this.effect);return true;
  }
  dispose():void{this.effect?.destroy();this.effect=undefined;}
}
