// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
/*!
 * Wring Out — p27 pack.
 *
 * A planetary core forms over the circle, drags the debris of the floor into orbit, and collapses it in one crushing pulse.
 *
 * Ported from itzmitto/Ability-ThreeJS-Project (MIT License, Copyright (c) 2026 itzmitto),
 * https://github.com/itzmitto/Ability-ThreeJS-Project — upstream source kept under
 * `src/abilities/p27/lib/src/`, licence in `src/abilities/p27/lib/LICENSE-ability-project-27.txt`.
 */
import { P27Ability } from './lib/P27Ability.js';
import { WringOut } from './lib/src/abilities/gravity/WringOut.ts';
import { GRAVITY_QUALITY } from './lib/src/abilities/gravity/WringOutConfig.ts';

const BUDGET = ["debris", "particles", "halos", "shells"];
const INTS = new Set(["debris", "particles", "halos", "shells"]);

export class P27GravityAbility extends P27Ability {
  constructor(context) {
    super('p27_gravity', context);
    this.nativeRadius = 6.0;
    this.scalable = true;
  }

  createSource() {
    return new WringOut();
  }

  /** Budget sliders shape the upstream MAX tier; LOW / MEDIUM stay as shipped. */
  applyLive(cfg) {
    const q = GRAVITY_QUALITY.MAX;
    for (const key of BUDGET) if (Number.isFinite(cfg[key])) q[key] = INTS.has(key) ? Math.round(cfg[key]) : cfg[key];
  }

  applyConfig(cfg) {
    this.applyLive(cfg);
  }
}
