// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
/*!
 * MIT License — Copyright (c) 2026 mohamedachrefelouafi
 * Ported from achrefelouafi/SamuraiThirdPersonTemplateThreeJS (src/vfx/WeaponFire.js,
 * VolumetricFireMaterial.js, BladeHeat.js, EmberSystem.js, DistanceField.js,
 * SurfaceSampler.js, EmitterBox.js, BladeImpact.js) into the VFX Armory cinematic pack.
 *
 * BURNING SLASH — the samurai's katana goes up in black-body fire and a combo of
 * crescent cuts is opened down the cast line.
 *
 *  - The katana (source `sword.glb`, source placement) is mounted on the
 *    caster's right hand for the cast. `WeaponFire` burns it exactly as in the
 *    source: the raymarched volume wrapped round a baked distance field of the
 *    blade, the steel's own incandescence (BladeHeat) and sparks thrown off its
 *    actual faces (EmberSystem). Its lamp is mirrored into a pooled light.
 *  - A strike front races down the line at `speed`; as it passes each combo
 *    station a crescent (`lib/SlashArcs.js`, authored in the same black-body
 *    palette) draws itself, alternating tilt like a real combo, each with an
 *    ember spray, speed lines, a BladeImpact flash and a scorch on the floor.
 *  - The last cut is a finisher: bigger, near-vertical, with a shockwave,
 *    screen flash and the source's hit-stop on this cast's own clock.
 */
import { Vector3 } from 'three';
import { SamuraiAbility } from './lib/SamuraiAbility.js';
import { WeaponFire } from './lib/WeaponFire.js';
import { SlashArcs } from './lib/SlashArcs.js';
import { BladeImpact } from './lib/BladeImpact.js';
import { RateEmitter } from '../../../particles/ParticleEngine.js';
import { DecalType } from '../../../effects/GroundDecals.js';
import { settings } from '../../../config/settings.js';
import { getColor } from './lib/color.js';
import { nest } from './lib/nest.js';
import { saturate } from './lib/math.js';

const _pos = new Vector3();
const _dir = new Vector3();
const _up = new Vector3(0, 1, 0);

export class BurningSlashAbility extends SamuraiAbility {
  constructor(context) {
    super('sam_burningslash', context, { katana: true });
  }

  createShaders() {
    this.fire = new WeaponFire();
    this.fireCfg = {
      enabled: true,
      intensity: 1,
      box: { show: false, autoFit: false, x: 0, y: 0, z: 0.617, rotX: 0, rotY: 0, rotZ: 0, scaleX: 1, scaleY: 1, scaleZ: 1, sizeX: 0.08, sizeY: 0.08, sizeZ: 0.9 },
      volume: { enabled: true },
      steel: { enabled: true },
      embers: { enabled: true },
      light: { enabled: true, decay: 1.8 }
    };
    this.fire.cfg = this.fireCfg;
    this.group.add(this.fire.group);

    this.arcs = new SlashArcs(14);
    for (const mesh of this.arcs.meshes) this.group.add(mesh);

    this.impact = new BladeImpact(1024);
    this.group.add(this.impact.mesh);
    this.impactCfg = { enabled: true };

    this._stations = [];
    this._next = 0;
    this._finisherAt = -1;
    this._endTime = 0;
  }

  createParticles() {
    this.createSlashParticles();
    this.trailEmitter = new RateEmitter();
  }

  get impactDuration() {
    return 1;
  }

