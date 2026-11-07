import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptSimplifier } from 'three/examples/jsm/libs/meshopt_simplifier.module.js';
import { BONES, MotionLibrary } from './motion';
import { GROUP, GruntKit } from './kit';
import { ARMS } from './fleshLooks';
import { WEARS } from '../../survival/horde/kinds';
import { noise3 } from './flesh';
import {tripoClips} from '../moba/tripoMotion';
import { applyOriginalGruntBodies, ownGruntModel } from '../../originals/survival';

/** The kinds that wear a model - every one, now - and where it is (shipped
 *  with the motion library; its concept and rig are kept, unshipped, in
 *  assets/source/survival/grunts/<kind>). */
// The kinds' ids no longer name their files, so the two older bodies still worn are written out; every other kind wears its
// own body (src/originals/survival.ts OWN_GRUNT_MODELS) or a stand-in's (ORIGINAL_GRUNT_BODIES).
const MODELLED = ['tribunal-guard', 'tribunal-guard-rifle', 'automaton', 'graft-raider', 'iron-warden', 'graft-brute', 'ash-wraith', 'ash-caster', 'great-wraith',
  'cinder-imp', 'jinlin-soldier', 'brood-spawn', 'pale-sapling', 'cutthroat', 'husk', 'rift-spawn'];
const MAIN_BODIES: Partial<Record<string, string>> = { husk: '/assets/survival/motion/grunt-husk.glb', 'rift-spawn': '/assets/survival/motion/grunt-rift-spawn.glb' };
export const MODEL_LOOKS: Partial<Record<string, string>> = Object.fromEntries(MODELLED.map(id => [id, MAIN_BODIES[id]]));
// The fifth list's kinds wear bodies the horde already has (horde/kinds.ts WEARS), with gear of their own.
for (const [kind, body] of Object.entries(WEARS)) MODEL_LOOKS[kind] = MODEL_LOOKS[body];
applyOriginalGruntBodies(MODEL_LOOKS, WEARS);

/** Which part each bone's flesh goes with when the horde cuts a body apart. */
const PART: Record<string, number> = {
  Head: GROUP.HEAD, head_end: GROUP.HEAD, headfront: GROUP.HEAD,
  neck: GROUP.UPPER, Spine: GROUP.UPPER, Spine01: GROUP.UPPER, Spine02: GROUP.UPPER, LeftShoulder: GROUP.UPPER, RightShoulder: GROUP.UPPER,
  LeftArm: GROUP.ARM_L, LeftForeArm: GROUP.ARM_L, LeftHand: GROUP.ARM_L,
  RightArm: GROUP.ARM_R, RightForeArm: GROUP.ARM_R, RightHand: GROUP.ARM_R,
};

/** The uv a kit-built part is given: off the texture, so the map leaves its colour alone. */
export const UNTEXTURED = -2;

export interface ModelLook {
  geometry: THREE.BufferGeometry; texture: THREE.Texture; motion: MotionLibrary;
  /** A coarser index over the same vertices, for bodies far from the lens. */
  far?: THREE.BufferAttribute;
}

/** How much of a model a far body keeps. (A model is three to four times a
 *  sculpt's vertices, and a hundred of them cost a crowd a quarter of its
 *  frame rate; past the far line a third of the triangles reads the same.) */
const FAR_SHARE = .3;

const loader = new GLTFLoader();
const TEXTURE_OF = new Map<string, THREE.Texture>();
const _v = new THREE.Vector3(), _n = new THREE.Vector3(), _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _nm = new THREE.Matrix3();

