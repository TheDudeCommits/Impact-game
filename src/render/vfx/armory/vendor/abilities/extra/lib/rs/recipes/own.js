// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
/*!
 * rollshade-gl / recipes/own.js
 *
 * Ported from rollshade (https://github.com/tsuyatt/rollshade) `src/runtime/recipes/own.ts`:
 * TypeScript types stripped, imports rewired to the GLSL runtime in this folder.
 * The move logic itself is unchanged.
 *
 * MIT License — Copyright (c) 2026 tsuyatt. Port for the VFX Armory "extra" pack.
 */
const owners = new WeakMap;
let serial = 0;
export function claim(handle, slot) {
  const id = ++serial;
  const map = owners.get(handle) ?? {};
  map[slot] = id;
  owners.set(handle, map);
  return id;
}
export function owns(handle, slot, id) {
  return owners.get(handle)?.[slot] === id;
}
