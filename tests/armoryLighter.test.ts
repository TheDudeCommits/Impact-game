import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
// @ts-expect-error vendored JavaScript with no declarations (the Armory's own particle kit)
import { ParticleSystem, ParticleShape } from '../src/render/vfx/armory/vendor/particles/ParticleSystem.js';
// @ts-expect-error vendored JavaScript with no declarations (the Armory's own ground field kit)
import { GroundField, GroundMode } from '../src/render/vfx/armory/vendor/vfx/GroundField.js';
// (the Armory's own ground decal kit; its declarations leave out the pools)
import { DecalSystem, DecalType } from '../src/render/vfx/armory/vendor/effects/GroundDecals.js';
// @ts-expect-error vendored JavaScript with no declarations (the Armory's own raymarched volume kit)
import { VolumeHull, HullShape, Medium } from '../src/render/vfx/armory/vendor/vfx/VolumeHull.js';
import { LIGHT, VOLUME, lighterCast, lighterShader, lighterVolume } from '../src/render/vfx/armory/lighter';

/** The Armory's heaviest kits drawn lighter for the game's close camera (render/vfx/armory/lighter.ts): each patch finds
 *  the vendored text it was written against, and does only what it says. */
const patched = (material: THREE.ShaderMaterial) => {
  const shader = { uniforms: { ...material.uniforms } as Record<string, unknown>, fragmentShader: material.fragmentShader, vertexShader: material.vertexShader };
  lighterShader(shader);
  return shader;
};
const balanced = (src: string) => [...src].reduce((d, c) => d + (c === '{' ? 1 : c === '}' ? -1 : 0), 0) === 0;

describe('the particle kit, lighter', () => {
  it('knows the lifetime alpha before the shape, and drops what no shape could lift over the threshold', () => {
    const smoke = new ParticleSystem({ name: 'test.smoke', capacity: 4, shape: ParticleShape.SMOKE, additive: false });
    const s = patched(smoke.material);
    expect(s.uniforms.armoryLight).toBe(LIGHT);
    expect(s.fragmentShader.startsWith('uniform float armoryLight;')).toBe(true);
    const main = s.fragmentShader.slice(s.fragmentShader.indexOf('void main()'));
    // the fade, then the early discard, then the shape
    expect(main.indexOf('float fade =')).toBeLessThan(main.indexOf('fade * uOpacity < 0.004) discard;'));
    expect(main.indexOf('fade * uOpacity < 0.004) discard;')).toBeLessThan(main.indexOf('float mask = shapeMask(vUv);'));
    // what follows it is the Armory's own, untouched
    expect(main).toContain('float alpha = mask * fade * uOpacity;');
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
    expect(src).toContain('uniform vec4 armoryPuff;\nuniform float armoryPuffCut;\nfloat armoryReach = 1.0;\nfloat shapeMask(vec2 uv) {');
    // the early discard, before each octave still to come, only with the switch on
    expect((src.match(/if \(armoryCut && d \+ n \* 0\.42 - /g) ?? []).length).toBe(2);
    expect(src).toContain('bool armoryCut = armoryLight > 0.5 && armoryPuffCut > 0.5;');
    expect(src).toContain('smoothstep(armoryPuff.z, armoryPuff.w, armoryReach)');
  });

  it('changes only the smoke shape\'s branch (every other shape is compiled without it)', () => {
    const soft = new ParticleSystem({ name: 'test.soft', capacity: 4, shape: ParticleShape.SOFT });
    const src = patched(soft.material).fragmentShader;
    expect(src).toContain('fade * uOpacity < 0.004) discard;');
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
