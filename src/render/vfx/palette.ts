import type { AttackSlot, FighterId } from '../../game/types';
import type { ComboKey } from '../../game/combos';
import { applyCompanionSparks } from '../../originals/companionLooks';
import { applyMinaseSparks } from '../../originals/minaseSparks';

/** What a blow is made of, as the three colours an impact is drawn in.
 *
 *  `spike` is the body of the starburst and the streaks, `rim` the saturated
 *  colour the spikes cool to at their tips and the rings are drawn in, and
 *  `light` the colour the dynamic light throws on the floor and the fighters.
 *  The hot white core is shared: every impact in the roster flashes white for
 *  its first frames, and the element is what it cools into. Every hit used to
 *  land in the same orange, and every energy light was the same blue whether
 *  the move was fire, lightning or a spirit. */
export interface Element { spike: number; rim: number; light: number; ink: number }

const E = (spike: number, rim: number, light = rim, ink = 0x10131a): Element => ({ spike, rim, light, ink });

/** A plain fist: the white-gold of concept 0's punch. */
export const PHYSICAL = E(0xffe45c, 0xff8a14, 0xffc873);
const KI_BLUE = E(0xbff4ff, 0x08baff, 0x46c3ff);
const KI_GOLD = E(0xfff3b0, 0xffb21e, 0xffc84a);
const KI_PURPLE = E(0xf0d6ff, 0x9a3cff, 0xa860ff);
const CHI_BLUE = E(0xd6f7ff, 0x2fb8ff, 0x5fd4ff);
const CHI_ORANGE = E(0xfff0c2, 0xff8a1c, 0xffa040);
const LIGHTNING = E(0xf2fbff, 0x5aa8ff, 0x9fd0ff, 0x0c1426);
const FIRE = E(0xfff1b0, 0xff4a1e, 0xff7a2a, 0x1c0a04);
const WILL = E(0xffe2c8, 0xf0321c, 0xff5a3a, 0x16050a);
const SLASH_GREEN = E(0xeafff0, 0x3fd97a, 0x9cf0b0, 0x08140c);
const BLACK_RED = E(0xffd2d8, 0xe0142e, 0xff3048, 0x050103);
const SPIRIT_PURPLE = E(0xf0e2ff, 0x9d63ff, 0xb48cff, 0x120a24);
const SPIRIT_GOLD = E(0xfff4c2, 0xf2b01e, 0xffd24a, 0x1a1204);
const HEX_BLUE = E(0xd8f6ff, 0x2ec4ff, 0x46d8ff, 0x061020);
const HEX_PURPLE = E(0xffd8fb, 0xb03cff, 0xd050ff, 0x14061c);
const ROOM_BLUE = E(0xdaf6ff, 0x3f9dff, 0x7fe0ff, 0x06101e);
const SHOCK_YELLOW = E(0xfffbd0, 0xffd21e, 0xffe95a, 0x1a1404);
const STEEL = E(0xf4f8ff, 0xb8c8d8, 0xdfe8f0, 0x10141a);
const SPIRIT = E(0xe2fbff, 0x2d9bff, 0x6fd8ff, 0x06142a);
const BEAST_VIOLET = E(0xefe2ff, 0x8d4dff, 0x9b64ff, 0x0e0620);
const CURSED_RED = E(0xffe0d8, 0xff2a1e, 0xff4a36, 0x1c0404);
const VOID_SICKLE_VIOLET = E(0xf0e0ff, 0x7a3cff, 0x9a6cff, 0x0c0420);
/** The shop's fighters: Gorai's lightning is the dragon's violet, Haldor's
 *  quake is white cracking into blue, and Sorrel' Crimson Command is black
 *  lightning edged in red; Dorado's is that lightning in gold. */
const DRAGON_VIOLET = E(0xf2e8ff, 0x9a5cff, 0xb890ff, 0x0c0418);
const QUAKE_WHITE = E(0xffffff, 0x9fd0ff, 0xe4f2ff, 0x0a1220);
const COMMAND_RED = E(0xffe2e2, 0xd0102a, 0xff2a3a, 0x060002);
/** Dorado's: the same black lightning, run through with gold. */
const HORIZON_GOLD = E(0xfff4d6, 0xe0a020, 0xffcf4a, 0x080400);
/** Shiun's pressure is pale seraph's violet; BLACK CONFESSIONAL is a coffin of black in it. */
const PALE_GEM = E(0xf4ecff, 0x8a3cff, 0xb48cff, 0x0a0414);
const BLACK_CONFESSIONAL = E(0xe8dcff, 0x3a0a6a, 0x7a3cff, 0x020006);
/** Magatsu's cuts are crimson; Calamity Pyre is fire. */
const CURSE = E(0xffd8dc, 0xd81f3a, 0xff4a5a, 0x120204);
const CALAMITY_PYRE = E(0xfff0c0, 0xff5a1e, 0xff8a3a, 0x1c0604);
/** Vesper's sabre is white steel with the hawk's silver-blue in it; the offering is a black sun ringed in
 *  violet, as Black Vespers's dark is. */
const PALE_FALCON = E(0xffffff, 0xa9c4ff, 0xe4ecff, 0x0a0e18);
/** Round 4b (GUMMY): SUNRISE - white, a warm rim, a cartoon's ink. */
const SUNRISE_WHITE = E(0xffffff, 0xffd98a, 0xfff2d6, 0x120a04);
const ECLIPSE = E(0xeee2ff, 0x4a2a8a, 0x8a5cff, 0x020006);
/** Imago's aura is jade; the final molt comes down in it, brighter. */
const ROYAL_JADE = E(0xeafff2, 0x2fd07a, 0x8af0b8, 0x041a0e);
const DECREE = E(0xf4fff8, 0x3ae88a, 0xb8ffd8, 0x02100a);
/** Wuming's ki is rose over black. */
const ROSE = E(0xffe2f6, 0xe83aa8, 0xff8ad8, 0x14020e);
/** Jirenga's power is red. */
const PRIDE_RED = E(0xffe2dc, 0xe8202a, 0xff5a4a, 0x140204);
/** 'Emperor Jinlin': the gold of him, his death beams' magenta, and the Drowned Sun's red. */
const GOLDEN = E(0xfff4cc, 0xffb21e, 0xffd86a, 0x140e02);
const PEARL_NEEDLE = E(0xffe8fb, 0xd82ab0, 0xff6ad8, 0x12020e);
const DROWNED_SUN = E(0xffe2cc, 0xff4a12, 0xff8a3a, 0x1a0602);
/** Gohaku: white with the red-violet of the Beast in it; the Star-Shifting Beam's yellow, and the Sun-Seizing Spiral's
 *  gold bored through with violet. */
