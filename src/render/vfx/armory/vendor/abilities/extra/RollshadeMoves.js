// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
/*!
 * rollshade (MIT)
 *
 * MIT License
 *
 * Copyright (c) 2026 tsuyatt
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
/*!
 * Rollshade moves — fourteen anime fighter moves from rollshade
 * (https://github.com/tsuyatt/rollshade, MIT, © 2026 tsuyatt), running on the
 * GLSL port of its runtime in `lib/rs/`. Each class is one recipe bound to one
 * settings block; the element slider swaps the whole elemental behaviour
 * (fire flames, ice crystals, thunder bolts, wind tornado, earth spikes …), not
 * just the colours.
 */
import { RSAbility } from './lib/rs/RSAbility.js';
import { iaido, cross, flurry, dash, wave, spin } from './lib/rs/recipes/melee.js';
import { rush, uppercut, palm, heel, pound } from './lib/rs/recipes/blunt.js';
import { beam, nova } from './lib/rs/recipes/magic.js';
import { shockwave } from './lib/rs/recipes/strike.js';

export class RsIaido extends RSAbility {
  constructor(ctx) {
    super('extra_iaido', ctx, iaido);
  }
}
export class RsCross extends RSAbility {
  constructor(ctx) {
    super('extra_cross', ctx, cross);
  }
}
export class RsFlurry extends RSAbility {
  constructor(ctx) {
    super('extra_flurry', ctx, flurry);
  }
}
export class RsDash extends RSAbility {
  constructor(ctx) {
    super('extra_dash', ctx, dash);
  }
}
export class RsBladeWave extends RSAbility {
  constructor(ctx) {
    super('extra_bladewave', ctx, wave);
  }
}
export class RsSpin extends RSAbility {
  constructor(ctx) {
    super('extra_spin', ctx, spin);
  }
}
export class RsRush extends RSAbility {
  constructor(ctx) {
    super('extra_rush', ctx, rush);
  }
}
export class RsUppercut extends RSAbility {
  constructor(ctx) {
    super('extra_uppercut', ctx, uppercut);
  }
}
export class RsPalm extends RSAbility {
  constructor(ctx) {
    super('extra_palm', ctx, palm);
  }
}
export class RsHeel extends RSAbility {
  constructor(ctx) {
    super('extra_heel', ctx, heel);
  }
}
export class RsPound extends RSAbility {
  constructor(ctx) {
    super('extra_pound', ctx, pound);
  }
}
export class RsBeam extends RSAbility {
  constructor(ctx) {
    super('extra_beam', ctx, beam);
  }
}
export class RsNova extends RSAbility {
  constructor(ctx) {
    super('extra_nova', ctx, nova);
  }
}
export class RsShockwave extends RSAbility {
  constructor(ctx) {
    super('extra_shockwave', ctx, shockwave);
  }
}
