// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { BufferGeometry, Float32BufferAttribute, Points } from "three";
import { voidMaterial } from "./VoidMaterials";
export class VoidParticles {
  readonly geometry = new BufferGeometry();
  readonly material = voidMaterial(
    `attribute vec4 aSeed;uniform float uTime,uRatio;varying float vLife,vSeed;void main(){float seed=aSeed.x;vSeed=seed;float t=max(0.,uTime-.4);float pull=smoothstep(5.3,7.42,uTime);float blast=smoothstep(7.55,8.35,uTime);float angle=aSeed.y*6.283+t*(.12+seed*.22)+pull*5.;float radius=3.+aSeed.z*13.;float cycling=fract(seed+t*.08);vec3 p=vec3(cos(angle)*radius,.3+cycling*17.,sin(angle)*radius*.7);p=mix(p,vec3(0,9.-smoothstep(6.6,7.5,uTime)*6.4,0),pow(pull,1.5));p+=vec3(cos(angle)*15.,sin(aSeed.w*33.)*6.-2.,sin(angle)*15.)*blast;vec4 view=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*view;gl_PointSize=clamp((.6+seed*1.1)*uRatio*100./max(5.,-view.z),1.,5.);vLife=smoothstep(.35,1.2,uTime)*(1.-smoothstep(8.3+seed*.5,10.8,uTime));}`,
    `varying float vLife,vSeed;uniform float uTime;void main(){vec2 p=gl_PointCoord-.5;float m=exp(-dot(p,p)*32.);float pull=smoothstep(5.3,7.3,uTime);vec3 color=mix(vec3(.24,.06,.65),vec3(.65,.5,1.),vSeed*.6+pull*.3);color=mix(color,vec3(.04,.025,.12),smoothstep(8.3,10.8,uTime));gl_FragColor=vec4(color,m*vLife*(vSeed>.9?.55:.16));}`,
    { uTime: { value: 0 }, uRatio: { value: 1 } },
  );
  readonly points = new Points(this.geometry, this.material);
  count = 0;
  constructor() {
    this.geometry.setAttribute(
      "position",
      new Float32BufferAttribute(new Float32Array(1100 * 3), 3),
    );
    const seed = new Float32Array(1100 * 4);
    for (let i = 0; i < 1100; i++)
      seed.set(
        [
          ((i * 163 + 97) % 997) / 997,
          ((i * 127 + 67) % 991) / 991,
          ((i * 61 + 7) % 983) / 983,
          ((i * 71 + 9) % 977) / 977,
        ],
        i * 4,
      );
    this.geometry.setAttribute("aSeed", new Float32BufferAttribute(seed, 4));
    this.points.frustumCulled = false;
    this.points.renderOrder = 7;
  }
  configure(count: number, ratio: number): void {
    this.count = count;
    this.geometry.setDrawRange(0, count);
    this.material.uniforms.uRatio.value = ratio;
  }
  update(t: number): void {
    this.material.uniforms.uTime.value = t;
    this.points.visible = t > 0.35 && t < 10.8;
  }
  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
