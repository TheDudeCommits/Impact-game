import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { FIGHTERS } from '../src/config';
import { IDLE_PROFILES } from '../src/render/idle/profile';
import { Fighter, bindClips } from '../src/render/Fighter';
import { glbJson } from './extraClips';
import { base, loadRig } from './rigHarness';
import { ORIGINALS } from '../src/originals/roster';

const OLD = {
  body: '/assets/fighters/konta-adult3.glb',
  extras: ['enders1', 'fanim1', 'fanim2', 'fanim3'].map(f => `/assets/fighters/konta-${f}.glb`),
  idle: '/assets/fighters/konta-idle1.glb',
  rush: '/assets/fighters/konta-rush1.glb',
};
/** Where the game stood adult3 (Fighter's automatic normalisation off `_Idle`'s first frame). */
const GAME_SCALE = 1.0934350545773837, GAME_OFFSET = new THREE.Vector3(0.034043933905943374, -1.0113249220726348, -0.33437842741558116);
/** The joints adult3's own clips slide (the headband's knot, twist helpers, jacket flaps, the sleeve): translation keyed
 *  on these and on Hips, nowhere else. */
const SLIDING = new Set(['Detail_CLOTH_ponytail01', 'LeftForeArmBend1', 'LeftForeArmBend2', 'LeftForeArmBend3', 'RightForeArmBend1',
  'RightForeArmBend2', 'RightForeArmBend3', 'left_wear', 'right_wear', 'back_wear', 'front_wear', 'right_sleeve', 'LeftUpLegBend01',
  'LeftUpLegBend02', 'RightUpLegBend01', 'RightUpLegBend02', 'LeftLegBend01', 'LeftLegBend02', 'LeftLegBend03', 'RightLegBend01',
  'RightLegBend02', 'RightLegBend03']);
/** The headband's tails, keyed hanging (scripts/konta/apose.py `tail_dir`). */
const TAILS = /^Detail_CLOTH_(left|right)_ponytail0[123]$/;
/** The sleeves' cloth bones hang off the forearms' last twist helpers, which now share the hand's twist (PR 3): they
 *  move a few millimetres with it. */
const SLEEVES = /_sleeve$/;
/** PR 3, the takes: the clips changed on purpose (scripts/konta/build_canon.py `fix_clip`), each held to its own rule
 *  below and, in the equality, to everything it did not set out to move: the light's root lifted onto the floor and
 *  the landings brought down onto it (so their joints are compared off the hips, the landings' legs apart), and a knee
 *  and an elbow turned to the right side of their hinge (the joints the turn moves; the hip or shoulder, and the foot
 *  or hand, stay put). */
const LEGS = /^(Left|Right)(UpLeg|Leg|Foot|ToeBase|UpLegBend0\d|LegBend0\d)$|^(left|right)_hem$/;
const FIXED: Record<string, { root?: true; limb?: RegExp; mm?: number }> = {
  'Konta light': { root: true },
  // The landings (scripts/konta/build_canon.py `fix_landing`): the hips lowered, the legs re-reached to their feet.
  'Jump Fall': { root: true, limb: LEGS },
  'Whirlsphere Dive': { root: true, limb: LEGS },
  // The turned limb is keyed at 60 fps across the turn: between those keys the foot or hand strays a few millimetres.
  'Rush 2': { limb: /^Right(Leg|LegBend0\d|UpLegBend0\d)$|^right_hem$/, mm: 5 },
  'air Attack 02': { limb: /^Left(ForeArm|ArmBend\d|ForeArmBend\d)$|^acce01$/, mm: 5 },
};
/** 8 October 2026, the moves pass (scripts/konta/repair_limbs.py): limbs folded the wrong way round their hinges
 *  (Rush 1's right elbow 153 degrees round, Hit 01's 111, Rush 3's left knee 103, air Attack 01's left elbow 137)
 *  rolled about their own line onto the hinge. No joint moves, but the sleeve's crest rides the upper arm's turned twist
 *  helper, and the repaired channels' keys interpolate a few millimetres differently at the fingers and shins. */
const REPAIRED = new Set(['air Attack 01', 'air Attack 02', 'Die fall', 'Hit 01', 'jump', 'Jump Fall', 'Rush 1', 'Rush 2', 'Rush 3',
  'Whirlsphere charge', 'slammed',
  // The follow-up (the coordinator: "the milder sideways bends (dash, idle)"): folds 45-70 degrees round, eased in.
  'Dash', '_Idle', 'Jump spin', 'Whirlsphere Ready', 'Whirlsphere charge Clone', 'down_end', 'down_lp', 'stun', 'Whirlsphere Dive']);
