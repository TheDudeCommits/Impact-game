import { SENKO_AWAKENING } from './fighters/senko';
/** Awakening: the transformation, on its own meter.
 *
 *  Since round 13 the awakening gauge (`PlayerState.awakening`) is separate
 *  from the ultimate bar. It fills from damage TAKEN - and a little from what
 *  a guard turns away - so the fighter losing an exchange is the one who gets
 *  to turn it round; the ultimate bar fills from damage DEALT and buys the
 *  ultimate, awakened or not. At full, the awakening trades the whole bar for
 *  a limited window where the fighter hits harder, takes less and moves
 *  faster. The ultimate is no longer free inside that window: it costs its
 *  own bar like any other, so an awakened fighter with an earned ultimate is
 *  the most dangerous thing in the arena, and one without is still a
 *  transformation rather than a free finisher.
 *
 *  Server-authoritative, like the stage registry: the simulation owns who is
 *  awakened and what it changes about a move, and the renderer reads the same
 *  table for what the transformation looks like. No renderer or DOM
 *  dependencies - the match server ships src/game only.
 */
import { BASILISSA_AWAKENING } from './fighters/basilissa';
import { HAWSER_COLOSSUS_AREA, HAWSER_COLOSSUS_AREA_LOOK, HAWSER_COLOSSUS_MOVES, HAWSER_COLOSSUS_RUSH } from './fighters/hawser';
import { MOVES, RUSH, RUSH_STAGES, rushStagesOf, type MoveDefinition } from './moves';
import { AREA_BY_ELEMENT, areaMoveFrom } from '../engine/sim/areaMoves';
import type { AttackSlot, FighterId } from './types';

/** The bar is spent whole. Partial awakening would make the meter a resource to
 *  drip rather than a decision to make. */
export const AWAKENING_COST = 100;
export const AWAKENING_SECONDS = 18;
/** The transformation itself: immobile, and invulnerable while it plays. The
 *  cost of awakening is the second you stand still for, not a free death. */
export const AWAKENING_ENTRY = 0.9;
/** Round 3e (MODELS2): the transformation's beat. The entry was a light
 *  pillar and a hard swap on no particular frame; now it is a gather (the
 *  fighter straining, the aura drawn in, the lens pushing in) and a burst at
 *  AWAKENING_SWAP seconds - a flash, the shockwave, the column - and the swap
 *  (hair, form, the body's own awaken-on/off meshes) lands on the burst, under
 *  the flash. About a third of the way in, so the new form is what the rest
 *  of the entry shows. A definition may move it (`swapAt`). Client-side. */
export const AWAKENING_SWAP = 0.34;
/** When a fighter's transformation swaps, seconds into the entry. */
export function awakeningSwapAt(fighter: FighterId) { return AWAKENINGS[fighter].swapAt ?? AWAKENING_SWAP; }
export const AWAKENED_DAMAGE = 1.3;
export const AWAKENED_RESIST = 0.8;
export const AWAKENED_SPEED = 1.15;

export interface AwakeningDefinition {
  /** Announced on transformation, and shown on the meter while it lasts. */
  name: string;
  /** Aura colours, in order core then rim. Client-side. */
  aura: readonly [number, number];
  /** How the transformation shows.
   *
   *  form    a replacement body, shipped as the fighter's formModel
   *  summon  a shell worn over them, shipped the same way but tinted
   *  spirit  their spirit looms over them for the window (round 3d: it used
   *          to take over from them); SwordSpiritEffects owns the model
   *  aura    their own body, plus the aura every transformation burns */
  kind: 'form' | 'summon' | 'spirit' | 'aura';
  /** Gold-hair treatment, for Taisei and Ouga. Client-side. */
  hair?: number;
  /** The hair as it is before the transformation, where the body is drawn in the transformed one: the hair's own
   *  material (one named for hair) is coloured this at rest, and its own colour comes back with the swap. Client-side. */
  baseHair?: number;
  /** Burn the aura as flames around the fighter. Only for a transformation with
   *  no geometry of its own: a gold awakening is the same body with gold hair, and
   *  the flames are the transformation. Everyone else grew a form - a fox, a
   *  Guardian, six arms, burning legs - and a second set of flames around that
   *  reads as an effect stuck to them rather than as power. Client-side. */
  flames?: boolean;
  /** How strongly a burning aura colours its own fighter, 0..1: the light it throws on them from over their head and
   *  the flat tint on their surfaces (default 1, Taisei's and Ouga's). Client-side. */
  auraGlow?: number;
  /** How much bigger the replacement body is than the fighter. Full Swell
   *  inflates; the runtime normalises every model to one height, which made the
   *  awakened form exactly as big as the base one. For a spirit, how much
   *  bigger the one looming over its awakened user is than the one summoned
   *  for a swing. Client-side. */
  formScale?: number;
  /** A summon is worn, not swapped into: the fighter stays visible inside it,
   *  and the shell is tinted and translucent. Client-side. */
  formTint?: number;
  formOpacity?: number;
  /** Metres to push the form forward of the fighter's own position. A
   *  quadruped's mass and its tails both sit behind the point a biped stands
   *  on, so without this the chase camera spends the window inside the tails. */
  formForward?: number;
  /** Transformation clips, in preference order. Client-side; every fighter
   *  falls back to their idle, and the aura carries the moment either way. */
  clips?: readonly string[];
  /** Seconds into the entry at which the swap and the burst land (default
   *  AWAKENING_SWAP). Client-side. */
  swapAt?: number;
}

