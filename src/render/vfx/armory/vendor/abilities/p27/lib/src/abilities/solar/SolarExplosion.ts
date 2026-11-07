// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import {InstancedMesh,Mesh,Object3D,SphereGeometry,Vector3} from 'three';
import type {AbilityCastContext} from '../Ability';
import {VisualOwner,SurfacePulse} from '../elemental/ElementalVisuals';
import {shardGeometry,crescentGeometry} from '../elemental/PackVisuals';
import {AstralParticles,brokenRingGeometry,ease,hash,clamp01} from '../elemental/AstralVisuals';
import {solarMaterial,novaWaveMaterial} from './SolarMaterials';
export class SolarExplosion{
  readonly particles:AstralParticles;
  readonly fragments:InstancedMesh;
  readonly blades:InstancedMesh;
  readonly rays:InstancedMesh;
  readonly flash:Mesh;
  readonly waves:Mesh[];
  readonly pulse:SurfacePulse;
  private readonly materials;
  private readonly fragmentMaterial;
  private readonly dummy=new Object3D();
  private readonly direction=new Vector3();
  private readonly axis=new Vector3(0,1,0);
  private readonly flashMaterial;
  constructor(owner:VisualOwner){
    this.particles=new AstralParticles(owner,650,'#fff1c4','solar');this.fragmentMaterial=owner.material(solarMaterial(3));this.fragments=new InstancedMesh(owner.geometry(shardGeometry()),this.fragmentMaterial,120);this.blades=new InstancedMesh(owner.geometry(crescentGeometry(30)),this.fragmentMaterial,18);this.rays=new InstancedMesh(this.fragments.geometry,this.fragmentMaterial,28);
    for(const m of [this.fragments,this.blades,this.rays]){m.frustumCulled=false;owner.root.add(m);}this.flashMaterial=owner.material(solarMaterial(0));this.flash=new Mesh(owner.geometry(new SphereGeometry(1,28,18)),this.flashMaterial);owner.root.add(this.flash);
    this.materials=[owner.material(solarMaterial(3)),owner.material(novaWaveMaterial()),owner.material(solarMaterial(2))];
    this.waves=[new Mesh(owner.geometry(brokenRingGeometry(1,120,.007)),this.materials[0]),new Mesh(owner.geometry(new SphereGeometry(1,64,36)),this.materials[1]),new Mesh(owner.geometry(brokenRingGeometry(1,72,.018)),this.materials[2])];for(const m of this.waves){m.frustumCulled=false;owner.root.add(m);}this.pulse=new SurfacePulse(owner,false);
  }
  update(t:number,particles:number,fragments:number,blades:number,rays:number,detail:number,fade:number,context:AbilityCastContext):void{
    const age=t-4.5,compression=ease((t-3.6)/.9);this.particles.update(t,particles,4.5,12,compression,fade,context);this.fragmentMaterial.uniforms.uTime.value=t;this.fragmentMaterial.uniforms.uFade.value=fade;this.fragmentMaterial.uniforms.uDetail.value=detail;
    this.fragments.count=fragments;this.fragments.visible=t>=1;const d=this.dummy;
    for(let i=0;i<fragments;i++){const s=hash(i+31),a=i*2.39996+Math.min(t,4.5)*.25;
      if(age<0){const r=(3+s*3)*(1-compression*.994);d.position.set(Math.cos(a)*r,12+Math.sin(a+i)*r*.5,Math.sin(a)*r);}else{const flight=Math.max(0,age-s*.12),r=Math.min(27,(4+s*14)*flight);d.position.set(Math.cos(a)*r,Math.max(.1,8+s*6-flight*(2+s*2)),Math.sin(a)*r);}
      d.rotation.set(i+t*.7,i*.3+t,t*.5);const size=(.04+s*.13)*fade*ease((t-1)/.8);d.scale.set(size*.6,size*(i%3===0?3:1.5),size*.45);d.updateMatrix();this.fragments.setMatrixAt(i,d.matrix);
    }this.fragments.instanceMatrix.needsUpdate=true;
    this.blades.count=blades;this.blades.visible=age>=0&&age<2.5;
    for(let i=0;i<blades;i++){const a=i*Math.PI*2/blades,r=2+Math.max(0,age)*(7+hash(i+19)*4);d.position.set(Math.cos(a)*r,6+Math.sin(a*3)*3+Math.max(0,age)*.5,Math.sin(a)*r);d.rotation.set(.5+i*.3,-a,i*.25+t*.1);const s=(.5+hash(i)*.5)*(1-ease(Math.max(0,age)/2.5))*fade;d.scale.set(s,s,s*.8);d.updateMatrix();this.blades.setMatrixAt(i,d.matrix);}this.blades.instanceMatrix.needsUpdate=true;
    this.rays.count=rays;this.rays.visible=age>=0&&age<1.3;
    for(let i=0;i<rays;i++){const a=i*2.39996,y=(hash(i+8)-.5)*.6;this.direction.set(Math.cos(a),y,Math.sin(a)).normalize();d.position.copy(this.direction).multiplyScalar(2+Math.max(0,age)*12);d.position.y+=12;d.quaternion.setFromUnitVectors(this.axis,this.direction);const intensity=(1-ease(Math.max(0,age)/1.3))*fade;d.scale.set(.04*intensity,(2+hash(i)*3)*intensity,.035*intensity);d.updateMatrix();this.rays.setMatrixAt(i,d.matrix);}this.rays.instanceMatrix.needsUpdate=true;
    this.waves.forEach((m,i)=>{const a=age-[0,.12,.48][i],duration=[1.4,2.25,2.8][i];m.visible=a>=0&&a<duration;const radius=[22,18,21][i]*ease(a/[.75,1.5,2.1][i]);m.position.y=i===1?10:.16+i*.12;if(i===1)m.scale.set(radius,radius*.45,radius);else{m.rotation.x=-Math.PI*.5;m.scale.setScalar(Math.max(.001,radius));}this.materials[i].uniforms.uTime.value=t;this.materials[i].uniforms.uFade.value=(1-ease(a/duration))*fade;});
    this.flash.visible=t>=4.36&&t<5;this.flash.position.y=12;const s=age<0?.18:.4+clamp01(age/.4)*5;this.flash.scale.setScalar(s);this.flashMaterial.uniforms.uTime.value=t;this.flashMaterial.uniforms.uFade.value=age<0?compression:Math.max(0,1-age/.5)*fade;
    this.pulse.update(Math.max(0,age),age>=0?(1-ease(age/3.5))*fade:0,4+Math.max(0,age)*10);
  }
}
