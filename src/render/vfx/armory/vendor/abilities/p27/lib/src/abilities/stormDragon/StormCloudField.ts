// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { InstancedMesh, PlaneGeometry, Object3D } from "three";
import { stormMaterial, noiseGLSL } from "./StormShaderLibrary";
import { random } from "./StormDragonConfig";
export class StormCloudField {
  readonly material = stormMaterial(
    `attribute mat4 instanceMatrix;uniform float uTime,uStrength;varying vec2 vUv;varying float vSeed;void main(){vUv=uv;vec3 c=(instanceMatrix*vec4(0,0,0,1)).xyz;vSeed=c.x*.14+c.z*.13;float a=uTime*(.025+mod(abs(c.y),3.)*.007);c.xz=mat2(cos(a),-sin(a),sin(a),cos(a))*c.xz;c.xz*=1.4-uStrength*.4;c.y+=sin(uTime*.5+vSeed)*.8;vec4 center=modelViewMatrix*vec4(c,1.);vec2 size=vec2(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz));center.xy+=position.xy*size;gl_Position=projectionMatrix*center;}`,
    `varying vec2 vUv;varying float vSeed;uniform float uTime,uStrength,uFlash,uDetail;${noiseGLSL}void main(){vec2 p=vUv*2.-1.;float r=length(p);float n=fbm(p*(3.+uDetail)+vec2(uTime*.08+vSeed,uTime*.04));float edge=1.-smoothstep(.45,1.,r);float a=edge*smoothstep(.14,.7,n)*uStrength*.75;float light=pow(max(0.,1.-r),2.)*(.1+uFlash*.55)*(n+.2);vec3 col=vec3(.021,.025,.043)+vec3(.13,.075,.23)*light+vec3(.22,.34,.49)*uFlash*n*.16;gl_FragColor=vec4(col,a);}`,
    {
      uTime: { value: 0 },
      uStrength: { value: 0 },
      uFlash: { value: 0 },
      uDetail: { value: 1 },
    },
    false,
  );
  readonly mesh = new InstancedMesh(new PlaneGeometry(1, 1), this.material, 80);
  constructor() {
    const rng = random(8184),
      dummy = new Object3D();
    for (let i = 0; i < 80; i++) {
      const a = rng() * Math.PI * 2,
        r = 12 + rng() * 26;
      dummy.position.set(
        Math.cos(a) * r,
        19 + rng() * 14,
        Math.sin(a) * r - 10,
      );
      dummy.scale.set(16 + rng() * 15, 8 + rng() * 8, 1);
      dummy.updateMatrix();
      this.mesh.setMatrixAt(i, dummy.matrix);
    }
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
  }
  update(
    t: number,
    strength: number,
    count: number,
    detail: number,
    flash: number,
  ): void {
    this.mesh.count = count;
    this.mesh.visible = strength > 0.001;
    const u = this.material.uniforms;
    u.uTime.value = t;
    u.uStrength.value = strength;
    u.uDetail.value = detail;
    u.uFlash.value = flash;
  }
  dispose(): void {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.mesh.dispose();
  }
}