/** And hands wrung past what a forearm turns, turned back about the forearm's line (repair_limbs.py `clamp_twist`):
 *  Rush 2's right hand 215 -> 120 degrees. Every repaired clip goes through it (rolling an arm onto its hinge turns
 *  the hand on its forearm). The palm rolls, so the hand's own joints are left out of the equality; the arm up to the
 *  wrist is held to it. */
const TWIST_CLAMPED = REPAIRED;
const HAND = /^(Left|Right)Hand/;
/** The limbs' twist helpers, which the repair turns to share the roll and the twist (they sit a few millimetres off
 *  their bones' lines, so turning them moves them that much): left out of the repaired clips' equality. */
const HELPER = /^(Left|Right)(ArmBend\d|ForeArmBend\d|UpLegBend0\d|LegBend0\d)$|_hem$/;
const REAUTHORED = new Set(['Konta heavy', 'Konta special', 'Konta ultimate', 'Konta light']);
const def = FIGHTERS.konta;
const files = () => [def.model, ...(def.extraModels ?? []), ...(IDLE_PROFILES.konta?.model ? [IDLE_PROFILES.konta.model] : []), ...(def.rushModel ? [def.rushModel] : [])];

type Interp = { evaluate(t: number): ArrayLike<number> };
const interpolant = (track: THREE.KeyframeTrack) => (track as unknown as { createInterpolant(): Interp }).createInterpolant();
const parse = (name: string) => THREE.PropertyBinding.parseTrackName(name);

/** The clips the game plays for him, by name, as FighterLibrary resolves them (the body's, then each extra file's and
 *  the idle file's, a later one replacing an earlier; the rush file's only where a name is free) - and for each, the
 *  clip it replaced, which fills what it leaves out. */
function plays(sets: { file: string; clips: THREE.AnimationClip[] }[], rush?: THREE.AnimationClip[]) {
  const out = new Map<string, { clip: THREE.AnimationClip; replaced?: THREE.AnimationClip }>();
  for (const { clips } of sets) for (const clip of clips) out.set(clip.name, { clip, replaced: out.get(clip.name)?.clip });
  for (const clip of rush ?? []) {
    const at = out.get(clip.name);
    if (!at) out.set(clip.name, { clip });
    else if (!at.replaced && !sets[0].clips.includes(at.clip)) at.replaced = clip;
  }
  return out;
}

/** Pose `scene` as `clip` plays at `t`: every node from its rest, then the clip's channels, then (old files) the
 *  replaced clip's where the clip has none. */
const rests = new WeakMap<THREE.Object3D, Map<THREE.Object3D, [THREE.Vector3, THREE.Quaternion, THREE.Vector3]>>();
function poser(scene: THREE.Object3D, clip: THREE.AnimationClip, replaced?: THREE.AnimationClip) {
  // The scene's rest, read once: a scene posed by the clip before must not lend that pose to this one.
  let rest = rests.get(scene);
  if (!rest) {
    const at = new Map<THREE.Object3D, [THREE.Vector3, THREE.Quaternion, THREE.Vector3]>();
    scene.traverse(o => at.set(o, [o.position.clone(), o.quaternion.clone(), o.scale.clone()]));
    rests.set(scene, rest = at);
  }
  const bound: { node: THREE.Object3D; property: string; at: Interp }[] = [];
  const seen = new Set<string>();
  for (const source of [clip, replaced]) for (const track of source?.tracks ?? []) {
    const { nodeName, propertyName } = parse(track.name);
    if (seen.has(nodeName + '.' + propertyName)) continue;
    const node = THREE.PropertyBinding.findNode(scene, nodeName) as THREE.Object3D | null;
    if (!node) continue;
    seen.add(nodeName + '.' + propertyName);
    bound.push({ node, property: propertyName, at: interpolant(track) });
  }
  return (t: number) => {
    for (const [node, [p, q, s]] of rest!) { node.position.copy(p); node.quaternion.copy(q); node.scale.copy(s); }
    for (const { node, property, at } of bound) {
      const v = at.evaluate(Math.min(t, clip.duration));
      if (property === 'quaternion') node.quaternion.fromArray(Array.from(v)).normalize();
      else if (property === 'position') node.position.fromArray(Array.from(v));
      else if (property === 'scale') node.scale.fromArray(Array.from(v));
    }
    scene.updateMatrixWorld(true);
  };
}