const BEAST = E(0xf6f2ff, 0xc23a7a, 0xe08ad0, 0x10040c);
const STAR_BEAM = E(0xfffbe0, 0xffd21e, 0xffe46a, 0x140f02);
const BEAM_CANNON = E(0xfff4d6, 0xffae1e, 0xc890ff, 0x12060e);
/** Ippon: his punches white into yellow, and the Clean Slate white into red. */
const PLAIN_PUNCH = E(0xfffbe8, 0xffd23a, 0xfff0a0, 0x14100a);
const CLEAN_SLATE = E(0xffffff, 0xff4a2a, 0xffb080, 0x140404);
/** Sekka: Gravedigger's pink, and the frost stance's ice-blue. */
const DESTRUCTIVE = E(0xfff0f4, 0xff4a8a, 0xff9ac0, 0x14040a);
const COMPASS = E(0xeaf4ff, 0x4a7aff, 0x9ab8ff, 0x060a1a);
/** Tobari: the Red Eye's red, Black Pyre's black flame (lit by its violet edge), and Red Moon Reverie's red moon. */
const RED_EYE = E(0xffe6e6, 0xe8202e, 0xff6a6a, 0x140204);
const BLACK_FLAME = E(0xe8d6ff, 0x3a0a4a, 0x7a3a9a, 0x020004);
/** Akagane: the Crow Clan's red, the Cinder Art: Burning Sea's fire, the meteor's burning rock and the Guardian's blue. */
const CROW_CLAN = E(0xffe2e2, 0xc8202e, 0xff5a5a, 0x120203);
const MAJESTIC = E(0xfff2c8, 0xff6a1a, 0xffa040, 0x1a0602);
const METEOR = E(0xffe8c0, 0xd2581c, 0xff9a40, 0x140602);
const GUARDIAN_BLUE = E(0xece6ff, 0x5b4ae8, 0x9a8cff, 0x060418);
/** Asahi: Tide Breath's blue and white; the Sun's fire. */
const WATER = E(0xf0fbff, 0x2e8cff, 0x8ad0ff, 0x02101e);
const SUN_FIRE = E(0xfff4c8, 0xff5a1f, 0xffb040, 0x1a0602);
/** Levin: the blades' steel, under the Slipped Moorings's green. */
const WINGS_STEEL = E(0xf4fff8, 0x4aa874, 0xc8f0d8, 0x06140c);
/** Rook: the shadows' violet. */
const SHADOW = E(0xf0e8ff, 0x6a3df0, 0xa88aff, 0x08021a);
/** Gaku's aura: the Landslide's gold. */
const AURA = E(0xfff6d2, 0xf0a018, 0xffd062, 0x160c02);

/** Per fighter, per slot. Awakened overrides follow below: gold awakening is
 *  gold, Kurobi is orange chi, and so on. */
