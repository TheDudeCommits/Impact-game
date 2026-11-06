import * as THREE from 'three';

/** Every mesh of the model, by name, and every material on them, by name. */
export function inventory(model: THREE.Object3D) {
  const meshes = new Map<string, THREE.Mesh>(), materials = new Map<string, THREE.MeshStandardMaterial>();
  model.updateMatrixWorld(true);
  model.traverse(o => {
    if (!(o instanceof THREE.Mesh)) return;
    meshes.set(o.name, o);
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) materials.set(m.name, m as THREE.MeshStandardMaterial);
  });
  return { meshes, materials };
}

/** Hide every mesh of the model whose name, or whose material's name, matches. Returns how many. */
export function hideWhere(model: THREE.Object3D, test: RegExp | ((mesh: THREE.Mesh) => boolean)) {
  let n = 0;
  model.traverse(o => {
    if (!(o instanceof THREE.Mesh)) return;
    const names = [o.name, ...(Array.isArray(o.material) ? o.material : [o.material]).map(m => m.name)];
    if (typeof test === 'function' ? test(o) : names.some(name => test.test(name))) { o.visible = false; n++; }
  });
  return n;
}

export type Rgb = [number, number, number];
/** A colour transform, 0..255 in and out (sRGB). */
export type Recolor = (r: number, g: number, b: number, x: number, y: number) => Rgb;

/** A palette shift: the picture's own light and shade kept (its luma, with `keep` of its colour), laid on a ramp from
 *  `dark` to `light` (sRGB hex), then `gain`ed. */
export function ramp(dark: number, light: number, o: { keep?: number; gain?: number; gamma?: number } = {}): Recolor {
  const d = new THREE.Color(dark), l = new THREE.Color(light), keep = o.keep ?? 0, gain = o.gain ?? 1, gamma = o.gamma ?? 1;
  const D: Rgb = [d.r * 255, d.g * 255, d.b * 255], L: Rgb = [l.r * 255, l.g * 255, l.b * 255];
  return (r, g, b) => {
    const y = Math.pow((r * .299 + g * .587 + b * .114) / 255, gamma);
    const out: Rgb = [0, 0, 0];
    const src = [r, g, b];
    for (let k = 0; k < 3; k++) out[k] = ((D[k] + (L[k] - D[k]) * y) * (1 - keep) + src[k] * keep) * gain;
    return out;
  };
}

