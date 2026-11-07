// The open copy of the VFX Armory carries none of the Armory's remade models (its own work, under the VFX Armory Licence),
// so every model loads as it is. The game ships no model that needed one: the extended pack aims at the fighters
// themselves (extendedField.ts), and the effects whose model is a remake are left out.
export const REMAKES = Object.freeze({});
export const REMAKE = false;
export function modelUrl(url) { return url; }