const TABLE: Record<FighterId, Record<Exclude<AttackSlot, 'area'>, Element>> = {
  chohan:{light:E(0xe8f0ec,0x9aa7a2,0x171d24),heavy:E(0xe8f0ec,0x9aa7a2,0x171d24),special:E(0xe8f0ec,0x9aa7a2,0x171d24),ultimate:E(0xe8f0ec,0x9aa7a2,0x171d24)},
  aqrab:{light:E(0xf5e7c9,0xc99b55,0x81643c),heavy:E(0xf5e7c9,0xc99b55,0x81643c),special:E(0xf5e7c9,0xc99b55,0x81643c),ultimate:E(0xf5e7c9,0xc99b55,0x81643c)},
  tsubute:{light:E(0xeaffc5,0x83b442,0x365822),heavy:E(0xeaffc5,0x83b442,0x365822),special:E(0xeaffc5,0x83b442,0x365822),ultimate:E(0xeaffc5,0x83b442,0x365822)},
  ume:{light:E(0xffe6f1,0xf397c3,0x593849),heavy:E(0xffe6f1,0xf397c3,0x593849),special:E(0xffe6f1,0xf397c3,0x593849),ultimate:E(0xffe6f1,0xf397c3,0x593849)},
  lanthorn:{light:E(0xf7eaff,0x9d4fed,0x130d20),heavy:E(0xf7eaff,0x9d4fed,0x130d20),special:E(0xf7eaff,0x9d4fed,0x130d20),ultimate:E(0xf7eaff,0x9d4fed,0x130d20)},
  highsun:{light:E(0xfff4ce,0xffba43,0xee6318),heavy:E(0xfff4ce,0xffba43,0xee6318),special:E(0xfff4ce,0xffba43,0xee6318),ultimate:E(0xfff4ce,0xffba43,0xee6318)},
  torsion:{light:E(0xeaffef,0x5dffac,0x6c847a),heavy:E(0xeaffef,0x5dffac,0x6c847a),special:E(0xeaffef,0x5dffac,0x6c847a),ultimate:E(0xeaffef,0x5dffac,0x6c847a)},
  kubiwa:{light:E(0xffedce,0xd69b47,0x782822),heavy:E(0xffedce,0xd69b47,0x782822),special:E(0xffedce,0xd69b47,0x782822),ultimate:E(0xffedce,0xd69b47,0x782822)},
  onigawara:{light:E(0xffedba,0xffbd27,0x23170b),heavy:E(0xffedba,0xffbd27,0x23170b),special:E(0xffedba,0xffbd27,0x23170b),ultimate:E(0xffedba,0xffbd27,0x23170b)},
  cardo:{light:E(0xb82418,0x340807,0x020202),heavy:E(0xb82418,0x340807,0x020202),special:E(0xb82418,0x340807,0x020202),ultimate:E(0xb82418,0x340807,0x020202)},
  minase:{light:E(0xffedbd,0xffcf50,0x967128),heavy:E(0xe7fbff,0x4bd6ff,0x3290ba),special:E(0xffedbd,0xffcf50,0x967128),ultimate:E(0xe7fbff,0x4bd6ff,0x967128)},
  aquilo:{light:E(0xf2f9ff,0xa8d8ee,0x24506a),heavy:E(0xf2f9ff,0xa8d8ee,0x24506a),special:E(0xf2f9ff,0xa8d8ee,0x24506a),ultimate:E(0xf6fff8,0x8ff0b4,0x1c6b47)},
  'psyche':{light:E(0xffeaf7,0xf8b7de,0x834985),heavy:E(0xfff0fa,0xd58db8,0x522a54),special:E(0xffeaf7,0xf8b7de,0x834985),ultimate:E(0xfff0fa,0xd58db8,0x522a54)},
  'ovid':{light:E(0xe7fff8,0x57d7bd,0x10221f),heavy:E(0xf3fff5,0x61ead0,0x10221f),special:E(0xd2fff0,0x57d7bd,0x10221f),ultimate:E(0xf0fff7,0x61ead0,0x10221f)},
  // Scout Hawser's blades: the regiment's steel, as Levin's (below). The YUGE's blows are FORM_TABLE's.
  hawser:{light:E(0xf4fff8,0x4aa874,0xc8f0d8,0x06140c),heavy:E(0xf4fff8,0x4aa874,0xc8f0d8,0x06140c),special:E(0xf4fff8,0x4aa874,0xc8f0d8,0x06140c),ultimate:E(0xf4fff8,0x4aa874,0xc8f0d8,0x06140c)},
  rotfalke:{light:E(0xfff1d0,0xff9a30,0x281419),heavy:E(0xfff1d0,0xf02b32,0x281419),special:E(0xfff1d0,0xff9a30,0x281419),ultimate:E(0xfff1d0,0xf02b32,0x281419)},
  bonsho:{light:E(0xfff1c0,0xe5bd54,0x47311a),heavy:E(0xfff1c0,0xe5bd54,0x47311a),special:E(0xfff1c0,0xe5bd54,0x47311a),ultimate:E(0xfff1c0,0xe5bd54,0x47311a)},
  murex:{light:E(0xf5e6ff,0x9b5ce4,0x201129),heavy:E(0xffe6a3,0xffab38,0x291221),special:E(0xffe6a3,0xffab38,0x291221),ultimate:E(0xffe6a3,0xf36b28,0x291221)},
  kinu:{light:E(0xf4fff5,0x6fdadd,0x131925),heavy:E(0xf4fff5,0x88db9e,0x131925),special:E(0xf4fff5,0x6fdadd,0x131925),ultimate:E(0xf4fff5,0x88db9e,0x131925)},
  'madake':{light:E(0xf2ffff,0x85d8ed,0x10272b),heavy:E(0xf2ffff,0x85d8ed,0x10272b),special:E(0xf2ffff,0x85d8ed,0x10272b),ultimate:E(0xffb4a0,0xe73a3e,0x250a0c)},
  akayuri:{light:E(0xffbbbd,0xef2148,0x170b18),heavy:E(0xffbbbd,0xef2148,0x170b18),special:E(0xffbbbd,0xef2148,0x170b18),ultimate:E(0xffeceb,0xef2148,0x170b18)},
  hagure:{light:E(0xc4f3ff,0x2696ec,0x140d18),heavy:E(0xc4f3ff,0x2696ec,0x140d18),special:E(0xc4f3ff,0x2696ec,0x140d18),ultimate:E(0xc4f3ff,0x9b8cff,0x140d18)},
  hisame:{light:E(0xf0fbff,0x91dfff,0x326da7),heavy:E(0xf0fbff,0x91dfff,0x326da7),special:E(0xf0fbff,0x91dfff,0x326da7),ultimate:E(0xf0fbff,0x91dfff,0x326da7)},
  svanhild:{light:E(0xf3fcff,0x5ec8ff,0x0b4a8c),heavy:E(0xf3fcff,0x5ec8ff,0x0b4a8c),special:E(0xf3fcff,0x5ec8ff,0x0b4a8c),ultimate:E(0xf3fcff,0x5ec8ff,0x0b4a8c)},
  mizuhiki:{light:E(0xf5fbff,0xb8cdd8,0x354652),heavy:E(0xf5fbff,0xb8cdd8,0x354652),special:E(0xf5fbff,0xb8cdd8,0x354652),ultimate:E(0xf5fbff,0xb8cdd8,0x354652)},
  'shibuichi':{light:E(0xf6fbff,0x8197a3,0x303d45),heavy:E(0xf6fbff,0x8197a3,0x303d45),special:E(0xd9ffff,0x66ddeb,0x284c5c),ultimate:E(0xd9ffff,0x66ddeb,0x284c5c)},
  'rakucho':{light:E(0xffb7cb,0xbc2456,0x140d18),heavy:E(0xffb7cb,0xbc2456,0x140d18),special:E(0xffb7cb,0xbc2456,0x140d18),ultimate:E(0xffe2ec,0xbc2456,0x140d18)},
  irbis:{light:E(0xf3ffff,0x49c9e9,0x124b66),heavy:E(0xf3ffff,0x49c9e9,0x124b66),special:E(0xffffff,0x25d7f2,0x10405e),ultimate:E(0xffffff,0x25d7f2,0x10405e)},
  shidare:{light:E(0xffeff8,0xf794ca,0x43294b),heavy:E(0xffeff8,0xf794ca,0x43294b),special:E(0xffeff8,0xf794ca,0x43294b),ultimate:E(0xffffff,0xffdbea,0x43294b)},
  yodaka:{light:E(0xfff5d3,0xffb441,0xe84b26),heavy:E(0xfff5d3,0xffb441,0xe84b26),special:E(0xfff5d3,0xffb441,0xe84b26),ultimate:E(0xfff5d3,0xffb441,0xe84b26)},
  hinomoto:{light:E(0xfff5d3,0xffc14c,0x6b554b),heavy:E(0xfff5d3,0xff571c,0x341c13),special:E(0xfff5d3,0xff571c,0x341c13),ultimate:E(0xfff5d3,0xff571c,0x341c13)},
  amagoi:{light:E(0xe5dfee,0x62586b,0x181222),heavy:E(0xf3eefa,0xab8fd4,0x181222),special:E(0xf3eefa,0xab8fd4,0x181222),ultimate:E(0xf3eefa,0xab8fd4,0x181222)},
  'shakudo':{light:E(0xf6fbff,0xb8d6e4,0x627181),heavy:E(0xe7fbff,0x62cfff,0x466b86),special:E(0xe7fbff,0x62cfff,0x9a8972),ultimate:E(0xe7fbff,0x62cfff,0x9a8972)},
  hikui:{light:E(0xcfacff,0x8053b9,0x171121),heavy:E(0xcfacff,0x8053b9,0x171121),special:E(0xcfacff,0x8053b9,0x171121),ultimate:E(0xcfacff,0x8053b9,0x171121)},
  tokan:{light:E(0xe9faff,0x83c7e7,0x306b9e),heavy:E(0xe9faff,0x83c7e7,0x306b9e),special:E(0xe9faff,0x83c7e7,0x306b9e),ultimate:E(0xe9faff,0x83c7e7,0x306b9e)},
  strappado:{light:E(0xfffaf1,0xf074ad,0x301425),heavy:E(0xfffaf1,0xf074ad,0x301425),special:E(0xfffaf1,0xf64d47,0x301425),ultimate:E(0xfffaf1,0xf074ad,0x301425)},
  unari:{light:E(0xffd9f2,0xf072cc,0x3c123f),heavy:E(0xffd9f2,0xf072cc,0x3c123f),special:E(0xfffcf7,0xf072cc,0x3c123f),ultimate:E(0xffd9f2,0xf072cc,0x3c123f)},
  barrow:{light:E(0xb074e5,0x41165e,0x100917),heavy:E(0xf1fbff,0x89c9e0,0x556577),special:E(0xb074e5,0x41165e,0x100917),ultimate:E(0xf1fbff,0x89c9e0,0x41165e)},
  sashigane:{light:E(0xdff5c2,0x78c6b0,0x556577),heavy:E(0xdff5c2,0x78c6b0,0x556577),special:E(0xdff5c2,0x78c6b0,0x556577),ultimate:E(0xdff5c2,0x78c6b0,0x556577)},
  gosu:{light:E(0xffd9ef,0x80dcf2,0x556577),heavy:E(0xffd9ef,0x80dcf2,0x556577),special:E(0xffd9ef,0x80dcf2,0x556577),ultimate:E(0xffd9ef,0x80dcf2,0x556577)},
  kusushi:{light:E(0xebfff7,0x63efb3,0x51765f),heavy:E(0xebfff7,0x63efb3,0x55545d),special:E(0xebfff7,0x63efb3,0x55545d),ultimate:E(0xebfff7,0x63efb3,0x55545d)},
  hakushi:{light:E(0xf3faff,0x99be8b,0x51765f),heavy:E(0xf3faff,0x59baff,0x2b5ca0),special:E(0xffdc60,0xf46e26,0xb93021),ultimate:E(0xffdc60,0xf46e26,0xb93021)},
  suzuran:{light:E(0xe8faff,0x9abdf5,0x5c97d5),heavy:E(0xe8faff,0x9abdf5,0x5c97d5),special:E(0xe8faff,0x9abdf5,0x5c97d5),ultimate:E(0xe8faff,0x9abdf5,0x5c97d5)},
  wataame:{light:E(0xf7f2df,0x9dc6e8,0x80705d),heavy:E(0xf7f2df,0x9dc6e8,0x80705d),special:E(0xf7f2df,0x9dc6e8,0x80705d),ultimate:E(0xf7f2df,0x9dc6e8,0x80705d)},
  bruin:{light:E(0x8a5ccc,0x4a1a80,0x06020c),heavy:E(0x8a5ccc,0x4a1a80,0x06020c),special:E(0x8a5ccc,0x4a1a80,0x06020c),ultimate:E(0x8a5ccc,0x4a1a80,0x06020c)},
  senko:{light:E(0xfffbe4,0xf9c238,0xffe18a),heavy:E(0xfffbe4,0xf9c238,0xffe18a),special:E(0xfffbe4,0xf9c238,0xffe18a),ultimate:E(0xfffbe4,0xf9c238,0xffe18a)},
  buna:{light:WILL,heavy:E(0xf5edff,0xc9adeb,0x8b5ed4),special:E(0xf5edff,0xc9adeb,0x8b5ed4),ultimate:E(0xf5edff,0xc9adeb,0x8b5ed4)},
  oyashio:{light:WATER,heavy:WATER,special:WATER,ultimate:E(0xe8fdff,0x42c4df,0x198bb5)},
  adad:{light:PHYSICAL,heavy:LIGHTNING,special:LIGHTNING,ultimate:E(0xeaffff,0x70d9ff,0xf9d25b)},
  akaito:{light:CURSE,heavy:CURSE,special:E(0xf4ebff,0xbda0df,0x826ba5),ultimate:E(0xf4ebff,0xbda0df,0x826ba5)},
  shijima:{light:WATER,heavy:WATER,special:WATER,ultimate:E(0xf6ffff,0x97e1ed,0xc1f4ff)},
  tempo:{light:CURSE,heavy:CURSE,special:CURSE,ultimate:E(0xfbe9e8,0xee4967,0x150305)},
  tancho:{light:WATER,heavy:FIRE,special:WATER,ultimate:E(0xe4ffff,0x58d9f3,0xa9eeff)},
  bellows:{light:FIRE,heavy:FIRE,special:FIRE,ultimate:FIRE},
  mikage:{light:PHYSICAL,heavy:LIGHTNING,special:LIGHTNING,ultimate:E(0xf4eaff,0xa663ee,0xc3a4ff)},
  taisei: { light: PHYSICAL, heavy: PHYSICAL, special: KI_BLUE, ultimate: SPIRIT },
  ouga: { light: KI_GOLD, heavy: E(0xd6f6ff, 0x2dbeff, 0x46caff), special: KI_PURPLE, ultimate: KI_GOLD },
  konta: { light: CHI_ORANGE, heavy: CHI_BLUE, special: E(0xeefcff, 0x6fd6ff, 0x9fe6ff), ultimate: BEAST_VIOLET },
  gummy: { light: WILL, heavy: WILL, special: WILL, ultimate: WILL },
  kosho: { light: FIRE, heavy: FIRE, special: FIRE, ultimate: FIRE },
  kagari: { light: FIRE, heavy: FIRE, special: FIRE, ultimate: FIRE },
  kenzo: { light: SLASH_GREEN, heavy: SLASH_GREEN, special: SLASH_GREEN, ultimate: SLASH_GREEN },
  shirokane: { light: STEEL, heavy: LIGHTNING, special: LIGHTNING, ultimate: VOID_SICKLE_VIOLET },
  shiden: { light: STEEL, heavy: LIGHTNING, special: E(0xe8d6ff, 0x5a1a9a, 0x8a4ad6, 0x040108), ultimate: E(0xf2e6ff, 0xb469ff, 0xc890ff, 0x10061c) },
  setsu: { light: LIGHTNING, heavy: LIGHTNING, special: LIGHTNING, ultimate: LIGHTNING },
  nigo: { light: BLACK_RED, heavy: BLACK_RED, special: BLACK_RED, ultimate: BLACK_RED },
  gaunt: { light: BLACK_RED, heavy: BLACK_RED, special: FIRE, ultimate: BLACK_RED },
  koko: { light: PHYSICAL, heavy: SPIRIT_PURPLE, special: SPIRIT_PURPLE, ultimate: SPIRIT_PURPLE },
  oro: { light: SPIRIT_GOLD, heavy: STEEL, special: SPIRIT_GOLD, ultimate: SPIRIT_GOLD },
  kuon: { light: HEX_BLUE, heavy: HEX_BLUE, special: HEX_PURPLE, ultimate: HEX_BLUE },
  ward: { light: ROOM_BLUE, heavy: ROOM_BLUE, special: ROOM_BLUE, ultimate: SHOCK_YELLOW },
  gorai: { light: WILL, heavy: WILL, special: E(0xeef8ff, 0x8ab8ff, 0xc0dcff, 0x0a0f1c), ultimate: DRAGON_VIOLET },
  haldor: { light: STEEL, heavy: STEEL, special: QUAKE_WHITE, ultimate: QUAKE_WHITE },
  strix: { light: SLASH_GREEN, heavy: SLASH_GREEN, special: SLASH_GREEN, ultimate: SLASH_GREEN },
  'full-beam': { light: PHYSICAL, heavy: PHYSICAL, special: QUAKE_WHITE, ultimate: QUAKE_WHITE },
  pyroclast: { light: PHYSICAL, heavy: FIRE, special: FIRE, ultimate: FIRE },
  ampere: { light: PHYSICAL, heavy: PHYSICAL, special: SLASH_GREEN, ultimate: SLASH_GREEN },
  shanxiao: { light: PHYSICAL, heavy: PHYSICAL, special: SLASH_GREEN, ultimate: SLASH_GREEN },
  kuzu: { light: STEEL, heavy: STEEL, special: STEEL, ultimate: STEEL },
  shakugo: { light: FIRE, heavy: FIRE, special: FIRE, ultimate: FIRE },
  'basilissa': { light: ROSE, heavy: WILL, special: ROSE, ultimate: ROSE },
  sorayomi: { light: STEEL, heavy: STEEL, special: WATER, ultimate: SHOCK_YELLOW },
  sorrel: { light: STEEL, heavy: COMMAND_RED, special: COMMAND_RED, ultimate: COMMAND_RED },
  dorado: { light: STEEL, heavy: HORIZON_GOLD, special: HORIZON_GOLD, ultimate: HORIZON_GOLD },
  shiun: { light: PALE_GEM, heavy: PALE_GEM, special: PALE_GEM, ultimate: BLACK_CONFESSIONAL },
  magatsu: { light: CURSE, heavy: CURSE, special: CURSE, ultimate: CALAMITY_PYRE },
  vesper: { light: PALE_FALCON, heavy: PALE_FALCON, special: PALE_FALCON, ultimate: ECLIPSE },
  imago: { light: ROYAL_JADE, heavy: ROYAL_JADE, special: ROYAL_JADE, ultimate: DECREE },
  'wuming': { light: ROSE, heavy: ROSE, special: ROSE, ultimate: ROSE },
  jirenga: { light: PRIDE_RED, heavy: PRIDE_RED, special: PRIDE_RED, ultimate: PRIDE_RED },
  'jinlin': { light: PEARL_NEEDLE, heavy: GOLDEN, special: PEARL_NEEDLE, ultimate: DROWNED_SUN },
  'gohaku': { light: BEAST, heavy: BEAST, special: STAR_BEAM, ultimate: BEAM_CANNON },
  ippon: { light: PLAIN_PUNCH, heavy: PLAIN_PUNCH, special: PLAIN_PUNCH, ultimate: CLEAN_SLATE },
  sekka: { light: DESTRUCTIVE, heavy: DESTRUCTIVE, special: COMPASS, ultimate: DESTRUCTIVE },
  tobari: { light: RED_EYE, heavy: RED_EYE, special: BLACK_FLAME, ultimate: RED_EYE },
  akagane: { light: CROW_CLAN, heavy: CROW_CLAN, special: MAJESTIC, ultimate: METEOR },
  asahi: { light: WATER, heavy: WATER, special: WATER, ultimate: SUN_FIRE },
  levin: { light: WINGS_STEEL, heavy: WINGS_STEEL, special: WINGS_STEEL, ultimate: WINGS_STEEL },
  'rook': { light: SHADOW, heavy: SHADOW, special: SHADOW, ultimate: SHADOW },
  gaku: { light: AURA, heavy: AURA, special: AURA, ultimate: AURA },
};
applyCompanionSparks(TABLE);
applyMinaseSparks(TABLE);

