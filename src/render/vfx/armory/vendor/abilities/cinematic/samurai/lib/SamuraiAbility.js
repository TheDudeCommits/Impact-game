// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
/*!
 * MIT License — Copyright (c) 2026 mohamedachrefelouafi
 * Shared base for the abilities ported from achrefelouafi/SamuraiThirdPersonTemplateThreeJS
 * into the VFX Armory cinematic pack.
 *
 * The source drives its moves from a melee state machine (Attack.js) rather than
 * a travel → impact → fade line, so these abilities run their own timeline:
 *
 *  - `update()` is taken over. `this.clock` is the effect's own time; it runs at
 *    `hitStopScale` for `hitStop` seconds after a blow lands — the source's
 *    hit-stop (App#_onStrike), applied to this cast's own VFX since the sandbox
 *    clock is not ours to freeze.
 *  - subclasses implement `step(dt, raw)` and set `this.done = true` when their
 *    timeline has played out; the base then marks the cast DONE.
 *  - the light: `this.position`/`this.lightLevel` drive the pooled light the
 *    usual way, or a subclass sets `this.lightOverride` to mirror a source
 *    effect's own lamp (Judgement, BladeStorm, WeaponFire) into it.
 *
 * Also carries the bits every slash shares: ember + speed-line particle systems
 * on the shared engine, and the optional katana on the caster's right hand.
 */
import { Color, Vector3 } from 'three';
import { Ability, AbilityPhase } from '../../../Ability.js';
import { ParticleShape } from '../../../../particles/ParticleSystem.js';
import { settings } from '../../../../config/settings.js';
import { frame } from '../../../../core/FrameUniforms.js';
import { getColor } from './color.js';
import { KatanaRig } from './assets.js';

const _emit = {};
const _dir = new Vector3();
const _color = new Color();

export class SamuraiAbility extends Ability {
  constructor(id, context, { katana = false } = {}) {
    super(id, context);
    this.clock = 0;
    this.done = false;
    this.lightLevel = 0;
    this.lightOverride = null;
    this._hitStop = 0;
    this._hitStopScale = 1;
    this.katana = katana ? new KatanaRig() : null;
  }

  /** Shared ember + speed-line systems. Call from createParticles(). */
  createSlashParticles() {
    const p = this.ctx.particles;
    this.embers = p.get(`${this.element}.embers`, {
      capacity: 5000,
      shape: ParticleShape.STREAK,
      additive: true,
      stretch: true,
      curl: true,
      softFade: 0.2
    });
    this.embers.uniforms.uSizeIn.value = 0.02;
    this.embers.uniforms.uFadeIn.value = 0.02;
    this.embers.uniforms.uFadeOut.value = 0.5;
    this.embers.uniforms.uEndSize.value = 0.2;

    this.lines = p.get(`${this.element}.speedlines`, {
      capacity: 1200,
      shape: ParticleShape.STREAK,
      additive: true,
      stretch: true,
      softFade: 0.1
    });
    this.lines.uniforms.uGravity.value.set(0, 0, 0);
    this.lines.uniforms.uSizeIn.value = 0.01;
    this.lines.uniforms.uFadeIn.value = 0.05;
    this.lines.uniforms.uFadeOut.value = 0.6;
    this.lines.uniforms.uEndSize.value = 0.6;
    this.lines.uniforms.uTurbulence.value = 0;
  }

  /** Push the ember- and speed-prefixed keys of a config block into the shared systems. */
  syncSlashParticles(c) {
    const g = settings.global;
    if (this.embers && c.emberColorA) {
      const u = this.embers.uniforms;
      this.embers.setGradient(
        getColor(c.emberColorA),
        getColor(c.emberColorB),
        getColor(c.emberColorC),
        getColor(c.emberColorD)
      );
      u.uGravity.value.set(0, c.emberGravity, 0);
      u.uDrag.value = c.emberDrag;
      u.uSizeScale.value = c.emberSize * g.particleSize * 7;
      u.uLifeScale.value = g.particleLifetime;
      u.uSpeedScale.value = g.particleSpeed;
      u.uOpacity.value = g.opacity;
      u.uGlow.value = c.emberGlow * g.glow;
      u.uStretch.value = c.emberStretch;
      u.uTurbulence.value = c.emberTurbulence * g.turbulence;
    }
    if (this.lines) {
      const u = this.lines.uniforms;
      _color.set(c.speedColor);
      this.lines.setGradient(getColor('#ffffff'), _color, _color, getColor('#000000'));
      u.uSizeScale.value = c.speedWidth * 7;
      u.uLifeScale.value = 1;
      u.uSpeedScale.value = 1;
      u.uDrag.value = c.speedDrag;
      u.uOpacity.value = g.opacity;
      u.uGlow.value = c.speedGlow * g.glow;
      u.uStretch.value = c.speedStretch;
    }
  }

