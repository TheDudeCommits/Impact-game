// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import type { Ability, AbilityCastContext } from "../Ability";
import { WORLDREND } from "./WorldrendConfig";
import { resolveVoidTarget } from "./resolveVoidTarget";
import { VoidResources } from "./VoidResources";
import { WorldrendEffect } from "./WorldrendEffect";
export class Worldrend implements Ability {
  readonly id = "worldrend";
  readonly name = "WORLDREND";
  readonly subtitle = "Sovereign Void";
  readonly element = "SPATIAL / VOID";
  readonly color = "#ad7bff";
  readonly icon = "⫷⫸";
  readonly cooldown = WORLDREND.cooldown; readonly range = WORLDREND.range;
  private readonly resources = new VoidResources();
  private seed = 32971;
  cast(c: AbilityCastContext): boolean {
    const target = resolveVoidTarget(c.player.position, c.groundTarget);
    if (!target) return false;
    const v = this.resources.pool.acquire();
    if (!v) return false;
    this.seed = (this.seed + 7919) >>> 0;
    c.effectManager.add(
      new WorldrendEffect(c, this.resources, v, target, this.seed),
    );
    return true;
  }
  dispose(): void {
    this.resources.dispose();
  }
}
