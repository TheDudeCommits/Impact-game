import type { FighterId } from '../../game/types';
import { PROFILES_A } from './profilesA';
import { PROFILES_B } from './profilesB';
import { PROFILE_SETSU } from './profileSetsu';
import { PROFILES_SHOP } from './profilesShop';
import { applyOriginalIdles } from '../../originals/apply';

export interface IdleProfile {
  /** Animation-only GLB whose clips join the body's own (bound by bone name,
   *  see FighterLibrary.load), for an idle the shipped body does not carry. */
  model?: string;
  /** Clip to loop as the idle instead of the model's own, by name in the
   *  fighter's GLB (or in a GLB the fighter already loads). */
  clip?: string;
  /** Occasional variations played between idle loops, by clip name. */
  fidgets?: readonly string[];
  /** Procedural life on top of the clip, 0 to switch a part off, 1 the
   *  default amount: breathing (chest and shoulders), weight shift between
   *  the feet, and the head's slow drift and settle. */
  breath?: number;
  sway?: number;
  gaze?: number;
  /** The stance the fighter's personality reads as, which tells the life
   *  layer what the hands are doing: fists up, hands low or in pockets, a
   *  blade held, or a spirit user's posture. */
  stance?: 'guard' | 'relaxed' | 'weapon' | 'stand';
  /** A light rhythmic bounce on the knees, 0 for none (the default) and 1 the
   *  life layer's own amount - for an idle clip that does not bounce itself. */
  bounce?: number;
  /** Seconds of standing between fidgets, the shortest and the longest wait
   *  (default seven to thirteen). */
  fidgetEvery?: readonly [number, number];
  /** Round 3c (ANIM): how far the breath settles the body into its knees -
   *  the up-and-down a standing fighter is read as alive by - as a multiple
   *  of the life layer's own amount (1, the default). For a clip that holds
   *  the body still, which the second blind critic read as a statue. */
  dip?: number;
  /** Round 3c (ANIM): the fight-ready stance, by clip name - the fighter's own
   *  battle idle - stood in instead of `clip` while an opponent is close, and
   *  for a few seconds after any exchange (see `IdleRig`). For a relaxed
   *  idle that reads as off duty in a fight: Ward's victory loop, Kagari's
   *  home-screen idle. No fidgets play in it. */
  ready?: string;
}

/** The idle a fighter with no profile gets: its own clip, and the default
 *  life on top. Every fighter breathes; the profile only tunes it. */
export const DEFAULT_IDLE: IdleProfile = {};

