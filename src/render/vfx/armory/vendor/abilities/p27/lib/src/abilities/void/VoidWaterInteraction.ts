// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { Mesh, PlaneGeometry, Vector3 } from "three";
import { voidMaterial, noiseGLSL } from "./VoidMaterials";
export class VoidWaterInteraction {
  readonly geometry = new PlaneGeometry(48, 48, 48, 48);
  private readonly uniforms = {
    uTime: { value: 0 },
    uDetail: { value: 1 },
    uView: { value: new Vector3() },
    uDark: { value: 0 },
  };
  readonly material = voidMaterial(
    `varying vec2 vUv;uniform float uTime;void main(){vUv=uv;vec3 p=position;float r=length(p.xy);float influence=exp(-r*.22)*smoothstep(.35,1.5,uTime)*(1.-smoothstep(8.5,11.,uTime));p.z+=.055*sin(r*2.3+uTime*3.)*influence;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
    `${noiseGLSL}varying vec2 vUv;uniform float uTime,uDetail,uDark;uniform vec3 uView;
 void main(){vec2 p=(vUv-.5)*48.;p.y=-p.y;float r=length(p),a=atan(p.y,p.x);float life=smoothstep(.3,1.,uTime)*(1.-smoothstep(10.,11.,uTime));float open=smoothstep(1.,2.6,uTime)*(1.-smoothstep(6.6,7.7,uTime));float pull=smoothstep(5.3,7.4,uTime);
 float n=fbm(p*.55+uTime*.06);float depression=exp(-r*r*.027);float rings=0.;for(int i=0;i<4;i++){if(float(i)>1.+uDetail)break;float d=float(i);float radius=mod(uTime*(i==0?-1.5:1.2)+d*3.5+24.,14.);radius*=1.-pull*.65;float distortedR=r+(n-.5)*(.4+uDetail*.2);rings+=exp(-pow((distortedR-radius)*9.,2.))*(.25+.75*noise(vec2(a*12.,uTime*.15+d)))*(1.-r/24.);}
 float crease=exp(-abs(sin(a*7.+r*.7+(n-.5)))*45.)*exp(-r*.23)*smoothstep(.6,1.2,uTime);
 vec2 direction=normalize(uView.xz+vec2(.001));float along=dot(p,direction),side=abs(p.x*direction.y-p.y*direction.x);float streak=(.3+.7*pow(.5+.5*sin(p.y*13.+p.x*4.+uTime*1.5+n*5.),4.));float reflection=exp(-side/(.4+max(0.,along)*.11))*exp(-abs(along)*.10)*step(0.,along)*streak*open;
 float age=max(0.,uTime-7.55),rad=18.*(1.-exp(-age*3.5));float polygon=r*(.975+.025*cos(a*12.));float front=exp(-pow((polygon-rad)*12.,2.))*step(7.55,uTime)*(1.-smoothstep(8.1,8.8,uTime));float gap=smoothstep(.16,.30,noise(vec2(floor(a*28.),age*1.3)));float broad=exp(-pow((r-rad+.5)*1.2,2.))*step(7.55,uTime)*(1.-smoothstep(8.2,9.2,uTime));float after=exp(-pow((r-mod(age*8.,22.))*10.,2.))*smoothstep(8.,8.3,uTime)*(1.-smoothstep(9.8,11.,uTime));
 if(uDark>.5){gl_FragColor=vec4(vec3(.001,.001,.008),depression*life*.35);return;}
 vec3 color=vec3(.22,.035,.5)*(rings*open*.45+crease*.25+reflection*.85)+vec3(.9,.64,1.25)*front*gap*2.+vec3(.11,.09,.28)*broad+vec3(.17,.04,.35)*after*.32;
 gl_FragColor=vec4(color,life*(1.-smoothstep(21.,24.,r)));}`,
    this.uniforms,
  );
  readonly mesh = new Mesh(this.geometry, this.material);
  readonly darkMaterial = this.material.clone();
  readonly dark = new Mesh(this.geometry, this.darkMaterial);
  constructor() {
    this.mesh.rotation.x = this.dark.rotation.x = -Math.PI / 2;
    this.mesh.position.y = 0.09;
    this.dark.position.y = 0.075;
    this.mesh.renderOrder = 2;
    this.dark.renderOrder = 1;
    this.darkMaterial.blending = 1;
    this.darkMaterial.uniforms.uDark.value = 1;
    this.mesh.frustumCulled = this.dark.frustumCulled = false;
  }
  update(t: number, detail: number, view: Vector3): void {
    this.uniforms.uTime.value = t;
    this.uniforms.uDetail.value = detail;
    this.uniforms.uView.value.copy(view);
    this.darkMaterial.uniforms.uTime.value = t;
    this.mesh.visible = this.dark.visible = t > 0.3 && t < 11;
  }
  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    this.darkMaterial.dispose();
  }
}
