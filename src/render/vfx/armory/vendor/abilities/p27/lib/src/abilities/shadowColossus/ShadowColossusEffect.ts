// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import {Group,Mesh,Vector3} from 'three';
import type {AbilityCastContext} from '../Ability';
import {PackEffect,shardGeometry} from '../elemental/PackVisuals';
import {flareMaterial} from '../elemental/AstralVisuals';
import {gridGeometry} from '../elemental/ElementalVisuals';
import {SHADOW_COLOSSUS,SHADOW_QUALITY} from './ShadowColossusConfig';
import {shadowTimeline} from './ShadowColossusTimeline';
import {handGeometries} from './ShadowHandGeometry';
import {ShadowHandRig} from './ShadowHandRig';
import {animateShadowHand} from './ShadowHandAnimation';
import {shadowHandMaterial} from './ShadowMaterials';
import {ShadowTargetField} from './ShadowTargetField';
import {ShadowGrasp} from './ShadowGrasp';
import {ShadowMistSystem} from './ShadowMistSystem';
import {ShadowCrushImpact} from './ShadowCrushImpact';
export class ShadowColossusEffect extends PackEffect{
  private readonly stage=new Group();
  private readonly material=this.owner.material(shadowHandMaterial());
  private readonly geometry=[0,1,2].map(d=>handGeometries(this.owner,d));
  private readonly left=new ShadowHandRig(-1,this.geometry[1],this.material);
  private readonly right=new ShadowHandRig(1,this.geometry[1],this.material);
  private readonly field=new ShadowTargetField(this.owner);
  private readonly grasp=new ShadowGrasp(this.owner);
  private readonly mist=new ShadowMistSystem(this.owner);
  private readonly impact=new ShadowCrushImpact(this.owner);
  private readonly axis=new Vector3();
  private readonly auraMaterial;
  constructor(context:AbilityCastContext,target:Vector3){
    super(context,target,'#77529f',shardGeometry());const forward=new Vector3().subVectors(target,context.player.position).setY(0);if(forward.lengthSq()<.001)forward.copy(context.playerForward).setY(0);if(forward.lengthSq()<.001)forward.set(0,0,-1);forward.normalize();this.axis.set(forward.z,0,-forward.x);this.stage.rotation.y=Math.atan2(forward.x,forward.z);this.stage.add(this.left.root,this.right.root);this.owner.root.add(this.stage);this.light.distance=40;
    this.auraMaterial=this.owner.material(flareMaterial('#614482'));this.auraMaterial.uniforms.uLength.value=4;this.auraMaterial.uniforms.uBend.value=1.6;const g=this.owner.geometry(gridGeometry(28,4));for(let i=0;i<2;i++){const m=new Mesh(g,this.auraMaterial);m.scale.setScalar(.07);m.rotation.set(i,i*.8,i*.6);m.frustumCulled=false;this.aura.add(m);}this.update(0,context.time);
  }
  get particleCount():number{return this.mist.mesh.count+this.mist.fragments.count;}
  get instanceCount():number{return this.particleCount+this.grasp.filaments.count;}
  update(delta:number,_elapsed:number):boolean{
    if(!this.tick(delta,SHADOW_COLOSSUS.lifetime))return false;const t=this.age,q=SHADOW_QUALITY[this.context.quality.preset],p=shadowTimeline(t);
    this.left.setDetail(this.geometry[q.detail]);this.right.setDetail(this.geometry[q.detail]);animateShadowHand(this.left,t,p);animateShadowHand(this.right,t,p);
    this.material.uniforms.uTime.value=t;this.material.uniforms.uEnergy.value=.18+p.energy*(.65+p.crush*.7)*(1-p.release*.6);this.material.uniforms.uDissolve.value=p.dissolve;this.material.uniforms.uFade.value=p.fade;this.material.uniforms.uDetail.value=q.detail;
    this.field.update(t,p.grasp,p.fade);this.grasp.update(t,p,this.left,this.right,this.target,q.filaments);this.mist.update(t,p,q.motes,q.mist,q.fragments,this.left,this.right,this.target,this.context);this.impact.update(t,q.shells,q.detail,p.fade);this.auraMaterial.uniforms.uTime.value=t;
    this.ripple(0,.3,-.18,2,3,4);this.ripple(1,.88,.62,2,8,1,-this.axis.x*6.6,-this.axis.z*6.6);this.ripple(2,1.38,.62,2,8,1,this.axis.x*6.6,this.axis.z*6.6);this.ripple(3,2.5,.23,2,5,3);this.ripple(4,4.2,-.38,1.25,3,4);this.ripple(5,5.15,-.48,.55,3,2);
    if(this.ripple(6,5.55,1,3,16,2))this.context.cameraFeedback?.(.007,.28);this.ripple(7,5.88,.52,2.5,19,3);this.ripple(8,7,.2,1.8,8,2);
    if(t<.7)this.light.position.copy(this.hand).sub(this.target);else this.light.position.set(0,5.5,0);this.lighting((5+p.energy*15+p.crush*9)*(1-p.release*.6)*p.fade);
    return true;
  }
}
