// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import {
  BufferGeometry,
  Float32BufferAttribute,
  InstancedBufferGeometry,
  InstancedBufferAttribute,
  Mesh,
} from "three";
import { voidMaterial } from "./VoidMaterials";
import type { VoidQuality } from "./WorldrendConfig";
/** Faceted triangular prisms occupy a volume; barycentric rims preserve the broken-space silhouette. */
export class RealityShards {
  readonly geometry = new InstancedBufferGeometry();
  readonly material = voidMaterial(
    `attribute vec4 aData;attribute vec3 aBary;attribute vec3 normal;varying vec3 vBary,vNormal;varying float vLife,vSeed,vMajor;uniform float uTime;
  mat2 spin(float a){return mat2(cos(a),-sin(a),sin(a),cos(a));}
  void main(){vBary=aBary;vSeed=aData.x;vMajor=aData.w;float seed=aData.x;float major=aData.w;float opening=smoothstep(1.1+seed*.6,2.7,uTime);float pull=smoothstep(5.45,7.45,uTime);float blast=smoothstep(7.55,8.2,uTime);float angle=seed*39.+uTime*(.08+seed*.11)+pull*2.3;
   float r=(major>.5?4.5+seed*3.5:5.+seed*8.);vec3 center=vec3(cos(angle)*r,(major>.5?1.2+seed*15.:.4+seed*13.),sin(angle)*r*.56);
   center.xz*=.5+opening*.5;center=mix(center,vec3(0,9.-smoothstep(6.6,7.5,uTime)*6.4,0),pow(pull,2.));if(major<.5)center+=vec3(cos(angle)*12.,sin(seed*28.)*6.,sin(angle)*12.)*blast;
   float size=major>.5?.38+seed*.82:.035+seed*.11;size*=opening*(1.-pull*.6);vec3 p=position*vec3(size,size*(1.2+seed),size);p.xz=spin(uTime*(.18+seed*.3)+seed*8.)*p.xz;p.xy=spin(seed*5.+uTime*.13)*p.xy;
   vNormal=normal;gl_Position=projectionMatrix*modelViewMatrix*vec4(p+center,1.);vLife=opening*(major>.5?1.-smoothstep(7.25,7.6,uTime):1.-smoothstep(8.6+seed,10.6,uTime));}`,
    `varying vec3 vBary,vNormal;varying float vLife,vSeed,vMajor;uniform float uTime;void main(){float edge=min(vBary.x,min(vBary.y,vBary.z));float rim=1.-smoothstep(.012,.045+fwidth(edge),edge);float facet=.012+.028*abs(vNormal.y);float pulse=.65+.35*sin(uTime*2.7+vSeed*31.);vec3 color=vec3(facet*.5,facet*.24,facet)+vec3(.34,.025,.8)*rim*(.8+pulse)*(vMajor>.5?.58:.12)+vec3(.2,.29,.4)*pow(rim,6.)*.18;gl_FragColor=vec4(color,vLife);}`,
    { uTime: { value: 0 } },
    false,
  );
  readonly mesh = new Mesh(this.geometry, this.material);
  constructor() {
    const corners = [
      [-0.8, -0.7, -0.16],
      [0.65, -0.45, -0.16],
      [0.16, 1, -0.16],
      [-0.8, -0.7, 0.16],
      [0.65, -0.45, 0.16],
      [0.16, 1, 0.16],
    ];
    const faces = [
        [0, 2, 1],
        [3, 4, 5],
        [0, 1, 4],
        [0, 4, 3],
        [1, 2, 5],
        [1, 5, 4],
        [2, 0, 3],
        [2, 3, 5],
      ],
      pos: number[] = [],
      bary: number[] = [];
    for (const face of faces)
      for (let j = 0; j < 3; j++) {
        pos.push(...corners[face[j]]);
        bary.push(j === 0 ? 1 : 0, j === 1 ? 1 : 0, j === 2 ? 1 : 0);
      }
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    this.geometry.setAttribute("position", g.getAttribute("position").clone());
    this.geometry.setAttribute("normal", g.getAttribute("normal").clone());
    this.geometry.setAttribute("aBary", new Float32BufferAttribute(bary, 3));
    g.dispose();
    this.geometry.setAttribute(
      "aData",
      new InstancedBufferAttribute(new Float32Array(484 * 4), 4),
    );
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 4;
  }
  configure(q: VoidQuality, seed: number): void {
    const data = this.geometry.getAttribute(
      "aData",
    ) as InstancedBufferAttribute;
    for (let i = 0; i < q.shards + q.fragments; i++)
      data.setXYZW(
        i,
        ((i * 193 + seed) % 991) / 991,
        0,
        0,
        i < q.shards ? 1 : 0,
      );
    data.needsUpdate = true;
    this.geometry.instanceCount = q.shards + q.fragments;
  }
  update(t: number): void {
    this.material.uniforms.uTime.value = t;
    this.mesh.visible = t > 1.1 && t < 10.6;
  }
  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
