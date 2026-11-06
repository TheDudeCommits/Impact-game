import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { showCasters } from '../src/render/textureWarmup';
import { StageEnvironment } from '../src/render/StageEnvironment';
import { CrowFlock } from '../src/render/shop/CrowFlock';
import { EmperorEffects } from '../src/render/EmperorEffects';

/**
 * Launch day 15 (s15perf): nothing is built in the middle of a fight. scripts/night/late_sweep.mjs found, for every fighter
 * in Training, a Duel and royales of twelve, what three still made after FIGHT; these hold the load-time halves of the cures:
 * the warm draw's whole roots (the room's bodies and the place, every mesh uncut), the camera cutaway given to a place's
 * every material as it loads (it was given in the fight's first frame), and the effects that were first made at their first
 * use - Tobari's crows, the illusion's shards - made with the room instead, hidden until used.
 */
afterEach(() => vi.restoreAllMocks());

describe('the warm draw draws the whole of a body or a place', () => {
  it('uncuts every mesh under a whole root, caster or not, shows only what a caster hangs from, and puts it all back', () => {
    const scene = new THREE.Scene(), place = new THREE.Group(), body = new THREE.Group(), form = new THREE.Group();
    scene.add(place, body); body.add(form); form.visible = false;
    const floor = new THREE.Mesh(); place.add(floor);                                 // not a caster: drawn uncut, not shown
    const prop = new THREE.Mesh(); prop.castShadow = true; place.add(prop);           // a place's caster far outside the sun's box
    const hidden = new THREE.Mesh(); hidden.visible = false; place.add(hidden);       // hidden and casting nothing: stays hidden
    const limb = new THREE.Mesh(); limb.castShadow = true; limb.frustumCulled = false; body.add(limb);
    const formLimb = new THREE.Mesh(); formLimb.castShadow = true; formLimb.frustumCulled = false; form.add(formLimb);
    const warm = showCasters([], scene, [place, body]);
    expect(warm.casters).toBe(3);
    expect(form.visible).toBe(true); expect(warm.shown).toEqual([form]);
    expect([floor.frustumCulled, prop.frustumCulled, hidden.frustumCulled]).toEqual([false, false, false]);
    expect(hidden.visible).toBe(false);
    warm.restore();
    expect(form.visible).toBe(false);
    expect([floor.frustumCulled, prop.frustumCulled, hidden.frustumCulled, limb.frustumCulled, formLimb.frustumCulled]).toEqual([true, true, true, false, false]);
  });
  it('counts no caster where there is none, so a draw with nothing to link is not made', () => {
    const scene = new THREE.Scene(), root = new THREE.Group(); scene.add(root); root.add(new THREE.Mesh());
    const warm = showCasters([root], scene);
    expect(warm.casters).toBe(0); expect(warm.unculled).toEqual([]); warm.restore();
  });
});

describe('a place carries the camera cutaway on every material before the room compiles', () => {
  it('gives it to what the place loaded without it (the dressing, the ground), and hands its root over', async () => {
    const scene = new THREE.Scene(), stages = new StageEnvironment(scene), root = new THREE.Group();
    const decals = new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshStandardMaterial({ name: 'Wear decals' }));
    const shader = new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.ShaderMaterial({ name: 'sky' }));
    root.add(decals, shader); scene.add(root);
    const build = vi.spyOn(stages as unknown as { build: (id: string) => Promise<unknown> }, 'build');
    build.mockImplementation(async () => ({ root, occluders: [] }));
    await stages.preload('sunfall-arena');
    // The key the room's compile links is the one the fight draws with: FollowCamera's coverStage finds nothing left to add.
    expect(decals.material.customProgramCacheKey()).toMatch(/-player-cutaway-v3$/);
    expect((shader.material as THREE.ShaderMaterial).customProgramCacheKey()).not.toMatch(/cutaway/);
    expect(stages.root('sunfall-arena')).toBe(root);
    expect(stages.root('kuroyuki-hall')).toBeUndefined();
  });
});

describe('effects first made at their first use are made with the room', () => {
  it("Tobari's crows are hidden while there is no bird to draw, shown while there are, hidden again after", () => {
    const scene = new THREE.Scene(), flock = new CrowFlock(scene, new THREE.Color(3, .2, .2));
    const meshes = ['tobari-crows', 'tobari-crow-wings', 'tobari-crow-eyes', 'tobari-crow-feathers'].map(name => scene.getObjectByName(name) as THREE.InstancedMesh);
    expect(meshes.every(m => m && !m.visible && m.count === 0)).toBe(true);
    flock.update(0, 1 / 60);
    expect(meshes.every(m => !m.visible)).toBe(true);
    flock.burstFrom([new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 1.5, 0)], new THREE.Vector3(0, 1.2, 0), 0, 2);
    flock.update(.05, 1 / 60);
    expect(meshes[0].visible && meshes[0].count > 0).toBe(true);
    for (let t = .1; t < 4; t += 1 / 30) flock.update(t, 1 / 30);
    expect(meshes.every(m => !m.visible && m.count === 0)).toBe(true);
    flock.burstFrom([new THREE.Vector3()], new THREE.Vector3(), 4, 1); flock.update(4.05, 1 / 60); flock.reset();
    expect(meshes.every(m => !m.visible && m.count === 0)).toBe(true);
    flock.dispose();
  });
  it('a room with an Tobari has his crows and an illusion\'s shards in the scene before its compile, hidden; Shiun the shards, Levin a whirl', () => {
    const named = (scene: THREE.Scene, name: string) => { const found: THREE.Object3D[] = []; scene.traverse(o => { if (o.name === name) found.push(o); }); return found; };
    const scene = new THREE.Scene(), fx = new EmperorEffects(scene);
    expect(named(scene, 'tobari-crows')).toEqual([]); expect(named(scene, 'false-encore-shards')).toEqual([]);
    fx.load(['taisei', 'konta']);
    expect(named(scene, 'tobari-crows')).toEqual([]); expect(named(scene, 'false-encore-shards')).toEqual([]);
    fx.load(['shiun']);
    expect(named(scene, 'tobari-crows')).toEqual([]); expect(named(scene, 'false-encore-shards').length).toBe(1);
    fx.load(['tobari', 'shiun']); fx.load(['tobari']);
    expect(named(scene, 'tobari-crows').length).toBe(1); expect(named(scene, 'false-encore-shards').length).toBe(1);
    expect([...named(scene, 'tobari-crows'), ...named(scene, 'false-encore-shards')].every(o => !o.visible)).toBe(true);
    fx.load(['levin']);
    // (His two blades' ribbons.)
    expect(named(scene, 'levin-blade-trail').length).toBe(2); expect(named(scene, 'levin-blade-trail').every(o => !o.visible)).toBe(true);
    fx.reset();
    expect(named(scene, 'tobari-crows').length).toBe(1);
    fx.dispose();
    expect(named(scene, 'tobari-crows')).toEqual([]); expect(named(scene, 'false-encore-shards')).toEqual([]); expect(named(scene, 'levin-blade-trail')).toEqual([]);
  });
});
