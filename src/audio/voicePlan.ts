import { comboMove, type ComboKey } from '../game/combos';
import { moveFor, rushMove } from '../game/awakening';
import type { MoveDefinition } from '../game/moves';
import { barrageWindow } from '../game/timeStopBarrage';
import type { AttackSlot, CombatEvent, FighterId, ReactionKind } from '../game/types';
import { cueDuration, type AudioCue, type CueLayer } from './cueTypes';
import { DODGE_SHARE, LOW_AGAIN, LOW_HEALTH, LOW_REARM, SITUATION_RULES, situationLayer, situationLines, type SituationLine, type VoiceSituation } from './voiceSituations';
import { AWAKENING_LINES } from './awakeningLines';
import { UNSEALED } from './unsealedTiming';
import { GOLDEN_FORM, SUPER_OUGA } from './goldenFormTiming';


/** Seconds of server time a fighter's named light callout rests after it plays. */
export const LIGHT_CALL_COOLDOWN = 9;
/** The chance a string opener outside the cooldown calls its light by name. */
export const LIGHT_CALL_CHANCE = .35;
/** The chance a light cast that is not a callout carries an effort. The
 *  never-twice-running rule brings the share of light casts that do down to
 *  about 29%. */
export const EFFORT_CHANCE = .4;
/** Two light casts closer together than this are one flurry: an effort does
 *  not follow an effort inside it. A rush stage comes every half second. */
const FLURRY = 1.6;
/** An effort is timed so its burst lands on the blow rather than on the press. */
const EFFORT_LEAD = .1;
/** A clock this far behind what a fighter was last seen at is a new match. */
const REWIND = 2;
/** Fighters remembered at once; the oldest is forgotten past it. */
const REMEMBERED = 64;
/** Casts remembered per fighter, so a re-planned cast is voiced the same. */
const DECISIONS = 16;

interface Rationed {
  /** Rotated between, never the same one twice running. */
  cues: readonly AudioCue[];
  /** The chance a cast of the slot is voiced; 1 when omitted. */
  chance?: number;
}
interface VoiceKit {
  /** Named callouts. The light's is rationed (see above); the others play on
   *  every cast of their slot. */
  calls: Partial<Record<AttackSlot, AudioCue>>;
  /** Short wordless efforts in the character's own voice - lotus-breath, grunts,
   *  exhales - for the light stages between callouts. */
  efforts: readonly AudioCue[];
  /** A heavy with no named callout: its own efforts. */
  heavy?: Rationed;
  /** A special with no named callout. */
  special?: Rationed;
  /** A Stand's barrage cry, looped across the special's blows and across the
   *  time-stop ultimate's barrageWindow. */
  barrage?: AudioCue;
  /** Said as the ultimate's finisher lands, after the barrage; `lands` is how
   *  far into the line the word that should meet the blow is. */
  finisher?: { cue: AudioCue; lands: number };
  /** Seconds a call waits after the cast, so its key word meets its moment:
   *  the "HA" of a Sunpalm Cannon on the beam, NIGHTFALL on the release. */
  delays?: Partial<Record<AttackSlot, number>>;
  /** (combos.ts, 4 October) The calls of the combo enders - a launcher, a knockdown, a stun, an air strike, a ground
   *  smash - rationed as a heavy's efforts are. An ender is never voiced with its slot's named call: Magatsu's Light +
   *  Heavy is not Hachi. Without one it is silent on the voice bus. */
  enders?: Partial<Record<ComboKey, Rationed>>;
  /** Round 3d (ULTS): a line inside a hit-confirm ultimate's cinematic,
   *  which is said only when the opener lands: `lands` seconds into it is
   *  the word that meets the finisher. Laid out from the cinematic's first
   *  blow (after the cast's call has finished), or from the confirm itself
   *  (`fromConfirm`) where the line must start before that blow. */
  cinematic?: { cue: AudioCue; lands: number; fromConfirm?: boolean };
}

/** Round 3d (PACE): the wait that puts a call's key word - `word` seconds
 *  into the line - on its move's release. These were written in seconds
 *  against round 3's contacts (Sunpalm Cannon 0.36 on 1.35, Gale 0.9 on 1.65);
 *  a line longer than the wind-up now starts on the cast, its word as close
 *  after the release as the line allows. */
const onRelease = (fighter: FighterId, slot: AttackSlot, word: number) => Math.max(0, Math.round((moveFor(fighter, slot, false).contacts[0] - word) * 100) / 100);

