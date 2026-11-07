// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { Mesh, PlaneGeometry } from "three";
import {
  radiantMaterial,
  planeVertex,
  holyNoise,
  envelope,
} from "./RadiantMaterials";
/** Analytic lines, interrupted glyph strokes and nested sacred polygons; no runtime texture allocation. */
export class TargetMark {
  readonly geometry = new PlaneGeometry(19, 19);
  readonly material = radiantMaterial(
    planeVertex,
    `${holyNoise}${envelope}varying vec2 vUv;uniform float uTime,uDetail;
 float line(float d,float w){w=max(w,fwidth(d)*.8);return exp(-d*d/(w*w));}
 void main(){vec2 p=(vUv-.5)*19.;float r=length(p),a=atan(p.y,p.x),t=uTime;
 float reveal=smoothstep(.16,.60,t);float outer=line(r-6.6,.035)+line(r-6.36,.012)*.5;
 float cell=mod(a+3.14159,1.0472)-.5236;float hex=r*cos(cell);
 float poly=line(hex-4.6,.025)+line(r*cos(mod(a+.5236+3.14159,1.0472)-.5236)-4.6,.025);
 float inner=line(r-2.0,.018)*.65+line(r-1.7,.012)*.3;
 float radial=line(sin(a*6.)*r,.018)*smoothstep(2.1,2.3,r)*(1.-smoothstep(6.1,6.3,r))*.32;
 float glyphA=mod(a+3.14159,.261799)-.1309;
 float glyph=line(abs(glyphA)*r-.16,.026)*smoothstep(5.48,5.55,r)*(1.-smoothstep(5.84,5.92,r));
 glyph+=line(r-5.7,.02)*step(.045,abs(glyphA))*step(abs(glyphA),.10);
 float ticking=line(r-6.85,.022)*pow(max(0.,cos(a*48.)),30.);
 float detail=step(.5,uDetail);float strokes=outer+poly*.7+inner+radial+detail*(glyph*.65+ticking*.5);
 float front=1.-smoothstep(reveal*7.5,reveal*7.5+.3,r);
 float impact=exp(-max(0.,t-1.3)*7.)*step(1.3,t);
 float glow=exp(-r*r/27.)*(.009+impact*.075);
 vec3 color=mix(vec3(.25,.39,.56),vec3(1.,.83,.52),clamp(strokes,0.,1.));
 float opacity=(strokes*(.36+impact*.4)+glow)*front*reveal*fade(t);
 gl_FragColor=vec4(color*1.4,opacity*(1.-smoothstep(8.5,9.4,r)));}`,
    { uTime: { value: 0 }, uDetail: { value: 1 } },
  );
  readonly mesh = new Mesh(this.geometry, this.material);
  constructor() {
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.y = 0.052;
    this.mesh.renderOrder = 2;
  }
  update(age: number, detail: number): void {
    this.material.uniforms.uTime.value = age;
    this.material.uniforms.uDetail.value = detail;
    this.mesh.visible = age > 0.15 && age < 6.8;
  }
  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