/** A form with a kit of its own lands every slot in its own colours, awakened: the YUGE's fists in a Colossus's
 *  green and amber (what adult Hawser's blows landed in), not the Scout's steel. */
const FORM_TABLE: Partial<Record<FighterId, Record<'light' | 'heavy' | 'special' | 'ultimate', Element>>> = {
  hawser:{light:E(0xe7fff1,0x45896e,0x11231d),heavy:E(0xfff0cc,0xc6a268,0x262318),special:E(0xd2f7e2,0x45896e,0x11231d),ultimate:E(0xffedbc,0xe4b450,0x262318)},
};
/** Kosho awakened: FEU BLEU's blue flame. */
const AWAKENED_KOSHO = E(0xe6f6ff, 0x3f8cff, 0x7fc8ff);
const AWAKENED: Partial<Record<FighterId, Element>> = {
  taisei: KI_GOLD, ouga: KI_GOLD, konta: CHI_ORANGE, gummy: SUNRISE_WHITE, kagari: FIRE, kosho: AWAKENED_KOSHO,
  strix: SLASH_GREEN, kenzo: SLASH_GREEN, nigo: BLACK_RED, gaunt: BLACK_RED, setsu: LIGHTNING, kuon: HEX_BLUE, ward: ROOM_BLUE,
  gorai: DRAGON_VIOLET, haldor: QUAKE_WHITE, sorrel: COMMAND_RED, dorado: HORIZON_GOLD, shiun: PALE_GEM, magatsu: CURSE, vesper: ECLIPSE, imago: DECREE, 'wuming': ROSE, jirenga: PRIDE_RED, 'jinlin': GOLDEN,
  'gohaku': BEAST, ippon: CLEAN_SLATE, sekka: COMPASS, tobari: RED_EYE,
  akagane: GUARDIAN_BLUE, asahi: SUN_FIRE, levin: WINGS_STEEL, 'rook': SHADOW, gaku: AURA,
};

