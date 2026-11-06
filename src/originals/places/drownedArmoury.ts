import type { Sculpt } from '../../render/rift/sculpt';
import type { FireSpot } from '../../render/rift/fire';
import type { RiftProp } from '../../game/riftLayouts';
import { Rig, rig, SHIELD, ROUNDEL, seeded, smooth } from './riftKit';

const RUST = 0x86664e, RUST_DARK = 0x644c3a, IRON = 0x4a4440, HOLE = 0x060505, STONE = 0x8e8a84, STONE_DARK = 0x66625c;
const REED = 0x8a7a4e, REED_DARK = 0x5e5034, SHAFT = 0x3a2a1c, RAG = 0x3a2e2c;

/** The lake reaches this far past the field's edge before its banks rise. */
const LAKE = 64;
const isles = smooth(41), banks = smooth(43);

/** The ground under the lake (it lies under the water's surface, y 0, everywhere the fight is): flat and drowned over the
 *  field, mud islets out in the lake, and banks rising past it to the hills. */
export function armouryGround(x: number, z: number, halfX: number, halfZ: number) {
  const out = Math.max(Math.abs(x) - halfX - 3, Math.abs(z) - halfZ - 3, 0);
  if (out <= 0) return -.35;
  const islet = out > 7 ? Math.max(0, isles(x * .05, z * .05) - .64) * 3.4 * Math.min(1, (out - 7) / 8) : 0;
  const bank = Math.pow(Math.max(0, Math.min(1, (out - LAKE) / 55)), 1.5) * (4 + banks(x * .03, z * .03) * 9);
  return -.35 + islet + bank;
}

// ---- the pieces of armour -----------------------------------------------------------------------------------------

/** A knight's visored helm, its foot at the frame's origin and its face toward +z: the mail cape flaring at its foot, the
 *  tall rounded skull, and the visor's pointed snout thrust forward with the sight cut across it and breaths along its
 *  sides; a ridge over the crown. About 9.5 units high. */
export function greatHelm(g: Rig, worn = .5, small = false) {
  const n = small ? 7 : 12;
  g.use('metal', RUST_DARK, .1).cyl(4.5, 2.6, n, .8);
  g.use('metal', RUST, .1).at(0, 2.5, 0).cyl(3.6, 3, n, .98);
  g.at(0, 5.4, 0).sphere(3.55, 1.15);
  g.use('metal', IRON, .06).at(0, 2.4, 0).cyl(3.7, .45, n);
  const visor = g.at(0, 4.35, 1.6, Math.PI / 2 - .12);
  visor.use('metal', RUST, .08).cone(2.5, 4.4, small ? 5 : 6);
  g.use('dark', HOLE, .02).at(0, 5.05, 2.9, -.12).box(3.9, .5, 1.6);
  if (small) return;
  for (const side of [-1, 1]) for (let i = 0; i < 3; i++) g.at(side * (.85 + i * .38), 3.5 - i * .25, 3.5 + i * .3, 0, side * .5).box(.24, .7, .5);
  g.use('metal', IRON, .06).at(0, 8.6, -.4).box(.45, .7, 5.6);
  for (const side of [-1, 1]) g.at(side * 3.55, 4.4, 1.1, 0, 0, Math.PI / 2 * side).cyl(.42, .3, 8);
  if (worn > .4) g.use('dark', HOLE).at(-3.1, 4.4, -1.4, 0, -.9).box(1.3, 1.1, .6);
}

/** A gauntlet up its frame's y: the vambrace in its lames, the flared cuff, the back of the hand, four fingers of three
 *  plates and the thumb, open (1) or a fist (0); the palm toward +z. About 12.5 units high, open. */
