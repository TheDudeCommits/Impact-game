import fs from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { STAGES, type StageId } from '../src/game/stages';
import { stageColliders } from '../src/game/environmentLayout';
import { PLAYER_RADIUS } from '../src/game/moves';
import { probeStage, type StageProbe } from '../scripts/lib/stageCollisionProbe';
import { RIFT_STAGES } from '../src/game/riftLayouts';

// The report was fighters stuck inside buildings and statues. Every stage's
// real collision world is driven through ArenaSimulation - run, dash and a
// 12 m/s knockback at every collider from every side - and the body must
// never end up with its centre inside one, and must always be able to walk
// away. The probe is `scripts/lib/stageCollisionProbe.ts`, shared with the
// printed audit in `scripts/probe_stage_collision.mts`.
const stages = Object.keys(STAGES) as StageId[];
const RIFT = new Set<StageId>(RIFT_STAGES);
const probes = new Map<StageId, StageProbe>();

describe('a fighter cannot get inside a landmark', () => {
  beforeAll(async () => {
    // The harbour has three hundred colliders; four sides each keeps the
    // whole gate under ten seconds.
    for (const id of stages) probes.set(id, await probeStage(id, { angles: id === 'harbor' ? 4 : 8 }));
  }, 600_000); // Round 4: twelve royale and rift stages probed; three minutes ran out on a loaded machine.

  it.each(stages)('%s: nothing a standing fighter overlaps is undeclared', id => {
    const probe = probes.get(id)!;
    expect(probe.grid.total).toBeGreaterThan(100);
    // Every overlapped point of the play rectangle is explained by a landmark
    // or wall the stage declares, a bridge deck, or the arch. A stray box - the
    // harbour's buildings left standing on a themed stage, say - is not.
    expect(probe.grid.inside.filter(g => !g.declared)).toEqual([]);
  });

  it.each(stages)('%s: the landmarks leave the rectangle a fighting floor', id => {
    const probe = probes.get(id)!;
    // The harbour is a town: its houses, terraces and quays take a third of
    // the square. A themed stage is a ring with a few stands at its corners.
    // Arcade survival's code-built stages are places, not rings: the burning
    // village is a town too, the fortress a courtyard inside its towers.
    // (And the four places added on 30 September: a shrine's courtyard in its
    // ring of ice, a clearing in a bamboo grove, a field of bones and rock, a
    // harbour's sand among its wrecks.)
    const allowed: Partial<Record<StageId, number>> = { harbor: .35, 'rift-village': .3, 'rift-fortress': .15, 'rift-swords': .08, 'rift-eclipse': .08,
      // Three lanes separated by deliberate ridges: at least 84% of the
      // rectangle stays open; chokePoints.test.ts verifies every rotation.
      'rift-war': .16 /* deliberate lane ridges; every pass is route-tested */, 'rift-frost': .09, 'rift-grove': .15, 'rift-wastes': .1, 'rift-harbor': .11,
      'mirror-mere': .15,
      // Amagoi's Crater: the village's wreckage on the crater's floor - heaps,
      // heaved crust, two roofs, broken walls, a cart, the receivers.
      'starfall-crater': .09 };
    expect(probe.grid.inside.length / probe.grid.total).toBeLessThan(allowed[id] ?? .05);
  });

  it.each(stages)('%s: running, dashing and knockback into every collider never ends inside one', id => {
    const probe = probes.get(id)!;
    expect(probe.drives.length).toBeGreaterThan(0);
    const describe = (d: typeof probe.drives[number]) => `${d.mode} at (${d.box.x}, ${d.box.z}) from ${Math.round(d.angle * 180 / Math.PI)} deg: ${d.deepest.toFixed(2)} m in`;
    expect(probe.drives.filter(d => d.inside).map(describe)).toEqual([]);
    // Not merely "centre outside": no more than the controller's own contact
    // tolerance inside anything, at any tick of the approach.
    expect(probe.drives.filter(d => d.deepest > .1).map(describe)).toEqual([]);
  });

  it.each(stages)('%s: after every approach the fighter can walk away within a second', id => {
    const probe = probes.get(id)!;
    expect(probe.drives.filter(d => d.stuck).map(d => `${d.mode} at (${d.box.x}, ${d.box.z}) from ${Math.round(d.angle * 180 / Math.PI)} deg moved ${d.away.toFixed(2)} m`)).toEqual([]);
  });

  it.each(stages)('%s: every spawn clears every collider by a capsule radius', id => {
    const probe = probes.get(id)!;
    expect(probe.spawns.length).toBeGreaterThanOrEqual(18);
    // The rift's stages never host a match (chooseStage never picks them), so
    // the match ring is not theirs to clear; the survival party's own seats are
    // checked below.
    const used = RIFT.has(id) ? probe.spawns.filter(s => s.kind !== 'match') : probe.spawns;
    expect(used.filter(s => s.clearance < PLAYER_RADIUS - 1e-6).map(s => `${s.id} (${s.kind}) at (${s.x.toFixed(1)}, ${s.z.toFixed(1)}) clears ${s.clearance.toFixed(2)} m`)).toEqual([]);
  });

  it.each([...RIFT])('%s: the survival party starts clear of everything', id => {
    // SurvivalGame.startPoint: four seats along a line in front of the rift.
    const { landmarks } = stageColliders(id), { halfZ } = STAGES[id];
    for (const x of [0, -2.6, 2.6, -5.2, 5.2]) {
      const at = { x, z: -Math.min(8, halfZ * .3) };
      for (const box of landmarks) {
        const dx = Math.max(0, Math.abs(at.x - box.x) - box.halfX), dz = Math.max(0, Math.abs(at.z - box.z) - box.halfZ);
        expect(Math.hypot(dx, dz), `${id} seat (${x}) against ${box.x},${box.z}`).toBeGreaterThanOrEqual(PLAYER_RADIUS);
      }
    }
  });
});

