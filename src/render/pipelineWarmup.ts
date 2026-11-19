import * as THREE from 'three';

/**
 * What a pipeline warm-up frame shows (GameRenderer.warmPipelines).
 *
 * On ANGLE's Metal (Chrome and Edge on a Mac) the GPU pipeline a draw needs is made the first time that program draws,
 * with that material's blending, into a target of that kind (its colour and depth formats, its samples) - not when the
 * program is linked. With nothing in macOS's shader cache for it (every shader the first time after a release changes
 * it) each was 10-300 ms of the GPU process, and the fight paid for them as it met them. The room's compile links the
 * programs and the warm draw draws its shadow casters into a 16-pixel target; neither draws an effect's pool into the
 * frame's own targets, and the frame's own draw leaves every empty pool off its lists (emptyInstances.ts).
 *
 * `exposeForWarm` makes everything under `roots` drawable for one frame: every hidden object shown, every drawable
 * uncut by the lens, an empty instanced mesh given one instance (an InstancedMesh's `count`, an instanced geometry's
 * `instanceCount`, a draw range of none), a material marked invisible shown, a place's few casters casting (they cast
 * only once their stage is shown, as the fight starts: look/placeShadows.ts - and an alpha-tested one's depth program
 * was linked in the fight's first shadow pass, 2 s with a cold cache), and every drawable's `onBeforeRender` and
 * `onAfterRender` kept from throwing (a pool's callback may expect a cast that is not there; a throw would end the
 * frame's draw half done). `restore` puts all of it back exactly. Nothing else is touched: the matrices, the layers
 * (what the camera never looks at stays unlooked at), the materials and the buffers are as they were.
 */
export interface Exposed {
  /** How many drawables were made drawable or were already. */
  readonly count: number;
  restore(): void;
}

type Drawable = THREE.Mesh | THREE.Points | THREE.Line | THREE.Sprite;
const drawable = (o: THREE.Object3D): o is Drawable =>
  (o as THREE.Mesh).isMesh === true || (o as THREE.Points).isPoints === true || (o as THREE.Line).isLine === true || (o as THREE.Sprite).isSprite === true;

export function exposeForWarm(roots: readonly THREE.Object3D[], scene: THREE.Object3D): Exposed {
  const shown: THREE.Object3D[] = [], unculled: THREE.Object3D[] = [], counted: THREE.InstancedMesh[] = [];
  const instanced: THREE.InstancedBufferGeometry[] = [], ranged: THREE.BufferGeometry[] = [], seen = new Set<THREE.BufferGeometry>();
  const materials: THREE.Material[] = [];
  const guarded: { o: THREE.Object3D; before: THREE.Object3D['onBeforeRender']; after: THREE.Object3D['onAfterRender']; ownBefore: boolean; ownAfter: boolean }[] = [];
  const quiet = new Set<THREE.Material>(), casting: THREE.Object3D[] = [];
  let count = 0;
  for (const root of roots) {
    // The root's own hidden holders up to the scene, then everything under it.
    for (let p = root.parent; p && p !== scene; p = p.parent) if (!p.visible) { p.visible = true; shown.push(p); }
    root.traverse(o => {
      if (!o.visible) { o.visible = true; shown.push(o); }
      if (!drawable(o)) return;
      count++;
      if (o.frustumCulled) { o.frustumCulled = false; unculled.push(o); }
      if (o.userData?.placeCaster && !o.castShadow) { o.castShadow = true; casting.push(o); }
      const mesh = o as THREE.InstancedMesh;
      if (mesh.isInstancedMesh && mesh.count === 0) { mesh.count = 1; counted.push(mesh); }
      const geometry = (o as THREE.Mesh).geometry as THREE.BufferGeometry | undefined;
      if (geometry && !seen.has(geometry)) {
        seen.add(geometry);
        const ig = geometry as THREE.InstancedBufferGeometry;
        if (ig.isInstancedBufferGeometry && ig.instanceCount === 0) { ig.instanceCount = 1; instanced.push(ig); }
        if (geometry.drawRange.count === 0) { geometry.drawRange.count = Infinity; ranged.push(geometry); }
      }
      for (const m of ([] as (THREE.Material | undefined)[]).concat((o as THREE.Mesh).material)) {
        if (m && !m.visible && !quiet.has(m)) { m.visible = true; quiet.add(m); materials.push(m); }
      }
      const before = o.onBeforeRender, after = o.onAfterRender, own = (k: string) => Object.prototype.hasOwnProperty.call(o, k);
      guarded.push({ o, before, after, ownBefore: own('onBeforeRender'), ownAfter: own('onAfterRender') });
      o.onBeforeRender = function (...args: Parameters<THREE.Object3D['onBeforeRender']>) { try { before.apply(this, args); } catch { /* a pool's callback without its cast */ } };
      o.onAfterRender = function (...args: Parameters<THREE.Object3D['onAfterRender']>) { try { after.apply(this, args); } catch { /* as above */ } };
    });
  }
  return {
    count,
    restore() {
      // (A callback the object had of its own goes back; one it inherited is inherited again.)
      for (const g of guarded) {
        if (g.ownBefore) g.o.onBeforeRender = g.before; else delete (g.o as Partial<THREE.Object3D>).onBeforeRender;
        if (g.ownAfter) g.o.onAfterRender = g.after; else delete (g.o as Partial<THREE.Object3D>).onAfterRender;
      }
      for (const m of materials) m.visible = false;
      for (const o of casting) o.castShadow = false;
      for (const g of ranged) g.drawRange.count = 0;
      for (const g of instanced) g.instanceCount = 0;
      for (const m of counted) m.count = 0;
      for (const o of unculled) o.frustumCulled = true;
      for (const o of shown) o.visible = false;
    },
  };
}
