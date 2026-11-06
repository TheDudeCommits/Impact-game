import { ORIGINALS } from './roster';

type Mark = { readonly node: string; readonly root: readonly [number, number, number]; readonly tip: readonly [number, number, number] };
const MARKS: Partial<Record<string, Mark>> = {
  // Cardo (cardo): his slab-sword, 1.08 m from the guard to the tip.
  ...(ORIGINALS.cardo ? { cardo: { node: 'weapon_slab_R', root: [0.0689, -0.0889, 0.075], tip: [0.6827, -0.7789, 0.6359] } } : {}),
  // Bruin (bruin): his katana, 0.72 m from the guard to the tip.
  ...(ORIGINALS.bruin ? { bruin: { node: 'weapon_katana_R', root: [0.004, 0.0283, -0.111], tip: [-0.026, 0.1559, -0.821] } } : {}),
};

export const originalBladeMark = (fighter: string): Mark | undefined => MARKS[fighter];