  emitEmbers(position, direction, count, c, { radius = 0.25, speed = 1, spread = 0.8 } = {}) {
    if (!this.embers) return;
    const n = Math.round(count * settings.global.particleCount);
    if (n <= 0) return;
    _emit.position = position;
    _emit.radius = radius;
    _emit.direction = _dir.copy(direction);
    _emit.speed = c.emberSpeed * speed;
    _emit.speedVariance = 0.8;
    _emit.spread = spread;
    _emit.inherit = null;
    _emit.anchor = null;
    _emit.size = 0.1;
    _emit.sizeVariance = 0.7;
    _emit.life = c.emberLife;
    _emit.lifeVariance = 0.55;
    _emit.spin = 0;
    _emit.tint = null;
    _emit.time = frame.uTime.value;
    this.embers.emit(n, _emit);
  }

  /** Anime speed lines: long thin streaks racing along `direction`. */
  emitSpeedLines(position, direction, count, c, radius = 0.8) {
    if (!this.lines) return;
    const n = Math.round(count);
    if (n <= 0) return;
    _emit.position = position;
    _emit.radius = radius;
    _emit.direction = _dir.copy(direction);
    _emit.speed = c.speedSpeed;
    _emit.speedVariance = 0.35;
    _emit.spread = 0.04;
    _emit.inherit = null;
    _emit.anchor = null;
    _emit.size = 0.05;
    _emit.sizeVariance = 0.5;
    _emit.life = c.speedLife;
    _emit.lifeVariance = 0.4;
    _emit.spin = 0;
    _emit.tint = null;
    _emit.time = frame.uTime.value;
    this.lines.emit(n, _emit);
  }

  /** The source's hit-stop: this cast's own clock drops to `scale` for `seconds`. */
  hitStop(seconds, scale) {
    this._hitStop = Math.max(this._hitStop, seconds);
    this._hitStopScale = scale;
  }

  /* ---- katana ---- */

  /** Mount the katana if the config asks for it. Retries each frame until the rig is up. */
  holdKatana(c) {
    if (!this.katana) return;
    if (!c.katanaShow) {
      if (this.katana.attached) this.katana.detach();
      return;
    }
    if (!this.katana.attached) this.katana.attach(this.ctx.scene, this._placement(c));
    else this.katana.place(this._placement(c));
  }

  _placement(c) {
    this._place ??= {};
    const p = this._place;
    p.x = c.katanaX;
    p.y = c.katanaY;
    p.z = c.katanaZ;
    p.rotX = c.katanaRotX;
    p.rotY = c.katanaRotY;
    p.rotZ = c.katanaRotZ;
    p.scale = c.katanaScale;
    return p;
  }

  /* ---- lifecycle ---- */

  spawn(origin, direction, distance) {
    this.clock = 0;
    this.done = false;
    this.lightLevel = 0;
    this.lightOverride = null;
    this._hitStop = 0;
    this._hitStopScale = 1;
    super.spawn(origin, direction, distance);
  }

  update(dt) {
    if (!this.isActive) return;
    this.age += dt;
    let scaled = dt;
    if (this._hitStop > 0) {
      this._hitStop = Math.max(0, this._hitStop - dt);
      scaled *= this._hitStopScale;
    }
    this.clock += scaled;
    this.step(scaled, dt);
    if (this.lightOverride) {
      const o = this.lightOverride;
      this.ctx.lights.set(this.light, o.position, o.color, o.intensity, o.distance, dt);
    } else {
      this._updateLight(dt, this.lightLevel);
    }
    if (this.done) this.phase = AbilityPhase.DONE;
  }

  /** Subclass timeline. `dt` is hit-stop scaled, `raw` is not. */
  step(_dt, _raw) {}

  destroy() {
    this.katana?.detach();
    super.destroy();
  }
}
