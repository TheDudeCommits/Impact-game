// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
/*!
 * ICS magma effect (160907_magma_effect) (MIT)
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
 * MagmaOrbAbility — the ICS "Magma Flare" orb as a charge-and-throw skillshot.
 *
 * Source: ICS INC. `ics-magma-orb` (MIT, Copyright (c) 2017 - 2026 ICS INC.),
 * src/magmaFlare/*. The orb's look is re-implemented in GLSL in
 * `lib/magmaorb/MagmaOrbMesh.js` (the original is WebGPU / TSL). This class adds
 * the sandbox beats: a charge in front of the caster (orb swells, sparks and
 * motes pull in), a launch down the aimed line, and a burst at the target built
 * from the shared systems (bursts, decals, particles, shake, flash, light).
 */
import { Vector3 } from 'three';
import { Ability, AbilityPhase } from '../Ability.js';
import { MagmaOrbMesh } from './lib/magmaorb/MagmaOrbMesh.js';
import { ParticleShape } from '../../particles/ParticleSystem.js';
import { RateEmitter } from '../../particles/ParticleEngine.js';
import { DecalType } from '../../effects/GroundDecals.js';
import { BurstMode } from '../../effects/BurstSphere.js';
import { frame } from '../../core/FrameUniforms.js';
import { settings } from '../../config/settings.js';
import { getColor } from '../../utils/color.js';
import { saturate, lerp, Easing } from '../../utils/math.js';

const ORB_UNITS = 2; // original orb radius

const _emit = {};
const _pos = new Vector3();
const _dir = new Vector3();
const _a = new Vector3();
const _b = new Vector3();
const _p = {
  fade: 1,
  flare: 1,
  flareFade: 1,
  flareScale: 1,
  flareSpin: 0,
  spark: 1,
  sparkFade: 1,
  sparkRate: 1,
  sparkReach: 1,
  aura: 1,
  inGlow: 1,
  outGlow: 1,
  outGlowScale: 1,
  magmaGain: 1,
  flowSpeed: 1,
  tint: null,
  glowColor: null
};

export class MagmaOrbAbility extends Ability {
  constructor(context) {
    super('fx_magmaorb', context);
  }

  createShaders() {
    this.orb = new MagmaOrbMesh();
    this.group.add(this.orb.object3D);
    this.orbPos = new Vector3();
    this._fired = false;
    this._popAt = -1;
  }

  createParticles() {
    const particles = this.ctx.particles;
    this.motes = particles.get('fx_magmaorb.motes', {
      capacity: 2400,
      shape: ParticleShape.SOFT,
      additive: true,
      curl: false,
      softFade: 0.2
    });
    this.motes.uniforms.uDrag.value = 0.0;
    this.motes.uniforms.uEndSize.value = 0.2;
    this.motes.uniforms.uFadeIn.value = 0.25;
    this.motes.uniforms.uFadeOut.value = 0.3;

    this.sparks = particles.get('fx_magmaorb.sparks', {
      capacity: 2400,
      shape: ParticleShape.STREAK,
      additive: true,
      softFade: 0.2
    });
    this.sparks.uniforms.uDrag.value = 1.6;
    this.sparks.uniforms.uEndSize.value = 0.3;
    this.sparks.uniforms.uStretch.value = 0.5;

    this.embers = particles.get('fx_magmaorb.embers', {
      capacity: 1600,
      shape: ParticleShape.SOFT,
      additive: true,
      curl: true,
      softFade: 0.3
    });
    this.embers.uniforms.uDrag.value = 1.2;
    this.embers.uniforms.uEndSize.value = 0.3;
    this.embers.uniforms.uFadeOut.value = 0.6;

    this.intakeEmitter = new RateEmitter();
    this.trailEmitter = new RateEmitter();
  }

  get impactDuration() {
    return Math.max(0.05, settings.fx_magmaorb.lifetime * settings.global.lifetime);
  }

  get fadeDuration() {
    return Math.max(0.05, settings.fx_magmaorb.fadeTime);
  }

  get chargeT() {
    return saturate(this.age / Math.max(0.01, settings.fx_magmaorb.charge));
  }

  lightShimmer() {
    return 0.85 + 0.15 * Math.sin(this.age * 17.0) * Math.sin(this.age * 5.3);
  }

