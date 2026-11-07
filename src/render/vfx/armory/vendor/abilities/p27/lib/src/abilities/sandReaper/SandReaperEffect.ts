// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { BufferGeometry, Group, Mesh, PointLight, Quaternion, Vector3 } from 'three';
import type { AbilityCastContext } from '../Ability';
import type { ManagedEffect } from '../../effects/EffectManager';
import { SAND_CAST, sandQuality, type SandReaperConfig, type SandQuality } from './SandReaperConfig';
import { createSandReaperMaterial } from './SandReaperMaterial';
import { SandReaperParticles } from './SandReaperParticles';
import { SandReaperImpact } from './SandReaperImpact';

const FORWARD = new Vector3(0, 0, 1);
export interface SandResources { readonly blades: readonly BufferGeometry[]; readonly fragments: readonly BufferGeometry[]; }
/** A cached visual bundle. Per-cast leases end after the residual, GPU resources end on ability disposal. */
export class SandReaperEffect implements ManagedEffect {
  readonly root = new Group();
  readonly blade: Mesh;
  readonly particles: SandReaperParticles;
  readonly impact = new SandReaperImpact();
  readonly stone = createSandReaperMaterial();
  readonly light = new PointLight('#ffd98a', 0, 8, 2);
  private context: AbilityCastContext;
  private readonly origin = new Vector3();
  private readonly target = new Vector3();
  private readonly ground = new Vector3();
  private readonly direction = new Vector3();
  private readonly previous = new Vector3();
  private readonly position = new Vector3();
  private readonly orientation = new Quaternion();
  private readonly spin = new Quaternion();
  private readonly hand = new Vector3();
  private quality: SandQuality;
  private unsubscribe: (() => void) | undefined;
  private age = 0;
  private impactTime = -1;
  private travel = 0;
  private flightDistance = 0;
  private waterStep = 0;
  private launched = false;
  private destroyed = false;
  active = false;
  phase: 'charge' | 'flight' | 'impact' | 'complete' = 'complete';
  constructor(ctx: AbilityCastContext, private readonly resources: SandResources, private readonly config: SandReaperConfig, private readonly released: () => void) {
    this.context = ctx; this.quality = sandQuality(ctx.quality.config);
    this.blade = new Mesh(resources.blades[this.quality.detail], this.stone.material);
    this.blade.receiveShadow = true; this.blade.frustumCulled = false;
    this.particles = new SandReaperParticles(resources.fragments, this.quality);
    this.root.name = 'Sand Reaper · bounded visual bundle'; this.root.add(this.blade, this.particles.root, this.impact.mesh, this.light);
  }
  activate(ctx: AbilityCastContext, target: Vector3): void {
    this.context = ctx; this.target.copy(target); this.ground.set(target.x, .06, target.z);
    this.origin.copy(ctx.origin); this.position.copy(ctx.origin); this.previous.copy(ctx.origin);
    this.direction.subVectors(target, ctx.origin).normalize(); this.orientation.setFromUnitVectors(FORWARD, this.direction);
    this.age = this.travel = this.waterStep = 0; this.impactTime = -1; this.launched = false; this.active = true; this.phase = 'charge';
    this.particles.reset(); this.impact.reset(); this.blade.visible = true; this.light.intensity = 0;
    ctx.scene.add(this.root);
    this.unsubscribe = ctx.quality.subscribe(q => {
      this.quality = sandQuality(q); this.blade.geometry = this.resources.blades[this.quality.detail];
      this.blade.castShadow = q.shadows && this.launched; this.particles.setQuality(this.quality); this.light.visible = this.quality.light;
    });
  }
  update(dt: number): boolean {
    if (!this.active || !Number.isFinite(dt) || dt < 0) return this.active;
    this.age += dt;
    // No catch-up emission storm on tab resume or explicit test cleanup.
    if (dt > 4 || this.age > 5.3) return false;
    const c = this.config, charge = Math.min(1, this.age / .54);
    if (!this.launched) {
      this.context.player.visual.getRightHandWorldPosition(this.hand);
      this.position.copy(this.hand).addScaledVector(this.direction, .7); this.position.y += .4;
      this.orientation.setFromUnitVectors(FORWARD, this.direction);
      this.blade.position.copy(this.position); this.blade.quaternion.copy(this.orientation);
      this.blade.rotateZ(Math.sin(this.age * 36) * .013 * charge);
      this.blade.scale.setScalar(.4 + charge * .6);
      this.particles.assembly(this.age, charge, this.position, this.orientation, c);
      this.particles.charge(this.age, Math.min(dt, .05), this.hand, c);
      this.light.position.copy(this.hand); this.light.intensity = .9 * Math.sin(charge * Math.PI);
      if (this.age >= SAND_CAST.release) {
        this.launched = true; this.phase = 'flight'; this.position.y = Math.max(2.5, this.position.y); this.origin.copy(this.position);
        this.direction.subVectors(this.target, this.origin); this.flightDistance = this.direction.length();
        if (!Number.isFinite(this.flightDistance) || this.flightDistance < .01) return false;
        this.direction.normalize(); this.orientation.setFromUnitVectors(FORWARD, this.direction);
        // Player may have moved during charge: enforce the same cap from the actual release hand.
        if (this.flightDistance > SAND_CAST.range) {
          this.flightDistance = SAND_CAST.range; this.target.copy(this.origin).addScaledVector(this.direction, this.flightDistance);
          this.ground.set(this.target.x, .06, this.target.z);
        }
        this.previous.copy(this.position); this.blade.castShadow = this.context.quality.config.shadows;
        this.context.cameraFeedback?.(.008, .065);
      }
    }
    if (this.launched && this.impactTime < 0) {
      const flightDelta = Math.min(dt, Math.max(0, this.age - SAND_CAST.release));
      this.travel = Math.min(this.flightDistance, this.travel + flightDelta * c.flightSpeed);
      this.position.copy(this.origin).addScaledVector(this.direction, this.travel);
      this.spin.setFromAxisAngle(FORWARD, (this.age - SAND_CAST.release) * c.bladeSpinSpeed);
      this.blade.position.copy(this.position); this.blade.quaternion.copy(this.orientation).multiply(this.spin); this.blade.scale.setScalar(1);
      this.particles.flight(this.age, Math.min(flightDelta, .05), this.position, this.previous, this.direction, c);
      this.previous.copy(this.position); this.light.position.copy(this.position); this.light.intensity = .8;
      if (this.travel - this.waterStep >= 2.2) {
        this.waterStep = this.travel; this.hand.set(this.position.x, 0, this.position.z);
        this.context.water?.addRipple({ position: this.hand, strength: .035, duration: .6, waveSpeed: 2.7, radius: .5 }, this);
      }
      if (this.travel >= this.flightDistance) {
        this.impactTime = this.age; this.phase = 'impact'; this.blade.visible = false;
        this.particles.impact(this.age, this.ground, this.direction, c, this.position, this.blade.quaternion);
        for (let i = 0; i < 3; i++) this.context.water?.addRipple({ position: this.ground, strength: .12 / (i + 1), duration: 2.5, waveSpeed: 5 + i * 2, wavelength: .5 + i * .15, radius: .3 + i * .6 }, this);
        this.context.cameraFeedback?.(.02, .15);
      }
    }
    const impactAge = this.impactTime < 0 ? -1 : this.age - this.impactTime;
    this.impact.update(impactAge, this.ground, c.impactRadius);
    if (impactAge >= 0) { this.light.position.copy(this.ground); this.light.position.y = 1.4; this.light.intensity = 2 * Math.exp(-impactAge * 5); }
    this.stone.sync(c, this.context.time + this.age, charge, this.launched ? Math.max(0, (this.travel / Math.max(.1, this.flightDistance) - .93) / .07) : 0, this.quality.detail);
    this.particles.update(this.age, c, !this.launched);
    return impactAge < SAND_CAST.residual;
  }
  get particleCount(): number { return this.particles.particleCount; }
  get instanceCount(): number { return this.particles.instanceCount + Number(this.blade.visible); }
  dispose(): void {
    if (!this.active) return;
    this.active = false; this.phase = 'complete'; this.unsubscribe?.(); this.unsubscribe = undefined;
    this.context.water?.removeOwner(this); this.root.removeFromParent(); this.light.intensity = 0;
    this.particles.reset(); this.impact.reset(); this.released();
  }
  destroy(): void {
    if (this.destroyed) return; this.destroyed = true; this.dispose();
    this.particles.dispose(); this.impact.dispose(); this.stone.material.dispose(); this.root.clear();
    // Shared blade and fragment geometry is owned by SandReaper, not an individual lease.
  }
}
