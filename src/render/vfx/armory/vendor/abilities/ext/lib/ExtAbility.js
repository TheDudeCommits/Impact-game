// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
/*!
 * ExtAbility — the base the ext pack's LinearAbilityExtThreeJS ports extend.
 *
 * Ported into VFX Armory (ext pack). The source repo
 * (achrefelouafi/LinearAbilityExtThreeJS, MIT, Copyright (c) 2026
 * mohamedachrefelouafi) has a newer Ability base than the Armory's: it adds
 * `isPersistent`, `wantsCamera` and `dismiss()` for casts that stand until
 * something takes them down (the gate, the ring, the fire portal), and its
 * AbilityManager dismisses a standing cast when a second one of the same id is
 * raised. The Armory's shared AbilityManager knows nothing of that, so this
 * class does it locally, without touching the shared core:
 *
 *  - a persistent cast dismisses any other live instance of its own id when it
 *    spawns (the source repo's "one gate at a time" rule);
 *  - it dismisses itself after `config.standTime` seconds of standing (0 keeps
 *    it up until another cast of the same id, or until the manager's
 *    concurrency cap retires it);
 *  - meshes on LAYER.DISTORTION retain the shared refraction pass while the
 *    cast is live, which the Armory's post stack needs (it skips the pass when
 *    nothing is writing to it).
 */
import { Ability, AbilityPhase } from '../../Ability.js';
import { LAYER, retainDistortion, releaseDistortion } from '../../../core/Layers.js';

export { AbilityPhase };

/** id → Set of live instances, for the one-standing-cast-per-id rule. */
const LIVE = new Map();

export class ExtAbility extends Ability {
  constructor(element, context) {
    super(element, context);
    this._distortion = null; // lazily: does this group draw into the refraction pass?
    this._retained = false;
  }

  /** Whether this cast stands until something dismisses it. */
  get isPersistent() {
    return false;
  }

  /** Kept for parity with the source repo; the Armory frames `isActive`. */
  get wantsCamera() {
    return this.isActive;
  }

  /** Ask a persistent cast to end. A no-op for everything else. */
  dismiss() {}

  _hasDistortion() {
    if (this._distortion === null) {
      let found = false;
      this.group.traverse((o) => {
        if (o !== this.group && o.layers.isEnabled(LAYER.DISTORTION)) found = true;
      });
      this._distortion = found;
    }
    return this._distortion;
  }

  spawn(origin, direction, distance) {
    if (this.isPersistent) {
      let set = LIVE.get(this.element);
      if (!set) LIVE.set(this.element, (set = new Set()));
      for (const other of set) if (other !== this && other.isActive) other.dismiss();
      set.add(this);
    }
    super.spawn(origin, direction, distance);
    if (!this._retained && this._hasDistortion()) {
      retainDistortion();
      this._retained = true;
    }
  }

  update(dt) {
    super.update(dt);
    if (this.isPersistent && this.phase === AbilityPhase.IMPACT) {
      const stand = this.config.standTime ?? 0;
      if (stand > 0 && this.impactTime >= stand) this.dismiss();
    }
  }

  destroy() {
    LIVE.get(this.element)?.delete(this);
    if (this._retained) {
      releaseDistortion();
      this._retained = false;
    }
    super.destroy();
  }
}
