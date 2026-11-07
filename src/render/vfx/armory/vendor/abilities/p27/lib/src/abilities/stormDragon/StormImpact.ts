// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { Group, Mesh, SphereGeometry, PlaneGeometry } from "three";
import { stormMaterial, noiseGLSL } from "./StormShaderLibrary";
import { envelope } from "./StormDragonConfig";
export class StormImpact {
  readonly root = new Group();
  readonly material = stormMaterial(
    `uniform float uTime;varying vec2 vUv;varying vec3 vP;void main(){vUv=uv;vP=position;vec3 p=position;float age=max(0.,uTime-9.2);p*=1.+age*15.;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
    `varying vec2 vUv;varying vec3 vP;uniform float uTime,uOpacity;${noiseGLSL}void main(){float n=fbm(vUv*12.+uTime*3.);float cells=pow(max(0.,sin(vUv.x*77.+vUv.y*19.+n*7.-uTime*18.)),14.);float rim=pow(1.-abs(vP.y),3.);gl_FragColor=vec4(vec3(.13,.09,.38)+vec3(.3,.7,1.2)*cells,(rim*.13+cells*.2)*uOpacity);}`,
    { uTime: { value: 0 }, uOpacity: { value: 0 } },
  );
  readonly dome = new Mesh(
    new SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    this.material,
  );
  readonly plumeMaterial = stormMaterial(
    `uniform float uTime;varying vec2 vUv;void main(){vUv=uv;vec3 p=position;p.x*=1.+sin(uv.y*21.-uTime*12.)*.15;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
    `varying vec2 vUv;uniform float uTime,uOpacity;${noiseGLSL}void main(){float n=fbm(vec2(vUv.x*9.,vUv.y*12.-uTime*3.));float a=pow(1.-abs(vUv.x*2.-1.),2.)*sin(vUv.y*3.14159)*n;vec3 c=mix(vec3(.035,.06,.1),vec3(.32,.49,.66),n);gl_FragColor=vec4(c,a*uOpacity*.7);}`,
    { uTime: { value: 0 }, uOpacity: { value: 0 } },
  );
  readonly plumes: Mesh[] = [];
  constructor() {
    this.root.add(this.dome);
    const g = new PlaneGeometry(1, 1, 8, 18);
    for (let i = 0; i < 6; i++) {
      const mesh = new Mesh(g, this.plumeMaterial);
      mesh.rotation.y = (i * Math.PI) / 3;
      this.root.add(mesh);
      this.plumes.push(mesh);
    }
  }
  update(t: number): void {
    const age = t - 9.2,
      power = envelope(9.2, 9.3, 10.1, 11, t);
    this.root.visible = power > 0.001;
    this.dome.visible = age < 1.1;
    this.material.uniforms.uTime.value = t;
    this.material.uniforms.uOpacity.value = power;
    this.plumeMaterial.uniforms.uTime.value = t;
    this.plumeMaterial.uniforms.uOpacity.value = power;
    for (let i = 0; i < 6; i++) {
      const h = 12 * (1 - Math.exp(-Math.max(0, age) * 5)) * (1 - i * 0.07);
      this.plumes[i].scale.set(5 + i * 0.7, h, 1);
      this.plumes[i].position.set(
        Math.cos(i * 2.4) * (1 + Math.max(0, age) * 2),
        h * 0.5,
        Math.sin(i * 2.4) * (1 + Math.max(0, age) * 2),
      );
    }
  }
  dispose(): void {
    this.root.removeFromParent();
    this.dome.geometry.dispose();
    this.plumes[0].geometry.dispose();
    this.material.dispose();
    this.plumeMaterial.dispose();
  }
}
