import * as THREE from 'three';
import { resolveSkeleton, type Canonical } from '../../render/skeleton';

type Sampler = { evaluate(time: number): ArrayLike<number> };
const KEYED = ['position', 'quaternion', 'scale'] as const;
type Keyed = typeof KEYED[number];

/** A rig as a retarget reads it: its nodes depth first (parents before children), each one's reference transform,
 *  and its canonical joints. Built once per rig and reference (rigOf caches it). */
export interface Rig {
  /** The scene it was read from (none for a rig read from a take pack: takePacks.ts). */
  readonly root?: THREE.Object3D;
  /** Its nodes by name, depth first: a scene's, or a take pack's (the chains that reach the canonical joints). */
  readonly nodes: readonly { readonly name: string }[];
  readonly parent: Int32Array;
  /** Node index by name, the first in the order a track binds to it (PropertyBinding.findNode). */
  readonly byName: ReadonlyMap<string, number>;
  /** Canonical joint -> node index. */
  readonly joints: ReadonlyMap<Canonical, number>;
  /** The reference pose: local position, rotation and scale of every node. */
  readonly refP: readonly THREE.Vector3[];
  readonly refQ: readonly THREE.Quaternion[];
  readonly refS: readonly THREE.Vector3[];
  /** The reference pose in the rig's frame (the scene root's), per node. */
  readonly refWorld: readonly THREE.Matrix4[];
  readonly refWorldQ: readonly THREE.Quaternion[];
  /** Which way the rig faces in its reference (radians about +Y, 0 facing +Z), and its hips' height over its feet. */
  readonly yaw: number;
  readonly hipsHeight: number;
  /** Why the rig cannot take part in a retarget, if it cannot. */
  readonly problem?: string;
}

/** The joints, root first, and for each the joints its bone points at (the first both rigs have). */
const CHAIN: readonly [Canonical, readonly Canonical[]][] = [
  ['Hips', ['Spine', 'Spine1', 'Spine2', 'Neck']],
  ['Spine', ['Spine1', 'Spine2', 'Neck']], ['Spine1', ['Spine2', 'Neck']], ['Spine2', ['Neck']], ['Neck', ['Head']], ['Head', []],
  ['LeftShoulder', ['LeftArm']], ['LeftArm', ['LeftForeArm']], ['LeftForeArm', ['LeftHand']], ['LeftHand', []],
  ['RightShoulder', ['RightArm']], ['RightArm', ['RightForeArm']], ['RightForeArm', ['RightHand']], ['RightHand', []],
  ['LeftUpLeg', ['LeftLeg']], ['LeftLeg', ['LeftFoot']], ['LeftFoot', ['LeftToeBase']], ['LeftToeBase', []],
  ['RightUpLeg', ['RightLeg']], ['RightLeg', ['RightFoot']], ['RightFoot', ['RightToeBase']], ['RightToeBase', []],
];
/** A joint with nowhere to point (a hand, the head, a toe) is swung as its parent joint is. */
const PARENT: Partial<Record<Canonical, Canonical>> = {
  Spine: 'Hips', Spine1: 'Spine', Spine2: 'Spine1', Neck: 'Spine2', Head: 'Neck', LeftShoulder: 'Spine2', LeftArm: 'LeftShoulder', LeftForeArm: 'LeftArm',
  LeftHand: 'LeftForeArm', RightShoulder: 'Spine2', RightArm: 'RightShoulder', RightForeArm: 'RightArm', RightHand: 'RightForeArm', LeftUpLeg: 'Hips',
  LeftLeg: 'LeftUpLeg', LeftFoot: 'LeftLeg', LeftToeBase: 'LeftFoot', RightUpLeg: 'Hips', RightLeg: 'RightUpLeg', RightFoot: 'RightLeg', RightToeBase: 'RightFoot',
};
/** What a move needs on both bodies: a pelvis, a back, a head, two arms and two legs. */
const CORE: readonly (Canonical | readonly Canonical[])[] = [
  'Hips', ['Spine', 'Spine1', 'Spine2'], ['Neck', 'Head'], 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightArm', 'RightForeArm', 'RightHand',
  'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot',
];
/** The limbs whose bones are checked against the source's after the fit, and how far one may stray (degrees). */
const CHECKED: readonly Canonical[] = ['LeftArm', 'LeftForeArm', 'RightArm', 'RightForeArm', 'LeftUpLeg', 'LeftLeg', 'RightUpLeg', 'RightLeg', 'Spine', 'Neck'];
const STRAY = 30;

