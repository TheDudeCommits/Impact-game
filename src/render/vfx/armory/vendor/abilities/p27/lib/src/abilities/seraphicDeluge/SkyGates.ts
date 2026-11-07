// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import {Group,Mesh,ShaderMaterial} from 'three';
import {VisualOwner,gridGeometry} from '../elemental/ElementalVisuals';
import {brokenRingGeometry} from '../elemental/AstralVisuals';
import {packMaterial} from '../elemental/PackVisuals';
/** Multiple broken luminous apertures above an area; no suspended sword grid. */
export class SkyGates{
  readonly gates:Group[]=[];
  readonly field:Mesh;
  private readonly material:ShaderMaterial;
  private readonly frameMaterial;
  private readonly fieldMaterial:ShaderMaterial;
  constructor(owner:VisualOwner){
    this.material=owner.material(new ShaderMaterial({transparent:true,depthWrite:false,side:2,uniforms:{uTime:{value:0},uFade:{value:0},uDetail:{value:2}},
      vertexShader:`varying vec2 vUv;uniform float uTime;void main(){vUv=uv;vec2 p=position.xy*2.-1.;float r=length(p);vec3 q=vec3(p.x,sin(r*15.-uTime*2.)*.02,p.y);gl_Position=projectionMatrix*modelViewMatrix*vec4(q,1.);}`,
      fragmentShader:`varying vec2 vUv;uniform float uTime,uFade,uDetail;void main(){vec2 p=vUv*2.-1.;float r=length(p),a=atan(p.y,p.x);if(r>1.)discard;float seam=exp(-pow((r-.78)/.035,2.));float inner=exp(-pow((r-.53)/.018,2.));float rays=pow(max(0.,cos(a*21.+uTime*.3)),16.)*smoothstep(.35,.6,r);float tears=.5+.5*sin(a*11.+r*13.+uTime*.6);float haze=exp(-r*r*3.)*(.05+tears*.055);vec3 col=mix(vec3(.8,.57,.16),vec3(1.,.97,.8),seam);gl_FragColor=vec4(col,(seam*.47+inner*.18+rays*.12*(1.-r)+haze)*uFade);}` }));
    this.frameMaterial=owner.material(packMaterial('#f6e4af',true));const grid=owner.geometry(gridGeometry(44,44)),ring=owner.geometry(brokenRingGeometry(.79,80,.007));
    const positions=[[0,27,0,11],[-8,23,-5,6],[8,25,5,6],[-5,22,8,5],[8,28,-7,5]];
    positions.forEach(([x,y,z,r],i)=>{const root=new Group();root.position.set(x,y,z);root.scale.set(r,1,r);const aperture=new Mesh(grid,this.material);aperture.frustumCulled=false;root.add(aperture);const frame=new Mesh(ring,this.frameMaterial);frame.rotation.x=-Math.PI*.5;root.add(frame);root.rotation.y=i*.7;this.gates.push(root);owner.root.add(root);});
    this.fieldMaterial=owner.material(new ShaderMaterial({transparent:true,depthWrite:false,side:2,uniforms:{uTime:{value:0},uFade:{value:0}},
      vertexShader:`varying vec2 vUv;void main(){vUv=uv;vec2 p=(position.xy*2.-1.)*19.;gl_Position=projectionMatrix*modelViewMatrix*vec4(p.x,.09,p.y,1.);}`,
      fragmentShader:`varying vec2 vUv;uniform float uTime,uFade;void main(){vec2 p=(vUv*2.-1.)*19.;float r=length(p),a=atan(p.y,p.x);float rings=exp(-pow((r-16.5)/.055,2.))+exp(-pow((r-11.)/.045,2.))*.5+exp(-pow((r-5.5)/.045,2.))*.25;float marks=pow(max(0.,cos(a*32.-uTime*.12)),24.)*exp(-pow((r-15.8)/.2,2.));float star=pow(max(0.,cos(a*8.)),32.)*smoothstep(1.,4.,r)*(1.-smoothstep(5.,7.,r));gl_FragColor=vec4(vec3(.96,.79,.36),uFade*(rings*.42+marks*.38+star*.14));}` }));
    this.field=new Mesh(owner.geometry(gridGeometry(64,64)),this.fieldMaterial);this.field.frustumCulled=false;owner.root.add(this.field);
  }
  update(t:number,count:number,detail:number,gates:number,field:number):void{
    this.material.uniforms.uTime.value=t;this.material.uniforms.uFade.value=gates;this.material.uniforms.uDetail.value=detail;this.frameMaterial.uniforms.uTime.value=t;this.frameMaterial.uniforms.uFade.value=gates*.65;
    this.gates.forEach((g,i)=>{g.visible=i<count&&gates>.001;g.rotation.y=i*.7+t*.018;});this.fieldMaterial.uniforms.uTime.value=t;this.fieldMaterial.uniforms.uFade.value=field;this.field.visible=field>.001;
  }
}
