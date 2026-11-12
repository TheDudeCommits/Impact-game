import type { FighterId } from '../../game/types';
import type { OriginalFighter } from '../roster';

const F = '/assets/fighters/';

export const SHOP_E: Partial<Record<FighterId, OriginalFighter>> = {
  ippon: {
    name: 'Ippon', series: 'Blast Radius',
    tagline: 'The quarantined crater-city where monsters crawl out every week, and one bored volunteer cleaner punches each of them back in, once.',
    homeArt: true,
    color: '#f0d040',
    moves: ['Clock-In Punch', 'Dust Allergy', 'Double Shift', 'Clean Slate'],
    shortMoves: ['CLOCK-IN', 'DUST ALLERGY', 'DOUBLE SHIFT', 'CLEAN SLATE'],
    awakening: 'ALL-NIGHTER',
    model: F + 'ippon-tr1.glb', extraModels: [],
    portrait: F + 'ippon-portrait.png', idleModel: F + 'ippon-idle1.glb',
    names: {},
    shop: {
      'fighter-ippon': { name: 'Ippon', blurb: 'The crater\'s volunteer cleaner: a punch on the clock, a sneeze that clears the street, a double shift of fists - and, for once, a clean slate.' },
    },
  },
  // SEKKA - the Shatter Fist. A demon martial artist of the ash winter who lives for a fight that never ends: long
  // ash-white hair with magenta tips in a high spiky ponytail, two short black horns, snowflake pupils, navy tattoo bands
  // round his arms and chest, a torn magenta sash, bound shins, bare toes and a broken shackle on each wrist. Awakened,
  // a WHITEOUT.
  sekka: {
    name: 'Sekka', series: 'Black Snow',
    tagline: 'A hundred years of falling ash and no dawn: demons walk the endless dusk, and the last swordsmen breathe through the ash to cut them down.',
    homeArt: true,
    color: '#ff6fa0',
    moves: ['Hailstone Fist', 'Avalanche', 'Frost Gale', 'Black Blizzard'],
    shortMoves: ['HAILSTONE', 'AVALANCHE', 'FROST GALE', 'BLACK BLIZZARD'],
    awakening: 'WHITEOUT',
    model: F + 'sekka-tr1.glb', extraModels: [],
    portrait: F + 'sekka-portrait.png', idleModel: F + 'sekka-idle1.glb',
    names: {
      'Straight Punch': 'Hailstone Fist', 'Diving Punch': 'Falling Hail',
    },
    shop: {
      'fighter-sekka': { name: 'Sekka', blurb: 'A demon of the black snow who lives to fight: the Hailstone Fist, the Avalanche, the Frost Gale that tears down the street - and the Black Blizzard.' },
    },
  },
  // ASAHI - the Lantern Blade. The boy who carries the last ember of the sun through the ash winter: messy black hair in
  // a short low tail, a kind, determined face, a green-and-black checked haori over a rust-brown padded jacket, a
  // respirator at his neck, an iron lantern at his hip and a plain katana (round 3's, on a bone of its own). Awakened, the
  // ember flares into DAYBREAK.
  asahi: {
    name: 'Asahi', series: 'Black Snow',
    tagline: 'A hundred years of falling ash and no dawn: demons walk the endless dusk, and the last swordsmen breathe through the ash to cut them down.',
    homeArt: true,
    color: '#2e9e6a',
    moves: ['Ripple Cut', 'Comet Throw', 'Ashfall Waltz', 'First Light'],
    shortMoves: ['RIPPLE CUT', 'COMET THROW', 'ASHFALL WALTZ', 'FIRST LIGHT'],
    awakening: 'DAYBREAK',
    coat: { thigh: .13, shin: .14 }, model: F + 'asahi-tr1.glb', extraModels: [],
    portrait: F + 'asahi-portrait.png',
    names: {
      'Rising Slash': 'Updraft Cut',
    },
    shop: {
      'fighter-asahi': { name: 'Asahi', glyph: '旭', blurb: 'The boy who carries the last ember of the sun: the Ripple Cut, the Comet Throw, the Ashfall Waltz - and First Light, the rite that sets the black sky on fire.' },
    },
  },
  // ROOK - the Gravecaller. The weakest hunter of the gates, who died in one and came back with the dead at his heel:
  // black hair swept back over shaved sides, a scar across his left eye, glowing violet eyes, a long black hunter's coat
  // with a raven-skull clasp, plated pauldrons and two raven-beak daggers. Awakened, he puts on the HOLLOW CROWN: black
  // bone armour seamed in violet, a raven-skull helm and a cloak of black feathers, a body of its own.
  'rook': {
    name: 'Rook', series: 'Gatefall',
    tagline: 'The gates tore open over the ruined cities, and the hunter nobody rated came back out of one with the dead at his heel.',
    homeArt: true,
    color: '#7a4dff',
    moves: ['Talon Cut', 'Crossed Talons', 'Grave Grip', 'Black Rookery'],
    shortMoves: ['TALON CUT', 'CROSSED TALONS', 'GRAVE GRIP', 'BLACK ROOKERY'],
    awakening: 'HOLLOW CROWN',
    coat: { thigh: .12, shin: .11 }, model: F + 'rook-tr1.glb', extraModels: [],
    formModel: F + 'rook-awakened-tr1.glb', formExtraModels: [F + 'rook-awakened-tr1-area1.glb'], // remake-areas: the form's Grave Legion cast (src/originals/areaCasts.ts)
    portrait: F + 'rook-portrait.png', idleModel: F + 'rook-idle1.glb',
    names: {
      'Shadow Cut': 'Raven Cut', 'Shadow Kick': 'Raven Kick',
    },
    shop: {
      'fighter-rook': { name: 'Rook', glyph: '墓', blurb: 'The hunter nobody rated, who died in a gate and came back: two raven talons, the Grave Grip - and the Black Rookery, an army of the dead risen behind him.' },
    },
  },
};
