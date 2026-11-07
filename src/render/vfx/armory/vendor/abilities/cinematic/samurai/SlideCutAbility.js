// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
/*!
 * MIT License — Copyright (c) 2026 mohamedachrefelouafi
 * Ported from achrefelouafi/SamuraiThirdPersonTemplateThreeJS (the T technique:
 * settings.crouchSlash, the pass-through warp in animation/Attack.js,
 * vfx/DustBurst.js, vfx/BloodBurst.js, vfx/BladeImpact.js) into the VFX Armory
 * cinematic pack.
 *
 * SLIDE CUT — "runs it down, drops into a slide and opens it on the way past".
 * A skid front races down the line at `speed`: DustBurst puffs and scuffed
 * floor every `skidEvery` metres, low speed lines streaming with it. At the end
 * of the line the blade opens a low, rising crescent and the front carries on
 * through for `passThrough` metres (the source's pass-through), throwing blood
 * and dirt after it. crouchSlash's hit-stop (0.11 s at 0.05×) and shake (0.28).
 */
import { Vector3 } from 'three';
import { SamuraiAbility } from './lib/SamuraiAbility.js';
import { SlashArcs } from './lib/SlashArcs.js';
import { HitKit } from './lib/HitKit.js';
import { DustBurst } from './lib/DustBurst.js';
import { RateEmitter } from '../../../particles/ParticleEngine.js';
import { DecalType } from '../../../effects/GroundDecals.js';
import { settings } from '../../../config/settings.js';
import { getColor } from './lib/color.js';
import { nest } from './lib/nest.js';
import { saturate } from './lib/math.js';

const _pos = new Vector3();
const _dir = new Vector3();
const _pivot = new Vector3();

export class SlideCutAbility extends SamuraiAbility {
  constructor(context) {
    super('sam_slidecut', context, { katana: true });
  }

  createShaders() {
    this.arcs = new SlashArcs(4);
    for (const mesh of this.arcs.meshes) this.group.add(mesh);
    this.hits = new HitKit(this.group);
    this.dust = new DustBurst(1536);
    this.group.add(this.dust.mesh);
    this.dustCfg = {};
    this.target = new Vector3();
  }

  createParticles() {
    this.createSlashParticles();
    this.lineEmitter = new RateEmitter();
  }

  onSpawn() {
    this.arcs.clear();
    this.hits.clear();
    this.dust.clear();
    this.lineEmitter.reset();
    this._cut = false;
    this._skid = 0;
    this._endTime = -1;
    this._reach = this.length + this.config.passThrough;
    this.pointAt(1, this.target);
  }

  _swing() {
    const c = this.config;
    const flip = c.cutFlip >= 0.5;
    this.target.y = c.cutHeight;
    _pivot.copy(this.target).addScaledVector(this.direction, -c.slashRadius * c.cutScale * 0.75);
    this.arcs.spawn(_pivot, this.direction, c.cutRoll, {
      scale: c.cutScale,
      flip,
      onDraw: () => this._contact(flip)
    });
  }

  _contact(flip) {
    const c = this.config;
    const g = settings.global;
    const at = this.target;
    _dir.copy(this.direction).addScaledVector(this.side, flip ? 0.5 : -0.5).setY(0.7).normalize();
    this.hits.cut(at, _dir);
    this.hits.flash(at, this.direction, 1);
    this.emitEmbers(at, _dir, c.emberBurst, c, { radius: 0.15, speed: 1.6, spread: 0.5 });
    this.dust.burst(at.x, 0, at.z, this.dustCfg, 1.4);
    this.hitStop(c.hitStop, c.hitStopScale);
    this.ctx.shake.add(c.shake * g.cameraShake, 3.2, 24);
    this.ctx.flash.trigger(getColor(c.flashColor), c.flash);
    this.lightBoost = c.lightIntensity * 1.5;
  }

  step(dt) {
    const c = this.config;
    this.holdKatana(c);
    this.syncSlashParticles(c);
    this.hits.sync(this.clock, c);
    this.hits.update(dt);
    nest(c, this.dustCfg, 'dust');
    this.dust.sync(this.clock, this.dustCfg);

    // the skid front, past the end of the line by `passThrough`
    if (this.front < this._reach) {
      const speed = c.speed * settings.global.speed;
      const ease = Math.min(1, this.age / 0.08);
      // slowing as it carries through the mark
      const brake = this.front > this.length ? 0.45 * saturate((this.front - this.length) / Math.max(0.01, c.passThrough)) : 0;
      this.front = Math.min(this._reach, this.front + speed * (0.3 + 0.7 * ease) * (1 - brake) * dt);
      _pos.copy(this.origin).addScaledVector(this.direction, this.front);
      this.position.copy(_pos).setY(0.6);

      while (this.front - this._skid >= c.skidEvery) {
        this._skid += c.skidEvery;
        _pos.copy(this.origin).addScaledVector(this.direction, this._skid);
        this.dust.burst(_pos.x, 0, _pos.z, this.dustCfg, 0.45);
        _pos.y = 0.02;
        this.ctx.decals.spawn(DecalType.DUSTRING, _pos, {
          radius: c.skidRadius,
          life: c.skidLife,
          intensity: 0.8,
          colorA: getColor(c.colorSkid),
          colorB: getColor(c.colorSkid)
        });
      }
      const n = Math.round(this.lineEmitter.tick(dt, c.lineRate));
      if (n > 0) {
        _pos.copy(this.origin).addScaledVector(this.direction, this.front - 1.5);
        _pos.y = 0.45;
        this.emitSpeedLines(_pos, this.direction, n, c, 0.45);
      }
    }
    if (!this._cut && this.front >= this.length - c.slashRadius * c.cutScale * 0.2) {
      this._cut = true;
      this._swing();
    }

    const live = this.arcs.update(dt, this.clock, c);
    this.lightLevel = this._cut ? 0.6 : 0.25;
    if (this._cut && live === 0 && this.front >= this._reach - 1e-3 && this._endTime < 0) this._endTime = this.clock;
    if (this._endTime >= 0) {
      const t = (this.clock - this._endTime) / Math.max(0.05, c.linger);
      this.lightLevel *= 1 - saturate(t);
      if (t >= 1) this.done = true;
    }
  }

  onDestroy() {
    this.arcs.clear();
  }

  dispose() {
    this.arcs.dispose();
    this.hits.dispose();
    this.dust.dispose();
    super.dispose();
  }
}
