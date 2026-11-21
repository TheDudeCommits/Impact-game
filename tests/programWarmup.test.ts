import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { compileShadowPrograms, introspectPrograms, introspectProgramsInSlices, programsLinked, type IntrospectableProgram } from '../src/render/programWarmup';

/** Launch day 10 (perf4): a program's interface (three's `getUniforms` / `getAttributes`, a synchronous question to the GPU
 *  process) is asked for every program the load compiled, while the loading screen covers the canvas, and not at each one's
 *  first draw in the fight's first seconds. */
const program = (log: string[], name: string, fail = false): IntrospectableProgram => ({
  getUniforms: () => { log.push(`${name}.uniforms`); if (fail) throw new Error('context lost'); return {}; },
  getAttributes: () => { log.push(`${name}.attributes`); return {}; },
});

describe('introspectPrograms', () => {
  it('asks every program for its uniforms and its attributes, and says how many', () => {
    const log: string[] = [];
    expect(introspectPrograms({ info: { programs: [program(log, 'a'), program(log, 'b'), program(log, 'c')] } })).toBe(3);
    expect(log).toEqual(['a.uniforms', 'a.attributes', 'b.uniforms', 'b.attributes', 'c.uniforms', 'c.attributes']);
  });

  it('goes on past a program that cannot be asked, and has nothing to do for a renderer with no program list', () => {
    const log: string[] = [];
    expect(introspectPrograms({ info: { programs: [program(log, 'a'), program(log, 'lost', true), program(log, 'c')] } })).toBe(2);
    expect(log).toContain('c.attributes');
    expect(introspectPrograms({ info: { programs: null } })).toBe(0);
    expect(introspectPrograms({ info: { programs: [] } })).toBe(0);
  });

  it('is what GameRenderer.compileScene does once the compile is in: after the await and the fence, in slices, with every program the renderer holds', () => {
    // (GameRenderer needs a WebGL context; the order is read from its source, so a refactor cannot drop the call.)
    const source = fs.readFileSync(path.resolve(__dirname, '../src/render/GameRenderer.ts'), 'utf8');
    const body = source.slice(source.indexOf('async compileScene('), source.indexOf('uploadTextures(root'));
    expect(body).toMatch(/await ready;[\s\S]*await programsLinked\(this\.renderer\);[\s\S]*await introspectProgramsInSlices\(this\.renderer\);/);
    expect(source).toMatch(/import \{[^}]*\bintrospectProgramsInSlices\b[^}]*\} from '\.\/programWarmup';/);
    // The shadow pass's programs, and for the whole scene the post chain's, are compiled inside the same bound target,
    // before the await (so the slices ask them too).
    expect(body).toMatch(/compileAsync\(root,this\.camera,this\.scene\);this\.compileShadows\(root\);if\(root===this\.scene\)this\.compilePost\(\);\}[\s\S]*await ready;/);
  });
});

/** The same questions, a few at a time, with a task's turn between, and the fence that
 *  waits for the GPU process's links where there is no KHR_parallel_shader_compile. */
describe('introspectProgramsInSlices', () => {
  it('asks every program, yields once a slice has used its budget, and skips one let go meanwhile', async () => {
    const log: string[] = [];
    const programs = [program(log, 'a'), program(log, 'b'), program(log, 'c')];
    const renderer = { info: { programs: [...programs] } };
    let turns = 0;
    // a budget of -1 ms: every program is a slice of its own; after the first, 'b' is let go
    const asked = await introspectProgramsInSlices(renderer, -1, async () => { turns++; if (turns === 1) renderer.info.programs.splice(1, 1); });
    expect(asked).toBe(2);
    expect(log).toEqual(['a.uniforms', 'a.attributes', 'c.uniforms', 'c.attributes']);
    expect(turns).toBe(2);
  });
  it('asks all in one slice when they fit its budget, and goes on past one that cannot be asked', async () => {
    const log: string[] = [];
    let turns = 0;
    const asked = await introspectProgramsInSlices({ info: { programs: [program(log, 'a'), program(log, 'lost', true), program(log, 'c')] } }, 1e9, async () => { turns++; });
    expect(asked).toBe(2);
    expect(turns).toBe(0);
    expect(await introspectProgramsInSlices({ info: { programs: null } })).toBe(0);
  });
});

describe('programsLinked', () => {
  const fake = (parallel: boolean, states: number[]) => {
    const calls: string[] = [];
    const gl = {
      SYNC_GPU_COMMANDS_COMPLETE: 0x9117, TIMEOUT_EXPIRED: 0x911b, ALREADY_SIGNALED: 0x911a, WAIT_FAILED: 0x911d,
      fenceSync: () => { calls.push('fence'); return {}; }, flush: () => calls.push('flush'),
      clientWaitSync: (_s: unknown, flags: number, timeout: number) => { calls.push(`wait ${flags} ${timeout}`); return states.shift() ?? 0x911a; },
      deleteSync: () => calls.push('delete'),
    };
    return { calls, renderer: { extensions: { has: (n: string) => parallel && n === 'KHR_parallel_shader_compile' }, getContext: () => gl } as unknown as THREE.WebGLRenderer };
  };
  it('resolves at once where three waits for the links itself (KHR_parallel_shader_compile)', async () => {
    const { calls, renderer } = fake(true, []);
    await programsLinked(renderer);
    expect(calls).toEqual([]);
  });
  it('otherwise puts a fence behind the queue and asks it, never waiting (a timeout of 0), until it is passed', async () => {
    const { calls, renderer } = fake(false, [0x911b, 0x911b, 0x911a]);
    await programsLinked(renderer);
    expect(calls).toEqual(['fence', 'flush', 'wait 0 0', 'wait 0 0', 'wait 0 0', 'delete']);
  });
  it('stops on a lost context (WAIT_FAILED)', async () => {
    const { calls, renderer } = fake(false, [0x911d]);
    await programsLinked(renderer);
    expect(calls).toEqual(['fence', 'flush', 'wait 0 0', 'delete']);
  });
});

