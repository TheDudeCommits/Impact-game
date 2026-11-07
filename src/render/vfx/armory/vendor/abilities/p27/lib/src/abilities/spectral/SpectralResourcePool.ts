// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { Group } from 'three';
import { ObjectPool } from '../../effects/ObjectPool';
import { SpectralAtmosphere } from './SpectralAtmosphere';
import { SpectralBeam } from './SpectralBeamMaterial';
import { SpectralRibbons } from './SpectralRibbons';
import { SpectralShockfront } from './SpectralShockfront';
import { SpectralCharge } from './SpectralCharge';
import { SpectralParticleSystem } from './SpectralParticleSystem';
import { SpectralImpact } from './SpectralImpact';
import { SpectralWaterInteraction } from './SpectralWaterInteraction';
import { SpectralLightController } from './SpectralLightController';
import type { SpectralQuality } from './SpectralQualityConfig';
export class SpectralVisuals {
  readonly root = new Group();
  readonly beamRoot = new Group();
  readonly beam = new SpectralBeam();
  readonly charge = new SpectralCharge();
  readonly ribbons = new SpectralRibbons('ribbon', 12);
  readonly fractures = new SpectralRibbons('fracture', 18);
  readonly pressure = new SpectralRibbons('pressure', 10);
  readonly head = new SpectralShockfront();
  readonly particles = new SpectralParticleSystem();
  readonly atmosphere = new SpectralAtmosphere();
  readonly impact = new SpectralImpact();
  readonly water = new SpectralWaterInteraction();
  readonly lights = new SpectralLightController();
  constructor() { this.root.name = 'Spectral Break — Prismatic Annihilation'; this.root.add(this.charge.root, this.beamRoot, this.water.mesh, this.water.impactMesh); this.beamRoot.add(...this.beam.layers, this.ribbons.mesh, this.fractures.mesh, this.pressure.mesh, this.head.root, this.atmosphere.mesh, this.particles.mesh, this.impact.root); }
  setQuality(q: SpectralQuality): void { this.beam.setQuality(q); this.ribbons.setCount(q.ribbons); this.fractures.setCount(q.fractures); this.pressure.setCount(q.rings); this.head.setQuality(q.detail); this.impact.setQuality(q.detail, q.ribbons); this.particles.mesh.count = q.particles; this.atmosphere.mesh.count = [6, 14, 24][q.detail]; this.lights.count = q.lights; this.water.material.uniforms.uDetail.value = q.detail; }
  reset(): void { this.root.removeFromParent(); this.root.visible = false; this.lights.reset(); this.water.reset(); }
  dispose(): void { this.reset(); this.beam.dispose(); this.charge.dispose(); this.ribbons.dispose(); this.fractures.dispose(); this.pressure.dispose(); this.head.dispose(); this.particles.dispose(); this.atmosphere.dispose(); this.impact.dispose(); this.water.dispose(); this.lights.dispose(); this.root.clear(); }
}
export class SpectralResourcePool {
  /** Cooldown exceeds lifetime: exactly one normal manifestation, no unbounded leases. */
  readonly pool = new ObjectPool(() => new SpectralVisuals(), v => v.reset(), v => v.dispose(), 1);
  dispose(): void { this.pool.dispose(); }
}
