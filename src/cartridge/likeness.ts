/**
 * The visitor, drawn as an Impact fighter (the world's LiveLikeness, ./live-contract.ts). When the visitor takes over a
 * fighter, that fighter becomes them: their own rigged model (host.visitor.model, the world's avatar.glb: one skinned
 * mesh and a face decal, Tripo bone names, metres, facing +z, soles on y = 0) worn over the fighter, in the fighter's
 * own materials and look - Impact's toon ramp and rim (applyToonShading), its ink hull, its hit flash and its limb smear,
 * on the uniforms of the fighter they wear - at the fighter's height. The fighter's own body stays and plays: its kit,
 * its clips and every procedural layer over them (hands, feet, cloth, reactions, ragdoll) pose its skeleton as ever,
 * on a layer no camera draws (its weapons stay drawn, in its hands), and each frame that pose is carried onto the
 * visitor's skeleton (`pose`).
 *
 * The carrying is the world's own retarget (tools/avatar/retarget.mts, from HISSATSU src/engine/anim/Retarget.ts:
 * Amir's code) run on the live pose rather than on a clip: every bone of the visitor's body turns from ITS OWN rest as
 * the fighter's bone turned from the fighter's rest, in the space both bodies stand in, its direction first laid along
 * the fighter's; the hips ride as high as the fighter's in proportion to the legs, then are set so the lower foot is as
 * far off the floor as the fighter's ("the feet decide, the hips follow"). The fighters' rigs are Tripo rigs spelled the
 * Mixamo way (the world's tools/avatar/rigmap.mts says so too): renamed here onto the Tripo names the visitor's rig has.
 *
 * Nothing of the visitor is kept in this repository: the model and the pictures are the world's, fetched from it.
 */
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import type { Fighter } from '../render/Fighter';
import { applyHitFlash, applyInkShell, applyLimbSmear, applyToonShading, headWeights, limbWeights } from '../render/look/toonShading';
import { addShaderPatch } from '../render/look/shaderPatch';
import { FIGHTERS } from '../config';

/** The fighters' toon ramp (Fighter.ts toonGradient): the darkest band at 110, so a shaded garment keeps its colour. */
const TOON_GRADIENT = new THREE.DataTexture(new Uint8Array([110, 155, 203, 255]), 4, 1, THREE.RedFormat);
TOON_GRADIENT.minFilter = TOON_GRADIENT.magFilter = THREE.NearestFilter;
TOON_GRADIENT.generateMipmaps = false; TOON_GRADIENT.colorSpace = THREE.NoColorSpace; TOON_GRADIENT.needsUpdate = true;
/** Fighter.ts INK_DEPTH_BIAS: the hull kept behind the surface it rings. */
const INK_DEPTH_BIAS = .035;
/** A layer no camera draws (the world's lens is on layer 0): the worn fighter's own body plays on there. */
const PUT_AWAY = 31;
/** What a fighter holds stays drawn: its weapons and its equipment, which its hands carry over the visitor's. */
const HELD = /weapon|equipment|held|sheath/i;

/** A fighter rig's bone (the Mixamo spelling Impact's Tripo rigs use) -> the Tripo name the visitor's rig has. */
function tripoName(name: string): string | undefined {
  const fixed: Record<string, string> = { Hips: 'Hip', Pelvis: 'Pelvis', Spine: 'Waist', Spine1: 'Spine01', Spine2: 'Spine02', Neck: 'NeckTwist01', NeckTwist02: 'NeckTwist02', Head: 'Head' };
  if (fixed[name]) return fixed[name];
  const m = name.match(/^(Left|Right)(Shoulder|Arm|ForeArm|Hand|UpLeg|Leg|Foot|ToeBase|HandThumb|HandIndex|HandMiddle|HandRing|HandPinky)(\d?)$/);
  if (!m) return /^[LR]_/.test(name) ? name : undefined;
  const side = m[1] === 'Left' ? 'L' : 'R';
  const part: Record<string, string> = { Shoulder: 'Clavicle', Arm: 'Upperarm', ForeArm: 'Forearm', Hand: 'Hand', UpLeg: 'Thigh', Leg: 'Calf', Foot: 'Foot', ToeBase: 'ToeBase', HandThumb: 'Thumb', HandIndex: 'Index', HandMiddle: 'Mid', HandRing: 'Ring', HandPinky: 'Pinky' };
  return `${side}_${part[m[2]]}${m[3]}`;
}
/** Bones that follow their parent and are never turned: they keep their own rest (retarget.mts HELPER). */
const HELPER = /(Twist|ShareBone|Eye|Facial|^BoneRoot$)/;
/** The child a bone points at, for laying its direction along the other rig's (retarget.mts mainChild). */
function mainChild(name: string): string | null {
  const m = name.match(/^([LR])_(.+)$/);
  if (m) {
    const [, s, n] = m, next: Record<string, string> = { Clavicle: 'Upperarm', Upperarm: 'Forearm', Forearm: 'Hand', Hand: 'Mid1', Thigh: 'Calf', Calf: 'Foot', Foot: 'ToeBase' };
    if (next[n]) return `${s}_${next[n]}`;
    const f = n.match(/^(Index|Mid|Ring|Pinky|Thumb)(\d)$/); if (f) return `${s}_${f[1]}${+f[2] + 1}`;
    return null;
  }
  return ({ Waist: 'Spine01', Spine01: 'Spine02', Spine02: 'NeckTwist01', NeckTwist01: 'NeckTwist02', NeckTwist02: 'Head' } as Record<string, string>)[name] ?? null;
}
const FEET = ['L_Foot', 'L_ToeBase', 'R_Foot', 'R_ToeBase'];

