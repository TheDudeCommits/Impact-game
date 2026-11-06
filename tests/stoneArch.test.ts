import { describe, expect, it } from 'vitest';
import { createRapierCollision } from '../src/game/rapierCollision';
import { ENVIRONMENT_COLLIDERS, STONE_ARCH } from '../src/game/environmentLayout';

const at=(x:number,y:number,z:number)=>({x:STONE_ARCH.x+x*STONE_ARCH.scale,
  y:STONE_ARCH.y+y*STONE_ARCH.scale,z:STONE_ARCH.z+z*STONE_ARCH.scale});

describe('source stone arch and masonry lane', () => {
  it('leaves the source arch opening hollow while adjacent source masonry blocks rays', async () => {
    const collision = await createRapierCollision();
    try {
      const end = at(0,1,-7);
      expect(collision.raycast!(at(0,1,7), end)).toEqual(end);
      const masonry = collision.raycast!(at(8,1,7),at(8,1,-7));
      expect(masonry.z).toBeGreaterThan(at(0,0,3).z);
      expect(masonry.z).toBeLessThan(at(0,0,5).z);
      const roof = collision.raycast!(at(0,9,0),at(0,0,0));
      expect(roof.y).toBeGreaterThan(at(0,6.7,0).y);
      expect(roof.y).toBeLessThan(at(0,7.4,0).y);
    } finally { collision.dispose!(); }
  });
  it('permits full-height capsule movement through the arch but blocks its supporting pier', async () => {
    const collision = await createRapierCollision();
    try {
      const opening = at(0,.01,7);
      const pier = at(8,.01,7);
      for (let i = 0; i < Math.ceil(14*STONE_ARCH.scale/.1)+10; i++) {
        for (const [id, p] of [['opening', opening], ['pier', pier]] as const) {
          const d = collision.move(id, p, { x: 0, y: -.05, z: -.1 });
          p.x += d.x; p.y += d.y; p.z += d.z;
        }
      }
      expect(opening.z).toBeLessThan(at(0,0,-7).z);
      expect(opening.y).toBeLessThan(.05);
      expect(pier.z).toBeGreaterThan(at(0,0,3.7).z);
      expect(pier.z).toBeLessThan(at(0,0,5).z+.5);
    } finally { collision.dispose!(); }
  });
  it('keeps the central 13 m fighting lane free from building and cargo collision', () => {
    const intrusions = ENVIRONMENT_COLLIDERS.filter(c => c.z - c.halfZ < 4 && c.z + c.halfZ > -18
      && c.x - c.halfX < 6.5 && c.x + c.halfX > -6.5);
    expect(intrusions).toEqual([]);
  });
});