/** Rush stages whose technique has a colour of its own, by stage (1-3): a
 *  Nova is red whoever's jab it follows, and a Static Kick is
 *  lightning. Anything not listed is the fighter's light. */
const RUSH: Partial<Record<FighterId, Partial<Record<number, Element>>>> = {
  kuon: { 3: CURSED_RED }, shirokane: { 3: LIGHTNING }, konta: { 3: CHI_ORANGE }, nigo: { 3: BLACK_RED }, setsu: { 3: LIGHTNING },
  kagari: { 1: FIRE, 2: FIRE, 3: FIRE }, kosho: { 3: FIRE }, koko: { 3: SPIRIT_PURPLE }, oro: { 3: SPIRIT_GOLD },
};

/** The main game's sixteen's combo enders (game/combos.ts), each in its fighter's own element rather than its slot's:
 *  a Light, Heavy thrown from Konta's heavy is not the Senpugan, so it does not land in the Senpugan's blue, and Taisei's
 *  enders are ki, not the plain fist of his Cloudstep. `base` is the fighter's, `keys` the enders made of
 *  something else of theirs (Kuon's blowback is a repulsion, his ground smash a void), `awakened` the form's.
 *  The shop's twenty keep their slot's: EmperorEffects draws their enders in their own colours, as it did. */
