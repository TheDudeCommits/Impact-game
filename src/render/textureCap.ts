import * as THREE from 'three';
import type { GLTF, GLTFParser } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { Settings } from '../config';
import { handheld, phone } from '../input/device';

/**
 * The largest side a model's image keeps on the graphics card, by graphics quality (launch night, 12 October 2026, "stay
 * inside memory on mid-range devices"). A twelve-fighter match on the harbour holds 300-500 MB of images with their
 * mipmaps - the castle keep's albedo alone is 4096 x 4096, 85 MB; most fighters' colour maps are 2048 x 2048, 21 MB - and a
 * phone's browser tab is closed at about a gigabyte. High keeps every image exactly as it ships (no change). Medium keeps
 * what a fighter ships (2048) and shrinks only what a stage ships bigger (4096: a quarter of the memory, on a screen that
 * shows a building's wall at a fraction of its size). Low halves again (1024: a fighter filling a phone's screen is about
 * 1000 pixels tall).
 *
 * Applied once, as a model is loaded (meshopt.ts, the one place every GLTFLoader goes through), to each distinct image
 * (a `Source`: sharedTextures.ts has made models that hold the same bytes hold one): resized with the browser's own
 * high-quality filter off the page's thread, the larger bitmap closed.
 */
export const textureCapFor = (quality: Settings['quality'], small = phone()): number => small ? PHONE_CAP : quality === 'low' ? 1024 : quality === 'medium' ? 2048 : Infinity;
/** A phone's cap at every quality (the stability pass, 2 November 2026: 156 lost graphics contexts on the live log, mostly
 *  iPhones mid-match - a phone's GPU memory). A phone starts on Low (qualityTier.ts), whose cap this is; one its player
 *  set to Medium or High kept every fighter's 2048 or 4096 px maps, 21 MB each with their mipmaps: Kuon against Setsu on
 *  High held 213 MB of images on the iPhone profile, 107 MB of it five 2048 px maps. A phone's screen is about 1000 px
 *  tall at its pixel ratio here, so the cap costs it little to see; every other quality setting (the resolution, the
 *  shadows, the ground) still follows the choice. Tablets and desktops are as they were. */
export const PHONE_CAP = 1024;

let cap = Infinity;
/** The cap models loaded from now on are held to (GameRenderer.applySettings sets it with the quality). */
export const setTextureCap = (side: number) => { cap = side; };
export const currentTextureCap = () => cap;

type Bitmapish = { width: number; height: number; close?: () => void };

/** A model's images over `side`, shrunk to it (in place, in their `Source`s). Resolves when every one is. Never rejects: an
 *  image that cannot be resized stays as it is. */
export async function capTextures(gltf: GLTF, side: number = cap, patience = 8000): Promise<number> {
  if (!Number.isFinite(side) || typeof createImageBitmap !== 'function') return 0;
  const sources = new Map<THREE.Texture['source'], THREE.Texture[]>();
  for (const scene of gltf.scenes?.length ? gltf.scenes : [gltf.scene]) scene.traverse(o => {
    const material = (o as THREE.Mesh).material; if (!material) return;
    for (const m of [material].flat()) for (const value of Object.values(m)) {
      const texture = value as THREE.Texture | null;
      if (!texture?.isTexture) continue;
      const list = sources.get(texture.source) ?? []; list.push(texture); sources.set(texture.source, list);
    }
  });
  let shrunk = 0;
  await Promise.all([...sources].map(async ([source, textures]) => {
    const image = source.data as Bitmapish | null | undefined;
    if (!image || !(image.width > side || image.height > side)) return;
    // ImageBitmap, an <img> or a canvas; anything else (a DataTexture's typed array) has no width/height pair to resize.
    if (typeof ImageBitmap === 'undefined' || !(image instanceof ImageBitmap) && !(typeof HTMLImageElement !== 'undefined' && image instanceof HTMLImageElement)) return;
    const k = side / Math.max(image.width, image.height), width = Math.max(1, Math.round(image.width * k)), height = Math.max(1, Math.round(image.height * k));
    try {
      // A resize that never answers must not hold the model (and so the match) up: `patience` ms, then the image stays as it is.
      const small = await Promise.race([
        createImageBitmap(image as ImageBitmap, { resizeWidth: width, resizeHeight: height, resizeQuality: 'high', premultiplyAlpha: 'none', colorSpaceConversion: 'none' }),
        new Promise<never>((_, no) => setTimeout(() => no(new Error('resize timed out')), patience)),
      ]);
      // A texture already uploaded at its old size is let go first: the card allocates the new size afresh.
      for (const texture of textures) texture.dispose();
      source.data = small; source.needsUpdate = true;
      for (const texture of textures) texture.needsUpdate = true;
      (image as ImageBitmap).close?.();
      shrunk++;
    } catch { /* kept at full size */ }
  }));
  return shrunk;
}

/**
 * The cap applied as an image is decoded, not after (the phone pass, November 2026: "iOS memory"). `capTextures` above
 * shrinks a model's images once the whole model is parsed, so until then every one of them is held at its full size: a
 * fighter's three or four 2048 px images, 16 MB each decoded, and a stage's 4096 px ones at 64 MB, all at once, in a
 * phone's tab that is closed at about a gigabyte. A square image (117 of the fighters' and places' 134 images over 1024
 * px are square) whose first bytes say it is over the cap is decoded straight to the cap's size instead - the browser's
 * own high-quality resize, the same `createImageBitmap` options as `capTextures`, so the same picture - and its full size
 * is never kept. Anything else (an image the header does not tell, a non-square one: EXIF could turn it) is decoded as
 * before and left to `capTextures`. Only on a phone or a tablet, where the cap is finite (Medium, Low). Chrome's two ways
 * give the same pixels exactly; Safari's differ by a resampling (a mean of 0.05-1.5 in 255 on two fighters' 2048 px
 * maps), so a desktop - Safari on a Mac runs Medium, whose 2048 cap Kuon's 4096 px map meets - decodes as it always did.
 */

