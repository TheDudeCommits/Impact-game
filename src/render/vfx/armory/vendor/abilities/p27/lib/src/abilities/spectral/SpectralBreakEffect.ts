// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { Quaternion, Vector3 } from 'three';
import type { AbilityCastContext } from '../Ability';
import type { ManagedEffect } from '../../effects/EffectManager';
import { SPECTRAL } from './SpectralBreakConfig';
import { spectralTimeline } from './SpectralTimeline';
import { spectralQuality } from './SpectralQualityConfig';
import type { SpectralQuality } from './SpectralQualityConfig';
import type { SpectralResourcePool, SpectralVisuals } from './SpectralResourcePool';
export class SpectralBreakEffect implements ManagedEffect {
  age = 0;
  readonly origin = new Vector3();
  readonly direction = new Vector3();
  readonly target = new Vector3();
  readonly frontPosition = new Vector3();
  released = false;
  length = 0;
  private disposed = false;
  private impactFeedback = false;
  private q!: SpectralQuality;
  private readonly axis = new Vector3(0, 0, 1);
  private readonly gravity = new Vector3(0, -1, 0);
  private readonly inverse = new Quaternion();
  private readonly unsubscribe: () => void;
  constructor(private readonly context: AbilityCastContext, private readonly resources: SpectralResourcePool, readonly visuals: SpectralVisuals, target: Vector3) {
    this.origin.copy(context.origin); this.direction.subVectors(target, this.origin).normalize(); this.length = this.origin.distanceTo(target); this.target.copy(target);
    visuals.root.visible = true; context.scene.add(visuals.root);
    this.unsubscribe = context.quality.subscribe(c => { this.q = spectralQuality(c); visuals.setQuality(this.q); }); this.update(0, context.time);
  }
  get particleCount(): number { return this.visuals.particles.mesh.visible ? this.visuals.particles.mesh.count : 0; }
  get instanceCount(): number {
    const v = this.visuals;
    return (v.ribbons.mesh.visible ? v.ribbons.mesh.count : 0) + (v.fractures.mesh.visible ? v.fractures.mesh.count : 0) + (v.pressure.mesh.visible ? v.pressure.mesh.count : 0) + (v.atmosphere.mesh.visible ? v.atmosphere.mesh.count : 0) + this.particleCount + (v.impact.root.visible && v.impact.shreds.mesh.visible ? v.impact.shreds.mesh.count : 0) + (v.charge.root.visible ? v.charge.strands.mesh.count + v.charge.rings.mesh.count : 0);
  }
  update(delta: number, _elapsed: number): boolean {
    if (this.disposed) return false; this.age += Math.max(0, Number.isFinite(delta) ? delta : 0);
    if (this.age >= SPECTRAL.lifetime) return false;
    const t = this.age, s = spectralTimeline(t), v = this.visuals;
    if (!this.released) {
      this.context.player.visual.getRightHandWorldPosition(this.origin);
      if (t >= SPECTRAL.release) { this.released = true; this.target.copy(this.origin).addScaledVector(this.direction, this.length); this.context.cameraFeedback?.(.0032, .12); }
    }
    v.charge.root.position.copy(this.origin); v.charge.root.quaternion.setFromUnitVectors(this.axis, this.direction); v.charge.update(t, s.charge, s.compression, s.flash);
    v.beamRoot.position.copy(this.origin); v.beamRoot.quaternion.setFromUnitVectors(this.axis, this.direction);
    this.inverse.copy(v.beamRoot.quaternion).invert(); this.gravity.set(0, -1, 0).applyQuaternion(this.inverse);
    this.frontPosition.copy(this.origin).addScaledVector(this.direction, this.length * s.front);
    v.beam.update(t, this.length, s.front, s.beam, s.collapse);
    v.ribbons.update(t, this.length, s.front, s.beam * .7 + s.aftermath * .32, s.collapse);
    v.fractures.update(t, this.length, s.front, s.beam * .88, s.collapse);
    v.pressure.update(t, this.length, s.front, s.beam * .7, s.collapse);
    v.head.root.position.z = this.length * s.front;
    v.head.update(t, 1.6 + s.front * 5.2, s.beam * (t < 1.65 ? 1. : .47));
    v.atmosphere.update(t, this.length, s.impact * .8 + s.aftermath);
    v.particles.update(t, this.length, s.front, this.gravity); v.particles.mesh.visible = true;
    v.impact.root.position.z = this.length; v.impact.update(t, s.impact, s.shock, s.aftermath);
    v.water.update(t, this.origin, this.target, s.front, s.beam * .9 + s.aftermath * .23, s.shock + s.aftermath * .5, this.q.waterSources, this.context.water, this);
    v.lights.update(this.context.scene, this.origin, this.frontPosition, this.target, s.charge, s.flash, s.beam, s.impact, s.aftermath, t);
    if (!this.impactFeedback && t >= SPECTRAL.impact) { this.impactFeedback = true; this.context.cameraFeedback?.(.0038, .17); }
    return true;
  }
  dispose(): void { if (this.disposed) return; this.disposed = true; this.unsubscribe(); this.context.water?.removeOwner(this); this.resources.pool.release(this.visuals); }
}
