import type { GroundPlan } from '../build';
import { SandPrints } from '../sand';
import { GROUND_TIERS } from '../quality';

/** 'Cinder Flats': the white desert under the night fortress takes every footprint -
 *  pressed wraiths in the moonlit sand, filling in again as the wind crosses
 *  it - and its dust is the game's own. Nothing grows there. */
export const CINDER_GROUND: GroundPlan = {
  sand(c) {
    const prints = new SandPrints(c.frame, {
      name: 'cinder sand', rect: { x0: -40, z0: -40, x1: 40, z1: 40 }, level: 0,
      // A fresh print's hollow at under half the sand's light (a hollow in
      // moonlit sand reads dark), filling in over half a minute.
      life: 30, shade: .45,
    }, GROUND_TIERS.high.prints);
    c.group.add(prints.mesh);
    c.own(prints);
  },
};
