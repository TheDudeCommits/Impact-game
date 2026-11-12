import type { FighterId } from '../../game/types';
import type { OriginalFighter } from '../roster';

const F = '/assets/fighters/';
/** A shop item renamed, with the kanji the shop sets behind it (catalog.ts `glyph`): the original's motif. */
const shopItem = (name: string, blurb: string, glyph: string) => ({ name, blurb, glyph }) as { name: string; blurb: string };

export const SHOP_R6B: Partial<Record<FighterId, OriginalFighter>> = {
  // FULL BEAM - The old lighthouse keeper of a blacked-out city, the light every hero in it steers by, who grins wider the darker it gets.
  'full-beam': {
    name: 'Full Beam', series: 'Beacon Ward', tagline: 'The old lighthouse keeper of a blacked-out city, the light every hero in it steers by, who grins wider the darker it gets.',
    color: '#edc750', height: 2.2,
    moves: ['Cape Horn Jab', "Land's End Chop", 'Foghorn Blast', 'Seven Seas Haymaker'],
    shortMoves: ['CAPE HORN', "LAND'S END", 'FOGHORN', 'SEVEN SEAS'],
    awakening: 'LAST WATCH',
    model: F + 'fullbeam-tr1.glb', extraModels: [],
    portrait: F + 'fullbeam-portrait.png',
    names: {
      'Aerial Hammer': 'Anchor Drop', 'Meteor Landing': 'Shipwreck Landing',
    },
    shop: { 'fighter-full-beam': shopItem('Full Beam', "The keeper of the last lighthouse: a jab off Cape Horn, a chop from Land's End, a punch that booms like a foghorn - and, when the dark comes in, the Seven Seas Haymaker.", '灯') },
  },
  // BELLOWS - The foundry master who feeds the city's last furnace and burns hotter than any hero in it, and still shines second, which he will never forgive.
  bellows: {
    name: 'Bellows', series: 'Beacon Ward', tagline: "The foundry master who feeds the city's last furnace and burns hotter than any hero in it, and still shines second, which he will never forgive.",
    color: '#ff6b22', height: 2.03,
    moves: ['Ingot Jab', "Smelter's Fist", 'Slag Lances', 'Meltdown'],
    shortMoves: ['INGOT', 'SMELTER', 'SLAG LANCES', 'MELTDOWN'],
    awakening: 'STOKED',
    coat: { thigh: .13, shin: .14 }, model: F + 'bellows-tr1.glb', extraModels: [],
    portrait: F + 'bellows-portrait.png',
    names: {},
    shop: { 'fighter-bellows': shopItem('Bellows', "The foundry master of Beacon Ward: a jab like a hot ingot, a smelter's fist, lances of molten slag - and Meltdown, the hottest thing in the city.", '炉') },
  },
  // AMPERE - The lineman's boy who was handed the lighthouse keeper's light: overcharged with green current, breaking his own arms to keep a blacked-out city lit.
  ampere: {
    name: 'Ampere', series: 'Beacon Ward', tagline: "The lineman's boy who was handed the lighthouse keeper's light: overcharged with green current, breaking his own arms to keep a blacked-out city lit.",
    color: '#37dba0', height: 1.78,
    moves: ['Live Line Jab', 'Cape Wrath Kick', 'Finisterre Flick', 'Foghorn Blast: Overcharge'],
    shortMoves: ['LIVE LINE', 'CAPE WRATH', 'FINISTERRE', 'OVERCHARGE'],
    awakening: 'LIGHTS ON',
    model: F + 'ampere-tr1.glb', extraModels: [], formModel: F + 'ampere-awakened-tr1.glb', formExtraModels: [],
    // (cloth3, 5 November 2026: his hooded cape on chains of its own from his shoulders, shop/cape_chains_r6.py 'ampere'; it rode
    // his hips, and went up with them as one shell in a launch.)
    cape: { hang: .8, cone: 18, droop: 45, stiffness: 16, thigh: 0 },
    portrait: F + 'ampere-portrait.png',
    names: {},
    shop: { 'fighter-ampere': shopItem('Ampere', "The light Beacon Ward was handed on: a live-line jab, a kick off Cape Wrath, a flick from the end of the earth - and his teacher's Foghorn Blast, overcharged.", '電') },
  },
  // PYROCLAST - Beacon Ward's walking volcano, a boy of black glass and magma cracks who means to be the biggest eruption the city has ever seen.
  pyroclast: {
    name: 'Pyroclast', series: 'Beacon Ward', tagline: "Beacon Ward's walking volcano, a boy of black glass and magma cracks who means to be the biggest eruption the city has ever seen.",
    color: '#f38b31', height: 1.9,
    moves: ['Spitfire Palm', 'Lava Bomb', 'Vent Shot', 'Supervolcano'],
    shortMoves: ['SPITFIRE', 'LAVA BOMB', 'VENT SHOT', 'SUPERVOLCANO'],
    awakening: 'BOILING POINT',
    model: F + 'pyroclast-tr1.glb', extraModels: [],
    portrait: F + 'pyroclast-portrait.png',
    names: {},
    shop: { 'fighter-pyroclast': shopItem('Pyroclast', "Beacon Ward's walking volcano: a spitfire palm, a lava bomb, a vent shot - and the Supervolcano, the biggest bang in the city.", '噴') },
  },
  // HAGURE - The stray who fled the cleaners' dojo to hunt them one by one, and who has decided the monsters are the ones worth being.
  hagure: {
    name: 'Hagure', series: 'Blast Radius', tagline: "The stray who fled the cleaners' dojo to hunt them one by one, and who has decided the monsters are the ones worth being.",
    color: '#2696ec', height: 1.82,
    moves: ['Snap Bite', 'Mauling Palm', 'Howling Spin', 'Pack of One'],
    shortMoves: ['SNAP BITE', 'MAULING PALM', 'HOWLING SPIN', 'PACK OF ONE'],
    awakening: 'MOONLESS',
    coat: { thigh: .12, shin: .11 }, model: F + 'hagure-tr1.glb', extraModels: [], formModel: F + 'hagure-awakened-tr1.glb', formExtraModels: [],
    portrait: F + 'hagure-portrait.png',
    names: {},
    shop: { 'fighter-hagure': shopItem('Hagure', "The stray of Blast Radius who hunts the cleaners: a snapping jab, a mauling palm, a howling spin - and Pack of One, a whole pack's worth of fists from one wolf.", '野') },
  },
  // KUZU - The scrapyard stray with handsaws for arms and an iron hound's skull for a head, working off a dead man's debt for three hot meals and a bed.
  kuzu: {
    name: 'Kuzu', series: 'Scrap Pact', tagline: "The scrapyard stray with handsaws for arms and an iron hound's skull for a head, working off a dead man's debt for three hot meals and a bed.",
    color: '#e8752c', height: 1.73,
    moves: ['Sawtooth Swipe', 'Dovetail Cut', 'Mad Dog Rush', 'Bonegrinder'],
    shortMoves: ['SAWTOOTH', 'DOVETAIL', 'MAD DOG', 'BONEGRINDER'],
    awakening: 'OFF THE LEASH',
    model: F + 'kuzu-tr1.glb', extraModels: [],
    portrait: F + 'kuzu-portrait.png',
    names: {
    },
    shop: { 'fighter-kuzu': shopItem('Kuzu', 'The scrapyard stray of Scrap Pact: a sawtooth swipe, a dovetail cut, a mad dog rush - and the Bonegrinder, all teeth, no brakes.', '錆') },
  },
  // HIKUI - The fire-eater cast out of the ice country, small and sharp, with a violet flame bound in his right arm and no patience for anyone slower than him, which is everyone.
  hikui: {
    name: 'Hikui', series: 'Ghost Wake', tagline: 'The fire-eater cast out of the ice country, small and sharp, with a violet flame bound in his right arm and no patience for anyone slower than him, which is everyone.',
    color: '#9460d7', height: 1.57,
    moves: ['Flicker Draw', 'Witchfire Blade', 'Heat Haze Cut', 'Unbound: Violet Balefire'],
    shortMoves: ['FLICKER', 'WITCHFIRE', 'HEAT HAZE', 'VIOLET BALEFIRE'],
    awakening: 'FIRE-EATER',
    model: F + 'hikui-tr1.glb', extraModels: [], formModel: F + 'hikui-awakened-tr1.glb', formExtraModels: [],
    portrait: F + 'hikui-portrait.png',
    names: {
      'Shadow Cut': 'Flicker Cut',
    },
    shop: { 'fighter-hikui': shopItem('Hikui', 'The fire-eater of Ghost Wake: a draw quicker than a flicker, a witchfire blade, a cut through the heat haze - and the violet balefire bound in his arm, let loose.', '焔') },
  },
  // LANTHORN - The boyish keeper of a tavern that wanders the road of penance, centuries old under the grin, with a black flame banked in the iron lamp on his arm.
  lanthorn: {
    name: 'Lanthorn', series: 'Penance Road', tagline: 'The boyish keeper of a tavern that wanders the road of penance, centuries old under the grin, with a black flame banked in the iron lamp on his arm.',
    color: '#a866e0', height: 1.55,
    moves: ['Wick Cut', 'Backdraft', 'Lampblack Edge', 'Last Call'],
    shortMoves: ['WICK CUT', 'BACKDRAFT', 'LAMPBLACK', 'LAST CALL'],
    awakening: 'AFTER HOURS',
    model: F + 'lanthorn-tr1.glb', extraModels: [], formModel: F + 'lanthorn-awakened-tr1.glb', formExtraModels: [],
    portrait: F + 'lanthorn-portrait.png',
    names: {},
    shop: { 'fighter-lanthorn': shopItem('Lanthorn', 'The tavern keeper of Penance Road: a cut that trims the wick, a backdraft that gives you your change, a blade black with lamp soot - and last call.', '酒') },
  },
  // AKAYURI - The quiet assassin of a rotting capital, with spider lilies stitched up her sleeve, crossing names out of the ledger the old court wrote in blood.
  akayuri: {
    name: 'Akayuri', series: 'Crimson Ledger', tagline: 'The quiet assassin of a rotting capital, with spider lilies stitched up her sleeve, crossing names out of the ledger the old court wrote in blood.',
    color: '#db2949', height: 1.64,
    moves: ['Lily Cut', 'Farewell Turn', 'Far Shore Thrust', 'Equinox: Lily Field'],
    shortMoves: ['LILY CUT', 'FAREWELL', 'FAR SHORE', 'LILY FIELD'],
    awakening: 'SCARLET BLOOM',
    model: F + 'akayuri-tr1.glb', extraModels: [], formModel: F + 'akayuri-awakened-tr1.glb', formExtraModels: [],
    portrait: F + 'akayuri-portrait.png',
    names: {},
    shop: { 'fighter-akayuri': shopItem('Akayuri', 'The quiet blade of Crimson Ledger: a lily cut, a farewell turn, a thrust to the far shore - and a field of red lilies where her mark falls.', '華') },
  },
  // SHANXIAO - A wild giant of the misty mountains who has chased the last sun across the earth, and who breaks whatever stands between him and it.
  shanxiao: {
    name: 'Shanxiao', series: 'Last Sun', tagline: 'A wild giant of the misty mountains who has chased the last sun across the earth, and who breaks whatever stands between him and it.',
    color: '#91d844', height: 2.1,
    moves: ['Wild Hook', 'Jade Hammer', 'Jade Comet', 'Sun Chaser'],
    shortMoves: ['WILD HOOK', 'JADE HAMMER', 'JADE COMET', 'SUN CHASER'],
    awakening: 'JADE STORM',
    // (The fighter quality round, fix-polish: his yak-pelt mantle hangs from his shoulders on chains of its own and swings,
    // no longer a shell over him in the run; floor-length, so no leg capsules.)
    cape: { cone: 18, hang: .8, droop: 40, stiffness: 16, thigh: 0 },
    model: F + 'shanxiao-tr1.glb', extraModels: [F + 'shanxiao-tr1-area1.glb'], formModel: F + 'shanxiao-awakened-tr1.glb', formExtraModels: [F + 'shanxiao-awakened-tr1-area1.glb'], // remake-areas: his Toppled Peak cast, both bodies (src/originals/areaCasts.ts)
    portrait: F + 'shanxiao-portrait.png',
    names: {
      'Aerial Hammer': 'Falling Jade', 'Meteor Landing': 'Peak Landing',
    },
    shop: { 'fighter-shanxiao': shopItem('Shanxiao', "The Last Sun's wild giant: a wild hook, a jade hammer, a jade comet - and the Sun Chaser, for whoever he finally catches.", '山') },
  },
  // OVID - A carcass-cleaner of the monster coast who swallowed something he shouldn't have, now a giant of black glass on the cleanup crew's side, still wearing his hazard rag.
  'ovid': {
    name: 'Ovid', series: 'Carcass Coast', tagline: "A carcass-cleaner of the monster coast who swallowed something he shouldn't have, now a giant of black glass on the cleanup crew's side, still wearing his hazard rag.",
    color: '#57d7bd', height: 2.35,
    moves: ['Cracked Knuckle', 'Shovel Uppercut', 'Shatterburst', 'Full Demolition'],
    shortMoves: ['CRACKED KNUCKLE', 'SHOVEL UPPERCUT', 'SHATTERBURST', 'FULL DEMOLITION'],
    awakening: 'CRACKED OPEN',
    model: F + 'ovid-tr1.glb', extraModels: [],
    portrait: F + 'ovid-portrait.png',
    names: {
      'Sledgehammer': 'Iron Sledge', 'Collapse': 'Condemned',
    },
    shop: { 'fighter-ovid': shopItem('Ovid', "Carcass Coast's cleaner turned monster: a cracked knuckle, a shovel uppercut, a shatterburst - and full demolition.", '砕') },
  },
  // SHIBUICHI - Slag Hill's gentlest giant: the smith's little brother, a suit of plate with no one visible inside, who would rather mend a thing than break it.
  'shibuichi': {
    name: 'Shibuichi', series: 'Slag Hill', tagline: "Slag Hill's gentlest giant: the smith's little brother, a suit of plate with no one visible inside, who would rather mend a thing than break it.",
    color: '#8197a3', height: 2.2,
    moves: ['Planish', 'Billet Ram', 'Quench Palm', 'KINTSUGI: Golden Seam'],
    shortMoves: ['PLANISH', 'BILLET RAM', 'QUENCH', 'GOLDEN SEAM'],
    awakening: 'HEARTHLIGHT',
    model: F + 'shibuichi-tr1.glb', extraModels: [],
    portrait: F + 'shibuichi-portrait.png',
    names: {
      'Armored Hammer': 'Sledge',
    },
    shop: { 'fighter-shibuichi': shopItem('Shibuichi', "Slag Hill's gentle giant: planishing blows, a billet ram, a palm that quenches the ground - and KINTSUGI, the golden seam.", '鋳') },
  },
  // HIGHSUN - The walking tavern's noonday giant, who grows stronger as the sun climbs and, at twelve o'clock, admits no equal under the sky.
  highsun: {
    name: 'Highsun', series: 'Penance Road', tagline: "The walking tavern's noonday giant, who grows stronger as the sun climbs and, at twelve o'clock, admits no equal under the sky.",
    color: '#f4b442', height: 2.05,
    moves: ['Sunbeam Cut', "Twelve O'Clock", 'Pocket Sun', 'Sword of the Zenith'],
    shortMoves: ['SUNBEAM', "TWELVE O'CLOCK", 'POCKET SUN', 'ZENITH SWORD'],
    awakening: 'NO SHADOW',
    // (The fighter quality round, fix-polish: his cape off his arms and hung from his shoulders on chains of its own,
    // shop/cape_chains_r6.py 'highsun', so his crouching guard no longer tears it into shards to the floor.)
    cape: { hang: .8, cone: 20, droop: 45, stiffness: 16, thigh: .14, shin: .11 },
    model: F + 'highsun-tr1.glb', extraModels: [], formModel: F + 'highsun-awakened-tr1.glb', formExtraModels: [],
    portrait: F + 'highsun-portrait.png',
    names: {},
    shop: { 'fighter-highsun': shopItem('Highsun', "Penance Road's noonday giant: a sunbeam cut, a blow at twelve o'clock, a pocket sun - and the Sword of the Zenith.", '午') },
  },
  // CARDO - The thistle of the briar kingdom's border: no spellbook, no magic, a sword that cuts spells apart, and a weed's refusal to stay trampled.
  cardo: {
    name: 'Cardo', series: 'Briar Crown', tagline: "The thistle of the briar kingdom's border: no spellbook, no magic, a sword that cuts spells apart, and a weed's refusal to stay trampled.",
    color: '#c94a3a', height: 1.55,
    moves: ['Weedcutter', 'Plowshare Drop', 'Unspell', 'Last Weed Standing'],
    shortMoves: ['WEEDCUTTER', 'PLOWSHARE', 'UNSPELL', 'LAST WEED'],
    awakening: 'OVERGROWN',
    model: F + 'cardo-tr1.glb', extraModels: [],
    portrait: F + 'cardo-portrait.png',
    names: {},
    shop: { 'fighter-cardo': shopItem('Cardo', 'The thistle of Briar Crown: a weedcutter, a plowshare drop, a slash that undoes spells - and the last weed standing.', '薊') },
  },
  // TANCHO - The furnace master's quiet son, a red-crowned crane with frost on one wing and fire on the other, who means to fly on both without anyone's say-so.
  tancho: {
    name: 'Tancho', series: 'Beacon Ward', tagline: "The furnace master's quiet son, a red-crowned crane with frost on one wing and fire on the other, who means to fly on both without anyone's say-so.",
    color: '#82d9ef', height: 1.8,
    moves: ['Frostbeak', 'Scarlet Wing', 'White Wingspan', 'Thousand Cranes'],
    shortMoves: ['FROSTBEAK', 'SCARLET WING', 'WINGSPAN', 'THOUSAND CRANES'],
    awakening: 'RED CROWN',
    model: F + 'tancho-tr1.glb', extraModels: [],
    portrait: F + 'tancho-portrait.png',
    names: {},
    shop: { 'fighter-tancho': shopItem('Tancho', 'The crane of Beacon Ward: a frost-tipped beak, a wing of scarlet fire, a wingspan of ice - and, at last, the Thousand Cranes.', '鶴') },
  },
  // TORSION - The crater-city's top-ranked cleaner, small, sharp-tongued and strong enough to wring a whole street like a rag, who has never once asked anyone for help.
  torsion: {
    name: 'Torsion', series: 'Blast Radius', tagline: "The crater-city's top-ranked cleaner, small, sharp-tongued and strong enough to wring a whole street like a rag, who has never once asked anyone for help.",
    color: '#65edb0', height: 1.48,
    moves: ['Snap Twist', 'Wring Out', 'Rubble Volley', 'Full Torque'],
    shortMoves: ['SNAP TWIST', 'WRING OUT', 'RUBBLE VOLLEY', 'FULL TORQUE'],
    awakening: 'GLOVES OFF',
    // (The fighter quality round, fix-polish: her cape hangs from her shoulders on chains of its own and swings, no longer
    // riding her back rigid; no leg capsules, which pushed it into slats in her kicks.)
    cape: { cone: 18, hang: .75, droop: 45, stiffness: 18, thigh: 0 },
    model: F + 'torsion-tr1.glb', extraModels: [F + 'torsion-tr1-area1.glb'], // remake-areas: her Twist-Off cast (src/originals/areaCasts.ts)
    portrait: F + 'torsion-portrait.png',
    names: {},
    shop: { 'fighter-torsion': shopItem('Torsion', "Blast Radius's top-ranked cleaner: a snap twist, a wring-out, a volley of rubble - and Full Torque, every street in reach twisted at once.", '捻') },
  },
  // BONSHO - The ancient abbot who chairs the scavengers' guild from a ruined mountain temple, striking his bronze bell before every blow, bored for a century and itching for a worthy fight.
  bonsho: {
    name: 'Bonsho', series: 'Salvage Wilds', tagline: "The ancient abbot who chairs the scavengers' guild from a ruined mountain temple, striking his bronze bell before every blow, bored for a century and itching for a worthy fight.",
    color: '#e5bd54', height: 1.68,
    moves: ['Dawn Bell Palm', 'Bell-Log Elbow', 'First Toll', 'Hundred and Eight Tolls'],
    shortMoves: ['DAWN BELL', 'BELL-LOG', 'FIRST TOLL', '108 TOLLS'],
    awakening: 'GREAT BELL',
    coat: { thigh: .13, shin: .14 }, model: F + 'bonsho-tr1.glb', extraModels: [],
    portrait: F + 'bonsho-portrait.png',
    sculpture: F + 'bonsho-guardian1.glb',
    names: {
      'Hundred: And: Eight: Tolls': 'Hundred and Eight Tolls',
    },
    shop: { 'fighter-bonsho': shopItem('Bonsho', "The old abbot of the Salvage Wilds' ruined mountain temple: a palm for the dawn bell, an elbow like the striking log, the first toll - and all hundred and eight.", '鐘') },
  },
  // MUREX - The violet war-frame of the drowned coast that wakes when its boy pilot can't fight on: a spined thing in torn restraints that nobody is sure is only a machine.
  murex: {
    name: 'Murex', series: 'Red Cradle', tagline: "The violet war-frame of the drowned coast that wakes when its boy pilot can't fight on: a spined thing in torn restraints that nobody is sure is only a machine.",
    color: '#8a42d6', height: 2.6,
    moves: ['Hooked Claw', 'Spine Hammer', 'Flinch Wave', 'Spinestorm'],
    shortMoves: ['HOOKED CLAW', 'SPINE HAMMER', 'FLINCH', 'SPINESTORM'],
    awakening: 'UNSTRAPPED',
    model: F + 'murex-tr1.glb', extraModels: [F + 'murex-tr1-area1.glb'], // remake-areas: his Core Flare cast (src/originals/areaCasts.ts)
    portrait: F + 'murex-portrait.png',
    names: {
      'Armored Hammer': 'Spine Hammer', 'Aerial Hammer': 'Falling Spine Hammer',
    },
    shop: { 'fighter-murex': shopItem('Murex', 'The violet frame of Red Cradle: a hooked claw, a spine hammer, a flinch that throws you back - and the Spinestorm, when the last strap snaps.', '棘') },
  },
  // AQUILO - The orphan from the briar-choked border who woke to find the north wind answering him, and who means to take the thorn crown before his rival does.
  aquilo: {
    name: 'Aquilo', series: 'Briar Crown', tagline: 'The orphan from the briar-choked border who woke to find the north wind answering him, and who means to take the thorn crown before his rival does.',
    color: '#4fd18b', height: 1.72,
    moves: ['Gust Darts', 'Shearwind Gust', 'Skimming Gale', 'Great Northerly'],
    shortMoves: ['GUST DARTS', 'SHEARWIND', 'SKIMMING GALE', 'GREAT NORTHERLY'],
    awakening: 'WINDBORNE',
    coat: { thigh: .12, shin: .11 }, model: F + 'aquilo-tr1.glb', extraModels: [],
    portrait: F + 'aquilo-portrait.png',
    names: {},
    shop: { 'fighter-aquilo': shopItem('Aquilo', 'The north wind of Briar Crown: darts of air, a shearing gust, a gale that skims the ground - and the Great Northerly.', '北') },
  },
  // SVANHILD - The youngest of a silver-haired noble house, written off as its ugly duckling, whose water magic found its wings the day she stopped trying to please them.
  svanhild: {
    name: 'Svanhild', series: 'Briar Crown', tagline: 'The youngest of a silver-haired noble house, written off as its ugly duckling, whose water magic found its wings the day she stopped trying to please them.',
    color: '#6fc6ff', height: 1.61,
    moves: ['Swan Quill', 'Breaking Wing', 'Lakeglass Orb', 'Swan Song'],
    shortMoves: ['SWAN QUILL', 'BREAKING WING', 'LAKEGLASS', 'SWAN SONG'],
    awakening: 'WHITE PLUMAGE',
    coat: { thigh: .12, shin: .11 }, model: F + 'svanhild-tr1.glb', extraModels: [],
    portrait: F + 'svanhild-portrait.png',
    names: {},
    shop: { 'fighter-svanhild': shopItem('Svanhild', "The swan of Briar Crown's silver house: a quill of water, a wing that breaks bones, an orb of lake glass - and her swan song.", '鵠') },
  },
  // MIZUHIKI - The Ropewalk's quiet guardian in armour of overlapping plates, who fights on twin cables and has never once let go of the line that ties her to her family.
  mizuhiki: {
    name: 'Mizuhiki', series: 'Ropewalk', tagline: "The Ropewalk's quiet guardian in armour of overlapping plates, who fights on twin cables and has never once let go of the line that ties her to her family.",
    color: '#bd3544', height: 1.7,
    moves: ['Strand Cut', 'Cross Splice', 'Haul In', 'Bitter End'],
    shortMoves: ['STRAND', 'CROSS SPLICE', 'HAUL IN', 'BITTER END'],
    awakening: 'TAUT',
    coat: { thigh: .12, shin: .11 }, model: F + 'mizuhiki-tr1.glb', extraModels: [],
    portrait: F + 'mizuhiki-portrait.png',
    names: {
      'Return Cut': 'Rebound Cut',
    },
    shop: { 'fighter-mizuhiki': shopItem('Mizuhiki', "The Ropewalk's guardian: a strand cut, a cross splice, a haul in on her own cable - and the bitter end.", '縄') },
  },
  // ROTFALKE - The red falcon of the drowned coast, a war-frame grown more than built, piloted by a proud teenage pilot-prodigy who will not let anyone see her lose.
  rotfalke: {
    name: 'Rotfalke', series: 'Red Cradle', tagline: 'The red falcon of the drowned coast, a war-frame grown more than built, piloted by a proud teenage pilot-prodigy who will not let anyone see her lose.',
    color: '#f04734', height: 3.05,
    moves: ['Feather Knife', 'Raking Talon', 'Diving Stoop', 'Ten-Count Talons'],
    shortMoves: ['FEATHER KNIFE', 'RAKING TALON', 'STOOP', 'TEN-COUNT'],
    awakening: "MOTHER'S WINGS",
    model: F + 'rotfalke-tr1.glb', extraModels: [], formModel: F + 'rotfalke-awakened-tr1.glb', formExtraModels: [],
    portrait: F + 'rotfalke-portrait.png',
    names: {
      'Rush 1': 'Air Talon', 'Rush 2': 'Air Feather', 'Rush 3': 'Air Stoop', 'Rising Talon Heel': 'Rising Barb Heel',
    },
    shop: { 'fighter-rotfalke': shopItem('Rotfalke', 'The red falcon of Red Cradle: a feather knife, a raking talon, a dive that breaks any guard - and a countdown nobody survives.', '隼') },
  },
  // BRUIN - A bear of a swordsman from the far eastern islands, lazy until somebody wakes him, who captains the briar kingdom's rowdiest band.
  bruin: {
    name: 'Bruin', series: 'Briar Crown', tagline: "A bear of a swordsman from the far eastern islands, lazy until somebody wakes him, who captains the briar kingdom's rowdiest band.",
    color: '#6b4fc4', height: 1.83,
    moves: ['Bearpaw Cut', 'Grizzly Thrust', 'Night Prowl', 'Starless Cut'],
    shortMoves: ['BEARPAW', 'GRIZZLY', 'NIGHT PROWL', 'STARLESS'],
    awakening: 'WIDE AWAKE',
    coat: { thigh: .13, shin: .14 }, model: F + 'bruin-tr1.glb', extraModels: [],
    portrait: F + 'bruin-portrait.png',
    names: {},
    shop: { 'fighter-bruin': shopItem('Bruin', "Briar Crown's bear from the far islands: a bearpaw cut, a grizzly thrust, a prowl in the dark - and the starless cut.", '熊') },
  },
  // AKAITO - A gentle, tired boy tied by a red thread to the shade who loved him first, whose hand now reaches out of his sleeve for anyone who hurts him.
  akaito: {
    name: 'Akaito', series: 'Hex Fallout', tagline: 'A gentle, tired boy tied by a red thread to the shade who loved him first, whose hand now reaches out of his sleeve for anyone who hurts him.',
    color: '#d4c0ed', height: 1.78,
    moves: ['Thread Draw', 'Severed Knot', 'Whispered Vow', 'Fated Knot'],
    shortMoves: ['THREAD DRAW', 'SEVERED KNOT', 'WHISPERED VOW', 'FATED KNOT'],
    awakening: 'TILL DEATH',
    // (The fighter quality round, fix-polish: his cape hangs from his right shoulder on chains of its own and swings.)
    cape: { cone: 18, hang: .75, droop: 45, stiffness: 18, thigh: 0 },
    model: F + 'akaito-tr1.glb', extraModels: [],
    portrait: F + 'akaito-portrait.png',
    spirit: F + 'akaito-bride2.glb', // (4 November 2026, akaito: her second build, hooded and veiled, drawn in light)
    names: {
      'Return Cut': 'Rewound Cut',
    },
    shop: { 'fighter-akaito': shopItem('Akaito', "Hex Fallout's betrothed: a draw cut on a red thread, a severed knot, a whispered vow - and the fated knot she has never let him untie.", '誓') },
  },
  // TEMPO - A street kid with absurd legs and a good heart, carrying a calamity inside him, whose punches land a beat late and twice as hard.
  tempo: {
    name: 'Tempo', series: 'Hex Fallout', tagline: 'A street kid with absurd legs and a good heart, carrying a calamity inside him, whose punches land a beat late and twice as hard.',
    color: '#ee4967', height: 1.76,
    moves: ['Street Jab', 'Double Tap', 'Pulse Shot', 'Perfect Timing'],
    shortMoves: ['STREET JAB', 'DOUBLE TAP', 'PULSE SHOT', 'PERFECT TIMING'],
    awakening: 'IN THE ZONE',
    model: F + 'tempo-tr1.glb', extraModels: [],
    portrait: F + 'tempo-portrait.png',
    names: {
      'Elbow Drop': 'Crown Elbow',
    },
    shop: { 'fighter-tempo': shopItem('Tempo', "Hex Fallout's street kid: a street jab, a double tap, a pulse shot - and perfect timing.", '拍') },
  },
  // SASHIGANE - A tired, exact man in a good coat, who inspects the ruins for a living, finds the weak point of anything he measures, and means to retire somewhere warm.
  sashigane: {
    name: 'Sashigane', series: 'Hex Fallout', tagline: 'A tired, exact man in a good coat, who inspects the ruins for a living, finds the weak point of anything he measures, and means to retire somewhere warm.',
    color: '#78c6b0', height: 1.84,
    moves: ['Measured Cut', 'Stress Test', 'Condemned', 'Final Inspection'],
    shortMoves: ['MEASURED CUT', 'STRESS TEST', 'CONDEMNED', 'FINAL INSPECTION'],
    awakening: 'ZERO TOLERANCE',
    coat: { thigh: .12, shin: .11 }, model: F + 'sashigane-tr1.glb', extraModels: [],
    portrait: F + 'sashigane-portrait.png',
    names: {},
    shop: { 'fighter-sashigane': shopItem('Sashigane', "Hex Fallout's inspector: a measured cut, the stress test, a building condemned - and the final inspection.", '矩') },
  },
  // CHOHAN - A lean hunter with not a trace of magic in him, who hunts hex-users for money, loses the money on dice, and has never once lost a fight.
  chohan: {
    name: 'Chohan', series: 'Hex Fallout', tagline: 'A lean hunter with not a trace of magic in him, who hunts hex-users for money, loses the money on dice, and has never once lost a fight.',
    color: '#9aa7a2', height: 1.88,
    moves: ['Fork Cut', 'Double Down', 'Sleight of Hand', 'The House Wins'],
    shortMoves: ['FORK CUT', 'DOUBLE DOWN', 'SLEIGHT', 'HOUSE WINS'],
    awakening: 'ALL IN',
    model: F + 'chohan-tr1.glb', extraModels: [],
    portrait: F + 'chohan-portrait.png',
    names: {},
    shop: { 'fighter-chohan': shopItem('Chohan', "Hex Fallout's gambler: a fork cut, a double down, a sleight of hand - and the house always wins.", '博') },
  },
  // YODAKA - The fire-watchman of the endless dusk, an eagle-owl of a swordsman with a voice like a temple drum, who keeps his lamp burning for everyone behind him.
  yodaka: {
    name: 'Yodaka', series: 'Black Snow', tagline: 'The fire-watchman of the endless dusk, an eagle-owl of a swordsman with a voice like a temple drum, who keeps his lamp burning for everyone behind him.',
    color: '#f36c27', height: 1.8,
    moves: ["Owl's Swoop", 'Bonfire Rise', 'Flaring Wings', 'Nighthawk Star'],
    shortMoves: ["OWL'S SWOOP", 'BONFIRE RISE', 'FLARING WINGS', 'NIGHTHAWK STAR'],
    awakening: 'BURNING STAR',
    coat: { thigh: .12, shin: .11 }, model: F + 'yodaka-tr1.glb', extraModels: [F + 'yodaka-tr1-area1.glb'], // remake-areas: his Fire Owl cast (src/originals/areaCasts.ts)
    portrait: F + 'yodaka-portrait.png',
    names: {},
    shop: { 'fighter-yodaka': shopItem('Yodaka', "Black Snow's fire-watchman: an owl's swoop, a bonfire rise, wings that flare - and the Nighthawk Star.", '番') },
  },
  // KINU - KoKo's daughter, a street fighter of the Gilded Ruin who broke out of her chains and unravels into green thread to stitch her enemies shut.
  kinu: {
    name: 'Kinu', series: 'Gilded Ruin', tagline: "KoKo's daughter, a street fighter of the Gilded Ruin who broke out of her chains and unravels into green thread to stitch her enemies shut.",
    color: '#6cca84', height: 1.74,
    moves: ['Silk Knuckle', 'Reeling Hook', 'UNSPOOL Barrage', 'Broken Shackles'],
    shortMoves: ['SILK KNUCKLE', 'REELING HOOK', 'UNSPOOL', 'BROKEN SHACKLES'],
    awakening: 'CUT LOOSE',
    model: F + 'kinu-tr1.glb', extraModels: [],
    portrait: F + 'kinu-portrait.png',
    companion: { model: F + 'kinu-puppet1.glb' },
    names: {
      'Stone Breaker': 'Shackle Breaker',
    },
    shop: { 'fighter-kinu': shopItem('Kinu', "KoKo's daughter, out of her chains: a silk knuckle, a reeling hook, the UNSPOOL Barrage - and Broken Shackles, swung on their threads.", '縫') },
  },
  // GOSU - The kindest delinquent in the Gilded Ruin, whose spirit mends anything broken with seams of gold, and who will break you first if you laugh at his jacket.
  gosu: {
    name: 'Gosu', series: 'Gilded Ruin', tagline: 'The kindest delinquent in the Gilded Ruin, whose spirit mends anything broken with seams of gold, and who will break you first if you laugh at his jacket.',
    color: '#3d6ee0', height: 1.85,
    moves: ['Porcelain Jab', 'Gold Seam Hammer', 'GILT Barrage', 'Gilded Scars'],
    shortMoves: ['PORCELAIN JAB', 'GOLD SEAM HAMMER', 'GILT', 'GILDED SCARS'],
    awakening: 'MENDED IN GOLD',
    model: F + 'gosu-tr1.glb', extraModels: [],
    portrait: F + 'gosu-portrait.png',
    companion: { model: F + 'gosu-mender1.glb' },
    names: {},
    shop: { 'fighter-gosu': shopItem('Gosu', 'The kindest delinquent in the Gilded Ruin: a porcelain jab, a gold-seam hammer, the GILT Barrage - and Gilded Scars, broken and mended in gold.', '繕') },
  },
};

export const R6B_WAITING: Partial<Record<FighterId, OriginalFighter>> = {
};

export const R6B_VOICES_PENDING: FighterId[] = [];

export const R6B_ART: FighterId[] = ['bellows', 'akayuri', 'svanhild', 'full-beam', 'hagure', 'rotfalke', 'tancho', 'hikui', 'aquilo', 'kuzu', 'bonsho', 'gosu', 'shibuichi', 'cardo', 'pyroclast', 'shanxiao', 'ampere', 'highsun', 'lanthorn', 'kinu', 'ovid', 'mizuhiki', 'yodaka', 'murex', 'torsion', 'bruin', 'akaito', 'tempo', 'sashigane', 'chohan'];
export const R6B_HOLD = (Object.keys(SHOP_R6B) as FighterId[]).filter(id => !R6B_ART.includes(id));
