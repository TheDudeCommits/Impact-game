// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { BufferGeometry, Float32BufferAttribute, Mesh } from "three";
import { stormMaterial } from "./StormShaderLibrary";
export class StormDragonAura {
  readonly geometry = new BufferGeometry();
  readonly material = stormMaterial(
    `attribute float aIndex;uniform float uTime;varying vec2 vUv;void main(){vUv=uv;float a=uv.y*6.283+uTime*.6+aIndex*1.7;float r=3.+aIndex*.13;vec3 p=vec3(cos(a)*r+position.x*.35,sin(a)*(2.8+aIndex*.1),-5.+aIndex*1.9);p.y+=.5;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
    `varying vec2 vUv;uniform float uPower,uTime;void main(){float a=pow(1.-abs(vUv.x*2.-1.),3.)*pow(max(0.,sin(vUv.y*6.283+uTime*2.)),6.);gl_FragColor=vec4(.22,.08,.47,a*uPower*.25);}`,
    { uTime: { value: 0 }, uPower: { value: 0 } },
  );
  readonly mesh = new Mesh(this.geometry, this.material);
  constructor() {
    const p: number[] = [],
      uv: number[] = [],
      ids: number[] = [],
      idx: number[] = [];
    for (let k = 0; k < 8; k++) {
      const base = p.length / 3;
      for (let j = 0; j <= 64; j++)
        for (let s = 0; s < 2; s++) {
          p.push(s - 0.5, 0, 0);
          uv.push(s, j / 64);
          ids.push(k);
        }
      for (let j = 0; j < 64; j++) {
        const a = base + j * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    this.geometry.setAttribute("position", new Float32BufferAttribute(p, 3));
    this.geometry.setAttribute("uv", new Float32BufferAttribute(uv, 2));
    this.geometry.setAttribute("aIndex", new Float32BufferAttribute(ids, 1));
    this.geometry.setIndex(idx);
    this.mesh.frustumCulled = false;
  }
  update(t: number, power: number, detail: number): void {
    this.geometry.setDrawRange(0, (3 + detail * 2) * 64 * 6);
    this.mesh.visible = power > 0.001;
    this.material.uniforms.uTime.value = t;
    this.material.uniforms.uPower.value = power;
  }
  dispose(): void {
    this.mesh.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
  }
}