const rigs = new Map<string, Promise<GLTF>>();
const rig = (url: string) => { if (!rigs.has(url)) rigs.set(url, loadRig(url)); return rigs.get(url)!; };

describe.skipIf(!!ORIGINALS.konta)('Konta\'s canonical rig', () => {
  it('is one skeleton in metres: no twins, no node scale, Hips under the root, every joint skinned', () => {
    const body = glbJson(def.model);
    const names = body.nodes.map(n => n.name ?? '');
    expect(names.filter(n => /_scaleCompensation$|^_rootJoint$|^win2$|^Object_4/.test(n)), 'twins and the old root').toEqual([]);
    expect(body.nodes.filter(n => n.scale && n.scale.some(s => Math.abs(s - 1) > 1e-6)).map(n => n.name), 'scaled nodes').toEqual([]);
    const joints = body.skins![0].joints, parent = new Map<number, number>();
    body.nodes.forEach((n, i) => n.children?.forEach(c => parent.set(c, i)));
    const hips = names.indexOf('Hips');
    expect(joints).toContain(hips);
    expect(names[parent.get(hips)!], 'Hips hangs off the root node').toBe('Konta');
    expect(joints.length, 'joints').toBe(152);
    for (const j of joints) expect(j === hips || joints.includes(parent.get(j)!), `${names[j]}'s parent is a joint`).toBe(true);
  });

  it('is bound in a symmetric A-pose, facing +Z, the feet on y = 0', async () => {
    const { scene } = await rig(def.model);
    scene.updateMatrixWorld(true);
    const at = (name: string) => scene.getObjectByName(name)!.getWorldPosition(new THREE.Vector3());
    const pairs: string[] = [];
    scene.traverse(o => { if ((o as THREE.Bone).isBone && /^Left/.test(o.name) && scene.getObjectByName(o.name.replace(/^Left/, 'Right'))) pairs.push(o.name); });
    expect(pairs.length, "left joints with a right twin").toBe(34);
    const core = ['UpLeg', 'Leg', 'Foot', 'ToeBase', 'Shoulder', 'Arm', 'ForeArm', 'Hand'];
    for (const name of pairs) {
      const l = at(name), r = at(name.replace(/^Left/, 'Right'));
      const off = Math.hypot(l.x + r.x, l.y - r.y, l.z - r.z);
      // The core mirrors to a millimetre or so; fingers and twist helpers to the mesh's own asymmetry.
      expect(off, `${name} against its right twin`).toBeLessThan(core.includes(name.slice(4)) ? .004 : .02);
      if (core.includes(name.slice(4))) expect(l.x, `${name} is on +X`).toBeGreaterThan(0);
    }
    const arm = at('LeftForeArm').sub(at('LeftArm')).normalize();
    expect(THREE.MathUtils.radToDeg(Math.asin(-arm.y)), 'the arms 45 degrees down').toBeCloseTo(45, 0);
    const shin = at('LeftFoot').sub(at('LeftLeg')).normalize();
    expect(shin.y, 'straight legs').toBeLessThan(-.999);
    const eyes = at('eyeup_L').sub(at('eyeup_R'));
    expect(Math.abs(eyes.z) + Math.abs(eyes.y), 'eyes level, looking +Z').toBeLessThan(.002);
    const box = new THREE.Box3();
    scene.traverse(o => { const m = o as THREE.SkinnedMesh; if (m.isSkinnedMesh) { m.computeBoundingBox(); box.union(new THREE.Box3().setFromObject(m)); } });
    expect(Math.abs(box.min.y), 'the soles on y = 0').toBeLessThan(.001);
  });

  it('keys every joint\'s rotation in every clip; translation on Hips and the sliding helpers only; no scale', async () => {
    const owner = new Map<string, string>();
    for (const url of files()) {
      const { scene, animations } = await rig(url);
      const joints: string[] = [];
      scene.traverse(o => { if (o.name && o.name !== 'Konta' && !(o as THREE.Mesh).isMesh && o !== scene && o.parent) joints.push(o.name); });
      for (const clip of animations) {
        expect(owner.get(clip.name), `${clip.name} is in ${owner.get(clip.name)} and ${url}`).toBeUndefined();
        owner.set(clip.name, url);
        const by = (p: string) => new Set(clip.tracks.filter(t => parse(t.name).propertyName === p).map(t => parse(t.name).nodeName));
        const turned = by('quaternion'), moved = by('position');
        expect(joints.filter(j => !turned.has(j)), `${clip.name}: joints it does not turn`).toEqual([]);
        expect([...moved].filter(j => j !== 'Hips' && !SLIDING.has(j)), `${clip.name}: translated`).toEqual([]);
        expect(moved.has('Hips'), `${clip.name}: the root`).toBe(true);
        for (const j of SLIDING) expect(moved.has(j), `${clip.name}: ${j} keyed in every clip`).toBe(true);
        expect(by('scale').size, `${clip.name}: scale keys`).toBe(0);
      }
    }
    // rush1.glb's clips never played (fanim2's Rush 1-3 shadowed them): the rush file is the stages that did.
    expect(def.rushModel, 'the rush file').toBe('/assets/fighters/konta-rush2.glb');
    expect((await rig(def.rushModel!)).animations.map(c => c.name).sort()).toEqual(['Rush 1', 'Rush 2', 'Rush 3']);
  }, 120_000);

  it('hangs the headband\'s tails down his back in every clip, not straight out behind his head', async () => {
    const knot = new THREE.Vector3(), tip = new THREE.Vector3(), up = new THREE.Vector3(), q = new THREE.Quaternion();
    for (const url of files()) for (const clip of (await rig(url)).animations) {
      const now = (await rig(def.model)).scene, pose = poser(now, clip);
      for (const t of [0, clip.duration / 2, clip.duration]) {
        pose(t);
        up.set(1, 0, 0).applyQuaternion(now.getObjectByName('Spine1')!.getWorldQuaternion(q));
        const down = new THREE.Vector3(0, -1, 0).sub(up).normalize();
        for (const side of ['left', 'right']) {
          now.getObjectByName(`Detail_CLOTH_${side}_ponytail01`)!.getWorldPosition(knot);
          now.getObjectByName(`Detail_CLOTH_${side}_ponytail03`)!.getWorldPosition(tip);
          // Lying down, it lies along the floor instead (y = 0 in every clip), never through it.
          if (tip.y < .06) { expect(tip.y, `${clip.name} at ${t.toFixed(2)} s: the ${side} tail over the floor`).toBeGreaterThan(0); continue; }
          const off = THREE.MathUtils.radToDeg(tip.sub(knot).angleTo(down));
          expect(off, `${clip.name} at ${t.toFixed(2)} s: the ${side} tail, degrees off hanging`).toBeLessThan(25);
        }
      }
    }
  }, 120_000);

  it('plays what the old files played, joint for joint, within a millimetre on every frame', async () => {
    const before = plays(await Promise.all([OLD.body, ...OLD.extras, OLD.idle].map(async file => ({ file, clips: (await rig(file)).animations }))),
      (await rig(OLD.rush)).animations);
    const after = plays(await Promise.all([def.model, ...(def.extraModels ?? []), IDLE_PROFILES.konta!.model!].map(async file => ({ file, clips: (await rig(file)).animations }))),
      (await rig(def.rushModel!)).animations);
    expect([...after.keys()].sort()).toEqual([...before.keys()].sort());
    const old = (await rig(OLD.body)).scene, now = (await rig(def.model)).scene;
    const joints: [THREE.Object3D, THREE.Object3D][] = [];
    now.traverse(o => { if ((o as THREE.Bone).isBone && !TAILS.test(o.name) && !SLEEVES.test(o.name)) joints.push([o, old.getObjectByName(o.name)!]); });
    const hipsNew = now.getObjectByName('Hips')!, hipsOld = old.getObjectByName('Hips')!, lift = new THREE.Vector3(), h = new THREE.Vector3();
    expect(joints.every(([, o]) => !!o)).toBe(true);
    const report: Record<string, number> = {};
    const p = new THREE.Vector3(), q = new THREE.Vector3();
    for (const [name, { clip, replaced }] of before) {
      const mine = after.get(name)!.clip;
      expect(mine.duration, `${name}'s length`).toBeCloseTo(clip.duration, 4);
      if (REAUTHORED.has(name)) continue;
      const poseOld = poser(old, clip, replaced), poseNew = poser(now, mine);
      const times = new Set<number>();
      for (const t of mine.tracks) for (const k of t.times) times.add(k);
      for (let t = 0; t < clip.duration; t += 1 / 60) times.add(t);
      let worst = 0;
      const fix = FIXED[name];
      for (const t of times) {
        poseOld(t); poseNew(t);
        // The light's root is lifted onto the floor: its body compared off its hips.
        if (fix?.root) lift.copy(hipsNew.getWorldPosition(h)).sub(hipsOld.getWorldPosition(p).multiplyScalar(GAME_SCALE).add(GAME_OFFSET));
        else lift.set(0, 0, 0);
        for (const [n, o] of joints) {
          if (fix?.limb?.test(n.name) || REPAIRED.has(name) && (n.name === 'acce01' || HELPER.test(n.name)) || TWIST_CLAMPED.has(name) && HAND.test(n.name)) continue;
          o.getWorldPosition(p).multiplyScalar(GAME_SCALE).add(GAME_OFFSET);
          worst = Math.max(worst, n.getWorldPosition(q).sub(lift).distanceTo(p));
        }
      }
      report[name] = +(worst * 1000).toFixed(3);
    }
    fs.mkdirSync('output/konta', { recursive: true });
    fs.writeFileSync('output/konta/canon-equality.json', JSON.stringify(report, null, 1));
    for (const [name, mm] of Object.entries(report)) expect(mm, `${name}: worst joint, mm`).toBeLessThan(Math.max(FIXED[name]?.mm ?? 1, REPAIRED.has(name) ? 6 : 1));
  }, 240_000);

  it('keeps a foot planted through the light: its root no longer drops through the floor (PR 3)', async () => {
    const gltf = await rig(def.model), clip = (await rig(def.extraModels![0])).animations.find(c => c.name === 'Konta light')!;
    const scene = gltf.scene, pose = poser(scene, clip);
    const feet: { mesh: THREE.SkinnedMesh; index: number }[] = [];
    scene.traverse(o => {
      const mesh = o as THREE.SkinnedMesh; if (!mesh.isSkinnedMesh) return;
      const J = mesh.geometry.attributes.skinIndex, W = mesh.geometry.attributes.skinWeight;
      for (let i = 0; i < J.count; i++) {
        let share = 0;
        for (let k = 0; k < 4; k++) if (/^(Left|Right)(Foot|ToeBase)$/.test(mesh.skeleton.bones[J.getComponent(i, k)].name)) share += W.getComponent(i, k);
        if (share > .5) feet.push({ mesh, index: i });
      }
    });
    expect(feet.length).toBeGreaterThan(500);
    const v = new THREE.Vector3();
    let lowest = Infinity, highest = -Infinity;
    for (let t = 0; t <= clip.duration + 1e-9; t += 1 / 60) {
      pose(t);
      let low = Infinity;
      for (const { mesh, index } of feet) low = Math.min(low, mesh.getVertexPosition(index, v).applyMatrix4(mesh.matrixWorld).y);
      lowest = Math.min(lowest, low); highest = Math.max(highest, low);
    }
    expect(lowest, 'the lowest sole, m').toBeGreaterThan(-.01);
    expect(highest, 'and never off the floor').toBeLessThan(.03);
  }, 120_000);

  it('lands Jump Fall and the Dive on the floor as the game draws them (PR 3)', async () => {
    // The game holds a jump's or an attack's root near the hips of _Idle's first frame (Fighter.limitRootMotion's
    // rootReference), softly capped: cap * tanh(offset / cap), by JUMP_ROOT (rise .06, drop .14) in the air and by his
    // config rootMotion (rise .14, drop .18) in an attack. Jump Fall is laid across the descent, so its end is the
    // touchdown: keyed standing tall, it was drawn 16 cm through the floor there. The Dive's crouch after its blow
    // (played 0.75-2.2 s, the blow at 1.2) was keyed 44 cm in the air and drawn 37 cm over the floor.
    const gltf = await rig(def.model), scene = gltf.scene;
    const feet: { mesh: THREE.SkinnedMesh; index: number }[] = [];
    scene.traverse(o => {
      const mesh = o as THREE.SkinnedMesh; if (!mesh.isSkinnedMesh) return;
      const J = mesh.geometry.attributes.skinIndex, W = mesh.geometry.attributes.skinWeight;
      for (let i = 0; i < J.count; i++) {
        let share = 0;
        for (let k = 0; k < 4; k++) if (/^(Left|Right)(Foot|ToeBase)$/.test(mesh.skeleton.bones[J.getComponent(i, k)].name)) share += W.getComponent(i, k);
        if (share > .5) feet.push({ mesh, index: i });
      }
    });
    const v = new THREE.Vector3(), hips = scene.getObjectByName('Hips')!;
    const idle = gltf.animations.find(c => c.name === '_Idle')!;
    poser(scene, idle)(0);
    const reference = hips.getWorldPosition(v).y;
    expect(reference, 'the root reference, m').toBeCloseTo(.69, 2);
    /** The lowest sole as drawn: the clip's, moved by however far the cap holds the hips off where they are keyed. */
    const drawn = (rise: number, drop: number) => {
      const up = hips.getWorldPosition(v).y - reference, cap = up >= 0 ? rise : drop;
      let low = Infinity;
      for (const { mesh, index } of feet) low = Math.min(low, mesh.getVertexPosition(index, v).applyMatrix4(mesh.matrixWorld).y);
      return low + cap * Math.tanh(up / cap) - up;
    };
    const fall = gltf.animations.find(c => c.name === 'Jump Fall')!, poseFall = poser(scene, fall);
    poseFall(fall.duration);
    expect(drawn(.06, .14), 'Jump Fall at the touchdown: the lowest sole as drawn, m').toBeGreaterThan(-.015);
    const dive = (await rig(def.extraModels![0])).animations.find(c => c.name === 'Whirlsphere Dive')!, poseDive = poser(scene, dive);
    let lowest = Infinity, highest = -Infinity;
    for (let t = 1.25; t <= 2.2 + 1e-9; t += 1 / 30) {
      poseDive(t);
      const low = drawn(.14, .18);
      lowest = Math.min(lowest, low); highest = Math.max(highest, low);
    }
    expect(lowest, 'the Dive after its blow: the lowest sole as drawn, m').toBeGreaterThan(-.015);
    expect(highest, 'and never off the floor').toBeLessThan(.02);
  }, 120_000);

  it('holds the jacket flaps in their own cone, not the headband tails\' droop (PR 3)', async () => {
    // Konta's SPRING_PROFILES row is the tails' settings, and a chain takes what it does not set from it: the flaps
    // were given the tails' droop (no higher than 95 degrees off straight down) and held 46-75 degrees off the clip
    // at idle. In their own 10 degree cone they follow the clip and swing a few degrees in a run (scripts/konta/
    // springs_ab.mts). Driven as the game drives him, at 60 Hz.
    const source = await rig(def.model) as GLTF & { animations: THREE.AnimationClip[] };
    const rush = bindClips(source.scene, (await rig(def.rushModel!)).animations, 'konta');
    for (const url of [...(def.extraModels ?? []), IDLE_PROFILES.konta!.model!]) {
      const clips = bindClips(source.scene, (await rig(url)).animations, 'konta'), names = new Set(clips.map(c => c.name));
      source.animations = [...source.animations.filter(c => !names.has(c.name)), ...clips];
    }
    const fighter = new Fighter(base('konta'), source, false, rush) as unknown as {
      model: THREE.Object3D; secondary?: { nodes: { bone: THREE.Bone; parent: THREE.Object3D; authored: THREE.Quaternion; axis: THREE.Vector3 }[] };
      update(dt: number, state: ReturnType<typeof base>, local: boolean): void; dispose?(): void };
    const flaps = (fighter.secondary?.nodes ?? []).filter(n => /_wear$/.test(n.bone.name));
    expect(flaps.length, 'sprung flaps').toBe(4);
    const v = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), m = new THREE.Matrix4(), w = new THREE.Matrix4();
    const deflection = () => Math.max(...flaps.map(n => {
      m.compose(n.bone.position, n.authored, n.bone.scale); w.multiplyMatrices(n.parent.matrixWorld, m).decompose(v, q, sc);
      const rest = n.axis.clone().applyQuaternion(q); n.bone.matrixWorld.decompose(v, q, sc);
      return THREE.MathUtils.radToDeg(rest.angleTo(n.axis.clone().applyQuaternion(q)));
    }));
    let x = 0, idle = 0, run = 0;
    for (let i = 0; i < 150; i++) {
      fighter.update(1 / 60, { ...base('konta'), action: 'idle', actionTime: i / 60 }, true);
      if (i >= 60) idle = Math.max(idle, deflection());
    }
    for (let i = 0; i < 90; i++) {
      x += 7.5 / 60;
      fighter.update(1 / 60, { ...base('konta'), action: 'run', x, actionTime: i / 60 }, true);
      run = Math.max(run, deflection());
    }
    fighter.dispose?.();
    expect(idle, 'flaps off the clip at idle, degrees').toBeLessThan(3);
    expect(run, 'flaps off the clip in a run, degrees').toBeLessThan(10.5);
  }, 120_000);

  it('bends the knee in Rush 2 and the elbow in air Attack 02 the right way (PR 3)', async () => {
    // Flexion is a turn about the joint's local -Z: the lower bone swings toward the upper bone's -Y.
    const check = async (url: string, name: string, upper: string, lower: string, end: string) => {
      const scene = (await rig(def.model)).scene, clip = (await rig(url)).animations.find(c => c.name === name)!, pose = poser(scene, clip);
      const a = scene.getObjectByName(upper)!, b = scene.getObjectByName(lower)!, c = scene.getObjectByName(end)!;
      const pb = new THREE.Vector3(), pc = new THREE.Vector3(), q = new THREE.Quaternion();
      let worst = 0;
      for (let t = 0; t <= clip.duration + 1e-9; t += 1 / 60) {
        pose(t);
        const d = pc.copy(c.getWorldPosition(pc)).sub(b.getWorldPosition(pb)).normalize().applyQuaternion(a.getWorldQuaternion(q).invert());
        const bend = THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(d.x, -1, 1)));
        const wrong = Math.abs(THREE.MathUtils.radToDeg(Math.atan2(d.z, -d.y)));
        if (bend > 12 && wrong > 155) worst = Math.max(worst, bend);
      }
      expect(worst, `${name}: ${lower} bent the wrong way, degrees`).toBe(0);
    };
    await check(def.rushModel!, 'Rush 2', 'RightUpLeg', 'RightLeg', 'RightFoot');
    await check(def.model, 'air Attack 02', 'LeftArm', 'LeftForeArm', 'LeftHand');
  }, 120_000);

  it('bends every elbow and knee on its hinge, and keeps the feet on the floor as drawn, in the re-authored takes', async () => {
    // The moves pass's takes (REAUTHORED) are posed by two-bone IK on the hinges (scripts/konta/rigkit.py): no limb
    // folds the wrong way, no hand passes into the torso, and a foot is on the floor (as the game draws the hips: its
    // attack caps, rise .14, drop .18, round _Idle's first frame) on every frame he is not in the air.
    const scene = (await rig(def.model)).scene;
    const idle = (await rig(def.model)).animations.find(c => c.name === '_Idle')!;
    poser(scene, idle)(0);
    const hips = scene.getObjectByName('Hips')!, reference = hips.getWorldPosition(new THREE.Vector3()).y;
    const sources = new Map<string, THREE.AnimationClip>();
    for (const url of [def.model, ...(def.extraModels ?? [])]) for (const clip of (await rig(url)).animations) if (REAUTHORED.has(clip.name)) sources.set(clip.name, clip);
    expect([...sources.keys()].sort()).toEqual([...REAUTHORED].sort());
    const pb = new THREE.Vector3(), pc = new THREE.Vector3(), q = new THREE.Quaternion(), v = new THREE.Vector3();
    for (const [name, clip] of sources) {
      const pose = poser(scene, clip);
      let wrong = 0, lowest = Infinity, highest = -Infinity, inside = 0;
      for (let t = 0; t <= clip.duration + 1e-9; t += 1 / 60) {
        pose(t);
        for (const [a, b, c] of [['LeftArm', 'LeftForeArm', 'LeftHand'], ['RightArm', 'RightForeArm', 'RightHand'], ['LeftUpLeg', 'LeftLeg', 'LeftFoot'], ['RightUpLeg', 'RightLeg', 'RightFoot']]) {
          const d = pc.copy(scene.getObjectByName(c)!.getWorldPosition(pc)).sub(scene.getObjectByName(b)!.getWorldPosition(pb)).normalize()
            .applyQuaternion(scene.getObjectByName(a)!.getWorldQuaternion(q).invert());
          const bend = THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(d.x, -1, 1)));
          if (bend > 12 && Math.abs(THREE.MathUtils.radToDeg(Math.atan2(d.z, -d.y))) > 90) wrong = Math.max(wrong, bend);
        }
        // The lowest ankle as drawn (the soles are 11 cm under the ankles standing flat).
        const up = hips.getWorldPosition(v).y - reference, cap = up >= 0 ? .14 : .18, shift = cap * Math.tanh(up / cap) - up;
        const ankle = Math.min(scene.getObjectByName('LeftFoot')!.getWorldPosition(pb).y, scene.getObjectByName('RightFoot')!.getWorldPosition(pc).y) + shift;
        lowest = Math.min(lowest, ankle); highest = Math.max(highest, ankle);
        // A hand inside the torso: closer than 10 cm to the hips-to-neck line.
        const a = scene.getObjectByName('Hips')!.getWorldPosition(new THREE.Vector3()), n = scene.getObjectByName('Neck')!.getWorldPosition(new THREE.Vector3());
        for (const side of ['Left', 'Right']) {
          const h = scene.getObjectByName(`${side}HandMiddle1`)!.getWorldPosition(new THREE.Vector3());
          const line = n.clone().sub(a), u = THREE.MathUtils.clamp(h.clone().sub(a).dot(line) / line.lengthSq(), 0, 1);
          inside = Math.max(inside, .10 - h.distanceTo(a.clone().addScaledVector(line, u)));
        }
      }
      expect(wrong, `${name}: an elbow or knee bent the wrong way, degrees`).toBe(0);
      expect(lowest, `${name}: the lowest ankle as drawn, m (11 cm is the sole on the floor)`).toBeGreaterThan(.095);
      expect(highest, `${name}: and a foot down at the start and the end`).toBeGreaterThan(.1);
      expect(inside, `${name}: a hand inside the torso, m`).toBeLessThanOrEqual(0);
    }
  }, 120_000);

  it('spreads the hand\'s twist along the forearm instead of wringing the wrist (PR 3)', async () => {
    const scene = (await rig(def.model)).scene;
    scene.updateMatrixWorld(true);
    const relative = (a: THREE.Object3D, b: THREE.Object3D) => a.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(b.getWorldQuaternion(new THREE.Quaternion()));
    const twist = (q: THREE.Quaternion) => { const sign = q.w < 0 ? -1 : 1; return THREE.MathUtils.radToDeg(2 * Math.atan2(sign * q.x, sign * q.w)); };
    const bind = new Map(['Left', 'Right'].flatMap(side => [
      [`${side}3`, relative(scene.getObjectByName(`${side}ForeArmBend3`)!, scene.getObjectByName(`${side}Hand`)!)],
      [`${side}F`, relative(scene.getObjectByName(`${side}ForeArm`)!, scene.getObjectByName(`${side}Hand`)!)],
    ]));
    for (const url of [def.model, def.extraModels![0], def.rushModel!, IDLE_PROFILES.konta!.model!]) for (const clip of (await rig(url)).animations) {
      const pose = poser(scene, clip);
      for (const side of ['Left', 'Right']) {
        const forearm = scene.getObjectByName(`${side}ForeArm`)!, bend3 = scene.getObjectByName(`${side}ForeArmBend3`)!, hand = scene.getObjectByName(`${side}Hand`)!;
        // At 120 Hz: the takes snap (the light's right forearm rolls a whole turn under the hand in 30 ms), and a
        // coarser count would read a whole turn as a turn back.
        let worst = 0, over = 0, low = Infinity, high = -Infinity, turned = 0, last = NaN;
        for (let t = 0; t <= clip.duration + 1e-9; t += 1 / 120) {
          pose(t);
          const wrist = Math.abs(twist(relative(bend3, hand).multiply(bind.get(`${side}3`)!.clone().invert())));
          worst = Math.max(worst, wrist);
          if (wrist > 125) over += 1 / 120;
          const own = twist(relative(forearm, hand).multiply(bind.get(`${side}F`)!.clone().invert()));
          turned = Number.isNaN(last) ? own : turned + (own - last) - 360 * Math.round((own - last) / 360);
          last = own; low = Math.min(low, turned); high = Math.max(high, turned);
        }
        if (high - low < 270) expect(worst, `${clip.name}: the ${side.toLowerCase()} wrist's own twist, degrees`).toBeLessThan(125);
        // A hand that turns a whole turn round its forearm (the special's right, lifting the Galewheel; the light's
        // right, its forearm rolling round under the fist in a snap) has to wring the skin once on the way, wherever the
        // turn is shared: it passes the wrist, for the moment the hand spins through it (scripts/konta/build_canon.py
        // `twist_share`), and the clip goes on unwrung.
        else expect(over, `${clip.name}: ${side.toLowerCase()} hand turns ${(high - low).toFixed(0)} degrees; seconds its wrist wrings past 125`).toBeLessThanOrEqual(.1);
      }
    }
  }, 240_000);
});