const define = (a: AwakeningDefinition) => a;

export const AWAKENINGS: Record<FighterId, AwakeningDefinition> = {
  chohan:define({name:'ALL IN',kind:'aura',aura:[0xc6cec8,0x707870],auraGlow:0,flames:false,clips:['ALL IN'],swapAt:.40}),
  aqrab:define({"name":"DRY SEASON","kind":"aura","aura":[15324064,13212501],"auraGlow":0.1,"clips":["DRY SEASON"],"swapAt":0.46}),
  tsubute:define({"name":"MIZUKAGAMI","kind":"aura","aura":[15138768,9027394],"auraGlow":0.12,"clips":["MIZUKAGAMI"],"swapAt":0.47}),
  ume:define({"name":"IRON BLOSSOM","kind":"form","aura":[16761311,15964099],"auraGlow":0.1,"clips":["IRON BLOSSOM"],"swapAt":0.504}),
  lanthorn:define({"name":"AFTER HOURS","kind":"form","aura":[7680950,1510441],"auraGlow":0.1,"clips":["The Dragon Awakens"],"swapAt":0.5}),
  highsun:define({"name":"NO SHADOW","kind":"form","aura":[16759363,16774350],"auraGlow":0.1,"clips":["NO SHADOW"],"swapAt":0.4}),
  torsion:define({name:'GLOVES OFF',kind:'aura',aura:[0x5dffac,0xeaffef],auraGlow:.08,clips:['GLOVES OFF'],swapAt:.55}),
  kubiwa:define({name:'CONDUCTOR',kind:'aura',aura:[0xd69b47,0x782822],auraGlow:.08,clips:['The CONDUCTOR'],swapAt:.567}),
  onigawara:define({"name":"UNMUZZLED","kind":"form","aura":[16760103,2299659],"auraGlow":0.1,"clips":["UNMUZZLED"],"swapAt":0.69}),
  cardo:define({name:'OVERGROWN',kind:'aura',aura:[0x2a2a30,0x050506],auraGlow:.06,clips:['OVERGROWN'],swapAt:.57}),
  minase:define({"name":"FULL STRIDE","kind":"form","aura":[16764745,7809023],"auraGlow":0.1,"clips":["FULL STRIDE"],"swapAt":0.522}),
  aquilo:define({name:'WINDBORNE',kind:'aura',aura:[0x8ff0b4,0x1c6b47],auraGlow:.1,clips:['WINDBORNE'],swapAt:.522}),
  'psyche':define({name:'VIOLET SWARM',kind:'aura',aura:[0xf2aad2,0x815a64],auraGlow:.09,clips:['VIOLET SWARM'],swapAt:.486}),
  'ovid':define({name:'CRACKED OPEN',kind:'aura',aura:[0x57d7bd,0xbbffe5],auraGlow:.04,clips:['WRATHFUL GUARDIAN Release'],swapAt:.513}),
  hawser:define({name:'YUGE',kind:'form',aura:[0xffe2a1,0x45896e],auraGlow:.04,clips:['Freedom Awakens','YUGE Emergence'],swapAt:.594}),
  rotfalke:define({name:'MOTHER\'S WINGS',kind:'form',aura:[16751152,15739698],auraGlow:.025,clips:['MOTHER\'S WINGS'],swapAt:.432}),
  bonsho:define({name:'GREAT BELL',kind:'aura',aura:[16768893,15313723],auraGlow:.08,clips:['GREAT BELL'],swapAt:.585}),
  yodaka:define({name:'BURNING STAR',kind:'aura',aura:[0xffb441,0xe84b26],auraGlow:.08,clips:['BURNING STAR'],swapAt:.9*73/108}),
  murex:define({name:'UNSTRAPPED',kind:'aura',aura:[16752955,8993741],auraGlow:.09,clips:['UNSTRAPPED'],swapAt:.576}),
  kinu:define({name:'CUT LOOSE',kind:'spirit',aura:[8969118,7330525],auraGlow:.08,clips:['CUT LOOSE'],swapAt:.576,formScale:1}),
  'madake':define({name:'EVERGREEN',kind:'form',aura:[0x9dffc8,0x1f8a4c],auraGlow:.06,clips:['EVERGREEN'],swapAt:.558}),
  akayuri:define({name:'SCARLET BLOOM',kind:'form',aura:[0xdd2949,0x220b20],auraGlow:.04,clips:['SCARLET BLOOM'],swapAt:.513}),
  hagure:define({name:'MOONLESS',kind:'form',aura:[0x8e87ff,0x2696ec],auraGlow:.08,clips:['MOONLESS'],swapAt:.549}),
  hisame:define({name:"POLAR NIGHT",kind:'aura',aura:[0x9fe5ff,0x326da7],auraGlow:.08,clips:["POLAR NIGHT"],swapAt:.684}),
  svanhild:define({name:'WHITE PLUMAGE',kind:'aura',aura:[0x9fdcff,0x0b4a8c],auraGlow:.1,clips:['WHITE PLUMAGE'],swapAt:.57}),
  mizuhiki:define({name:'TAUT',kind:'aura',aura:[0xd6e1e8,0xbd3544],auraGlow:.03,clips:['TAUT'],swapAt:.594}),
  'shibuichi':define({name:'HEARTHLIGHT',kind:'aura',aura:[0x78d9e8,0x314853],auraGlow:.07,clips:['HEARTHLIGHT'],swapAt:.63}),
  'rakucho':define({name:'STARVING',kind:'form',aura:[0xbc2456,0x140d18],auraGlow:.08,clips:['STARVING'],swapAt:.423}),
  irbis:define({"name":"BARED FANGS","kind":"form","aura":[5298687,1342397],"auraGlow":0.1,"clips":["BARED FANGS Release"],"swapAt":0.657}),
  shidare:define({name:'FULL BLOOM',kind:'aura',aura:[0xf794ca,0xffdbea],auraGlow:.08,clips:['FULL BLOOM'],swapAt:.504}),
  hinomoto:define({name:'THE OLD FIRE',kind:'aura',aura:[0xffb14b,0x341c13],auraGlow:.06,clips:['THE OLD FIRE'],swapAt:.576}),
  amagoi:define({name:'IRON HALO',kind:'aura',aura:[0xab8fd4,0x302139],auraGlow:.1,clips:['IRON HALO'],swapAt:.54}),
  'shakudo':define({name:'KUROGANE',kind:'aura',aura:[0x62cfff,0xe8fbff],auraGlow:.08,clips:['KUROGANE'],swapAt:.63}),
  hikui:define({"name":"FIRE-EATER","kind":"form","aura":[9063886,1511971],"auraGlow":0.1,"clips":["Dragon Absorption"],"swapAt":0.549}),
  tokan:define({name:'DEAD OF WINTER',kind:'aura',aura:[0x83c7e7,0xe9faff],auraGlow:.06,clips:['DEAD OF WINTER'],swapAt:.58}),
  strappado:define({name:'SHOWSTOPPER',kind:'aura',aura:[0xfffaf1,0xf074ad],auraGlow:.07,clips:['SHOWSTOPPER'],swapAt:.55}),
  unari:define({"name":"OPEN SEASON","kind":"aura","aura":[15692487,16767474],"auraGlow":0.08,"clips":["Magicians Malice"],"swapAt":0.62}),
  barrow:define({name:"BOTTOMLESS",kind:'aura',aura:[0xb074e5,0x89c9e0],auraGlow:.09,clips:['Emperor Ambition'],swapAt:.55}),
  sashigane:define({name:'ZERO TOLERANCE',kind:'aura',aura:[0xc8e998,0x78c6b0],auraGlow:.08,clips:['ZERO TOLERANCE Release'],swapAt:.378}),
  gosu:define({"name":"MENDED IN GOLD","kind":"spirit","aura":[15763125,8445170],"auraGlow":0.1,"formScale":1.15,"clips":["MENDED IN GOLD"],"swapAt":0.62}),
  kusushi:define({"name":"GRAND CHAMPION","kind":"form","aura":[15466487,6549427],"auraGlow":0.1,"clips":["GRAND CHAMPION"],"swapAt":0.504}),
  hakushi:define({"name":"THE OLD LION","kind":"form","aura":[10075800,16301691],"auraGlow":0.08,"clips":["THE OLD LION"],"swapAt":0.576}),
  suzuran:define({name:'YOIN',kind:'aura',aura:[0xdbeeff,0xbaa9f0],auraGlow:.12,clips:['YOIN Release'],swapAt:.63}),
  wataame:define({"name":"MEZAMASHI","kind":"aura","aura":[10340333,15988991],"auraGlow":0.1,"clips":["MEZAMASHI"],"swapAt":0.62}),
  bruin:define({name:'WIDE AWAKE',kind:'aura',aura:[0x7a34c8,0x06020c],auraGlow:.08,clips:['WIDE AWAKE'],swapAt:.62}),
  senko:define(SENKO_AWAKENING),
  buna:define({name:'YUKIOKOSHI',kind:'aura',aura:[0xf5edff,0xc9adeb],auraGlow:.13,clips:['YUKIOKOSHI'],swapAt:.55}),
  oyashio:define({name:'DEEP CURRENT',kind:'aura',aura:[0xe8fdff,0x42c4df],auraGlow:.12,clips:['DEEP CURRENT'],swapAt:.46}),
  adad:define({"name":"STORM THRONE","kind":"aura","aura":[7395839,16766809],"auraGlow":0.12,"clips":["STORM THRONE"],"swapAt":0.54}),
  shijima: define({"name":"WHITE SILENCE","kind":"form","aura":[15925247,6932456],"auraGlow":0.1,"clips":["WHITE SILENCE"],"swapAt":0.585}),
  akaito: define({"name":"TILL DEATH","kind":"aura","aura":[16050687,7559846],"auraGlow":0.13,"clips":["Ring Pact"],"swapAt":0.504}),
  tempo:define({"name": "IN THE ZONE", "kind": "aura", "aura": [15721960, 14357301], "auraGlow": 0.12, "clips": ["Soul Resolve"], "swapAt": 0.58}),
  tancho: define({name:'RED CROWN',kind:'aura',aura:[0xe4ffff,0x58d9f3],auraGlow:.16,clips:['Phosphor'],swapAt:.585}),
  bellows: define({name:'STOKED',kind:'aura',aura:[0xfff1b5,0xff6b22],auraGlow:.18,clips:['STOKED Ignition'],swapAt:.522}),
  mikage: define({name:'HACKLES UP',kind:'aura',aura:[0xf4eaff,0xa663ee],auraGlow:.18,clips:['HACKLES UP Release'],swapAt:.486}),
  // A game-adapted focus stance, not a transformation.
  'full-beam': define({ name: 'LAST WATCH', kind: 'aura', aura: [0xfffbee, 0xf6c65a], auraGlow: .1, clips: ['Inheritance'], swapAt: .54 }),
  pyroclast: define({ name: 'BOILING POINT', kind: 'aura', aura: [0xfff6d8, 0xff791e], auraGlow: .1, clips: ['Cluster Ignition'], swapAt: .549 }),
  ampere: define({ name: 'LIGHTS ON', kind: 'form', aura: [0xe7fff3, 0x32db99], auraGlow: .14, formScale: 1.84/1.78, clips: ['Vigilante Resolve'], swapAt: .504 }),
  shanxiao: define({ name: 'JADE STORM', kind: 'form', aura: [0xe4ff8b, 0x67d92d], auraGlow: .2, formScale: 2.26/2.1, clips: ['Unbound Fury'], swapAt: .477 }),
  kuzu: define({ name: 'OFF THE LEASH', kind: 'aura', aura: [0xffefd0, 0xffa847], auraGlow: .15, clips: ['Ripcord Awakening'], swapAt: .63 }),
  shakugo: define({ name: 'NO QUARTER', kind: 'aura', aura: [0xffdb90, 0xdd3c17], auraGlow: .2, clips: ['NO QUARTER'], swapAt: .35 }),
  strix: define({ name: 'UNBLINKING', kind: 'aura', aura: [0xeaf5cf, 0x73a56d], auraGlow: .35, clips: ['Unblinking Focus'] }),
  'basilissa': define(BASILISSA_AWAKENING),
  sorayomi: define({ name: 'EYE OF THE STORM', kind: 'aura', aura: [0xd6f6ff, 0x54bde8], auraGlow: .25, clips: ['Storm Eye Awakening'], swapAt: .65 }),
  // Round 3e (MODELS2): the gold awakening is a new silhouette, not a tint - the
  // Last Sun hair (awaken-on, scripts/r3e_models2.py) swaps in on
  // the burst, Taisei's own fused hair drawn in onto his skull by a morph target
  // - and the entry is a power-up clip keyed to the beat (taisei-awaken1.glb,
  // ouga-awaken1.glb, scripts/r3e_awaken_clips.py: gather, burst at the
  // swap, settle). The gold `hair` tint now finishes the brows and the teal
  // the eyes; the irises ride in the face texture's alpha.
  taisei: define({ name: 'GOLDEN SAGE', kind: 'aura', aura: [0xffe37a, 0xffa227], hair: 0xffd23d,
    flames: true, clips: ['awaken-powerup', 'last-sun', 'taisei-ready', '02-STANCE'] }),
  ouga: define({ name: 'GOLDEN PRIDE', kind: 'aura', aura: [0xffe37a, 0xff8c1f], hair: 0xffcf3a,
    flames: true, clips: ['awaken-powerup', 'Shikou-Ha', '_Idle'] }),
  // The fox-spirit itself, not a cloak of its chi: Konta Online's Kurobi
  // ships a whole fighting set, so the fox is the fighter for the window.
  // Kurobi is a quadruped, so normalising its height already makes it five
  // metres long and the scale was held at .85 to keep the camera out of nine
  // tails. A beast spirit that is the same size as the man is not a tailed
  // beast, so it is twice that now and the camera is asked to cope - see the
  // summon framing in FollowCamera, which pulls back on the awakened silhouette
  // rather than on the fighter's own height.
  // Align the front paws/muzzle with combat range. The source origin is behind
  // the hips; leaving it there puts a nearby opponent inside the fox's torso.
  konta: define({ name: 'HOMURA', kind: 'form', aura: [0xffd873, 0xff7d1c], formScale: 2.8, formForward: -1.5,
    clips: ['Whirlsphere charge', 'Konta pose', '_Idle'] }),
  gummy: define({ name: 'SUNRISE', kind: 'form', aura: [0xffffff, 0xcfd6ff], formScale: 1.08,
    clips: ['flagget_lp', 'flagget', '_Idle'] }),
  nigo: define({ name: 'NIGHTFALL', kind: 'form', aura: [0x9b6ad6, 0x1a1026], formScale: 1.06,
    clips: ['stay_show', 'Block', '_Idle'], swapAt: AWAKENING_ENTRY * .82 }),
  kenzo: define({ name: 'RAKSHASA', kind: 'form', aura: [0x9cf07c, 0x11361a], formScale: 1.06,
    clips: ['opening', 'flagget', '_Idle'] }),
  kosho: define({ name: 'FEU BLEU', kind: 'aura', aura: [0x7fc8ff, 0x1b4fd0],
    clips: ['opening', 'flagget', '_Idle'] }),
  // A WRATHFUL KING bound to each of their own skeletons, so it fights their
  // moves rather than standing beside them: see scripts/rig_guardian.py. They
  // stay visible inside it, which is what being in a Guardian looks like.
  shiden: define({ name: 'IKAZUCHI', kind: 'summon', aura: [0xb469ff, 0x4a1a86],
    formScale: 4.2, formTint: 0x8a3ce0, formOpacity: .42,
    clips: ['Ikazuchi Arrow', 'Black Pyre', '_Idle'] }),
  shirokane: define({ name: 'HARVEST WARDEN', kind: 'summon', aura: [0x6ad4ff, 0x123f7a],
    formScale: 4.2, formTint: 0x2f8ae0, formOpacity: .42,
    clips: ['Sickle Bolt', 'Void Eye: Sickle Bolt', '_Idle'] }),
  koko: define({ name: 'HUSH', kind: 'spirit', aura: [0xd0a6ff, 0x2a1440], formScale: 1.5,
    clips: ['HUSH', '_Idle'] }),
  // Round 16. Kagari burns: the KAGUTSUCHI is fire over his own body, so the
  // aura carries the flame while his hair retains its natural color.
  kagari: define({ name: 'KAGUTSUCHI', kind: 'aura', aura: [0xffb347, 0xff3d00],
    flames: true, clips: ['opening', 'flagget', '_Idle'] }),
  ward: define({ name: 'OPERATING THEATRE', kind: 'aura', aura: [0x7fe0ff, 0x1a3fa0],
    clips: ['opening', 'flagget', '_Idle'] }),
  kuon: define({ name: 'TENGAN', kind: 'aura', aura: [0x9fe8ff, 0x2a5fd0],
    clips: ['_Idle'] }),
  // LORD ORO the same: he fights on, and HUSH looms over him in gold - the
  // same shape as KoKo's spirit, drawn by the same effects class.
  oro: define({ name: 'MIDNIGHT', kind: 'spirit', aura: [0xffe27a, 0x8a5a10], formScale: 1.5,
    clips: ['MIDNIGHT', '_Idle'] }),
  // The HOUND ARMOR: a body of its own, bound to his skeleton so it
  // fights his clips (scripts/build_gaunt.py).
  gaunt: define({ name: 'HOUND ARMOR', kind: 'form', aura: [0xff2a2a, 0x2b0000], formScale: 1.02,
    clips: ['Hound Rampage', '_Idle'] }),
  setsu: define({ name: 'SETSUNA', kind: 'aura', aura: [0xbfe6ff, 0x3a6fff],
    clips: ['_Idle'] }),
  gorai: define({ name: 'STORM WYRM', kind: 'form', aura: [0xc39bff, 0x3a0d6e], formScale: 1.25,
    clips: ['awaken-roar', '_Idle'] }),
  haldor: define({ name: 'GROUNDSWELL', kind: 'aura', aura: [0xa8d8ff, 0x2a6ad8],
    flames: true, auraGlow: .3, clips: ['awaken-quake', '_Idle'] }),
  sorrel: define({ name: 'CRIMSON WILL', kind: 'aura', aura: [0xff2a3a, 0x1a0006],
    flames: true, auraGlow: .3, clips: ['awaken-will', '_Idle'] }),
  // Dorado raises Kagari over his head, and his will comes up gold round black
  // lightning: the man who reached the end of the sea.
  dorado: define({ name: 'LAST HORIZON', kind: 'aura', aura: [0xffb020, 0x140800],
    flames: true, auraGlow: .3, clips: ['awaken-kagari', '_Idle'] }),
  shiun: define({ name: 'PALE SERAPH', kind: 'form', aura: [0xb070ff, 0x24083f], formScale: 1.08,
    clips: ['awaken-pale-gem', '_Idle'] }),
  magatsu: define({ name: 'CALAMITY KING', kind: 'form', aura: [0xff2a3a, 0x1c0204], formScale: 1.24,
    clips: ['awaken-shrine', '_Idle'] }),
  vesper: define({ name: 'BLACK VESPERS', kind: 'form', aura: [0xe8e0ff, 0x4a2a8a], formScale: 1.1,
    clips: ['awaken-black-vespers', '_Idle'] }),
  // Imago reborn, his aura synthesised: the roar, and jade comes up round
  // him (the survival boss's awakening).
  imago: define({ name: 'SWARM ASCENDANT', kind: 'aura', aura: [0x7affa8, 0x1ab866],
    flames: true, auraGlow: .3, clips: ['awaken-swarm', '_Idle'] }),
  // The shop's power-ups burn as Taisei's and Ouga's do (3 October): Wuming's Rose,
  // Jirenga at full power, Gohaku's Beast, Imago reborn and Asahi breathing
  // the Sun are each the same body with the power pouring off it, so their aura
  // burns as flames over the colour (`flames`), where before it was a glow.
  // Wuming goes LOTUS IN FLAME: the smug turn of his hand, his black
  // hair pink (the crown tint, as Taisei's gold), and a rose aura round him.
  'wuming': define({ name: 'LOTUS IN FLAME', kind: 'aura', aura: [0xff6ad8, 0xc8208c], hair: 0xff6ad8,
    flames: true, auraGlow: .3, clips: ['awaken-rose', '_Idle'] }),
  // Jirenga at full power: the crossed-arm stare, and red blazing up round him (the move card's).
  jirenga: define({ name: 'WRATHFUL GUARDIAN', kind: 'aura', aura: [0xff5a3a, 0xc8101e],
    flames: true, auraGlow: .3, clips: ['awaken-wrathful-guardian', '_Idle'] }),
  // Emperor Jinlin goes further (3 October): his arms spread wide and he wakes as BLACK TIDE - his own body with
  // the gold of his plates gone glossy black and his gems magenta (jinlin-black1.glb,
  // scripts/economy/recolor_form.py), under a violet aura.
  'jinlin': define({ name: 'BLACK TIDE', kind: 'form', aura: [0xf0d4ff, 0x7a2bd8], formScale: 1,
    clips: ['awaken-golden', '_Idle'] }),
  // Gohaku: the roar he wakes it with, and white light round him with red-violet in it.
  // His body is the Beast's, silver hair and all: before, he woke from Beast into Beast ("the hair gets bigger and
  // nothing else transforms", the blind critic, 3 October). He fights as Gohaku, his hair black, and the Beast's silver
  // comes up through it as he roars (`baseHair`).
  'gohaku': define({ name: 'WHITE APE', kind: 'aura', aura: [0xc8a0ff, 0xc23a7a], baseHair: 0x1a1d2a,
    flames: true, auraGlow: .3, clips: ['awaken-beast', '_Idle'] }),
  // Ippon, serious for once: he settles into a stance, and the air round him presses down, white into red.
  ippon: define({ name: 'ALL-NIGHTER', kind: 'aura', aura: [0xffd060, 0xe8402a],
    flames: true, auraGlow: .3, clips: ['awaken-serious', '_Idle'] }),
  // Sekka, WHITEOUT: one arm thrown up, then dropped into Gravedigger's wide stance, arms flung out, and
  // the Aurora Shards' ice-blue round him.
  sekka: define({ name: 'WHITEOUT', kind: 'aura', aura: [0x6a9cff, 0x1a3a9a],
    flames: true, auraGlow: .3, clips: ['awaken-high-moon', '_Idle'] }),
  // Tobari's Guardian, worn as Shiden's and Shirokane's are (3 October): his hands in a seal as the armoured warrior rises
  // round him, red-orange - the shell of Akagane's first sketch bound to Tobari's own skeleton (guardian-tobari1.glb,
  // scripts/rig_guardian.py tobari sketch-runtime), so it throws his blows with him.
  tobari: define({ name: 'CROW TENGU', kind: 'summon', aura: [0xffe6dc, 0xe8442a],
    formScale: 4.2, formTint: 0xe8502a, formOpacity: .42,
    clips: ['awaken-guardian', '_Idle'] }),
  // Akagane's WRATHFUL KING: the winged one, bound to his skeleton (guardian-akagane1.glb, rig_guardian.py akagane
  // perfect-runtime --nearest), in his own blue (in indigo the critics read Shiden's purple). Asahi breathing the
  // Sun, its fire; Levin, the strongest of his people.
  akagane: define({ name: 'WRATHFUL KING', kind: 'summon', aura: [0xd8ecff, 0x2a6ae8],
    formScale: 4.2, formTint: 0x2a62f0, formOpacity: .42,
    clips: ['awaken-guardian', '_Idle'] }),
  asahi: define({ name: 'DAYBREAK', kind: 'aura', aura: [0xffa040, 0xff4a10],
    flames: true, auraGlow: .3, clips: ['awaken-sun', '_Idle'] }),
  levin: define({ name: 'KEPPEKI', kind: 'aura', aura: [0x5ae89a, 0x0e4a2a],
    flames: true, auraGlow: .3, clips: ['awaken-captain', '_Idle'] }),
  'rook': define({ name: 'HOLLOW CROWN', kind: 'form', aura: [0xeee2ff, 0x6a3df0], formScale: 1.12,
    clips: ['awaken-rookery', '_Idle'] }),
  gaku: define({ name: 'KOMAINU', kind: 'form', aura: [0xffc83a, 0xe08a0c], formScale: 2.0, flames: true, auraGlow: .3,
    clips: ['awaken-adult', '_Idle'] }),
};

