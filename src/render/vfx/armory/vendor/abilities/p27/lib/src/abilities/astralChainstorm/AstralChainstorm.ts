// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { Vector3 } from 'three';
import type { Ability, AbilityCastContext } from '../Ability';
import { CHAIN_CAST, CHAIN_DEFAULTS, validatedChainConfig, type AstralChainstormConfig } from './AstralChainstormConfig';
import { AstralChainstormEffect } from './AstralChainstormEffect';
export function astralChainTarget(ctx:AbilityCastContext):Vector3|null {
  if(![ctx.origin.x,ctx.origin.y,ctx.origin.z].every(Number.isFinite))return null;
  const source=ctx.groundTarget??ctx.targetPoint,target=new Vector3();
  if(source&&source.toArray().every(Number.isFinite))target.copy(source);
  else{const d=ctx.cameraForward;if(!d.toArray().every(Number.isFinite)||d.lengthSq()<1e-8)return null;target.copy(ctx.origin).addScaledVector(d.clone().normalize(),CHAIN_CAST.range);}
  const delta=target.clone().sub(ctx.origin),distance=delta.length();if(!Number.isFinite(distance)||distance<.05)return null;
  if(distance>CHAIN_CAST.range)target.copy(ctx.origin).addScaledVector(delta.normalize(),CHAIN_CAST.range);
  target.y=ctx.water?.getSurfaceHeight(target.x,target.z)??0;return target;
}
export class AstralChainstorm implements Ability {
  readonly id='astral-chainstorm';readonly name='ASTRAL CHAINSTORM';readonly subtitle='RUNEBREAKER';readonly element='ARCANE / METAL';readonly color='#91f2ff';readonly icon='astral-chainstorm';readonly cooldown=CHAIN_CAST.cooldown;readonly range=CHAIN_CAST.range;readonly tags=['chain','rune','steel','constriction'];
  private readonly controls={...CHAIN_DEFAULTS};private readonly pool:AstralChainstormEffect[]=[];
  get config():Readonly<AstralChainstormConfig>{return this.controls;}
  get activeCount():number{return this.pool.filter(e=>e.active).length;}
  configure(patch:Partial<AstralChainstormConfig>):void{
    const next=validatedChainConfig(patch,this.controls);
    const shape=next.linkLength!==this.controls.linkLength||next.linkThickness!==this.controls.linkThickness;
    if(shape&&this.activeCount)throw new Error('Wait for active chains before rebuilding link geometry');
    if(shape){this.pool.forEach(e=>e.destroy());this.pool.length=0;}Object.assign(this.controls,next);this.pool.forEach(e=>e.refreshQuality());
  }
  cast(ctx:AbilityCastContext):boolean{
    const target=astralChainTarget(ctx);if(!target||this.activeCount>=CHAIN_CAST.maximumActive)return false;
    let effect=this.pool.find(e=>!e.active);if(!effect){effect=new AstralChainstormEffect(ctx,this.controls);this.pool.push(effect);}
    ctx.player.visual.beginRightHandCast(.95);effect.activate(ctx,target);ctx.effectManager.add(effect);return true;
  }
  dispose():void{this.pool.forEach(e=>e.destroy());this.pool.length=0;}
}
