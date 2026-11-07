// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
/*!
 * assets.js — lazy, cached model loading for the extended pack.
 *
 * The source apps loaded every model at boot and handed them to abilities as
 * `ctx.models`. Here a model is loaded by the ability module's `preload()`,
 * which the registry descriptor awaits inside `load()`, so the class is never
 * constructed before its model is in memory and nothing extra loads at boot.
 *
 * Files live in `public/extended/models/`.
 *
 * Part of the extended pack. MIT, Copyright (c) 2026 mohamedachrefelouafi.
 */
import { ExtAssetLoader } from './ExtAssetLoader.js';
import { modelUrl } from '../../../remake.js';

const BASE = '/assets/armory/extended/models/';
let loader = null;
const cache = new Map();

export function assetLoader() {
  if (!loader) loader = new ExtAssetLoader();
  return loader;
}

/** Load a glTF from public/extended/models once; resolves to the parsed glTF. */
export function loadGLTF(file) {
  if (!cache.has(file)) {
    const pending = assetLoader()
      .loadGLTF(modelUrl(BASE + file))
      .then(async (gltf) => {
        // Textures can still be in flight when the model resolves.
        await assetLoader().settled();
        return gltf;
      });
    pending.catch(() => cache.delete(file));
    cache.set(file, pending);
  }
  return cache.get(file);
}

/**
 * Built rigs, keyed like the source's `ctx.models` (`drone`, `monowheel`,
 * `phoenix`, `serpent`). Each ability's `preload()` fills its own entry.
 */
export const extModels = {};
