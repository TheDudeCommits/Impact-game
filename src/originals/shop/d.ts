import type { FighterId } from '../../game/types';
import type { OriginalFighter } from '../roster';

const F = '/assets/fighters/';
const shopItem = (name: string, blurb: string, glyph: string) => ({ name, blurb, glyph }) as { name: string; blurb: string };

export const SHOP_D: Partial<Record<FighterId, OriginalFighter>> = {
  vesper: {
    name: 'Vesper', series: 'Grave Hound', tagline: 'The uncrowned of the grave roads, who led his company toward a crown and paid for it with every one of them.',
    homeArt: true,
    color: '#dfe8ff',
    moves: ['Quill Thrust', "Raven's Drop", 'Pale Lance', 'The Offering'],
    shortMoves: ['QUILL THRUST', "RAVEN'S DROP", 'PALE LANCE', 'THE OFFERING'],
    awakening: 'BLACK VESPERS',
    coat: { thigh: .13, shin: .14 }, model: F + 'vesper-tr1.glb',
    formModel: F + 'vesper-awakened-tr1.glb',
    portrait: F + 'vesper-portrait.png', idleModel: F + 'vesper-idle1.glb',
    names: {},
    shop: {
      'fighter-vesper': shopItem('Vesper', "The Uncrowned of the grave roads: a fencer's sabre, a dive through them before they see him move - and the Offering, when the sun goes black over them.", '鴉'),
    },
  },
  // IMAGO - the Swarm King (Salvage Wilds, Thunder Hawk's world). The perfect king the insect swarm that ate the old world was born
  // to make: a mantis's crest for a crown, gold eyes in black sclera, jade chitin edged in black, a cloak of folded
  // wing-cases (on chains below the waist), and the ringed tail with its hooked stinger, built onto his body as main built
  // the King's, on the joints the slot's springs swing. His awakening, SWARM ASCENDANT, burns jade round his own body.
  imago: {
    name: 'Imago', series: 'Salvage Wilds', tagline: 'The perfect king the swarm was born to make, who has never met anything in the wastes worth bowing to.',
    homeArt: true,
    color: '#3ae88a',
    moves: ['Swarm Claw', 'Stinger Lash', 'Hive Burst', 'The Final Molt'],
    shortMoves: ['SWARM CLAW', 'STINGER LASH', 'HIVE BURST', 'FINAL MOLT'],
    awakening: 'SWARM ASCENDANT',
    coat: { thigh: .13, shin: .14 }, model: F + 'imago-tr1.glb',
    portrait: F + 'imago-portrait.png', idleModel: F + 'imago-idle1.glb',
    names: {},
    shop: {
      'fighter-imago': shopItem('Imago', 'The Swarm King: a claw quicker than the eye, a stinger that whips and storms round him - and the Final Molt, both fists brought down.', '蟲'),
    },
  },
  // GAKU - the Stone Lion (Salvage Wilds, Thunder Hawk's best friend there). A feral boy of the drowned isles who grew up among a
  // ruined shrine's stone lion-dogs: a wild black mane of hair tipped sandy gold, a chipped-tooth grin, a moss-green vest,
  // a lure at his belt and a fist like a landslide. His awakening, KOMAINU, is a body of his own: the boy grown at once into
  // the guardian, towering, his mane rising like black flame, gold cracks across his skin like carved stone.
  gaku: {
    name: 'Gaku', series: 'Salvage Wilds', tagline: 'The feral boy of the drowned isles, raised among a ruined shrine\'s stone lion-dogs, who hits like a landslide and never stops grinning.',
    homeArt: true,
    color: '#4fae3c',
    moves: ['Lion Fist', 'Fang Sweep', 'Roar Palm', 'Landslide'],
    shortMoves: ['LION FIST', 'FANG SWEEP', 'ROAR PALM', 'LANDSLIDE'],
    awakening: 'KOMAINU',
    model: F + 'gaku-tr1.glb',
    formModel: F + 'gaku-awakened-tr1.glb',
    portrait: F + 'gaku-portrait.png', idleModel: F + 'gaku-idle1.glb',
    names: {
      'Lion\'s Roar': 'Mane Flare',
    },
    shop: {
      'fighter-gaku': shopItem('Gaku', 'The feral boy of the drowned isles: a lion\'s fist, a fang of gold, a roar thrown off his palm - and the Landslide, everything he has in one punch.', '獅'),
    },
  },
  levin: {
    name: 'Levin', series: 'Ropewalk', tagline: 'The smallest man on the Ropewalk keeps the cleanest blades - and has the floor swept before you finish falling.',
    homeArt: true,
    color: '#7d9bb8', height: 1.6,
    moves: ['Shave', 'Fuse Lance', 'Zipline', 'SOJI: Clean Sweep'],
    shortMoves: ['SHAVE', 'FUSE LANCE', 'ZIPLINE', 'CLEAN SWEEP'],
    awakening: 'KEPPEKI',
    cape: { hang: .8, cone: 18, droop: 45, stiffness: 16, thigh: .11, shin: .1 }, model: F + 'levin-tr1.glb',
    portrait: F + 'levin-portrait.png',
    names: {},
    shop: {
      'fighter-levin': shopItem('Levin', 'Ropewalk\'s spotless captain: two short swords, a line reel to cross the room before you blink - and the Clean Sweep, nothing left standing but the dust he missed.', '掃'),
    },
  },
};