export function gauntlet(g: Rig, open: number) {
  g.use('metal', RUST, .1).cyl(1.45, 5.2, 12, 1.12);
  g.use('metal', IRON, .06);
  for (let i = 0; i < 4; i++) g.at(0, .55 + i * 1.25, 0).cyl(1.5 + i * .05, .3, 12);
  g.use('metal', RUST_DARK, .08).at(0, 5.2, 0).cyl(1.72, 1.5, 12, 1.24);
  const hand = g.at(0, 6.6, 0, -.1);
  hand.use('metal', RUST, .08).box(2.9, 2.6, 1.3);
  hand.use('metal', IRON, .06).at(0, 2.45, .05).box(3.15, .5, 1.45);
  const curl = .12 + (1 - open) * 1.18;
  [-1.08, -.36, .36, 1.08].forEach((fx, i) => {
    const len = [.95, 1.12, 1.06, .86][i];
    let f = hand.at(fx, 2.8, 0, curl * .55, 0, -fx * .1 * open);
    for (let j = 0; j < 3; j++) {
      const L = len * [1, .84, .72][j];
      f.use('metal', j % 2 ? IRON : RUST, .08).box(.6 - j * .06, L, .62 - j * .05);
      f = f.at(0, L, 0, curl * .95);
    }
  });
  let t = hand.at(-1.55, .5, .25, .4 * (1 - open), 0, .35 + .7 * open);
  for (let j = 0; j < 2; j++) { t.use('metal', j ? IRON : RUST, .08).box(.66, 1.15 - j * .2, .62); t = t.at(0, 1.15 - j * .2, 0, .55 * (1 - open) + .1, 0, -.15); }
}

/** A heater shield up its frame's y, its face toward +z, one unit wide: the dished face, its rim, two straps and the boss. */
export function heater(g: Rig, worn = .5) {
  g.use('metal', IRON, .06).at(0, -.04, -.03).add(SHIELD, 1.07, 1.06, 1);
  g.use('metal', worn > .5 ? RUST : RUST_DARK, .1).add(SHIELD);
  g.use('metal', IRON, .05);
  for (const y of [.42, .86]) g.at(0, y, .03).box(.96 - (y < .5 ? .2 : 0), .06, .04);
  g.at(0, .62, .02, Math.PI / 2).cyl(.11, .1, 6, .45);
}

/** A round shield, a unit across, its face toward +z (its rim's foot at the origin): the face, its rim, the boss. */
export function roundel(g: Rig) {
  g.use('metal', IRON, .05).at(0, -.03, -.02).add(ROUNDEL, 1.06, 1.06, 1);
  g.use('metal', RUST, .1).add(ROUNDEL);
  g.use('metal', IRON, .05).at(0, .5, .04, Math.PI / 2).cyl(.13, .1, 7, .45);
}

// ---- the field's props ---------------------------------------------------------------------------------------------

/** A prop of the field, drawn as the Armoury's. False for those main draws itself (the dead, the gallows, the trees). */
export function armouryProp(k: Sculpt, p: RiftProp, fires: FireSpot[]): boolean {
  const r = p.seed;
  switch (p.kind) {
    case 'statue':
      // The crown: a colossal gauntlet reaching up out of the water, its palm to the field, filling the great sword's pillar.
      gauntlet(rig(k, p.x, -1.6, p.z, .1, Math.PI + .5, -.08, .9), .85);
      return true;
    case 'rock': {
      // An outcrop: the armour of a giant half-sunk in its box (a helm, a fist, a shield on its side).
      const s = Math.min(p.w, p.d);
      if (r < .5) greatHelm(rig(k, p.x, -1.2 - s * .05, p.z, (r - .25) * .5, p.rot, (r - .25) * .6, (p.h + 1.2) / 9.5), r);
      else heater(rig(k, p.x, -.7, p.z, -1.18, p.rot, (r - .75) * .8, Math.max(p.w, p.d) * .95), r);
      return true;
    }
    case 'sword': {
      // A pike or a halberd of the drowned host, rusted, standing in the water at its lean; some snapped off.
      const g = rig(k, p.x, -.35, p.z, (r - .5) * .7, p.rot, (((r * 7.3) % 1) - .5) * .5);
      const broken = r < .2, h = (broken ? .5 : 1) * (p.h + .45);
      g.use('wood', SHAFT, .14).cyl(.042, h, 5, .8);
      if (broken) { g.at(0, h, 0, .5, 0, .3).use('wood', 0x24180e, .08).cone(.032, .3, 4); return true; }
      const head = g.at(0, h, 0);
      head.use('metal', RUST, .16).cyl(.05, .1, 5);
      if (r > .6) {
        head.at(.15, -.08, 0).box(.27, .38, .028);
        head.at(-.04, .02, 0, 0, 0, 1.25).cone(.03, .22, 4);
        head.at(0, .08, 0).cone(.045, .46, 4);
      } else head.at(0, .08, 0).cone(.075, .52, 4);
      if (r > .86) g.at(.04, h * .78, 0, 0, 0, .06).use('cloth', RAG, .2).box(.42, .55, .02);
      return true;
    }
    case 'grave':
      // A shield standing in the shallows at a lean, or a helm on its side.
      if (r < .84) heater(rig(k, p.x, -.42, p.z, -.42 - ((r * 3.3) % 1) * .55, p.rot, (((r * 5.1) % 1) - .5) * .6, p.h * .95), r);
      else greatHelm(rig(k, p.x, -.5, p.z, (r - .92) * .5, p.rot, (((r * 3.7) % 1) - .5) * .4, .11 + (r - .84) * .3), r, true);
      return true;
    case 'stake': {
      // A pike driven in to mark the line, a helm set on its point.
      k.use('wood', SHAFT, .12).cylinder(p.x, -.35, p.z, .05, p.h + .3, 5, 0, (r - .5) * .16, (r - .5) * .16, .85);
      greatHelm(rig(k, p.x, p.h - .05, p.z, (r - .5) * .3, p.rot, (r - .5) * .2, .052), r, true);
      void fires;
      return true;
    }
    default: return false;
  }
}

