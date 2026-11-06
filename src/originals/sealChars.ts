import { areaJaOf } from '../engine/sim/areaMoves';
import { moveFor } from '../game/awakening';
import { MOVES, type MoveDefinition } from '../game/moves';
import type { FighterId } from '../game/types';
import { charsOf, ringLatin } from '../render/area/glyphText';
import { displayMove } from './apply';
import { ORIGINAL_AREAS, shownAreaJa } from './area';
import { ORIGINAL_EMBLEMS } from './emblems';
import { ORIGINAL_IDS } from './roster';

export function originalSealLines(fighter: FighterId, move: MoveDefinition) {
  return { ja: shownAreaJa(fighter, areaJaOf(fighter, move), move.name), en: displayMove(fighter, move.name) };
}

/** Every character of every original's seal: the area move it casts, and the one its awakened form casts where that is another. */
export function originalSealChars(): string[] {
  const want = new Set<string>();
  // (And a slot whose original is named but still waiting to open: its area entry's lines are baked ahead.)
  for (const id of new Set([...ORIGINAL_IDS, ...(Object.keys(ORIGINAL_AREAS) as FighterId[])])) {
    for (const move of new Set([MOVES[id].area, moveFor(id, 'area', true)])) {
      const { ja, en } = originalSealLines(id, move);
      for (const c of charsOf(ja)) want.add(c);
      for (const c of charsOf(ringLatin(en))) want.add(c);
      const area = ORIGINAL_AREAS[id];
      if (area) for (const c of [...charsOf(area.ja), ...charsOf(area.form?.ja ?? ''), ...charsOf(ringLatin(area.name))]) want.add(c);
    }
    const emblem = ORIGINAL_EMBLEMS[id];
    if (emblem && 'glyph' in emblem) for (const c of charsOf(emblem.glyph)) want.add(c);
  }
  return [...want].sort();
}
