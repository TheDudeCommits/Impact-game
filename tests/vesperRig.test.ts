import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { FIGHTERS } from '../src/config';
import { Fighter } from '../src/render/Fighter';
import { isDynamicBoneName, SPRING_PROFILES } from '../src/render/SecondaryMotion';
import { loadRig, base } from './rigHarness';
import { loadRigWithExtras } from './extraClips';
import { ORIGINALS } from '../src/originals/roster';
const LEG = /^(Left|Right)(UpLeg|Leg|Foot|ToeBase)$/, ARM = /^(Left|Right)(Arm|ForeArm|Hand)$/;

type Gltf = { nodes: { name?: string }[]; skins: { joints: number[]; inverseBindMatrices: number }[];
  accessors: { bufferView: number; byteOffset?: number; count: number; type: string; componentType: number }[];
  bufferViews: { byteOffset?: number; byteLength: number }[]; images?: { bufferView: number }[];
  meshes: { primitives: { indices: number }[] }[]; animations?: { name: string; samplers: { input: number; output: number }[] }[] };
function glb(path: string) {
  const file = fs.readFileSync(`public${path}`), length = file.readUInt32LE(12);
  return { json: JSON.parse(file.subarray(20, 20 + length).toString()) as Gltf, bin: file.subarray(20 + length + 8) };
}
const bytes = ({ json, bin }: ReturnType<typeof glb>, accessor: number) => {
  const a = json.accessors[accessor], view = json.bufferViews[a.bufferView];
  const width = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }[a.type] ?? 1, size = { 5126: 4, 5125: 4, 5123: 2, 5121: 1 }[a.componentType] ?? 4;
  const start = (view.byteOffset ?? 0) + (a.byteOffset ?? 0);
  return bin.subarray(start, start + a.count * width * size);
};
const triangles = (file: ReturnType<typeof glb>) => file.json.meshes.reduce((n, m) => n + m.primitives.reduce((k, p) => k + file.json.accessors[p.indices].count / 3, 0), 0);

/** Every joint the old body had, in its place: its name, its index in the skin and its inverse bind; every clip, byte
 *  for byte; the texture the same; no more triangles. */
function keepsTheRig(from: string, to: string) {
  const a = glb(from), b = glb(to);
  const ja = a.json.skins[0].joints.map(i => a.json.nodes[i].name ?? ''), jb = b.json.skins[0].joints.map(i => b.json.nodes[i].name ?? '');
  expect(jb.slice(0, ja.length)).toEqual(ja);
  const ia = bytes(a, a.json.skins[0].inverseBindMatrices), ib = bytes(b, b.json.skins[0].inverseBindMatrices);
  expect(Buffer.compare(ia, ib.subarray(0, ia.length))).toBe(0);
  const clips = (f: ReturnType<typeof glb>) => new Map((f.json.animations ?? []).map(an => [an.name, an.samplers.map(s => Buffer.concat([bytes(f, s.input), bytes(f, s.output)]))]));
  const ca = clips(a), cb = clips(b);
  expect([...cb.keys()].sort()).toEqual([...ca.keys()].sort());
  for (const [name, data] of ca) data.forEach((d, i) => expect(Buffer.compare(d, cb.get(name)![i]), `${name} sampler ${i}`).toBe(0));
  const image = (f: ReturnType<typeof glb>) => f.bin.subarray(f.json.bufferViews[f.json.images![0].bufferView].byteOffset ?? 0, (f.json.bufferViews[f.json.images![0].bufferView].byteOffset ?? 0) + f.json.bufferViews[f.json.images![0].bufferView].byteLength);
  expect(Buffer.compare(image(a), image(b))).toBe(0);
  expect(triangles(b)).toBeLessThanOrEqual(triangles(a));
  return jb.slice(ja.length);
}

