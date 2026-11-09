import type { FighterId } from '../../game/types';
import type { OriginalFighter } from '../roster';

const F = '/assets/fighters/';
/** A shop item renamed, with the kanji the shop sets behind it (catalog.ts `glyph`): the original's motif. */
const shopItem = (name: string, blurb: string, glyph: string) => ({ name, blurb, glyph }) as { name: string; blurb: string };

export const SHOP_PX: Partial<Record<FighterId, OriginalFighter>> = {
  hisame: {
    name: 'Hisame', series: 'Crimson Ledger', tagline: "The Frostmarch's youngest general - perfect manners, a sabre in her right hand and winter in her left.",
    homeArt: true,
    color: '#75f0ec', height: 1.7,
    moves: ['Rime Thrust', 'Black Ice', 'Glacier Javelin', 'WHITEOUT: Glass Coffin'],
    shortMoves: ['RIME THRUST', 'BLACK ICE', 'GLACIER JAVELIN', 'GLASS COFFIN'],
    awakening: 'POLAR NIGHT',
    coat: { thigh: .11, shin: .1 }, model: F + 'hisame-px1.glb', rushModel: F + 'hisame-pxrush1.glb', extraModels: [],
    portrait: F + 'hisame-px-portrait.png',
    names: {},
    shop: { 'fighter-hisame': shopItem('Hisame', "The Frostmarch's youngest general: a sabre that never hurries, ice that does - and the Glass Coffin, winter closed round you.", '霜') },
  },
  suzuran: {
    name: 'Suzuran', series: 'Hidden Ash', tagline: 'Keeper of the Still Bell - she apologises before every bout, then strikes once, softly, and you ring.',
    homeArt: true,
    color: '#dca4f4', height: 1.6,
    moves: ['Chime Strike', 'Shumoku', 'Kyoumei-Ha', 'Great Bell: Last Toll'],
    shortMoves: ['CHIME STRIKE', 'SHUMOKU', 'KYOUMEI-HA', 'LAST TOLL'],
    awakening: 'YOIN',
    model: F + 'suzuran-px1.glb', rushModel: F + 'suzuran-pxrush1.glb', extraModels: [F + 'suzuran-px1-area1.glb'], // remake-areas: her Bell Garden cast (src/originals/areaCasts.ts)
    portrait: F + 'suzuran-px-portrait.png',
    names: {},
    shop: { 'fighter-suzuran': shopItem('Suzuran', 'Keeper of the Still Bell: one soft strike in the right place, and you ring - right up to the Last Toll.', '鈴') },
  },
  unari: {
    name: 'Unari', series: 'Salvage Wilds', tagline: 'The slyest kite-fighter on the rooftops - he takes every bet, and he has never once lost his line.',
    homeArt: true,
    color: '#c2409a', height: 1.9,
    moves: ['Fine Line', 'Snag', 'Paper Cut', "AYATORI: Cat's Cradle"],
    shortMoves: ['FINE LINE', 'SNAG', 'PAPER CUT', "CAT'S CRADLE"],
    awakening: 'OPEN SEASON',
    model: F + 'unari-px1.glb', rushModel: F + 'unari-pxrush1.glb', extraModels: [],
    portrait: F + 'unari-px-portrait.png',
    names: {},
    shop: { 'fighter-unari': shopItem('Unari', "Paper Sky's slyest kite-fighter: a fine line, a snag, a paper cut - and he has never once lost his line.", '凧') },
  },
  buna: {
    name: 'Buna', series: 'Dust Sea', tagline: 'Warden of the Old Growth - slow to speak, slower to anger, and when she falls on you, the whole forest falls with her.',
    homeArt: true,
    color: '#2a9486', height: 2,
    moves: ['Swathe', 'Deadfall', 'Heartshake', 'TIMBER: The Forest Falls'],
    shortMoves: ['SWATHE', 'DEADFALL', 'HEARTSHAKE', 'TIMBER'],
    awakening: 'YUKIOKOSHI',
    model: F + 'buna-px1.glb', rushModel: F + 'buna-pxrush1.glb', extraModels: [],
    portrait: F + 'buna-px-portrait.png',
    names: {},
    shop: { 'fighter-buna': shopItem('Buna', 'Warden of the Old Growth: an iron club, ice and thunder - and when she falls on you, the whole forest falls with her.', '樹') },
  },
  tsubute: {
    name: 'Tsubute', series: 'Dust Sea', tagline: 'The best throwing arm on the Stone Ford - and whoever gets past the stones meets the maul that set them.',
    homeArt: true,
    color: '#8f9a35', height: 1.8,
    moves: ['Skimmer', 'Ballast', 'Far Bank', 'INJI: Both Banks'],
    shortMoves: ['SKIMMER', 'BALLAST', 'FAR BANK', 'BOTH BANKS'],
    awakening: 'MIZUKAGAMI',
    model: F + 'tsubute-px1.glb', rushModel: F + 'tsubute-pxrush1.glb', extraModels: [],
    portrait: F + 'tsubute-px-portrait.png',
    names: {},
    shop: { 'fighter-tsubute': shopItem('Tsubute', 'The best throwing arm on the Stone Ford: a skimmer, a stone with ballast in it - and the maul that set them.', '礫') },
  },
  'shakudo': {
    name: 'Shakudo', series: 'Slag Hill', tagline: "Slag Hill's youngest smith: an iron arm, a short fuse, and a grin that gets wider the worse it goes.",
    homeArt: true,
    color: '#b8433a', height: 1.65,
    moves: ['Rivet', 'Hot Edge', 'Bedrock Pike', 'TANREN: White Heat'],
    shortMoves: ['RIVET', 'HOT EDGE', 'BEDROCK PIKE', 'WHITE HEAT'],
    awakening: 'KUROGANE',
    model: F + 'shakudo-px1.glb', rushModel: F + 'shakudo-pxrush1.glb', extraModels: [],
    portrait: F + 'shakudo-px-portrait.png',
    names: {
      'Stone Breaker': 'Spall',
    },
    shop: { 'fighter-shakudo': shopItem('Shakudo', "Slag Hill's youngest smith: an iron arm, a hot edge off it - and White Heat, the forge's whole fire in one blow.", '銅') },
  },
  wataame: {
    name: 'Wataame', series: 'Lantern Ward', tagline: 'A lazy, bored swordsman with a wooden sword - he only works odd jobs when the rent is due, and he is always late.',
    homeArt: true,
    color: '#93bfe5', height: 1.82,
    moves: ['Yawn', 'Snooze Button', 'Sugar Rush', 'SHIMEKIRI: Past Due'],
    shortMoves: ['YAWN', 'SNOOZE BUTTON', 'SUGAR RUSH', 'PAST DUE'],
    awakening: 'MEZAMASHI',
    model: F + 'wataame-tr1.glb', extraModels: [F + 'wataame-tr1-area1.glb'], // remake-areas: his Lie In cast (src/originals/areaCasts.ts)
    portrait: F + 'wataame-portrait.png',
    names: {},
    shop: { 'fighter-wataame': shopItem('Wataame', 'A lazy swordsman with a wooden sword: a yawn, a snooze button - and Past Due, when the rent finally catches up with you.', '綿') },
  },
  hawser: {
    name: 'Hawser', series: 'Ropewalk', tagline: 'The Ropewalk\'s angriest boy, who wants to see what is at the far end of every line, and who, when he can\'t break the rope, becomes a giant of bark and steam.',
    homeArt: true,
    color: '#45896e', height: 1.7,
    moves: ['Fray', 'Squib', 'Snap Line', 'Slipped Moorings'],
    shortMoves: ['FRAY', 'SQUIB', 'SNAP LINE', 'SLIPPED MOORINGS'],
    awakening: 'YUGE',
    // The fighter quality round (3 November 2026): his jacket's hem rides chains of its own (coat_chains.py `hawser-px`).
    coat: { thigh: .12, shin: .11 }, model: F + 'hawser-px-tr1.glb', extraModels: [],
    formModel: F + 'hawser-px-giant-tr1.glb',
    formShortMoves: ['TRUNK FIST', 'ROOT UPPERCUT', 'BURL FIST', 'TIMBERFALL'], // the giant's cards (its moves' names, short)
    portrait: F + 'hawser-px-portrait.png',
    names: {
      'Fuse Lance': 'Squib',
    },
    shop: { 'fighter-hawser': shopItem('Hawser', 'The Ropewalk\'s angriest boy: a fraying cut, a squib, a snap line - and, when the rope won\'t break, YUGE, the giant of bark and steam.', '綱') },
  },
  'rakucho': {
    name: 'Rakucho', series: 'Quiet Hunger', tagline: 'A gentle bookworm turned half-monster in a city where the hungry hide among the fed: white-haired now, with four crimson bookmark-ribbons that eat.',
    homeArt: true,
    color: '#bc2456', height: 1.7,
    moves: ['Torn Page', 'Ribbon Lash', 'Four Bookmarks', 'Last Chapter'],
    shortMoves: ['TORN PAGE', 'RIBBON LASH', 'FOUR BOOKMARKS', 'LAST CHAPTER'],
    awakening: 'STARVING',
    model: F + 'rakucho-px-tr1.glb', extraModels: [],
    formModel: F + 'rakucho-px-awakened-tr1.glb',
    portrait: F + 'rakucho-px-portrait.png',
    names: {},
    shop: { 'fighter-rakucho': shopItem('Rakucho', 'Quiet Hunger\'s missing pages: a torn page, a ribbon lash, four bookmarks - and the last chapter.', '頁') },
  },
  kubiwa: {
    name: 'Kubiwa', series: 'Scrap Pact', tagline: 'The smiling conductor of Scrap Pact, who keeps the city\'s strays on short leads and plays every one of them like an instrument.',
    homeArt: true,
    color: '#c26745', height: 1.7,
    moves: ['Baton Flick', 'Crescendo', 'Cue', 'Final Bar'],
    shortMoves: ['BATON', 'CRESCENDO', 'CUE', 'FINAL BAR'],
    awakening: 'CONDUCTOR',
    cape: { hang: 0, cone: 18, droop: 45, stiffness: 16, thigh: .01, shin: .01 },
    coat: { thigh: .12, shin: .11 }, model: F + 'kubiwa-px-tr1.glb', extraModels: [],
    portrait: F + 'kubiwa-px-portrait.png',
    names: {},
    shop: { 'fighter-kubiwa': shopItem('Kubiwa', 'Scrap Pact\'s conductor: a flick of the baton, a crescendo that crushes, a cue - and the final bar everyone plays.', '輪') },
  },
};

export const PX_WAITING: Partial<Record<FighterId, OriginalFighter>> = {
};
