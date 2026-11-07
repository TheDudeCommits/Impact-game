// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { Vector3 } from "three";
import { stormMaterial, noiseGLSL } from "./StormShaderLibrary";
const vertex = `attribute vec3 normal;uniform float uTime,uFlex;varying vec3 vP,vN;varying vec2 vUv;void main(){vUv=uv;vec3 p=position;p.y+=sin(p.x*.6+uTime*2.)*uFlex*uv.y;vP=p;vN=normalize(mat3(modelViewMatrix)*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`;
const fragment = `varying vec3 vP,vN;varying vec2 vUv;uniform float uTime,uCharge,uDissolve,uDetail,uKind;${noiseGLSL}
void main(){float n=fbm(vP.xz*.72+vP.y*.31);float mask=n*.48+.24+abs(vP.x)*.012-vP.z*.005;if(mask<uDissolve)discard;float edge=1.-smoothstep(uDissolve,uDissolve+.06,mask);float rim=pow(1.-abs(normalize(vN).z),2.5);float diffuse=max(0.,dot(normalize(vN),normalize(vec3(-.4,.7,.5))));float cells=abs(sin(vUv.x*28.+sin(vUv.y*36.)*.6)*sin(vUv.y*36.));float scale=(1.-smoothstep(.08,.24,cells))*uDetail;float vein=pow(max(0.,sin(vUv.x*31.+sin(vUv.y*13.)*2.+uTime*.8)),24.)*(.1+uCharge*.65);vec3 base=mix(vec3(.01,.014,.024),vec3(.022,.02,.032),n);if(uKind>.5)base*=.65;vec3 c=base*(.6+diffuse*2.3)+rim*vec3(.055,.045,.11)+scale*.008+vein*vec3(.18,.1,.4)+edge*vec3(.24,.18,.55);gl_FragColor=vec4(c,1.);}`;
export class DragonMaterials {
  readonly body = stormMaterial(
    vertex,
    fragment,
    {
      uTime: { value: 0 },
      uCharge: { value: 0 },
      uDissolve: { value: 0 },
      uDetail: { value: 1 },
      uKind: { value: 0 },
      uFlex: { value: 0 },
    },
    false,
    true,
  );
  readonly wing = this.body.clone();
  readonly horn = this.body.clone();
  readonly eye = stormMaterial(
    "void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    "uniform float uGlow;void main(){gl_FragColor=vec4(vec3(.5,.2,1.4)*uGlow,1.);}",
    { uGlow: { value: 1 } },
  );
  readonly mouth = stormMaterial(
    "varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    `varying vec3 vP;uniform float uGlow,uTime;${noiseGLSL}void main(){float n=fbm(vP.xy*5.+uTime*3.);gl_FragColor=vec4(mix(vec3(.15,.06,.45),vec3(1.4,2.,2.4),n)*uGlow,.8);}`,
    { uGlow: { value: 0 }, uTime: { value: 0 } },
  );
  readonly view = new Vector3();
  constructor() {
    this.wing.uniforms.uKind.value = 1;
    this.wing.uniforms.uFlex.value = 0.12;
    this.horn.uniforms.uKind.value = 2;
  }
  update(t: number, charge: number, dissolve: number, detail: number): void {
    for (const m of [this.body, this.wing, this.horn]) {
      m.uniforms.uTime.value = t;
      m.uniforms.uCharge.value = charge;
      m.uniforms.uDetail.value = detail;
      m.uniforms.uDissolve.value =
        dissolve * (m === this.wing ? 1.25 : m === this.horn ? 0.88 : 1);
    }
    this.eye.uniforms.uGlow.value =
      (0.8 + charge * 2) * (1 - Math.max(0, (dissolve - 0.7) / 0.3));
    this.mouth.uniforms.uGlow.value = charge * 3;
    this.mouth.uniforms.uTime.value = t;
  }
  dispose(): void {
    for (const m of [this.body, this.wing, this.horn, this.eye, this.mouth])
      m.dispose();
  }
}
export function disposeMeshes(root: import("three").Object3D): void {
  const geometries = new Set<import("three").BufferGeometry>();
  root.traverse((o) => {
    if ("geometry" in o) geometries.add((o as import("three").Mesh).geometry);
  });
  for (const g of geometries) g.dispose();
}
