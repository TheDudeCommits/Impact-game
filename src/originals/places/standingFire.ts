/** Standing fire, the places' lights: no lanterns, bells, chimes or hanging lights in any design. Where a place has a
 *  light there is fire that stands on something - an iron basket on a post, a fire bowl on its foot, a torch in an iron
 *  bracket set in a wall - drawn into the place's own Forge (one draw a material however many), each returning where
 *  its fire burns so the place lights it with its glow (src/render/stages/glow.ts Beacons) and, where it is near enough
 *  to see, flames (ambient.fire / puffs). Nothing here is solid: the places' collision is theirs, as it was. */
import * as THREE from 'three';
import type { DressContext } from '../../render/stages/dressing';
import type { Forge } from './forge';

/** Where a fire burns, and how big. */
export interface FireAt { x: number; y: number; z: number; size: number }
/** Forge material keys: the ironwork's, the stone's or timber's, and an unlit one for the embers' glow. */
export interface FireMats { iron: string; stone?: string; wood?: string; glow?: string }

const IRON = 0x2a2622, EMBER = 0xff7a2a, ASH = 0x3a3634;

/** An iron fire basket, its foot at y, `r` its rim's radius: a collar, a flared bowl, eight short bars flaring out over its rim,
 *  open at the top (no ring: a closed cage of bars round a glow reads as a lantern's glass), the embers in it. Its fire burns
 *  up out of it, over the rim. */
export function ironBasket(f: Forge, m: FireMats, x: number, y: number, z: number, r: number, o: { tint?: number; bars?: number; lit?: boolean } = {}): FireAt {
  const tint = o.tint ?? IRON, bars = o.bars ?? 8;
  f.cyl(m.iron, x, y, z, r * .5, r * .32, r * .35, tint, { sides: 8 });
  f.cyl(m.iron, x, y + r * .35, z, r, r * .5, r * .5, tint, { sides: 10 });
  for (let k = 0; k < bars; k++) {
    const a = k / bars * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    f.pipe(m.iron, [x + c * r * .94, y + r * .8, z + s * r * .94], [x + c * r * 1.3, y + r * 1.35, z + s * r * 1.3], r * .055, tint, { sides: 4 });
  }
  if (m.glow) f.cyl(m.glow, x, y + r * .8, z, r * .9, r * .9, r * .06, o.lit === false ? ASH : EMBER, { sides: 10 });
  return { x, y: y + r * 1.05, z, size: r * 1.25 };
}

/** A post (timber or iron) `h` high with an iron fire basket on its top: a torch on a post. */
export function basketPost(f: Forge, m: FireMats, x: number, z: number, h: number, r: number, o: { post?: string; postTint?: number; y?: number; thick?: number } = {}): FireAt {
  const y = o.y ?? 0, thick = o.thick ?? r * .32;
  const wooden = !!(o.post ?? m.wood);
  f.pipe(o.post ?? m.wood ?? m.iron, [x, y, z], [x, y + h, z], thick, o.postTint ?? (wooden ? 0x3a2a1e : IRON), { r2: thick * .8, sides: 6 });
  if (!wooden) f.cyl(m.iron, x, y, z, thick * 2.4, thick * 2.8, .12, IRON, { sides: 8 });
  return ironBasket(f, m, x, y + h, z, r);
}

/** A fire bowl on its foot: a square or round foot, a short shaft, a wide shallow bowl, embers in it (cold ash with `cold`).
 *  `r` the bowl's radius, `h` the bowl's rim over y (at least its foot and bowl). In stone (m.stone) or dark bronze (m.iron). */
export function fireBowl(f: Forge, m: FireMats, x: number, y: number, z: number, r: number, h: number, o: { tint?: number; cold?: boolean; square?: boolean; rot?: number; ember?: number } = {}): FireAt {
  const key = m.stone ?? m.iron, tint = o.tint ?? 0x6a6660, rot = o.rot ?? 0;
  const foot = r * .3, bowl = r * .55, shaft = Math.max(0, h - foot - bowl), rim = y + foot + shaft + bowl;
  if (o.square) f.box(key, x, y, z, r * 1.6, foot, r * 1.6, tint, { rot });
  else f.cyl(key, x, y, z, r * .76, r * .95, foot, tint, { sides: 10 });
  if (shaft > 0) f.cyl(key, x, y + foot, z, r * .3, r * .38, shaft, tint, { sides: 8 });
  f.cyl(key, x, y + foot + shaft, z, r, r * .45, bowl, tint, { sides: 12 });
  if (m.glow) f.cyl(m.glow, x, rim - r * .12, z, r * .86, r * .86, r * .05, o.cold ? ASH : o.ember ?? EMBER, { sides: 12 });
  return { x, y: rim, z, size: r * .9 };
}

