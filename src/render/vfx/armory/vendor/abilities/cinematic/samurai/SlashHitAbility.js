// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
/*!
 * MIT License — Copyright (c) 2026 mohamedachrefelouafi
 * Ported from achrefelouafi/SamuraiThirdPersonTemplateThreeJS (the R technique:
 * settings.slashHit, animation/Attack.js, core/App.js#_onStrike, vfx/BloodBurst.js,
 * vfx/BladeImpact.js) into the VFX Armory cinematic pack.
 *
 * SLASH HIT — "steps in and opens it across the waist". The katana comes out on
 * the caster's hand; `hitAt` seconds later a flat crescent draws itself across
 * waist height at the end of the line (the source has no trail ribbon; this one
 * is authored in its black-body palette, here pushed white-hot). On the frame
 * the edge passes the mark: the source's slashHit hit-stop (0.1 s at 0.05×)
 * on this cast's clock, its lens knock (0.24), a BladeImpact flash, and the
 * BloodBurst spray and bleed a body cut in two throws (settings.slice.blood).
 */
import { Vector3 } from 'three';
import { SamuraiAbility } from './lib/SamuraiAbility.js';
import { SlashArcs } from './lib/SlashArcs.js';
import { HitKit } from './lib/HitKit.js';
import { settings } from '../../../config/settings.js';
import { getColor } from './lib/color.js';
import { saturate } from './lib/math.js';

const _pos = new Vector3();
const _dir = new Vector3();
const _pivot = new Vector3();

export class SlashHitAbility extends SamuraiAbility {
  constructor(context) {
    super('sam_slashhit', context, { katana: true });
  }

  createShaders() {
    this.arcs = new SlashArcs(4);
    for (const mesh of this.arcs.meshes) this.group.add(mesh);
    this.hits = new HitKit(this.group);
    this.target = new Vector3();
  }

  createParticles() {
    this.createSlashParticles();
  }

  onSpawn() {
    this.arcs.clear();
    this.hits.clear();
    this._cut = false;
    this._endTime = -1;
    this.pointAt(1, this.target);
    this.position.copy(this.target);
  }

  _swing() {
    const c = this.config;
    const flip = c.cutFlip >= 0.5;
    this.target.y = c.cutHeight;
    _pivot.copy(this.target).addScaledVector(this.direction, -c.cutBack * c.cutScale);
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
    // the blade is travelling across the body: along ±side, a little forward
    _dir.copy(this.side).multiplyScalar(flip ? 1 : -1).addScaledVector(this.direction, 0.45).setY(0.25).normalize();
    this.hits.cut(at, _dir);
    this.hits.flash(at, _dir, 1);
    this.emitEmbers(at, _dir, c.emberBurst, c, { radius: 0.15, speed: 1.6, spread: 0.5 });
    this.emitSpeedLines(_pos.copy(at).addScaledVector(_dir, -2.2), _dir, c.speedCount, c, 0.5);
    this.hitStop(c.hitStop, c.hitStopScale);
    this.ctx.shake.add(c.shake * g.cameraShake, 3.5, 26);
    this.ctx.flash.trigger(getColor(c.flashColor), c.flash);
    this.lightBoost = c.lightIntensity * 1.5;
  }

  step(dt) {
    const c = this.config;
    this.holdKatana(c);
    this.syncSlashParticles(c);
    this.hits.sync(this.clock, c);
    this.hits.update(dt);

    if (!this._cut && this.clock >= c.hitAt) {
      this._cut = true;
      this._swing();
    }
    const live = this.arcs.update(dt, this.clock, c);
    this.lightLevel = this._cut ? 0.6 : 0.2;

    if (this._cut && live === 0 && this._endTime < 0) this._endTime = this.clock;
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
    super.dispose();
  }
}
