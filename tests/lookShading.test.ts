import { describe, expect, it, vi } from 'vitest';
import * as T from 'three';
import { loadRig, base } from './rigHarness';
import { FIGHTERS } from '../src/config';
import { STAGES, type StageId } from '../src/game/stages';
import { Fighter } from '../src/render/Fighter';
import { addShaderPatch, shaderPatchKeys } from '../src/render/look/shaderPatch';
import { applyToonShading } from '../src/render/look/toonShading';
import { STAGE_LOOKS } from '../src/render/look/stageLooks';
import { lookStageMaterial } from '../src/render/look/stageMaterials';

type Shader = T.WebGLProgramParametersWithUniforms;
/** Run a material's onBeforeCompile over the real three.js sources for its type. */
function compile(material: T.Material, lib: { vertexShader: string; fragmentShader: string }) {
  const shader = { uniforms: {} as Record<string, T.IUniform>, vertexShader: lib.vertexShader, fragmentShader: lib.fragmentShader, defines: {} } as unknown as Shader;
  material.onBeforeCompile(shader, {} as T.WebGLRenderer);
  return shader;
}
const surfaces = (fighter: Fighter) => {
  const toon: T.MeshToonMaterial[] = [], ink: T.MeshToonMaterial[] = [], meshes: T.Mesh[] = [];
  fighter.group.traverse(o => {
    const mesh = o as T.Mesh; if (!mesh.isMesh) return; meshes.push(mesh);
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      if (!(m instanceof T.MeshToonMaterial)) continue;
      (m.userData.ink ? ink : toon).push(m);
    }
  });
  return { toon, ink, meshes };
};

describe('shader edits compose', () => {
  it('runs every edit in order and joins their program keys', () => {
    const material = new T.MeshToonMaterial();
    addShaderPatch(material, 'first', s => { s.fragmentShader += '\n// first'; });
    addShaderPatch(material, 'second', s => { s.fragmentShader += '\n// second'; });
    const shader = compile(material, T.ShaderLib.toon);
    expect(shader.fragmentShader.indexOf('// first')).toBeLessThan(shader.fragmentShader.indexOf('// second'));
    expect(material.customProgramCacheKey()).toBe('first|second');
    // Re-adding a key replaces that edit instead of stacking a copy.
    addShaderPatch(material, 'first', s => { s.fragmentShader += '\n// first again'; });
    const again = compile(material, T.ShaderLib.toon);
    expect(again.fragmentShader).toContain('// first again');
    expect(again.fragmentShader).not.toContain('// first\n');
    expect(shaderPatchKeys(material)).toEqual(['first', 'second']);
  });
  it('keeps an onBeforeCompile that was there before the first edit', () => {
    const material = new T.MeshToonMaterial();
    material.onBeforeCompile = s => { s.fragmentShader += '\n// legacy'; };
    material.customProgramCacheKey = () => 'legacy-v1';
    addShaderPatch(material, 'look', s => { s.fragmentShader += '\n// look'; });
    const shader = compile(material, T.ShaderLib.toon);
    expect(shader.fragmentShader).toContain('// legacy');
    expect(shader.fragmentShader).toContain('// look');
    expect(material.customProgramCacheKey()).toBe('legacy-v1|look');
  });
  it('finds every chunk the toon light model edits in this three.js', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      for (const kind of ['body', 'hair'] as const) {
        const material = new T.MeshToonMaterial();
        applyToonShading(material, kind);
        const shader = compile(material, T.ShaderLib.toon);
        expect(shader.fragmentShader).toContain('RE_Direct_Toon');
        expect(shader.fragmentShader).toContain('toonShadowTerm = ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ]');
        expect(shader.fragmentShader).toContain('toonIsKey = UNROLLED_LOOP_INDEX == 0');
        // The cool fill is the second directional light, and a silhouette
        // (time stop, impact frame) is painted after the fog.
        expect(shader.fragmentShader).toContain('toonIsFill = UNROLLED_LOOP_INDEX == 1');
        expect(shader.fragmentShader).toMatch(/#include <fog_fragment>\s*gl_FragColor\.rgb = mix\( gl_FragColor\.rgb, vec3\( lookSilhouetteEdge \* uLookSilhouetteRim \), uLookSilhouette \)/);
        expect(shader.fragmentShader).toContain('fwidth( lookGdV )');
        expect(shader.fragmentShader).not.toContain('#include <lights_toon_pars_fragment>');
        expect(shader.vertexShader).toContain('vLookHead = lookHead');
        expect((shader.defines as Record<string, string>).LOOK_HAIR !== undefined).toBe(kind === 'hair');
      }
      expect(warn).not.toHaveBeenCalled();
    } finally { warn.mockRestore(); }
  });
});