export async function loadModelLook(kind: string, url: string, library: MotionLibrary): Promise<ModelLook | undefined> {
  const gltf = await loader.loadAsync(url);
  const root = gltf.scene;
  root.updateMatrixWorld(true);
  let mesh: THREE.SkinnedMesh | undefined;
  root.traverse(o => { if (!mesh && (o as THREE.SkinnedMesh).isSkinnedMesh) mesh = o as THREE.SkinnedMesh; });
  if (!mesh) return undefined;
  const native=url.startsWith('/assets/moba/')||ownGruntModel(url);
  const motion = native?MotionLibrary.native(root,tripoClips(root,gltf.animations,library)):MotionLibrary.retarget(library, root);
  // (The bake leaves the rig at rest: its mixer restores what it animated.
  // Not skeleton.pose(): this rig's bind matrices are its armature's, in
  // centimetres, and pose() shrank the skeleton a hundredfold.)
  root.updateMatrixWorld(true);
  const source = mesh.geometry, count = source.getAttribute('position').count;
  const pos = source.getAttribute('position') as THREE.BufferAttribute, nor = source.getAttribute('normal') as THREE.BufferAttribute;
  const uv = source.getAttribute('uv') as THREE.BufferAttribute;
  const joints = source.getAttribute('skinIndex') as THREE.BufferAttribute, weights = source.getAttribute('skinWeight') as THREE.BufferAttribute;
  // Skeleton bone slot -> the library's bone index, by name.
  const slot = mesh.skeleton.bones.map(bone => {
    let node:THREE.Object3D|null=bone;
    while(node){const index=BONES.indexOf(node.name as typeof BONES[number]);if(index>=0)return index;if(!native)break;node=node.parent;}
    return -1;
  });
  // Each vertex where three draws it at rest (its own skinning of the model,
  // whatever the rig's units and bind), then into the library's space.
  const into = _m.multiplyMatrices(motion.normal, mesh.matrixWorld);
  _nm.getNormalMatrix(_m2.multiplyMatrices(motion.normal, mesh.matrixWorld));
  const _p1 = new THREE.Vector3(), _p2 = new THREE.Vector3();
  const P = new Float32Array(count * 3), N = new Float32Array(count * 3), U = new Float32Array(count * 2), C = new Float32Array(count * 3).fill(1);
  const B = new Float32Array(count), B2 = new Float32Array(count), W = new Float32Array(count), G = new Float32Array(count);
  const L = new Float32Array(count), H = new Float32Array(count), E = new Float32Array(count * 3);
  let top = 0;
  for (let i = 0; i < count; i++) {
    mesh.getVertexPosition(i, _v).applyMatrix4(into);
    // A normal through the same skinning: the vertex nudged along it, skinned, and differenced.
    _p1.fromBufferAttribute(pos, i); _n.fromBufferAttribute(nor, i);
    _p2.copy(_p1).addScaledVector(_n, .01);
    pos.setXYZ(i, _p2.x, _p2.y, _p2.z); mesh.getVertexPosition(i, _p2).applyMatrix4(into); pos.setXYZ(i, _p1.x, _p1.y, _p1.z);
    _n.subVectors(_p2, _v).normalize();
    P[i * 3] = _v.x; P[i * 3 + 1] = _v.y; P[i * 3 + 2] = _v.z; top = Math.max(top, _v.y);
    N[i * 3] = _n.x; N[i * 3 + 1] = _n.y; N[i * 3 + 2] = _n.z;
    if (uv) { U[i * 2] = uv.getX(i); U[i * 2 + 1] = uv.getY(i); }
    // The two heaviest bones; the rest of the weight goes to the first.
    let a = -1, wa = 0, b = -1, wb = 0;
    for (let k = 0; k < 4; k++) {
      const bone = slot[joints.getComponent(i, k)] ?? -1, w = weights.getComponent(i, k);
      if (bone < 0 || w <= 0) continue;
      if (w > wa) { b = a; wb = wa; a = bone; wa = w; } else if (w > wb) { b = bone; wb = w; }
    }
    if (a < 0) a = 0;
    if (b < 0) { b = a; wb = 0; }
    const share = wa / Math.max(1e-6, wa + wb);
    B[i] = a; B2[i] = b; W[i] = share > .92 ? 1 : share;
    const part = PART[BONES[a]] ?? GROUP.BODY;
    G[i] = part; H[i] = part === GROUP.HEAD ? 1 : 0;
    // Wear, as a sculpt's: where a splash lands (smooth noise, so it lands in
    // blots - a per-vertex hash on a mesh this dense read as camouflage), no
    // grain of its own (the texture has its weave and dirt), a little mud.
    const { x, y, z } = _v;
    E[i * 3] = noise3(x * 5.3, y * 5.3, z * 5.3) * .7 + noise3(x * 19 + 3.1, y * 19, z * 19) * .3;
    E[i * 3 + 1] = .5;
    E[i * 3 + 2] = Math.max(0, Math.min(1, (.62 - y) / .58)) * (.3 + .25 * noise3(x * 7 + 3.1, y * 7, z * 7));
  }
  const geometry = withArms(native&&!ownGruntModel(url)?(kind==='cutthroat'?ARMS[kind]:undefined):ARMS[kind], motion.rest, count, { P, N, U, C, B, B2, W, G, L, H, E }, source.index);
  geometry.computeBoundingSphere();
  // One texture a model, however many kinds wear it (the fifth list's kinds
  // wear the bodies there were; sixteen more copies were 64 MB of the GPU).
  let texture = ((mesh.material as THREE.MeshStandardMaterial).map ?? new THREE.Texture()) as THREE.Texture;
  const shared = TEXTURE_OF.get(url);
  if (shared) { if (shared !== texture) texture.dispose(); texture = shared; }
  else TEXTURE_OF.set(url, texture);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  // Its standing height is its crown's (the cap on its head, not the skull's bone).
  motion.height = Math.max(.5, top);
  // Converted geometry and the shared diffuse map are all the crowd needs.
  // Drop source PBR maps/materials and skin buffers after baking.
  const materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();
  root.traverse(o=>{if(!(o instanceof THREE.Mesh))return;o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);if(o instanceof THREE.SkinnedMesh)o.skeleton.dispose();});
  for(const m of materials){for(const value of Object.values(m))if(value instanceof THREE.Texture&&value!==texture)textures.add(value);m.dispose();}
  for(const t of textures)t.dispose();
  return { geometry, texture, motion, far: await coarser(geometry) };
}

