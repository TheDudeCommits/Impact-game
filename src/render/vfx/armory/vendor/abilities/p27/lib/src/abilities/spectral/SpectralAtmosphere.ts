// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { AdditiveBlending, DoubleSide, InstancedBufferAttribute, InstancedMesh, Matrix4, PlaneGeometry, ShaderMaterial } from 'three';
import { SPECTRAL_NOISE_GLSL } from './SpectralPalette';
/** Local soft haze; no scene-color sampling or postprocessing mutation. */
export class SpectralAtmosphere {
  readonly material = new ShaderMaterial({    
uniforms: { uTime: { value: 0 }, uLength: { value: 40 }, uStrength: { value: 0 } }, transparent: true, depthWrite: false, side: DoubleSide, blending: AdditiveBlending,
    vertexShader: `attribute float aSeed;uniform float uTime,uLength;varying vec2 vUv;varying float vSeed;void main(){vUv=uv;vSeed=aSeed;float age=max(0.,uTime-3.7),a=aSeed*35.;vec3 p=vec3(cos(a+age*.12)*(2.+aSeed*7.),sin(a)*2.+age*.4,uLength*(.75+aSeed*.22));vec4 mv=modelViewMatrix*vec4(p,1.);mv.xy+=position.xy*(2.+aSeed*3.+age*.35);gl_Position=projectionMatrix*mv;}`,
    fragmentShader: `uniform float uTime,uStrength;varying vec2 vUv;varying float vSeed;${SPECTRAL_NOISE_GLSL}
   void main(){vec2 p=vUv*2.-1.;float soft=pow(max(0.,1.-dot(p,p)),2.);float n=noise3(vec3(p*3.+vSeed*25.,uTime*.35));float alpha=soft*smoothstep(.28,.7,n)*uStrength*.065;if(alpha<.004)discard;vec3 color=mix(vec3(.015,.2,.4),vec3(.17,.035,.4),vSeed*.6);gl_FragColor=vec4(color,alpha);}`});
  readonly mesh: InstancedMesh;
  constructor() { const g = new PlaneGeometry(1, 1); g.setAttribute('aSeed', new InstancedBufferAttribute(Float32Array.from({ length: 24 }, (_, i) => (i * .61803398875) % 1), 1)); this.mesh = new InstancedMesh(g, this.material, 24); const identity = new Matrix4(); for (let i = 0; i < 24; i++)this.mesh.setMatrixAt(i, identity); this.mesh.frustumCulled = false; this.mesh.renderOrder = 4; }
  update(t: number, length: number, strength: number): void { this.mesh.visible = strength > .005; this.material.uniforms.uTime.value = t; this.material.uniforms.uLength.value = length; this.material.uniforms.uStrength.value = strength; }
  dispose(): void { this.mesh.geometry.dispose(); this.material.dispose(); this.mesh.dispose(); }
}
