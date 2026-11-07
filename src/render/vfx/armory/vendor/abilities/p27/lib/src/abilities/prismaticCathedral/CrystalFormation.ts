// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import {DynamicDrawUsage,InstancedMesh,Object3D} from 'three';
import type {InstancedBufferAttribute} from 'three';
import {VisualOwner,hash,ease} from '../elemental/ElementalVisuals';
import {crystalSpikeGeometry} from './CrystalSpikeGeometry';
import {crystalMaterial} from './CrystalMaterials';
import {crystalGrowth} from './PrismaticCathedralTimeline';
export class CrystalFormation{
  readonly meshes:InstancedMesh[]=[];
  readonly state=new Float32Array(36*9);
  readonly material;
  private readonly attributes:InstancedBufferAttribute[]=[];
  private readonly dummy=new Object3D();
  private readonly counters=new Uint8Array(4);
  constructor(owner:VisualOwner){
    this.material=owner.material(crystalMaterial(0));
    for(let v=0;v<4;v++){const g=owner.geometry(crystalSpikeGeometry(v,9,v%2===0?6:8));this.attributes.push(g.getAttribute('aCrystal') as InstancedBufferAttribute);const m=new InstancedMesh(g,this.material,9);m.frustumCulled=false;m.instanceMatrix.setUsage(DynamicDrawUsage);this.meshes.push(m);owner.root.add(m);}
    for(let i=0;i<36;i++){const k=i*9,a=i*2.39996;
      if(i===0){this.state.set([0,0,0,17,2.1,0,0,2.5,.95],k);}
      else if(i<5){const r=1.8+hash(i)*.9;this.state.set([Math.cos(a)*r,0,Math.sin(a)*r,10+hash(i+8)*4,1+hash(i)*.45,Math.sin(a)*.16,Math.cos(a)*-.16,2.55+i*.06,.9],k);}
      else if(i<10){const r=6+hash(i+17)*2.2;this.state.set([Math.cos(a)*r,0,Math.sin(a)*r,4.2+hash(i+9)*3.2,.52+hash(i)*.35,Math.sin(a)*.25,Math.cos(a)*-.3,.8+(i-5)*.13,.68],k);}
      else{const inner=i%3===0,r=inner?3+hash(i)*1.2:5+hash(i+12)*3.2,h=inner?10+hash(i+41)*5:6+hash(i+14)*6;this.state.set([Math.cos(a)*r,0,Math.sin(a)*r,h,.65+hash(i+37)*.75,Math.sin(a)*(inner?.13:.27),Math.cos(a)*(inner?-.15:-.32),inner?2.55+hash(i)*.4:1.55+hash(i+29)*.65,.85],k);}
    }
  }
  update(t:number,count:number,detail:number,energy:number,fade:number,sink:number):void{
    this.counters.fill(0);const counters=this.counters,s=this.state,d=this.dummy;this.material.uniforms.uTime.value=t;this.material.uniforms.uDetail.value=detail;
    for(let i=0;i<count;i++){const k=i*9,v=i%4,n=counters[v]++,g=crystalGrowth(t,s[k+7],s[k+8]),outer=i>=5&&i%4===1,fracture=outer?ease((t-4.8)/.45)*.22:0;
      d.position.set(s[k],-.28*(1-g)-sink*(3+hash(i)*3),s[k+2]);d.rotation.set(s[k+5],i*.47,s[k+6]);const height=s[k+3]*(i===0?(detail===1?.83:detail===2?.94:1):1);d.scale.set(s[k+4],height,s[k+4]*(.72+hash(i+5)*.25));d.updateMatrix();this.meshes[v].setMatrixAt(n,d.matrix);this.attributes[v].setXYZW(n,g*(1-fracture),fade*ease(g/.1),energy*(i<5?1.1:.65),hash(i+91));
    }
    this.meshes.forEach((m,i)=>{m.count=counters[i];m.instanceMatrix.needsUpdate=true;this.attributes[i].needsUpdate=true;});
  }
}
