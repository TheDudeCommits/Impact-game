// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
/*!
 * ICS three.js save point / magic circle (160304_threejs_save_point) (MIT)
 *
 * MIT License
 *
 * Copyright (c) 2017 - 2026 ICS INC.
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
 * MagicCircleAbility — the ICS save-point magic circle as a ZONE summon.
 *
 * Source: ICS INC. `ics-magic-circle` (MIT, Copyright (c) 2017 - 2026 ICS INC.),
 * src/effects/{MagicCircle,Pillar,Swirl}.ts, src/particles/*,
 * src/objects/SavePoint.ts. The look is re-implemented in GLSL in
 * `lib/magiccircle/SavePointMesh.js` (the original is WebGPU + gsap); the gsap
 * timeline of `SavePoint.start()` is evaluated analytically here, played once:
 * the layers draw themselves on (centre first), the floor glow spreads, the
 * pillar rises out of the floor, one energy pulse fires the wave of rising
 * streaks, then it fades. Shared systems add the shockwave decals, flash,
 * shake and the dynamic light.
 */
import { Vector3 } from 'three';
import { Ability, AbilityPhase } from '../Ability.js';
import { SavePointMesh } from './lib/magiccircle/SavePointMesh.js';
import { DecalType } from '../../effects/GroundDecals.js';
import { settings } from '../../config/settings.js';
import { getColor } from '../../utils/color.js';
import { saturate, lerp } from '../../utils/math.js';

const ORIGINAL_RADIUS = 3;

const backOut = (t, s = 1.4) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
const expoOut = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
const pow4Out = (t) => 1 - Math.pow(1 - t, 4);
const pow3InOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const pow1Out = (t) => 1 - (1 - t) * (1 - t);

const _centre = new Vector3();
const _state = {
  energy: 0,
  sparkle: 0.2,
  fade: 1,
  tint: null,
  spin: 1,
  layerScale: [0, 0, 0],
  layerReveal: [0, 0, 0],
  revealEdge: 1,
  circleTurn: 0,
  circleGain: 1,
  floorScale: 0,
  groundGain: 1,
  swirlGain: 1,
  spreadGain: 1,
  pillarGain: 1,
  pillarY: -8,
  pillarHeight: 1,
  pillarWidth: 1,
  clipY: 0,
  ambient: 0,
  wave: 1,
  time: 0,
  waveTime: -1,
  seed: 0
};

export class MagicCircleAbility extends Ability {
  constructor(context) {
    super('fx_magiccircle', context);
  }

  createShaders() {
    this.savePoint = new SavePointMesh();
    this.group.add(this.savePoint.object3D);
    this._openAt = -1;
    this._waved = false;
    this._seed = 0;
    this._energy = 0;
  }

  get impactDuration() {
    return Math.max(0.1, settings.fx_magiccircle.lifetime * settings.global.lifetime);
  }

  get fadeDuration() {
    return Math.max(0.05, settings.fx_magiccircle.fadeTime);
  }

  lightShimmer() {
    const twinkle = 0.92 + 0.08 * Math.sin(this.age * 23.0);
    return (0.35 + this._energy * 1.4) * twinkle;
  }

  onSpawn() {
    this._openAt = -1;
    this._waved = false;
    this._energy = 0;
    this._seed = Math.random() * Math.PI * 2;
    this.savePoint.reset();
    this.savePoint.object3D.visible = false;
  }

  _elapsed() {
    return this._openAt < 0 ? -1 : this.age - this._openAt;
  }

  _energyAt(T) {
    const c = settings.fx_magiccircle;
    const t0 = c.pulseDelay;
    const t1 = t0 + Math.max(0.01, c.pulseRise);
    const idle = c.idleEnergy;
    if (T < t0) return idle;
    if (T < t1) return lerp(idle, c.energyPeak, pow3InOut((T - t0) / (t1 - t0)));
    return lerp(c.energyPeak, idle, pow1Out(saturate((T - t1) / Math.max(0.01, c.pulseDecay))));
  }

