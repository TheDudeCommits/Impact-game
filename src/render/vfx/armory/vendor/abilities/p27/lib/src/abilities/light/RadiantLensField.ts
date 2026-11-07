// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { InstancedBufferGeometry, Mesh, PlaneGeometry } from "three";
import type { BeamStrikeSequence } from "./BeamStrikeSequence";
import { radiantMaterial, envelope } from "./RadiantMaterials";
const ECHO_COUNTS = [3, 5, 9] as const;
/** Low optical echoes make convergence legible when the 23–26 m celestial array is above the camera. */
export class RadiantLensField {
  readonly geometry = new InstancedBufferGeometry();
  readonly material = radiantMaterial(
    `attribute vec3 aOffset;attribute vec4 aTiming;varying vec2 vUv;varying float vPulse;uniform float uTime;
 void main(){vUv=uv;vec3 p=aOffset+vec3(0,5.8+mod(aTiming.x*17.,3.),0);vec4 v=modelViewMatrix*vec4(p,1.);
 v.xy+=(uv-.5)*vec2(2.1,1.25);vPulse=exp(-abs(uTime-aTiming.x)*17.);gl_Position=projectionMatrix*v;}`,
    `${envelope}varying vec2 vUv;varying float vPulse;uniform float uTime,uDetail;
 void main(){vec2 p=(vUv-.5)*2.;float r=length(p),a=atan(p.y,p.x)-uTime*.25;
 float ring=exp(-pow((r-.61)/max(.016,fwidth(r)),2.));
 float hex=r*cos(mod(a+3.14159,1.0472)-.5236);float seal=exp(-pow((hex-.39)/max(.012,fwidth(hex)),2.));
 float segments=pow(max(0.,cos(a*6.)),26.)*exp(-pow((r-.77)/.026,2.));
 float pin=exp(-dot(p,p)/.009);float glare=exp(-abs(p.y)*75.)*exp(-abs(p.x)*6.)*vPulse;
 float build=smoothstep(.55,1.10,uTime)*fade(uTime);
 vec3 color=mix(vec3(.37,.52,.72),vec3(1.,.88,.62),clamp(seal+pin+vPulse,0.,1.));
 gl_FragColor=vec4(color*1.6,(ring*.22+seal*.28+segments*.3+pin*.9+glare*.7)*build*(.7+vPulse*1.6));}`,
    { uTime: { value: 0 }, uDetail: { value: 1 } },
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
    this.mesh.renderOrder = 5;
  }
  update(age: number, detail: number): void {
    this.geometry.instanceCount = ECHO_COUNTS[detail];
    this.material.uniforms.uTime.value = age;
    this.material.uniforms.uDetail.value = detail;
    this.mesh.visible = age > 0.55 && age < 6.8;
  }
  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