const KITS: Record<FighterId, VoiceKit> = {
  chohan:{calls:{heavy:'vo-chohan-cut',special:'vo-chohan-blink'},efforts:['vo-chohan-effort-a','vo-chohan-effort-b'],cinematic:{cue:'vo-chohan-playtime-over',lands:1.2,fromConfirm:true}},
  tsubute:{calls:{heavy:'vo-tsubute-ballast',special:'vo-tsubute-far-bank'},efforts:['vo-tsubute-effort-a'],cinematic:{cue:'vo-tsubute-battle-begins',lands:2.4,fromConfirm:true}},
  aqrab:{calls:{heavy:'vo-aqrab-stinger-line',special:'vo-aqrab-sables'},efforts:[],cinematic:{cue:'vo-aqrab-bone-dry',lands:1.3,fromConfirm:true}},
  yodaka:{calls:{heavy:'vo-yodaka-rising-sun',special:'vo-yodaka-blooming-flame'},efforts:['vo-yodaka-effort-a','vo-yodaka-effort-b'],cinematic:{cue:'vo-yodaka-ninth-form',lands:2.69,fromConfirm:true}},
  ume:{calls:{},efforts:['vo-ume-effort-c','vo-ume-effort-d'],heavy:{cues:['vo-ume-effort-a','vo-ume-effort-b'],chance:.65},special:{cues:['vo-ume-bloom-barrage'],chance:.8},cinematic:{cue:'vo-ume-hurricane',lands:2.747,fromConfirm:true}},
  lanthorn:{calls:{},efforts:['vo-lanthorn-effort-a','vo-lanthorn-effort-b','vo-lanthorn-effort-c'],heavy:{cues:['vo-lanthorn-counter'],chance:.75},special:{cues:['vo-lanthorn-lampblack'],chance:.85},cinematic:{cue:'vo-lanthorn-ultimate',lands:2.75,fromConfirm:true}},
  highsun:{calls:{light:'vo-highsun-pride'},efforts:[],heavy:{cues:['vo-highsun-divider'],chance:.65},special:{cues:['vo-highsun-pocket-sun'],chance:.85},cinematic:{cue:'vo-highsun-divine-sword',lands:3.05,fromConfirm:true}},
  torsion:{calls:{},efforts:['vo-torsion-effort-a','vo-torsion-effort-b'],heavy:{cues:['vo-torsion-crush'],chance:.7},special:{cues:['vo-torsion-return-fire'],chance:.85},enders:{lllh:{cues:['vo-torsion-disappear'],chance:.7}},cinematic:{cue:'vo-torsion-smithereens',lands:3.14,fromConfirm:true}},
  kubiwa:{calls:{},efforts:['vo-kubiwa-effort-a','vo-kubiwa-effort-b'],heavy:{cues:['vo-kubiwa-beckon','vo-kubiwa-effort-c'],chance:.65},special:{cues:['vo-kubiwa-quiet'],chance:.9},cinematic:{cue:'vo-kubiwa-ultimate',lands:2.82,fromConfirm:true}},
  cardo:{calls:{special:'vo-cardo-special'},efforts:['vo-cardo-effort-a','vo-cardo-effort-b','vo-cardo-effort-c','vo-cardo-effort-d','vo-cardo-effort-e','vo-cardo-effort-f'],heavy:{cues:['vo-cardo-plowshare-drop'],chance:0.6},cinematic:{cue:'vo-cardo-last-weed-standing',lands:3.69,fromConfirm:true}},bruin:{calls:{},efforts:['vo-bruin-effort-a','vo-bruin-effort-b','vo-bruin-effort-c','vo-bruin-effort-d'],special:{cues:['vo-bruin-avidya-slash'],chance:0.35},cinematic:{cue:'vo-bruin-dimension-slash',lands:2.37,fromConfirm:true}},aquilo:{calls:{special:'vo-aquilo-skimming-swallow'},efforts:['vo-aquilo-effort-b','vo-aquilo-effort-c','vo-aquilo-effort-d','vo-aquilo-effort-e'],heavy:{cues:['vo-aquilo-wind-blade-shower'],chance:0.35},cinematic:{cue:'vo-aquilo-great-migration',lands:3.6,fromConfirm:true}},svanhild:{calls:{},efforts:['vo-svanhild-effort-a','vo-svanhild-effort-b','vo-svanhild-effort-d','vo-svanhild-effort-e'],cinematic:{cue:'vo-svanhild-sea-dragon-roar',lands:2.53,fromConfirm:true}},
  onigawara:{calls:{},efforts:['vo-onigawara-effort-a','vo-onigawara-effort-b'],heavy:{cues:['vo-onigawara-heavy'],chance:.65},special:{cues:['vo-onigawara-special'],chance:.85},cinematic:{cue:'vo-onigawara-ultimate',lands:2.79,fromConfirm:true}},
  minase:{calls:{},efforts:['vo-minase-effort-b'],heavy:{cues:['vo-minase-senpugan','vo-minase-effort-a'],chance:.75},special:{cues:['vo-minase-flash-ready'],chance:.85},cinematic:{cue:'vo-minase-tempest',lands:2.8,fromConfirm:true}},
  'psyche':{calls:{special:'vo-psyche-spank'},efforts:['vo-psyche-effort-a','vo-psyche-effort-b'],heavy:{cues:['vo-psyche-try-this'],chance:.45},cinematic:{cue:'vo-psyche-another-job',lands:3.075,fromConfirm:true}},
  'ovid':{calls:{special:'vo-ovid-break'},efforts:[],heavy:{cues:['vo-ovid-break'],chance:.45},cinematic:{cue:'vo-ovid-maximum',lands:3.24,fromConfirm:true}},
  // (13 October: the Scout and the YUGE say the same lines - none names a move. "Kurai yagare!" on the Snap Line
  // and the Burl Fist and on some Thunder Spears and uppercuts; "Kuchiku shite yaru!" from the confirm of Wings of
  // Freedom and of the Colossus's rampage: `lands` is past the line's end, so it starts with the confirm under both clocks.)
  hawser:{calls:{special:'vo-hawser-drive'},efforts:[],heavy:{cues:['vo-hawser-drive'],chance:.45},cinematic:{cue:'vo-hawser-eradicate',lands:3.46,fromConfirm:true}},
  rotfalke:{calls:{special:'vo-rotfalke-field'},efforts:[],heavy:{cues:['vo-rotfalke-challenge','vo-rotfalke-take-that'],chance:.55},cinematic:{cue:'vo-rotfalke-finish',lands:2.988,fromConfirm:true}},
  bonsho:{calls:{special:'vo-bonsho-hundred-hands'},efforts:['vo-bonsho-effort-b'],heavy:{cues:['vo-bonsho-drive'],chance:.45},cinematic:{cue:'vo-bonsho-hundred-hands',lands:3.444,fromConfirm:true}},
  murex:{calls:{special:'vo-murex-special'},efforts:[],heavy:{cues:['vo-murex-heavy'],chance:.55},cinematic:{cue:'vo-murex-ultimate',lands:3.078,fromConfirm:true}},
  kinu:{calls:{},efforts:['vo-kinu-effort-a'],heavy:{cues:['vo-kinu-effort-b'],chance:.65},special:{cues:['vo-kinu-stone-free','vo-kinu-ora'],chance:.75},cinematic:{cue:'vo-kinu-ultimate',lands:3.18,fromConfirm:true}},
  'madake':{calls:{special:'vo-madake-tiger'},efforts:['vo-madake-effort-tap'],heavy:{cues:['vo-madake-pressure'],chance:.55},cinematic:{cue:'vo-madake-midwinter-bamboo',lands:1.0,fromConfirm:true},enders:{lh:{cues:['vo-madake-pressure'],chance:.55},llh:{cues:['vo-madake-chase'],chance:.55},llls:{cues:['vo-madake-peacock'],chance:.75}}},
  akayuri:{calls:{},efforts:[],heavy:{cues:['vo-akayuri-eliminate'],chance:.55},special:{cues:['vo-akayuri-swift'],chance:.6},cinematic:{cue:'vo-akayuri-eliminate',lands:2.87,fromConfirm:true}},
  hagure:{calls:{},efforts:[],heavy:{cues:['vo-hagure-effort-a','vo-hagure-effort-b'],chance:.65},special:{cues:['vo-hagure-move-aside'],chance:.7},enders:{lllh:{cues:['vo-hagure-read-you'],chance:.6}},cinematic:{cue:'vo-hagure-ultimate',lands:3.02,fromConfirm:true}},
  hisame:{calls:{},efforts:[],heavy:{cues:['vo-hisame-heavy'],chance:.5},special:{cues:['vo-hisame-special'],chance:.7},cinematic:{cue:'vo-hisame-ultimate',lands:2.89,fromConfirm:true}},
  mizuhiki:{calls:{light:'vo-mizuhiki-strike'},efforts:[],heavy:{cues:['vo-mizuhiki-cleave'],chance:.6},special:{cues:['vo-mizuhiki-crosscut'],chance:.7},cinematic:{cue:'vo-mizuhiki-finish',lands:3.22,fromConfirm:true}},
  'shibuichi':{calls:{},efforts:['vo-shibuichi-effort-tap'],heavy:{cues:['vo-shibuichi-there'],chance:.6},special:{cues:['vo-shibuichi-hit'],chance:.7},enders:{lh:{cues:['vo-shibuichi-open'],chance:.5},lllh:{cues:['vo-shibuichi-caught'],chance:.5}},cinematic:{cue:'vo-shibuichi-finish',lands:3.56,fromConfirm:true}},
  'rakucho':{calls:{light:'vo-rakucho-my-turn'},efforts:[],cinematic:{cue:'vo-rakucho-ultimate',lands:3.02,fromConfirm:true}},
  irbis:{calls:{special:'vo-irbis-special'},efforts:['vo-irbis-effort-c'],heavy:{cues:['vo-irbis-heavy'],chance:.5},cinematic:{cue:'vo-irbis-ultimate',lands:2.65,fromConfirm:true}},
  shidare:{calls:{light:'vo-shidare-ready'},efforts:['vo-shidare-effort-a','vo-shidare-effort-b'],heavy:{cues:['vo-shidare-finish'],chance:.6},special:{cues:['vo-shidare-refusal'],chance:.7},cinematic:{cue:'vo-shidare-finish',lands:2.8,fromConfirm:true}},
  hinomoto:{calls:{light:'vo-hinomoto-strike'},efforts:[],heavy:{cues:['vo-hinomoto-cleave'],chance:.65},special:{cues:['vo-hinomoto-flame'],chance:.8},cinematic:{cue:'vo-hinomoto-no-refunds',lands:3.14,fromConfirm:true}},
  amagoi:{calls:{light:'vo-amagoi-effort-a'},efforts:[],heavy:{cues:['vo-amagoi-cloudburst'],chance:.8},special:{cues:['vo-amagoi-calling-water'],chance:.9},enders:{lllh:{cues:['vo-amagoi-effort-b'],chance:.65}},cinematic:{cue:'vo-amagoi-ultimate',lands:3.08,fromConfirm:true}},
  'shakudo':{calls:{},efforts:['vo-shakudo-effort-tap'],heavy:{cues:['vo-shakudo-strike','vo-shakudo-effort-a'],chance:.65},special:{cues:['vo-shakudo-stay-back'],chance:.8},enders:{lllh:{cues:['vo-shakudo-no-refunds'],chance:.65}},cinematic:{cue:'vo-shakudo-transmute',lands:3.3,fromConfirm:true}},
  hikui:{calls:{},efforts:['vo-hikui-effort-a','vo-hikui-effort-b'],heavy:{cues:['vo-hikui-flame-sword'],chance:.65},special:{cues:['vo-hikui-effort-a'],chance:.75},cinematic:{cue:'vo-hikui-ultimate',lands:1.734,fromConfirm:true}},
  tokan:{calls:{},efforts:['vo-tokan-effort-a','vo-tokan-effort-b'],heavy:{cues:['vo-tokan-heel'],chance:.65},special:{cues:['vo-tokan-pheasant'],chance:.8},cinematic:{cue:'vo-tokan-winter-sleep',lands:1.15,fromConfirm:true}},
  strappado:{calls:{},efforts:['vo-strappado-effort-a','vo-strappado-effort-b'],heavy:{cues:['vo-strappado-out-of-my-way'],chance:.65},special:{cues:['vo-strappado-small-fry'],chance:.75},enders:{llls:{cues:['vo-strappado-parasite'],chance:.75}},cinematic:{cue:'vo-strappado-god-thread',lands:3.18,fromConfirm:true}},
  unari:{calls:{heavy:'vo-unari-gum'},efforts:['vo-unari-effort-a','vo-unari-effort-b','vo-unari-effort-c'],special:{cues:['vo-unari-gum'],chance:.8},cinematic:{cue:'vo-unari-encore',lands:2.89,fromConfirm:true}},
  barrow:{calls:{heavy:'vo-barrow-take-it-all'},efforts:['vo-barrow-effort-a','vo-barrow-effort-b'],special:{cues:['vo-barrow-sinkhole'],chance:.8},cinematic:{cue:'vo-barrow-liberation',lands:3.25,fromConfirm:true}},
  sashigane:{calls:{light:'vo-sashigane-cut',heavy:'vo-sashigane-ratio'},efforts:[],special:{cues:['vo-sashigane-collapse'],chance:.8},cinematic:{cue:'vo-sashigane-finish',lands:2.05,fromConfirm:true}},
  gosu:{calls:{heavy:'vo-gosu-diamond'},efforts:['vo-gosu-effort-a','vo-gosu-effort-b','vo-gosu-effort-c'],special:{cues:['vo-gosu-dora'],chance:.8},cinematic:{cue:'vo-gosu-in-range',lands:2.76,fromConfirm:true}},
  kusushi:{calls:{},efforts:['vo-kusushi-effort-a','vo-kusushi-effort-b'],heavy:{cues:['vo-kusushi-effort-c','vo-kusushi-effort-d'],chance:.65},special:{cues:['vo-kusushi-strength'],chance:.8},cinematic:{cue:'vo-kusushi-pure-land',lands:1.1,fromConfirm:true}},
  hakushi:{calls:{heavy:'vo-hakushi-senpugan'},efforts:['vo-hakushi-effort-a','vo-hakushi-effort-b'],special:{cues:['vo-hakushi-effort-b'],chance:.65},cinematic:{cue:'vo-hakushi-ultimate',lands:2.6,fromConfirm:true}},
  suzuran:{calls:{},efforts:['vo-suzuran-effort-a','vo-suzuran-effort-c'],heavy:{cues:['vo-suzuran-palm'],chance:.65},special:{cues:['vo-suzuran-vacuum'],chance:.85},cinematic:{cue:'vo-suzuran-lions',lands:1.35,fromConfirm:true}},
  wataame:{calls:{},efforts:['vo-wataame-effort-a','vo-wataame-effort-b','vo-wataame-effort-c'],special:{cues:['vo-wataame-ready'],chance:.75},cinematic:{cue:'vo-wataame-lets-go',lands:1.52,fromConfirm:true}},
  senko:{calls:{},efforts:['vo-senko-effort-a','vo-senko-effort-b','vo-senko-effort-c'],heavy:{cues:['vo-senko-finish'],chance:.65},special:{cues:['vo-senko-slow'],chance:.85},cinematic:{cue:'vo-senko-hundred-lights',lands:2.06,fromConfirm:true}},
  buna:{calls:{light:'vo-buna-lets-go',special:'vo-buna-heartshake'},efforts:['vo-buna-effort-a','vo-buna-effort-b'],heavy:{cues:['vo-buna-clear-the-way'],chance:.65},cinematic:{cue:'vo-buna-timber-the-forest-falls',lands:1.54,fromConfirm:true}},
  oyashio:{calls:{},efforts:['vo-oyashio-effort-a','vo-oyashio-effort-b','vo-oyashio-effort-c'],heavy:{cues:['vo-oyashio-karate'],chance:.55},special:{cues:['vo-oyashio-water'],chance:.85},cinematic:{cue:'vo-oyashio-vagabond',lands:1.1,fromConfirm:true}},
  // No clean Adad nonverbal bank exists: ration this speech as an opener call, never as an effort.
  adad:{calls:{light:'vo-adad-enough'},efforts:[],heavy:{cues:['vo-adad-silence'],chance:.55},special:{cues:['vo-adad-judgment'],chance:.8},cinematic:{cue:'vo-adad-firmament-fall',lands:.3,fromConfirm:true}},
  shijima:{calls:{},efforts:['vo-shijima-effort-a','vo-shijima-effort-b','vo-shijima-effort-c'],heavy:{cues:['vo-shijima-snow-halo'],chance:.7},special:{cues:['vo-shijima-hoarfrost'],chance:.85},cinematic:{cue:'vo-shijima-quip-resolve',lands:1.2,fromConfirm:true}},
  akaito:{calls:{},efforts:['vo-akaito-effort-a','vo-akaito-effort-b','vo-akaito-effort-c'],heavy:{cues:['vo-akaito-effort-d'],chance:.7},special:{cues:['vo-akaito-command'],chance:.85},cinematic:{cue:'vo-akaito-pinky-promise',lands:1.6,fromConfirm:true}},
  tempo:{calls:{},efforts:['vo-tempo-effort-a','vo-tempo-effort-b','vo-tempo-effort-c'],heavy:{cues:['vo-tempo-break'],chance:.65},special:{cues:['vo-tempo-close'],chance:.8},cinematic:{cue:'vo-tempo-all-out',lands:1.4,fromConfirm:true}},
  tancho:{calls:{},efforts:['vo-tancho-effort-a','vo-tancho-effort-b','vo-tancho-effort-c'],
    heavy:{cues:['vo-tancho-burn'],chance:.65},special:{cues:['vo-tancho-freeze'],chance:.85},
    cinematic:{cue:'vo-tancho-maximum',lands:1.65,fromConfirm:true}},
  bellows:{calls:{},efforts:['vo-bellows-effort-a','vo-bellows-effort-b','vo-bellows-effort-c'],
    heavy:{cues:['vo-bellows-flame'],chance:.6},special:{cues:['vo-bellows-spider'],chance:.8},
    cinematic:{cue:'vo-bellows-burn',lands:2.3,fromConfirm:true}},
  mikage:{calls:{},efforts:['vo-mikage-effort-a','vo-mikage-effort-b','vo-mikage-effort-c'],
    heavy:{cues:['vo-mikage-finish'],chance:.65},special:{cues:['vo-mikage-slow'],chance:.85},
    cinematic:{cue:'vo-mikage-flash',lands:2.48,fromConfirm:true}},
  // Source-bank nonverbal acting; no invented spoken technique name.
  'full-beam':{calls:{},efforts:['vo-full-beam-effort-a','vo-full-beam-effort-b'],
    heavy:{cues:['vo-full-beam-effort-c','vo-full-beam-effort-d'],chance:.65},special:{cues:['vo-full-beam-smash'],chance:.65},
    cinematic:{cue:'vo-full-beam-wrathful-guardian',lands:1.65,fromConfirm:true},
    enders:{lllh:{cues:['vo-full-beam-effort-d'],chance:.55},airSpecial:{cues:['vo-full-beam-effort-c'],chance:.5}}},
  pyroclast:{calls:{},efforts:['vo-pyroclast-effort-a','vo-pyroclast-effort-b'],
    heavy:{cues:['vo-pyroclast-effort-c','vo-pyroclast-effort-d'],chance:.65},special:{cues:['vo-pyroclast-ap-effort'],chance:.8},
    cinematic:{cue:'vo-pyroclast-howitzer-effort',lands:2.8,fromConfirm:true},
    enders:{lllh:{cues:['vo-pyroclast-effort-d'],chance:.55},airSpecial:{cues:['vo-pyroclast-effort-c'],chance:.5}}},
  ampere:{calls:{},efforts:['vo-ampere-effort-c','vo-ampere-effort-d'],
    heavy:{cues:['vo-ampere-effort-a','vo-ampere-effort-b'],chance:.65},special:{cues:['vo-ampere-air-force-effort'],chance:.8},
    cinematic:{cue:'vo-ampere-plus-ultra',lands:1.6,fromConfirm:true},
    enders:{lllh:{cues:['vo-ampere-effort-a'],chance:.55},airSpecial:{cues:['vo-ampere-effort-c'],chance:.5}}},
  shanxiao:{calls:{},efforts:['vo-shanxiao-effort-a','vo-shanxiao-effort-b','vo-shanxiao-effort-c'],
    heavy:{cues:['vo-shanxiao-effort-d'],chance:.7},special:{cues:['vo-shanxiao-eraser-effort'],chance:.85},
    cinematic:{cue:'vo-shanxiao-sun-chaser',lands:.55,fromConfirm:true},
    enders:{lllh:{cues:['vo-shanxiao-effort-d'],chance:.55},airSpecial:{cues:['vo-shanxiao-effort-c'],chance:.6}}},
  kuzu:{calls:{},efforts:['vo-kuzu-effort-a','vo-kuzu-effort-b','vo-kuzu-effort-c'],
    heavy:{cues:['vo-kuzu-die','vo-kuzu-effort-b'],chance:.7},special:{cues:['vo-kuzu-dont-run'],chance:.8},
    cinematic:{cue:'vo-kuzu-engine',lands:1.2,fromConfirm:true},
    enders:{lllh:{cues:['vo-kuzu-hurts'],chance:.5},airSpecial:{cues:['vo-kuzu-effort-c'],chance:.65}}},
  shakugo:{calls:{special:'vo-shakugo-crimson-hound'},efforts:['vo-shakugo-effort-b','vo-shakugo-effort-c'],
    heavy:{cues:['vo-shakugo-effort-a','vo-shakugo-effort-c'],chance:.7},
    cinematic:{cue:'vo-shakugo-final-sentence-brimstone-rain',lands:1.65,fromConfirm:true},
    enders:{lllh:{cues:['vo-shakugo-effort-a'],chance:.55},airSpecial:{cues:['vo-shakugo-effort-c'],chance:.6}}},
  // The native Thorn Kiss name is limited to occasional string openers.
  // Both longer Perfume calls remain held; no uncertain technique call is mapped.
  'basilissa':{calls:{light:'vo-basilissa-thorn-kiss',special:'vo-basilissa-sandrose-volley'},
    efforts:['vo-basilissa-effort-a'], heavy:{cues:['vo-basilissa-effort-a'],chance:.65},
    cinematic:{cue:'vo-basilissa-where-looking',lands:.85,fromConfirm:true},
    enders:{lllh:{cues:['vo-basilissa-effort-a'],chance:.45},airSpecial:{cues:['vo-basilissa-effort-a'],chance:.45}}},
  // Sorayomi's own short efforts; the recorded electrical-release quote is only
  // heard on a confirmed thunder ultimate. No Zeus or invented technique calls.
  sorayomi:{calls:{},efforts:['vo-sorayomi-effort-a','vo-sorayomi-effort-b','vo-sorayomi-effort-c','vo-sorayomi-effort-d'],
    heavy:{cues:['vo-sorayomi-effort-b','vo-sorayomi-effort-d']},
    special:{cues:['vo-sorayomi-effort-c','vo-sorayomi-effort-d'],chance:.85},
    cinematic:{cue:'vo-sorayomi-discharge',lands:1.15,fromConfirm:true},
    enders:{llh:{cues:['vo-sorayomi-effort-a','vo-sorayomi-effort-b'],chance:.6},
      lllh:{cues:['vo-sorayomi-effort-b','vo-sorayomi-effort-d'],chance:.6},
      airSpecial:{cues:['vo-sorayomi-effort-d'],chance:.65}}},
  // Strix speaks his own battle quotes, not invented names for his sword techniques.
  strix:{calls:{special:'vo-strix-bearpaw-cut'},
    cinematic:{cue:'vo-strix-surpass-blade',lands:1.35,fromConfirm:true},
    efforts:['vo-strix-effort-a','vo-strix-effort-b','vo-strix-effort-c','vo-strix-effort-d'],
    heavy:{cues:['vo-strix-effort-c','vo-strix-effort-d']},
    enders:{lllh:{cues:['vo-strix-effort-c','vo-strix-effort-d'],chance:.55},airSpecial:{cues:['vo-strix-effort-d'],chance:.6}}},
  // The Sunpalm Cannon, its "HA" 0.99 s into the line: on the beam when
  // the beam came at 1.35 s; since round 3d's 0.75 a quarter second into it,
  // as soon as the line can say it. MOVES' Cloudstep kick gets his
  // lotus-breath on the kick.
  taisei: { calls: { special: 'vo-taisei-sunpalm-cannon', ultimate: 'taisei-spirit' }, efforts: ['vo-taisei-ha', 'vo-taisei-ya', 'vo-taisei-fun'],
    heavy: { cues: ['vo-taisei-harya', 'vo-taisei-orya'] }, delays: { special: onRelease('taisei', 'special', .99) },
    enders: { lllh: { cues: ['vo-taisei-orya', 'vo-taisei-harya'], chance: .55 }, airSpecial: { cues: ['vo-taisei-harya'], chance: .6 } } },
  // The Gale: its "hō" is 0.75 s into the line.
  ouga: { calls: { heavy: 'vo-ouga-big-bang', special: 'vo-ouga-gale', ultimate: 'vo-ouga-kyokko-ho' },
    efforts: ['vo-ouga-ha', 'vo-ouga-da', 'vo-ouga-fun'], delays: { special: onRelease('ouga', 'special', .75) },
    // The scoff with Coronation; a cry as the Pride Burst goes off round him.
    enders: { llh: { cues: ['vo-ouga-fun'], chance: .5 }, airSpecial: { cues: ['vo-ouga-ha', 'vo-ouga-da'], chance: .6 } } },
  konta: { calls: { heavy: 'konta-senpugan', special: 'konta-galewheel', ultimate: 'vo-konta-fox-bomb' },
    efforts: ['vo-konta-ura', 'vo-konta-ha', 'vo-konta-yo'],
    // Never "Senpugan!" over a Big Ball or a Planetary one: his cries, not his heavy's call.
    enders: { llh: { cues: ['vo-konta-ura'], chance: .5 }, airSpecial: { cues: ['vo-konta-ura', 'vo-konta-ha'], chance: .6 } } },
  shiden: { calls: { heavy: 'vo-shiden-shrike-bolt', special: 'vo-shiden-black-pyre' }, efforts: ['vo-shiden-ei', 'vo-shiden-ya', 'vo-shiden-fu'],
    enders: { lllh: { cues: ['vo-shiden-ei'], chance: .5 }, airSpecial: { cues: ['vo-shiden-ya', 'vo-shiden-ei'], chance: .6 } } },
  shirokane: { calls: { heavy: 'vo-shirokane-lightning-cut', special: 'vo-shirokane-lightning-twin', ultimate: 'vo-shirokane-void-sickle-lightning-cut' },
    efforts: ['vo-shirokane-seya', 'vo-shirokane-ti', 'vo-shirokane-fun'],
    enders: { llh: { cues: ['vo-shirokane-seya'], chance: .5 }, airSpecial: { cues: ['vo-shirokane-ti', 'vo-shirokane-seya'], chance: .6 } } },
  gummy: { calls: { light: 'gummy-pistol', heavy: 'vo-gummy-bazooka', special: 'vo-gummy-sunset-barrage', ultimate: 'vo-gummy-rubber-no' },
    delays: { heavy: onRelease('gummy', 'heavy', .39), special: onRelease('gummy', 'special', .44) },
    efforts: ['vo-gummy-yo', 'vo-gummy-ho', 'vo-gummy-da'], cinematic: { cue: 'vo-gummy-grand-tide', lands: .82, fromConfirm: true },
    enders: { llh: { cues: ['vo-gummy-da', 'vo-gummy-yo'], chance: .5 }, airSpecial: { cues: ['vo-gummy-ho', 'vo-gummy-da'], chance: .6 } } },
  kenzo: { calls: { light: 'vo-kenzo-crossing', heavy: 'vo-kenzo-lion-cut', special: 'kenzo-phoenix', ultimate: 'kenzo-world' },
    efforts: ['vo-kenzo-fun', 'vo-kenzo-ura', 'vo-kenzo-fu'],
    enders: { lllh: { cues: ['vo-kenzo-ura'], chance: .45 }, airSpecial: { cues: ['vo-kenzo-fu', 'vo-kenzo-ura'], chance: .55 } } },
  kosho: { calls: { heavy: 'vo-kosho-hachoir', special: 'vo-kosho-ram', ultimate: 'vo-kosho-banquet-infernal' },
    efforts: ['vo-kosho-tei', 'vo-kosho-sea', 'vo-kosho-fun'],
    enders: { lllh: { cues: ['vo-kosho-tei'], chance: .5 }, airSpecial: { cues: ['vo-kosho-sea', 'vo-kosho-tei'], chance: .6 } } },
  // ASHSTEP is footwork, not a Unsealed transformation. A familiar line attached
  // to the wrong action misidentifies the technique.
  // Round 3d: NIGHTFALL is said with the black wave, the opener at .5 - the
  // call at the cast.
  nigo: { calls: { special: 'vo-nigo-nightfang', ultimate: 'nigo-nightfall' }, efforts: ['vo-nigo-fu', 'vo-nigo-ha', 'vo-nigo-da'],
    // The Grand Nightfang is not called by his special's "Scorched Earth": a cry as it comes down.
    enders: { lllh: { cues: ['vo-nigo-da', 'vo-nigo-ha'], chance: .5 }, airSpecial: { cues: ['vo-nigo-ha', 'vo-nigo-da'], chance: .6 } } },
  kagari: { calls: { light: 'kagari-hinoko', heavy: 'kagari-yuragi', special: 'vo-kagari-taimatsu', ultimate: 'vo-kagari-taiyou-dama' }, efforts: ['vo-kagari-yo', 'vo-kagari-orya', 'vo-kagari-do'],
    enders: { llh: { cues: ['vo-kagari-orya'], chance: .5 }, airSpecial: { cues: ['vo-kagari-do', 'vo-kagari-orya'], chance: .6 } } },
  // Round 3d: ROOM at the cast; "Counter Shock" inside the cinematic.
  ward: { calls: { heavy: 'ward-stat-shot', special: 'ward-cautery-blade', ultimate: 'vo-ward-room' }, efforts: ['vo-ward-fun', 'vo-ward-se', 'vo-ward-che'],
    cinematic: { cue: 'ward-counter-shock', lands: 1.2 },
    // "ROOM" before Mes, as he opens it before every operation; a breath with Biopsy Strike.
    enders: { llls: { cues: ['vo-ward-room'], chance: .5 }, airSpecial: { cues: ['vo-ward-che', 'vo-ward-se'], chance: .55 } } },
  kuon: { calls: { heavy: 'kuon-ao', special: 'kuon-violet', ultimate: 'kuon-boundless' }, efforts: ['vo-kuon-ha', 'vo-kuon-ya', 'vo-kuon-fu'],
    enders: { lllh: { cues: ['vo-kuon-ya'], chance: .5 }, airSpecial: { cues: ['vo-kuon-ha', 'vo-kuon-ya'], chance: .6 } } },
  // The two spirit fighters' lights are their battle cries, rationed as efforts;
  // their specials and ultimates are scheduled by stand().
  koko: { calls: { heavy: 'vo-koko-needle-finger', special: 'koko-star', ultimate: 'vo-koko-the-hour' },
    efforts: ['vo-koko-ora-1', 'vo-koko-ora-2', 'vo-koko-ora-4', 'vo-koko-fun'],
    barrage: 'vo-koko-ora-barrage', finisher: { cue: 'vo-koko-gaaan', lands: .15 },
    // Iron Spirit's GAN on the receipt's last blow and on the grave-hound barrage's.
    enders: { llh: { cues: ['vo-koko-gaaan'], chance: .55 }, airSpecial: { cues: ['vo-koko-ora-4', 'vo-koko-ora-2'], chance: .65 } } },
  oro: { calls: { heavy: 'vo-oro-ukete', ultimate: 'vo-oro-the-hour' }, efforts: ['vo-oro-noroma', 'vo-oro-wasted', 'vo-oro-fun', 'vo-oro-fun-2'],
    barrage: 'vo-oro-noroma-barrage', finisher: { cue: 'oro-steamroller', lands: 1.8 },
    // HUSH's GILDED PUNCH on its blow from behind; his scoff as the knives close in.
    enders: { lllh: { cues: ['vo-oro-wasted', 'vo-oro-noroma'], chance: .55 }, airSpecial: { cues: ['vo-oro-fun'], chance: .5 } } },
  gaunt: { calls: { special: 'vo-gaunt-kurai', ultimate: 'vo-gaunt-roar' }, efforts: ['vo-gaunt-ha', 'vo-gaunt-fu', 'vo-gaunt-sei', 'vo-gaunt-da'],
    heavy: { cues: ['vo-gaunt-dora', 'vo-gaunt-gah'] },
    enders: { lllh: { cues: ['vo-gaunt-gah', 'vo-gaunt-sei'], chance: .5 }, airSpecial: { cues: ['vo-gaunt-sei', 'vo-gaunt-ha'], chance: .6 } } },
  // Round 3d: Kanmuru at the cast; "Shippū Jinrai" inside the cinematic.
  setsu: { calls: { special: 'setsu-ikazuchi', ultimate: 'vo-setsu-thundercrown' }, efforts: ['vo-setsu-ha', 'vo-setsu-ta', 'vo-setsu-deya'],
    cinematic: { cue: 'setsu-gale-step', lands: 1.3 },
    enders: { llls: { cues: ['vo-setsu-ta'], chance: .45 }, airSpecial: { cues: ['vo-setsu-deya', 'vo-setsu-ha'], chance: .6 } } },
  gorai: { calls: { light: 'vo-gorai-ora', ultimate: 'vo-gorai-thunder-sign' }, efforts: ['vo-gorai-effort-a', 'vo-gorai-effort-b', 'vo-gorai-effort-c'],
    enders: { lllh: { cues: ['vo-gorai-laugh'], chance: .5 } } },
  haldor: { calls: { ultimate: 'vo-haldor-lets-go' }, efforts: ['vo-haldor-effort-a', 'vo-haldor-effort-b', 'vo-haldor-effort-c'],
    enders: { lllh: { cues: ['vo-haldor-laugh'], chance: .5 } } },
  // Sorrel and Dorado name their Horizon Sunder as they draw it, in their home lines: "HORIZON SUNDER". Between blows,
  // their own cries (3 October).
  sorrel: { calls: { ultimate: 'vo-sorrel-horizon-sunder' }, efforts: ['vo-sorrel-effort-a', 'vo-sorrel-effort-b', 'vo-sorrel-effort-c', 'vo-sorrel-effort-d'] },
  dorado: { calls: { ultimate: 'vo-dorado-horizon-sunder' }, efforts: ['vo-dorado-effort-a', 'vo-dorado-effort-b', 'vo-dorado-effort-c', 'vo-dorado-effort-d'] },
  // Shiun in the survival boss's own voice: the spells called, "weak" opening a string now and then, and between blows
  // his own cries.
  shiun: { calls: { light: 'vo-shiun-weak', special: 'vo-shiun-senju', ultimate: 'vo-shiun-black-confessional' },
    efforts: ['vo-shiun-effort-a', 'vo-shiun-effort-b', 'vo-shiun-effort-c', 'vo-shiun-effort-d'] },
  // Magatsu in the survival boss's own voice: his heavy, his special and Calamity Pyre called, a click of the tongue
  // opening a string now and then, and between blows his own cries.
  // (Mirror Mere is his ultimate, a field as Kuon's is, called by name as Kuon's is.)
  magatsu: { calls: { light: 'vo-magatsu-tch', heavy: 'vo-magatsu-hachi', special: 'vo-magatsu-kai', ultimate: 'vo-magatsu-domain' },
    efforts: ['vo-magatsu-effort-a', 'vo-magatsu-effort-b', 'vo-magatsu-effort-c', 'vo-magatsu-effort-d'],
    enders: { airSpecial: { cues: ['vo-magatsu-calamity-pyre'], chance: .7 } } },
  // Vesper in the survival boss's own voice: "I won't allow it" as he dives, "you are mine" as the offering takes
  // them; between blows, his own cries.
  vesper: { calls: { special: 'vo-vesper-wont-allow', ultimate: 'vo-vesper-mine' },
    efforts: ['vo-vesper-effort-a', 'vo-vesper-effort-b', 'vo-vesper-effort-c', 'vo-vesper-effort-d'] },
  // Imago in the survival boss's own voice: "prepare yourself" on the Stinger Lash, "vanish" as the tail storms round
  // him, "I'll finish you" on the Decree, "I can read it" opening a string now and then, and his own cries between
  // blows.
  imago: { calls: { light: 'vo-imago-i-can-read', heavy: 'vo-imago-prepare', special: 'vo-imago-vanish', ultimate: 'vo-imago-finish' },
    efforts: ['vo-imago-effort-a', 'vo-imago-effort-b', 'vo-imago-effort-c', 'vo-imago-effort-d'] },
  // Wuming in the survival boss's own voice: "I'll finish you in an instant" as he goes, the Lightless Cannon's call as
  // he draws it, "receive your retribution" as the scythe comes down, and "dame da" as a string's knockdown lands;
  // between blows, his own cries.
  'wuming': { calls: { heavy: 'vo-wuming-instant', special: 'vo-taisei-lightless-cannon', ultimate: 'vo-wuming-retribution' },
    efforts: ['vo-wuming-effort-a', 'vo-wuming-effort-b', 'vo-wuming-effort-c', 'vo-wuming-effort-d'],
    enders: { lllh: { cues: ['vo-wuming-finish'], chance: .6 } } },
  // Jirenga in the survival boss's own voice: "vanish" with Vermilion Seal, "I'll end this" on the WRATHFUL GUARDIAN
  // Fist, and "fall" as a string's knockdown lands; between blows, his own cries.
  jirenga: { calls: { special: 'vo-jirenga-vanish', ultimate: 'vo-jirenga-finish' }, efforts: ['vo-jirenga-effort-a', 'vo-jirenga-effort-b', 'vo-jirenga-effort-c', 'vo-jirenga-effort-d'],
    enders: { lllh: { cues: ['vo-jirenga-fall'], chance: .7 } } },
  // Emperor Jinlin in the survival boss's own voice: his laugh as the needle rays go, and "it's over" with the Drowned
  // Sun; between blows, his own cries.
  'jinlin': { calls: { special: 'vo-jinlin-laugh', ultimate: 'vo-jinlin-over' },
    efforts: ['vo-jinlin-effort-a', 'vo-jinlin-effort-b', 'vo-jinlin-effort-c', 'vo-jinlin-effort-d'],
    enders: { llls: { cues: ['vo-jinlin-die'], chance: .6 }, llh: { cues: ['vo-jinlin-vanish'], chance: .5 } } },
  // Gohaku and Ippon have no survival boss: their lines are their home screen's (public/assets/audio/home/manifest.json).
  // Gohaku calls the Sun-Seizing Spiral as he casts it. Ippon says "Serious Series" as he gets serious, and "Clean Slate"
  // inside the cinematic, its "punch" (0.8 s into the cut) on the blow. Between blows (3 October), their own cries.
  'gohaku': { calls: { ultimate: 'vo-gohaku-piercing-beam' }, efforts: ['vo-gohaku-effort-a', 'vo-gohaku-effort-b', 'vo-gohaku-effort-c', 'vo-gohaku-effort-d'] },
  ippon: { calls: {}, efforts: ['vo-ippon-effort-a', 'vo-ippon-effort-b', 'vo-ippon-effort-c', 'vo-ippon-effort-d'], cinematic: { cue: 'vo-ippon-clean-slate', lands: .8, fromConfirm: true } },
  // Sekka, from his home line: "Unmaking satsu: rashin" (Gravedigger: Compass Needle) with the Compass Needle, and
  // "Jutsushiki tenkai" (Technique Development) as he wakes. His own cries between blows (3 October).
  sekka: { calls: {}, efforts: ['vo-sekka-effort-a', 'vo-sekka-effort-b', 'vo-sekka-effort-c', 'vo-sekka-effort-d'],
    // "Unmaking satsu: rashin" goes with the Compass Needle's snowflake, which opens under his stun now (combosShop.ts).
    enders: { llls: { cues: ['vo-sekka-compass-needle'], chance: .8 } } },
  // Tobari, from his home line: "Sono genjitsu wa maboroshi kamo shirenai" (That reality might be an illusion) inside
  // Red Moon Reverie, said from the moment it catches them so that "maboroshi" (1.2 s into the cut) meets the finisher.
  // Between blows, his own battle cries (3 October).
  tobari: { calls: {}, efforts: ['vo-tobari-effort-a', 'vo-tobari-effort-b', 'vo-tobari-effort-c', 'vo-tobari-effort-d'], cinematic: { cue: 'vo-tobari-illusion', lands: 1.2, fromConfirm: true } },
  // The sixth wave, from their home lines. Akagane inside Heaven's Anvil: "What will you do about the second one?", its
  // question on the meteor. Asahi: "Lantern Rite: First Light!" inside it, the rite's name on the cut.
  // Rook: "Rise" as the shadows rise. Levin says his as he wakes.
  // Akagane names the Cinder Art: Burning Sea as he breathes it, his survival boss's line. Between blows, his own
  // battle cries, as Tobari's are (5 October; his first set had no clean one).
  akagane: { calls: { special: 'vo-akagane-great-fire' }, efforts: ['vo-akagane-effort-a', 'vo-akagane-effort-b', 'vo-akagane-effort-c', 'vo-akagane-effort-d'],
    cinematic: { cue: 'vo-akagane-second', lands: 1.4, fromConfirm: true },
    enders: { lllh: { cues: ['vo-akagane-its-over'], chance: .6 }, airSpecial: { cues: ['vo-akagane-shatter'], chance: .7 } } },
  asahi: { calls: {}, efforts: ['vo-asahi-effort-a', 'vo-asahi-effort-b', 'vo-asahi-effort-c', 'vo-asahi-effort-d'], cinematic: { cue: 'vo-asahi-sun-dance', lands: 1.1, fromConfirm: true } },
  levin: { calls: {}, efforts: ['vo-levin-effort-a', 'vo-levin-effort-b', 'vo-levin-effort-c', 'vo-levin-effort-d'] },
  'rook': { calls: {}, efforts: ['vo-rook-effort-a', 'vo-rook-effort-b', 'vo-rook-effort-c'],
    cinematic: { cue: 'vo-rook-arise', lands: .4, fromConfirm: true } },
  // Gaku, from his home line, inside Landslide: the move's last syllable (1.38 s into the cut) on the blow. Between
  // blows, his own cries (3 October).
  gaku: { calls: {}, efforts: ['vo-gaku-effort-a', 'vo-gaku-effort-b', 'vo-gaku-effort-c', 'vo-gaku-effort-d'], cinematic: { cue: 'vo-gaku-rock-paper', lands: 1.38, fromConfirm: true } },
};
/** Awakened Konta is the fox, with his own voice. kurobi-bite, which the
 *  fox's light used to play, holds no voice at all (Demucs: +50 dB of effect
 *  over voice) - it is a bite sound, not a line - so his light is silent on
 *  the voice bus and the SFX half keeps whatever it wants of it. */
