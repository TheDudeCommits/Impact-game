// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
/*!
 * Ability-ThreeJS-Project (p27 pack) (MIT)
 *
 * MIT License
 *
 * Copyright (c) 2026 itzmitto
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
 * P27Ability — runs an ability from itzmitto/Ability-ThreeJS-Project inside the
 * Armory's pooled Ability lifecycle.
 *
 * Source: https://github.com/itzmitto/Ability-ThreeJS-Project (MIT, (c) 2026 itzmitto).
 * The ported modules live, unmodified except where noted, under `./src/` and
 * keep the upstream licence in `./LICENSE-ability-project-27.txt`.
 *
 * The upstream project has its own little framework: an `Ability` is a
 * stateless-ish caster whose `cast(context)` builds a `ManagedEffect` and hands
 * it to an `EffectManager`, which ticks it with `update(dt, elapsed)` until it
 * returns false and then calls `dispose()`. Every effect owns its own GPU ring
 * buffers, instanced meshes and shaders, and the look depends on them, so the
 * port keeps that code as-is and adapts the *seams* instead:
 *
 *  - **lifecycle.** One Armory instance owns one upstream ability instance (and
 *    therefore its cached resources). `spawn()` builds an upstream cast context
 *    from the Armory line, `update()` ticks the effects the cast produced, and
 *    the instance reports DONE once every effect has expired. `destroy()`
 *    (clear / concurrency cap / teardown) disposes whatever is still live.
 *  - **cast line.** The target is the far end of the Armory line (the zone
 *    centre for ZONE casts). The caster's "right hand" is a point in the cast
 *    frame (`handHeight/handForward/handSide`).
 *  - **scene.** Effects add their roots to this ability's group, and every node
 *    is kept on `LAYER.VFX` so the depth pre-pass ignores them.
 *  - **lights.** Upstream effects create their own PointLights; adding lights
 *    to the Armory scene would recompile every material, so they are hidden and
 *    the brightest one is mirrored into this cast's pooled light
 *    (`lightIntensity`, `lightRadius`, tinted by `lightColor`).
 *  - **water.** The upstream arena is an ocean; `addRipple()` calls become
 *    shared ground-decal ripples (`rippleIntensity`).
 *  - **camera feedback.** Upstream micro-shakes drive the shared camera shake
 *    (`shake`) and, past a threshold, the shared screen flash (`flash`).
 *  - **quality.** A fixed LOW / MEDIUM / MAX tier (`detail`: 0/1/2) stands in
 *    for the upstream GraphicsSettings; it is read at cast time.
 *
 * Subclasses implement `createSource()` and may override `applyConfig(cfg)`
 * (once per cast, before `cast()`) and `applyLive(cfg)` (every frame).
 */
import { Vector3, Color, PointLight } from 'three';
import { Ability, AbilityPhase } from '../../Ability.js';
import { LAYER } from '../../../core/Layers.js';
import { DecalType } from '../../../effects/GroundDecals.js';
import { getColor } from '../../../utils/color.js';
import { QUALITY_PRESETS } from './src/quality/QualityPreset.ts';

const TIERS = ['LOW', 'MEDIUM', 'MAX'];
const UP = new Vector3(0, 1, 0);
const MAX_AGE = 40; // seconds — a net under any effect that never reports done

const _v = new Vector3();
const _c = new Color();
const _rippleColorA = new Color(0.55, 0.75, 1.0);

export class P27Ability extends Ability {
  constructor(element, context) {
    super(element, context);

    /** Live upstream effects owned by the current cast. */
    this.effects = [];
    /** Shader clock handed to upstream effects as `elapsedTime`. */
    this.clock = Math.random() * 100;
    this._peakLight = 1e-6;
    this._rippleCooldown = 0;
    this._lightPos = new Vector3();
    this._lightCol = new Color();

    /* ---- the upstream cast context, built once and refreshed per cast ---- */
    const self = this;
    this.hand = new Vector3();
    this.target = new Vector3();
    this.casterPos = new Vector3();
    this.castDir = new Vector3();

    this._quality = {
      get preset() {
        return TIERS[self._tier()];
      },
      get config() {
        return QUALITY_PRESETS[TIERS[self._tier()]];
      },
      mouseSensitivity: 1,
      subscribe(listener) {
        listener(this.config);
        return () => {};
      },
      setPreset() {}
    };

    const hand = this.hand;
    // Caster points are handed out pre-divided by the effect scale about the
    // target, so that a target-rooted effect drawn at `scale` puts its hand
    // visuals back on the real hand (see `_scale()`).
    this._visual = {
      getRightHandWorldPosition: (out = new Vector3()) => self._unscale(out.copy(hand)),
      getLeftHandWorldPosition: (out = new Vector3()) =>
        self._unscale(out.copy(hand).addScaledVector(self.side, -2 * (self.config.handSide ?? 0.3))),
      getChestWorldPosition: (out = new Vector3()) =>
        self._unscale(out.copy(self.casterPos).addScaledVector(UP, (self.config.handHeight ?? 1.25) + 0.15)),
      getFootWorldPosition: (side, out = new Vector3()) =>
        self._unscale(out.copy(self.casterPos).addScaledVector(self.side, side === 'left' ? -0.12 : 0.12)),
      beginRightHandCast() {}
    };
    /**
     * Uniform size. Opt-in per ability (`scalable`), because it only holds for
     * upstream effects whose root sits on the target and draws in its local
     * frame. ZONE abilities derive it from `zoneRadius / nativeRadius`, so the
     * circle you aim with is the footprint you get.
     */
    this.scalable = false;
    this.nativeRadius = 0;
    this._scaledRoots = [];
    this._player = {
      position: this.casterPos,
      visual: this._visual,
      getForward: () => this.castDir.clone()
    };

    this._water = {
      addRipple: (r) => this._ripple(r),
      removeOwner() {},
      removeDisturbance() {},
      getSurfaceHeight: () => 0,
      subscribe: () => () => {}
    };

    this._scene = {
      add: (...objects) => {
        for (const o of objects) this.group.add(o);
        return this._scene;
      },
      remove: (...objects) => {
        for (const o of objects) this.group.remove(o);
        return this._scene;
      }
    };

    this._effectManager = {
      add: (effect) => this.effects.push(effect),
      get activeCount() {
        return self.effects.length;
      }
    };

    this.source = this.createSource();
  }

