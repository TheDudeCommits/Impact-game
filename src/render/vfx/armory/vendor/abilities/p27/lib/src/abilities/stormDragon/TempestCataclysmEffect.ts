// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { Vector3, Quaternion } from "three";
import type { AbilityCastContext } from "../Ability";
import type { ManagedEffect } from "../../effects/EffectManager";
import { CATACLYSM, envelope } from "./StormDragonConfig";
import { StormDragonTimeline } from "./StormDragonTimeline";
import { stormDragonQuality } from "./StormDragonQuality";
import type { StormDragonQuality } from "./StormDragonQuality";
import type { StormResourcePool, StormVisuals } from "./StormResourcePool";
export class TempestCataclysmEffect implements ManagedEffect {
  readonly target = new Vector3();
  readonly timeline = new StormDragonTimeline();
  readonly mouth = new Vector3();
  private readonly localPlayer = new Vector3();
  private readonly inverse = new Quaternion();
  private readonly distance: number;
  private q!: StormDragonQuality;
  private pixel = 1;
  private disposed = false;
  private feedback = 0;
  private readonly unsubscribe: () => void;
  get age(): number {
    return this.timeline.age;
  }
  constructor(
    private readonly context: AbilityCastContext,
    private readonly resources: StormResourcePool,
    readonly visuals: StormVisuals,
    target: Vector3,
  ) {
    this.target.copy(target);
    const v = visuals;
    v.root.position.copy(target);
    const dx = context.player.position.x - target.x,
      dz = context.player.position.z - target.z;
    this.distance = Math.hypot(dx, dz);
    v.root.rotation.set(0, Math.atan2(dx, dz), 0);
    this.inverse.copy(v.root.quaternion).invert();
    v.root.visible = true;
    context.scene.add(v.root);
    this.unsubscribe = context.quality.subscribe((c) => {
      this.q = stormDragonQuality(c);
      this.pixel = Math.min(
        typeof devicePixelRatio === "number" ? devicePixelRatio : 1,
        c.pixelRatio,
      );
      v.dragon.scales.count = this.q.scales;
    });
    this.update(0, context.time);
  }
  get particleCount(): number {
    return this.timeline.storm > 0.001 ? this.q.particles + this.q.rain : 0;
  }
  get instanceCount(): number {
    return (
      this.q.clouds +
      (this.visuals.mist.mesh.visible ? this.q.mist : 0) +
      (this.visuals.dragon.root.visible ? this.q.scales : 0)
    );
  }
  update(delta: number, _elapsed: number): boolean {
    if (this.disposed) return false;
    this.timeline.advance(delta);
    const tl = this.timeline,
      t = tl.age,
      v = this.visuals,
      q = this.q;
    if (t >= CATACLYSM.lifetime) return false;
    v.animation.update(tl, this.distance, q.detail);
    this.mouth
      .copy(v.dragon.mouthWorld)
      .sub(this.target)
      .applyQuaternion(this.inverse);
    this.localPlayer
      .copy(this.context.player.position)
      .sub(this.target)
      .applyQuaternion(this.inverse);
    const impact = envelope(9.15, 9.3, 10.6, 12, t),
      flash =
        Math.exp(-(((t - 9.25) * 8) ** 2)) +
        tl.surge * 0.7 +
        Math.max(0, Math.sin(t * 11.3) * Math.sin(t * 23.8) - 0.65) * tl.storm;
    v.clouds.update(t, tl.storm, q.clouds, q.detail, flash);
    v.particles.update(
      t,
      tl.storm,
      impact + tl.breath,
      tl.dissolve,
      q.particles,
      this.mouth,
      this.pixel,
    );
    v.rain.update(t, tl.storm, q.rain, flash);
    v.electricity.update(
      t,
      tl.dragon,
      tl.charge + tl.surge,
      q.arcs,
      v.dragon,
      v.root,
    );
    v.thunder.update(t, q.strikes, tl.storm);
    v.beam.update(t, tl.breath, this.mouth, q.helices, q.detail);
    v.charge.update(t, tl.charge * (1 - tl.breath * 0.7) + tl.breath * 0.25);
    v.player.update(t, this.context.player, v.root);
    v.tornadoes.update(t, q.tornadoes);
    v.water.update(
      t,
      tl.storm,
      q.detail,
      flash + tl.breath * 0.5,
      v.dragon.root.position,
    );
    v.impact.update(t);
    v.wind.update(t, tl.storm, q.detail);
    v.lighting.update(
      v.root,
      q.lights,
      t,
      tl.storm,
      flash,
      this.mouth,
      this.localPlayer,
    );
    v.discharge.update(
      t,
      tl.charge,
      tl.breath,
      this.mouth,
      v.dragon,
      v.root,
      q.detail,
    );
    v.aura.update(t, tl.dragon * (0.25 + tl.charge + tl.surge), q.detail);
    v.mist.update(t, q.mist);
    while (this.feedback < FEEDBACK.length && t >= FEEDBACK[this.feedback]) {
      this.context.cameraFeedback?.(this.feedback === 4 ? 0.004 : 0.0015, 0.15);
      this.feedback++;
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
const FEEDBACK = [3.4, 4.7, 5.85, 6.95, 9.2, 12.65];
