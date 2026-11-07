/** Round 4b (MAPS): the props a battle royale place is dressed with inside its
 *  play bounds, and the boxes the solid ones stand in. No renderer or DOM
 *  dependencies: the server's Rapier world, the bots' navigation grid and the
 *  client's camera occluders are all built from `propColliders` (through
 *  STAGE_LANDMARKS), and the renderer places the same list
 *  (src/render/stages), so what is drawn is what stops a fighter.
 *
 *  Everything a fighter could walk into above the ankle is solid; flat things
 *  (planks, flagstones, grass) are not. Pieces are the kit's own GLBs
 *  (public/assets/environment/<piece>.glb), set on their bottom centre. */
import type { StageId } from './stages';
import type { EnvironmentCollider } from './environmentLayout';

/** The kit pieces' own sizes (x, y, z metres), measured off the GLBs
 *  (tests/stageProps.test.ts checks these against the files). */
export const KIT_SIZE = {
  // (The fan-made houses are retired.)
  'br/rock-a': [4.8, 10.19, 4.64], 'br/rock-b': [5.03, 7.54, 3.98], 'br/rock-c': [3.92, 6.67, 4.61], 'br/rock-d': [1.55, 2.34, 1.73],
  'br/rock-formation-b': [8.17, 4.68, 4.88], 'br/stone-a': [1.38, .7, 1.52],
  'br/cart': [1.83, .97, 3.39], 'br/kenney-town-lantern': [.22, 1.56, .22], 'br/kenney-town-wall-broken': [.12, 1, 1],
  'br/kenney-town-cart-high': [.89, .86, 1.39],
  'br/meshy-stall': [3.34, 3.43, 3.26], 'br/meshy-well': [3.98, 4.33, 3.95], 'br/meshy-rubble': [6.39, 2.48, 6.43],
  'br/wall-column': [.9, 4.8, .95], 'br/podest': [7.32, .79, 5.11],
  'asian/torii': [6.6, 3.56, .68], 'br/stone-lamp': [.47, 1.04, .47], 'br/pot': [1.18, .87, 1.18],
  'br/kenney-pirate-cannon-mobile': [1.68, 1.38, 1.92], 'br/kenney-pirate-cannon': [1.4, 1.05, 1.92],
  'br/tree-place': [3.33, .42, 3.21],
  'harbor/crate': [1.08, .77, 1.31], 'harbor/barrel': [1.34, 1.23, 1.34], 'harbor/crate-bottles': [1.08, 1.06, 1.31],
  'br/kenney-town-wall-wood-broken': [.12, 1, 1],
} as const satisfies Record<string, readonly [number, number, number]>;
export type KitPieceId = keyof typeof KIT_SIZE;

export interface StageProp {
  /** A kit piece, or a shape the map's dressing builds itself (a column of
   *  `length` and `radius`, lying along its yaw, or a `stump` of one standing
   *  `length` tall; a cut `block` of `size`), or
   *  `none`: a box only, for a piece drawn with another (a torii's posts). */
  piece: KitPieceId | 'column' | 'stump' | 'block' | 'none';
  length?: number; radius?: number; size?: readonly [number, number, number];
  x: number; z: number; y?: number;
  /** Yaw, radians (three's Y rotation). */
  rot?: number;
  scale?: number;
  /** Lean, radians, about x then z - a boulder on its side. */
  tilt?: number; roll?: number;
  /** Squash on the piece's own height (a stump of a column). */
  sy?: number;
  /** A tint multiplied into the piece's colour (sRGB hex). */
  tint?: number;
  /** Solid: true boxes the rotated footprint (times `fit`, for a round rock
   *  whose corners are air) to `height` metres or the piece's own; or the
   *  box itself, about the prop's x/z. */
  solid?: true | { halfX: number; halfY: number; halfZ: number; dx?: number; dz?: number; y?: number };
  fit?: number;
  height?: number;
  /** For a `none`: what the place's own dressing draws in the box (a mast, a
   *  barricade, a rib), src/render/stages. */
  draw?: string;
}

