// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
/*!
 * Worldrend — p27 pack.
 *
 * Space tears open in a jagged violet rift, reality shards orbit its throat, and it slams shut in a shockwave.
 *
 * Ported from itzmitto/Ability-ThreeJS-Project (MIT License, Copyright (c) 2026 itzmitto),
 * https://github.com/itzmitto/Ability-ThreeJS-Project — upstream source kept under
 * `src/abilities/p27/lib/src/`, licence in `src/abilities/p27/lib/LICENSE-ability-project-27.txt`.
 */
import { P27Ability } from './lib/P27Ability.js';
import { Worldrend } from './lib/src/abilities/void/Worldrend.ts';
import { WORLDREND } from './lib/src/abilities/void/WorldrendConfig.ts';

const KEYS = ["shock"];

export class P27WorldrendAbility extends P27Ability {
  constructor(context) {
    super('p27_worldrend', context);
    this.nativeRadius = 9.0;
    this.scalable = true;
  }

  createSource() {
    return new Worldrend();
  }

  /** Upstream reads these constants every frame, so they are live. */
  applyLive(cfg) {
    for (const key of KEYS) if (Number.isFinite(cfg[key])) WORLDREND[key] = cfg[key];
  }

  applyConfig(cfg) {
    this.applyLive(cfg);
  }
}
