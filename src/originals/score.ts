const M = '/assets/music/originals/';

/** Each world's theme, the music its fighters fight and win to (src/audio/musicTracks.ts `phases`): `replaces`, the key
 *  of the table's entry that plays it. */
export const ORIGINAL_SCORE = [
  { url: M + 'skyborn-ascent.m4a', title: 'Skyborn Ascent', artist: 'Last Sun OST', replaces: ['originals-skyborn-ascent'] },
  { url: M + 'gale-runner.m4a', title: 'Gale Runner', artist: 'Ashwood OST', replaces: ['originals-gale-runner'] },
  { url: M + 'set-sail.m4a', title: 'Set Sail on the Dust Sea', artist: 'Dust Sea OST', replaces: ['originals-set-sail'] },
  { url: M + 'cinder-requiem.m4a', title: 'Cinder Requiem', artist: 'Cinder Requiem OST', replaces: ['originals-cinder-requiem'] },
  { url: M + 'gilded-hour.m4a', title: 'Gilded Hour', artist: 'Gilded Ruin OST', replaces: ['originals-gilded-hour'] },
  { url: M + 'endless-null.m4a', title: 'Endless Null', artist: 'Hex Fallout OST', replaces: ['originals-endless-null'] },
  { url: M + 'grave-road.m4a', title: 'Grave Road', artist: 'Grave Hound OST', replaces: ['originals-grave-road'] },
  { url: M + 'static-trail.m4a', title: 'Static Trail', artist: 'Salvage Wilds OST', replaces: ['originals-static-trail'] },
] as const;

/** Round 4: the pieces written for the Rift, Arcade Survival's playlist (src/audio/musicTracks.ts SURVIVAL_MUSIC and the
 *  bosses' rounds), which the shop's fighters of no series fight to as well: the run's battle march, its rite, the thing
 *  circling it, the light left at its end (the run's results open on it) and the watch between two fights. */
export const ORIGINAL_RIFT = [
  { url: M + 'rift-unbound.m4a', title: 'The Rift Unbound', artist: 'The Rift OST', replaces: ['originals-rift-unbound'] },
  { url: M + 'rite-of-ashes.m4a', title: 'Rite of Ashes', artist: 'The Rift OST', replaces: ['originals-rite-of-ashes'] },
  { url: M + 'apex-of-the-rift.m4a', title: 'Apex of the Rift', artist: 'The Rift OST', replaces: ['originals-apex-of-the-rift'] },
  { url: M + 'last-light.m4a', title: 'Last Light', artist: 'The Rift OST', replaces: ['originals-last-light'] },
  { url: M + 'long-night-watch.m4a', title: 'Long Night Watch', artist: 'The Rift OST', replaces: ['originals-long-night-watch'] },
] as const;

