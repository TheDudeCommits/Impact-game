import { comboMove, type ComboKey } from '../game/combos';
import { moveFor } from '../game/awakening';
import { isBigBlow } from '../game/bigBlow';
import type { CombatEvent } from '../game/types';

/** Whether a landed blow is one of the feel pass's big ones (see
 *  game/bigBlow.ts): the last contact of a special, an ultimate, a combo
 *  ender or a rush finisher. Read off the event the way CombatEffects reads
 *  which move it was (an ender is its own move, never its slot's), so the
 *  presentation and the simulation's longer hold agree. `awakened`: the
 *  thrower's form, whose moves can count their contacts differently. */
export function bigBlowOf(event: CombatEvent, awakened = false) {
  if (event.kind !== 'hit' || !event.slot || !event.fighter) return false;
  const move = (event.branch ? comboMove(event.fighter, event.branch as ComboKey, awakened) : undefined) ?? moveFor(event.fighter, event.slot, awakened);
  const count = move?.contacts.length ?? 1;
  const last = count <= 1 || event.contactIndex === undefined || event.contactIndex >= count - 1;
  return isBigBlow(event.slot, event.branch, event.chain, last);
}

/** A blow of a hit-confirmed ultimate's cinematic (every contact after its
 *  opener): the paired finisher's (render/FinisherCuts.ts) - each one snapped
 *  into, held shaking and flashed on the victim like a big blow, in sync with
 *  the thrower's schedule, so the pair read as one choreography. Presentation
 *  only: the simulation's hold for these is its own. */
export function cinematicBlowOf(event: CombatEvent, awakened = false) {
  if (event.kind !== 'hit' || event.slot !== 'ultimate' || !event.fighter || event.branch) return false;
  const move = moveFor(event.fighter, 'ultimate', awakened);
  return !!move.confirm && (event.contactIndex ?? 0) >= 1;
}
