
/** One baked glyph: its outline (SVG path in the set's `em` units, y down from the baseline), its advance and its box. */
export type BakedGlyph = [d: string, advance: number, x0: number, y0: number, x1: number, y1: number];
export interface GlyphSet { em: number; fonts: { ja: string; latin: string }; glyphs: Record<string, BakedGlyph> }

/** Whether a character is set in the brush face (kana, kanji and their punctuation) rather than the Latin one. */
export const isJapanese = (char: string) => (char.codePointAt(0) ?? 0) >= 0x3000;
/** A move's English as the ring sets it: capitals, accents dropped (Brasier: Coup de Feu, Ash Brand). */
export const ringLatin = (name: string) => name.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
/** Every character a text needs from the bake (spaces are advances only). */
export const charsOf = (text: string) => [...text].filter(c => c !== ' ');
