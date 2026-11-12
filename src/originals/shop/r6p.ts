import type { FighterId } from '../../game/types';
import type { OriginalFighter } from '../roster';

const F = '/assets/fighters/';
/** A shop item renamed, with the kanji the shop sets behind it (catalog.ts `glyph`): the original's motif. */
const shopItem = (name: string, blurb: string, glyph: string) => ({ name, blurb, glyph }) as { name: string; blurb: string };

export const SHOP_R6P: Partial<Record<FighterId, OriginalFighter>> = {
  // SHAKUGO 灼獒 (Shakugo's slot, round 6's concept b; writer C):
  // Warden of the Tribunal.
  shakugo: {
    name: 'Shakugo', series: 'Dust Sea', tagline: 'The harshest of the Tribunal\'s three Wardens: a man of molten rock with a hound at each fist, who has never let a single outlaw cross the next dune alive.',
    homeArt: true,
    color: '#f34c2b', height: 2.3,
    moves: ['Slag Knuckle', 'Fissure Blast', 'Sentence: Molten Fang', 'Final Sentence: Brimstone Rain'],
    shortMoves: ['SLAG KNUCKLE', 'FISSURE BLAST', 'MOLTEN FANG', 'BRIMSTONE RAIN'],
    awakening: 'NO QUARTER',
    model: F + 'shakugo-tr1.glb', extraModels: [],
    portrait: F + 'shakugo-portrait.png',
    names: {},
    shop: { 'fighter-shakugo': shopItem('Shakugo', 'The harshest of the Tribunal\'s Wardens: a slag knuckle, a fissure blast, a molten fang - and the Final Sentence, brimstone raining from the sky.', '刑') },
  },
  // TOKAN 凍鷴 (tokan's slot, round 6's concept e; writer C):
  // Warden of Frost.
  tokan: {
    name: 'Tokan', series: 'Dust Sea', tagline: 'The Tribunal\'s laziest Warden: a frost-heron of a man who would rather sleep through the war, until something makes him freeze the whole sea solid.',
    homeArt: true,
    color: '#83c7e7', height: 2.05,
    moves: ['Frostbite Cut', 'Sleet Heel', 'Frostplume Flight', 'Winter Sleep'],
    shortMoves: ['FROSTBITE CUT', 'SLEET HEEL', 'FROSTPLUME', 'WINTER SLEEP'],
    awakening: 'DEAD OF WINTER',
    model: F + 'tokan-tr1.glb', extraModels: [],
    portrait: F + 'tokan-portrait.png',
    names: {},
    shop: { 'fighter-tokan': shopItem('Tokan', 'The Tribunal\'s laziest Warden: a frostbite cut, a heel of sleet, a heron of frost - and the Winter Sleep, when everything stops till spring.', '霜') },
  },
  // SENKO 閃猴 (senko's slot, round 6's concept e; writer C):
  // Warden of Glare.
  senko: {
    name: 'Senko', series: 'Dust Sea', tagline: 'The Tribunal\'s Warden of Glare: a lanky, drawling old monkey of light who kicks faster than you can blink and never seems to be trying.',
    homeArt: true,
    color: '#f9c238', height: 2.08,
    moves: ['Glimmer Kick', 'Searchlight Heel', 'Fingertip Glare', 'Troop of a Hundred Lights'],
    shortMoves: ['GLIMMER KICK', 'SEARCHLIGHT', 'FINGERTIP GLARE', 'HUNDRED LIGHTS'],
    awakening: 'BLINDING NOON',
    model: F + 'senko-tr1.glb', extraModels: [],
    portrait: F + 'senko-portrait.png',
    names: {
      'Glare Heel Drop': 'Glare Rook\'s Heel',
    },
    shop: { 'fighter-senko': shopItem('Senko', 'The Tribunal\'s Warden of Glare: a glimmering kick, a searchlight heel, a beam from one lazy finger - and a troop of a hundred shrieking lights.', '輝') },
  },
  // BASILISSA バシリッサ (basilissa's slot, round 6's concept a; writer C):
  // the Rose Queen of the Wrecks, on foot.
  'basilissa': {
    name: 'Basilissa', series: 'Dust Sea', tagline: 'The stone-rose queen of the Dust Sea\'s wreck-gardens, who has never once looked up at anyone, and turns every man who stares too long into a rose of stone.',
    homeArt: true,
    color: '#e95e9b', height: 2.3,
    moves: ['Thorn Kiss', 'Rosestone Heel', 'Sandrose Volley', 'The Stone Garden'],
    shortMoves: ['THORN KISS', 'ROSESTONE HEEL', 'SANDROSE VOLLEY', 'STONE GARDEN'],
    awakening: 'STONE CROWN',
    // QA round (fix-cloth, 3 November 2026): her floor-length cape and the hair under it hang from her shoulders on chains of
    // their own (scripts/originals/shop/cape_chains_r6.py), not welded to her hips: no leg capsules (they were dropped while
    // she sat with it pooled on the floor, where a floor push fanned it into slats; she now stands, and the cape hangs free).
    cape: { thigh: 0, droop: 40 },
    model: F + 'basilissa-tr1.glb', extraModels: [],
    portrait: F + 'basilissa-portrait.png',
    names: {
      'Crown Heel Drop': 'Crown Rook\'s Heel', 'Petal Air Kick': 'Petal Kick Loose',
    },
    shop: { 'fighter-basilissa': shopItem('Basilissa', 'The stone-rose queen of the Dust Sea\'s wrecks: a thorned kiss, a heel that turns flesh to stone, a volley of desert roses - and the Stone Garden, where her admirers pose forever.', '薔') },
  },
  // BARROW バロウ (barrow's slot, round 6's concept b; writer C):
  // the Wrecker.
  barrow: {
    name: 'Barrow', series: 'Dust Sea', tagline: 'The wrecker of the Dust Sea, who hangs a lantern of black glass on the dunes to lure the sand-fleets in, eats everything they carried, and means to swallow the whole Dust Sea next.',
    homeArt: true,
    color: '#8a53b9', height: 2.3,
    moves: ['Tar Jab', 'Wreck Quake', 'Tar Pit', 'Jettison: Full Hold'],
    shortMoves: ['TAR JAB', 'WRECK QUAKE', 'TAR PIT', 'JETTISON'],
    awakening: 'GORGED',
    model: F + 'barrow-tr1.glb', extraModels: [],
    portrait: F + 'barrow-portrait.png',
    names: {},
    shop: { 'fighter-barrow': shopItem('Barrow', 'The wrecker of the Dust Sea: a jab of tar, a quake shaken out of the wrecks, a tar pit that swallows the floor - and Jettison, every wreck he ever ate, coughed back up at you.', '泥'),
      'outfit-barrow-classic': null },
  },
  // STRAPPADO ストラッパード (strappado's slot, round 6's concept b; writer C):
  // the Ringmaster.
  strappado: {
    name: 'Strappado', series: 'Dust Sea', tagline: 'The ringmaster of the Dust Sea\'s last oasis city, who smiles down from the royal box while everyone below dances on his strings.',
    homeArt: true,
    color: '#e969a0', height: 2.25,
    moves: ['String Lash', 'Tightrope Kick', 'Searing Cord', 'Curtain Call: The Final Bow'],
    shortMoves: ['STRING LASH', 'TIGHTROPE', 'SEARING CORD', 'CURTAIN CALL'],
    awakening: 'SHOWSTOPPER',
    model: F + 'strappado-tr1.glb', extraModels: [],
    portrait: F + 'strappado-portrait.png',
    names: {},
    shop: { 'fighter-strappado': shopItem('Strappado', 'The ringmaster of the Dust Sea\'s last oasis city: a lash of string, a kick from the tightrope, a cord that burns - and the Curtain Call, where every puppet takes its final bow.', '幕') },
  },
  // ADAD アダド (adad's slot, round 6's concept b; writer C):
  // the Glass God.
  adad: {
    name: 'Adad', series: 'Dust Sea', tagline: 'The self-made god of the Dust Sea, who was struck by lightning on the dunes, got up, and crowned himself with the glass it left in the sand.',
    homeArt: true,
    color: '#70d9ff', height: 2.58,
    moves: ['Glasstip Jab', 'Lightning Rod', 'Glass Spire', 'Firmament Fall'],
    shortMoves: ['GLASSTIP JAB', 'LIGHTNING ROD', 'GLASS SPIRE', 'FIRMAMENT FALL'],
    awakening: 'STORM THRONE',
    model: F + 'adad-tr1.glb', extraModels: [],
    portrait: F + 'adad-portrait.png',
    names: {
      'Glass Backcut': 'Glass Reverse Quill',
    },
    shop: { 'fighter-adad': shopItem('Adad', 'The self-made god of the Dust Sea: a glass-tipped staff, a swing of the lightning rod, a spire of lightning-fused sand - and the Firmament Fall, the whole storm brought down at once.', '閃') },
  },
  // AQRAB アクラブ (aqrab's slot, round 6's concept b; writer C):
  // the Drought Baron.
  aqrab: {
    name: 'Aqrab', series: 'Dust Sea', tagline: 'The Drought Baron of the Dust Sea: the hero a thirsty city cheered, right up until it noticed the sand rising through its floors.',
    homeArt: true,
    color: '#c99b55', height: 2.2,
    moves: ['Pincer Slash', 'Stinger Line', 'Thirst Storm', 'Bone Dry'],
    shortMoves: ['PINCER SLASH', 'STINGER LINE', 'THIRST STORM', 'BONE DRY'],
    awakening: 'DRY SEASON',
    model: F + 'aqrab-tr1.glb', extraModels: [],
    portrait: F + 'aqrab-portrait.png',
    names: {},
    shop: { 'fighter-aqrab': shopItem('Aqrab', 'The Drought Baron of the Dust Sea: a gold pincer\'s slash, a line of sand stingers, a storm that drinks you dry - and Bone Dry, which leaves nothing else.', '蠍') },
  },
  // OYASHIO 親潮 (oyashio's slot, round 6's concept g; writer C):
  // the Helmsman of the Fish-Folk.
  oyashio: {
    name: 'Oyashio', series: 'Dust Sea', tagline: 'The helmsman of the Dust Sea\'s fish-folk: a whale shark of a man who swims the dunes like open water and has never once gone back on his word.',
    homeArt: true,
    color: '#42c4df', height: 2.2,
    moves: ['Tide Palm', 'Breakwater Fist', 'Brine Shot', 'Grand Gyre'],
    shortMoves: ['TIDE PALM', 'BREAKWATER FIST', 'BRINE SHOT', 'GRAND GYRE'],
    awakening: 'DEEP CURRENT',
    // The fighter quality round (fix-d1): his coat's skirt on chains (coat_chains.py 'oyashio'), kept out of his legs as Haldor's.
    coat: { thigh: .28, shin: .24, cone: 18 }, model: F + 'oyashio-tr1.glb', extraModels: [F + 'oyashio-tr1-area1.glb'], // remake-areas: his Riptide Overthrow cast (src/originals/areaCasts.ts)
    portrait: F + 'oyashio-portrait.png',
    names: {},
    shop: { 'fighter-oyashio': shopItem('Oyashio', 'The helmsman of the Dust Sea\'s fish-folk: a palm like the tide, a fist like a sea wall, a shot of brine - and the Grand Gyre, the whole sea spun round you.', '潮') },
  },
  // STRIX ストリクス (strix's slot, round 6's concept a; writer C):
  // the Night-Count.
  strix: {
    name: 'Strix', series: 'Dust Sea', tagline: 'The Night-Count of the Dust Sea: the finest blade on the dried ocean, who sails out alone in a black skiff looking for one opponent worth keeping vigil over.',
    homeArt: true,
    color: '#7eae77', height: 1.98,
    moves: ['Vigil Cut', 'Wingbreak Cleave', 'Vigil: Long Farewell', 'Last Vigil'],
    shortMoves: ['VIGIL CUT', 'WINGBREAK', 'LONG FAREWELL', 'LAST VIGIL'],
    awakening: 'UNBLINKING',
    model: F + 'strix-tr1.glb', extraModels: [],
    portrait: F + 'strix-portrait.png',
    names: {
      'I Won’t Hold Back': 'Last Vigil', 'Rising Wing': 'Updraft', 'Vigil Backcut': 'Vigil Reverse Quill',
    },
    shop: { 'fighter-strix': shopItem('Strix', 'The Night-Count of the Dust Sea: a cut from the Vigil, a wing-guard cleave, a farewell that crosses the whole sea - and the Last Vigil, kept over you.', '梟') },
  },
  // SORAYOMI 空読み (sorayomi's slot, round 6's concept d; writer C):
  // the Storm Navigator.
  sorayomi: {
    name: 'Sorayomi', series: 'Dust Sea', tagline: 'The storm navigator of the Dust Sea, who reads every cloud over the dunes, calls lightning down on cue, and charges for both.',
    homeArt: true,
    color: '#f5a94b', height: 1.7,
    moves: ['Vane Thrust', 'Windcup Crash', 'Gust Spinner', 'Storm Warning'],
    shortMoves: ['VANE THRUST', 'WINDCUP CRASH', 'GUST SPINNER', 'STORM WARNING'],
    awakening: 'EYE OF THE STORM',
    model: F + 'sorayomi-tr1.glb', extraModels: [],
    portrait: F + 'sorayomi-portrait.png',
    names: {
      'Vane Backcut': 'Vane Reverse Quill',
    },
    shop: { 'fighter-sorayomi': shopItem('Sorayomi', 'The storm navigator of the Dust Sea: a weathervane jab, a crash of wind cups, a spinning gust - and the Storm Warning, the forecast that comes true on you.', '嵐') },
  },
  // PSYCHE プシュケ (psyche's slot, round 6's concept d; writer C):
  // the Ruin-Reader.
  'psyche': {
    name: 'Psyche', series: 'Dust Sea', tagline: 'The ruin-reader of the Dust Sea, who blooms hands like moths from any stone and reads the history the dried ocean buried.',
    homeArt: true,
    color: '#d58db8', height: 1.88,
    moves: ['Moth Palm', 'Clasping Wings', 'Ruin Palm', 'Silk Cocoon'],
    shortMoves: ['MOTH PALM', 'CLASPING WINGS', 'RUIN PALM', 'SILK COCOON'],
    awakening: 'VIOLET SWARM',
    model: F + 'psyche-tr1.glb', extraModels: [F + 'psyche-tr1-area1.glb'], // remake-areas: her Field of Hands cast (src/originals/areaCasts.ts)
    // Her moth wings on chains of their own (scripts/originals/shop/cape_chains_r6.py `psyche`, fix-polish2): floor-length,
    // so no leg capsules.
    cape: { cone: 18, hang: .75, droop: 45, stiffness: 18, thigh: 0 },
    portrait: F + 'psyche-portrait.png',
    names: {},
    shop: { 'fighter-psyche': shopItem('Psyche', 'The ruin-reader of the Dust Sea: a moth-light palm, clasping wings, a hand that rises from the ruins - and the Silk Cocoon, where her reading ends.', '蛾') },
  },
  // AMAGOI 雨乞い (amagoi's slot, round 6's concept g; writer C):
  // the God of the Ash Rain.
  amagoi: {
    name: 'Amagoi', series: 'Ashwood', tagline: 'The god of the ash rain, who stands over Ashwood\'s drowned neighbour and lets the sky weep on whoever he chooses.',
    homeArt: true,
    color: '#ab8fd4', height: 1.82,
    moves: ['Rainrod Thrust', 'Cloudburst', 'Calling Water', 'Ash Moon'],
    shortMoves: ['RAINROD', 'CLOUDBURST', 'CALLING WATER', 'ASH MOON'],
    awakening: 'IRON HALO',
    model: F + 'amagoi-tr1.glb', extraModels: [],
    portrait: F + 'amagoi-portrait.png',
    names: {},
    shop: { 'fighter-amagoi': shopItem('Amagoi', 'The god of the ash rain: a thrust of iron rods, a cloudburst that throws you away, water that calls you back - and the Ash Moon, rising.', '雨') },
  },
  // MIKAGE ミカゲ (mikage's slot, round 6's concept c; writer C):
  // the Rooftop Cat.
  mikage: {
    name: 'Mikage', series: 'Cinder Requiem', tagline: 'The cat burglar of the Cinder Requiem\'s rooftops: a princess of an old house who ran off to steal back what the dead city buried, and is still too quick for anyone to catch.',
    homeArt: true,
    color: '#a663ee', height: 1.72,
    moves: ['Velvet Palm', 'Pounce Heel', 'Static Claw', 'Storm Pounce'],
    shortMoves: ['VELVET PALM', 'POUNCE HEEL', 'STATIC CLAW', 'STORM POUNCE'],
    awakening: 'HACKLES UP',
    model: F + 'mikage-tr1.glb', extraModels: [F + 'mikage-tr1-area1.glb'], // remake-areas: her Catwalk cast (src/originals/areaCasts.ts)
    portrait: F + 'mikage-portrait.png',
    names: {},
    shop: { 'fighter-mikage': shopItem('Mikage', 'The cat burglar of the Cinder Requiem\'s rooftops: a velvet palm, a pouncing heel, a claw of static - and her Storm Pounce, saved for you.', '猫') },
  },
  // SHIDARE シダレ (shidare's slot, round 6's concept d; writer C):
  // Head of the Oldest House.
  shidare: {
    name: 'Shidare', series: 'Cinder Requiem', tagline: 'The head of the Cinder Requiem\'s oldest house, who unravels his sword into a drift of steel petals and has never once had to raise his voice.',
    homeArt: true,
    color: '#ef95c3', height: 1.8,
    moves: ['Steel Petal Cut', 'Pruning Cut', 'Unravel', 'Last Petal'],
    shortMoves: ['STEEL PETAL', 'PRUNING CUT', 'UNRAVEL', 'LAST PETAL'],
    awakening: 'FULL BLOOM',
    model: F + 'shidare-tr1.glb', extraModels: [],
    portrait: F + 'shidare-portrait.png',
    names: {},
    shop: { 'fighter-shidare': shopItem('Shidare', 'The head of the Cinder Requiem\'s oldest house: a cut of steel petals, a gardener\'s pruning stroke, a blade that unravels into a drift - and the Last Petal, all of it gathered into one.', '綻') },
  },
  // IRBIS イルビス (irbis's slot, round 6's concept d; writer C):
  // the White Beast-King.
  irbis: {
    name: 'Irbis', series: 'Cinder Requiem', tagline: 'The white beast-king of the Cinder Requiem\'s outer dark, one of the conductor\'s Ashen Ten, who calls himself king of everything that hasn\'t beaten him yet.',
    homeArt: true,
    color: '#49c9e9', height: 1.86,
    moves: ['Claw Cross', 'Mauling Rake', 'Crown Blast', 'Avalanche Talons'],
    shortMoves: ['CLAW CROSS', 'MAULING RAKE', 'CROWN BLAST', 'AVALANCHE'],
    awakening: 'BARED FANGS',
    model: F + 'irbis-tr1.glb', extraModels: [],
    formModel: F + 'irbis-form-tr1.glb',
    portrait: F + 'irbis-portrait.png',
    names: {},
    shop: { 'fighter-irbis': shopItem('Irbis', 'The white beast-king of the Cinder Requiem\'s outer dark: a cross of claws, a mauling rake, a blast fit for a crown - and the Avalanche Talons, the whole mountain brought down on you.', '牙') },
  },
  // SHIJIMA シジマ (shijima's slot, round 6's concept d; writer C):
  // the Chorister.
  shijima: {
    name: 'Shijima', series: 'Cinder Requiem', tagline: 'The youngest chorister of the Cinder Requiem, adopted into its oldest house, who sings the dead city\'s snow down onto anything that will not stay buried.',
    homeArt: true,
    color: '#b9e6f5', height: 1.52,
    moves: ['Frostnote Cut', 'Snow Halo', 'Hoarfrost', 'Last Carol: Stillness'],
    shortMoves: ['FROSTNOTE CUT', 'SNOW HALO', 'HOARFROST', 'STILLNESS'],
    awakening: 'WHITE SILENCE',
    model: F + 'shijima-tr1.glb', extraModels: [F + 'shijima-tr1-area1.glb'], // remake-areas: her Blue Pyre cast, both bodies (src/originals/areaCasts.ts)
    formModel: F + 'shijima-form-tr1.glb', formExtraModels: [F + 'shijima-form-tr1-area1.glb'],
    portrait: F + 'shijima-portrait.png',
    names: {},
    shop: { 'fighter-shijima': shopItem('Shijima', 'The youngest chorister of the Cinder Requiem: a frost-note cut, the Snow Halo, a wave of Hoarfrost - and the Last Carol, after which nothing moves.', '寂') },
  },
  // ONIGAWARA オニガワラ (onigawara's slot, round 6's concept b; writer C):
  // the Boar of the Outskirts.
  onigawara: {
    name: 'Onigawara', series: 'Cinder Requiem', tagline: 'The boar of the Cinder Requiem\'s lawless outskirts, a grinning brute who cut his way into the choir\'s ranks and has been looking for a fight that lasts long enough ever since.',
    homeArt: true,
    color: '#e7b439', height: 2.28,
    moves: ['Headlong Cleave', 'Tusk Sweep', 'Stampede', 'Earthsplitter'],
    shortMoves: ['HEADLONG CLEAVE', 'TUSK SWEEP', 'STAMPEDE', 'EARTHSPLITTER'],
    awakening: 'UNMUZZLED',
    model: F + 'onigawara-tr1.glb', extraModels: [],
    formModel: F + 'onigawara-form-tr1.glb',
    portrait: F + 'onigawara-portrait.png',
    names: {},
    shop: { 'fighter-onigawara': shopItem('Onigawara', 'The boar of the Cinder Requiem\'s outskirts: a headlong cleave, a tusk sweep, a stampede through everything - and the Earthsplitter, every ounce of him in one swing.', '猪') },
  },
  // UME ウメ (ume's slot, round 6's concept c; writer C):
  // the Ash Medic.
  ume: {
    name: 'Ume', series: 'Ashwood', tagline: 'Ashwood\'s field medic, who closes wounds with one hand and caves the ground in with the other, and will never again be the one left behind.',
    homeArt: true,
    color: '#f397c3', height: 1.65,
    moves: ['Budburst Straight', 'Magnolia Heel', 'Bloom Barrage', 'Magnolia Meteor'],
    shortMoves: ['BUDBURST', 'MAGNOLIA HEEL', 'BLOOM BARRAGE', 'MAGNOLIA METEOR'],
    awakening: 'IRON BLOSSOM',
    model: F + 'ume-tr1.glb', extraModels: [],
    formModel: F + 'ume-form-tr1.glb',
    portrait: F + 'ume-portrait.png',
    names: {},
    shop: { 'fighter-ume': shopItem('Ume', 'Ashwood\'s field medic: a straight that bursts like a bud, a magnolia heel that splits the ground, a barrage in full flower - and the Magnolia Meteor, everything she\'s got from straight above.', '拳') },
  },
  // KUSUSHI 医 (kusushi's slot, round 6's concept f; writer C):
  // the Yokozuna.
  kusushi: {
    name: 'Kusushi', series: 'Ashwood', tagline: 'The yokozuna of Ashwood and its finest healer, who wears the sacred rope, bets on everything, and loses nearly all of it, except the fights.',
    homeArt: true,
    color: '#63cda0', height: 1.7,
    moves: ['Wrapped Fist', 'Shiko Stomp', 'Ring-Out Palm', 'Bet the Purse'],
    shortMoves: ['WRAPPED FIST', 'SHIKO STOMP', 'RING-OUT PALM', 'BET THE PURSE'],
    awakening: 'YOKOZUNA',
    // (The fighter quality round, fix-d2: her coat's skirt on chains, capsules the size of her trousers, Nigo's slim recipe.)
    coat: { thigh: .12, shin: .11 }, model: F + 'kusushi-tr1.glb', extraModels: [],
    formModel: F + 'kusushi-form-tr1.glb',
    portrait: F + 'kusushi-portrait.png',
    names: {
      'Crushing Heel': 'Stomping Heel',
    },
    shop: { 'fighter-kusushi': shopItem('Kusushi', 'The yokozuna of Ashwood: a rope-wrapped fist, the champion\'s stomp, a palm that throws you out of the ring - and Bet the Purse, everything on one bout.', '賽') },
  },
  // HAKUSHI 白獅 (hakushi's slot, round 6's concept f; writer C):
  // the White Lion.
  hakushi: {
    name: 'Hakushi', series: 'Ashwood', tagline: 'The white lion of Ashwood: a wandering hermit, dancer and scribbler who throws his pupils off cliffs because he believes they\'ll climb back up.',
    homeArt: true,
    color: '#ba4538', height: 1.91,
    moves: ['Flourish Palm', 'Lion\'s Pearl', 'Lion\'s Breath', 'Lion Dance: Over the Cliff'],
    shortMoves: ['FLOURISH PALM', 'LION\'S PEARL', 'LION\'S BREATH', 'OVER THE CLIFF'],
    awakening: 'THE OLD LION',
    model: F + 'hakushi-tr1.glb', extraModels: [],
    formModel: F + 'hakushi-form-tr1.glb',
    portrait: F + 'hakushi-portrait.png',
    names: {},
    shop: { 'fighter-hakushi': shopItem('Hakushi', 'The white lion of Ashwood: a dancer\'s flourish, the lion\'s burning pearl, a breath of cinders - and Over the Cliff, the lesson he gives the pupils he loves.', '獅') },
  },
  minase: {
    name: 'Minase', series: 'Ashwood', tagline: 'The relay courier of Ashwood, who carries word through the ash storms and is already there a moment after he is called.',
    homeArt: true,
    color: '#ffcf50', height: 1.82,
    moves: ['Relay Knife', 'Gale Palm', 'Relay Leap', 'Fifty-Three Stations'],
    shortMoves: ['RELAY KNIFE', 'GALE PALM', 'RELAY LEAP', '53 STATIONS'],
    awakening: 'FULL STRIDE',
    model: F + 'minase-tr1.glb', extraModels: [],
    formModel: F + 'minase-form-tr1.glb',
    formStance: true,
    coat: { thigh: .14, shin: .12 },
    portrait: F + 'minase-portrait.png',
    names: {
      'Rising Gale': 'Rising Swallow',
    },
    shop: { 'fighter-minase': shopItem('Minase', 'The relay courier of Ashwood: a relay knife, a palm of gale, a leap to wherever the knife lands - and the Fifty-Three Stations, run in one breath.', '駅') },
  },
  // MADAKE 真竹 (madake's slot, round 6's concept e; writer C):
  // the green brawler of the Ash.
  'madake': {
    name: 'Madake', series: 'Ashwood', tagline: 'Ashwood\'s bare-handed bamboo: a teacher who trains till his arms steam, grows back from every beating, and has never once turned a challenge down.',
    homeArt: true,
    color: '#c33e37', height: 1.82,
    moves: ['Bamboo Straight', 'Bamboo Gale Kick', 'Summer Wolf', 'Midwinter Bamboo'],
    shortMoves: ['BAMBOO STRAIGHT', 'BAMBOO GALE', 'SUMMER WOLF', 'MIDWINTER BAMBOO'],
    awakening: 'EVERGREEN',
    model: F + 'madake-tr1.glb', extraModels: [F + 'madake-tr1-area1.glb'],
    // (The fighter quality round, fix-d2: EVERGREEN, a body of its own; its tattered skirt on chains, Nigo's slim recipe.)
    // (remake-areas, 6 November: `*-area1.glb` hold his Autumn Stag cast, both bodies: src/originals/areaCasts.ts.)
    formModel: F + 'madake-form-tr1.glb', formExtraModels: [F + 'madake-form-tr1-area1.glb'], coat: { thigh: .12, shin: .11 },
    portrait: F + 'madake-portrait.png',
    names: {},
    shop: { 'fighter-madake': shopItem('Madake', 'Ashwood\'s bamboo brawler: a bamboo-straight fist, a bamboo gale kick, a summer wolf of air - and the Midwinter Bamboo, springing back out of the snow.', '竹') },
  },
  // HINOMOTO 火の元 (hinomoto's slot, round 6's concept ?; writer C):
  // the Oldest Fire.
  hinomoto: {
    name: 'Hinomoto', series: 'Cinder Requiem', tagline: 'The oldest fire in the Cinder Requiem: an ancient general in black lacquer who walked out of the pyre that burned the city, and has commanded its ash ever since.',
    homeArt: true,
    color: '#f18a40', height: 1.68,
    moves: ['Ember Stroke', 'Pyre Cleave', 'Furnace Wave', 'Funeral Pyre'],
    shortMoves: ['EMBER STROKE', 'PYRE CLEAVE', 'FURNACE WAVE', 'FUNERAL PYRE'],
    awakening: 'THE OLD FIRE',
    model: F + 'hinomoto-tr1.glb', extraModels: [],
    portrait: F + 'hinomoto-portrait.png',
    names: {
      'Old Fire': 'Furnace Wave',
    },
    shop: { 'fighter-hinomoto': shopItem('Hinomoto', 'The oldest fire in the Cinder Requiem: an ember stroke, a cleave onto the pyre, a furnace thrown open - and the Funeral Pyre, raised round you.', '熾') },
  },
};

export const R6P_DRAWN: FighterId[] = ['shakugo', 'adad', 'shijima', 'ume', 'irbis', 'barrow', 'mikage', 'basilissa', 'onigawara', 'shidare', 'aqrab', 'strix', 'strappado', 'tokan', 'oyashio', 'hakushi', 'senko', 'madake', 'minase', 'sorayomi', 'psyche', 'amagoi', 'kusushi', 'hinomoto'];
export const R6P_HOLD: FighterId[] = (Object.keys(SHOP_R6P) as FighterId[]).filter(id => !R6P_DRAWN.includes(id));

export const R6P_WAITING: Partial<Record<FighterId, OriginalFighter>> = {
};
