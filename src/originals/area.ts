import type { FighterId } from '../game/types';

export interface OriginalArea {
  main: string;
  name: string;
  /** The short name on the move card, where the full one is long. */
  card?: string;
  /** The banner's and the seal's Japanese line. */
  ja: string;
  form?: { main: string; ja: string };
}

export const ORIGINAL_AREAS: Partial<Record<FighterId, OriginalArea>> = {
  taisei: { main: 'Great Sage Thunderclap', name: 'Great Sage Thunderclap', card: 'Thunderclap', ja: '大聖雷拳' },
  konta: { main: 'Wind Art: Senpu Shigure', name: 'Wind Art: Senpu Shigure', card: 'Senpu Shigure', ja: '風術・旋風時雨' },
  gummy: { main: 'Monsoon', name: 'Monsoon', ja: 'モンスーン' },
  nigo: { main: 'Ash Brand', name: 'Ash Brand', ja: '灰の烙印' },
  ouga: { main: 'Haou Ryuusei', name: 'Haou Ryuusei', ja: '覇王流星' },
  shirokane: { main: 'Ash Art: Great Dust Fall', name: 'Ash Art: Great Dust Fall', card: 'Dust Fall', ja: '灰遁・大塵瀑' },
  shiden: { main: 'Cinder Art: Pyre Crow Technique', name: 'Storm Art: Great Thunderball', card: 'Thunderball', ja: '霆遁・大雷球' },
  kenzo: { main: 'Oni Wind: Great Sandspout', name: 'Oni Wind: Great Sandspout', card: 'Sandspout', ja: '鬼風・大砂柱' },
  kagari: { main: 'Kagaribi', name: 'Kagaribi', ja: '篝火' },
  kosho: { main: 'Brasier: Salamandre', name: 'Brasier: Salamandre', card: 'Salamandre', ja: 'ブラジエ・サラマンドル' },
  ward: { main: 'THEATRE: Lift', name: 'THEATRE: Lift', ja: '手術室・浮揚' },
  koko: { main: 'Iron Lullaby: Ground Smash', name: 'Iron Lullaby: Ground Smash', card: 'Iron Lullaby', ja: '鉄の子守唄' },
  oro: { main: 'Midnight: Knife Rain', name: 'Midnight: Knife Rain', card: 'Knife Rain', ja: '刻の刃雨' },
  kuon: { main: 'Hex: Collapse', name: 'Hex: Collapse', card: 'Condemned', ja: '呪・崩落' },
  setsu: { main: 'Raisetsu', name: 'Raisetsu', ja: '雷雪' },
  haldor: { main: 'Groundswell Quake', name: 'Groundswell Quake', card: 'Groundswell', ja: '地鳴り' },
  sorrel: { main: 'Crimson Wake Strike', name: 'Crimson Wake Strike', card: 'Crimson Wake', ja: '紅の航跡' },
  'wuming': { main: 'Lotus Verdict', name: 'Lotus Verdict', card: 'Verdict', ja: '裁きの蓮' },
  jirenga: { main: 'Immovable Barrage', name: 'Immovable Barrage', card: 'Immovable', ja: '不動連撃' },
  'jinlin': { main: 'Dragon-Gate Disc', name: 'Dragon-Gate Disc', ja: '龍門円刃' },
  'gohaku': { main: 'White Ape Barrage', name: 'White Ape Barrage', card: 'White Ape', ja: '白猿連打' },
  tobari: { main: 'Cinder Art: Pyre Crow Technique', name: 'Crow Art: Great Ember', card: 'Great Ember', ja: '鴉遁・大燼' },
  akagane: { main: 'Tomb Pyre', name: 'Tomb Pyre', card: 'Tomb Pyre', ja: '墓炎' }, // the redesign (3 November 2026): "Flame Hymn" answered "Release Song" word for word
  magatsu: { main: 'Calamity Pyre', name: 'Calamity Pyre', ja: '禍焔' },
  vesper: { main: 'Raven Host', name: 'Raven Host', ja: '鴉の軍' },
  imago: { main: 'Checkmate', name: 'Last Move', ja: '終局' },
  gaku: { main: 'Lion\'s Roar', name: "Lion's Roar", ja: '獅子吼' },
  levin: { main: "Spotless", name: 'Spotless', ja: '塵ひとつ無し' },
  sekka: { main: 'Shatter Art: Snowcrush', name: 'Shatter Art: Snowcrush', card: 'Snowcrush', ja: '砕雪' },
  asahi: { main: 'Daybreak Cycle', name: 'Daybreak Cycle', ja: '夜明けの巡り' },
  'rook': { main: 'Grave Legion', name: 'Grave Legion', ja: '墓の軍勢' },
  shiun: { main: 'Hymn 7: Storm Psalm', name: 'Hymn 7: Storm Psalm', card: 'Storm Psalm', ja: '聖歌七番・嵐の詩篇' },
  gaunt: { main: 'Scrap Repeater', name: 'Scrap Repeater', ja: '鉄屑連射' },
  gorai: { main: 'Wyrm Breath', name: 'Wyrm Breath', ja: '嵐竜の息吹' },
  dorado: { main: "Crown Clash", name: 'Crown Clash', ja: '王冠の激突' },
  ippon: { main: 'All-Nighter Desk Flip', name: 'All-Nighter Desk Flip', card: 'Desk Flip', ja: '残業ちゃぶ台返し' },
  'full-beam': { main: 'Cape Hatteras Gale', name: 'Cape Hatteras Gale', card: 'Hatteras Gale', ja: '灯台旋風' }, // Full Beam's (round 6)
  bellows: { main: "Open Furnace", name: 'Open Furnace', ja: '炉門開放' }, // Bellows's (round 6)
  ampere: { main: 'Good Hope Drop', name: 'Good Hope Drop', card: 'Good Hope', ja: '希望岬' }, // Ampere's (round 6)
  pyroclast: { main: 'Tephra Storm', name: 'Tephra Storm', ja: '噴石嵐' }, // Pyroclast's (round 6)
  hagure: { main: 'Stray Fist: Thousand Bites', name: 'Stray Fist: Thousand Bites', card: 'Thousand Bites', ja: '野良拳・千噛み' }, // Hagure's (round 6)
  kuzu: { main: 'Choke Chain', name: 'Choke Chain', ja: '首輪鎖' }, // Kuzu's (round 6)
  hikui: { main: 'Sending Fire', name: 'Sending Fire', ja: '送り火' }, // Hikui's (round 6)
  lanthorn: { main: 'Closing Time', name: 'Closing Time', ja: '店じまい' }, // Lanthorn's (round 6)
  akayuri: { main: 'Blossom-Scatter', name: 'Blossom-Scatter', ja: '花散らし' }, // Akayuri's (round 6)
  shanxiao: { main: 'Toppled Peak', name: 'Toppled Peak', ja: '崩山' }, // Shanxiao's (round 6)
  'ovid': { main: 'Wrecking Ball', name: 'Wrecking Ball', ja: '解体の鉄球' }, // Ovid's (round 6)
  'shibuichi': { main: 'Recast', name: 'Recast', ja: '鋳直し' }, // Shibuichi's (round 6)
  highsun: { main: 'Corona Burst', name: 'Corona Burst', ja: '日冕爆' }, // Highsun's (round 6)
  cardo: { main: 'Thistledown Storm', name: 'Thistledown Storm', card: 'Thistledown', ja: '綿毛嵐' }, // Cardo's (round 6)
  tancho: { main: 'Snowmelt Rupture', name: 'Snowmelt Rupture', card: 'Snowmelt', ja: '雪解爆波' }, // Tancho's (round 6)
  torsion: { main: 'Twist-Off', name: 'Twist-Off', ja: '捻じ切り' }, // Torsion's (round 6)
  bonsho: { main: 'Last Toll', name: 'Last Toll', ja: '終の鐘' }, // Bonsho's (round 6)
  murex: { main: 'Core Flare', name: 'Core Flare', ja: '炉心閃光' }, // Murex's (round 6)
  aquilo: { main: 'Eye of the Gale', name: 'Eye of the Gale', ja: '疾風の眼' }, // Aquilo's (round 6)
  svanhild: { main: "Mirror Lake", name: 'Mirror Lake', ja: '鏡の湖' }, // Svanhild's (round 6)
  mizuhiki: { main: 'Spinning Slash', name: 'Spinning Jenny', ja: '紡ぎ車' }, // Mizuhiki's (round 6)
  rotfalke: { main: 'Hood Off: Wild Raptor', name: 'Hood Off: Wild Raptor', card: 'Hood Off', ja: '猛禽解放' }, // Rotfalke's (round 6)
  hisame: { main: 'Permafrost', name: 'Permafrost', ja: '永久凍土' },
  suzuran: { main: 'Bell Garden', name: 'Bell Garden', ja: '鈴の庭' },
  unari: { main: 'All Fall Down', name: 'All Fall Down', ja: '総崩れ' },
  buna: { main: 'Cold Snap', name: 'Cold Snap', ja: '寒波' },
  tsubute: { main: 'Spate', name: 'Spate', ja: '鉄砲水' },
  'shakudo': { main: 'Full Pour', name: 'Full Pour', ja: '総鋳込み' },
  wataame: { main: 'Lie In', name: 'Lie In', ja: '朝寝坊' },
  shakugo: { main: 'Sentence: Molten Prison', name: 'Sentence: Molten Prison', card: 'Molten Prison', ja: '刑・溶獄' }, // Shakugo's (round 6)
  tokan: { main: 'Icicle Pikes', name: 'Icicle Pikes', ja: '氷柱槍' }, // Tokan's (round 6)
  senko: { main: 'Black Pyre', name: 'Broad Daylight', card: 'Daylight', ja: '白昼光' }, // Senko's (round 6)
  'basilissa': { main: 'Gaze of the Stone Rose', name: 'Gaze of the Stone Rose', card: 'Stone Rose', ja: '石薔薇の眼差し' }, // Basilissa's (round 6)
  barrow: { main: 'Wrecker\'s Haul', name: 'Wrecker\'s Haul', card: 'Haul', ja: '引き揚げ' }, // Barrow's (round 6)
  strappado: { main: 'Big Top', name: 'Big Top', ja: '天幕' }, // Strappado's (round 6)
  adad: { main: 'Advent of Thunder', name: 'Advent of Thunder', card: 'Advent', ja: '天雷降臨' }, // Adad's (round 6)
  aqrab: { main: 'Antlion Pit', name: 'Antlion Pit', ja: '蟻地獄' }, // Aqrab's (round 6)
  oyashio: { main: 'Riptide Overthrow', name: 'Riptide Overthrow', card: 'Overthrow', ja: '離岸流・巴投げ' }, // Oyashio's (round 6)
  strix: { main: 'Vigil: Thousand Candles', name: 'Vigil: Thousand Candles', card: 'Thousand Candles', ja: '通夜・千の灯' }, // Strix's (round 6)
  sorayomi: { main: 'Forecast: Lightning Front', name: 'Forecast: Lightning Front', card: 'Lightning Front', ja: '予報・雷雨前線' }, // Sorayomi's (round 6)
  'psyche': { main: 'Field of Hands', name: 'Field of Hands', ja: '掌の野' }, // Psyche's (round 6)
  amagoi: { main: 'Weeping Sky', name: 'Weeping Sky', ja: '天の涙' }, // Amagoi's (round 6)
  mikage: { main: 'Catwalk', name: 'Catwalk', ja: '猫道' }, // Mikage's (round 6)
  shidare: { main: 'Steel Avenue', name: 'Steel Avenue', ja: '鋼並木' }, // Shidare's (round 6)
  irbis: { main: 'Hailstorm Talons', name: 'Hailstorm Talons', card: 'Hailstorm', ja: '雹爪' }, // Irbis's (round 6)
  shijima: { main: 'Hymn 27: Blue Pyre', name: 'Hymn 27: Blue Pyre', card: 'Blue Pyre', ja: '聖歌二十七番・青き弔火' }, // Shijima's (round 6)
  onigawara: { main: 'Rampage Ground', name: 'Rampage Ground', card: 'Rampage', ja: '暴れ野' }, // Onigawara's (round 6)
  ume: { main: 'Earthbloom!!', name: 'Earthbloom', ja: '大地咲き' }, // Ume's (round 6)
  kusushi: { main: 'Purifying Salt', name: 'Purifying Salt', ja: '清め塩' }, // Kusushi's (round 6)
  hakushi: { main: 'Mane Cage', name: 'Mane Cage', ja: '鬣の檻' }, // Hakushi's (round 6)
  minase: { main: 'Grand Circuit', name: 'Grand Circuit', ja: '疾風早馬・大周回・三番' }, // Minase's (round 6's Kanata, renamed by minase-build)
  'madake': { main: 'Autumn Stag', name: 'Autumn Stag', ja: '秋の鹿' }, // Madake's (round 6)
  bruin: { main: 'Bear\'s Den', name: "Bear's Den", ja: '熊の穴' }, // Bruin's (round 6)
  akaito: { main: 'Ghost Bride', name: 'Ghost Bride', ja: '冥婚' }, // Akaito's (round 6)
  tempo: { main: 'Dark Spark', name: 'Zero Gap', ja: '零距離' }, // Tempo's (round 6)
  sashigane: { main: 'Fault Line', name: 'Fault Line', ja: '断層線' }, // Sashigane's (round 6)
  chohan: { main: 'Loaded Dice', name: 'Loaded Dice', ja: 'イカサマ賽' }, // Chohan's (round 6)
  hawser: { main: 'Tug of War', name: 'Tug of War', ja: '綱引き', form: { main: 'The Uprooting', ja: '根こそぎ' } },
  'rakucho': { main: 'Torn Binding', name: 'Torn Binding', ja: '綴じ破り' },
  kubiwa: { main: 'Grand Pause', name: 'Grand Pause', ja: '総休止' },
  hinomoto: { main: 'Old Fire', name: 'Ashen Decree', ja: '焼尽の令' }, // Hinomoto's (round 6)
  yodaka: { main: 'Fifth Watch: Fire Owl', name: 'Fifth Watch: Fire Owl', card: 'Fire Owl', ja: '五番・火梟' }, // Yodaka's (round 6)
  kinu: { main: 'Cat\'s Cradle', name: "Cat's Cradle", ja: 'あやとり' }, // Kinu's (round 6)
  gosu: { main: 'Shard Shot', name: 'Shard Shot', ja: '欠片弾' }, // Gosu's (round 6)
};

