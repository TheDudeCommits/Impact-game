import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptSimplifier } from 'three/examples/jsm/libs/meshopt_simplifier.module.js';
import type { RiftProp, RiftStageId } from '../../game/riftLayouts';
import { riftPlaceDress } from '../../originals/places/riftPlaces';

export interface PropModel {
  /** Base on y 0, centred on x and z, in the model's metres. */
  geometry: THREE.BufferGeometry;
  /** The same, with a third of the triangles: for what stands beyond the field (a town of houses, a ring of wall). */
  far: THREE.BufferGeometry;
  texture: THREE.Texture;
  size: THREE.Vector3;
}

/** What a model is fitted to: a footprint `w` by `d` (turned to lie its long
 *  side along `w`, scaled evenly to fit), a height `h` (evenly), or all three -
 *  a whole box, filled (a stretch of wall). */
export interface Fit { w?: number; d?: number; h?: number }
/** How a prop wears a model: which, fitted to what, sunk how far, leaning how. */
export interface Dress extends Fit { id: string; sink?: number; tilt?: readonly [number, number] }

const IDS = ['house-a', 'house-b', 'ruin', 'watch-tower', 'cart', 'sword', 'grave', 'giant-sword', 'dead-tree',
  'fortress-tower', 'knight-statue', 'brazier', 'cage', 'stake-body', 'altar', 'curtain-wall', 'fortress-keep', 'rock-spire', 'boulder',
  // The landmarks (scripts/survival/landmarks/build_landmarks.py: modelled in code for the page, painted in flat tones).
  'great-wave', 'wreck', 'lighthouse'] as const;
const url = (id: string) => `/assets/survival/motion/prop-${id}.glb`;

/** What a prop of a place wears, if it wears a model. */
export function dressFor(stage: RiftStageId, p: RiftProp): Dress | undefined {
  { const own = riftPlaceDress(stage, p); if (own !== 'main') return own; }
  const r = p.seed, footprint = { w: p.w, d: p.d };
  switch (p.kind) {
    case 'house': return { id: r > .55 ? 'house-b' : 'house-a', ...footprint };
    case 'ruin': return { id: 'ruin', ...footprint };
    // (The village's is a watchtower, fitted by riftPlaceDress.)
    case 'tower': return { id: stage === 'rift-village' ? 'watch-tower' : 'fortress-tower', ...footprint };
    case 'cart': return { id: 'cart', ...footprint };
    // Driven in point first, and leaning as the code-built ones did.
    case 'sword': return { id: 'sword', h: p.h + .3, sink: .3, tilt: [(r - .5) * .7, (r - .5) * .4] };
    case 'grave': return { id: 'grave', h: p.h, tilt: [(r - .5) * .3, (r - .5) * .25] };
    case 'statue': return stage === 'rift-swords' ? { id: 'giant-sword', h: p.h + 1.5 } : { id: 'knight-statue', h: p.h };
    case 'tree': return { id: 'dead-tree', h: p.h };
    // A stretch of wall fills its collision's whole box.
    case 'wall': return { id: 'curtain-wall', w: p.w, d: p.d, h: p.h + 1 };
    case 'brazier': return { id: 'brazier', h: 1.6 };
    case 'cage': return { id: 'cage', ...footprint };
    // The sacrificed: a body on every stake, taller than the stake's own
    // collision (a man's height of body on a stake of two and a half metres).
    case 'stake': return { id: 'stake-body', h: Math.max(4.6, p.h + 1.8) };
    case 'stone': return stage === 'rift-eclipse' ? { id: 'stake-body', h: p.h + 2.2 } : undefined;
    case 'altar': return { id: 'altar', ...footprint };
    case 'rock': return { id: 'boulder', w: p.w, d: p.d, h: p.h };
    default: return undefined;
  }
}

const models = new Map<string, PropModel>();
let loading: Promise<void> | undefined;
let settled = false;

/** Every prop model, loaded once (a failed one is left out: its props stay code-built). */
export function loadPropModels(): Promise<void> {
  // (?noprops: the code-built places, to measure against.)
  const wanted = typeof location === 'object' && new URLSearchParams(location.search).has('noprops') ? [] : IDS;
  return loading ??= Promise.all(wanted.map(async id => {
    try { const model = await loadOne(url(id)); if (model) models.set(id, model); }
    catch (error) { console.warn(`Rift: prop ${id} did not load; it stays code-built`, error); }
  })).then(() => { settled = true; });
}
/** Loaded (or given up on): a place can be dressed now. */
export const propModelsSettled = () => settled;
export const propModel = (id: string) => models.get(id);

