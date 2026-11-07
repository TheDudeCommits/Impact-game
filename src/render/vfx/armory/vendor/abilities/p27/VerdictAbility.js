// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
/*!
 * Heaven's Verdict — p27 pack.
 *
 * Storm cloud gathers, precursors feel for the ground, and a single verdict bolt splits the sky and runs out across the floor.
 *
 * Ported from itzmitto/Ability-ThreeJS-Project (MIT License, Copyright (c) 2026 itzmitto),
 * https://github.com/itzmitto/Ability-ThreeJS-Project — upstream source kept under
 * `src/abilities/p27/lib/src/`, licence in `src/abilities/p27/lib/LICENSE-ability-project-27.txt`.
 */
import { P27Ability } from './lib/P27Ability.js';
import { HeavensVerdict } from './lib/src/abilities/lightning/HeavensVerdict.ts';
import { VERDICT } from './lib/src/abilities/lightning/verdictConfig.ts';

const KEYS = ["height", "discharge", "afterimage"];

export class P27VerdictAbility extends P27Ability {
  constructor(context) {
    super('p27_verdict', context);
    this.nativeRadius = 8.0;
    this.scalable = true;
  }

  createSource() {
    return new HeavensVerdict();
  }

  /** Upstream reads these constants every frame, so they are live. */
  applyLive(cfg) {
    for (const key of KEYS) if (Number.isFinite(cfg[key])) VERDICT[key] = cfg[key];
  }

  applyConfig(cfg) {
    this.applyLive(cfg);
  }
}
