import type { FighterId } from '../../game/types';
import type { OriginalFighter } from '../roster';

const F = '/assets/fighters/';

export const SHOP_A: Partial<Record<FighterId, OriginalFighter>> = {
  // GORAI, the Thunderhead (Gorai's place). Three metres of storm-drunk warlord: black bull horns capped in copper, a
  // braided crest, a forked braided beard, lightning scars down both arms, a sleeveless storm-violet sailcloth greatcoat
  // and an anchor chain for a belt. He fights with a colossal riveted iron club cut from a ship's mast-spar (carried on
  // Gorai's mast-breaker bone, scripts/originals/shop/build_a.sh), swigs storm-grog before a gale, and calls the lightning
  // down it. Awakened, the STORM WYRM: a body of his own, scaled, antlered and tailed, in the half-wyrm form's place.
  gorai: {
    name: 'Gorai', series: 'Dust Sea',
    homeArt: true,
    tagline: 'The Thunderhead of the Dust Sea: three metres of storm-drunk warlord who has sunk every sand-fleet that ever sailed against him, and is bored of all of them.',
    color: '#8a63d2',
    moves: ['Mast Breaker', 'Hull Crusher', 'Grog Gale', 'Thunderhead: Sky Anvil'],
    shortMoves: ['MAST BREAKER', 'HULL CRUSHER', 'GROG GALE', 'SKY ANVIL'],
    awakening: 'STORM WYRM',
    coat: { thigh: .3, shin: .26 }, model: F + 'gorai-tr1.glb', formModel: F + 'gorai-awakened-tr1.glb',
    portrait: F + 'gorai-portrait.png',
    names: {
      'Great Roar': 'Storm Bellow',
    },
    shop: {
      'fighter-gorai': { name: 'Gorai', glyph: '雷', blurb: 'The Thunderhead of the Dust Sea, three metres of him: a ship\'s mast for a club, a cask of storm-grog, lightning on call - and the storm wyrm, scaled and tailed, when he wakes.' },
    },
  },
  // HALDOR, the Old Quake (Haldor's place). The oldest captain on the dried ocean, father to every lost sailor on it:
  // a long snow-white beard braided at the end, a white queue, a crescent scar across a bare chest, a sleeveless cream
  // longcoat, a navy sash and a rope belt. He fights with a colossal crescent glaive (carried on the bisento's joint) and
  // fists that crack the air like glass. His awakening, GROUNDSWELL, is the slot's aura.
  haldor: {
    name: 'Haldor', series: 'Dust Sea',
    homeArt: true,
    tagline: 'The Old Quake of the Dust Sea: the oldest captain on the dried ocean, father to every lost sailor on it, whose fists still make the seabed roll.',
    color: '#e9e2cf',
    moves: ['Crescent Reap', 'Prow Splitter', 'Faultline Fist', 'World Tilt: Seabed Rising'],
    shortMoves: ['CRESCENT REAP', 'PROW SPLITTER', 'FAULTLINE FIST', 'WORLD TILT'],
    awakening: 'GROUNDSWELL',
    // QA round (3 November 2026, fix-c): his bloused trousers reach 0.21 m from the thigh's axis and 0.18 from the shin's
    // (measured on haldor-tr1.glb), past the capsules his coat was kept out of, so a wide stance or a stride pushed them
    // through its back as black holes (through the springs, .deploy probe: the worst frame of a light 22% of the coat
    // pierced, of a heavy 22%, 12% standing; on these, 12, 15 and 12); and its hem, held to 12 degrees, rode a run stiff.
    coat: { thigh: .28, shin: .24, cone: 18 }, model: F + 'haldor-tr1.glb',
    portrait: F + 'haldor-portrait.png',
    names: {},
    shop: {
      'fighter-haldor': { name: 'Haldor', blurb: 'The Old Quake of the Dust Sea: a crescent glaive taller than a man, and fists that crack the air like glass and tilt the dead seabed under them.' },
    },
  },
  sorrel: {
    name: 'Sorrel', series: 'Dust Sea',
    homeArt: true,
    tagline: 'The Crimson Wake of the Dust Sea: the most easy-going captain on the dried ocean, and the one nobody ever crosses twice.',
    color: '#d8323c',
    moves: ['Wake Cutter', 'Redline Thrust', 'Crimson Command', 'Horizon Sunder'],
    shortMoves: ['WAKE CUTTER', 'REDLINE', 'COMMAND', 'HORIZON SUNDER'],
    awakening: 'CRIMSON WILL',
    coat: { thigh: .12, shin: .11 }, model: F + 'sorrel-tr1.glb',
    portrait: F + 'sorrel-portrait.png',
    names: {},
    shop: {
      'fighter-sorrel': { name: 'Sorrel', glyph: '紅', blurb: 'The Crimson Wake: a dark cutlass, a lazy smile, and a will that drops a crowd of raiders to its knees without a blow.' },
    },
  },
  dorado: {
    name: 'Dorado', series: 'Dust Sea',
    homeArt: true,
    tagline: 'The Far-Edge Captain: the first ever to cross the whole Dust Sea to its far edge, and he came back laughing.',
    color: '#d9a441',
    moves: ['Gilded Cut', 'Crown Lunge', 'Sovereign Shot', 'Last Light: Sunset Divide'],
    shortMoves: ['GILDED CUT', 'CROWN LUNGE', 'SOVEREIGN SHOT', 'SUNSET DIVIDE'],
    awakening: 'LAST HORIZON',
    coat: { thigh: .13, shin: .13 }, model: F + 'dorado-tr1.glb',
    portrait: F + 'dorado-portrait.png',
    names: {},
    shop: {
      'fighter-dorado': { name: 'Dorado', glyph: '陽', blurb: 'The Far-Edge Captain: a gilded cutlass, a brass flintlock, and the one cut he saved for the far edge of the dead sea.' },
    },
  },
};
