// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { InstancedMesh, PlaneGeometry, Object3D } from "three";
import { stormMaterial, noiseGLSL } from "./StormShaderLibrary";
import { random, envelope } from "./StormDragonConfig";
/** Low vapor layer follows impact pressure, then drifts and settles independently of the cloud ceiling. */
export class StormMistField {
  readonly material = stormMaterial(
    `attribute mat4 instanceMatrix;uniform float uTime;varying vec2 vUv;varying float vSeed;void main(){vUv=uv;vec3 c=(instanceMatrix*vec4(0,0,0,1)).xyz;vSeed=c.x+c.z;float age=max(0.,uTime-9.2);float a=uTime*.09+c.y*.2;c.xz=mat2(cos(a),-sin(a),sin(a),cos(a))*c.xz;c.xz*=.35+min(1.2,age*.5);c.y+=sin(uTime*.8+vSeed)*.25;vec4 mv=modelViewMatrix*vec4(c,1.);mv.xy+=position.xy*vec2(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz));gl_Position=projectionMatrix*mv;}`,
    `varying vec2 vUv;varying float vSeed;uniform float uTime,uOpacity;${noiseGLSL}void main(){vec2 p=vUv*2.-1.;float edge=1.-smoothstep(.3,1.,length(p));float n=fbm(p*3.+vec2(vSeed+uTime*.15,uTime*.07));float a=edge*smoothstep(.18,.7,n)*uOpacity;gl_FragColor=vec4(mix(vec3(.025,.035,.06),vec3(.14,.19,.25),n),a*.4);}`,
    { uTime: { value: 0 }, uOpacity: { value: 0 } },
    false,
  );
  readonly mesh = new InstancedMesh(new PlaneGeometry(1, 1), this.material, 36);
  constructor() {
    const rng = random(871),
      dummy = new Object3D();
    for (let i = 0; i < 36; i++) {
      const a = rng() * Math.PI * 2,
        r = 6 + rng() * 20;
      dummy.position.set(Math.cos(a) * r, 0.8 + rng() * 1.3, Math.sin(a) * r);
      dummy.scale.set(8 + rng() * 6, 2 + rng() * 2, 1);
      dummy.updateMatrix();
      this.mesh.setMatrixAt(i, dummy.matrix);
    }
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
  }
  update(t: number, count: number): void {
    const e = envelope(9.2, 10.3, 16, 18, t);
    this.mesh.count = count;
    this.mesh.visible = e > 0.001;
    this.material.uniforms.uTime.value = t;
    this.material.uniforms.uOpacity.value = e;
  }
  dispose(): void {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.mesh.dispose();
  }
}