const KUROBI: VoiceKit = { calls: { heavy: 'kurobi-taunt', special: 'kurobi-growl', ultimate: 'kurobi-growl' }, efforts: [] };
/** Round 5 (GUMMY): calls that name a move the awakened form does not throw, swapped for what it says instead. SUNRISE's
 *  Q is the Dawn Gatling, not the 'SUNSET BARRAGE': his cry, as round 4b had it on both. */
const FORM_CALLS: Partial<Record<FighterId, Partial<Record<AttackSlot, AudioCue>>>> = { gummy: { special: 'vo-gummy-yo' } };

const LEVEL = -16.5;
const MEASURED: Partial<Record<AudioCue, number>> = {
  'taisei-sunpalm-cannon-full': -14.6, 'taisei-spirit': -11.3, 'ouga-gale': -16.6, 'konta-senpugan': -8.8,
  'konta-galewheel': -11.3, 'kurobi-link': -19.1, 'kurobi-taunt': -19.7, 'kurobi-growl': -21.5,
  'gummy-pistol': -17.7, 'gummy-bazooka': -17.4, 'gummy-grand-tide-fist': -15.8, 'kenzo-crossing': -16.3,
  'kenzo-phoenix': -16.8, 'kenzo-world': -15.4, 'koko-star': -16.7,
  'koko-world': -17.0, 'nigo-nightfall': -12.6, 'kagari-hinoko': -20.7, 'kagari-yuragi': -16.6,
  'ward-stat-shot': -14.1, 'ward-cautery-blade': -17.3, 'ward-counter-shock': -18.0, 'kuon-ao': -16.8,
  'kuon-violet': -13.5, 'kuon-boundless': -13.2, 'oro-steamroller': -18.8, 'gaunt-scream': -19.1,
  'setsu-ikazuchi': -16.8, 'setsu-gale-step': -15.3,
};
function levelled(cue: AudioCue, gain: number) {
  const measured = MEASURED[cue];
  if (measured === undefined || Math.abs(LEVEL - measured) <= 1.5) return gain;
  return +(gain * 10 ** ((LEVEL - measured) / 20)).toFixed(3);
}

