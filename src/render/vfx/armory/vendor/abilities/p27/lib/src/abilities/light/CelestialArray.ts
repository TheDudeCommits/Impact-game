// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import {
  InstancedBufferGeometry,
  Mesh,
  OctahedronGeometry,
  PlaneGeometry,
} from "three";
import type { BeamStrikeSequence } from "./BeamStrikeSequence";
import { radiantMaterial, holyNoise, envelope } from "./RadiantMaterials";
const vertex = `attribute vec3 aOffset;attribute vec4 aTiming;varying vec2 vUv;varying vec3 vP;varying float vPulse;uniform float uTime,uLens;
void main(){vUv=uv;float rotate=uTime*.34+aTiming.x;float c=cos(rotate),s=sin(rotate);vec3 p=position;
if(uLens>.5){p=vec3((uv.x-.5)*3.3,0.,(uv.y-.5)*3.3);}else{p*=vec3(.40,1.0,.40);}
p.xz=mat2(c,-s,s,c)*p.xz;vP=p; p+=aOffset+vec3(0,aTiming.w+sin(uTime*1.7+aTiming.x)*.10,0);
vPulse=exp(-abs(uTime-aTiming.x)*14.);gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`;
export class CelestialArray {
  readonly prismGeometry = new InstancedBufferGeometry();
  readonly lensGeometry = new InstancedBufferGeometry();
  readonly material = radiantMaterial(
    vertex,
    `${holyNoise}${envelope}varying vec2 vUv;varying vec3 vP;varying float vPulse;uniform float uTime,uLens,uDetail;
 void main(){float build=smoothstep(.42,1.05,uTime)*fade(uTime);float r=length(vUv-.5)*2.;
 float ring=exp(-pow((r-.76)/.024,2.))+exp(-pow((r-.91)/.008,2.))*.4;
 float a=atan(vUv.y-.5,vUv.x-.5);float glyph=pow(max(0.,cos(a*6.+uTime*.3)),22.)*exp(-pow((r-.55)/.06,2.));
 float facet=abs(sin(vP.x*12.+vP.y*7.+vP.z*9.));vec3 color=mix(vec3(.22,.40,.64),vec3(1.,.9,.65),facet);
 float opacity=uLens>.5?(ring+glyph*.5)*(.25+vPulse):(.12+facet*.38+vPulse*.4);
 gl_FragColor=vec4(color*(1.4+vPulse*2.),opacity*build);}`,
    { uTime: { value: 0 }, uLens: { value: 0 }, uDetail: { value: 1 } },
  );
  readonly lensMaterial = this.material.clone();
  readonly prisms = new Mesh(this.prismGeometry, this.material);
  readonly lenses = new Mesh(this.lensGeometry, this.lensMaterial);
  constructor(sequence: BeamStrikeSequence) {
    const sources = [new OctahedronGeometry(1, 0), new PlaneGeometry(1, 1)];
    for (const [i, g] of [this.prismGeometry, this.lensGeometry].entries()) {
      const source = sources[i];
      g.setAttribute("position", source.getAttribute("position").clone());
      g.setAttribute("uv", source.getAttribute("uv").clone());
      if (source.index) g.setIndex(source.index.clone());
      g.setAttribute("aOffset", sequence.offsetAttribute);
      g.setAttribute("aTiming", sequence.timingAttribute);
      source.dispose();
    }
    this.lensMaterial.uniforms.uLens.value = 1;
    this.prisms.frustumCulled = this.lenses.frustumCulled = false;
    this.prisms.renderOrder = this.lenses.renderOrder = 4;
  }
  update(age: number, count: number, detail: number): void {
    this.prismGeometry.instanceCount = this.lensGeometry.instanceCount = count;
    this.material.uniforms.uTime.value =
      this.lensMaterial.uniforms.uTime.value = age;
    this.material.uniforms.uDetail.value =
      this.lensMaterial.uniforms.uDetail.value = detail;
    this.prisms.visible = this.lenses.visible = age > 0.42 && age < 6.8;
  }
  dispose(): void {
    this.prismGeometry.dispose();
    this.lensGeometry.dispose();
    this.material.dispose();
    this.lensMaterial.dispose();
  }
}