/** A canvas of the texture's picture (its own size, capped at `max`). Undefined if the picture cannot be drawn. */
function canvasOf(texture: THREE.Texture, max = 1024) {
  const image = texture.image as CanvasImageSource & { width: number; height: number } | undefined;
  if (!image || !image.width || typeof document === 'undefined') return undefined;
  const s = Math.min(1, max / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(image.width * s); canvas.height = Math.round(image.height * s);
  const g = canvas.getContext('2d', { willReadFrequently: true });
  if (!g) return undefined;
  try { g.drawImage(image, 0, 0, canvas.width, canvas.height); } catch { return undefined; }
  return { canvas, g };
}

/** A new texture with the old one's sampling (its flip, wrap, repeat, channel, colour space) on a new picture. */
function like(texture: THREE.Texture, canvas: HTMLCanvasElement) {
  const t = new THREE.CanvasTexture(canvas);
  t.flipY = texture.flipY; t.wrapS = texture.wrapS; t.wrapT = texture.wrapT; t.repeat.copy(texture.repeat); t.offset.copy(texture.offset);
  t.rotation = texture.rotation; t.center.copy(texture.center); t.channel = texture.channel; t.colorSpace = texture.colorSpace;
  t.anisotropy = texture.anisotropy; t.name = `${texture.name} (fork)`;
  return t;
}

/** The texture repainted: every pixel through `recolor` (optionally only inside `rects`, [x0, y0, x1, y1] as shares of
 *  the picture), then `paint` over it. The old texture is left alone (others may share it); undefined if it cannot be read. */
export function repaint(texture: THREE.Texture | null | undefined, recolor?: Recolor | null, o: {
  rects?: readonly (readonly [number, number, number, number])[]; paint?: (g: CanvasRenderingContext2D, w: number, h: number) => void; max?: number;
} = {}) {
  if (!texture) return undefined;
  const drawn = canvasOf(texture, o.max);
  if (!drawn) return undefined;
  const { canvas, g } = drawn, W = canvas.width, H = canvas.height;
  if (recolor) {
    const rects = o.rects ?? [[0, 0, 1, 1]];
    for (const [a, b, c, d] of rects) {
      const x0 = Math.floor(a * W), y0 = Math.floor(b * H), w = Math.max(1, Math.ceil(c * W) - x0), h = Math.max(1, Math.ceil(d * H) - y0);
      const data = g.getImageData(x0, y0, w, h), px = data.data;
      for (let i = 0; i < px.length; i += 4) {
        const k = i / 4, [r, gg, b] = recolor(px[i], px[i + 1], px[i + 2], x0 + k % w, y0 + Math.floor(k / w));
        px[i] = r; px[i + 1] = gg; px[i + 2] = b;
      }
      g.putImageData(data, x0, y0);
    }
  }
  o.paint?.(g, W, H);
  return like(texture, canvas);
}

/** Set a material's map (and emissive map) to repainted copies, in place. */
export function repaintMaterial(m: THREE.MeshStandardMaterial | undefined, recolor: Recolor | null, o: Parameters<typeof repaint>[2] & { emissive?: Recolor | null; emissivePaint?: (g: CanvasRenderingContext2D, w: number, h: number) => void } = {}) {
  if (!m) return;
  const map = repaint(m.map, recolor, o);
  if (map) { m.map = map; m.needsUpdate = true; }
  if (m.emissiveMap && (o.emissive !== undefined || o.emissivePaint)) {
    const e = repaint(m.emissiveMap, o.emissive ?? null, { rects: o.rects, paint: o.emissivePaint, max: o.max });
    if (e) { m.emissiveMap = e; m.needsUpdate = true; }
  }
}

/** A canvas texture drawn in code, sRGB, tiling. */
export function drawn(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, o: { repeat?: boolean } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  draw(canvas.getContext('2d')!, w, h);
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (o.repeat !== false) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** A small seeded random, 0..1. */
export function rand(seed: number) {
  let s = seed % 2147483647 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** Vertex colours on a geometry (one colour, or by height), so many pieces share one material in one draw. */
export function tinted(g: THREE.BufferGeometry, color: number | ((y: number, x: number, z: number) => number)) {
  const p = g.getAttribute('position') as THREE.BufferAttribute, col = new Float32Array(p.count * 3), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    c.set(typeof color === 'number' ? color : color(p.getY(i), p.getX(i), p.getZ(i)));
    col.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

/** Drop a mesh's triangles where `drop` holds for their centre (world metres): a piece baked into a shared mesh, or a few
 *  copies of an instanced piece (a whole instance moved out of sight). In place. */
export function dropWhere(mesh: THREE.Mesh, drop: (p: THREE.Vector3) => boolean) {
  mesh.updateMatrixWorld(true);
  if (mesh instanceof THREE.InstancedMesh) {
    const m = new THREE.Matrix4(), p = new THREE.Vector3(), gone = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < mesh.count; i++) { mesh.getMatrixAt(i, m); p.setFromMatrixPosition(m).applyMatrix4(mesh.matrixWorld); if (drop(p)) mesh.setMatrixAt(i, gone); }
    mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere();
    return;
  }
  const g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry;
  const pos = g.getAttribute('position'), keep: number[] = [], c = new THREE.Vector3();
  for (let t = 0; t < pos.count; t += 3) {
    c.set(0, 0, 0);
    for (let k = 0; k < 3; k++) c.x += pos.getX(t + k) / 3, c.y += pos.getY(t + k) / 3, c.z += pos.getZ(t + k) / 3;
    if (!drop(c.applyMatrix4(mesh.matrixWorld))) keep.push(t);
  }
  if (keep.length * 3 === pos.count) return;
  const out = new THREE.BufferGeometry();
  for (const [name, attr] of Object.entries(g.attributes)) {
    const a = attr as THREE.BufferAttribute, size = a.itemSize, src = a.array, dst = new (src.constructor as Float32ArrayConstructor)(keep.length * 3 * size);
    keep.forEach((t, j) => dst.set(src.subarray(t * size, (t + 3) * size), j * 3 * size));
    out.setAttribute(name, new THREE.BufferAttribute(dst, size, a.normalized));
  }
  out.computeBoundingSphere(); out.computeBoundingBox();
  if (g !== mesh.geometry) g.dispose();
  mesh.geometry.dispose();
  mesh.geometry = out;
}

/** The ambient's cloth not yet built (it is built after the dressing): drop the pieces whose top is above `y`. */
export function dropClothAbove(ambient: unknown, y: number) {
  const parts = (ambient as { clothParts?: Map<THREE.Material, THREE.BufferGeometry[]> }).clothParts;
  if (!parts) return;
  for (const [material, list] of parts) {
    const kept = list.filter(g => { g.computeBoundingBox(); return g.boundingBox!.max.y <= y; });
    list.filter(g => !kept.includes(g)).forEach(g => g.dispose());
    // (A material with nothing left is dropped: the ambient merges each list, and an empty one would throw - stages-old.)
    if (kept.length) parts.set(material, kept); else parts.delete(material);
  }
}

/** Cellular noise (Worley) at a pixel: the gap between its nearest and second-nearest cell points, in pixels (small at a
 *  cell's edge: cracks, plates, flagstones), and the nearest cell's own random 0..1 (its shade). `size` px a cell. */
export function cellEdge(x: number, y: number, size: number, seed = 1) {
  const cx = Math.floor(x / size), cy = Math.floor(y / size);
  let d1 = Infinity, d2 = Infinity, id = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const gx = cx + i, gy = cy + j;
    const h = Math.sin(gx * 127.1 + gy * 311.7 + seed * 74.7) * 43758.5453, hx = h - Math.floor(h);
    const k = Math.sin(gx * 269.5 + gy * 183.3 + seed * 13.1) * 43758.5453, hy = k - Math.floor(k);
    const px = (gx + hx) * size, py = (gy + hy) * size, d = Math.hypot(x - px, y - py);
    if (d < d1) { d2 = d1; d1 = d; id = hx; } else if (d < d2) d2 = d;
  }
  return { edge: d2 - d1, shade: id };
}
