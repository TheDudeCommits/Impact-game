import * as THREE from 'three';
import type { DressContext } from '../../render/stages/dressing';
import { detail, Forge, noise2 } from './forge';
import { rand } from './remake';

const BASALT = 0x2e2a2a, BASALT_LIT = 0x4a423c, ASH = 0x5a524a, PINE = 0x2a3a2a, RENDER = 0xc8bca8, TIMBER = 0x5a4232, SLATE = 0x4a4a50;

/** Build the backdrop into Last Stand's root. True when it is built (the village then loads nothing of the colosseum's). */
export async function lastStandBackdrop(root: THREE.Group) {
  const f = new Forge({ stage: 'ashwood', root } as unknown as DressContext, 'ashwood backdrop');
  f.mat('basalt', { map: detail.rock(71), tile: 10, flat: true, roughness: .95, air: .4 });
  f.mat('scree', { map: detail.gravel(72), tile: 14, roughness: 1, air: .45 });
  f.mat('stone', { map: detail.ashlar(74, 60), tile: 3.4, roughness: .9, air: .35 });
  f.mat('slate', { map: detail.slate(77), tile: 3, roughness: .8, air: .35 });
  f.mat('glow', { basic: true, fog: false });
  crag(f);
  upperTown(f);
  f.done();
  return true;
}

/** The Ash Crag north of the town: ranks of six-sided basalt columns, each rank's tops stepping down and up along it, pines
 *  on the front rank's tops, fallen columns on the hill's shoulders. */
function crag(f: Forge) {
  const r = rand(78), n = noise2(79), Z = 268;
  for (let rank = 0; rank < 2; rank++) {
    const z0 = Z + rank * 18, rad = 3.8 + rank * .5;
    for (let x = -230; x <= 230; x += rad * 1.73) {
      // The crest wanders slowly along the crag, each column a little off its neighbours (no blocks: columns in even ranks,
      // not towers), falling away at the crag's ends.
      const crest = 46 + rank * 14 + n(x * .008, rank) * 24 + (r() - .5) * 4 - Math.max(0, Math.abs(x) - 120) * .5;
      const h = crest + 34, zz = z0 + (r() - .5) * 2.4 + (Math.round(x / (rad * 1.73)) % 2) * rad * .9;
      f.cyl('basalt', x, -4, zz, rad, rad * 1.02, h, (_x, y) => y > h - 12 ? BASALT_LIT : BASALT, { sides: 6, rot: r() * .2 });
      // Pines on some of the front rank's tops below the next.
      if (rank < 1 && r() < .2) for (let k = 0; k < 2; k++) pine(f, x + (r() - .5) * 3, h - 4, zz + rad * .3 + (r() - .5) * 2, 6 + r() * 5);
    }
  }
  // Fallen columns lying on the hill's shoulders either side of the town.
  for (let i = 0; i < 18; i++) {
    const x = (r() < .5 ? -1 : 1) * (120 + r() * 100), z = Z - 4 - r() * 20, len = 8 + r() * 14, yaw = r() * Math.PI, y = 40;
    f.pipe('basalt', [x - Math.cos(yaw) * len / 2, y, z - Math.sin(yaw) * len / 2], [x + Math.cos(yaw) * len / 2, y + r() * 3, z + Math.sin(yaw) * len / 2], 1.8 + r() * .8, BASALT, { sides: 6 });
  }
}

/** A pine: a trunk and three stacked cones, dark. */
function pine(f: Forge, x: number, y: number, z: number, h: number) {
  f.cyl('basalt', x, y, z, .2, .3, h * .35, 0x2a2018, { sides: 5 });
  for (let k = 0; k < 3; k++) f.add('basalt', new THREE.ConeGeometry(h * (.32 - k * .07), h * .42, 7).translate(x, y + h * (.3 + k * .2) + h * .21, z), PINE);
}

/** The upper town north of the village's heart: three terraces of ash-stone walls stepping up a hill, houses along each
 *  (rendered walls, timber bands, hipped slate roofs), and on the hill's top the stepped pyramid with the eternal fire. */
function upperTown(f: Forge) {
  const r = rand(82), Z = 118;
  f.terrain('scree', -240, Z - 10, 240, Z + 175, 14, (x, z) => Math.max(0, (z - Z) * .38 - Math.max(0, Math.abs(x) - 70) * .12) + (z > Z + 120 ? (z - Z - 120) * .2 : 0), (x, _y, z) => (Math.sin(x * .05) * Math.sin(z * .07) > .2 ? 0x3e4a38 : 0x4a4e42));
  for (let t = 0; t < 3; t++) {
    const z = Z + 12 + t * 26, y = t * 10, w = 210 - t * 40;
    // The terrace: a block of ash-stone, its front the wall, its top the street the houses stand on.
    f.box('stone', 0, -4, z + 12, w, y + 12 - (t ? 0 : 2), 26, t % 2 ? 0x8a8278 : 0x7a7268);
    for (let x = -w / 2 + 8; x < w / 2 - 8; x += 11 + r() * 6) {
      if (Math.abs(x) < 14 && t === 2) continue;
      const hw = 6 + r() * 3, hd = 6 + r() * 3, hh = 5 + r() * 4, zz = z + 4 + hd / 2 + r() * 3, base = y + 8 - (t ? 0 : 2);
      f.box('stone', x, base, zz, hw, hh, hd, RENDER);
      f.box('stone', x, base + hh * .55, zz, hw + .3, .4, hd + .3, TIMBER);
      f.roof('slate', x, base + hh, zz, hw + 1.2, hd + 1.2, 2.6 + r() * 1.2, SLATE, r() < .5 ? 0 : Math.PI / 2, 1.2);
    }
  }
  // The stepped pyramid on the hill's top, the eternal fire in a bronze bowl on it.
  const pz = Z + 120, py = 40;
  for (let k = 0; k < 5; k++) f.box('stone', 0, py + k * 7, pz, 46 - k * 8, 7, 34 - k * 6, k % 2 ? 0x5a504a : 0x4a423e);
  f.cyl('stone', 0, py + 35, pz, 4, 5, 2.4, 0x3a302a);
  for (let k = 0; k < 3; k++) f.add('glow', new THREE.ConeGeometry(3.4 - k * .9, 6 - k * 1.2, 9).translate((k - 1) * .8, py + 40 + k * 1.4, pz + (k % 2) * .6), [0xff7a2a, 0xffa040, 0xffd070][k]);
}
