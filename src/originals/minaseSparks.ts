import type { FighterId } from '../game/types';
import type { Element } from '../render/vfx/palette';
import { ORIGINALS } from './roster';

/** The gale palm's spark: white-gold spikes cooling to gold, a warm light, an amber-brown ink. */
const GALE: Element = { spike: 0xfff3d2, rim: 0xffb21f, light: 0xffd27a, ink: 0x2a1604 };

export function applyMinaseSparks(table: Partial<Record<FighterId, Record<string, Element>>>) {
  if (ORIGINALS.minase && table.minase) table.minase = { ...table.minase, heavy: GALE, ultimate: GALE };
  return table;
}
