// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { InstancedMesh, Mesh, Object3D, ShaderMaterial, SphereGeometry } from 'three';
import type { AbilityCastContext } from '../Ability';
import { VisualOwner,SurfacePulse } from '../elemental/ElementalVisuals';
import { PackParticles,packMaterial,ease,hash } from '../elemental/PackVisuals';
import { earthGeometry } from '../earth/EarthGeometry';
export class GravityBurst {
  readonly debris:InstancedMesh;
  readonly particles:PackParticles;
  readonly shells:Mesh[]=[];
  readonly shellMaterial:ShaderMaterial;
  readonly material;
  readonly pulse:SurfacePulse;
  private readonly dummy=new Object3D();
  constructor(owner:VisualOwner){
    this.material=owner.material(packMaterial('#363044'));this.debris=new InstancedMesh(owner.geometry(earthGeometry(31,1)),this.material,88);this.debris.frustumCulled=false;owner.root.add(this.debris);this.particles=new PackParticles(owner,280,'#b5a4ed','gravity');this.pulse=new SurfacePulse(owner,true);
    this.shellMaterial=owner.material(new ShaderMaterial({transparent:true,depthWrite:false,side:2,uniforms:{uTime:{value:0},uFade:{value:1}},
      vertexShader:`varying vec3 vP,vW;varying vec2 vUv;uniform float uTime;void main(){vP=position;vUv=uv;vec3 p=position*(1.+sin(uv.x*43.+uTime*6.)*sin(uv.y*18.)*.025);vec4 w=modelMatrix*vec4(p,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,
      fragmentShader:`varying vec3 vP,vW;varying vec2 vUv;uniform float uTime,uFade;void main(){vec3 n=normalize(cross(dFdx(vW),dFdy(vW)));float rim=pow(1.-abs(dot(n,normalize(cameraPosition-vW))),2.);float inner=pow(max(0.,sin(vUv.y*70.-uTime*8.)),14.);float edge=smoothstep(.82,.99,vUv.y);float arcs=.65+.35*sin(vUv.x*31.+uTime*4.);vec3 col=mix(vec3(.024,.009,.05),vec3(.61,.48,.92),rim*.6+inner*.4);gl_FragColor=vec4(col,uFade*arcs*(rim*.38+inner*.23+edge*.3));}` }));
    const shell=owner.geometry(new SphereGeometry(1,64,32,0,Math.PI*2,0,Math.PI*.55));for(let i=0;i<3;i++){const m=new Mesh(shell,this.shellMaterial);m.frustumCulled=false;this.shells.push(m);owner.root.add(m);}
  }
  update(t:number,count:number,particles:number,shells:number,fade:number,context:AbilityCastContext):void{
    const collapse=ease((t-2.1)/1.65),age=t-3.8;this.material.uniforms.uTime.value=t;this.material.uniforms.uFade.value=fade;this.material.uniforms.uEnergy.value=.25+collapse*.7;this.debris.count=count;this.debris.visible=t>=.6;
    const d=this.dummy;
    for(let i=0;i<count;i++){const s=hash(i+77),a=i*2.39996+Math.min(t,3.8)*(1+s+collapse*2),r=(4+s*5)*(1-collapse*.97);let size=(.18+s*.5)*ease((t-.6-s*.4)/.7)*fade;
      if(age<0){d.position.set(Math.cos(a)*r,3+Math.sin(a*.6+i)*r*.45,Math.sin(a)*r);if(t>=3.73)size*=.05;}
      else{const flight=Math.max(0,age-s*.06),radius=(5+s*17)*flight;d.position.set(Math.cos(a)*radius,Math.max(.06,2.6+(4+s*11)*flight-5*flight*flight)-ease((t-6.7)/.8),Math.sin(a)*radius);}
      d.rotation.set(i+t*(1+s),i+t*.7,i*.3+t);d.scale.set(size,size*.6,size*.9);d.updateMatrix();this.debris.setMatrixAt(i,d.matrix);
    }
    this.debris.instanceMatrix.needsUpdate=true;this.particles.update(t,particles,3.8,fade,context);this.shellMaterial.uniforms.uTime.value=t;this.shellMaterial.uniforms.uFade.value=fade*(1-ease(Math.max(0,age)/2.1));
    this.shells.forEach((m,i)=>{const a=age-i*.12;m.visible=i<shells&&a>=0&&a<2.1;const r=.4+Math.pow(Math.max(0,a),.72)*22;m.position.y=.12;m.scale.set(r,r*(.2+i*.05),r);m.rotation.y=i*.8+t*.1;});
    this.pulse.update(Math.max(0,age),age<0?0:(1-ease(age/3))*fade,4+Math.max(0,age)*15);
  }
}
