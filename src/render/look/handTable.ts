import type { FighterId } from '../../game/types';

/** The hands table (look/hands.ts reads it): one row a fighter whose body has finger bones, of the sixty added at launch.
 *
 *  A row says what each hand is where the clip the body has on leaves it flat or fanned; it is never asked about a hand the
 *  clip poses. Where a row says nothing the hand is a striker's (hands.ts HAND_DEFAULT): a fist in the guard and in every
 *  blow, a relaxed curl standing, crossing the floor, in the air and struck. A row overrides that by the moment's own name
 *  (`idle`, `guard`, `run`, `dash`, `jump`, `light1` to `light4`, `heavy`, `special`, `ultimate`, `area`, `hit`, `launched`,
 *  `down`, `getup`), by a group (`light`, `blow`: the lights and the heavy, `cast`: the special, the ultimate and the area
 *  move, `stand`: idle and guard, `move`, `struck`) or for `all`, for the left hand (`L`), the right (`R`) or `both`; one
 *  word in place of the list is that pose in every moment.
 *
 *  The poses: `relaxed`, `fist`, `grip`, `palm` (an open palm, fingers together: a palm strike, a push, a cast, a knife
 *  hand), `claw` (a hooked open hand: strings, talons, a sphere held in the palm), `held` (the hand as the body's own idle
 *  holds it: the grip it has on its weapon, wherever a borrowed clip opens that hand), `own` (leave the clip's hand alone,
 *  whatever it reads as). `form`: the same again for the awakened body where it differs. */
export type HandShape = 'relaxed' | 'fist' | 'grip' | 'palm' | 'claw';
export type HandPose = HandShape | 'held' | 'own';
export type HandKind = 'idle' | 'guard' | 'run' | 'dash' | 'jump' | 'light1' | 'light2' | 'light3' | 'light4' | 'heavy' | 'special' | 'ultimate' | 'area' | 'hit' | 'launched' | 'down' | 'getup';
export type HandKey = HandKind | 'light' | 'stand' | 'move' | 'blow' | 'cast' | 'struck' | 'all';
export type HandSide = HandPose | Partial<Record<HandKey, HandPose>>;
export interface HandRow { L?: HandSide; R?: HandSide; both?: HandSide; form?: { L?: HandSide; R?: HandSide; both?: HandSide } }

