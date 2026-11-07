// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
/*!
 * Megiddo — p27 pack.
 *
 * A celestial array locks onto the circle and drives column after column of white light into it.
 *
 * Ported from itzmitto/Ability-ThreeJS-Project (MIT License, Copyright (c) 2026 itzmitto),
 * https://github.com/itzmitto/Ability-ThreeJS-Project — upstream source kept under
 * `src/abilities/p27/lib/src/`, licence in `src/abilities/p27/lib/LICENSE-ability-project-27.txt`.
 */
import { P27Ability } from './lib/P27Ability.js';
import { Megiddo } from './lib/src/abilities/light/Megiddo.ts';
import { MEGIDDO } from './lib/src/abilities/light/MegiddoConfig.ts';

const KEYS = ["height"];

export class P27MegiddoAbility extends P27Ability {
  constructor(context) {
    super('p27_megiddo', context);
    this.nativeRadius = 6.6;
    this.scalable = true;
  }

  createSource() {
    return new Megiddo();
  }

  /** Upstream reads these constants every frame, so they are live. */
  applyLive(cfg) {
    for (const key of KEYS) if (Number.isFinite(cfg[key])) MEGIDDO[key] = cfg[key];
  }

  applyConfig(cfg) {
    this.applyLive(cfg);
  }
}
