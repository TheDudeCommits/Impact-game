// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import {
  Group,
  InstancedMesh,
  InstancedBufferAttribute,
  Matrix4,
  PlaneGeometry,
  Mesh,
} from "three";
import {
  electricalMaterial,
  electricalNoise,
  surfaceVertex,
} from "./LightningMaterials";
import { dischargeIntensity, pulse, smooth } from "./verdictConfig";

/** Layered localized cloud mass and a rotating ionized eye; no skybox or opaque sphere. */
export class StormVolume {
  readonly root = new Group();
  readonly clouds: InstancedMesh;
  private readonly geometry = new PlaneGeometry(1, 1);
  private readonly material = electricalMaterial(
    `attribute float aSeed;varying vec2 vUv;varying float vSeed;uniform float uTime;
    void main(){vUv=uv;vSeed=aSeed;float angle=aSeed*23.0+uTime*0.35;
      float radius=1.0+aSeed*3.2;float fringe=1.0-step(0.25,aSeed);
      vec3 center=vec3(cos(angle)*radius,mix(12.5+aSeed*6.0,7.8+aSeed*4.0,fringe),sin(angle)*radius);
      vec4 p=modelViewMatrix*vec4(center,1.0);p.xy+=position.xy*vec2(8.0+aSeed*4.0,mix(7.0+aSeed*2.0,4.5,fringe));gl_Position=projectionMatrix*p;}`,
    `varying vec2 vUv;varying float vSeed;uniform float uTime,uOpacity,uFlash,uDetail,uSeed;${electricalNoise}
    void main(){vec2 p=(vUv-0.5)*2.0;float r=dot(p,p);vec2 flow=vUv*3.8+vSeed*31.0;
      flow+=vec2(sin(flow.y*2.0+uTime*0.8),cos(flow.x*2.0-uTime*0.7))*0.32;
      float cloud=fbm(flow+vec2(uTime*0.08,-uTime*0.035)+uSeed);if(uDetail>1.5)cloud+=noise(flow*6.0-uTime*0.17)*0.09;
      float alpha=smoothstep(0.22,0.62,cloud)*exp(-r*1.5)*(1.0-smoothstep(0.58,1.0,r))*uOpacity*0.65;
      float illumination=exp(-dot(p-vec2(sin(vSeed*14.0)*0.4,-0.35),p-vec2(sin(vSeed*14.0)*0.4,-0.35))*4.0)*uFlash;
      vec3 color=mix(vec3(0.012,0.028,0.053),vec3(0.07,0.12,0.19),cloud)+vec3(0.15,0.36,0.67)*illumination;
      gl_FragColor=vec4(color,alpha);}`,
    {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uFlash: { value: 0 },
      uDetail: { value: 1 },
      uSeed: { value: 0 },
    },
    false,
  );
  private readonly eyeGeometry = new PlaneGeometry(15, 15);
  private readonly eyeMaterial = electricalMaterial(
    surfaceVertex,
    `varying vec2 vUv;uniform float uTime,uOpacity,uFlash;${electricalNoise}
    void main(){vec2 p=(vUv-0.5)*2.0;float r=length(p),a=atan(p.y,p.x);float n=fbm(p*4.0+vec2(uTime*0.1));
      float spiral=pow(max(0.0,sin(a*3.0+r*11.0-uTime*1.8)),4.0)*exp(-pow((r-0.44)/0.28,2.0));
      float alpha=spiral*(0.02+uFlash*0.07)*uOpacity*(1.0-smoothstep(0.7,1.0,r));gl_FragColor=vec4(vec3(0.06,0.2,0.42)*(0.4+n),alpha);}`,
    { uTime: { value: 0 }, uOpacity: { value: 0 }, uFlash: { value: 0 } },
  );
  private readonly eye = new Mesh(this.eyeGeometry, this.eyeMaterial);
  constructor() {
    const seeds = new Float32Array(10);
    for (let i = 0; i < 10; i++) seeds[i] = (i * 0.61803398875) % 1;
    this.geometry.setAttribute("aSeed", new InstancedBufferAttribute(seeds, 1));
    this.clouds = new InstancedMesh(this.geometry, this.material, 10);
    const identity = new Matrix4();
    for (let i = 0; i < 10; i++) this.clouds.setMatrixAt(i, identity);
    this.clouds.frustumCulled = false;
    this.clouds.renderOrder = 2;
    this.eye.rotation.x = -Math.PI / 2;
    this.eye.position.y = 18.5;
    this.eye.renderOrder = 3;
    this.root.add(this.clouds, this.eye);
  }
  setQuality(count: number, detail: number, seed: number): void {
    this.clouds.count = count;
    this.material.uniforms.uDetail.value = detail;
    this.material.uniforms.uSeed.value = (seed % 8192) * 0.007;
  }
  update(age: number): void {
    const opacity = smooth(0.38, 0.85, age) * (1 - smooth(2.6, 5.7, age));
    this.root.visible = opacity > 0.001;
    const flash =
      pulse(age, 0.55, 0.08) * 0.24 +
      pulse(age, 0.735, 0.07) * 0.66 +
      pulse(age, 0.875, 0.06) * 0.35 +
      dischargeIntensity(age) * 2;
    this.material.uniforms.uTime.value = age;
    this.material.uniforms.uOpacity.value = opacity;
    this.material.uniforms.uFlash.value = flash;
    this.eyeMaterial.uniforms.uTime.value = age;
    this.eyeMaterial.uniforms.uOpacity.value = opacity;
    this.eyeMaterial.uniforms.uFlash.value = flash;
  }
  dispose(): void {
    this.clouds.dispose();
    this.geometry.dispose();
    this.material.dispose();
    this.eyeGeometry.dispose();
    this.eyeMaterial.dispose();
  }
}