// ---- the lake round the field ---------------------------------------------------------------------------------------

/** The causeway's lines (x, z), from the south shore across the field to the reaching hand, and its branches out to the
 *  giant pieces. */
const CAUSEWAY: readonly (readonly [number, number])[][] = [
  [[-7, -96], [-3, -66], [-5, -44], [-1, -28], [2, -15], [-1, -4], [2, 6], [.5, 12.5]],
  [[.5, 12.5], [-8, 21], [-20, 30], [-34, 39], [-50, 47]],
  [[2, -15], [14, -19], [28, -24], [44, -27], [62, -18]],
  [[-1, -4], [-14, -1], [-30, 4], [-47, 4], [-66, 12]],
  [[2, 6], [14, 14], [26, 25], [39, 38], [50, 51]],
];

export interface Beyond {
  halfX: number; halfZ: number; fires: FireSpot[];
  /** RiftStage's set piece: what follows is one, standing at (x, z), falling toward `angle`. Its tag (0: none left). */
  piece: (x: number, z: number, angle: number, size: number, height: number, rigid?: boolean, y?: number) => number;
  at: (x: number, z: number) => number;
}

/** Everything round the field: the causeway, the giant armour out in the lake, the host's pikes in their ranks, the reed
 *  beds and their fires, and the standards that come down as the fight worsens. */
