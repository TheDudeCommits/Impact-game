// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import {InstancedBufferAttribute,InstancedMesh,Object3D,PlaneGeometry,Vector3,DynamicDrawUsage} from 'three';
import type {VisualOwner} from '../elemental/ElementalVisuals';
import {ease} from '../elemental/ElementalVisuals';
import {fallProgress} from './SeraphicDelugeTimeline';
import {rainTrailMaterial} from './SwordRainMaterials';
import type {SwordRainSpawner} from './SwordRainSpawner';
import type {RingCollapse} from './RingCollapse';
/** A fixed 600-slot trail pool, recycled each frame; includes the final perimeter wave. */
export class SwordRainTrails{
  readonly mesh:InstancedMesh;
  private readonly material;
  private readonly attribute:InstancedBufferAttribute;
  private readonly dummy=new Object3D();
  private readonly a=new Vector3();
  private readonly b=new Vector3();
  private readonly direction=new Vector3();
  private readonly up=new Vector3(0,1,0);
  private cursor=0;
  constructor(owner:VisualOwner){
    const g=owner.geometry(new PlaneGeometry(1,1));this.attribute=new InstancedBufferAttribute(new Float32Array(600),1).setUsage(DynamicDrawUsage);g.setAttribute('aTail',this.attribute);this.material=owner.material(rainTrailMaterial());this.mesh=new InstancedMesh(g,this.material,600);this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);this.mesh.frustumCulled=false;owner.root.add(this.mesh);
  }
  private streak(width:number,layers:number,alpha:number):void{
    this.direction.subVectors(this.b,this.a);const length=this.direction.length();if(length<.025)return;this.direction.divideScalar(length);const d=this.dummy;
    for(let j=0;j<layers&&this.cursor<600;j++){d.position.copy(this.a).lerp(this.b,.5);d.quaternion.setFromUnitVectors(this.up,this.direction);d.rotateY(j*Math.PI/layers);d.scale.set(width*(j===0?1:1.5),length,1);d.updateMatrix();this.mesh.setMatrixAt(this.cursor,d.matrix);this.attribute.setX(this.cursor++,alpha);}
  }
  update(t:number,rain:SwordRainSpawner,count:number,ring:RingCollapse,finalCount:number,layers:number,fade:number):void{
    this.cursor=0;this.material.uniforms.uTime.value=t;
    for(let i=0;i<count;i++){const k=i*11,s=rain.state,age=t-s[k+6],duration=s[k+7];if(age<0||age>duration+.2)continue;rain.sample(i,fallProgress(age,duration),this.b);rain.sample(i,fallProgress(age-.19,duration),this.a);this.streak(.24*s[k+8],layers,fade*(1-ease((age-duration)/.2)));}
    for(let i=0;i<finalCount;i++){const age=t-ring.launch(i);if(age<0||age>.8)continue;ring.sample(i,finalCount,fallProgress(age,.55),this.b);ring.sample(i,finalCount,fallProgress(age-.23,.55),this.a);this.streak(.65,layers,fade*(1-ease((age-.55)/.25)));}
    this.mesh.count=this.cursor;this.mesh.visible=this.cursor>0;this.mesh.instanceMatrix.needsUpdate=true;this.attribute.needsUpdate=true;
  }
}