  /** Build the upstream ability instance. */
  createSource() {
    throw new Error('P27Ability subclass must implement createSource()');
  }

  /** Push the settings block into upstream config objects, once per cast. */
  applyConfig(_cfg) {}

  /** Push live (per-frame safe) settings into upstream config objects. */
  applyLive(_cfg) {}

  _scale() {
    if (!this.scalable) return 1;
    const cfg = this.config;
    const s = this.nativeRadius > 0 ? (cfg.zoneRadius ?? this.nativeRadius) / this.nativeRadius : cfg.scale ?? 1;
    return Math.max(0.05, Number.isFinite(s) ? s : 1);
  }

  /** world point → the point that lands on it once scaled about the target */
  _unscale(p) {
    const s = this._scale();
    if (s !== 1) p.sub(this.target).divideScalar(s).add(this.target);
    return p;
  }

  /** inverse of `_unscale` */
  _rescale(p) {
    const s = this._scale();
    if (s !== 1) p.sub(this.target).multiplyScalar(s).add(this.target);
    return p;
  }

  _tier() {
    const d = Math.round(this.config.detail ?? 2);
    return d <= 0 ? 0 : d >= 2 ? 2 : 1;
  }

  get isActive() {
    return this.phase === AbilityPhase.TRAVEL;
  }

  /* ------------------------------------------------------------------ */

  onSpawn() {
    const cfg = this.config;
    this.effects.length = 0;
    this._peakLight = 1e-6;
    this._rippleCooldown = 0;

    this.castDir.copy(this.direction);
    this.casterPos.copy(this.origin);
    this.target.copy(this.origin).addScaledVector(this.direction, this.length);
    this.target.y = 0;
    this.position.copy(this.target);
    this.hand
      .copy(this.origin)
      .addScaledVector(UP, cfg.handHeight ?? 1.25)
      .addScaledVector(this.direction, cfg.handForward ?? 0.45)
      .addScaledVector(this.side, cfg.handSide ?? 0.3);

    const aim = new Vector3().subVectors(this.target, this.hand).normalize();
    const camera = this.ctx.camera;
    const context = {
      player: this._player,
      scene: this._scene,
      camera,
      origin: this.hand.clone(),
      direction: aim,
      playerForward: this.direction.clone(),
      cameraForward: camera.getWorldDirection(new Vector3()),
      targetPoint: this.target.clone(),
      groundTarget: this.target.clone(),
      targeting: null,
      effectManager: this._effectManager,
      quality: this._quality,
      time: this.clock,
      water: this._water,
      cameraFeedback: (strength, duration) => this._feedback(strength, duration),
      skyFraming: () => {}
    };

    this.applyConfig(cfg);
    let ok = false;
    try {
      ok = this.source.cast(context) !== false;
    } catch (error) {
      console.error(`[p27] ${this.element} cast failed`, error);
      ok = false;
    }
    if (!ok || this.effects.length === 0) this.phase = AbilityPhase.DONE;
    // Roots the cast hung on the target are the ones `scale` may resize.
    this._scaledRoots.length = 0;
    if (this.scalable) {
      for (const child of this.group.children) {
        if (child.position.distanceToSquared(this.target) < 1e-4) this._scaledRoots.push(child);
      }
    }
    this._syncScene(0);
  }

  update(dt) {
    if (!this.isActive) return;
    const cfg = this.config;
    const sdt = Math.min(0.1, dt) * Math.max(0, cfg.timeScale ?? 1);
    this.age += sdt;
    this.clock += sdt;
    this._rippleCooldown -= sdt;

    this.applyLive(cfg);

    const effects = this.effects;
    for (let i = effects.length - 1; i >= 0; i--) {
      const effect = effects[i];
      let alive = false;
      try {
        alive = effect.update(sdt, this.clock);
      } catch (error) {
        console.error(`[p27] ${this.element} effect update failed`, error);
        alive = false;
      }
      if (!alive) {
        effect.dispose();
        effects.splice(i, 1);
      }
    }
    this.source.update?.(sdt);

    this._syncScene(dt);

    if (effects.length === 0 || this.age > MAX_AGE) this.phase = AbilityPhase.DONE;
  }

