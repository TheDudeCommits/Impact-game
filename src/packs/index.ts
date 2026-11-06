import type { PackDefinition } from '../engine/packs/pack';

/** The content packs this build carries, by id (a page asks for one with ?pack=<id>: src/engine/packs/boot.ts). None
 *  ship in this repository yet; a pack is a PackDefinition (src/engine/packs/pack.ts) registered here. */
export const PACKS: Readonly<Record<string, PackDefinition>> = {};
