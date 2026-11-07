// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { DoubleSide, Mesh, NormalBlending, ShaderMaterial } from 'three';
import { spectralSurface } from './SpectralBeamGeometry';
import { SPECTRAL_FLOW_VERTEX, SPECTRAL_FLOW_FRAGMENT } from './SpectralFlowShader';
import type { SpectralQuality } from './SpectralQualityConfig';
export class SpectralBeam {
  readonly geometry = spectralSurface();
  readonly layers: Mesh[] = [];
  constructor() {    
for (let i = 0; i < 7; i++) {
      const m = new ShaderMaterial({ uniforms: { uTime: { value: 0 }, uLength: { value: 40 }, uFront: { value: 0 }, uLayer: { value: i }, uStrength: { value: 0 }, uCollapse: { value: 0 }, uDetail: { value: 1 } }, vertexShader: SPECTRAL_FLOW_VERTEX, fragmentShader: SPECTRAL_FLOW_FRAGMENT, transparent: true, depthWrite: false, side: DoubleSide, blending: NormalBlending });
      const mesh = new Mesh(this.geometry, m); mesh.frustumCulled = false; mesh.renderOrder = 10 - i; this.layers.push(mesh);
    }  
}
  setQuality(q: SpectralQuality): void { this.layers.forEach((l, i) => { l.userData.enabled = i < q.layers; (l.material as ShaderMaterial).uniforms.uDetail.value = q.detail; }); }
  update(t: number, length: number, front: number, strength: number, collapse: number): void { for (const l of this.layers) { l.visible = !!l.userData.enabled && strength > .005; const u = (l.material as ShaderMaterial).uniforms; u.uTime.value = t; u.uLength.value = length; u.uFront.value = front; u.uStrength.value = strength; u.uCollapse.value = collapse; } }
  dispose(): void { this.geometry.dispose(); this.layers.forEach(l => (l.material as ShaderMaterial).dispose()); }
}
