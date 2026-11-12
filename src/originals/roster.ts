import type { FighterId } from '../game/types';
import { ORIGINAL_AREAS, ORIGINAL_TECHNIQUES } from './area';
import { SHOP_A } from './shop/a';
import { SHOP_B } from './shop/b';
import { SHOP_C } from './shop/c';
import { SHOP_D } from './shop/d';
import { SHOP_E } from './shop/e';
import { SHOP_PX } from './shop/px';
import { SHOP_R6P } from './shop/r6p';
import { SHOP_R6B } from './shop/r6b';

export interface OriginalFighter {
  name: string;
  /** Shown above the name; an original series for each. */
  series: string;
  /** The world the series is set in, one line, for the guide and the credits. */
  tagline: string;
  color: string;
  moves: [string, string, string, string];
  shortMoves: [string, string, string, string];
  /** The transformation's name, in capitals as the banner sets it. */
  awakening: string;
  model: string;
  rushModel?: string;
  extraModels?: string[];
  formModel?: string;
  formExtraModels?: string[];
  /** The cards' labels while a form that fights with a kit of its own shows (config `formShortMoves`: Hawser's giant's). */
  formShortMoves?: string[];
  /** Where that body stands, metres ahead of the fighter's root (AWAKENINGS' `formForward`, the renderer's alone): a
   *  body the runtime centres on a different silhouette needs its own to bring its muzzle to the same reach. */
  formForward?: number;
  formScale?: number;
  formStance?: boolean;
  portrait: string;
  height?: number;
  homeArt?: boolean;
  /** The idle profile's animation-only file (src/render/idle/profile.ts `model`). */
  idleModel?: string;
  coat?: { thigh: number; shin: number; cone?: number; floor?: number; floored?: boolean };
  /** A cape hung from the shoulders on spring chains (scripts/originals/shop/cape_chains_r6.py, its Detail_CLOTH_Cape_*
   *  joints under the chest): sprung by src/originals/apply.ts's cape profile, which these override - `cone` (degrees a
   *  link swings off its pose), `hang` (how much of each chain's first link hangs toward the floor from the fighter's
   *  root rather than off the chest, 0..1), `droop` (the furthest a link rises from straight down, degrees), `stiffness`,
   *  and the capsules (`thigh`, `shin`: metres) that keep it out of the legs. */
  cape?: { cone?: number; hang?: number; droop?: number; stiffness?: number; thigh?: number; shin?: number };
  impactWord?: string;
  guardian?: string;
  knife?: string;
  sculpture?: string;
  spirit?: string;
  companion?: { model: string; punches?: string };
  shop?: Record<string, { name: string; blurb: string; glyph?: string } | null>;
  hiddenNames?: Record<string, string>;
  /** Every other name the fighter's moves are known by in the tables (rush stages, air string, enders, the awakened
   *  kit), internal name to the name shown. */
  names: Record<string, string>;
}

const F = '/assets/fighters/';