const r = Math.PI / 180;
/** Kenney's bright crates and barrels toned to weathered wood. */
const WOOD = 0x9c8676;

/** The Mirror Mere: a torii over the approach (its four posts solid; the
 *  lintel is overhead), stone lanterns down both sides of it with fire in
 *  them, and two braziers before the seal-stone - off the spawn ellipse
 *  (22 by 24 m), clear of the limestone ridges. */
const TORII_POSTS = [-2.7, -1.48, 1.48, 2.7];
export const SHRINE_RIBS: readonly (readonly [number, number])[] = [[19.5, -20.5], [25, -6], [24.5, 7], [-19.5, -20], [-25, -5], [-24, 8]];
export const SHRINE_TABLETS: readonly (readonly [number, number])[] = [[12.5, -26.5], [-12.5, -26.5]];
const SHRINE: StageProp[] = [
  { piece: 'asian/torii', x: 0, z: 33, scale: 2.4, tint: 0x8a2a24, solid: { halfX: .48, halfY: 3.36, halfZ: .48, dx: TORII_POSTS[0] * 2.4 } },
  ...TORII_POSTS.slice(1).map(dx => ({ piece: 'none' as const, x: 0, z: 33, solid: { halfX: .48, halfY: 3.36, halfZ: .48, dx: dx * 2.4 } })),
  ...[[-10, -18], [10, -18], [-10, 0], [10, 0], [-10, 18], [10, 18]].map(([x, z]) => ({ piece: 'br/stone-lamp' as const, x, z, scale: 2.4, tint: 0x9a8a84, solid: { halfX: .55, halfY: 1.25, halfZ: .55 } })),
  { piece: 'br/pot', x: -18, z: -26, scale: 1.9, tint: 0x6a5a58, solid: { halfX: 1.1, halfY: .85, halfZ: 1.1 } },
  { piece: 'br/pot', x: 18, z: -26, scale: 1.9, tint: 0x6a5a58, solid: { halfX: 1.1, halfY: .85, halfZ: 1.1 } },
  // Near scenery round the fight: a low gate on the approach (its four posts;
  // the lintel is overhead), limestone pinnacles either side, and cairns of
  // stacked stones (src/originals/places/mirror-mere.ts draws them in these
  // boxes).
  { piece: 'asian/torii', x: 0, z: -20, y: -.3, scale: 1.25, tint: 0x7a2420, solid: { halfX: .3, halfY: 1.8, halfZ: .3, dx: TORII_POSTS[0] * 1.25 } },
  ...TORII_POSTS.slice(1).map(dx => ({ piece: 'none' as const, x: 0, z: -20, solid: { halfX: .3, halfY: 1.8, halfZ: .3, dx: dx * 1.25 } })),
  ...SHRINE_RIBS.map(([x, z]) => ({ piece: 'none' as const, draw: 'rib', x, z, solid: { halfX: .6, halfY: 2.5, halfZ: .95 } })),
  ...SHRINE_TABLETS.map(([x, z]) => ({ piece: 'none' as const, draw: 'tablets', x, z, solid: { halfX: 1, halfY: 1.2, halfZ: .85 } })),
];

/** The Ash Colosseum's court: three training posts, boulders the matches have
 *  thrown about, and a log stack - off the spawn ring (radius 26), inside the
 *  96 m square the court's wall stands round. */
