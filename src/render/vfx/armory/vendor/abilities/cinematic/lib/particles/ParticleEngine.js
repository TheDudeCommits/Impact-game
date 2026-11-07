// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
/**
 * Particle bridge for the cinematic pack (ported from achrefelouafi/AbilityCastingThreeJS, MIT).
 *
 * The cinematic abilities were authored against a newer `ParticleSystem` that
 * has three shapes the base engine lacks (BUBBLE, DROPLET, GLINT). Rather than
 * edit the shared engine, the pack keeps its own copy of that system class
 * (`./ParticleSystem.js`) and registers each instance into the base engine's
 * map — so the base engine still flushes, counts, resets and disposes them
 * exactly like its own, and the HUD particle count includes them.
 */
import { ParticleSystem } from './ParticleSystem.js';

export { RateEmitter } from '../../../../particles/ParticleEngine.js';

const PREFIX = 'cin.';

/** A tiny `get(name, options)` facade over the base engine. */
export function cinParticles(ctx) {
  const engine = ctx.particles;
  return {
    get(name, options) {
      const key = PREFIX + name;
      let system = engine.systems.get(key);
      if (!system) {
        system = new ParticleSystem({ name: key, ...options });
        engine.systems.set(key, system);
        engine.scene.add(system.object3D);
      }
      return system;
    }
  };
}
