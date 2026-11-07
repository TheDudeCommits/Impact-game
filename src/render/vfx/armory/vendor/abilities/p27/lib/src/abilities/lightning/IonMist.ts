// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import {
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  PlaneGeometry,
} from "three";
import { electricalMaterial, electricalNoise } from "./LightningMaterials";
import { dischargeIntensity, VERDICT } from "./verdictConfig";

export class IonMist {
  private readonly geometry = new PlaneGeometry(1, 1);
  private readonly material = electricalMaterial(
    `attribute float aSeed;varying vec2 vUv;varying float vSeed;uniform float uAge;
    void main(){vUv=uv;vSeed=aSeed;float age=max(0.0,uAge);float a=aSeed*47.0+age*0.25;
      float radius=0.3+(1.0-exp(-age*3.2))*(2.5+aSeed*6.2);
      vec3 center=vec3(cos(a)*radius,0.35+aSeed*0.5+age*0.15,sin(a)*radius);
      vec4 p=modelViewMatrix*vec4(center,1.0);p.xy+=position.xy*vec2(2.0+age*1.8,0.85+age*0.8);gl_Position=projectionMatrix*p;}`,
    `varying vec2 vUv;varying float vSeed;uniform float uAge,uFlash,uDetail;${electricalNoise}
    void main(){vec2 p=(vUv-0.5)*2.0;float r=dot(p,p),age=max(0.0,uAge);vec2 flow=vUv*4.0+vSeed*23.0;
      flow+=vec2(sin(flow.y*3.0+age),cos(flow.x*2.0-age))*0.2;float cloud=fbm(flow+age*0.1);
      float alpha=exp(-r*3.0)*(1.0-smoothstep(0.5,1.0,r))*smoothstep(0.1,0.64,cloud)*smoothstep(0.0,0.05,age)*(1.0-smoothstep(0.8,3.7,age))*0.35*step(0.0,uAge);
      vec3 color=vec3(0.21,0.39,0.6)+vec3(0.4,0.6,0.9)*(uFlash*2.0+cloud*0.12);
      gl_FragColor=vec4(color,alpha);}`,
    { uAge: { value: -1 }, uFlash: { value: 0 }, uDetail: { value: 1 } },
    false,
  );
  readonly mesh: InstancedMesh;
  constructor() {
    const seeds = new Float32Array(24);
    for (let i = 0; i < 24; i++)
      seeds[i] = (Math.sin(i * 127.1 + 12.7) * 43758.5453) % 1;
    for (let i = 0; i < 24; i++) seeds[i] = Math.abs(seeds[i]);
    this.geometry.setAttribute("aSeed", new InstancedBufferAttribute(seeds, 1));
    this.mesh = new InstancedMesh(this.geometry, this.material, 24);
    const identity = new Matrix4();
    for (let i = 0; i < 24; i++) this.mesh.setMatrixAt(i, identity);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
  }
  update(age: number, detail: number): void {
    this.material.uniforms.uAge.value = age - VERDICT.strike;
    this.material.uniforms.uFlash.value = dischargeIntensity(age);
    this.material.uniforms.uDetail.value = detail;
    this.mesh.visible = age >= VERDICT.strike && age < 4.8;
  }
  dispose(): void {
    this.mesh.dispose();
    this.geometry.dispose();
    this.material.dispose();
  }
}
