// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { BufferGeometry, Float32BufferAttribute, Mesh } from "three";
import { stormMaterial, noiseGLSL } from "./StormShaderLibrary";
import { envelope } from "./StormDragonConfig";
export class StormTornadoField {
  readonly g = new BufferGeometry();
  readonly material = stormMaterial(
    `attribute float aIndex;uniform float uTime,uCount;varying vec2 vUv;varying float vIndex;void main(){vUv=uv;float id=floor(aIndex/3.);vIndex=id;float h=uv.y*(11.+mod(id*3.1,5.));float a=uv.y*20.-uTime*(4.+id*.3)+mod(aIndex,3.)*2.094;float r=.45+pow(uv.y,1.5)*3.;float centerAngle=id*2.3999+.3;vec3 p=vec3(cos(centerAngle)*(13.+id*2.)+cos(a)*r+h*.12*sin(uTime*.7+id),h,sin(centerAngle)*(13.+id*2.)+sin(a)*r);p+=vec3(cos(a),0,sin(a))*position.x*.7;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
    `varying vec2 vUv;varying float vIndex;uniform float uOpacity,uCount,uTime;${noiseGLSL}void main(){if(vIndex>=uCount)discard;float n=fbm(vec2(vUv.y*28.-uTime*2.,vIndex*3.+vUv.x));float a=pow(1.-abs(vUv.x*2.-1.),2.)*sin(vUv.y*3.14159)*n*uOpacity;gl_FragColor=vec4(.14,.17,.29,a*.45);}`,
    { uTime: { value: 0 }, uOpacity: { value: 0 }, uCount: { value: 3 } },
  );
  readonly mesh = new Mesh(this.g, this.material);
  constructor() {
    const p: number[] = [],
      uv: number[] = [],
      ids: number[] = [],
      idx: number[] = [];
    for (let k = 0; k < 15; k++) {
      const base = p.length / 3;
      for (let j = 0; j <= 100; j++)
        for (let s = 0; s < 2; s++) {
          p.push(s - 0.5, 0, 0);
          uv.push(s, j / 100);
          ids.push(k);
        }
      for (let j = 0; j < 100; j++) {
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
  update(t: number, count: number): void {
    this.g.setDrawRange(0, count * 3 * 100 * 6);
    const e = envelope(9.7, 10.9, 14, 16.5, t);
    this.mesh.visible = e > 0.001;
    this.material.uniforms.uTime.value = t;
    this.material.uniforms.uOpacity.value = e;
    this.material.uniforms.uCount.value = count;
  }
  dispose(): void {
    this.mesh.removeFromParent();
    this.g.dispose();
    this.material.dispose();
  }
}
