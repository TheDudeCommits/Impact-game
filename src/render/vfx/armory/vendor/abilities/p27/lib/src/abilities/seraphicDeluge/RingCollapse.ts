// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import {InstancedMesh,Object3D,Vector3} from 'three';
import type {InstancedBufferAttribute} from 'three';
import {VisualOwner,ease,hash} from '../elemental/ElementalVisuals';
import {swordRainGeometry} from './SwordRainGeometry';
import {swordRainMaterial} from './SwordRainMaterials';
import {fallProgress} from './SeraphicDelugeTimeline';
export class RingCollapse{
  readonly mesh:InstancedMesh;
  readonly halo:InstancedMesh;
  readonly landing=new Float32Array(12*3);
  readonly hits=new Uint8Array(12);
  private readonly attribute:InstancedBufferAttribute;
  private readonly material;
  private readonly haloMaterial;
  private readonly dummy=new Object3D();
  private readonly direction=new Vector3();
  private readonly head=new Vector3();
  private readonly axis=new Vector3(0,1,0);
  constructor(owner:VisualOwner){
    const g=owner.geometry(swordRainGeometry(3,12));this.attribute=g.getAttribute('aRain') as InstancedBufferAttribute;this.material=owner.material(swordRainMaterial());this.haloMaterial=owner.material(swordRainMaterial(true));this.mesh=new InstancedMesh(g,this.material,12);this.halo=new InstancedMesh(g,this.haloMaterial,12);for(const m of [this.mesh,this.halo]){m.frustumCulled=false;owner.root.add(m);}
  }
  launch(index:number):number{return 6.65+(index%3)*.012;}
  impact(index:number):number{return this.launch(index)+.55;}
  sample(index:number,count:number,progress:number,out:Vector3):Vector3{
    const a=index/count*Math.PI*2+.16,r=17.2,p=progress;
    return out.set(Math.cos(a)*(r+1.2*(1-p)),.13+(22+hash(index+67)*2)*(1-p),Math.sin(a)*(r+1.2*(1-p)));
  }
  update(t:number,count:number,detail:number,fade:number):void{
    this.mesh.count=this.halo.count=count;this.halo.visible=detail>=2;this.material.uniforms.uTime.value=this.haloMaterial.uniforms.uTime.value=t;this.material.uniforms.uDetail.value=this.haloMaterial.uniforms.uDetail.value=detail;
    const d=this.dummy;
    for(let i=0;i<count;i++){const p=fallProgress(t-this.launch(i),.55),growth=ease((t-5.8-i*.006)/.48);this.sample(i,count,1,this.head);this.landing[i*3]=this.head.x;this.landing[i*3+1]=this.head.y;this.landing[i*3+2]=this.head.z;this.sample(i,count,p,this.head);
      this.direction.set(-Math.cos(i/count*Math.PI*2+.16)*1.2,-22-hash(i+67)*2,-Math.sin(i/count*Math.PI*2+.16)*1.2).normalize();const scale=1.8+hash(i+39)*.4;d.quaternion.setFromUnitVectors(this.axis,this.direction);d.position.copy(this.head).addScaledVector(this.direction,-3.4*scale);d.position.y-=ease((t-8.2)/.8)*5;d.scale.set(scale,scale,scale);d.updateMatrix();this.mesh.setMatrixAt(i,d.matrix);this.halo.setMatrixAt(i,d.matrix);this.attribute.setXYZW(i,growth*fade,growth,.7+p*1.5,hash(i+83));
    }
    this.mesh.instanceMatrix.needsUpdate=this.halo.instanceMatrix.needsUpdate=true;this.attribute.needsUpdate=true;
  }
  newlyHit(index:number,t:number):boolean{if(this.hits[index]||t<this.impact(index))return false;this.hits[index]=1;return true;}
}
