import * as THREE from 'three';
import { propColliders } from '../../../game/stageProps';
import type { GroundPlan } from '../build';
import { box, circle, DENSITY, FLOWERS, type GroundField, HEIGHT, path, SPARE, spawnSeats, valueNoise } from '../mask';
import { STAGES } from '../../../game/stages';
import { seeded } from '../../stages/ambient';

const smooth = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** The stadium wall's inner radius, and the play square's half-size. */
const WALL = 77.4;
const { halfX: BOUND } = STAGES['ash-colosseum'];

/** The model's own trees round the field (x, z): the ring keeps clear of
 *  them, and the ground lays its fallen leaves under them too. */
export const PROVING_OWN_TREES: readonly (readonly [number, number])[] = [[-41.5, 33.9], [-52.5, 13.7], [33.7, 33.2], [54.3, -3.2], [9.5, -50], [-9.4, 50.5], [-41.2, -40.6], [36, -42.7]];

/** Where the ring's trees stand: their trunks outside the play square (by
 *  1.8 m and more), their canopies inside the wall, a dense row at 50-60 m and
 *  a sparser one behind it - in groves, with gaps between where the wall and
 *  the stands show through - and clear of the model's own trees. Toward the
 *  corners, where the square comes within a few metres of the wall, smaller. */
export function treeRing() {
  const rng = seeded(1515);
  const own = PROVING_OWN_TREES;
  const spots: { x: number; z: number; rot: number; scale: number }[] = [];
  const free = (x: number, z: number, gap: number) => own.every(([ox, oz]) => Math.hypot(x - ox, z - oz) > 10) && spots.every(s => Math.hypot(x - s.x, z - s.z) > gap);
  for (let g = 0; g < 16; g++) {
    if (g % 4 === 3) continue;
    const a0 = g / 16 * Math.PI * 2 + rng() * .1;
    for (let k = 0; k < 4; k++) {
      const a = a0 + (rng() - .5) * .34, outer = false;
      // Along the angle, from the square's edge outward.
      const s = Math.sin(a), co = Math.cos(a), edge = (BOUND + 1.8) / Math.max(Math.abs(s), Math.abs(co));
      const r = outer ? Math.max(edge + 8, 60 + rng() * 10) : Math.max(edge, 50 + rng() * 8);
      // A canopy reaches about 7.2 m at full size; it must stay inside the wall.
      const fits = (WALL - .5 - r) / (7.2 * .8);
      const scale = Math.min(.72 + rng() * .3, fits);
      if (scale < .5) continue;
      const x = s * r, z = co * r;
      if (!free(x, z, outer ? 10 : 7.5)) continue;
      spots.push({ x, z, rot: rng() * Math.PI * 2, scale });
    }
  }
  return spots;
}


/** The worn tracks across the field (x, z), dirt paths through the grass:
 *  one from the north stand's box down past the training posts and east of
 *  the middle to the south gate, and one across from the west, meeting it. */
export const PROVING_PATHS: readonly (readonly (readonly [number, number])[])[] = [
  [[1, -74], [2, -46], [-3, -36], [4, -24], [9, -10], [8, 4], [12, 20], [9, 40], [14, 74]],
  [[-74, -14], [-48, -12], [-30, -6], [-16, -9], [-4, -12], [9, -10]],
];

/** The colosseum's field: grass from the middle to the stadium wall
 *  (77.5 m out), a true leaf green moving to yellow-green across it - the
 *  field read olive before - each blade from a cool base through its green to
 *  a sunlit yellow-green tip; worn to earth along two tracks, in patches, at
 *  the props' feet and on the royale's spawn seats; trodden shorter in the
 *  middle, knee-high by the wall; drifts of small flowers. */