  _sync(dt) {
    const c = settings.fx_magiccircle;
    const g = settings.global;
    const T = this._elapsed();
    if (T < 0) {
      this.savePoint.object3D.visible = false;
      return;
    }
    this.savePoint.object3D.visible = true;

    const k = c.zoneRadius / ORIGINAL_RADIUS;
    this.pointAt(1, _centre).setY(0);
    const root = this.savePoint.object3D;
    root.position.copy(_centre);
    root.scale.setScalar(k);

    const energy = this._energyAt(T);
    this._energy = energy;
    const peakT = c.pulseDelay + c.pulseRise;
    const sparkle = T < c.pulseDelay ? 0.2 : T < peakT
      ? lerp(0.2, 1, pow3InOut((T - c.pulseDelay) / Math.max(0.01, c.pulseRise)))
      : lerp(1, 0.2, pow1Out(saturate((T - peakT) / Math.max(0.01, c.pulseDecay))));

    let fade = 1;
    if (this.phase === AbilityPhase.FADE) fade = 1 - saturate(this.fadeTime / this.fadeDuration);

    const s = _state;
    s.energy = energy;
    s.sparkle = sparkle;
    s.fade = fade * g.opacity;
    s.tint = getColor(c.colorTint);
    s.spin = c.spin;

    // MagicCircle.startEntrance: reversed layers, stagger, back.out(1.4).
    for (let i = 0; i < 3; i++) {
      const order = 2 - i; // centre layer (index 2) first
      const lt = saturate((T - order * c.drawStagger) / Math.max(0.01, c.drawTime));
      s.layerScale[i] = lt <= 0 ? 0 : backOut(lt);
      s.layerReveal[i] = pow1Out(saturate((T - order * c.drawStagger) / Math.max(0.01, c.revealTime)));
    }
    s.revealEdge = c.revealEdge;
    const et = saturate(T / Math.max(0.01, c.entranceTime));
    s.circleTurn = lerp(-Math.PI / 2, 0, expoOut(et));
    s.circleGain = c.circleGain * g.glow;
    s.floorScale = expoOut(et);
    s.groundGain = c.groundGain * g.glow;
    s.swirlGain = c.swirlGain * g.glow;
    s.spreadGain = c.spreadGain * g.glow;
    s.pillarGain = c.pillarGain * g.glow;
    s.pillarY = lerp(-8, 0, pow4Out(et));
    s.pillarHeight = c.pillarHeight;
    s.pillarWidth = c.pillarWidth;
    s.clipY = 0;
    s.ambient = c.ambient * saturate(T / 0.6);
    s.wave = c.wave;
    s.time = T + 8; // ambient risers already mid-cycle, as gsap .progress(random)
    const waveAt = peakT - c.waveLead;
    s.waveTime = T >= waveAt ? T - waveAt : -1;
    s.seed = this._seed;

    if (!this._waved && T >= waveAt) {
      this._waved = true;
      this._waveFx();
    }

    this.savePoint.update(dt, s);

    this.position.copy(_centre);
    this.position.y = 2 * k;
  }

  _waveFx() {
    const c = settings.fx_magiccircle;
    const g = settings.global;
    if (c.waveShock > 0) {
      this.ctx.decals.spawn(DecalType.SHOCKWAVE, _centre, {
        radius: c.shockRadius * (c.zoneRadius / ORIGINAL_RADIUS) * g.explosionIntensity,
        life: 0.8,
        width: 0.05,
        intensity: c.waveShock,
        colorA: getColor(c.colorShockA),
        colorB: getColor(c.colorShockB)
      });
    }
    this.ctx.flash.trigger(getColor(c.colorFlash), c.waveFlash * g.explosionIntensity);
    this.ctx.shake.add(c.waveShake * g.explosionIntensity, 2.5, 18);
    this.lightBoost = c.lightIntensity * 0.6;
  }

  onTravel() {
    this.pointAt(this.u, this.position);
    this.position.y = 1;
  }

  onImpact() {
    const c = settings.fx_magiccircle;
    const g = settings.global;
    this._openAt = this.age;
    this.pointAt(1, _centre).setY(0);
    if (c.openShock > 0) {
      this.ctx.decals.spawn(DecalType.SHOCKWAVE, _centre, {
        radius: c.zoneRadius * 1.5 * g.explosionIntensity,
        life: 0.55,
        width: 0.08,
        intensity: c.openShock,
        colorA: getColor(c.colorShockA),
        colorB: getColor(c.colorShockB)
      });
    }
    this.ctx.shake.add(0.06 * g.explosionIntensity, 3, 20);
    this._sync(0);
  }

  onFade(dt) {
    this._sync(dt);
  }

  onDestroy() {
    this._openAt = -1;
    this._waved = false;
    this._energy = 0;
    this.savePoint.object3D.visible = false;
  }

  dispose() {
    this.savePoint.dispose();
    super.dispose();
  }
}
