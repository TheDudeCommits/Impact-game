// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import {
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  OctahedronGeometry,
} from "three";
import type { BeamStrikeSequence } from "./BeamStrikeSequence";
import { radiantMaterial } from "./RadiantMaterials";
const COUNTS = [12, 28, 48] as const;
/** Tiny drifting refractive splinters: a fourth particle language, separate from dust, impact motes and mist. */
export class PrismaticFragments {
  readonly geometry = new InstancedBufferGeometry();
  readonly material = radiantMaterial(
    `attribute vec4 aSeed;varying vec3 vFacet;varying float vAlpha;uniform float uTime,uCount;uniform vec3 uOffsets[12];uniform vec4 uTimings[12];
 void main(){int idx=int(mod(aSeed.w,uCount));float t=uTime-uTimings[idx].x;float a=aSeed.x*6.283185;float travel=(1.-exp(-max(0.,t)*1.3))/1.3;
 float radius=(1.+aSeed.y*5.)*travel;vec3 origin=uOffsets[idx]+vec3(cos(a)*radius,.18+(1.+aSeed.z*3.)*travel+sin(max(0.,t)*2.)*.2,sin(a)*radius);
 float spin=uTime*(.4+aSeed.y)+a;mat2 turn=mat2(cos(spin),-sin(spin),sin(spin),cos(spin));vec3 p=position*vec3(.035,.12,.025)*(1.+aSeed.z);p.xy=turn*p.xy;p.xz=turn*p.xz;
 vFacet=position;vAlpha=step(0.,t)*smoothstep(0.,.2,t)*(1.-smoothstep(1.1,3.,t));gl_Position=projectionMatrix*modelViewMatrix*vec4(origin+p,1.);}`,
    `varying vec3 vFacet;varying float vAlpha;uniform float uTime;
 void main(){float facet=abs(sin(vFacet.x*2.+vFacet.y*3.+vFacet.z*4.+uTime*.3));vec3 color=mix(vec3(.18,.36,.6),vec3(1.,.91,.72),facet);gl_FragColor=vec4(color*1.6,(.12+facet*.5)*vAlpha);}`,
    {
      uTime: { value: 0 },
      uCount: { value: 1 },
      uOffsets: { value: new Float32Array(36) },
      uTimings: { value: new Float32Array(48) },
    },
  );
  readonly mesh = new Mesh(this.geometry, this.material);
  constructor() {
    const source = new OctahedronGeometry(1);
    this.geometry.setAttribute(
      "position",
      source.getAttribute("position").clone(),
    );
    this.geometry.setAttribute("uv", source.getAttribute("uv").clone());
    if (source.index) this.geometry.setIndex(source.index.clone());
    source.dispose();
    const seeds = new Float32Array(48 * 4);
    for (let i = 0; i < 48; i++)
      seeds.set(
        [
          ((i * 137 + 9) % 983) / 983,
          ((i * 193 + 91) % 991) / 991,
          ((i * 73 + 21) % 997) / 997,
          i % 12,
        ],
        i * 4,
      );
    this.geometry.setAttribute("aSeed", new InstancedBufferAttribute(seeds, 4));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
  }
  configure(detail: number, sequence: BeamStrikeSequence): void {
    this.geometry.instanceCount = COUNTS[detail];
    this.material.uniforms.uCount.value = sequence.count;
    (this.material.uniforms.uOffsets.value as Float32Array).set(
      sequence.offsets,
    );
    (this.material.uniforms.uTimings.value as Float32Array).set(
      sequence.timings,
    );
  }
  update(age: number): void {
    this.material.uniforms.uTime.value = age;
    this.mesh.visible = age >= 1.3 && age < 5.5;
  }
  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
