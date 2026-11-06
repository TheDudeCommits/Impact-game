import * as THREE from 'three';
import type { DressContext } from '../../render/stages/dressing';
import { crowdCards, figureAtlas, type CrowdSpot } from '../../render/stages/crowd';
import { Beacons, LightPools } from '../../render/stages/glow';
import { stageMaterial } from '../../render/stages/build';
import { type Forge, fromTris } from './forge';
import { rand } from './remake';

export type P3 = readonly [number, number, number];

/** A sagging line from a to b: the point `t` (0..1) of the way along it. */
export function sagAt(a: P3, b: P3, sag: number) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  return (t: number) => A.clone().lerp(B, t).add(new THREE.Vector3(0, -sag * 4 * t * (1 - t), 0));
}

/** A string of pennants from a to b, sagging `sag` m at its middle: the line in the Forge material `line`, the pennants
 *  (triangles `size` m deep, about `gap` m apart) in `cloth` (a two-sided material), coloured round `colours`. */
export function bunting(f: Forge, a: P3, b: P3, o: { colours: readonly number[]; sag?: number; size?: number; gap?: number; line?: string; cloth?: string; lineTint?: number; seed?: number }) {
  const len = new THREE.Vector3(...a).distanceTo(new THREE.Vector3(...b)), size = o.size ?? .9;
  const at = sagAt(a, b, o.sag ?? len * .07), segs = Math.max(4, Math.ceil(len / 3));
  for (let i = 0; i < segs; i++) f.beam(o.line ?? 'dark', at(i / segs), at((i + 1) / segs), .05, o.lineTint ?? 0x2a1c14);
  const n = Math.max(2, Math.floor(len / (o.gap ?? size * 1.2))), r = rand(o.seed ?? 7);
  for (let i = 1; i < n; i++) {
    const t = i / n, p = at(t), q = at(Math.min(1, t + .3 / n)), w = q.clone().sub(p).normalize().multiplyScalar(size * .42);
    f.add(o.cloth ?? 'cloth', fromTris([[p.x - w.x, p.y - w.y, p.z - w.z], [p.x + w.x, p.y + w.y, p.z + w.z], [p.x, p.y - size, p.z]], [[0, 1, 2]]),
      o.colours[(i + Math.floor(r() * 2)) % o.colours.length]);
  }
}

/** A string of lanterns from a to b: the line in `line`, a lantern every `gap` m (its body in `body`, a lit material), and
 *  each one's flicker in `glow` (Beacons). */
export function lanternString(f: Forge, glow: Beacons, a: P3, b: P3, o: { gap?: number; sag?: number; colour?: number; size?: number; body?: string; bodyTint?: number; line?: string; lineTint?: number; seed?: number }) {
  const len = new THREE.Vector3(...a).distanceTo(new THREE.Vector3(...b)), at = sagAt(a, b, o.sag ?? len * .06), segs = Math.max(4, Math.ceil(len / 3));
  for (let i = 0; i < segs; i++) f.beam(o.line ?? 'dark', at(i / segs), at((i + 1) / segs), .04, o.lineTint ?? 0x1e1610);
  const n = Math.max(2, Math.round(len / (o.gap ?? 2.6))), r = rand(o.seed ?? 11), s = o.size ?? 1;
  for (let i = 1; i < n; i++) {
    const p = at(i / n);
    f.cyl(o.body ?? 'glow', p.x, p.y - .62 * s, p.z, .2 * s, .22 * s, .5 * s, o.bodyTint ?? 0xffc070, { sides: 8 });
    glow.add(p.x, p.y - .4 * s, p.z, 1.5 * s, o.colour ?? 0xffa850, -1, r(), 1);
  }
}

/** A brazier's or a torch's fire at each spot (flames, their smoke and their warm pool: ambient.fire, three draws for all),
 *  its flicker on the lens (Beacons) and, given `pools`, its light laid on the floor `floor` m under it. */
export function fires(c: DressContext, spots: readonly { x: number; y: number; z: number; size: number }[], o: { glow?: Beacons; pools?: LightPools; floor?: number; colour?: number; pool?: number; smoke?: number; seed?: number } = {}) {
  if (!spots.length) return;
  c.ambient.fire(spots.map((s, i) => ({ ...s, smoke: o.smoke ?? .25, seed: (o.seed ?? 3) + i * 1.7 })));
  const warm = new THREE.Color(o.colour ?? 0xff9a48).multiplyScalar(.5);
  for (const s of spots) {
    o.glow?.add(s.x, s.y + s.size * .5, s.z, 2.4 * s.size, 0xff9a40, -1, ((s.x * .013 + s.z * .007) % 1 + 1) % 1, 1);
    if (o.pools && o.floor !== undefined) o.pools.add(s.x, s.z, (o.pool ?? 6) * s.size, warm, o.floor + .05);
  }
}

/** The colours a crowd is painted in: robes, head cloths, skins (CSS colours). */
export interface Palette { robes: readonly string[]; wraps: readonly string[]; skins?: readonly string[]; ink?: string }
/** Cells of `people`'s atlas: 0-7 standing, 8-15 an arm raised, 16-23 kneeling. */
export const STANDING = 0, CHEERING = 8, KNEELING = 16;

/** A crowd of a place's own people, painted in code (their light in them), on crowd cards (render/stages/crowd.ts): one draw.
 *  `spots` name a cell of the atlas (STANDING, CHEERING or KNEELING plus 0-7) and a height (a kneeling figure's card is the
 *  standing figure's height: the figure is drawn in its lower part). */
