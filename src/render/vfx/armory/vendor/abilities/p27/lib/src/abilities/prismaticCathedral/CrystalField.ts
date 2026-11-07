// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import {Mesh,ShaderMaterial} from 'three';
import {VisualOwner,gridGeometry,ease} from '../elemental/ElementalVisuals';
import {prismPalette} from './CrystalMaterials';
export class CrystalField{
  readonly mesh:Mesh;
  readonly material:ShaderMaterial;
  constructor(owner:VisualOwner){
    this.material=owner.material(new ShaderMaterial({transparent:true,depthWrite:false,side:2,uniforms:{uTime:{value:0},uPower:{value:0},uEnergy:{value:0},uDetail:{value:2}},
      vertexShader:`varying vec2 vUv;uniform float uTime,uPower;void main(){vUv=uv;vec2 p=(position.xy*2.-1.)*12.;float h=.085+sin(length(p)*4.-uTime*3.)*.035*uPower;gl_Position=projectionMatrix*modelViewMatrix*vec4(p.x,h,p.y,1.);}`,
      fragmentShader:`varying vec2 vUv;uniform float uTime,uPower,uEnergy,uDetail;${prismPalette}void main(){vec2 p=(vUv*2.-1.)*12.;float r=length(p),a=atan(p.y,p.x);if(r>12.)discard;float polygon=r*cos(mod(a+3.14159/6.,6.28318/6.)-3.14159/6.);float ring=exp(-pow((polygon-7.8)/.06,2.));float inner=exp(-pow((polygon-3.1)/.055,2.));float vein=pow(max(0.,cos(a*12.+sin(r*2.)*.25)),32.)*smoothstep(1.,3.,r)*(1.-smoothstep(8.,10.,r));float crossing=pow(max(0.,sin(p.x*1.7+p.y*.9+sin(p.y*2.)*.4)),20.)*.22;float mask=1.-smoothstep(8.,12.,r);vec3 col=mix(vec3(.68,.86,.93),prism(a*.22+r*.025+uTime*.04),.4);float alpha=(ring*.6+inner*.35+vein*.3+crossing*uEnergy)*mask*uPower;gl_FragColor=vec4(col,alpha);}` }));
    this.mesh=new Mesh(owner.geometry(gridGeometry(64,64)),this.material);this.mesh.frustumCulled=false;owner.root.add(this.mesh);
  }
  update(t:number,power:number,energy:number,detail:number):void{this.mesh.visible=t>=.3;this.material.uniforms.uTime.value=t;this.material.uniforms.uPower.value=power*(.55+.45*ease((t-.3)/.7));this.material.uniforms.uEnergy.value=energy;this.material.uniforms.uDetail.value=detail;}
}
