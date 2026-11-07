// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { BufferGeometry, Float32BufferAttribute, Points, Vector3 } from "three";
import type { ShaderMaterial } from "three";
import { electricalMaterial } from "./LightningMaterials";
import { VERDICT } from "./verdictConfig";

const vertex = `attribute vec4 aSeed;varying float vAlpha,vMode,vSeed;uniform float uAge,uTime,uMode,uPixel,uSeed,uFlash;uniform vec3 uHand;
void main(){vec4 s=fract(aSeed+uSeed*vec4(0.00013,0.00017,0.00019,0.00023));float age=max(0.0,uAge);float angle=s.x*6.28318;
  vec3 p;float alpha;vMode=uMode;vSeed=s.w;
  if(uMode>2.5){float cycle=fract(s.y+uTime*2.3);float r=(1.0-cycle)*0.27;p=uHand+vec3(cos(angle+uTime*5.0)*r,(s.z-0.5)*r,sin(angle+uTime*5.0)*r);alpha=sin(cycle*3.14159)*(1.0-smoothstep(0.85,1.05,uTime));}
  else if(uMode>1.5){float r=1.0+s.y*8.0;p=vec3(cos(angle+age*0.12)*r,0.2+s.z*2.0+age*0.15,sin(angle+age*0.12)*r);alpha=smoothstep(0.1,0.4,age)*(1.0-smoothstep(2.6,4.6,age))*(0.15+0.6*step(0.86,fract(sin(floor(uTime*9.0)+s.w*27.0)*43758.5453)));}
  else if(uMode>0.5){float speed=3.0+s.y*8.0;p=vec3(cos(angle)*speed*age,0.15+(2.0+s.z*5.0)*age-6.0*age*age,sin(angle)*speed*age);alpha=smoothstep(0.0,0.03,age)*(1.0-smoothstep(0.3,1.1,age))*step(0.05,p.y);}
  else{float r=(1.0-exp(-age*3.8))*(2.0+s.y*11.0);p=vec3(cos(angle)*r,0.1+s.z*5.0*sin(min(3.14159,age*2.3)),sin(angle)*r);alpha=smoothstep(0.0,0.025,age)*(1.0-smoothstep(0.3,1.6,age));}
  vec4 mv=modelViewMatrix*vec4(p,1.0);gl_Position=projectionMatrix*mv;gl_PointSize=clamp((uMode<0.5?2.5:1.3+s.w*2.0)*uPixel*30.0/max(1.0,-mv.z),1.0,uMode<0.5?13.0:7.0);
  vAlpha=alpha*(uMode>2.5?1.0:step(0.0,uAge));}`;
const fragment = `varying float vAlpha,vMode,vSeed;uniform float uFlash;void main(){vec2 p=(gl_PointCoord-0.5)*2.0;float r=dot(p,p);float mask=exp(-r*4.0)*(1.0-smoothstep(0.6,1.0,r));
  if(vMode<0.5&&vSeed>0.68){p.x*=4.0;mask=exp(-dot(p,p)*3.0)*(1.0-smoothstep(0.4,1.0,r));}
  vec3 color=vMode>1.5?vec3(0.12,0.4,1.0):vMode>0.5?vec3(0.43,0.72,0.94):mix(vec3(0.25,0.64,1.0),vec3(1.8),vSeed);
  gl_FragColor=vec4(color*(1.0+uFlash*2.0),mask*vAlpha*0.8);}`;
interface Emitter {
  points: Points<BufferGeometry, ShaderMaterial>;
  count: number;
}
export class ElectricParticleSystem {
  readonly emitters: Emitter[] = [];
  constructor() {
    for (const [mode, capacity] of [
      [0, 450],
      [1, 260],
      [2, 160],
      [3, 80],
    ]) {
      const geometry = new BufferGeometry(),
        seeds = new Float32Array(capacity * 4);
      for (let i = 0; i < seeds.length; i++) {
        const n = Math.sin(i * 127.1 + mode * 311.7 + 71.2) * 43758.5453;
        seeds[i] = n - Math.floor(n);
      }
      geometry.setAttribute(
        "position",
        new Float32BufferAttribute(new Float32Array(capacity * 3), 3),
      );
      geometry.setAttribute("aSeed", new Float32BufferAttribute(seeds, 4));
      const material = electricalMaterial(vertex, fragment, {
        uAge: { value: -1 },
        uTime: { value: 0 },
        uMode: { value: mode },
        uPixel: { value: 1 },
        uSeed: { value: 1 },
        uFlash: { value: 0 },
        uHand: { value: new Vector3() },
      });
      const points = new Points(geometry, material);
      points.frustumCulled = false;
      points.renderOrder = 4;
      this.emitters.push({ points, count: 0 });
    }
  }
  configure(total: number, pixel: number, seed: number): void {
    const drift = Math.floor(total * 0.18),
      burst = total - drift,
      fast = Math.floor(burst * 0.65);
    const counts = [
      fast,
      burst - fast,
      drift,
      Math.min(80, Math.floor(total * 0.085)),
    ];
    for (let i = 0; i < 4; i++) {
      const e = this.emitters[i];
      e.count = counts[i];
      e.points.geometry.setDrawRange(0, e.count);
      const u = e.points.material.uniforms;
      u.uPixel.value = pixel;
      u.uSeed.value = seed;
    }
  }
  update(age: number, hand: Vector3, flash: number): void {
    for (let i = 0; i < 4; i++) {
      const e = this.emitters[i];
      const material = e.points.material;
      material.uniforms.uAge.value = age - VERDICT.strike;
      material.uniforms.uTime.value = age;
      material.uniforms.uHand.value.copy(hand);
      material.uniforms.uFlash.value = flash;
      e.points.visible =
        i === 3
          ? age < VERDICT.strike
          : i === 2
            ? age >= VERDICT.strike && age < 5.65
            : age >= VERDICT.strike && age < 2.65;
    }
  }
  get count(): number {
    let count = 0;
    for (const e of this.emitters) if (e.points.visible) count += e.count;
    return count;
  }
  dispose(): void {
    for (const e of this.emitters) {
      e.points.geometry.dispose();
      e.points.material.dispose();
      e.points.removeFromParent();
    }
  }
}
