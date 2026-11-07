// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { BufferGeometry, Float32BufferAttribute, Points, Vector3 } from "three";
import { stormMaterial } from "./StormShaderLibrary";
import { random } from "./StormDragonConfig";
/** One GPU batch, six distinct analytic velocity fields: dust, spray, tornadoes, beam streaks, dissolve fragments, ions. */
export class StormParticleSystem {
  readonly geometry = new BufferGeometry();
  readonly material = stormMaterial(
    `attribute vec4 aSeed;uniform float uTime,uStrength,uImpact,uDissolve,uPixel;uniform vec3 uMouth;varying float vAlpha,vKind;void main(){float k=mod(aSeed.w,6.);vKind=k;vec3 p=position;float t=uTime;float a=aSeed.x*6.283;float r=aSeed.y*27.;float life=fract(aSeed.z+t*.15);vAlpha=uStrength*.085;float size=1.5;
 if(k<.5){p=vec3(cos(a+t*.18)*r,life*18.,sin(a+t*.18)*r);vAlpha*=sin(life*3.1415);}
 else if(k<1.5){float age=max(0.,t-9.2-aSeed.z*.6);float v=1.-exp(-age*1.7);p=vec3(cos(a)*v*(6.+r*.7),max(.1,age*(14.+aSeed.y*12.)-age*age*7.),sin(a)*v*(6.+r*.7));vAlpha=uImpact*(1.-smoothstep(1.4,2.7,age));size=1.4;}
 else if(k<2.5){float h=life*12.,ta=a+t*3.;p=vec3(cos(ta)*(1.+h*.16)+cos(aSeed.w)*16.,h,sin(ta)*(1.+h*.16)+sin(aSeed.w)*16.);vAlpha*=smoothstep(9.,10.,t);}
 else if(k<3.5){float f=fract(aSeed.z+t*3.);p=mix(uMouth,vec3(0,.2,0),f)+vec3(cos(a+t*8.),sin(a+t*8.),0.)*.9;vAlpha=uImpact*.28;size=2.;}
 else if(k<4.5){p=vec3(cos(a)*(r*.6),8.+aSeed.z*7.+uDissolve*6.,-28.+sin(a)*r);vAlpha=uDissolve*uStrength*.55;size=2.4;}
 else{p=vec3(cos(a+t*.05)*r,.3+sin(life*3.1415)*2.,sin(a+t*.05)*r);vAlpha*=.5;}
 vec4 mv=modelViewMatrix*vec4(p,1.);gl_PointSize=min(5.,size*uPixel*100./max(1.,-mv.z));gl_Position=projectionMatrix*mv;}`,
    `varying float vAlpha,vKind;void main(){vec2 p=gl_PointCoord*2.-1.;float a=exp(-dot(p,p)*3.)*(1.-smoothstep(.6,1.,length(p)));vec3 c=vKind>3.5?vec3(.35,.2,.6):vec3(.17,.28,.4);gl_FragColor=vec4(c,a*vAlpha);}`,
    {
      uTime: { value: 0 },
      uStrength: { value: 0 },
      uImpact: { value: 0 },
      uDissolve: { value: 0 },
      uPixel: { value: 1 },
      uMouth: { value: new Vector3() },
    },
  );
  readonly points = new Points(this.geometry, this.material);
  constructor() {
    const rng = random(7913),
      seeds = new Float32Array(3200 * 4);
    for (let i = 0; i < 3200; i++) seeds.set([rng(), rng(), rng(), i], i * 4);
    this.geometry.setAttribute(
      "position",
      new Float32BufferAttribute(new Float32Array(3200 * 3), 3),
    );
    this.geometry.setAttribute("aSeed", new Float32BufferAttribute(seeds, 4));
    this.points.frustumCulled = false;
  }
  update(
    t: number,
    strength: number,
    impact: number,
    dissolve: number,
    count: number,
    mouth: Vector3,
    pixel: number,
  ): void {
    this.geometry.setDrawRange(0, count);
    const u = this.material.uniforms;
    u.uTime.value = t;
    u.uStrength.value = strength;
    u.uImpact.value = impact;
    u.uDissolve.value = dissolve;
    u.uMouth.value.copy(mouth);
    u.uPixel.value = pixel;
    this.points.visible = strength > 0.001;
  }
  dispose(): void {
    this.points.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
  }
}
