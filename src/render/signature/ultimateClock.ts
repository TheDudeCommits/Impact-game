import { WHIFF_RECOVERY, type MoveDefinition } from '../../game/moves';
import type { PlayerState } from '../../game/types';

/** Round 3d (ULTS): the hit-confirm ultimates, as the effects see them.
 *
 *  The opener's effects play from the cast; the cinematic's only once the
 *  opener has landed - `landed`, the simulation's confirm (PlayerState
 *  .confirmedAt: the server's for everyone else, the prediction's for your
 *  own). An opener that found nobody ends the move WHIFF_RECOVERY later, and
 *  `whiffEnd` says when on the action's own clock (seconds since it started,
 *  freezes left out: the `actionTime * actionDuration` every effect reads).
 *  actionDuration itself stays the whole move's - the rig's pacing is scaled
 *  to it - so anything that fades out towards the end of the move ends at
 *  `ultimateEnd` instead. `beats` is how many of the move's contacts are
 *  drawn: the opener's alone until the confirm.
 *
 *  Round 3e (ULTFIX): your own ultimate's verdict is the server's now too (a
 *  client's copy leaves it to the server: ArenaSimulation.follows). And a
 *  whiff shows as one at once: what the opener raised over the world - the
 *  time stop, the dome, ROOM, the technique's grade, its light - is gone
 *  WHIFF_CLEAR after the verdict is known (`whiffGone`), not held on through
 *  the recovery. The third critic watched MIDNIGHT's stop and SETSUNA's
 *  blue hold for a second and more over nothing. */
export const landed = (s: PlayerState) => s.action === 'ultimate' && s.confirmedAt !== undefined;
export const whiffEnd = (s: PlayerState) => s.whiffedAt === undefined ? Infinity : s.whiffedAt - s.actionStarted - (s.actionFrozen ?? 0) + WHIFF_RECOVERY;
export const ultimateEnd = (s: PlayerState) => Math.min(s.actionDuration, whiffEnd(s));
export const beats = (s: PlayerState, move: Pick<MoveDefinition, 'contacts' | 'confirm'>) =>
  s.action === 'ultimate' && move.confirm && s.confirmedAt === undefined ? Math.min(1, move.contacts.length) : move.contacts.length;
/** Round 3e (ULTFIX): how long a whiffed ultimate's field, grade and light
 *  take to go once the whiff is known. */
export const WHIFF_CLEAR = .15;
/** Round 3e (ULTFIX): when on the action's clock the opener was found to have
 *  missed (Infinity while it has not), and until when what it raised shows. */
export const whiffAt = (s: PlayerState) => s.whiffedAt === undefined ? Infinity : s.whiffedAt - s.actionStarted - (s.actionFrozen ?? 0);
export const whiffGone = (s: PlayerState) => whiffAt(s) + WHIFF_CLEAR;
/** Round 3e (ULTFIX): how long a hit-confirm ultimate's grade holds past its
 *  opener at a time while the verdict is out (CombatEffects), so a whiff
 *  lets go of it at once. */
export const OPENER_FEED = .15;
/** Round 3e (ULTFIX): an ultimate still waiting on its opener's verdict. */
export const undecided = (s: PlayerState) => s.action === 'ultimate' && s.confirmedAt === undefined && s.whiffedAt === undefined;
