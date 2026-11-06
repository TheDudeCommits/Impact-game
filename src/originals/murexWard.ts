import * as THREE from 'three';
import type { MoveStage, StageLook } from '../render/signature/MoveStage';
import { originalBody } from './launch';

export const MUREX = originalBody('murex');
const lin = (r: number, g: number, b: number) => new THREE.Color(r, g, b);
/** His violet: a bone-white heart (the spines' tips), the frame's violet, a deep bruise at the rim, and the violet light
 *  it throws on the floor. */
export const WARD: StageLook = { core: lin(2.7, 2.3, 3.3), main: lin(1.3, .4, 2.25), rim: lin(.42, .06, .76), light: lin(.92, .5, 1.38),
  element: { spike: 0xf2e4ff, rim: 0x9a4ae8, light: 0xb070ff, ink: 0x16052a }, shell: 0xa060ff, edge: 0x3c0c70, flame: -1, dark: false, heart: 0 };

export function murexLook(main: StageLook): StageLook { return MUREX ? WARD : main; }

const TAU = Math.PI * 2;
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3();
const hash = (x: number) => { const v = Math.sin(x * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };
function point(out: THREE.Vector3, at: THREE.Vector3, x: THREE.Vector3, y: THREE.Vector3, r: number, a: number) {
  return out.copy(at).addScaledVector(x, Math.cos(a) * r).addScaledVector(y, Math.sin(a) * r);
}

type Nested = (st: MoveStage, at: THREE.Vector3, x: THREE.Vector3, y: THREE.Vector3, radius: number, sides: number, count: number, width: number, look: StageLook, k?: number, intensity?: number, spin?: number, time?: number, first?: number, span?: number) => void;

export function ward(st: MoveStage, at: THREE.Vector3, x: THREE.Vector3, y: THREE.Vector3, radius: number, sides: number, count: number, width: number, look: StageLook, k = 1, intensity = 1, spin = 0, time = 0, first = 0, span = sides) {
  if (k <= .02 || intensity <= .02) return;
  const whole = span >= sides, from = spin + first * TAU / sides, arc = whole ? TAU : span * TAU / sides;
  for (let i = 1; i <= count; i++) {
    const s = i / count; if (s > k + .001) break;
    const ripple = .55 + .45 * Math.max(0, Math.sin(time * 9 - i * 1.1)), outer = i === count || s + 1 / count > k + .001;
    const lit = intensity * ripple * (outer ? 1.15 : .95), w = width * (.7 + .5 * s) * 1.5;
    if (lit <= .02 || radius * s <= .02) continue;
    const r0 = radius * (i - 1) / count, r1 = radius * s, S = span;
    const strap = outer ? (S >= 6 ? 2 : S >= 3 ? 1 : 0) : 0, segs = S - strap;
    const colour = outer ? look.core : look.main, spine = i === 1 ? 0 : radius * (outer ? .26 : .13) * (.85 + .3 * hash(i * 3.1 + count));
    const turn = (f: number) => from + arc * f, rad = (f: number) => r0 + (r1 - r0) * f;
    point(_a, at, x, y, rad(0), turn(0));
    for (let j = 1; j <= segs; j++) {
      const f = j / segs, out = j % 2 === 1 && j < segs ? spine : 0;
      point(_b, at, x, y, rad(f) + out, turn(f) - (out ? .18 : 0));
      st.streak(_a, _b, out ? w * 1.25 : w, out ? look.core : colour, out ? lit * 1.05 : lit);
      _a.copy(_b);
    }
    // The torn restraint: a strap across the whole ward through its heart, parted in the middle (in a sector, its half).
    for (let j = 0; j < strap; j++) {
      const phi = whole ? spin + .62 + j * Math.PI : from + arc * .5;
      _c.copy(x).multiplyScalar(Math.cos(phi)).addScaledVector(y, Math.sin(phi));
      _d.copy(x).multiplyScalar(-Math.sin(phi)).addScaledVector(y, Math.cos(phi));
      _a.copy(at).addScaledVector(_d, radius * s * .12).addScaledVector(_c, radius * s * .96);
      _b.copy(at).addScaledVector(_d, radius * s * (j ? -.05 : .05)).addScaledVector(_c, radius * s * .14);
      st.streak(_a, _b, w * 1.2, look.core, lit * .8);
    }
  }
}

export function murexNested(main: Nested): Nested { return MUREX ? ward : main; }

export function murexCrown(st: MoveStage, centre: THREE.Vector3, across: THREE.Vector3, reach: number, size: number, fade: number, look: StageLook) {
  if (!MUREX) return false;
  if (fade <= .02) return true;
  const n = 11;
  for (let i = 0; i < n; i++) {
    // Fanned over the upper half-turn and a little below it, longest straight out to each side, as a murex's crown.
    const a = Math.PI * (-.12 + 1.24 * i / (n - 1)), len = reach * (.45 + .55 * Math.abs(Math.cos(a))) * (.8 + .2 * hash(i * 1.7));
    _c.copy(across).multiplyScalar(Math.cos(a)); _c.y = Math.sin(a) * .85;
    _a.copy(centre).addScaledVector(_c, .35 * size);
    _b.copy(centre).addScaledVector(_c, len * .55); _d.copy(centre).addScaledVector(_c, len);
    st.streak(_a, _b, .5 * size * (.5 + .5 * fade), look.main, 1.05 * fade); st.streak(_b, _d, .18 * size * (.5 + .5 * fade), look.core, 1.2 * fade);
  }
  st.glow(centre, 2.4 * size, look.core, .8 * fade); st.glow(centre, 4.5 * size, look.main, .35 * fade);
  return true;
}
