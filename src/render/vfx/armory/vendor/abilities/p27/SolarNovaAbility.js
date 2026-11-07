// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
/*!
 * Solar Nova — p27 pack.
 *
 * A dawnstar is raised over the circle, gathers rings and flares, compresses, and goes nova.
 *
 * Ported from itzmitto/Ability-ThreeJS-Project (MIT License, Copyright (c) 2026 itzmitto),
 * https://github.com/itzmitto/Ability-ThreeJS-Project — upstream source kept under
 * `src/abilities/p27/lib/src/`, licence in `src/abilities/p27/lib/LICENSE-ability-project-27.txt`.
 */
import { P27Ability } from './lib/P27Ability.js';
import { SolarNova } from './lib/src/abilities/solar/SolarNova.ts';
import { SOLAR_QUALITY } from './lib/src/abilities/solar/SolarNovaConfig.ts';

const BUDGET = ["rings", "flares", "particles", "fragments", "blades", "rays"];
const INTS = new Set(["rings", "flares", "particles", "fragments", "blades", "rays"]);

export class P27SolarNovaAbility extends P27Ability {
  constructor(context) {
    super('p27_solarnova', context);
    this.nativeRadius = 8.0;
    this.scalable = true;
  }

  createSource() {
    return new SolarNova();
  }

  /** Budget sliders shape the upstream MAX tier; LOW / MEDIUM stay as shipped. */
  applyLive(cfg) {
    const q = SOLAR_QUALITY.MAX;
    for (const key of BUDGET) if (Number.isFinite(cfg[key])) q[key] = INTS.has(key) ? Math.round(cfg[key]) : cfg[key];
  }

  applyConfig(cfg) {
    this.applyLive(cfg);
  }
}
