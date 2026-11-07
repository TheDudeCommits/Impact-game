type P = readonly [number, number];

const f = (n: number) => +n.toFixed(1);
/** Twice the signed area: positive for a clockwise ring of points on screen (y down). */
const area2 = (pts: readonly P[]) => pts.reduce((s, [x, y], i) => { const [u, v] = pts[(i + 1) % pts.length]; return s + x * v - u * y; }, 0);
/** A closed polygon, wound as a solid (or as a hole: `hole`). */
function poly(points: readonly P[], hole = false): string {
  const pts = (area2(points) > 0) !== hole ? points : [...points].reverse();
  return `M${pts.map(([x, y]) => `${f(x)} ${f(y)}`).join('L')}Z`;
}
const rot = ([x, y]: P, cx: number, cy: number, a: number): P => [cx + (x - cx) * Math.cos(a) - (y - cy) * Math.sin(a), cy + (x - cx) * Math.sin(a) + (y - cy) * Math.cos(a)];
function ellipse(cx: number, cy: number, rx: number, ry: number, angle = 0, hole = false, n = 48): string {
  const pts: P[] = [];
  for (let i = 0; i < n; i++) { const t = i / n * Math.PI * 2; pts.push(rot([cx + rx * Math.cos(t), cy + ry * Math.sin(t)], cx, cy, angle)); }
  return poly(pts, hole);
}
const circle = (cx: number, cy: number, r: number, hole = false) => ellipse(cx, cy, r, r, 0, hole);
const ring = (cx: number, cy: number, outer: number, inner: number) => circle(cx, cy, outer) + circle(cx, cy, inner, true);
/** A rod from one point to another with rounded ends (a bone's shaft, a clock hand). */
function rod(x1: number, y1: number, x2: number, y2: number, r: number, hole = false): string {
  const a = Math.atan2(y2 - y1, x2 - x1), pts: P[] = [];
  for (let i = 0; i <= 12; i++) { const t = a + Math.PI / 2 + i / 12 * Math.PI; pts.push([x1 + r * Math.cos(t), y1 + r * Math.sin(t)]); }
  for (let i = 0; i <= 12; i++) { const t = a - Math.PI / 2 + i / 12 * Math.PI; pts.push([x2 + r * Math.cos(t), y2 + r * Math.sin(t)]); }
  return poly(pts, hole);
}
function star(cx: number, cy: number, outer: number, inner: number, points = 5, turn = -Math.PI / 2): string {
  const pts: P[] = [];
  for (let i = 0; i < points * 2; i++) { const r = i % 2 ? inner : outer, t = turn + i * Math.PI / points; pts.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]); }
  return poly(pts);
}
/** A ume petal pointing up from the blossom's centre (50, 50): an oval with a V notch cut into its tip. */
function petal(): P[] {
  const pts: P[] = [], t0 = Math.asin(3.2 / 13);
  for (let i = 0; i <= 36; i++) {
    const t = t0 + i / 36 * (Math.PI * 2 - 2 * t0);
    pts.push([50 + 13 * Math.sin(t), 26 - 22 * Math.cos(t)]);
  }
  pts.push([50, 26 - 22 + 7]);
  return pts;
}
export const SYMBOLS = {
  /** KoKo: a star. */
  star: star(50, 52, 46, 19),
  /** 'LORD ORO': HUSH's clock face. */
  clock: ring(50, 50, 46, 39) + [...Array(12).keys()].map(i => { const a = i * Math.PI / 6, r1 = i % 3 ? 33 : 30; return rod(50 + Math.cos(a) * r1, 50 + Math.sin(a) * r1, 50 + Math.cos(a) * 36, 50 + Math.sin(a) * 36, i % 3 ? 1.4 : 2.4); }).join('')
    + rod(50, 50, 50, 20, 2.6) + rod(50, 50, 69, 61, 3.2) + circle(50, 50, 5),
  /** Kagari: a spade. */
  spade: circle(33, 56, 18.5) + circle(67, 56, 18.5) + poly([[50, 6], [16, 52], [50, 64], [84, 52]]) + poly([[50, 56], [63, 93], [37, 93]]),
  /** Gosu: the heart he wears. */
  heart: circle(35, 37, 18.5) + circle(65, 37, 18.5) + poly([[18.5, 43], [81.5, 43], [50, 88]]),
  /** A lightning bolt. */
  bolt: poly([[58, 6], [24, 54], [46, 54], [36, 94], [76, 42], [54, 42], [66, 6]]),
  /** Ume: a forehead seal. */
  seal: poly([[50, 6], [80, 50], [50, 94], [20, 50]]) + poly([[50, 30], [63, 50], [50, 70], [37, 50]], true),
  /** Tobari: a cloud. */
  cloud: circle(27, 58, 15) + circle(43, 44, 18) + circle(62, 41, 17) + circle(76, 56, 14) + circle(58, 64, 14) + circle(40, 66, 13)
    + poly([[24, 60], [80, 60], [72, 76], [30, 76]]),
  /** Sorayomi: a pinwheel. */
  pinwheel: [0, 1, 2, 3].map(i => poly(([[50, 50], [44, 12], [62, 8], [70, 28]] as P[]).map(p => rot(p, 50, 50, i * Math.PI / 2)))).join('') + circle(50, 50, 6),
  /** Kinu: her butterfly. */
  butterfly: ellipse(50, 50, 3.4, 25) + ellipse(32, 36, 16, 20, -.45) + ellipse(68, 36, 16, 20, .45) + ellipse(36, 66, 11, 14, .45) + ellipse(64, 66, 11, 14, -.45)
    + circle(32, 36, 5.5, true) + circle(68, 36, 5.5, true) + rod(48.5, 26, 40, 10, 1.3) + rod(51.5, 26, 60, 10, 1.3),
  /** Shidare: a ume blossom - five petals, each notched at its tip (Steel Petal Cut). */
  ume: [0, 1, 2, 3, 4].map(i => poly(petal().map(p => rot(p, 50, 50, i * Math.PI * 2 / 5)))).join('') + circle(50, 50, 5),} as const;
export type SymbolName = keyof typeof SYMBOLS;