const samplers = new WeakMap<THREE.KeyframeTrack, Sampler>();
const samplerOf = (track: THREE.KeyframeTrack) => {
  let sampler = samplers.get(track);
  if (!sampler) { sampler = (track as THREE.KeyframeTrack & { createInterpolant(): Sampler }).createInterpolant(); samplers.set(track, sampler); }
  return sampler;
};
/** A clip's tracks by node index and property, for one rig. */
function bind(rig: Pick<Rig, 'byName'>, clip: THREE.AnimationClip) {
  const out = new Map<number, Partial<Record<Keyed, Sampler>>>();
  for (const track of clip.tracks) {
    const parsed = THREE.PropertyBinding.parseTrackName(track.name), property = parsed.propertyName as Keyed;
    if (!KEYED.includes(property)) continue;
    const index = rig.byName.get(parsed.nodeName);
    if (index === undefined) continue;
    const entry = out.get(index) ?? {};
    entry[property] = samplerOf(track);
    out.set(index, entry);
  }
  return out;
}

const rigs = new WeakMap<THREE.Object3D, Map<THREE.AnimationClip | null, Rig>>();
/** A rig, against its reference clip's first frame (its idle), or its rest without one. Cached per scene and reference. */
export function rigOf(root: THREE.Object3D, reference?: THREE.AnimationClip): Rig {
  let byReference = rigs.get(root);
  if (!byReference) rigs.set(root, byReference = new Map());
  let rig = byReference.get(reference ?? null);
  if (!rig) byReference.set(reference ?? null, rig = buildRig(root, reference));
  return rig;
}
function buildRig(root: THREE.Object3D, reference?: THREE.AnimationClip): Rig {
  const nodes: THREE.Object3D[] = [], index = new Map<THREE.Object3D, number>();
  root.traverse(node => { index.set(node, nodes.length); nodes.push(node); });
  const parent = new Int32Array(nodes.length).fill(-1);
  nodes.forEach((node, i) => { if (node.parent && index.has(node.parent)) parent[i] = index.get(node.parent)!; });
  const byName = new Map<string, number>();
  nodes.forEach((node, i) => { if (!byName.has(node.name)) byName.set(node.name, i); });
  const bones: string[] = [];
  for (const node of nodes) if ((node as THREE.Bone).isBone) bones.push(node.name);
  const joints = new Map<Canonical, number>();
  for (const [canonical, actual] of resolveSkeleton(bones)) {
    const i = nodes.findIndex(node => (node as THREE.Bone).isBone && node.name === actual);
    if (i >= 0) joints.set(canonical as Canonical, i);
  }
  orderSpine(joints, parent, i => !!(nodes[i] as THREE.Bone).isBone);
  const refP = nodes.map(node => node.position.clone()), refQ = nodes.map(node => node.quaternion.clone()), refS = nodes.map(node => node.scale.clone());
  if (reference) for (const [i, tracks] of bind({ byName }, reference)) {
    if (tracks.position) refP[i].fromArray(tracks.position.evaluate(0) as number[]);
    if (tracks.quaternion) refQ[i].fromArray(tracks.quaternion.evaluate(0) as number[]).normalize();
    if (tracks.scale) refS[i].fromArray(tracks.scale.evaluate(0) as number[]);
  }
  return finishRig({ root, nodes, parent, byName, joints, refP, refQ, refS });
}