/** Each skinned vertex's weights by joint name. */
async function weights(path: string) {
  const rig = await loadRig(path), out: { name: string; w: number }[][] = [];
  rig.scene.traverse(o => {
    const mesh = o as THREE.SkinnedMesh;
    if (!mesh.isSkinnedMesh) return;
    const bones = mesh.skeleton.bones, index = mesh.geometry.getAttribute('skinIndex'), weight = mesh.geometry.getAttribute('skinWeight');
    for (let v = 0; v < index.count; v++) {
      const row: { name: string; w: number }[] = [];
      for (let k = 0; k < 4; k++) { const w = weight.getComponent(v, k); if (w > 1e-3) row.push({ name: bones[index.getComponent(v, k)]?.name ?? '', w }); }
      out.push(row);
    }
  });
  return { rig, rows: out };
}

/** A run, a dash and a stop on the game's own Fighter: every chain's tail finite, the hem under the belt and near the
 *  body, the hair under the top of the head. */
function runs(fighter: Fighter, ends: RegExp, under: (end: THREE.Bone, hip: THREE.Vector3, head: THREE.Vector3, tail: THREE.Vector3) => void) {
  const hips = fighter.model.getObjectByName('Hips')!, head = fighter.model.getObjectByName('Head')!;
  const tips: THREE.Bone[] = [];
  fighter.model.traverse(o => { if ((o as THREE.Bone).isBone && ends.test(o.name)) tips.push(o as THREE.Bone); });
  const state = fighter.state, hip = new THREE.Vector3(), top = new THREE.Vector3(), tail = new THREE.Vector3();
  let x = 0;
  for (const [action, frames, speed] of [['idle', 40, 0], ['run', 60, 7.5], ['dash', 20, 15], ['idle', 40, 0]] as const) for (let i = 0; i < frames; i++) {
    x += speed / 60;
    fighter.update(1 / 60, { ...state, action, x, actionTime: i / 60 }, true, 1 / 60);
    fighter.group.updateMatrixWorld(true);
    hips.getWorldPosition(hip); head.getWorldPosition(top);
    for (const end of tips) { end.getWorldPosition(tail); expect(Number.isFinite(tail.x + tail.y + tail.z)).toBe(true); under(end, hip, top, tail); }
  }
  return tips.length;
}

describe.skipIf(!!ORIGINALS.vesper)('Vesper’s body: the cape off the legs and the arms, the hair on chains', () => {
  it('keeps every joint, clip and the texture of vesper-mx1, and appends only the hem and hair chains', () => {
    const added = keepsTheRig('/assets/fighters/vesper-mx1.glb', '/assets/fighters/vesper-mx2.glb');
    expect(added.filter(n => /^Detail_CLOTH_vesper_hem_\d_\d$/.test(n)).length).toBe(18);
    expect(added.filter(n => /^Detail_CLOTH_vesper_hair_\d_\d$/.test(n)).length).toBe(15);
    expect(added.filter(n => /^Detail_CLOTH_vesper_lock[LR]_0_\d$/.test(n)).length).toBe(6);
    expect(added.every(n => /^(Detail_CLOTH_vesper_|HemEnd_vesper_|HairEnd_vesper_)/.test(n))).toBe(true);
    // The chains' ends carry nothing and are not sprung (a hair end named like hair was taken for a link).
    expect(added.filter(n => /End_/.test(n)).every(n => !isDynamicBoneName(n))).toBe(true);
  });

  it('hangs no vertex on both a chain and a leg, and none of the cape on an arm', async () => {
    const { rig, rows } = await weights(FIGHTERS.vesper.model);
    const parent = (name: string) => rig.scene.getObjectByName(name)?.parent?.name;
    expect(parent('Detail_CLOTH_vesper_hem_0_0')).toBe('Hips');
    expect(parent('Detail_CLOTH_vesper_hair_2_0')).toBe('Head');
    expect(parent('Detail_CLOTH_vesper_lockL_0_0')).toBe('Head');
    let hem = 0, hair = 0;
    for (const row of rows) {
      const on = (re: RegExp) => row.filter(r => re.test(r.name)).reduce((s, r) => s + r.w, 0);
      const chain = on(/^Detail_CLOTH_vesper_hem_/), strands = on(/^Detail_CLOTH_vesper_(hair|lock)/);
      if (chain > 0) { hem++; expect(on(LEG)).toBe(0); expect(on(ARM)).toBe(0); }
      if (strands > 0) { hair++; expect(on(LEG) + on(ARM)).toBe(0); }
    }
    expect(hem).toBeGreaterThan(400);
    expect(hair).toBeGreaterThan(1500);
  }, 120_000);

  it('keeps the hem under the belt and the hair under his crown through a run, a dash and a stop', async () => {
    const rig = await loadRig(FIGHTERS.vesper.model);
    const fighter = new Fighter(base('vesper'), rig);
    try {
      let lowest = Infinity;
      const n = runs(fighter, /^(HemEnd|HairEnd)_vesper_/, (end, hip, head, tail) => {
        if (end.name.startsWith('Hem')) {
          expect(tail.y, end.name).toBeLessThan(hip.y + .2);
          // Its hem hangs 0.8 m from the hips at rest (mx2's, to the floor: 1.1), and trails a dash.
          expect(tail.distanceTo(hip)).toBeLessThan(1.5);
          lowest = Math.min(lowest, tail.y);
        } else {
          expect(tail.y, end.name).toBeLessThan(head.y + .1);
          expect(tail.distanceTo(head)).toBeLessThan(.9);
        }
      });
      // mx2's six hem ends and mx3's thirteen, the five down his back and the two locks.
      expect(n).toBe(26);
      expect(lowest).toBeGreaterThan(-.05);
    } finally { fighter.dispose(); }
  }, 120_000);
});

