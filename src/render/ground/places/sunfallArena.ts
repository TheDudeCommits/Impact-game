import type { GroundPlan } from '../build';
import { box, circle, DENSITY, FLOWERS, HEIGHT, valueNoise } from '../mask';

/** The masts round the field (x, z), clear of the competitors' walk to the south: the grass parts round their feet. */
export const TOURNAMENT_MASTS: readonly (readonly [number, number])[] = [
  [-11, -20.5], [11, -20.5], [16, -16], [22.5, 0], [16, 16], [7, 21.5], [-7, 21.5], [-16, 16], [-22.5, 0], [-16, -16],
];

/** The field round the ring: its level, the ring's half-size, and the
 *  field's (a square out to the low wall before the stands, 30 m each way:
 *  measured off the model). */
export const TOURNAMENT_FIELD = { level: -1.8, ring: 16.2, wall: 29.6 };

/** Pieces standing on the field round the ring, as circles the grass parts
 *  round: their feet stand in a trodden patch, not in a tuft. */
export const TOURNAMENT_PIECES: readonly (readonly [number, number, number])[] = [
  // Tables and parasols on the west and east sides.
  [-19.5, 3, 1.6], [-19.5, -3.2, 1.6], [-21.4, 5.2, 1.3], [-21.4, 0, 1.3], [-21.4, -5.4, 1.3],
  [20.5, -6, 1.8], [19.6, 1.5, 1.5], [21.6, 1.5, 1.3],
  // Pieces by the walk to the south gate.
  [-5.5, 18.8, 1.2], [5.5, 18.8, 1.2], [-20, -11, 1.4],
  // Lamps at the ring's corners and at the field's.
  [-17.2, -17.2, 1], [17.2, -17.2, 1], [-17.2, 17.2, 1], [17.2, 17.2, 1],
  [-26.5, -26.5, 1.4], [26.5, -26.5, 1.4], [-26.5, 26.5, 1.4], [26.5, 26.5, 1.4],
];

/** The Sunfall Arena's lawn round the ring - the stone ring
 *  stands 1.8 m over a grass field running out to the low wall before the stands. The bounds hold the fight on the ring, so
 *  the grass is what is seen past and below its edges all fight long. The
 *  walk south to the gate stays stone, and the grass parts round the
 *  ringside pieces and masts (ground only). */
export const TOURNAMENT_GROUND: GroundPlan = {
  wind: { heading: 2.6, strength: .22, gusts: 4 },
  grass: [{
    name: 'tournament lawn',
    rect: { x0: -31, z0: -31, x1: 31, z1: 33 }, texel: .4,
    floor: TOURNAMENT_FIELD.level,
    look: { height: .3, root: 0x285a26, cool: 0x44a64c, warm: 0x8ec64a, tip: 0xc0dc6a, warmth: .5, width: .045 },
    cover: { specks: [0xffffff, 0xfff27a], speckle: .04, opacity: .92 },
    flowers: { colors: [0xffffff, 0xfff27a, 0xffc0dc, 0xffffff], size: .08, reach: 14 },
    paint(field) {
      const tall = valueNoise(61), bloom = valueNoise(62), worn = valueNoise(63);
      const { ring, wall } = TOURNAMENT_FIELD;
      // The whole square field, out to the low wall before the stands (the
      // painted field everywhere it shows), and off the ring's stone and its steps.
      field.paint(DENSITY, box(0, 0, wall, wall), 1, 'set', .6);
      field.paint(DENSITY, box(0, 0, ring, ring), 0, 'min', .8);
      // The competitors' walk south to the gate, and the two lamps beside it.
      field.paint(DENSITY, box(0, 23.5, 2.1, 8.5), 0, 'min', .6);
      for (const x of [-11.2, 11.2]) field.paint(DENSITY, circle(x, 27, 1.6), 0, 'min', .5);
      // Stream E's ringside pieces and masts.
      for (const [x, z, r] of TOURNAMENT_PIECES) field.paint(DENSITY, circle(x, z, r), 0, 'min', .6);
      for (const [x, z] of TOURNAMENT_MASTS) field.paint(DENSITY, circle(x, z, .9), 0, 'min', .5);
      // Trodden thinner along the ring's foot, where the attendants walk.
      field.map(DENSITY, (v, x, z) => {
        const edge = Math.max(Math.abs(x), Math.abs(z)) - ring;
        return edge > 0 && edge < 2.2 ? v * (.55 + .45 * worn(x * .4, z * .4)) : v;
      });
      field.fill(HEIGHT, 1);
      field.map(HEIGHT, (v, x, z) => v * (.85 + .3 * tall(x * .15, z * .15)));
      field.map(FLOWERS, (_, x, z) => bloom(x * .12, z * .12) > .66 ? 1 : 0);
    },
  }],
};
