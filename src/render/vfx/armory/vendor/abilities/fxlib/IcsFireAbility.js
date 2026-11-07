// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
/*!
 * ICS three-fires (140104_three_fires) (MIT)
 *
 * MIT License
 *
 * Copyright (c) 2014-2026 ICS INC.
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
 * IcsFireAbility — fxlib pack.
 *
 * A stylised fire field erupting at the target: the "three-fires" demo by
 * ICS INC. (MIT; repo "ics-fire", src/fire/*.ts) wrapped as a
 * timed zone cast. The column of hand-painted flame billboards, the embers
 * flung out in bouncing arcs with flame tails and lens flares, and the warm
 * centre light all come from the original; see lib/icsfire/FireField.js for
 * the port itself and its MIT notice.
 *
 * MIT License — Copyright (c) 2014-2026 ICS INC.
 */
import { Vector3 } from 'three';
import { Ability } from '../Ability.js';
import { DecalType } from '../../effects/GroundDecals.js';
import { settings } from '../../config/settings.js';
import { getColor } from '../../utils/color.js';
import { FireField } from './lib/icsfire/FireField.js';

const ID = 'fx_icsfire';
const _center = new Vector3();

export class IcsFireAbility extends Ability {
  constructor(context) {
    super(ID, context);
  }

  createShaders() {
    this.field = new FireField(this.group, this.ctx.camera);
    this._impactDur = 1;
    this._burnStart = 0;
    this._target = new Vector3();
  }

  get impactDuration() {
    return this._impactDur;
  }

  /** The column dies down, then the last flames and in-flight embers finish. */
  get fadeDuration() {
    const c = settings[ID];
    return Math.max(0.05, c.fadeTime) + Math.max(0.1, c.centerLifeMax) + 0.1;
  }

  lightShimmer() {
    const c = settings[ID];
    const t = this.age - this._burnStart;
    const ramp = Math.min(1, Math.max(0, t * c.lightFadeIn));
    return ramp * this.field.centerRatio * (0.85 + 0.15 * Math.sin(this.age * 31.7) * Math.sin(this.age * 13.3));
  }

  onSpawn() {
    const c = settings[ID];
    this.pointAt(1, this._target);
    this._burnStart = this.age;
    this._impactDur = 1;
    this.field.start(this._target, c, Math.max(0.1, c.lifetime));

    _center.copy(this._target);
    this.ctx.decals.spawn(DecalType.SCORCH, _center, {
      radius: c.scorchRadius,
      life: c.scorchLife,
      intensity: c.scorchIntensity,
      colorA: getColor(c.colorScorch),
      colorB: getColor(c.colorScorchGlow),
      height: 0.015
    });
    this.ctx.flash.trigger(getColor(c.colorFlash), c.igniteFlash);
    this.ctx.shake.add(c.igniteShake, 1.8, 18);
    this._tick(0);
  }

  onTravel(dt) {
    this._tick(dt);
  }

  onImpact() {
    const c = settings[ID];
    this._impactDur = Math.max(0.05, c.lifetime - this.age);
  }

  onFade(dt) {
    this._tick(dt);
  }

  _tick(dt) {
    const c = settings[ID];
    const t = this.age - this._burnStart;
    const fadeT = (t - c.lifetime) / Math.max(0.05, c.fadeTime);
    const burning = fadeT < 0;
    this.field.centerRatio = burning ? 1 : Math.max(0, 1 - fadeT);
    this.field.update(dt, t, c, burning);
    if (burning && c.holdShake > 0) this.ctx.shake.rumble(c.holdShake, dt);

    this.position.copy(this._target);
    this.position.y = c.lightHeight;
  }

  onDestroy() {
    this.field.stop();
  }

  dispose() {
    super.dispose();
    this.field.dispose();
  }
}