export function armouryBeyond(k: Sculpt, b: Beyond) {
  const { halfX, halfZ, fires, piece, at } = b, edge = Math.max(halfX, halfZ), r = seeded(9187);
  k.tag(0);
  causeway(k, r, edge);
  // The giant armour: one in every direction the fight can face, near enough to stand in its frame (past the camera's
  // walls, ten metres out), and greater ones far out on the water against the dusk.
  const face = (x: number, z: number) => Math.atan2(-x, -z);
  const giants: [kind: string, x: number, z: number, s: number, extra: number][] = [
    ['helm', -56, 52, 2.05, .12], ['hand', 55, 58, 1.75, .9], ['fist', -63, -30, 1.55, 0], ['heater', 66, -6, 14, .5],
    ['helm', 14, -66, 1.7, .3], ['roundel', -32, -72, 12, .3], ['helm', 96, -88, 3.4, .1], ['hand', -30, 122, 2.9, .75],
    ['heater', -122, 34, 22, .35], ['hand', 118, 66, 3, .6], ['helm', 2, 54, 1.05, .08], ['fist', -50, 6, .95, 0],
    ['heater', 34, -52, 8, .6], ['helm', 52, 20, .95, -.1], ['roundel', -48, -48, 7.5, .5], ['helm', -96, -70, 2.6, .2],
  ];
  for (const [kind, x, z, s, extra] of giants) {
    const yaw = face(x, z) + (r() - .5) * .5, y = at(x, z);
    if (kind === 'helm') greatHelm(rig(k, x, y - 2.2 * s, z, extra, yaw, (r() - .5) * .25, s), r());
    else if (kind === 'hand') gauntlet(rig(k, x, y - 3 * s, z, .14, yaw, (r() - .5) * .3, s), extra);
    else if (kind === 'fist') gauntlet(rig(k, x, y - .8 * s, z, 1.5, yaw + 1.2, (r() - .5) * .5, s), 0);
    else if (kind === 'heater') heater(rig(k, x, y - s * .25, z, -extra, yaw, (r() - .5) * .3, s), r());
    else roundel(rig(k, x, y - s * .35, z, -extra, yaw, (r() - .5) * .3, s));
  }
  // The host, drowned standing: blocks of pikes in their ranks out in the water, each at its own lean.
  for (let f = 0; f < 12; f++) {
    const a = f / 12 * Math.PI * 2 + r() * .3, d = edge + 9 + r() * 34, cx = Math.sin(a) * d, cz = Math.cos(a) * d;
    if (CAUSEWAY.some(line => line.some(([x, z]) => Math.hypot(x - cx, z - cz) < 9))) continue;
    const yaw = r() * Math.PI, ranks = 4 + Math.floor(r() * 4), files = 6 + Math.floor(r() * 6);
    for (let i = 0; i < ranks; i++) for (let j = 0; j < files; j++) {
      if (r() < .16) continue;
      const u = (j - files / 2) * 1.7 + (r() - .5) * .5, v = (i - ranks / 2) * 1.9 + (r() - .5) * .5;
      const x = cx + u * Math.cos(yaw) + v * Math.sin(yaw), z = cz - u * Math.sin(yaw) + v * Math.cos(yaw);
      if (Math.max(Math.abs(x), Math.abs(z)) < edge + 2) continue;
      const tall = 2.6 + r() * 1.6, broken = r() < .25, lean = (r() - .5) * .3 + .12;
      const g = rig(k, x, at(x, z) - .2, z, lean, yaw, (r() - .5) * .25);
      g.use('wood', SHAFT, .14).cyl(.05, broken ? tall * .5 : tall, 5, .8);
      if (!broken) g.at(0, tall, 0).use('metal', RUST, .16).cone(.08, .5, 4);
    }
  }
  // Shields and helms out in the shallows, and the reed beds on the mud.
  for (let i = 0; i < 46; i++) {
    const a = r() * Math.PI * 2, d = edge + 4 + Math.pow(r(), 1.4) * 52, x = Math.sin(a) * d, z = Math.cos(a) * d, y = at(x, z);
    if (r() < .55) heater(rig(k, x, y - .2, z, (r() - .5) * 1.4, r() * 6, (r() - .5) * .6, 1 + r() * 1.4), r());
    else greatHelm(rig(k, x, y - .6, z, (r() - .5) * .4, r() * 6, (r() - .5) * .5, .14 + r() * .1), r(), true);
  }
  reeds(k, r, edge, at);
  // The host's standards, tall in the water round the field: they come down as the fight there worsens.
  for (let i = 0; i < 14; i++) {
    const a = i / 14 * Math.PI * 2 + r() * .3, d = edge + 7 + r() * 28, x = Math.sin(a) * d, z = Math.cos(a) * d;
    const tall = 8 + r() * 6, g0 = at(x, z) - .3, lean = (r() - .5) * .16;
    piece(x, z, r() * Math.PI * 2, 3, tall, true, g0);
    const g = rig(k, x, g0, z, lean, r() * 6, (r() - .5) * .12);
    g.use('wood', SHAFT, .1).cyl(.14, tall, 6, .7);
    g.at(0, tall - .9, 0).box(2.6, .14, .14);
    g.use('cloth', r() < .5 ? RAG : 0x2a1e1c, .2).at(0, tall - 4.1, .05, 0, 0, (r() - .5) * .14).box(2.2, 3.2, .04);
    g.use('metal', RUST, .12).at(0, tall, 0).cone(.18, .9, 4);
    k.tag(0);
  }
  // What burns: the reed beds catch as the fight goes on; a few fires on the islets from the start.
  for (let i = 0; i < 24; i++) {
    const a = i / 24 * Math.PI * 2 + r() * .2, d = edge + 5 + r() * 22, x = Math.sin(a) * d, z = Math.cos(a) * d;
    fires.push({ x, y: Math.max(0, at(x, z)), z, size: 1.4 + r() * 1.8, smoke: .8, seed: r() * 60, from: i % 6 === 0 ? 0 : i % 2 ? .5 : .95 });
  }
}

/** The causeway: flat stones laid two and three across along its lines, their tops just over the water; fewer and
 *  smaller toward the shore, a few lost. */
