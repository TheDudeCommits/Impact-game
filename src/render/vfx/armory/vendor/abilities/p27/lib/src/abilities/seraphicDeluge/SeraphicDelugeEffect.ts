// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import {Mesh,MeshBasicMaterial,SphereGeometry,AdditiveBlending} from 'three';
import type {Vector3} from 'three';
import type {AbilityCastContext} from '../Ability';
import {PackEffect} from '../elemental/PackVisuals';
import {flareMaterial} from '../elemental/AstralVisuals';
import {gridGeometry,ease} from '../elemental/ElementalVisuals';
import {SERAPHIC_DELUGE,DELUGE_QUALITY} from './SeraphicDelugeConfig';
import {delugeTimeline} from './SeraphicDelugeTimeline';
import {swordRainGeometry} from './SwordRainGeometry';
import {SkyGates} from './SkyGates';
import {SwordRainSpawner} from './SwordRainSpawner';
import {SwordRainTrails} from './SwordRainTrails';
import {SwordRainImpacts} from './SwordRainImpacts';
import {RingCollapse} from './RingCollapse';
import {SeraphicAfterpulse} from './SeraphicAfterpulse';
export class SeraphicDelugeEffect extends PackEffect{
  private readonly gates=new SkyGates(this.owner);
  private readonly rain=new SwordRainSpawner(this.owner);
  private readonly ring=new RingCollapse(this.owner);
  private readonly trails=new SwordRainTrails(this.owner);
  private readonly impacts=new SwordRainImpacts(this.owner);
  private readonly afterpulse=new SeraphicAfterpulse(this.owner);
  private readonly chargeMaterial;
  constructor(context:AbilityCastContext,target:Vector3){
    super(context,target,'#fff0bd',swordRainGeometry(0,14));this.light.distance=55;
    const coreMaterial=this.owner.material(new MeshBasicMaterial({color:'#fff8df',transparent:true,opacity:.65,depthWrite:false,blending:AdditiveBlending}));const core=new Mesh(this.owner.geometry(new SphereGeometry(.065,12,8)),coreMaterial);this.aura.add(core);
    this.chargeMaterial=this.owner.material(flareMaterial('#f4e5b7'));this.chargeMaterial.uniforms.uLength.value=4;this.chargeMaterial.uniforms.uBend.value=1.5;const g=this.owner.geometry(gridGeometry(28,4));for(let i=0;i<2;i++){const m=new Mesh(g,this.chargeMaterial);m.rotation.set(i*.8,i*1.5,i);m.scale.setScalar(.07);m.frustumCulled=false;this.aura.add(m);}this.update(0,context.time);
  }
  get particleCount():number{return this.afterpulse.sparks.mesh.count+this.afterpulse.mist.mesh.count+this.afterpulse.fragments.count;}
  get instanceCount():number{
    let swords=0;for(let i=0;i<4;i++)swords+=this.rain.meshes[i].count+(this.rain.halos[i].visible?this.rain.halos[i].count:0);
    return swords+this.ring.mesh.count+(this.ring.halo.visible?this.ring.halo.count:0)+this.trails.mesh.count+this.impacts.surface.count+this.impacts.pillars.count+this.particleCount;
  }
  update(delta:number,_elapsed:number):boolean{
    if(!this.tick(delta,SERAPHIC_DELUGE.lifetime))return false;const t=this.age,q=DELUGE_QUALITY[this.context.quality.preset],s=delugeTimeline(t);
    this.gates.update(t,q.gates,q.detail,s.gates,s.field);this.rain.update(t,q.rain,q.embedded,q.detail,s.fade);this.ring.update(t,q.final,q.detail,s.fade);this.trails.update(t,this.rain,q.rain,this.ring,q.final,q.trails,s.fade);this.impacts.update(t,this.rain,q.rain,this.ring,q.final,s.fade);this.afterpulse.update(t,this.rain,q.rain,q.sparks,q.mist,q.detail,s.fade,this.context);this.chargeMaterial.uniforms.uTime.value=t;
    // Each strike feeds the existing bounded disturbance buffer; surface batches retain every flash.
    for(let i=0;i<q.rain;i++)if(this.rain.newlyHit(i,t)){const k=i*11;this.point.copy(this.target);this.point.x+=this.rain.state[k+3];this.point.z+=this.rain.state[k+5];this.context.water?.addRipple({position:this.point,strength:.13,duration:.28,waveSpeed:6,wavelength:.28,radius:.2},this);}
    for(let i=0;i<q.final;i++)if(this.ring.newlyHit(i,t)){this.point.copy(this.target);this.point.x+=this.ring.landing[i*3];this.point.z+=this.ring.landing[i*3+2];this.context.water?.addRipple({position:this.point,strength:.5,duration:1.55,waveSpeed:9,wavelength:.7,radius:1},this);}
    this.ripple(0,.3,.12,1.7,4,3);if(this.ripple(1,7.24,.75,1.7,16,3))this.context.cameraFeedback?.(.0055,.22);this.ripple(2,7.52,.3,1.35,13,4);
    if(t<.7)this.light.position.copy(this.hand).sub(this.target);else this.light.position.set(0,t<1.6?18:4,0);
    const energy=t<1.6?ease((t-.3)/.8)*9:t<5.8?11+s.rain*7:t<7.24?18+s.ring*8:26*(1-ease((t-7.24)/1.7));this.lighting(energy*s.fade);
    return true;
  }
}
