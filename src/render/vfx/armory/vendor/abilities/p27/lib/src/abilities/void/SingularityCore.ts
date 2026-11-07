// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { IcosahedronGeometry, Mesh } from "three";
import { voidMaterial, noiseGLSL } from "./VoidMaterials";
import { smooth } from "./WorldrendConfig";
export class SingularityCore {
  readonly geometry = new IcosahedronGeometry(1, 2);
  readonly material = voidMaterial(
    `attribute vec3 normal;varying vec3 vNormal,vView,vPosition;uniform float uTime;void main(){vec3 p=position*(1.+.09*sin(position.y*13.+uTime*22.));vec4 view=modelViewMatrix*vec4(p,1.);vPosition=p;vView=normalize(-view.xyz);vNormal=normalize(mat3(modelViewMatrix)*normal);gl_Position=projectionMatrix*view;}`,
    `${noiseGLSL}varying vec3 vNormal,vView,vPosition;uniform float uTime,uIntensity;void main(){float fresnel=pow(1.-abs(dot(normalize(vNormal),normalize(vView))),3.);float pressure=fbm(vPosition.xy*5.+uTime*2.);vec3 color=vec3(.003,.001,.01)+vec3(.65,.42,1.3)*fresnel*(1.5+pressure*2.)+vec3(.2,.01,.5)*exp(-abs(pressure-.52)*60.)*.3;gl_FragColor=vec4(color*uIntensity,1.);}`,
    { uTime: { value: 0 }, uIntensity: { value: 1 } },
    false,
  );
  readonly mesh = new Mesh(this.geometry, this.material);
  constructor() {
    this.mesh.position.y = 9;
    this.mesh.renderOrder = 5;
  }
  update(t: number): void {
    this.mesh.visible = t > 6.98 && t < 7.95;
    this.mesh.position.y = 9 - smooth(6.6, 7.5, t) * 6.4;
    const scale =
      (0.32 + smooth(6.98, 7.26, t) * 0.95) * (1 - smooth(7.55, 7.95, t));
    this.mesh.scale.setScalar(Math.max(0.005, scale));
    this.material.uniforms.uTime.value = t;
    this.material.uniforms.uIntensity.value =
      1 + Math.exp(-(((t - 7.55) * 18) ** 2)) * 4;
  }
  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
