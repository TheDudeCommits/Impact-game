import type { FighterId } from '../game/types';
import type { AudioCue } from './cueTypes';
import { applyOriginalFamilies } from '../originals/sfx';

export type Family =
  | 'fire' | 'ice' | 'water' | 'lightning' | 'wind' | 'stone' | 'sand' | 'light' | 'dark' | 'steel' | 'string' | 'plant' | 'blast'
  | 'psychic' | 'blood' | 'petal' | 'acid' | 'gravity' | 'sonic' | 'beast'
  // And what the roster adds to them, each made of the above or of the bank: ki (Last Sun's, a void-ray, an aura blast),
  // a quake (the ground giving and the air cracking like glass), magma (fire and stone), Will thrown as a blow, rubber,
  // thrown blades, Kuon's Blue, the Dark Spark and a chainsaw.
  | 'ki' | 'quake' | 'magma' | 'will' | 'elastic' | 'knives' | 'void' | 'flash' | 'saw';

/** One sound of a layer: a cue (or interchangeable takes of it, one picked by the event), how loud, and optionally how
 *  fast it plays and how long after the layer's moment. */
export interface FamilySound { readonly cue: AudioCue | readonly AudioCue[]; readonly gain: number; readonly rate?: number; readonly after?: number }
export interface FamilyLayers {
  readonly cast: readonly FamilySound[]; readonly rush: readonly FamilySound[]; readonly hit: readonly FamilySound[]; readonly tail: readonly FamilySound[];
  /** How much of the floor's own blow goes under one of its strikes on an area move's circle, 0-1: all of it under rock
   *  and weight, some under what bursts, little under what cuts or stings, none under petals. (Every strike of every
   *  fighter had the same heavy slam and crack, a storm of petals as a meteor.) */
  readonly weight: number;
  /** It goes off where it lands: a move of it with no landing of its own keeps the bank's blast under the family's hit.
   *  The others land as a blow, and the family's hit is what it sounds like (an ice lance does not explode). */
  readonly explodes?: boolean;
}

const one = (cue: AudioCue | readonly AudioCue[], gain: number, rate?: number, after?: number): FamilySound => ({ cue, gain, ...(rate !== undefined ? { rate } : {}), ...(after !== undefined ? { after } : {}) });
const WHOOSH = ['fx-fire-whoosh-1', 'fx-fire-whoosh-2'] as const, ZAP = ['fx-zap-1', 'fx-zap-2', 'fx-zap-3'] as const, ZIP = ['fx-zip-1', 'fx-zip-2'] as const;
const BLAST = ['fx-explosion-1', 'fx-explosion-2'] as const, ENERGY = ['fx-energy-hit-1', 'fx-energy-hit-2'] as const, KI = ['fx-ki-blast-1', 'fx-ki-blast-2', 'fx-ki-blast-3'] as const;
const CUT = ['fx-cut-heavy-1', 'fx-cut-heavy-2'] as const, SWIPE = ['fx-beast-swipe-1', 'fx-beast-swipe-2'] as const, THROW = ['fx-clock-hand-knives-1', 'fx-clock-hand-knives-2'] as const;
const STUCK = ['fx-knife-hit-1', 'fx-knife-hit-2'] as const, STRETCH = ['fx-stretch-1', 'fx-stretch-2'] as const, SNAP = ['fx-snap-1', 'fx-snap-2'] as const, HEAVY = ['fx-swing-heavy-1', 'fx-swing-heavy-2'] as const;

