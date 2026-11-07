// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
/*!
 * Spectral Break — p27 pack.
 *
 * A prismatic charge compresses in the hand and lets go as a torrent of spectral ribbons that detonates into a shell of light.
 *
 * Ported from itzmitto/Ability-ThreeJS-Project (MIT License, Copyright (c) 2026 itzmitto),
 * https://github.com/itzmitto/Ability-ThreeJS-Project — upstream source kept under
 * `src/abilities/p27/lib/src/`, licence in `src/abilities/p27/lib/LICENSE-ability-project-27.txt`.
 */
import { P27Ability } from './lib/P27Ability.js';
import { SpectralBreak } from './lib/src/abilities/spectral/SpectralBreak.ts';

export class P27SpectralAbility extends P27Ability {
  constructor(context) {
    super('p27_spectral', context);

  }

  createSource() {
    return new SpectralBreak();
  }

}
