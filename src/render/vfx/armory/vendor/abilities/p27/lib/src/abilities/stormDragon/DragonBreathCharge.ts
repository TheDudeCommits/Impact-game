// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { Group, Mesh, IcosahedronGeometry, TorusGeometry } from "three";
import { stormMaterial, noiseGLSL } from "./StormShaderLibrary";
export class DragonBreathCharge {
  readonly root = new Group();
  readonly material = stormMaterial(
    "varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    `varying vec3 vP;uniform float uTime,uPower;${noiseGLSL}void main(){float n=fbm(vP.xy*5.+uTime*4.);vec3 c=mix(vec3(.13,.04,.48),vec3(1.1,1.6,2.),pow(n,2.))*uPower;gl_FragColor=vec4(c,.75);}`,
    { uTime: { value: 0 }, uPower: { value: 0 } },
  );
  readonly core = new Mesh(new IcosahedronGeometry(0.7, 2), this.material);
  readonly rings: Mesh[] = [];
  constructor() {
    this.root.add(this.core);
    const g = new TorusGeometry(1, 0.035, 6, 64);
    for (let i = 0; i < 3; i++) {
      const r = new Mesh(g, this.material);
      r.rotation.set(i * 0.8, i * 0.7, 0);
      this.root.add(r);
      this.rings.push(r);
    }
  }
  update(t: number, power: number): void {
    this.root.visible = power > 0.01;
    this.root.scale.setScalar(0.25 + power * 0.9);
    this.material.uniforms.uTime.value = t;
    this.material.uniforms.uPower.value = power * 1.3;
    this.core.rotation.set(t * 2, t * 3, t);
    for (let i = 0; i < 3; i++) {
      this.rings[i].rotation.z = t * (i % 2 ? 2 : -3);
      this.rings[i].scale.setScalar(1.8 - ((t * 0.5 + i * 0.3) % 1.3));
    }
  }
  dispose(): void {
    this.root.removeFromParent();
    this.core.geometry.dispose();
    this.rings[0].geometry.dispose();
    this.material.dispose();
  }
}
