import { RARITY, type Rarity } from './rarity';
import { UNLOCKS } from './unlocks';
import type { FighterId } from '../types';

/** What an item is, which is also the slot it is worn in. */
export const KINDS = {
  fighter: { name: 'Fighters', one: 'Fighter', blurb: 'Fighters of your own, to play in every mode. Any of them can be tried first in the Training Ground.' },
  outfit: { name: 'Outfits', one: 'Outfit', blurb: 'Another look for one fighter - a form or a costume of theirs - every move the same.' },
  skin: { name: 'Page skins', one: 'Page skin', blurb: 'How your fighter is drawn. Every skin fits every fighter.' },
  form: { name: 'Forms', one: 'Form', blurb: 'The look of an awakening: your fighter redrawn, and what burns round them, while they are awakened.' },
  aura: { name: 'Auras', one: 'Aura', blurb: 'What burns round your fighter all match.' },
  trail: { name: 'Afterimages', one: 'Afterimage', blurb: 'What a dash leaves behind.' },
  kill: { name: 'Kill effects', one: 'Kill effect', blurb: 'What the horde does as you cut it down. Your whole party sees it.' },
  banner: { name: 'Streak banners', one: 'Streak banner', blurb: 'What crosses the screen as your KO chain climbs: at 50, 100, 500 and 1,000.' },
  emote: { name: 'Emotes', one: 'Emote', blurb: 'Manga stickers and lettering over your fighter. Four on the wheel: keys 1-4 or the D-pad in a fight.' },
  entrance: { name: 'Entrance pages', one: 'Entrance page', blurb: 'Your own splash page as a match begins.' },
  stamp: { name: 'Finisher stamps', one: 'Finisher stamp', blurb: 'What a finisher is stamped with.' },
  ko: { name: 'Knockout effects', one: 'Knockout effect', blurb: 'What the fallen do.' },
  title: { name: 'Titles', one: 'Title', blurb: 'The line under your name.' },
  addon: { name: 'Add-ons', one: 'Add-on', blurb: 'Worn: a mask, horns, a familiar that follows.' },
  quip: { name: 'Quips', one: 'Quip pack', blurb: 'Lines lettered in a speech bubble.' },
  announcer: { name: 'Announcers', one: 'Announcer', blurb: 'A different voice calling the fight.' },
  music: { name: 'Music', one: 'Album', blurb: "The game's own score." },
  place: { name: 'Places', one: 'Place', blurb: 'Stages and variants to start a run in.' },
  // The ball modes' own: Goal Rush and Sky Spike only (game/ball/look.ts reads them).
  ball: { name: 'Ball skins', one: 'Ball skin', blurb: 'How the ball looks to you in Goal Rush and Sky Spike: the ink football and the woven ball both.' },
  balltrail: { name: 'Ball trails', one: 'Ball trail', blurb: 'What the ball leaves behind while it is yours. Everyone in the match sees it.' },
  goalburst: { name: 'Goal bursts', one: 'Goal burst', blurb: 'What bursts from the net when you score, or from the court when you put a point away. Everyone sees it.' },
  celebration: { name: 'Celebrations', one: 'Celebration', blurb: 'How you celebrate a goal or a point in the ball modes, before your victory pose.' },
} as const;
export type ItemKind = keyof typeof KINDS;
/** The wheel: how many emotes are worn at once. Every other kind is worn one at a time. */
export const EMOTE_SLOTS = 4;

export interface Item {
  id: string;
  name: string;
  kind: ItemKind;
  rarity: Rarity;
  blurb: string;
  stage: 'live' | 'road' | 'retired' | 'next' | 'ask';
  /** The feat it asks for besides its price and level (feats.ts). Legendary and Mythic each name one. */
  feat?: string;
  /** A glyph the shop shows for it where it has no picture: a kanji, a mark. */
  glyph?: string;
  /** An outfit's fighter: the one fighter it is worn by. A fighter's (kind `fighter`): the fighter it unlocks. */
  fighter?: FighterId;
  /** Its price in the shop (unlocks.ts), where it is sold. */
  price?: number;
  /** The account level the road gives it at (unlocks.ts), where it is the road's. */
  level?: number;
}

const item = (kind: ItemKind, id: string, name: string, rarity: Rarity, blurb: string, extra: Partial<Item> = {}): Item => ({ id: `${kind}-${id}`, name, kind, rarity, blurb, stage: 'live', ...extra });
const next = { stage: 'next' } as const, ask = { stage: 'ask' } as const;

