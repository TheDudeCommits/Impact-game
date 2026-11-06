import { MOVES } from '../../game/moves';
import { moveFor } from '../../game/awakening';
import { FIGHTER_IDS } from '../../engine/sim/registry';
import { areaJaOf } from '../../engine/sim/areaMoves';
import { EMBLEMS, emblemText } from './emblems';
import { charsOf, ringLatin } from './glyphText';
import { originalSealChars } from '../../originals/sealChars';
import { shownAreaJa } from '../../originals/area';

export function wantedChars(): string[] {
  const want = new Set<string>();
  for (const id of FIGHTER_IDS) {
    for (const c of charsOf(emblemText(EMBLEMS[id]))) want.add(c);
    // (Its own area move, and the one its awakened form casts where that is another: the YUGE's Rumbling.)
    for (const move of new Set([MOVES[id].area, moveFor(id, 'area', true)])) {
      for (const c of charsOf(areaJaOf(id, move))) want.add(c);
      for (const c of charsOf(shownAreaJa(id, areaJaOf(id, move), move.name))) want.add(c);
      for (const c of charsOf(ringLatin(move.name))) want.add(c);
    }
  }
  for (const c of originalSealChars()) want.add(c);
  return [...want].sort();
}
