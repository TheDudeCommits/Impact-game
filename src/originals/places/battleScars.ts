import * as THREE from 'three';
import type { DressContext } from '../../render/stages/dressing';
import { inlay } from './richness';
import { rand } from './remake';

export interface CraterOptions {
  /** The decal's centre and the crater's, world metres (the crater may sit off the decal's middle). */
  x?: number; z?: number; cx?: number; cz?: number;
  /** The decal's side, the bowl's radius and how far the cracks run, metres. */
  size: number; radius: number; reach: number;
  y?: number; seed?: number; cracks?: number;
  /** Long straight strokes, [[x0, z0], [x1, z1]] in world metres. */
  strokes?: readonly (readonly [readonly [number, number], readonly [number, number]])[];
  /** The bearing the lip is lit from (radians, from +x toward +z, as the canvas's angle runs). */
  lit?: number;
  /** The glow's colour (linear, as the emissive) and strength; the lip's lit and shaded stone (CSS colours). */
  ember?: number; strength?: number; litStone?: string; darkStone?: string;
  /** The cracks' width, a share of the usual (32 cm dark, 7 cm glowing): thinner tears in steel plate. */
  width?: number;
  /** The bowl's glowing heart, a share of the usual (0: none - added onto the dark bowl it reads as a solid disc of the ember's
   *  colour at any strength). */
  heart?: number;
  name: string;
}

export function crater(c: DressContext, o: CraterOptions) {
  const r = rand(o.seed ?? 1301), size = o.size, px = 2048, u = px / size;
  const ox = o.x ?? 0, oz = o.z ?? 0, cx = o.cx ?? ox, cz = o.cz ?? oz, R = o.radius;
  const lines: [number, number][][] = [];
  for (let k = 0, n = o.cracks ?? 15; k < n; k++) {
    let a = k / n * Math.PI * 2 + (r() - .5) * .3, rr = R * (.75 + r() * .15), x = cx + Math.cos(a) * rr, z = cz + Math.sin(a) * rr;
    const line: [number, number][] = [[x, z]], end = R + (o.reach - R) * (.4 + r() * .6);
    while (rr < end) { rr += .5 + r() * .9; a += (r() - .5) * .35; x = cx + Math.cos(a) * rr; z = cz + Math.sin(a) * rr; line.push([x, z]); }
    lines.push(line);
  }
  const strokes = o.strokes ?? [];
  const toPx = ([x, z]: readonly [number, number]) => [(x - ox + size / 2) * u, (z - oz + size / 2) * u] as const;
  const path = (g: CanvasRenderingContext2D, line: readonly (readonly [number, number])[]) => { g.beginPath(); line.forEach((p, i) => { const [X, Y] = toPx(p); if (i) g.lineTo(X, Y); else g.moveTo(X, Y); }); };
  const lit = o.lit ?? Math.PI / 2;
  const mesh = inlay(c, g => {
    const [X, Y] = toPx([cx, cz]);
    const scorch = g.createRadialGradient(X, Y, 0, X, Y, R * 2 * u);
    scorch.addColorStop(0, 'rgba(26,12,10,.9)'); scorch.addColorStop(.38, 'rgba(40,18,14,.75)'); scorch.addColorStop(.7, 'rgba(60,28,20,.3)'); scorch.addColorStop(1, 'rgba(60,28,20,0)');
    g.fillStyle = scorch; g.fillRect(0, 0, px, px);
    for (let k = 0; k < 22; k++) {
      const a = k / 22 * Math.PI * 2, rr = R * (.8 + r() * .22), w = R * (.16 + r() * .16);
      g.save(); g.translate(X + Math.cos(a) * rr * u, Y + Math.sin(a) * rr * u); g.rotate(a + (r() - .5) * .6);
      g.fillStyle = Math.cos(a - lit) > 0 ? (o.litStone ?? 'rgba(214,170,132,.85)') : (o.darkStone ?? 'rgba(70,40,34,.85)');
      g.fillRect(-w * u / 2, -R * .065 * u, w * u, R * .13 * u);
      g.restore();
    }
    g.fillStyle = 'rgba(16,8,8,.92)'; g.beginPath(); g.arc(X, Y, R * .66 * u, 0, Math.PI * 2); g.fill();
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (const line of lines) { g.strokeStyle = 'rgba(18,8,6,.92)'; g.lineWidth = .32 * u * (o.width ?? 1); path(g, line); g.stroke(); }
    for (const s of strokes) {
      g.strokeStyle = 'rgba(24,12,10,.85)'; g.lineWidth = .55 * u; path(g, s); g.stroke();
      g.strokeStyle = 'rgba(220,170,120,.45)'; g.lineWidth = .12 * u; g.save(); g.translate(.3 * u, .3 * u); path(g, s); g.stroke(); g.restore();
    }
  }, { x: ox, z: oz, size, px, y: o.y ?? .02, roughness: .95, name: o.name });
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1024;
  const g = canvas.getContext('2d')!, k = 1024 / px;
  g.scale(k, k); g.lineCap = 'round'; g.lineJoin = 'round';
  g.shadowColor = 'rgba(255,255,255,1)'; g.shadowBlur = 18;
  for (const line of lines) { g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = .07 * u * (o.width ?? 1); path(g, line.slice(0, Math.ceil(line.length * .6))); g.stroke(); }
  g.shadowBlur = 8;
  for (const s of strokes) { g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = .06 * u; path(g, s); g.stroke(); }
  const [X, Y] = toPx([cx, cz]);
  const hk = o.heart ?? 1;
  if (hk > 0) {
    const heart = g.createRadialGradient(X, Y, 0, X, Y, R * .45 * u); heart.addColorStop(0, `rgba(255,255,255,${.8 * hk})`); heart.addColorStop(.5, `rgba(255,255,255,${.3 * hk})`); heart.addColorStop(1, 'rgba(255,255,255,0)');
    g.shadowBlur = 0; g.fillStyle = heart; g.beginPath(); g.arc(X, Y, R * .45 * u, 0, Math.PI * 2); g.fill();
  }
  const ember = new THREE.CanvasTexture(canvas);
  ember.colorSpace = THREE.SRGBColorSpace; ember.anisotropy = 4;
  const m = mesh.material as THREE.MeshStandardMaterial;
  m.emissive.set(o.ember ?? 0xff7a30); m.emissiveMap = ember; m.emissiveIntensity = o.strength ?? 2.2; m.needsUpdate = true;
  // Over any inlay on the same floor (the Summit's festival sun lay over its crater's bowl and kept it orange).
  mesh.renderOrder = 1;
  return mesh;
}
