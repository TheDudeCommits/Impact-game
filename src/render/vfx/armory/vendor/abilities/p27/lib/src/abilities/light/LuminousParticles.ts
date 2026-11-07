// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { BufferGeometry, Float32BufferAttribute, Points } from "three";
import type { ShaderMaterial } from "three";
import type { BeamStrikeSequence } from "./BeamStrikeSequence";
import { radiantMaterial, holyNoise } from "./RadiantMaterials";
class RadiantEmitter {
  readonly geometry = new BufferGeometry();
  readonly material: ShaderMaterial;
  readonly points: Points;
  count = 0;
  constructor(
    readonly capacity: number,
    readonly kind: number,
  ) {
    const seeds = new Float32Array(capacity * 4);
    for (let i = 0; i < capacity; i++) {
      seeds[i * 4] = ((i * 73 + 19) % 997) / 997;
      seeds[i * 4 + 1] = ((i * 137 + 41) % 991) / 991;
      seeds[i * 4 + 2] = ((i * 193 + 81) % 983) / 983;
      seeds[i * 4 + 3] = i % 12;
    }
    this.geometry.setAttribute(
      "position",
      new Float32BufferAttribute(new Float32Array(capacity * 3), 3),
    );
    this.geometry.setAttribute("aData", new Float32BufferAttribute(seeds, 4));
    this.material = radiantMaterial(
      `attribute vec4 aData;varying float vAlpha,vSeed;varying vec3 vColor;uniform float uTime,uKind,uRatio,uCount;uniform vec3 uOffsets[12];uniform vec4 uTimings[12];
  void main(){int idx=int(mod(aData.w,uCount));vec4 timing=uTimings[idx];float t=uTime-timing.x;float a=aData.x*6.283185,r=aData.y;
  vec3 p=uOffsets[idx];float opacity=0.,size=1.;vSeed=aData.z;
  if(uKind<.5){float birth=.3+aData.z*.7,life=uTime-birth;float radius=1.2+r*5.6;
    p=vec3(cos(a+uTime*.12)*radius,.12+max(0.,life)*(.2+r*.7),sin(a+uTime*.12)*radius);
    opacity=smoothstep(0.,.5,life)*(1.-smoothstep(4.4,6.8,uTime))*(.22+.6*aData.z);size=1.3+1.5*r;vColor=mix(vec3(.45,.61,.83),vec3(1.,.89,.65),aData.z);}
  else if(uKind<1.5){float travel=(1.-exp(-max(0.,t)*2.8))/2.8;float speed=3.+r*9.;p+=vec3(cos(a)*travel*speed,.1+(2.+aData.z*6.)*travel-t*t*.85,sin(a)*travel*speed);
    opacity=step(0.,t)*(1.-smoothstep(.35,1.8,t))*smoothstep(-.2,.05,p.y);size=1.2+r*2.2;vColor=mix(vec3(.5,.64,.85),vec3(1.,.94,.76),aData.z);}
  else{float travel=(1.-exp(-max(0.,t)*1.8))/1.8;p+=vec3(cos(a)*travel*(1.+r*6.),.2+travel*(.5+aData.z*1.3),sin(a)*travel*(1.+r*6.));
    opacity=step(0.,t)*smoothstep(0.,.12,t)*(1.-smoothstep(.6,2.4,t))*.11;size=(70.+r*100.)*(.3+travel);vColor=mix(vec3(.28,.40,.59),vec3(.8,.75,.61),aData.z);}
  vAlpha=opacity;vec4 v=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*v;gl_PointSize=min(220.,size*uRatio*(uKind>1.5?12./max(2.,-v.z):clamp(18./max(2.,-v.z),.6,2.)));}`,
      `${holyNoise}varying float vAlpha,vSeed;varying vec3 vColor;uniform float uKind,uTime;
  void main(){vec2 p=gl_PointCoord-.5;float r=length(p)*2.;float mask=pow(max(0.,1.-r*r),uKind>1.5?2.:1.5);
    if(uKind>1.5)mask*=smoothstep(.1,.8,noise(p*6.+vec2(vSeed*70.,uTime*.3)));
    gl_FragColor=vec4(vColor*(uKind<1.5?1.6:1.),mask*vAlpha);}`,
      {
        uTime: { value: 0 },
        uKind: { value: kind },
        uRatio: { value: 1 },
        uCount: { value: 1 },
        uOffsets: { value: Array.from({ length: 12 }, () => [0, 0, 0]) },
        uTimings: { value: Array.from({ length: 12 }, () => [0, 1, 1, 23]) },
      },
    );
    // Typed uniform arrays are filled at configuration, never allocated by the frame loop.
    this.material.uniforms.uOffsets.value = new Float32Array(36);
    this.material.uniforms.uTimings.value = new Float32Array(48);
    this.points = new Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 6;
  }
  configure(count: number, sequence: BeamStrikeSequence, ratio: number): void {
    this.count = count;
    this.geometry.setDrawRange(0, count);
    (this.material.uniforms.uOffsets.value as Float32Array).set(
      sequence.offsets,
    );
    (this.material.uniforms.uTimings.value as Float32Array).set(
      sequence.timings,
    );
    this.material.uniforms.uCount.value = sequence.count;
    this.material.uniforms.uRatio.value = ratio;
  }
  update(age: number): void {
    this.material.uniforms.uTime.value = age;
    this.points.visible =
      this.kind === 0 ? age > 0.3 && age < 6.8 : age >= 1.3 && age < 5;
  }
  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
export class LuminousParticles {
  readonly dust = new RadiantEmitter(450, 0);
  readonly burst = new RadiantEmitter(450, 1);
  readonly mist = new RadiantEmitter(28, 2);
  readonly emitters = [this.dust, this.burst, this.mist];
  get count(): number {
    let count = 0;
    for (const e of this.emitters) if (e.points.visible) count += e.count;
    return count;
  }
  configure(
    budget: number,
    mist: number,
    sequence: BeamStrikeSequence,
    ratio: number,
  ): void {
    const dust = Math.floor((budget - mist) * 0.51);
    this.dust.configure(dust, sequence, ratio);
    this.burst.configure(budget - mist - dust, sequence, ratio);
    this.mist.configure(mist, sequence, ratio);
  }
  update(age: number): void {
    for (const e of this.emitters) e.update(age);
  }
  dispose(): void {
    for (const e of this.emitters) e.dispose();
  }
}
