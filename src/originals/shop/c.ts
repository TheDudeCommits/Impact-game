import type { FighterId } from '../../game/types';
import type { OriginalFighter } from '../roster';

const F = '/assets/fighters/';

export const SHOP_C: Partial<Record<FighterId, OriginalFighter>> = {
  // TOBARI - the Ash Crow (Tobari's place), Hidden Ash. The prodigy who burned the Hidden Ash to save the one person in it
  // he loved, let everyone believe the worst of him and went into its crows: shaggy black hair with a feathered braid,
  // crimson eyes, a long open black coat whose collar and shoulders are crow feathers, lined in crimson, a crow-beak mask
  // at his hip. He fights with a feather-shaped blade, crows and a black fire that will not go out; awakened, the CROW
  // TENGU rises round him, a guardian worn as the Guardian was (tobari-tengu-tr1.glb, on his own clips).
  tobari: {
    name: 'Tobari', series: 'Hidden Ash', tagline: 'The prodigy who burned the Hidden Ash and vanished into its crows, still watching over the one he left alive.',
    homeArt: true,
    color: '#d42a3c',
    moves: ['Quill Cut', 'Murder of Crows', 'Black Pyre', 'Red Moon Reverie'],
    shortMoves: ['QUILL CUT', 'MURDER OF CROWS', 'BLACK PYRE', 'RED MOON'],
    awakening: 'CROW TENGU',
    coat: { thigh: .12, shin: .11 }, model: F + 'tobari-tr1.glb', extraModels: [F + 'tobari-tr1-area1.glb'],
    // (remake-areas, 6 November: `*-area1.glb` hold his Great Ember cast, both bodies: src/originals/areaCasts.ts.)
    formModel: F + 'tobari-tengu-tr1.glb', formExtraModels: [F + 'tobari-tengu-tr1-area1.glb'],
    portrait: F + 'tobari-portrait.png', idleModel: F + 'tobari-idle1.glb',
    names: {
      'Kunai Slash': 'Quill Cut', 'Shadow Kick': 'Shade Kick', 'Guardian Fist': 'Tengu: Iron Fist',
      
    },
    shop: { 'fighter-tobari': { name: 'Tobari', blurb: 'The Ash Crow of the Hidden Ash: a feather-bladed cut, a murder of crows that comes at them from behind, a black fire that will not go out - and the Red Moon Reverie, a dream he cuts them down in.' } },
  },
  akagane: {
    name: 'Akagane', series: 'Hidden Ash', tagline: 'A copper tyrant of the old wars who walked out of his own tomb when the world ended, and found no one left worth opening his fan for.',
    homeArt: true,
    color: '#b8402f',
    moves: ['War Fan Sweep', 'Skybreaker Kick', 'Cinder Art: Burning Sea', "Heaven's Anvil"],
    shortMoves: ['WAR FAN', 'SKYBREAKER', 'BURNING SEA', "HEAVEN'S ANVIL"],
    awakening: 'WRATHFUL KING',
    guardian: F + 'akagane-king-loom1.glb',
    coat: { thigh: .14, shin: .15 }, model: F + 'akagane-tr1.glb', extraModels: [],
    portrait: F + 'akagane-portrait.png', idleModel: F + 'akagane-idle1.glb',
    names: {
      'Rising Kick': 'Skybreaker Kick', 'Guardian Fist': 'Wrathful King: Fist',
    },
    shop: { 'fighter-akagane': { name: 'Akagane', glyph: '銅', blurb: 'The copper tyrant of the old wars, out of his tomb: an iron war fan, a skybreaker kick, a sea of fire - and Heaven\'s Anvil, a burning star pulled out of the sky onto them.' } },
  },
  // SHIUN - the False Saint (Shiun's place), Cinder Requiem. The serene conductor of the requiem the dead city sings: a
  // white cassock-coat with a black-lined collar, a violet sash and stole, rimless spectacles, silver-lavender hair
  // slicked back into a short tail, a slender straight sword in his right hand (round 3's katana, on Shiun's sword
  // hand). He fights with numbered hymns of violet light and a copy of himself that shatters like a mirror. Awakened, the
  // PALE SERAPH: porcelain-white and cracked, an ember in his chest, ash-white moth wings with violet eye-spots on his
  // back (a model of their own, worn on his upper spine: scripts/originals/shop/wings_c.py).
  shiun: {
    name: 'Shiun', series: 'Cinder Requiem', tagline: 'The serene conductor of the Cinder Requiem, who has had the whole dead city singing his hymn since before anyone noticed.',
    homeArt: true,
    color: '#a48ae0',
    moves: ['Measured Cut', 'False Encore', 'Hymn 12: Stained-Glass Lances', 'Hymn 40: Black Confessional'],
    shortMoves: ['MEASURED CUT', 'FALSE ENCORE', 'GLASS LANCES', 'BLACK CONFESSIONAL'],
    awakening: 'PALE SERAPH',
    // QA round (3 November 2026, fix-c): with his skirt off his fingers and on its chains (build_c.sh), kept off trousers
    // that reach 0.135 m from the thigh's axis (measured on shiun-tr1.glb), not the slim recipe's 0.12.
    coat: { thigh: .15, shin: .11 }, model: F + 'shiun-tr1.glb', extraModels: [],
    formModel: F + 'shiun-awakened-tr1.glb',
    portrait: F + 'shiun-portrait.png',
    names: {
      'Hymn 12: Stained-Glass Lances': 'Hymn 12: Stained-Glass Lances', 'Hymn 40: Black Confessional': 'Hymn 40: Black Confessional',
      'Hymn 3: Wailing Choir': 'Hymn 3: Wailing Choir',
    },
    shop: { 'fighter-shiun': { name: 'Shiun', glyph: '紫', blurb: 'The False Saint of the Cinder Requiem: a measured cut, a copy of him that shatters like a mirror, lances of violet stained glass - and the Black Confessional, closing round them.' } },
  },
  // MAGATSU - the Hex King (Magatsu's place), Hex Fallout. A calamity older than the fall, who ate the fallout like a
  // feast: wild hair ash-white at the roots and blood-red at the tips, black hex brands across his face like a cracked
  // mask and over his chest and forearms, a tattered crimson-black haori, a rope sash hung with bone charms. He carves
  // whatever he looks at with invisible slashes; awakened, the CALAMITY KING, his true form, a body of its own (a bone
  // half-mask, the brands glowing, a long mane, clawed gauntlets).
  magatsu: {
    name: 'Magatsu', series: 'Hex Fallout', tagline: 'The Calamity King, older than the fall, who ate the fallout like a feast and has come back for the rest.',
    homeArt: true,
    color: '#dc2337',
    moves: ['Flaying Cut', 'Calamity Maw', 'Rend: Thousand Cuts', 'Sanctum: Carrion Altar'],
    shortMoves: ['FLAYING CUT', 'CALAMITY MAW', 'THOUSAND CUTS', 'CARRION ALTAR'],
    awakening: 'CALAMITY KING',
    // Round 5 (3 November 2026): his v2 body has no skirt, so no coat's chains (scripts/originals/shop/build_c.sh).
    model: F + 'magatsu-tr1.glb', extraModels: [F + 'magatsu-tr1-area1.glb'],
    // (remake-areas, 6 November: `*-area1.glb` hold his Calamity Pyre cast, both bodies: src/originals/areaCasts.ts.)
    formModel: F + 'magatsu-awakened-tr1.glb', formExtraModels: [F + 'magatsu-awakened-tr1-area1.glb'],
    portrait: F + 'magatsu-portrait.png', idleModel: F + 'magatsu-idle1.glb',
    names: {
      'Dark Spark': 'Blood Spark',
    },
    shop: { 'fighter-magatsu': { name: 'Magatsu', glyph: '禍', blurb: 'The Calamity King: invisible slashes from bare hands, a thousand cuts at once - and the Carrion Altar, his sanctum, where everything in reach is carved apart.' } },
  },
};
