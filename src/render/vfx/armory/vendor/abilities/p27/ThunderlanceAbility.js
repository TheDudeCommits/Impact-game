// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
/*!
 * Thunderlance — p27 pack.
 *
 * A spear of lightning is forged in a crackling cage, hurled downrange, and overloads into a storm of branches where it lands.
 *
 * Ported from itzmitto/Ability-ThreeJS-Project (MIT License, Copyright (c) 2026 itzmitto),
 * https://github.com/itzmitto/Ability-ThreeJS-Project — upstream source kept under
 * `src/abilities/p27/lib/src/`, licence in `src/abilities/p27/lib/LICENSE-ability-project-27.txt`.
 */
import { P27Ability } from './lib/P27Ability.js';
import { Thunderlance } from './lib/src/abilities/thunderlance/Thunderlance.ts';
import { THUNDER_QUALITY } from './lib/src/abilities/thunderlance/ThunderlanceConfig.ts';

const BUDGET = ["branches", "cage", "sparks"];
const INTS = new Set(["branches", "cage", "sparks"]);

export class P27ThunderlanceAbility extends P27Ability {
  constructor(context) {
    super('p27_thunderlance', context);
    this.scalable = true;
  }

  createSource() {
    return new Thunderlance();
  }

  /** Budget sliders shape the upstream MAX tier; LOW / MEDIUM stay as shipped. */
  applyLive(cfg) {
    const q = THUNDER_QUALITY.MAX;
    for (const key of BUDGET) if (Number.isFinite(cfg[key])) q[key] = INTS.has(key) ? Math.round(cfg[key]) : cfg[key];
  }

  applyConfig(cfg) {
    this.applyLive(cfg);
  }
}