/** What the transformation changes about a move.
 *
 *  The spirit fighters replace their ultimates; Kurobi has his own move names
 *  and keeps his native attack timing. HUSH *is* the awakening,
 *  so awakened it stops being two hits with a pause in the middle and becomes
 *  what the scene is - time stops, the spirit empties a barrage into someone
 *  who cannot move, and the damage lands when the clock starts again. LORD ORO's
 *  is the mirror of KoKo's, with the steamroller as the finisher. Hawser's
 *  YUGE throws a kit that is all its own (COLOSSUS, below). Everyone
 *  else's awakened ultimate is the same move thrown by a stronger fighter,
 *  which the damage multiplier already covers. */
/** A form's own move laid over its fighter's whole: every field the fighter's move sets and the form's does not is
 *  cleared, so nothing of the one (a dash through, a guard break, a blade's reach) rides under the other body's blow. */
const whole = (base: MoveDefinition, own: MoveDefinition): Partial<MoveDefinition> => ({ ...Object.fromEntries(Object.keys(base).map(key => [key, undefined])), ...own });
const COLOSSUS_AREA = areaMoveFrom(AREA_BY_ELEMENT[HAWSER_COLOSSUS_AREA.element], HAWSER_COLOSSUS_AREA as Parameters<typeof areaMoveFrom>[1], HAWSER_COLOSSUS_AREA_LOOK);
const COLOSSUS: Partial<Record<AttackSlot, Partial<MoveDefinition>>> = {
  light: whole(MOVES.hawser.light, HAWSER_COLOSSUS_MOVES.light), heavy: whole(MOVES.hawser.heavy, HAWSER_COLOSSUS_MOVES.heavy),
  special: whole(MOVES.hawser.special, HAWSER_COLOSSUS_MOVES.special), ultimate: whole(MOVES.hawser.ultimate, HAWSER_COLOSSUS_MOVES.ultimate),
  area: whole(MOVES.hawser.area, COLOSSUS_AREA),
};
export const AWAKENED_MOVES: Partial<Record<FighterId, Partial<Record<AttackSlot, Partial<MoveDefinition>>>>> = {
  hawser: COLOSSUS,
  konta:{
    light:{name:'Homura Claw Barrage'},
    // The fox lunges from where it stands: no charge-in slide back. Round 3d
    // (PACE): its native clip (1.04 s, the bite at 0.49) played faster, the
    // bite at the same share of it.
    heavy:{name:'Homura Fang',duration:.78,contacts:[.37],cooldown:1.1,lunge:8,lungeDelay:0,chargeIn:undefined,palmHold:undefined,lockAim:undefined},
    special:{name:'Foxfire Blast'},
    ultimate:{name:'Kitsunebi-Dama'},
  },
  // Round 4b (GUMMY): in SUNRISE the barrage is a dawn barrage - his fists
  // blown up and hardened in Will, the barrage that put Saturn through the
  // buildings - on the same clock, the fists bigger (a wider line).
  gummy:{
    special:{name:'High Noon Barrage',radius:1.3},
  },
  koko: {
    ultimate: {
      // The base World is a barrage of its own now, so the awakened one is the
      // longer beating rather than the only one: eighteen GAN across the field
      // inside a stop most of a second longer (a wider one, too), then the
      // finisher as the clock starts again - two hundredths after the stop
      // ends, as the base one's. Round 3: spread over every opponent the stop
      // caught (src/game/timeStopBarrage.ts). Round 3d: the stop at 0.58 as
      // the base one's (0.85), fourteen GAN from 1.0 a seventh of a second
      // apart (eighteen from 1.1), the finisher at 3.3 (4.47): 4.2 s in all
      // against 6.4, still most of a second longer than the base World. It
      // keeps the base move's `confirm` (moveFor merges over it).
      duration: 4.2, contacts: [.58, 1, 1.15, 1.3, 1.45, 1.6, 1.75, 1.9, 2.05, 2.2, 2.35, 2.5, 2.65, 2.8, 2.95, 3.3],
      damage: 34, finisherDamage: 216, stun: .2, finisherStun: 2.3,
      knockback: 2, finisherKnockback: 18,
      timeStop: { contact: 0, duration: 2.7, radius: 6.5 },
    },
  },
  oro: {
    ultimate: {
      // A quarter of a second past KoKo's, for the steamroller (moves.ts).
      duration: 4.35, contacts: [.58, 1, 1.15, 1.3, 1.45, 1.6, 1.75, 1.9, 2.05, 2.2, 2.35, 2.5, 2.65, 2.8, 2.95, 3.3],
      damage: 34, finisherDamage: 242, stun: .2, finisherStun: 2.3,
      knockback: 2, finisherKnockback: 18,
      timeStop: { contact: 0, duration: 2.7, radius: 6.5 },
    },
  },
};