/** Every item as it was made, in the order a party is told them in (see `lookOf`): nothing here may move. */
const CATALOGUE: readonly Item[] = [
  // ---- Page skins: how a fighter is drawn (one shader: every skin fits every fighter) --------
  item('skin', 'newsprint', 'Newsprint', 'common', 'Grey halftone dots, as a weekly prints it.', { glyph: '網' }),
  item('skin', 'blueline', 'Blueline', 'common', 'A pencil sketch in non-photo blue.', { glyph: '下' }),
  item('skin', 'sumi-e', 'Sumi-e', 'rare', 'Black ink and bare paper: your fighter joins the page.', { glyph: '墨' }),
  item('skin', 'sepia', 'Sepia Volume', 'rare', 'An old collected edition, browned.', { glyph: '古' }),
  item('skin', 'negative', 'Negative', 'epic', 'White ink on black, as a rank-S page.', { glyph: '反' }),
  item('skin', 'blood-moon', 'Blood Moon', 'epic', 'Black and one red.', { glyph: '月' }),
  item('skin', 'gold-leaf', 'Gold Leaf', 'legendary', 'Black lacquer and gold leaf, the gold alive in the light.', { glyph: '金', feat: 'seal' }),
  item('skin', 'spectral', 'Spectral', 'legendary', 'A spirit: pale blue, its edges burning off.', { glyph: '霊', feat: 'rank-a' }),
  item('skin', 'authors-hand', "The Author's Hand", 'mythic', 'An unfinished drawing: construction lines that redraw as it moves.', { glyph: '筆', feat: 'author' }),
  // ---- Auras ------------------------------------------------------------------------------
  item('aura', 'embers', 'Ember Motes', 'common', 'Sparks rising off the shoulders.', { glyph: '火' }),
  item('aura', 'static', 'Static', 'common', 'Small arcs snapping round the body.', { glyph: '電' }),
  item('aura', 'ume', 'Ume Drift', 'rare', 'Petals falling round your fighter.', { glyph: '桜' }),
  item('aura', 'ink-wisps', 'Ink Wisps', 'rare', 'Threads of ink curling up.', { glyph: '煙' }),
  item('aura', 'azure-flame', 'Azure Flame', 'epic', 'A cold blue fire from the feet up.', { glyph: '蒼' }),
  item('aura', 'thunder-coil', 'Thunder Coil', 'epic', 'A coil of lightning turning round the body.', { glyph: '雷' }),
  item('aura', 'black-sun', 'Black Sun', 'legendary', "An eclipse's corona behind the head.", { glyph: '蝕', feat: 's-rank' }),
  item('aura', 'ink-dragon', 'Ink Dragon', 'legendary', 'A dragon of brush strokes winding round your fighter.', { glyph: '龍', ...next }),
  item('aura', 'hundred-seals', 'Hundred Seals', 'mythic', 'A ring of red seals turning slowly, each a kanji.', { glyph: '印', feat: 'bosses-100' }),
  // ---- Afterimages and trails ----------------------------------------------------------------
  item('trail', 'chalk', 'Chalk', 'common', 'A white smear behind a dash.', { glyph: '白' }),
  item('trail', 'afterimage', 'Afterimage', 'rare', 'Faded copies of your fighter left behind.', { glyph: '残' }),
  item('trail', 'crimson-edge', 'Crimson Edge', 'epic', 'Blows leave a red line in the air.', { glyph: '紅', ...next }),
  item('trail', 'ink-brush', 'Ink Brush', 'legendary', 'Every blow a wide black stroke.', { glyph: '刷', ...next }),
  item('trail', 'rift-tear', 'Rift Tear', 'mythic', 'Blows tear the page: a black crack with red at its edge.', { glyph: '裂', ...next }),
  // ---- Emotes ---------------------------------------------------------------------------------
  item('emote', 'interrobang', '!?', 'common', 'The mark, popped over the head.', { glyph: '!?' }),
  item('emote', 'dots', '...', 'common', 'Three dots and a silence.', { glyph: '…' }),
  item('emote', 'sweat', 'Sweat Drop', 'common', 'One large drop.', { glyph: '汗' }),
  item('emote', 'anger', 'Anger Vein', 'rare', 'The vein, drawn in ink.', { glyph: '怒' }),
  item('emote', 'sparkle', 'Sparkle', 'rare', 'キラッ and four stars.', { glyph: 'キラ' }),
  item('emote', 'menacing', 'Menacing', 'epic', 'ゴゴゴゴ rising round your fighter.', { glyph: 'ゴゴ' }),
  item('emote', 'don', 'DON!!', 'epic', 'ドン!! slammed on in brush.', { glyph: 'ドン' }),
  item('emote', 'speed-lines', 'Speed Lines', 'legendary', "The screen's edge goes to focus lines round your fighter.", { glyph: '集', feat: 'style-sss' }),
  item('emote', 'cover-page', 'Cover Page', 'mythic', 'The moment is framed as a magazine cover, with a masthead.', { glyph: '表', feat: 'seal-3' }),
  // ---- Entrance pages ---------------------------------------------------------------------------
  item('entrance', 'paper', 'Riot Palm', 'common', 'Your own splash page on plain paper.', { glyph: '紙' }),
  item('entrance', 'newsprint', 'Newsprint', 'rare', 'Coarse dots and a grey page.', { glyph: '網' }),
  item('entrance', 'night', 'Night Edition', 'epic', 'Black paper, white ink.', { glyph: '夜' }),
  item('entrance', 'gold-foil', 'Gold Foil', 'legendary', 'A foil stamp and a gilt edge.', { glyph: '箔', feat: 'finishers-25' }),
  item('entrance', 'double-spread', 'Double Spread', 'mythic', 'The page opens across the whole screen, your name in the gutter.', { glyph: '見', feat: 'level-40' }),
  // ---- Finisher stamps and knockout effects -------------------------------------------------------
  item('stamp', 'the-end', '完 The End', 'rare', 'A finisher is stamped 完.', { glyph: '完' }),
  item('stamp', 'heavens-judgment', "天誅 Heaven's Judgment", 'epic', 'Stamped 天誅, in gold.', { glyph: '天誅' }),
  item('stamp', 'one-blow', '一撃必殺 One Blow', 'legendary', 'Stamped down the whole page.', { glyph: '必殺', feat: 'finishers-25' }),
  item('ko', 'petals', 'Petal Burst', 'rare', 'The bosses you fell go in petals.', { glyph: '散' }),
  item('ko', 'paper-shred', 'Paper Shred', 'epic', 'The fallen tear into strips of paper.', { glyph: '破', ...next }),
  item('ko', 'thunder', 'Thunder Judgment', 'legendary', 'A bolt takes each boss that falls.', { glyph: '雷', feat: 's-rank' }),
  item('ko', 'panel-break', 'Panel Break', 'mythic', "The panel's border breaks with the last blow.", { glyph: '砕', ...next }),
  // ---- Titles -------------------------------------------------------------------------------------
  ...(([['rookie', 'Rookie', 'common'], ['rift-tourist', 'Rift Tourist', 'common'], ['button-masher', 'Button Masher', 'common'], ['weekly-reader', 'Weekly Reader', 'common'],
    ['horde-breaker', 'Horde Breaker', 'rare'], ['page-turner', 'Page Turner', 'rare'], ['glass-cannon', 'Glass Cannon', 'rare'], ['second-wind', 'Second Wind', 'rare'],
    ['dark-choir', 'Hand of Heaven', 'epic'], ['the-unfallen', 'The Unfallen', 'epic'], ['ink-drinker', 'Ink Drinker', 'epic'],
    ['seal-keeper', 'Seal Keeper', 'legendary', 'seal'], ['one-page-wonder', 'One-Page Wonder', 'legendary', 'fast-boss'], ['the-last-panel', 'The Last Panel', 'legendary', 'finishers-25'],
    ['author', 'Author', 'mythic', 'author'], ['editor-in-chief', 'Editor in Chief', 'mythic', 'level-40']] as const)
    .map(([id, name, rarity, feat]) => item('title', id, name, rarity, 'Worn under your name.', feat ? { feat } : {}))),
  item('addon', 'oni-mask', 'Oni Mask', 'rare', 'A mask on the brow.', { glyph: '鬼', ...next }),
  item('addon', 'kitsune-mask', 'Kitsune Mask', 'rare', 'A fox mask on the brow.', { glyph: '狐', ...next }),
  item('addon', 'horns', 'Horns', 'epic', 'A pair, swept back.', { glyph: '角', ...next }),
  item('addon', 'halo', 'Halo', 'epic', 'A broken ring of light.', { glyph: '輪', ...next }),
  item('addon', 'paper-crane', 'Paper Crane', 'epic', 'A familiar of folded paper that follows.', { glyph: '鶴', ...next }),
  item('addon', 'ink-koi', 'Ink Koi', 'legendary', 'A carp of ink swimming round the shoulders.', { glyph: '鯉', ...next }),
  item('form', 'oni', 'Oni Form', 'legendary', 'Awakened, your fighter is drawn in red lacquer and black, and a fire stands up round them.', { glyph: '鬼', feat: 's-rank' }),
  item('form', 'celestial', 'Celestial Form', 'legendary', 'Awakened, your fighter turns to white porcelain veined with gold, under a ring of light.', { glyph: '天', feat: 'seal' }),
  item('quip', 'stoic', 'Quips: Stoic', 'rare', 'Ten lettered lines for knockouts and finishers.', { glyph: '静', ...next }),
  item('quip', 'loud', 'Quips: Loud', 'rare', 'Ten lettered lines, all capitals.', { glyph: '叫', ...next }),
  item('quip', 'villain', 'Quips: Villain', 'rare', 'Ten lettered lines, none of them kind.', { glyph: '悪', ...next }),
  item('announcer', 'villain', 'The Villain', 'epic', "A designed voice, not anyone's.", { glyph: '声', ...ask }),
  item('announcer', 'deadpan', 'The Deadpan', 'epic', 'A designed voice, unimpressed.', { glyph: '声', ...ask }),
  item('music', 'rift-volume-1', 'The Rift, Volume I', 'epic', "The game's own score for the eight places.", { glyph: '音', ...ask }),
  item('music', 'victory-themes', 'Victory Themes', 'rare', 'A short theme of your own on the results.', { glyph: '勝', ...next }),
  item('place', 'harbor-night', 'Harbour at Night', 'epic', 'The Drowned Harbour under a moon, its light sweeping.', { glyph: '港', ...next }),
  item('place', 'eclipse-ascendant', 'The Offering Ascendant', 'epic', 'The Offering at its height.', { glyph: '蝕', ...next }),
  item('kill', 'soak', 'Soak', 'rare', 'Everything you cut down bursts into black ink that soaks into the page.', { glyph: '滲' }),
  item('kill', 'screentone', 'Screentone', 'epic', 'The fallen come apart as a printed page does: in dots, off register.', { glyph: '網' }),
  item('kill', 'cranes', 'Thousand Cranes', 'epic', 'The fallen fold into paper cranes and fly.', { glyph: '鶴' }),
  item('kill', 'kintsugi', 'Kintsugi', 'legendary', 'The ground breaks where they fall, and the cracks run with gold. A bell for the big ones.', { glyph: '金', feat: 'rank-a' }),
  item('kill', 'seal', 'Vermilion Seal', 'legendary', 'Every kill stamped with a red seal where it fell; an elite, with a great one, and a thud you feel.', { glyph: '印', feat: 'finishers-25' }),
  item('banner', 'brush', 'Brushstroke', 'epic', 'One stroke of a wide brush across the screen, and the count in white inside it.', { glyph: '筆' }),
  item('banner', 'taiko', 'Taiko', 'legendary', 'A war drum struck, its crest turning, the count in gold on red. Louder at every mark.', { glyph: '太鼓', feat: 'style-sss' }),
  item('skin', 'living-ink', 'Living Ink', 'legendary', 'Drawn as the run goes: a blue pencil sketch, inked at 100 kills, printed at 500, gilded at 2,000.', { glyph: '生', feat: 'rank-b' }),
  item('aura', 'rising', 'Rising Spirit', 'legendary', 'It rises with your style: a thread of ink at D, a black fire at A, a pillar of red and gold at SSS.', { glyph: '昇', feat: 'style-sss' }),
  item('form', 'negative', 'Negative Form', 'epic', 'Awakened, your fighter is printed in reverse: white ink on black, and the black runs off them.', { glyph: '反' }),
  item('outfit', 'taisei-golden-sage', 'Taisei · Golden Sage', 'rare', 'The mane burning gold from the first bell to the last: the Great Sage, awake all match.', { glyph: '超', fighter: 'taisei' }),
  item('outfit', 'taisei-ember-mane', 'Taisei · Ember Mane', 'rare', 'A crown of hair burnt red and a red aura for the awakening: the monkey king at his hottest.', { glyph: '神', fighter: 'taisei' }),
  item('outfit', 'taisei-azure-sage', 'Taisei · Azure Sage', 'epic', 'The golden mane gone sky blue, under an aura that crackles like a downed power line.', { glyph: '蒼', fighter: 'taisei' }),
  item('outfit', 'taisei-silver-mane', 'Taisei · Silver Mane', 'epic', 'A silver crown of hair and a silver-blue aura: the body moving before the thought.', { glyph: '極', fighter: 'taisei' }),
  item('outfit', 'ouga-golden-pride', 'Ouga · Golden Pride', 'rare', 'His crest burning gold from the first bell to the last: the prince\'s pride, awake all match.', { glyph: '超', fighter: 'ouga' }),
  item('outfit', 'ouga-crimson-crown', 'Ouga · Crimson Crown', 'rare', 'A crest burnt red and a red aura for the awakening: a prince at his hottest.', { glyph: '神', fighter: 'ouga' }),
  item('outfit', 'ouga-azure-pride', 'Ouga · Azure Pride', 'epic', 'A sky-blue crest under an aura that crackles like a storm front.', { glyph: '蒼', fighter: 'ouga' }),
  item('outfit', 'ouga-violet-wrath', 'Ouga · Violet Wrath', 'epic', 'Crest and aura in deep violet: a prince who grows stronger with every blow he takes.', { glyph: '我', fighter: 'ouga' }),
  item('outfit', 'gummy-daybreak', 'Gummy · Daybreak', 'legendary', 'Jacket and trousers bleached white by the sun over the Dust Sea, the sash lit gold like the first light, the headband still red.', { glyph: '暁', fighter: 'gummy', feat: 's-rank' }),
  item('outfit', 'gummy-black-flag', 'Gummy · Black Flag', 'epic', 'The jacket dyed black and the sash the red of the flag\'s skull: what he wears to take a fortress by night.', { glyph: '旗', fighter: 'gummy' }),
  // The rest of the Dust Sea costumes: each its own body with the fight set it came with.
  item('outfit', 'gummy-mirage', 'Gummy · Mirage', 'legendary', 'Turquoise as the water every sailor on the Dust Sea swears they saw, over sand-pale trousers and a coral sash.', { glyph: '蜃', fighter: 'gummy', feat: 'rank-a' }),
  item('outfit', 'gummy-deckhand', 'Gummy · Deckhand', 'epic', 'The faded denim and work trousers he scrubbed decks in before he had a ship of his own, and the red sash he never took off.', { glyph: '甲', fighter: 'gummy' }),
  item('outfit', 'kenzo-night-raider', 'Kenzo · Night Raider', 'epic', 'His vest dyed midnight indigo for a raid by moonlight. He still found the wrong gate first.', { glyph: '夜', fighter: 'kenzo' }),
  item('outfit', 'kenzo-oasis-dandy', 'Kenzo · Oasis Dandy', 'epic', 'A vest of ivory silk, bought at the first oasis he wandered into by mistake. He insists it was on purpose.', { glyph: '泉', fighter: 'kenzo' }),
  item('outfit', 'kosho-sommelier', 'Kosho · Sommelier', 'epic', 'A claret shirt and a gold neckerchief for the captain\'s table: he pairs every kick with something red.', { glyph: '葡', fighter: 'kosho' }),
  item('outfit', 'kagari-dune-walker', 'Kagari · Dune Walker', 'epic', 'Cloth dyed the red of the dunes at dusk, the flames and the sash in gold, for the long walk over the Dust Sea - where he naps in the hottest sun and never notices.', { glyph: '砂', fighter: 'kagari' }),
  item('outfit', 'ward-night-shift', 'Ward · Night Shift', 'epic', 'The coat in scrubs teal for the night rounds, the hazard stripes kept: on his shift, nobody sleeps through the operation.', { glyph: '宿', fighter: 'ward' }),
  item('outfit', 'ward-house-call', 'Ward · House Call', 'epic', 'A doctor\'s white coat over navy trousers: he comes to you, and the bill comes later.', { glyph: '往', fighter: 'ward' }),
  // Repaints: the fighter's own body and moves, painted anew.
  item('outfit', 'kenzo-masterless', 'Kenzo · Masterless', 'rare', 'His vest dyed black, the colour of no house at all: two blades, a hundred roads, and nowhere he has to be.', { glyph: '浪', fighter: 'kenzo' }),
  item('outfit', 'oro-ascendant', 'Lord ORO · Ascendant', 'rare', 'Ivory where the black was and every gear of gold lit from within: the lord of the clock tower at his zenith, above the hour itself.', { glyph: '昇', fighter: 'oro' }),
  item('outfit', 'setsu-live-wire', 'Setsu · Live Wire', 'rare', 'The jacket black and every seam carrying violet lightning: an assassin who arrives before the thunder does.', { glyph: '雷', fighter: 'setsu' }),
  item('outfit', 'kagari-blue-ember', 'Kagari · Blue Ember', 'rare', 'His fire burnt to its hottest: blue flames up his shirt and round his sash, and a blue blaze when he wakes.', { glyph: '蒼', fighter: 'kagari' }),
  item('outfit', 'kosho-flambe', 'Kosho · Flambé', 'rare', 'A black shirt for the late service, and from the shoes to the knee his legs burn like a pan set alight.', { glyph: '炎', fighter: 'kosho' }),
  item('fighter', 'gorai', 'Gorai', 'legendary', 'The Thunderhead of the Dust Sea, three metres of him: a ship\'s mast for a club, a cask of storm-grog, lightning on call - and the storm wyrm, scaled and tailed, when he wakes.', { glyph: '雷', fighter: 'gorai', price: 15000, feat: 's-rank' }),
  item('fighter', 'haldor', 'Haldor', 'legendary', 'The Old Quake of the Dust Sea: a crescent glaive taller than a man, and fists that crack the air like glass and tilt the dead seabed under them.', { glyph: '震', fighter: 'haldor', price: 15000, feat: 's-rank' }),
  item('fighter', 'sorrel', 'Sorrel', 'legendary', 'The Crimson Wake: a dark cutlass, a lazy smile, and a will that drops a crowd of raiders to its knees without a blow.', { glyph: '紅', fighter: 'sorrel', price: 12000, feat: 'rank-a' }),
  // The LAST HORIZON is the dearest of them.
  item('fighter', 'dorado', 'Dorado', 'legendary', 'The Horizon King: a gilded cutlass, a brass flintlock, and the one cut that split the clouds the day he reached the edge of the dead sea.', { glyph: '陽', fighter: 'dorado', price: 18000, feat: 's-rank' }),
  item('fighter', 'magatsu', 'Magatsu', 'legendary', 'The Calamity King: invisible slashes from bare hands, a thousand cuts at once - and the Carrion Altar, his sanctum, where everything in reach is carved apart.', { glyph: '禍', fighter: 'magatsu', price: 18000, feat: 's-rank' }),
  item('fighter', 'shiun', 'Shiun', 'legendary', 'The False Saint of the Cinder Requiem: a measured cut, a copy of him that shatters like a mirror, lances of violet stained glass - and the Black Confessional, closing round them.', { glyph: '紫', fighter: 'shiun', price: 16000, feat: 's-rank' }),
  item('fighter', 'vesper', 'Vesper', 'legendary', 'The Uncrowned of the grave roads: a fencer\'s sabre, a dive through them before they see him move - and the Offering, when the sun goes black over them.', { glyph: '鴉', fighter: 'vesper', price: 14000, feat: 's-rank' }),
  item('fighter', 'imago', 'Imago', 'legendary', 'The Swarm King: a claw quicker than the eye, a stinger that whips and storms round him - and the Final Molt, both fists brought down.', { glyph: '蟲', fighter: 'imago', price: 14000, feat: 's-rank' }),
  item('fighter', 'wuming', 'Wuming', 'legendary', 'A fallen god of the Jade Court in the Great Sage\'s own garb, dyed for mourning: a blade of pink light from behind them, the Lightless Cannon - and a scythe that harvests the skyline.', { glyph: '無', fighter: 'wuming', price: 14000, feat: 's-rank' }),
  item('fighter', 'jirenga', 'Jirenga', 'legendary', 'A temple guardian gone to stone: a one-two heavier than it looks, an uppercut that uproots them, the Vermilion Seal - and a punch with a thousand years of stillness behind it.', { glyph: '石', fighter: 'jirenga', price: 14000, feat: 's-rank' }),
  item('fighter', 'jinlin', 'Emperor Jinlin', 'legendary', 'Last Sun: Pearl Needle, Whirlpool Tail, Pearl Rain - and Drowned Sun.', { glyph: '帝', fighter: 'jinlin', price: 14000, feat: 's-rank' }),
  item('fighter', 'gohaku', 'Gohaku', 'legendary', 'Last Sun: Long-Arm Fist, Moon-Plucking Kick, Star-Shifting Beam - and Sun-Seizing Spiral.', { glyph: '獣', fighter: 'gohaku', price: 12000, feat: 'rank-a' }),
  item('fighter', 'ippon', 'Ippon', 'legendary', 'The crater\'s volunteer cleaner: a punch on the clock, a sneeze that clears the street, a double shift of fists - and, for once, a clean slate.', { glyph: '拳', fighter: 'ippon', price: 12000, feat: 'rank-a' }),
  item('fighter', 'sekka', 'Sekka', 'legendary', 'A demon of the black snow who lives to fight: the Hailstone Fist, the Avalanche, the Frost Gale that tears down the street - and the Black Blizzard.', { glyph: '鬼', fighter: 'sekka', price: 12000, feat: 'rank-a' }),
  item('fighter', 'tobari', 'Tobari', 'legendary', 'The Ash Crow of the Hidden Ash: a feather-bladed cut, a murder of crows that comes at them from behind, a black fire that will not go out - and the Red Moon Reverie, a dream he cuts them down in.', { glyph: '鴉', fighter: 'tobari', price: 12000, feat: 'rank-a' }),
  item('fighter', 'akagane', 'Akagane', 'legendary', 'The copper tyrant of the old wars, out of his tomb: an iron war fan, a skybreaker kick, a sea of fire - and Heaven\'s Anvil, a burning star pulled out of the sky onto them.', { glyph: '銅', fighter: 'akagane', price: 18000, feat: 's-rank' }),
  item('fighter', 'asahi', 'Asahi', 'legendary', 'The boy who carries the last ember of the sun: the Ripple Cut, the Comet Throw, the Ashfall Waltz - and First Light, the rite that sets the black sky on fire.', { glyph: '旭', fighter: 'asahi', price: 12000, feat: 'rank-a' }),
  item('fighter', 'levin', 'Levin', 'legendary', 'Ropewalk\'s spotless captain: two short swords, a line reel to cross the room before you blink - and the Clean Sweep, nothing left standing but the dust he missed.', { glyph: '掃', fighter: 'levin', price: 12000, feat: 'rank-a' }),
  item('fighter', 'rook', 'Rook', 'legendary', 'The weakest hunter who died in a gate and came back: two raven talons, the Grave Grip - and the Black Rookery, an army of the dead risen behind him.', { glyph: '墓', fighter: 'rook', price: 12000, feat: 'rank-a' }),
  item('fighter', 'gaku', 'Gaku', 'legendary', 'The feral boy of the drowned isles: a lion\'s fist, a fang of gold, a roar thrown off his palm - and the Landslide, everything he has in one punch.', { glyph: '獅', fighter: 'gaku', price: 12000, feat: 'rank-a' }),
  // Append-only: encoded cosmetic indices already exist in player loadouts. Both Barrow bodies passed scoped gameplay review.
  item('outfit','barrow-classic','Barrow Classic Era','epic','An older coat of Barrow\'s, kept off the shelves.',{glyph:'闇',fighter:'barrow', ...ask}),
  item('fighter', "strix", "Strix", 'epic', 'The Night-Count of the Dust Sea: a cut from the Vigil, a wing-guard cleave, a farewell that crosses the whole sea - and the Last Vigil, kept over you.', { glyph: '梟', fighter: "strix" }),
  item('fighter', "sorayomi", "Sorayomi", 'epic', 'The storm navigator of the Dust Sea: a weathervane jab, a crash of wind cups, a spinning gust - and the Storm Warning, the forecast that comes true on you.', { glyph: '嵐', fighter: "sorayomi" }),
  item('fighter', "basilissa", "Basilissa", 'epic', 'The stone-rose queen of the Dust Sea\'s wrecks: a thorned kiss, a heel that turns flesh to stone, a volley of desert roses - and the Stone Garden, where her admirers pose forever.', { glyph: '薔', fighter: "basilissa" }),
  item('fighter', "kuzu", "Kuzu", 'epic', 'The scrapyard stray of Scrap Pact: a sawtooth swipe, a dovetail cut, a mad dog rush - and the Bonegrinder, all teeth, no brakes.', { glyph: '錆', fighter: "kuzu" }),
  item('fighter', "shakugo", "Shakugo", 'epic', 'The harshest of the Tribunal\'s Wardens: a slag knuckle, a fissure blast, a molten fang - and the Final Sentence, brimstone raining from the sky.', { glyph: '刑', fighter: "shakugo" }),
  item('fighter', "shanxiao", "Shanxiao", 'epic', 'The Last Sun\'s wild giant: a wild hook, a jade hammer, a jade comet - and the Sun Chaser, for whoever he finally catches.', { glyph: '山', fighter: "shanxiao" }),
  item('fighter', "ampere", "Ampere", 'epic', 'The light Beacon Ward was handed on: a live-line jab, a kick off Cape Wrath, a flick from the end of the earth - and his teacher\'s Foghorn Blast, overcharged.', { glyph: '電', fighter: "ampere" }),
  item('fighter', "pyroclast", "Pyroclast", 'epic', 'Beacon Ward\'s walking volcano: a spitfire palm, a lava bomb, a vent shot - and the Supervolcano, the biggest bang in the city.', { glyph: '噴', fighter: "pyroclast" }),
  item('fighter', "full-beam", "Full Beam", 'epic', 'The keeper of the last lighthouse: a jab off Cape Horn, a chop from Land\'s End, a punch that booms like a foghorn - and, when the dark comes in, the Seven Seas Haymaker.', { glyph: '灯', fighter: "full-beam" }),
  item('fighter', "tancho", "Tancho", 'epic', 'The crane of Beacon Ward: a frost-tipped beak, a wing of scarlet fire, a wingspan of ice - and, at last, the Thousand Cranes.', { glyph: '鶴', fighter: "tancho" }),
  item('fighter', "bellows", "Bellows", 'epic', 'The foundry master of Beacon Ward: a jab like a hot ingot, a smelter\'s fist, lances of molten slag - and Meltdown, the hottest thing in the city.', { glyph: '炉', fighter: "bellows" }),
  item('fighter', "akaito", "Akaito", 'epic', 'Hex Fallout\'s betrothed: a draw cut on a red thread, a severed knot, a whispered vow - and the pinky promise she has never let him break.', { glyph: '誓', fighter: "akaito" }),
  item('fighter', "mikage", "Mikage", 'epic', 'The cat burglar of the Cinder Requiem\'s rooftops: a velvet palm, a pouncing heel, a claw of static - and her Ninth Life, spent on you.', { glyph: '猫', fighter: "mikage" }),
  item('fighter', "tempo", "Tempo", 'epic', 'Hex Fallout\'s street kid: a street jab, a double tap, a pulse shot - and perfect timing.', { glyph: '拍', fighter: "tempo" }),
  item('fighter', "shijima", "Shijima", 'epic', 'The youngest chorister of the Cinder Requiem: a frost-note cut, the First Carol\'s halo of snow, the Second\'s wave of hoarfrost - and the Last Carol, after which nothing moves.', { glyph: '寂', fighter: "shijima" }),
  item('fighter', "senko", "Senko", 'epic', 'The Tribunal\'s Warden of Glare: a glimmering kick, a searchlight heel, a beam from one lazy finger - and a troop of a hundred shrieking lights.', { glyph: '輝', fighter: "senko" }),
  item('fighter', "adad", "Adad", 'epic', 'The self-made god of the Dust Sea: a glass-tipped staff, a swing of the lightning rod, a spire of lightning-fused sand - and the Firmament Fall, the whole storm brought down at once.', { glyph: '閃', fighter: "adad" }),
  item('fighter', "buna", "Buna", 'epic', 'Warden of the Old Growth: an iron club, ice and thunder - and when she falls on you, the whole forest falls with her.', { glyph: '樹', fighter: "buna" }),
  item('fighter', "oyashio", "Oyashio", 'epic', 'The helmsman of the Dust Sea\'s fish-folk: a palm like the tide, a fist like a sea wall, a shot of brine - and the Grand Gyre, the whole sea spun round you.', { glyph: '潮', fighter: "oyashio" }),
  item('fighter', "suzuran", "Suzuran", 'epic', 'Keeper of the Still Bell: one soft strike in the right place, and you ring - right up to the Last Toll.', { glyph: '鈴', fighter: "suzuran" }),
  item('fighter', "wataame", "Wataame", 'epic', 'A lazy swordsman with a wooden sword: a yawn, a snooze button - and Past Due, when the rent finally catches up with you.', { glyph: '綿', fighter: "wataame" }),
  item('fighter', "kusushi", "Kusushi", 'epic', 'The grand champion of the Hidden Ash: a rope-wrapped fist, the champion\'s stomp, a palm that throws you out of the ring - and Double or Nothing, everything on one bet.', { glyph: '賽', fighter: "kusushi" }),
  item('fighter', "sashigane", "Sashigane", 'epic', 'Hex Fallout\'s inspector: a measured cut, the golden section, a building condemned - and the final inspection.', { glyph: '矩', fighter: "sashigane" }),
  item('fighter', "gosu", "Gosu", 'epic', 'The kindest delinquent in the Gilded Ruin: a porcelain jab, a gold-seam hammer, the KIN KIN barrage - and Gilded Scars, broken and mended in gold.', { glyph: '繕', fighter: "gosu" }),
  item('fighter', "hakushi", "Hakushi", 'epic', 'The white lion of the Hidden Ash: a dancer\'s flourish, the lion\'s burning pearl, a breath of cinders - and Over the Cliff, the lesson he gives the pupils he loves.', { glyph: '獅', fighter: "hakushi" }),
  item('fighter', "barrow", "Barrow", 'epic', 'The wrecker of the Dust Sea: a jab of tar, a quake he stole off a better man, a sinkhole that swallows the floor - and Jettison, every wreck he ever ate, coughed back up at you.', { glyph: '泥', fighter: "barrow" }),
  item('fighter', "unari", "Unari", 'epic', 'Paper Sky\'s slyest kite-fighter: a fine line, a snag, a paper cut - and he has never once lost his line.', { glyph: '凧', fighter: "unari" }),
  item('fighter', "strappado", "Strappado", 'epic', 'The ringmaster of the Dust Sea\'s last oasis city: a lash of string, a kick from the tightrope, a cord that burns - and the Curtain Call, where every puppet takes its final bow.', { glyph: '幕', fighter: "strappado" }),
  item('fighter', "tokan", "Tokan", 'epic', 'The Tribunal\'s laziest Warden: a frostbite cut, a heel of sleet, a pheasant of frost - and the Winter Sleep, when everything stops till spring.', { glyph: '霜', fighter: "tokan" }),
  item('fighter', "hikui", "Hikui", 'epic', 'The fire-eater of Ghost Wake: a draw quicker than a flicker, a witchfire blade, a cut through the heat haze - and the violet balefire bound in his arm, let loose.', { glyph: '焔', fighter: "hikui" }),
  item('fighter', "ume", "Ume", 'epic', 'The Hidden Ash\'s field medic: a straight that bursts like a bud, a magnolia heel that splits the ground, a barrage in full flower - and the Magnolia Meteor, everything she\'s got from straight above.', { glyph: '拳', fighter: "ume" }),
  item('fighter', "lanthorn", "Lanthorn", 'epic', 'The tavern keeper of Penance Road: a cut that trims the wick, a backdraft that gives you your change, a blade black with lamp soot - and last call.', { glyph: '酒', fighter: "lanthorn" }),
  item('fighter', "highsun", "Highsun", 'epic', 'Penance Road\'s noonday giant: a sunbeam cut, a blow at twelve o\'clock, a pocket sun - and the Sword of the Zenith.', { glyph: '午', fighter: "highsun" }),
  item('fighter', "torsion", "Torsion", 'epic', 'Blast Radius\'s top-ranked cleaner: a snap twist, a wring-out, a volley of rubble - and Full Torque, every street in reach twisted at once.', { glyph: '捻', fighter: "torsion" }),
  item('fighter', "kubiwa", "Kubiwa", 'epic', 'Scrap Pact\'s conductor: a flick of the baton, a crescendo that crushes, a cue - and the final bar everyone plays.', { glyph: '輪', fighter: "kubiwa" }),
  item('fighter', "onigawara", "Onigawara", 'epic', 'The boar of the Cinder Requiem\'s outskirts: a headlong cleave, a tusk sweep, a stampede through everything - and the Earthsplitter, every ounce of him in one swing.', { glyph: '猪', fighter: "onigawara" }),
  item('fighter', "minase", "Minase", 'epic', 'The relay courier of the Hidden Ash: a relay knife, a palm of gale, a leap to wherever the knife lands - and the Fifty-Three Stations, run in one breath.', { glyph: '駅', fighter: "minase" }),
  item('fighter', "shakudo", "Shakudo", 'epic', 'Slag Hill\'s youngest smith: an iron arm, a hot edge off it - and White Heat, the forge\'s whole fire in one blow.', { glyph: '銅', fighter: "shakudo" }),
  item('fighter', "amagoi", "Amagoi", 'epic', 'The god of the ash rain: a thrust of iron rods, a cloudburst that throws you away, water that calls you back - and the Ash Moon, rising.', { glyph: '雨', fighter: "amagoi" }),
  item('fighter', "hinomoto", "Hinomoto", 'epic', 'The oldest fire in the Cinder Requiem: an ember stroke, a cleave onto the pyre, a furnace thrown open - and the Funeral Pyre, raised round you.', { glyph: '熾', fighter: "hinomoto" }),
  item('fighter', "shidare", "Shidare", 'epic', 'The head of the Cinder Requiem\'s oldest house: a cut of steel petals, a gardener\'s pruning stroke, a blade that unravels into a drift - and the Last Petal, all of it gathered into one.', { glyph: '綻', fighter: "shidare" }),
  item('fighter', "irbis", "Irbis", 'epic', 'The white beast-king of the Cinder Requiem\'s outer dark: a cross of claws, a mauling rake, a blast fit for a crown - and the Avalanche Talons, the whole mountain brought down on you.', { glyph: '牙', fighter: "irbis" }),
  item('fighter', "shibuichi", "Shibuichi", 'epic', 'Slag Hill\'s gentle giant: planishing blows, a billet ram, a palm that quenches the ground - and KINTSUGI, the golden seam.', { glyph: '鋳', fighter: "shibuichi" }),
  item('fighter', "rakucho", 'Rakucho', 'epic', "Quiet Hunger: Torn Page, Ribbon Lash, Four Bookmarks - and Last Chapter.", { glyph: "喰", fighter: "rakucho" }),
  item('fighter', "hisame", "Hisame", 'epic', 'The Frostmarch\'s youngest general: a sabre that never hurries, ice that does - and the Glass Coffin, winter closed round you.', { glyph: '霜', fighter: "hisame" }),
  item('fighter', "mizuhiki", "Mizuhiki", 'epic', 'The Ropewalk\'s guardian: a strand cut, a cross splice, a haul in on her own cable - and the bitter end.', { glyph: '縄', fighter: "mizuhiki" }),
  item('fighter', "bonsho", "Bonsho", 'epic', 'The old abbot of the Salvage Wilds\' ruined mountain temple: a palm for the dawn bell, an elbow like the striking log, the first toll - and all hundred and eight.', { glyph: '鐘', fighter: "bonsho" }),
  item('fighter', "akayuri", "Akayuri", 'epic', 'The quiet blade of Crimson Ledger: a lily cut, a farewell turn, a thrust to the far shore - and a field of red lilies where her mark falls.', { glyph: '華', fighter: "akayuri" }),
  item('fighter', "madake", "Madake", 'epic', 'The Hidden Ash\'s green beast: a bamboo-straight fist, a green gale kick, a summer wolf of air - and the Midwinter Bamboo, springing back out of the snow.', { glyph: '竹', fighter: "madake" }),
  item('fighter', "psyche", "Psyche", 'epic', 'The ruin-reader of the Dust Sea: a moth-light palm, clasping wings, a hand that rises from the ruins - and the Silk Cocoon, where her reading ends.', { glyph: '蛾', fighter: "psyche" }),
  item('fighter', "rotfalke", "Rotfalke", 'epic', 'The red falcon of Red Cradle: a feather knife, a raking talon, a dive that breaks any guard - and a countdown nobody survives.', { glyph: '隼', fighter: "rotfalke" }),
  item('fighter', "kinu", "Kinu", 'epic', 'KoKo\'s daughter, out of her chains: a silk knuckle, a reeling hook, the BUCHI BUCHI barrage - and Broken Shackles, swung on their threads.', { glyph: '縫', fighter: "kinu" }),
  item('fighter', "hawser", "Hawser", 'epic', 'The Ropewalk\'s angriest boy: a fraying cut, a squib, a snap line - and, when the rope won\'t break, YUGE, the giant of bark and steam.', { glyph: '綱', fighter: "hawser" }),
  item('fighter', "murex", "Murex", 'epic', 'The violet frame of Red Cradle: a hooked claw, a spine hammer, a flinch that throws you back - and the Spinestorm, when the last strap snaps.', { glyph: '棘', fighter: "murex" }),
  item('fighter', "hagure", "Hagure", 'epic', 'The stray of Blast Radius who hunts the cleaners: a snapping jab, a mauling palm, a howling spin - and Pack of One, a whole pack\'s worth of fists from one wolf.', { glyph: '野', fighter: "hagure" }),
  item('fighter', "ovid", 'Ovid', 'epic', 'Carcass Coast: Cracked Knuckle, Shovel Uppercut, Shatterburst - and Full Demolition.', { glyph: "怪", fighter: "ovid" }),
  item('fighter', "yodaka", "Yodaka", 'epic', 'Black Snow\'s fire-watchman: the First Watch\'s swoop, a bonfire rise, wings that flare - and the Ninth Watch, the Nighthawk Star.', { glyph: '番', fighter: "yodaka" }),
  item('fighter', "tsubute", "Tsubute", 'epic', 'The best throwing arm on the Stone Ford: a skimmer, a stone with ballast in it - and the maul that set them.', { glyph: '礫', fighter: "tsubute" }),
  item('fighter', "aqrab", "Aqrab", 'epic', 'The Drought Baron of the Dust Sea: a gold pincer\'s slash, a line of sand stingers, a storm that drinks you dry - and Bone Dry, which leaves nothing else.', { glyph: '蠍', fighter: "aqrab" }),
  item('fighter', "chohan", "Chohan", 'epic', 'Hex Fallout\'s gambler: a fork cut, a double down, a sleight of hand - and the house always wins.', { glyph: '博', fighter: "chohan" }),
  item('fighter', "cardo", "Cardo", 'epic', 'The thistle of Briar Crown: a weedcutter, a plowshare drop, a slash that undoes spells - and the last weed standing.', { glyph: '薊', fighter: "cardo" }),
  item('fighter', "bruin", "Bruin", 'epic', 'Briar Crown\'s bear from the far islands: a bearpaw cut, a grizzly thrust, a prowl in the dark - and the starless cut.', { glyph: '熊', fighter: "bruin" }),
  item('fighter', "aquilo", "Aquilo", 'epic', 'The north wind of Briar Crown: darts of air that fly like swallows, a forktail gust, a blade that skims the ground - and the Great Migration.', { glyph: '燕', fighter: "aquilo" }),
  item('fighter', "svanhild", "Svanhild", 'epic', 'The swan of Briar Crown\'s silver house: a quill of water, a wing that breaks bones, an orb of lake glass - and her swan song.', { glyph: '鵠', fighter: "svanhild" }),
  // ---- The ball modes' gear: Goal Rush and Sky Spike only, each
  // drawn in code (render/ball/ballCosmetics.ts, game/ball/look.ts). Appended, as everything here is: nothing above moves.
  item('ball', 'vermilion', 'Vermilion Seal', 'rare', 'Red and paper-white panels; the woven ball lacquered red.', { glyph: '朱' }),
  item('ball', 'night-ink', 'Night Ink', 'rare', 'White ink on black: the panels and the weave printed in reverse.', { glyph: '夜' }),
  item('ball', 'indigo', 'Indigo Dye', 'rare', 'Indigo and undyed cotton, as a dyer\'s cloth.', { glyph: '藍' }),
  item('ball', 'jade', 'Jade', 'epic', 'Green stone and white: the panels cut from jade, the weave from its rind.', { glyph: '翠' }),
  item('ball', 'gold-leaf', 'Gold Leaf', 'epic', 'Black lacquer and gold leaf on every panel and strip.', { glyph: '金' }),
  item('balltrail', 'brush', 'Brushstroke', 'rare', 'The ball\'s wake drawn as one wide stroke of black ink, your colour at its heart.', { glyph: '筆' }),
  item('balltrail', 'embers', 'Ember Wake', 'rare', 'Sparks shaken off the ball all along its flight.', { glyph: '火' }),
  item('balltrail', 'petals', 'Petal Wake', 'epic', 'Petals spun off behind it as it flies.', { glyph: '花' }),
  item('balltrail', 'gold-thread', 'Gold Thread', 'epic', 'A ribbon of gold behind the ball, glinting.', { glyph: '糸' }),
  item('goalburst', 'ink-bomb', 'Ink Bomb', 'rare', 'Black ink bursts out of the net and splashes the floor.', { glyph: '墨' }),
  item('goalburst', 'paper-storm', 'Paper Storm', 'rare', 'Torn pages of a weekly blown out in a storm.', { glyph: '紙' }),
  item('goalburst', 'cranes', 'Paper Cranes', 'epic', 'A flock of folded cranes takes off from the net.', { glyph: '鶴' }),
  item('goalburst', 'thunder', 'Thunderclap', 'epic', 'Lightning strikes where the ball went in.', { glyph: '雷' }),
  item('celebration', 'spin', 'Spin', 'rare', 'Two turns on the spot, then your victory pose.', { glyph: '回' }),
  item('celebration', 'stand-tall', 'Stand Tall', 'rare', 'Guard up and unmoved: the wall nobody gets past.', { glyph: '壁' }),
  item('celebration', 'showboat', 'Showboat', 'epic', 'Your own heavy blow at nothing, then your victory pose.', { glyph: '誇' }),
];

