// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
/*!
 * Shadow Colossus — p27 pack.
 *
 * Two colossal shadow arms claw up out of the floor around the circle and crush it between them.
 *
 * Ported from itzmitto/Ability-ThreeJS-Project (MIT License, Copyright (c) 2026 itzmitto),
 * https://github.com/itzmitto/Ability-ThreeJS-Project — upstream source kept under
 * `src/abilities/p27/lib/src/`, licence in `src/abilities/p27/lib/LICENSE-ability-project-27.txt`.
 */
import { P27Ability } from './lib/P27Ability.js';
import { ShadowColossus } from './lib/src/abilities/shadowColossus/ShadowColossus.ts';
import { SHADOW_QUALITY } from './lib/src/abilities/shadowColossus/ShadowColossusConfig.ts';

const BUDGET = ["motes", "mist", "fragments", "filaments", "shells"];
const INTS = new Set(["motes", "mist", "fragments", "filaments", "shells"]);

export class P27ColossusAbility extends P27Ability {
  constructor(context) {
    super('p27_colossus', context);
    this.nativeRadius = 7.0;
    this.scalable = true;
  }

  createSource() {
    return new ShadowColossus();
  }

  /** Budget sliders shape the upstream MAX tier; LOW / MEDIUM stay as shipped. */
  applyLive(cfg) {
    const q = SHADOW_QUALITY.MAX;
    for (const key of BUDGET) if (Number.isFinite(cfg[key])) q[key] = INTS.has(key) ? Math.round(cfg[key]) : cfg[key];
  }

  applyConfig(cfg) {
    this.applyLive(cfg);
  }
}