  onSpawn() {
    const c = this.config;
    this.trailEmitter.reset();
    this.arcs.clear();
    this.impact.clear();
    this.fire.embers.clear();
    this._next = 0;
    this._finisherAt = -1;
    this._endTime = -1;
    this._fireLevel = 0;

    // combo stations along the line, the last is the finisher
    const n = Math.max(1, Math.round(c.comboCount));
    this._stations.length = 0;
    const start = Math.min(c.comboStart, this.length * 0.5);
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 1 : i / (n - 1);
      this._stations.push(start + (this.length - start) * t);
    }
    this.katana.ready.then(() => {
      if (this.isActive) this.fire.model = this.katana.model;
    });
    if (this.katana.model) this.fire.model = this.katana.model;
  }

  _syncLook(c) {
    nest(c, this.fireCfg, 'fire');
    this.fireCfg.intensity = c.fire_intensity * this._fireLevel;
    nest(c, this.impactCfg, 'impact');
    this.impactCfg.enabled = true;
    this.syncSlashParticles(c);
  }

  _cut(index) {
    const c = this.config;
    const n = this._stations.length;
    const last = index === n - 1 && n > 1;
    const along = this._stations[index];
    const sway = (index % 2 === 0 ? -1 : 1) * c.comboSide;
    _pos
      .copy(this.origin)
      .addScaledVector(this.direction, along)
      .addScaledVector(this.side, sway);
    _pos.y = c.comboHeight;
    const t = n > 1 ? index / Math.max(1, n - 2) : 0;
    const scale = last ? c.finisherScale : c.comboScaleStart + (c.comboScaleEnd - c.comboScaleStart) * saturate(t);
    const roll = last
      ? c.finisherRoll
      : (index % 2 === 0 ? 1 : -1) * c.comboTilt + (Math.random() - 0.5) * 2 * c.comboJitter;
    // the arc pivots a little behind the station so its edge passes through it
    const pivot = _pos.clone().addScaledVector(this.direction, -c.slashRadius * scale * 0.55);
    if (last) pivot.y = c.comboHeight + c.slashRadius * scale * 0.15;
    this.arcs.spawn(pivot, this.direction, roll, {
      scale,
      flip: index % 2 === 1,
      delay: last ? c.finisherDelay : 0,
      onDraw: () => this._onCut(_pos.copy(pivot).addScaledVector(this.direction, c.slashRadius * scale * 0.9), last)
    });
  }

  _onCut(at, finisher) {
    const c = this.config;
    const g = settings.global;
    at.y = Math.max(0.3, at.y);
    this.impact.burst(at.x, at.y, at.z, this.direction.x, 0.15, this.direction.z, this.impactCfg, finisher ? 1.6 : 0.8);
    this.emitEmbers(at, _dir.copy(this.direction).setY(0.6).normalize(), finisher ? c.finisherEmbers : c.emberBurst, c, {
      radius: 0.5 * (finisher ? 2 : 1),
      speed: finisher ? 1.8 : 1
    });
    this.emitSpeedLines(
      _dir.copy(at).addScaledVector(this.direction, -2.5),
      this.direction,
      c.speedCount * (finisher ? 2 : 1),
      c,
      finisher ? 1.4 : 0.8
    );
    _dir.copy(at).setY(0.02);
    this.ctx.decals.spawn(DecalType.SCORCH, _dir, {
      radius: c.scorchRadius * (finisher ? 2 : 1),
      life: c.scorchLife,
      intensity: c.scorchIntensity,
      colorA: getColor(c.colorScorch),
      colorB: getColor(c.colorEmber),
      height: 0.015
    });
    this.position.copy(at);
    if (finisher) {
      this.ctx.decals.spawn(DecalType.SHOCKWAVE, _dir, {
        radius: c.shockRadius * g.explosionIntensity,
        life: 0.55,
        width: 0.06,
        intensity: 1.2,
        colorA: getColor(c.colorShockA),
        colorB: getColor(c.colorShockB)
      });
      this.ctx.shake.add(c.shake * 2.2 * g.cameraShake * g.explosionIntensity, 3.2, 24);
      this.ctx.flash.trigger(getColor(c.flashColor), c.flash * g.explosionIntensity);
      this.hitStop(c.hitStop, c.hitStopScale);
      this.lightBoost = c.lightIntensity * 1.6;
    } else {
      this.ctx.shake.add(c.shake * g.cameraShake, 4, 26);
      this.ctx.flash.trigger(getColor(c.flashColor), c.flash * 0.25);
      this.lightBoost = c.lightIntensity * 0.6;
    }
  }

  step(dt) {
    const c = this.config;
    this.holdKatana(c);

    // the fire: ignite at once, douse once the combo has played out
    const dousing = this._endTime >= 0;
    if (!dousing) this._fireLevel = Math.min(1, this._fireLevel + dt / Math.max(0.01, c.fireRampIn));
    else this._fireLevel = Math.max(0, this._fireLevel - dt / Math.max(0.01, c.fireRampOut));
    this._syncLook(c);
    this.fire.update(dt);

    // strike front
    if (this.front < this.length) this.advance(dt);
    while (this._next < this._stations.length && this.front >= this._stations[this._next] - 1e-4) {
      this._cut(this._next++);
    }
    if (this.front < this.length) {
      const n = Math.round(this.trailEmitter.tick(dt, c.emberTrail));
      if (n > 0) {
        this.pointAt(this.u, _pos).setY(c.comboHeight * 0.7);
        this.emitEmbers(_pos, _up, n, c, { radius: 0.4, speed: 0.6, spread: 1 });
      }
    }

    const live = this.arcs.update(dt, this.clock, c);
    this.impact.sync(this.clock, this.impactCfg);

    // light: the hot steel early, the cut that just landed after
    this.lightLevel = 0.4 + 0.6 * this._fireLevel;
    if (this.fire.light.intensity > 0 && live === 0 && this._next === 0) {
      this.position.copy(this.fire.light.position);
    } else if (this._next === 0) {
      this.pointAt(this.u, this.position).setY(c.comboHeight);
    }

    if (this._next >= this._stations.length && live === 0 && this._endTime < 0) this._endTime = this.clock;
    if (this._endTime >= 0) {
      const t = (this.clock - this._endTime) / Math.max(0.05, c.linger + c.fireRampOut);
      this.lightLevel *= 1 - saturate(t);
      if (t >= 1) this.done = true;
    }
  }

  onDestroy() {
    this.arcs.clear();
    this._fireLevel = 0;
    this.fireCfg.intensity = 0;
    // put the steel back and drop the hull before the katana leaves the hand
    this.fire.update(0);
    this.fire.hull.visible = false;
    this.fire.embers.mesh.visible = false;
  }

  dispose() {
    this.fire.dispose();
    this.arcs.dispose();
    this.impact.dispose();
    super.dispose();
  }
}
