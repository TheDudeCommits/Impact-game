// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import {Mesh,ShaderMaterial,SphereGeometry} from 'three';
import {VisualOwner,ease} from '../elemental/ElementalVisuals';
export class ShadowCrushImpact{
  readonly shells:Mesh[]=[];
  readonly flash:Mesh;
  private readonly material:ShaderMaterial;
  private readonly flashMaterial:ShaderMaterial;
  private readonly geometries:SphereGeometry[];
  constructor(owner:VisualOwner){
    this.material=owner.material(new ShaderMaterial({transparent:true,depthWrite:false,side:2,uniforms:{uTime:{value:0},uFade:{value:0}},
      vertexShader:`varying vec2 vUv;varying vec3 vW;uniform float uTime;void main(){vUv=uv;vec3 p=position*(1.+sin(uv.x*37.+uTime*4.)*sin(uv.y*14.)*.022);vec4 w=modelMatrix*vec4(p,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,
      fragmentShader:`varying vec2 vUv;varying vec3 vW;uniform float uTime,uFade;void main(){vec3 n=normalize(cross(dFdx(vW),dFdy(vW)));float rim=pow(1.-abs(dot(n,normalize(cameraPosition-vW))),2.5);float leading=smoothstep(.88,.99,vUv.y);float bands=pow(max(0.,sin(vUv.y*64.-uTime*8.+sin(vUv.x*21.)*.4)),18.);vec3 col=mix(vec3(.011,.005,.025),vec3(.38,.1,.7),rim*.55+leading*.65+bands*.3);gl_FragColor=vec4(col,uFade*(.11+rim*.33+leading*.4+bands*.2));}` }));
    this.geometries=[24,40,64].map(n=>owner.geometry(new SphereGeometry(1,n,Math.round(n*.4),0,Math.PI*2,0,Math.PI*.54)));for(let i=0;i<3;i++){const m=new Mesh(this.geometries[1],this.material);m.frustumCulled=false;this.shells.push(m);owner.root.add(m);}
    this.flashMaterial=owner.material(new ShaderMaterial({transparent:true,depthWrite:false,uniforms:{uFade:{value:0}},vertexShader:`varying vec3 vW,vN;void main(){vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;vN=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*viewMatrix*w;}`,fragmentShader:`varying vec3 vW,vN;uniform float uFade;void main(){float edge=pow(1.-abs(dot(normalize(vN),normalize(cameraPosition-vW))),2.);gl_FragColor=vec4(mix(vec3(.015,.005,.03),vec3(.65,.35,.9),edge),uFade*(.2+edge*.7));}` }));
    this.flash=new Mesh(owner.geometry(new SphereGeometry(1,20,14)),this.flashMaterial);owner.root.add(this.flash);
  }
  update(t:number,shells:number,detail:number,fade:number):void{
    const age=t-5.55;this.material.uniforms.uTime.value=t;this.material.uniforms.uFade.value=age>=0?(1-ease(age/2.6))*fade:0;
    this.shells.forEach((m,i)=>{const a=age-i*.16,r=18*ease(a/(1.15+i*.3));m.geometry=this.geometries[detail];m.visible=i<shells&&a>=0&&a<2.6;m.position.y=.16;m.scale.set(Math.max(.001,r),Math.max(.001,r*(.23-i*.045)),Math.max(.001,r));});
    this.flash.visible=age>=0&&age<.3;this.flash.position.set(0,6.3,0);const s=.2+Math.max(0,age)*5;this.flash.scale.set(s*.8,s,s*.9);this.flashMaterial.uniforms.uFade.value=Math.max(0,1-age/.3)*fade;
  }
}
