// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import {InstancedMesh,Object3D,Vector3,DynamicDrawUsage} from 'three';
import type {InstancedBufferAttribute} from 'three';
import type {AbilityCastContext} from '../Ability';
import {VisualOwner,ease,clamp01,hash} from '../elemental/ElementalVisuals';
import {celestialSwordGeometry} from './CelestialSwordGeometry';
import {celestialSwordMaterial} from './CelestialSwordMaterial';
import {swordLaunchTime} from './HeavenlyArsenalTimeline';
import {HEAVENLY_ARSENAL} from './HeavenlyArsenalConfig';
/** Cast-owned deterministic per-sword state. All coordinates are local to the captured target. */
export class SwordFormation{
  static readonly stride=14;
  readonly state=new Float32Array(HEAVENLY_ARSENAL.maximumSwords*SwordFormation.stride);
  readonly mesh:InstancedMesh;
  readonly halo:InstancedMesh;
  readonly material;
  readonly haloMaterial;
  readonly life:InstancedBufferAttribute;
  readonly variant:InstancedBufferAttribute;
  readonly impactEvents=new Uint8Array(HEAVENLY_ARSENAL.maximumSwords);
  private readonly dummy=new Object3D();
  private readonly start=new Vector3();
  private readonly end=new Vector3();
  private readonly tangent=new Vector3();
  private readonly up=new Vector3(0,1,0);
  constructor(owner:VisualOwner,context:AbilityCastContext,target:Vector3){
    const forward=new Vector3().subVectors(target,context.player.position);forward.y=0;if(forward.lengthSq()<.001)forward.copy(context.playerForward).setY(0);if(forward.lengthSq()<.001)forward.set(0,0,-1);forward.normalize();const right=new Vector3(forward.z,0,-forward.x);
    const g=owner.geometry(celestialSwordGeometry(84));this.life=g.getAttribute('aLife') as InstancedBufferAttribute;this.variant=g.getAttribute('aVariant') as InstancedBufferAttribute;this.life.setUsage(DynamicDrawUsage);this.material=owner.material(celestialSwordMaterial());this.haloMaterial=owner.material(celestialSwordMaterial(true));this.mesh=new InstancedMesh(g,this.material,84);this.halo=new InstancedMesh(g,this.haloMaterial,84);
    for(const m of [this.mesh,this.halo]){m.frustumCulled=false;m.instanceMatrix.setUsage(DynamicDrawUsage);owner.root.add(m);}
    for(let i=0;i<84;i++){const k=i*14,row=i%4,col=(Math.floor(i/4)*3)%7,band=Math.floor(i/28),x=(col-3)*3.8+(row%2)*1.3+(hash(i+41)-.5)*.8,z=4+band*4+hash(i+57)*2,y=8+row*3.8+hash(i+19)*1.4;
      this.state[k]=right.x*x+forward.x*z;this.state[k+1]=y;this.state[k+2]=right.z*x+forward.z*z;
      const angle=i*2.39996,r=Math.sqrt(hash(i+13))*4.7;this.state[k+3]=Math.cos(angle)*r;this.state[k+4]=.13;this.state[k+5]=Math.sin(angle)*r;
      this.state[k+6]=.55+row*.13+band*.055+hash(i+63)*.14;this.state[k+7]=swordLaunchTime(i);this.state[k+8]=.34+hash(i+9)*.2;
      this.state[k+9]=i<4?1.1+hash(i)*.25:.47+hash(i+28)*.5;this.state[k+10]=(i%5===0?.72:1.15)+hash(i+71)*.2;this.state[k+11]=(i%3===0?1:-1)*(i%4===0?2.5:.35);
      this.state[k+12]=right.x;this.state[k+13]=right.z;this.variant.setX(i,hash(i+34));
    }this.variant.needsUpdate=true;
  }
  sample(index:number,progress:number,out:Vector3):Vector3{
    const k=index*14,d=this.state,p=clamp01(progress),arc=Math.sin(p*Math.PI)*d[k+11];out.set(d[k]+(d[k+3]-d[k])*p+d[k+12]*arc,d[k+1]+(d[k+4]-d[k+1])*p+Math.sin(p*Math.PI)*Math.abs(d[k+11])*.4,d[k+2]+(d[k+5]-d[k+2])*p+d[k+13]*arc);return out;
  }
  update(t:number,count:number,detail:number,residual:number,fade:number):void{
    this.mesh.count=this.halo.count=count;this.material.uniforms.uTime.value=this.haloMaterial.uniforms.uTime.value=t;this.material.uniforms.uDetail.value=this.haloMaterial.uniforms.uDetail.value=detail;
    for(let i=0;i<count;i++){const k=i*14,s=this.state,spawn=s[k+6],launch=s[k+7],duration=s[k+8],age=t-spawn,flight=clamp01((t-launch)/duration),progress=flight*flight*(2-flight),growth=ease(age/.44),guard=ease((age-.13)/.3),hit=t-launch-duration,lingering=i>=count-residual;
      let opacity=ease(age/.1)*(1-ease((hit+.01)/.18))*fade,energy=t>=launch&&hit<0?1.2:.25;
      const d=this.dummy;
      if(lingering){opacity=growth*(1-ease((t-5.9)/1.4))*.55*fade;d.position.set(s[k],s[k+1]+Math.sin(t*.8+i)*.1,s[k+2]);d.quaternion.identity();d.rotateY(hash(i)*.5);energy=.2;}
      else{this.sample(i,progress,d.position);if(t<launch){d.position.y+=Math.sin(t*.8+i)*.11;d.quaternion.identity();d.rotateY((hash(i)-.5)*.4);}else{this.sample(i,Math.min(1,progress+.004),this.end);this.sample(i,Math.max(0,progress-.004),this.start);this.tangent.subVectors(this.end,this.start);if(this.tangent.lengthSq()<1e-8)this.tangent.set(0,-1,0);this.tangent.normalize();d.quaternion.setFromUnitVectors(this.up,this.tangent);d.rotateY(hash(i)*.5);}}
      // Four-point star first, blade extension second, crossguard last; shape stays volumetric.
      const scale=s[k+9];d.scale.set(scale,scale*s[k+10],scale);d.updateMatrix();this.mesh.setMatrixAt(i,d.matrix);this.halo.setMatrixAt(i,d.matrix);this.life.setXYZW(i,Math.max(0,opacity),growth,guard,energy);
    }
    this.life.needsUpdate=true;this.mesh.instanceMatrix.needsUpdate=true;this.halo.instanceMatrix.needsUpdate=true;this.halo.visible=detail>=2;
  }
  newlyImpacted(index:number,t:number,count:number,residual:number):boolean{if(index>=count-residual||this.impactEvents[index])return false;const k=index*14;if(t<this.state[k+7]+this.state[k+8])return false;this.impactEvents[index]=1;return true;}
}