export function people(c: DressContext, spots: readonly CrowdSpot[], palette: Palette, o: { name?: string; shade?: number; sway?: number } = {}) {
  const skins = palette.skins ?? ['#c88a60', '#a86a44', '#e0b08a', '#7a4a30'], ink = palette.ink ?? '#1a0e0a';
  const atlas = figureAtlas(8, 3, 96, 192, (g, i, w, h) => {
    const k = i % 8, pose = Math.floor(i / 8), cx = w / 2;
    const robe = palette.robes[k % palette.robes.length], wrap = palette.wraps[(k + pose) % palette.wraps.length], skin = skins[(k + pose * 3) % skins.length];
    g.lineWidth = 3; g.strokeStyle = ink; g.lineJoin = 'round';
    const shape = (fill: string, path: () => void) => { g.beginPath(); path(); g.fillStyle = fill; g.fill(); g.stroke(); };
    // Kneeling: the same figure folded into the card's lower half.
    const top = pose === 2 ? h * .46 : 0, H = pose === 2 ? h * .54 : h;
    const y = (t: number) => top + H * t;
    if (pose === 2) {
      shape(robe, () => { g.moveTo(cx - 14, y(.3)); g.lineTo(cx + 14, y(.3)); g.lineTo(cx + 30, y(.98)); g.lineTo(cx - 24, y(.98)); g.closePath(); });
    } else {
      shape(robe, () => { g.moveTo(cx - 16, y(.3)); g.lineTo(cx + 16, y(.3)); g.lineTo(cx + 25, y(.98)); g.lineTo(cx - 25, y(.98)); g.closePath(); });
      shape('rgba(0,0,0,.2)', () => { g.moveTo(cx - 3, y(.32)); g.lineTo(cx + 3, y(.32)); g.lineTo(cx + 5, y(.98)); g.lineTo(cx - 5, y(.98)); g.closePath(); });
    }
    if (pose === 1) { g.lineWidth = 11; g.beginPath(); g.moveTo(cx + 13, y(.34)); g.lineTo(cx + 22, y(.07)); g.stroke(); g.lineWidth = 6; g.strokeStyle = robe; g.stroke(); g.lineWidth = 3; g.strokeStyle = ink; }
    const head = pose === 2 ? 11 : 13;
    shape(skin, () => g.arc(cx, y(.2), head, 0, Math.PI * 2));
    shape(wrap, () => { g.arc(cx, y(.18), head + 2, Math.PI * 1.05, -Math.PI * .05); g.lineTo(cx + head + 2, y(.21)); g.lineTo(cx - head - 2, y(.21)); g.closePath(); });
    if (k % 3 === 0) shape(wrap, () => { g.moveTo(cx + head - 1, y(.2)); g.lineTo(cx + head + 7, y(.42)); g.lineTo(cx + head - 1, y(.42)); g.closePath(); });
  });
  return crowdCards(c, atlas, 8, 3, spots, { name: o.name ?? `${c.stage} people`, aspect: .5, shade: o.shade ?? .9, sway: o.sway ?? .04 });
}

/** Crowd spots in a band round a point: `count` figures between radius r0 and r1, at the angles `arc` allows, each `height`
 *  m (+/- 8%), standing on `y`. */
export function ringSpots(o: { x?: number; z?: number; r0: number; r1: number; count: number; y: number | ((x: number, z: number) => number); height: number; arc?: (a: number, x: number, z: number) => boolean; poses?: readonly number[]; seed?: number }) {
  const r = rand(o.seed ?? 21), spots: CrowdSpot[] = [], poses = o.poses ?? [STANDING, CHEERING, KNEELING];
  for (let tries = 0; spots.length < o.count && tries < o.count * 20; tries++) {
    const a = r() * Math.PI * 2, d = o.r0 + (o.r1 - o.r0) * r(), x = (o.x ?? 0) + Math.sin(a) * d, z = (o.z ?? 0) + Math.cos(a) * d;
    if (o.arc && !o.arc(a, x, z)) continue;
    const pose = poses[Math.floor(r() * poses.length)];
    spots.push({ x, y: typeof o.y === 'number' ? o.y : o.y(x, z), z, cell: pose + Math.floor(r() * 8), height: o.height * (.92 + r() * .16), flip: r() < .5 });
  }
  return spots;
}

/** A painted disc laid on a floor (an inlay, a mosaic, a scorch): `draw` paints a square canvas `px` wide, centred; laid
 *  `y` m up, `size` m across, turned `rot`. Lit, matte, receiving shadows, behind the fighters' contact shadows. */
export function inlay(c: DressContext, draw: (g: CanvasRenderingContext2D, s: number) => void, o: { x?: number; z?: number; y?: number; size: number; rot?: number; px?: number; roughness?: number; color?: number; name?: string }) {
  const s = o.px ?? 1024, canvas = document.createElement('canvas');
  canvas.width = canvas.height = s;
  draw(canvas.getContext('2d')!, s);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8;
  const material = stageMaterial(c.stage, o.name ?? `${c.stage} inlay`, { map, transparent: true, alphaTest: .02, depthWrite: false, roughness: o.roughness ?? .85,
    color: o.color ?? 0xffffff, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(o.size, o.size).rotateX(-Math.PI / 2).rotateY(o.rot ?? 0), material);
  mesh.position.set(o.x ?? 0, o.y ?? .012, o.z ?? 0);
  mesh.name = material.name; mesh.receiveShadow = true; mesh.renderOrder = 1;
  c.root.add(mesh);
  return mesh;
}
