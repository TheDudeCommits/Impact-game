import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
// @ts-expect-error vendored JavaScript with no declarations (the Armory's own particle kit)
import { ParticleSystem, ParticleShape } from '../src/render/vfx/armory/vendor/particles/ParticleSystem.js';
// @ts-expect-error vendored JavaScript with no declarations (the Armory's own ground field kit)
import { GroundField, GroundMode } from '../src/render/vfx/armory/vendor/vfx/GroundField.js';
// (the Armory's own ground decal kit; its declarations leave out the pools)
import { DecalSystem, DecalType } from '../src/render/vfx/armory/vendor/effects/GroundDecals.js';
// @ts-expect-error vendored JavaScript with no declarations (the Armory's own raymarched volume kit)
import { VolumeHull, HullShape, Medium } from '../src/render/vfx/armory/vendor/vfx/VolumeHull.js';
import { HALF, LIGHT, POOL_CUT, PUFF, PUFF_LINE, PUFF_THIN, SOFT_SKIP, VOLUME, lighterCast, lighterParticles, lighterPool, lighterShader, lighterVolume } from '../src/render/vfx/armory/lighter';
// @ts-expect-error the vendored liquid kit ships no declarations (vendor/ stays as it came)
import { LiquidSurface, LiquidMode } from '../src/render/vfx/armory/vendor/vfx/LiquidSurface.js';
// (the Armory's frame uniforms: the scene depth the soft fade reads)
import { frame } from '../src/render/vfx/armory/vendor/core/FrameUniforms.js';
import { WARMING } from '../src/render/pipelineWarmup';
import { runBeforeEffects } from '../src/render/look/beforeEffects';

/** The Armory's heaviest kits drawn lighter for the game's close camera (render/vfx/armory/lighter.ts): each patch finds
 *  the vendored text it was written against, and does only what it says. */
const patched = (material: THREE.ShaderMaterial) => {
  const shader = { uniforms: { ...material.uniforms } as Record<string, unknown>, fragmentShader: material.fragmentShader, vertexShader: material.vertexShader };
  lighterShader(shader);
  return shader;
};
const balanced = (src: string) => [...src].reduce((d, c) => d + (c === '{' ? 1 : c === '}' ? -1 : 0), 0) === 0;
// (the kits' GLSL in JavaScript: smoothstep, and Ashima's simplex noise as noise.glsl.js has it)
const ss = (e0: number, e1: number, x: number) => { const u = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1); return u * u * (3 - 2 * u); };
const fl = Math.floor, mod289 = (x: number) => x - fl(x * (1 / 289)) * 289, permute = (x: number) => mod289(((x * 34) + 10) * x);
const snoise = (vx: number, vy: number, vz: number) => {
  const s0 = (vx + vy + vz) / 3; let ix = fl(vx + s0), iy = fl(vy + s0), iz = fl(vz + s0);
  const t0 = (ix + iy + iz) / 6, x0 = [vx - ix + t0, vy - iy + t0, vz - iz + t0];
  const g = [x0[1] <= x0[0] ? 1 : 0, x0[2] <= x0[1] ? 1 : 0, x0[0] <= x0[2] ? 1 : 0], l = g.map(e => 1 - e);
  const i1 = [Math.min(g[0], l[2]), Math.min(g[1], l[0]), Math.min(g[2], l[1])], i2 = [Math.max(g[0], l[2]), Math.max(g[1], l[0]), Math.max(g[2], l[1])];
  const xs = [x0, x0.map((e, k) => e - i1[k] + 1 / 6), x0.map((e, k) => e - i2[k] + 1 / 3), x0.map(e => e - .5)];
  ix = mod289(ix); iy = mod289(iy); iz = mod289(iz);
  const pz = [0, i1[2], i2[2], 1].map(o => permute(iz + o)), py = [0, i1[1], i2[1], 1].map((o, k) => permute(pz[k] + iy + o));
  const p = [0, i1[0], i2[0], 1].map((o, k) => permute(py[k] + ix + o));
  const n7 = Math.fround(0.142857142857), ns = [n7 * 2, n7 * .5 - 1, n7];
  let out = 0;
  for (let k = 0; k < 4; k++) {
    const j = p[k] - 49 * fl(p[k] * ns[2] * ns[2]), x_ = fl(j * ns[2]), y_ = fl(j - 7 * x_);
    const x = x_ * ns[0] + ns[1], y = y_ * ns[0] + ns[1], h = 1 - Math.abs(x) - Math.abs(y), sh = h <= 0 ? -1 : 0;
    let gx = x + (fl(x) * 2 + 1) * sh, gy = y + (fl(y) * 2 + 1) * sh, gz = h;
    const r = 1.79284291400159 - 0.85373472095314 * (gx * gx + gy * gy + gz * gz); gx *= r; gy *= r; gz *= r;
    const X = xs[k]; let m = Math.max(.6 - (X[0] * X[0] + X[1] * X[1] + X[2] * X[2]), 0); m *= m;
    out += m * m * (gx * X[0] + gy * X[1] + gz * X[2]);
  }
  return 42 * out;
};

