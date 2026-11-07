// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import {
  InstancedBufferGeometry,
  InstancedBufferAttribute,
  Mesh,
  PlaneGeometry,
} from "three";
import { voidMaterial, noiseGLSL } from "./VoidMaterials";
/** Local volume of curved translucent veils. Procedural refraction-like contours, no scene color copy. */
export class SpatialAtmosphere {
  readonly geometry = new InstancedBufferGeometry();
  readonly material = voidMaterial(
    `attribute vec4 aSeed;varying vec2 vUv;varying float vLife,vSeed;uniform float uTime,uDetail;
 void main(){vUv=uv;float seed=aSeed.x;vSeed=seed;float pull=smoothstep(5.3,7.4,uTime);float blast=smoothstep(7.55,8.35,uTime);float angle=seed*29.+uTime*.08+pull*1.7;float r=4.+aSeed.y*9.;vec3 p=vec3(cos(angle)*r,.2+aSeed.z*7.,sin(angle)*r*.6);p=mix(p,vec3(0,9.-smoothstep(6.6,7.5,uTime)*6.4,0),pull*.8);p.xz+=vec2(cos(angle),sin(angle))*blast*10.;vec4 view=modelViewMatrix*vec4(p,1.);float size=3.+seed*3.;view.xy+=(uv-.5)*vec2(size,size*.68);view.x+=sin(uv.y*10.+uTime*3.+seed*30.)*.14*uDetail;gl_Position=projectionMatrix*view;vLife=smoothstep(.5,1.6,uTime)*(1.-smoothstep(8.4,10.9,uTime));}`,
    `${noiseGLSL}varying vec2 vUv;varying float vLife,vSeed;uniform float uTime,uDetail;void main(){vec2 p=(vUv-.5)*2.;float soft=pow(max(0.,1.-dot(p,p)),2.);float n=fbm(p*3.+vec2(vSeed*29.,-uTime*.14));float contours=exp(-abs(n-.5)*35.)*uDetail*.09;vec3 color=vec3(.055,.025,.1)*n+vec3(.12,.11,.21)*contours;gl_FragColor=vec4(color,soft*vLife*(.19+n*.18));}`,
    { uTime: { value: 0 }, uDetail: { value: 1 } },
    false,
  );
  readonly mesh = new Mesh(this.geometry, this.material);
  constructor() {
    const p = new PlaneGeometry(1, 1, 3, 3);
    this.geometry.setAttribute("position", p.getAttribute("position").clone());
    this.geometry.setAttribute("uv", p.getAttribute("uv").clone());
    this.geometry.setIndex(p.index!.clone());
    p.dispose();
    const data = new Float32Array(28 * 4);
    for (let i = 0; i < 28; i++)
      data.set(
        [
          ((i * 167 + 63) % 991) / 991,
          ((i * 53 + 39) % 983) / 983,
          ((i * 47 + 15) % 977) / 977,
          i,
        ],
        i * 4,
      );
    this.geometry.setAttribute("aSeed", new InstancedBufferAttribute(data, 4));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
  }
  update(t: number, count: number, detail: number): void {
    this.geometry.instanceCount = count;
    this.material.uniforms.uTime.value = t;
    this.material.uniforms.uDetail.value = detail;
    this.mesh.visible = t > 0.5 && t < 10.9;
  }
  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