/** The move as thrown. A cast keeps whichever definition it started with, so an
 *  awakening that expires mid-move does not retime the contacts under it. */
export function moveFor(fighter: FighterId, slot: AttackSlot, awakened: boolean): MoveDefinition {
  const base = MOVES[fighter][slot];
  const change = awakened ? AWAKENED_MOVES[fighter]?.[slot] : undefined;
  return change ? { ...base, ...change } : base;
}

/** What the transformation changes about the rush stages 1..3, the same way
 *  AWAKENED_MOVES does for the four slots. Only Kurobi renames them: the fox
 *  fights with his own kit, and a string announced as clones while a
 *  nine-beast spirit throws it would be a lie. Everyone else's awakened rush
 *  is their own string thrown harder, which the damage multiplier covers. */
export const AWAKENED_RUSH: Partial<Record<FighterId, readonly (Partial<MoveDefinition> | undefined)[]>> = {
  konta: [{ name: 'Homura Swipe' }, { name: 'Foxtail Lash' }, { name: 'Foxtail Slam' }],
  // The Colossus's own string after its first fist, whole (its hooks carry them back; the Scout's cuts launch).
  hawser: rushStagesOf(HAWSER_COLOSSUS_RUSH, HAWSER_COLOSSUS_MOVES.light).map((stage, i) => whole(RUSH.hawser[i], stage)),
};

/** One stage of the light rush string, as thrown. Stage 0 is the fighter's
 *  own light (moveFor, unchanged); 1..RUSH_STAGES-1 are the follow-ups in
 *  RUSH. Like moveFor, a cast keeps the definition it started with. */
export function rushMove(fighter: FighterId, stage: number, awakened: boolean): MoveDefinition {
  if (stage <= 0) return moveFor(fighter, 'light', awakened);
  const index = Math.min(stage, RUSH_STAGES - 1) - 1;
  const base = RUSH[fighter][index];
  const change = awakened ? AWAKENED_RUSH[fighter]?.[index] : undefined;
  return change ? { ...base, ...change } : base;
}
