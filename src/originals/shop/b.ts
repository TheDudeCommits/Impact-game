import type { FighterId } from '../../game/types';
import type { OriginalFighter } from '../roster';

const F = '/assets/fighters/';

// WUMING - the Withering Sage (wuming's place). A fallen god of the ruined Jade Court who learned the Great Sage's own
// arts, and wears his kung-fu garb gone mourning black - the hero's dark mirror, with a face of his own: long black hair
// in a high topknot bound by a silver ring, a lotus-petal mark on his brow, one jade teardrop earring, a black vest with
// silver frog buttons over charcoal sleeves, a rose-pink sash. He cuts with blades and a scythe of pink light. Awakened,
// JADE PYRE: the topknot burns lotus-pink (the slot's crown tint, AWAKENINGS['wuming'].hair).
const WUMING: OriginalFighter = {
  name: 'Wuming', series: 'Last Sun',
  tagline: "A fallen god of the ruined Jade Court, come down to weed the mortals out of the last sun's garden.",
  homeArt: true,
  color: '#e85fc8',
  moves: ['Weeding Fist', 'Lotus Edge', 'Withering Beam', "Heaven's Harvest"],
  shortMoves: ['WEEDING FIST', 'LOTUS EDGE', 'WITHERING BEAM', "HEAVEN'S HARVEST"],
  awakening: 'JADE PYRE',
  // Wuming's slot lists his body and four takes over it (fanim1-4); they are folded into Wuming's one body file.
  // Round 5 (3 November 2026): his v2 coat's skirt hangs on the coat's chains, over slim trousers.
  coat: { thigh: .12, shin: .11 }, model: F + 'wuming-tr1.glb', extraModels: [F + 'wuming-tr1-area1.glb'], // remake-areas: his Lotus Verdict cast (src/originals/areaCasts.ts)
  portrait: F + 'wuming-portrait.png',
  names: {},
  shop: {
    'fighter-wuming': { name: 'Wuming', glyph: '無', blurb: "A fallen god of the Jade Court in a brawler's garb, dyed for mourning: a blade of pink light from behind them, the Withering Beam - and a scythe that harvests the skyline." },
  },
};

const GANDANG: OriginalFighter = {
  name: 'Banjaku', series: 'Last Sun',
  tagline: "The stone guardian who sat a thousand years at the last temple's gate, and has not been moved by anything since.",
  homeArt: true,
  color: '#d8262e',
  moves: ['Bedrock Jab', 'Uprooting Fist', 'Vermilion Seal', 'Mountain-Felling Fist'],
  shortMoves: ['BEDROCK JAB', 'UPROOTING FIST', 'VERMILION SEAL', 'MOUNTAIN FIST'],
  awakening: 'WRATHFUL GUARDIAN',
  coat: { thigh: .18, shin: .17, floor: .04, floored: true },
  model: F + 'gandang-tr1.glb', extraModels: [],
  portrait: F + 'gandang-portrait.png',
  names: {
    'Crushing Heel': 'Rockfall Heel',
  },
  shop: {
    'fighter-banjaku': { name: 'Banjaku', glyph: '石', blurb: 'A temple guardian gone to stone: a one-two heavier than it looks, an uppercut that uproots them, the Vermilion Seal - and a punch with a thousand years of stillness behind it.' },
  },
};

const JINLIN: OriginalFighter = {
  name: 'Jinlin', series: 'Last Sun',
  tagline: 'The golden carp who leapt the Dragon Gate and made himself tyrant of the dried seas, where he sells the last water by the drop.',
  homeArt: true,
  color: '#f5b41e',
  moves: ['Pearl Needle', 'Whirlpool Tail', 'Pearl Rain', 'Drowned Sun'],
  shortMoves: ['PEARL NEEDLE', 'WHIRLPOOL TAIL', 'PEARL RAIN', 'DROWNED SUN'],
  awakening: 'ABYSSAL TIDE',
  // Jinlin's slot lists his body and three takes over it (fanim1-3); they are folded into Jinlin's one body file.
  model: F + 'jinlin-tr1.glb', extraModels: [],
  formModel: F + 'jinlin-awakened-tr1.glb',
  portrait: F + 'jinlin-portrait.png',
  names: {
    'Tail Sweep': 'Tide Sweep', 'Double Axe Handle': 'Tyrant\'s Hammer',
  },
  shop: {
    'fighter-jinlin': { name: 'Jinlin', blurb: 'The tyrant of the dried seas in dragon gold: a needle of light off one finger, his tail swung round in a whirlpool, a rain of pearls - and the Drowned Sun.' },
  },
};

const GOHAKU: OriginalFighter = {
  name: 'Gohaku', series: 'Last Sun',
  tagline: 'The gentle scholar of the last library, in whom the long-armed white ape sleeps until someone he loves is hurt.',
  homeArt: true,
  color: '#a57cff',
  moves: ['Long-Arm Fist', 'Moon-Plucking Kick', 'Star-Shifting Beam', 'Sun-Seizing Spiral'],
  shortMoves: ['LONG-ARM FIST', 'MOON KICK', 'STAR BEAM', 'SUN SPIRAL'],
  awakening: 'WHITE APE',
  // Gohaku's slot lists his body and four takes over it (fanim1-4), folded into Gohaku's one body file, and an idle
  // file of its own (IDLE_PROFILES), which Gohaku's is.
  model: F + 'tongbi-tr1.glb', extraModels: [],
  portrait: F + 'tongbi-portrait.png', idleModel: F + 'tongbi-idle1.glb',
  names: {
    'Rising Kick': 'Moon-Plucking Kick', 'Flying Kick': 'Leaping Ape Kick',
  },
  shop: {
    'fighter-gohaku': { name: 'Gohaku', glyph: '猿', blurb: 'The scholar of the last library with the white ape let loose at last: a long-armed fist, a kick that plucks the moon, the Star-Shifting Beam - and the Sun-Seizing Spiral, bored straight through them.' },
  },
};

export const SHOP_B: Partial<Record<FighterId, OriginalFighter>> = {
  'wuming': WUMING,
  banjaku: GANDANG,
  'jinlin': JINLIN,
  'gohaku': GOHAKU,
};
