import { ORIGINALS } from './roster';

type Edge = { readonly top: readonly [number, number, number]; readonly middle: readonly [number, number, number]; readonly bottom: readonly [number, number, number] };
const BLADE: Edge = { top: [-1.4978, 0.025, 0.3277], middle: [-1.2629, 0.0053, 0.1993], bottom: [-0.9301, 0.0041, 0.135] };

export const HIGHSUN_BLADE: { readonly node: string; readonly base: Edge; readonly form: Edge } | undefined =
  ORIGINALS.highsun ? { node: 'weapon_slab_R', base: BLADE, form: BLADE } : undefined;
