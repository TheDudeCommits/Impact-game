// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { Group, Mesh, ShaderMaterial, SphereGeometry, TorusGeometry } from 'three';
import { VisualOwner,gridGeometry } from '../elemental/ElementalVisuals';
import { ease } from '../elemental/PackVisuals';
export class GravityCore {
  readonly root=new Group();
  readonly core:Mesh;
  readonly halos:Mesh[]=[];
  readonly material:ShaderMaterial;
  readonly haloMaterial:ShaderMaterial;
  readonly well:Mesh;
  readonly wellMaterial:ShaderMaterial;
  constructor(owner:VisualOwner){
    this.material=owner.material(new ShaderMaterial({transparent:true,uniforms:{uTime:{value:0},uPower:{value:0},uFade:{value:1}},
      vertexShader:`varying vec3 vLocal,vWorld,vNormal;uniform float uTime,uPower;void main(){vLocal=position;vec3 p=position*(1.+sin(position.y*12.+uTime*3.)*sin(position.x*9.-uTime)*.025*uPower);vec4 w=modelMatrix*vec4(p,1.);vWorld=w.xyz;vNormal=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*viewMatrix*w;}`,
      fragmentShader:`varying vec3 vLocal,vWorld,vNormal;uniform float uTime,uPower,uFade;void main(){vec3 eye=normalize(cameraPosition-vWorld),n=normalize(vNormal);float rim=pow(1.-abs(dot(eye,n)),3.);float a=atan(vLocal.z,vLocal.x),h=vLocal.y;float swirl=pow(max(0.,sin(a*5.+h*14.-uTime*(3.+uPower*5.)+sin(h*12.)*.7)),9.);vec3 col=vec3(.006,.004,.013)+vec3(.17,.09,.3)*swirl*.28;col+=rim*mix(vec3(.24,.17,.48),vec3(.7,.61,.95),pow(rim,4.))*(.65+uPower);gl_FragColor=vec4(col,uFade);}` }));
    this.core=new Mesh(owner.geometry(new SphereGeometry(1.45,40,28)),this.material);this.root.add(this.core);this.root.position.y=3.1;owner.root.add(this.root);
    this.haloMaterial=owner.material(new ShaderMaterial({transparent:true,depthWrite:false,side:2,uniforms:{uTime:{value:0},uFade:{value:1},uPower:{value:0}},
      vertexShader:`varying vec3 vP;varying vec2 vUv;uniform float uTime,uPower;void main(){vP=position;vUv=uv;vec3 p=position;p.z+=sin(uv.x*31.+uTime*4.)*.07*uPower;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
      fragmentShader:`varying vec3 vP;varying vec2 vUv;uniform float uTime,uFade,uPower;void main(){float lane=.5+.5*sin(vUv.x*38.-uTime*7.);float thin=pow(max(0.,sin(vUv.y*3.14159)),10.);vec3 col=mix(vec3(.035,.015,.07),vec3(.57,.46,.88),thin*(.6+lane*.4));gl_FragColor=vec4(col,uFade*(.3+thin*.6)*(1.-sin(vUv.x*11.+uTime)*.22));}` }));
    const halo=owner.geometry(new TorusGeometry(2,.11,8,100));for(let i=0;i<5;i++){const m=new Mesh(halo,this.haloMaterial);m.rotation.set(.5+i*.46,i*.7,i*.4);this.halos.push(m);this.root.add(m);}
    this.wellMaterial=owner.material(new ShaderMaterial({transparent:true,depthWrite:false,side:2,uniforms:{uTime:{value:0},uPower:{value:0},uPull:{value:0}},
      vertexShader:`varying vec2 vUv;uniform float uTime,uPower,uPull;void main(){vUv=uv;vec2 p=(position.xy*2.-1.)*10.;float r=length(p)/10.;float h=.065+sin(r*37.+uTime*7.)*.13*uPower*r;gl_Position=projectionMatrix*modelViewMatrix*vec4(p.x,h,p.y,1.);}`,
      fragmentShader:`varying vec2 vUv;uniform float uTime,uPower,uPull;void main(){vec2 p=vUv*2.-1.;float r=length(p),a=atan(p.y,p.x);if(r>1.)discard;float bands=pow(max(0.,sin(r*40.+uTime*9.+sin(a*4.+uTime)*.65)),12.);float spiral=pow(max(0.,sin(a*6.+r*20.+uTime*4.)),18.);float mask=1.-smoothstep(.65,1.,r);vec3 col=mix(vec3(.007,.006,.015),vec3(.28,.2,.48),bands*.65+spiral*.25);float depression=exp(-r*r*14.)*uPull;gl_FragColor=vec4(col,mask*uPower*(.16+bands*.5+depression*.6));}` }));
    this.well=new Mesh(owner.geometry(gridGeometry(56,56)),this.wellMaterial);this.well.frustumCulled=false;owner.root.add(this.well);
  }
  update(t:number,halos:number,fade:number):void{
    const grow=ease((t-.3)/1.6),compress=ease((t-2.1)/1.65),burst=t>=3.8;
    this.root.visible=t>=.3&&t<4.2;this.root.scale.setScalar(Math.max(.006,grow*(1-compress*.96)*(burst?1-ease((t-3.8)/.4):1)));this.root.position.y=3.1-compress*.65;
    this.material.uniforms.uTime.value=t;this.material.uniforms.uPower.value=compress;this.material.uniforms.uFade.value=fade;
    this.haloMaterial.uniforms.uTime.value=t;this.haloMaterial.uniforms.uPower.value=compress;this.haloMaterial.uniforms.uFade.value=grow*fade;
    this.halos.forEach((m,i)=>{m.visible=i<halos;m.rotation.set(.5+i*.46+t*.16,i*.7+t*(.17+i*.05),i*.4+t*.13);const s=1+i*.32;m.scale.set(s,s,.7+i*.12);});
    this.wellMaterial.uniforms.uTime.value=t;this.wellMaterial.uniforms.uPower.value=grow*fade*(burst?1-ease((t-3.8)/2.7):1);this.wellMaterial.uniforms.uPull.value=compress*(burst?1-ease((t-3.8)/.5):1);
  }
}
