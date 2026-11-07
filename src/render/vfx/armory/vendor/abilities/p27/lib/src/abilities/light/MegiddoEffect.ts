// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { Vector3 } from "three";
import type { AbilityCastContext } from "../Ability";
import type { ManagedEffect } from "../../effects/EffectManager";
import { MEGIDDO, radiantQuality, smooth } from "./MegiddoConfig";
import type { RadiantQuality } from "./MegiddoConfig";
import type { MegiddoResources, MegiddoVisuals } from "./MegiddoResources";
/** A single owned clock drives all stages; no timers, callbacks, scene copies or compositor changes. */
export class MegiddoEffect implements ManagedEffect {
  readonly target = new Vector3();
  private readonly hand = new Vector3();
  private readonly view = new Vector3();
  private readonly flashPoint = new Vector3();
  private age = 0;
  private disposed = false;
  private struck = false;
  private q!: RadiantQuality;
  private readonly unsubscribe: () => void;
  constructor(
    private readonly context: AbilityCastContext,
    private readonly resources: MegiddoResources,
    readonly visuals: MegiddoVisuals,
    target: Vector3,
    seed: number,
  ) {
    this.target.copy(target);
    visuals.root.position.copy(target);
    visuals.root.visible = true;
    context.scene.add(visuals.root);
    this.unsubscribe = context.quality.subscribe((config) => {
      this.q = radiantQuality(config);
      visuals.sequence.configure(this.q.detail, seed);
      visuals.fragments.configure(this.q.detail, visuals.sequence);
      visuals.particles.configure(
        this.q.particles,
        this.q.mist,
        visuals.sequence,
        Math.min(
          typeof devicePixelRatio === "number" ? devicePixelRatio : 1,
          config.pixelRatio,
        ),
      );
    });
    this.update(0, context.time);
  }
  get particleCount(): number {
    return this.visuals.particles.count;
  }
  get instanceCount(): number {
    return (
      (this.visuals.array.prisms.visible ? this.q.lenses * 2 : 0) +
      (this.visuals.beams.mesh.visible ? this.q.strikes * 2 : 0) +
      (this.visuals.ripples.mesh.visible ? this.q.strikes : 0) +
      (this.visuals.echoes.mesh.visible
        ? this.visuals.echoes.geometry.instanceCount
        : 0) +
      (this.visuals.fragments.mesh.visible
        ? this.visuals.fragments.geometry.instanceCount
        : 0)
    );
  }
  update(delta: number, _elapsed: number): boolean {
    if (this.disposed) return false;
    this.age += Math.max(0, delta);
    if (this.age >= MEGIDDO.lifetime) return false;
    const v = this.visuals,
      q = this.q,
      t = this.age;
    if (t < 1.15)
      this.context.player.visual
        .getRightHandWorldPosition(this.hand)
        .sub(this.target);
    v.hand.update(t, this.hand, this.context.camera.quaternion);
    v.mark.update(t, q.detail);
    v.array.update(t, q.lenses, q.detail);
    v.beams.update(t, q.strikes, q.detail);
    v.echoes.update(t, q.detail);
    this.view.copy(this.context.camera.position).sub(this.target);
    v.ripples.update(t, q.strikes, q.detail, this.view);
    v.particles.update(t);
    v.fragments.update(t);
    const flash = v.sequence.getFlash(t, this.flashPoint);
    if (t < 2.95) {
      if (!v.impactLight.parent) v.root.add(v.impactLight);
      if (q.detail > 0 && !v.fillLight.parent) v.root.add(v.fillLight);
      if (q.detail === 0) v.fillLight.removeFromParent();
    } else {
      v.impactLight.removeFromParent();
      v.fillLight.removeFromParent();
    }
    if (t < 1.15) {
      v.impactLight.position.copy(this.hand);
      v.impactLight.intensity = 2.8 * smooth(0, 0.25, t);
    } else {
      v.impactLight.position.copy(this.flashPoint);
      v.impactLight.position.y = 1.4;
      v.impactLight.intensity = q.light * flash;
    }
    v.fillLight.position.copy(this.view);
    v.fillLight.position.y += 3;
    v.fillLight.intensity = q.light * flash * 0.22;
    if (t >= MEGIDDO.firstStrike && !this.struck) {
      this.struck = true;
      this.context.cameraFeedback?.(
        0.0028 *
          Math.max(
            0.3,
            1 - this.target.distanceTo(this.context.player.position) / 80,
          ),
        0.16,
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