describe('the particle kit, lighter', () => {
  it('knows the lifetime alpha before the shape, and drops what no shape could lift over the threshold', () => {
    const smoke = new ParticleSystem({ name: 'test.smoke', capacity: 4, shape: ParticleShape.SMOKE, additive: false });
    const s = patched(smoke.material);
    expect(s.uniforms.armoryLight).toBe(LIGHT);
    expect(s.fragmentShader.startsWith('uniform float armoryLight;')).toBe(true);
    const main = s.fragmentShader.slice(s.fragmentShader.indexOf('void main()'));
    // the fade, then the early discard, then the shape
    expect(main.indexOf('float fade =')).toBeLessThan(main.indexOf('fade * uOpacity * armoryBoost < 0.004) discard;'));
    expect(main.indexOf('fade * uOpacity * armoryBoost < 0.004) discard;')).toBeLessThan(main.indexOf('float mask = shapeMask(vUv);'));
    // what follows it is the Armory's own, untouched
    // (times a thinned system's boost: 1, so the very same number, for every other)
    expect(main).toContain('float alpha = mask * fade * uOpacity * armoryBoost;');
    expect(main).toContain('armoryBoost = armoryLight > 0.5 ? 1.0 / armoryThin : 1.0;');
    expect(balanced(s.fragmentShader)).toBe(true);
  });

  it('gives a faint puff fewer octaves, and a full one exactly fbm3\'s three', () => {
    const smoke = new ParticleSystem({ name: 'test.smoke2', capacity: 4, shape: ParticleShape.SMOKE });
    const src = patched(smoke.material).fragmentShader;
    expect(src).not.toContain('float n = fbm3(vec3(c * 1.6, vSeed * 21.0 + vClock * 0.25));');
    // fbm3: 0.5 s(p) + 0.25 s(2.02 p) + 0.125 s(2.02 * 2.02 p), the steps taken as the loop takes them
    expect(src).toContain('vec3 armoryP2 = armoryP * 2.02, armoryP3 = armoryP2 * 2.02;');
    // (each octave added in fbm3's order; between them only the exact early discard, below)
    const o1 = src.indexOf('float n = 0.5 * snoise(armoryP);'), o2 = src.indexOf('if (armoryW2 > 0.0) n += armoryW2 * 0.25 * snoise(armoryP2);'), o3 = src.indexOf('if (armoryW3 > 0.0) n += armoryW3 * 0.125 * snoise(armoryP3);');
    expect(o1).toBeGreaterThan(0);
    expect(o2).toBeGreaterThan(o1);
    expect(o3).toBeGreaterThan(o2);
    // nothing else adds to the noise in between (the two octaves' own lines do)
    expect((src.slice(o1, o3 + 80).match(/\bn \+= /g) ?? []).length).toBe(2);
    expect(src).toContain('uniform vec4 armoryPuff;\nuniform float armoryPuffCut;\nuniform float armoryPuffLine;\nuniform float armoryThin;\nfloat armoryReach = 1.0;\nfloat armoryBoost = 1.0;\n');
    expect(src.indexOf('bool armoryGone(float x) {')).toBeLessThan(src.indexOf('float shapeMask(vec2 uv) {'));
    // the early discard, before each octave still to come, only with the switch on
    expect((src.match(/if \(armoryCut && armoryGone\(d \+ n \* 0\.42 - /g) ?? []).length).toBe(2);
    expect(src).toContain('bool armoryCut = armoryLight > 0.5 && armoryPuffCut > 0.5;');
    expect(src).toContain('smoothstep(armoryPuff.z, armoryPuff.w, armoryReach)');
  });

  it('drops a faint puff\'s fragment at its alpha line before the first octave, and draws its quad only that far out', () => {
    const smoke = new ParticleSystem({ name: 'test.smoke3', capacity: 4, shape: ParticleShape.SMOKE });
    const s = patched(smoke.material);
    expect(s.uniforms.armoryPuffLine).toBe(PUFF_LINE);
    const f = s.fragmentShader;
    // the alpha line, only with the switch, the cut and the line on, before the first octave is paid for
    expect(f).toContain('smoothstep(1.0, 0.05, x) * 0.9 * armoryReach * armoryBoost < 0.004');
    const pre = f.indexOf('if (armoryCut && armoryPuffLine > 0.5 && armoryGone(d - (0.5 + armoryW2 * 0.25 + armoryW3 * 0.125) * 0.462)) return 0.0;');
    expect(pre).toBeGreaterThan(0);
    expect(pre).toBeLessThan(f.indexOf('float n = 0.5 * snoise(armoryP);'));
    const v = s.vertexShader!;
    // declared once each (the kit's vertex stage has none of them), and only for the smoke shape, unlit
    for (const u of ['armoryLight', 'armoryPuffCut', 'armoryPuffLine', 'armoryThin', 'uOpacity', 'uFadeIn', 'uFadeOut']) expect(v.match(new RegExp(`uniform float ${u};`, 'g'))?.length).toBe(1);
    expect(v).toContain('#if SHAPE == 1 && !defined(USE_LIT)');
    // after the kit's own exit for the dead, before the corner is placed; the uv scaled with the corner
    expect(v.indexOf('float armoryK = 1.0;')).toBeGreaterThan(v.indexOf('if (age < 0.0 || t > 1.0) {'));
    expect(v).toContain('vUv = 0.5 + (uv - 0.5) * armoryK;');
    expect(v).toContain('    mvPosition.xy += corner * armoryK;');
    expect(v).not.toContain('    mvPosition.xy += corner;');
    expect(balanced(v)).toBe(true);
  });

  it('cuts nothing that shows: the line inverts the mask exactly, and no sampled fragment past it clears the discards', () => {
    const gone = (x: number, reach: number) => x > 0.966 || ss(1, 0.05, x) * 0.9 * reach < 0.004;
    const line = (reach: number) => 1 - 0.95 * (0.5 - Math.sin(Math.asin(1 - 2 * (0.004 / 0.9 * Math.max(1, 1 / reach))) / 3));
    let shown = 0, near = 0;
    for (let i = 0; i < 3000; i++) {
      const reach = Math.exp(-5.4 + (i / 3000) * 5.6); // 0.0045 .. 1.2
      const q = 0.004 / 0.9 * Math.max(1, 1 / reach);
      // the inverse: the mask at the line is the line (the alpha's, or the mask's own over full opacity)
      expect(ss(1, 0.05, line(reach)) * 0.9).toBeCloseTo(q * 0.9, 6);
      const W2 = ss(PUFF.x, PUFF.y, reach), W3 = ss(PUFF.z, PUFF.w, reach), W = 0.5 + 0.25 * W2 + 0.125 * W3;
      const k = Math.min(1, line(reach) + W * 0.462 + 0.03), seed = (i * 0.618) % 1, clock = i * 0.37;
      for (let j = 0; j < 60; j++) {
        // a point of the whole quad, a third of them within 0.15 of where the line says the puff ends
        const a = j * 2.39996, r = j % 3 ? Math.sqrt(((j * 0.7548) % 1) * 2) : k - 0.03 - 0.15 * ((j * 0.5698) % 1);
        const cx = r * Math.cos(a), cy = r * Math.sin(a);
        if (Math.abs(cx) > 1 || Math.abs(cy) > 1) continue;
        const d = Math.hypot(cx, cy), P = [cx * 1.6, cy * 1.6, seed * 21 + clock * 0.25];
        const n = 0.5 * snoise(P[0], P[1], P[2]) + W2 * 0.25 * snoise(P[0] * 2.02, P[1] * 2.02, P[2] * 2.02) + W3 * 0.125 * snoise(P[0] * 4.0804, P[1] * 4.0804, P[2] * 4.0804);
        const mask = ss(1, 0.05, d + n * 0.42) * 0.9;
        if (!(mask > 0.004 && mask * reach >= 0.004)) continue;
        shown++;
        if (d > k - 0.2) near++;
        // drawn (inside the shrunk quad), and not dropped before the first octave
        expect(Math.max(Math.abs(cx), Math.abs(cy))).toBeLessThan(k);
        expect(gone(d - W * 0.462, reach)).toBe(false);
      }
    }
    expect(shown).toBeGreaterThan(20000);
    expect(near).toBeGreaterThan(500);
  });

  it('draws a thinned system\'s share of its puffs, kept by seed, each the denser for it; its octaves by the alpha it had', () => {
    const pyre = new ParticleSystem({ name: 'ext_pyre.smoke', capacity: 4, shape: ParticleShape.SMOKE });
    // the host's adapt step hands the material its system's share; another system's keeps all of its puffs
    lighterParticles(pyre.mesh, pyre.material);
    const shader = { uniforms: { ...pyre.material.uniforms } as Record<string, unknown>, fragmentShader: pyre.material.fragmentShader, vertexShader: pyre.material.vertexShader };
    lighterShader.call(pyre.material, shader);
    expect(shader.uniforms.armoryThin).toBe(PUFF_THIN['ext_pyre.smoke']);
    expect(PUFF_THIN['ext_pyre.smoke'].value).toBeGreaterThan(0);
    expect(PUFF_THIN['ext_pyre.smoke'].value).toBeLessThan(1);
    const other = new ParticleSystem({ name: 'test.thin', capacity: 4, shape: ParticleShape.SMOKE });
    lighterParticles(other.mesh, other.material);
    const s2 = { uniforms: { ...other.material.uniforms } as Record<string, unknown>, fragmentShader: other.material.fragmentShader, vertexShader: other.material.vertexShader };
    lighterShader.call(other.material, s2);
    expect((s2.uniforms.armoryThin as { value: number }).value).toBe(1);
    expect(s2.uniforms.armoryThin).not.toBe(shader.uniforms.armoryThin);
    // and none where the vertex stage is not the kit's (it could not take the share): every puff, at the alpha it had
    const s3 = { uniforms: { ...pyre.material.uniforms } as Record<string, unknown>, fragmentShader: pyre.material.fragmentShader, vertexShader: 'void main() { gl_Position = vec4(0.0); }' };
    lighterShader.call(pyre.material, s3);
    expect((s3.uniforms.armoryThin as { value: number }).value).toBe(1);
    // the vertex stage: kept or not by the puff's own seed (fixed for its life), before anything else is worked out
    const v = shader.vertexShader;
    const cull = v.indexOf('if (armoryLight > 0.5 && armoryThin < 1.0 && fract(aSeed * 97.31) >= armoryThin) {');
    expect(cull).toBeGreaterThan(v.indexOf('if (age < 0.0 || t > 1.0) {'));
    expect(cull).toBeLessThan(v.indexOf('float armoryK = 1.0;'));
    // the quad's line at the alpha drawn (boosted), its octaves' reach at the alpha it had
    expect(v).toContain('max(armoryR / armoryThin, 1e-6)');
    expect(v).toContain('smoothstep(armoryPuff.x, armoryPuff.y, armoryR)');
    // the fragment: octaves by armoryReach (fade x opacity), the line and the alpha by it x the boost
    const f = shader.fragmentShader;
    expect(f).toContain('armoryReach = armoryLight > 0.5 ? fade * uOpacity : 1.0;');
    expect(f).toContain('smoothstep(armoryPuff.x, armoryPuff.y, armoryReach)');
    expect(f).toContain('smoothstep(1.0, 0.05, x) * 0.9 * armoryReach * armoryBoost < 0.004');
    expect(f).toContain('if (armoryBoost > 1.0) alpha = min(alpha, 1.0);');
    // the seeds a system is filled with keep about its share (the kit's seeds: Math.random)
    const share = PUFF_THIN['ext_pyre.smoke'].value;
    let kept = 0; const N = 20000;
    for (let i = 0; i < N; i++) { const x = Math.random() * 97.31; if (x - Math.floor(x) < share) kept++; }
    expect(Math.abs(kept / N - share)).toBeLessThan(0.02);
  });

  it('skips the soft fade only where the scene depth is the host\'s texel of "nothing in front"', () => {
    const before = frame.uSceneDepth.value;
    try {
      const far = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
      frame.uSceneDepth.value = far as never;
      const smoke = new ParticleSystem({ name: 'test.soft1', capacity: 4, shape: ParticleShape.SMOKE });
      const s = patched(smoke.material);
      expect(s.uniforms.armorySoftSkip).toBe(SOFT_SKIP);
      const f = s.fragmentShader, main = f.slice(f.lastIndexOf('void main()'));
      expect(main).toContain('alpha *= armorySoftFade(uSceneDepth, screenUV, vViewZ, uCameraNear, uCameraFar, uSoftFade);');
      expect(main).not.toMatch(/[^y]softFade\(uSceneDepth,/);
      // the wrapper: 1 with the switch and the knob on, else the Armory's own fade
      expect(f).toContain('if (armoryLight > 0.5 && armorySoftSkip > 0.5) return 1.0;\n  return softFade(sceneDepth, screenUV, fragViewZ, near, far, fadeDist);');
      expect(f.indexOf('float armorySoftFade(')).toBeLessThan(f.lastIndexOf('void main()'));
      expect(f.indexOf('float softFade(sampler2D sceneDepth')).toBeLessThan(f.indexOf('float armorySoftFade('));
      expect(balanced(f)).toBe(true);
      // a real depth (any other texture), or none: left as the Armory has it
      frame.uSceneDepth.value = new THREE.DataTexture(new Uint8Array([10, 20, 30, 40, 255, 255, 255, 255]), 2, 1) as never;
      const s2 = patched(new ParticleSystem({ name: 'test.soft2', capacity: 4, shape: ParticleShape.SMOKE }).material);
      expect(s2.fragmentShader).not.toContain('armorySoftFade');
      expect(s2.uniforms.armorySoftSkip).toBeUndefined();
    } finally {
      frame.uSceneDepth.value = before;
    }
  });

  it('changes only the smoke shape\'s branch (every other shape is compiled without it)', () => {
    const soft = new ParticleSystem({ name: 'test.soft', capacity: 4, shape: ParticleShape.SOFT });
    const src = patched(soft.material).fragmentShader;
    expect(src).toContain('fade * uOpacity * armoryBoost < 0.004) discard;');
    const smoke = src.slice(src.indexOf('#elif SHAPE == 1'), src.indexOf('#elif SHAPE == 2'));
    expect(smoke).toContain('armoryW2');
    expect(src.replace(smoke, '')).not.toContain('armoryW2');
  });
});

describe('the ground field kit, lighter', () => {
  it('stops every mark loop at the marks there are (POCK)', () => {
    const field = new GroundField(new THREE.Group(), { mode: GroundMode.POCK, marks: 64 });
    const material = (field as unknown as { material: THREE.ShaderMaterial }).material;
    const before = (material.fragmentShader.match(/float on = step\(float\(i\), uMarkCount - 1\.0\);/g) ?? []).length;
    expect(before).toBeGreaterThan(0);
    const src = patched(material).fragmentShader;
    expect((src.match(/if \(armoryLight > 0\.5 && float\(i\) >= uMarkCount\) break;\s*float on = step\(float\(i\), uMarkCount - 1\.0\);/g) ?? []).length).toBe(before);
  });
});

describe('the ground decal kit, lighter', () => {
  type Pools = { _poolFor(type: number): { acquire(): { material: THREE.ShaderMaterial } } };
  const decal = (type: number) => (new DecalSystem(new THREE.Group() as unknown as THREE.Scene) as unknown as Pools)._poolFor(type).acquire().material;

  it('drops a crack\'s fragment beyond its spreading reach before the ridged noise, and a dust ring\'s before its fbm', () => {
    const s = patched(decal(DecalType.CRACK)), src = s.fragmentShader;
    expect(s.uniforms.armoryDecalCut).toEqual({ value: 1 });
    const crack = src.slice(src.indexOf('#elif DECAL == 2'), src.indexOf('#elif DECAL == 3'));
    expect(crack.indexOf('float radial = smoothstep(spread, spread * 0.35, d);')).toBeLessThan(crack.indexOf('radial * 0.95 * fadeOut * uIntensity < 0.004) discard;'));
    expect(crack.indexOf('radial * 0.95 * fadeOut * uIntensity < 0.004) discard;')).toBeLessThan(crack.indexOf('float branch = ridged('));
    // what follows is the Armory's own crack
    expect(crack).toContain('float crack = smoothstep(0.55 - uWidth * 0.35, 0.85, branch) * radial;');
    const dust = src.slice(src.indexOf('#elif DECAL == 4'), src.indexOf('#elif DECAL == 6'));
    expect(dust.indexOf('* 1.15 * (1.0 - uAge) * 0.7 * uIntensity < 0.004) discard;')).toBeLessThan(dust.indexOf('float n = fbm3('));
    expect(dust).toContain('float puff = smoothstep(radius, radius * 0.35, d) * (0.6 + n * 0.5);');
    expect(balanced(src)).toBe(true);
  });

  it('takes a scorch\'s noise octave by octave as fbm3 does, and drops a burn that cannot clear the discard before the rest', () => {
    const src = patched(decal(DecalType.SCORCH)).fragmentShader;
    const scorch = src.slice(src.indexOf('#if DECAL == 0'), src.indexOf('#elif DECAL == 1'));
    expect(scorch).not.toContain('fbm3(');
    // fbm3: 0.5 s(p) + 0.25 s(2.02 p) + 0.125 s(2.02 * 2.02 p)
    const o = ['float n = 0.5 * snoise(armoryQ);', 'n += 0.25 * snoise(armoryQ * 2.02);', 'n += 0.125 * snoise(armoryQ * 2.02 * 2.02);'].map(t => scorch.indexOf(t));
    expect(o[0]).toBeGreaterThan(0); expect(o[1]).toBeGreaterThan(o[0]); expect(o[2]).toBeGreaterThan(o[1]);
    expect((scorch.match(/< 0\.004\) discard;/g) ?? []).length).toBe(3);
    // the Armory's own burn and embers after it
    expect(scorch).toContain('float burn = smoothstep(1.0, 0.15, d + n * 0.45);');
    expect(scorch).toContain('float embers = pow(max(0.0, snoise(vec3(c * 6.0, uSeed * 9.0 + uTime * 0.35))), 4.0);');
    expect(balanced(src)).toBe(true);
  });
});

describe('a program that is none of the kits', () => {
  it('is left exactly as it was', () => {
    const shader = { uniforms: {}, fragmentShader: 'void main() { gl_FragColor = vec4(1.0); }' };
    lighterShader(shader);
    expect(shader.fragmentShader).toBe('void main() { gl_FragColor = vec4(1.0); }');
    expect(shader.uniforms).toEqual({});
  });
});

describe('the volume kit\'s self-shadow, lighter', () => {
  const hullShader = (medium: number) => {
    const hull = new VolumeHull({ hull: HullShape.CYLINDER, medium, prefix: 'test', maxSteps: 48 });
    return patched(hull.material as THREE.ShaderMaterial);
  };

  it('takes the shadow taps\' density at fewer octaves, and a lone tap midway, only with the switch on', () => {
    const s = hullShader(Medium.SMOKE), src = s.fragmentShader;
    expect(s.uniforms.armoryLight).toBe(LIGHT);
    expect(s.uniforms.armoryShadowCut).toEqual({ value: 0 });
    expect(s.uniforms.armoryTapShift).toEqual({ value: 0 });
    // the fbm's loop stops octaves early only while armoryOctCut is set, which only the shadow's density sets
    expect(src).toContain('if (float(i) >= max(uOctaves - armoryOctCut, 1.0)) break;');
    expect(src).toMatch(/armoryOctCut = armoryLight > 0\.5 \? armoryShadowCut : 0\.0;\s*float armoryD = mediumDensity\(lp, wp, shape, detail, event\);\s*armoryOctCut = 0\.0;/);
    expect(src).toContain('float h = uShadowLength * (0.45 + float(s) * 1.1 + (armoryLight > 0.5 ? armoryTapShift : 0.0));');
    // the march itself, the medium's own density and its shading are the Armory's
    expect(src).toContain('float d = mediumDensity(lp, wp, shape, detail, event);');
    expect((src.match(/armoryOctCut/g) ?? []).length).toBe(4);
    expect(balanced(src)).toBe(true);
  });

  it('patches a flame hull (no shadow compiled in) the same way, harmlessly', () => {
    const src = hullShader(Medium.FLAME).fragmentShader;
    expect(src).toContain('uniform float armoryShadowCut;');
  });
});

describe('the liquid kit, lighter (POOL_CUT)', () => {
  const pool = () => new LiquidSurface({ mode: LiquidMode.POOL, segments: 8 });

  it('tests the waterline first, and drops a fragment its raggedness cannot bring inside before the normal\'s four taps', () => {
    const s = patched(pool().material as THREE.ShaderMaterial), src = s.fragmentShader;
    expect(s.uniforms.armoryPoolCut).toBe(POOL_CUT);
    expect(s.uniforms.armoryLight).toBe(LIGHT);
    const cut = src.indexOf('* uOpacity < 0.004) discard;');
    expect(cut).toBeGreaterThan(src.lastIndexOf('void main()'));
    expect(cut).toBeLessThan(src.indexOf('vec3 px = liquidPoint('));
    // never with foam (foam lifts alpha outside the line), never with no soft edge to invert
    expect(src).toContain('if (armoryLight > 0.5 && armoryPoolCut > 0.5 && uFoam <= 0.001 && uEdgeSoft > 1e-3) {');
    // the kit's own waterline and alpha are where they were
    expect(src).toContain('float jag = fbm3(vec3(vParam * uEdgeScale, uSeed * 5.7)) * 0.5 + 0.5;');
    expect(src).toContain('if (alpha < 0.004) discard;');
    expect(balanced(src)).toBe(true);
  });

  it('cuts nothing that shows: sampled over pools of every shape, no fragment it drops clears the kit\'s discard', () => {
    const fbm3 = (x: number, y: number, z: number) => 0.5 * snoise(x, y, z) + 0.25 * snoise(x * 2.02, y * 2.02, z * 2.02) + 0.125 * snoise(x * 4.0804, y * 4.0804, z * 4.0804);
    let dropped = 0, shownNear = 0, least = 1;
    for (let i = 0; i < 400; i++) {
      const fill = 0.2 + 0.8 * ((i * 0.618) % 1), soft = 0.02 + 0.3 * ((i * 0.7548) % 1), e = (i * 0.5698) % 1;
      const round = (i * 0.4142) % 1, opacity = 0.02 + 0.98 * ((i * 0.3183) % 1), half = [3 + (i % 5), 2 + (i % 3)];
      const scale = 0.6 + 1.2 * ((i * 0.2718) % 1), seed = (i * 0.1732) % 1 * 10;
      for (let j = 0; j < 120; j++) {
        const px = (((j * 0.7548) % 1) * 2 - 1) * half[0], pz = (((j * 0.5698 + i * 0.13) % 1) * 2 - 1) * half[1];
        const nq = [px / half[0], pz / half[1]], r0 = (1 - round) * Math.max(Math.abs(nq[0]), Math.abs(nq[1])) + round * Math.hypot(nq[0], nq[1]);
        const jag = fbm3(px * scale, pz * scale, seed * 5.7) * 0.5 + 0.5;
        least = Math.min(least, jag);
        const r = r0 * ((1 - e) + e * (0.7 + 0.6 * jag));
        const alpha = (1 - ss(Math.max(fill - soft, 0), fill, r)) * opacity;
        const cut = (1 - ss(Math.max(fill - soft, 0), fill, r0 * (1 - 0.3 * e + 0.6 * e * 0.01875))) * opacity < 0.004;
        if (cut) { dropped++; expect(alpha).toBeLessThan(0.004); }
        else if (alpha >= 0.004 && r > fill - soft) shownNear++;
      }
    }
    expect(least).toBeGreaterThan(0.01875);
    expect(dropped).toBeGreaterThan(5000);
    expect(shownNear).toBeGreaterThan(1000);
  });
});

describe('a raymarched volume, lighter', () => {
  const was = VOLUME.on;
  beforeAll(() => { VOLUME.on = true; });
  afterAll(() => { VOLUME.on = was; });
  const volume = (size: number) => {
    const material = new THREE.ShaderMaterial({ uniforms: { uSteps: { value: 30 }, uSize: { value: new THREE.Vector3(size, size, size) } },
      fragmentShader: 'uniform float uSteps; void main() { float transmittance = 1.0; gl_FragColor = vec4(transmittance); }' });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1), material);
    mesh.updateMatrixWorld();
    lighterVolume(mesh);
    return { mesh, material };
  };
  const camera = new THREE.PerspectiveCamera(50, 16 / 9, .1, 100);
  const draw = (mesh: THREE.Mesh, at: number) => {
    camera.position.set(0, 0, at); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
    mesh.onBeforeRender({} as THREE.WebGLRenderer, new THREE.Scene(), camera, mesh.geometry, mesh.material as THREE.Material, null as unknown as THREE.Group);
  };

  it('marches half its steps while it fills the screen, and all of them once it is small', () => {
    const { mesh, material } = volume(3);
    draw(mesh, 5);
    expect(material.uniforms.uSteps.value).toBe(15);
    draw(mesh, 60);
    expect(material.uniforms.uSteps.value).toBe(30);
  });

  it('never under VOLUME.least, and follows a new count the ability writes', () => {
    const { mesh, material } = volume(3);
    material.uniforms.uSteps.value = 16; draw(mesh, 5);
    expect(material.uniforms.uSteps.value).toBe(Math.max(VOLUME.least, 8));
    material.uniforms.uSteps.value = 40; draw(mesh, 5);
    expect(material.uniforms.uSteps.value).toBe(20);
  });

  const hullOf = (medium: number, shadow: 0 | 1) => {
    const material = new THREE.ShaderMaterial({ defines: { HULL_SHAPE: 1, MEDIUM: medium, MAX_STEPS: 48, VOLUME_SHADOW: shadow }, uniforms: { uSteps: { value: 30 }, uShadowTaps: { value: shadow ? 2 : 0 }, uSize: { value: new THREE.Vector3(3, 3, 3) } },
      fragmentShader: 'uniform float uSteps; void main() { float transmittance = 1.0; gl_FragColor = vec4(transmittance); }' });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1), material);
    mesh.updateMatrixWorld();
    lighterVolume(mesh);
    return { mesh, material };
  };

  it('a VolumeHull of flame marches half its steps; spores, the void and every other medium keep theirs', () => {
    const flame = hullOf(0, 0); draw(flame.mesh, 5);
    expect(flame.material.uniforms.uSteps.value).toBe(15);
    for (const medium of [1, 3, 7]) {
      const other = hullOf(medium, medium === 1 ? 1 : 0); draw(other.mesh, 5);
      expect(other.material.uniforms.uSteps.value).toBe(30);
    }
  });

  it('an absorbing medium (built with its self-shadow) keeps its steps and gives up shadow taps and octaves instead', () => {
    const material = new THREE.ShaderMaterial({ defines: { HULL_SHAPE: 1, MEDIUM: 1, MAX_STEPS: 48, VOLUME_SHADOW: 1 }, uniforms: { uSteps: { value: 30 }, uShadowTaps: { value: 2 }, uSize: { value: new THREE.Vector3(3, 3, 3) } },
      fragmentShader: 'uniform float uSteps; void main() { float transmittance = 1.0; gl_FragColor = vec4(transmittance); }' });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1), material);
    mesh.updateMatrixWorld();
    lighterVolume(mesh);
    draw(mesh, 5);
    expect(material.uniforms.uSteps.value).toBe(30);
    expect(material.uniforms.uShadowTaps.value).toBe(VOLUME.taps);
    expect(material.uniforms.armoryShadowCut.value).toBe(VOLUME.shadowCut);
    expect(material.uniforms.armoryTapShift.value).toBe(VOLUME.tapShift);
    // small again: all of it back, and a count the ability writes is followed
    draw(mesh, 60);
    expect(material.uniforms.uShadowTaps.value).toBe(2);
    expect(material.uniforms.armoryShadowCut.value).toBe(0);
    expect(material.uniforms.armoryTapShift.value).toBe(0);
    material.uniforms.uShadowTaps.value = 1; draw(mesh, 5);
    expect(material.uniforms.uShadowTaps.value).toBe(1);
    expect(material.uniforms.armoryTapShift.value).toBe(0);
  });

  it('is left alone with the switch off, and when it is not a medium', () => {
    const { mesh, material } = volume(3);
    LIGHT.value = 0; try { draw(mesh, 5); expect(material.uniforms.uSteps.value).toBe(30); } finally { LIGHT.value = 1; }
    const other = new THREE.Mesh(new THREE.SphereGeometry(1), new THREE.ShaderMaterial({ uniforms: { uSteps: { value: 30 } }, fragmentShader: 'uniform float uSteps; void main() {}' }));
    lighterVolume(other);
    expect(Object.prototype.hasOwnProperty.call(other, 'onBeforeRender')).toBe(false);
  });
});

