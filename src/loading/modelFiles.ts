import type { GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * A loader whose files are all asked for at once and handed to its caller in the order the caller asks for them (the performance
 * sweep, 24 October 2026). A fighter's body, rush, extra takes, idle, form and the form's extras were each fetched only once
 * the one before had come and been parsed - fifteen or so requests in a row a fighter, a round trip and a parse apart: a
 * pinned twelve-fighter royale at 40 Mbit/s took 1.8 s to fetch Taisei's fourteen small takes after his body, its last fighter's
 * body starting 9.4 s after PLAY. Loading them together and binding them one by one in the same order keeps every clip,
 * override and join exactly as it was; only the waiting between them goes.
 *
 * Each file goes through the loader's own `loadAsync` (three's FileLoader and the game's meshopt and texture hooks, or
 * whatever a test or tool has put in its place), started at once for every file named; `loadAsync` on the returned loader
 * hands back the one started for that address. `urls`: every file the caller will load through it (absent entries skipped).
 * One it never asks for is loaded for nothing and dropped; one it asks for that was not named is loaded then. A failure
 * surfaces where that file is asked for, as before.
 */
export function aheadLoader(loader: GLTFLoader, urls: readonly (string | undefined)[]): GLTFLoader {
  const files = new Map<string, Promise<GLTF>>();
  for (const url of urls) {
    if (!url || files.has(url)) continue;
    const file = loader.loadAsync(url);
    file.catch(() => { /* rejected where it is asked for */ });
    files.set(url, file);
  }
  const ahead = Object.create(loader) as GLTFLoader;
  ahead.loadAsync = (url: string) => {
    const file = files.get(url) ?? loader.loadAsync(url);
    files.delete(url);
    return file;
  };
  return ahead;
}
