// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { PointLight } from 'three';
import type { Scene, Vector3 } from 'three';
/** Actual scene lights, never material/exposure mutation. Pooled lamps detach when no longer useful. */
export class SpectralLightController {
  readonly lights = [new PointLight('#b7faff', 0, 24, 2), new PointLight('#35bfff', 0, 30, 2), new PointLight('#b77cff', 0, 48, 2)];
  count = 2;
  update(scene: Scene, origin: Vector3, front: Vector3, target: Vector3, charge: number, flash: number, beam: number, impact: number, after: number, t: number): void {
    this.setLight(0, scene, origin, charge * 12 + flash * 520 + beam * 48, t, .3);
    this.setLight(1, scene, front, beam * 450 + impact * 500, t, .3);
    this.setLight(2, scene, target, impact * 1250 + after * 140, t, 3);
  }
  private setLight(index: number, scene: Scene, position: Vector3, strength: number, t: number, height: number): void {
    const light = this.lights[index]; light.position.copy(position); light.position.y += height; light.intensity = strength;
    if (index < this.count && strength > .02 && t < 7.7) { if (!light.parent) scene.add(light); } else light.removeFromParent();
  }
  reset(): void { this.lights.forEach(l => { l.intensity = 0; l.removeFromParent(); }); }
  dispose(): void { this.reset(); this.lights.forEach(l => l.dispose()); }
}
