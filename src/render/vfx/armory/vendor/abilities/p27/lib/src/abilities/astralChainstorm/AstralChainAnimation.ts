// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { InstancedMesh, Matrix4, Object3D, Quaternion, Vector3, InstancedBufferAttribute, DynamicDrawUsage } from 'three';
import type { BufferGeometry, Material } from 'three';
import { ease, clamp01, hash } from '../elemental/ElementalVisuals';
import type { AstralChainstormConfig, ChainQuality } from './AstralChainstormConfig';

const Y=new Vector3(0,1,0);
/** Fixed sampled curves and arc-length lookup. Links retain true dimensions instead of stretching. */
export class AstralChainAnimation {
  readonly mesh:InstancedMesh;
  private readonly data:InstancedBufferAttribute;
  private readonly samples=Array.from({length:5},()=>Array.from({length:129},()=>new Vector3()));
  private readonly lengths=Array.from({length:5},()=>new Float32Array(129));
  private readonly dummy=new Object3D();
  private readonly tangent=new Vector3();private readonly normal=new Vector3();private readonly binormal=new Vector3();
  private readonly flight=new Vector3();private readonly cage=new Vector3();private readonly radial=new Vector3();
  private readonly side=new Vector3();private readonly frame=new Matrix4();private readonly roll=new Quaternion();
  private readonly normals=Array.from({length:5},()=>new Vector3(1,0,0));
  constructor(private readonly geometries:readonly BufferGeometry[],material:Material){
    this.data=new InstancedBufferAttribute(new Float32Array(210*3),3).setUsage(DynamicDrawUsage);
    geometries.forEach(g=>g.setAttribute('aChainData',this.data));
    this.mesh=new InstancedMesh(geometries[0],material,210);this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);this.mesh.count=0;this.mesh.frustumCulled=false;
    this.mesh.name='Astral chains · arc-length interlocking links';
  }
  reset():void{this.mesh.count=0;this.normals.forEach(n=>n.set(1,0,0));}
  update(age:number,origin:Vector3,target:Vector3,direction:Vector3,flightProgress:number,wrap:number,constrict:number,slam:number,fade:number,q:ChainQuality,c:Readonly<AstralChainstormConfig>,surface=target.y):void {
    this.mesh.geometry=this.geometries[q.tier];this.mesh.visible=fade>0;
    this.side.set(direction.z,0,-direction.x).normalize();if(this.side.lengthSq()<.001)this.side.set(1,0,0);
    const distance=origin.distanceTo(target),step=c.chainSpacing*c.linkLength/1.12;
    let total=0;
    for(let chain=0;chain<q.chains;chain++) {
      const points=this.samples[chain],arc=this.lengths[chain],angle=chain/q.chains*Math.PI*2;
      const assembly=clamp01(age/.75),flying=age>=.75;
      const reached=distance*flightProgress,tail=Math.max(0,reached-q.links*step*.96);
      for(let j=0;j<129;j++) {
        const s=j/128;
        if(!flying){
          const a=angle+s*Math.PI*3.2-age*2;
          points[j].copy(origin).addScaledVector(this.side,Math.cos(a)*(.16+s*.12));
          points[j].y+=Math.sin(a)*(.15+s*.12)+s*.2;
          points[j].addScaledVector(direction,s*assembly*1.2);
        }else{
          const d=tail+(reached-tail)*s;
          this.flight.copy(origin).addScaledVector(direction,d);
          const arch=Math.sin(s*Math.PI),whip=c.whipAmplitude*arch*Math.sin(s*6.283-age*c.whipFrequency+angle);
          this.flight.addScaledVector(this.side,Math.cos(angle)*1.55*arch+whip);
          this.flight.y+=arch*(1.2+Math.sin(angle)*.85+Math.sin(age*2+angle)*.15);
          const a=angle+s*Math.PI*(2.6+constrict*1.8)+age*c.wrapSpeed;
          const radius=c.wrapRadius*(1-constrict*.49)*(1-s*.28);
          this.radial.copy(this.side).multiplyScalar(Math.cos(a)*radius).addScaledVector(direction,Math.sin(a)*radius);
          this.cage.copy(target).add(this.radial);this.cage.y=surface+.35+(1-s)*5.7*(1-constrict*.35);
          this.cage.y=surface+.02+(this.cage.y-surface-.02)*(1-ease(slam));
          points[j].copy(this.flight).lerp(this.cage,ease(wrap));
        }
        arc[j]=j===0?0:arc[j-1]+points[j].distanceTo(points[j-1]);
      }
      const length=arc[128],count=Math.min(q.links,Math.max(0,Math.floor(length*(flying?1:assembly)/step)+1));
      let cursor=1;this.normal.copy(this.normals[chain]);
      for(let i=0;i<count;i++) {
        const along=flying?Math.max(0,length-(count-1)*step)+i*step:i*step;
        while(cursor<128&&arc[cursor]<along)cursor++;
        const f=clamp01((along-arc[cursor-1])/Math.max(.00001,arc[cursor]-arc[cursor-1]));
        this.dummy.position.copy(points[cursor-1]).lerp(points[cursor],f);
        this.tangent.subVectors(points[Math.min(128,cursor+1)],points[Math.max(0,cursor-2)]).normalize();
        if(this.tangent.lengthSq()<.1)this.tangent.copy(direction);
        // Parallel transported frame avoids sudden roll at vertical and reversing tangents.
        this.normal.addScaledVector(this.tangent,-this.normal.dot(this.tangent));
        if(this.normal.lengthSq()<.001){this.normal.copy(this.side).addScaledVector(this.tangent,-this.side.dot(this.tangent));if(this.normal.lengthSq()<.001)this.normal.set(0,0,1);}
        this.normal.normalize();this.binormal.crossVectors(this.normal,this.tangent).normalize();
        if(i===0)this.normals[chain].copy(this.normal);
        this.frame.makeBasis(this.normal,this.tangent,this.binormal);this.dummy.quaternion.setFromRotationMatrix(this.frame);
        const linkIdentity=flying?count-1-i:i;
        this.roll.setFromAxisAngle(Y,linkIdentity%2*Math.PI*.5+chain*.1);this.dummy.quaternion.multiply(this.roll);
        this.dummy.scale.setScalar(flying?1:.28+assembly*.42);this.dummy.updateMatrix();this.mesh.setMatrixAt(total,this.dummy.matrix);
        this.data.setXYZ(total,i/Math.max(1,count-1),chain,hash(linkIdentity+chain*43));total++;
      }
    }
    this.mesh.count=total;this.mesh.instanceMatrix.needsUpdate=true;this.data.needsUpdate=true;
  }
  dispose():void{this.mesh.removeFromParent();this.mesh.dispose();this.geometries.forEach(g=>g.dispose());}
}
