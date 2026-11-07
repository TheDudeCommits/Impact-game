// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
/*!
 * The three self-buff auras, as castable abilities.
 *
 * Ported into VFX Armory (ext pack) from achrefelouafi/LinearAbilityExtThreeJS
 * by mohamedachrefelouafi (MIT License, Copyright (c) 2026 mohamedachrefelouafi).
 *
 * In the source repo these are not abilities: B / M / K toggle a buff the
 * character wears (`effects/ElectricBoost.js`, `MagicBoost.js`, `FireBoost.js`),
 * outside the aim-and-cast loop. Here each is a ZONE cast whose circle sits on
 * the caster's feet (`range` is tiny); the cast point is ignored and the buff
 * plays on the character, unchanged, for its full `duration`. The ability ends
 * when the buff's own envelope runs out, so the expiry pop plays too.
 *
 * Casting the same aura again while it is up re-triggers it (the source repo's
 * behaviour); a second, different aura stacks, and the body's fresnel shows
 * whichever is strongest, as in the source.
 */
import { Ability, AbilityPhase } from '../Ability.js';
import { CharacterLink } from './lib/CharacterLink.js';
import { ElectricBoost } from './lib/ElectricBoost.js';
import { MagicBoost } from './lib/MagicBoost.js';
import { FireBoost } from './lib/FireBoost.js';
import { syncFresnelAura } from './lib/FresnelAura.js';

/** id → the instance currently wearing the aura, so a re-cast re-triggers it. */
const WORN = new Map();

class AuraAbility extends Ability {
  constructor(element, Buff, context) {
    super(element, context);
    this.link = new CharacterLink(context.environment);
    this.buff = new Buff({ ...context, character: this.link });
  }

  get instanceCount() {
    return this.buff.instanceCount;
  }

  spawn(origin, direction, distance) {
    // A re-cast of the aura already worn retires the old wearer first; the new
    // one starts the envelope from zero, exactly as pressing B twice does.
    const worn = WORN.get(this.element);
    if (worn && worn !== this && worn.isActive) worn._finish();
    WORN.set(this.element, this);

    this.origin.set(origin.x, 0, origin.z);
    this.direction.copy(direction).setY(0).normalize();
    this.length = Math.max(0.1, distance);
    this.age = 0;
    this.u = 1;
    this.front = 0;
    this.impactTime = 0;
    this.fadeTime = 0;
    this.phase = AbilityPhase.IMPACT;
    this.group.visible = true;

    this.link.sync();
    this.buff.cooldown = 0; // the Armory's slot cooldown is the one that counts
    this.buff.activate();
    this._track();
  }

  _track() {
    const p = this.link.position;
    this.position.set(p.x, p.y + this.link.height * 0.55, p.z);
  }

  update(dt) {
    if (!this.isActive) return;
    this.age += dt;
    this.impactTime += dt;
    this.buff.update(dt);
    this._track();
    if (!this.buff.active) this.phase = AbilityPhase.DONE;
  }

  _finish() {
    if (this.buff.active) this.buff.cancel();
    this.phase = AbilityPhase.DONE;
  }

  destroy() {
    if (this.buff.active) this.buff.cancel();
    // Hand the body's fresnel back: the source repo pushes a zero every frame
    // from the idle buff, and nothing updates an idle buff here.
    if (this.buff._releaseAura) this.buff._releaseAura();
    else syncFresnelAura(0);
    if (WORN.get(this.element) === this) WORN.delete(this.element);
    for (let i = this.borrowed.length - 1; i >= 0; i--) this.borrowed[i]?.release?.();
    this.borrowed.length = 0;
    this.group.visible = false;
    this.phase = AbilityPhase.IDLE;
  }

  dispose() {
    this.buff.dispose();
    super.dispose();
  }
}

export class ElectricAuraAbility extends AuraAbility {
  constructor(context) {
    super('ext_aura_electric', ElectricBoost, context);
  }
}

export class MagicAuraAbility extends AuraAbility {
  constructor(context) {
    super('ext_aura_magic', MagicBoost, context);
  }
}

export class FireAuraAbility extends AuraAbility {
  constructor(context) {
    super('ext_aura_fire', FireBoost, context);
  }
}
