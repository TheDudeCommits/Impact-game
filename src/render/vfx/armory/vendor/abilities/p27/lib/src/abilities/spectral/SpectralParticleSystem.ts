// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { AdditiveBlending, DoubleSide, InstancedBufferAttribute, InstancedMesh, Matrix4, PlaneGeometry, ShaderMaterial, Vector3 } from 'three';
import { SPECTRAL_PALETTE_GLSL } from './SpectralPalette';
/** Eight distinct categories, one fixed GPU buffer. Flakes/streaks have geometry, motes use soft coverage. */
export class SpectralParticleSystem {
  readonly mesh: InstancedMesh;
  readonly material: ShaderMaterial;
  constructor() {    
const maximum = 1600, g = new PlaneGeometry(1, 1); const seeds = new Float32Array(maximum * 4); for (let i = 0; i < maximum; i++) { seeds[i * 4] = (i * .61803398875) % 1; seeds[i * 4 + 1] = (i * .754877666) % 1; seeds[i * 4 + 2] = (i * .569840296) % 1; seeds[i * 4 + 3] = i % 8; }
    g.setAttribute('aSeed', new InstancedBufferAttribute(seeds, 4));
    this.material = new ShaderMaterial({      
uniforms: { uTime: { value: 0 }, uLength: { value: 40 }, uFront: { value: 0 }, uGravity: { value: new Vector3(0, -1, 0) } }, transparent: true, depthWrite: false, side: DoubleSide, blending: AdditiveBlending,
      vertexShader: `attribute vec4 aSeed;uniform float uTime,uLength,uFront;uniform vec3 uGravity;varying vec2 vUv;varying float vKind,vAlpha,vColor;
      void main(){vUv=uv;vKind=aSeed.w;vColor=aSeed.x;
       float t=uTime,kind=aSeed.w,angle=aSeed.y*6.2831853,cycle=fract(t*(.7+aSeed.z)+aSeed.x);vec3 p;float size=.035+aSeed.z*.09;vAlpha=1.;bool streak=false;
       if(kind<.5){float radius=(1.-cycle)*1.4;p=vec3(cos(angle)*radius,sin(angle)*radius,(aSeed.z-.5)*radius);vAlpha=smoothstep(0.,.3,t)*(1.-smoothstep(.98,1.1,t));}
       else if(kind<1.5){p=vec3(cos(angle)*(1.+aSeed.z*4.),sin(angle)*(1.+aSeed.z*4.),cycle*uLength);vAlpha=smoothstep(1.05,1.2,t)*(1.-smoothstep(4.2,5.7,t))*step(cycle,uFront);streak=true;}
       else if(kind<2.5){p=vec3(cos(angle+t)*3.,sin(angle+t)*3.,cycle*uLength);vAlpha=smoothstep(1.2,1.5,t)*(1.-smoothstep(4.2,6.4,t))*step(cycle,uFront);size*=1.8;}
       else if(kind<3.5){p=vec3(cos(angle)*4.,sin(angle)*4.,uFront*uLength+(cycle-.5)*2.);vAlpha=smoothstep(1.05,1.3,t)*(1.-smoothstep(3.8,5.,t));}
       else if(kind<4.5){p=vec3(cos(angle)*2.,sin(angle)*2.,cycle*uLength);vAlpha=smoothstep(1.4,1.7,t)*(1.-smoothstep(4.2,5.6,t))*step(cycle,uFront);size*=1.4;}
       else if(kind<5.5){float age=max(0.,t-3.72-aSeed.z*.3);vec3 velocity=vec3(cos(angle)*(3.+aSeed.z*10.),sin(angle)*(3.+aSeed.z*10.),(aSeed.x-.5)*10.);p=vec3(0,0,uLength)+velocity*age+uGravity*age*age*1.3;vAlpha=step(3.72+aSeed.z*.3,t)*(1.-smoothstep(.5,2.8,age));size*=3.;streak=true;}
       else if(kind<6.5){float age=max(0.,t-3.72-aSeed.x*.7);p=vec3(cos(angle)*age*7.,sin(angle)*age*7.,uLength+(aSeed.z-.5)*age*8.)-uGravity*(age*5.-age*age*4.);vAlpha=step(3.72+aSeed.x*.7,t)*(1.-smoothstep(.4,1.8,age));size*=.6;}
       else{float age=max(0.,t-4.5);p=vec3(cos(angle+age*.13)*(2.+aSeed.x*9.),sin(angle+age*.13)*(2.+aSeed.x*6.),uLength*(.4+aSeed.z*.6));vAlpha=smoothstep(4.4,5.,t)*(1.-smoothstep(7.,9.,t));size*=.7;}
       vAlpha*=sin(cycle*3.14159)*sin(cycle*3.14159);
       vec4 mv=modelViewMatrix*vec4(p,1.);
       if(streak){vec3 offset=vec3(position.x*size,0.,position.y*(kind<2.?2.5:1.));mv=modelViewMatrix*vec4(p+offset,1.);}
       else mv.xy+=position.xy*size;
       gl_Position=projectionMatrix*mv;
      }`,
      fragmentShader: `varying vec2 vUv;varying float vKind,vAlpha,vColor;${SPECTRAL_PALETTE_GLSL}
      void main(){vec2 q=vUv*2.-1.;float alpha;
       if(vKind==2.||vKind==4.||vKind==5.)alpha=1.-smoothstep(.15,1.,abs(q.x)+abs(q.y)*.5);
       else if(vKind==1.)alpha=pow(1.-abs(q.x),2.)*pow(1.-abs(q.y),.6);
       else alpha=pow(max(0.,1.-dot(q,q)),2.);
       alpha*=vAlpha;if(alpha<.015)discard;vec3 color=spectralColor(vColor);
       if(vKind==4.)color=vec3(.02,.01,.09);if(vKind==6.)color=vec3(.12,.5,.7);
       gl_FragColor=vec4(color*1.8,alpha);
      }`});
    this.mesh = new InstancedMesh(g, this.material, maximum); const identity = new Matrix4(); for (let i = 0; i < maximum; i++)this.mesh.setMatrixAt(i, identity); this.mesh.frustumCulled = false; this.mesh.renderOrder = 16;
  }
  update(t: number, length: number, front: number, gravity: Vector3): void { const u = this.material.uniforms; u.uTime.value = t; u.uLength.value = length; u.uFront.value = front; u.uGravity.value.copy(gravity); }
  dispose(): void { this.mesh.geometry.dispose(); this.material.dispose(); this.mesh.dispose(); }
}
