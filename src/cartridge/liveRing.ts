/**
 * The Gate Ring: the floor Impact's duel is fought on inside dude.work (the world's Ring Terraces, its src/games/registry.ts
 * LIVE entry). The world's ring is a stone circle 10.5 m across the middle; the duel's floor inside it is a 14 m square,
 * court x and z in [-7, 7], the world's court space exactly (origin at the ring's centre on its floor, metres, y up). The
 * duel's axis runs along court z (`duelAxis: 0`, as the Sunfall Arena's and the Zenith Coliseum's), which the world turns
 * to run east-west, so a visitor coming up from the south sees the two fighters side on.
 *
 * A stage of the game's own kind (game/stages.ts): a themed stage with no model is one flat slab under the floor and a
 * wall on each side (environmentLayout.ts stageColliders), so the sim's bounds are this square, and so is its collision
 * (RingCollision below). It is put into the game's tables here, for the live build only: the game's own build never
 * sees it.
 */
import { STAGES, type StageDefinition, type StageId } from '../game/stages';
import { STAGE_LANDMARKS } from '../game/environmentLayout';
import { PLAYER_RADIUS } from '../game/moves';
import type { CollisionMovement, CollisionWorld, Vec3 } from '../game/types';

export const RING = 'gate-ring' as StageId;
export const HALF = 7;
export const RING_BOUNDS = { minX: -HALF, maxX: HALF, minZ: -HALF, maxZ: HALF } as const;

const RING_STAGE: StageDefinition = {
  id: RING, name: 'The Gate Ring', scene: 'A stone ring on the terraces of dude.work',
  model: null, halfX: HALF, halfZ: HALF, spawnRadius: 4.5,
  cameraFar: 900, fog: [160, 1150],
  duelAxis: 0,
};

/** How high the walls stand (a themed stage's: environmentLayout.ts, 12 m). */
const WALL = 12;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * The ring's floor and walls for the sim, as the CollisionWorld it asks (game/types.ts): y = 0 underfoot and a wall at
 * x = ±7 and z = ±7, which is all a themed stage's Rapier world holds (stageColliders: one slab, four walls, no
 * landmarks, no roofs), worked out exactly instead - a flat floor in a walled square asks nothing of a physics engine,
 * and Rapier's wasm (2.8 MB) stays off the first load (the death ragdolls bring it in later, render/Ragdoll.ts). A body's
 * capsule stops at a wall, rests on the floor, and a ray (a projectile's flight, a line of sight, the floor under a
 * point) ends where it meets either.
 */
export class RingCollision implements CollisionWorld {
  move(_id: string, p: Vec3, d: Vec3): CollisionMovement {
    const reach = HALF - PLAYER_RADIUS;
    const x = clamp(p.x + d.x, -reach, reach) - p.x, z = clamp(p.z + d.z, -reach, reach) - p.z;
    // on the floor (landing, or standing as the tick's fall asks to go under it); a body below it is lifted out
    const floor = p.y + d.y <= 0;
    return { x, y: floor ? -p.y : d.y, z, grounded: floor && d.y <= 0 };
  }
  raycast(o: Vec3, e: Vec3): Vec3 {
    const dx = e.x - o.x, dy = e.y - o.y, dz = e.z - o.z;
    let t = 1;
    if (o.y >= 0 && e.y < 0) t = Math.min(t, o.y / (o.y - e.y));
    for (const [from, delta] of [[o.x, dx], [o.z, dz]] as const) {
      for (const side of [HALF, -HALF]) {
        if (!delta || Math.abs(from) > HALF) continue;
        const at = (side - from) / delta;
        if (at <= 0 || at >= t) continue;
        const y = o.y + dy * at;
        if (y >= 0 && y <= WALL) t = at;
      }
    }
    return { x: o.x + dx * t, y: o.y + dy * t, z: o.z + dz * t };
  }
  remove() {}
  dispose() {}
}

let registered = false;
export function registerRing() {
  if (registered) return;
  registered = true;
  (STAGES as Record<string, StageDefinition>)[RING] = RING_STAGE;
  (STAGE_LANDMARKS as Record<string, readonly unknown[]>)[RING] = [];
}
