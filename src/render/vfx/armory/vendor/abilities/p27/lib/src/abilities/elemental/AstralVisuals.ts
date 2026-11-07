// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { NormalBlending, AdditiveBlending, BufferGeometry, Color, DoubleSide, Float32BufferAttribute, InstancedMesh, Object3D, PlaneGeometry, ShaderMaterial, Vector3 } from 'three';
import type { AbilityCastContext } from '../Ability';
import { VisualOwner, gridGeometry } from './ElementalVisuals';
import { clamp01, ease, hash } from './PackVisuals';

/** Segmented crystal/light band, with a bevelled rectangular cross-section and real gaps. */
export function brokenRingGeometry(radius:number, segments=60, thickness=.055):BufferGeometry{
  const p:number[]=[],uv:number[]=[],idx:number[]=[];
  for(let i=0;i<segments;i++){
    if(i%9===0||i%13===0)continue;
    const offset=p.length/3;
    for(let side=0;side<2;side++){const a=(i+side*.84)/segments*Math.PI*2;
      for(let j=0;j<4;j++){const r=radius+(j<2?-thickness:thickness)*(1+.3*Math.sin(i*4.));const z=(j===0||j===3?-thickness*.45:thickness*.45);p.push(Math.cos(a)*r,Math.sin(a)*r,z);uv.push((i+side*.84)/segments,j/3);}}
    const faces=[0,1,5,0,5,4,1,2,6,1,6,5,2,3,7,2,7,6,3,0,4,3,4,7,0,3,2,0,2,1,4,5,6,4,6,7];for(const index of faces)idx.push(offset+index);
  }
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(p,3));g.setAttribute('uv',new Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
}
/** Reusable curved flare strip; vertex deformation is bounded, geometry stays stable. */
export function flareMaterial(color:string):ShaderMaterial{
  return new ShaderMaterial({transparent:true,depthWrite:false,side:DoubleSide,blending:AdditiveBlending,
    uniforms:{uTime:{value:0},uFade:{value:1},uColor:{value:new Color(color)},uLength:{value:5},uBend:{value:2}},
    vertexShader:`varying vec2 vUv;uniform float uTime,uLength,uBend;void main(){vUv=uv;float s=uv.x;float arch=sin(s*3.14159);vec3 p=vec3((s-.5)*uLength,arch*uBend+(uv.y-.5)*(.04+arch*.32),sin(s*6.283+uTime*2.)*.22*arch);gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
    fragmentShader:`varying vec2 vUv;uniform float uTime,uFade;uniform vec3 uColor;void main(){float edge=pow(max(0.,1.-abs(vUv.y*2.-1.)),2.);float flow=.5+.5*sin(vUv.x*55.-uTime*13.+sin(vUv.x*17.+uTime));float end=pow(max(0.,sin(vUv.x*3.14159)),.4);gl_FragColor=vec4(mix(uColor,vec3(1.),edge*.5)*(.65+flow*.6),edge*end*uFade*.7);}`});
}
/** Bounded billboard snow/sun/spark batches; each spell supplies its own timeline. */
export class AstralParticles{
  readonly mesh:InstancedMesh;
  readonly material:ShaderMaterial;
  private readonly dummy=new Object3D();
  private readonly unit=new Vector3();
  constructor(owner:VisualOwner,maximum:number,color:string,readonly kind:'snow'|'solar'|'electric',readonly mist=false){
    this.material=owner.material(new ShaderMaterial({transparent:true,depthWrite:false,side:DoubleSide,blending:mist?NormalBlending:AdditiveBlending,
      uniforms:{uFade:{value:1},uColor:{value:new Color(color)},uSnow:{value:kind==='snow'&&!mist?1:0}},
      vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}',
      fragmentShader:`varying vec2 vUv;uniform float uFade,uSnow;uniform vec3 uColor;void main(){vec2 p=vUv*2.-1.;float r=length(p);float a=pow(max(0.,1.-r*r),2.);if(uSnow>.5){float angle=atan(p.y,p.x);float branch=pow(max(0.,cos(angle*6.)),18.);a*=.2+branch*.8;}if(a<.01)discard;gl_FragColor=vec4(uColor,a*uFade);}` }));
    this.mesh=new InstancedMesh(owner.geometry(new PlaneGeometry(1,1)),this.material,maximum);this.mesh.frustumCulled=false;owner.root.add(this.mesh);
  }
  update(t:number,count:number,burst:number,height:number,compression:number,fade:number,context:AbilityCastContext,arrival=0):void{
    this.mesh.count=count;this.mesh.visible=t>=.25;this.material.uniforms.uFade.value=fade*(this.mist?.26:.8);const d=this.dummy;
    for(let i=0;i<count;i++){const s=hash(i+27),b=hash(i+77),a=i*2.39996+t*.3,age=t-burst;
      if(age<0){const r=(2+s*5)*(1-compression*.96),y=height+(b-.5)*r*1.4;d.position.set(Math.cos(a)*r,y,Math.sin(a)*r);if(this.kind==='electric'){d.position.set(Math.cos(a)*(2+s*4),.2+b*7,Math.sin(a)*(2+s*4));}}
      else{const speed=this.mist?2+s*3:4+s*13,r=Math.min(22,age*speed);let y=this.mist?.4+b*5+age*.6:Math.max(.1,height*.2+(3+b*9)*age-3.5*age*age);if(this.kind==='electric'){y=.1+b*5+age*.7;d.position.set(Math.cos(a)*r,y,Math.sin(a)*r);}else{d.position.set(Math.cos(i*2.39996)*r,y,Math.sin(i*2.39996)*r);} }
      if(this.kind==='electric'&&t<arrival){const r=3+s*4;this.unit.set(Math.cos(a)*r,hash(i+11)*3,Math.sin(a)*r);d.position.copy(this.unit);}
      d.quaternion.copy(context.camera.quaternion);const size=(this.mist?.7+s*2.1:.035+s*.12)*fade;d.scale.set(size,size*(this.kind==='electric'&&!this.mist?3:1),size);d.updateMatrix();this.mesh.setMatrixAt(i,d.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate=true;
  }
}
export function surfaceGeometry(owner:VisualOwner,segments=64):BufferGeometry{return owner.geometry(gridGeometry(segments,segments));}
export {clamp01,ease,hash};
