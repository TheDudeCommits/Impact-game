// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import type { StormDragon } from "./StormDragon";
import { smooth } from "./StormDragonConfig";
import type { StormDragonTimeline } from "./StormDragonTimeline";
/** Absolute-time choreography is deterministic under irregular frame intervals. No AI or independent timers. */
export class DragonAnimationController {
  constructor(readonly dragon: StormDragon) {}
  update(tl: StormDragonTimeline, distance: number, detail: number): void {
    const t = tl.age,
      d = this.dragon,
      flight = smooth(3.3, 6.6, t),
      turn = Math.sin(flight * Math.PI) * 0.42;
    d.root.position.set(
      Math.sin(flight * Math.PI * 1.6) * (1 - flight) * 18,
      6.5 +
        Math.sin(flight * Math.PI) * 2.5 +
        Math.sin(t * 1.3) * 0.3 +
        smooth(13.5, 16, t) * 6,
      -Math.max(28, 70 - distance) - (1 - flight) * 22,
    );
    const showcase = 0.35 * smooth(5.7, 7, t);
    d.root.rotation.set(-0.04 * Math.sin(t), turn + showcase, turn * -0.4);
    d.root.visible = tl.dragon > 0.001;
    const stable = smooth(6.8, 8, t) * (1 - smooth(11, 12, t));
    d.neckDeformation.bend(
      smooth(6.7, 8.6, t) * 0.48 -
        smooth(12, 13.2, t) * 0.28 +
        0.03 * Math.sin(t * 1.3),
    );
    d.neck.rotation.y = Math.sin(t * 0.6) * 0.045 * (1 - stable) - showcase;
    d.head.root.rotation.x += 0.12 * tl.charge;
    d.head.jaw.rotation.x = 0.15 + tl.charge * 0.65 + tl.breath * 0.12;
    for (let i = 0; i < 2; i++)
      d.wings[i].animate(
        t,
        smooth(2.5, 4.5, t) * (1 - 0.3 * smooth(14, 16, t)),
        stable,
        turn,
        i === 0 ? -1 : 1,
      );
    d.tail.animate(t, turn, tl.surge);
    d.limbs.animate(t, tl.charge);
    d.materials.update(t, tl.charge + tl.surge, tl.dissolve, detail);
    d.updateAnchors();
  }
}
