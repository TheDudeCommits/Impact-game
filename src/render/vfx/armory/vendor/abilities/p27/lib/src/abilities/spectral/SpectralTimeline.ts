// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { SPECTRAL, smooth, envelope } from './SpectralBreakConfig';
/** Absolute-time envelopes make pauses, large deltas and live quality deterministic. */
export function spectralTimeline(t: number) {
  const surge = .13 * Math.exp(-(((t - 2.05) / .13) ** 2)) + .2 * Math.exp(-(((t - 2.72) / .12) ** 2)) + .35 * Math.exp(-(((t - 3.47) / .16) ** 2));
  return {
    charge: envelope(0, .25, .99, 1.12, t), compression: smooth(.65, 1.03, t),
    flash: envelope(1.05, 1.065, 1.09, 1.15, t),
    front: smooth(SPECTRAL.release, SPECTRAL.arrival, t),
    beam: envelope(1.05, 1.2, 3.35, 4.65, t) * (1 + surge),
    collapse: smooth(3.4, 5.3, t),
    impact: envelope(3.58, 3.83, 4.2, 5.55, t),
    shock: envelope(3.72, 3.83, 5.4, 6.6, t),
    aftermath: envelope(4.15, 4.75, 7.1, 9, t),
    alive: 1 - smooth(7.2, 9, t), surge,
  };
}
export function spectralStage(t: number): string {
  return t < .65 ? 'CHARGE' : t < 1.05 ? 'COMPRESSION' : t < 1.3 ? 'RELEASE' : t < 1.65 ? 'TRAVELING FRONT' : t < 3.35 ? 'SUSTAINED BEAM' : t < 3.72 ? 'OVERLOAD' : t < 4.5 ? 'PRISMATIC IMPACT' : t < 5.4 ? 'COLLAPSE' : t < 7.2 ? 'AFTERMATH' : t < 9 ? 'FADE' : 'COMPLETE';
}
