// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import type { Ability, AbilityCastContext } from "../Ability";
import { MEGIDDO } from "./MegiddoConfig";
import { resolveMegiddoTarget } from "./resolveMegiddoTarget";
import { MegiddoResources } from "./MegiddoResources";
import { MegiddoEffect } from "./MegiddoEffect";
export class Megiddo implements Ability {
  readonly id = "megiddo";
  readonly name = "MEGIDDO";
  readonly element = "LIGHT";
  readonly color = "#f5dfb1";
  readonly icon = "✧";
  readonly cooldown = MEGIDDO.cooldown; readonly range = MEGIDDO.range;
  private readonly resources = new MegiddoResources();
  private seed = 39119;
  cast(context: AbilityCastContext): boolean {
    const target = resolveMegiddoTarget(
      context.player.position,
      context.groundTarget,
    );
    if (!target) return false;
    const visuals = this.resources.pool.acquire();
    if (!visuals) return false;
    this.seed = (this.seed + 7919) >>> 0;
    context.effectManager.add(
      new MegiddoEffect(context, this.resources, visuals, target, this.seed),
    );
    return true;
  }
  dispose(): void {
    this.resources.dispose();
  }
}
