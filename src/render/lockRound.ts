import type { FighterId } from '../game/types';

/** Lock combat (game/lockCombat.ts), the rework: the takes a second round's three blows are drawn with (the moves
 *  LOCK_ROUND_TWO names), on the floor. Takes of each pilot's own body that the first round and its finisher do not
 *  play - kicks, elbows and palms beside the first round's punches and cuts.
 *
 *  A row is a clip by name and, where only part of a longer take is the blow, the part played (`from`/`to` seconds,
 *  its blow at `contact` of what is played, read off a take `span` long - as AIR_STRING_CLIPS' rows are). A whole take
 *  is cut down round its blow (measured off the rig, as a rush stage's is), LOCK_TAKE_LEAD before it and LOCK_TAKE_TAIL
 *  after, so a long take is not played at a sprint to fit a stage's 0.42 s. */
export type LockTake = { clip: string; from?: number; to?: number; contact?: number; span?: number };
export const LOCK_ROUND_CLIPS: Partial<Record<FighterId, readonly [LockTake, LockTake, LockTake]>> = {
  konta: [{ clip: 'Punch 01' }, { clip: 'air Attack 02' }, { clip: 'Kick 02' }],
  taisei: [{ clip: 'taisei-grounded-meteor', from: 0, to: .667, contact: .42, span: .667 }, { clip: 'taisei-grounded-cross' }, { clip: 'Straight Palm' }],
  gummy: [{ clip: 'Punch 02', from: 0, to: 1, contact: .37, span: 1 }, { clip: 'Punch 01' }, { clip: 'Sickle Sweep' }],
  nigo: [{ clip: 'strike_1_1' }, { clip: 'attack_1_1' }, { clip: 'attack_1' }],
  ouga: [{ clip: 'Elbow Palm' }, { clip: 'Rising Kick' }, { clip: 'Ki Volley' }],
  shiden: [{ clip: 'Slash Palm', from: .25, to: 1.05, contact: .46, span: 5.542 }, { clip: 'Rising Slash' }, { clip: 'Cut Plunge' }],
};
/** How much of a whole take is played before its blow, and after it, in seconds of the take. */
export const LOCK_TAKE_LEAD = .3, LOCK_TAKE_TAIL = .45;
