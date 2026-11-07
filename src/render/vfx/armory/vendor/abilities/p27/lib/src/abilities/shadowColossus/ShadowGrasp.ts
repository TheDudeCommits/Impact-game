// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import {InstancedBufferAttribute,InstancedMesh,Mesh,ShaderMaterial,SphereGeometry,Vector3} from 'three';
import {VisualOwner,gridGeometry,ease} from '../elemental/ElementalVisuals';
import type {ShadowHandRig} from './ShadowHandRig';
import type {ShadowPose} from './ShadowColossusTimeline';
/** Smooth shadow tension ribbons connect actual animated fingertips; deliberately no lightning helper. */
export class ShadowGrasp{
  readonly filaments:InstancedMesh;
  readonly core:Mesh;
  private readonly start:InstancedBufferAttribute;
  private readonly end:InstancedBufferAttribute;
  private readonly material:ShaderMaterial;
  private readonly coreMaterial:ShaderMaterial;
  private readonly a=new Vector3();
  private readonly b=new Vector3();
  constructor(owner:VisualOwner){
    const g=owner.geometry(gridGeometry(36,4));this.start=new InstancedBufferAttribute(new Float32Array(30),3);this.end=new InstancedBufferAttribute(new Float32Array(30),3);g.setAttribute('aStart',this.start);g.setAttribute('aEnd',this.end);g.setAttribute('aSeed',new InstancedBufferAttribute(new Float32Array(10).map((_,i)=>i*.618),1));
    this.material=owner.material(new ShaderMaterial({transparent:true,depthWrite:false,side:2,uniforms:{uTime:{value:0},uPower:{value:0}},
      vertexShader:`attribute vec3 aStart,aEnd;attribute float aSeed;varying vec2 vUv;uniform float uTime,uPower;void main(){vUv=uv;float s=uv.x,arch=sin(s*3.14159);vec3 p=mix(aStart,aEnd,s);p.z+=arch*sin(aSeed*7.+uTime)*.7;p.y+=arch*.35;p.z+=(uv.y-.5)*(.035+arch*.13)*uPower;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
      fragmentShader:`varying vec2 vUv;uniform float uTime,uPower;void main(){float edge=pow(max(0.,1.-abs(vUv.y*2.-1.)),2.);float flow=.5+.5*sin(vUv.x*29.-uTime*6.);vec3 col=mix(vec3(.02,.009,.04),vec3(.37,.1,.64),edge*.7+flow*.2);gl_FragColor=vec4(col,edge*uPower*.7);}` }));
    this.filaments=new InstancedMesh(g,this.material,10);this.filaments.frustumCulled=false;owner.root.add(this.filaments);
    this.coreMaterial=owner.material(new ShaderMaterial({transparent:true,depthWrite:false,side:2,uniforms:{uTime:{value:0},uPower:{value:0}},
      vertexShader:`varying vec3 vW,vN,vP;uniform float uTime;void main(){vP=position;vec3 p=position*(1.+sin(position.y*8.+uTime*3.)*sin(position.z*7.)*.05);vec4 w=modelMatrix*vec4(p,1.);vW=w.xyz;vN=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*viewMatrix*w;}`,
      fragmentShader:`varying vec3 vW,vN,vP;uniform float uTime,uPower;void main(){float rim=pow(1.-abs(dot(normalize(vN),normalize(cameraPosition-vW))),3.);float cracks=pow(max(0.,sin(vP.y*18.+vP.x*11.-uTime*4.)),16.);gl_FragColor=vec4(vec3(.008,.004,.017)+vec3(.3,.09,.51)*(rim*.65+cracks*.2)*uPower,(.26+rim*.35)*uPower);}` }));
    this.core=new Mesh(owner.geometry(new SphereGeometry(1,28,18)),this.coreMaterial);owner.root.add(this.core);
  }
  update(t:number,p:ShadowPose,left:ShadowHandRig,right:ShadowHandRig,target:Vector3,count:number):void{
    const power=p.grasp*(1-ease((t-5.55)/.45));this.filaments.count=count;this.filaments.visible=power>.001;this.material.uniforms.uTime.value=t;this.material.uniforms.uPower.value=power;
    for(let i=0;i<count;i++){left.tipLocal(i%5,this.a,target);right.tipLocal(i<5?i%5:4-i%5,this.b,target);this.start.setXYZ(i,this.a.x,this.a.y,this.a.z);this.end.setXYZ(i,this.b.x,this.b.y,this.b.z);}this.start.needsUpdate=this.end.needsUpdate=true;
    this.core.visible=power>.001;this.core.position.set(0,8-p.crush*1.6,0);const s=(.3+p.grasp*1.3)*(1-p.crush*.91);this.core.scale.set(s*.8,s*1.15,s);this.coreMaterial.uniforms.uTime.value=t;this.coreMaterial.uniforms.uPower.value=power;
  }
}