const loader = new GLTFLoader();
async function loadOne(src: string): Promise<PropModel | undefined> {
  const gltf = await loader.loadAsync(src);
  gltf.scene.updateMatrixWorld(true);
  let mesh: THREE.Mesh | undefined;
  gltf.scene.traverse(o => { if (!mesh && (o as THREE.Mesh).isMesh) mesh = o as THREE.Mesh; });
  if (!mesh) return undefined;
  const geometry = new THREE.BufferGeometry();
  const source = mesh.geometry;
  geometry.setAttribute('position', source.getAttribute('position').clone());
  geometry.setAttribute('normal', source.getAttribute('normal').clone());
  geometry.setAttribute('uv', source.getAttribute('uv').clone());
  if (source.index) geometry.setIndex(source.index.clone());
  geometry.applyMatrix4(mesh.matrixWorld);
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!, size = box.getSize(new THREE.Vector3());
  geometry.translate(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
  const texture = ((mesh.material as THREE.MeshStandardMaterial).map ?? new THREE.Texture()) as THREE.Texture;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return { geometry, far: await coarser(geometry, .35), texture, size };
}

/** A coarser copy (meshoptimizer, keeping uv seams), its unused vertices dropped - or the same, if it will not simplify. */
async function coarser(geometry: THREE.BufferGeometry, share: number): Promise<THREE.BufferGeometry> {
  try {
    await MeshoptSimplifier.ready;
    const positions = geometry.getAttribute('position').array as Float32Array;
    const index = geometry.getIndex() ? Uint32Array.from(geometry.getIndex()!.array as ArrayLike<number>) : Uint32Array.from({ length: positions.length / 3 }, (_, i) => i);
    const [coarse] = MeshoptSimplifier.simplify(index, Float32Array.from(positions), 3, Math.floor(index.length * share / 3) * 3, .03);
    if (coarse.length < 3 || coarse.length > index.length * .85) return geometry;
    // Compact: only the vertices the coarse index uses, in the order it uses them.
    const remap = new Map<number, number>(), order: number[] = [];
    const out = new Uint32Array(coarse.length);
    for (let i = 0; i < coarse.length; i++) {
      let to = remap.get(coarse[i]);
      if (to === undefined) { to = order.length; remap.set(coarse[i], to); order.push(coarse[i]); }
      out[i] = to;
    }
    const far = new THREE.BufferGeometry();
    for (const name of ['position', 'normal', 'uv']) {
      const from = geometry.getAttribute(name), size = from.itemSize, data = new Float32Array(order.length * size);
      order.forEach((v, i) => { for (let c = 0; c < size; c++) data[i * size + c] = from.getComponent(v, c); });
      far.setAttribute(name, new THREE.BufferAttribute(data, size));
    }
    far.setIndex(new THREE.BufferAttribute(out, 1));
    return far;
  } catch (error) {
    console.warn('Rift: a prop could not be simplified', error);
    return geometry;
  }
}

/** The scale (per axis) and turn that set `model` as `fit` asks. */
export function fitOf(fit: Fit, model: PropModel): { scale: { x: number; y: number; z: number }; turn: number } {
  const size = model.size, even = (k: number) => ({ scale: { x: k, y: k, z: k }, turn: 0 });
  if (fit.w === undefined || fit.d === undefined) return even((fit.h ?? size.y) / Math.max(.01, size.y));
  // Its long side along the footprint's.
  const turned = (fit.w >= fit.d) !== (size.x >= size.z);
  const mx = Math.max(.01, turned ? size.z : size.x), mz = Math.max(.01, turned ? size.x : size.z), turn = turned ? Math.PI / 2 : 0;
  // A box: filled on every axis (in the model's own axes, turned).
  if (fit.h !== undefined) {
    const sx = fit.w / mx, sz = fit.d / mz, sy = fit.h / Math.max(.01, size.y);
    return { scale: turned ? { x: sz, y: sy, z: sx } : { x: sx, y: sy, z: sz }, turn };
  }
  // A footprint: as large as fits it (a little over, so no wall of it stands
  // short of where the collision stops a body).
  const k = Math.min(fit.w / mx, fit.d / mz) * 1.04;
  return { scale: { x: k, y: k, z: k }, turn };
}
