import type * as THREE from 'three';
import { materialTextures } from './textureWarmup';

/** What the scene's images weigh on the graphics card, estimated (the stability pass, 2 November 2026: a phone's lost
 *  context is its memory, and `renderer.info.memory` counts textures, not bytes). Each image once (its `Source`), at four
 *  bytes a pixel - three uploads RGBA8, and a compressed one would say otherwise (none ships) - a third more for its
 *  mipmaps where it has them; a typed array's own length. */
export function textureBytes(root: THREE.Object3D, extra: Iterable<THREE.Texture> = []): { images: number; bytes: number; largest: number } {
  const seen = new Set<unknown>();
  let bytes = 0, largest = 0;
  for (const texture of [...materialTextures(root), ...extra]) {
    const source = texture.source ?? texture; if (seen.has(source)) continue; seen.add(source);
    const image = (texture.source?.data ?? texture.image) as { width?: number; height?: number; data?: ArrayBufferView } | null;
    if (!image) continue;
    const side = Math.max(image.width ?? 0, image.height ?? 0);
    const base = image.data && typeof image.data.byteLength === 'number' ? image.data.byteLength : (image.width ?? 0) * (image.height ?? 0) * 4;
    bytes += texture.generateMipmaps && side > 1 ? base * 4 / 3 : base;
    largest = Math.max(largest, side);
  }
  return { images: seen.size, bytes: Math.round(bytes), largest };
}