export const ORIGINAL_WORLDS = [
  { id: 'originals-black-snow', series: 'black-snow', url: M + 'embers-in-the-black-snow.m4a', title: 'Embers in the Black Snow',
    artist: 'Black Snow OST', fighters: ['sekka', 'asahi'] },
  { id: 'originals-blast-radius', series: 'blast-radius', url: M + 'hazard-pay.m4a', title: 'Hazard Pay',
    artist: 'Blast Radius OST', fighters: ['ippon'] },
  { id: 'originals-gatefall', series: 'gatefall', url: M + 'the-dead-follow.m4a', title: 'The Dead Follow',
    artist: 'Gatefall OST', fighters: ['rook'] },
  { id: 'originals-pixel-konta', series: 'pixel-konta', url: M + 'pixel-konta.m4a', title: 'Spiral Wind', artist: 'Ashwood OST', fighters: ['konta'] },
  { id: 'originals-pixel-lucy', series: 'pixel-lucy', url: M + 'pixel-lucy.m4a', title: 'Past Every Horizon', artist: 'Dust Sea OST', fighters: ['gummy'] },
  { id: 'originals-pixel-kosho', series: 'pixel-kosho', url: M + 'pixel-kosho.m4a', title: 'Service at Sea', artist: 'Dust Sea OST', fighters: ['kosho'] },
  { id: 'originals-pixel-ouga', series: 'pixel-ouga', url: M + 'pixel-ouga.m4a', title: "The Prince's March", artist: 'Last Sun OST', fighters: ['ouga'] },
  { id: 'originals-pixel-kagari', series: 'pixel-kagari', url: M + 'pixel-kagari.m4a', title: 'Watch-Fire', artist: 'Dust Sea OST', fighters: ['kagari'] },
  { id: 'originals-pixel-kuon', series: 'pixel-kuon', url: M + 'pixel-kuon.m4a', title: 'Planetarium', artist: 'Hex Fallout OST', fighters: ['kuon'] },
  { id: 'originals-pixel-setsu', series: 'pixel-setsu', url: M + 'pixel-setsu.m4a', title: 'Thundersnow Chase', artist: 'Salvage Wilds OST', fighters: ['setsu'] },
  // (Levin's slot left Ironwall's 'Hold the Last Wall' with Lanius.)
  { id: 'originals-pixel-kirigane', series: 'pixel-kirigane', url: M + 'pixel-kirigane.m4a', title: 'Taut Line', artist: 'Ropewalk OST', fighters: ['levin', 'hawser'] }, // (and Hawser's, Ropewalk's other: 3 November)
  { id: 'originals-pixel-hisame', series: 'pixel-hisame', url: M + 'pixel-hisame.m4a', title: 'Waltz in the Snow', artist: 'Frostmarch OST', fighters: ['hisame'] },
  { id: 'originals-pixel-suzuran', series: 'pixel-suzuran', url: M + 'pixel-suzuran.m4a', title: 'The Still Bell', artist: 'Hundred Bells OST', fighters: ['suzuran'] },
  { id: 'originals-pixel-unari', series: 'pixel-unari', url: M + 'pixel-unari.m4a', title: 'Rooftop Tango', artist: 'Paper Sky OST', fighters: ['unari'] },
  { id: 'originals-pixel-buna', series: 'pixel-buna', url: M + 'pixel-buna.m4a', title: 'Woodland Stomp', artist: 'Old Growth OST', fighters: ['buna'] },
  { id: 'originals-pixel-tsubute', series: 'pixel-tsubute', url: M + 'pixel-tsubute.m4a', title: 'Skipping Stones', artist: 'Stone Ford OST', fighters: ['tsubute'] },
  { id: 'originals-pixel-shakudo', series: 'pixel-shakudo', url: M + 'pixel-shakudo.m4a', title: 'Forge Funk', artist: 'Slag Hill OST', fighters: ['shakudo'] },
  { id: 'originals-pixel-wataame', series: 'pixel-wataame', url: M + 'pixel-wataame.m4a', title: 'Odd Jobs', artist: 'Lantern Ward OST', fighters: ['wataame'] },
] as const;

/** The home screen's playlist until 4 November 2026: one original theme, looped. The soundtrack's home rotation (SOUNDTRACK.home)
 *  took its place; the piece is kept (its file and record stay) but no longer listed, so it does not ship. */
export const ORIGINAL_HOME = { id: 'originals-pages-of-legend', url: M + 'pages-of-legend.m4a', title: 'Pages of Legend', artist: 'Original score' } as const;

// ---- The soundtrack (4 November 2026) ----------------------------------------------------------------------------------

export interface SoundtrackCredit { readonly work: string; readonly by: string; readonly page: string; readonly changes: string }
export interface SoundtrackTrack { readonly id: string; readonly url: string; readonly title: string; readonly artist: string; readonly credit: SoundtrackCredit }
const ost = (file: string, title: string, artist: string, credit: SoundtrackCredit): SoundtrackTrack => ({ id: `ost-${file}`, url: `${M}${file}.m4a`, title, artist, credit });

/** The modes as the music knows them (src/ui/modes/catalogue.ts ModeId, read through modeOfSnapshot). */
export type SoundtrackMode = 'duel' | 'royale' | 'training' | 'arcade' | 'last-stand' | 'bad-blood' | 'rift-war' | 'goal-rush' | 'sky-spike';