/** The far level: the same vertices, fewer triangles (meshoptimizer, which keeps uv seams). */
async function coarser(geometry: THREE.BufferGeometry): Promise<THREE.BufferAttribute | undefined> {
  try {
    await MeshoptSimplifier.ready;
    const index = Uint32Array.from(geometry.getIndex()!.array as ArrayLike<number>);
    const positions = geometry.getAttribute('position').array as Float32Array;
    const [coarse] = MeshoptSimplifier.simplify(index, positions, 3, Math.floor(index.length * FAR_SHARE / 3) * 3, .02);
    if (coarse.length < 3 || coarse.length > index.length * .8) return undefined;
    return new THREE.BufferAttribute(positions.length / 3 > 65535 ? coarse : Uint16Array.from(coarse), 1);
  } catch (error) {
    console.warn('Horde: a model\'s far level could not be simplified', error);
    return undefined;
  }
}

interface Arrays { P: Float32Array; N: Float32Array; U: Float32Array; C: Float32Array; B: Float32Array; B2: Float32Array; W: Float32Array; G: Float32Array; L: Float32Array; H: Float32Array; E: Float32Array }

/** The model's own surface, and after it whatever the kind carries, built by the kit on the model's rest pose. */
function withArms(arms: ((k: GruntKit) => void) | undefined, rest: readonly THREE.Vector3[], count: number, a: Arrays, index: THREE.BufferAttribute | null) {
  let { P, N, U, C, B, B2, W, G, L, H, E } = a;
  let I: ArrayLike<number> = index ? index.array : Array.from({ length: count }, (_, i) => i);
  let total = count;
  if (arms) {
    const kit = new GruntKit(rest);
    arms(kit);
    const hard = kit.build();
    const hp = hard.getAttribute('position'), hn = hard.getAttribute('normal'), hc = hard.getAttribute('color');
    const hb = hard.getAttribute('aBone'), hg = hard.getAttribute('aGroup'), hl = hard.getAttribute('aGlow'), hh = hard.getAttribute('lookHead');
    total = count + hp.count;
    const grow = (from: Float32Array, size: number) => { const to = new Float32Array(total * size); to.set(from); return to; };
    P = grow(P, 3); N = grow(N, 3); U = grow(U, 2); C = grow(C, 3); B = grow(B, 1); B2 = grow(B2, 1); W = grow(W, 1); G = grow(G, 1); L = grow(L, 1); H = grow(H, 1); E = grow(E, 3);
    P.set(hp.array as Float32Array, count * 3); N.set(hn.array as Float32Array, count * 3); C.set(hc.array as Float32Array, count * 3);
    B.set(hb.array as Float32Array, count); B2.set(hb.array as Float32Array, count); W.fill(1, count);
    G.set(hg.array as Float32Array, count); L.set(hl.array as Float32Array, count); H.set(hh.array as Float32Array, count);
    U.fill(UNTEXTURED, count * 2);
    for (let i = 0; i < hp.count; i++) { const o = (count + i) * 3; E[o] = .5; E[o + 1] = .5; E[o + 2] = 0; }
    const hardIndex = hard.getIndex()!.array;
    const merged = new Uint32Array(I.length + hardIndex.length);
    merged.set(I); for (let i = 0; i < hardIndex.length; i++) merged[I.length + i] = hardIndex[i] + count;
    I = merged;
    hard.dispose();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(P, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(U, 2));
  geometry.setAttribute('color', new THREE.BufferAttribute(C, 3));
  geometry.setAttribute('aBone', new THREE.BufferAttribute(B, 1));
  geometry.setAttribute('aBone2', new THREE.BufferAttribute(B2, 1));
  geometry.setAttribute('aBoneW', new THREE.BufferAttribute(W, 1));
  geometry.setAttribute('aGroup', new THREE.BufferAttribute(G, 1));
  geometry.setAttribute('aGlow', new THREE.BufferAttribute(L, 1));
  geometry.setAttribute('lookHead', new THREE.BufferAttribute(H, 1));
  geometry.setAttribute('aWear', new THREE.BufferAttribute(E, 3));
  geometry.setIndex(new THREE.BufferAttribute(total > 65535 ? Uint32Array.from(I) : Uint16Array.from(I), 1));
  return geometry;
}
