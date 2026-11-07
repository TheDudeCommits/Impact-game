// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
/*!
 * particles.js — the extended pack's door into the shared particle engine.
 *
 * The base engine (`particles/ParticleEngine.js`) builds base `ParticleSystem`s,
 * which know shapes 0..5. The source repos added BUBBLE, DROPLET and GLINT, so
 * every system this pack asks for is an `ExtParticleSystem` (a superset: shapes
 * 0..5 are identical, time regions still work) registered *into* the shared
 * engine's map, so flush / countLive / reset / dispose treat it like any other.
 *
 * Usage, in place of `this.ctx.particles.get(name, options)`:
 *
 *     import { extParticles, ParticleShape } from './lib/particles.js';
 *     this.mist = extParticles(this.ctx, 'extd_acid.mist', { shape: ParticleShape.SMOKE, ... });
 *
 * Names are global across all packs; prefix them with the ability id.
 *
 * Part of the extended pack. MIT, Copyright (c) 2026 mohamedachrefelouafi.
 */
import { ExtParticleSystem, ParticleShape } from './ExtParticleSystem.js';
import { RateEmitter } from '../../../particles/ParticleEngine.js';

export { ParticleShape, ExtParticleSystem, RateEmitter };

/**
 * @param {object} ctx the AbilityManager context
 * @param {string} name globally unique system name
 * @param {object} options see ParticleSystem
 */
export function extParticles(ctx, name, options = {}) {
  const engine = ctx.particles;
  let system = engine.systems.get(name);
  if (!system) {
    system = new ExtParticleSystem({ name, ...options });
    engine.systems.set(name, system);
    engine.scene.add(system.object3D);
  }
  return system;
}

/**
 * A drop-in object with the source repos' `ctx.particles.get(name, opts)`
 * shape, for code that holds on to `this.ctx.particles`.
 */
export function particleFacade(ctx) {
  return {
    get: (name, options) => extParticles(ctx, name, options),
    systems: ctx.particles.systems
  };
}
