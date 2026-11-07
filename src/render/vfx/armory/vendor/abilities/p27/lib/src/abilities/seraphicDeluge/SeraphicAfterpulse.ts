// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import {InstancedMesh,Object3D,Mesh,ShaderMaterial,SphereGeometry} from 'three';
import type {InstancedBufferAttribute} from 'three';
import type {AbilityCastContext} from '../Ability';
import {VisualOwner,ease,hash,clamp01} from '../elemental/ElementalVisuals';
import {AstralParticles,brokenRingGeometry} from '../elemental/AstralVisuals';
import {novaWaveMaterial} from '../solar/SolarMaterials';
import {swordRainGeometry} from './SwordRainGeometry';
import {swordRainMaterial} from './SwordRainMaterials';
import type {SwordRainSpawner} from './SwordRainSpawner';
/** Wide resonance with broken arcs and low pressure depth, rather than an explosion or a lone sword. */
export class SeraphicAfterpulse{
  readonly arcs:Mesh[]=[];
  readonly shell:Mesh;
  readonly sparks:AstralParticles;
  readonly mist:AstralParticles;
  readonly fragments:InstancedMesh;
  private readonly material:ShaderMaterial;
  private readonly fragmentMaterial;
  private readonly fragmentData:InstancedBufferAttribute;
  private readonly dummy=new Object3D();
  constructor(owner:VisualOwner){
    this.material=owner.material(novaWaveMaterial());const ring=owner.geometry(brokenRingGeometry(1,100,.01));for(let i=0;i<3;i++){const m=new Mesh(ring,this.material);m.rotation.x=-Math.PI*.5;m.position.y=.18+i*.18;this.arcs.push(m);owner.root.add(m);}
    this.shell=new Mesh(owner.geometry(new SphereGeometry(1,56,20,0,Math.PI*2,0,Math.PI*.51)),this.material);this.shell.frustumCulled=false;owner.root.add(this.shell);
    this.sparks=new AstralParticles(owner,500,'#fff0be','solar');this.mist=new AstralParticles(owner,90,'#c8b998','solar',true);
    const g=owner.geometry(swordRainGeometry(2,90));this.fragmentData=g.getAttribute('aRain') as InstancedBufferAttribute;this.fragmentMaterial=owner.material(swordRainMaterial());this.fragments=new InstancedMesh(g,this.fragmentMaterial,90);this.fragments.frustumCulled=false;owner.root.add(this.fragments);
  }
  update(t:number,rain:SwordRainSpawner,count:number,sparks:number,mist:number,detail:number,fade:number,context:AbilityCastContext):void{
    const age=t-7.24,pressure=age>=0?(1-ease(age/1.75))*fade:0;this.material.uniforms.uTime.value=t;this.material.uniforms.uFade.value=pressure*.8;const radius=22*ease(age/1.2);this.shell.visible=age>=0&&age<1.75;this.shell.scale.set(Math.max(.001,radius),Math.max(.001,radius*.1),Math.max(.001,radius));this.shell.position.y=.13;
    this.arcs.forEach((m,i)=>{const a=age-i*.15;m.visible=i<detail&&a>=0&&a<1.75;m.scale.setScalar(Math.max(.001,(19+i*1.5)*ease(a/(.85+i*.15))));});
    const d=this.dummy,s=rain.state;this.sparks.mesh.count=sparks;this.sparks.mesh.visible=t>=.75;this.sparks.material.uniforms.uFade.value=fade*.75;
    for(let i=0;i<sparks;i++){const index=i%count,k=index*11,seed=hash(i+8),birth=s[k+6],duration=s[k+7],hit=t-birth-duration,type=i%4;let alpha=1;
      if(type===0){const p=clamp01((t-birth-seed*.1)/duration);rain.sample(index,Math.pow(p,2.15),d.position);d.position.x+=(seed-.5)*.35;alpha=t>=birth&&hit<.08?1:0;}
      else if(type===1){const a=i*2.39996,r=Math.max(0,hit)*(1+seed*3);d.position.set(s[k+3]+Math.cos(a)*r,.14+Math.max(0,(1+seed*4)*hit-4*hit*hit),s[k+5]+Math.sin(a)*r);alpha=hit>=0?1-ease(hit/.75):0;}
      else if(type===2){d.position.set(s[k+3]+Math.sin(t+i)*.4,.2+((Math.max(0,hit)*.6+seed*2)%3),s[k+5]+Math.cos(t+i)*.4);alpha=hit>=0?(1-ease((hit-2.8)/1.8)):0;}
      else{const a=i*2.39996,r=4+seed*14;d.position.set(Math.cos(a)*r,Math.max(.1,1+hash(i+33)*6-Math.max(0,age)*1.5),Math.sin(a)*r);alpha=ease(age/.25);}
      d.quaternion.copy(context.camera.quaternion);const size=(.025+seed*.08)*alpha*fade;d.scale.set(size,size*(type===0?4:1),size);d.updateMatrix();this.sparks.mesh.setMatrixAt(i,d.matrix);
    }this.sparks.mesh.instanceMatrix.needsUpdate=true;
    this.mist.mesh.count=mist;this.mist.mesh.visible=t>=1.5;this.mist.material.uniforms.uFade.value=fade*.22;
    for(let i=0;i<mist;i++){const a=i*2.39996,r=3+hash(i+25)*14;d.position.set(Math.cos(a)*r,.25+hash(i+41)*1.5+Math.sin(t*.25+i)*.12,Math.sin(a)*r);d.quaternion.copy(context.camera.quaternion);const size=(.7+hash(i)*1.3)*ease((t-1.5)/2)*fade;d.scale.set(size,size*.6,size);d.updateMatrix();this.mist.mesh.setMatrixAt(i,d.matrix);}this.mist.mesh.instanceMatrix.needsUpdate=true;
    this.fragments.count=detail===1?24:detail===2?50:90;this.fragments.visible=age>=0;this.fragmentMaterial.uniforms.uTime.value=t;
    for(let i=0;i<this.fragments.count;i++){const a=i*2.39996,r=8+hash(i+19)*9;d.position.set(Math.cos(a)*r,.2+hash(i+29)*3+Math.max(0,age)*(.5+hash(i)),Math.sin(a)*r);d.rotation.set(i+t*.3,i*.7,t*.2);const size=(.04+hash(i)*.045)*fade;d.scale.set(size,size*(i%2===0?2:1),size);d.updateMatrix();this.fragments.setMatrixAt(i,d.matrix);this.fragmentData.setXYZW(i,fade,1,.6,hash(i+17));}this.fragments.instanceMatrix.needsUpdate=true;this.fragmentData.needsUpdate=true;
  }
}
