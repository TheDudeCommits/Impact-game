import * as THREE from 'three';
import { Flesh } from '../horde/flesh';
import type { V3 } from '../horde/kit';
import type { Sculpt } from './sculpt';

const ORIGIN: V3 = [0, 0, 0];
let HAND: THREE.BufferGeometry | undefined;

export function stoneHand(): THREE.BufferGeometry {
  return HAND ??= sculptHand();
}
export const hasHand = () => !!HAND;
/** The tree meshed ahead (fleshAhead), kept unless the Dead Sun made its own first. */
export function adoptHand(geometry: THREE.BufferGeometry) {
  if (HAND) geometry.dispose(); else HAND = geometry;
}
/** Sculpted and meshed: the dearest thing in any place. */
export function sculptHand(): THREE.BufferGeometry {
  const f = new Flesh([]);
  f.soft(.35).color(0x4a3e44);
  // The trunk out of the ground, leaning a little, and its roots gripping the earth.
  f.capsule([0, -2.4, 0], [.25, 4.6, .1], 1.15, .78);
  for (const [x, z] of [[1.7, .9], [-1.6, 1.1], [1.2, -1.5], [-1.3, -1.3]] as const) f.soft(.25).capsule([0, -1.2, 0], [x, -2.4, z], .55, .22);
  // The crown: three limbs splitting off the top, each forking twice, thinning to claws.
  const limbs: [number, number, number][][] = [
    [[.25, 4.6, .1], [-1.9, 7.1, -.3], [-2.7, 9.2, -.55], [-3.5, 9.8, -.2]],
    [[.25, 4.6, .1], [2.0, 7.4, .3], [2.5, 9.9, .45], [3.4, 10.3, .6]],
    [[.25, 4.6, .1], [.45, 8.3, -.1], [-.15, 10.9, .1], [.5, 11.6, .25]],
  ];
  for (const limb of limbs) {
    const radii = [.6, .38, .2, .07];
    for (let i = 0; i + 1 < limb.length; i++) f.soft(.15).capsule(limb[i], limb[i + 1], radii[i], radii[i + 1]);
    // A twig off each fork, crooked outward.
    const [a, b] = [limb[1], limb[2]];
    f.soft(.1).capsule(a, [a[0] + (b[0] - a[0]) * .2 + (a[0] > 0 ? .9 : -.9), a[1] + 1.1, a[2] + .4], .2, .06);
  }
  // A broken stub low on the trunk.
  f.soft(.12).capsule([.15, 2.6, .05], [1.4, 3.3, -.3], .32, .14);
  void ORIGIN;
  return f.build({ cell: .13, occlusion: .95 });
}

/** A sword the size of a tower, planted blade-down in a hill: its blade,
 *  cross, grip and pommel, leaning a little, in dark iron. `(x, y, z)` is
 *  where the blade enters the ground; `lean` tips it away along `yaw`. */
export function colossalSword(k: Sculpt, x: number, y: number, z: number, yaw: number, scale = 1, lean = .12) {
  const blade = 52 * scale, width = 3.6 * scale, thick = .6 * scale;
  const up = (h: number): [number, number, number] => [x + Math.sin(yaw) * Math.sin(lean) * h, y + Math.cos(lean) * h, z + Math.cos(yaw) * Math.sin(lean) * h];
  k.use('metal', 0x2e2c30, .05);
  // The blade, from below the turf to the cross, its edge a little lighter.
  const [bx, by, bz] = up(-4 * scale);
  k.box(bx, by, bz, width, blade + 4 * scale, thick, yaw, lean, 0);
  k.use('metal', 0x46444a, .05).box(bx, by, bz, width * .18, blade + 4 * scale, thick * 1.2, yaw, lean, 0);
  // The cross, the grip wound in leather gone black, the pommel.
  const [cx, cy, cz] = up(blade);
  k.use('metal', 0x2a282c, .05).box(cx, cy, cz, width * 4.2, 1.8 * scale, thick * 2.6, yaw, lean, 0);
  const [gx, gy, gz] = up(blade + 1.8 * scale);
  k.use('cloth', 0x1a1214, .08).box(gx, gy, gz, width * .34, 9 * scale, width * .34, yaw, lean, 0);
  const [px, py, pz] = up(blade + 10.8 * scale);
  k.use('metal', 0x2a282c, .05).box(px, py, pz, width * .8, 2.2 * scale, width * .8, yaw, lean, 0);
}
