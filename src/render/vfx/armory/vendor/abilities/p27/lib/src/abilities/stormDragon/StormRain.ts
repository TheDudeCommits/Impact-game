// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { BufferGeometry, Float32BufferAttribute, Mesh } from "three";
import { stormMaterial } from "./StormShaderLibrary";
import { random } from "./StormDragonConfig";
export class StormRain {
  readonly g = new BufferGeometry();
  readonly material = stormMaterial(
    `attribute vec3 aSeed;uniform float uTime;varying vec2 vUv;void main(){vUv=uv;vec3 p=vec3(aSeed.x*65.-32.5,fract(aSeed.y-uTime*.8)*30.,aSeed.z*65.-32.5);p.x+=p.y*.16*sin(uTime*.4);vec4 mv=modelViewMatrix*vec4(p,1.);mv.xy+=vec2(position.x*.018,position.y*.7);gl_Position=projectionMatrix*mv;}`,
    `varying vec2 vUv;uniform float uOpacity;void main(){float a=(1.-abs(vUv.x*2.-1.))*sin(vUv.y*3.14159);gl_FragColor=vec4(.3,.42,.6,a*uOpacity);}`,
    { uTime: { value: 0 }, uOpacity: { value: 0 } },
  );
  readonly mesh = new Mesh(this.g, this.material);
  constructor() {
    const rng = random(528),
      p: number[] = [],
      uv: number[] = [],
      seed: number[] = [];
    const quad = [
      -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5,
    ];
    for (let i = 0; i < 900; i++) {
      const s = [rng(), rng(), rng()];
      for (let j = 0; j < 6; j++) {
        p.push(quad[j * 2], quad[j * 2 + 1], 0);
        uv.push(quad[j * 2] + 0.5, quad[j * 2 + 1] + 0.5);
        seed.push(...s);
      }
    }
    this.g.setAttribute("position", new Float32BufferAttribute(p, 3));
    this.g.setAttribute("uv", new Float32BufferAttribute(uv, 2));
    this.g.setAttribute("aSeed", new Float32BufferAttribute(seed, 3));
    this.mesh.frustumCulled = false;
  }
  update(t: number, strength: number, count: number, flash: number): void {
    this.g.setDrawRange(0, count * 6);
    this.material.uniforms.uTime.value = t;
    this.material.uniforms.uOpacity.value = strength * (0.035 + flash * 0.14);
    this.mesh.visible = strength > 0.001;
  }
  dispose(): void {
    this.mesh.removeFromParent();
    this.g.dispose();
    this.material.dispose();
  }
}
