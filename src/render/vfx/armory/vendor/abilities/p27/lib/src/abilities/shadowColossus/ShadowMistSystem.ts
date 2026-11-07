// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import {InstancedBufferAttribute,InstancedMesh,Object3D,PlaneGeometry,ShaderMaterial,Vector3} from 'three';
import type {AbilityCastContext} from '../Ability';
import {VisualOwner,ease,hash} from '../elemental/ElementalVisuals';
import {shardGeometry,packMaterial} from '../elemental/PackVisuals';
import type {ShadowPose} from './ShadowColossusTimeline';
import type {ShadowHandRig} from './ShadowHandRig';
export class ShadowMistSystem{
  readonly mesh:InstancedMesh;
  readonly fragments:InstancedMesh;
  private readonly material:ShaderMaterial;
  private readonly fragmentMaterial;
  private readonly attributes:InstancedBufferAttribute;
  private readonly dummy=new Object3D();
  private readonly limb=new Vector3();
  constructor(owner:VisualOwner){
    const g=owner.geometry(new PlaneGeometry(1,1));this.attributes=new InstancedBufferAttribute(new Float32Array(490*2),2);g.setAttribute('aMote',this.attributes);
    this.material=owner.material(new ShaderMaterial({transparent:true,depthWrite:false,side:2,
      vertexShader:`attribute vec2 aMote;varying vec2 vUv,vMote;void main(){vUv=uv;vMote=aMote;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}`,
      fragmentShader:`varying vec2 vUv,vMote;void main(){vec2 p=vUv*2.-1.;float r=length(p),soft=pow(max(0.,1.-r*r),2.);if(soft<.01)discard;float edge=exp(-pow((r-.63)/.2,2.));vec3 color=vMote.y>.5?vec3(.32,.11,.53):mix(vec3(.012,.008,.024),vec3(.12,.045,.22),edge*.65);gl_FragColor=vec4(color,soft*vMote.x*(vMote.y>.5?.8:.26));}` }));
    this.mesh=new InstancedMesh(g,this.material,490);this.mesh.frustumCulled=false;owner.root.add(this.mesh);this.fragmentMaterial=owner.material(packMaterial('#443056'));this.fragments=new InstancedMesh(owner.geometry(shardGeometry()),this.fragmentMaterial,70);this.fragments.frustumCulled=false;owner.root.add(this.fragments);
  }
  update(t:number,p:ShadowPose,motes:number,mist:number,fragments:number,left:ShadowHandRig,right:ShadowHandRig,target:Vector3,context:AbilityCastContext):void{
    const d=this.dummy,age=t-5.55;this.mesh.count=motes+mist;this.mesh.visible=t>=.3;
    for(let i=0;i<this.mesh.count;i++){const s=hash(i+41),a=i*2.39996+t*.22,fog=i>=motes,type=i%4;let opacity=p.fade;
      if(type===0){const hand=i%2?left:right;hand.wrist.getWorldPosition(this.limb).sub(target);d.position.set(this.limb.x+Math.cos(a)*(1+s*1.8),this.limb.y-2+s*4, this.limb.z+Math.sin(a)*(1+s*1.8));opacity*=hand===left?p.left:p.right;}
      else if(age<0){const r=(3+s*9)*(1-p.grasp*.85);d.position.set(Math.cos(a)*r,.2+s*4+p.grasp*3,Math.sin(a)*r);opacity*=ease((t-.3)/.6);}
      else{const r=Math.min(20,(2+s*8)*age),y=.2+s*3+(fog?age*.6:Math.max(0,age*(3+s*4)-age*age*2));d.position.set(Math.cos(a)*r,y,Math.sin(a)*r);opacity*=1-ease((t-8)/1);}
      d.quaternion.copy(context.camera.quaternion);const size=(fog?.85+s*1.8:.04+s*.085)*opacity;d.scale.set(size,size*(fog?.7:1),size);d.updateMatrix();this.mesh.setMatrixAt(i,d.matrix);this.attributes.setXY(i,opacity,fog||i%3===0?0:1);
    }this.mesh.instanceMatrix.needsUpdate=this.attributes.needsUpdate=true;
    this.fragments.count=fragments;this.fragments.visible=age>=0;this.fragmentMaterial.uniforms.uTime.value=t;this.fragmentMaterial.uniforms.uFade.value=p.fade;this.fragmentMaterial.uniforms.uEnergy.value=.4*(1-ease((t-6)/2));
    for(let i=0;i<fragments;i++){const s=hash(i+73),a=i*2.39996,r=Math.max(0,age)*(3+s*10);d.position.set(Math.cos(a)*r,Math.max(.08,1+(4+s*6)*Math.max(0,age)-4*Math.max(0,age)**2),Math.sin(a)*r);d.rotation.set(i+t*.8,i*.7,t+i);const size=(.08+s*.16)*p.fade;d.scale.set(size*.5,size*1.3,size*.4);d.updateMatrix();this.fragments.setMatrixAt(i,d.matrix);}this.fragments.instanceMatrix.needsUpdate=true;
  }
}
