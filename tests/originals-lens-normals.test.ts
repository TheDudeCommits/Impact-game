import fs from 'node:fs';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { LENS_NORMAL_GLSL, lensFacingNormals, lensNormalPatch } from '../src/originals/lensNormals';

describe('a cloth fold is shaded as cloth (polish4)', () => {
  it('is Ampere\'s alone', () => {
    expect(lensFacingNormals('ampere')).toBe(true);
    for (const id of ['gummy', 'konta', 'kenzo', 'taisei', 'amagoi']) expect(lensFacingNormals(id)).toBe(false);
  });
  it('edits the toon shader after its normal is made, once', () => {
    const shader = { fragmentShader: THREE.ShaderLib.toon.fragmentShader, vertexShader: '', uniforms: {} } as unknown as THREE.WebGLProgramParametersWithUniforms;
    lensNormalPatch(shader);
    const at = shader.fragmentShader.indexOf(LENS_NORMAL_GLSL);
    expect(at).toBeGreaterThan(shader.fragmentShader.indexOf('#include <normal_fragment_maps>'));
    expect(at).toBeLessThan(shader.fragmentShader.indexOf('#include <lights_fragment_begin>'));
    expect(shader.fragmentShader.split(LENS_NORMAL_GLSL).length).toBe(2);
  });
  it('turns a normal that faces away from the lens to face it, and leaves one that faces it', () => {
    const v = new THREE.Vector3(0, 0, 1), mirror = (n: THREE.Vector3) => { const d = n.dot(v); return d < 0 ? n.clone().addScaledVector(v, -2 * d) : n.clone(); };
    const away = new THREE.Vector3(.3, .2, -.93).normalize(), toward = new THREE.Vector3(.3, .2, .93).normalize(), edge = new THREE.Vector3(1, 0, -.02).normalize();
    expect(mirror(away).dot(v)).toBeCloseTo(-away.dot(v), 6);
    expect(mirror(toward).toArray()).toEqual(toward.toArray());
    expect(mirror(edge).dot(v)).toBeLessThan(.03);
  });
  it('is hooked where a fighter\'s toon material is made', () => {
    const src = fs.readFileSync('src/render/Fighter.ts', 'utf8');
    expect(src).toMatch(/applyToonShading\(mat,toonKind\(mesh\.name,material\.name\)\);\n\s+if\(lensFacingNormals\(state\.fighter\)\)addShaderPatch\(mat,'lens-normal-v1',lensNormalPatch\);/);
  });
});
