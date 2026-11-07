import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ARMORY_MANIFEST } from '../src/render/vfx/armory/vendor/manifest';
import { ArmoryHost } from '../src/render/vfx/armory/host';
import { ArmoryEffectType } from '../src/render/vfx/armory/effect';

/** A renderer that only keeps count: what was drawn (each material once) and into what. */
function counting() {
  const drawn = new Set<THREE.Material>(), targets = new Set<THREE.WebGLRenderTarget>();
  let target: THREE.WebGLRenderTarget | null = null;
  const renderer = {
    autoClear: true, xr: { enabled: false },
    getRenderTarget: () => target, getActiveCubeFace: () => 0, getActiveMipmapLevel: () => 0,
    setRenderTarget: (t: THREE.WebGLRenderTarget | null) => { target = t; if (t) targets.add(t); },
    render: (object: THREE.Object3D) => { object.traverse(o => { const m = (o as THREE.Mesh).material as THREE.Material | undefined; if (m) drawn.add(m); }); },
  };
  return { renderer: renderer as unknown as THREE.WebGLRenderer, drawn, targets, current: () => target };
}

describe('an Armory effect that simulates off screen is linked at load (docs/engine/VFX_BAR.md: 0 late programs)', () => {
  it('the Volumetric Inferno (Bellows\'s area look) runs one step of its simulation for the warm cast and lets its targets go', async () => {
    const scene = new THREE.Scene(), host = ArmoryHost.for(scene);
    try {
      const type = new ArmoryEffectType(host, 'found_volumefire', await ARMORY_MANIFEST.found_volumefire.load(), 2);
      type.prewarm(scene);
      const c = counting(), let_go = new Set<THREE.WebGLRenderTarget>();
      // Nothing of it was drawn by the prewarm: its passes belong to no scene, which is why a compile never saw them.
      expect(c.drawn.size).toBe(0);
      const before = c.renderer.autoClear;
      expect(type.warmPasses(c.renderer)).toBe(true);
      // Its seven programs' materials (clear, curl, advect, divergence, pressure, project, dye), drawn once each...
      expect(c.drawn.size).toBeGreaterThanOrEqual(7);
      for (const material of c.drawn) expect((material as THREE.ShaderMaterial).isShaderMaterial).toBe(true);
      // ...the renderer handed back as it was, and a second call as harmless as the first.
      expect(c.current()).toBeNull(); expect(c.renderer.autoClear).toBe(before);
      for (const target of c.targets) target.addEventListener('dispose', () => let_go.add(target));
      expect(type.warmPasses(c.renderer)).toBe(true);
      expect(let_go.size).toBe(c.targets.size);
      type.dispose();
    } finally { host.dispose(); }
  });

  it('an effect with nothing of the kind is left alone', async () => {
    const scene = new THREE.Scene(), host = ArmoryHost.for(scene);
    try {
      const type = new ArmoryEffectType(host, 'blade_quake', await ARMORY_MANIFEST.blade_quake.load(), 2);
      type.prewarm(scene);
      const c = counting();
      expect(type.warmPasses(c.renderer)).toBe(false);
      expect(c.drawn.size).toBe(0);
      type.dispose();
    } finally { host.dispose(); }
  });
});

describe('an Armory effect\'s dry run at load (effect.ts `dryRun`)', () => {
  it('plays on the Armory\'s clock: an effect that steps once a frame, by the frame\'s time, is stepped on every step', async () => {
    // The fxlib pack's three-nebula rigs (NebulaKit `tick`) step when the frame's time has moved. On a clock held at 0 a
    // meteor shower's dry run dropped no meteor, so the scorch and shock rings they leave were first built - two
    // programs, 62 ms - on Pyroclast's first G. (The pack itself needs a page for its sprites; this stands in for it.)
    const { Ability } = await import('../src/render/vfx/armory/vendor/abilities/Ability.js');
    const { frame } = await import('../src/render/vfx/armory/vendor/core/FrameUniforms.js');
    const seen: number[] = [];
    let steps = 0;
    class ByTheFrame extends (Ability as unknown as new (id: string, ctx: unknown) => { update(dt: number): void }) {
      private last = Number.NaN;
      constructor(ctx: unknown) { super('blade_quake', ctx); }
      update(dt: number) { super.update(dt); const t = (frame as { uTime: { value: number } }).uTime.value; seen.push(t); if (t !== this.last) { this.last = t; steps++; } }
    }
    const scene = new THREE.Scene(), host = ArmoryHost.for(scene);
    try {
      const type = new ArmoryEffectType(host, 'blade_quake', ByTheFrame as never, 1);
      type.prewarm(scene);
      expect(seen.length).toBeGreaterThan(20);
      // Every step of every cast (the pooled one, whole; the warm one, to where it is left standing) saw a new time.
      expect(steps).toBe(seen.length);
      // A cast starts its clock at 0: the first step is one step in.
      expect(Math.min(...seen)).toBeCloseTo(1 / 20, 5);
      type.dispose();
    } finally { host.dispose(); }
  });

  it('hands the warm draw its warm cast, and its first pooled instance once that has been cast whole in hiding', async () => {
    const scene = new THREE.Scene(), host = ArmoryHost.for(scene);
    try {
      const type = new ArmoryEffectType(host, 'blade_quake', await ARMORY_MANIFEST.blade_quake.load(), 3);
      expect(type.warmSpaces()).toEqual([]);
      // Built for a room's area look (fxStage.ts): quick, then one instance dry run by the room's warm-up.
      type.prewarm(scene, true);
      expect(type.warmSpaces().map(o => o.name)).toEqual(['armory-space:blade_quake#warm']);
      type.dryRun(1);
      expect(type.warmSpaces().map(o => o.name)).toEqual(['armory-space:blade_quake#warm', 'armory-space:blade_quake#0']);
      // Each is a space of this host's, hidden between casts: what the draw shows and hides again.
      for (const root of type.warmSpaces()) { expect(root.parent).toBe(host.root); expect(root.visible).toBe(false); }
      type.dispose();
      expect(type.warmSpaces()).toEqual([]);
    } finally { host.dispose(); }
  });
});