export const FAMILIES: Readonly<Record<Family, FamilyLayers>> = {
  // ---- layered from the bank as it was
  fire: { cast: [one('fx-fire-ignite', .4)], rush: [one(WHOOSH, .42)], hit: [one('fx-fire-burst', .5)], tail: [one('fx-embers', .26)], weight: .6, explodes: true },
  lightning: { cast: [one(ZIP, .26), one(ZAP, .22)], rush: [one(ZAP, .34)], hit: [one('fx-lightning', .44), one(ZAP, .24, 1, .05)], tail: [one(ZAP, .16, 1.1, .12)], weight: .6, explodes: true },
  wind: { cast: [one(HEAVY, .34, .85)], rush: [one('fx-wind-blast', .5)], hit: [one('fx-wind-blast', .46, 1.2)], tail: [], weight: .45 },
  steel: { cast: [one('fx-draw', .3)], rush: [one('fx-slash-wave', .4)], hit: [one(CUT, .5), one('fx-sword-ring', .16, 1, .02)], tail: [], weight: .35 },
  blast: { cast: [], rush: [one('fx-ki-launch', .36)], hit: [one(BLAST, .6)], tail: [one('fx-embers', .2)], weight: 1, explodes: true },
  beast: { cast: [one(SWIPE, .44)], rush: [one('fx-beast-roar', .34)], hit: [one('fx-beast-bite', .5)], tail: [], weight: .35 },
  ki: { cast: [], rush: [one(KI, .4)], hit: [one(ENERGY, .46)], tail: [], weight: .6, explodes: true },
  elastic: { cast: [one(STRETCH, .36)], rush: [], hit: [one(SNAP, .36)], tail: [], weight: .35 },
  knives: { cast: [one(THROW, .4)], rush: [one(THROW, .34, 1.1)], hit: [one(STUCK, .56)], tail: [], weight: .3 },
  // Will thrown as a blow: the arm hardening, then the will's own blow and its black lightning (the awakening's entrance).
  will: { cast: [one('fx-will', .4)], rush: [], hit: [one('fx-enter-will', .44)], tail: [], weight: .6 },
  // ---- made for this (fx-el-*)
  ice: { cast: [one('fx-el-ice-cast', .42)], rush: [one('fx-el-ice-rush', .4)], hit: [one('fx-el-ice-hit', .56)], tail: [one('fx-el-ice-tail', .28)], weight: .5 },
  water: { cast: [one('fx-el-water-cast', .44)], rush: [one('fx-el-water-rush', .42)], hit: [one('fx-el-water-hit', .68)], tail: [one('fx-el-water-tail', .28)], weight: .5 },
  stone: { cast: [one('fx-el-stone-cast', .46)], rush: [one('fx-el-stone-cast', .34, 1.25)], hit: [one('fx-el-stone-hit', .66)], tail: [one('fx-el-stone-tail', .34)], weight: 1 },
  sand: { cast: [one('fx-el-sand-cast', .44)], rush: [one('fx-el-sand-rush', .42)], hit: [one('fx-el-sand-hit', .8)], tail: [one('fx-el-sand-tail', .3)], weight: .5 },
  light: { cast: [one('fx-el-light-cast', .4)], rush: [one('fx-el-light-rush', .42)], hit: [one('fx-el-light-hit', .74)], tail: [one('fx-el-light-tail', .26)], weight: .45, explodes: true },
  dark: { cast: [one('fx-el-dark-cast', .46)], rush: [one('fx-el-dark-cast', .3, 1.3)], hit: [one('fx-el-dark-hit', .5)], tail: [], weight: .6 },
  string: { cast: [one('fx-el-string-cast', .42)], rush: [one('fx-el-string-rush', .4)], hit: [one('fx-el-string-hit', .72)], tail: [], weight: .3 },
  plant: { cast: [one('fx-el-plant-cast', .44)], rush: [one('fx-el-plant-cast', .3, 1.3)], hit: [one('fx-el-plant-hit', .76)], tail: [], weight: .35 },
  psychic: { cast: [one('fx-el-psy-cast', .42)], rush: [one('fx-el-psy-cast', .3, 1.2)], hit: [one('fx-el-psy-hit', .58)], tail: [], weight: .5 },
  blood: { cast: [one('fx-el-blood-rush', .36, .85)], rush: [one('fx-el-blood-rush', .4)], hit: [one('fx-el-blood-hit', .7)], tail: [], weight: .2 },
  petal: { cast: [one('fx-el-petal-cast', .5)], rush: [one('fx-el-petal-rush', .5)], hit: [one('fx-el-petal-hit', .8)], tail: [one('fx-el-petal-cast', .24, .8)], weight: 0 },
  acid: { cast: [one('fx-el-acid-cast', .42)], rush: [one('fx-el-acid-cast', .3, 1.2)], hit: [one('fx-el-acid-hit', .58)], tail: [], weight: .2 },
  gravity: { cast: [one('fx-el-grav-cast', .46)], rush: [], hit: [one('fx-el-grav-hit', .52)], tail: [], weight: 1 },
  sonic: { cast: [one('fx-el-sonic-cast', .42)], rush: [], hit: [one('fx-el-sonic-hit', .64)], tail: [], weight: .35 },
  // ---- made of two of the above
  // A quake: the ground giving, and the air itself cracking like glass where the blow lands (the bank's shatter).
  quake: { cast: [one('fx-el-stone-cast', .46)], rush: [], hit: [one('fx-guard-shatter', .4), one('fx-el-stone-hit', .56)], tail: [one('fx-el-stone-tail', .3)], weight: 1 },
  // Magma: it burns and it is rock.
  magma: { cast: [one('fx-fire-ignite', .36), one('fx-el-stone-cast', .34)], rush: [one(WHOOSH, .4)], hit: [one('fx-fire-burst', .46), one('fx-el-stone-hit', .46)], tail: [one('fx-embers', .24)], weight: 1, explodes: true },
  // The Dark Spark: hex energy drawn in, and space cracking black on the blow (the bank's own).
  flash: { cast: [one('fx-el-dark-cast', .4)], rush: [], hit: [one('fx-dark-spark', .46), one('fx-el-dark-hit', .36)], tail: [], weight: .6 },
  // A chainsaw on its chain (the bank's own, Kuzu's): the engine revving out, and the bar grinding in.
  saw: { cast: [one('fx-kuzu-rev', .36)], rush: [], hit: [one(['fx-kuzu-saw-1', 'fx-kuzu-saw-2'], .56)], tail: [], weight: .35 },
  // Blue: the pull of it (the bank's own, Kuon's) and what it crushes.
  void: { cast: [one('fx-blue', .4)], rush: [], hit: [one('fx-el-grav-hit', .5)], tail: [], weight: .8 },
};

