import { awakeningSwapAt } from '../game/awakening';

const swap = awakeningSwapAt('nigo');
/** The burst breaks on the vowel, not the consonant: 30 ms after the word's
 *  first consonant its opening hiss masked it. */
const burstAfterKai = .08;
export const UNSEALED = {
  /** Seconds from the awaken event to the second word's onset. */
  kai: swap - burstAfterKai,
  /** Seconds into the voice cut where the second word starts, measured
   *  on the cut (10 ms frames within 20 dB of its peak): the first word
   *  0.02-0.30, the second 0.54-0.91. */
  kaiInLine: .54,
  burstAfterKai,
};
