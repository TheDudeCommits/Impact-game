// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import type { Ability, AbilityCastContext } from "../Ability";
import { CATACLYSM } from "./StormDragonConfig";
import { resolveStormTarget } from "./resolveStormTarget";
import { StormResourcePool } from "./StormResourcePool";
import { TempestCataclysmEffect } from "./TempestCataclysmEffect";
export class TempestCataclysm implements Ability {
  readonly id = "tempest-cataclysm";
  readonly name = "TEMPEST CATACLYSM";
  readonly subtitle = "Storm Dragon Ascension";
  readonly element = "TRUE DRAGON / STORM";
  readonly color = "#b098ef";
  readonly icon = "storm-dragon";
  readonly cooldown = CATACLYSM.cooldown; readonly range = CATACLYSM.range;
  private readonly resources = new StormResourcePool();
  cast(context: AbilityCastContext): boolean {
    const target = resolveStormTarget(
      context.player.position,
      context.groundTarget,
    );
    if (!target) return false;
    const v = this.resources.pool.acquire();
    if (!v) return false;
    context.effectManager.add(
      new TempestCataclysmEffect(context, this.resources, v, target),
    );
    return true;
  }
  dispose(): void {
    this.resources.dispose();
  }
}
