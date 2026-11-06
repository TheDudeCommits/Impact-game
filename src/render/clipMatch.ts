/** How a body's clips are found by name, and how its clip files are joined: the renderer's own rules (Fighter.findClip,
 *  FighterLibrary.ensure, the Fighter constructor), in one place so the engine's fighter check
 *  (src/engine/client/fighterCheck.ts) reads a fighter exactly as the game draws it. No three.js: a clip here is anything
 *  with a name, so the check can run over the files' headers and the game over its loaded clips. */
export interface NamedClip { readonly name: string }

/** A clip name as the matcher reads it: lower case, letters and digits only, so `Rush 1`, `rush_1` and `RUSH-1` are one. */
export const clipKey = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '');

/** The clip the first pattern any clip answers to finds: a clip whose whole name is the pattern first, else the first
 *  clip whose name holds it. So even a "convention" name like `Run` is a substring pattern, and the order of the clips
 *  (joinClips, appendClips) decides between two clips that answer to the same one. */
export function findClipIn<T extends NamedClip>(clips: readonly T[], patterns: readonly string[]): T | undefined {
  for (const pattern of patterns) {
    const key = clipKey(pattern);
    const exact = clips.find(clip => clipKey(clip.name) === key);
    if (exact) return exact;
    const match = clips.find(clip => clipKey(clip.name).includes(key));
    if (match) return match;
  }
  return undefined;
}

/** A clip file joined onto a body's clips (`extraModels`, `formExtraModels`, the idle profile's `model`): a clip of a name
 *  the body already has replaces it, and the new clips go at the end. */
export function joinClips<T extends NamedClip>(clips: readonly T[], added: readonly T[]): T[] {
  const names = new Set(added.map(clip => clip.name));
  return [...clips.filter(clip => !names.has(clip.name)), ...added];
}

/** The rush file's clips (`rushModel`): appended, so a name the body already answers to keeps the body's. With none to
 *  add, the same list. */
export function appendClips<T>(clips: T[], added?: readonly T[]): T[] {
  return added?.length ? [...clips, ...added] : clips;
}
