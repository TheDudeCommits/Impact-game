// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import {InstancedMesh,Object3D,Vector3} from 'three';
import type {InstancedBufferAttribute} from 'three';
import type {AbilityCastContext} from '../Ability';
import {VisualOwner,ease,hash,clamp01} from '../elemental/ElementalVisuals';
import {AstralParticles} from '../elemental/AstralVisuals';
import {celestialSwordGeometry} from './CelestialSwordGeometry';
import {celestialSwordMaterial} from './CelestialSwordMaterial';
import type {SwordFormation} from './SwordFormation';
/** Materialization motes, flight sparks, impact flakes, execution convergence, and warm fallout. */
export class HeavenlyAftermath{
  readonly particles:AstralParticles;
  readonly fragments:InstancedMesh;
  private readonly material;
  private readonly life:InstancedBufferAttribute;
  private readonly dummy=new Object3D();
  private readonly sample=new Vector3();
  constructor(owner:VisualOwner){
    this.particles=new AstralParticles(owner,480,'#fff0be','solar');const geometry=owner.geometry(celestialSwordGeometry(130,false));this.life=geometry.getAttribute('aLife') as InstancedBufferAttribute;this.material=owner.material(celestialSwordMaterial());this.fragments=new InstancedMesh(geometry,this.material,130);this.fragments.frustumCulled=false;owner.root.add(this.fragments);
  }
  update(t:number,formation:SwordFormation,swords:number,count:number,fragments:number,fade:number,context:AbilityCastContext):void{
    const mesh=this.particles.mesh,d=this.dummy,s=formation.state;mesh.count=count;mesh.visible=t>=.45;this.particles.material.uniforms.uFade.value=fade*.72;
    for(let i=0;i<count;i++){const seed=hash(i+29),index=i%swords,k=index*14,type=i%5,age=t-s[k+7]-s[k+8],nova=t-5.25;let visible=1;
      if(type===0){d.position.set(s[k]+Math.sin(t+i)*.6,s[k+1]+Math.cos(t+i)*.5,s[k+2]);visible=ease((t-s[k+6])/.15)*(1-ease((t-s[k+6]-.45)/.4));}
      else if(type===1){const p=clamp01((t-s[k+7]-seed*.09)/s[k+8]);formation.sample(index,p*p*(2-p),this.sample);d.position.copy(this.sample);d.position.x+=(seed-.5)*.35;visible=t>=s[k+7]&&age<.1?1:0;}
      else if(type===2){const a=i*2.39996,r=Math.max(0,age)*(1+seed*4);d.position.set(s[k+3]+Math.cos(a)*r,.15+Math.max(0,(2+seed*4)*age-5*age*age),s[k+5]+Math.sin(a)*r);visible=age>=0?1-ease(age/.8):0;}
      else if(type===3){const compress=ease((t-3.8)/.9),r=(2+seed*6)*(1-compress*.99);d.position.set(Math.cos(i*2.39996+t)*r,28+(hash(i+41)-.5)*r,Math.sin(i*2.39996+t)*r);visible=ease((t-3.7)/.4)*(1-ease((t-4.7)/.6));}
      else{const a=i*2.39996,r=Math.min(22,Math.max(0,nova)*(2+seed*7));d.position.set(Math.cos(a)*r,Math.max(.08,2+hash(i+18)*6-Math.max(0,nova)*(.5+seed)),Math.sin(a)*r);visible=ease(nova/.15);}
      d.quaternion.copy(context.camera.quaternion);const size=(.025+seed*.09)*fade*visible;d.scale.set(size,size*(type===1?4:1),size);d.updateMatrix();mesh.setMatrixAt(i,d.matrix);
    }mesh.instanceMatrix.needsUpdate=true;this.fragments.count=fragments;this.fragments.visible=t>=5.25;this.material.uniforms.uTime.value=t;
    const age=Math.max(0,t-5.25);for(let i=0;i<fragments;i++){const seed=hash(i+17),a=i*2.39996,r=Math.min(25,age*(3+seed*10));d.position.set(Math.cos(a)*r,Math.max(.07,2+(3+seed*7)*age-2.2*age*age),Math.sin(a)*r);d.rotation.set(i+t*.3,i*.7+t*.2,i+t*.4);const size=(.04+seed*.1)*fade;d.scale.set(size,size*(i%3===0?2:.5),size);d.updateMatrix();this.fragments.setMatrixAt(i,d.matrix);this.life.setXYZW(i,fade*(1-ease((t-7)/1)),1,1,.5);}this.fragments.instanceMatrix.needsUpdate=true;this.life.needsUpdate=true;
  }
}
