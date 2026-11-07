// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import {InstancedMesh,Mesh} from 'three';
import type {InstancedBufferAttribute,Vector3} from 'three';
import type {AbilityCastContext} from '../Ability';
import {PackEffect} from '../elemental/PackVisuals';
import {brokenRingGeometry,flareMaterial} from '../elemental/AstralVisuals';
import {gridGeometry,ease} from '../elemental/ElementalVisuals';
import {PRISMATIC_CATHEDRAL,PRISM_QUALITY} from './PrismaticCathedralConfig';
import {cathedralTimeline} from './PrismaticCathedralTimeline';
import {crystalSpikeGeometry} from './CrystalSpikeGeometry';
import {crystalMaterial,prismPalette} from './CrystalMaterials';
import {CrystalFormation} from './CrystalFormation';
import {CrystalField} from './CrystalField';
import {CrystalShards} from './CrystalShards';
import {CrystalBurst} from './CrystalBurst';
export class PrismaticCathedralEffect extends PackEffect{
  private readonly formation=new CrystalFormation(this.owner);
  private readonly field=new CrystalField(this.owner);
  private readonly shards=new CrystalShards(this.owner);
  private readonly burst=new CrystalBurst(this.owner);
  private readonly handMaterial;
  private readonly handRibbons;
  private readonly handCore:InstancedMesh;
  constructor(context:AbilityCastContext,target:Vector3){
    super(context,target,'#d7e5ff',crystalSpikeGeometry(1,14));this.light.distance=45;
    const g=this.owner.geometry(crystalSpikeGeometry(2,1));(g.getAttribute('aCrystal') as InstancedBufferAttribute).setXYZW(0,1,1,.4,.2);this.handMaterial=this.owner.material(crystalMaterial(1));this.handCore=new InstancedMesh(g,this.handMaterial,1);this.handCore.scale.set(.1,.23,.1);this.handCore.frustumCulled=false;this.aura.add(this.handCore);
    this.handRibbons=this.owner.material(flareMaterial('#e4defa'));this.handRibbons.fragmentShader=prismPalette+this.handRibbons.fragmentShader.replace('mix(uColor,vec3(1.),edge*.5)','mix(mix(uColor,prism(vUv.x*.7+uTime*.15),.24),vec3(1.),edge*.5)');
    // Ring geometry uses the crystal material through an instance for its genuine polygonal outline.
    const ringMaterial=this.owner.material(crystalMaterial(2)),ring=this.owner.geometry(brokenRingGeometry(.35,36,.008));ring.setAttribute('aCrystal',g.getAttribute('aCrystal'));const ringMesh=new InstancedMesh(ring,ringMaterial,1);ringMesh.frustumCulled=false;this.aura.add(ringMesh);
    const strip=this.owner.geometry(gridGeometry(32,4));for(let i=0;i<2;i++){const m=new Mesh(strip,this.handRibbons);m.rotation.set(i*.8,i*1.4,i*.6);m.scale.setScalar(.065);m.frustumCulled=false;this.aura.add(m);}this.handRibbons.uniforms.uLength.value=5;this.handRibbons.uniforms.uBend.value=1.8;this.update(0,context.time);
  }
  get particleCount():number{return this.burst.particles.mesh.count+this.burst.mist.mesh.count;}
  get instanceCount():number{return this.particleCount+this.formation.meshes.reduce((sum,m)=>sum+m.count,0)+this.shards.meshes.reduce((sum,m)=>sum+m.count,0)+this.burst.rays.count+2;}
  update(delta:number,_elapsed:number):boolean{
    if(!this.tick(delta,PRISMATIC_CATHEDRAL.lifetime))return false;const t=this.age,q=PRISM_QUALITY[this.context.quality.preset],s=cathedralTimeline(t);
    this.formation.update(t,q.spikes,q.detail,s.energy,s.fade,s.sink);this.field.update(t,s.field,s.energy,q.detail);this.shards.update(t,q.shards,q.detail,s.energy,s.fade);this.burst.update(t,q.rays,q.particles,q.mist,q.detail,s.energy,s.fade,this.context);
    this.handMaterial.uniforms.uTime.value=t;this.handMaterial.uniforms.uDetail.value=q.detail;this.handRibbons.uniforms.uTime.value=t;
    this.ripple(0,.3,.15,2,4,3);
    for(let i=0;i<q.waterSources;i++){const index=i<5?i+5:i-5,k=index*9;if(index>=q.spikes)continue;this.ripple(10+i,this.formation.state[k+7]+.1,.3,1.8,6,1,this.formation.state[k],this.formation.state[k+2]);}
    this.ripple(39,2.6,.3,1.8,6,2);this.ripple(40,3.7,.23,1.2,5,2);if(this.ripple(41,4.8,.9,3.1,15,2))this.context.cameraFeedback?.(.0058,.24);this.ripple(42,5.1,.46,2.6,18,3);this.ripple(43,6,.2,1.8,9,3);
    if(t<.7)this.light.position.copy(this.hand).sub(this.target);else this.light.position.set(0,t<4.8?7:3,0);
    this.light.color.setRGB(.78+Math.sin(t*.7)*.05,.82+Math.cos(t*.6)*.05,1);this.lighting((t<4.8?(3+s.energy*17):33*(1-ease((t-4.8)/2.5)))*s.fade);return true;
  }
}
