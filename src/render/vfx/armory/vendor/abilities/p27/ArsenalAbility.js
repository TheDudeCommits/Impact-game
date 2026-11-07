// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
/*!
 * Heavenly Arsenal — p27 pack.
 *
 * A sky full of radiant swords forms over the circle, rains down point-first, then one colossal blade executes the centre.
 *
 * Ported from itzmitto/Ability-ThreeJS-Project (MIT License, Copyright (c) 2026 itzmitto),
 * https://github.com/itzmitto/Ability-ThreeJS-Project — upstream source kept under
 * `src/abilities/p27/lib/src/`, licence in `src/abilities/p27/lib/LICENSE-ability-project-27.txt`.
 */
import { P27Ability } from './lib/P27Ability.js';
import { HeavenlyArsenal } from './lib/src/abilities/heavenlyArsenal/HeavenlyArsenal.ts';
import { ARSENAL_QUALITY } from './lib/src/abilities/heavenlyArsenal/HeavenlyArsenalConfig.ts';

const BUDGET = ["swords", "trails", "particles", "fragments", "rings", "residual"];
const INTS = new Set(["swords", "trails", "particles", "fragments", "rings"]);

export class P27ArsenalAbility extends P27Ability {
  constructor(context) {
    super('p27_arsenal', context);
    this.nativeRadius = 7.0;
    this.scalable = true;
  }

  createSource() {
    return new HeavenlyArsenal();
  }

  /** Budget sliders shape the upstream MAX tier; LOW / MEDIUM stay as shipped. */
  applyLive(cfg) {
    const q = ARSENAL_QUALITY.MAX;
    for (const key of BUDGET) if (Number.isFinite(cfg[key])) q[key] = INTS.has(key) ? Math.round(cfg[key]) : cfg[key];
  }

  applyConfig(cfg) {
    this.applyLive(cfg);
  }
}
