// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  Vector3,
} from "three";
import { breathMaterial } from "./DragonBreathMaterials";
import { stormMaterial } from "./StormShaderLibrary";
import { smooth } from "./StormDragonConfig";
export class DragonBreathBeam {
  readonly root = new Group();
  readonly direction = new Vector3();
  readonly coreMaterial = breathMaterial(0);
  readonly shellMaterial = breathMaterial(1);
  readonly pressureMaterial = breathMaterial(2);
  readonly geometry = new BufferGeometry();
  readonly ribbonGeometry = new BufferGeometry();
  readonly ribbonsMaterial = stormMaterial(
    `attribute float aIndex;uniform float uTime,uLength,uCount;varying vec2 vUv;varying float vIndex;void main(){vUv=uv;vIndex=aIndex;float a=uv.y*35.-uTime*18.+aIndex*6.283/uCount;float r=1.7+uv.y*1.3;vec3 p=vec3(cos(a)*(r+position.x*.22),uv.y*uLength,sin(a)*(r+position.x*.22));gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
    `varying vec2 vUv;varying float vIndex;uniform float uOpacity,uCount;void main(){if(vIndex>=uCount)discard;float edge=pow(1.-abs(vUv.x*2.-1.),2.);float flow=.55+.45*sin(vUv.y*42.);gl_FragColor=vec4(.34,.43,.85,edge*flow*uOpacity*.6);}`,
    {
      uTime: { value: 0 },
      uLength: { value: 1 },
      uCount: { value: 4 },
      uOpacity: { value: 0 },
    },
  );
  constructor() {
    const p: number[] = [],
      uv: number[] = [],
      indices: number[] = [],
      N = 96,
      S = 24;
    for (let j = 0; j <= N; j++)
      for (let i = 0; i <= S; i++) {
        p.push(0, 0, 0);
        uv.push(i / S, j / N);
      }
    for (let j = 0; j < N; j++)
      for (let i = 0; i < S; i++) {
        const a = j * (S + 1) + i,
          b = a + S + 1;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    this.geometry.setAttribute("position", new Float32BufferAttribute(p, 3));
    this.geometry.setAttribute("uv", new Float32BufferAttribute(uv, 2));
    this.geometry.setIndex(indices);
    for (const [mat, r] of [
      [this.coreMaterial, 0.58],
      [this.shellMaterial, 1.5],
      [this.pressureMaterial, 3.4],
    ] as const) {
      mat.uniforms.uRadius.value = r;
      const mesh = new Mesh(this.geometry, mat);
      mesh.frustumCulled = false;
      this.root.add(mesh);
    }
    const rp: number[] = [],
      ruv: number[] = [],
      ri: number[] = [],
      idx: number[] = [];
    for (let k = 0; k < 7; k++) {
      const base = rp.length / 3;
      for (let j = 0; j <= 120; j++)
        for (let side = 0; side < 2; side++) {
          rp.push(side - 0.5, 0, 0);
          ruv.push(side, j / 120);
          ri.push(k);
        }
      for (let j = 0; j < 120; j++) {
        const a = base + j * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    this.ribbonGeometry.setAttribute(
      "position",
      new Float32BufferAttribute(rp, 3),
    );
    this.ribbonGeometry.setAttribute("uv", new Float32BufferAttribute(ruv, 2));
    this.ribbonGeometry.setAttribute(
      "aIndex",
      new Float32BufferAttribute(ri, 1),
    );
    this.ribbonGeometry.setIndex(idx);
    const ribbon = new Mesh(this.ribbonGeometry, this.ribbonsMaterial);
    ribbon.frustumCulled = false;
    this.root.add(ribbon);
  }
  update(
    t: number,
    strength: number,
    mouth: Vector3,
    count: number,
    detail: number,
  ): void {
    this.ribbonGeometry.setDrawRange(0, count * 120 * 6);
    this.root.visible = strength > 0.001;
    this.root.position.copy(mouth);
    this.direction.copy(mouth).negate();
    this.direction.y += 0.25;
    const length = this.direction.length();
    this.direction.divideScalar(Math.max(0.001, length));
    this.root.quaternion.setFromUnitVectors(UP, this.direction);
    for (const mat of [
      this.coreMaterial,
      this.shellMaterial,
      this.pressureMaterial,
    ]) {
      const u = mat.uniforms;
      u.uTime.value = t;
      u.uLength.value = length;
      u.uOpacity.value = strength;
      u.uReveal.value = smooth(8.8, 9.2, t);
      u.uDetail.value = detail;
    }
    const u = this.ribbonsMaterial.uniforms;
    u.uTime.value = t;
    u.uLength.value = length * smooth(8.8, 9.2, t);
    u.uCount.value = count;
    u.uOpacity.value = strength;
    this.root.children[2].visible = detail > 0;
  }
  dispose(): void {
    this.root.removeFromParent();
    this.geometry.dispose();
    this.ribbonGeometry.dispose();
    for (const m of [
      this.coreMaterial,
      this.shellMaterial,
      this.pressureMaterial,
      this.ribbonsMaterial,
    ])
      m.dispose();
  }
}
const UP = new Vector3(0, 1, 0);