describe('fighters wear the look', () => {
  it('every stage has a look preset', () => {
    expect(Object.keys(STAGE_LOOKS).sort()).toEqual(Object.keys(STAGES).sort());
  });
  it('the Golden crown, the toon model and the ink hull all survive on Taisei', async () => {
    const f = new Fighter(base('taisei'), await loadRig(FIGHTERS.taisei.model));
    try {
      const { toon, ink, meshes } = surfaces(f);
      expect(toon.length).toBeGreaterThan(0);
      expect(ink.length).toBeGreaterThan(0);
      for (const m of toon) expect(shaderPatchKeys(m).some(k => k.startsWith('look-toon-'))).toBe(true);
      const crowned = toon.filter(m => shaderPatchKeys(m).includes('golden-crown-v2'));
      expect(crowned.length).toBeGreaterThan(0);
      const shader = compile(crowned[0], T.ShaderLib.toon);
      expect(shader.fragmentShader).toContain('uGold');
      expect(shader.fragmentShader).toContain('RE_Direct_Toon');
      expect(crowned[0].customProgramCacheKey()).toContain('golden-crown-v2|look-toon-');
      for (const m of ink) {
        // Round 4b (TARGETING): the lock's glow rides on every hull (ThreatOutline applyThreatInk), after the ink's own patch.
        // The feel pass: the smear frame rides the hull as it rides the body (look/toonShading.ts applyLimbSmear),
        // on the striking limb alone since the roster-wide motion pass (v2: the vertices' smearLimb).
        // The side's trim rides between the two (look/toonShading.ts applyTeamTrim): after the ink's own
        // colour, before the lock's glow, and nothing at all outside a ball match. (v2: the hull widens by the
        // trim's `widen`, football's bold kits.)
        expect(shaderPatchKeys(m)).toEqual(['look-ink-v2', 'look-team-trim-ink-v2', 'threat-ink-v1', 'look-limb-smear-v2']);
        const hull = compile(m, T.ShaderLib.toon);
        expect(hull.vertexShader).toContain('uThreatWiden');
        expect(hull.fragmentShader).toContain('mix( outgoingLight, uThreatColor, uThreatMix )');
        expect(hull.fragmentShader).toContain('gl_FragColor.rgb *= 1.0 - uLookSilhouette');
        // Still pushed back behind the surface, so thin cloth gets no shards.
        expect(hull.vertexShader).toContain('mvPosition.z -= 0.0350');
        expect(hull.vertexShader).toContain('uInkWidth * uInkScale');
        expect(hull.uniforms.uInkScale.value).toBeCloseTo(FIGHTERS.taisei.outlineWidth / .003);
      }
      for (const mesh of meshes) if ((mesh.material as T.Material) instanceof T.MeshToonMaterial) expect(mesh.geometry.hasAttribute('lookHead'), mesh.name).toBe(true);
    } finally { f.dispose(); }
  }, 60_000);
  it('Gummy keeps Will and the garment floor under the toon model', async () => {
    const f = new Fighter(base('gummy'), await loadRig(FIGHTERS.gummy.model));
    try {
      const { toon } = surfaces(f);
      const will = toon.filter(m => shaderPatchKeys(m).some(k => k.startsWith('gummy-will-')));
      expect(will.length).toBeGreaterThan(0);
      const shader = compile(will[0], T.ShaderLib.toon);
      expect(shader.fragmentShader).toContain('uWill');
      expect(shader.fragmentShader).toContain('float peak=max(max(diffuseColor.r');
      expect(shader.fragmentShader).toContain('RE_Direct_Toon');
    } finally { f.dispose(); }
  }, 60_000);
  it('the head weight is highest on the head', async () => {
    const f = new Fighter(base('konta'), await loadRig(FIGHTERS.konta.model));
    try {
      let head = 0, total = 0;
      f.group.traverse(o => { const mesh = o as T.SkinnedMesh; if (!mesh.isSkinnedMesh || mesh.name.endsWith('-ink')) return;
        const w = mesh.geometry.getAttribute('lookHead'); for (let i = 0; i < w.count; i++) { head += w.getX(i); total++; } });
      // A head is a minority of a body, but a real one.
      expect(head / total).toBeGreaterThan(.03);
      expect(head / total).toBeLessThan(.6);
    } finally { f.dispose(); }
  }, 60_000);
});

describe('stage materials', () => {
  it('an unlit source material becomes lit, keeping its map and alpha', () => {
    const map = new T.Texture();
    const source = new T.MeshBasicMaterial({ name: '5_ground02_1_0_0', map, color: 0xffffff, alphaTest: .3 });
    const lit = lookStageMaterial(source, 'wreckers-causeway', '5_ground02_1_0_0_0') as T.MeshStandardMaterial;
    expect(lit).toBeInstanceOf(T.MeshStandardMaterial);
    expect(lit.map).toBe(map);
    expect(lit.alphaTest).toBe(.3);
    // Baked mobile paint is toned down so the sun on top does not blow it out.
    expect(lit.color.r).toBeLessThan(.8);
    expect(lit.metalness).toBe(0);
    // Every stage surface takes the room's share of the key light (and the
    // cookie, where the look has one) through the same uniforms.
    // The feel pass: the albedo grade carries the ground's (v2); the floors round grades the floor once,
    // its own exposure and a shoulder in place of the clamp (v3).
    expect(shaderPatchKeys(lit)).toEqual(['look-albedo-v3', 'look-stage-light-v1']);
    const shader = compile(lit, T.ShaderLib.standard);
    expect(shader.fragmentShader).toContain('directLight.color *= uStageKey * lookCookie( vLookWorld )');
  });
  it('painted skies stay unlit and outside the fog', () => {
    for (const [stage, name] of [['wreckers-causeway', '5_sky_1_0_0'], ['sunfall-arena', '5_skybox_1_0_0']] as [StageId, string][]) {
      const out = lookStageMaterial(new T.MeshStandardMaterial({ name }), stage, 'Object_6') as T.MeshBasicMaterial;
      expect(out).toBeInstanceOf(T.MeshBasicMaterial);
      expect(out.fog).toBe(false);
    }
  });
});