/** One rig as it stands in its holder (the fighter's group, which both bodies stand in): bones parent first, by name. */
interface Rig {
  bones: THREE.Bone[]; names: string[]; parent: number[]; index: Map<string, number>;
  /** Rest, in the holder's space (from the skin's bind matrices: the pose the mesh was bound in). */
  restQ: THREE.Quaternion[]; restP: THREE.Vector3[];
  /** Each bone's rest offset from its parent (local), and how many holder units one of its parent's units is. */
  localP: THREE.Vector3[]; unit: number[];
}
const _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();

/** The holder-from-node matrix by the nodes' local matrices (`node` a descendant of `holder`). */
function holderMatrix(node: THREE.Object3D, holder: THREE.Object3D, out: THREE.Matrix4): THREE.Matrix4 {
  out.identity();
  for (let n: THREE.Object3D | null = node; n && n !== holder; n = n.parent) { n.updateMatrix(); out.premultiply(n.matrix); }
  return out;
}

function rigOf(root: THREE.Object3D, holder: THREE.Object3D, rename: (name: string) => string | undefined): Rig | null {
  // the skeleton the body's skin is bound to (its bind matrices are the rest)
  let skin: THREE.SkinnedMesh | undefined;
  root.traverse(o => { const s = o as THREE.SkinnedMesh; if (s.isSkinnedMesh && (!skin || s.skeleton.bones.length > skin.skeleton.bones.length)) skin = s; });
  if (!skin) return null;
  const inverse = new Map<THREE.Bone, THREE.Matrix4>();
  skin.skeleton.bones.forEach((b, i) => inverse.set(b, skin!.skeleton.boneInverses[i]));
  const bones: THREE.Bone[] = [], names: string[] = [], parent: number[] = [], index = new Map<string, number>();
  const at = new Map<THREE.Object3D, number>();
  root.traverse(o => {
    const b = o as THREE.Bone;
    if (!b.isBone || !inverse.has(b)) return;
    const name = rename(b.name) ?? b.name;
    at.set(b, bones.length); index.set(name, bones.length);
    bones.push(b); names.push(name);
    let up = b.parent; while (up && !at.has(up)) up = up.parent;
    parent.push(up ? at.get(up)! : -1);
  });
  // the skin's bind space in the holder: the root's own placement (a fighter's normalisation, the visitor's scale)
  const placed = holderMatrix(root, holder, new THREE.Matrix4());
  const restQ: THREE.Quaternion[] = [], restP: THREE.Vector3[] = [], localP: THREE.Vector3[] = [], unit: number[] = [];
  for (let i = 0; i < bones.length; i++) {
    _m.copy(inverse.get(bones[i])!).invert().premultiply(placed);
    const q = new THREE.Quaternion(), p = new THREE.Vector3();
    _m.decompose(p, q, _s);
    restQ.push(q); restP.push(p); localP.push(bones[i].position.clone());
  }
  for (let i = 0; i < bones.length; i++) {
    const a = parent[i];
    // (a parent's scale in the holder: its bind matrix's, or the root's placement for the top bone)
    if (a >= 0) { _m.copy(inverse.get(bones[a])!).invert().premultiply(placed); _m.decompose(_p, _q, _s); unit.push(_s.x); }
    else { _m.copy(placed); _m.decompose(_p, _q, _s); unit.push(_s.x); }
  }
  return { bones, names, parent, index, restQ, restP, localP, unit };
}