export const IDLE_PROFILES: Partial<Record<FighterId, IdleProfile>> = {
  chohan:{clip:'_Idle',ready:'_Idle',stance:'guard',breath:.018,sway:.014,gaze:.025,dip:0},
  aqrab:{"clip":"_Idle","ready":"_Idle","stance":"guard","breath":0.025,"sway":0.018,"gaze":0.04,"dip":0},
  tsubute:{"clip":"_Idle","ready":"_Idle","stance":"guard","breath":0.025,"sway":0.02,"gaze":0.04,"dip":0},
  ume:{clip:'_Idle',ready:'_Idle',stance:'guard',breath:.08,sway:.04,gaze:.08,dip:.02},
  lanthorn:{clip:'_Idle',ready:'_Idle',stance:'guard',breath:.08,sway:.04,gaze:.08,dip:.02},
  highsun:{clip:'_Idle',ready:'_Idle',stance:'guard',breath:.08,sway:.04,gaze:.08,dip:.02},
  torsion:{clip:'_Idle',ready:'_Idle',stance:'guard',breath:.04,sway:.02,gaze:.06,dip:0},
  kubiwa:{clip:'_Idle',ready:'_Idle',stance:'guard',breath:.10,sway:.04,gaze:.10,dip:0},
  onigawara:{clip:'_Idle',ready:'_Idle',stance:'guard',breath:.1,sway:.06,gaze:.1,dip:0},
  cardo:{clip:'_Idle',ready:'_Idle',stance:'weapon',breath:1.1,sway:.8,gaze:1,dip:3,bounce:.6},
  minase:{clip:'_Idle',ready:'_Idle',stance:'guard',breath:.08,sway:.03,gaze:.1,dip:0},
  aquilo:{clip:'_Idle',ready:'_Idle',stance:'relaxed',breath:.9,sway:.6,gaze:.9,dip:2.2,bounce:.4},
  'psyche':{clip:'_Idle',ready:'_Idle',stance:'guard',breath:.015,sway:.012,gaze:.025,dip:0},
  'ovid':{clip:'_Idle',ready:'_Idle',stance:'guard',breath:.018,sway:.01,gaze:.025,dip:0},
  // Scout Hawser stands in Levin's stance (his kit fitted to him): blades held, breathed as Levin is (profilesShop.ts).
  hawser:{clip:'_Idle',ready:'_Idle',stance:'weapon',breath:1,sway:.5,gaze:.8,dip:2.2},
  rotfalke:{clip:'_Idle',ready:'_Idle',stance:'guard',breath:.018,sway:.01,gaze:.025,dip:0},
  bonsho:{clip:'_Idle',ready:'_Idle',stance:'guard',breath:.018,sway:.01,gaze:.025,dip:0},
  murex:{clip:'_Idle',ready:'_Idle',stance:'guard',breath:.018,sway:.01,gaze:.025,dip:0},
  kinu:{clip:'_Idle',ready:'_Idle',stance:'guard',breath:.018,sway:.015,gaze:.04,dip:0},
  'madake':{clip:'_Idle',ready:'_Idle',stance:'guard',breath:.02,sway:.015,gaze:.04,dip:0},
  akayuri:{clip:'_Idle',ready:'_Idle',stance:'guard',breath:.025,sway:.015,gaze:.035,dip:0},
  hagure:{clip:'_Idle',ready:'_Idle',stance:'guard',breath:.035,sway:.025,gaze:.07,dip:0},
  hisame:{clip:'_Idle',ready:'_Idle',stance:'guard',breath:.035,sway:.018,gaze:.07,dip:0},
  svanhild:{clip:'_Idle',ready:'_Idle',stance:'relaxed',breath:.9,sway:.65,gaze:.9,dip:2.2,bounce:.3},
  mizuhiki:{clip:'_Idle',ready:'_Idle',stance:'guard',breath:.04,sway:.02,gaze:.08,dip:0},
  'shibuichi':{clip:'_Idle',ready:'_Idle',stance:'guard',breath:.04,sway:.02,gaze:.08,dip:0},
  'rakucho':{clip:'_Idle',ready:'_Idle',stance:'guard',breath:.07,sway:.025,gaze:.09,dip:0},
  irbis:{clip:'_Idle',ready:'_Idle',stance:'guard',breath:.08,sway:.03,gaze:.09,dip:0},
  shidare:{clip:'_Idle',ready:'_Idle',stance:'guard',breath:.07,sway:.025,gaze:.08,dip:0},
  yodaka:{clip:'_Idle',ready:'_Idle',stance:'guard',breath:.025,sway:.015,gaze:.04,dip:0},
  hinomoto:{clip:'_Idle',ready:'_Idle',stance:'guard',breath:.07,sway:.025,gaze:.08,dip:0},
  amagoi:{clip:'_Idle',ready:'_Idle',stance:'guard',breath:.07,sway:.03,gaze:.08,dip:0},
  'shakudo':{clip:'_Idle',ready:'_Idle',stance:'guard',breath:.08,sway:.03,gaze:.1,dip:0},
  hikui:{clip:'_Idle',ready:'_Idle',stance:'guard',breath:.08,sway:.04,gaze:.08,dip:.02},
  tokan:{clip:'_Idle',ready:'_Idle',stance:'guard',breath:.08,sway:.04,gaze:.08,dip:.02},
  strappado:{clip:'_Idle',ready:'_Idle',stance:'guard',breath:.1,sway:.05,gaze:.1,dip:.02},
  unari:{clip:'_Idle',ready:'_Idle',stance:'guard',breath:.13,sway:.07,gaze:.11,dip:.03},
  barrow:{clip:'_Idle',ready:'_Idle',stance:'guard',breath:.12,sway:.06,gaze:.1,dip:.03},
  sashigane:{clip:'_Idle',ready:'_Idle',stance:'weapon',breath:.16,sway:.09,gaze:.12,dip:.04},
  gosu:{clip:'_Idle',ready:'_Idle',stance:'stand',breath:.16,sway:.09,gaze:.12,dip:.04},
  kusushi:{clip:'_Idle',ready:'_Idle',stance:'guard',breath:.19,sway:.10,gaze:.12,dip:.04},
  hakushi:{clip:'_Idle',ready:'_Idle',stance:'guard',breath:.19,sway:.10,gaze:.12,dip:.04},
  suzuran:{clip:'_Idle',ready:'_Idle',stance:'guard',breath:.18,sway:.10,gaze:.12,dip:.04},
  wataame:{clip:'_Idle',ready:'_Idle',stance:'weapon',breath:.20,sway:.12,gaze:.14,dip:.05},
  bruin:{clip:'_Idle',ready:'_Idle',stance:'weapon',breath:.8,sway:.5,gaze:.8,dip:2,bounce:.25},
  senko:{clip:'_Idle',ready:'_Idle',stance:'guard',breath:.1,sway:.06,gaze:.1,dip:.03},
  buna:{clip:'_Idle',ready:'_Idle',stance:'weapon',breath:.16,sway:.1,gaze:.12,dip:.04},
  oyashio:{clip:'_Idle',ready:'_Idle',stance:'guard',breath:.15,sway:.08,gaze:.12,dip:.04},
  adad:{clip:'_Idle',ready:'_Idle',stance:'weapon',breath:.16,sway:.1,gaze:.16,dip:.04},
  shijima: {clip:'_Idle',ready:'_Idle',stance:'guard',breath:.18,sway:.12,gaze:.12,dip:.06},
  akaito: {clip:'_Idle',ready:'_Idle',stance:'guard',breath:.18,sway:.12,gaze:.12,dip:.06},
  tempo:{clip:'_Idle',ready:'_Idle',stance:'guard',breath:.22,sway:.14,gaze:.15,dip:.06},
  tancho:{clip:'_Idle',ready:'_Idle',stance:'guard',breath:.2,sway:.12,gaze:.1,dip:.06},
  bellows:{clip:'_Idle',ready:'_Idle',stance:'guard',breath:.18,sway:.1,gaze:.1,dip:.05},
  mikage:{clip:'_Idle',ready:'_Idle',stance:'guard',breath:.22,sway:.16,gaze:.15,dip:.08},
  ...PROFILES_A, ...PROFILES_B, ...PROFILE_SETSU, ...PROFILES_SHOP,
  strix: { clip: '_Idle', ready: '_Idle', stance: 'weapon', breath: .35, sway: .2, gaze: .25, dip: .15 },
  'full-beam': { clip: '_Idle', ready: '_Idle', stance: 'guard', breath: .2, sway: .12, gaze: .1, dip: .06 },
  pyroclast: { clip: '_Idle', ready: '_Idle', stance: 'guard', breath: .2, sway: .12, gaze: .1, dip: .06 },
  ampere: { clip: '_Idle', ready: '_Idle', stance: 'guard', breath: .25, sway: .12, gaze: .1, dip: .06 },
  shanxiao: { clip: '_Idle', ready: '_Idle', stance: 'guard', breath: .2, sway: .12, gaze: .1, dip: .06 },
  kuzu: { clip: '_Idle', ready: '_Idle', stance: 'weapon', breath: .2, sway: .12, gaze: .1, dip: .06 },
  shakugo: { clip: '_Idle', ready: '_Idle', stance: 'relaxed', breath: .18, sway: .12, gaze: .15, dip: .05 },
  'basilissa': { clip: '_Idle', ready: '_Idle', stance: 'relaxed', breath: .15, sway: .15, gaze: .2, dip: .05 },
  sorayomi: { clip: '_Idle', ready: '_Idle', stance: 'weapon', breath: .3, sway: .2, gaze: .3, dip: .1 },
};
applyOriginalIdles(IDLE_PROFILES);
