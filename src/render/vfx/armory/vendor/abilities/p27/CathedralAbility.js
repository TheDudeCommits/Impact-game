// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
/*!
 * Prismatic Cathedral — p27 pack.
 *
 * A prism sigil cracks across the floor and a cathedral of crystal spires erupts out of it, then bursts into light.
 *
 * Ported from itzmitto/Ability-ThreeJS-Project (MIT License, Copyright (c) 2026 itzmitto),
 * https://github.com/itzmitto/Ability-ThreeJS-Project — upstream source kept under
 * `src/abilities/p27/lib/src/`, licence in `src/abilities/p27/lib/LICENSE-ability-project-27.txt`.
 */
import { P27Ability } from './lib/P27Ability.js';
import { PrismaticCathedral } from './lib/src/abilities/prismaticCathedral/PrismaticCathedral.ts';
import { PRISM_QUALITY } from './lib/src/abilities/prismaticCathedral/PrismaticCathedralConfig.ts';

const BUDGET = ["spikes", "shards", "particles", "mist", "rays"];
const INTS = new Set(["spikes", "shards", "particles", "mist", "rays"]);

export class P27CathedralAbility extends P27Ability {
  constructor(context) {
    super('p27_cathedral', context);
    this.nativeRadius = 8.0;
    this.scalable = true;
  }

  createSource() {
    return new PrismaticCathedral();
  }

  /** Budget sliders shape the upstream MAX tier; LOW / MEDIUM stay as shipped. */
  applyLive(cfg) {
    const q = PRISM_QUALITY.MAX;
    for (const key of BUDGET) if (Number.isFinite(cfg[key])) q[key] = INTS.has(key) ? Math.round(cfg[key]) : cfg[key];
  }

  applyConfig(cfg) {
    this.applyLive(cfg);
  }
}