/** An item as the shop now has it (unlocks.ts): sold for its price (`live`, and the road's too where it has a
 *  level), the road's alone at its level (`road`), or - released before and in neither - `retired`. What is on offer
 *  asks nothing but its price or its level: no feat, no rarity's level. */
function offer(item: Item): Item {
  const how = UNLOCKS[item.id];
  if (how?.price !== undefined) return { ...item, stage: 'live', price: how.price, level: how.level, feat: undefined };
  if (how?.level !== undefined) return { ...item, stage: 'road', level: how.level, price: undefined, feat: undefined };
  return item.stage === 'live' ? { ...item, stage: 'retired' } : item;
}
export const ITEMS: readonly Item[] = CATALOGUE.map(offer);

export const ITEM = new Map(ITEMS.map(each => [each.id, each] as const));
export const priceOf = (each: Item) => each.price ?? RARITY[each.rarity].price;
/** Whether an item has been released: on sale, on the road, or retired (still owned and worn). Not one waiting. */
export const released = (item: Item | undefined) => !!item && (item.stage === 'live' || item.stage === 'road' || item.stage === 'retired');
/** Whether an item can be got now: in the shop, or on the road. */
export const onOffer = (item: Item | undefined) => !!item && (item.stage === 'live' || item.stage === 'road');
/** What an account wears: one of each kind, up to four emotes on the wheel, and an outfit for each fighter. */
export type Worn = Partial<Record<Exclude<ItemKind, 'emote' | 'outfit' | 'fighter'>, string>> & { emotes?: string[]; outfits?: Partial<Record<FighterId, string>> };
/** What every account starts with, worn: the plain entrance page and a first title (owned without being bought). */
export const STARTERS: readonly string[] = ['entrance-paper', 'title-rookie', 'emote-interrobang'];