/** A rig as data: its nodes (names, depth first), each one's parent (-1 for the root), its canonical joints by node
 *  index, and its reference pose as 10 numbers a node (position, rotation as x y z w, scale). What a take pack carries
 *  (takePacks.ts), and what `rigData` writes. */
export interface RigData { readonly names: readonly string[]; readonly parents: ArrayLike<number>; readonly joints: Readonly<Partial<Record<Canonical, number>>>; readonly reference: ArrayLike<number> }
/** A back named from the top down resolves upside down by name: Meshy's rig hangs `Spine02 > Spine01 > Spine > neck`
 *  off its hips, so `Spine` is its chest and `Spine1` (`Spine02`) its waist, and every bone of a back fitted from it
 *  pointed at the joint below it - the torso folded in a Z, the head at the belt (the techniques' takes, 2 November
 *  2026). Where the named back joints hang in the wrong order, they are taken again as they hang between the hips and
 *  the neck: the lowest `Spine`, the next `Spine1`, the one under the neck `Spine2`. A back in order is left as named. */
export function orderSpine(joints: Map<Canonical, number>, parent: ArrayLike<number>, isBone: (i: number) => boolean) {
  const hips = joints.get('Hips'), neck = joints.get('Neck');
  if (hips === undefined || neck === undefined) return;
  const above = (low: number, high: number) => { for (let i = parent[high]; i >= 0; i = parent[i]) if (i === low) return true; return false; };
  const named = (['Spine', 'Spine1', 'Spine2'] as const).map(joint => joints.get(joint)).filter((i): i is number => i !== undefined);
  if (named.every((i, k) => k === 0 || above(named[k - 1], i))) return;
  const back: number[] = [];
  for (let i = parent[neck]; i >= 0 && i !== hips; i = parent[i]) if (isBone(i)) back.unshift(i);
  if (back.length < 2 || !above(hips, back[0])) return;
  joints.delete('Spine'); joints.delete('Spine1'); joints.delete('Spine2');
  joints.set('Spine', back[0]); joints.set('Spine1', back[1]);
  if (back.length > 2) joints.set('Spine2', back[back.length - 1]);
}

/** A rig from data (a take pack's). */
export function rigFromData(data: RigData): Rig {
  const count = data.names.length, parent = new Int32Array(count), byName = new Map<string, number>(), joints = new Map<Canonical, number>();
  const refP: THREE.Vector3[] = [], refQ: THREE.Quaternion[] = [], refS: THREE.Vector3[] = [], r = data.reference;
  for (let i = 0; i < count; i++) {
    parent[i] = data.parents[i];
    if (!byName.has(data.names[i])) byName.set(data.names[i], i);
    refP.push(new THREE.Vector3(r[i * 10], r[i * 10 + 1], r[i * 10 + 2]));
    refQ.push(new THREE.Quaternion(r[i * 10 + 3], r[i * 10 + 4], r[i * 10 + 5], r[i * 10 + 6]));
    refS.push(new THREE.Vector3(r[i * 10 + 7], r[i * 10 + 8], r[i * 10 + 9]));
  }
  for (const [joint, i] of Object.entries(data.joints)) if (i !== undefined) joints.set(joint as Canonical, i);
  return finishRig({ nodes: data.names.map(name => ({ name })), parent, byName, joints, refP, refQ, refS });
}
/** The part of a rig a retarget reads, as data: the chains from its root to every canonical joint (in depth-first
 *  order, parents first), their reference pose and their names. A take pack keeps this, and the takes' tracks on it. */
export function rigData(rig: Rig): RigData & { readonly kept: readonly number[] } {
  const needed = new Set<number>();
  for (const joint of rig.joints.values()) for (let i = joint; i >= 0; i = rig.parent[i]) needed.add(i);
  const kept = [...needed].sort((a, b) => a - b), at = new Map(kept.map((index, i) => [index, i]));
  const reference = new Float32Array(kept.length * 10);
  kept.forEach((index, i) => { rig.refP[index].toArray(reference, i * 10); rig.refQ[index].toArray(reference, i * 10 + 3); rig.refS[index].toArray(reference, i * 10 + 7); });
  return {
    kept, names: kept.map(index => rig.nodes[index].name), parents: kept.map(index => rig.parent[index] < 0 ? -1 : at.get(rig.parent[index])!),
    joints: Object.fromEntries([...rig.joints].map(([joint, index]) => [joint, at.get(index)!])), reference,
  };
}

