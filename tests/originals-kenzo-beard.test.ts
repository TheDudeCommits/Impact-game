import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { SecondaryMotion, SPRING_PROFILES, isDynamicBoneName, type SpringProfile } from '../src/render/SecondaryMotion';
import { BEARD_SPRINGS } from '../src/originals/apply';
import type { FighterId } from '../src/game/types';

type Json = {
  nodes: { name?: string; children?: number[]; mesh?: number; skin?: number }[];
  meshes: { name?: string; primitives: { attributes: Record<string, number>; indices?: number; material?: number }[] }[];
  skins: { joints: number[] }[];
  accessors: { count: number; bufferView: number; byteOffset?: number; componentType: number; type: string }[];
  bufferViews: { byteOffset?: number; byteLength: number; byteStride?: number }[];
  animations?: { name: string; channels: { target: { node: number; path: string } }[] }[];
};
function glb(url: string) {
  const file = fs.readFileSync(`public${url}`), n = file.readUInt32LE(12);
  const json = JSON.parse(file.subarray(20, 20 + n).toString()) as Json;
  const bin = file.subarray(20 + n + 8);
  return { json, bin };
}
function accessor({ json, bin }: ReturnType<typeof glb>, index: number) {
  const a = json.accessors[index], view = json.bufferViews[a.bufferView];
  const width = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type as 'VEC4']!;
  const T = a.componentType === 5126 ? Float32Array : a.componentType === 5123 ? Uint16Array : a.componentType === 5121 ? Uint8Array : Uint32Array;
  const start = (view.byteOffset ?? 0) + (a.byteOffset ?? 0), stride = view.byteStride ?? width * T.BYTES_PER_ELEMENT;
  const out: number[][] = [];
  for (let i = 0; i < a.count; i++) {
    const row: number[] = [];
    for (let k = 0; k < width; k++) row.push(bin[`read${T === Float32Array ? 'FloatLE' : T === Uint16Array ? 'UInt16LE' : T === Uint8Array ? 'UInt8' : 'UInt32LE'}`](start + i * stride + k * T.BYTES_PER_ELEMENT));
    out.push(row);
  }
  return out;
}

const BODY = '/assets/fighters/kenzo-tr1.glb', FORM = '/assets/fighters/kenzo-awakened-tr1.glb';
const LINK = /^Detail_CLOTH_Beard_(\d)_(\d)$/;

