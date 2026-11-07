// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { InstancedBufferGeometry, Mesh, PlaneGeometry, Vector3 } from "three";
import type { BeamStrikeSequence } from "./BeamStrikeSequence";
import { radiantMaterial, holyNoise } from "./RadiantMaterials";
/** Each impact owns an analytic ripple, broad optical water highlight and view-aligned broken reflection. */
export class HolyRipple {
  readonly geometry = new InstancedBufferGeometry();
  readonly view = new Vector3();
  readonly material = radiantMaterial(
    `attribute vec3 aOffset;attribute vec4 aTiming;varying vec2 vUv;varying vec4 vTiming;uniform float uTime;
 void main(){vUv=uv;vTiming=aTiming;vec3 p=aOffset+vec3((uv.x-.5)*24.,.066,(uv.y-.5)*24.);gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
    `${holyNoise}varying vec2 vUv;varying vec4 vTiming;uniform float uTime,uDetail;uniform vec3 uView;
 void main(){vec2 p=(vUv-.5)*24.;float r=length(p),t=uTime-vTiming.x;if(t<0.)discard;
 float distortion=uDetail*.028*sin(atan(p.y,p.x)*13.+uTime*8.)*noise(p*2.);float d=r+distortion;
 float ring=exp(-pow((d-min(10.,t*12.))/.07,2.))*exp(-t*1.4);
 float second=exp(-pow((d-min(8.5,t*7.))/.25,2.))*exp(-t*1.7)*.27;
 float flash=exp(-r*r/2.8)*exp(-t*13.)*2.;
 vec2 toward=normalize(uView.xz+vec2(.0001));float along=dot(p,toward),across=dot(p,vec2(-toward.y,toward.x));
 float reflection=exp(-across*across/(.15+max(0.,along)*.09))*smoothstep(-.3,.3,along)*(1.-smoothstep(7.,11.,along));
 reflection*=pow(noise(vec2(across*4.,along*13.+uTime*2.)),3.)*exp(-t*1.9)*1.7;
 float glow=exp(-r*r/12.)*exp(-t*2.)*.035;
 vec3 color=mix(vec3(.14,.28,.48),vec3(1.,.87,.61),clamp(ring+flash+reflection,0.,1.));
 float opacity=(ring+second+flash+reflection+glow)*vTiming.z*(1.-smoothstep(10.5,11.8,r));
 gl_FragColor=vec4(color*1.8,opacity);}`,
    { uTime: { value: 0 }, uDetail: { value: 1 }, uView: { value: this.view } },
  );
  readonly mesh = new Mesh(this.geometry, this.material);
  constructor(sequence: BeamStrikeSequence) {
    const p = new PlaneGeometry(1, 1);
    this.geometry.setAttribute("position", p.getAttribute("position").clone());
    this.geometry.setAttribute("uv", p.getAttribute("uv").clone());
    this.geometry.setIndex(p.index!.clone());
    p.dispose();
    this.geometry.setAttribute("aOffset", sequence.offsetAttribute);
    this.geometry.setAttribute("aTiming", sequence.timingAttribute);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
  }
  update(age: number, count: number, detail: number, view: Vector3): void {
    this.geometry.instanceCount = count;
    this.material.uniforms.uTime.value = age;
    this.material.uniforms.uDetail.value = detail;
    this.view.copy(view);
    this.mesh.visible = age >= 1.3 && age < 6.8;
  }
  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