/** The banner's and the seal's Japanese line for `fighter`'s area move: the original's (its form's, for the move `move` its
 *  awakened form casts), else what the game gives. */
export function shownAreaJa(fighter: FighterId | string, ja: string, move?: string) {
  const a = ORIGINAL_AREAS[fighter as FighterId];
  return a ? (a.form && move === a.form.main ? a.form.ja : a.ja) : ja;
}

/** The move card's short name for `fighter`'s area move, given the game's card name for it. */
export function shownAreaCard(fighter: FighterId | string, card: string) {
  const a = ORIGINAL_AREAS[fighter as FighterId];
  return a ? (a.card ?? a.name) : card;
}

/** `fighter`'s area move with the original's card name on it (src/ui/hud/moveCards.ts, before areaMoveCard reads it). */
export function shownAreaMove<M extends { name: string; area?: { card?: string } } | undefined>(fighter: FighterId | string, move: M): M {
  const a = ORIGINAL_AREAS[fighter as FighterId];
  return a && move ? { ...move, area: { ...move.area, card: a.card ?? a.name } } as M : move;
}

export const ORIGINAL_TECHNIQUES: Partial<Record<FighterId, Record<string, string>>> = {
  taisei: { 'Redline Dash': 'Redline Dash', 'Monkey King Uppercut': 'Monkey King Uppercut', 'Empty Mind Counter': 'Empty Mind Counter' },
  ouga: { 'Royal Charge': 'Royal Charge', 'Crown Uppercut': 'Crown Uppercut', 'Prince\'s Reprisal': "Prince's Reprisal" },
  gummy: { 'Bow Wave Rush': 'Bow Wave Rush', 'Riptide Uppercut': 'Riptide Uppercut', 'Rebound Counter': 'Rebound Counter' },
  konta: { 'Foxpack Rush': 'Foxpack Rush', 'Gust Uppercut': 'Gust Uppercut', 'Kitsune Counter': 'Kitsune Counter' },
  shiden: { 'Storm Hawk Lunge': 'Storm Hawk Lunge', 'Hawk-Eye Counter': 'Hawk-Eye Counter' },
  kenzo: { 'Oni Lunge': 'Oni Lunge', 'Iai Counter: Ronin': 'Iai Counter: Ronin' },
  nigo: { 'Ember Step Thrust': 'Ember Step Thrust', 'Nightfall Counter': 'Nightfall Counter' },
  koko: { 'Iron Rush': 'Iron Rush', 'Lullaby Counter': 'Lullaby Counter' },
  oro: { 'Gilded Rush': 'Gilded Rush', 'Midnight Counter': 'Midnight Counter' },
  kosho: { 'Service Rush': 'Service Rush', 'Kitchen Counter': 'Kitchen Counter' },
  shirokane: { 'Scarecrow Dash': 'Scarecrow Dash', 'Mirror Counter': 'Mirror Counter' },
  kuon: { 'Gravity Blink': 'Gravity Blink', 'Null Counter': 'Null Counter' },
  gaunt: { 'Hound Lunge': 'Hound Lunge', 'Ash Hound Counter': 'Ash Hound Counter' },
  setsu: { 'Snowflash': 'Snowflash', 'Instant Counter': 'Instant Counter' },
  kagari: { 'Wildfire Rush': 'Wildfire Rush', 'Ember Counter': 'Ember Counter' },
  ward: { 'Crossmatch Lunge': 'Crossmatch Lunge', 'Triage Counter': 'Triage Counter' },
  'full-beam': { 'Dashing Strike': 'Lifeboat Rush', 'Rising Uppercut': 'Lighthouse Uppercut', 'Counter Stance': 'Breakwater Counter' }, // Full Beam's (round 6)
  bellows: { 'Dashing Strike': 'Coal Rush', 'Rising Uppercut': 'Smokestack Rise', 'Counter Stance': 'Anvil Counter' }, // Bellows's (round 6)
  ampere: { 'Dashing Strike': 'Short Circuit Rush', 'Rising Uppercut': 'Spark Gap Uppercut', 'Counter Stance': 'Ground Fault Counter' }, // Ampere's (round 6)
  pyroclast: { 'Dashing Strike': 'Lava Dash', 'Rising Uppercut': 'Geyser Uppercut', 'Counter Stance': 'Backfire Counter' }, // Pyroclast's (round 6)
  hagure: { 'Dashing Strike': 'Stray Lunge', 'Rising Uppercut': 'Scruff Uppercut', 'Counter Stance': 'Turnabout Counter' }, // Hagure's (round 6)
  kuzu: { 'Lunging Thrust': "Sic 'Em Lunge", 'Rising Slash': 'Fetch Slash', 'Iai Counter': 'Heel Counter' }, // Kuzu's (round 6)
  hikui: { 'Lunging Thrust': 'Flicker Step', 'Rising Slash': 'Ember Leap Slash', 'Iai Counter': 'Short Fuse Counter' }, // Hikui's (round 6)
  lanthorn: { 'Lunging Thrust': 'Swinging Door Lunge', 'Rising Slash': 'Uncorked Slash', 'Iai Counter': 'Last Orders Counter' }, // Lanthorn's (round 6)
  akayuri: { 'Lunging Thrust': 'Unseen Lunge', 'Rising Slash': 'Rising Stem', 'Iai Counter': 'Still Lily Counter' }, // Akayuri's (round 6)
  shanxiao: { 'Dashing Strike': 'Stampede Rush', 'Rising Uppercut': 'Horn Toss Uppercut', 'Counter Stance': 'Thick Hide Counter' }, // Shanxiao's (round 6)
  'ovid': { 'Charging Ram': 'Bulldozer Charge', 'Upheaval': 'Forklift', 'Iron Counter': 'Hard Hat Counter' }, // Ovid's (round 6)
  'shibuichi': { 'Charging Ram': 'Plate Charge', 'Upheaval': 'Jack Lift', 'Iron Counter': 'Mended Guard' }, // Shibuichi's (round 6)
  highsun: { 'Lunging Thrust': 'Sunrise Lunge', 'Rising Slash': 'Ascendant Slash', 'Iai Counter': 'Shadowless Counter' }, // Highsun's (round 6)
  cardo: { 'Lunging Thrust': 'Reckless Lunge', 'Rising Slash': 'Uprooter', 'Iai Counter': 'Prickle Counter' }, // Cardo's (round 6)
  tancho: { 'Blink Strike': 'Frost Glide', 'Uplift Burst': "Crane's Ascent", 'Reflect Stance': 'Thin Ice Counter' }, // Tancho's (round 6)
  torsion: { 'Blink Strike': 'Yank', 'Uplift Burst': 'Hoist', 'Reflect Stance': 'Rebuff Counter' }, // Torsion's (round 6)
  bonsho: { 'Dashing Strike': 'Temple Steps Rush', 'Rising Uppercut': 'Bell-Rope Uppercut', 'Counter Stance': 'Still Pond Counter' }, // Bonsho's (round 6)
  murex: { 'Charging Ram': 'Lurching Charge', 'Upheaval': 'Mantis Lift', 'Iron Counter': 'Cornered Counter' }, // Murex's (round 6)
  aquilo: { 'Blink Strike': 'Tailwind Blink', 'Uplift Burst': 'Updraft', 'Reflect Stance': 'Headwind Counter' }, // Aquilo's (round 6)
  svanhild: { 'Blink Strike': 'Glide Step', 'Uplift Burst': 'Running Takeoff', 'Reflect Stance': 'Raised Wings Counter' }, // Svanhild's (round 6)
  mizuhiki: { 'Lunging Thrust': 'Reel-In Lunge', 'Rising Slash': 'Hoist Cut', 'Iai Counter': 'Slack Counter' }, // Mizuhiki's (round 6)
  rotfalke: { 'Charging Ram': 'Wingover Charge', 'Upheaval': 'Climbing Heel', 'Iron Counter': 'Mantle Counter' }, // Rotfalke's (round 6)
  bruin: { 'Lunging Thrust': 'Bear Charge Lunge', 'Rising Slash': 'Rearing Slash', 'Iai Counter': 'Swat Counter' }, // Bruin's (round 6)
  akaito: { 'Lunging Thrust': 'Threadline Lunge', 'Rising Slash': 'Veil Lift', 'Iai Counter': "Bride's Guard Counter" }, // Akaito's (round 6)
  tempo: { 'Dashing Strike': 'Sprint Start', 'Rising Uppercut': 'Skyhook', 'Counter Stance': 'Reflex Counter' }, // Tempo's (round 6)
  sashigane: { 'Lunging Thrust': 'Straight Line Lunge', 'Rising Slash': 'Rising Measure', 'Iai Counter': 'Margin Counter' }, // Sashigane's (round 6)
  chohan: { 'Lunging Thrust': "Dealer's Lunge", 'Rising Slash': 'Raise', 'Iai Counter': 'Called Bluff Counter' }, // Chohan's (round 6)
  yodaka: { 'Lunging Thrust': 'Night Patrol Lunge', 'Rising Slash': "Owl's Lift", 'Iai Counter': "Watchman's Counter" }, // Yodaka's (round 6)
  kinu: { 'Dashing Strike': 'Unspooling Rush', 'Counter Stance': 'Snap-Thread Counter' }, // Kinu's (round 6)
  gosu: { 'Dashing Strike': 'Glaze Rush', 'Counter Stance': 'Hair-Trigger Counter' }, // Gosu's (round 6)
  shiun: { 'Lunging Thrust': 'Downbeat Lunge', 'Iai Counter': 'Encore Counter' },
  vesper: { 'Lunging Thrust': 'Crownward Lunge', 'Iai Counter': 'Feather Riposte' },
  gorai: { 'Driving Thrust': 'Mast Ram', 'Staff Counter': 'Thunderhead Counter' },
  dorado: { 'Lunging Thrust': 'Gold Rush', 'Iai Counter': 'Horizon Counter' },
  sorrel: { 'Lunging Thrust': 'Wake Lunge', 'Iai Counter': 'Dead Calm Counter' },
  magatsu: { 'Blink Strike': 'Omen Step', 'Reflect Stance': 'Calamity Counter' },
  haldor: { 'Driving Thrust': 'Glaive Drive', 'Staff Counter': 'Old Stolen Tremor' },
  shakugo: { 'Dashing Strike': 'No Refunds Rush', 'Counter Stance': 'Verdict Counter' },
  tokan: { 'Lunging Thrust': 'Sleepwalk Lunge', 'Iai Counter': 'Half-Awake Counter' },
  senko: { 'Lunging Kick': 'Glare Lunge', 'Counter Spin Kick': 'Prism Counter' },
  'basilissa': { 'Lunging Kick': 'Gliding Serpent Kick', 'Counter Spin Kick': 'Haughty Counter' },
  barrow: { 'Dashing Strike': 'Glutton\'s Rush', 'Counter Stance': 'Salvage Counter' },
  strappado: { 'Blink Strike': 'Grand Entrance', 'Reflect Stance': 'Strings-Attached Counter' },
  adad: { 'Driving Thrust': 'Arc Thrust', 'Staff Counter': 'Foresight Counter' },
  aqrab: { 'Blink Strike': 'Sandslip Strike', 'Reflect Stance': 'Shifting-Sand Counter' },
  oyashio: { 'Dashing Strike': 'Helmsman\'s Charge', 'Counter Stance': 'Ebb-Tide Counter' },
  strix: { 'Lunging Thrust': 'Count\'s Lunge', 'Iai Counter': 'Unblinking Counter' },
  sorayomi: { 'Driving Thrust': 'Tailwind Thrust', 'Staff Counter': 'Weathervane Counter' },
  'psyche': { 'Blink Strike': 'Fluttering Strike', 'Reflect Stance': 'Read-Ahead Counter' },
  amagoi: { 'Blink Strike': 'Silent Rain Step', 'Reflect Stance': 'Repelling Counter' },
  mikage: { 'Lunging Kick': 'Prowling Kick', 'Counter Spin Kick': 'Feline Counter' },
  shidare: { 'Lunging Thrust': 'Petal Step Lunge', 'Iai Counter': 'Pruning Counter' },
  irbis: { 'Dashing Strike': 'Pouncing Rush', 'Counter Stance': 'Snarl Counter' },
  shijima: { 'Lunging Thrust': 'Descant Lunge', 'Iai Counter': 'Hush Counter' },
  onigawara: { 'Lunging Thrust': 'Headlong Lunge', 'Iai Counter': 'Open-Guard Counter' },
  ume: { 'Dashing Strike': 'Headlong Bloom', 'Counter Stance': 'Triage Counter' },
  kusushi: { 'Dashing Strike': 'Tachiai Charge', 'Counter Stance': 'Ring-Edge Counter' },
  hakushi: { 'Blink Strike': 'Hanamichi Rush', 'Reflect Stance': 'Frozen-Pose Counter' },
  minase: { 'Dashing Strike': 'Courier\'s Dash', 'Counter Stance': 'Waypoint Counter' },
  'madake': { 'Dashing Strike': 'Bamboo Dash', 'Counter Stance': 'Snap-Back Counter' },
  hawser: { 'Lunging Thrust': 'Payout Lunge', 'Rising Slash': 'Belay Rise', 'Iai Counter': 'Backlash Counter' },
  'rakucho': { 'Dashing Strike': 'Skimming Dash', 'Rising Uppercut': 'Page-Turn Uppercut', 'Counter Stance': 'Bookend Counter' },
  kubiwa: { 'Blink Strike': 'Rubato Step', 'Uplift Burst': 'Upstroke', 'Reflect Stance': 'Measured Rest Counter' },
  hinomoto: { 'Lunging Thrust': 'Marching Lunge', 'Iai Counter': 'Staff-Sheath Counter' },
};
