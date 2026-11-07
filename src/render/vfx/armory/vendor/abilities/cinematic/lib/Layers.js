// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
/*!
 * AbilityCastingThreeJS (cinematic pack) (MIT)
 *
 * MIT License
 *
 * Copyright (c) 2026 mohamedachrefelouafi
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
/**
 * Layers shim for the cinematic pack (ported from achrefelouafi/AbilityCastingThreeJS, MIT).
 *
 * The source adds a fifth layer, SHAPED, for opaque ability geometry whose vertex
 * stage is hand written (the Wildroot Reliquary's stones). The base sandbox has
 * no such layer, so it is declared here and the ability that uses it enables it
 * on the camera and the sun's shadow camera itself (`enableShapedLayer`) — no
 * shared core file is edited.
 */
import { LAYER as BASE_LAYER } from '../../../core/Layers.js';

export * from '../../../core/Layers.js';

export const LAYER = Object.freeze({ ...BASE_LAYER, SHAPED: 4 });

/** Make LAYER.SHAPED visible to the main camera and cast into the sun's shadow map. */
export function enableShapedLayer(ctx) {
  ctx.camera?.layers.enable(LAYER.SHAPED);
  ctx.environment?.sun?.shadow?.camera?.layers.enable(LAYER.SHAPED);
}