/** The way a rig faces at rest (horizontal unit vector): its left (thighs + upper arms) crossed with up. */
function facing(r: Rig): THREE.Vector3 {
  const at = (n: string) => r.restP[r.index.get(n) ?? -1] ?? new THREE.Vector3();
  const left = at('L_Thigh').clone().sub(at('R_Thigh')).add(at('L_Upperarm').clone().sub(at('R_Upperarm'))); left.y = 0;
  if (left.lengthSq() < 1e-8) return new THREE.Vector3(0, 0, 1);
  left.normalize();
  return new THREE.Vector3().crossVectors(left, new THREE.Vector3(0, 1, 0)).normalize();
}

/** The live retarget from one fighter body (its skeleton as it plays) onto the visitor's (retarget.mts ClipRetarget's
 *  plan, applied to a pose each frame instead of a clip's keys). */
class LiveRetarget {
  private plan: { src: number; helper: boolean; fix: THREE.Quaternion }[] = [];
  private readonly face: THREE.Quaternion;
  private readonly hipS: number; private readonly hipD: number; private readonly hipScale: number;
  private readonly feetS: number[]; private readonly feetD: number[]; private readonly chainD: number[]; private readonly grounded: boolean;
  private readonly floorD: number[]; private readonly floorS: number[];
  private readonly sq: THREE.Quaternion[]; private readonly sp: THREE.Vector3[];
  private readonly dq: THREE.Quaternion[]; private readonly wp: THREE.Vector3[];
  private readonly used: number[];
  private readonly topQ: THREE.Quaternion[];
  constructor(private readonly src: Rig, private readonly dst: Rig, private readonly holder: THREE.Object3D) {
    const A = new THREE.Quaternion().setFromUnitVectors(facing(dst), facing(src));
    this.face = A.clone().invert();
    const dir = (r: Rig, i: number) => { const c = mainChild(r.names[i]); const k = c ? r.index.get(c) ?? -1 : -1; return k >= 0 ? r.restP[k].clone().sub(r.restP[i]).normalize() : null; };
    for (let i = 0; i < dst.names.length; i++) {
      const name = dst.names[i], s = src.index.get(name) ?? -1, helper = HELPER.test(name) || s < 0;
      const fix = A.clone();
      if (!helper) {
        const ds = dir(src, s), dd = dir(dst, i);
        if (ds && dd) fix.premultiply(new THREE.Quaternion().setFromUnitVectors(dd.applyQuaternion(A), ds));
        fix.multiply(dst.restQ[i]);
        fix.premultiply(src.restQ[s].clone().invert());
      }
      this.plan.push({ src: s, helper, fix });
    }
    this.hipS = src.index.get('Hip') ?? -1; this.hipD = dst.index.get('Hip') ?? -1;
    this.feetS = FEET.map(n => src.index.get(n) ?? -1); this.feetD = FEET.map(n => dst.index.get(n) ?? -1);
    this.grounded = this.hipS >= 0 && this.hipD >= 0 && this.feetS.every(i => i >= 0) && this.feetD.every(i => i >= 0);
    this.floorS = this.feetS.map(i => (i >= 0 ? src.restP[i].y : 0)); this.floorD = this.feetD.map(i => (i >= 0 ? dst.restP[i].y : 0));
    const lowest = (r: Rig, feet: number[]) => Math.min(...feet.filter(i => i >= 0).map(i => r.restP[i].y));
    this.hipScale = this.grounded ? (dst.restP[this.hipD].y - lowest(dst, this.feetD)) / Math.max(1e-6, src.restP[this.hipS].y - lowest(src, this.feetS)) : 1;
    // the visitor's bones from the hips down to the feet, parent first (for the feet's height)
    const need = new Set<number>();
    for (let b of this.feetD) for (; b >= 0; b = dst.parent[b]) need.add(b);
    this.chainD = [...need].sort((a, b) => a - b);
    this.sq = src.names.map(() => new THREE.Quaternion()); this.sp = src.names.map(() => new THREE.Vector3());
    this.dq = dst.names.map(() => new THREE.Quaternion()); this.wp = dst.names.map(() => new THREE.Vector3());
    // the source bones read each frame: the ones the plan turns from, the hips and the feet
    this.used = [...new Set([...this.plan.filter(p => !p.helper).map(p => p.src), this.hipS, ...this.feetS].filter(i => i >= 0))];
    // a top bone's parent in the holder (the visitor's root, scaled; none of its own turn)
    this.topQ = dst.bones.map(b => { holderMatrix(b.parent ?? b, holder, _m2); const q = new THREE.Quaternion(); _m2.decompose(_p, q, _s); return q; });
  }

