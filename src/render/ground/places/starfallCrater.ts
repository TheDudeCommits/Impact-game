import type { GroundPlan } from '../build';
import { SandPrints } from '../sand';
import { GROUND_TIERS } from '../quality';

/** The crater: its flat floor is loose, swept earth -
 *  it takes every footprint, a shallow hollow darker than the dust, and the
 *  settling dust fills it in. Nothing grows there. */
export const CRATER_GROUND: GroundPlan = {
  sand(c) {
    const prints = new SandPrints(c.frame, {
      name: 'crater earth', rect: { x0: -40, z0: -40, x1: 40, z1: 40 }, level: 0,
      // Ochre earth in daylight: a fresh print a little darker than Cinder Flats's moonlit one needs, settling in 40 s.
      life: 40, shade: .62,
    }, GROUND_TIERS.high.prints);
    c.group.add(prints.mesh);
    c.own(prints);
  },
};