/** An image's width and height from its first bytes (PNG, JPEG, WebP), or undefined. */
export function imageSize(b: Uint8Array): { width: number; height: number } | undefined {
  const be16 = (i: number) => b[i] << 8 | b[i + 1], be32 = (i: number) => (b[i] << 24 >>> 0) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3];
  const le24 = (i: number) => b[i] | b[i + 1] << 8 | b[i + 2] << 16;
  const ascii = (i: number, text: string) => [...text].every((c, k) => b[i + k] === c.charCodeAt(0));
  if (b.length >= 24 && b[0] === 0x89 && ascii(1, 'PNG') && ascii(12, 'IHDR')) return { width: be32(16), height: be32(20) };
  if (b.length >= 30 && ascii(0, 'RIFF') && ascii(8, 'WEBP')) {
    if (ascii(12, 'VP8 ') && b[23] === 0x9d && b[24] === 0x01 && b[25] === 0x2a) return { width: (b[26] | b[27] << 8) & 0x3fff, height: (b[28] | b[29] << 8) & 0x3fff };
    if (ascii(12, 'VP8L') && b[20] === 0x2f) { const v = (b[21] | b[22] << 8 | b[23] << 16 | b[24] << 24) >>> 0; return { width: (v & 0x3fff) + 1, height: (v >>> 14 & 0x3fff) + 1 }; }
    if (ascii(12, 'VP8X')) return { width: le24(24) + 1, height: le24(27) + 1 };
    return undefined;
  }
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) {
    for (let i = 2; i + 9 < b.length;) {
      if (b[i] !== 0xff) return undefined;
      const marker = b[i + 1];
      if (marker === 0xff) { i++; continue; }
      if (marker === 0x01 || marker >= 0xd0 && marker <= 0xd8) { i += 2; continue; }
      // Start of frame: every SOF but DHT (C4), JPG (C8) and DAC (CC).
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) return { width: be16(i + 7), height: be16(i + 5) };
      if (marker === 0xd9 || marker === 0xda) return undefined;
      i += 2 + be16(i + 2);
    }
  }
  return undefined;
}

/** The size a decode is asked for: a square over `side`, at `side`; anything else undefined (decoded as it is). */
export function decodeSize(size: { width: number; height: number } | undefined, side: number) {
  if (!size || !Number.isFinite(side) || size.width !== size.height || !(size.width > side)) return undefined;
  return { width: side, height: side };
}

/** three's ImageBitmapLoader, deciding each image's decoded size from its first bytes (see above). */
class CappedBitmapLoader extends THREE.ImageBitmapLoader {
  constructor(manager: THREE.LoadingManager, private readonly side: number) { super(manager); }
  override load(url: string, onLoad?: (bitmap: ImageBitmap) => void, _onProgress?: (event: ProgressEvent) => void, onError?: (error: unknown) => void): void {
    url = this.manager.resolveURL((this.path ?? '') + (url ?? ''));
    const options = { ...(this.options as ImageBitmapOptions), colorSpaceConversion: 'none' as const }, side = this.side, manager = this.manager;
    manager.itemStart(url);
    // (Aborted as three's own is: this loader's abort() or its manager's.)
    const own = (this as unknown as { _abortController?: AbortController })._abortController?.signal, all = (manager as unknown as { abortController?: AbortController }).abortController?.signal;
    const signal = own && all && typeof AbortSignal.any === 'function' ? AbortSignal.any([own, all]) : own ?? all;
    fetch(url, { credentials: this.crossOrigin === 'anonymous' ? 'same-origin' : 'include', headers: this.requestHeader, signal })
      .then(response => response.blob())
      .then(async blob => {
        const fit = decodeSize(imageSize(new Uint8Array(await blob.slice(0, 65536).arrayBuffer())), side);
        return createImageBitmap(blob, fit ? { ...options, resizeWidth: fit.width, resizeHeight: fit.height, resizeQuality: 'high' } : options);
      })
      .then(bitmap => { onLoad?.(bitmap); manager.itemEnd(url); })
      .catch(error => { onError?.(error); manager.itemError(url); manager.itemEnd(url); });
  }
}

/** A GLTFLoader plugin (meshopt.ts registers it on every loader): where the parser decodes its images to ImageBitmaps and
 *  the cap is finite, it decodes them at the cap. */
export function decodeCapPlugin(parser: GLTFParser, small = handheld()) {
  const side = small ? cap : Infinity, current = (parser as unknown as { textureLoader?: { isImageBitmapLoader?: boolean } & THREE.Loader & { options: ImageBitmapOptions } }).textureLoader;
  if (Number.isFinite(side) && current?.isImageBitmapLoader === true && typeof createImageBitmap === 'function') {
    const loader = new CappedBitmapLoader(current.manager, side);
    loader.setCrossOrigin(current.crossOrigin); loader.setRequestHeader(current.requestHeader); loader.setOptions(current.options);
    (parser as unknown as { textureLoader: THREE.ImageBitmapLoader }).textureLoader = loader;
  }
  return { name: 'JUMP_decode_cap' };
}
