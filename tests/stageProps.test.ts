import fs from 'node:fs';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { KIT_SIZE, STAGE_PROPS, propCollider, propColliders } from '../src/game/stageProps';
import { STAGE_LANDMARKS } from '../src/game/environmentLayout';
import { ROYALE_STAGES, STAGES, type StageId } from '../src/game/stages';

/**
 * Round 4b (MAPS): the battle royale places' props. What a fighter runs into
 * is what is drawn: the renderer places STAGE_PROPS (src/render/stages) and
 * the server's world, the bots' grid and the camera's occluders are built from
 * the same boxes (STAGE_LANDMARKS). These hold the list to the kit it names
 * and to the floor it stands on.
 */
function glbSize(piece: string): [number, number, number] {
  const file = fs.readFileSync(`public/assets/environment/${piece}.glb`);
  const length = file.readUInt32LE(12), json = JSON.parse(file.subarray(20, 20 + length).toString());
  // Every primitive's bounds, through its node's whole transform (Kenney's
  // pieces hang their parts off translated, turned children).
  const box = new THREE.Box3(), corner = new THREE.Vector3();
  const visit = (index: number, parent: THREE.Matrix4) => {
    const node = json.nodes[index];
    const local = node.matrix ? new THREE.Matrix4().fromArray(node.matrix)
      : new THREE.Matrix4().compose(new THREE.Vector3(...(node.translation ?? [0, 0, 0])), new THREE.Quaternion(...(node.rotation ?? [0, 0, 0, 1])), new THREE.Vector3(...(node.scale ?? [1, 1, 1])));
    const world = parent.clone().multiply(local);
    if (node.mesh !== undefined) for (const p of json.meshes[node.mesh].primitives) {
      const { min, max } = json.accessors[p.attributes.POSITION];
      for (const x of [min[0], max[0]]) for (const y of [min[1], max[1]]) for (const z of [min[2], max[2]]) box.expandByPoint(corner.set(x, y, z).applyMatrix4(world));
    }
    for (const child of node.children ?? []) visit(child, world);
  };
  for (const root of json.scenes[json.scene ?? 0].nodes) visit(root, new THREE.Matrix4());
  const size = box.getSize(new THREE.Vector3());
  return [size.x, size.y, size.z];
}

describe('the battle royale places\' props', () => {

  it.each(Object.keys(STAGE_PROPS) as StageId[])('%s: every solid prop is boxed into the stage\'s landmarks', stage => {
    const boxes = propColliders(stage);
    expect(boxes.length).toBeGreaterThan(0);
    for (const box of boxes) expect(STAGE_LANDMARKS[stage]).toContainEqual(box);
  });

  it.each(Object.keys(STAGE_PROPS) as StageId[])('%s: the props stand on the floor, inside the bounds, and leave the middle clear', stage => {
    const { halfX, halfZ } = STAGES[stage];
    for (const p of STAGE_PROPS[stage]!) {
      const box = propCollider(p);
      if (!box) continue;
      expect(Math.abs(box.x) - box.halfX, `${p.piece} at (${p.x}, ${p.z})`).toBeLessThan(halfX);
      expect(Math.abs(box.z) - box.halfZ, `${p.piece} at (${p.x}, ${p.z})`).toBeLessThan(halfZ);
      expect(box.y - box.halfY, `${p.piece} floats`).toBeLessThan(.6);
      // Nothing solid within six metres of the middle, where the fight begins.
      const dx = Math.max(0, Math.abs(box.x) - box.halfX), dz = Math.max(0, Math.abs(box.z) - box.halfZ);
      expect(Math.hypot(dx, dz), `${p.piece} at (${p.x}, ${p.z})`).toBeGreaterThan(6);
    }
  });

  it('dress every place in the royale pool', () => {
    for (const stage of ROYALE_STAGES) expect(STAGE_PROPS[stage], stage).toBeDefined();
  });
});
