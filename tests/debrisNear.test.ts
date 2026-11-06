import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { Debris, DEBRIS_NEAR } from '../src/render/vfx/Debris';

/** The feel pass, iteration eight: a stone thrown at the lens shrinks before it fills the frame
 *  (src/render/vfx/Debris.ts) - in the stone's shader and its ink hull's alike, about the chunk's own centre. */
describe('debris near the camera', () => {
  it('scales every chunk and its ink by its distance from the camera, after the hull\'s push', () => {
    const debris = new Debris(new THREE.Scene(), 4);
    try {
      for (const [mesh, key] of [[debris.mesh, 'debris-stone-near-v1'], [debris.ink, 'debris-ink-near-v2']] as const) {
        const material = mesh.material as THREE.Material;
        const shader = { vertexShader: 'void main(){\n#include <begin_vertex>\n#include <project_vertex>\n}', fragmentShader: '', uniforms: {} } as unknown as THREE.WebGLProgramParametersWithUniforms;
        material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
        expect(shader.vertexShader).toContain('distance( debrisCentre.xyz, cameraPosition )');
        expect(shader.vertexShader).toContain('modelMatrix * instanceMatrix * vec4( 0.0, 0.0, 0.0, 1.0 )');
        expect(material.customProgramCacheKey()).toBe(key);
        if (mesh === debris.ink) expect(shader.vertexShader.indexOf('normal * .16')).toBeLessThan(shader.vertexShader.indexOf('smoothstep'));
      }
      // Full size from a little over three metres - the fight's camera sits further out than that - and gone a metre out.
      expect(DEBRIS_NEAR[0]).toBeGreaterThanOrEqual(.8);
      expect(DEBRIS_NEAR[1]).toBeLessThanOrEqual(3.5);
    } finally { debris.dispose(); }
  });
});