/** What a row holds: a family, or null (see the header). */
type F = Family | null;
/** Every fighter's heavy, special, ultimate and area move, in that order. The area move always has a family: it is the
 *  slot that had one sound for everybody. */
export const MOVE_FAMILY: Readonly<Record<FighterId, readonly [heavy: F, special: F, ultimate: F, area: Family]>> = {
  // ----- Dust Sea
  gummy: [null, null, null, 'blast'],                        // Rubber: his own rubber sounds; Monsoon's giant fists land as a chain of blasts
  kenzo: [null, null, null, 'wind'],                          // his own blades; Oni Wind: Great Sandspout is a twister of cuts
  kosho: [null, 'fire', 'fire', 'fire'],                     // Ember Leg burns
  kagari: ['fire', 'fire', 'fire', 'fire'],
  ward: [null, null, null, 'psychic'],                        // ROOM is his own; Takt lifts the ground with it
  sorayomi: [null, 'wind', 'lightning', 'lightning'],            // Gust Spinner, Storm Warning, Zeus
  strix: ['steel', 'steel', 'steel', 'steel'],
  'basilissa': ['stone', 'light', 'stone', 'light'],       // her kicks turn what they strike to stone; Sandrose Volley and Gaze of the Stone Rose are light
  gorai: [null, 'wind', 'lightning', 'fire'],                // Grog Gale's wind scythes, TIMBER: The Forest Falls, Wyrm Breath
  haldor: ['steel', 'quake', 'quake', 'water'],          // the bisento; the tremor; Groundswell Quake heaves the open sea up round them
  sorrel: ['steel', 'will', 'will', 'will'],
  dorado: ['will', 'will', 'will', 'will'],
  aqrab: ['sand', 'sand', 'sand', 'sand'],
  tsubute: ['plant', 'fire', 'plant', 'plant'],                // pop greens, and the Far Bank
  'psyche': ['petal', 'petal', 'petal', 'petal'],        // limbs blooming in petals
  tokan: ['ice', 'ice', 'ice', 'ice'],
  strappado: ['string', 'string', 'string', 'string'],
  barrow: ['quake', 'dark', 'quake', 'dark'],            // both fruits: the tremor and the dark; Wrecker's Haul is a well of it
  senko: ['light', 'light', 'light', 'light'],
  buna: [null, 'wind', 'lightning', 'ice'],                // Heartshake, TIMBER: The Forest Falls, Cold Snap
  oyashio: ['water', 'water', 'water', 'water'],
  adad: ['lightning', 'lightning', 'lightning', 'lightning'],
  shakugo: ['magma', 'magma', 'magma', 'magma'],
  // ----- Konta
  konta: [null, null, null, 'wind'],                        // the Senpugan is his own; a barrage of them is wind
  shiden: [null, null, 'lightning', 'fire'],                 // Shrike Bolt and Black Pyre are his own; Thunder Lord's Arrow; the Great Fireball
  shirokane: [null, null, null, 'water'],                      // the Sickle Bolt is his own; the Great Waterfall
  tobari: ['psychic', null, 'psychic', 'fire'],              // a crow clone and Red Moon Reverie are in the mind; Black Pyre is his own
  akagane: [null, 'fire', 'stone', 'fire'],                   // Cinder Art: Burning Sea; Heaven's Anvil is a meteor
  minase: ['wind', 'light', 'light', 'wind'],                // the Senpugan; the Relay Leap is a flash
  ume: ['stone', null, 'stone', 'stone'],                 // what her fist does to the ground
  kusushi: ['stone', 'stone', 'stone', 'acid'],              // the same strength; Katsuyu's acid
  hakushi: ['wind', 'fire', 'fire', 'acid'],                 // his Senpugan; toad oil and flame; a toad's stomach
  suzuran: ['ki', 'wind', 'beast', 'ki'],                     // the Gentle Fist's chi; a vacuum palm; the twin lions
  amagoi: ['gravity', 'gravity', 'gravity', 'gravity'],        // Cloudburst, Calling Water, Ash Moon
  'madake': ['wind', 'wind', 'blast', 'wind'],            // air struck so hard it is a weapon
  // ----- Cinder Requiem
  nigo: ['steel', null, null, 'steel'],                    // the Nightfang and NIGHTFALL are his own
  shiun: ['psychic', 'ki', 'dark', 'lightning'],             // False Encore, a hymn volley, BLACK CONFESSIONAL, a thunder hymn
  shidare: ['petal', 'petal', 'petal', 'petal'],
  onigawara: ['steel', 'steel', 'steel', 'steel'],
  irbis: ['beast', 'ki', 'beast', 'knives'],              // claws; the Crown Blast; BARED FANGS's needles in a hail
  hinomoto: ['fire', 'fire', 'magma', 'fire'],                // Old Fire; Funeral Pyre's pillars of flame break up through the ground
  shijima: ['ice', 'ice', 'ice', 'fire'],                      // Snowfall; Sokatsui is blue fire
  mikage: [null, 'lightning', 'lightning', 'lightning'],   // HACKLES UP
  // ----- Hex Fallout
  kuon: [null, null, null, 'void'],                          // Blue, Red and Purple are his own; Hex: Collapse
  magatsu: ['steel', 'steel', 'steel', 'fire'],               // Cleave and Flaying Cut; Calamity Pyre burns
  tempo: ['dark', 'blood', 'flash', 'flash'],                 // hex energy; Piercing Blood; the Dark Spark
  akaito: ['steel', 'sonic', 'dark', 'dark'],                  // Whispered Vow; Ghost Bride
  sashigane: ['steel', 'stone', 'steel', 'steel'],              // Collapse breaks what is round him
  chohan: ['steel', 'steel', 'steel', 'steel'],
  // ----- Salvage Wilds
  gaku: ['ki', 'ki', 'ki', 'ki'],
  setsu: [null, null, null, 'lightning'],                   // his own lightning
  unari: ['elastic', 'knives', 'elastic', 'petal'],         // Bungee Gum; a card thrown; a storm of cards flutters and cuts as petals do
  bonsho: [null, 'light', 'light', 'light'],                 // the Guanyin's golden hands
  imago: ['beast', 'ki', 'ki', 'light'],                    // the tail; Photon
  // ----- Last Sun
  taisei: [null, null, null, 'ki'],
  ouga: [null, null, null, 'ki'],
  shanxiao: [null, 'ki', 'ki', 'ki'],
  'wuming': ['ki', 'ki', 'ki', 'light'],                 // Lotus Verdict: columns of divine light
  jirenga: ['ki', 'ki', 'ki', 'ki'],
  'jinlin': [null, 'ki', 'ki', 'ki'],
  'gohaku': [null, 'ki', 'ki', 'ki'],
  // ----- Beacon Ward
  ampere: ['wind', 'wind', 'wind', 'stone'],                   // smashes that move the air; the Good Hope Drop craters
  pyroclast: ['blast', 'blast', 'blast', 'blast'],
  tancho: ['fire', 'ice', 'ice', 'blast'],                 // Snowmelt Rupture: the frozen air heated all at once
  bellows: ['fire', 'fire', 'fire', 'fire'],
  'full-beam': ['wind', 'wind', 'wind', 'wind'],
  // ----- Black Snow
  asahi: ['steel', 'water', 'fire', 'water'],              // Tide Breath; Lantern Rite: First Light
  yodaka: ['fire', 'fire', 'fire', 'fire'],
  sekka: [null, 'wind', 'blast', 'ice'],                     // Air Type; Shatter Art: Black Blizzard; his snowflake drawn on the floor, and everything on it shattering
  // ----- Blast Radius
  ippon: [null, null, 'blast', 'stone'],                   // the Dust Allergy is his own; the Table Flip
  torsion: ['psychic', 'stone', 'wind', 'wind'],           // her mind's grip; rubble thrown; the Tornado of Terror
  hagure: ['water', 'wind', null, 'wind'],                    // Snap Bite Rock Smashing Fist; Whirlwind Iron Cutting Fist
  // ----- Ropewalk
  hawser: ['blast', 'steel', 'steel', 'steel'],                // the Scout: a Fuse Lance, and steel (the YUGE's are FORM_FAMILY's)
  levin: ['blast', 'steel', 'steel', 'steel'],                // a Fuse Lance
  mizuhiki: ['steel', 'steel', 'steel', 'steel'],
  // ----- The Seven Deadly Sins
  lanthorn: ['dark', 'fire', 'dark', 'steel'],               // Full Counter; LAMPBLACK; Closing Time cuts
  highsun: ['fire', 'fire', 'light', 'light'],               // the sun
  // ----- Scrap Pact
  kuzu: [null, null, null, 'saw'],                          // the saws are his own, and so is the lasso's
  kubiwa: ['psychic', 'psychic', 'psychic', 'gravity'],      // an order; a bell of pressure closing over the circle
  // ----- Red Cradle
  rotfalke: [null, 'light', null, 'beast'],
  murex: [null, 'light', 'light', 'light'],
  akayuri: ['steel', 'steel', 'steel', 'steel'],
  hisame: ['ice', 'ice', 'ice', 'ice'],
  cardo: ['steel', 'dark', 'dark', 'steel'],
  bruin: ['dark', 'dark', 'dark', 'void'],
  aquilo: ['wind', 'wind', 'wind', 'wind'],
  svanhild: ['water', 'water', 'water', 'water'],
  // ----- Slag Hill
  'shakudo': ['steel', 'stone', 'stone', 'stone'],
  'shibuichi': [null, 'stone', 'stone', 'light'],       // transmuted stone; a transmutation circle, and the reaction's light rising out of it
  // ----- the rest
  koko: [null, null, null, 'stone'],                       // Iron Spirit is his own; the Ground Smash
  oro: [null, null, null, 'knives'],                         // DEAD STOP is his own; a barrage of knives
  kinu: ['string', null, 'string', 'string'],              // her puppet's thread
  gosu: [null, null, 'light', 'knives'],                   // things mending in light; a bearing shot
  gaunt: [null, null, null, 'knives'],                        // the Dragon Slayer and the cannon are his own; crossbow bolts
  vesper: ['steel', 'steel', 'dark', 'wind'],              // the offering; a flock of white hawks streaming in on their own wind
  'rook': ['steel', 'psychic', 'dark', 'dark'],       // daggers; Grave Grip; the shadows
  'rakucho': ['blood', 'blood', 'blood', 'blood'],        // the tendril
  hikui: ['fire', 'steel', 'fire', 'fire'],                   // the Darkness Flame, and its dragon
  'ovid': [null, 'blast', 'blast', 'stone'],           // shockwaves; the Wrecking Ball
  wataame: [null, null, null, 'blast'],                      // a wooden sword and no energy; a Justaway goes off
};

