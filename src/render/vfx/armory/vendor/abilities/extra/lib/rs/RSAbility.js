// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
/*!
 * RSAbility — runs one rollshade move (https://github.com/tsuyatt/rollshade,
 * MIT, © 2026 tsuyatt) inside the Armory's Ability lifecycle.
 *
 * A cast builds rollshade's play context exactly as `FXSystem.play()` does —
 * palette from the element (or one custom colour), the recipe's params from
 * this ability's live settings block — and calls the recipe once. From then on
 * the move is a set of timed tasks on this instance's own runtime; the ability
 * is finished when the move has ended *and* the last particle has died, so
 * nothing is ever cut off mid-fade.
 *
 * Every look value (brightness, particle density, smoke, hot-white, light,
 * flash, distortion, shake, hit-stop, impact frames) is re-read every frame,
 * so dragging a slider changes a move that is already playing. Timing and
 * shape params are read at cast time, as in rollshade.
 */
import { Vector3 } from 'three';
import { Ability, AbilityPhase } from '../../../Ability.js';
import { settings } from '../../../../config/settings.js';
import { RSRuntime } from './runtime.js';
import { Ctx } from './ctx.js';
import { palette } from './palette.js';

export const ELEMENT_NAMES = ['plain', 'fire', 'ice', 'thunder', 'wind', 'earth', 'water', 'light', 'dark', 'poison', 'arcane'];

/** Settings keys that belong to the sandbox / look, never passed to a recipe. */
const NOT_PARAMS = new Set([
  'range', 'minRange', 'cooldown', 'castAnim', 'element', 'hue', 'useColor', 'color', 'scale', 'brightness',
  'particles', 'smoke', 'coreWhite', 'hotWhite', 'lightScale', 'flash', 'distortion', 'shake', 'hitStop',
  'impactFrames', 'handHeight', 'handForward', 'targetHeight', 'maxLife'
]);

const UP = new Vector3(0, 1, 0);

export class RSAbility extends Ability {
  /**
   * @param {string} id       settings key
   * @param {object} context  sandbox services
   * @param {Function} recipe a rollshade recipe `(ctx, params) => void` with `.defaults`
   */
  constructor(id, context, recipe) {
    super(id, context);
    this.recipe = recipe;
  }

  createShaders() {
    this.rt = new RSRuntime(this.ctx, this.group);
    this.from = new Vector3();
    this.to = new Vector3();
    this.handle = null;
  }

  get impactDuration() {
    return 1;
  }

  _syncLook() {
    const c = this.config;
    const g = settings.global;
    const L = this.rt.look;
    L.particles = c.particles * g.particleCount;
    L.smoke = c.smoke;
    L.core = c.coreWhite;
    L.hot = c.hotWhite;
    L.bright = c.brightness * g.glow * g.opacity;
    L.light = c.lightScale * g.lightIntensity;
    L.flash = c.flash * g.explosionIntensity;
    L.distortion = c.distortion;
    L.shake = c.shake;
    L.impactFrames = c.impactFrames;
    this.rt.hitStopScale = c.hitStop;
  }

  spawn(origin, direction, distance) {
    const c = this.config;
    this.origin.set(origin.x, 0, origin.z);
    this.direction.copy(direction).setY(0).normalize();
    this.side.crossVectors(this.direction, UP).normalize();
    const dist = Math.min(Math.max(distance, c.minRange), c.range);
    this.length = dist;
    this.front = 0;
    this.u = 0;
    this.age = 0;
    this.impactTime = 0;
    this.fadeTime = 0;
    this.lightBoost = 0;
    this.phase = AbilityPhase.TRAVEL;
    this.group.visible = true;

    this.rt.clear();
    this._syncLook();

    this.from.copy(this.origin).addScaledVector(this.direction, c.handForward).setY(c.handHeight);
    this.to.copy(this.origin).addScaledVector(this.direction, dist).setY(c.targetHeight);
    this.position.copy(this.from).lerp(this.to, 0.5);

    const element = ELEMENT_NAMES[Math.max(0, Math.min(ELEMENT_NAMES.length - 1, Math.round(c.element)))];
    const pal = palette(element, c.hue, c.useColor > 0.5 ? c.color : undefined, { value: c.coreWhite });

    const handle = {
      playing: true,
      ended: false,
      head: this.position.clone(),
      blade: { base: new Vector3(), tip: new Vector3(), active: false },
      body: { offset: new Vector3(), lean: 0, turn: 0, limb: null },
      emit(name) {
        if (name === 'end') this.ended = true;
      }
    };
    this.handle = handle;

    const params = { ...this.recipe.defaults };
    for (const key of Object.keys(this.recipe.defaults)) if (key in c && !NOT_PARAMS.has(key)) params[key] = c[key];
    if ('anime' in c) params.anime = c.anime;

    const ctx = new Ctx(this.rt, handle, { element, hue: c.hue }, pal, {
      from: this.from,
      to: this.to,
      power: 1,
      scale: c.scale,
      floorY: 0
    });
    ctx.params = params;
    this.rt.scheduler.part = 'main';
    try {
      this.recipe(ctx, params);
    } catch (error) {
      console.error(`[${this.element}] rollshade recipe failed`, error);
    }
    ctx.finish();
  }

  update(dt) {
    if (!this.isActive) return;
    this.age += dt;
    this._syncLook();
    this.rt.step(dt);
    const h = this.handle;
    if (h && h.head.lengthSq() > 0) this.position.lerp(h.head, Math.min(1, dt * 6));
    if (h?.ended && this.phase === AbilityPhase.TRAVEL) this.phase = AbilityPhase.FADE;
    const maxLife = this.config.maxLife ?? 14;
    if ((h?.ended && !this.rt.busy) || this.age > maxLife) this.phase = AbilityPhase.DONE;
  }

  destroy() {
    if (this.handle) this.handle.playing = false;
    this.rt.clear();
    super.destroy();
  }

  dispose() {
    this.rt.dispose();
    super.dispose();
  }
}