const KI_WHITE = E(0xf6fcff, 0x3fb8ff, 0x9fdcff, 0x06142a);
const KUROBI = E(0xffe6c8, 0xff3c14, 0xff6a2a, 0x1c0604);
const PURPLE_LIGHTNING = E(0xf4e8ff, 0x9a4aff, 0xbf94ff, 0x0c0418);
const STEEL_BLOOD = E(0xf2f6fa, 0xc0222a, 0xffb4a8, 0x0c0204);
/** Taisei's Red Surge red; the Blackout Flash's white; Konta's Galewheel wind; Shirokane's earth arts; LORD ORO's freezing
 *  touch; Kuon's Dark Spark (black lightning, crimson) and Event Horizon's pale blue. */
const RED_SURGE = E(0xffe2dc, 0xff2a24, 0xff5a46, 0x1c0404);
const SOLAR = E(0xffffff, 0xfff0a0, 0xfffbe6, 0x14100a);
const WIND = E(0xeefcff, 0x6fd6ff, 0x9fe6ff, 0x061420);
const EARTH = E(0xfff0d8, 0xb08850, 0xe0c8a0, 0x1a1006);
const FROST = E(0xf4fdff, 0x8fd8ff, 0xd0f4ff, 0x061420);
const DARK_SPARK = E(0xff6a5a, 0x9a0014, 0xff2a30, 0x000000);
const HORIZON_PALE = E(0xf4fbff, 0x9fe6ff, 0xd8f6ff, 0x061426);
/** The ender names are COMBOS-DATA's (game/combosVol1.ts). */
export const ENDER_ELEMENTS: Partial<Record<FighterId, { base: Element; keys?: Partial<Record<ComboKey, Element>>; awakened?: Element; awakenedKeys?: Partial<Record<ComboKey, Element>> }>> = {
  // Monkey King Fist's golden dragon, the Redline Rush's red, the Blackout Flash's white, the Grand Sunpalm Cannon's blue.
  taisei: { base: KI_WHITE, keys: { lh: KI_GOLD, llh: RED_SURGE, llls: SOLAR, airSpecial: KI_BLUE }, awakened: KI_GOLD },
  // The Gale purple; Coronation, the energy volley and the Pride Burst in his gold.
  ouga: { base: KI_PURPLE, keys: { llh: KI_GOLD, llls: KI_GOLD, airSpecial: KI_GOLD }, awakened: KI_GOLD },
  // The Gale Palm's orange; the Giant Senpugan's and the Senpugan Wreath's blue; the Mini Galewheel's wind. Kurobi's own in its
  // red-orange, its Mini Foxfire Bomb in the bomb's violet.
  konta: { base: CHI_ORANGE, keys: { lllh: CHI_BLUE, llls: WIND, airSpecial: CHI_BLUE }, awakened: KUROBI, awakenedKeys: { airSpecial: BEAST_VIOLET } },
  // Will; the burning fist's fire. SUNRISE's own (round 4b): his white, and the lightning he catches.
  gummy: { base: WILL, keys: { airSpecial: FIRE }, awakened: SUNRISE_WHITE, awakenedKeys: { llls: LIGHTNING, airSpecial: FIRE } },
  // The green of his cuts; Sunstroke bursts into flame.
  strix: { base: SLASH_GREEN },
  kenzo: { base: SLASH_GREEN, keys: { airHeavy: FIRE } },
  kosho: { base: FIRE, awakened: AWAKENED_KOSHO },
  kagari: { base: FIRE },
  ward: { base: ROOM_BLUE },
  // Blue; Dark Spark's black lightning; Event Horizon's stillness; the Supermassive.
  kuon: { base: HEX_BLUE, keys: { lh: DARK_SPARK, llls: HORIZON_PALE, airSpecial: HEX_PURPLE } },
  koko: { base: SPIRIT_PURPLE },
  // HUSH's gold; the freezing touch.
  oro: { base: SPIRIT_GOLD, keys: { llls: FROST } },
  nigo: { base: BLACK_RED },
  // Steel and blood; the bomb and the cannon's fire.
  gaunt: { base: STEEL_BLOOD, keys: { llls: FIRE, airSpecial: FIRE } },
  // Lightning; the yo-yos are steel.
  setsu: { base: LIGHTNING, keys: { lh: STEEL } },
  // Lightning; the Water Dragon, the earth arts, Purple Electricity.
  shirokane: { base: LIGHTNING, keys: { lh: WATER, lllh: EARTH, llls: EARTH, airSpecial: PURPLE_LIGHTNING } },
  // Purple lightning (Shrike Bolt, Thunder Hawk); the Fireball Arts's fire.
  shiden: { base: PURPLE_LIGHTNING, keys: { lllh: FIRE } },
};
/** An ender's element, or undefined for a fighter whose enders are drawn as their slot's (the shop's). */
export function enderElement(fighter: FighterId | undefined, key: ComboKey | undefined, awakened = false): Element | undefined {
  const row = fighter && key ? ENDER_ELEMENTS[fighter] : undefined;
  if (!row || !key) return undefined;
  if (awakened) return row.awakenedKeys?.[key] ?? row.awakened ?? row.keys?.[key] ?? row.base;
  return row.keys?.[key] ?? row.base;
}