  /** Hold the front at the hand until the orb is charged. */
  advance(dt) {
    const c = this.config;
    const charge = Math.max(0, c.charge);
    if (this.age < charge) return false;
    const speed = c.speed * settings.global.speed;
    const since = this.age - charge;
    this.front += speed * Easing.outQuad(saturate(since / 0.06)) * dt;
    const previousU = this.u;
    this.u = saturate(this.front / this.length);
    this.pointAt(this.u, this.position);
    return this.u >= 1 && previousU < 1;
  }

  _handPoint(out) {
    const c = settings.fx_magmaorb;
    out.copy(this.origin).addScaledVector(this.direction, c.handForward).addScaledVector(this.side, c.handSide);
    out.y = c.handHeight;
    return out;
  }

  _endPoint(out) {
    this.pointAt(1, out);
    out.y = settings.fx_magmaorb.endHeight;
    return out;
  }

  /** Point on the flight path, s 0..1. */
  _flightPoint(s, out) {
    const c = settings.fx_magmaorb;
    this._handPoint(_a);
    this._endPoint(_b);
    out.lerpVectors(_a, _b, s);
    out.y += c.arc * 4 * s * (1 - s);
    return out;
  }

  onSpawn() {
    this.intakeEmitter.reset();
    this.trailEmitter.reset();
    this._fired = false;
    this._popAt = -1;
    this.orb.object3D.visible = true;
    this._handPoint(this.orbPos);
    this._sync(0);
  }

  /* ------------------------------------------------------------------ */

  _sync(dt) {
    const c = settings.fx_magmaorb;
    const g = settings.global;

    let scale = 1;
    let fade = 1;
    let flareFade = 1;
    let sparkFade = 1;
    let flareScale = c.flareScale;

    if (this.phase === AbilityPhase.TRAVEL && this.age < c.charge) {
      const k = this.chargeT;
      scale = lerp(c.chargeStart, 1, Easing.outBack(k));
      flareFade = 0.4 + 0.6 * k;
      sparkFade = 0.6 + 0.8 * k;
      flareScale *= lerp(1.6, 1, k);
    } else if (this.phase === AbilityPhase.TRAVEL) {
      flareFade = c.flightFlare;
      sparkFade = c.flightFlare;
    } else {
      // popping
      const k = this._popAt < 0 ? 1 : saturate((this.age - this._popAt) / Math.max(0.02, c.popTime));
      scale = lerp(1, c.popScale, Easing.outCubic(k));
      fade = 1 - Easing.inQuad(k);
      flareFade = fade;
      sparkFade = fade;
      flareScale *= lerp(1, 1.5, k);
    }

    const s = (c.orbSize / ORB_UNITS) * scale;
    this.orb.object3D.position.copy(this.orbPos);
    this.orb.object3D.scale.setScalar(Math.max(1e-4, s));
    this.orb.object3D.visible = fade > 0.005;

    _p.fade = fade * g.opacity;
    _p.flare = c.flare;
    _p.flareFade = flareFade * g.opacity;
    _p.flareScale = flareScale;
    _p.flareSpin = c.flareSpin;
    _p.spark = c.spark;
    _p.sparkFade = sparkFade * g.opacity;
    _p.sparkRate = c.sparkRate;
    _p.sparkReach = c.sparkReach;
    _p.aura = c.aura;
    _p.inGlow = c.inGlow;
    _p.outGlow = c.outGlow * g.glow;
    _p.outGlowScale = c.outGlowScale;
    _p.magmaGain = c.magmaGain;
    _p.flowSpeed = c.flowSpeed * g.noiseSpeed;
    _p.tint = getColor(c.colorTint);
    _p.glowColor = getColor(c.colorGlow);
    this.orb.update(frame.uTime.value, _p);

    this.position.copy(this.orbPos);

    const motes = this.motes;
    motes.setGradient(getColor(c.colorMoteA), getColor(c.colorMoteB), getColor(c.colorMoteC), getColor(c.colorMoteD));
    motes.uniforms.uGravity.value.set(0, 0, 0);
    motes.uniforms.uSizeScale.value = g.particleSize;
    motes.uniforms.uLifeScale.value = g.particleLifetime;
    motes.uniforms.uSpeedScale.value = g.particleSpeed;
    motes.uniforms.uOpacity.value = g.opacity;
    motes.uniforms.uGlow.value = 1.6 * g.glow;
    motes.uniforms.uTurbulence.value = 0;

    this.sparks.setGradient(getColor(c.colorBurstA), getColor(c.colorBurstB), getColor(c.colorBurstC), getColor(c.colorMoteD));
    this.sparks.uniforms.uGravity.value.set(0, -6, 0);
    this.sparks.uniforms.uSizeScale.value = g.particleSize;
    this.sparks.uniforms.uLifeScale.value = g.particleLifetime;
    this.sparks.uniforms.uSpeedScale.value = g.particleSpeed;
    this.sparks.uniforms.uOpacity.value = g.opacity;
    this.sparks.uniforms.uGlow.value = 1.8 * g.glow;

    this.embers.setGradient(getColor(c.colorMoteB), getColor(c.colorMoteC), getColor(c.colorMoteD), getColor(c.colorMoteC));
    this.embers.uniforms.uGravity.value.set(0, 0.9, 0);
    this.embers.uniforms.uSizeScale.value = g.particleSize;
    this.embers.uniforms.uLifeScale.value = g.particleLifetime;
    this.embers.uniforms.uSpeedScale.value = g.particleSpeed;
    this.embers.uniforms.uOpacity.value = g.opacity;
    this.embers.uniforms.uGlow.value = 1.4 * g.glow;
    this.embers.uniforms.uTurbulence.value = 0.8 * g.turbulence;
    void dt;
  }

