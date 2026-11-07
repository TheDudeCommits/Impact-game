// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
/*!
 * FireField — stylised billboard fire, ported from "three-fires" by ICS INC.
 * (src/fire/billboard.ts, fire-particles.ts, fire-field.ts).
 *
 * MIT License — Copyright (c) 2014-2026 ICS INC.
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, subject to the conditions of the MIT License (the
 * above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software). THE SOFTWARE IS PROVIDED
 * "AS IS", WITHOUT WARRANTY OF ANY KIND.
 *
 * Port notes:
 *  - TypeScript → JS, `three/webgpu` → `three`. The original uses only
 *    MeshBasicMaterial + InstancedMesh (no TSL nodes), so it runs unchanged on
 *    the base WebGLRenderer. Its TSL post pass (LinearToneMapping + an HDR
 *    highlight lift) is left to the sandbox's own ACES/bloom chain.
 *  - GSAP timelines (power1.out / CustomBounce / power2.in / sine.inOut) are
 *    evaluated analytically per frame from a launch time, so a cast is
 *    deterministic and pausable.
 *  - Units: everything is read in metres from the live settings block (the
 *    original values × 1/150). The infinite loop becomes a timed burn.
 *  - The 75 per-ember PointLights are dropped (the sandbox has a light pool);
 *    one pooled light stands in for the centre light.
 */
import {
  AdditiveBlending,
  CircleGeometry,
  Color,
  DoubleSide,
  DynamicDrawUsage,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  NearestFilter,
  Quaternion,
  SRGBColorSpace,
  TextureLoader,
  Vector3
} from 'three';
import { LAYER } from '../../../../core/Layers.js';
import { getColor } from '../../../../utils/color.js';

const BASE = `/assets/armory/fxlib/ics-fire/`;

/* ------------------------------------------------------------------ */
/* Textures (shared, loaded once)                                      */
/* ------------------------------------------------------------------ */
let _textures = null;
function textures() {
  if (_textures) return _textures;
  const loader = new TextureLoader();
  const load = (name, crisp) => {
    const t = loader.load(BASE + name);
    t.colorSpace = SRGBColorSpace;
    if (crisp) {
      // The original keeps the flame silhouettes pixel-crisp.
      t.generateMipmaps = false;
      t.minFilter = t.magFilter = NearestFilter;
    }
    return t;
  };
  const streak = load('lens_frare_active.png', false);
  // Cut out the horizontal-line band and flip it, as the original does.
  streak.offset.y = 1;
  streak.repeat.y = 336 / 512 - 1;
  _textures = {
    blurred: load('fire_particle.png', true),
    sharp: load('fire_particle_sharp.png', true),
    flare: load('lens_frare.png', false),
    streak
  };
  return _textures;
}

