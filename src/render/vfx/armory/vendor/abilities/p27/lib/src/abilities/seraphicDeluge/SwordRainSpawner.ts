// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import {DynamicDrawUsage,InstancedMesh,Object3D,Vector3} from 'three';
import type {InstancedBufferAttribute} from 'three';
import {VisualOwner,ease,hash,clamp01} from '../elemental/ElementalVisuals';
import {swordRainGeometry} from './SwordRainGeometry';
import {swordRainMaterial} from './SwordRainMaterials';
import {rainSpawnTime,fallProgress} from './SeraphicDelugeTimeline';
/** Fixed cast-owned storage; each sword owns a birth, trajectory, landing point and embedded interval. */
export class SwordRainSpawner{
  static readonly stride=11;
  readonly state=new Float32Array(288*11);
  readonly hits=new Uint8Array(288);
  readonly meshes:InstancedMesh[]=[];
  readonly halos:InstancedMesh[]=[];
  readonly material;
  readonly haloMaterial;
  private readonly attributes:InstancedBufferAttribute[]=[];
  private readonly counters=new Uint8Array(4);
  private readonly dummy=new Object3D();
  private readonly direction=new Vector3();
  private readonly head=new Vector3();
  private readonly axis=new Vector3(0,1,0);
  constructor(owner:VisualOwner){
    this.material=owner.material(swordRainMaterial());this.haloMaterial=owner.material(swordRainMaterial(true));
    for(let v=0;v<4;v++){const g=owner.geometry(swordRainGeometry(v,72));this.attributes.push(g.getAttribute('aRain') as InstancedBufferAttribute);const core=new InstancedMesh(g,this.material,72),halo=new InstancedMesh(g,this.haloMaterial,72);for(const m of [core,halo]){m.frustumCulled=false;m.instanceMatrix.setUsage(DynamicDrawUsage);owner.root.add(m);}this.meshes.push(core);this.halos.push(halo);}
    for(let i=0;i<288;i++){const k=i*11,seed=hash(i+37),angle=i*2.39996,perimeter=i%3===0&&i%12!==0;let radius:number,x:number,z:number;
      if(perimeter){radius=13.5+seed*3.8;x=Math.cos(angle)*radius;z=Math.sin(angle)*radius;}
      else if(i%5===0){const c=i%7,a=c*Math.PI*2/7,r=6+hash(c+61)*4;radius=2+seed*3;x=Math.cos(a)*r+Math.cos(angle)*radius;z=Math.sin(a)*r+Math.sin(angle)*radius;}
      else if(i%5===1){radius=3+seed*10.5;const a=angle+radius*.32;x=Math.cos(a)*radius;z=Math.sin(a)*radius;}
      else{radius=Math.sqrt(seed)*12;x=Math.cos(angle)*radius;z=Math.sin(angle)*radius;}
      const startY=14+hash(i+83)*13,inward=i%4===0?3.5:hash(i+29)*1.3;
      this.state.set([x+Math.cos(angle)*inward,startY,z+Math.sin(angle)*inward,x,.13,z,rainSpawnTime(i),.66+hash(i+14)*.48,(i%12===0?.95:.47)+hash(i+23)*.3,(hash(i+41)-.5)*1.2,seed],k);
    }
  }
  sample(index:number,progress:number,out:Vector3):Vector3{const k=index*11,s=this.state,p=clamp01(progress),arc=Math.sin(p*Math.PI)*s[k+9];return out.set(s[k]+(s[k+3]-s[k])*p+arc,s[k+1]+(s[k+4]-s[k+1])*p,s[k+2]+(s[k+5]-s[k+2])*p+arc*.35);}
  update(t:number,count:number,embedded:number,detail:number,fade:number):void{
    this.counters.fill(0);this.material.uniforms.uTime.value=this.haloMaterial.uniforms.uTime.value=t;this.material.uniforms.uDetail.value=this.haloMaterial.uniforms.uDetail.value=detail;
    const d=this.dummy,s=this.state;
    for(let i=0;i<count;i++){const k=i*11,v=i%4,n=this.counters[v]++,age=t-s[k+6],p=fallProgress(age,s[k+7]),hitAge=age-s[k+7],formed=ease(age/.14),keep=Math.floor((i+1)*embedded/count)>Math.floor(i*embedded/count);let alpha=age>=0?fade:0;
      this.sample(i,p,this.head);this.direction.set(s[k+3]-s[k],s[k+4]-s[k+1],s[k+5]-s[k+2]).normalize();
      if(hitAge>=0){if(keep){alpha*=1-ease((hitAge-3.5)/1.4);this.head.y-=ease((t-8.1)/.9)*3;}else alpha*=1-ease(hitAge/.14);}
      d.quaternion.setFromUnitVectors(this.axis,this.direction);d.rotateY(s[k+10]*.6);d.position.copy(this.head).addScaledVector(this.direction,-3.4*s[k+8]);d.scale.set(s[k+8],s[k+8],s[k+8]);d.updateMatrix();this.meshes[v].setMatrixAt(n,d.matrix);this.halos[v].setMatrixAt(n,d.matrix);this.attributes[v].setXYZW(n,Math.max(0,alpha),formed,hitAge<0?.4+p*1.2:.35,s[k+10]);
    }
    for(let i=0;i<4;i++){this.meshes[i].count=this.halos[i].count=this.counters[i];this.halos[i].visible=detail>=2;this.meshes[i].instanceMatrix.needsUpdate=this.halos[i].instanceMatrix.needsUpdate=true;this.attributes[i].needsUpdate=true;}
  }
  newlyHit(index:number,t:number):boolean{if(this.hits[index])return false;const k=index*11;if(t<this.state[k+6]+this.state[k+7])return false;this.hits[index]=1;return true;}
}
