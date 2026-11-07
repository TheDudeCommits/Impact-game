// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
/*!
 * Tempest Cataclysm — p27 pack.
 *
 * A storm dragon assembles out of cloud and lightning, wheels over the circle and breathes a thunder beam into it.
 *
 * Ported from itzmitto/Ability-ThreeJS-Project (MIT License, Copyright (c) 2026 itzmitto),
 * https://github.com/itzmitto/Ability-ThreeJS-Project — upstream source kept under
 * `src/abilities/p27/lib/src/`, licence in `src/abilities/p27/lib/LICENSE-ability-project-27.txt`.
 */
import { P27Ability } from './lib/P27Ability.js';
import { TempestCataclysm } from './lib/src/abilities/stormDragon/TempestCataclysm.ts';

export class P27StormDragonAbility extends P27Ability {
  constructor(context) {
    super('p27_stormdragon', context);
    this.nativeRadius = 30.0;
    this.scalable = true;
  }

  createSource() {
    return new TempestCataclysm();
  }

}
