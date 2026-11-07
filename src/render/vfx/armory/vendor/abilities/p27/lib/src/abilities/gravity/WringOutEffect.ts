// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import type { Vector3 } from 'three';
import type { AbilityCastContext } from '../Ability';
import { PackEffect,shardGeometry,ease } from '../elemental/PackVisuals';
import { WRING_OUT,GRAVITY_QUALITY } from './WringOutConfig';
import { GravityCore } from './GravityCore';
import { GravityBurst } from './GravityBurst';
export class WringOutEffect extends PackEffect {
  private readonly core=new GravityCore(this.owner);
  private readonly burst=new GravityBurst(this.owner);
  constructor(context:AbilityCastContext,target:Vector3){super(context,target,'#9f84df',shardGeometry());this.update(0,context.time);}
  get particleCount():number{return this.burst.particles.mesh.count;}
  get instanceCount():number{return this.particleCount+this.burst.debris.count;}
  update(delta:number,_elapsed:number):boolean{
    if(!this.tick(delta,WRING_OUT.lifetime))return false;const t=this.age,q=GRAVITY_QUALITY[this.context.quality.preset],fade=1-ease((t-6.3)/1.2);
    this.core.update(t,q.halos,fade);this.burst.update(t,q.debris,q.particles,q.shells,fade,this.context);this.lighting((t<3.8?ease((t-.8)/2)*7:(1-ease((t-3.8)/2))*22)*fade);
    this.ripple(0,.3,-.18,2,3,5);this.ripple(1,1.2,-.3,2,3,5);this.ripple(2,2.2,-.45,1.8,2.5,4);this.ripple(3,3.35,-.65,.8,2,2);
    if(this.ripple(4,3.8,1,3,17,2))this.context.cameraFeedback?.(.007,.25);this.ripple(5,4.03,.6,2.8,20,3);this.ripple(6,4.4,.35,2.5,14,3);this.ripple(7,5.1,.18,1.8,9,2);
    return true;
  }
}
