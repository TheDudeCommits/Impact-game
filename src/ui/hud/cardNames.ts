import type { MoveDefinition } from '../../game/moves';
import { areaCardOf } from '../../engine/sim/areaMoves';
/** The area move's name on its card (Hud.ts): the move's own name, unless it would run past the two lines a name has under
 *  its card in the row (halo.css) - then the part after its colon ("Steel Avenue"), or, with none to
 *  drop, the part players call it (SHORT). The full name stays the card's title and the move list's. */
const SHORT: Readonly<Record<string, string>> = {
  'WIND ART: SENPU SHIGURE': 'GIANT SENPUGAN',
};

/** The lines a name takes under a card in the row - its card's share of the row holds about 14 letters a line (halo.css
 *  .ik-cap) - filled a word at a time. */
export function cardLines(name: string, perLine = 14) {
  let count = 1, line = 0;
  for (const word of name.split(' ')) {
    if (line && line + 1 + word.length > perLine) { count++; line = word.length; }
    else line += (line ? 1 : 0) + word.length;
  }
  return count;
}

export function areaCardName(name: string) {
  const upper = name.toUpperCase();
  if (SHORT[upper]) return SHORT[upper];
  if (cardLines(upper) <= 2 || !upper.includes(':')) return upper;
  return upper.slice(upper.lastIndexOf(':') + 1).trim();
}

/** The G card's name for an area move: its card name (AreaSpec.card, 16 characters or fewer), else its own name as
 *  above. The card's title, the cast banner and the seal's ring keep the full name. */
export const areaMoveCard = (move: Pick<MoveDefinition, 'name' | 'area'>) => areaCardName(areaCardOf(move));
