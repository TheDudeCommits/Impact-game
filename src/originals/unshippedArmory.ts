/** The Armory's effects the game may not offer (their files' licences forbid it), and their files. Moved out of
 *  credits.ts unchanged: the Forge's effects (render/vfx/armory/forgeFx.ts) read it, and since the
 *  fighters' effect layers became chunks of their own the bundler put what forgeFx imports in a chunk they share, credits and all;
 *  the packager allows credits only in the chunk that carries the LEGAL page (scripts/package_vercel_preview.ts). */
export const UNSHIPPED_ARMORY = new Set(['cin_dragon']);
export const UNSHIPPED_ARMORY_FILES = ['assets/armory/remake/dragon.glb', 'assets/armory/thumbs/cin_dragon.webp'] as const;
