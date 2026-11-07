// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
/*!
 * Astral Chainstorm — p27 pack.
 *
 * Rune-forged chains whip out of the hand, coil around the target, constrict, and slam it into the floor.
 *
 * Ported from itzmitto/Ability-ThreeJS-Project (MIT License, Copyright (c) 2026 itzmitto),
 * https://github.com/itzmitto/Ability-ThreeJS-Project — upstream source kept under
 * `src/abilities/p27/lib/src/`, licence in `src/abilities/p27/lib/LICENSE-ability-project-27.txt`.
 */
import { P27Ability } from './lib/P27Ability.js';
import { AstralChainstorm } from './lib/src/abilities/astralChainstorm/AstralChainstorm.ts';

const KEYS = ["chainCount", "linksPerChain", "linkLength", "linkThickness", "chainSpacing", "launchSpeed", "whipAmplitude", "whipFrequency", "wrapRadius", "wrapSpeed", "constrictTime", "runeBrightness", "runePulseSpeed", "metalRoughness", "scratchScale", "sparkDensity", "fragmentCount", "impactIntensity", "waterRippleStrength"];
const SHAPE = new Set(["linkLength", "linkThickness"]);
const RENAME = {};

export class P27ChainstormAbility extends P27Ability {
  constructor(context) {
    super('p27_chainstorm', context);

  }

  createSource() {
    return new AstralChainstorm();
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
      console.warn('[p27] p27_chainstorm configure', error);
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
