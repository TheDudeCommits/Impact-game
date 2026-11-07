// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
/*!
 * HandCastAbilityThreeJS (extended pack) (MIT)
 *
 * MIT License
 *
 * Copyright (c) 2026 mohamedachrefelouafi
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
 * LinearAbiltyCastingExtendedThreeJS (extended pack) (MIT)
 *
 * MIT License
 *
 * Copyright (c) 2026 mohamedachrefelouafi
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
 * ExtAbility — the base every extended-pack ability extends.
 *
 * The extended pack ports achrefelouafi/LinearAbiltyCastingExtendedThreeJS and
 * achrefelouafi/HandCastAbilityThreeJS into the armory. Their Ability base is
 * the armory's with a few additions; this class supplies those, so a ported
 * class only has to change its `extends`:
 *
 *  - `config`         the block as a *nested* live view (see lib/nest.js), so
 *                     `this.config.hit.impulse` works over the flat block.
 *  - `dummies`        the pack's practice-target field (lib/combat/field.js),
 *                     in place of the source App's `ctx.dummies`.
 *  - `models`         built rigs, in place of the source App's `ctx.models`.
 *  - `handlesOwnHits` / `cameraWeight` — the source base's two extra getters.
 *  - `holdDistortion()` — the base PostProcessing skips the refraction pass
 *                     unless someone has retained it (core/Layers.js). Called
 *                     automatically on spawn when any mesh under `this.group`
 *                     is on LAYER.DISTORTION; call it yourself for writers that
 *                     live elsewhere. Released automatically on destroy.
 *  - enables the `SHAPED` render layer (lib/layers.js) once.
 *
 * MIT, Copyright (c) 2026 mohamedachrefelouafi (source architecture).
 */
import { Ability, AbilityPhase } from '../../Ability.js';

export { AbilityPhase };
import { settings } from '../../../config/settings.js';
import { LAYER as BASE_LAYER, retainDistortion, releaseDistortion } from '../../../core/Layers.js';
import { saturate } from '../../../utils/math.js';
import { nest } from './nest.js';
import { extModels } from './assets.js';
import { ensureField, trackCast, untrackCast } from './combat/field.js';
import { enableShapedLayer } from './layers.js';

/**
 * Keeps a ported distortion writer 1:1 with the source repos.
 *
 * Source pass: offset = dir * B * A * 0.045 (post.distortion = 0.045), and the
 * writers folded `global.distortion` into their own strength.
 * Armory pass: offset = dir * B * post.distortion (1.0) * global.distortion,
 * with no alpha term.
 * So a ported writer must: write B *= A in its shader, multiply its strength by
 * DISTORTION_MATCH, and stop applying `global.distortion` itself.
 * (Same value as `lib/linear/sourceDistortion.js#SOURCE_POST_DISTORTION`.)
 */
export const DISTORTION_MATCH = 0.045;

export class ExtAbility extends Ability {
  constructor(element, context) {
    enableShapedLayer(context);
    super(element, context);
    this._distortionHeld = false;
  }

  /** Live nested view over `settings[this.element]`. */
  get config() {
    return nest(settings[this.element]);
  }

  /** The pack's practice targets (`findTargets`, `findBodies`, ...). */
  get dummies() {
    return ensureField(this.ctx);
  }

  /** Built model rigs, filled by each module's `preload()`. */
  get models() {
    return extModels;
  }

  get handlesOwnHits() {
    return false;
  }

  get cameraWeight() {
    return saturate(1 - this.u * 0.4);
  }

  /** Keep the refraction pass running while this cast is out. */
  holdDistortion() {
    if (this._distortionHeld) return;
    this._distortionHeld = true;
    retainDistortion();
  }

  dropDistortion() {
    if (!this._distortionHeld) return;
    this._distortionHeld = false;
    releaseDistortion();
  }

  spawn(origin, direction, distance) {
    ensureField(this.ctx);
    super.spawn(origin, direction, distance);
    trackCast(this);
    // Any mesh of ours on LAYER.DISTORTION means the refraction pass has to
    // run while this cast is out (the base skips it when nobody retained it).
    if (this._writesDistortion === undefined) {
      let found = false;
      this.group.traverse((node) => {
        if (node.isMesh && node.layers.isEnabled(BASE_LAYER.DISTORTION)) found = true;
      });
      this._writesDistortion = found;
    }
    if (this._writesDistortion) this.holdDistortion();
  }

  destroy() {
    untrackCast(this);
    super.destroy();
    this.dropDistortion();
  }
}