/** Launch day 15 (s15perf): the shadow pass's depth program is chosen under the key of whichever caster made the shared depth
 *  material choose again, so every caster is compiled as the pass would draw it alone. Three's compile is faked: what it is
 *  handed is recorded as getProgram would read it. */
describe('compileShadowPrograms', () => {
  const fake = (enabled = true) => {
    const seen: { name: string; material: string; side: THREE.Side; map: boolean; alphaTest: number; skinned: boolean }[] = [];
    let lights: string[] = [], target: unknown;
    const renderer = {
      shadowMap: { enabled, type: THREE.PCFShadowMap }, localClippingEnabled: false,
      compile(scene: { traverse(v: (o: THREE.Object3D) => void): void }, _camera: THREE.Camera, targetScene: { traverseVisible(v: (o: THREE.Object3D) => void): void; isScene?: boolean }) {
        target = targetScene; lights = [];
        targetScene.traverseVisible(o => { if ((o as THREE.Light).isLight) lights.push(o.name); });
        scene.traverse(o => {
          const m = (o as THREE.Mesh).material as THREE.MeshDepthMaterial;
          seen.push({ name: o.name, material: m.type, side: m.side, map: !!m.map, alphaTest: m.alphaTest, skinned: !!(o as THREE.SkinnedMesh).isSkinnedMesh });
        });
      },
    };
    return { renderer: renderer as unknown as THREE.WebGLRenderer, seen, lights: () => lights, target: () => target };
  };
  const mesh = (name: string, material: THREE.Material, cast = true, skinned = false) => {
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3));
    const o = skinned ? new THREE.SkinnedMesh(geometry, material) : new THREE.Mesh(geometry, material);
    o.name = name; o.castShadow = cast; return o;
  };

  it('gives the keeper what the shadow map gives its own, a caster at a time, and puts each material back', () => {
    const scene = new THREE.Scene(), sun = new THREE.DirectionalLight(); sun.name = 'sun'; sun.castShadow = true; scene.add(sun);
    scene.fog = new THREE.Fog(0, 1, 2);
    const map = new THREE.Texture();
    const front = new THREE.MeshToonMaterial({ map }), double = new THREE.MeshToonMaterial({ map, side: THREE.DoubleSide }), clips = new THREE.MeshBasicMaterial({ map, alphaTest: .5 });
    const body = mesh('body', front, true, true), cloak = mesh('cloak', double, true, true), leaf = mesh('leaf', clips), floor = mesh('floor', new THREE.MeshBasicMaterial(), false);
    const hidden = new THREE.Group(); hidden.visible = false; hidden.add(mesh('form', double, true, true));   // a form: hidden, compiled all the same
    scene.add(body, cloak, leaf, floor, hidden);
    const keeper = new THREE.MeshDepthMaterial(), f = fake();
    const n = compileShadowPrograms(f.renderer, scene, scene, new THREE.PerspectiveCamera(), keeper);
    // The form is the cloak's twin in everything the key reads: compiled once.
    expect(n).toBe(3);
    expect(f.seen).toEqual([
      { name: 'body', material: 'MeshDepthMaterial', side: THREE.BackSide, map: true, alphaTest: 0, skinned: true },
      { name: 'cloak', material: 'MeshDepthMaterial', side: THREE.DoubleSide, map: true, alphaTest: 0, skinned: true },
      { name: 'leaf', material: 'MeshDepthMaterial', side: THREE.BackSide, map: true, alphaTest: .5, skinned: false },
    ]);
    expect([body.material, cloak.material, leaf.material]).toEqual([front, double, clips]);
    // Lit by the scene's lights, drawn with no scene of its own (three then uses its empty one: no fog), as the pass is.
    expect(f.lights()).toEqual(['sun']);
    expect((f.target() as { isScene?: boolean }).isScene).toBeUndefined();
  });

  it("compiles a caster's own depth material where it has one, and nothing with shadows off", () => {
    const scene = new THREE.Scene(), own = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), body = mesh('body', new THREE.MeshToonMaterial(), true, true);
    body.customDepthMaterial = own; scene.add(body);
    const f = fake();
    expect(compileShadowPrograms(f.renderer, scene, scene, new THREE.PerspectiveCamera(), new THREE.MeshDepthMaterial())).toBe(1);
    expect(f.seen[0]).toMatchObject({ name: 'body', side: THREE.BackSide });
    expect(own.side).toBe(THREE.BackSide);
    const off = fake(false);
    expect(compileShadowPrograms(off.renderer, scene, scene, new THREE.PerspectiveCamera(), new THREE.MeshDepthMaterial())).toBe(0);
    expect(off.seen).toEqual([]);
  });
});
