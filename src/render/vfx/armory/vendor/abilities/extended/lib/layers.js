// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
/*!
 * layers.js — the one render layer the source repos have and the base lacks.
 *
 * `SHAPED` (4): opaque ability geometry whose vertex stage is hand-written (the
 * ice/glass statues, the Chrono-Summon's foliage). It must stay out of the
 * WORLD depth prepass, whose override material would rasterise the raw buffer.
 * The base camera does not render layer 4, so `enableShapedLayer` turns it on
 * for the main camera and the sun's shadow camera, at runtime, once.
 *
 * Part of the extended pack. MIT, Copyright (c) 2026 mohamedachrefelouafi.
 */
import { LAYER as BASE_LAYER } from '../../../core/Layers.js';

export const LAYER = Object.freeze({ ...BASE_LAYER, SHAPED: 4 });

let done = false;
export function enableShapedLayer(ctx) {
  if (done) return;
  done = true;
  ctx.camera?.layers.enable(LAYER.SHAPED);
  ctx.environment?.sun?.shadow?.camera?.layers.enable(LAYER.SHAPED);
}
