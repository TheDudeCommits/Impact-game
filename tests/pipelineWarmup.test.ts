import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as THREE from 'three';
import { exposeForWarm } from '../src/render/pipelineWarmup';

/** The pipeline warm-up (GameRenderer.warmPipelines): every drawable under the
 *  roots drawable for one frame, and everything put back exactly afterwards. */
describe('a pipeline warm-up frame', () => {
  const scene = () => {
    const s = new THREE.Scene(), pool = new THREE.Group(), inner = new THREE.Group();
    s.add(pool); pool.add(inner);
    return { s, pool, inner };
  };

  it('shows what is hidden, uncut, gives empty pools an instance and shows a hidden material', () => {
    const { s, pool, inner } = scene();
    pool.visible = false; inner.visible = false;
    const quad = new THREE.PlaneGeometry(1, 1);
    const hidden = new THREE.Mesh(quad, new THREE.MeshBasicMaterial()); hidden.visible = false; inner.add(hidden);
    const empty = new THREE.InstancedMesh(quad, new THREE.MeshBasicMaterial(), 8); empty.count = 0; inner.add(empty);
    const ig = new THREE.InstancedBufferGeometry().copy(quad as unknown as THREE.InstancedBufferGeometry); ig.instanceCount = 0;
    const particles = new THREE.Mesh(ig, new THREE.ShaderMaterial()); inner.add(particles);
    const ranged = new THREE.BufferGeometry().copy(quad); ranged.setDrawRange(0, 0);
    const line = new THREE.Line(ranged, new THREE.LineBasicMaterial()); inner.add(line);
    const quiet = new THREE.MeshBasicMaterial(); quiet.visible = false;
    const muted = new THREE.Mesh(quad, quiet); inner.add(muted);
    // a place's caster, which casts only once its stage is shown (look/placeShadows.ts)
    const flag = new THREE.Mesh(quad, new THREE.MeshBasicMaterial({ alphaTest: .5 })); flag.userData.placeCaster = true; flag.castShadow = false; inner.add(flag);
    const shown = exposeForWarm([pool], s);
    expect(shown.count).toBe(6);
    expect(flag.castShadow).toBe(true);
    expect([pool.visible, inner.visible, hidden.visible]).toEqual([true, true, true]);
    expect([hidden, empty, particles, line, muted].every(o => !o.frustumCulled)).toBe(true);
    expect(empty.count).toBe(1); expect(ig.instanceCount).toBe(1); expect(ranged.drawRange.count).toBe(Infinity); expect(quiet.visible).toBe(true);
    shown.restore();
    expect([pool.visible, inner.visible, hidden.visible]).toEqual([false, false, false]);
    expect([hidden, empty, particles, line, muted].every(o => o.frustumCulled)).toBe(true);
    expect(empty.count).toBe(0); expect(ig.instanceCount).toBe(0); expect(ranged.drawRange.count).toBe(0); expect(quiet.visible).toBe(false);
    expect(flag.castShadow).toBe(false);
  });

  it('keeps a pool\'s callbacks from ending the frame, and puts them back as they were', () => {
    const { s, pool } = scene();
    const own = new THREE.Mesh(), plain = new THREE.Mesh();
    const before = () => { throw new Error('no cast'); }, after = () => { throw new Error('no cast'); };
    own.onBeforeRender = before; own.onAfterRender = after; pool.add(own, plain);
    const shown = exposeForWarm([pool], s);
    const args = [null, null, null, null, null, null] as unknown as Parameters<THREE.Object3D['onBeforeRender']>;
    expect(() => own.onBeforeRender(...args)).not.toThrow();
    expect(() => own.onAfterRender(...args)).not.toThrow();
    shown.restore();
    expect(own.onBeforeRender).toBe(before); expect(own.onAfterRender).toBe(after);
    // (An inherited callback is inherited again: the empty-instances hold reads a mesh as plain by these.)
    expect(Object.prototype.hasOwnProperty.call(plain, 'onBeforeRender')).toBe(false);
    expect(plain.onBeforeRender).toBe(THREE.Object3D.prototype.onBeforeRender);
    expect(plain.onAfterRender).toBe(THREE.Object3D.prototype.onAfterRender);
  });

  it('shows the hidden holders above a root, and leaves alone what was already drawable', () => {
    const { s, pool, inner } = scene();
    pool.visible = false;
    const drawn = new THREE.Mesh(); drawn.frustumCulled = false; inner.add(drawn);
    const shown = exposeForWarm([inner], s);
    expect(pool.visible).toBe(true);
    shown.restore();
    expect([pool.visible, inner.visible, drawn.visible, drawn.frustumCulled]).toEqual([false, true, true, false]);
  });

  it('is drawn at the load through the frame\'s own passes, and in a fight through the scene\'s pass alone', () => {
    const renderer = fs.readFileSync(new URL('../src/render/GameRenderer.ts', import.meta.url), 'utf8');
    expect(renderer).toMatch(/async warmPipelines\([^]*?exposeForWarm\([^]*?if\(onScreen\)this\.composer\.render\(0\);\s*else this\.scenePass\.render\(/);
    const main = fs.readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
    expect(main).toMatch(/stamp\('effekseer'\);[^]*?await view\.warmPipelines\(current\);stamp\('pipelines'\);/);
    expect(main).toMatch(/async function prepareSwap[^]*?await view\.warmPipelines\(\(\)=>started,false\);/);
  });
});
