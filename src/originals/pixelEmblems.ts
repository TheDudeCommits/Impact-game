import type { FighterId } from '../game/types';

export const PIXEL_EMBLEMS: Partial<Record<FighterId, { glyph: string; why: string }>> = {
  konta: { glyph: '狐', why: "Konta's fox spirit, HOMURA" },
  gummy: { glyph: '潮', why: "Lucy's tides" },
  kosho: { glyph: '胡椒', why: "Kosho's name: pepper" },
  ouga: { glyph: '覇', why: "Ouga's Haou: the sovereign" },
  kagari: { glyph: '篝', why: "Kagari's name: the watch-fire" },
  kuon: { glyph: '久遠', why: "Kuon's name: eternity" },
  setsu: { glyph: '雪', why: "Setsu's snow" },
  levin: { glyph: '掃', why: "Levin's sweep (his shop card's)" },
  hisame: { glyph: '氷雨', why: "Hisame's name: ice rain" },
  suzuran: { glyph: '鈴', why: "Suzuran's bells (her shop card's)" },
  unari: { glyph: '凧', why: "Unari's kites (his shop card's)" },
  buna: { glyph: '樹', why: "Buna's Old Growth (her shop card's; her name's beech, 橅, is not in the seal's brush font)" },
  tsubute: { glyph: '礫', why: "Tsubute's name: a thrown stone (his shop card's)" },
  'shakudo': { glyph: '赤銅', why: "Shakudo's name: red copper" },
  wataame: { glyph: '綿', why: "Wataame's name: cotton candy" },
  hawser: { glyph: '綱', why: 'Hawser\'s name and card: the rope' },
  'rakucho': { glyph: '頁', why: 'Rakucho\'s card: the page torn out' },
  kubiwa: { glyph: '輪', why: 'Kubiwa\'s name: the collar\'s ring' },
};

/** src/render/area/emblems.ts EMBLEMS: each Pixel character's own in its slot's place (the seal's ink stays the card's colour). */
export function applyPixelEmblems<E>(emblems: Record<string, E>) {
  for (const [id, emblem] of Object.entries(PIXEL_EMBLEMS)) emblems[id] = emblem as unknown as E;
  return emblems;
}