/** Every track, by its file (scripts/originals/music/soundtrack.json lists each one's source and licence). */
const OST = {
  'maoudamashii-shining-star': ost('maoudamashii-shining-star', 'シャイニングスター', 'MaouDamashii · vo. 詩歩',
    { work: '“シャイニングスター” (Shining Star)', by: 'by 魔王魂 (MaouDamashii, Koichi Morita), sung by 詩歩', page: 'https://maou.audio/14_shining_star/', changes: 'its short version, levelled' }),
  'maoudamashii-burning-heart': ost('maoudamashii-burning-heart', 'Burning Heart', 'MaouDamashii · vo. KEI',
    { work: '“Burning Heart”', by: 'by 魔王魂 (MaouDamashii, Koichi Morita), sung by KEI', page: 'https://maou.audio/08_burning_heart/', changes: 'its short version, levelled' }),
  'maoudamashii-hikari-trigger': ost('maoudamashii-hikari-trigger', 'ヒカリトリガー', 'MaouDamashii · vo. 火ノ岡レイ',
    { work: '“ヒカリトリガー” (Hikari Trigger)', by: 'by 魔王魂 (MaouDamashii, Koichi Morita), sung by 火ノ岡レイ', page: 'https://maou.audio/44_hikari_trigger/', changes: 'its short version, levelled' }),
  'maoudamashii-tsuki-to-okami': ost('maoudamashii-tsuki-to-okami', '月と狼', 'MaouDamashii · vo. KEI',
    { work: '“月と狼” (Tsuki to Okami, The Moon and the Wolf)', by: 'by 魔王魂 (MaouDamashii, Koichi Morita), sung by KEI; violin by 奥村みのり', page: 'https://maou.audio/04_tsuki_to_okami/', changes: 'its short version, levelled' }),
  'maoudamashii-12345': ost('maoudamashii-12345', '12345', 'MaouDamashii · vo. Mary',
    { work: '“12345”', by: 'by 魔王魂 (MaouDamashii, Koichi Morita), sung by Mary', page: 'https://maou.audio/19_12345/', changes: 'its short version, levelled' }),
  'maoudamashii-halzion': ost('maoudamashii-halzion', 'ハルジオン', 'MaouDamashii · vo. KEI',
    { work: '“ハルジオン” (Halzion)', by: 'by 魔王魂 (MaouDamashii, Koichi Morita), sung by KEI', page: 'https://maou.audio/05_halzion/', changes: 'its short version, levelled' }),
  'maoudamashii-neorock82': ost('maoudamashii-neorock82', '君が見ていた世界の果て', 'MaouDamashii · Neo Rock 82',
    { work: 'ネオロック82「君が見ていた世界の果て」 (Neo Rock 82)', by: 'by 魔王魂 (MaouDamashii, Koichi Morita)', page: 'https://maou.audio/bgm_neorock82/', changes: 'levelled' }),
  'maoudamashii-neorock36': ost('maoudamashii-neorock36', '火花散る間合い', 'MaouDamashii · Neo Rock 36',
    { work: 'ネオロック36 (Neo Rock 36)', by: 'by 魔王魂 (MaouDamashii, Koichi Morita)', page: 'https://maou.audio/bgm_neorock36/', changes: 'levelled' }),
  'maoudamashii-neorock81': ost('maoudamashii-neorock81', '狙撃手の葛藤', 'MaouDamashii · Neo Rock 81',
    { work: 'ネオロック81「狙撃手の葛藤」 (Neo Rock 81)', by: 'by 魔王魂 (MaouDamashii, Koichi Morita)', page: 'https://maou.audio/bgm_neorock81/', changes: 'levelled' }),
  'maoudamashii-neorock80': ost('maoudamashii-neorock80', 'Hallucination', 'MaouDamashii · Neo Rock 80',
    { work: 'ネオロック80「Hallucination」 (Neo Rock 80)', by: 'by 魔王魂 (MaouDamashii, Koichi Morita)', page: 'https://maou.audio/bgm_neorock80/', changes: 'levelled' }),
  'maoudamashii-fantasy15': ost('maoudamashii-fantasy15', '駆け抜ける戦場の嵐', 'MaouDamashii · Fantasy 15',
    { work: 'ファンタジー15「駆け抜ける戦場の嵐」 (Fantasy 15)', by: 'by 魔王魂 (MaouDamashii, Koichi Morita)', page: 'https://maou.audio/bgm_fantasy15/', changes: 'levelled' }),
  'maoudamashii-fantasy03': ost('maoudamashii-fantasy03', '戦いのアーチ', 'MaouDamashii · Fantasy 03',
    { work: 'ファンタジー03「戦いのアーチ」 (Fantasy 03)', by: 'by 魔王魂 (MaouDamashii, Koichi Morita)', page: 'https://maou.audio/bgm_fantasy03/', changes: 'levelled' }),
  'maoudamashii-neorock83': ost('maoudamashii-neorock83', '厳戒態勢', 'MaouDamashii · Neo Rock 83',
    { work: 'ネオロック83「厳戒態勢」 (Neo Rock 83)', by: 'by 魔王魂 (MaouDamashii, Koichi Morita)', page: 'https://maou.audio/bgm_neorock83/', changes: 'levelled' }),
  'maoudamashii-orchestra24': ost('maoudamashii-orchestra24', 'crisis', 'MaouDamashii · Orchestra 24',
    { work: 'オーケストラ24「crisis」 (Orchestra 24)', by: 'by 魔王魂 (MaouDamashii, Koichi Morita)', page: 'https://maou.audio/bgm_orchestra24/', changes: 'levelled' }),
  'maoudamashii-neorock75': ost('maoudamashii-neorock75', 'Skull heart', 'MaouDamashii · Neo Rock 75',
    { work: 'ネオロック75「Skull heart」 (Neo Rock 75)', by: 'by 魔王魂 (MaouDamashii, Koichi Morita)', page: 'https://maou.audio/bgm_neorock75/', changes: 'levelled' }),
  'maoudamashii-neorock68': ost('maoudamashii-neorock68', 'ツメアト', 'MaouDamashii · Neo Rock 68',
    { work: 'ネオロック68「ツメアト」 (Neo Rock 68)', by: 'by 魔王魂 (MaouDamashii, Koichi Morita)', page: 'https://maou.audio/bgm_neorock68/', changes: 'levelled' }),
  'maoudamashii-fantasy12': ost('maoudamashii-fantasy12', '戦術的構想', 'MaouDamashii · Fantasy 12',
    { work: 'ファンタジー12「戦術的構想」 (Fantasy 12)', by: 'by 魔王魂 (MaouDamashii, Koichi Morita)', page: 'https://maou.audio/bgm_fantasy12/', changes: 'levelled' }),
  'maoudamashii-orchestra20': ost('maoudamashii-orchestra20', '裸足の勇者', 'MaouDamashii · Orchestra 20',
    { work: 'オーケストラ20「裸足の勇者」 (Orchestra 20)', by: 'by 魔王魂 (MaouDamashii, Koichi Morita)', page: 'https://maou.audio/bgm_orchestra20/', changes: 'levelled' }),
  'maoudamashii-neorock33': ost('maoudamashii-neorock33', '千本目の型', 'MaouDamashii · Neo Rock 33',
    { work: 'ネオロック33 (Neo Rock 33)', by: 'by 魔王魂 (MaouDamashii, Koichi Morita)', page: 'https://maou.audio/bgm_neorock33/', changes: 'levelled' }),
  'maoudamashii-neorock54': ost('maoudamashii-neorock54', '打ち込み百本', 'MaouDamashii · Neo Rock 54',
    { work: 'ネオロック54 (Neo Rock 54)', by: 'by 魔王魂 (MaouDamashii, Koichi Morita)', page: 'https://maou.audio/bgm_neorock54/', changes: 'levelled' }),
  'maoudamashii-neorock71': ost('maoudamashii-neorock71', 'NECRO SACRIFICE', 'MaouDamashii · Neo Rock 71',
    { work: 'ネオロック71「NECRO SACRIFICE」 (Neo Rock 71)', by: 'by 魔王魂 (MaouDamashii, Koichi Morita)', page: 'https://maou.audio/bgm_neorock71/', changes: 'levelled' }),
  'maoudamashii-orchestra25': ost('maoudamashii-orchestra25', '神々の試練', 'MaouDamashii · Orchestra 25',
    { work: 'オーケストラ25「神々の試練」 (Orchestra 25)', by: 'by 魔王魂 (MaouDamashii, Koichi Morita)', page: 'https://maou.audio/bgm_orchestra25/', changes: 'levelled' }),
  'maoudamashii-neorock49': ost('maoudamashii-neorock49', '勝鬨の残響', 'MaouDamashii · Neo Rock 49',
    { work: 'ネオロック49 (Neo Rock 49)', by: 'by 魔王魂 (MaouDamashii, Koichi Morita)', page: 'https://maou.audio/bgm_neorock49/', changes: 'levelled' }),
  'maoudamashii-orchestra26': ost('maoudamashii-orchestra26', '戦いの跡', 'MaouDamashii · Orchestra 26',
    { work: 'オーケストラ26「戦いの跡」 (Orchestra 26)', by: 'by 魔王魂 (MaouDamashii, Koichi Morita)', page: 'https://maou.audio/bgm_orchestra26/', changes: 'levelled' }),
  'maoudamashii-sting-victory': ost('maoudamashii-sting-victory', 'Victory', 'MaouDamashii · Neo Rock 33',
    { work: 'ネオロック33 (Neo Rock 33)', by: 'by 魔王魂 (MaouDamashii, Koichi Morita)', page: 'https://maou.audio/bgm_neorock33/', changes: 'its last six seconds, levelled, as the victory sting' }),
  'maoudamashii-sting-defeat': ost('maoudamashii-sting-defeat', 'Defeat', 'MaouDamashii · Neo Rock 46',
    { work: 'ネオロック46 (Neo Rock 46)', by: 'by 魔王魂 (MaouDamashii, Koichi Morita)', page: 'https://maou.audio/bgm_neorock46/', changes: 'its last nine seconds, levelled, as the defeat sting' }),
} as const;
/** A song of the home screen's rotation as a battle theme of its own (the ball modes): the same file and
 *  credit under an id of its own, so the table holds it in the gameplay scope as well as the home screen's. */