/** The element a blow lands in. `slot` undefined is a body with no move in
 *  hand - a landing, a slide - and reads as the fighter's light. `chain` is
 *  the rush stage of a light, when it is one; `branch` the combo ender a heavy
 *  or special is, which lands in its own element (ENDER_ELEMENTS). */
export function elementFor(fighter: FighterId | undefined, slot?: AttackSlot, awakened = false, chain = 0, branch?: ComboKey): Element {
  if (!fighter) return PHYSICAL;
  const ender = branch && (slot === 'heavy' || slot === 'special') ? enderElement(fighter, branch, awakened) : undefined;
  if (ender) return ender;
  const rush = slot === 'light' && chain > 0 ? RUSH[fighter]?.[chain] : undefined;
  if (rush) return rush;
  const form = awakened ? FORM_TABLE[fighter] : undefined;
  if (form) return form[slot === 'area' ? 'special' : slot ?? 'light'];
  // Melee normals follow the transformation; specials and ultimates keep
  // the technique's own colour, since a Shikou-Ha is purple either way.
  if (awakened && (slot === undefined || slot === 'light' || slot === 'heavy')) return AWAKENED[fighter] ?? TABLE[fighter].light;
  return TABLE[fighter][slot === 'area' ? 'special' : slot ?? 'light'];
}

/** The colour a signature technique paints the room while it plays - what
 *  the dynamic light throws and what the frame is graded toward. Mostly the
 *  move's own element; a few techniques read as a different colour from the
 *  blow they land as: VOID SICKLE and PLANETARIUM are violet, not the blue of the
 *  user's other moves, and Kurobi's techniques are its orange. */
const TECHNIQUE: Partial<Record<FighterId, Partial<Record<AttackSlot, number>>>> = {
  taisei: { special: 0x46c3ff, ultimate: 0x5fd4ff }, shirokane: { heavy: 0x8fd0ff, special: 0x8fd0ff, ultimate: 0x9a6cff },
  konta: { heavy: 0x5fd4ff, special: 0x7fdcff }, kuon: { special: 0xc050ff, ultimate: 0x9a60ff },
  nigo: { special: 0xff3048, ultimate: 0xd01830 }, gummy: { special: 0xff3a2a }, shiden: { ultimate: 0xb469ff },
};
export function techniqueColour(fighter: FighterId, slot: AttackSlot, awakened = false, branch?: ComboKey): number {
  // A combo ender lights the room in its own element, not its slot's technique (a Light, Heavy is no Senpugan).
  const ender = branch && (slot === 'heavy' || slot === 'special') ? enderElement(fighter, branch, awakened) : undefined;
  if (ender) return ender.light;
  if (awakened && fighter === 'konta') return 0xff8a2a;
  return TECHNIQUE[fighter]?.[slot] ?? elementFor(fighter, slot, awakened).light;
}

