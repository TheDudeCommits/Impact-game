// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { BufferGeometry, Float32BufferAttribute, Mesh } from "three";
import { stormMaterial } from "./StormShaderLibrary";
export class StormWindField {
  readonly g = new BufferGeometry();
  readonly material = stormMaterial(
    `attribute float aIndex;uniform float uTime,uStrength;varying vec2 vUv;varying float vIndex;void main(){vUv=uv;vIndex=aIndex;float a=uv.y*2.4+uTime*(.3+aIndex*.005)+aIndex*2.399;float r=10.+mod(aIndex*3.7,20.);float h=1.+mod(aIndex*1.9,15.);vec3 p=vec3(cos(a)*r,h+sin(a*2.)*2.,sin(a)*r);p.y+=position.x*.24;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
    `varying vec2 vUv;varying float vIndex;uniform float uStrength,uCount;void main(){if(vIndex>=uCount)discard;float a=pow(1.-abs(vUv.x*2.-1.),2.)*pow(sin(vUv.y*3.14159),2.)*uStrength;gl_FragColor=vec4(.2,.15,.38,a*.055);}`,
    { uTime: { value: 0 }, uStrength: { value: 0 }, uCount: { value: 12 } },
  );
  readonly mesh = new Mesh(this.g, this.material);
  constructor() {
    const p: number[] = [],
      uv: number[] = [],
      ids: number[] = [],
      idx: number[] = [];
    for (let k = 0; k < 24; k++) {
      const base = p.length / 3;
      for (let j = 0; j <= 60; j++)
        for (let s = 0; s < 2; s++) {
          p.push(s - 0.5, 0, 0);
          uv.push(s, j / 60);
          ids.push(k);
        }
      for (let j = 0; j < 60; j++) {
        const a = base + j * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    this.g.setAttribute("position", new Float32BufferAttribute(p, 3));
    this.g.setAttribute("uv", new Float32BufferAttribute(uv, 2));
    this.g.setAttribute("aIndex", new Float32BufferAttribute(ids, 1));
    this.g.setIndex(idx);
    this.mesh.frustumCulled = false;
  }
  update(t: number, strength: number, detail: number): void {
    this.g.setDrawRange(0, (6 + detail * 9) * 60 * 6);
    this.mesh.visible = strength > 0.001;
    this.material.uniforms.uTime.value = t;
    this.material.uniforms.uStrength.value = strength;
    this.material.uniforms.uCount.value = 6 + detail * 9;
  }
  dispose(): void {
    this.mesh.removeFromParent();
    this.g.dispose();
    this.material.dispose();
  }
}
