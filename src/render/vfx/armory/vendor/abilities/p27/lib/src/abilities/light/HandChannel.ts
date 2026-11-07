// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { Group, Mesh, PlaneGeometry, Quaternion, Vector3 } from "three";
import { radiantMaterial, planeVertex } from "./RadiantMaterials";
export class HandChannel {
  readonly root = new Group();
  readonly geometry = new PlaneGeometry(0.8, 0.8);
  readonly material = radiantMaterial(
    planeVertex,
    `varying vec2 vUv;uniform float uTime;
 void main(){vec2 p=(vUv-.5)*2.;float r=length(p),a=atan(p.y,p.x)-uTime*1.9;
 float rings=exp(-pow((r-.55)/.021,2.))+exp(-pow((r-.72)/.013,2.))*.4;
 float star=exp(-pow((r*cos(mod(a+3.14159,1.0472)-.5236)-.32)/.02,2.));
 float spiral=pow(max(0.,cos(a*3.+r*13.-uTime*5.)),34.)*smoothstep(.18,.3,r)*(1.-smoothstep(.7,.9,r))*.3;
 float motes=pow(max(0.,cos(a*13.+uTime*2.)),60.)*exp(-pow((r-.8)/.06,2.));
 float charge=smoothstep(0.,.2,uTime)*(1.-smoothstep(.65,1.15,uTime));
 vec3 color=mix(vec3(.34,.52,.72),vec3(1.,.9,.64),clamp(rings+star,0.,1.));
 gl_FragColor=vec4(color*2.,(rings*.6+star*.3+spiral+motes*.4+exp(-r*r/.015)*.5)*charge);}`,
    { uTime: { value: 0 } },
  );
  readonly mesh = new Mesh(this.geometry, this.material);
  constructor() {
    this.root.add(this.mesh);
    this.mesh.renderOrder = 7;
  }
  update(age: number, hand: Vector3, rotation: Quaternion): void {
    this.root.visible = age < 1.15;
    if (!this.root.visible) return;
    this.root.position.copy(hand);
    this.root.quaternion.copy(rotation);
    this.material.uniforms.uTime.value = age;
  }
  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