function causeway(k: Sculpt, r: () => number, edge: number) {
  for (const line of CAUSEWAY) for (let s = 0; s + 1 < line.length; s++) {
    const [x0, z0] = line[s], [x1, z1] = line[s + 1], len = Math.hypot(x1 - x0, z1 - z0), yaw = Math.atan2(x1 - x0, z1 - z0);
    for (let t = 0; t < len; t += .95 + r() * .35) {
      const x = x0 + (x1 - x0) * t / len, z = z0 + (z1 - z0) * t / len, far = Math.max(0, Math.max(Math.abs(x), Math.abs(z)) - edge);
      for (const across of [-1.2, 0, 1.2]) {
        if (r() < .1 + far * .006 || (across && far > 30 && r() < .5)) continue;
        const side = across + (r() - .5) * .5, along = (r() - .5) * .4;
        const ox = x + Math.cos(yaw) * side + Math.sin(yaw) * along, oz = z - Math.sin(yaw) * side + Math.cos(yaw) * along;
        const rad = .42 + r() * .36, sides = 5 + Math.floor(r() * 3);
        k.use('bone', r() < .3 ? STONE_DARK : STONE, .14).cylinder(ox, .009 - .16, oz, rad, .16, sides, r() * 6, (r() - .5) * .03, (r() - .5) * .03);
      }
    }
  }
}

/** Reed beds: on the mud islets out in the lake and along the field's edge (never on it), clumps of dead reeds at their
 *  leans, a few flowered heads. */
function reeds(k: Sculpt, r: () => number, edge: number, at: (x: number, z: number) => number) {
  let placed = 0;
  for (let tries = 0; placed < 320 && tries < 4000; tries++) {
    const a = r() * Math.PI * 2, d = edge + 1.5 + Math.pow(r(), 1.2) * 70, x = Math.sin(a) * d, z = Math.cos(a) * d, y = at(x, z);
    const fringe = d < edge + 9;
    if (!fringe && y < -.15) continue;
    if (CAUSEWAY.some(line => line.some(([cx, cz]) => Math.hypot(cx - x, cz - z) < 3))) continue;
    placed++;
    const n = 10 + Math.floor(r() * 12), spread = .5 + r() * 1.3, ground = Math.max(-.05, y);
    for (let i = 0; i < n; i++) {
      const ox = x + (r() - .5) * spread * 2, oz = z + (r() - .5) * spread * 2, tall = 1 + r() * 1.4;
      k.use('thatch', r() < .4 ? REED_DARK : REED, .16).cone(ox, ground - .1, oz, .03 + r() * .015, tall, 3, r() * 6, (r() - .5) * .5, (r() - .5) * .5);
      if (r() < .12) k.use('thatch', REED_DARK, .1).cylinder(ox, ground + tall * .8, oz, .045, .22, 4, 0, 0, 0, .6);
    }
  }
}

/** The lake's own surface, at the fight's floor: drawn where RiftStage lays the Harbour's sea (riftPlaces.ts). */
export const ARMOURY_WATER = { size: 440, y: -.004, color: 0x0c1418 } as const;

/** On the inked page, after the sea's strokes (src/render/rift/ink.ts WATER_STROKES, which draw a rolling swell in long
 *  arcs over a pale tone): the lake is still and darker - a grey screentone, short level ripples broken along their rows,
 *  closing to the tone with distance, and pale glints where the dusk catches it. */
export const STILL_WATER = /* glsl */`
		{
			vec2 w = vInkWorld;
			float level = max( 0.0, log2( max( inkDepth, 1.0 ) / 12.0 ) );
			float fine = exp2( - floor( level ) ), blend = fract( level );
			float ripple = 0.0, glint = 0.0;
			for ( int n = 0; n < 2; n ++ ) {
				float scale = ( n == 0 ? fine : fine * .5 ) * 1.6;
				float rowAt = w.y * .9 * scale + sin( w.x * .05 * scale + uSkyTime * .08 ) * .5;
				float row = floor( rowAt ), across = abs( fract( rowAt ) - .5 ), aa = fwidth( rowAt ) * 1.2;
				float run = sin( w.x * scale * ( .5 + .3 * inkHash( vec2( row, 11.0 + float( n ) ) ) ) + row * 4.1 + uSkyTime * .15 );
				float fade = 1.0 - smoothstep( .3, .8, aa ), share = n == 0 ? 1.0 - blend : blend;
				ripple += ( 1.0 - smoothstep( .05 - aa, .05 + aa, across ) ) * smoothstep( .35, .7, run ) * fade * share;
				glint += ( 1.0 - smoothstep( .1 - aa, .1 + aa, abs( fract( rowAt + .5 ) - .5 ) ) ) * smoothstep( .86, .97, run ) * fade * share;
			}
			inkLine = ripple * .85;
			inkValueHere = mix( .4, .3, smoothstep( 30.0, 160.0, inkDepth ) ) - .08 * ( 1.0 - inkKeyLit ) + glint * .6;
		}`;
