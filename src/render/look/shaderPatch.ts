import * as THREE from 'three';

type Shader = THREE.WebGLProgramParametersWithUniforms;
type Edit = (shader: Shader, renderer: THREE.WebGLRenderer) => void;
interface Chain { edits: { key: string; edit: Edit }[]; base: string }

const chains = new WeakMap<THREE.Material, Chain>();
const DEFAULT_COMPILE = THREE.Material.prototype.onBeforeCompile;

/** Adds one edit to a material's shader without replacing the others.
 *
 *  A fighter's toon material can carry several edits at once - the Golden
 *  crown, Gummy's Will, the garment floor, the look's colour ramp and rim -
 *  and each of them used to be installed by assigning `onBeforeCompile`,
 *  which silently threw away whichever had been assigned before it. Every
 *  edit added here runs, in the order it was added, and the program cache key
 *  joins all of their keys, so two materials only share a program when they
 *  carry the same edits. An `onBeforeCompile` that was already on the material
 *  when the first edit arrives is kept and runs first; code that wraps the
 *  material afterwards (the fox-tail clearance, the camera cutaway) captures
 *  this composite and chains on top of it, as it always has.
 *
 *  Adding an edit under a key the material already has replaces that edit in
 *  place, so a patch can be re-installed without stacking. */
export function addShaderPatch(material: THREE.Material, key: string, edit: Edit) {
  let chain = chains.get(material);
  if (!chain) {
    const previous = material.onBeforeCompile;
    const inherited = previous !== DEFAULT_COMPILE;
    chain = { edits: [], base: inherited ? material.customProgramCacheKey() : '' };
    chains.set(material, chain);
    const own = chain;
    material.onBeforeCompile = function (shader, renderer) {
      if (inherited) previous.call(this, shader, renderer);
      for (const { edit } of own.edits) edit(shader, renderer);
    };
    material.customProgramCacheKey = () => [own.base, ...own.edits.map(e => e.key)].filter(Boolean).join('|');
  }
  const existing = chain.edits.find(e => e.key === key);
  if (existing) existing.edit = edit; else chain.edits.push({ key, edit });
  material.needsUpdate = true;
}

/** The keys of every edit on a material, in order - for tests and probes. */
export function shaderPatchKeys(material: THREE.Material): string[] {
  return chains.get(material)?.edits.map(e => e.key) ?? [];
}

/** Replace one `#include <chunk>` (or any exact snippet) in a shader string,
 *  and say so when it is missing. A three.js upgrade that renames a chunk
 *  would otherwise turn an edit into a silent no-op, which is how the old
 *  overwrite bug hid for so long. */
export function replaceOnce(source: string, find: string, replacement: string, label: string) {
  if (!source.includes(find)) {
    if (typeof console !== 'undefined') console.warn(`look: shader edit "${label}" did not find ${find}`);
    return source;
  }
  return source.replace(find, replacement);
}
