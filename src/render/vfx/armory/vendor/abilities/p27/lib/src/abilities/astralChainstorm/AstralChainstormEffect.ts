// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { Group, Matrix4, PointLight, Vector3 } from 'three';
import type { AbilityCastContext } from '../Ability';
import type { ManagedEffect } from '../../effects/EffectManager';
import { CHAIN_CAST, chainQuality, type AstralChainstormConfig, type ChainQuality } from './AstralChainstormConfig';
import { createAstralChainLinkGeometry } from './AstralChainGeometry';
import { createAstralChainMaterial } from './AstralChainMaterial';
import { AstralChainAnimation } from './AstralChainAnimation';
import { AstralChainParticles } from './AstralChainParticles';
import { AstralChainImpact } from './AstralChainImpact';
import { clamp01, hash } from '../elemental/ElementalVisuals';

export class AstralChainstormEffect implements ManagedEffect {
  readonly root=new Group();readonly metal=createAstralChainMaterial();readonly chains:AstralChainAnimation;
  readonly particles=new AstralChainParticles();readonly impact=new AstralChainImpact();
  readonly handLight=new PointLight('#91f2ff',0,5,2);readonly impactLight=new PointLight('#38d8ff',0,14,2);
  readonly origin=new Vector3();readonly target=new Vector3();readonly ground=new Vector3();private readonly direction=new Vector3();
  private readonly tip=new Vector3();private readonly velocity=new Vector3();private readonly spark=new Vector3();
  private readonly matrix=new Matrix4();
  private context:AbilityCastContext;private quality:ChainQuality;private unsubscribe?:()=>void;private destroyed=false;
  private age=0;private arrival=0;private impactTime=0;private distance=0;private emitted=false;private released=false;private emission=0;
  private flightSpeed=34;private constrictDuration=.4;
  active=false;phase:'charge'|'assembly'|'launch'|'wrap'|'constrict'|'slam'|'impact'|'complete'='complete';
  constructor(ctx:AbilityCastContext,private readonly config:AstralChainstormConfig){
    this.context=ctx;this.quality=chainQuality(ctx.quality.config,config);
    this.chains=new AstralChainAnimation([20,32,44].map(n=>createAstralChainLinkGeometry(config,n)),this.metal.material);
    this.root.name='Astral Chainstorm · reusable bounded bundle';this.root.add(this.chains.mesh,this.particles.root,this.impact.mesh,this.impact.fractures,this.handLight,this.impactLight);
  }
  activate(ctx:AbilityCastContext,target:Vector3):void{
    this.context=ctx;this.target.copy(target);this.ground.copy(target);this.origin.copy(ctx.origin);this.direction.subVectors(target,this.origin).normalize();
    this.flightSpeed=this.config.launchSpeed;this.constrictDuration=this.config.constrictTime;
    this.age=this.emission=0;this.emitted=this.released=false;this.active=true;this.phase='charge';this.chains.reset();this.particles.reset();this.impact.mesh.visible=this.impact.fractures.visible=false;
    this.handLight.intensity=this.impactLight.intensity=0;ctx.scene.add(this.root);
    this.unsubscribe=ctx.quality.subscribe(q=>{this.quality=chainQuality(q,this.config);this.handLight.visible=this.impactLight.visible=this.quality.light;});
  }
  refreshQuality():void{this.quality=chainQuality(this.context.quality.config,this.config);}
  update(dt:number):boolean{
    if(!this.active||!Number.isFinite(dt)||dt<0)return this.active;
    this.age+=dt;if(dt>8||this.age>8)return false;
    const t=this.age,c=this.config,q=this.quality;
    this.ground.y=this.context.water?.getSurfaceHeight(this.ground.x,this.ground.z)??this.ground.y;
    if(!this.released){
      this.context.player.visual.getRightHandWorldPosition(this.origin);this.direction.subVectors(this.target,this.origin).normalize();
      if(t>=CHAIN_CAST.release){
        this.released=true;this.target.y=this.ground.y+.65;
        this.direction.subVectors(this.target,this.origin);this.distance=this.direction.length();
        if(!Number.isFinite(this.distance)||this.distance<.05)return false;
        this.direction.normalize();if(this.distance>CHAIN_CAST.range){this.distance=CHAIN_CAST.range;this.target.copy(this.origin).addScaledVector(this.direction,this.distance);this.ground.copy(this.target);this.ground.y=this.context.water?.getSurfaceHeight(this.target.x,this.target.z)??0;}
        this.arrival=CHAIN_CAST.release+this.distance/this.flightSpeed+.12;
        this.impactTime=this.arrival+CHAIN_CAST.wrap+this.constrictDuration+CHAIN_CAST.slam;
        this.context.cameraFeedback?.(.008,.07);
      }
    }
    const flightAge=Math.max(0,t-CHAIN_CAST.release);
    const progress=this.released?clamp01(this.flightSpeed*(flightAge-.12*(1-Math.exp(-flightAge/.12)))/Math.max(.05,this.distance)):0;
    const wrap=this.released?clamp01((t-this.arrival)/CHAIN_CAST.wrap):0;
    const constrict=this.released?clamp01((t-this.arrival-CHAIN_CAST.wrap)/this.constrictDuration):0;
    const slam=this.released?clamp01((t-this.impactTime+CHAIN_CAST.slam)/CHAIN_CAST.slam):0;
    const after=this.released?t-this.impactTime:-1;
    this.phase=t<.4?'charge':!this.released?'assembly':after>=0?'impact':slam>0?'slam':constrict>0?'constrict':wrap>0?'wrap':'launch';
    this.root.userData.phase=this.phase;
    const fade=after<0?1:Math.max(0,1-after/.65);
    this.chains.update(t,this.origin,this.target,this.direction,progress,wrap,constrict,slam,fade,q,c,this.ground.y);
    this.metal.sync(c,t,clamp01(t/.75),constrict,fade,q.tier);
    this.tip.copy(this.origin).lerp(this.target,progress);
    // Fixed-rate, bounded emission: no catch-up storm after an interrupted frame.
    if(after<0){this.emission+=Math.min(dt,.05)*(q.tier===0?30:90)*c.sparkDensity;const n=Math.min(12,Math.floor(this.emission));this.emission-=n;
      for(let i=0;i<n;i++){const a=(t*9+i)*2.39996,s=hash(i+t*31);const center=this.released?(wrap>0?this.target:this.tip):this.origin;
        this.spark.copy(center);this.spark.x+=Math.cos(a)*(.25+wrap*c.wrapRadius);this.spark.z+=Math.sin(a)*(.25+wrap*c.wrapRadius);this.spark.y+=wrap*s*4;
        this.velocity.set(Math.cos(a)*.6,.2+s*.6,Math.sin(a)*.6);this.particles.emit(t,this.spark,this.velocity,q.sparks,.045+s*.04,.45+s*.4);}
    }
    if(after>=0&&!this.emitted){
      this.emitted=true;this.particles.burst(t,this.ground,q.fragments,q.sparks);
      for(let i=0;i<4;i++)this.context.water?.addRipple({position:this.ground,strength:c.waterRippleStrength/(1+i*.35),duration:1.4,waveSpeed:4.5+i*1.5,wavelength:.65+i*.2,radius:i*.55},this);
      this.context.cameraFeedback?.(.025,.16);
    }
    if(after>=0&&after<.55&&this.chains.mesh.count){
      this.emission+=Math.min(dt,.05)*60*c.sparkDensity;const n=Math.min(6,Math.floor(this.emission));this.emission-=n;
      for(let i=0;i<n;i++){this.chains.mesh.getMatrixAt(Math.floor(hash(i+t*23)*this.chains.mesh.count),this.matrix);this.spark.setFromMatrixPosition(this.matrix);this.velocity.set(Math.sin(t*17+i),1.5,Math.cos(t*19+i));this.particles.emit(t,this.spark,this.velocity,q.sparks,.08,.7,true);}
    }
    this.handLight.position.copy(this.origin);this.handLight.intensity=this.released?0:1.7*Math.sin(clamp01(t/.75)*Math.PI);
    this.impactLight.position.copy(this.target);this.impactLight.position.y=this.ground.y+2;
    this.impactLight.intensity=after<0?(wrap>0?1.1:0):7*c.impactIntensity*Math.exp(-after*7);
    this.impact.update(after,this.ground,c.impactIntensity);this.particles.update(t,q.sparks);
    return after<CHAIN_CAST.residual;
  }
  get particleCount():number{return this.particles.particleCount;}
  get instanceCount():number{return this.chains.mesh.visible?this.chains.mesh.count+this.particles.instanceCount:this.particles.instanceCount;}
  dispose():void{if(!this.active)return;this.active=false;this.phase='complete';this.unsubscribe?.();this.unsubscribe=undefined;this.context.water?.removeOwner(this);this.root.removeFromParent();this.handLight.intensity=this.impactLight.intensity=0;this.chains.reset();this.particles.reset();}
  destroy():void{if(this.destroyed)return;this.destroyed=true;this.dispose();this.chains.dispose();this.metal.material.dispose();this.particles.dispose();this.impact.dispose();this.root.clear();}
}
