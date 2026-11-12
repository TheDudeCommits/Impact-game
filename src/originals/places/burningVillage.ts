/** THE BURNING VILLAGE (`rift-village`, Arcade Survival's first place) with no bell and no hanging light. The village
 *  stands as it is built (src/render/rift/RiftStage.ts, src/game/riftLayouts.ts): its layout, its collision, its houses and
 *  their models, its toppling, the fires on its roofs and in its street. But for two things, both drawn here, one hooked
 *  line each in RiftStage.ts and riftPlaces.ts:
 *
 *  - **The tower** at the square's north end is a watchtower: a stone shaft and the string course at its top
 *    (prop-watch-tower.glb), a crenellated parapet round it, and the beacon in a great iron fire basket standing on a stone
 *    block in the middle of the platform. (Its code-built stand-in, if the model never comes, is a stone shaft to the same
 *    height.)
 *  - **The houses' window fires**: each burning window's fire is an iron fire basket on a post standing in the street
 *    before its window, a little lower than the window (the same fires, so the same light on the square).
 *
 *  Nothing here is solid: the collision is the layout's, as it was. */
import * as THREE from 'three';
import type { Sculpt } from '../../render/rift/sculpt';
import type { FireSpot } from '../../render/rift/fire';
import type { RiftProp } from '../../game/riftLayouts';

/** The watchtower's shaft: its model is fitted to this height (riftPlaceDress), its parapet and beacon stand on it. */
export const WATCH_SHAFT = 11.4;
/** The model's width at that height (prop-watch-tower.glb is 0.434 by 0.952 units): its string course's edge. */
const WATCH_WIDTH = WATCH_SHAFT * .434 / .952;

const STONE = 0x5a5650, CAP = 0x4a4640, IRON = 0x2a2622, EMBER = 0xff8a3a, POST = 0x8a6440;
const RING = new THREE.TorusGeometry(1, .06, 4, 16);

function local(p: RiftProp, lx: number, lz: number): [number, number] {
  const c = Math.cos(p.rot), s = Math.sin(p.rot);
  return [p.x + lx * c + lz * s, p.z - lx * s + lz * c];
}

/** An iron fire basket standing at (x, y, z), `s` times a street basket's (0.9 m across at its rim): a collar, a bowl, eight
 *  bars flaring up round it and a ring round their tops, the embers in its bowl - and its fire, `size`. (The Wreckers'
 *  Causeway's basket(), in the Rift's own Sculpt.) */
export function basket(k: Sculpt, fires: FireSpot[], x: number, y: number, z: number, s: number, size: number, seed: number, smoke = .35) {
  k.use('metal', IRON, .1).cylinder(x, y, z, .28 * s, .3 * s, 8, 0, 0, 0, .16 / .28).cylinder(x, y + .3 * s, z, .3 * s, .22 * s, 10, 0, 0, 0, .46 / .3);
  const lean = Math.atan2(.16, .6), bar = Math.hypot(.16, .6) * s;
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2;
    k.cylinder(x + Math.cos(a) * .4 * s, y + .45 * s, z + Math.sin(a) * .4 * s, .045 * s, bar, 5, Math.PI / 2 - a, lean, 0);
  }
  k.add(RING, x, y + 1.02 * s, z, Math.PI / 2, 0, 0, .56 * s, .56 * s, .56 * s);
  k.use('glow', EMBER).cylinder(x, y + .5 * s, z, .38 * s, .06 * s, 10);
  fires.push({ x, y: y + .4 * s, z, size, smoke, seed });
}

/** A village prop drawn its own way here; false: RiftStage draws it. The tower: its code-built shaft (the model's stand-in) and the
 *  beacon's fire (which a prop wearing a model lights all the same). */
export function villageProp(k: Sculpt, p: RiftProp, fires: FireSpot[]): boolean {
  if (p.kind !== 'tower') return false;
  const w = p.w;
  k.use('stone', STONE, .06).box(p.x, 0, p.z, w, WATCH_SHAFT - .9, w, p.rot).use('stone', CAP, .05).box(p.x, WATCH_SHAFT - .9, p.z, w + .5, .9, w + .5, p.rot);
  for (const side of [-1, 1]) k.use('glow', EMBER).box(p.x + side * (w / 2 + .01), WATCH_SHAFT * .7, p.z, .04, 1.2, .3, 0);
  // The beacon, in its basket on the platform (villageStanding draws the basket).
  fires.push({ x: p.x, y: WATCH_SHAFT + .55 + .4 * 2.1, z: p.z, size: 2.8, smoke: 1, seed: 7 });
  return true;
}

/** What stands with the village's props, whether or not they wear their models - drawn into the place's own merge: the
 *  watchtower's parapet and its beacon's basket, and a fire basket before each burning window. */
export function villageStanding(k: Sculpt, props: readonly RiftProp[], fires: FireSpot[]) {
  for (const p of props) {
    if (p.kind === 'tower') {
      // The platform's floor over the shaft, the parapet round it (a merlon at each corner and two between), the stone block
      // in its middle and the beacon's great basket on it.
      const half = WATCH_WIDTH / 2, top = WATCH_SHAFT, wall = .32, high = .85;
      k.use('stone', CAP, .05).box(p.x, top - .12, p.z, WATCH_WIDTH - .1, .14, WATCH_WIDTH - .1, p.rot);
      k.use('stone', STONE, .06);
      for (const side of [-1, 1]) {
        const [ax, az] = local(p, 0, side * (half - wall / 2)), [bx, bz] = local(p, side * (half - wall / 2), 0);
        k.box(ax, top, az, WATCH_WIDTH, high, wall, p.rot).box(bx, top, bz, wall, high, WATCH_WIDTH - wall * 2, p.rot);
        for (const u of [-1, -1 / 3, 1 / 3, 1]) {
          const along = u * (half - .4);
          const [mx, mz] = local(p, along, side * (half - wall / 2)), [nx, nz] = local(p, side * (half - wall / 2), along);
          k.box(mx, top + high, mz, .8, .62, wall + .04, p.rot);
          if (Math.abs(u) < 1) k.box(nx, top + high, nz, wall + .04, .62, .8, p.rot);
        }
      }
      k.use('stone', CAP, .05).box(p.x, top, p.z, 1.5, .55, 1.5, p.rot + Math.PI / 4);
      basket(k, [], p.x, top + .55, p.z, 2.1, 0, 0);
      continue;
    }
    if (p.kind !== 'house' && p.kind !== 'ruin') continue;
    // RiftStage's house(): a ruin burns, and four houses in five; its windows a quarter of its width either side of the middle, on
    // both long walls, a basket on a post 1.6 m out in the street before each.
    const { w, d, h, seed: r } = p, ruined = p.kind === 'ruin';
    if (!(ruined || r > .2)) continue;
    // (A wooden post, its iron foot: an iron one was lost against the sooted walls behind it, and its fire read as hung there.)
    const wallH = ruined ? h * (.5 + r * .3) : h * .62, post = Math.max(1.1, Math.min(1.5, wallH * .45 - .35));
    for (const side of [-1, 1]) for (const t of [-.25, .25]) {
      const [x, z] = local(p, t * w, side * (d / 2 + 1.6));
      k.use('metal', IRON, .1).cylinder(x, 0, z, .22, .12, 8);
      k.use('wood', POST, .12).cylinder(x, .12, z, .085, post - .12, 6, 0, 0, 0, .8);
      basket(k, fires, x, post, z, .8, 1.1, r * 20 + t * 3 + side, .3);
    }
  }
}
