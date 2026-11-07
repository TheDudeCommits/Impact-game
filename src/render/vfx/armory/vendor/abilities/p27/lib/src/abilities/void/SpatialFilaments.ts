// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import {
  InstancedBufferGeometry,
  InstancedBufferAttribute,
  PlaneGeometry,
  Mesh,
} from "three";
import { voidMaterial } from "./VoidMaterials";
/** A bounded strip batch: short angled prefractures and curved edge-to-shard tension strands. */
export class SpatialFilaments {
  readonly geometry = new InstancedBufferGeometry();
  readonly material = voidMaterial(
    `attribute vec4 aSeed;varying vec2 vUv;varying float vLife,vSeed;uniform float uTime,uCount;
  void main(){vUv=uv;float seed=aSeed.x;vSeed=seed;float index=aSeed.w;float s=uv.y;float fracture=step(index,5.);float start=.7+seed*.35;float opening=smoothstep(start,start+.45,uTime);float pull=smoothstep(5.5,7.4,uTime);
   float angle=seed*32.;vec3 base=vec3(cos(angle)*(3.+seed*3.),2.+seed*13.,sin(angle)*3.);vec3 end=vec3(-base.x*.25,3.+seed*11.,-.4);
   vec3 p=mix(base,end,s);p+=vec3(sin(s*3.14159)*sin(angle)*2.,sin(s*6.28+angle)*.5,sin(s*3.14159)*2.);float tooth=sin(floor(s*18.)*3.7+angle)*.18*fracture;p.x+=tooth;p.z+=fracture*cos(floor(s*12.)*2.)*.14;
   if(fracture>.5)p=mix(base,end,.2+s*.45);p=mix(p,vec3(0,9.-smoothstep(6.6,7.5,uTime)*6.4,0),pow(pull,1.8));p.x+=position.x*.28;
   float close=smoothstep(8.+seed*.9,9.1+seed*.9,uTime);float reveal=smoothstep(0.,.08,s)*(1.-smoothstep(1.-close,1.-close+.05,s));
   gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);vLife=opening*reveal*(1.-smoothstep(9.2,10.5,uTime))*(fracture>.5?1.:.25+.65*pow(.5+.5*sin(uTime*2.+angle),3.));}`,
    `varying vec2 vUv;varying float vLife,vSeed;uniform float uTime;void main(){float x=abs(vUv.x-.5)*2.;float core=exp(-x*6.),halo=pow(1.-x,3.);float packet=exp(-pow((vUv.y-fract(uTime*.6+vSeed))*15.,2.));vec3 color=vec3(.5,.22,.95)*core+vec3(.18,.015,.5)*halo+vec3(.4,.5,.7)*packet*core;gl_FragColor=vec4(color,vLife);}`,
    { uTime: { value: 0 }, uCount: { value: 14 } },
  );
  readonly mesh = new Mesh(this.geometry, this.material);
  constructor() {
    const plane = new PlaneGeometry(1, 1, 1, 36);
    this.geometry.setAttribute(
      "position",
      plane.getAttribute("position").clone(),
    );
    this.geometry.setAttribute("uv", plane.getAttribute("uv").clone());
    this.geometry.setIndex(plane.index!.clone());
    plane.dispose();
    const data = new Float32Array(28 * 4);
    for (let i = 0; i < 28; i++)
      data.set([((i * 173 + 71) % 997) / 997, 0, 0, i], i * 4);
    this.geometry.setAttribute("aSeed", new InstancedBufferAttribute(data, 4));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 6;
  }
  update(t: number, count: number): void {
    this.geometry.instanceCount = count;
    this.material.uniforms.uTime.value = t;
    this.mesh.visible = t > 0.7 && t < 10.5;
  }
  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
