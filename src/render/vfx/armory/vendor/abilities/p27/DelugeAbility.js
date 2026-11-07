// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
/*!
 * Seraphic Deluge — p27 pack.
 *
 * Gates of light open overhead and a millennium of blades pours down across a wide golden ring.
 *
 * Ported from itzmitto/Ability-ThreeJS-Project (MIT License, Copyright (c) 2026 itzmitto),
 * https://github.com/itzmitto/Ability-ThreeJS-Project — upstream source kept under
 * `src/abilities/p27/lib/src/`, licence in `src/abilities/p27/lib/LICENSE-ability-project-27.txt`.
 */
import { P27Ability } from './lib/P27Ability.js';
import { SeraphicDeluge } from './lib/src/abilities/seraphicDeluge/SeraphicDeluge.ts';
import { DELUGE_QUALITY } from './lib/src/abilities/seraphicDeluge/SeraphicDelugeConfig.ts';

const BUDGET = ["rain", "final", "embedded", "gates", "trails", "sparks", "mist"];
const INTS = new Set(["rain", "final", "embedded", "gates", "trails", "sparks", "mist"]);

export class P27DelugeAbility extends P27Ability {
  constructor(context) {
    super('p27_deluge', context);
    this.nativeRadius = 14.0;
    this.scalable = true;
  }

  createSource() {
    return new SeraphicDeluge();
  }

  /** Budget sliders shape the upstream MAX tier; LOW / MEDIUM stay as shipped. */
  applyLive(cfg) {
    const q = DELUGE_QUALITY.MAX;
    for (const key of BUDGET) if (Number.isFinite(cfg[key])) q[key] = INTS.has(key) ? Math.round(cfg[key]) : cfg[key];
    q.total = q.rain + q.final;
  }

  applyConfig(cfg) {
    this.applyLive(cfg);
  }
}