type Parts = Pick<Rig, 'root' | 'nodes' | 'parent' | 'byName' | 'joints' | 'refP' | 'refQ' | 'refS'>;
function finishRig({ root, nodes, parent, byName, joints, refP, refQ, refS }: Parts): Rig {
  // In the rig's own frame: the root's own transform is the scene's placement, not the rig's.
  const refWorld: THREE.Matrix4[] = [], refWorldQ: THREE.Quaternion[] = [], local = new THREE.Matrix4(), p = new THREE.Vector3(), s = new THREE.Vector3();
  nodes.forEach((_, i) => {
    local.compose(refP[i], refQ[i], refS[i]);
    refWorld.push(i === 0 ? new THREE.Matrix4() : parent[i] < 0 ? local.clone() : refWorld[parent[i]].clone().multiply(local));
    refWorldQ.push(new THREE.Quaternion());
    refWorld[i].decompose(p, refWorldQ[i], s);
  });
  const at = (joint: Canonical) => { const i = joints.get(joint); return i === undefined ? undefined : new THREE.Vector3().setFromMatrixPosition(refWorld[i]); };
  const missing = CORE.filter(need => (Array.isArray(need) ? need : [need]).every(joint => !joints.has(joint as Canonical))).map(need => Array.isArray(need) ? need.join('/') : need);
  const hips = at('Hips'), head = at('Head') ?? at('Neck'), leftLeg = at('LeftUpLeg'), rightLeg = at('RightUpLeg');
  const feet = (['LeftFoot', 'RightFoot', 'LeftToeBase', 'RightToeBase'] as Canonical[]).map(at).filter((v): v is THREE.Vector3 => !!v);
  let yaw = 0, hipsHeight = 0, problem: string | undefined = missing.length ? `missing joints: ${missing.join(', ')}` : undefined;
  if (!problem && hips && head && leftLeg && rightLeg && feet.length) {
    const up = head.clone().sub(hips).normalize(), across = rightLeg.clone().sub(leftLeg);
    const forward = new THREE.Vector3(0, 1, 0).cross(across).setY(0);
    yaw = Math.atan2(forward.x, forward.z);
    hipsHeight = hips.y - Math.min(...feet.map(foot => foot.y));
    if (up.y < .8) problem = `its reference pose does not stand upright (spine ${Math.round(Math.acos(Math.min(1, up.y)) * 180 / Math.PI)} degrees off)`;
    else if (!(hipsHeight > 1e-4) || forward.lengthSq() < 1e-10) problem = 'its reference pose has no hips over its feet';
  }
  return { root, nodes, parent, byName, joints: joints as ReadonlyMap<Canonical, number>, refP, refQ, refS, refWorld, refWorldQ, yaw, hipsHeight, problem };
}

/** A clip fitted to a body, or why it could not be. */
export type Fitted = { clip: THREE.AnimationClip; reason?: undefined; stray: number; pinned: number } | { clip?: undefined; reason: string };

/** The nodes a set of joints hang from, parents first. */
function chainsOf(rig: Rig, joints: Iterable<number>) {
  const needed = new Set<number>();
  for (const joint of joints) for (let i = joint; i >= 0; i = rig.parent[i]) needed.add(i);
  return [...needed].sort((a, b) => a - b);
}

/** `clip`, as played on `source`, fitted to `target`: tracks for the canonical joints both rigs have (rotations) and the
 *  hips (position), at `fps`, named for the target's nodes, as long as the clip. Refused with a reason where it cannot
 *  be done well (see the file's header). */
