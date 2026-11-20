/**
 * (dude.work round 8, roadmap S2) A big picture put on the GPU a band of rows a slot of the world's frame budget, not in one
 * go: the visitor's 4096 px picture, uploaded whole by the first frame that drew him (his join's), took 100 ms of it. The
 * world's own way (its src/core/warm.ts uploadInBands, which uploads his picture for his avatar the same way), ported: the
 * picture's pixels read off the page's thread (a copy of it drawn into a canvas in a worker), a texture of its size and kind
 * made on the GPU with no pixels (a render target's), the rows copied into it a band at a time
 * (renderer.copyTextureToTexture), its mipmaps made on the GPU after the last band. The caller then draws with it in the
 * picture's place. Only for a picture three would upload as it is: an ImageBitmap (what three's glTF loader makes) or an
 * <img>, 8 bits a channel, never uploaded yet, and never one drawn with its alpha (read back through a canvas, a picture's
 * fully transparent pixels lose their colour): `null` otherwise, and the caller draws with the picture as before.
 */
import * as THREE from 'three';

/** A picture this big (pixels) is worth the bands. */
const BAND_MIN_PX = 1024 * 1024;
/** Rows a band: about 4 MB of a 4096 px picture's pixels a slot. */
const BAND_ROWS = 256;

export async function uploadInBands(renderer: THREE.WebGLRenderer, src: THREE.Texture, slot: () => Promise<void>, within: <T>(fn: () => T) => T = fn => fn()): Promise<THREE.Texture | null> {
  const img = src.image as { width?: number; height?: number } | null;
  const w = img?.width ?? 0, h = img?.height ?? 0;
  if (w * h < BAND_MIN_PX || (src as THREE.Texture & { isRenderTargetTexture?: boolean }).isRenderTargetTexture || (src as THREE.CompressedTexture).isCompressedTexture
    || (src as THREE.DataTexture).isDataTexture || src.type !== THREE.UnsignedByteType || src.format !== THREE.RGBAFormat || (src as THREE.VideoTexture).isVideoTexture) return null;
  if (renderer.properties.has(src) && (renderer.properties.get(src) as { __version?: number }).__version !== undefined) return null;
  const isImg = typeof HTMLImageElement !== 'undefined' && src.image instanceof HTMLImageElement;
  const isBmp = typeof ImageBitmap !== 'undefined' && src.image instanceof ImageBitmap;
  if (!(isImg || isBmp) || (src.flipY && !isImg) || typeof createImageBitmap !== 'function') return null;
  let pixels: Uint8Array | null = null;
  try {
    if (isImg) await (src.image as HTMLImageElement).decode?.();
    // (turned upright as three would upload it, its colours converted as three would: only an <img> in a colour space)
    const copy = await createImageBitmap(src.image as ImageBitmap, { imageOrientation: src.flipY ? 'flipY' : 'from-image', premultiplyAlpha: 'none', colorSpaceConversion: isImg && src.colorSpace !== THREE.NoColorSpace ? 'default' : 'none' });
    pixels = await pixelsOf(copy);
  } catch { pixels = null; }
  if (!pixels || pixels.length !== w * h * 4) return null;
  const mips = src.generateMipmaps && src.minFilter !== THREE.LinearFilter && src.minFilter !== THREE.NearestFilter;
  const rt = new THREE.WebGLRenderTarget(w, h, {
    type: THREE.UnsignedByteType, format: THREE.RGBAFormat, colorSpace: src.colorSpace as THREE.ColorSpace, depthBuffer: false, generateMipmaps: mips,
    minFilter: src.minFilter, magFilter: src.magFilter, wrapS: src.wrapS, wrapT: src.wrapT, anisotropy: src.anisotropy,
  });
  const dst = rt.texture;
  dst.name = src.name; dst.offset.copy(src.offset); dst.repeat.copy(src.repeat); dst.center.copy(src.center); dst.rotation = src.rotation;
  dst.matrixAutoUpdate = src.matrixAutoUpdate; dst.matrix.copy(src.matrix); dst.channel = src.channel;
  await slot();
  within(() => renderer.initRenderTarget(rt));
  dst.generateMipmaps = false;
  const region = new THREE.Box2(new THREE.Vector2(), new THREE.Vector2()), at = new THREE.Vector2();
  // (the bands copied from its pixels: a data texture of them, never uploaded itself)
  const from = new THREE.DataTexture(pixels, w, h, THREE.RGBAFormat, THREE.UnsignedByteType);
  from.colorSpace = src.colorSpace; from.flipY = false;
  for (let y = 0; y < h; y += BAND_ROWS) {
    const y1 = Math.min(h, y + BAND_ROWS);
    await slot();
    region.min.set(0, y); region.max.set(w, y1); at.set(0, y);
    // (the mipmaps after the last band)
    if (y1 >= h) dst.generateMipmaps = mips;
    within(() => renderer.copyTextureToTexture(from, dst, region, at));
  }
  return dst;
}

/** A worker that reads a picture's pixels back (an OffscreenCanvas of its own), off the page's thread; let go when idle. */
let pixelWorker: Worker | null = null, pixelSeq = 0, pixelUrl: string | null = null;
const pixelWaits = new Map<number, (d: Uint8Array | null) => void>();
const PIXEL_WORKER = `onmessage = e => { const { id, bmp } = e.data; try { const c = new OffscreenCanvas(bmp.width, bmp.height), x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(bmp, 0, 0); bmp.close(); const d = x.getImageData(0, 0, c.width, c.height).data; postMessage({ id, buf: d.buffer }, [d.buffer]); } catch (err) { postMessage({ id, buf: null }); } };`;
/** The picture's pixels (RGBA, its rows top down as the picture holds them), read in the worker; null where that can't be. */
function pixelsOf(bmp: ImageBitmap): Promise<Uint8Array | null> {
  if (typeof OffscreenCanvas === 'undefined' || typeof Worker === 'undefined') { bmp.close(); return Promise.resolve(null); }
  try {
    pixelWorker ??= (() => {
      pixelUrl ??= URL.createObjectURL(new Blob([PIXEL_WORKER], { type: 'text/javascript' }));
      const w = new Worker(pixelUrl);
      w.onmessage = (e: MessageEvent<{ id: number; buf: ArrayBuffer | null }>) => {
        const f = pixelWaits.get(e.data.id); pixelWaits.delete(e.data.id); f?.(e.data.buf ? new Uint8Array(e.data.buf) : null);
        if (!pixelWaits.size) { w.terminate(); if (pixelWorker === w) pixelWorker = null; }
      };
      w.onerror = () => { for (const f of pixelWaits.values()) f(null); pixelWaits.clear(); w.terminate(); if (pixelWorker === w) pixelWorker = null; };
      return w;
    })();
  } catch { bmp.close(); return Promise.resolve(null); }
  const id = ++pixelSeq;
  return new Promise(resolve => { pixelWaits.set(id, resolve); pixelWorker!.postMessage({ id, bmp }, [bmp]); });
}
