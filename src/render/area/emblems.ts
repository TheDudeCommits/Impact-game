import type { FighterId } from '../../game/types';
import type { SymbolName } from './symbols';
import { applyPixelEmblems } from '../../originals/pixelEmblems';

export type Emblem = ({ glyph: string } | { symbol: SymbolName }) & { colour?: string; why: string };

export const EMBLEMS: Readonly<Record<FighterId, Emblem>> = {
  chohan: { glyph: '博', why: "Chohan's shop-card glyph (round 6)" },
  aqrab: { glyph: '蠍', why: 'Aqrab\'s card kanji (round 6)' },
  tsubute: { glyph: '礫', why: "Tsubute's name: a thrown stone (his shop card's)" },
  yodaka: { glyph: '番', why: "Yodaka's shop-card glyph (round 6)" },
  // Last Sun
  taisei: { glyph: '大聖', why: "the Great Sage's title, as his cannon's name has it" },
  ouga: { glyph: '覇', why: "Ouga's crown: the sovereign" },
  gohaku: { glyph: '猿', why: 'the white ape' },
  wuming: { glyph: '無', why: 'Wuming, the nameless' },
  jinlin: { glyph: '鱗', why: "the dragon's scale" },
  banjaku: { glyph: '石', why: 'the stone guardian' },
  shanxiao: { glyph: '山', why: "Shanxiao's name, 山魈: the mountain spirit (its second character is not in the seal's brush font) (round 6)" },
  // Konta
  konta: { glyph: '狐', why: "Konta's fox spirit, HOMURA" },
  shiden: { glyph: '霆', why: 'the thunderclap of his seal' },
  akagane: { glyph: '銅', why: "Akagane's red copper" },
  tobari: { glyph: '鴉', why: 'the ash crow' },
  shirokane: { glyph: '案山子', colour: '#5b95ad', why: "the scarecrow, Shirokane's own" },
  minase: { glyph: '駅', why: 'Minase\'s card kanji (round 6)' },
  aquilo: { glyph: '燕', why: "Aquilo's shop-card glyph (round 6)" },
  suzuran: { glyph: '鈴', why: "Suzuran's bells (her shop card's)" },
  kusushi: { glyph: '賽', why: 'Kusushi\'s card kanji (round 6)' },
  hakushi: { glyph: '獅', why: 'Hakushi\'s card kanji (round 6)' },
  amagoi: { glyph: '雨', why: 'Amagoi\'s card kanji (round 6)' },
  ume: { glyph: '拳', why: 'Ume\'s card kanji (round 6)' },
  madake: { glyph: '竹', why: 'Madake\'s card kanji (round 6)' },
  // Dust Sea
  gummy: { glyph: '潮', why: "Lucy's tides" },
  kenzo: { glyph: '牙', why: 'the fang of his twin blades' },
  kosho: { glyph: '胡椒', why: "Kosho's name: pepper" },
  sorayomi: { glyph: '嵐', why: 'Sorayomi\'s card kanji (round 6)' },
  kagari: { glyph: '篝', why: "Kagari's name: the watch-fire" },
  ward: { glyph: '病棟', why: "the ward he is named for" },
  haldor: { glyph: '地', colour: '#55788f', why: 'the seabed that rolls under him' },
  gorai: { glyph: '雷', why: 'the thunderhead' },
  sorrel: { glyph: '紅', why: 'the crimson wake' },
  dorado: { glyph: '陽', why: 'the sun on the far horizon' },
  strix: { glyph: '梟', why: 'Strix\'s card kanji (round 6)' },
  basilissa: { glyph: '薔', why: 'Basilissa\'s card kanji (round 6)' },
  shakugo: { glyph: '刑', why: 'Shakugo\'s card kanji (round 6)' },
  senko: { glyph: '輝', why: 'Senko\'s card kanji (round 6)' },
  tokan: { glyph: '霜', why: 'Tokan\'s card kanji (round 6)' },
  oyashio: { glyph: '潮', why: 'Oyashio\'s card kanji (round 6)' },
  adad: { glyph: '閃', why: 'Adad\'s card kanji (round 6)' },
  buna: { glyph: '樹', why: "Buna's Old Growth (her shop card's; her name's beech, 橅, is not in the seal's brush font)" },
  barrow: { glyph: '泥', why: 'Barrow\'s card kanji (round 6)' },
  strappado: { glyph: '幕', why: 'Strappado\'s card kanji (round 6)' },
  psyche: { glyph: '蛾', why: 'Psyche\'s card kanji (round 6)' },
  // Cinder Requiem
  nigo: { glyph: '灰', why: 'the ash of the Cinder Reaper' },
  shiun: { glyph: '紫', why: "Shiun's violet" },
  shidare: { glyph: '綻', why: 'Shidare\'s card kanji (round 6)' },
  onigawara: { glyph: '猪', why: 'Onigawara\'s card kanji (round 6)' },
  cardo: { glyph: '薊', why: "Cardo's shop-card glyph (round 6)" },
  hinomoto: { glyph: '熾', why: 'Hinomoto\'s card kanji (round 6)' },
  shijima: { glyph: '寂', why: 'Shijima\'s card kanji (round 6)' },
  mikage: { glyph: '猫', why: 'Mikage\'s card kanji (round 6)' },
  irbis: { glyph: '牙', why: 'Irbis\'s card kanji (round 6)' },
  // Hex Fallout
  kuon: { glyph: '久遠', why: "Kuon's name: eternity" },
  magatsu: { glyph: '禍', why: 'the calamity' },
  tempo: { glyph: '拍', why: "Tempo's shop-card glyph (round 6)" },
  akaito: { glyph: '誓', why: "Akaito's shop-card glyph (round 6)" },
  sashigane: { glyph: '矩', why: "Sashigane's shop-card glyph (round 6)" },
  // Black Snow
  asahi: { glyph: '旭', why: 'the first light' },
  sekka: { glyph: '雪', why: 'the black snow' },
  // Gilded Ruin
  koko: { glyph: '鉄', why: 'the iron of his barrage, struck like a hammer on iron' },
  oro: { glyph: '刻', why: 'the hour, and its stroke' },
  gosu: { glyph: '繕', why: "Gosu's shop-card glyph (round 6)" },
  kinu: { glyph: '縫', why: "Kinu's shop-card glyph (round 6)" },
  // Salvage Wilds
  gaku: { glyph: '獅', why: "the lion-dog's" },
  setsu: { glyph: '雪', why: "Setsu's snow" },
  unari: { glyph: '凧', why: "Unari's kites (his shop card's)" },
  imago: { glyph: '蟲', why: 'the swarm' },
  bonsho: { glyph: '鐘', why: "Bonsho's shop-card glyph (round 6)" },
  // Grave Hound
  gaunt: { glyph: '犬', why: "the ash hound's" },
  vesper: { glyph: '鴉', colour: '#5d6c9a', why: 'the raven feathers of his mantle' },
  // Blast Radius
  ippon: { glyph: '一本', why: "Ippon's own name: one point, one punch" },
  hagure: { glyph: '野', why: "Hagure's shop-card glyph (round 6)" },
  torsion: { glyph: '捻', why: "Torsion's shop-card glyph (round 6)" },
  // Ropewalk
  levin: { glyph: '掃', why: "Levin's sweep (his shop card's)" },
  hawser: { glyph: '綱', why: 'Hawser\'s name and card: the rope' },
  mizuhiki: { glyph: '縄', why: "Mizuhiki's shop-card glyph (round 6)" },
  // Gatefall, Scrap Pact, Beacon Ward
  rook: { glyph: '墓', why: 'the grave' },
  kuzu: { glyph: '錆', why: "Kuzu's shop-card glyph (round 6)" },
  kubiwa: { glyph: '輪', why: 'Kubiwa\'s name: the collar\'s ring' },
  ampere: { glyph: '電', why: "Ampere's shop-card glyph (round 6)" },
  pyroclast: { glyph: '噴', why: "Pyroclast's shop-card glyph (round 6)" },
  'full-beam': { glyph: '灯', why: "Full Beam's shop-card glyph (round 6)" },
  tancho: { glyph: '鶴', why: "Tancho's shop-card glyph (round 6)" },
  bellows: { glyph: '炉', why: "Bellows's shop-card glyph (round 6)" },
  // Lantern Ward, Ghost Wake, Penance Road, Slag Hill
  wataame: { glyph: '綿', why: "Wataame's name: cotton candy" },
  bruin: { glyph: '熊', why: "Bruin's shop-card glyph (round 6)" },
  hikui: { glyph: '焔', why: "Hikui's shop-card glyph (round 6)" },
  lanthorn: { glyph: '酒', why: "Lanthorn's shop-card glyph (round 6)" },
  highsun: { glyph: '午', why: "Highsun's shop-card glyph (round 6)" },
  shakudo: { glyph: '赤銅', why: "Shakudo's name: red copper" },
  shibuichi: { glyph: '鋳', why: "Shibuichi's shop-card glyph (round 6)" },
  // Quiet Hunger, Crimson Ledger, Red Cradle, Carcass Coast
  rakucho: { glyph: '頁', why: 'Rakucho\'s card: the page torn out' },
  hisame: { glyph: '氷雨', why: "Hisame's name: ice rain" },
  svanhild: { glyph: '鵠', why: "Svanhild's shop-card glyph (round 6)" },
  akayuri: { glyph: '百合', why: "Akayuri's name: the red lily on her sleeve (round 6)" },
  murex: { glyph: '棘', why: "Murex's shop-card glyph (round 6)" },
  rotfalke: { glyph: '隼', why: "Rotfalke's shop-card glyph (round 6)" },
  ovid: { glyph: '砕', why: "Ovid's shop-card glyph (round 6)" },
};
applyPixelEmblems(EMBLEMS as Record<FighterId, Emblem>);

/** A seal's characters (the empty string for a drawn symbol). */
export const emblemText = (e: Emblem) => 'glyph' in e ? e.glyph : '';