export const PROVING_GROUND: GroundPlan = {
  // The evening breeze off the cliff (north-west).
  wind: { heading: 2.3, strength: .2, gusts: 3 },
  grass: [{
    name: 'proving field',
    rect: { x0: -76, z0: -76, x1: 76, z1: 76 }, texel: .5,
    // The floor's top layer (the model's tiles stand at 0.004 and 0.051 m).
    floor: .051,
    // Under the sunset's orange key these albedos land on a true leaf green
    // (hue ~100 on screen; the field read olive, 60-90, before): the tips a
    // sunlit yellow-green, the bases a cool green that still reads as colour.
    look: { height: .44, root: 0x24634a, cool: 0x349a6c, warm: 0x70be58, tip: 0xb0c848, warmth: .55, width: .05 },
    // Opaque: the sheet is the stadium's floor out to the wall's foot.
    cover: { specks: [0xfff4d6, 0xffe27a, 0xf4b6de], speckle: .05, earth: 0x766a5c, opaque: true },
    flowers: { colors: [0xfff6dc, 0xffe066, 0xf0a6d4, 0xffffff], size: .09, reach: 18 },
    // Fallen leaves: dry tan, ochre, olive and russet (the sundown's key
    // warms them), under the trees and on the earth of the tracks and the
    // worn patches (in the blades they lie hidden).
    litter: { colors: [0xa88c56, 0xb48c4a, 0x868a4c, 0xa8704a], size: .22, reach: 24, where: provingLitter() },
    paint(field) {
      const noise = valueNoise(51), fine = valueNoise(52), tall = valueNoise(53), bloom = valueNoise(54), wobble = valueNoise(55);
      field.paint(DENSITY, circle(0, 0, 75), 1, 'set', 3);
      // The ground the field lays over the floor: all of it, to the wall's foot.
      field.paint(SPARE, circle(0, 0, 77.6), 1, 'set', .5);
      field.fill(HEIGHT, 1);
      // Worn patches of earth where the noise runs low (about a fifth of the field).
      field.map(DENSITY, (v, x, z) => v * smooth(.26, .37, noise(x * .05, z * .05) * .75 + fine(x * .23, z * .23) * .25));
      // The tracks: bare down the middle, thin and short along their edges,
      // their width wandering.
      for (const track of PROVING_PATHS) {
        const line = path(track, 1);
        field.map(DENSITY, (v, x, z) => {
          const d = line.sd(x, z) - (1.1 + 1.1 * wobble(x * .08, z * .08));
          return v * smooth(-.2, 1.8, d + (fine(x * .9, z * .9) - .5) * .9);
        });
        field.map(HEIGHT, (v, x, z) => v * (.55 + .45 * smooth(0, 3.5, line.sd(x, z) - 1.2)));
      }
      // Trodden shorter in the middle, knee-high out by the wall: 0.2-0.68 m a blade.
      field.map(HEIGHT, (v, x, z) => v * (.78 + .3 * smooth(18, 62, Math.hypot(x, z))) * (.85 + .25 * tall(x * .09 + 9, z * .09)));
      field.map(FLOWERS, (_, x, z) => smooth(.52, .72, bloom(x * .06 + 31, z * .06)));
      // The props standing in the field: their feet clear, and earth round
      // the training posts.
      for (const c of propColliders('ash-colosseum')) field.paint(DENSITY, box(c.x, c.z, c.halfX + .25, c.halfZ + .25), 0, 'min', .7);
      field.paint(DENSITY, circle(0, -33.5, 5.5), .1, 'min', 3);
      // Worn ground on the royale's spawn seats.
      for (const [x, z] of spawnSeats('ash-colosseum')) field.paint(DENSITY, circle(x, z, 1.6), .15, 'min', 1.8);
    },
  }],
  // Under the field's own ground sheet (grass and earth, laid to the wall's
  // foot) the model's floor tiles are never seen, and where they stood above
  // it they showed through it near the lens: they are put away once the
  // ground is down. A ground that fails leaves them.
  finish(c) {
    c.model.traverse(o => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || !FLOOR_TILES.test((Array.isArray(mesh.material) ? mesh.material[0] : mesh.material).name)) return;
      mesh.geometry.computeBoundingBox();
      const b = mesh.geometry.boundingBox!.clone().applyMatrix4(mesh.matrixWorld);
      if (b.max.y - b.min.y < .3) mesh.visible = false;
    });
  },
};

/** Where the field's fallen leaves lie: thick under the trees round it (the
 *  model's own and the ring's), gathered along the tracks' edges, scattered
 *  wherever the earth shows, in drifts; a few anywhere. The share of the
 *  floor's cells holding a leaf. */
export function provingLitter() {
  const trees = [...PROVING_OWN_TREES.map(([x, z]) => ({ x, z })), ...treeRing().map(t => ({ x: t.x, z: t.z }))];
  const tracks = PROVING_PATHS.map(track => path(track, 1)), drift = valueNoise(57);
  return (x: number, z: number, field: GroundField) => {
    let under = 0;
    for (const t of trees) { const d = Math.hypot(x - t.x, z - t.z); if (d < 9) under = Math.max(under, 1 - smooth(2.5, 9, d)); }
    let edge = 0;
    for (const line of tracks) { const d = line.sd(x, z); edge = Math.max(edge, Math.exp(-((d - 1.4) ** 2) / 1.2)); }
    const earth = 1 - field.sample(DENSITY, x, z);
    const here = Math.max(under * .85, edge * .8, earth * .6, .03);
    return here * (.4 + 1.2 * smooth(.25, .75, drift(x * .14, z * .14)));
  };
}

/** The colosseum model's floor: its tiles, and the ring of floor out to the wall. */
export const FLOOR_TILES = /^Material\.0(4[3-9]|5\d|6\d)$/;
