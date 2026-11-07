// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { Group, Mesh, PointLight, Vector3 } from 'three';
import type { AbilityCastContext } from '../Ability';
import type { ManagedEffect } from '../../effects/EffectManager';
import { MOON_CAST, moonPhase, moonQuality, smooth, saturate, type MoonfallConfig, type MoonPhase, type MoonQuality } from './AbyssalMoonfallConfig';
import { createAbyssalMoonGeometry } from './MoonGeometry';
import { createMoonMaterial } from './MoonMaterial';
import { MoonStructures } from './MoonStructures';
import { MoonLightning } from './MoonLightning';
import { MoonfallParticles } from './MoonfallParticles';
import { MoonfallWater } from './MoonfallWater';
import { MoonStorm } from './MoonStorm';

/** A single reusable ultimate lease. Its clock alone schedules every phase and owned disturbance. */
export class AbyssalMoonfallEffect implements ManagedEffect {
  readonly root=new Group();readonly body:Mesh;readonly metal=createMoonMaterial('shell');readonly structures=new MoonStructures();
  readonly lightning=new MoonLightning();readonly particles=new MoonfallParticles();readonly water=new MoonfallWater();readonly storm=new MoonStorm();
  readonly center=new Vector3();readonly ground=new Vector3();readonly sky=new Vector3();readonly light=new PointLight('#ad92ff',0,180,2);
  private readonly direction=new Vector3();private readonly hand=new Vector3();private readonly lods;
  private context:AbilityCastContext;private config:MoonfallConfig;private quality:MoonQuality;private unsubscribe?:()=>void;
  private age=0;private impact=10;private contact=35;private waveIndex=0;private destroyed=false;
  active=false;phase:MoonPhase='cleanup';
  constructor(ctx:AbilityCastContext,c:Readonly<MoonfallConfig>){
    this.context=ctx;this.config={...c};this.quality=moonQuality(ctx.quality.config,c);
    this.lods=[10,18,26].map(n=>createAbyssalMoonGeometry(c,n));this.body=new Mesh(this.lods[0],this.metal.material);
    this.body.name='Twenty solid cratered lunar plates';this.body.frustumCulled=false;
    this.root.name='Abyssal Moonfall · bounded reusable ultimate';this.root.add(this.body,this.structures.root,this.lightning.root,this.particles.root,this.water.root,this.storm.root,this.light);
  }
  activate(ctx:AbilityCastContext,target:Vector3,c:Readonly<MoonfallConfig>):void{
    this.context=ctx;this.config={...c};this.age=0;this.waveIndex=0;this.active=true;this.phase='summoning';this.ground.copy(target);
    this.impact=MOON_CAST.descent+c.descentDuration;
    this.direction.subVectors(target,ctx.player.position);this.direction.y=0;if(this.direction.lengthSq()<.01)this.direction.copy(ctx.cameraForward).setY(0);this.direction.normalize();
    // The normal camera looks slightly down. Put the full 70m silhouette in its far upper field,
    // then descend diagonally to the actual target; no camera takeover or scale shrinking.
    const standoff=(c.moonHeight+c.moonRadius*1.55)/Math.tan(ctx.skyFraming ? .47 : .26);
    this.sky.copy(target).addScaledVector(this.direction,standoff);this.sky.y=target.y+c.moonHeight;
    this.contact=-this.lods[0].boundingBox!.min.y*c.moonRadius;
    this.body.rotation.set(.12,0,.08);this.light.intensity=0;ctx.scene.add(this.root);
    this.unsubscribe=ctx.quality.subscribe(q=>{this.quality=moonQuality(q,this.config);this.body.geometry=this.lods[this.quality.tier];this.light.visible=this.quality.light;});
    this.update(0);
  }
  update(dt:number):boolean{
    if(!this.active||!Number.isFinite(dt)||dt<0)return this.active;
    if(dt>30)return false;this.age+=dt;const t=this.age,c=this.config,q=this.quality;
    this.phase=moonPhase(t,c);this.root.userData.phase=this.phase;if(this.phase==='cleanup')return false;
    this.context.skyFraming?.(.14*smooth(t)*(1-smooth((t-8)/2)),.12);
    this.ground.y=this.context.water?.getSurfaceHeight(this.ground.x,this.ground.z)??0;
    const assembled=smooth((t-1)/2),fracture=smooth((t-5.5)/2),fall=saturate((t-7.5)/c.descentDuration);
    const travel=fall*fall,after=t-this.impact;
    this.center.copy(this.sky).lerp(this.ground,travel);this.center.y=this.sky.y*(1-travel)+(this.ground.y+this.contact)*travel;
    this.body.position.copy(this.center);this.body.scale.setScalar(c.moonRadius);this.body.rotation.y=t*c.moonRotationSpeed;
    this.body.visible=t>1&&after<.7;
    this.metal.sync(c,t,.08+assembled*.18+fracture*.74,q.tier,after<0?1:1-smooth(after/.7));
    this.metal.uniforms.uAssembly.value=(1-assembled)*.65;this.metal.uniforms.uBreakup.value=fracture;
    this.metal.uniforms.uFall.value=fall*fall*.55;
    this.structures.update(t,this.center,this.ground,c,q,this.impact);
    this.context.player.visual.getRightHandWorldPosition(this.hand);
    this.lightning.update(t,this.center,c,q,this.impact,this.hand);this.particles.update(t,this.impact,this.center,this.ground,c,q);
    this.storm.update(t,this.impact,this.center,this.ground,c);this.water.update(t,after,this.ground,c,q);
    this.light.position.copy(this.center);this.light.position.y=Math.max(this.ground.y+10,this.center.y-c.moonRadius*.5);
    this.light.intensity=after<0?(2+fracture*4)*assembled:50*c.impactFlash*Math.exp(-after*4);
    // Four large low-frequency pulses and three fine secondary wavelets, spread over time.
    while(this.waveIndex<7&&after>=this.waveIndex*.16){const i=this.waveIndex++;
      this.context.water?.addRipple({position:this.ground,strength:c.waterDisplacement/(1+i*.3),duration:Math.min(c.aftermathDuration,3.7),waveSpeed:i<4?18+i*3:8+i,
        wavelength:i<4?3.5+i*.6:.7,radius:i*.4,displacementScale:i<4?2.4:.3,attenuation:i<4?.012:.05},this);
      if(i===0)this.context.cameraFeedback?.(.004,.2);
    }
    return true;
  }
  get particleCount():number{return this.particles.particleCount;}
  get instanceCount():number{return this.structures.instanceCount;}
  dispose():void{if(!this.active)return;this.active=false;this.phase='cleanup';this.unsubscribe?.();this.unsubscribe=undefined;this.context.water?.removeOwner(this);this.root.removeFromParent();this.light.intensity=0;}
  destroy():void{if(this.destroyed)return;this.destroyed=true;this.dispose();this.lods.forEach(g=>g.dispose());this.metal.material.dispose();this.structures.dispose();this.lightning.dispose();this.particles.dispose();this.water.dispose();this.storm.dispose();this.root.clear();}
}
