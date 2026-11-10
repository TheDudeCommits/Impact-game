/** The ball modes' drawn lettering: one atlas, drawn ahead of time from one heavy display face, Dela Gothic One (SIL Open
 *  Font License 1.1; CREDITS.md). No font ships for it and nothing is fetched to draw a letter: only this WebP. Its cells hold three nested masks -
 *  R the letters' fill, G the fill and its ink outline, B those and a thin paper rim - which the page thresholds at a half,
 *  so it colours the fill as it likes, keeps the ink, and stays crisp drawn larger than a cell.
 *
 *  Two layers read it, each an effect of its own (none of it is in the arenas): the sound words stamped at the biggest
 *  hits (render/ball/SoundWords.ts) and the numerals and MATCH POINT laid on the pitch and the court
 *  (render/ball/PitchCount.ts). The layout is the drawing's: change both together. */
import * as THREE from 'three';

export const SOUND_WORDS_URL = '/assets/vfx/ball-sound-words.webp';
export const SOUND_ATLAS = {width: 2048, height: 1024} as const;

/** The atlas as a texture, loaded once for the page on the first ask (both layers share it). Masks, not colours: no
 *  colour space; mipmapped, and sharp at a slant for the numerals lying on the pitch. */
let shared: THREE.Texture | null = null;
export function soundAtlas(): THREE.Texture {
  if (shared) return shared;
  // (Through the loaders, as every asset is, so the release's versioned address is the one asked for.)
  const texture = shared = typeof document === 'object'
    ? new THREE.TextureLoader().load(SOUND_WORDS_URL, () => { loaded = true; }, undefined, () => console.warn('Ball sound words failed to load', SOUND_WORDS_URL))
    : new THREE.Texture();
  texture.colorSpace = THREE.NoColorSpace; texture.anisotropy = 8; texture.name = 'Ball sound words';
  return texture;
}
let loaded = false;
/** Whether the atlas has arrived (the layers draw nothing before it). */
export const atlasReady = () => loaded;

/** A cell, in the atlas's pixels from its top left. */
export interface AtlasCell { x: number; y: number; w: number; h: number }

/** The eight sound words, plain ones: a heavy blast, a boom, a sharp rip, a heavy smash, a hard hit, a smack, a hard
 *  stop and a crack. Four to a row, 512 x 224 each. */
export const SOUND_WORDS = ['ズドン', 'ドン', 'ズバッ', 'ドゴッ', 'ドカッ', 'バシッ', 'ガッ', 'バキッ'] as const;
export const WORD_CELLS: readonly AtlasCell[] = SOUND_WORDS.map((_, i) => ({x: (i % 4) * 512, y: Math.floor(i / 4) * 224, w: 512, h: 224}));

/** The last ten seconds' numerals: 10 (448 wide), 9, 8, 7 and 6 in one row, 5 to 1 in the next, 288 tall. */
export const COUNT_CELLS: Readonly<Record<number, AtlasCell>> = (() => {
  const cells: Record<number, AtlasCell> = {};
  let x = 0;
  for (let n = 10; n >= 1; n--) {
    if (n === 5) x = 0;
    const w = n === 10 ? 448 : 256;
    cells[n] = {x, y: n > 5 ? 448 : 736, w, h: 288};
    x += w;
  }
  return cells;
})();

/** MATCH POINT, two lines, MATCH over POINT. */
export const MATCH_POINT_CELL: AtlasCell = {x: 1472, y: 448, w: 576, h: 576};

/** A cell as the texture's UV rectangle (u0, v0, u1, v1), for an image loaded the usual way up (flipY: v 1 at the top). */
export function cellUv<T extends {set(x: number, y: number, z: number, w: number): unknown}>(c: AtlasCell, out: T): T {
  const {width: W, height: H} = SOUND_ATLAS;
  out.set(c.x / W, 1 - (c.y + c.h) / H, (c.x + c.w) / W, 1 - c.y / H);
  return out;
}

/** The shaders' threshold of the three masks, and the colours they are drawn in. `cut` is a half, eased over about a
 *  pixel of the screen whatever size the cell is drawn at. */
export const ATLAS_GLSL = /* glsl */`
float atlasCut(float v){ float w = max(fwidth(v) * .75, 1e-3); return smoothstep(.5 - w, .5 + w, v); }`;
