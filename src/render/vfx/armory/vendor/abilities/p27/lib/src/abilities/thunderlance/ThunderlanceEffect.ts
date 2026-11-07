// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import type {Vector3} from 'three';
import type {AbilityCastContext} from '../Ability';
import {PackEffect,shardGeometry,ease} from '../elemental/PackVisuals';
import {THUNDERLANCE,THUNDER_QUALITY} from './ThunderlanceConfig';
import {LightningSpear} from './LightningSpear';
import {ElectricCage} from './ElectricCage';
export class ThunderlanceEffect extends PackEffect{
  private readonly spear=new LightningSpear(this.owner);
  private readonly cage=new ElectricCage(this.owner);
  constructor(context:AbilityCastContext,target:Vector3){super(context,target,'#a7edff',shardGeometry());this.update(0,context.time);}
  get particleCount():number{return this.cage.sparks.mesh.count;}
  get instanceCount():number{return this.particleCount;}
  update(delta:number,_elapsed:number):boolean{
    if(!this.tick(delta,THUNDERLANCE.lifetime))return false;const t=this.age,q=THUNDER_QUALITY[this.context.quality.preset],fade=1-ease((t-6.1)/.4);
    this.spear.update(t,q.detail,q.branches,fade,this.context,this.target);this.cage.update(t,q.cage,q.branches,q.sparks,q.detail,fade,this.context);
    if(t<2.05)this.light.position.copy(this.spear.root.position);else this.light.position.set(0,1.5,0);this.lighting(t<1.5?ease(t/.6)*6:t<2.05?10:(1-ease((t-4.15)/1.8))*18*fade);
    if(this.ripple(0,2.05,.85,2.1,13,2))this.context.cameraFeedback?.(.005,.18);this.ripple(1,2.4,.3,1.7,9,2);if(this.ripple(2,4.15,.9,2.2,18,2))this.context.cameraFeedback?.(.0055,.2);this.ripple(3,4.45,.4,1.8,14,3);
    for(let i=0;i<q.detail*2;i++){const a=i*2.39996;this.ripple(10+i,4.6+i*.1,.15,1,6,1,Math.cos(a)*8,Math.sin(a)*8);}return true;
  }
}