/** The cape re-hung (8 October 2026, scripts/rig/vesper_rig.py `rehem`): vesper-mx3, from vesper-mx2 with every
 *  joint and clip kept - the skirt on thirteen chains of even links, its hem at mid-calf, mx2's six chains left in the
 *  skeleton carrying nothing, and the scabbard moved with the cloth it hangs in. */
const OLD_HEM = /^Detail_CLOTH_vesper_hem_[0-5]_\d$/, NEW_HEM = /^Detail_CLOTH_vesper_hem_(\d+)_(\d+)$/;
describe.skipIf(!!ORIGINALS.vesper)('Vesper’s cape re-hung: thirteen chains, the scabbard on the cloth', () => {
  it('keeps every joint, clip and the texture of vesper-mx2, and appends only the new chains', () => {
    expect(FIGHTERS.vesper.model).toBe('/assets/fighters/vesper-mx3.glb');
    const added = keepsTheRig('/assets/fighters/vesper-mx2.glb', FIGHTERS.vesper.model);
    const links = added.map(n => NEW_HEM.exec(n)).filter(Boolean) as RegExpExecArray[];
    const sectors = [...new Set(links.map(m => Number(m[1])))].sort((a, b) => a - b), levels = new Set(links.map(m => m[2])).size;
    expect(sectors).toEqual([6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]);
    expect(levels).toBeGreaterThanOrEqual(5);
    expect(links.length).toBe(13 * levels);
    expect(added.filter(n => /^HemEnd_vesper_\d+$/.test(n)).length).toBe(13);
    expect(added.length).toBe(13 * (levels + 1));
  });

  it('carries nothing on mx2\'s six chains - the springs leave them off - and hangs the scabbard on the cloth, off his thigh', async () => {
    const before = await weights('/assets/fighters/vesper-mx2.glb'), after = await weights(FIGHTERS.vesper.model);
    let scabbard = 0;
    after.rows.forEach((row, v) => {
      for (const r of row) if (OLD_HEM.test(r.name)) expect(r.w, `vertex ${v} on ${r.name}`).toBe(0);
      const thigh = (rows: { name: string; w: number }[]) => rows.filter(r => r.name === 'LeftUpLeg').reduce((sum, r) => sum + r.w, 0);
      if (thigh(before.rows[v]) > 1e-3 && thigh(row) === 0) {
        scabbard++;
        // From the belt (the pelvis) at its top to the cloth beside it lower down; on no leg.
        expect(row.every(r => r.name === 'Hips' || NEW_HEM.test(r.name)), `scabbard vertex ${v}: ${row.map(r => r.name).join(', ')}`).toBe(true);
      }
    });
    // The empty scabbard at his left hip (152 vertices, its own island) was the only thing on the thigh to leave it.
    expect(scabbard).toBe(152);
    const chains = SPRING_PROFILES.vesper!.chains!, rule = (name: string) => chains.find(c => c.match.test(name))!.profile;
    expect(rule('Detail_CLOTH_vesper_hem_3_1').off).toBe(true);
    expect(rule('Detail_CLOTH_vesper_hem_13_1').off).toBeUndefined();
    expect(rule('Detail_CLOTH_vesper_hem_13_1').legs).toBeDefined();
  }, 120_000);

  it('does not throw the cape out flat through a U-turn at a run', async () => {
    // Running (his own run, the heel held under the belt), turned about in eight frames, run on and stopped: each
    // chain's line, from its head under the belt to its end, off straight down. mx2's six chains stood out 62 degrees
    // through the same turn.
    const rig = await loadRigWithExtras('vesper');
    const fighter = new Fighter(base('vesper'), rig);
    try {
      const chains = [...Array(13).keys()].map(i => [fighter.model.getObjectByName(`Detail_CLOTH_vesper_hem_${i + 6}_0`)!, fighter.model.getObjectByName(`HemEnd_vesper_${i + 6}`)!]);
      const a = new THREE.Vector3(), b = new THREE.Vector3();
      let z = 0, yaw = 0, widest = 0;
      for (const [action, frames, speed, turn] of [['idle', 30, 0, 0], ['run', 50, 7.5, 0], ['run', 8, 7.5, Math.PI / 8], ['run', 60, 7.5, 0], ['idle', 40, 0, 0]] as const) {
        for (let i = 0; i < frames; i++) {
          yaw += turn; z += Math.cos(yaw) * speed / 60;
          fighter.update(1 / 60, { ...fighter.state, action, x: 0, z, yaw, actionTime: i / 60 }, true, 1 / 60);
          fighter.group.updateMatrixWorld(true);
          for (const [head, end] of chains) {
            head.getWorldPosition(a); end.getWorldPosition(b);
            const d = b.sub(a);
            widest = Math.max(widest, THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(-d.y / d.length(), -1, 1))));
          }
        }
      }
      expect(widest).toBeGreaterThan(20);
      expect(widest).toBeLessThan(60);
    } finally { fighter.dispose(); }
  }, 120_000);
});

