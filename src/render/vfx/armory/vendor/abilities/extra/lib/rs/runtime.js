// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
/*!
 * rollshade-gl / runtime — the `fx` object rollshade's Ctx and recipes talk to.
 *
 * Stands in for rollshade's `FXSystem` (`src/runtime/system.ts`,
 * https://github.com/tsuyatt/rollshade): one scheduler, the twelve particle
 * pools, the primitive pool and the three solid sets, stepped together with
 * rollshade's hit-stop (simulation slowed to 4 % while a stop is held).
 *
 * Where rollshade drives its own WebGPU post pass, lights and camera, this
 * adapter routes the same calls into the Armory sandbox's shared services:
 *   - shake            → ctx.shake (CameraShake trauma)
 *   - post.flash/blink → ctx.flash (ScreenFlash)
 *   - post.wave        → a refraction ring in the distortion buffer
 *   - post.impactFrames→ a full-screen inversion quad
 *   - lights           → borrowed entries of the shared LightPool
 *
 * One runtime per ability instance, so a cast owns exactly its own buffers
 * and "Clear effects" can drop them on the spot.
 *
 * MIT License — Copyright (c) 2026 tsuyatt. Port for the VFX Armory "extra" pack.
 */
import { Color, Group, Vector3 } from 'three';
import { Scheduler } from './scheduler.js';
import { KINDS, ParticleSystem, particleUniforms, flushParticleEvents } from './particles.js';
import { PrimPool } from './prims.js';
import { SolidSet, crystalGeometries, crystalMaterial, rockGeometries, rockMaterial, rockSpikeGeometries } from './solids.js';
import { LAYER, retainDistortion, releaseDistortion } from '../../../../core/Layers.js';

const CAPS = { glow: 500, spark: 2400, star: 160, flare: 80, flame: 1400, smoke: 1400, mote: 1400, shard: 900, bubble: 400, glyph: 200, mist: 1200, haze: 200 };
const _v = new Vector3();
const WHITE = new Color(1, 1, 1);

export class RSRuntime {
  /**
   * @param {object} host  the sandbox context handed to abilities
   * @param {THREE.Group} parent  the ability's group
   */
  constructor(host, parent) {
    this.host = host;
    this.camera = host.camera;
    this.root = new Group();
    this.root.name = 'rollshade-gl';
    this.root.matrixAutoUpdate = false;
    parent.add(this.root);

    /** Live look values, refreshed from the ability's settings every frame. */
    this.look = { particles: 0.25, smoke: 0.2, core: 0.1, hot: 0.2, bright: 1, light: 0.4, flash: 1, distortion: 1, shake: 1, impactFrames: 1 };
    this.shared = particleUniforms();

    this.scheduler = new Scheduler();
    this.particles = {};
    for (const kind of KINDS) {
      const sys = new ParticleSystem(kind, CAPS[kind], this.look, this.shared);
      sys.mesh.layers.set(LAYER.VFX);
      this.particles[kind] = sys;
      this.root.add(sys.mesh);
    }
    this.prims = new PrimPool(this.root, this.shared);
    this.rocks = new SolidSet(rockGeometries(), rockMaterial, 48);
    this.spikes = new SolidSet(rockSpikeGeometries(), rockMaterial, 32);
    this.crystals = new SolidSet(crystalGeometries(), crystalMaterial, 48);
    for (const m of [...this.rocks.meshes, ...this.spikes.meshes, ...this.crystals.meshes]) this.root.add(m);

    this.floorY = 0;
    this.feel = true;
    this.hitStopScale = 1;
    this.photosensitive = false;
    this.only = null;
    this.stopT = 0;
    this._dt = 1 / 60;
    this._waves = 0;
    this._lights = [];

    this.lights = this._makeLights();
    this.post = this._makePost();
  }

  get impactFrames() {
    return this.look.impactFrames > 0.5;
  }

  set impactFrames(_v) {}

  /* ---- feel ---- */

  shake(amount) {
    this.host.shake.add(amount * this.look.shake, 1.6, 22);
  }

  hitStop(seconds) {
    this.stopT = Math.max(this.stopT, seconds);
  }

  /* ---- lights: rollshade's LightPool API over the sandbox's pool ---- */

  _makeLights() {
    const pool = this.host.lights;
    const rt = this;
    const borrow = () => {
      const entry = pool.acquire();
      if (entry) rt._lights.push(entry);
      return entry;
    };
    const free = (entry) => {
      const i = rt._lights.indexOf(entry);
      if (i >= 0) rt._lights.splice(i, 1);
      pool.release(entry);
    };
    return {
      flash(pos, color, intensity, dur, range = 8) {
        const entry = borrow();
        if (!entry) return;
        const p = pos.clone();
        const c = color.clone();
        rt.scheduler.add({
          age: 0,
          update(dt) {
            this.age += dt;
            const k = Math.min(this.age / Math.max(dur, 1e-3), 1);
            pool.set(entry, p, c, intensity * rt.look.light * (1 - k) * (1 - k), range, Math.max(dt, 1 / 30));
            return k < 1;
          },
          dispose: () => free(entry)
        });
      },
      hold(color, range = 6) {
        const entry = borrow();
        if (!entry) return { set() {}, release() {} };
        const c = color.clone();
        let open = true;
        return {
          set(pos, intensity, col) {
            if (!open) return;
            if (col) c.copy(col);
            pool.set(entry, pos, c, (intensity ?? 0) * rt.look.light * (0.9 + Math.random() * 0.2), range, Math.max(rt._dt, 1 / 30));
          },
          release() {
            if (!open) return;
            open = false;
            free(entry);
          }
        };
      }
    };
  }

