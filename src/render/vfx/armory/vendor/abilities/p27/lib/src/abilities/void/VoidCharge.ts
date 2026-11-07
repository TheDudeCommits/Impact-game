// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { Mesh, PlaneGeometry, Quaternion, Vector3 } from "three";
import { voidMaterial, noiseGLSL, planeVertex } from "./VoidMaterials";
export class VoidCharge {
  readonly geometry = new PlaneGeometry(0.85, 0.85);
  readonly material = voidMaterial(
    planeVertex,
    `${noiseGLSL}varying vec2 vUv;uniform float uTime;void main(){vec2 p=(vUv-.5)*2.;float r=length(p),a=atan(p.y,p.x);float life=smoothstep(0.,.15,uTime)*(1.-smoothstep(.55,1.,uTime));float jag=abs(r-(.45+.035*sin(a*9.+uTime*6.)));float rim=exp(-jag*65.);float filament=exp(-abs(sin(a*3.+r*11.-uTime*8.))*35.)*exp(-abs(r-.62)*12.);float motes=pow(hash(floor((p+vec2(sin(uTime),cos(uTime))*.2)*25.)),50.)*smoothstep(.35,.6,r)*(1.-smoothstep(.85,1.,r));vec3 color=vec3(.55,.22,1.)*rim+vec3(.22,.025,.7)*filament+vec3(.4,.55,.8)*motes;gl_FragColor=vec4(color,life*(rim+filament+motes));}`,
    { uTime: { value: 0 } },
  );
  readonly mesh = new Mesh(this.geometry, this.material);
  constructor() {
    this.mesh.renderOrder = 8;
  }
  update(t: number, hand: Vector3, orientation: Quaternion): void {
    this.mesh.position.copy(hand);
    this.mesh.quaternion.copy(orientation);
    this.material.uniforms.uTime.value = t;
    this.mesh.visible = t < 1;
  }
  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