applyOriginalFamilies(MOVE_FAMILY);

/** A form whose moves are another body's, awakened: the YUGE's fists are plain blows, its rampage ends hardened
 *  and its area move is the uprooting (what adult Hawser's row was). */
const FORM_FAMILY: Readonly<Partial<Record<FighterId, readonly [heavy: F, special: F, ultimate: F, area: Family]>>> = {
  hawser: [null, null, 'stone', 'stone'],
};
const SLOT = { heavy: 0, special: 1, ultimate: 2, area: 3 } as const;
/** `fighter`'s move's family, or null: a light, a plain blow, a move with its own sound, a fighter the table does not know. */
export function familyOf(fighter: FighterId, slot: string, awakened = false): Family | null {
  const row = (awakened ? FORM_FAMILY[fighter] : undefined) ?? MOVE_FAMILY[fighter], index = SLOT[slot as keyof typeof SLOT];
  return row && index !== undefined ? row[index] : null;
}

const cuesOf = (family: Family): AudioCue[] => {
  const layers = FAMILIES[family];
  return [...layers.cast, ...layers.rush, ...layers.hit, ...layers.tail].flatMap(sound => typeof sound.cue === 'string' ? [sound.cue] : [...sound.cue]);
};
/** Every cue `fighter`'s moves' families play (a room fetches the made ones by need: audio/roomCues.ts). */
export function familyCues(fighter: FighterId): AudioCue[] {
  const row = [...MOVE_FAMILY[fighter] ?? [], ...FORM_FAMILY[fighter] ?? []];
  return row ? [...new Set(row.filter((f): f is Family => !!f).flatMap(cuesOf))] : [];
}
