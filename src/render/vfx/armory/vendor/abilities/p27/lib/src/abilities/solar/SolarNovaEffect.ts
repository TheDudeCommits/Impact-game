// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import type {Vector3} from 'three';
import type {AbilityCastContext} from '../Ability';
import {PackEffect,shardGeometry,ease} from '../elemental/PackVisuals';
import {SOLAR_NOVA,SOLAR_QUALITY} from './SolarNovaConfig';
import {SolarCore} from './SolarCore';
import {SolarExplosion} from './SolarExplosion';
export class SolarNovaEffect extends PackEffect{
  private readonly core=new SolarCore(this.owner);
  private readonly explosion=new SolarExplosion(this.owner);
  constructor(context:AbilityCastContext,target:Vector3){super(context,target,'#fff0b4',shardGeometry());this.light.distance=55;this.update(0,context.time);}
  get particleCount():number{return this.explosion.particles.mesh.count;}
  get instanceCount():number{return this.particleCount+this.explosion.fragments.count+this.explosion.blades.count+this.explosion.rays.count;}
  update(delta:number,_elapsed:number):boolean{
    if(!this.tick(delta,SOLAR_NOVA.lifetime))return false;const t=this.age,q=SOLAR_QUALITY[this.context.quality.preset],fade=1-ease((t-7.2)/.8);
    this.core.update(t,q.rings,q.flares,q.detail,fade);this.explosion.update(t,q.particles,q.fragments,q.blades,q.rays,q.detail,fade,this.context);this.light.position.y=t<4.5?this.core.root.position.y:4;this.lighting((t<4.5?ease((t-.3)/2.4)*22:(1-ease((t-4.5)/2.8))*(q.detail===3?48:32))*fade);
    this.ripple(0,.3,.14,2,4,2);this.ripple(1,2,.2,2.4,6,3);if(this.ripple(2,4.5,.95,3.4,17,2))this.context.cameraFeedback?.(.006,.26);this.ripple(3,4.7,.5,3,20,3);this.ripple(4,5,.28,2.8,12,4);this.ripple(5,6,.18,1.8,8,3);return true;
  }
}
