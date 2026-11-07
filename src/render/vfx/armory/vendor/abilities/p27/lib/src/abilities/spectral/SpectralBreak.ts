// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import type { Ability, AbilityCastContext } from '../Ability';
import { SPECTRAL } from './SpectralBreakConfig';
import { resolveSpectralTarget } from './resolveSpectralTarget';
import { SpectralResourcePool } from './SpectralResourcePool';
import { SpectralBreakEffect } from './SpectralBreakEffect';
export class SpectralBreak implements Ability {
  readonly id = 'spectral-break'; readonly name = 'SPECTRAL BREAK'; readonly subtitle = 'PRISMATIC ANNIHILATION';
  readonly element = 'LIGHT / SPECTRAL ENERGY'; readonly color = '#65eaff'; readonly icon = 'spectral-break'; readonly cooldown = SPECTRAL.cooldown; readonly range = SPECTRAL.range;
  readonly resources = new SpectralResourcePool();
  cast(context: AbilityCastContext): boolean { const target = resolveSpectralTarget(context.origin, context.groundTarget, context.direction); if (!target) return false; const v = this.resources.pool.acquire(); if (!v) return false; context.effectManager.add(new SpectralBreakEffect(context, this.resources, v, target)); return true; }
  dispose(): void { this.resources.dispose(); }
}