describe('a screen-filling volume marched at half resolution (HALF)', () => {
  const was = { volume: VOLUME.on, half: HALF.on, light: LIGHT.value };
  beforeAll(() => { VOLUME.on = true; HALF.on = true; LIGHT.value = 1; });
  afterAll(() => { VOLUME.on = was.volume; HALF.on = was.half; LIGHT.value = was.light; WARMING.value = false; });
  // (each test's volumes let go after it, as a cast's do: the frame's work marches only the volumes that live)
  const made: THREE.ShaderMaterial[] = [];
  afterEach(() => { for (const m of made.splice(0)) m.dispose(); });
  const hull = (medium: number) => {
    const h = new VolumeHull({ hull: HullShape.CYLINDER, medium, prefix: 'half', maxSteps: 40 });
    const mesh = h.mesh as THREE.Mesh, real = h.material as THREE.ShaderMaterial;
    made.push(real);
    (real.uniforms.uSize.value as THREE.Vector3).set(4, 2, 4);
    // (the kit shows its hull once it has faded in; shown here as a cast shows it)
    mesh.visible = true;
    mesh.updateMatrixWorld();
    lighterVolume(mesh);
    return { mesh, real, hull: h };
  };
  /** A renderer that records what it is asked: the frame's target 1920 x 1080, and what is drawn into what. */
  const recorder = () => {
    const frameTarget = { width: 1920, height: 1080, viewport: new THREE.Vector4(0, 0, 1920, 1080), scissorTest: false };
    // (bound as the frame's work runs: the film look's painting, a smaller target)
    const paintTarget = { width: 640, height: 360, viewport: new THREE.Vector4(0, 0, 640, 360), scissorTest: false };
    const calls: string[] = [];
    let target: unknown = frameTarget, clearAlpha = 1, sized = '';
    const renderer = {
      info: { autoReset: true }, autoClear: true,
      getRenderTarget: () => target,
      setRenderTarget: (t: { width: number; height: number }) => { target = t; calls.push(t === frameTarget ? 'into frame' : t === paintTarget ? 'into painting' : 'into half'); if (t !== frameTarget && t !== paintTarget) sized = `${t.width}x${t.height}`; },
      getCurrentViewport: (v: THREE.Vector4) => v.set(0, 0, 1920, 1080),
      getDrawingBufferSize: (v: THREE.Vector2) => v.set(1920, 1080),
      getClearAlpha: () => clearAlpha, getClearColor: (c: THREE.Color) => c.set(0x123456),
      setClearColor: (_c: unknown, a: number) => { clearAlpha = a; },
      clear: () => calls.push('clear'),
      render: (scene: THREE.Scene) => {
        const m = (scene.children[0] as THREE.Mesh).material as THREE.ShaderMaterial;
        calls.push(`draw ${m.fragmentShader.includes('armoryHalf') ? 'lay-over' : 'volume'} (autoClear ${renderer.autoClear}, reset ${renderer.info.autoReset})`);
      },
    };
    const frame = () => { target = paintTarget; runBeforeEffects(renderer as unknown as THREE.WebGLRenderer, camera, frameTarget as unknown as THREE.WebGLRenderTarget); target = frameTarget; };
    return { renderer: renderer as unknown as THREE.WebGLRenderer, calls, frame, frameTarget, sized: () => sized, alpha: () => clearAlpha };
  };
  const camera = new THREE.PerspectiveCamera(50, 16 / 9, .1, 100);
  const draw = (mesh: THREE.Mesh, at: number, renderer: THREE.WebGLRenderer, scene = new THREE.Scene()) => {
    camera.position.set(0, 1, at); camera.lookAt(0, 1, 0); camera.updateMatrixWorld();
    mesh.onBeforeRender(renderer, scene, camera, mesh.geometry, mesh.material as THREE.Material, null as unknown as THREE.Group);
  };

  it('lays a spore volume that filled the screen over the next frame, marched at half the size before the effects', () => {
    const { mesh, real } = hull(Medium.SPORE), r = recorder();
    draw(mesh, 3, r.renderer);
    expect(r.calls).toEqual([]);
    expect(mesh.material).toBe(real);
    // the next frame: marched into its own target (cleared) before the effects, the frame's target back, the renderer as it was
    r.frame();
    const layover = mesh.material as THREE.ShaderMaterial;
    expect(layover).not.toBe(real);
    // (sized from the frame's target, whatever was bound: then what was bound, back)
    expect(r.calls).toEqual(['into half', 'clear', 'draw volume (autoClear false, reset false)', 'into painting']);
    expect(r.sized()).toBe('960x540');
    expect((layover.uniforms.armoryFull.value as THREE.Vector2).toArray()).toEqual([1920, 1080]);
    expect(r.renderer.autoClear).toBe(true);
    expect(r.renderer.info.autoReset).toBe(true);
    expect(r.alpha()).toBe(1);
    // drawn as the lay-over: nothing drawn inside the frame's pass
    r.calls.length = 0;
    draw(mesh, 80, r.renderer);
    expect(r.calls).toEqual([]);
    // small now: the next frame draws it whole, and marches nothing
    r.frame();
    expect(mesh.material).toBe(real);
    expect(r.calls).toEqual([]);
  });

  it('lays over with the volume\'s own blending, depth, faces and vertex stage, reading the small target at the frame\'s pixel', () => {
    const { mesh, real } = hull(Medium.SPORE), r = recorder();
    draw(mesh, 3, r.renderer); r.frame();
    const layover = mesh.material as THREE.ShaderMaterial;
    expect(layover.fragmentShader).toContain('gl_FragColor = texture2D(armoryHalf, gl_FragCoord.xy / armoryFull);');
    expect(layover.vertexShader).toBe(real.vertexShader);
    expect(layover.uniforms.uSize).toBe(real.uniforms.uSize);
    expect(layover.uniforms.uInvModel).toBe(real.uniforms.uInvModel);
    for (const k of ['blending', 'blendEquation', 'blendSrc', 'blendDst', 'blendSrcAlpha', 'blendDstAlpha', 'depthTest', 'depthWrite', 'side', 'transparent'] as const)
      expect(layover[k]).toBe(real[k]);
    expect(layover.defines).toEqual(real.defines);
  });

  it('never for another medium, a hidden volume, a split frame, an override pass, the switch off or HALF off', () => {
    const smoke = hull(Medium.SMOKE), r = recorder();
    draw(smoke.mesh, 3, r.renderer); r.frame();
    expect(smoke.mesh.material).toBe(smoke.real);
    const spore = hull(Medium.SPORE), over = new THREE.Scene();
    over.overrideMaterial = new THREE.MeshBasicMaterial();
    draw(spore.mesh, 3, r.renderer, over);
    r.frame(); expect(spore.mesh.material).toBe(spore.real);
    draw(spore.mesh, 3, r.renderer);
    spore.mesh.visible = false; r.frame(); expect(spore.mesh.material).toBe(spore.real); spore.mesh.visible = true;
    r.frameTarget.viewport.z = 960; r.frame(); expect(spore.mesh.material).toBe(spore.real); r.frameTarget.viewport.z = 1920;
    HALF.on = false; r.frame(); expect(spore.mesh.material).toBe(spore.real); HALF.on = true;
    LIGHT.value = 0; r.frame(); expect(spore.mesh.material).toBe(spore.real); LIGHT.value = 1;
    expect(r.calls).toEqual([]);
    // and back on, it lays over again
    r.frame(); expect(spore.mesh.material).not.toBe(spore.real);
  });

  it('makes all three pipelines in a warm-up frame, small or not: the march, the lay-over and the volume drawn whole', () => {
    const { mesh, real } = hull(Medium.SPORE), r = recorder();
    draw(mesh, 80, r.renderer);
    WARMING.value = true;
    r.frame();
    expect(mesh.material).not.toBe(real);
    draw(mesh, 80, r.renderer);
    WARMING.value = false;
    expect(r.calls).toEqual(['into half', 'clear', 'draw volume (autoClear false, reset false)', 'into painting',
      'draw volume (autoClear false, reset false)', 'into frame']);
    // the frame after: small, so whole again
    r.frame();
    expect(mesh.material).toBe(real);
    expect(r.renderer.autoClear).toBe(true);
  });

  it('lays a liquid pool that fills the screen over too: its own depth drawn small with it, and written again only where it drew', () => {
    const pool = new LiquidSurface({ mode: LiquidMode.POOL, segments: 8, depthWrite: true, doubleSide: true });
    const mesh = pool.mesh as THREE.Mesh, real = pool.material as THREE.ShaderMaterial;
    made.push(real);
    mesh.visible = true;
    real.forceSinglePass = true;
    (real.uniforms.uHalf.value as THREE.Vector2).set(4.6, 4.6);
    (real.uniforms.uAnchor.value as THREE.Vector3).set(0, 0, 0);
    lighterPool(mesh);
    const r = recorder();
    draw(mesh, 6, r.renderer); r.frame();
    const layover = mesh.material as THREE.ShaderMaterial;
    expect(layover).not.toBe(real);
    expect(r.calls).toEqual(['into half', 'clear', 'draw volume (autoClear false, reset false)', 'into painting']);
    expect((layover.uniforms.armoryHalf.value as THREE.Texture)).toBeTruthy();
    expect(layover.fragmentShader).toContain('if (armoryC.a < 0.004) discard;');
    for (const k of ['depthTest', 'depthWrite', 'side', 'forceSinglePass'] as const) expect(layover[k]).toBe(real[k]);
    expect(layover.blendSrc).toBe(THREE.OneFactor);
    expect(layover.blendDst).toBe(THREE.OneMinusSrcAlphaFactor);
    expect(layover.uniforms.uHalf).toBe(real.uniforms.uHalf);
    // far off, or with HALF.pool off: drawn whole
    draw(mesh, 200, r.renderer); r.frame(); expect(mesh.material).toBe(real);
    draw(mesh, 6, r.renderer); HALF.pool = false; r.frame(); expect(mesh.material).toBe(real); HALF.pool = true;
    r.frame(); expect(mesh.material).not.toBe(real);
  });

  it('lets go of its target and lay-over with its volume', () => {
    const { mesh, real } = hull(Medium.SPORE), r = recorder();
    draw(mesh, 3, r.renderer); r.frame();
    const layover = mesh.material as THREE.ShaderMaterial;
    let freed = 0;
    layover.addEventListener('dispose', () => { freed++; });
    real.dispose();
    expect(freed).toBe(1);
    // gone from the march: the next frame's work leaves it as it is
    r.calls.length = 0; r.frame();
    expect(r.calls).toEqual([]);
  });
});

describe('a cast too heavy for the close camera, lighter (LIGHTER_SETS)', () => {
  const sets = { dusty: { dustRate: .65, dustSize: .85, missing: 2 } };
  const defaults = { dustRate: 60, dustSize: 1, burst: 70 };

  it('scales what the cast has (else the vendored value), never rounded, and leaves other keys alone', () => {
    const values = new Map<string, unknown>([['dustSize', 1.4]]);
    lighterCast('dusty', values, defaults, sets);
    expect(values.get('dustRate')).toBeCloseTo(39);
    // (a vendored size of exactly 1 is still a size: 1.4 x .85, not rounded to a whole number)
    expect(values.get('dustSize')).toBeCloseTo(1.19);
    expect(values.has('burst')).toBe(false);
    expect(values.has('missing')).toBe(false);
  });

  it('does nothing with the switch off or for another effect', () => {
    const other = new Map<string, unknown>();
    lighterCast('calm', other, defaults, sets);
    expect(other.size).toBe(0);
    const off = new Map<string, unknown>();
    LIGHT.value = 0; try { lighterCast('dusty', off, defaults, sets); } finally { LIGHT.value = 1; }
    expect(off.size).toBe(0);
  });
});
