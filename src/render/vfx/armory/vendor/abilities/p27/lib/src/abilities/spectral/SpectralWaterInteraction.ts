// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { DoubleSide, Mesh, NormalBlending, PlaneGeometry, ShaderMaterial, Vector3 } from 'three';
import type { WaterInteractionManager } from '../../world/water/WaterInteractionManager';
import { SPECTRAL_NOISE_GLSL } from './SpectralPalette';
import { smooth } from './SpectralBreakConfig';
/** Temporary world-space pressure channel; shared water retains ownership of genuine reflections. */
export class SpectralWaterInteraction {
  readonly material = new ShaderMaterial({    
uniforms: { uTime: { value: 0 }, uLength: { value: 40 }, uFront: { value: 0 }, uStrength: { value: 0 }, uImpact: { value: 0 }, uDetail: { value: 1 } }, transparent: true, depthWrite: false, side: DoubleSide, blending: NormalBlending,
    vertexShader: `uniform float uTime,uLength,uFront,uStrength,uImpact;varying vec2 vUv;
    void main(){vUv=uv;float width=(1.+uv.y*5.)*uStrength;vec3 p=vec3(position.x*width,.055,uv.y*uLength);
     p.y+=sin(uv.y*45.-uTime*22.)*.06*uStrength*(1.-abs(position.x)*2.);
     gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
    fragmentShader: `uniform float uTime,uLength,uFront,uStrength,uImpact,uDetail;varying vec2 vUv;${SPECTRAL_NOISE_GLSL}
    void main(){float z=vUv.y*uLength,edge=abs(vUv.x*2.-1.);float n=noise3(vec3(vUv.x*10.,z*.8-uTime*10.,uTime*.2));
     float broken=smoothstep(.36,.68,n);float streak=pow(max(0.,sin(z*1.7-uTime*28.+n*4.)),4.);
     float vWake=pow(max(0.,1.-abs(edge-(.35+.18*sin(z*.1-uTime*2.)))*8.),3.);
     float alpha=(broken*.24+streak*.25+vWake*.32)*(1.-smoothstep(.7,1.,edge))*uStrength*(1.-smoothstep(uFront-.015,uFront+.008,vUv.y));
     vec3 color=mix(vec3(.005,.06,.14),vec3(.015,.65,.82),streak*.6+broken*.4);
     if(alpha<.008)discard;gl_FragColor=vec4(color,alpha);
    }`});
  readonly mesh = new Mesh(new PlaneGeometry(1, 1, 18, 96), this.material);
  readonly impactMaterial = new ShaderMaterial({    
uniforms: { uTime: { value: 0 }, uAge: { value: 0 }, uStrength: { value: 0 } }, transparent: true, depthWrite: false, side: DoubleSide,
    vertexShader: `uniform float uAge,uStrength;varying vec2 vUv;void main(){vUv=uv;vec3 p=vec3(position.x*48.,.065,position.y*48.);float r=length(p.xz);float wave=exp(-pow((r-uAge*8.)/1.2,2.));p.y+=wave*.45*uStrength;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
    fragmentShader: `uniform float uTime,uAge,uStrength;varying vec2 vUv;${SPECTRAL_NOISE_GLSL}
    void main(){vec2 p=(vUv-.5)*48.;float r=length(p),a=atan(p.y,p.x);float n=noise3(vec3(p*.3,uTime));
     float crest=exp(-pow((r-uAge*8.+sin(a*7.)*.3)/.65,2.));float echo=exp(-pow((r-uAge*5.)/.9,2.));float residue=exp(-r*.17)*n*.09;
     float alpha=(crest*.6+echo*.27+residue)*uStrength*(1.-smoothstep(21.,24.,r));if(alpha<.007)discard;
     gl_FragColor=vec4(mix(vec3(.07,.018,.25),vec3(.03,.65,.9),crest),alpha);
    }`});
  readonly impactMesh = new Mesh(new PlaneGeometry(1, 1, 96, 96), this.impactMaterial);
  private emitted = 0;
  private impacted = false;
  private readonly p = new Vector3();
  constructor() { this.mesh.frustumCulled = false; this.impactMesh.frustumCulled = false; this.mesh.renderOrder = 2; this.impactMesh.renderOrder = 3; }
  update(t: number, origin: Vector3, target: Vector3, front: number, strength: number, after: number, sources: number, water?: WaterInteractionManager, owner?: object): void {
    const dx = target.x - origin.x, dz = target.z - origin.z, span = Math.hypot(dx, dz);
    this.mesh.position.set(origin.x, 0, origin.z); this.mesh.rotation.y = Math.atan2(dx, dz);
    this.mesh.visible = strength > .004 && Math.min(origin.y, target.y) < 5 && span > .2;
    const u = this.material.uniforms; u.uTime.value = t; u.uLength.value = span; u.uFront.value = front; u.uStrength.value = strength;
    this.impactMesh.position.set(target.x, 0, target.z); this.impactMesh.visible = target.y < 5 && t > 3.72 && after > .005;
    const impact = this.impactMaterial.uniforms; impact.uTime.value = t; impact.uAge.value = Math.max(0, t - 3.72); impact.uStrength.value = after;
    // Monotonic milestones avoid frame-dependent emission and do not reset on quality switches.
    if (water && this.mesh.visible) { while (this.emitted < 10 && front >= (this.emitted + 1) / 10) { const i = ++this.emitted; if (i <= sources) { this.p.lerpVectors(origin, target, i / 10).y = 0; water.addRipple({ position: this.p, strength: .17, duration: 2.1, waveSpeed: 5, wavelength: .8, radius: 9 }, owner); } } }
    if (water && !this.impacted && t >= 3.72 && target.y < 5) { this.impacted = true; this.p.set(target.x, 0, target.z); for (let i = 0; i < 3; i++)water.addRipple({ position: this.p, strength: .35 - i * .075, duration: 4.7 + i * .2, waveSpeed: 9 - i * 2, wavelength: 1.2 + i * .5, radius: 22 }, owner); }
    this.impactMesh.visible &&= (1 - smooth(7.2, 9, t)) > .001;
  }
  reset(): void { this.emitted = 0; this.impacted = false; this.mesh.visible = false; this.impactMesh.visible = false; }
  dispose(): void { this.mesh.geometry.dispose(); this.material.dispose(); this.impactMesh.geometry.dispose(); this.impactMaterial.dispose(); }
}