const PROVING: StageProp[] = [
  ...[[-3.5, -33], [0, -34.5], [3.5, -33]].map(([x, z]) => ({ piece: 'br/wall-column' as const, x, z, scale: 1.25, sy: .42, tint: 0xa47a58, solid: { halfX: .6, halfY: 1.26, halfZ: .6 } })),
  { piece: 'br/rock-b', x: 31, z: 12, rot: .6, scale: .52, tint: 0xc0a080, solid: true, fit: .78 },
  { piece: 'br/rock-c', x: -32, z: -14, rot: 2.1, scale: .55, tint: 0xc0a080, solid: true, fit: .78 },
  { piece: 'br/rock-d', x: -18, z: 30, rot: 1.2, scale: 1.3, tint: 0xc0a080, solid: true, fit: .8 },
  { piece: 'br/rock-formation-b', x: 24, z: -30, rot: 4.1, scale: .5, tint: 0xc0a080, solid: true, fit: .8 },
  { piece: 'column', x: 34, z: 26, rot: 30 * r, length: 5.5, radius: .55, solid: { halfX: 2.6, halfY: .55, halfZ: 1.8 } },
];

/** The Kuroyuki Hall's hall (scripts/build_kuroyuki_hall.py draws all of
 *  it): eight pillars of dark wood round the middle, an andon lantern at each
 *  one's foot, four free-standing fusuma partitions between the seats, two
 *  daises with gold screens on the north side and two small rooms open to the
 *  hall in the south corners - off the spawn ring (radius 26), six metres
 *  clear of the middle. */
export const CASTLE_PILLARS: readonly (readonly [number, number])[] = [[12, 12], [-12, 12], [12, -12], [-12, -12], [17, 0], [-17, 0], [0, 17], [0, -17]];
const CASTLE: StageProp[] = [
  ...CASTLE_PILLARS.map(([x, z]) => ({ piece: 'none' as const, draw: 'pillar', x, z, solid: { halfX: .65, halfY: 8, halfZ: .65 } })),
  ...CASTLE_PILLARS.map(([x, z]) => { const d = Math.hypot(x, z); return { piece: 'none' as const, draw: 'andon', x: +(x - x / d * 1.4).toFixed(2), z: +(z - z / d * 1.4).toFixed(2), solid: { halfX: .27, halfY: .55, halfZ: .27 } }; }),
  { piece: 'none', draw: 'fusuma', x: 0, z: 31, solid: { halfX: 3.95, halfY: 1.55, halfZ: .3 } },
  { piece: 'none', draw: 'fusuma', x: 0, z: -31, solid: { halfX: 3.95, halfY: 1.55, halfZ: .3 } },
  { piece: 'none', draw: 'fusuma', x: 31, z: 0, solid: { halfX: .3, halfY: 1.55, halfZ: 3.95 } },
  { piece: 'none', draw: 'fusuma', x: -31, z: 0, solid: { halfX: .3, halfY: 1.55, halfZ: 3.95 } },
  ...[-24, 24].flatMap(x => [
    { piece: 'none' as const, draw: 'dais', x, z: -26, solid: { halfX: 3.1, halfY: .3, halfZ: 2.6 } },
    { piece: 'none' as const, draw: 'byobu', x, z: -28.2, solid: { halfX: 3, halfY: 1.1, halfZ: .2, y: 1.7 } },
    ...[-2.4, 2.4].map(dx => ({ piece: 'none' as const, draw: 'andon', x: x + dx, z: -24.4, solid: { halfX: .27, halfY: .55, halfZ: .27, y: 1.15 } })),
  ]),
  ...[-1, 1].flatMap(side => [
    { piece: 'none' as const, draw: 'room', x: side * 31.7, z: 28.5, solid: { halfX: .22, halfY: 1.4, halfZ: 3.25 } },
    { piece: 'none' as const, draw: 'room', x: side * 28.5, z: 31.7, solid: { halfX: 3.25, halfY: 1.4, halfZ: .22 } },
    { piece: 'none' as const, draw: 'post', x: side * 25.3, z: 25.3, solid: { halfX: .2, halfY: 1.65, halfZ: .2 } },
    { piece: 'none' as const, draw: 'andon', x: side * 26.7, z: 26.7, solid: { halfX: .25, halfY: .5, halfZ: .25 } },
  ]),
];

