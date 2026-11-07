// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { Vector3 } from "three";
import { MEGIDDO } from "./MegiddoConfig";
export function resolveMegiddoTarget(
  player: Readonly<Vector3>,
  ground: Readonly<Vector3> | null,
  out = new Vector3(),
): Vector3 | null {
  if (
    !ground ||
    ![player.x, player.y, player.z, ground.x, ground.y, ground.z].every(
      Number.isFinite,
    )
  )
    return null;
  out
    .set(ground.x - player.x, 0, ground.z - player.z)
    .clampLength(0, MEGIDDO.range)
    .add(player);
  out.y = 0;
  return out;
}
