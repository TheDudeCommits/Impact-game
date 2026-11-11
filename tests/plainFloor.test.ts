import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { plainFloor } from '../src/render/StageEnvironment';

/** A stage whose model is not in this checkout (README.md) is fought on a plain floor of its size
 *  (StageEnvironment.plainFloor). */
describe('a stage with no model', () => {
  it('stands on a plain floor of its size', () => {
    const floor = plainFloor(38, 30);
    const box = new THREE.Box3().setFromObject(floor);
    expect(box.max.x - box.min.x).toBeGreaterThanOrEqual(76);
    expect(Math.abs(box.max.y)).toBeLessThan(.1);
  });
});
