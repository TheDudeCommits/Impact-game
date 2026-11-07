// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
/*!
 * MIT License — Copyright (c) 2026 mohamedachrefelouafi
 * Ported from achrefelouafi/SamuraiThirdPersonTemplateThreeJS (the E technique:
 * settings.kick, core/App.js#_onStrike, vfx/BladeImpact.js, vfx/ShockRing.js,
 * vfx/DustBurst.js) into the VFX Armory cinematic pack.
 *
 * KICK — "steps onto the body and plants a foot in it". The source sells the
 * kick with contact alone (ragdoll shove, hit-stop, lens knock); without a body
 * that contact is drawn: a pale swoosh of the leg, then at the end of the line
 * the impact frame — BladeImpact's star flash and sparks pushed through the
 * target, a small ShockRing racing over the floor, a DustBurst kicked up under
 * it, a ring of radial speed lines, and the kick's own hit-stop (0.07 s at
 * 0.06×) and shake (0.16).
 */
import { Vector3 } from 'three';
import { SamuraiAbility } from './lib/SamuraiAbility.js';
import { SlashArcs } from './lib/SlashArcs.js';
import { BladeImpact } from './lib/BladeImpact.js';
import { ShockRing } from './lib/ShockRing.js';
import { DustBurst } from './lib/DustBurst.js';
import { BurstMode } from '../../../effects/BurstSphere.js';
import { settings } from '../../../config/settings.js';
import { getColor } from './lib/color.js';
import { nest } from './lib/nest.js';
import { saturate } from './lib/math.js';

const _pos = new Vector3();
const _dir = new Vector3();
const _pivot = new Vector3();

export class KickAbility extends SamuraiAbility {
  constructor(context) {
    super('sam_kick', context);
  }

  createShaders() {
    this.arcs = new SlashArcs(2);
    for (const mesh of this.arcs.meshes) this.group.add(mesh);
    this.impact = new BladeImpact(768);
    this.shock = new ShockRing();
    this.dust = new DustBurst(1024);
    this.group.add(this.impact.mesh, this.shock.mesh, this.dust.mesh);
    this.impactCfg = { enabled: true };
    this.shockCfg = {};
    this.dustCfg = {};
    this.target = new Vector3();
  }

  createParticles() {
    this.createSlashParticles();
  }

  onSpawn() {
    this.arcs.clear();
    this.impact.clear();
    this.shock.clear();
    this.dust.clear();
    this._hit = false;
    this._swoosh = false;
    this._hitTime = -1;
    this.pointAt(1, this.target);
    this.target.y = this.config.hitHeight;
    this.position.copy(this.target);
  }

  _contact() {
    const c = this.config;
    const g = settings.global;
    const at = this.target;
    this.impact.burst(at.x, at.y, at.z, this.direction.x, 0.1, this.direction.z, this.impactCfg, 1);
    this.shock.burst(at.x, at.z, this.shockCfg, 1);
    this.dust.burst(at.x, 0, at.z, this.dustCfg, 1);
    this.ctx.bursts.spawn(BurstMode.AIR, at, {
      radius: 0.15,
      endRadius: c.shellSize * g.explosionIntensity,
      life: 0.28,
      intensity: c.shellIntensity,
      opacity: 0.7,
      fresnel: 2,
      displace: 0.2,
      colorA: getColor(c.impact_color),
      colorB: getColor(c.impact_ringColor),
      colorC: getColor(c.impact_ringColor)
    });
    // radial impact lines, thrown out round the contact in the screen-ish plane
    const n = Math.round(c.radialLines);
    for (let i = 0; i < n; i++) {
      const a = (i / Math.max(1, n)) * Math.PI * 2 + Math.random() * 0.2;
      _dir
        .copy(this.side)
        .multiplyScalar(Math.cos(a))
        .addScaledVector(this.direction, 0.35)
        .setY(Math.sin(a))
        .normalize();
      _pos.copy(at).addScaledVector(_dir, 0.25);
      this.emitSpeedLines(_pos, _dir, 1, c, 0.05);
    }
    this.hitStop(c.hitStop, c.hitStopScale);
    this.ctx.shake.add(c.shake * g.cameraShake, 4, 28);
    this.ctx.flash.trigger(getColor(c.flashColor), c.flash);
    this.lightBoost = c.lightIntensity * 1.8;
  }

  step(dt) {
    const c = this.config;
    this.syncSlashParticles(c);
    nest(c, this.impactCfg, 'impact');
    this.impactCfg.enabled = true;
    nest(c, this.shockCfg, 'shock');
    nest(c, this.dustCfg, 'dust');
    this.impact.sync(this.clock, this.impactCfg);
    this.dust.sync(this.clock, this.dustCfg);
    this.shock.update(dt, this.shockCfg);

    // the swoosh leads the contact so its edge arrives on `hitAt`
    if (!this._swoosh && c.swooshShow >= 0.5 && this.clock >= Math.max(0, c.hitAt - c.slashSweep)) {
      this._swoosh = true;
      _pivot.copy(this.target).addScaledVector(this.direction, -c.slashRadius * c.swooshScale * 0.8);
      _pivot.y = Math.max(0.4, this.target.y - 0.25);
      this.arcs.spawn(_pivot, this.direction, c.swooshRoll, { scale: c.swooshScale, flip: true });
    }
    if (!this._hit && this.clock >= c.hitAt) {
      this._hit = true;
      this._hitTime = this.clock;
      this._contact();
    }
    this.arcs.update(dt, this.clock, c);
    this.lightLevel = this._hit ? 0.5 : 0;

    if (this._hitTime >= 0) {
      const t = (this.clock - this._hitTime) / Math.max(0.05, c.linger + c.shock_life);
      this.lightLevel *= 1 - saturate(t);
      if (t >= 1) this.done = true;
    }
  }

  onDestroy() {
    this.arcs.clear();
    this.shock.clear();
  }

  dispose() {
    this.arcs.dispose();
    this.impact.dispose();
    this.shock.dispose();
    this.dust.dispose();
    super.dispose();
  }
}
