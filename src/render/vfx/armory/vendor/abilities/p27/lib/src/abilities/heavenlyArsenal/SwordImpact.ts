// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import {InstancedMesh,Mesh,Object3D,SphereGeometry} from 'three';
import type {InstancedBufferAttribute} from 'three';
import {VisualOwner,SurfacePulse,ease,hash} from '../elemental/ElementalVisuals';
import {brokenRingGeometry} from '../elemental/AstralVisuals';
import {novaWaveMaterial,solarMaterial} from '../solar/SolarMaterials';
import {celestialSwordGeometry} from './CelestialSwordGeometry';
import {celestialSwordMaterial} from './CelestialSwordMaterial';
import type {SwordFormation} from './SwordFormation';
export class SwordImpact{
  readonly small:InstancedMesh;
  readonly shell:Mesh;
  readonly flash:Mesh;
  readonly rings:Mesh[]=[];
  readonly rays:InstancedMesh;
  readonly pulse:SurfacePulse;
  private readonly smallLife:InstancedBufferAttribute;
  private readonly rayLife:InstancedBufferAttribute;
  private readonly smallMaterial;
  private readonly waveMaterial;
  private readonly flashMaterial;
  private readonly rayMaterial;
  private readonly dummy=new Object3D();
  constructor(owner:VisualOwner){
    const g=owner.geometry(celestialSwordGeometry(84,false));this.smallLife=g.getAttribute('aLife') as InstancedBufferAttribute;this.smallMaterial=owner.material(celestialSwordMaterial());this.small=new InstancedMesh(g,this.smallMaterial,84);this.small.frustumCulled=false;owner.root.add(this.small);
    this.waveMaterial=owner.material(novaWaveMaterial());this.shell=new Mesh(owner.geometry(new SphereGeometry(1,64,28,0,Math.PI*2,0,Math.PI*.55)),this.waveMaterial);this.shell.frustumCulled=false;owner.root.add(this.shell);
    this.flashMaterial=owner.material(solarMaterial(0));this.flash=new Mesh(owner.geometry(new SphereGeometry(1,24,16)),this.flashMaterial);owner.root.add(this.flash);
    const ring=owner.geometry(brokenRingGeometry(1,90,.012));for(let i=0;i<3;i++){const m=new Mesh(ring,this.waveMaterial);m.rotation.x=-Math.PI*.5;m.position.y=.18+i*.15;this.rings.push(m);owner.root.add(m);}
    const rays=owner.geometry(celestialSwordGeometry(24,false));this.rayLife=rays.getAttribute('aLife') as InstancedBufferAttribute;this.rayMaterial=owner.material(celestialSwordMaterial());this.rays=new InstancedMesh(rays,this.rayMaterial,24);this.rays.frustumCulled=false;owner.root.add(this.rays);this.pulse=new SurfacePulse(owner,false);
  }
  update(t:number,formation:SwordFormation,count:number,residual:number,detail:number,fade:number):void{
    const d=this.dummy,s=formation.state;this.small.count=count;this.smallMaterial.uniforms.uTime.value=t;this.smallMaterial.uniforms.uDetail.value=detail;
    for(let i=0;i<count;i++){const k=i*14,age=t-s[k+7]-s[k+8],alpha=age>=0&&i<count-residual?(1-ease(age/.45))*fade:0;d.position.set(s[k+3],.22,s[k+5]);d.rotation.set(0,hash(i)*Math.PI,0);const size=(.4+hash(i+8)*.3);d.scale.set(size*(1+Math.max(0,age)*4),size*.65,size*(1+Math.max(0,age)*4));d.updateMatrix();this.small.setMatrixAt(i,d.matrix);this.smallLife.setXYZW(i,alpha,1,1,1.3);}this.small.instanceMatrix.needsUpdate=true;this.smallLife.needsUpdate=true;
    const age=t-5.25,radius=17*ease(age/1.3);this.shell.visible=age>=0&&age<2.3;this.shell.position.y=.18;this.shell.scale.set(Math.max(.001,radius),Math.max(.001,radius*.32),Math.max(.001,radius));this.waveMaterial.uniforms.uTime.value=t;this.waveMaterial.uniforms.uFade.value=(1-ease(Math.max(0,age)/2.3))*fade;
    this.rings.forEach((m,i)=>{const a=age-i*.16;m.visible=i<detail&&a>=0&&a<2.1;m.scale.setScalar(Math.max(.001,(14+i*2)*ease(a/(.85+i*.22))));});
    this.flash.visible=age>=0&&age<.7;this.flash.position.y=.75;this.flash.scale.set(1+Math.max(0,age)*11,1+Math.max(0,age)*6,1+Math.max(0,age)*11);this.flashMaterial.uniforms.uTime.value=t;this.flashMaterial.uniforms.uFade.value=Math.max(0,1-age/.7)*fade;
    this.rays.count=detail===1?8:detail===2?16:24;this.rays.visible=age>=0&&age<1.5;this.rayMaterial.uniforms.uTime.value=t;
    for(let i=0;i<this.rays.count;i++){const a=i*2.39996,up=(hash(i+10)-.3)*.8,r=2+Math.max(0,age)*8;d.position.set(Math.cos(a)*r,1.6+Math.sin(i)*Math.max(0,age)*2,Math.sin(a)*r);d.rotation.set(Math.PI*.5+up,0,-a);d.scale.set(.12,(.7+hash(i)*.8)*(1-ease(Math.max(0,age)/1.5)),.12);d.updateMatrix();this.rays.setMatrixAt(i,d.matrix);this.rayLife.setXYZW(i,fade,1,1,1.4);}this.rays.instanceMatrix.needsUpdate=true;this.rayLife.needsUpdate=true;
    this.pulse.update(Math.max(0,age),age>=0?(1-ease(age/2.75))*fade:0,4+Math.max(0,age)*12);
  }
}
