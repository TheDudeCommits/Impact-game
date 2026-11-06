import * as THREE from 'three';
import { VFX } from '../vfxLevel';

interface Request { x: number; y: number; z: number; r: number; g: number; b: number; intensity: number; distance: number; weight: number; taken: boolean }
const colour = new THREE.Color();
/** The most light, in candela per square metre of distance, a pool light may
 *  put on a fighter: about two and a half times what the key light gives. A
 *  point light falls off with the square of its distance, so one asked for
 *  at a fist, in a caster's palms or at the point of contact burned whoever
 *  was standing there to white. */
const EXPOSURE = 12;
/** How many bodies the pool keeps clear of, and their shape: a vertical
 *  segment from the knees to the crown, and a radius. */
const BODIES = 16, LOW = .3, HIGH = 1.6, RADIUS = .2;

/** A fixed set of point lights, handed out each frame to whatever effects most
 *  deserve them.
 *
 *  Three recompiles every lit program when the number of lights in the scene
 *  changes, so the count is fixed when the pool is built - before the loading
 *  screen compiles anything - and never moves again: an idle light is still
 *  there, at zero intensity. Effects ask for light every frame they want it;
 *  `flush` keeps the strongest requests and darkens the rest. A Sunpalm Cannon
 *  lights the floor cyan and a Taimatsu lights it orange, rather than every
 *  impact in the game throwing the same blue.
 */
export class LightPool {
  readonly lights: THREE.PointLight[];
  private requests: Request[] = Array.from({ length: 48 }, () => ({ x: 0, y: 0, z: 0, r: 0, g: 0, b: 0, intensity: 0, distance: 1, weight: 0, taken: false }));
  private n = 0;
  private bodies = new Float32Array(BODIES * 3);
  private bodyCount = 0;
  constructor(scene: THREE.Scene, count = 4) {
    this.lights = Array.from({ length: count }, (_, i) => {
      const light = new THREE.PointLight(0xffffff, 0, 8, 2);
      light.name = `vfx-light-${i}`; light.castShadow = false; scene.add(light); return light;
    });
  }

  /** Ask for light this frame. `priority` weighs requests of equal strength:
   *  the local player's own blow over a stranger's across the map. */
  request(x: number, y: number, z: number, hex: number, intensity: number, distance: number, priority = 1) {
    if (intensity <= .01 || this.n >= this.requests.length) return;
    const q = this.requests[this.n++];
    colour.setHex(hex);
    q.x = x; q.y = y; q.z = z; q.r = colour.r; q.g = colour.g; q.b = colour.b; q.intensity = intensity; q.distance = distance;
    q.weight = intensity * Math.sqrt(distance) * priority; q.taken = false;
  }

  /** Where the fighters' feet are this frame, for the exposure limit. */
  body(i: number, x: number, y: number, z: number) {
    if (i >= BODIES) return;
    this.bodies[i * 3] = x; this.bodies[i * 3 + 1] = y; this.bodies[i * 3 + 2] = z; this.bodyCount = Math.max(this.bodyCount, i + 1);
  }
  bodiesDone(count: number) { this.bodyCount = Math.min(BODIES, count); }

  /** (VISUAL EFFECTS: at the level's share of the light, render/vfxLevel.ts.) */
  flush() {
    for (const light of this.lights) {
      let best = -1;
      for (let i = 0; i < this.n; i++) if (!this.requests[i].taken && (best < 0 || this.requests[i].weight > this.requests[best].weight)) best = i;
      if (best < 0) { light.intensity = 0; continue; }
      const q = this.requests[best]; q.taken = true;
      // No brighter on the nearest body than EXPOSURE allows.
      let cap = Infinity;
      for (let b = 0; b < this.bodyCount; b++) {
        const bx = this.bodies[b * 3], by = this.bodies[b * 3 + 1], bz = this.bodies[b * 3 + 2];
        const dy = q.y < by + LOW ? by + LOW - q.y : q.y > by + HIGH ? q.y - by - HIGH : 0;
        const d = Math.max(.25, Math.sqrt((q.x - bx) * (q.x - bx) + (q.z - bz) * (q.z - bz) + dy * dy) - RADIUS);
        cap = Math.min(cap, EXPOSURE * d * d);
      }
      light.position.set(q.x, q.y, q.z); light.color.setRGB(q.r, q.g, q.b); light.intensity = Math.min(q.intensity, cap) * VFX.lights; light.distance = q.distance;
    }
    this.n = 0;
  }

  clear() { this.n = 0; for (const light of this.lights) light.intensity = 0; }
  dispose() { for (const light of this.lights) light.removeFromParent(); }
}