  /** Motes pulled in from a shell around the orb. */
  _intakeFx(dt) {
    const c = settings.fx_magmaorb;
    const g = settings.global;
    const k = this.chargeT;
    let count = Math.round(this.intakeEmitter.tick(dt, c.intakeRate * (0.4 + k)) * g.particleCount);
    const time = frame.uTime.value;
    const shell = c.intakeRadius * lerp(1, 0.55, k);
    while (count > 0) {
      const n = Math.min(count, 3);
      count -= n;
      // random point on a sphere shell, flying at the centre
      _dir.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize();
      _pos.copy(this.orbPos).addScaledVector(_dir, shell);
      const life = 0.35 + Math.random() * 0.15;
      _emit.position = _pos;
      _emit.radius = 0.08;
      _emit.direction = _dir.negate();
      _emit.speed = (shell - c.orbSize * 0.6) / life;
      _emit.speedVariance = 0.1;
      _emit.spread = 0.05;
      _emit.inherit = null;
      _emit.anchor = null;
      _emit.size = c.intakeSize;
      _emit.sizeVariance = 0.5;
      _emit.life = life;
      _emit.lifeVariance = 0.1;
      _emit.spin = 0;
      _emit.tint = null;
      _emit.time = time;
      this.motes.emit(n, _emit);
    }
  }

  _trailFx(dt) {
    const c = settings.fx_magmaorb;
    const g = settings.global;
    const count = Math.round(this.trailEmitter.tick(dt, c.trailRate) * g.particleCount);
    if (count <= 0) return;
    _emit.position = this.orbPos;
    _emit.radius = c.orbSize * 0.8;
    _emit.direction = _dir.copy(this.direction).negate();
    _emit.speed = 1.2;
    _emit.speedVariance = 0.6;
    _emit.spread = 0.8;
    _emit.inherit = null;
    _emit.anchor = null;
    _emit.size = c.trailSize;
    _emit.sizeVariance = 0.5;
    _emit.life = c.trailLife;
    _emit.lifeVariance = 0.4;
    _emit.spin = 0;
    _emit.tint = null;
    _emit.time = frame.uTime.value;
    this.embers.emit(count, _emit);
  }

  onTravel(dt) {
    const c = settings.fx_magmaorb;
    const g = settings.global;
    if (this.age < c.charge) {
      this._handPoint(this.orbPos);
      this._sync(dt);
      this._intakeFx(dt);
      this.ctx.shake.rumble(c.chargeShake * this.chargeT * g.cameraShake, dt);
      return;
    }
    if (!this._fired) {
      this._fired = true;
      this._releaseFx();
    }
    this._flightPoint(this.u, this.orbPos);
    this._sync(dt);
    this._trailFx(dt);
  }

