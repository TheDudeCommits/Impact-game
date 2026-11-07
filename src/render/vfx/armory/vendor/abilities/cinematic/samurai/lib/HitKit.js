// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
/*!
 * MIT License — Copyright (c) 2026 mohamedachrefelouafi
 * Port of the contact beat in achrefelouafi/SamuraiThirdPersonTemplateThreeJS
 * (core/App.js#_onStrike, combat/Enemy.js bleeding, vfx/BloodBurst.js,
 * vfx/BladeImpact.js) for the VFX Armory cinematic pack.
 *
 * What a cut body throws off, without a body: the BloodBurst spray along the
 * blade's path, the slower bleed that follows it (`drip` over `bleedTime`),
 * and the BladeImpact flash at the point of contact. One per ability
 * instance, driven on that ability's own (hit-stopped) clock.
 */
import { Vector3 } from 'three';
import { BloodBurst } from './BloodBurst.js';
import { BladeImpact } from './BladeImpact.js';
import { nest } from './nest.js';

const _down = new Vector3(0, -1, 0);
const _jit = new Vector3();

export class HitKit {
  constructor(group) {
    this.bloodCfg = {};
    this.impactCfg = { enabled: true };
    this.blood = new BloodBurst(3072, this.bloodCfg);
    this.impact = new BladeImpact(768);
    group.add(this.blood.mesh, this.impact.mesh);
    this._bleed = 0;
    this._bleedLeft = 0;
    this._carry = 0;
    this._at = new Vector3();
  }

  sync(time, c) {
    if (c.blood_burst !== undefined) {
      nest(c, this.bloodCfg, 'blood');
      this.blood.sync(time);
    }
    if (c.impact_size !== undefined) {
      nest(c, this.impactCfg, 'impact');
      this.impactCfg.enabled = true;
      this.impact.sync(time, this.impactCfg);
    }
  }

  /** The cut: spray along `dir`, then bleed. */
  cut(at, dir, strength = 1) {
    const b = this.bloodCfg;
    if (!b.enabled) return;
    this.blood.emit(at, dir, b.burst * strength, b.speed);
    this._at.copy(at);
    this._bleed = Math.max(0.01, b.bleedTime);
    this._bleedLeft = b.drip * strength;
    this._carry = 0;
  }

  flash(at, dir, strength = 1) {
    this.impact.burst(at.x, at.y, at.z, dir.x, dir.y, dir.z, this.impactCfg, strength);
  }

  update(dt) {
    if (this._bleedLeft <= 0 || dt <= 0) return;
    const rate = this.bloodCfg.drip / this._bleed;
    this._carry += rate * dt;
    const n = Math.min(Math.floor(this._carry), Math.ceil(this._bleedLeft));
    if (n <= 0) return;
    this._carry -= n;
    this._bleedLeft -= n;
    _jit.set((Math.random() - 0.5) * 0.3, 0, (Math.random() - 0.5) * 0.3).add(this._at);
    this.blood.emit(_jit, _down, n, this.bloodCfg.dripSpeed);
  }

  clear() {
    this.blood.clear();
    this.impact.clear();
    this._bleedLeft = 0;
  }

  dispose() {
    this.blood.dispose();
    this.impact.dispose();
  }
}