/** How far each slot's call may push past another speaker. */
const PRIORITY: Record<AttackSlot, number> = { light: 0, heavy: 0, special: 1, ultimate: 2, area: 1 };
/** Taisei's Golden Form line (4.6 s) runs on well past the 0.9 s entry, and a released line keeps out every later line of
 *  its speaker at or under its own priority (CombatAudio.play). Between his efforts (0) and his calls (1): no effort cuts
 *  in on it or keeps it out, and his calls - the Sunpalm Cannon, the LAST SUN - still speak over it, which ducks it. A
 *  Sunpalm Cannon call still ringing as he awakens (it outlasts the move by 0.44 s) keeps it out. */
export const SUPER_LINE_PRIORITY = .5;
/** Ouga's heavy is a named call, "ビッグバンアタック!", at a heavy's priority (0): under his Super Ouga line, which
 *  would keep it out for the line's 2.8 s - and level with his own efforts, a ringing one of which kept it out too. It
 *  goes out over both, still under his Shikou-Ha (1) and his Kyokko-Ho (2). */
export const BIG_BANG_PRIORITY = .75;
/** (The overnight pass, 9 October) The awakening lines named after the burst (awakeningLines.ts) are released at
 *  SUPER_LINE_PRIORITY too, so a named heavy call - Kenzo's Lion Cut, Gummy's Bazooka - would be kept out for the
 *  line's length as Ouga's Big Bang was. Awakened, the heavy call of a fighter with such a line goes out at Big Bang's
 *  priority, over the line (ducking it) and still under the special and the ultimate; in the base form it is as it was.
 *  Efforts, a light's callout and a heavy's cries stay under the line and do not cut it. */