  _releaseFx() {
    const c = settings.fx_magmaorb;
    const g = settings.global;
    this.ctx.bursts.spawn(BurstMode.STORM, this.orbPos, {
      radius: c.orbSize,
      endRadius: c.orbSize * 3.2 * g.explosionIntensity,
      life: 0.28,
      intensity: c.burstIntensity * 0.7,
      opacity: 0.8,
      fresnel: 1.6,
      displace: 0.4,
      colorA: getColor(c.colorBurstA),
      colorB: getColor(c.colorBurstB),
      colorC: getColor(c.colorBurstC)
    });
    this.ctx.shake.add(0.12 * g.cameraShake, 4, 22);
    this.lightBoost = c.lightIntensity * 0.4;
  }

  onImpact() {
    const c = settings.fx_magmaorb;
    const g = settings.global;
    const time = frame.uTime.value;
    this._popAt = this.age;
    this._endPoint(this.orbPos);
    _pos.copy(this.orbPos);

    this.ctx.bursts.spawn(BurstMode.STORM, _pos, {
      radius: c.burstSize * 0.15,
      endRadius: c.burstSize * g.explosionIntensity,
      life: 0.6,
      intensity: c.burstIntensity,
      opacity: 0.7,
      fresnel: 1.7,
      displace: 0.6,
      squash: 0.85,
      colorA: getColor(c.colorBurstA),
      colorB: getColor(c.colorBurstB),
      colorC: getColor(c.colorBurstC)
    });
    this.ctx.bursts.spawn(BurstMode.FIRE, _pos, {
      radius: c.burstSize * 0.1,
      endRadius: c.burstSize * 0.5 * g.explosionIntensity,
      life: 0.45,
      intensity: c.burstIntensity * 0.6,
      opacity: 0.5,
      fresnel: 1.2,
      displace: 0.5,
      colorA: getColor(c.colorBurstA),
      colorB: getColor(c.colorMoteD),
      colorC: getColor(c.colorBurstC)
    });

    _a.copy(_pos).setY(0);
    this.ctx.decals.spawn(DecalType.SHOCKWAVE, _a, {
      radius: c.shockRadius * g.explosionIntensity,
      life: 0.6,
      width: 0.07,
      intensity: 1.2,
      colorA: getColor(c.colorShockA),
      colorB: getColor(c.colorShockB)
    });
    if (c.scorchRadius > 0) {
      this.ctx.decals.spawn(DecalType.SCORCH, _a, {
        radius: c.scorchRadius,
        life: 3.2,
        intensity: 1,
        colorA: getColor(c.colorScorchA),
        colorB: getColor(c.colorScorchB)
      });
    }

    _emit.position = _pos;
    _emit.radius = c.orbSize;
    _emit.direction = _dir.set(0, 1, 0);
    _emit.speed = c.sparkSpeed;
    _emit.speedVariance = 0.6;
    _emit.spread = 1.0;
    _emit.inherit = null;
    _emit.anchor = null;
    _emit.size = 0.14;
    _emit.sizeVariance = 0.5;
    _emit.life = 0.7;
    _emit.lifeVariance = 0.5;
    _emit.spin = 0;
    _emit.tint = null;
    _emit.time = time;
    this.sparks.emit(Math.round(c.sparkBurst * g.particleCount), _emit);

    _emit.speed = c.sparkSpeed * 0.25;
    _emit.size = 0.22;
    _emit.life = 1.6;
    _emit.radius = c.orbSize * 2;
    this.embers.emit(Math.round(c.emberCount * g.particleCount), _emit);

    this.ctx.shake.add(c.impactShake * g.explosionIntensity, 1 / Math.max(0.05, c.shakeDuration), 22);
    this.ctx.flash.trigger(getColor(c.colorFlash), c.impactFlash * g.explosionIntensity);
    this.lightBoost = c.lightIntensity * 1.2 * g.explosionIntensity;
    this._sync(0);
  }

  onFade(dt) {
    this._sync(dt);
  }

  onDestroy() {
    this._fired = false;
    this._popAt = -1;
    this.orb.object3D.visible = false;
  }

  dispose() {
    this.orb.dispose();
    super.dispose();
  }
}