/** A hand that holds a weapon is the weapon's in every moment: where a borrowed clip opens it, it closes as the idle has it. */
const HELD = 'held' as const;
export const HAND_ROWS: Partial<Record<FighterId, HandRow>> = {
  // ---- Beacon Ward
  ampere: {},
  // Land's End Chop is a crossed chop: knife hands, not the boards the clip has.
  'full-beam': { both: { heavy: 'palm' } },
  // His blasts leave open, hooked hands.
  pyroclast: { both: { blow: 'claw', cast: 'claw' } },
  // Frostbeak is a fist; the arc of flame, the wall, the glacier and the heatwave are thrown from an open hand.
  tancho: { both: { heavy: 'palm', cast: 'palm' } },
  // Slag Lances runs from his fingertips; Meltdown opens both hands.
  bellows: { both: { special: 'claw', ultimate: 'claw' } },
  // ---- Konta
  // Cloudburst, Calling Water, Ash Moon: a palm pushed out. The right hand stays closed on what it holds.
  amagoi: { L: { guard: 'palm', light: 'relaxed', heavy: 'palm', cast: 'palm' }, R: HELD },
  // The kunai in the right; the palm sphere is held in the left.
  minase: { L: { heavy: 'claw', area: 'claw' }, R: HELD },
  // Aquilo casts from open hands: the wind leaves his palm, a blade of it his knife hand.
  aquilo: { both: { blow: 'palm', cast: 'palm' } },
  // His base body's right hand is broken in the file (the middle and last joints sit folded back through the hand; the mesh
  // is an open hand): turning those bones tangles the fingers, so it is left as it is. The Sage body's hands are sound.
  // He stands and guards behind an open palm (the kabuki stance). The Sage body's hands are modelled fanned and its mesh
  // opens gaps between the fingers when they close, so a relaxed curl still read as a spread claw at the gameplay camera in
  // the run, the dash and the jump (rig audit, 15 October): there it runs with closed fists.
  hakushi: { L: { stand: 'palm', light: 'palm', heavy: 'relaxed', cast: 'palm' }, R: 'own', form: { both: { stand: 'palm', light: 'palm', cast: 'palm', move: 'fist' }, L: { heavy: 'relaxed' }, R: { heavy: 'claw' } } },
  ume: {},
  // The soft palm strikes, guards and stands with open palms.
  suzuran: { both: { stand: 'palm', blow: 'palm', cast: 'palm' } },
  kusushi: {},
  // ---- Dust Sea
  // His strings: clawed, spread fingers are his look, standing, guarding and in every move. Never closed.
  strappado: { both: { all: 'claw', struck: 'relaxed' } },
  // A brawler with no fist anywhere: fists standing too. The JETTISON's raised hands stay open.
  barrow: { both: { idle: 'fist', ultimate: 'claw' } },
  // Her arms cross and her hands stay open while the hands she sprouts do the work.
  'psyche': { both: { guard: 'palm', blow: 'palm', cast: 'palm' } },
  // ---- Hex Fallout
  // The blood shot is thrown from pressed palms.
  tempo: { both: { special: 'palm' } },
  sashigane: { R: HELD },
  // The left hand is raised open for Ghost Bride and Pinky Promise.
  akaito: { L: { special: 'relaxed', ultimate: 'palm', area: 'palm' }, R: HELD },
  chohan: { R: HELD },
  // ---- Cinder Requiem
  // The open palm.
  mikage: { both: { light: 'palm' } },
  // The free hand of a man who fights for the joy of it: open and hooked through his blows.
  onigawara: { L: { blow: 'claw', cast: 'claw' }, R: HELD },
  // Cardo: the Weedcutter in the right; a fist in the left in every blow.
  cardo: { L: { blow: 'fist' }, R: HELD },
  // The free left hand runs (and walks) as a fist: the relaxed curl hung open and flat at the belly (s15 audit: FINGERS-FLAT).
  hinomoto: { L: { run: 'fist' }, R: HELD },
  // A panther's hands rake; the Crown Blast is fired from an open palm. (Both hands are free: BARED FANGS is drawn only in the
  // clips that close the right hand on it, which are the clips' own. Filmed: a `held` right hand closed on nothing and shut the Void Ray's palm.)
  irbis: { both: { blow: 'claw', cast: 'claw', special: 'palm' } },
  shidare: { R: HELD },
  // The blue-fire spell is cast from the open left hand.
  shijima: { L: { area: 'palm' }, R: HELD },
  // ---- Salvage Wilds
  unari: {},
  // The prayer and the hundred hands: open palms standing, in the lights and in every cast. The elbow is a fist's.
  bonsho: { both: { stand: 'palm', light: 'palm', cast: 'palm' } },
  // ---- Ropewalk
  mizuhiki: { both: HELD },
  // The row is the YUGE's (a striker's fists). The Scout's body has no finger bones (Meshy's rig gives a hand one
  // joint): his hands are closed on his blades in the mesh (scripts/roster-expansion/hawser_scout_build.sh).
  hawser: {},
  // ---- Single fighters
  wataame: { R: HELD },
  bruin: { R: HELD },
  // The free left hand runs (and walks: the walk is the run's moment) as a fist: on his rig the relaxed curl read as an
  // open, fanned hand swung at the hip (s15 audit, 16 October: FINGERS-FLAT, RUN and WALK), where Taisei's and Ward's are fists.
  hikui: { L: { run: 'fist' }, R: HELD },
  akayuri: { R: HELD },
  // Ice is called with a raised open hand; the rapier stays in the right.
  hisame: { L: { cast: 'palm' }, R: HELD },
  // Svanhild: the lakeglass from an open left palm; the right closes on her lance of water (an open palm before the WHITE PLUMAGE gives her one).
  svanhild: { L: { cast: 'palm', blow: 'palm' }, R: { blow: 'grip', cast: 'palm' }, form: { R: HELD } },
  // The Unit's left hand pries the field open; the knife is in the right. The guard holds the free hand up beside the head
  // palm out, fingers together (the barrier field's gesture): a fist on this rig's long fingers, seen from the palm side as
  // the guard shows it, read as a fanned claw at the face (16 October re-audit).
  rotfalke: { L: { guard: 'palm', special: 'claw' }, R: HELD },
  // His barrier field is pushed out with an open hand.
  murex: { both: { cast: 'palm' } },
  // Her spirit's strings run from the fingers of the hand she holds out: hooked, standing.
  kinu: { L: { idle: 'claw' } },
  gosu: {},
  // A ghoul's hands, hooked, wherever they are not fists. Last Chapter's arms open wide at its finish: a claw there
  // read as a fanned hand at the gameplay camera (s15 audit, ULTIMATE RECOVERY), so that one is a relaxed curl.
  'rakucho': { both: { blow: 'claw', special: 'claw', area: 'claw', ultimate: 'relaxed' } },
  // Pocket Sun sits over the open left hand; the Divine Sword is the right hand itself, a knife hand. Sunhammer is the right's otherwise.
  highsun: { L: { special: 'claw', area: 'claw' }, R: { ultimate: 'palm', all: HELD } },
  // The broken sword is in the left.
  lanthorn: { L: HELD },
  // Alchemy is a clap and two palms. His off hand stood open at his face: a fist, like the other.
  'shibuichi': { both: { special: 'palm', area: 'palm' }, L: { idle: 'fist' } },
  'shakudo': { both: { special: 'palm', area: 'palm' } },
  // She throws with a hooked hand and shields with an open one.
  torsion: { both: { guard: 'palm', blow: 'claw', cast: 'claw' } },
  // The Snap Bite Rock Smashing Fist is open hands; the Cross Fang is a claw.
  hagure: { both: { stand: 'palm', blow: 'palm', special: 'palm', area: 'claw' } },
  'ovid': {},
  // The off hand hangs loose beside the sword until the two-handed forms take it.
  yodaka: { L: { light: 'relaxed' }, R: HELD },
  // Hands behind her back, a pointed finger, a quiet word: nothing of hers is a fist. The hand she raises to guard is an open palm.
  kubiwa: { both: 'relaxed', R: { guard: 'palm' } },
  // Jade Comet and Toppled Peak are thrown from an open, hooked hand.
  shanxiao: { both: { special: 'claw', area: 'claw' } },
  // The chainsaws run through his hands: a fist would put the fingers through the blade. The clip's own, flat as they are.
  kuzu: { both: 'own' },
};

export const NO_FINGERS: readonly FighterId[] = ['shakugo', 'tokan', 'basilissa', 'aqrab', 'adad', 'oyashio', 'senko', 'strix', 'sorayomi', 'tsubute', 'buna', 'madake'];

export const handRow = (fighter: FighterId): HandRow | undefined => HAND_ROWS[fighter];