const asTheme = (track: SoundtrackTrack, mode: SoundtrackMode): SoundtrackTrack => ({ ...track, id: `${track.id}--${mode}` });
/** The soundtrack's playlists (src/originals/apply.ts applyOriginalMusic and soundtrackQueue): the home screen's rotation; each
 *  mode's battle themes (a match opens on the next of them, turned by the match's number); Arcade Survival's boss rounds;
 *  the results after a win or a loss; and the sting each end opens on. */
export const SOUNDTRACK = {
  home: [OST['maoudamashii-shining-star'], OST['maoudamashii-burning-heart'], OST['maoudamashii-hikari-trigger'], OST['maoudamashii-tsuki-to-okami'], OST['maoudamashii-12345'], OST['maoudamashii-halzion']],
  modes: {
    duel: [OST['maoudamashii-neorock82'], OST['maoudamashii-neorock36']],
    royale: [OST['maoudamashii-neorock81'], OST['maoudamashii-neorock80']],
    training: [OST['maoudamashii-neorock33'], OST['maoudamashii-neorock54']],
    arcade: [OST['maoudamashii-fantasy15'], OST['maoudamashii-fantasy03']],
    'last-stand': [OST['maoudamashii-neorock83'], OST['maoudamashii-orchestra24']],
    'bad-blood': [OST['maoudamashii-neorock75'], OST['maoudamashii-neorock68']],
    'rift-war': [OST['maoudamashii-fantasy12'], OST['maoudamashii-orchestra20']],
    // The ball modes: songs of the home screen's rotation as their battle themes (every instrumental piece is another
    // mode's), and a boss theme as each one's climax (`peak`).
    'goal-rush': [asTheme(OST['maoudamashii-burning-heart'], 'goal-rush'), asTheme(OST['maoudamashii-hikari-trigger'], 'goal-rush')],
    'sky-spike': [asTheme(OST['maoudamashii-12345'], 'sky-spike'), asTheme(OST['maoudamashii-shining-star'], 'sky-spike')],
  } satisfies Record<SoundtrackMode, readonly SoundtrackTrack[]>,
  /** A match's climax, cutting in over its battle theme (CharacterMusic.peak; src/audio/ballAudio.ts): Goal Rush's
   *  OVERTIME, Sky Spike's match point and FEVER. Boss themes, so the queue's boss rule cuts to them at once. */
  peak: { 'goal-rush': OST['maoudamashii-neorock71'], 'sky-spike': OST['maoudamashii-orchestra25'] } as Partial<Record<SoundtrackMode, SoundtrackTrack>>,
  boss: [OST['maoudamashii-neorock71'], OST['maoudamashii-orchestra25']],
  results: { win: [OST['maoudamashii-neorock49']], loss: [OST['maoudamashii-orchestra26']] },
  stinger: { win: OST['maoudamashii-sting-victory'], loss: OST['maoudamashii-sting-defeat'] },
} as const;

