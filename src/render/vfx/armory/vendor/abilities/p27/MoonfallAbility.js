// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
/*!
 * Abyssal Moonfall — p27 pack.
 *
 * A fractured moon assembles in the far sky, storms and splits, then falls onto the circle in a crater of light.
 *
 * Ported from itzmitto/Ability-ThreeJS-Project (MIT License, Copyright (c) 2026 itzmitto),
 * https://github.com/itzmitto/Ability-ThreeJS-Project — upstream source kept under
 * `src/abilities/p27/lib/src/`, licence in `src/abilities/p27/lib/LICENSE-ability-project-27.txt`.
 */
import { P27Ability } from './lib/P27Ability.js';
import { AbyssalMoonfall } from './lib/src/abilities/abyssalMoonfall/AbyssalMoonfall.ts';

const KEYS = ["moonRadius", "moonHeight", "moonRotationSpeed", "craterDepth", "displacementScale", "rockRoughness", "fractureDensity", "fractureBrightness", "ringRotationSpeed", "satelliteCount", "debrisCount", "stormDensity", "stormRadius", "lightningFrequency", "lightningIntensity", "descentDuration", "impactFlash", "shockwaveRadius", "waterDisplacement", "sprayIntensity", "aftermathDuration"];
const SHAPE = new Set(["craterDepth", "displacementScale"]);
const RENAME = {"shockwaveRadius": "moonShockwaveRadius"};

export class P27MoonfallAbility extends P27Ability {
  constructor(context) {
    super('p27_moonfall', context);

  }

  createSource() {
    return new AbyssalMoonfall();
  }

  _patch(cfg, liveOnly) {
    const patch = {};
    for (const key of KEYS) {
      if (liveOnly && SHAPE.has(key)) continue;
      const v = cfg[RENAME[key] ?? key];
      if (Number.isFinite(v)) patch[key] = v;
    }
    return patch;
  }

  /** Upstream `configure()` validates and clamps; shape keys rebuild geometry between casts. */
  applyConfig(cfg) {
    try {
      this.source.configure(this._patch(cfg, false));
    } catch (error) {
      console.warn('[p27] p27_moonfall configure', error);
    }
  }
}
