// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
/*!
 * Sand Reaper — p27 pack.
 *
 * A crescent cleaver of carved stone assembles in the hand, spins downrange and bursts into sand and shards.
 *
 * Ported from itzmitto/Ability-ThreeJS-Project (MIT License, Copyright (c) 2026 itzmitto),
 * https://github.com/itzmitto/Ability-ThreeJS-Project — upstream source kept under
 * `src/abilities/p27/lib/src/`, licence in `src/abilities/p27/lib/LICENSE-ability-project-27.txt`.
 */
import { P27Ability } from './lib/P27Ability.js';
import { SandReaper } from './lib/src/abilities/sandReaper/SandReaper.ts';

const KEYS = ["bladeLength", "bladeWidth", "bladeThickness", "crescentCurvature", "facetRoughness", "bladeSpinSpeed", "flightSpeed", "noiseFrequency", "sandDensity", "sandTurbulence", "fragmentCount", "fragmentSpeed", "mineralGlow", "dustOpacity", "impactRadius"];
const SHAPE = new Set(["bladeLength", "bladeWidth", "bladeThickness", "crescentCurvature", "facetRoughness"]);
const RENAME = {};

export class P27SandReaperAbility extends P27Ability {
  constructor(context) {
    super('p27_sandreaper', context);

  }

  createSource() {
    return new SandReaper();
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
      console.warn('[p27] p27_sandreaper configure', error);
    }
  }

  /** Scalar controls are read every frame upstream; write them straight through. */
  applyLive(cfg) {
    const controls = this.source.controls;
    if (!controls) return;
    const patch = this._patch(cfg, true);
    for (const key in patch) {
      const v = patch[key];
      if (controls[key] !== v) controls[key] = Math.round(v * 1e4) / 1e4;
    }
  }
}