describe('an Armory effect that draws its particles from a sprite atlas (effect.ts `warmAtlases`)', () => {
  it('packs the atlas once its images are in and hands both of its textures to the GPU, at load', async () => {
    // The fxlib pack's three-nebula rigs (a page's business: their sprites are images), stood in for by an ability with a
    // rig whose atlas waits on its image, as GPURenderer's TextureAtlas does.
    const { Ability } = await import('../src/render/vfx/armory/vendor/abilities/Ability.js');
    const image = { loaded: false };
    const made: { needsUpdate: boolean; packs: number; atlasTexture: THREE.Texture; atlasIndex: THREE.Texture; update(): void }[] = [];
    class WithRig extends (Ability as unknown as new (id: string, ctx: unknown) => object) {
      rigs: unknown[];
      constructor(ctx: unknown) {
        super('blade_quake', ctx);
        const atlas = { needsUpdate: true, packs: 0, atlasTexture: new THREE.Texture(), atlasIndex: new THREE.DataTexture(new Float32Array(4), 1, 1),
          update() { if (!this.needsUpdate || !image.loaded) return; this.needsUpdate = false; this.packs++; this.atlasTexture = new THREE.Texture({ width: 32, height: 32 } as never); } };
        made.push(atlas);
        this.rigs = [{ points: { textureAtlas: atlas } }, { points: null }];
      }
    }
    const scene = new THREE.Scene(), host = ArmoryHost.for(scene);
    try {
      const type = new ArmoryEffectType(host, 'blade_quake', WithRig as never, 2);
      type.prewarm(scene, true);
      const uploaded: THREE.Texture[] = [];
      const renderer = { initTexture: (texture: THREE.Texture) => { uploaded.push(texture); } } as unknown as THREE.WebGLRenderer;
      // Its image still out: nothing is packed, nothing uploaded, and the three atlases are reported waiting (the load
      // asks again; one never packed is left for its first cast, as before).
      expect(type.warmAtlases(renderer)).toBe(3);
      expect(uploaded).toEqual([]);
      image.loaded = true;
      expect(type.warmAtlases(renderer)).toBe(0);
      // Every instance's rig (the warm cast's and the pool's two): the packed atlas and its index, each once.
      expect(made.length).toBe(3);
      for (const atlas of made) { expect(atlas.packs).toBe(1); expect(uploaded).toContain(atlas.atlasTexture); expect(uploaded).toContain(atlas.atlasIndex); }
      expect(uploaded.length).toBe(6);
      // Packed already: a second call does nothing.
      expect(type.warmAtlases(renderer)).toBe(0);
      expect(uploaded.length).toBe(6);
      type.dispose();
    } finally { host.dispose(); }
  });

  it('an effect with no rig is left alone', async () => {
    const scene = new THREE.Scene(), host = ArmoryHost.for(scene);
    try {
      const type = new ArmoryEffectType(host, 'blade_quake', await ARMORY_MANIFEST.blade_quake.load(), 2);
      type.prewarm(scene, true);
      expect(type.warmAtlases({ initTexture() { throw new Error('nothing to upload'); } } as unknown as THREE.WebGLRenderer)).toBe(0);
      type.dispose();
    } finally { host.dispose(); }
  });
});