/** The Starfall Crater (the bigger cover - the wreckage heaps, the heaved
 *  crust, the fallen roofs - is boxed in environmentLayout.ts): the village's
 *  smaller wreckage on the crater's floor - broken timber walls, a cart,
 *  rubble - and charred posts driven in by twos and threes
 *  (src/originals/places/craterWreck.ts draws them).
 *  Off the twelve seats (radius 26) and 6 m clear of the centre. */
const CRATER: StageProp[] = [
  { piece: 'br/kenney-town-wall-wood-broken', x: -26, z: -2, rot: 75 * r, scale: 3, tint: 0xb8a48c, solid: true, fit: 1 },
  { piece: 'br/kenney-town-wall-wood-broken', x: 27.5, z: 3.5, rot: -100 * r, scale: 3, tint: 0xb8a48c, solid: true, fit: 1 },
  { piece: 'br/kenney-town-cart-high', x: 10, z: -31, rot: 40 * r, scale: 2, tint: 0xc0aa90, solid: true, fit: .85 },
  { piece: 'br/meshy-rubble', x: -6, z: 25.5, rot: 30 * r, scale: .6, tint: 0xd0c0a8, solid: { halfX: 1.2, halfY: .7, halfZ: 1.2 } },
  { piece: 'br/meshy-rubble', x: 30, z: 24, rot: 120 * r, scale: .55, tint: 0xd0c0a8, solid: { halfX: 1.1, halfY: .65, halfZ: 1.1 } },
  { piece: 'br/meshy-rubble', x: -29, z: -30, rot: 200 * r, scale: .58, tint: 0xd0c0a8, solid: { halfX: 1.15, halfY: .65, halfZ: 1.15 } },
  ...([[22, -22], [-8, -27], [-31, 19], [33, -32], [-18, -33]] as const).map(([x, z]) =>
    ({ piece: 'none' as const, draw: 'posts', x, z, solid: { halfX: .55, halfY: 1.6, halfZ: .55 } })),
];

export const STAGE_PROPS: Partial<Record<StageId, readonly StageProp[]>> = {
  'ash-colosseum': PROVING,
  'mirror-mere': SHRINE,
  'kuroyuki-hall': CASTLE,
  'starfall-crater': CRATER,
};

/** The axis-aligned box a placed prop stands in, or none for a flat one. */
export function propCollider(p: StageProp): EnvironmentCollider | undefined {
  if (!p.solid) return undefined;
  const scale = p.scale ?? 1;
  if (p.solid !== true || p.piece === 'column' || p.piece === 'stump' || p.piece === 'block' || p.piece === 'none') {
    if (p.solid === true) throw new Error(`${p.piece} needs its box`);
    const { halfX, halfY, halfZ, dx = 0, dz = 0, y } = p.solid;
    return { x: p.x + dx, y: y ?? (p.y ?? 0) + halfY, z: p.z + dz, halfX, halfY, halfZ };
  }
  const [w, h, d] = KIT_SIZE[p.piece];
  const fit = p.fit ?? 1, yaw = p.rot ?? 0;
  const c = Math.abs(Math.cos(yaw)), s = Math.abs(Math.sin(yaw));
  const halfX = (w * c + d * s) / 2 * scale * fit, halfZ = (w * s + d * c) / 2 * scale * fit;
  // A tilted piece is as tall as its lean leaves it.
  const lean = Math.max(Math.abs(p.tilt ?? 0), Math.abs(p.roll ?? 0));
  const height = p.height ?? h * scale * (lean ? Math.max(Math.cos(lean), .35) : 1);
  return { x: p.x, y: (p.y ?? 0) + height / 2, z: p.z, halfX, halfY: height / 2, halfZ };
}

/** Every solid prop's box on a stage. */
export function propColliders(stage: StageId): EnvironmentCollider[] {
  return (STAGE_PROPS[stage] ?? []).map(propCollider).filter((c): c is EnvironmentCollider => !!c);
}
