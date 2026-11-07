// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import {Mesh,ShaderMaterial} from 'three';
import {VisualOwner,gridGeometry,ease} from '../elemental/ElementalVisuals';
export class ShadowTargetField{
  readonly mesh:Mesh;
  private readonly material:ShaderMaterial;
  constructor(owner:VisualOwner){
    this.material=owner.material(new ShaderMaterial({transparent:true,depthWrite:false,side:2,uniforms:{uTime:{value:0},uPower:{value:0},uGrasp:{value:0}},
      vertexShader:`varying vec2 vUv;uniform float uTime,uPower;void main(){vUv=uv;vec2 p=(position.xy*2.-1.)*18.;float h=.095+sin(length(p)*4.+uTime*3.)*.09*uPower;gl_Position=projectionMatrix*modelViewMatrix*vec4(p.x,h,p.y,1.);}`,
      fragmentShader:`varying vec2 vUv;uniform float uTime,uPower,uGrasp;void main(){vec2 p=(vUv*2.-1.)*18.;float r=length(p),a=atan(p.y,p.x);float radius=15.*min(1.,uTime/1.2);float edge=1.-smoothstep(radius-1.5,radius,r);float veins=pow(max(0.,sin(a*12.+r*1.8+sin(a*9.)*.7-uTime*.3)),24.);float cracks=pow(max(0.,cos(p.x*.9+p.y*.65+sin(p.y*2.)*.45)),28.);float bands=pow(max(0.,sin(r*5.+uTime*(3.+uGrasp*4.))),16.);vec3 col=mix(vec3(.006,.004,.012),vec3(.29,.08,.49),clamp(veins*.65+cracks*.4+bands*.16,0.,1.));float opacity=edge*uPower*(.19+veins*.27+cracks*.18+bands*.12)*(1.-smoothstep(11.,17.,r));gl_FragColor=vec4(col,opacity);}` }));
    this.mesh=new Mesh(owner.geometry(gridGeometry(56,56)),this.material);this.mesh.frustumCulled=false;owner.root.add(this.mesh);
  }
  update(t:number,grasp:number,fade:number):void{this.mesh.visible=t>=.3;this.material.uniforms.uTime.value=t;this.material.uniforms.uPower.value=ease((t-.3)/.7)*fade;this.material.uniforms.uGrasp.value=grasp;}
}
