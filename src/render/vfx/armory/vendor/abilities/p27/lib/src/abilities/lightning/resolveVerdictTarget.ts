// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { Vector3 } from "three";
import { VERDICT } from "./verdictConfig";

/** Ground-targeted ability: invalid or sky hits reject, finite hits clamp from the player. */
export function resolveVerdictTarget(
  player: Readonly<Vector3>,
  ground: Readonly<Vector3> | null,
  result = new Vector3(),
): Vector3 | null {
  if (
    !ground ||
    ![player.x, player.y, player.z, ground.x, ground.y, ground.z].every(
      Number.isFinite,
    )
  )
    return null;
  result
    .set(ground.x - player.x, 0, ground.z - player.z)
    .clampLength(0, VERDICT.range)
    .add(player);
  result.y = 0;
  return result;
}
