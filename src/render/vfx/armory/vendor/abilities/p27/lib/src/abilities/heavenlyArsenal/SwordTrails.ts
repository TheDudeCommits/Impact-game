// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import {InstancedMesh,Object3D,ShaderMaterial,Vector3,PlaneGeometry,DoubleSide,AdditiveBlending} from 'three';
import type {VisualOwner} from '../elemental/ElementalVisuals';
import {clamp01,ease} from '../elemental/ElementalVisuals';
import type {SwordFormation} from './SwordFormation';
/** Three crossed tapered streak strips per blade, in one bounded instance draw. */
export class SwordTrails{
  readonly mesh:InstancedMesh;
  readonly material:ShaderMaterial;
  private readonly dummy=new Object3D();
  private readonly a=new Vector3();
  private readonly b=new Vector3();
  private readonly direction=new Vector3();
  private readonly up=new Vector3(0,1,0);
  constructor(owner:VisualOwner){
    this.material=owner.material(new ShaderMaterial({transparent:true,depthWrite:false,side:DoubleSide,blending:AdditiveBlending,uniforms:{uTime:{value:0},uFade:{value:1}},
      vertexShader:`varying vec2 vUv;void main(){vUv=uv;vec3 p=position;p.x*=pow(max(.01,uv.y),.65);gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(p,1.);}`,
      fragmentShader:`varying vec2 vUv;uniform float uTime,uFade;void main(){float x=abs(vUv.x*2.-1.),core=exp(-x*x*85.),halo=pow(max(0.,1.-x),2.5),tail=pow(vUv.y,.7);vec3 col=vec3(1.,.98,.86)*core+vec3(.77,.51,.12)*halo;gl_FragColor=vec4(col,halo*tail*uFade*.6);}` }));
    this.mesh=new InstancedMesh(owner.geometry(new PlaneGeometry(1,1)),this.material,255);this.mesh.frustumCulled=false;owner.root.add(this.mesh);
  }
  update(t:number,formation:SwordFormation,count:number,layers:number,residual:number,fade:number):void{
    this.material.uniforms.uTime.value=t;this.material.uniforms.uFade.value=fade;let n=0;const s=formation.state,d=this.dummy;
    for(let i=0;i<count-residual;i++){const k=i*14,launch=s[k+7],duration=s[k+8],age=t-launch;if(age<0||age>duration+.24)continue;
      const p=clamp01(age/duration),old=clamp01((age-.22)/duration);formation.sample(i,p*p*(2-p),this.b);formation.sample(i,old*old*(2-old),this.a);this.direction.subVectors(this.b,this.a);const length=this.direction.length();if(length<.02)continue;this.direction.divideScalar(length);
      for(let j=0;j<layers;j++){d.position.copy(this.a).lerp(this.b,.5);d.quaternion.setFromUnitVectors(this.up,this.direction);d.rotateY(j*Math.PI/layers);const width=(j===0?.4:.62)*s[k+9]*(1-ease((age-duration)/.24));d.scale.set(width,length,1);d.updateMatrix();this.mesh.setMatrixAt(n++,d.matrix);}
    }
    this.mesh.count=n;this.mesh.visible=n>0;this.mesh.instanceMatrix.needsUpdate=true;
  }
}