export const AWAKENED_HEAVY_PRIORITY = BIG_BANG_PRIORITY;

// --- what each fighter has said -------------------------------------------

interface Memory {
  /** The latest server time planned for this fighter. */
  seen: number;
  /** When the named light callout last played, and until when it is spoken. */
  calledAt: number;
  quietUntil: number;
  /** The previous light cast: when, and whether it carried an effort. */
  lightAt: number;
  effortOnLight: boolean;
  lastEffort?: AudioCue;
  lastHeavy?: AudioCue;
  lastSpecial?: AudioCue;
  /** Casts already planned, so a cast planned twice is voiced the same. */
  decided: Map<string, CueLayer[]>;
  /** The voice situations (planReaction): when each kind last spoke for this fighter, when a perfect guard was last
   *  rolled for (said or not), whether this life's low-health line has had its moment, when each line was last said and
   *  which one each kind said last; and the events already answered, kept apart from the casts' so that a flurry of hits
   *  never pushes a cast's decision out. */
  spokeAt: Partial<Record<VoiceSituation, number>>;
  parryTried: number;
  lowSaid: boolean;
  saidAt: Map<SituationLine, number>;
  lastLine: Partial<Record<VoiceSituation, SituationLine>>;
  reacted: Map<string, CueLayer[]>;
}
const memories = new Map<string, Memory>();