  /* ---- post: rollshade's post hooks mapped onto the sandbox ---- */

  _makePost() {
    const rt = this;
    const tint = new Color(1, 1, 1);
    let flashValue = 0;
    let invert = null;
    return {
      aberration: 0,
      blinkT: 0,
      zoomAt() {},
      flashTint(c) {
        tint.copy(c);
      },
      get flash() {
        return flashValue;
      },
      set flash(v) {
        if (v > flashValue) rt.host.flash.trigger(tint, v * rt.look.flash, 0.002);
        flashValue = v;
      },
      set blinkAmount(v) {
        rt.host.flash.trigger(tint, v * 4 * rt.look.flash, 1e-7);
      },
      get blinkAmount() {
        return 0;
      },
      decay(dt) {
        flashValue = Math.max(0, flashValue - dt * 3);
      },
      set impactFrames(seconds) {
        if (!rt.impactFrames || seconds <= 0) return;
        if (invert) return;
        const prim = rt.prims.acquire('invert');
        prim.u.amount.value = 1;
        invert = prim;
        let age = 0;
        rt.scheduler.add({
          update(dt) {
            age += Math.max(dt, 1 / 240);
            return age < seconds;
          },
          dispose() {
            rt.prims.release(prim);
            invert = null;
          }
        });
      },
      get impactFrames() {
        return 0;
      },
      wave(p, radius, dur = 0.45, strength = 1) {
        if (rt.look.distortion <= 0) return;
        const prim = rt.prims.acquire('wave');
        const m = prim.mesh;
        const at = p.clone();
        prim.u.strength.value = strength * 0.025 * rt.look.distortion;
        prim.u.k.value = 0;
        if (rt._waves++ === 0) retainDistortion();
        let age = 0;
        const place = () => {
          m.position.copy(at);
          m.quaternion.copy(rt.camera.quaternion);
          m.scale.setScalar(Math.max(radius, 0.01));
        };
        place();
        rt.scheduler.add({
          update(dt) {
            age += dt;
            const k = Math.min(age / dur, 1);
            prim.u.k.value = k;
            place();
            return k < 1;
          },
          dispose() {
            rt.prims.release(prim);
            if (--rt._waves === 0) releaseDistortion();
          }
        });
      }
    };
  }

  /* ---- the frame ---- */

  /** Push live look values into the shared uniforms. */
  syncLook() {
    const cam = this.camera;
    this.shared.uTanHalfFov.value = Math.tan(((cam.fov ?? 45) * Math.PI) / 360);
    this.shared.uHotWhite.value = this.look.hot;
    this.shared.uBright.value = this.look.bright;
  }

  step(dt) {
    if (!(dt > 0)) dt = 0;
    this._dt = dt || this._dt;
    const real = Math.min(dt, 0.1);
    const sim = real * (this.stopT > 0 ? 0.04 : 1);
    this.stopT = Math.max(this.stopT - real, 0);
    this.syncLook();
    this.scheduler.step(sim);
    this.prims.sync();
    const t = this.scheduler.time;
    for (const sys of Object.values(this.particles)) sys.update(sim, t);
    flushParticleEvents();
    this.rocks.floorY = this.crystals.floorY = this.spikes.floorY = this.floorY;
    this.rocks.update(sim);
    this.crystals.update(sim);
    this.spikes.update(sim);
    this.post.decay(real);
  }

  /** Anything still drawing or scheduled? */
  get busy() {
    if (this.prims.busy) return true;
    for (const sys of Object.values(this.particles)) if (sys.alive) return true;
    if (this.rocks.size || this.crystals.size || this.spikes.size) return true;
    return false;
  }

  clear() {
    this.scheduler.cancel();
    for (const sys of Object.values(this.particles)) sys.clear();
    this.rocks.clear();
    this.crystals.clear();
    this.spikes.clear();
    this.prims.clear();
    for (const entry of [...this._lights]) this.host.lights.release(entry);
    this._lights.length = 0;
    if (this._waves > 0) releaseDistortion();
    this._waves = 0;
    this.stopT = 0;
    void _v;
    void WHITE;
  }

  dispose() {
    this.clear();
    for (const sys of Object.values(this.particles)) sys.dispose();
    this.prims.dispose();
    this.rocks.dispose();
    this.crystals.dispose();
    this.spikes.dispose();
    this.root.removeFromParent();
  }
}
