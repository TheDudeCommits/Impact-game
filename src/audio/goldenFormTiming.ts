import { awakeningSwapAt } from '../game/awakening';

const burst = awakeningSwapAt('taisei');
export const GOLDEN_FORM = {
  /** Seconds from the awaken event to the burst and the swap. */
  burst,
  /** Seconds from the awaken event to the line: 0.26 s after the burst, as the blast's tail falls away, so the line's
   *  soft opening is not laid under it. */
  line: Math.round((burst + .26) * 1000) / 1000,
  /** Seconds into the voice cut where its words start, measured on the cut (10 ms frames within 25 dB of its
   *  loudest, after 50 ms below it): the second phrase at 2.08 and the name at 2.89, the line's loudest. */
  son: 2.08,
  taisei: 2.89,
};

const ougaBurst = awakeningSwapAt('ouga');
export const SUPER_OUGA = {
  /** Seconds from the awaken event to the burst and the swap. */
  burst: ougaBurst,
  /** Seconds from the awaken event to the line: 0.26 s after the burst, as Taisei's, so the line's calm opening is not
   *  laid under the blast's crest. */
  line: Math.round((ougaBurst + .26) * 1000) / 1000,
  /** Seconds into the voice cut where its words start, measured on the cut as Taisei's are (10 ms frames within
   *  25 dB of its loudest, after 50 ms below it): the opening word at 0.01, the second phrase at 1.04 and the name at
   *  1.92. */
  ore: .01,
  super: 1.04,
  ouga: 1.92,
};