  /**
   * Keep every upstream node on the VFX layer, hide upstream PointLights and
   * mirror the brightest one into the pooled light.
   */
  _syncScene(dt) {
    if (this._scaledRoots.length) {
      const s = this._scale();
      for (const root of this._scaledRoots) root.scale.setScalar(s);
    }
    let best = null;
    let bestIntensity = 0;
    this.group.traverse((node) => {
      node.layers.set(LAYER.VFX);
      if (node instanceof PointLight) {
        if (node.intensity > bestIntensity) {
          bestIntensity = node.intensity;
          best = node;
        }
        // Hidden, never removed: upstream code keeps driving its intensity,
        // which is what the mirror reads next frame.
        node.visible = false;
      }
    });

    if (!this.light) return;
    const cfg = this.config;
    if (best) {
      this._peakLight = Math.max(this._peakLight, bestIntensity);
      best.getWorldPosition(this._lightPos);
      this._lightCol.copy(best.color).multiply(getColor(cfg.lightColor));
    } else {
      this._lightPos.copy(this.position).setY(1.5);
    }
    const level = best ? bestIntensity / this._peakLight : 0;
    this.ctx.lights.set(
      this.light,
      this._lightPos,
      this._lightCol,
      cfg.lightIntensity * level + this.lightBoost,
      cfg.lightRadius,
      dt || 0.016
    );
    this.lightBoost = Math.max(0, this.lightBoost - this.lightBoost * 4.5 * (dt || 0.016));
  }

  /** Upstream camera micro-feedback → shared shake + screen flash + light punch. */
  _feedback(strength, duration) {
    if (!Number.isFinite(strength) || strength <= 0) return;
    const cfg = this.config;
    const k = Math.min(1, strength / 0.025);
    const decay = 1 / Math.max(0.12, Math.min(0.6, (duration || 0.15) * 3));
    this.ctx.shake.add(Math.min(1, (cfg.shake ?? 1) * (0.12 + k * 0.6)), decay);
    if (strength >= 0.006 && (cfg.flash ?? 0) > 0) {
      _c.copy(getColor(cfg.lightColor));
      this.ctx.flash.trigger(_c, (cfg.flash ?? 0) * (0.25 + k * 0.75));
    }
    if (strength >= 0.006 && (cfg.shockwave ?? 0) > 0) {
      this.ctx.decals.spawn(DecalType.SHOCKWAVE, this.target, {
        radius: (cfg.shockwaveRadius ?? 6) * (0.5 + k * 0.5) * this._scale(),
        life: 0.9,
        intensity: cfg.shockwave,
        colorA: getColor(cfg.lightColor),
        colorB: getColor(cfg.lightColor),
        growth: 1
      });
    }
    this.lightBoost += (cfg.lightIntensity ?? 10) * 0.5 * k;
  }

  /** Upstream water ripple → shared ripple decal, rate limited. */
  _ripple(r) {
    const cfg = this.config;
    const intensity = cfg.rippleIntensity ?? 1;
    if (intensity <= 0 || !r?.position || this._rippleCooldown > 0) return 0;
    if (![r.position.x, r.position.z, r.strength, r.duration].every(Number.isFinite)) return 0;
    this._rippleCooldown = 0.15;
    const s = this._scale();
    const radius = Math.min(8, (r.radius ?? 0.15) + (r.waveSpeed ?? 2) * Math.min(r.duration, 3) * 0.2) * s;
    this._rescale(_v.set(r.position.x, 0, r.position.z));
    this.ctx.decals.spawn(DecalType.RIPPLE, _v, {
      radius: Math.max(0.6, radius),
      life: Math.max(0.4, Math.min(3, r.duration)),
      intensity: Math.min(0.6, 0.1 + Math.abs(r.strength) * 0.6) * intensity,
      colorA: _rippleColorA,
      colorB: getColor(cfg.lightColor),
      growth: 1
    });
    return 1;
  }

  onDestroy() {
    for (const effect of this.effects) {
      try {
        effect.dispose();
      } catch (error) {
        console.error(`[p27] ${this.element} effect dispose failed`, error);
      }
    }
    this.effects.length = 0;
  }

  dispose() {
    this.onDestroy();
    this.source?.dispose?.();
    super.dispose();
  }
}

/**
 * Copy a set of keys from the settings block into an upstream config object.
 * `map` is `{ upstreamKey: settingsKey }` or an array of shared key names.
 */
export function assignKeys(target, cfg, keys) {
  if (Array.isArray(keys)) {
    for (const key of keys) if (key in cfg && Number.isFinite(cfg[key])) target[key] = cfg[key];
  } else {
    for (const [to, from] of Object.entries(keys)) if (Number.isFinite(cfg[from])) target[to] = cfg[from];
  }
  return target;
}
