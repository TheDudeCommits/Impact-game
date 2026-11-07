// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { AdditiveBlending, DoubleSide, InstancedBufferAttribute, InstancedMesh, Matrix4, NormalBlending, ShaderMaterial } from 'three';
import { spectralStrip } from './SpectralBeamGeometry';
import { SPECTRAL_PALETTE_GLSL } from './SpectralPalette';
export type RibbonMode = 'ribbon' | 'fracture' | 'pressure';
/** One draw per category; fixed UV strips deform in the GPU, with no per-frame topology writes. */
export class SpectralRibbons {
  readonly mesh: InstancedMesh;
  readonly material: ShaderMaterial;
  constructor(readonly mode: RibbonMode, readonly maximum: number) {
    const geometry = spectralStrip(mode === 'pressure' ? 80 : 64);
    geometry.setAttribute('aSeed', new InstancedBufferAttribute(Float32Array.from({ length: maximum }, (_, i) => (i * .61803398875 + .13) % 1), 1));
    const kind = mode === 'fracture' ? 1 : mode === 'pressure' ? 2 : 0;
    this.material = new ShaderMaterial({      
uniforms: { uTime: { value: 0 }, uLength: { value: 40 }, uFront: { value: 1 }, uStrength: { value: 0 }, uCollapse: { value: 0 }, uMode: { value: kind } }, transparent: true, depthWrite: mode === 'fracture', side: DoubleSide, blending: mode === 'fracture' ? NormalBlending : AdditiveBlending,
      vertexShader: `attribute float aSeed;uniform float uTime,uLength,uFront,uStrength,uCollapse,uMode;varying vec2 vUv;varying float vSeed,vZ;
      void main(){vUv=uv;vSeed=aSeed;float cycle=fract(uTime*(.39+aSeed*.25)+aSeed),z;vec3 p;
       if(uMode>1.5){z=cycle*uLength;float a=uv.x*6.2831853;
        float r=(1.7+cycle*3.)*(1.+.1*sin(a*5.+aSeed*30.+uTime*8.));
        p=vec3(cos(a)*r,sin(a)*r*.82,z+(uv.y-.5)*(.1+aSeed*.14)+sin(a*3.+uTime*6.)*.12);
       }else{float extent=uMode>.5?.16:.36;z=(cycle-extent*.5+uv.x*extent)*uLength;
        float a=aSeed*34.+z*(.09+aSeed*.08)-uTime*(.8+aSeed);
        float r=(uMode>.5?1.8:2.5)+aSeed*2.+sin(z*.21-uTime*9.+aSeed*22.)*.48;
        r*=smoothstep(0.,.1,z/max(uLength,.2));
        if(uMode<.5)r*=1.+uCollapse*(.7+aSeed);
        float width=uMode>.5?.10+aSeed*.18:.055+aSeed*.14;
        float taper=pow(max(0.,sin(uv.x*3.14159)),.65);
        float jag=uMode>.5?sin(floor(uv.x*19.)*7.3+aSeed*30.)*.17:0.;
        p=vec3(cos(a)*r,sin(a)*r,z)+vec3(-sin(a),cos(a),0.)*((uv.y-.5)*width*taper+jag);
       }
       vZ=z/uLength;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
      }`,
      fragmentShader: `uniform float uTime,uFront,uStrength,uCollapse,uMode;varying vec2 vUv;varying float vSeed,vZ;${SPECTRAL_PALETTE_GLSL}
      void main(){if(vZ<0.||vZ>uFront)discard;
       float tips=pow(max(0.,sin(vUv.x*3.14159)),.5),edge=1.-abs(vUv.y*2.-1.);
       float alpha=tips*edge*min(uStrength,1.)*(1.-uCollapse*.5);
       if(uMode>1.5){alpha*=smoothstep(.1,.3,fract(vUv.x*3.+vSeed))*(1.-smoothstep(.82,1.,vZ));}
       vec3 color=spectralColor(vSeed);
       color=mix(color,vec3(.04,.16,.5),uCollapse*.55);
       if(uMode>.5&&uMode<1.5){color=vec3(.001,.003,.018);alpha=tips*smoothstep(0.,.12,edge)*min(uStrength,1.);}
       if(alpha<.02)discard;gl_FragColor=vec4(color*(uMode<.5?1.4:1.),alpha);
      }`});
    this.mesh = new InstancedMesh(geometry, this.material, maximum); const identity = new Matrix4(); for (let i = 0; i < maximum; i++)this.mesh.setMatrixAt(i, identity);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = mode === 'fracture' ? 15 : 12;
  }
  setCount(n: number): void { this.mesh.count = Math.min(this.maximum, n); }
  update(t: number, length: number, front: number, strength: number, collapse = 0): void { const u = this.material.uniforms; u.uTime.value = t; u.uLength.value = length; u.uFront.value = front; u.uStrength.value = strength; u.uCollapse.value = collapse; this.mesh.visible = strength > .005; }
  dispose(): void { this.mesh.geometry.dispose(); this.material.dispose(); this.mesh.dispose(); }
}
