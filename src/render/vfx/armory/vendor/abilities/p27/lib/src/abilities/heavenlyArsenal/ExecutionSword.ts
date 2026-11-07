// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import {Group,InstancedMesh,Mesh,PlaneGeometry,Vector3} from 'three';
import type {ShaderMaterial,InstancedBufferAttribute} from 'three';
import {VisualOwner,clamp01,ease} from '../elemental/ElementalVisuals';
import {brokenRingGeometry} from '../elemental/AstralVisuals';
import {packMaterial} from '../elemental/PackVisuals';
import {celestialSwordGeometry} from './CelestialSwordGeometry';
import {celestialSwordMaterial} from './CelestialSwordMaterial';
export class ExecutionSword{
  readonly root=new Group();
  readonly sword:InstancedMesh;
  readonly halo:InstancedMesh;
  readonly trail:InstancedMesh;
  readonly rings:Mesh[]=[];
  readonly tip=new Vector3();
  private readonly life:InstancedBufferAttribute;
  private readonly material;
  private readonly haloMaterial;
  private readonly ringMaterial;
  private readonly trailRoot=new Group();
  constructor(owner:VisualOwner,trailMaterial:ShaderMaterial){
    const geometry=owner.geometry(celestialSwordGeometry(1));this.life=geometry.getAttribute('aLife') as InstancedBufferAttribute;this.material=owner.material(celestialSwordMaterial());this.haloMaterial=owner.material(celestialSwordMaterial(true));this.sword=new InstancedMesh(geometry,this.material,1);this.halo=new InstancedMesh(geometry,this.haloMaterial,1);
    const transform=new Group();transform.rotation.z=Math.PI;transform.scale.set(1.7,2.55,1.7);transform.updateMatrix();for(const m of [this.sword,this.halo]){m.setMatrixAt(0,transform.matrix);m.frustumCulled=false;this.root.add(m);}owner.root.add(this.root);
    this.ringMaterial=owner.material(packMaterial('#f9e6b3',true));const ring=owner.geometry(brokenRingGeometry(3.4,64,.018));for(let i=0;i<3;i++){const m=new Mesh(ring,this.ringMaterial);m.rotation.set(Math.PI*.5,i*.7,i*.5);m.position.y=3+i*1.2;m.scale.setScalar(1+i*.17);this.rings.push(m);this.root.add(m);}
    this.trail=new InstancedMesh(owner.geometry(new PlaneGeometry(1,1)),trailMaterial,2);this.trail.frustumCulled=false;owner.root.add(this.trail);
  }
  update(t:number,detail:number,ringCount:number,fade:number):void{
    const growth=ease((t-3.8)/.85),guard=ease((t-4.05)/.5),flight=clamp01((t-4.7)/.55),progress=Math.pow(flight,2.4),after=t-5.25;
    this.root.position.y=28+(9.82-28)*progress;this.root.visible=t>=3.8&&t<6.15;this.tip.set(0,this.root.position.y-3.8*2.55*growth,0);
    this.life.setXYZW(0,(1-ease((t-5.3)/.85))*fade,growth,guard,1+ease((t-4.5)/.2)*1.5);this.life.needsUpdate=true;
    for(const m of [this.material,this.haloMaterial]){m.uniforms.uTime.value=t;m.uniforms.uDetail.value=detail;}this.halo.visible=detail>=2;
    this.ringMaterial.uniforms.uTime.value=t;this.ringMaterial.uniforms.uFade.value=guard*(1-ease((t-4.7)/.6))*fade;
    this.rings.forEach((m,i)=>{m.visible=i<ringCount;m.rotation.z=i*.5+t*(.2+i*.1);});
    this.trail.visible=t>=4.7&&t<5.65;this.trail.count=detail===1?1:2;const length=Math.max(.001,Math.min(24,(28-this.root.position.y)+Math.max(0,after)*8));
    for(let i=0;i<this.trail.count;i++){this.trailRoot.position.set(0,this.tip.y+length*.5,0);this.trailRoot.rotation.set(0,i*Math.PI*.5,Math.PI);this.trailRoot.scale.set((i===0?.85:1.5)*(1-ease(after/.4)),length,1);this.trailRoot.updateMatrix();this.trail.setMatrixAt(i,this.trailRoot.matrix);}this.trail.instanceMatrix.needsUpdate=true;
  }
}
