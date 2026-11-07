// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import {InstancedMesh,Mesh,MeshBasicMaterial,Object3D,AdditiveBlending} from 'three';
import type {Vector3} from 'three';
import type {AbilityCastContext} from '../Ability';
import {PackEffect,ease} from '../elemental/PackVisuals';
import {brokenRingGeometry} from '../elemental/AstralVisuals';
import {HEAVENLY_ARSENAL,ARSENAL_QUALITY} from './HeavenlyArsenalConfig';
import {arsenalTimeline} from './HeavenlyArsenalTimeline';
import {celestialSwordGeometry} from './CelestialSwordGeometry';
import {SwordFormation} from './SwordFormation';
import {SwordTrails} from './SwordTrails';
import {ExecutionSword} from './ExecutionSword';
import {SwordImpact} from './SwordImpact';
import {HeavenlyAftermath} from './HeavenlyAftermath';
export class HeavenlyArsenalEffect extends PackEffect{
  private readonly formation:SwordFormation;
  private readonly trails=new SwordTrails(this.owner);
  private readonly execution=new ExecutionSword(this.owner,this.trails.material);
  private readonly impact=new SwordImpact(this.owner);
  private readonly aftermath=new HeavenlyAftermath(this.owner);
  private readonly sigil:Mesh;
  private waterEmitted=0;
  constructor(context:AbilityCastContext,target:Vector3){
    super(context,target,'#fff0bc',celestialSwordGeometry(14,false));this.formation=new SwordFormation(this.owner,context,target);this.light.distance=55;
    const sigilMaterial=this.owner.material(new MeshBasicMaterial({color:'#ffeab6',transparent:true,opacity:.55,depthWrite:false,blending:AdditiveBlending}));this.sigil=new Mesh(this.owner.geometry(brokenRingGeometry(.42,48,.008)),sigilMaterial);this.aura.add(this.sigil);
    const marks=new InstancedMesh(this.owner.geometry(celestialSwordGeometry(8,false)),sigilMaterial,8),d=new Object3D();for(let i=0;i<8;i++){const a=i*Math.PI/4;d.position.set(Math.cos(a)*.4,Math.sin(a)*.4,0);d.rotation.z=a-Math.PI*.5;d.scale.set(.018,.027,.018);d.updateMatrix();marks.setMatrixAt(i,d.matrix);}this.aura.add(marks);this.update(0,context.time);
  }
  get particleCount():number{return this.aftermath.particles.mesh.count+this.aftermath.fragments.count;}
  get instanceCount():number{return this.particleCount+this.formation.mesh.count+(this.formation.halo.visible?this.formation.halo.count:0)+this.trails.mesh.count+this.impact.small.count+this.impact.rays.count+2;}
  update(delta:number,_elapsed:number):boolean{
    if(!this.tick(delta,HEAVENLY_ARSENAL.lifetime))return false;const t=this.age,q=ARSENAL_QUALITY[this.context.quality.preset],s=arsenalTimeline(t);
    this.formation.update(t,q.swords,q.detail,q.residual,s.fade);this.trails.update(t,this.formation,q.swords,q.trails,q.residual,s.fade);this.execution.update(t,q.detail,q.rings,s.fade);this.impact.update(t,this.formation,q.swords,q.residual,q.detail,s.fade);this.aftermath.update(t,this.formation,q.swords,q.particles,q.fragments,s.fade,this.context);
    this.sigil.rotation.z=t*.55;
    const maxRipples=q.detail===1?6:q.detail===2?14:24;
    for(let i=0;i<q.swords;i++)if(this.formation.newlyImpacted(i,t,q.swords,q.residual)&&i%q.waterStride===0&&this.waterEmitted<maxRipples){const k=i*14;this.point.copy(this.target);this.point.x+=this.formation.state[k+3];this.point.z+=this.formation.state[k+5];this.context.water?.addRipple({position:this.point,strength:.22,duration:.65,waveSpeed:7,wavelength:.35,radius:.4},this);this.waterEmitted++;}
    this.ripple(100,.55,.13,1.8,4,2);this.ripple(101,4.85,-.28,.6,3,3);if(this.ripple(102,5.25,.95,2.7,16,2))this.context.cameraFeedback?.(.0065,.26);this.ripple(103,5.55,.46,2.3,19,3);this.ripple(104,6.25,.22,1.6,9,2);
    if(t<.7)this.light.position.copy(this.hand).sub(this.target);else if(t<3.8)this.light.position.set(0,12,6);else if(t<5.25)this.light.position.copy(this.execution.root.position);else this.light.position.set(0,2,0);
    this.lighting((t<3.8?ease((t-.55)/1)*9:t<5.25?ease((t-3.8)/.9)*20:(1-ease((t-5.25)/2.3))*42)*s.fade);return true;
  }
}