  /** Carry the source body's pose (as drawn now) onto the visitor's skeleton. */
  apply() {
    const { src, dst, sq, sp, dq, wp, plan } = this;
    const holder = this.holder;
    holder.updateMatrixWorld(true);
    const into = _m2.copy(holder.matrixWorld).invert();
    for (const i of this.used) { _m.multiplyMatrices(into, src.bones[i].matrixWorld); _m.decompose(sp[i], sq[i], _s); }
    for (let i = 0; i < dst.bones.length; i++) {
      const pl = plan[i], a = dst.parent[i], bone = dst.bones[i];
      const up = a >= 0 ? dq[a] : this.topQ[i];
      if (pl.helper) { dq[i].copy(up).multiply(bone.quaternion); continue; }
      dq[i].copy(sq[pl.src]).multiply(pl.fix).premultiply(this.face);
      bone.quaternion.copy(up).invert().multiply(dq[i]);
    }
    // the hips: as high as the source's in proportion to the legs, then set by the feet
    if (this.hipS >= 0 && this.hipD >= 0) {
      const target = _p.copy(sp[this.hipS]).sub(src.restP[this.hipS]).applyQuaternion(this.face).multiplyScalar(this.hipScale).add(dst.restP[this.hipD]);
      if (this.grounded) {
        let want = Infinity;
        this.feetS.forEach((s, k) => { want = Math.min(want, sp[s].y - this.floorS[k]); });
        want *= this.hipScale;
        for (const i of this.chainD) {
          const a = dst.parent[i];
          if (i === this.hipD) wp[i].copy(target);
          else if (a < 0) wp[i].copy(dst.restP[i]);
          else wp[i].copy(dst.localP[i]).multiplyScalar(dst.unit[i]).applyQuaternion(dq[a]).add(wp[a]);
        }
        let got = Infinity;
        this.feetD.forEach((d, k) => { got = Math.min(got, wp[d].y - this.floorD[k]); });
        if (Number.isFinite(want) && Number.isFinite(got)) target.y += want - got;
      }
      // into the hips' parent's space (it is never turned: its rest)
      const a = dst.parent[this.hipD], hip = dst.bones[this.hipD];
      if (a >= 0) {
        _s.copy(target).sub(dst.restP[a]).applyQuaternion(_q.copy(dq[a]).invert()).divideScalar(dst.unit[this.hipD] || 1);
        hip.position.copy(_s);
      }
    }
  }
}

/** The uniforms a fighter's materials share (Fighter.ts: its hit flash and its smear), which the visitor's wear too. */
interface Looks { flash: { value: THREE.Vector4 }; flashFlat: { value: number }; smear: Parameters<typeof applyLimbSmear>[1] }

/** The visitor's meshes in a fighter's materials (Fighter.ts's chain: toon ramp and rim, hit flash, smear, and an ink
 *  hull on the body; the face decal over it as it came, shaded the same). Returns the materials made. */
