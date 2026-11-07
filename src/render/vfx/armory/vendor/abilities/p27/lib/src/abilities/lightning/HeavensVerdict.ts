// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import type { Ability, AbilityCastContext } from "../Ability";
import { VERDICT } from "./verdictConfig";
import { resolveVerdictTarget } from "./resolveVerdictTarget";
import { VerdictResources } from "./VerdictResources";
import { HeavensVerdictEffect } from "./HeavensVerdictEffect";

export class HeavensVerdict implements Ability {
  readonly id = "heavens-verdict";
  readonly name = "HEAVEN'S VERDICT";
  readonly element = "LIGHTNING";
  readonly color = "#a9cbff";
  readonly icon = "ϟ";
  readonly cooldown = VERDICT.cooldown; readonly range = VERDICT.range;
  private readonly resources = new VerdictResources();
  private seed = 18207;
  cast(context: AbilityCastContext): boolean {
    const target = resolveVerdictTarget(
      context.player.position,
      context.groundTarget,
    );
    if (!target) return false;
    const visuals = this.resources.pool.acquire();
    if (!visuals) return false;
    this.seed = (this.seed + 7919) >>> 0;
    context.effectManager.add(
      new HeavensVerdictEffect(
        context,
        this.resources,
        visuals,
        target,
        this.seed,
      ),
    );
    return true;
  }
  dispose(): void {
    this.resources.dispose();
  }
}
