// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import {AdditiveBlending,InstancedBufferAttribute,InstancedMesh,Object3D,PlaneGeometry,ShaderMaterial} from 'three';
import type {VisualOwner} from '../elemental/ElementalVisuals';
import {ease,hash} from '../elemental/ElementalVisuals';
import {swordRainGeometry} from './SwordRainGeometry';
import {swordRainMaterial} from './SwordRainMaterials';
import type {SwordRainSpawner} from './SwordRainSpawner';
import type {RingCollapse} from './RingCollapse';
/** Every impact has a bounded flash, short radiant pillar and local expanding surface wave. */
export class SwordRainImpacts{
  readonly surface:InstancedMesh;
  readonly pillars:InstancedMesh;
  private readonly surfaceMaterial:ShaderMaterial;
  private readonly pillarMaterial;
  private readonly data:InstancedBufferAttribute;
  private readonly pillarData:InstancedBufferAttribute;
  private readonly dummy=new Object3D();
  constructor(owner:VisualOwner){
    const g=owner.geometry(new PlaneGeometry(1,1));this.data=new InstancedBufferAttribute(new Float32Array(300*4),4);g.setAttribute('aImpact',this.data);
    this.surfaceMaterial=owner.material(new ShaderMaterial({transparent:true,depthWrite:false,side:2,blending:AdditiveBlending,
      vertexShader:`attribute vec4 aImpact;varying vec2 vUv;varying vec4 vHit;void main(){vUv=uv;vHit=aImpact;vec3 p=vec3(position.x,.015*sin(length(position.xy)*22.),position.y);gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(p,1.);}`,
      fragmentShader:`varying vec2 vUv;varying vec4 vHit;void main(){vec2 p=vUv*2.-1.;float r=length(p);float leading=exp(-pow((r-vHit.y)/.055,2.));float core=exp(-r*r*65.)*vHit.z;float spokes=pow(max(0.,cos(atan(p.y,p.x)*8.+vHit.w)),22.)*exp(-r*4.)*vHit.z;vec3 col=mix(vec3(.75,.49,.13),vec3(1.,.98,.85),core+leading*.55);gl_FragColor=vec4(col,(leading*.48+core*.85+spokes*.35)*vHit.x*(1.-smoothstep(.85,1.,r)));}` }));
    this.surface=new InstancedMesh(g,this.surfaceMaterial,300);this.surface.frustumCulled=false;owner.root.add(this.surface);
    const pillar=owner.geometry(swordRainGeometry(0,300));this.pillarData=pillar.getAttribute('aRain') as InstancedBufferAttribute;this.pillarMaterial=owner.material(swordRainMaterial());this.pillars=new InstancedMesh(pillar,this.pillarMaterial,300);this.pillars.frustumCulled=false;owner.root.add(this.pillars);
  }
  update(t:number,rain:SwordRainSpawner,count:number,ring:RingCollapse,finalCount:number,fade:number):void{
    this.surface.count=this.pillars.count=count+finalCount;this.pillarMaterial.uniforms.uTime.value=t;const d=this.dummy;
    for(let i=0;i<count+finalCount;i++){const final=i>=count,index=final?i-count:i,k=index*11,age=final?t-ring.impact(index):t-rain.state[k+6]-rain.state[k+7],duration=final?.65:.34,alpha=age>=0?(1-ease(age/duration))*fade:0;
      const x=final?ring.landing[index*3]:rain.state[k+3],z=final?ring.landing[index*3+2]:rain.state[k+5],radius=final?3.3:1.45;
      d.position.set(x,.12,z);d.quaternion.identity();d.scale.set(radius*2,1,radius*2);d.updateMatrix();this.surface.setMatrixAt(i,d.matrix);this.data.setXYZW(i,alpha,.12+Math.max(0,age)/duration*.75,1-ease(Math.max(0,age)/(.12+(final?.15:0))),hash(i+8)*6.283);
      const width=final?.16:.075;d.scale.set(width,final?1.1:.24,width);d.updateMatrix();this.pillars.setMatrixAt(i,d.matrix);this.pillarData.setXYZW(i,alpha,1,1.2,hash(i+37));
    }
    this.surface.instanceMatrix.needsUpdate=this.pillars.instanceMatrix.needsUpdate=true;this.data.needsUpdate=this.pillarData.needsUpdate=true;
  }
}