function memoryOf(actorId: string, at: number): Memory {
  let memory = memories.get(actorId);
  if (!memory || at < memory.seen - REWIND)
    memory = { seen: at, calledAt: -Infinity, quietUntil: -Infinity, lightAt: -Infinity, effortOnLight: false, decided: new Map(),
      spokeAt: {}, parryTried: -Infinity, lowSaid: false, saidAt: new Map(), lastLine: {}, reacted: new Map() };
  // Most recently heard last, so the first entry is the one to forget.
  memories.delete(actorId); memories.set(actorId, memory);
  if (memories.size > REMEMBERED) memories.delete(memories.keys().next().value!);
  memory.seen = Math.max(memory.seen, at);
  return memory;
}
function decide(memory: Memory, key: string, layers: CueLayer[]) {
  memory.decided.set(key, layers);
  if (memory.decided.size > DECISIONS) memory.decided.delete(memory.decided.keys().next().value!);
  return layers;
}

/** Forget every fighter. For tests: a new match needs no reset (see above). */
export function resetVoiceMemory() { memories.clear(); }

/** One cast of one slot, as both copies of it (predicted and authoritative) name it. */
const castKey = (event: CombatEvent) => `${event.actionSeq ?? `#${event.id}`}:${event.slot}:${event.chain ?? 0}:${event.fighter}`;

