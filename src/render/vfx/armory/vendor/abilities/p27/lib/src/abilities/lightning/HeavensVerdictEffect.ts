// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { Vector3 } from "three";
import type { AbilityCastContext } from "../Ability";
import type { ManagedEffect } from "../../effects/EffectManager";
import type { VerdictResources, VerdictVisuals } from "./VerdictResources";
import {
  dischargeIntensity,
  lightningQuality,
  pulse,
  smooth,
  VERDICT,
} from "./verdictConfig";
import type { LightningQuality } from "./verdictConfig";

/** Authored clock-driven stages; no timers, per-branch meshes or secondary animation loops. */
export class HeavensVerdictEffect implements ManagedEffect {
  readonly target = new Vector3();
  private readonly hand = new Vector3();
  private age = 0;
  private disposed = false;
  private struck = false;
  private q!: LightningQuality;
  private readonly unsubscribe: () => void;
  constructor(
    private readonly context: AbilityCastContext,
    private readonly resources: VerdictResources,
    readonly visuals: VerdictVisuals,
    target: Vector3,
    private readonly seed: number,
  ) {
    this.target.copy(target);
    visuals.root.position.copy(target);
    visuals.root.visible = true;
    context.scene.add(visuals.root);
    visuals.charge.reset();
    this.unsubscribe = context.quality.subscribe((config) => {
      this.q = lightningQuality(config);
      visuals.discharge.configure(seed, this.q);
      visuals.water.configure(seed, this.q);
      visuals.water.configureTravel(context.player.position, this.target);
      visuals.storm.setQuality(this.q.clouds, this.q.detail, seed);
      visuals.mist.mesh.count = this.q.mist;
      visuals.particles.configure(
        this.q.particles,
        Math.min(
          typeof devicePixelRatio === "number" ? devicePixelRatio : 1,
          config.pixelRatio,
        ),
        seed,
      );
    });
    this.update(0, context.time);
  }
  get particleCount(): number {
    return this.visuals.particles.count;
  }
  get instanceCount(): number {
    return (
      (this.visuals.storm.root.visible ? this.visuals.storm.clouds.count : 0) +
      (this.visuals.mist.mesh.visible ? this.visuals.mist.mesh.count : 0) +
      (this.visuals.water.coronas.visible
        ? this.visuals.water.coronas.count
        : 0)
    );
  }
  update(delta: number, _elapsed: number): boolean {
    if (this.disposed) return false;
    this.age += Math.max(0, delta);
    if (this.age >= VERDICT.lifetime) return false;
    const v = this.visuals,
      q = this.q;
    if (this.age < 1.15)
      this.context.player.visual.getRightHandWorldPosition(this.hand);
    v.charge.update(
      this.age,
      this.context.player,
      this.target,
      this.context.camera.quaternion,
      this.seed,
      q.detail,
      this.hand,
    );
    if (this.age < 1.15) this.hand.sub(this.target);
    v.discharge.update(this.age);
    v.storm.update(this.age);
    v.water.update(this.age);
    v.shockwave.update(this.age, q.detail, this.target);
    v.mist.update(this.age, q.detail);
    const flash = dischargeIntensity(this.age);
    v.particles.update(this.age, this.hand, flash);
    const early =
      pulse(this.age, 0.55, 0.08) * 0.05 + pulse(this.age, 0.735, 0.07) * 0.12;
    let secondary = 0;
    for (let i = 0; i < q.secondary; i++)
      secondary +=
        pulse(this.age, VERDICT.strike + v.discharge.secondaryTimes[i], 0.075) *
        0.18;
    const intensity = q.light * (flash + secondary);
    v.impactLight.intensity = intensity;
    v.skyLight.intensity = q.detail > 0 ? q.light * (flash * 0.3 + early) : 0;
    // Elevated backscatter lights the player's camera-facing side during the short flash.
    // The main light remains physically at the water impact; no screen overlay is used.
    v.skyLight.position.copy(this.context.camera.position).sub(this.target);
    v.skyLight.position.y += 4;
    if (this.age < 1.95) {
      if (!v.impactLight.parent) v.root.add(v.impactLight);
      if (q.detail > 0 && !v.skyLight.parent) v.root.add(v.skyLight);
      if (q.detail === 0) v.skyLight.removeFromParent();
    } else {
      v.impactLight.removeFromParent();
      v.skyLight.removeFromParent();
    }
    // A small hand light during charge uses the impact light before the strike rather than a third light.
    if (this.age < 0.9) {
      v.impactLight.position.copy(this.hand);
      v.impactLight.intensity = 3 * smooth(0.05, 0.3, this.age);
    } else v.impactLight.position.set(0, 2, 0);
    if (!this.struck && this.age >= VERDICT.strike) {
      this.struck = true;
      const distance = this.context.player.position.distanceTo(this.target);
      this.context.cameraFeedback?.(
        0.0038 * Math.max(0.35, 1 - distance / 70),
        0.2,
      );
    }
    return true;
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.unsubscribe();
    this.resources.pool.release(this.visuals);
  }
}
