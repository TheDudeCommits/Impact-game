import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { decodeCapPlugin, decodeSize, imageSize, setTextureCap } from '../src/render/textureCap';

/** The phone pass (November 2026): a square image over the quality's cap is decoded at the cap, its full size never held
 *  (render/textureCap.ts). The decision is the image's own first bytes. */
const bytes = (...parts: (number[] | string)[]) => new Uint8Array(parts.flatMap(p => typeof p === 'string' ? [...p].map(c => c.charCodeAt(0)) : p));
const be32 = (n: number) => [n >>> 24 & 255, n >>> 16 & 255, n >>> 8 & 255, n & 255];

describe('an image\'s size from its first bytes', () => {
  it('PNG', () => {
    expect(imageSize(bytes([0x89], 'PNG', [13, 10, 26, 10], be32(13), 'IHDR', be32(2048), be32(1024), [8, 6, 0, 0, 0]))).toEqual({ width: 2048, height: 1024 });
  });
  it('JPEG, past its APP segments', () => {
    const app0 = [0xff, 0xe0, 0, 16, ...bytes('JFIF'), 0, 1, 1, 0, 0, 1, 0, 1, 0, 0];
    const sof = [0xff, 0xc2, 0, 17, 8, 0x08, 0x00, 0x10, 0x00, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1];
    expect(imageSize(new Uint8Array([0xff, 0xd8, ...app0, ...sof, 0xff, 0xda]))).toEqual({ width: 4096, height: 2048 });
    // A huffman table (C4) is not a frame.
    expect(imageSize(new Uint8Array([0xff, 0xd8, 0xff, 0xc4, 0, 4, 0, 0, 0xff, 0xc0, 0, 17, 8, 0x04, 0x00, 0x04, 0x00, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0]))).toEqual({ width: 1024, height: 1024 });
  });
  it('WebP: lossy, lossless and extended', () => {
    const riff = (chunk: string, body: number[]) => bytes('RIFF', [0, 0, 0, 0], 'WEBP', chunk, [0, 0, 0, 0], body);
    expect(imageSize(riff('VP8 ', [0, 0, 0, 0x9d, 0x01, 0x2a, 0x00, 0x08, 0x00, 0x08, 0, 0]))).toEqual({ width: 2048, height: 2048 });
    const w = 2047, h = 1023, v = (w | h << 14) >>> 0;
    expect(imageSize(riff('VP8L', [0x2f, v & 255, v >>> 8 & 255, v >>> 16 & 255, v >>> 24 & 255, 0, 0, 0, 0, 0]))).toEqual({ width: 2048, height: 1024 });
    expect(imageSize(riff('VP8X', [0, 0, 0, 0, 0xff, 0x0f, 0, 0xff, 0x0f, 0]))).toEqual({ width: 4096, height: 4096 });
  });
  it('nothing it does not know', () => {
    expect(imageSize(bytes('GIF89a', [0, 4, 0, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBeUndefined();
    expect(imageSize(new Uint8Array(4))).toBeUndefined();
  });
  it('reads every image the fighters\' models carry as the models\' own JSON leaves them', () => {
    const dir = new URL('../public/assets/fighters/', import.meta.url);
    let read = 0;
    for (const name of readdirSync(dir).filter(n => n.endsWith('.glb'))) {
      if (read >= 40) break;
      const file = readFileSync(new URL(name, dir)); if (file.toString('ascii', 0, 4) !== 'glTF') continue;
      const length = file.readUInt32LE(12), json = JSON.parse(file.toString('utf8', 20, 20 + length)), bin = 20 + length + 8;
      for (const image of json.images ?? []) {
        if (image.bufferView === undefined) continue;
        const view = json.bufferViews[image.bufferView], start = bin + (view.byteOffset ?? 0);
        const size = imageSize(new Uint8Array(file.buffer, file.byteOffset + start, Math.min(view.byteLength, 65536)));
        expect(size, `${name} image ${image.name ?? ''}`).toBeDefined();
        expect(size!.width).toBeGreaterThan(0); expect(size!.height).toBeGreaterThan(0);
        read++;
      }
    }
    expect(read).toBeGreaterThanOrEqual(40);
  });
});

describe('what a decode is asked for', () => {
  it('a square over the cap, at the cap; anything else as it is', () => {
    expect(decodeSize({ width: 2048, height: 2048 }, 1024)).toEqual({ width: 1024, height: 1024 });
    expect(decodeSize({ width: 1024, height: 1024 }, 1024)).toBeUndefined();
    expect(decodeSize({ width: 2048, height: 1024 }, 1024)).toBeUndefined();
    expect(decodeSize({ width: 4096, height: 4096 }, Infinity)).toBeUndefined();
    expect(decodeSize(undefined, 1024)).toBeUndefined();
  });
  it('High (no cap), or a desktop at any cap, leaves the parser\'s own loader alone; a phone at a cap swaps it', () => {
    const parser = () => ({ textureLoader: { isImageBitmapLoader: true, options: {}, crossOrigin: 'anonymous', requestHeader: {}, manager: { abortController: new AbortController() } } });
    setTextureCap(Infinity);
    const high = parser(), own = high.textureLoader;
    expect(decodeCapPlugin(high as never, true).name).toBeTruthy();
    expect(high.textureLoader).toBe(own);
    setTextureCap(1024);
    const desktop = parser(), desktopOwn = desktop.textureLoader;
    decodeCapPlugin(desktop as never, false);
    expect(desktop.textureLoader).toBe(desktopOwn);
    if (typeof createImageBitmap === 'function') {
      const phone = parser(), phoneOwn = phone.textureLoader;
      decodeCapPlugin(phone as never, true);
      expect(phone.textureLoader).not.toBe(phoneOwn);
    }
    setTextureCap(Infinity);
  });
});