/** A deterministic roll in [0, 1) from a fighter, a cast and a purpose. */
export function voiceRoll(actorId: string, key: string, purpose: number): number {
  let h = (0x811c9dc5 ^ Math.imul(purpose, 0x9e3779b1)) >>> 0;
  const text = `${actorId}|${key}`;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  // A final avalanche: FNV alone leaves neighbouring sequence numbers close.
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** One of `cues`, never `last` when there is another to choose. */
function rotate(cues: readonly AudioCue[], roll: number, last?: AudioCue): AudioCue {
  let index = Math.min(cues.length - 1, Math.floor(roll * cues.length));
  if (cues.length > 1 && cues[index] === last) index = (index + 1) % cues.length;
  return cues[index];
}

const voice = (cue: AudioCue, gain: number, voicePriority: number, delay = 0, extra: Partial<CueLayer> = {}): CueLayer =>
  ({ cue, bus: 'voice', gain: levelled(cue, gain), voicePriority, phase: 'cast', ...(delay > 0 ? { delay } : {}), ...extra });

// --- the voice situations ---------------------------------------------------

/** Who is in an event, which the event itself does not say: the body each side is playing (a borrowed move's event names
 *  the move's fighter, never the thrower's body) and how much of the target's health is left, 0 to 1. CombatAudio reads
 *  them off the players it is shown - the roster's fighters only: an enemy of the Rift is nobody here, whatever fighter its
 *  event carries - and without them a reaction has nobody to speak and plans nothing. */
export interface VoiceScene { actor?: FighterId; target?: FighterId; targetHealth?: number }

const REACTIONS = new Set<CombatEvent['kind']>(['hit', 'wall-splat', 'ground-bounce', 'eliminated', 'just-guard', 'vanish', 'dodge', 'respawn']);
/** The reactions a body is thrown by: the heavier cry. */
const THROWN = new Set<ReactionKind>(['launched', 'knockdown', 'splat']);
/** A perfect guard and the vanish out of it are one moment, and a multi-hit move dodged is one dodge: a second roll
 *  inside this of the first is not made. */
const PARRY_ONCE = .5;

/** One line of a kind for a fighter, or none: the kind is resting, the roll said no, or every line it has was said too
 *  recently. What is said is remembered against the server clock, as a cast's voice is. `share` scales the chance. */
function speak(memory: Memory, kind: VoiceSituation, fighter: FighterId, speaker: string, event: CombatEvent, share = 1): CueLayer[] {
  const rule = SITUATION_RULES[kind], at = event.serverTime;
  if (at - (memory.spokeAt[kind] ?? -Infinity) < rule.rest) return [];
  if (rule.chance * share < 1 && voiceRoll(speaker, `r${event.id}:${kind}`, 6) >= rule.chance * share) return [];
  const fresh = situationLines(fighter, kind).filter(line => at - (memory.saidAt.get(line) ?? -Infinity) >= rule.again);
  if (!fresh.length) return [];
  const last = memory.lastLine[kind];
  let index = Math.min(fresh.length - 1, Math.floor(voiceRoll(speaker, `r${event.id}:${kind}`, 7) * fresh.length));
  if (fresh.length > 1 && fresh[index] === last) index = (index + 1) % fresh.length;
  const line = fresh[index];
  memory.spokeAt[kind] = at; memory.saidAt.set(line, at); memory.lastLine[kind] = line;
  // (A cast's own voice is planned exactly as it was before the situations: a line here never keeps an effort or a call
  // from being planned - the plan cannot know the mixer played the line - and the speaker's next move line cuts it.)
  return [situationLayer(kind, line, speaker)];
}

/** What the bodies in an event say about it. Planned once per event and fighter, on the server's clock, from rolls both
 *  copies of the event share - so every client makes the same call, and an event planned twice is answered the same.
 *
 *  - **hit**: the body hit. Its `low` line the first time its health is at LOW_HEALTH or under in this life; else a cry -
 *    the heavier one when the blow threw it (launched, knockdown, splat) - rationed (SITUATION_RULES). A cry of either
 *    weight rests both: a launch and the wall it meets are one cry.
 *  - **wall-splat, ground-bounce**: the body thrown, a heavier cry under the same rest.
 *  - **eliminated**: the victim's cry, always; then the killer's line (never for a fall nobody scored).
 *  - **just-guard, vanish, dodge**: the one who read the blow.
 *  - **respawn**: a new life: the low-health moment is armed again.
 *  Nothing here cuts a move's call: every line but the knockout cry yields (CueLayer.yields), and the mixer drops a line
 *  that cannot be said at its moment - never plays it late. */
export function planReaction(event: CombatEvent, scene: VoiceScene = {}): CueLayer[] {
  const at = event.serverTime, key = `${event.kind}#${event.id}`;
  const answer = (id: string, plan: (memory: Memory) => CueLayer[]): CueLayer[] => {
    const memory = memoryOf(id, at), known = memory.reacted.get(key);
    if (known) return known;
    const layers = plan(memory);
    memory.reacted.set(key, layers);
    if (memory.reacted.size > DECISIONS) memory.reacted.delete(memory.reacted.keys().next().value!);
    return layers;
  };
  const actor = scene.actor, target = scene.target, targetId = event.targetId;
  switch (event.kind) {
    case 'respawn': memoryOf(event.actorId, at).lowSaid = false; return [];
    case 'hit': {
      if (!target || !targetId || targetId === event.actorId) return [];
      return answer(targetId, memory => {
        const health = scene.targetHealth;
        if (health !== undefined && health <= 0) return []; // The knockout's cry is the 'eliminated' event's.
        if (health !== undefined && health > LOW_REARM) memory.lowSaid = false;
        if (memory.lowSaid && at - (memory.spokeAt.low ?? -Infinity) >= LOW_AGAIN) memory.lowSaid = false;
        if (health !== undefined && health <= LOW_HEALTH && !memory.lowSaid) {
          memory.lowSaid = true;
          const line = speak(memory, 'low', target, targetId, event);
          if (line.length) return line;
        }
        return cry(memory, event.reaction && THROWN.has(event.reaction) ? 'hurt-heavy' : 'hurt', target, targetId, event);
      });
    }
    case 'wall-splat': case 'ground-bounce': {
      return actor ? answer(event.actorId, memory => cry(memory, 'hurt-heavy', actor, event.actorId, event)) : [];
    }
    case 'eliminated': {
      const layers: CueLayer[] = [];
      if (target && targetId) layers.push(...answer(targetId, memory => { memory.lowSaid = false; return speak(memory, 'ko', target, targetId, event); }));
      if (actor && event.actorId && event.actorId !== targetId) layers.push(...answer(event.actorId, memory => speak(memory, 'kill', actor, event.actorId, event)));
      return layers;
    }
    case 'just-guard': case 'dodge': return target && targetId ? answer(targetId, memory => parry(memory, target, targetId, event, event.kind === 'dodge' ? DODGE_SHARE : 1)) : [];
    case 'vanish': return actor ? answer(event.actorId, memory => parry(memory, actor, event.actorId, event, 1)) : [];
    default: return [];
  }
}
/** A cry of either weight: the lighter rests under the heavier's last, and a heavier one rests both. */
function cry(memory: Memory, kind: 'hurt' | 'hurt-heavy', fighter: FighterId, speaker: string, event: CombatEvent): CueLayer[] {
  const at = event.serverTime, last = Math.max(memory.spokeAt.hurt ?? -Infinity, memory.spokeAt['hurt-heavy'] ?? -Infinity);
  if (at - last < SITUATION_RULES.hurt.rest) return [];
  const layers = speak(memory, kind, fighter, speaker, event);
  if (layers.length && kind === 'hurt-heavy') memory.spokeAt.hurt = at;
  return layers;
}
/** A blow read: one roll a moment (PARRY_ONCE), whichever event of it comes first. */
function parry(memory: Memory, fighter: FighterId, speaker: string, event: CombatEvent, share: number): CueLayer[] {
  if (event.serverTime - memory.parryTried < PARRY_ONCE) return [];
  memory.parryTried = event.serverTime;
  return speak(memory, 'parry', fighter, speaker, event, share);
}

// --- the plan ---------------------------------------------------------------

export function planVoice(event: CombatEvent, awakened = false, scene?: VoiceScene): CueLayer[] {
  const fighter = event.fighter, slot = event.slot;
  // The voice situations: what a body says when it is acted on (planReaction, below).
  if (REACTIONS.has(event.kind)) return planReaction(event, scene);
  if (event.kind === 'awaken') {
    // Said from the event: the fox answering Konta, and Gaunt' scream as the
    // HOUND ARMOR takes him.
    if (fighter === 'konta') return [voice('kurobi-link', .9, 2)];
    if (fighter === 'gaunt') return [voice('gaunt-scream', .9, 1, .1)];
    // The two captains laugh as they wake: Gorai's and Haldor's own.
    if (fighter === 'gorai') return [voice('vo-gorai-laugh', .9, 2)];
    if (fighter === 'haldor') return [voice('vo-haldor-laugh', .9, 2)];
    // Shiun on pale seraph, as it takes him beyond.
    if (fighter === 'shiun') return [voice('vo-shiun-pale-gem', .9, 2)];
    // Magatsu in his true form: "it's getting fun" (the Rift boss's own line).
    if (fighter === 'magatsu') return [voice('vo-magatsu-fun', .9, 2)];
    // Vesper reborn as Black Vespers: "it seems I am free".
    if (fighter === 'vesper') return [voice('vo-vesper-free', .9, 2)];
    // Imago reborn: "the power is filling me".
    if (fighter === 'imago') return [voice('vo-imago-power', .9, 2)];
    // Wuming going Rose: "now is the time to show a god's true power".
    if (fighter === 'wuming') return [voice('vo-wuming-true-power', .9, 2)];
    // Jirenga at full power: "come at me with everything you have". Emperor Jinlin: "the real fight starts now".
    if (fighter === 'jirenga') return [voice('vo-jirenga-come-all', .9, 2)];
    if (fighter === 'jinlin') return [voice('vo-jinlin-for-real', .9, 2)];
    // Ippon, serious for once: "Hissatsu maji shirīzu" (Serious Series).
    if (fighter === 'ippon') return [voice('vo-ippon-serious-series', .9, 2)];
    // Sekka: "Jutsushiki tenkai" (Technique Development).
    if (fighter === 'sekka') return [voice('vo-sekka-technique', .9, 2)];
    // Levin: "Kui ga nokoranai hō o jibun de erabe" (Choose for yourself the one you won't regret).
    if (fighter === 'levin') return [voice('vo-levin-choose', .9, 2)];
    if (fighter === 'akagane') return [voice('vo-akagane-end-this', .9, 2)];
    // Round 3d: Nigo's "Night... FALL!", placed so its second word meets the pressure
    // burst and the NIGHTFALL swapping in (unsealedTiming.ts). On the
    // release phase, like the burst: the first cast after the entry must
    // not cut the shout.
    if (fighter === 'nigo') return [voice('vo-nigo-unsealed', .95, 2, UNSEALED.kai - UNSEALED.kaiInLine, { phase: 'release' })];
    // Taisei names the form once the burst has passed (goldenFormTiming.ts): "見せてやる…これが黄金の大聖…タイセイだっ!!",
    // his own line. Released like Nigo's, so the first attack after the entry does not cut it; at SUPER_LINE_PRIORITY, so
    // his calls still speak over it.
    if (fighter === 'taisei') return [voice('vo-taisei-golden-form', .95, SUPER_LINE_PRIORITY, GOLDEN_FORM.line, { phase: 'release' })];
    // Ouga names his, on the same beat (goldenFormTiming.ts, SUPER_OUGA): "ひれ伏せ…ゴールデン・プライド!", his own line.
    // Released, and at SUPER_LINE_PRIORITY, as Taisei's: his efforts do not cut it, and his calls - Big Bang
    // (BIG_BANG_PRIORITY), the Gale, Kyokko-Ho - speak over it.
    if (fighter === 'ouga') return [voice('vo-ouga-super-ouga', .95, SUPER_LINE_PRIORITY, SUPER_OUGA.line, { phase: 'release' })];
    // (The overnight pass, 9 October) The rest name their form on Taisei's and Ouga's beat, once the burst has passed
    // (awakeningLines.ts): Kenzo's "鬼面……羅刹ッ！", Gummy's "にっひひ…サンライズ!" and the others. Released, and at
    // SUPER_LINE_PRIORITY, as Taisei's and Ouga's lines: their efforts do not cut it, and their calls speak over it.
    // Native nonverbal strain/roar begins with the authored entry.
    if (fighter === 'tancho') return [voice('vo-tancho-phosphor', .95, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'oyashio') return [voice('vo-oyashio-sea', .95, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'ume') return [voice('vo-ume-grand-champion', .95, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'lanthorn') return [voice('vo-lanthorn-awakening', .95, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'highsun') return [voice('vo-highsun-sunshine', .95, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'torsion') return [voice('vo-torsion-serious', .95, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'kubiwa') return [voice('vo-kubiwa-awakening', .95, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'onigawara') return [voice('vo-onigawara-awaken', .95, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'minase') return [voice('vo-minase-sage', .95, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'psyche') return [voice('vo-psyche-violet-swarm', .85, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'ovid') return [voice('vo-ovid-resolve', .85, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'hawser') return [voice('vo-hawser-stronger', .85, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'rotfalke') return [voice('vo-rotfalke-sync', .85, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'bonsho') return [voice('vo-bonsho-prayer', .85, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'chohan') return [voice('vo-chohan-power-gap', .85, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'tsubute') return [voice('vo-tsubute-resolve', .85, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'aqrab') return [voice('vo-aqrab-to-sand', .85, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'yodaka') return [voice('vo-yodaka-heart-ablaze', .9, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'murex') return [voice('vo-murex-awaken', .85, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'kinu') return [voice('vo-kinu-awakening', .85, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'madake') return [voice('vo-madake-resolve', .85, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'akayuri') return [voice('vo-akayuri-resolve', .85, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'hagure') return [voice('vo-hagure-awakening', .85, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'hisame') return [voice('vo-hisame-awaken', .85, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'mizuhiki') return [voice('vo-mizuhiki-own-will', .9, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'shibuichi') return [voice('vo-shibuichi-resolve', .9, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'rakucho') return [voice('vo-rakucho-awakening', .9, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'irbis') return [voice('vo-irbis-awaken', .9, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'shidare') return [voice('vo-shidare-unsealed', .9, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'hinomoto') return [voice('vo-hinomoto-time-ripe', .95, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'amagoi') return [voice('vo-amagoi-awakening', .95, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'shakudo') return [voice('vo-shakudo-serious', .95, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'hikui') return [voice('vo-hikui-awaken', .95, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'tokan') return [voice('vo-tokan-justice', .95, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'strappado') return [voice('vo-strappado-showstopper', .95, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'unari') return [voice('vo-unari-awakening', .95, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'barrow') return [voice('vo-barrow-strongest', .95, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'sashigane') return [voice('vo-sashigane-overtime', .95, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'gosu') return [voice('vo-gosu-awakening', .95, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'kusushi') return [voice('vo-kusushi-grand-champion', .95, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'hakushi') return [voice('vo-hakushi-awaken', .95, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'suzuran') return [voice('vo-suzuran-resolve', .95, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'wataame') return [voice('vo-wataame-awakening', .95, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'senko') return [voice('vo-senko-speed', .95, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'buna') return [voice('vo-buna-oden', .95, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'adad') return [voice('vo-adad-awakening', .95, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'bellows') return [voice('vo-bellows-stoked', .95, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'mikage') return [voice('vo-mikage-hackles-up', .95, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'akaito') return [voice('vo-akaito-ring-pact', .95, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'shijima') return [voice('vo-shijima-unsealed', .95, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'tempo') return [voice('vo-tempo-awakening', .95, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'shanxiao') return [voice('vo-shanxiao-unbound-fury', .95, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    const named = fighter ? AWAKENING_LINES[fighter] : undefined;
    if (named) return [voice(named.cue, .95, SUPER_LINE_PRIORITY, named.line, { phase: 'release' })];
    return [];
  }
  // Round 3d (ULTS): the lines inside a hit-confirm ultimate's cinematic.
  if ((event.kind === 'confirm' || event.kind === 'release') && fighter && slot === 'ultimate') return cinematicVoice(event, fighter, awakened);
  if (event.kind !== 'cast' || !fighter || !slot) return [];
  const kurobi = fighter === 'konta' && awakened, kit = kurobi ? KUROBI : KITS[fighter];
  if (!kit) return [];
  if (slot === 'light') return light(event, fighter, kit, awakened);
  if (event.branch) { const ender = comboMove(fighter, event.branch, awakened); return ender ? rationed(event, kit.enders?.[event.branch], slot, ender) : []; }
  const move = moveFor(fighter, slot, awakened);
  if (slot === 'area') { const cue = move.area?.voice as AudioCue | undefined; return cue ? [voice(cue, .95, PRIORITY.area)] : []; }
  if (kit.barrage && (slot === 'special' || slot === 'ultimate')) return stand(slot, move, kit);
  const swapped = awakened ? FORM_CALLS[fighter]?.[slot] : undefined;
  const call = swapped ?? kit.calls[slot];
  if (!call) return rationed(event, slot === 'heavy' ? kit.heavy : slot === 'special' ? kit.special : undefined, slot, move);
  // Taisei's and Konta's calls always went out at the default priority. A named heavy speaks over an awakening line
  // (BIG_BANG_PRIORITY, AWAKENED_HEAVY_PRIORITY).
  const priority = (fighter === 'taisei' || fighter === 'konta') && !kurobi ? 1
    : slot === 'heavy' && fighter === 'ouga' ? BIG_BANG_PRIORITY
      : slot === 'heavy' && awakened && AWAKENING_LINES[fighter] ? AWAKENED_HEAVY_PRIORITY : PRIORITY[slot];
  const layers = [voice(call, kurobi ? .85 : .95, priority, swapped ? 0 : kit.delays?.[slot] ?? 0)];
  // A single actor cannot speak two phrases at once. Schedule from the
  // measured output durations, including the runtime's onset trim.
  // Round 3d (ULTS): a hit-confirm ultimate's lines after the call are its
  // cinematic's, said only when it lands (cinematicVoice).
  return layers;
}

/** Round 3d (ULTS): the first blow of a hit-confirm ultimate's cinematic, as a
 *  contact index: the first after the opener, or after a time stop's stop. */
function cinematicStart(move: MoveDefinition) {
  return (move.timeStop?.contact ?? 0) + 1;
}

/** Round 3d (ULTS): the lines of a hit-confirm ultimate's cinematic, which
 *  are said only when its opener lands. They are laid out from the release
 *  of the cinematic's first blow: that release only happens on a confirm,
 *  and by then the call made at the cast has been said (one man cannot say
 *  two things at once, and a line planned over one still being spoken cuts
 *  it). A line that must start sooner than that blow - Grand Tide's,
 *  whose cinematic is one blow - is laid out from the confirm. A Stand
 *  user's cinematic is its barrage: the GAN/GILDED_PUNCH loop across barrageWindow
 *  and the finisher's line after it (stand). Seconds on the move's own
 *  timeline, moved onto the event's: the confirm is `castAge` into the move,
 *  the release is its contact's time. */
function cinematicVoice(event: CombatEvent, fighter: FighterId, awakened: boolean): CueLayer[] {
  const kit = fighter === 'konta' && awakened ? KUROBI : KITS[fighter], move = moveFor(fighter, 'ultimate', awakened);
  if (!kit || !move.confirm) return [];
  const first = cinematicStart(move);
  if (first >= move.contacts.length) return [];
  let at: number;
  if (event.kind === 'confirm') { if (!kit.cinematic?.fromConfirm) return []; at = event.castAge ?? move.contacts[0]; }
  else { if (event.contactIndex !== first || kit.cinematic?.fromConfirm) return []; at = move.contacts[first]; }
  const priority = PRIORITY.ultimate, blow = move.contacts[move.contacts.length - 1];
  if (kit.barrage) return shift(standCinematic(move, kit), at);
  const line = kit.cinematic;
  if (!line) return [];
  return shift([voice(line.cue, .9, priority, Math.max(at, blow - line.lands))], at);
}

/** Layers planned on the move's timeline, moved onto an event `at` seconds
 *  into it: what was due before it starts at once, cut by as much. */
function shift(layers: CueLayer[], at: number): CueLayer[] {
  return layers.map(layer => {
    const from = (layer.delay ?? 0) - at, { delay: _delay, ...rest } = layer;
    const duration = layer.duration === undefined ? undefined : Math.max(.2, layer.duration + Math.min(0, from));
    return { ...rest, ...(from > 0 ? { delay: Math.round(from * 1000) / 1000 } : {}), ...(duration !== undefined ? { duration } : {}) };
  });
}

const LIGHT_PHASE: Partial<CueLayer> = { phase: 'release' };

/** A light: the rationed callout, or an effort, or nothing. */
function light(event: CombatEvent, fighter: FighterId, kit: VoiceKit, awakened: boolean): CueLayer[] {
  const memory = memoryOf(event.actorId, event.serverTime), key = castKey(event);
  const known = memory.decided.get(key);
  if (known) return known;
  const at = event.serverTime, stage = event.chain ?? 0, call = kit.calls.light;
  let layers: CueLayer[] = [];
  if (call && stage === 0 && at - memory.calledAt >= LIGHT_CALL_COOLDOWN && voiceRoll(event.actorId, key, 1) < LIGHT_CALL_CHANCE) {
    memory.calledAt = at; memory.quietUntil = at + cueDuration(call);
    layers = [voice(call, fighter === 'konta' && awakened ? .85 : .95, 0, 0, LIGHT_PHASE)];
    memory.effortOnLight = false;
  } else if (kit.efforts.length && at >= memory.quietUntil && !(memory.effortOnLight && at - memory.lightAt < FLURRY)
    && voiceRoll(event.actorId, key, 2) < EFFORT_CHANCE) {
    const cue = rotate(kit.efforts, voiceRoll(event.actorId, key, 3), memory.lastEffort);
    memory.lastEffort = cue; memory.effortOnLight = true;
    const contact = rushMove(fighter, stage, awakened).contacts[0];
    layers = [voice(cue, .8, 0, Math.max(0, contact - EFFORT_LEAD), LIGHT_PHASE)];
  } else memory.effortOnLight = false;
  memory.lightAt = at;
  return decide(memory, key, layers);
}

/** A heavy or special with no named callout: the fighter's own efforts for
 *  it, rotated, never the same clip twice running. */
function rationed(event: CombatEvent, bank: Rationed | undefined, slot: AttackSlot, move: MoveDefinition): CueLayer[] {
  if (!bank?.cues.length) return [];
  const memory = memoryOf(event.actorId, event.serverTime), key = castKey(event);
  const known = memory.decided.get(key);
  if (known) return known;
  if (voiceRoll(event.actorId, key, 4) >= (bank.chance ?? 1)) return decide(memory, key, []);
  const cue = rotate(bank.cues, voiceRoll(event.actorId, key, 5), slot === 'heavy' ? memory.lastHeavy : memory.lastSpecial);
  if (slot === 'heavy') memory.lastHeavy = cue; else memory.lastSpecial = cue;
  // The cry peaks a little way in: that part lands on the blow.
  const delay = Math.max(0, move.contacts[0] - Math.min(.35, cueDuration(cue) * .3));
  return decide(memory, key, [voice(cue, .9, PRIORITY[slot], delay)]);
}

/** VOL.5, the move transplant (src/engine/client/transplant.ts): a borrowed move is voiced by the body throwing it, never
 *  by the fighter it comes from - no other character's voice out of this body, and no move name. One of the body's own
 *  wordless efforts on the cast, timed to the borrowed move's first contact: rationed as a light's are (a light), or on
 *  every cast the body is not already speaking over (a heavy, special or ultimate). `event` names the move's fighter and
 *  slot; `body` is the thrower's. */
export function planBodyEffort(event: CombatEvent, body: FighterId): CueLayer[] {
  const fighter = event.fighter, slot = event.slot, kit = KITS[body];
  if (event.kind !== 'cast' || !fighter || !slot || !kit?.efforts.length) return [];
  const memory = memoryOf(event.actorId, event.serverTime), key = `${castKey(event)}:${body}`;
  const known = memory.decided.get(key);
  if (known) return known;
  const at = event.serverTime, light = slot === 'light';
  const quiet = at < memory.quietUntil || (light && memory.effortOnLight && at - memory.lightAt < FLURRY);
  if (light) memory.lightAt = at;
  if (quiet || (light && voiceRoll(event.actorId, key, 2) >= EFFORT_CHANCE)) { if (light) memory.effortOnLight = false; return decide(memory, key, []); }
  const cue = rotate(kit.efforts, voiceRoll(event.actorId, key, 3), memory.lastEffort);
  memory.lastEffort = cue; if (light) memory.effortOnLight = true;
  const move = light ? rushMove(fighter, 0, false) : moveFor(fighter, slot, false);
  return decide(memory, key, [voice(cue, light ? .8 : .9, light ? 0 : PRIORITY[slot], Math.max(0, (move.contacts[0] ?? 0) - EFFORT_LEAD), light ? LIGHT_PHASE : {})]);
}

/** The loop starts this far ahead of the first blow, so the first syllable
 *  lands on it rather than after it. */
const BARRAGE_LEAD = .04;
/** And runs this far past the last blow, so it is not cut on that blow. */
const BARRAGE_TAIL = .2;

/** A spirit fighter's special and ultimate: the call, the GAN/GILDED_PUNCH loop across
 *  the blows, and on the ultimate the finisher's line. One man cannot shout
 *  two things at once, so each segment starts where the one before ends.
 *
 *  The time-stop ultimate's loop covers barrageWindow (TIMESTOP keeps it true
 *  to the barrage) from its first blow through its last, and nothing may
 *  push it late: the call is cut to end as the barrage starts. The special's
 *  loop covers its blows but waits for the call to finish. */
function stand(slot: 'special' | 'ultimate', move: MoveDefinition, kit: VoiceKit): CueLayer[] {
  const call = kit.calls[slot], loop = kit.barrage!, priority = PRIORITY[slot];
  // Round 3d (ULTS): a hit-confirm time stop's call goes out with the cast;
  // its barrage and finisher's line are its cinematic (standCinematic), said
  // only when the stop catches somebody.
  if (slot === 'ultimate' && move.confirm) {
    const window = barrageWindow(move);
    const room = window ? Math.max(0, window.start - BARRAGE_LEAD) - .02 : Infinity;
    return call ? [voice(call, .95, priority, 0, cueDuration(call) > room ? { duration: Math.max(.2, room) } : {})] : [];
  }
  const window = slot === 'ultimate' ? barrageWindow(move)
    : move.contacts.length > 1 ? { start: move.contacts[0], end: move.contacts[move.contacts.length - 1] } : null;
  if (!window) return call ? [voice(call, .95, priority)] : [];
  const layers: CueLayer[] = [];
  let start = Math.max(0, window.start - BARRAGE_LEAD);
  if (call) {
    const said = cueDuration(call), room = start - .02;
    if (slot === 'ultimate') layers.push(voice(call, .95, priority, 0, said > room ? { duration: Math.max(.2, room) } : {}));
    // Round 3d (PACE): the special's blows start at 0.6 s now, and a call
    // that cannot finish before the first of them is left out - the cry
    // across the blows is the special's voice - rather than holding the cry
    // back until the barrage is nearly over ("Iron Spirit!" is 1.5 s).
    else if (said + .02 <= start) layers.push(voice(call, .95, priority));
  }
  const end = window.end + BARRAGE_TAIL;
  layers.push(voice(loop, .8, priority, start, { loop: true, duration: end - start }));
  if (slot === 'ultimate' && kit.finisher) {
    const blow = move.contacts[move.contacts.length - 1];
    layers.push(voice(kit.finisher.cue, .9, priority, Math.max(end + .02, blow - kit.finisher.lands)));
  }
  return layers;
}

/** Round 3d (ULTS): a spirit fighter's time stop, inside it - the loop across
 *  barrageWindow and the finisher's line after it - on the move's timeline. */
function standCinematic(move: MoveDefinition, kit: VoiceKit): CueLayer[] {
  const window = barrageWindow(move), loop = kit.barrage!, priority = PRIORITY.ultimate;
  if (!window) return [];
  const start = Math.max(0, window.start - BARRAGE_LEAD), end = window.end + BARRAGE_TAIL;
  const layers = [voice(loop, .8, priority, start, { loop: true, duration: end - start })];
  if (kit.finisher) layers.push(voice(kit.finisher.cue, .9, priority, Math.max(end + .02, move.contacts[move.contacts.length - 1] - kit.finisher.lands)));
  return layers;
}