export interface RetargetOptions {
  /** The back - hips to head - turned only as the source's turns away from its own stance, on the body's stance, rather
   *  than swung to point where the source's points. The limbs still point where the source's do (a punch lands where
   *  it was thrown), but a fighter who stands up straight stays straight through a take read off a boxer's crouch:
   *  the techniques' takes (styleMoves.ts), all read off one stance, would otherwise lean every body 25 degrees over.
   *  A number is how much of the source's turn the back takes (true: all of it): a body that already stands bent, as
   *  a brawler does, bent as far again by a boxer's dip reads as bowing. */
  ownBack?: boolean | number;
  /** Which way each rig really faces (radians about +Y, 0 facing +Z), in place of the estimate off its hips. A fighting
   *  stance stands side-on: the line across its hips can be 40 degrees off the line its blows travel, and a take turned
   *  hips to hips throws every punch past the opponent's shoulder (the techniques' takes, 2 November 2026). */
  facing?: { source: number; target: number };
  /** The body kept at its own height: the root's travel along the floor only, the feet left where the legs put them.
   *  For a take that leaps, thrown by a body the game already has in the air (a jump's height is the simulation's). */
  level?: boolean;
  /** The hands held at the body's own grip (its stance's turn of the hand on the forearm) rather than the source's: a
   *  take read off empty hands turns a sword, an axe or a staff to point at the sky or back over the shoulder at the
   *  blow. The arms still swing it where the source's arms go. */
  ownHands?: boolean;
  /** With ownHands, the turn of each hand on its forearm to hold, in place of the stance's (styleMoves.ts: a weapon
   *  fighter's grip at the blow of its own heavy, so a blade swung by a take's arm comes round at the opponent). */
  grip?: Partial<Record<Canonical, THREE.Quaternion>>;
  /** How far the root may travel along the floor, in the body's hip heights, eased in (tanh) as Fighter's root caps
   *  are: where the game moves the fighter itself (a technique's lunge), a take's own long step would carry the body
   *  past its opponent and snap it back. A weight shift stays as it is. */
  travel?: number;
}
const HANDS: ReadonlySet<Canonical> = new Set<Canonical>(['LeftHand', 'RightHand']);
const BACK: ReadonlySet<Canonical> = new Set<Canonical>(['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head']);
export function retarget(source: Rig, clip: THREE.AnimationClip, target: Rig, fps = 60, options: RetargetOptions = {}): Fitted {
  if (source.problem) return { reason: `the source rig: ${source.problem}` };
  if (target.problem) return { reason: `the body: ${target.problem}` };
  if (!(clip.duration > 0)) return { reason: 'the clip has no length' };
  const tracks = bind(source, clip);
  if (!tracks.size) return { reason: 'the clip keys nothing on its own rig' };
  // The joints both rigs have, root first, each with the joint its bone points at.
  const shared = CHAIN.filter(([joint]) => source.joints.has(joint) && target.joints.has(joint))
    .map(([joint, toward]) => ({ joint, toward: toward.find(next => source.joints.has(next) && target.joints.has(next)), s: source.joints.get(joint)!, t: target.joints.get(joint)! }));
  const facing = options.facing ?? { source: source.yaw, target: target.yaw };
  const turn = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), facing.source - facing.target), unturn = turn.clone().invert();
  // Each body joint swung so its bone points as the source's does in the source's reference (turned to face its way).
  const align = new Map<Canonical, THREE.Quaternion>();
  const toward = (rig: Rig, from: number, to: number) => new THREE.Vector3().setFromMatrixPosition(rig.refWorld[to]).sub(new THREE.Vector3().setFromMatrixPosition(rig.refWorld[from]));
  for (const entry of shared) {
    if (options.ownBack && BACK.has(entry.joint)) { align.set(entry.joint, new THREE.Quaternion()); continue; }
    if (!entry.toward) { align.set(entry.joint, align.get(PARENT[entry.joint] ?? entry.joint)?.clone() ?? new THREE.Quaternion()); continue; }
    const s = toward(source, entry.s, source.joints.get(entry.toward)!), t = toward(target, entry.t, target.joints.get(entry.toward)!).applyQuaternion(turn);
    if (s.lengthSq() < 1e-12 || t.lengthSq() < 1e-12) { align.set(entry.joint, align.get(PARENT[entry.joint] ?? entry.joint)?.clone() ?? new THREE.Quaternion()); continue; }
    align.set(entry.joint, new THREE.Quaternion().setFromUnitVectors(t.normalize(), s.normalize()));
  }
  // Source and body, evaluated along the chains that reach the shared joints.
  const sourceChain = chainsOf(source, shared.map(entry => entry.s)), targetChain = chainsOf(target, shared.map(entry => entry.t));
  const sourceShared = new Map(shared.map(entry => [entry.s, entry])), targetShared = new Map(shared.map(entry => [entry.t, entry]));
  const hipsS = source.joints.get('Hips')!, hipsT = target.joints.get('Hips')!;
  const scale = target.hipsHeight / source.hipsHeight;
  const frames = Math.max(2, Math.round(clip.duration * fps) + 1), times = new Float32Array(frames);
  for (let f = 0; f < frames; f++) times[f] = Math.min(clip.duration, f / fps);
  times[frames - 1] = clip.duration;
  const rotations = new Map(shared.map(entry => [entry.t, new Float32Array(frames * 4)])), hipsTrack = new Float32Array(frames * 3);
  const sWorld = source.nodes.map(() => new THREE.Matrix4()), tWorldQ = target.nodes.map(() => new THREE.Quaternion()), tWorld = target.nodes.map(() => new THREE.Matrix4());
  const local = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(), worldQ = new THREE.Quaternion(), delta = new THREE.Quaternion();
  const refHipsS = new THREE.Vector3().setFromMatrixPosition(source.refWorld[hipsS]), refHipsT = new THREE.Vector3().setFromMatrixPosition(target.refWorld[hipsT]);
  const hipsParentInverse = target.parent[hipsT] >= 0 ? target.refWorld[target.parent[hipsT]].clone().invert() : new THREE.Matrix4();
  const travel = new THREE.Vector3(), hipsLocal = new THREE.Vector3();
  let moved = 0, stray = 0, strayJoint = '', pinned = 0;
  // The feet, for the floor: the body's lowest foot is kept as high over its floor as the source's is over its own (in
  // hip heights), the hips raised or lowered to it - the same turns on other legs would sink a body to its knees or lift
  // it off the floor. How much that took (`pinned`) says how different the two bodies are.
  const FEET: readonly Canonical[] = ['LeftFoot', 'RightFoot', 'LeftToeBase', 'RightToeBase'];
  const feetS = FEET.filter(joint => source.joints.has(joint) && target.joints.has(joint)).map(joint => source.joints.get(joint)!);
  const feetT = FEET.filter(joint => source.joints.has(joint) && target.joints.has(joint)).map(joint => target.joints.get(joint)!);
  const lowest = (world: readonly THREE.Matrix4[], feet: readonly number[]) => Math.min(...feet.map(i => world[i].elements[13]));
  const floorS = lowest(source.refWorld, feetS), floorT = lowest(target.refWorld, feetT);
  const underHips = new Set<number>();
  for (const i of targetChain) for (let k = i; k >= 0; k = target.parent[k]) if (k === hipsT) { underHips.add(i); break; }
  // Only a bone that carries the joint it points at is held to the source's: on a rig whose `Spine` hangs beside `Spine1`
  // instead of over it (Lanthorn': both are the hips' children) the line between the two turns with the hips whatever the
  // fit does to `Spine`, and a slam's arched back read as a spine 45 degrees astray and was refused.
  const carries = (rig: Rig, from: number, to: number) => { for (let i = rig.parent[to]; i >= 0; i = rig.parent[i]) if (i === from) return true; return false; };
  const checked = shared.filter(entry => entry.toward && CHECKED.includes(entry.joint) && !(options.ownBack && BACK.has(entry.joint)) && carries(source, entry.s, source.joints.get(entry.toward)!) && carries(target, entry.t, target.joints.get(entry.toward)!));
  const sDir = new THREE.Vector3(), tDir = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(), swing = new THREE.Quaternion(), still = new THREE.Quaternion();
  for (let f = 0; f < frames; f++) {
    const time = times[f];
    for (const i of sourceChain) {
      const entry = tracks.get(i);
      p.copy(source.refP[i]); q.copy(source.refQ[i]); s.copy(source.refS[i]);
      if (entry?.position) p.fromArray(entry.position.evaluate(time) as number[]);
      if (entry?.quaternion) q.fromArray(entry.quaternion.evaluate(time) as number[]).normalize();
      if (entry?.scale) s.fromArray(entry.scale.evaluate(time) as number[]);
      local.compose(p, q, s);
      if (i === 0) sWorld[i].identity(); else if (source.parent[i] < 0) sWorld[i].copy(local); else sWorld[i].multiplyMatrices(sWorld[source.parent[i]], local);
    }
    // The body: each shared joint turned as the source's turned from its reference, after the swing; every other node
    // in the chains at its reference.
    for (const i of targetChain) {
      const parentQ = target.parent[i] >= 0 && i !== 0 ? tWorldQ[target.parent[i]] : undefined, entry = targetShared.get(i);
      if (entry) {
        sWorld[entry.s].decompose(p, worldQ, s);
        delta.copy(worldQ).multiply(q.copy(source.refWorldQ[entry.s]).invert());
        // Where the source's bone actually points (through joints the body may lack, or a stretch): the turn is swung
        // onto it, so the body's bone points there too.
        if (entry.toward) {
          const to = source.joints.get(entry.toward)!;
          sDir.setFromMatrixPosition(sWorld[to]).sub(a.setFromMatrixPosition(sWorld[entry.s]));
          b.setFromMatrixPosition(source.refWorld[to]).sub(a.setFromMatrixPosition(source.refWorld[entry.s])).applyQuaternion(delta);
          if (sDir.lengthSq() > 1e-12 && b.lengthSq() > 1e-12) delta.premultiply(swing.setFromUnitVectors(b.normalize(), sDir.normalize()));
        }
        moved = Math.max(moved, 2 * Math.acos(Math.min(1, Math.abs(delta.w))));
        if (typeof options.ownBack === 'number' && BACK.has(entry.joint)) delta.slerp(still, options.ownBack < 1 ? 1 - options.ownBack : 0);
        // In the source's frame: delta * align * (turn * reference); back to the body's frame.
        tWorldQ[i].copy(unturn).multiply(delta).multiply(align.get(entry.joint)!).multiply(turn).multiply(target.refWorldQ[i]);
        const localQ = q.copy(parentQ ?? new THREE.Quaternion()).invert().multiply(tWorldQ[i]).normalize();
        const out = rotations.get(i)!, prev = f > 0 ? out.subarray((f - 1) * 4, f * 4) : undefined;
        if (prev && prev[0] * localQ.x + prev[1] * localQ.y + prev[2] * localQ.z + prev[3] * localQ.w < 0) localQ.set(-localQ.x, -localQ.y, -localQ.z, -localQ.w);
        localQ.toArray(out, f * 4);
        local.compose(i === hipsT ? hipsLocal : target.refP[i], localQ, target.refS[i]);
      } else {
        if (i === 0) tWorldQ[i].identity(); else tWorldQ[i].copy(parentQ ?? new THREE.Quaternion()).multiply(target.refQ[i]);
        local.compose(target.refP[i], target.refQ[i], target.refS[i]);
      }
      if (i === hipsT) {
        // The root's travel from the source's reference, turned to the body's facing and scaled to its size.
        travel.setFromMatrixPosition(sWorld[hipsS]).sub(refHipsS).multiplyScalar(scale).applyQuaternion(unturn);
        if (options.level) travel.y = 0;
        if (options.travel !== undefined) {
          const flat = Math.hypot(travel.x, travel.z), cap = options.travel * target.hipsHeight;
          if (flat > 1e-9 && cap > 0) { const k = cap * Math.tanh(flat / cap) / flat; travel.x *= k; travel.z *= k; }
        }
        hipsLocal.copy(refHipsT).add(travel).applyMatrix4(hipsParentInverse);
        hipsLocal.toArray(hipsTrack, f * 3);
        local.compose(hipsLocal, q.copy(parentQ ?? new THREE.Quaternion()).invert().multiply(tWorldQ[i]).normalize(), target.refS[i]);
      }
      if (i === 0) tWorld[i].identity(); else if (target.parent[i] < 0) tWorld[i].copy(local); else tWorld[i].multiplyMatrices(tWorld[target.parent[i]], local);
    }
    // Does each limb point where the source's does?
    for (const entry of checked) {
      sDir.setFromMatrixPosition(sWorld[source.joints.get(entry.toward!)!]).sub(a.setFromMatrixPosition(sWorld[entry.s]));
      tDir.setFromMatrixPosition(tWorld[target.joints.get(entry.toward!)!]).sub(b.setFromMatrixPosition(tWorld[entry.t])).applyQuaternion(turn);
      if (sDir.lengthSq() < 1e-12 || tDir.lengthSq() < 1e-12) continue;
      const angle = sDir.angleTo(tDir) * 180 / Math.PI;
      if (angle > stray) { stray = angle; strayJoint = entry.joint; }
    }
    if (feetS.length && !options.level) {
      const dy = (lowest(sWorld, feetS) - floorS) / source.hipsHeight * target.hipsHeight - (lowest(tWorld, feetT) - floorT);
      if (Math.abs(dy) > 1e-7) {
        travel.y += dy;
        hipsLocal.copy(refHipsT).add(travel).applyMatrix4(hipsParentInverse);
        hipsLocal.toArray(hipsTrack, f * 3);
        for (const i of underHips) tWorld[i].elements[13] += dy;
        pinned = Math.max(pinned, Math.abs(dy) / target.hipsHeight);
      }
    }
    for (const value of hipsTrack.subarray(f * 3, f * 3 + 3)) if (!Number.isFinite(value)) return { reason: 'the fit came out non-finite' };
  }
  if (moved < .02) return { reason: 'the clip moves no joint the two rigs share' };
  if (stray > STRAY) return { reason: `the rigs disagree: the ${strayJoint} strays ${Math.round(stray)} degrees from the source's` };
  const out: THREE.KeyframeTrack[] = [], ends = [0, clip.duration];
  const held = (name: string, property: 'position' | 'quaternion' | 'scale', value: THREE.Vector3 | THREE.Quaternion) => {
    const values = [...value.toArray(), ...value.toArray()];
    out.push(property === 'quaternion' ? new THREE.QuaternionKeyframeTrack(`${name}.${property}`, ends, values) : new THREE.VectorKeyframeTrack(`${name}.${property}`, ends, values));
  };
  for (const i of targetChain) {
    if (i === 0) continue;
    const name = target.nodes[i].name, entry = targetShared.get(i);
    if (!entry || (options.ownHands && HANDS.has(entry.joint))) { held(name, 'position', target.refP[i]); held(name, 'quaternion', (entry && options.grip?.[entry.joint]) || target.refQ[i]); held(name, 'scale', target.refS[i]); continue; }
    const values = rotations.get(i)!;
    for (const value of values) if (!Number.isFinite(value)) return { reason: 'the fit came out non-finite' };
    out.push(new THREE.QuaternionKeyframeTrack(`${name}.quaternion`, times, values));
    if (i === hipsT) out.push(new THREE.VectorKeyframeTrack(`${name}.position`, times, hipsTrack));
    else held(name, 'position', target.refP[i]);
  }
  return { clip: new THREE.AnimationClip(clip.name, clip.duration, out), stray, pinned };
}
