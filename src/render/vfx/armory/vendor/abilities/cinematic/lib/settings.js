// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
/**
 * Settings shim for the cinematic pack (ported from achrefelouafi/AbilityCastingThreeJS, MIT).
 *
 * The ported code reads `settings.shark`, `settings.global`, `settings.dummies`…
 * the way the source repo laid its one settings tree out. Here every ability
 * block lives in the base tree under a pack-prefixed id (`cin_shark`), so this
 * proxy maps the source names onto the live base blocks — editor sliders stay
 * live — and supplies the handful of source-only blocks (the dummy constants
 * the abilities aim at) as local constants.
 */
import { settings as base } from '../../../config/settings.js';

/** source block name -> armory ability id */
export const CIN_IDS = Object.freeze({
  shark: 'cin_shark',
  wolf: 'cin_wolf',
  chains: 'cin_chains',
  dragon: 'cin_dragon',
  gyro: 'cin_gyro',
  tome: 'cin_tome',
  reliquary: 'cin_reliquary',
  amethyst: 'cin_amethyst',
  lance: 'cin_lance'
});

/** The source's target dummies, reduced to the constants the abilities read. */
const LOCAL = {
  dummies: {
    height: 1.78,
    bodyRadius: 0.42,
    ragdoll: { gravity: -19.0 }
  }
};

export const settings = new Proxy(
  {},
  {
    get(_, key) {
      if (typeof key !== 'string') return undefined;
      const mapped = CIN_IDS[key];
      if (mapped) return base[mapped];
      if (key in LOCAL) return LOCAL[key];
      return base[key];
    },
    has(_, key) {
      return key in CIN_IDS || key in LOCAL || key in base;
    }
  }
);
