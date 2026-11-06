import type { FighterId } from '../../game/types';

/** Round 3e (MODELS2): hands drawn to the body's scale.
 *
 *  Taisei's hands are grafted from the Oup77 rig onto the Meshy body, and they
 *  came across at that rig's size: 0.27 m from the wrist joint to the middle
 *  fingertip against a 0.19 m forearm, 15% of his height where a hand is
 *  about 11% - the third blind critic's "clay-like oversized open hand". Every
 *  one of his clips (and the rush and teleport files bound onto him) keys the
 *  hand bones' scale at 1, so the scale is applied after the pose each frame,
 *  on the hand bone itself: the fingers, the palm and the half of the
 *  wristband weighted to the hand shrink about the wrist together, and every
 *  finger still bends at its own knuckle. The wrist, and so every effect and
 *  contact placed from the hand, does not move. */
export const HAND_SCALE: Partial<Record<FighterId, number>> = {};
