// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { Quaternion, Vector3 } from "three";
import type { AbilityCastContext } from "../Ability";
import type { ManagedEffect } from "../../effects/EffectManager";
import { WORLDREND, voidQuality, smooth } from "./WorldrendConfig";
import type { VoidQuality } from "./WorldrendConfig";
import type { VoidResources, VoidVisuals } from "./VoidResources";
const FEEDBACK_TIMES = [0.82, 2.35, 5.55, 7.55, 7.85];
const FEEDBACK_STRENGTHS = [0.001, 0.0025, 0.0015, 0.004, 0.0017];
export class WorldrendEffect implements ManagedEffect {
  readonly target = new Vector3();
  private readonly hand = new Vector3();
  private readonly view = new Vector3();
  private readonly rotation = new Quaternion();
  private readonly localCamera = new Quaternion();
  private clock = 0;
  private disposed = false;
  private feedbackStage = 0;
  private q!: VoidQuality;
  private readonly unsubscribe: () => void;
  get age(): number {
    return this.clock;
  }
  constructor(
    private readonly context: AbilityCastContext,
    private readonly resources: VoidResources,
    readonly visuals: VoidVisuals,
    target: Vector3,
    seed: number,
  ) {
    this.target.copy(target);
    visuals.root.position.copy(target);
    // Fixed facing at creation: walking around reveals the real recessed tunnel and depth-offset fragments.
    const dx = context.camera.position.x - target.x,
      dz = context.camera.position.z - target.z;
    visuals.root.rotation.set(0, Math.atan2(dx, dz), 0);
    this.rotation.copy(visuals.root.quaternion).invert();
    visuals.root.visible = true;
    context.scene.add(visuals.root);
    this.unsubscribe = context.quality.subscribe((c) => {
      this.q = voidQuality(c);
      visuals.rift.configure(this.q, seed);
      visuals.shards.configure(this.q, seed);
      visuals.particles.configure(
        this.q.particles,
        Math.min(
          typeof devicePixelRatio === "number" ? devicePixelRatio : 1,
          c.pixelRatio,
        ),
      );
    });
    this.update(0, context.time);
  }
  get particleCount(): number {
    return this.visuals.particles.points.visible ? this.q.particles : 0;
  }
  get instanceCount(): number {
    const v = this.visuals;
    return (
      (v.shards.mesh.visible ? this.q.shards + this.q.fragments : 0) +
      (v.atmosphere.mesh.visible ? this.q.haze : 0) +
      (v.filaments.mesh.visible ? this.q.filaments : 0)
    );
  }
  update(delta: number, _elapsed: number): boolean {
    if (this.disposed) return false;
    this.clock += Math.max(0, delta);
    if (this.clock >= WORLDREND.lifetime) return false;
    const t = this.clock,
      v = this.visuals,
      q = this.q;
    if (t < 1)
      this.context.player.visual
        .getRightHandWorldPosition(this.hand)
        .sub(this.target)
        .applyQuaternion(this.rotation);
    this.localCamera
      .copy(this.rotation)
      .multiply(this.context.camera.quaternion);
    v.charge.update(t, this.hand, this.localCamera);
    this.view
      .copy(this.context.camera.position)
      .sub(this.target)
      .applyQuaternion(this.rotation);
    v.rift.update(t, this.view);
    v.shards.update(t);
    v.filaments.update(t, q.filaments);
    v.particles.update(t);
    v.atmosphere.update(t, q.haze, q.detail);
    v.water.update(t, q.detail, this.view);
    v.core.update(t);
    const stable = smooth(0.7, 2.5, t) * (1 - smooth(7.55, 8.2, t)),
      flash = Math.exp(-(((t - WORLDREND.shock) * 17) ** 2));
    if (t < 9) {
      if (!v.light.parent) v.root.add(v.light);
      if (q.detail > 0 && !v.upper.parent) v.root.add(v.upper);
      if (q.detail === 0) v.upper.removeFromParent();
    } else {
      v.light.removeFromParent();
      v.upper.removeFromParent();
    }
    if (t < 0.8) {
      v.light.position.copy(this.hand);
      v.light.intensity = 3 * smooth(0, 0.2, t);
    } else {
      v.light.position.set(0, 3, 1.5);
      v.light.intensity =
        q.light * (stable * (0.25 + 0.025 * Math.sin(t * 5)) + flash * 1.7);
    }
    v.upper.position.set(0, 12, 2);
    v.upper.intensity = q.light * (stable * 0.2 + flash * 0.6);
    while (
      this.feedbackStage < FEEDBACK_TIMES.length &&
      t >= FEEDBACK_TIMES[this.feedbackStage]
    ) {
      this.context.cameraFeedback?.(
        FEEDBACK_STRENGTHS[this.feedbackStage],
        this.feedbackStage === 3 ? 0.18 : 0.12,
      );
      this.feedbackStage++;
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