describe('Kenzo\'s WILD RONIN beard (kenzo, base body)', () => {
  const body = glb(BODY);
  const { json } = body;
  const named = (name: string) => json.nodes.findIndex(n => n.name === name);
  const parentOf = (i: number) => json.nodes.findIndex(n => n.children?.includes(i));

  it('is a mesh of its own on the body\'s material and skin, about 3 000 triangles at most', () => {
    const node = json.nodes[named('Beard')], bodyNode = json.nodes[named('Body')];
    expect(node?.mesh, 'a Beard node with a mesh').toBeTypeOf('number');
    expect(node.skin).toBe(bodyNode.skin);
    const prims = json.meshes[node.mesh!].primitives;
    expect(prims).toHaveLength(1);
    expect(prims[0].material).toBe(json.meshes[bodyNode.mesh!].primitives[0].material);
    const tris = json.accessors[prims[0].indices!].count / 3;
    expect(tris).toBeGreaterThan(1500);
    expect(tris).toBeLessThanOrEqual(3100);
  });

  it('hangs its long locks on three chains of three links off the head, which the springs move and no clip keys', () => {
    const joints = new Set(json.skins[0].joints);
    const links = json.nodes.map((n, i) => [n.name ?? '', i] as const).filter(([name]) => LINK.test(name));
    expect(links.map(([name]) => name).sort()).toEqual([0, 1, 2].flatMap(c => [0, 1, 2].map(k => `Detail_CLOTH_Beard_${c}_${k}`)));
    for (const [name, i] of links) {
      const [, c, k] = LINK.exec(name)!;
      expect(json.nodes[parentOf(i)].name, name).toBe(k === '0' ? 'Head' : `Detail_CLOTH_Beard_${c}_${+k - 1}`);
      expect(joints.has(i), `${name} is a joint of the skin`).toBe(true);
      expect(isDynamicBoneName(name), `${name} is sprung`).toBe(true);
    }
    const keyed = new Set((json.animations ?? []).flatMap(a => a.channels.map(c => c.target.node)));
    expect(links.filter(([, i]) => keyed.has(i)).map(([name]) => name)).toEqual([]);
  });

  it('rides his head and its own chains only, its upper part (moustache, cheeks, sideburns) on the head alone', () => {
    const prim = json.meshes[json.nodes[named('Beard')].mesh!].primitives[0];
    const ids = accessor(body, prim.attributes.JOINTS_0), weights = accessor(body, prim.attributes.WEIGHTS_0), pos = accessor(body, prim.attributes.POSITION);
    const jointNames = json.skins[0].joints.map(j => json.nodes[j].name ?? '');
    const used = new Set<string>();
    let upper = 0;
    ids.forEach((row, v) => {
      row.forEach((j, k) => { if (weights[v][k] > 1e-4) used.add(jointNames[j]); });
      if (pos[v][1] > 1.52) { upper++; expect(row.some((j, k) => jointNames[j] === 'Head' && weights[v][k] > .999), `vertex ${v} at ${pos[v][1].toFixed(3)} m rides Head`).toBe(true); }
    });
    expect(upper).toBeGreaterThan(200);
    expect([...used].filter(n => n !== 'Head' && !LINK.test(n))).toEqual([]);
    expect([...used].filter(n => LINK.test(n)).length).toBe(9);
  });

  it('sways on springs of its own beside the coat\'s: stiffer, a tight cone, nothing toward the floor, nothing in the air', () => {
    const chains = SPRING_PROFILES.kenzo?.chains ?? [];
    const beard = chains.find(c => c.match.test('Detail_CLOTH_Beard_1_2'))?.profile;
    expect(beard).toEqual(BEARD_SPRINGS.kenzo);
    expect(beard!.maxAngle).toBeLessThanOrEqual(10);
    expect(beard!.stiffness).toBeGreaterThan(22);
    for (const key of ['hang', 'droop', 'launched', 'legs'] as const) expect(beard![key], key).toBeUndefined();
    // The slot's coat keeps its own entry, as before (its ground settings in the air: kenzo is in LAUNCHED_KEPT).
    const coat = chains.find(c => c.match.test('Detail_CLOTH_Coat_0_0'))?.profile;
    expect(coat?.stiffness).toBe(22);
    expect(coat?.launched).toBeUndefined();
  });

  it('keeps off his chest in a dash and settles when he stops (a head and a chain like his, on the beard\'s springs)', () => {
    const key = 'kenzo-beard-test' as FighterId;
    SPRING_PROFILES[key] = { stiffness: 12, drag: .4, gravity: 3, maxAngle: 24, trail: .09, flutter: .12, chains: [{ match: /^Detail_CLOTH_Beard_/, profile: BEARD_SPRINGS.kenzo! }] } as Partial<SpringProfile>;
    const root = new THREE.Group();
    const head = new THREE.Bone(); head.name = 'Head'; head.position.set(0, 1.55, 0); root.add(head);
    // His chain: from under the chin, down and forward to the upper chest (beard_mesh_r6.py's links: 6-7 cm each).
    let parent: THREE.Object3D = head;
    const links: THREE.Bone[] = [];
    const heads = [[0, -.074, .093], [0, -.058, .028], [0, -.058, .022]];
    for (let k = 0; k < 3; k++) {
      const link = new THREE.Bone(); link.name = `Detail_CLOTH_Beard_1_${k}`; link.position.fromArray(heads[k]); parent.add(link); links.push(link); parent = link;
    }
    root.updateMatrixWorld(true);
    const springs = new SecondaryMotion(root, key);
    const rest = links[2].getWorldPosition(new THREE.Vector3()).sub(root.position);
    let back = 0, swing = 0;
    const tip = new THREE.Vector3();
    for (let i = 0; i < 150; i++) {
      // a dash forward (+z) at 9 m/s for a third of a second, then a dead stop
      if (i >= 20 && i < 40) root.position.z += 9 / 60;
      root.updateMatrixWorld(true);
      springs.update(1 / 60);
      root.updateMatrixWorld(true);
      links[2].getWorldPosition(tip).sub(root.position);
      back = Math.max(back, rest.z - tip.z);
      swing = Math.max(swing, springs.swingDegrees);
    }
    delete SPRING_PROFILES[key];
    expect(swing).toBeGreaterThan(1);                            // it moves
    expect(swing).toBeLessThanOrEqual(BEARD_SPRINGS.kenzo!.maxAngle! + 1e-6);
    expect(back).toBeLessThan(.018);                             // short of the 2 cm it stands off the chest
    expect(tip.distanceTo(rest)).toBeLessThan(.002);             // settled again
  });

  it('leaves his oni form as it was: no beard on RAKSHASA', () => {
    const form = glb(FORM).json;
    expect(form.nodes.some(n => n.name === 'Beard' || LINK.test(n.name ?? ''))).toBe(false);
  });

});
