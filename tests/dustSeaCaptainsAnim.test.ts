import { beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { FIGHTERS } from '../src/config';
import { bindClips } from '../src/render/Fighter';
import { COMBO_CLIPS } from '../src/render/comboClips';
import { IDLE_PROFILES } from '../src/render/idle/profile';
import type { FighterId } from '../src/game/types';
import { loadRig } from './rigHarness';
import { ORIGINALS } from '../src/originals/roster';
import { guardTakes, type Take } from './takeGuard';

/** The Dust Sea captains' pass (9 October 2026): Gorai, Haldor, Sorrel
 *  and Dorado, measured on each body as the game binds it (the body's clips, then `extraModels` in order, a later file's
 *  clip replacing one of the same name). Lengths in each body's own units, against its idle: the floor is the idle's
 *  lowest toe, the height its head over that floor. Every behaviour test here fails on the clips before the pass. */
const TAKES: Take[] = [
  ['gorai', 'gorai-fanim3.glb', ['Mast Breaker', 'Hit 01', 'Rivet Ram', 'Quake Stamp', 'Thunderclap Spar', 'Cloudbank Dive'], ['gorai-fanim2.glb']],
  ['haldor', 'haldor-fanim2.glb', ['shake', 'Aftershock', 'Leaping Glaive Chop']],
  ['sorrel', 'sorrel-fanim2.glb', ['Red Tide Ambush', 'Crimson Lightning Chop', 'Falling Wake', 'Maelstrom Edge', 'Dead Calm Glare', 'Horizon Splitting Clash', 'stun', 'Hit 01', 'shake']],
  ['dorado', 'dorado-fanim2.glb', ['HORIZON SUNDER', 'shake']],
];
guardTakes('The captains\' pass: new takes keep their clips\' lengths and key what the body moves', TAKES);

type Rig = { gltf: GLTF; bones: Map<string, THREE.Object3D>; mixer: THREE.AnimationMixer; clips: Map<string, THREE.AnimationClip> };
const rigs = new Map<FighterId, Rig>();

async function rig(id: FighterId): Promise<Rig> {
  if (rigs.has(id)) return rigs.get(id)!;
  const def = FIGHTERS[id];
  const gltf = await loadRig(def.model);
  let clips = [...gltf.animations];
  for (const url of [...def.extraModels ?? [], IDLE_PROFILES[id]?.model]) {
    if (!url) continue;
    const more = bindClips(gltf.scene, (await loadRig(url)).animations, id), names = new Set(more.map(c => c.name));
    clips = [...clips.filter(c => !names.has(c.name)), ...more];
  }
  const bones = new Map<string, THREE.Object3D>();
  gltf.scene.traverse(o => { if (!bones.has(o.name)) bones.set(o.name, o); });
  const r = { gltf, bones, mixer: new THREE.AnimationMixer(gltf.scene), clips: new Map(clips.map(c => [c.name, c])) };
  rigs.set(id, r);
  return r;
}

function pose(r: Rig, clip: string, t: number) {
  const c = r.clips.get(clip);
  if (!c) throw new Error(`no clip ${clip}`);
  r.mixer.stopAllAction();
  const action = r.mixer.clipAction(c);
  action.reset().play();
  action.time = Math.min(t, c.duration);
  r.mixer.update(0);
  r.gltf.scene.updateMatrixWorld(true);
  const bone = (name: string) => { const b = r.bones.get(name); if (!b) throw new Error(`no bone ${name}`); return b; };
  return {
    bone,
    at: (name: string) => bone(name).getWorldPosition(new THREE.Vector3()),
    local: (name: string) => bone(name).quaternion.clone(),
    /** A point along a joint's own axis, `s` of its units out. */
    along: (name: string, axis: THREE.Vector3, s: number) => bone(name).localToWorld(axis.clone().multiplyScalar(s)),
  };
}

/** The idle's floor (its lowest toe), its height (the head over that floor) and a snapshot of its pose: every joint's
 *  world place, its turn and its place on its parent, read now (a later pose moves the same bones). */
function stance(r: Rig) {
  pose(r, '_Idle', 0);
  const at = new Map<string, THREE.Vector3>(), local = new Map<string, THREE.Quaternion>(), offset = new Map<string, THREE.Vector3>();
  r.bones.forEach((b, name) => { at.set(name, b.getWorldPosition(new THREE.Vector3())); local.set(name, b.quaternion.clone()); offset.set(name, b.position.clone()); });
  const get = <T extends { clone(): T }>(m: Map<string, T>, name: string) => { const v = m.get(name); if (!v) throw new Error(`no bone ${name}`); return v.clone(); };
  const p = { at: (name: string) => get(at, name), local: (name: string) => get(local, name), offset: (name: string) => get(offset, name) };
  const floor = Math.min(p.at('LeftToeBase').y, p.at('RightToeBase').y);
  return { floor, height: p.at('Head').y - floor, p };
}

/** The lowest point of a weapon's line (`span` along `axis` of `joint`). */
function lowest(p: ReturnType<typeof pose>, joint: string, axis: THREE.Vector3, span: [number, number]) {
  let low = Infinity;
  for (let k = 0; k <= 12; k++) low = Math.min(low, p.along(joint, axis, span[0] + (span[1] - span[0]) * k / 12).y);
  return low;
}

const times = (from: number, to: number, step = 1 / 60) => { const out: number[] = []; for (let t = from; t <= to + 1e-9; t += step) out.push(t); return out; };
const deg = (a: THREE.Quaternion, b: THREE.Quaternion) => THREE.MathUtils.radToDeg(2 * Math.acos(Math.min(1, Math.abs(a.dot(b)))));
const Z = new THREE.Vector3(0, 0, 1), X = new THREE.Vector3(1, 0, 0);
const CLUB: [number, number] = [-1.7, 7.4], BISENTO: [number, number] = [-2.45, 4.73];

beforeAll(async () => { for (const id of ['gorai', 'haldor', 'sorrel', 'dorado'] as FighterId[]) await rig(id); }, 120_000);

describe('Gorai: Hassaikai swung with weight, and kept out of the floor', () => {
  it.skipIf(!!ORIGINALS.gorai)('the light is one forehand: from his stance, coiled to his right with the club high behind him, round flat onto them', async () => {
    const r = await rig('gorai'), { floor, height, p: idle } = stance(r);
    const L = r.clips.get('Mast Breaker')!.duration;
    for (const t of [0, L]) {
      const p = pose(r, 'Mast Breaker', t);
      for (const j of ['RightHand', 'LeftHand', 'Head']) expect(p.at(j).distanceTo(idle.at(j)) / height, `${j} at ${t.toFixed(3)}`).toBeLessThan(.02);
    }
    // The coil: the club's head behind him on his right, above his head.
    for (const t of [.2, .23]) {
      const p = pose(r, 'Mast Breaker', t), hips = p.at('Hips'), head = p.along('mast_breaker_joint_049', Z, 7);
      const bearing = THREE.MathUtils.radToDeg(Math.atan2(head.x - hips.x, head.z - hips.z));
      expect(bearing, `the club's head round behind his right at ${t}`).toBeLessThan(-110);
      expect(head.y - p.at('Head').y, `the club's head over his own at ${t}`).toBeGreaterThan(0);
    }
    // The blow (0.317 s): the club straight out ahead of him.
    const p = pose(r, 'Mast Breaker', .317), hips = p.at('Hips'), head = p.along('mast_breaker_joint_049', Z, 7);
    expect(Math.abs(THREE.MathUtils.radToDeg(Math.atan2(head.x - hips.x, head.z - hips.z))), 'the club ahead on the blow').toBeLessThan(25);
    // And never through the floor (an earlier take buried it 1.5 m in its recovery).
    for (const t of times(0, L)) expect((lowest(pose(r, 'Mast Breaker', t), 'mast_breaker_joint_049', Z, CLUB) - floor) / height, `the club at ${t.toFixed(3)}`).toBeGreaterThan(-.01);
    // The fist rolls on its forearm through the swing, but never a half turn from his stance's grip, and never faster
    // than 55 degrees a sixtieth of a second (the old take turned it 63 in one).
    const axis = idle.offset('RightHand').normalize(), grip = idle.local('RightHand').invert();
    let last: number | undefined;
    for (const t of times(0, L)) {
      const rel = grip.clone().multiply(pose(r, 'Mast Breaker', t).local('RightHand'));
      const roll = THREE.MathUtils.radToDeg(2 * Math.atan2(rel.x * axis.x + rel.y * axis.y + rel.z * axis.z, rel.w));
      const wrapped = ((roll + 540) % 360) - 180;
      expect(Math.abs(wrapped), `the fist's roll from his grip at ${t.toFixed(3)}`).toBeLessThan(160);
      if (last !== undefined) expect(Math.abs(((wrapped - last + 540) % 360) - 180), `the fist's roll in a frame at ${t.toFixed(3)}`).toBeLessThan(55);
      last = wrapped;
    }
  });

  it.skipIf(!!ORIGINALS.gorai)('his recoil keeps the club in his grip: it goes where his arm goes, never round in his fist or into the floor', async () => {
    const r = await rig('gorai'), { floor, height, p: idle } = stance(r);
    const grip = idle.local('RightHand');
    for (const t of times(0, r.clips.get('Hit 01')!.duration)) {
      const p = pose(r, 'Hit 01', t);
      expect(deg(p.local('RightHand'), grip), `the fist's turn on the forearm at ${t.toFixed(3)}`).toBeLessThan(1);
      expect((lowest(p, 'mast_breaker_joint_049', Z, CLUB) - floor) / height, `the club at ${t.toFixed(3)}`).toBeGreaterThan(-.01);
    }
  });

  it.skipIf(!!ORIGINALS.gorai)('after each slam of the combo enders the club rests on the floor, his fist on top of it, never through it', async () => {
    const r = await rig('gorai'), { floor, height } = stance(r);
    for (const key of ['lh', 'llh', 'lllh', 'airSpecial'] as const) {
      const seg = COMBO_CLIPS.gorai![key]!;
      for (const t of times(seg.from ?? 0, seg.to ?? r.clips.get(seg.clip)!.duration)) {
        const p = pose(r, seg.clip, t);
        expect((lowest(p, 'mast_breaker_joint_049', Z, CLUB) - floor) / height, `${seg.clip}: the club at ${t.toFixed(3)}`).toBeGreaterThan(-.015);
        expect((p.at('RightHand').y - floor) / height, `${seg.clip}: the fist at ${t.toFixed(3)}`).toBeGreaterThan(0);
      }
    }
  });
});

describe('Haldor: the bisento in his hand and out of the floor', () => {
  it.skipIf(!!ORIGINALS.haldor)('his flinch carries the bisento in his hand (it rides a joint of its own, and was left behind 45 cm off the hand)', async () => {
    const r = await rig('haldor');
    for (const t of times(0, r.clips.get('shake')!.duration)) {
      const p = pose(r, 'shake', t), hand = p.at('RightHand'), a = p.along('weapon_jnt_060', Z, 0), b = p.along('weapon_jnt_060', Z, 1);
      const line = b.clone().sub(a).normalize(), off = hand.clone().sub(a);
      const gap = off.sub(line.multiplyScalar(off.dot(line))).length();
      // The idle holds the shaft 0.30 of his units off the wrist joint (the fist round it).
      expect(gap, `the hand on the shaft at ${t.toFixed(3)}`).toBeLessThan(.4);
    }
  });

  it.skipIf(!!ORIGINALS.haldor)('two combo enders no longer leave the blade half a metre down in the floor after their blows', async () => {
    const r = await rig('haldor'), { floor, height } = stance(r);
    for (const key of ['lllh', 'airHeavy'] as const) {
      const seg = COMBO_CLIPS.haldor![key]!;
      for (const t of times(seg.from ?? 0, seg.to ?? r.clips.get(seg.clip)!.duration)) {
        expect((lowest(pose(r, seg.clip, t), 'weapon_jnt_060', Z, BISENTO) - floor) / height, `${seg.clip} at ${t.toFixed(3)}`).toBeGreaterThan(-.02);
      }
    }
  });
});

describe('Sorrel: one arm, and nothing where the other was', () => {
  it('no clip he plays turns his missing arm (the empty sleeve on its stump holds still, as in all his own clips)', async () => {
    const r = await rig('sorrel'), { p: idle } = stance(r);
    const still = ['LeftArm', 'LeftForeArm', 'LeftHand'].map(j => [j, idle.local(j)] as const);
    const played = new Set<string>(['Wake Cutter', 'Redline Thrust', 'Sovereign Will', 'Horizon Sunder', 'Punch 01', 'Run', 'Walk', 'Dash',
      'jump', 'Jump Fall', 'Block', 'Hit 01', 'shake', 'stun', 'slammed', 'down_lp', 'down_end', 'awaken-will', 'victory_lp', 'idle_relaxed', '_Idle']);
    for (const seg of Object.values(COMBO_CLIPS.sorrel!)) played.add(seg!.clip);
    // Sorrel has both arms, his left hanging dead from the shoulder in every clip and swinging after his moves. It
    // turns as a dead arm turns, so what holds is that it never lifts or strikes: the hand at least
    // three fifths of the arm's reach below the shoulder, and the elbow within a few degrees of its idle's bend (it
    // swings with the arm, a dead elbow never folds).
    const dead = !!ORIGINALS.sorrel;
    const reach = idle.at('LeftArm').distanceTo(idle.at('LeftForeArm')) + idle.at('LeftForeArm').distanceTo(idle.at('LeftHand'));
    const bend = (q: { at(j: string): THREE.Vector3 }) => q.at('LeftForeArm').clone().sub(q.at('LeftArm')).angleTo(q.at('LeftHand').clone().sub(q.at('LeftForeArm'))) * 180 / Math.PI;
    for (const name of played) {
      const c = r.clips.get(name);
      expect(c, name).toBeDefined();
      for (const t of times(0, c!.duration, 1 / 30)) {
        const p = pose(r, name, t);
        if (dead) {
          expect((p.at('LeftArm').y - p.at('LeftHand').y) / reach, `${name}: the left hand's drop at ${t.toFixed(2)}`).toBeGreaterThan(.6);
          expect(Math.abs(bend(p) - bend(idle)), `${name}: the left elbow at ${t.toFixed(2)}`).toBeLessThan(3);
          continue;
        }
        for (const [j, q] of still) expect(deg(p.local(j), q), `${name}: ${j} at ${t.toFixed(2)}`).toBeLessThan(2);
      }
    }
  });
});

describe('Dorado: his flinch with his own arms', () => {
  it('every light blow he takes leaves his arms their own length (the flinch stretched them to three to five times)', async () => {
    const r = await rig('dorado'), { p: idle } = stance(r);
    const segs = ['Left', 'Right'].flatMap(s => [[s + 'Arm', s + 'ForeArm'], [s + 'ForeArm', s + 'Hand']]);
    const length = (p: { at(name: string): THREE.Vector3 }, [a, b]: string[]) => p.at(a).distanceTo(p.at(b));
    for (const t of times(0, r.clips.get('shake')!.duration, 1 / 30)) {
      const p = pose(r, 'shake', t);
      for (const s of segs) expect(Math.abs(length(p, s) / length(idle, s) - 1), `${s.join('-')} at ${t.toFixed(2)}`).toBeLessThan(.05);
    }
  });
});



describe('Dorado: HORIZON SUNDER, the blade brought down from on high onto the blow', () => {
  it.skipIf(!!ORIGINALS.dorado)('raised high over his head, it comes down through them into the blow at 1.736 s, and he ends in his stance', async () => {
    const r = await rig('dorado'), { height, p: idle } = stance(r);
    const tip = (t: number) => { const p = pose(r, 'HORIZON SUNDER', t); return { p, tip: p.along('wuqi_bone01_076', X, 1.4), head: p.at('Head') }; };
    // The wind-up: the blade over his head.
    const top = tip(1.58);
    expect(top.tip.y - top.head.y, 'the blade over his head before the cut').toBeGreaterThan(.1 * height);
    const a = tip(1.64), b = tip(1.736);
    expect((a.tip.y - b.tip.y) / height, 'the blade coming down onto the blow').toBeGreaterThan(.25);
    // His stance at the end: what the game blends into after it.
    const end = pose(r, 'HORIZON SUNDER', r.clips.get('HORIZON SUNDER')!.duration);
    for (const j of ['RightHand', 'LeftHand', 'Head']) expect(end.at(j).distanceTo(idle.at(j)) / height, `${j} at the end`).toBeLessThan(.03);
  });
});
