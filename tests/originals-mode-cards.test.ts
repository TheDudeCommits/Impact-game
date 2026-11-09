import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CARD_MASTER_WIDTH, CARD_WIDTH, HOME_ASSETS, HOME_MODES, cardSmall, mangaHome } from '../src/ui/MangaHome';

/** The home's mode cards at the size the home draws them (src/ui/MangaHome.ts
 *  CARD_WIDTH): each master has a <art>-480.webp beside it at the master's aspect, both ship, and the card asks for the small
 *  one with srcset, the master for denser or larger screens. */
function webpSize(file: string): { width: number; height: number } {
  const b = fs.readFileSync(file);
  expect(b.toString('latin1', 0, 4) + b.toString('latin1', 8, 12)).toBe('RIFFWEBP');
  const chunk = b.toString('latin1', 12, 16);
  if (chunk === 'VP8 ') return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
  if (chunk === 'VP8L') { const bits = b.readUInt32LE(21); return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 }; }
  if (chunk === 'VP8X') return { width: b.readUIntLE(24, 3) + 1, height: b.readUIntLE(27, 3) + 1 };
  throw new Error(`${file}: ${chunk}`);
}
const dir = 'public/assets/home/modes';

describe('the home mode cards', () => {
  it('have a small picture of each master at the card width, at the master\'s aspect, both shipped', () => {
    for (const { id } of HOME_MODES) {
      const master = webpSize(`${dir}/${id}.webp`), small = webpSize(`public${cardSmall(id)}`);
      expect(master.width, id).toBe(CARD_MASTER_WIDTH[id] ?? 900);
      expect(small.width, id).toBe(CARD_WIDTH);
      expect(Math.abs(small.height / small.width - master.height / master.width), id).toBeLessThan(.005);
      expect(HOME_ASSETS).toContain(`/assets/home/modes/${id}.webp`);
      expect(HOME_ASSETS).toContain(cardSmall(id));
      // (Smaller on the wire: that is the point.)
      expect(fs.statSync(`public${cardSmall(id)}`).size, id).toBeLessThan(fs.statSync(`${dir}/${id}.webp`).size / 2);
    }
  });
  it('ask for the small one with srcset, and the master at its own width for larger or denser screens', () => {
    const html = mangaHome('konta' as never, 8);
    const images = [...html.matchAll(/<span class="home-mode-art">(<img [^>]+>)<\/span>/g)].map(m => m[1]);
    expect(images.length).toBeGreaterThan(0);
    for (const img of images) {
      const art = /modes\/([\w-]+)-480\.webp"/.exec(img)?.[1];
      expect(art, img).toBeTruthy();
      expect(img).toContain(`srcset="`);
      expect(img).toMatch(new RegExp(`${art}-480\\.webp ${CARD_WIDTH}w, [^"]*modes/${art}\\.webp ${CARD_MASTER_WIDTH[art!] ?? 900}w"`));
      expect(img).toMatch(/ sizes="[^"]+"/);
    }
  });
});