/** The hue the look pass grades the room toward while a signature special
 *  or ultimate plays: deeper than the light the technique throws, since the
 *  grade tints a whole frame and the light only what it reaches. One blue
 *  for the Sunpalm Cannon, Lightning Cut and Galewheel family, one violet for
 *  Singularity, PLANETARIUM and VOID SICKLE, one crimson for Nightfang, NIGHTFALL
 *  and the SUNSET BARRAGE's Will, one orange for Kurobi; the rest follow the
 *  palette. */
const GRADE: Partial<Record<FighterId, Partial<Record<AttackSlot, number>>>> = {
  taisei: { special: 0x3a8cff, ultimate: 0x3a8cff }, shirokane: { special: 0x3a8cff, ultimate: 0x8a4dff },
  konta: { special: 0x3a8cff, ultimate: 0x8a4dff }, kuon: { special: 0x8a4dff, ultimate: 0x8a4dff },
  nigo: { special: 0xd0203a, ultimate: 0xd0203a }, gummy: { special: 0xd0203a }, shiden: { ultimate: 0x8a4dff },
  setsu: { special: 0x3a8cff, ultimate: 0x3a8cff },
  // Briar Crown (31 October 2026): Lightless Magic drains the room to grey (no hue: a dark blade is read on grey, and was
  // nothing in a room gone violet); Bruin's darkness a muted violet (critic pass 3: "a frame washed entirely purple");
  // the wind white-cyan and only Sylph's (the ultimate) green; the sea blue. (Round 7.)
  cardo: { special: 0x9c9c9c, ultimate: 0x9c9c9c }, bruin: { special: 0x5a4a78, ultimate: 0x4e3e6e },
  // (Round 19, run 38's film: Great Migration's room went a saturated green from edge to edge; the beam is white
  // at its core and mint at its edges. The room only leans mint.)
  aquilo: { special: 0x7ec4dc, ultimate: 0x86d4b4 }, svanhild: { special: 0x2a8ce0, ultimate: 0x2a7fd0 },
};
export function gradeHue(fighter: FighterId, slot: AttackSlot, awakened = false, branch?: ComboKey): number {
  const ender = branch && (slot === 'heavy' || slot === 'special') ? enderElement(fighter, branch, awakened) : undefined;
  if (ender) return ender.rim;
  if (awakened && fighter === 'konta') return 0xff7a1a;
  return GRADE[fighter]?.[slot] ?? techniqueColour(fighter, slot, awakened);
}
const SHOP_GRADE = .25;
const SHOP: ReadonlySet<FighterId> = new Set<FighterId>(['gorai', 'haldor', 'sorrel', 'dorado', 'shiun', 'magatsu', 'vesper', 'imago',
  'wuming', 'jirenga', 'jinlin', 'gohaku', 'ippon', 'sekka', 'tobari', 'akagane', 'asahi', 'levin', 'rook', 'gaku']);
export function gradeStrength(fighter: FighterId): number { return SHOP.has(fighter) ? SHOP_GRADE : 1; }

/** What a fighter's own afterimage is tinted, off their energy rather than
 *  their clothes: Taisei's ghosts are ki blue, not gi orange. */
export function ghostTint(fighter: FighterId, awakened = false, slot?: AttackSlot, chain = 0): number {
  // A ghost thrown off a technique is the technique's colour: Nova
  // leaves red afterimages, not Kuon's cyan.
  if (slot === 'light' && chain > 0) { const rush = RUSH[fighter]?.[chain]; if (rush) return rush.light; }
  if (awakened) return (AWAKENED[fighter] ?? TABLE[fighter].special).light;
  return GHOSTS[fighter] ?? 0xbfe6ff;
}
/** Built once: MotionFx asks for a tint for every fighter every frame. */
const GHOSTS: Partial<Record<FighterId, number>> = { taisei: 0x7fd8ff, ouga: 0x8aa8ff, konta: 0xffb54a, gummy: 0xff6a4a, kosho: 0xffa04a,
  kagari: 0xff8a2a, kenzo: 0x8af0a8, shirokane: 0x9fd8ff, shiden: 0xb48cff, setsu: 0xbfe6ff, nigo: 0xff5068, gaunt: 0xff4a4a,
  koko: 0xb48cff, oro: 0xffd24a, kuon: 0x7fe6ff, ward: 0x7fc8ff,
  // The shop's twenty in their own colours (3 October): they fell through to the pale blue, and the blind critics saw
  // "the same pale-blue ghost" at the same blow of every one of their strings. Each is a colour of their power set
  // against their clothes: in the colour of the clothes, a ghost reads as the body torn (Haldor's ivory as "the
  // coat stretched into huge flat cream sheets", Gorai's violet as "a flat lavender blob").
  gorai: 0xffa63a, haldor: 0x5ac8ff, sorrel: 0xff5a64, dorado: 0xff4040, shiun: 0xa060ff, magatsu: 0xff4a5e,
  vesper: 0xf4f0ff, imago: 0x6af0a0, 'wuming': 0xff7ae0, jirenga: 0xff5a4a, 'jinlin': 0xffd04a,
  'gohaku': 0xc49aff, ippon: 0xff5a3a, sekka: 0xff7ab0, tobari: 0xff4a5a, akagane: 0x9a8cff, asahi: 0x6ac8ff,
  levin: 0x7ae0a0, 'rook': 0x9a6aff, gaku: 0xffc840,
  // Torsion's dash is a burst of her force (19 October, signature/TorsionFlight.ts): its poses in her psychic green.
  torsion: 0x86ffc4 };
