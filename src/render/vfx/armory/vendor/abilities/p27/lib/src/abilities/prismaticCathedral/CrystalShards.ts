// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import {InstancedMesh,Object3D} from 'three';
import type {InstancedBufferAttribute} from 'three';
import {VisualOwner,hash,ease} from '../elemental/ElementalVisuals';
import {crystalSpikeGeometry} from './CrystalSpikeGeometry';
import {crystalMaterial} from './CrystalMaterials';
export class CrystalShards{
  readonly meshes:InstancedMesh[]=[];
  readonly material;
  private readonly attributes:InstancedBufferAttribute[]=[];
  private readonly counters=new Uint8Array(3);
  private readonly dummy=new Object3D();
  constructor(owner:VisualOwner){
    this.material=owner.material(crystalMaterial(1));
    for(let i=0;i<3;i++){const g=owner.geometry(crystalSpikeGeometry(i+1,40,i===2?8:6)),p=g.getAttribute('position');for(let j=0;j<p.count;j++)p.setY(j,p.getY(j)-.5);g.computeBoundingSphere();this.attributes.push(g.getAttribute('aCrystal') as InstancedBufferAttribute);const m=new InstancedMesh(g,this.material,40);m.frustumCulled=false;this.meshes.push(m);owner.root.add(m);}
  }
  update(t:number,count:number,detail:number,energy:number,fade:number):void{
    this.counters.fill(0);this.material.uniforms.uTime.value=t;this.material.uniforms.uDetail.value=detail;const d=this.dummy,age=t-4.8,align=ease((t-3.6)/1.1);
    for(let i=0;i<count;i++){const v=i%3,n=this.counters[v]++,s=hash(i+27),a=i*2.39996+Math.min(t,4.8)*(.24+s*.3),r=(3+s*5)*(1-align*.3),y=2+hash(i+81)*9+align*(1+s*2);
      if(age<0||i%3===0){const orbit=a+Math.max(0,age)*.12;d.position.set(Math.cos(orbit)*r,y+Math.sin(t+i)*.2-ease((t-6)/2)*4,Math.sin(orbit)*r);}
      else{const flight=Math.max(0,age-s*.12),radius=r+(4+s*10)*flight;d.position.set(Math.cos(a)*radius,Math.max(.08,3+hash(i+9)*4+(5+s*6)*flight-4.8*flight*flight)-ease((t-7.2)/.8),Math.sin(a)*radius);}
      d.rotation.set(i+t*(.3+s*.7),i*1.7+t*.4,i*.5+t*.2);const appear=ease((t-1.1-s*.9)/.5),size=(.14+s*.32)*appear*fade;d.scale.set(size*(v===0?.42:1),size*(v===0?2.7:v===1?1.3:.65),size*.7);d.updateMatrix();this.meshes[v].setMatrixAt(n,d.matrix);this.attributes[v].setXYZW(n,1,fade,.2+energy*.9,hash(i+14));
    }
    this.meshes.forEach((m,i)=>{m.count=this.counters[i];m.instanceMatrix.needsUpdate=true;this.attributes[i].needsUpdate=true;});
  }
}