describe.skipIf(!!ORIGINALS.vesper)('Black Vespers’s body: the wings on the chest, the cape on chains, each limb on its own chain', () => {
  it('keeps every joint, clip and the texture of vesper-black-vespers-mx1, and appends only the hem chains', () => {
    expect(FIGHTERS.vesper.formModel).toBe('/assets/fighters/vesper-black-vespers-mx2.glb');
    const added = keepsTheRig('/assets/fighters/vesper-black-vespers-mx1.glb', FIGHTERS.vesper.formModel!);
    expect(added.filter(n => /^Detail_CLOTH_vesper-black_vespers_hem_\d_\d$/.test(n)).length).toBe(18);
    expect(added.every(n => /^(Detail_CLOTH_vesper-black_vespers_hem_|HemEnd_vesper-black_vespers_)/.test(n))).toBe(true);
  });

  it('weights no vertex to an arm and a leg at once, no arm to the other side’s, and nothing to the misplaced LeftHand', async () => {
    const { rows } = await weights(FIGHTERS.vesper.formModel!);
    let hem = 0;
    for (const row of rows) {
      const on = (re: RegExp) => row.filter(r => re.test(r.name)).reduce((s, r) => s + r.w, 0);
      const arm = on(ARM), leg = on(LEG);
      expect(Math.min(arm, leg)).toBeLessThan(.02);
      // An arm's own vertices (the chest between them carries a little of both, relaxed).
      if (arm > .5) expect(Math.min(on(/^Left(Arm|ForeArm|Hand)$/), on(/^Right(Arm|ForeArm|Hand)$/))).toBeLessThan(.02);
      expect(on(/^LeftHand$/)).toBeLessThan(.02);
      if (on(/^Detail_CLOTH_vesper-black_vespers_hem_/) > 0) { hem++; expect(arm + leg).toBe(0); }
    }
    expect(hem).toBeGreaterThan(3000);
  }, 120_000);
});
