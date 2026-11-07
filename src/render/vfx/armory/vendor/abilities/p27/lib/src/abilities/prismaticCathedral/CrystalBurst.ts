// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import {AdditiveBlending,InstancedMesh,Mesh,MeshBasicMaterial,Object3D,SphereGeometry,Vector3} from 'three';
import type {InstancedBufferAttribute} from 'three';
import type {AbilityCastContext} from '../Ability';
import {VisualOwner,SurfacePulse,ease,hash} from '../elemental/ElementalVisuals';
import {AstralParticles,brokenRingGeometry} from '../elemental/AstralVisuals';
import {crystalSpikeGeometry} from './CrystalSpikeGeometry';
import {crystalMaterial,prismWaveMaterial,prismPalette} from './CrystalMaterials';
export class CrystalBurst{
  readonly shell:Mesh;
  readonly arcs:Mesh[]=[];
  readonly rays:InstancedMesh;
  readonly flash:Mesh;
  readonly particles:AstralParticles;
  readonly mist:AstralParticles;
  readonly pulse:SurfacePulse;
  private readonly material;
  private readonly rayMaterial;
  private readonly rayData:InstancedBufferAttribute;
  private readonly flashMaterial;
  private readonly geometries:SphereGeometry[];
  private readonly dummy=new Object3D();
  private readonly direction=new Vector3();
  private readonly axis=new Vector3(0,1,0);
  constructor(owner:VisualOwner){
    this.material=owner.material(prismWaveMaterial());this.geometries=[24,48,72].map(n=>owner.geometry(new SphereGeometry(1,n,Math.round(n*.45),0,Math.PI*2,0,Math.PI*.59)));this.shell=new Mesh(this.geometries[1],this.material);this.shell.frustumCulled=false;owner.root.add(this.shell);
    const ring=owner.geometry(brokenRingGeometry(1,84,.013));for(let i=0;i<3;i++){const m=new Mesh(ring,this.material);m.rotation.set(-Math.PI*.5,i*.3,i*.7);this.arcs.push(m);owner.root.add(m);}
    const g=owner.geometry(crystalSpikeGeometry(2,24));this.rayData=g.getAttribute('aCrystal') as InstancedBufferAttribute;this.rayMaterial=owner.material(crystalMaterial(2));this.rays=new InstancedMesh(g,this.rayMaterial,24);this.rays.frustumCulled=false;owner.root.add(this.rays);
    this.flashMaterial=owner.material(new MeshBasicMaterial({color:'#effcff',transparent:true,opacity:1,depthWrite:false,blending:AdditiveBlending}));this.flash=new Mesh(owner.geometry(new SphereGeometry(1,24,16)),this.flashMaterial);owner.root.add(this.flash);
    this.particles=new AstralParticles(owner,360,'#ddecf4','solar');this.mist=new AstralParticles(owner,70,'#a3bec9','solar',true);
    // Instance-local shimmer extension; existing particle utilities and other spells remain untouched.
    this.particles.material.vertexShader=this.particles.material.vertexShader.replace('varying vec2 vUv;', 'varying vec2 vUv;varying float vPrism;').replace('void main(){', 'void main(){vPrism=fract(instanceMatrix[3].x*.17+instanceMatrix[3].z*.13);');
    this.particles.material.fragmentShader=this.particles.material.fragmentShader.replace('varying vec2 vUv;', `varying vec2 vUv;varying float vPrism;${prismPalette}`).replace('vec4(uColor,a*uFade)', 'vec4(mix(uColor,prism(vPrism),.28),a*uFade)');
    this.pulse=new SurfacePulse(owner,true);
  }
  update(t:number,rays:number,particles:number,mist:number,detail:number,energy:number,fade:number,context:AbilityCastContext):void{
    const age=t-4.8,power=age>=0?(1-ease(age/2.5))*fade:0,radius=17*ease(age/1.6);this.material.uniforms.uTime.value=t;this.material.uniforms.uFade.value=power;this.material.uniforms.uDetail.value=detail;this.shell.geometry=this.geometries[detail-1];this.shell.visible=age>=0&&age<2.5;this.shell.position.y=.2;this.shell.scale.set(Math.max(.001,radius),Math.max(.001,radius*.28),Math.max(.001,radius));
    this.arcs.forEach((m,i)=>{const a=age-i*.17;m.visible=i<detail&&a>=0&&a<2.4;m.position.y=.18+i*.16;m.scale.setScalar(Math.max(.001,(14+i*2)*ease(a/(1+i*.25))));});
    this.rays.count=rays;this.rays.visible=age>=0&&age<1.6;this.rayMaterial.uniforms.uTime.value=t;this.rayMaterial.uniforms.uDetail.value=detail;const d=this.dummy;
    for(let i=0;i<rays;i++){const a=i*2.39996;this.direction.set(Math.cos(a),.06+hash(i+28)*.46,Math.sin(a)).normalize();d.position.copy(this.direction).multiplyScalar(1+Math.max(0,age)*4);d.position.y+=3;d.quaternion.setFromUnitVectors(this.axis,this.direction);const pulse=1-ease(Math.max(0,age)/1.6);d.scale.set(.025*pulse,(4+hash(i)*7)*pulse,.025*pulse);d.updateMatrix();this.rays.setMatrixAt(i,d.matrix);this.rayData.setXYZW(i,1,power,.8,hash(i+42));}this.rays.instanceMatrix.needsUpdate=true;this.rayData.needsUpdate=true;
    this.flash.visible=age>=0&&age<.55;this.flash.position.y=4.5;const size=.4+Math.max(0,age)*9;this.flash.scale.set(size,size*.65,size);this.flashMaterial.opacity=Math.max(0,1-age/.55)*fade;
    this.particles.update(t,particles,4.8,6,energy*.4,fade*ease((t-.3)/.5),context);this.mist.update(t,mist,4.8,3,0,fade*(age<0?.2:.8),context);this.pulse.update(Math.max(0,age),power,4+Math.max(0,age)*11);
  }
}
