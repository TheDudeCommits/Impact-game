// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { InstancedBufferGeometry, Mesh, PlaneGeometry } from "three";
import type { BeamStrikeSequence } from "./BeamStrikeSequence";
import { radiantMaterial, holyNoise } from "./RadiantMaterials";
/** Two batched camera-facing strips per strike: concentrated optical column and broad atmospheric shaft. */
export class LightBeam {
  readonly geometry = new InstancedBufferGeometry();
  readonly material = radiantMaterial(
    `attribute vec3 aOffset;attribute vec4 aTiming;varying vec2 vUv;varying vec4 vTiming;uniform float uShaft;
    void main(){vUv=uv;vTiming=aTiming;vec4 a=modelViewMatrix*vec4(aOffset+vec3(0,.05,0),1),b=modelViewMatrix*vec4(aOffset+vec3(0,aTiming.w,0),1);
    vec2 n=normalize(vec2(-(b.y-a.y),b.x-a.x));vec4 p=mix(a,b,uv.y);
    float taper=mix(.42,1.2,uv.y);float width=mix(1.15*aTiming.z,4.5+uv.y*3.5,uShaft);
    p.xy+=n*(uv.x-.5)*width*taper;gl_Position=projectionMatrix*p;}`,
    `${holyNoise}varying vec2 vUv;varying vec4 vTiming;uniform float uTime,uDetail,uShaft;
    void main(){float t=uTime-vTiming.x,x=abs(vUv.x*2.-1.);
    float anticipation=smoothstep(-.16,-.045,t)*(1.-smoothstep(-.04,0.,t))*.055;
    float beam=smoothstep(0.,.018,t)*(1.-smoothstep(vTiming.y*.42,vTiming.y,t));
    float after=smoothstep(.02,.10,t)*exp(-max(0.,t-vTiming.y)*5.)*.045;
    float descend=step(1.-vUv.y,clamp(t/.022,0.,1.));
    float pixel=max(.028,fwidth(vUv.x)*1.2);float core=exp(-x*x/max(0.0015,pixel*pixel)),body=exp(-x*x/.023),halo=pow(max(0.,1.-x),3.4);
    float braid=.24+.025*sin(vUv.y*53.-uTime*28.);float diffraction=exp(-pow((x-braid)/.012,2.));
    float packets=pow(max(0.,cos(vUv.y*68.+uTime*68.)),18.)*exp(-x*x/.05);
    float flow=.78+.22*sin(vUv.y*92.-uTime*48.);float facets=.84+.16*sin(vUv.y*24.+uTime*8.+noise(vUv*vec2(11,32))*2.);
    vec3 color=vec3(1,.98,.89)*(core*11.+packets*1.1)+vec3(1,.79,.45)*(body*2.5*flow+diffraction*.9)+vec3(.62,.73,1.)*halo*.16;
    float intensity=(beam*descend+anticipation+after)*facets;
    if(uShaft>.5){float build=smoothstep(.55,1.15,uTime)*(1.-smoothstep(2.9,4.4,uTime));
      float rays=pow(.5+.5*sin(vUv.x*43.+noise(vUv*9.)*2.),4.);
      color=mix(vec3(.16,.3,.52),vec3(.74,.66,.45),vUv.y);
      intensity=(build*.028+beam*.12)*halo*(.45+rays*.55)*(1.-smoothstep(.85,1.,vUv.y))*(.6+uDetail*.2);}
    gl_FragColor=vec4(color,clamp(intensity*halo,0.,1.));}`,
    { uTime: { value: 0 }, uDetail: { value: 1 }, uShaft: { value: 0 } },
  );
  readonly shaftMaterial = this.material.clone();
  readonly mesh = new Mesh(this.geometry, this.material);
  readonly shafts = new Mesh(this.geometry, this.shaftMaterial);
  constructor(sequence: BeamStrikeSequence) {
    const plane = new PlaneGeometry(1, 1);
    this.geometry.setAttribute(
      "position",
      plane.getAttribute("position").clone(),
    );
    this.geometry.setAttribute("uv", plane.getAttribute("uv").clone());
    this.geometry.setIndex(plane.index!.clone());
    plane.dispose();
    this.geometry.setAttribute("aOffset", sequence.offsetAttribute);
    this.geometry.setAttribute("aTiming", sequence.timingAttribute);
    this.shaftMaterial.uniforms.uShaft.value = 1;
    this.mesh.frustumCulled = this.shafts.frustumCulled = false;
    this.mesh.renderOrder = 8;
    this.shafts.renderOrder = 3;
  }
  update(age: number, count: number, detail: number): void {
    this.geometry.instanceCount = count;
    this.material.uniforms.uTime.value =
      this.shaftMaterial.uniforms.uTime.value = age;
    this.material.uniforms.uDetail.value =
      this.shaftMaterial.uniforms.uDetail.value = detail;
    this.mesh.visible = age > 0.5 && age < 4.4;
    this.shafts.visible = age > 0.45 && age < 4.4;
  }
  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    this.shaftMaterial.dispose();
  }
}