function dress(body: THREE.Object3D, looks: Looks, outlineWidth: number): THREE.Material[] {
  const width = outlineWidth / .003, made: THREE.Material[] = [];
  const shells: [THREE.SkinnedMesh, THREE.Mesh][] = [];
  body.traverse(o => {
    const mesh = o as THREE.SkinnedMesh; if (!mesh.isMesh || mesh.name.endsWith('-ink')) return;
    const src = mesh.material as THREE.MeshStandardMaterial;
    const decal = !!src.transparent;
    const mat = new THREE.MeshToonMaterial({
      map: src.map ?? null, color: src.color?.clone() ?? new THREE.Color(1, 1, 1), gradientMap: TOON_GRADIENT,
      normalMap: src.normalMap ?? null, transparent: decal, opacity: src.opacity ?? 1, alphaTest: src.alphaTest ?? 0,
      side: src.side ?? THREE.FrontSide, depthWrite: decal ? false : src.depthWrite,
    });
    mat.name = `likeness-${src.name || 'body'}`;
    if (decal) { mat.polygonOffset = true; mat.polygonOffsetFactor = -1; mat.polygonOffsetUnits = -1; }
    applyToonShading(mat, 'body');
    // His black cloth reads black, as Impact keeps a matte black (toonShading.ts LOOK_MATTE: a third of the look's albedo
    // floor; at the whole of it his black joggers and the jacket's dark half read pale indigo under the key).
    addShaderPatch(mat, 'likeness-black-v1', shader => { shader.fragmentShader = shader.fragmentShader.replace('vec3 lookFloor = uToonFloor;', 'vec3 lookFloor = uToonFloor * .35;'); });
    applyHitFlash(mat, looks.flash, looks.flashFlat);
    applyLimbSmear(mat, looks.smear);
    mesh.material = mat; made.push(mat);
    mesh.castShadow = !decal; mesh.receiveShadow = true; mesh.frustumCulled = false;
    if (decal) { mesh.renderOrder = 1; return; }
    const ink = new THREE.MeshToonMaterial({ color: 0x081621, side: THREE.BackSide, depthWrite: false });
    ink.userData.ink = true;
    if (mat.map) ink.map = mat.map;
    applyInkShell(ink, width, INK_DEPTH_BIAS); applyLimbSmear(ink, looks.smear);
    made.push(ink);
    shells.push([mesh, mesh.isSkinnedMesh ? new THREE.SkinnedMesh(mesh.geometry, ink) : new THREE.Mesh(mesh.geometry, ink)]);
  });
  for (const [mesh, shell] of shells) {
    shell.name = mesh.name + '-ink'; shell.frustumCulled = false; shell.matrixAutoUpdate = false; shell.matrix.identity(); shell.castShadow = false; shell.receiveShadow = false;
    if ((shell as THREE.SkinnedMesh).isSkinnedMesh && mesh.isSkinnedMesh) { (shell as THREE.SkinnedMesh).bind(mesh.skeleton, mesh.bindMatrix); (shell as THREE.SkinnedMesh).bindMode = mesh.bindMode; }
    mesh.add(shell);
  }
  return made;
}

/** The visitor's model, loaded once and kept: each fighter they take over wears a copy (`wear`). */
export class Likeness {
  private constructor(private readonly template: THREE.Object3D, private readonly height: number) {}

  /** Fetch and prepare the visitor's model (the world serves it; the browser usually has it from the world already). */
  static async load(url: string): Promise<Likeness> {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    const gltf: GLTF = await loader.loadAsync(url);
    const template = gltf.scene;
    // what the fighters' look reads off every geometry it draws (Fighter.ts: the face's softer terminator, the four
    // striking limbs for the smear), worked out once on the template (its copies share the geometries)
    let head: THREE.Bone | undefined;
    const limbs: (THREE.Bone | undefined)[] = [undefined, undefined, undefined, undefined];
    template.traverse(o => {
      const b = o as THREE.Bone; if (!b.isBone) return;
      if (b.name === 'Head') head = b;
      // SMEAR_LIMBS: RightArm, LeftArm, RightUpLeg, LeftUpLeg
      const k = ['R_Upperarm', 'L_Upperarm', 'R_Thigh', 'L_Thigh'].indexOf(b.name); if (k >= 0) limbs[k] = b;
    });
    template.updateMatrixWorld(true);
    template.traverse(o => {
      const mesh = o as THREE.SkinnedMesh; if (!mesh.isMesh) return;
      const g = mesh.geometry;
      if (!g.hasAttribute('lookHead')) {
        // (the head weight and the crease field as a fighter's, but not the cel gate: the flattening and the painted ink
        // read the map a few mips up, and his atlas's tight islands bleed his black cloth into his skin there - lifting
        // the black and streaking it brown. He takes the fighters' light, rim and line, not that texture pass.)
        const weights = headWeights(g, mesh.isSkinnedMesh ? mesh.skeleton : undefined, head);
        for (let i = 0; i < weights.count; i++) weights.setY(i, 0);
        g.setAttribute('lookHead', weights);
      }
      if (!g.hasAttribute('smearLimb')) g.setAttribute('smearLimb', limbWeights(mesh, limbs));
    });
    const box = new THREE.Box3();
    template.traverse(o => { const mesh = o as THREE.Mesh; if (mesh.isMesh && !(mesh.material as THREE.Material).transparent) box.union(new THREE.Box3().setFromObject(mesh)); });
    return new Likeness(template, Math.max(.5, box.isEmpty() ? 1.75 : box.max.y - box.min.y));
  }