export const ORIGINALS: Partial<Record<FighterId, OriginalFighter>> = {
  taisei: {
    name: 'Taisei', series: 'Last Sun', tagline: 'The monkey-tailed brawler of the last sun, who will fight anyone strong enough to make the end of the world interesting.',
    homeArt: true,
    color: '#1f9a7e', // jade, his vest's
    moves: ['Stoneborn Fist', 'Cloudstep Strike', 'Sunpalm Cannon', 'Last Sunfall'],
    shortMoves: ['STONEBORN', 'CLOUDSTEP', 'SUNPALM', 'LAST SUN'],
    awakening: 'GOLDEN SAGE',
    model: F + 'wukong-tr1.glb', rushModel: F + 'wukong-rush1.glb',
    extraModels: [F + 'wukong-transmission1.glb', F + 'wukong-awaken1.glb', F + 'wukong-enders1.glb', F + 'wukong-enders2.glb', F + 'wukong-hurts1.glb'],
    portrait: F + 'wukong-portrait.png', idleModel: F + 'wukong-idle1.glb',
    names: {
      'Flying Kick': 'Rooftop Kick', 'Double Axe Handle': 'Wrecking Hammer',
    },
    // His four hair outfits: the gold one wears the Golden Sage all match (its `goldHair` shows the awakened mesh, and
    // the blue one recolours that mane's `gold-hair` material).
    shop: {
      'outfit-taisei-golden-sage': { name: 'Taisei · Golden Sage', blurb: 'The mane burning gold from the first bell to the last: the Great Sage, awake all match.' },
      'outfit-taisei-ember-mane': { name: 'Taisei · Ember Mane', blurb: 'A crown of hair burnt red and a red aura for the awakening: the monkey king at his hottest.' },
      'outfit-taisei-azure-sage': { name: 'Taisei · Azure Sage', blurb: 'The golden mane gone sky blue, under an aura that crackles like a downed power line.' },
      'outfit-taisei-silver-mane': { name: 'Taisei · Silver Mane', blurb: 'A silver crown of hair and a silver-blue aura, cold and quiet as the moon.' },
    },
  },
  konta: {
    name: 'Konta', series: 'Ashwood', tagline: 'The loudest ninja of his village - and the fox spirit of azure flame sealed inside him.',
    homeArt: true,
    color: '#ff9a1f', height: 1.66,
    moves: ['Foxpack Barrage', 'Kazeyose', 'Galewheel', 'Azure Foxfire'],
    shortMoves: ['FOXPACK BARRAGE', 'KAZEYOSE', 'GALEWHEEL', 'AZURE FOXFIRE'],
    awakening: 'HOMURA',
    coat: { thigh: .12, shin: .11 }, model: F + 'konta-px1.glb', rushModel: F + 'konta-pxrush1.glb', extraModels: [F + 'konta-pxenders1.glb'],
    formModel: F + 'homura-px1.glb', formForward: -1.5, formScale: 2.8,
    portrait: F + 'konta-px-portrait.png', idleModel: F + 'konta-pxidle1.glb',
    names: {
      'Up You Go!!': 'Up You Go!', 'Tail Sweep': 'Foxtail Sweep', 'Great Roar': 'Homura Howl',
    },
  },
  gummy: {
    name: 'Gummy', series: 'Dust Sea', tagline: 'A rubber-limbed captain sailing the Dust Sea past every horizon.',
    homeArt: true,
    color: '#e8403a', height: 1.74,
    moves: ['Snapback Jab', 'Rogue Wave', 'Sunset Barrage', 'Spring Tide'],
    shortMoves: ['SNAPBACK', 'ROGUE WAVE', 'SUNSET BARRAGE', 'SPRING TIDE'],
    awakening: 'SUNRISE',
    model: F + 'lucy-px1.glb', rushModel: F + 'lucy-pxrush1.glb', extraModels: [F + 'lucy-pxenders1.glb', F + 'lucy-pxenders2.glb', F + 'lucy-pxtide1.glb'],
    formModel: F + 'sunrise-px1.glb', formExtraModels: [F + 'sunrise-pxmoves1.glb', F + 'sunrise-pxreact1.glb', F + 'sunrise-pxtide1.glb'],
    // (lucy-moves, 5 November: `*-pxtide1.glb` hold his own Spring Tide and Monsoon takes, scripts/originals/clips/author_lucy_tide.py.)
    portrait: F + 'lucy-px-portrait.png', idleModel: F + 'lucy-pxidleb1.glb',
    names: {
      'High Noon Barrage': 'NO SHADOW Barrage',
    },
    shop: {
      'outfit-gummy-daybreak': { name: 'Gummy · Daybreak', blurb: 'Jacket and trousers bleached white by the sun over the Dust Sea, the sash lit gold like the first light, the headband still red.', glyph: '暁' },
      'outfit-gummy-black-flag': { name: 'Gummy · Black Flag', blurb: 'The jacket dyed black and the sash the red of the flag\'s skull: what he wears to take a fortress by night.', glyph: '旗' },
      'outfit-gummy-mirage': { name: 'Gummy · Mirage', blurb: 'Turquoise as the water every sailor on the Dust Sea swears they saw, over sand-pale trousers and a coral sash.', glyph: '蜃' },
      'outfit-gummy-deckhand': { name: 'Gummy · Deckhand', blurb: 'The faded denim and work trousers he scrubbed decks in before he had a ship of his own, and the red sash he never took off.', glyph: '甲' },
    },
  },
  // NIGO - the Cinder Reaper. A reaper of the cinder wastes: short copper hair, a torn black sleeveless duster over a
  // chest bound in bandages, a red tie on his left wrist and a glove on his right, and HAIZAN, a cleaver cut from a
  // bridge girder (carried on Nigo's sword bone, scripts/originals/retarget_prop.py). He fights with crescents of
  // burning ash. Awakened, he is NIGHTFALL: a long black mane streaked copper and a broken white jaw visor.
  nigo: {
    name: 'Nigo', series: 'Cinder Requiem', tagline: 'The reaper of the cinder wastes, who cuts the dead city\'s ghosts down with a girder for a sword.',
    homeArt: true,
    color: '#e2702a',
    moves: ['Haizan Cut', 'Ashstep Strike', 'Scorched Earth', 'Haizan: Nightfall'],
    shortMoves: ['HAIZAN', 'ASHSTEP', 'SCORCHED EARTH', 'NIGHTFALL'],
    awakening: 'NIGHTFALL',
    coat: { thigh: .12, shin: .11 }, model: F + 'nigo-tr1.glb', rushModel: F + 'nigo-rush1.glb', extraModels: [F + 'nigo-tr1-area1.glb'],
    // (remake-areas, 6 November: `*-area1.glb` hold his Ash Brand cast, both bodies: src/originals/areaCasts.ts.)
    formModel: F + 'nigo-awakened-tr1.glb', formExtraModels: [F + 'nigo-awakened-tr1-area1.glb'],
    portrait: F + 'nigo-portrait.png', idleModel: F + 'nigo-idle1.glb',
    names: {
      'Point-Blank Scorch': 'Accent Scorch', 'Backhand Cleave': 'Backhand Hack',
    },
  },

  ouga: {
    name: 'Ouga', series: 'Last Sun', tagline: 'The proud prince of a fallen kingdom - and he will never let a rival get ahead of him.',
    homeArt: true,
    color: '#d8344a', height: 1.72,
    moves: ['Crown Straight', 'Crown Burst', 'Throne Wave', 'Royal Aurora'],
    shortMoves: ['CROWN STRAIGHT', 'CROWN BURST', 'THRONE WAVE', 'ROYAL AURORA'],
    awakening: 'CROWNFIRE',
    // QA round (fix-cloth, 3 November 2026): his cape hangs from his shoulders on chains of its own (shop/cape_chains_r6.py),
    // not welded to his chest, so his guard and his run no longer stand it out behind him as a board.
    cape: { hang: .8, cone: 20, droop: 45, stiffness: 16, thigh: .11, shin: .1 },
    model: F + 'ouga-px1.glb', rushModel: F + 'ouga-pxrush1.glb',
    extraModels: [F + 'ouga-pxstraight1.glb', F + 'ouga-pxawaken1.glb', F + 'ouga-pxenders1.glb', F + 'ouga-pxhurts1.glb'],
    portrait: F + 'ouga-px-portrait.png', idleModel: F + 'ouga-pxidle1.glb',
    names: {
      'Double Axe Handle': 'Throne Breaker',
    },
    shop: {
      'outfit-ouga-crownfire': { name: 'Ouga · Crownfire', blurb: 'His crest burning gold from the first bell to the last: the crown on fire, awake all match.' },
      'outfit-ouga-crimson-crown': { name: 'Ouga · Crimson Crown', blurb: 'A crest burnt red and a red aura for the awakening: a prince at his hottest.' },
      'outfit-ouga-azure-crown': { name: 'Ouga · Azure Crown', blurb: 'A sky-blue crest under an aura that crackles like a storm front.' },
      'outfit-ouga-violet-wrath': { name: 'Ouga · Violet Wrath', blurb: 'Crest and aura in deep violet: a prince in his blackest mood.' },
    },
  },
  // SHIROKANE - the Scarecrow. Ashwood's laziest teacher and its deadliest ninja, dressed as the scarecrow that
  // guards what is left of its fields: long silver hair in a low tail, a woven conical hat, a stitched patchwork mask, a red
  // glass lens over the eye that copies every technique it sees, a patched field coat and a paperback in his belt.
  shirokane: {
    name: 'Shirokane', series: 'Ashwood', tagline: 'The harvest warden of Ashwood: half asleep, a book in his belt, and a red lens that misses nothing.',
    homeArt: true,
    color: '#88b9ca', height: 1.78,
    moves: ['Scrap Kunai', 'Sickle Bolt', 'Static Decoy', 'Sickle Bolt: Reaper'],
    shortMoves: ['SCRAP KUNAI', 'SICKLE BOLT', 'STATIC DECOY', 'SICKLE REAPER'],
    awakening: 'HARVEST WARDEN',
    guardian: F + 'guardian-loom1.glb',
    coat: { thigh: .12, shin: .11 }, model: F + 'shirokane-tr1.glb', rushModel: F + 'shirokane-rush1.glb', extraModels: [F + 'shirokane-enders1.glb', F + 'shirokane-tr1-area1.glb'], // remake-areas: his Dust Curtain cast (src/originals/areaCasts.ts)
    portrait: F + 'shirokane-portrait.png', idleModel: F + 'shirokane-idle1.glb',
    names: {
      'Kunai Slash': 'Kunai Slice',
    },
  },
  // SHIDEN - the Storm Hawk. Konta's rival, who left Ashwood to hunt the man who burned it: long black hair in a
  // high tail, a left eye that glows violet, a sleeveless black high-collared coat, a hawk-feather pauldron, a katana.
  shiden: {
    name: 'Shiden', series: 'Ashwood', tagline: 'The storm hawk who left Ashwood to hunt the man who burned it.',
    homeArt: true,
    color: '#9271d6',
    moves: ['Habakiri Cut', 'Storm Talon', 'Hawk Pyre', 'Ikazuchi Arrow'],
    shortMoves: ['HABAKIRI', 'STORM TALON', 'HAWK PYRE', 'IKAZUCHI ARROW'],
    awakening: 'IKAZUCHI',
    guardian: F + 'guardian-loom1.glb',
    coat: { thigh: .12, shin: .11 }, model: F + 'shiden-tr1.glb', rushModel: F + 'shiden-rush1.glb', extraModels: [F + 'shiden-enders1.glb'],
    portrait: F + 'shiden-portrait.png', idleModel: F + 'shiden-idle1.glb',
    names: {
      'Black Pyre': 'Hawk Pyre',
    },
  },
  kenzo: {
    name: 'Kenzo', series: 'Dust Sea', tagline: 'The two-blade ronin of the Dust Sea, who gets lost on the way to every fight and wins it anyway.',
    homeArt: true,
    color: '#7fc45b',
    moves: ['Fang Crossing', 'Mirage Draw', 'Eagle\'s Reach', 'Dust Sea Sundered'],
    shortMoves: ['FANG CROSSING', 'MIRAGE DRAW', 'EAGLE\'S REACH', 'DUST SEA SUNDERED'],
    awakening: 'DUNE ONI',
    coat: { thigh: .13, shin: .14 }, model: F + 'kenzo-tr1.glb', rushModel: F + 'kenzo-rush1.glb', extraModels: [F + 'kenzo-enders1.glb', F + 'kenzo-enders2.glb'],
    formModel: F + 'kenzo-awakened-tr1.glb',
    portrait: F + 'kenzo-portrait.png', idleModel: F + 'kenzo-idleb1.glb',
    names: {
      'eagles reach': 'Eagle\'s Reach',
    },
    shop: {
      'outfit-kenzo-night-raider': { name: 'Kenzo · Night Raider', blurb: 'His vest dyed midnight indigo for a raid by moonlight. He still found the wrong gate first.', glyph: '夜' },
      'outfit-kenzo-oasis-dandy': { name: 'Kenzo · Oasis Dandy', blurb: 'A vest of ivory silk, bought at the first oasis he wandered into by mistake. He insists it was on purpose.', glyph: '泉' },
      'outfit-kenzo-masterless': { name: 'Kenzo · Masterless', blurb: 'His vest dyed black, the colour of no house at all: two blades, a hundred roads, and nowhere he has to be.', glyph: '浪' },
    },
  },
  kosho: {
    name: 'Kosho', series: 'Dust Sea', tagline: "The crew's chef, gallant and hot-headed - he never fights with his hands, and his legs burn hot enough to cook with.",
    homeArt: true,
    color: '#f2c14e', height: 1.8,
    moves: ['Amuse-Bouche', 'Hachoir', 'Brasier: Coup de Feu', 'Banquet Infernal'],
    shortMoves: ['AMUSE-BOUCHE', 'HACHOIR', 'COUP DE FEU', 'BANQUET INFERNAL'],
    awakening: 'FEU BLEU',
    model: F + 'kosho-px1.glb', rushModel: F + 'kosho-pxrush1.glb', extraModels: [F + 'kosho-pxenders1.glb', F + 'kosho-pxfmoves1.glb'],
    portrait: F + 'kosho-px-portrait.png', idleModel: F + 'kosho-pxidleb1.glb',
    names: {
      'Brasier: Salamandre': 'Gratin',
    },
    // His two outfits: his own body in two palettes (parity2, 5 November 2026: src/originals/outfits.ts).
    shop: {
      'outfit-kosho-sommelier': { name: 'Kosho · Sommelier', blurb: 'A claret shirt and a gold neckerchief for the captain\'s table: he pairs every kick with something red.', glyph: '葡' },
      'outfit-kosho-flambe': { name: 'Kosho · Flambé', blurb: 'A black shirt for the late service, and from the shoes to the knee his legs burn like a pan set alight.', glyph: '炎' },
    },
  },
  kagari: {
    name: 'Kagari', series: 'Dust Sea', tagline: "Gummy's sworn older brother - a laid-back, polite pirate whose body is living fire, apt to doze off mid-sentence.",
    homeArt: true,
    color: '#ff6f3c', height: 1.72,
    moves: ['Hinoko', 'Yuragi', 'Taimatsu', 'Taiyou-Dama'],
    shortMoves: ['HINOKO', 'YURAGI', 'TAIMATSU', 'TAIYOU-DAMA'],
    awakening: 'ALL ABLAZE',
    model: F + 'kagari-px1.glb', rushModel: F + 'kagari-pxrush1.glb', extraModels: [F + 'kagari-pxenders1.glb', F + 'kagari-pxfmoves1.glb'],
    portrait: F + 'kagari-px-portrait.png',
    names: {
      'Rising Ember': 'Rising Spark', 'Kagaribi': 'Funka',
    },
    // His two outfits: his own body in two palettes (parity2, 5 November 2026: src/originals/outfits.ts).
    shop: {
      'outfit-kagari-dune-walker': { name: 'Kagari · Dune Walker', blurb: 'Cloth dyed the red of the dunes at dusk, the flames and the sash in gold, for the long walk over the Dust Sea - where he naps in the hottest sun and never notices.', glyph: '砂' },
      'outfit-kagari-blue-ember': { name: 'Kagari · Blue Ember', blurb: 'His fire burnt to its hottest: blue flames up his shirt and round his sash, and a blue blaze when he wakes.', glyph: '蒼' },
    },
  },
  // WARD - the Field Surgeon. The Dust Sea's coldest doctor, who operates on whatever stands inside his ward: a black
  // wolf-cut with one white streak, a yellow-and-black hazard coat, a stethoscope, and a nodachi taller than he is.
  ward: {
    name: 'Ward', series: 'Dust Sea', tagline: 'The coldest surgeon on the Dust Sea: inside his ward, everything is on the operating table.',
    homeArt: true,
    color: '#4d9cff',
    moves: ['Lancet Slash', 'Stat Shot', 'Cautery Blade', 'Flatline'],
    shortMoves: ['LANCET', 'STAT SHOT', 'CAUTERY', 'FLATLINE'],
    awakening: 'SCRUBBED IN',
    coat: { thigh: .12, shin: .11 }, model: F + 'ward-tr1.glb', rushModel: F + 'ward-rush1.glb', extraModels: [F + 'ward-enders1.glb', F + 'ward-ult1.glb'],
    portrait: F + 'ward-portrait.png',
    names: {},
    // His two outfits, under the names his writer gave them: his own body in two palettes (parity2, 5 November 2026).
    shop: {
      'outfit-ward-night-shift': { name: 'Ward · Night Shift', blurb: 'The coat in scrubs teal for the night rounds, the hazard stripes kept: on his shift, nobody sleeps through the operation.', glyph: '宿' },
      'outfit-ward-house-call': { name: 'Ward · House Call', blurb: 'A doctor\'s white coat over navy trousers: he comes to you, and the bill comes later.', glyph: '往' },
    },
  },
  koko: {
    name: 'KoKo', series: 'Gilded Ruin', tagline: 'The silent brawler of the gilded ruins, and the iron guardian that throws his punches for him.',
    homeArt: true,
    color: '#cf83d6', height: 1.92,
    moves: ['Iron Straight', 'Iron Nail', 'IRONFALL Barrage', 'Iron Lullaby: Slumber'],
    shortMoves: ['IRON STRAIGHT', 'IRON NAIL', 'IRONFALL', 'SLUMBER'],
    awakening: 'SLUMBER',
    impactWord: 'ガァンッ', companion: { model: F + 'koko-spirit-tr1.glb', punches: F + 'koko-spirit-fanim1.glb' },
    coat: { thigh: .13, shin: .14, cone: 20 }, model: F + 'koko-tr1.glb', rushModel: F + 'koko-rush1.glb', extraModels: [F + 'koko-enders1.glb'],
    portrait: F + 'koko-portrait.png', idleModel: F + 'koko-idle1.glb',
    names: {
      'Straight Punch': 'Iron Straight', 'Hammer!!': 'Hammer!', 'ANVIL!!': 'ANVIL!', 'Diving Punch': 'Anvil Drop',
    },
  },
  // LORD ORO - the Gilded Hour. A vampire lord who rules the ruins from a clock tower: swept-back gold hair, golden
  // eyes, a black-and-gold vest of clock gears, clock-face kneepads. His spirit, THE GILDED HOUR, a clockwork knight with
  // a clock for a heart, stops time while he tears his tower's great bell down on whoever is left (src/originals/hourBell.ts).
  oro: {
    name: 'Lord ORO', series: 'Gilded Ruin', tagline: 'The vampire lord of the clock tower, whose gilded spirit can stop the hour itself.',
    homeArt: true,
    color: '#f2c94c',
    moves: ['Gilded Punch', 'Clock-Hand Knives', 'CLOCKWORK Barrage', 'MIDNIGHT: Hour of Ruin'],
    shortMoves: ['GILDED PUNCH', 'CLOCK-HAND KNIVES', 'CLOCKWORK', 'MIDNIGHT'],
    awakening: 'MIDNIGHT',
    impactWord: 'のろまッ', knife: F + 'oro-knife1.glb', companion: { model: F + 'oro-spirit-tr1.glb', punches: F + 'oro-spirit-fanim1.glb' },
    model: F + 'oro-tr1.glb', rushModel: F + 'oro-rush1.glb', extraModels: [F + 'oro-enders1.glb', F + 'oro-enders2.glb', F + 'oro-tr1-area1.glb'], // remake-areas: his Knife Rain cast (src/originals/areaCasts.ts)
    portrait: F + 'oro-portrait.png', idleModel: F + 'oro-idleb1.glb',
    names: {
      'Tick!!': 'Tick!', 'Tick Tock!!': 'Tick Tock!', 'HOUR\'S UP!!': 'HOUR\'S UP!', 'Die!': 'Perish!', 'Diving Kick': 'Steeple Drop', 'Checkmate': 'Last Tick',
    },
    // His outfit, under the name his writer gave it: his own body in ivory and lit gold (parity2, 5 November 2026).
    shop: { 'outfit-oro-ascendant': { name: 'Lord ORO · Ascendant', blurb: 'Ivory where the black was and every gear of gold lit from within: the lord of the clock tower at his zenith, above the hour itself.', glyph: '昇' } },
  },
  kuon: {
    name: 'Kuon', series: 'Hex Fallout', tagline: 'A sorcerer without equal - laid-back, rings of light round both forearms, and bored of winning.',
    homeArt: true,
    color: '#4fc3ff', height: 1.9,
    moves: ['Hex Strike', 'Gravity', 'Singularity', 'Planetarium'],
    shortMoves: ['HEX STRIKE', 'GRAVITY', 'SINGULARITY', 'PLANETARIUM'],
    awakening: 'TENGAN',
    coat: { thigh: .13, shin: .14 }, model: F + 'kuon-px1.glb', rushModel: F + 'kuon-pxrush1.glb', extraModels: [F + 'kuon-pxenders1.glb', F + 'kuon-pxenders2.glb'],
    portrait: F + 'kuon-px-portrait.png', idleModel: F + 'kuon-pxidle1.glb',
    names: {
      'Dark Spark': 'Dark Star', 'Flying Kick': 'Comet Kick',
    },
  },
  // GAUNT - the Ash Hound. A scarred veteran who has walked the grave roads longer than anyone: long ash-grey hair, an
  // iron eyepatch, a hooded dark-red cloak, scrap-iron plate, a sword cut from a slab of rail steel and a cannon for a
  // left arm. Awakened, he is sealed in the GRAVE PLATE.
  gaunt: {
    name: 'Gaunt', series: 'Grave Hound', tagline: 'The ash hound of the grave roads, with a slab of rail steel for a sword and a cannon for an arm.',
    homeArt: true,
    color: '#8b1a1a',
    moves: ['Gravedigger Slash', 'Butcher Cleave', 'Scrap Cannon Arm', 'Hound Rampage'],
    shortMoves: ['GRAVEDIGGER', 'BUTCHER CLEAVE', 'SCRAP CANNON', 'HOUND RAMPAGE'],
    awakening: 'GRAVE PLATE',
    coat: { thigh: .13, shin: .14 }, model: F + 'gaunt-tr1.glb', rushModel: F + 'gaunt-rush1.glb', extraModels: [F + 'gaunt-enders2.glb'],
    formModel: F + 'gaunt-awakened-tr1.glb',
    portrait: F + 'gaunt-portrait.png', idleModel: F + 'gaunt-idleb1.glb',
    names: {
      'Spinning Slash': 'Spinning Hack',
    },
  },
  setsu: {
    name: 'Setsu', series: 'Salvage Wilds', tagline: 'A sharp-tongued boy from a family of assassins - quick as lightning, loyal to his one friend.',
    homeArt: true,
    color: '#9fd8ff', height: 1.5,
    moves: ['Snow Claw', 'Sekkou', 'Ikazuchi', 'Setsuna: Kazahana'],
    shortMoves: ['SNOW CLAW', 'SEKKOU', 'IKAZUCHI', 'KAZAHANA'],
    awakening: 'SETSUNA',
    // Round 5 (3 November 2026): the new, cooler Setsu's body (scripts/originals/build_fighter.sh setsu), Pixel's kit on it.
    model: F + 'setsu-tr1.glb', rushModel: F + 'setsu-rush1.glb', extraModels: [F + 'setsu-enders1.glb'],
    portrait: F + 'setsu-portrait.png',
    names: {
      'Diving Kick': 'Hail Kick',
    },
    // His outfit: his own body, the jacket black and its seams violet lightning (parity2, 5 November 2026).
    shop: { 'outfit-setsu-live-wire': { name: 'Setsu · Live Wire', blurb: 'The jacket black and every seam carrying violet lightning: an assassin who arrives before the thunder does.', glyph: '雷' } },
  },
  // Round 4 (9 October 2026): the shop's originals, one table per team (src/originals/shop/).
  ...SHOP_A, ...SHOP_B, ...SHOP_C, ...SHOP_D, ...SHOP_E,
  ...SHOP_PX,
  // Round 6's new fighters the Pixel port opens (src/originals/shop/r6p.ts).
  ...SHOP_R6P,
  ...SHOP_R6B,
};

for (const [id, area] of Object.entries(ORIGINAL_AREAS)) { const original = ORIGINALS[id as FighterId]; if (original && area) original.names[area.main] = area.name; }
for (const [id, names] of Object.entries(ORIGINAL_TECHNIQUES)) { const original = ORIGINALS[id as FighterId]; if (original && names) Object.assign(original.names, names); }

// (The internal names - moves, clips, cues, keys - are the shown ones, so no map from one to the other is needed.)

/** The ids an original stands in for, in roster order. */
export const ORIGINAL_IDS = Object.keys(ORIGINALS) as FighterId[];