/** billboard.ts — one image, many camera-facing discs, one draw call. */
function createBillboards({ texture, maxInstances, renderOrder, heightScale, depthTest = true, alphaTest = 0 }) {
  const material = new MeshBasicMaterial({
    map: texture,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    depthTest,
    alphaTest,
    fog: false,
    toneMapped: true,
    // The streak's height is flipped by a negative scale; keep both faces.
    side: DoubleSide
  });
  const geometry = new CircleGeometry(0.5, 12);
  if (heightScale !== undefined) geometry.scale(1, heightScale, 1);
  const mesh = new InstancedMesh(geometry, material, maxInstances);
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  mesh.setColorAt(0, new Color());
  mesh.instanceColor.setUsage(DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.renderOrder = renderOrder;
  mesh.layers.set(LAYER.VFX);
  mesh.count = 0;
  return mesh;
}

/* ------------------------------------------------------------------ */
/* Easing (the GSAP curves the original timeline used)                 */
/* ------------------------------------------------------------------ */
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const power1Out = (t) => 1 - (1 - t) * (1 - t);
const power2In = (t) => t * t * t;
const sineInOut = (t) => -(Math.cos(Math.PI * t) - 1) / 2;
const smoothstep = (x, a, b) => {
  if (x <= a) return 0;
  if (x >= b) return 1;
  const t = (x - a) / (b - a);
  return t * t * (3 - 2 * t);
};
/**
 * CustomBounce(strength 0.7, endAtStart) stand-in: a thrown ember rises to
 * 1, lands at 0, and bounces `n` times with each arc `decay`× shorter.
 */
function bounce(t, n, decay) {
  let total = 0;
  let d = 1;
  for (let i = 0; i < n; i++, d *= decay) total += d;
  let x = t * total;
  d = 1;
  for (let i = 0; i < n; i++, d *= decay) {
    if (x <= d || i === n - 1) {
      const u = clamp01(x / d);
      return 4 * u * (1 - u) * d * d;
    }
    x -= d;
  }
  return 0;
}
const rand = (a, b) => a + Math.random() * (b - a);

const SEC_FADE_MAX = 1;
const SEC_RETRY_SPAWN = 0.1;
const SPEED_RESET = 33; // m/s (original 5000 / 150)

const MAX_SOURCES = 150;
const MAX_TRAIL = 80;
const MAX_CENTER = 400;
const MAX_MOTIONS = Math.max(MAX_TRAIL, MAX_CENTER);

const _m = new Matrix4();
const _p = new Vector3();
const _s = new Vector3();
const _c = new Color();
const _q = new Quaternion();
const _cam = new Vector3();

export class FireField {
  /**
   * @param {THREE.Object3D} parent  where the meshes live
   * @param {THREE.Camera} camera
   */
  constructor(parent, camera) {
    this.camera = camera;
    const tex = textures();

    this.center = new Vector3();
    this.centerRatio = 0;

    this.motions = [];
    for (let i = 0; i < MAX_MOTIONS; i++) {
      this.motions.push({
        secDelay: 0,
        secLife: 1,
        thresholdSpawn: 0,
        scaleCenter: 1,
        positionOffset: new Vector3(),
        velocityCenter: new Vector3(),
        velocityTrail: new Vector3(),
        accelerationHorizontal: new Vector3()
      });
    }

    this.sources = [];
    for (let i = 0; i < MAX_SOURCES; i++) {
      this.sources.push({
        position: new Vector3(),
        positionPrevious: new Vector3(),
        velocity: new Vector3(),
        ratioSpawn: 0,
        brightness: 0,
        isFlying: false,
        active: false,
        cycleStart: 0,
        delay: 0,
        landX: 0,
        landZ: 0,
        peak: 1
      });
    }

    // Particle state, split by texture (0 = blurred, 1 = sharp).
    const cap = MAX_SOURCES * MAX_TRAIL + MAX_CENTER;
    this.batches = [tex.blurred, tex.sharp].map((texture, textureIndex) => {
      const states = [];
      for (let i = 0; i < cap; i++) {
        states.push({ secAge: 0, emitter: null, positionStart: new Vector3(), velocityStart: new Vector3(), motion: null });
      }
      const mesh = createBillboards({ texture, maxInstances: cap, renderOrder: 20, alphaTest: 0.01 });
      parent.add(mesh);
      return { textureIndex, states, count: 0, mesh };
    });

    this.meshFlare = createBillboards({ texture: tex.flare, maxInstances: MAX_SOURCES, renderOrder: 21, depthTest: false });
    this.meshStreak = createBillboards({
      texture: tex.streak,
      maxInstances: 20,
      renderOrder: 22,
      depthTest: false,
      heightScale: tex.streak.repeat.y
    });
    parent.add(this.meshFlare, this.meshStreak);
    this.numSources = 0;
  }

  /* ------------------------------------------------------------------ */

  _rollMotion(m, c) {
    const angle = rand(0, Math.PI * 2);
    const speed = rand(c.trailSpeedMin, c.trailSpeedMax);
    m.secDelay = rand(0, c.centerIgnite);
    m.secLife = Math.max(0.02, rand(c.centerLifeMin, c.centerLifeMax));
    m.thresholdSpawn = Math.random();
    m.scaleCenter = rand(c.centerScaleMin, c.centerScaleMax);
    const j = c.centerJitter;
    m.positionOffset.set(rand(-j, j), rand(-j, j), rand(-j, j));
    m.velocityCenter.set(rand(-c.centerSpread, c.centerSpread), rand(c.centerRiseMin, c.centerRiseMax), rand(-c.centerSpread, c.centerSpread));
    m.velocityTrail.setFromCylindricalCoords(speed, angle, 0);
    m.accelerationHorizontal.set(rand(-c.centerAccel, c.centerAccel), 0, rand(-c.centerAccel, c.centerAccel));
  }

  _launch(src, now, c, lifetime, first) {
    const maxDelay = Math.max(0, Math.min(c.launchWindow, lifetime - c.flightTime));
    if (first) src.delay = rand(0, maxDelay);
    src.cycleStart = now;
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * c.landRadius;
    src.landX = Math.cos(a) * r;
    src.landZ = Math.sin(a) * r;
    src.peak = rand(c.peakMin, c.peakMax);
    src.position.copy(this.center);
    src.positionPrevious.copy(this.center);
    src.velocity.set(0, 0, 0);
    src.isFlying = false;
    src.ratioSpawn = 0;
    src.brightness = 0;
    src.active = true;
  }

  /** Start a burn at `center` (floor point). */
  start(center, c, lifetime) {
    this.center.copy(center);
    this.centerRatio = 1;
    this.lifetime = lifetime;

    const numSources = Math.max(0, Math.min(MAX_SOURCES, Math.round(c.sources)));
    const trail = Math.max(0, Math.min(MAX_TRAIL, Math.round(c.trailCount)));
    const numCenter = Math.max(0, Math.min(MAX_CENTER, Math.round(c.centerCount)));
    const stepSharp = Math.max(1, Math.round(c.sharpEvery));
    this.numSources = numSources;

    const numMotions = Math.max(trail, numCenter);
    for (let i = 0; i < numMotions; i++) this._rollMotion(this.motions[i], c);

    for (let i = 0; i < MAX_SOURCES; i++) {
      const s = this.sources[i];
      if (i < numSources) this._launch(s, 0, c, lifetime, true);
      else s.active = false;
    }

    for (const b of this.batches) b.count = 0;
    const add = (emitter, n) => {
      for (let i = 0; i < n; i++) {
        const motion = this.motions[i];
        const b = this.batches[i % stepSharp === stepSharp - 1 ? 1 : 0];
        const st = b.states[b.count++];
        st.secAge = -motion.secDelay;
        st.emitter = emitter;
        st.motion = motion;
      }
    };
    for (let i = 0; i < numSources; i++) add(this.sources[i], trail);
    add(null, numCenter);
    for (const b of this.batches) b.mesh.count = b.count;
    this.meshFlare.count = numSources;
    this.meshStreak.count = 0;
  }

  /** Hide everything (pool return). */
  stop() {
    for (const b of this.batches) b.mesh.count = 0;
    this.meshFlare.count = 0;
    this.meshStreak.count = 0;
    for (const s of this.sources) s.active = false;
  }

  /* ------------------------------------------------------------------ */

  /**
   * @param {number} dt      seconds
   * @param {number} now     seconds since the burn started
   * @param {object} c       live settings block
   * @param {boolean} allowLaunch  false once the burn is dying down
   */
  update(dt, now, c, allowLaunch) {
    this.camera.getWorldQuaternion(_q);
    this.camera.getWorldPosition(_cam);
    this._updateSources(dt, now, c, allowLaunch);
    this._updateFlares(c);
    this._updateParticles(dt, c);
  }

  _updateSources(dt, now, c, allowLaunch) {
    const flight = Math.max(0.05, c.flightTime);
    for (let i = 0; i < this.numSources; i++) {
      const s = this.sources[i];
      if (!s.active) {
        s.isFlying = false;
        s.ratioSpawn = 0;
        continue;
      }
      const tau = now - s.cycleStart;
      if (tau < s.delay) {
        s.isFlying = false;
        s.ratioSpawn = 0;
        s.brightness = clamp01(tau / 0.2); // ignition tween (not visible until flying)
      } else {
        const local = tau - s.delay;
        const f = local / flight;
        if (f >= 1) {
          // Landed: back to the centre for the next cycle, or rest.
          if (c.repeat >= 0.5 && allowLaunch && now + s.delay + flight <= this.lifetime) {
            this._launch(s, now, c, this.lifetime, false);
          } else {
            s.active = false;
            s.isFlying = false;
            s.ratioSpawn = 0;
            s.brightness = 0;
            s.position.copy(this.center);
          }
          s.velocity.set(0, 0, 0);
          s.positionPrevious.copy(s.position);
          continue;
        }
        s.isFlying = true;
        const h = power1Out(f);
        s.position.set(
          this.center.x + s.landX * h,
          this.center.y + s.peak * bounce(f, Math.max(1, Math.round(c.bounces)), c.bounceDecay),
          this.center.z + s.landZ * h
        );
        const left = flight - local;
        s.ratioSpawn = c.particleFade > 0 && left < c.particleFade ? 1 - power2In(1 - left / c.particleFade) : 1;
        s.brightness = c.emberFade > 0 && left < c.emberFade ? 1 - sineInOut(1 - left / c.emberFade) : 1;
      }

      // updateVelocity
      if (!s.isFlying || dt <= 0.0001) {
        s.velocity.set(0, 0, 0);
        s.positionPrevious.copy(s.position);
      } else {
        s.velocity.subVectors(s.position, s.positionPrevious).divideScalar(dt);
        s.positionPrevious.copy(s.position);
        if (s.velocity.lengthSq() > SPEED_RESET * SPEED_RESET) s.velocity.set(0, 0, 0);
      }
    }
  }

  _updateFlares(c) {
    this.meshFlare.material.opacity = rand(c.flareOpacityMin, c.flareOpacityMax);
    this.meshStreak.material.opacity = rand(c.flareOpacityMin * 0.75, c.flareOpacityMax);
    const maxStreaks = Math.max(0, Math.min(20, Math.round(c.streakMax)));
    let numStreaks = 0;
    for (let i = 0; i < this.numSources; i++) {
      const s = this.sources[i];
      _c.setScalar(s.isFlying ? s.brightness * c.flareBrightness : 0);
      _m.compose(s.position, _q, _s.setScalar(c.flareSize));
      this.meshFlare.setMatrixAt(i, _m);
      this.meshFlare.setColorAt(i, _c);

      if (!s.isFlying || i % 3 !== 0 || numStreaks >= maxStreaks) continue;
      const depth = _p.copy(s.position).sub(_cam).length();
      const k =
        smoothstep(s.position.y - this.center.y, c.streakHeightMin, c.streakHeightMax) *
        smoothstep(depth, c.streakNearIn, c.streakNearFull) *
        (1 - smoothstep(depth, c.streakFarStart, c.streakFarEnd));
      if (k <= 0) continue;
      _c.setScalar(s.brightness * k * c.streakBrightness);
      _m.compose(s.position, _q, _s.setScalar(c.streakSize));
      this.meshStreak.setMatrixAt(numStreaks, _m);
      this.meshStreak.setColorAt(numStreaks, _c);
      numStreaks++;
    }
    this.meshFlare.instanceMatrix.needsUpdate = true;
    this.meshFlare.instanceColor.needsUpdate = true;
    this.meshStreak.count = numStreaks;
    this.meshStreak.instanceMatrix.needsUpdate = true;
    this.meshStreak.instanceColor.needsUpdate = true;
  }

  _updateParticles(dt, c) {
    const blurStart = getColor(c.colorBlurStart);
    const blurEnd = getColor(c.colorBlurEnd);
    const sharpStart = getColor(c.colorSharpStart);
    const sharpEnd = getColor(c.colorSharpEnd);
    const drag = Math.max(0.01, c.trailDrag);

    for (const batch of this.batches) {
      const sharp = batch.textureIndex === 1;
      const colStart = sharp ? sharpStart : blurStart;
      const colEnd = sharp ? sharpEnd : blurEnd;
      const cw0 = sharp ? c.sharpWidthStart : c.blurWidthStart;
      const cw1 = sharp ? c.sharpWidthEnd : c.blurWidthEnd;
      const ch0 = sharp ? c.sharpHeightStart : c.blurHeightStart;
      const ch1 = sharp ? c.sharpHeightEnd : c.blurHeightEnd;
      const cBright = sharp ? c.sharpBrightness : c.blurBrightness;
      const tBright = sharp ? c.trailSharpBrightness : c.trailBlurBrightness;
      const mesh = batch.mesh;

      for (let i = 0; i < batch.count; i++) {
        const particle = batch.states[i];
        const motion = particle.motion;
        particle.secAge += dt;

        if (particle.secAge >= motion.secLife || (particle.secAge >= 0 && particle.secAge < dt)) {
          const ratio = particle.emitter ? particle.emitter.ratioSpawn : this.centerRatio;
          if (ratio <= motion.thresholdSpawn) {
            particle.secAge = -SEC_RETRY_SPAWN;
          } else {
            particle.secAge %= motion.secLife;
            this._capture(particle, c);
          }
        }

        if (particle.secAge < 0) {
          _m.compose(this.center, _q, _s.setScalar(0));
          mesh.setMatrixAt(i, _m);
          continue;
        }

        const isCenter = particle.emitter === null;
        const secAge = particle.secAge;
        const ratioLife = secAge / motion.secLife;
        const halfAgeSquared = secAge * secAge * 0.5;
        _p.copy(particle.positionStart).add(motion.positionOffset);
        if (isCenter) {
          _p.addScaledVector(particle.velocityStart, secAge);
        } else {
          const secDrag = -Math.expm1(-drag * secAge) / drag;
          _p.addScaledVector(particle.velocityStart, secDrag);
          _p.y += (c.trailLift / drag) * (secAge - secDrag);
        }
        _p.addScaledVector(motion.accelerationHorizontal, halfAgeSquared * (isCenter ? c.centerAccelScale : c.trailAccelScale));

        if (isCenter) {
          const k = motion.scaleCenter;
          _s.set((cw0 + (cw1 - cw0) * ratioLife) * k, (ch0 + (ch1 - ch0) * ratioLife) * k, 1);
        } else {
          const w = c.trailSizeStart + (c.trailSizeEnd - c.trailSizeStart) * ratioLife;
          _s.set(w, w, 1);
        }
        const secFade = Math.min(SEC_FADE_MAX, motion.secLife * 0.5);
        const fade = smoothstep(motion.secLife - secAge, 0, secFade);
        _c.copy(colStart).lerp(colEnd, ratioLife).multiplyScalar(fade * (isCenter ? cBright : tBright));

        _m.compose(_p, _q, _s);
        mesh.setMatrixAt(i, _m);
        mesh.setColorAt(i, _c);
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }

  /** captureEmission */
  _capture(particle, c) {
    const emitter = particle.emitter;
    particle.positionStart.copy(emitter ? emitter.position : this.center);
    particle.velocityStart.copy(emitter ? particle.motion.velocityTrail : particle.motion.velocityCenter);
    if (!emitter) return;
    const speed = emitter.velocity.length();
    if (speed <= 0.27) return; // speedSourceMin 40 / 150
    const back = Math.min(c.trailBackMax, Math.max(c.trailBackMin, speed * c.trailBackRatio));
    particle.velocityStart.addScaledVector(emitter.velocity, -back / speed);
  }

  dispose() {
    for (const b of this.batches) {
      b.mesh.geometry.dispose();
      b.mesh.material.dispose();
      b.mesh.dispose();
    }
    for (const m of [this.meshFlare, this.meshStreak]) {
      m.geometry.dispose();
      m.material.dispose();
      m.dispose();
    }
  }
}