  /** A dressed copy that nobody wears, for compiling the visitor's materials before anyone walks in (its own
   *  uniforms: the programs are the same whoever wears them). `free` lets it go. */
  warm(): { body: THREE.Object3D; free(): void } {
    const body = cloneSkinned(this.template);
    const made = dress(body, { flash: { value: new THREE.Vector4(1, 1, 1, 0) }, flashFlat: { value: 0 }, smear: { point: { value: new THREE.Vector4(0, 0, 0, .6) }, motion: { value: new THREE.Vector4(0, 1, 0, 0) }, limb: { value: new THREE.Vector4(1, 0, 0, 0) } } }, .003);
    return { body, free: () => { body.removeFromParent(); for (const m of made) m.dispose(); } };
  }

  /** The visitor in `fighter`'s place, until `remove`. */
  wear(fighter: Fighter): Worn | null {
    try { return new Worn(fighter, cloneSkinned(this.template), this.height); }
    catch (error) { console.warn('Impact live: the visitor could not wear', fighter.state.fighter, error); return null; }
  }
}

/** A fighter worn by the visitor: their body over its rig, its own body put away, its pose carried over each frame. */
export class Worn {
  private readonly retargets = new Map<Fighter, LiveRetarget | null>();
  private readonly materials: THREE.Material[] = [];
  private readonly away = new Map<THREE.Object3D, number>();
  readonly body: THREE.Object3D;
  constructor(readonly fighter: Fighter, body: THREE.Object3D, ownHeight: number) {
    this.body = body;
    body.name = 'likeness';
    // the fighter's height (its standing box, weapons aside, as Fighter.ts normalises it)
    const box = new THREE.Box3();
    fighter.group.updateMatrixWorld(true);
    fighter.model.traverse(o => { const mesh = o as THREE.Mesh; if (mesh.isMesh && !HELD.test(mesh.name) && !mesh.name.endsWith('-ink') && mesh.name !== 'contact-shadow') box.union(new THREE.Box3().setFromObject(mesh)); });
    const into = new THREE.Matrix4().copy(fighter.group.matrixWorld).invert();
    box.applyMatrix4(into);
    const height = box.isEmpty() ? FIGHTERS[fighter.state.fighter]?.height ?? 1.7 : box.max.y - box.min.y;
    body.scale.setScalar(height / ownHeight);
    this.materials.push(...dress(body, fighter, FIGHTERS[fighter.state.fighter]?.outlineWidth ?? .003));
    fighter.group.add(body);
    body.updateMatrixWorld(true);
    this.putAway(fighter.model);
  }

  /** The fighter's own meshes onto a layer no camera draws (its held weapons and its blob shadow stay). */
  private putAway(root: THREE.Object3D) {
    root.traverse(o => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || this.away.has(mesh) || mesh.name === 'contact-shadow') return;
      if (HELD.test(mesh.name) || HELD.test(mesh.parent?.name ?? '') && mesh.name.endsWith('-ink')) return;
      this.away.set(mesh, mesh.layers.mask);
      mesh.layers.set(PUT_AWAY);
    });
  }

  /** Each frame after the fighter has posed: the visitor's skeleton takes the pose of the body it shows. */
  pose() {
    const fighter = this.fighter, body = fighter.shownBody;
    // a form (an awakened body of its own) is put away too the first time it shows
    if (body !== fighter) this.putAway(body.model);
    let plan = this.retargets.get(body);
    if (plan === undefined) {
      const src = rigOf(body.model, fighter.group, tripoName), dst = rigOf(this.body, fighter.group, name => name);
      plan = src && dst ? new LiveRetarget(src, dst, fighter.group) : null;
      this.retargets.set(body, plan);
    }
    // shown when the fighter's own body (or its form) would be: a vanish hides both
    this.body.visible = body === fighter ? fighter.model.visible : body.group.visible;
    plan?.apply();
  }

  /** The fighter's own body back, the visitor's gone (its geometries are the kept model's; its materials go). */
  remove() {
    for (const [mesh, mask] of this.away) mesh.layers.mask = mask;
    this.away.clear();
    this.body.removeFromParent();
    for (const m of this.materials) m.dispose();
    this.materials.length = 0;
  }
}