/** What the party sees each of them wear - a skin, an aura, an afterimage, a kill effect, a form -
 *  as places in the catalogue (-1: none): how a co-op room tells a party what each of them wears,
 *  in a few bytes a frame. New kinds go on the end (a client that knows fewer reads the first ones). */
const ON_THE_BODY = ['skin', 'aura', 'trail', 'kill', 'form'] as const;
/** ...and, after those, the outfit worn for the fighter being played (`fighter`), if any. */
export const lookOf = (worn: Worn | undefined, fighter?: FighterId): number[] => [...ON_THE_BODY.map(kind => ITEMS.findIndex(each => each.id === worn?.[kind])),
  ...(fighter ? [ITEMS.findIndex(each => each.id === worn?.outfits?.[fighter])] : [])];
export function wornOf(look: readonly number[] | undefined): Worn {
  const worn: Worn = {};
  ON_THE_BODY.forEach((kind, i) => { const item = ITEMS[look?.[i] ?? -1]; if (item?.kind === kind) worn[kind] = item.id; });
  const outfit = ITEMS[look?.[ON_THE_BODY.length] ?? -1];
  if (outfit?.kind === 'outfit' && outfit.fighter) worn.outfits = { [outfit.fighter]: outfit.id };
  return worn;
}

export interface Bundle { id: string; name: string; glyph: string; blurb: string; items: readonly string[] }
/** How much a bundle took off. */
export const BUNDLE_OFF = .25;
export const BUNDLES: readonly Bundle[] = [];
export const BUNDLE = new Map(BUNDLES.map(each => [each.id, each] as const));
export const isBundle = (id: string) => BUNDLE.has(id);
/** What a bundle costs one who owns what `owns` says: `full`, the pieces still to buy at their own
 *  prices; `price`, a quarter off that, to the nearest ten. */
export function bundlePrice(bundle: Bundle, owns: (id: string) => boolean = () => false) {
  const full = bundle.items.filter(id => !owns(id)).reduce((sum, id) => sum + priceOf(ITEM.get(id)!), 0);
  return { full, price: Math.round(full * (1 - BUNDLE_OFF) / 10) * 10 };
}