/** A torch set in a wall: an iron plate on the wall's face at (x, y, z), a bracket out along (ox, oz) (the wall's outward
 *  facing, a unit vector), an iron ring holding a wooden haft that leans out, a pitch-black head; its fire on the head.
 *  `lit` false: an unlit torch (a charred head, no fire spot's glow wanted). */
export function wallTorch(f: Forge, m: FireMats, x: number, y: number, z: number, ox: number, oz: number, o: { scale?: number; lit?: boolean } = {}): FireAt {
  const s = o.scale ?? 1, out = .26 * s;
  const rot = Math.atan2(ox, oz);
  f.box(m.iron, x + ox * .02, y - .22 * s, z + oz * .02, .2 * s, .44 * s, .04 * s, IRON, { rot });
  f.beam(m.iron, [x, y - .05 * s, z], [x + ox * out, y + .02 * s, z + oz * out], .05 * s, IRON);
  f.beam(m.iron, [x, y - .2 * s, z], [x + ox * out, y - .02 * s, z + oz * out], .04 * s, IRON);
  const hx = x + ox * out, hz = z + oz * out;
  f.add(m.iron, new THREE.TorusGeometry(.07 * s, .018 * s, 4, 10).rotateX(Math.PI / 2).translate(hx, y, hz), IRON);
  // The haft: from under the ring up through it, leaning a little out from the wall.
  const lean = .12 * s, b: [number, number, number] = [hx - ox * .05 * s, y - .32 * s, hz - oz * .05 * s], t: [number, number, number] = [hx + ox * lean, y + .3 * s, hz + oz * lean];
  f.pipe(m.wood ?? m.iron, b, t, .035 * s, 0x5a4028, { r2: .042 * s, sides: 6 });
  f.pipe(m.wood ?? m.iron, t, [t[0] + ox * .03 * s, t[1] + .16 * s, t[2] + oz * .03 * s], .06 * s, 0x1a1412, { r2: .055 * s, sides: 6 });
  if (o.lit !== false && m.glow) f.cyl(m.glow, t[0] + ox * .03 * s, t[1] + .15 * s, t[2] + oz * .03 * s, .045 * s, .05 * s, .03 * s, EMBER, { sides: 6 });
  return { x: t[0] + ox * .03 * s, y: t[1] + .22 * s, z: t[2] + oz * .03 * s, size: .32 * s };
}

/** The flames of fires that stood where lanterns were (src/render/rift/fire.ts, as the places' braziers burn: flames and a
 *  little smoke, one field), laying no pool of light on the floor - the lanterns laid none, and their glow is the place's
 *  Beacons, so the light is as it was. With `colour`, a spirit fire instead: licking additive puffs in that colour (the
 *  fire field burns orange). */
export function flames(c: DressContext, spots: readonly FireAt[], seed: number, o: { smoke?: number; colour?: number; shade?: number } = {}) {
  if (!spots.length) return;
  if (o.colour === undefined) {
    c.ambient.fire(spots.map((s, i) => ({ x: s.x, y: s.y, z: s.z, size: s.size, smoke: o.smoke ?? .15, seed: seed + i * 1.7 }))).withoutPools();
    return;
  }
  const mean = spots.reduce((a, s) => a + s.size, 0) / spots.length;
  c.ambient.puffs({ spots: spots.flatMap(s => [0, 1, 2].map(j => ({ x: s.x, y: s.y + j * s.size * .35, z: s.z, size: s.size * (1.3 - j * .32) }))),
    color: o.colour, shade: o.shade ?? o.colour, opacity: .85, life: 1, rise: 2.2 * mean, grow: .55, additive: true, seed, order: 1 });
}