describe('the camera stops at what the body stops at', () => {
  // StageEnvironment in Node: three's file loader is pointed at public/ and
  // the GLB's images dropped, so the real occluder-building code runs.
  beforeAll(() => {
    (THREE.FileLoader.prototype as unknown as { load: unknown }).load = function (this: THREE.FileLoader, url: string, onLoad: (d: ArrayBuffer) => void, _p?: unknown, onError?: (e: unknown) => void) {
      try {
        const file = fs.readFileSync(`public${url}`), length = file.readUInt32LE(12);
        const json = JSON.parse(file.subarray(20, 20 + length).toString());
        json.materials = (json.materials ?? []).map((m: { name: string }) => ({ name: m.name }));
        delete json.images; delete json.textures; delete json.samplers;
        const data = Buffer.from(JSON.stringify(json)), padded = Buffer.concat([data, Buffer.alloc((4 - data.length % 4) % 4, 32)]);
        const tail = file.subarray(20 + length), result = Buffer.alloc(20 + padded.length + tail.length);
        result.writeUInt32LE(0x46546c67, 0); result.writeUInt32LE(2, 4); result.writeUInt32LE(result.length, 8);
        result.writeUInt32LE(padded.length, 12); result.writeUInt32LE(0x4e4f534a, 16); padded.copy(result, 20); tail.copy(result, 20 + padded.length);
        this.manager.itemStart(url);
        setTimeout(() => { onLoad(result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength)); this.manager.itemEnd(url); }, 0);
      } catch (e) { onError?.(e); this.manager.itemError(url); }
    };
  });

  it.each(['proving-hall', 'ash-colosseum'] as const)('%s: the occluders are the collider list', async id => {
    const { StageEnvironment } = await import('../src/render/StageEnvironment');
    const environment = new StageEnvironment(new THREE.Scene());
    try {
      await environment.show(id);
      const { walls, landmarks } = stageColliders(id);
      const boxes = environment.occluders.map(o => {
        const mesh = o as THREE.Mesh<THREE.BoxGeometry>;
        const { width, height, depth } = mesh.geometry.parameters;
        return { x: mesh.position.x, y: mesh.position.y, z: mesh.position.z, halfX: width / 2, halfY: height / 2, halfZ: depth / 2 };
      });
      expect(boxes).toHaveLength(walls.length + landmarks.length);
      for (const c of landmarks) {
        const match = boxes.find(b => Math.abs(b.x - c.x) < 1e-6 && Math.abs(b.z - c.z) < 1e-6 && Math.abs(b.halfX - c.halfX) < 1e-6 && Math.abs(b.halfZ - c.halfZ) < 1e-6 && Math.abs(b.halfY - c.halfY) < 1e-6);
        expect(match, `landmark at (${c.x}, ${c.z}) has a camera box`).toBeDefined();
      }
      // The camera walls stand on the bound, where the collider's inner face is.
      const { halfX, halfZ } = STAGES[id];
      const wallBoxes = boxes.filter(b => !landmarks.some(c => c.x === b.x && c.z === b.z));
      expect(wallBoxes).toHaveLength(4);
      for (const b of wallBoxes) {
        const inner = b.halfX < b.halfZ ? Math.abs(b.x) - b.halfX : Math.abs(b.z) - b.halfZ;
        expect(inner).toBeCloseTo((b.halfX < b.halfZ ? halfX : halfZ) - .4, 6);
      }
    } finally { environment.dispose(); }
  }, 60_000);
});
