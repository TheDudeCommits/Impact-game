
export interface Unlock { price?: number; level?: number }

export const BANDS = {
  fighterCrown: 1200, fighterFirst: 1000,
  /** The second ("Also strong": Wuming, Vesper, Imago, Jirenga, Emperor Jinlin). */
  fighterSecond: 800,
  /** The third (the rest of VOL.2, and since 28 October 2026 every fighter past VOL.1's sixteen and the ranks). */
  fighterThird: 600,
} as const;

export const UNLOCKS: Readonly<Record<string, Unlock>> = {
  'fighter-dorado': { price: BANDS.fighterCrown },
  'fighter-magatsu': { price: BANDS.fighterFirst }, 'fighter-akagane': { price: BANDS.fighterFirst }, 'fighter-shiun': { price: BANDS.fighterFirst },
  'fighter-gorai': { price: BANDS.fighterFirst }, 'fighter-haldor': { price: BANDS.fighterFirst },
  'fighter-wuming': { price: BANDS.fighterSecond }, 'fighter-imago': { price: BANDS.fighterSecond }, 'fighter-jirenga': { price: BANDS.fighterSecond },
  'fighter-jinlin': { price: BANDS.fighterSecond }, 'fighter-vesper': { price: BANDS.fighterSecond, level: 40 },
  'fighter-tobari': { price: BANDS.fighterThird }, 'fighter-sorrel': { price: BANDS.fighterThird }, 'fighter-gohaku': { price: BANDS.fighterThird },
  'fighter-asahi': { price: BANDS.fighterThird, level: 5 }, 'fighter-levin': { price: BANDS.fighterThird, level: 10 },
  'fighter-gaku': { price: BANDS.fighterThird, level: 16 }, 'fighter-rook': { price: BANDS.fighterThird, level: 22 },
  'fighter-ippon': { price: BANDS.fighterThird, level: 30 }, 'fighter-sekka': { price: BANDS.fighterThird, level: 50 },
  'fighter-strix': { price: BANDS.fighterThird }, 'fighter-sorayomi': { price: BANDS.fighterThird }, 'fighter-basilissa': { price: BANDS.fighterThird },
  'fighter-kuzu': { price: BANDS.fighterThird }, 'fighter-shakugo': { price: BANDS.fighterThird }, 'fighter-shanxiao': { price: BANDS.fighterThird },
  'fighter-ampere': { price: BANDS.fighterThird }, 'fighter-pyroclast': { price: BANDS.fighterThird }, 'fighter-full-beam': { price: BANDS.fighterThird },
  'fighter-tancho': { price: BANDS.fighterThird }, 'fighter-bellows': { price: BANDS.fighterThird }, 'fighter-akaito': { price: BANDS.fighterThird },
  'fighter-mikage': { price: BANDS.fighterThird }, 'fighter-tempo': { price: BANDS.fighterThird }, 'fighter-shijima': { price: BANDS.fighterThird },
  'fighter-senko': { price: BANDS.fighterThird }, 'fighter-adad': { price: BANDS.fighterThird }, 'fighter-buna': { price: BANDS.fighterThird },
  'fighter-oyashio': { price: BANDS.fighterThird }, 'fighter-suzuran': { price: BANDS.fighterThird }, 'fighter-wataame': { price: BANDS.fighterThird },
  'fighter-kusushi': { price: BANDS.fighterThird }, 'fighter-sashigane': { price: BANDS.fighterThird }, 'fighter-gosu': { price: BANDS.fighterThird },
  'fighter-hakushi': { price: BANDS.fighterThird }, 'fighter-barrow': { price: BANDS.fighterThird }, 'fighter-unari': { price: BANDS.fighterThird },
  'fighter-strappado': { price: BANDS.fighterThird }, 'fighter-tokan': { price: BANDS.fighterThird }, 'fighter-hikui': { price: BANDS.fighterThird },
  'fighter-ume': { price: BANDS.fighterThird }, 'fighter-lanthorn': { price: BANDS.fighterThird }, 'fighter-highsun': { price: BANDS.fighterThird },
  'fighter-torsion': { price: BANDS.fighterThird }, 'fighter-kubiwa': { price: BANDS.fighterThird }, 'fighter-onigawara': { price: BANDS.fighterThird },
  'fighter-minase': { price: BANDS.fighterThird }, 'fighter-shakudo': { price: BANDS.fighterThird }, 'fighter-amagoi': { price: BANDS.fighterThird },
  'fighter-hinomoto': { price: BANDS.fighterThird }, 'fighter-shidare': { price: BANDS.fighterThird }, 'fighter-irbis': { price: BANDS.fighterThird },
  'fighter-shibuichi': { price: BANDS.fighterThird }, 'fighter-rakucho': { price: BANDS.fighterThird }, 'fighter-hisame': { price: BANDS.fighterThird },
  'fighter-mizuhiki': { price: BANDS.fighterThird }, 'fighter-bonsho': { price: BANDS.fighterThird }, 'fighter-akayuri': { price: BANDS.fighterThird },
  'fighter-madake': { price: BANDS.fighterThird }, 'fighter-psyche': { price: BANDS.fighterThird }, 'fighter-rotfalke': { price: BANDS.fighterThird },
  'fighter-kinu': { price: BANDS.fighterThird }, 'fighter-hawser': { price: BANDS.fighterThird }, 'fighter-murex': { price: BANDS.fighterThird },
  'fighter-hagure': { price: BANDS.fighterThird }, 'fighter-ovid': { price: BANDS.fighterThird }, 'fighter-yodaka': { price: BANDS.fighterThird },
  'fighter-tsubute': { price: BANDS.fighterThird }, 'fighter-aqrab': { price: BANDS.fighterThird }, 'fighter-chohan': { price: BANDS.fighterThird },
  'fighter-cardo': { price: BANDS.fighterThird }, 'fighter-bruin': { price: BANDS.fighterThird }, 'fighter-aquilo': { price: BANDS.fighterThird },
  'fighter-svanhild': { price: BANDS.fighterThird },
  // ---- Outfits: the fighters' forms and costumes, seen by everyone in every mode (an outfit is the body). A hair
  // and aura on the fighter's own body 300-900, a costume of its own 500-1,000.
  'outfit-taisei-golden-sage': { price: 300, level: 3 }, 'outfit-ouga-golden-pride': { price: 300, level: 7 },
  'outfit-taisei-ember-mane': { price: 400 }, 'outfit-ouga-crimson-crown': { price: 400 },
  'outfit-taisei-azure-sage': { price: 600, level: 18 }, 'outfit-ouga-azure-pride': { price: 600 },
  'outfit-taisei-silver-mane': { price: 900 }, 'outfit-ouga-violet-wrath': { price: 900, level: 32 },
  'outfit-gummy-daybreak': { price: 1000 }, 'outfit-gummy-mirage': { price: 800, level: 52 },
  'outfit-gummy-black-flag': { price: 600 }, 'outfit-gummy-deckhand': { price: 600, level: 12 },
  'outfit-kenzo-night-raider': { price: 600, level: 26 }, 'outfit-kenzo-oasis-dandy': { price: 600 },
  'outfit-kosho-sommelier': { price: 600 }, 'outfit-kagari-dune-walker': { price: 500, level: 42 },
  'outfit-ward-night-shift': { price: 600 }, 'outfit-ward-house-call': { price: 600, level: 36 },
  'outfit-oro-ascendant': { price: 700 }, 'outfit-setsu-live-wire': { price: 500, level: 48 },
  'outfit-barrow-classic': { price: 800 },
  'aura-azure-flame': { level: 2 }, 'aura-thunder-coil': { price: 500 }, 'aura-black-sun': { price: 900 }, 'aura-hundred-seals': { level: 60 },
  'skin-sumi-e': { level: 6 }, 'skin-spectral': { level: 20 }, 'skin-negative': { price: 400 }, 'skin-blood-moon': { level: 38 }, 'skin-gold-leaf': { level: 58 },
  'trail-afterimage': { level: 8 },
  'kill-cranes': { level: 14 }, 'kill-screentone': { level: 28 }, 'kill-seal': { level: 44 }, 'kill-kintsugi': { level: 55 },
  'banner-taiko': { level: 34 },
  'emote-don': { level: 4 }, 'emote-menacing': { level: 24 }, 'emote-speed-lines': { level: 46 },
  // ---- The ball modes' gear: Goal Rush and Sky Spike only, by Sumi alone - a ball skin a
  // few matches, a goal burst about a week of a regular's play. Hidden on Player Two while the modes are (LAUNCH.ballModes).
  'ball-vermilion': { price: 300 }, 'ball-night-ink': { price: 300 }, 'ball-indigo': { price: 300 }, 'ball-jade': { price: 500 }, 'ball-gold-leaf': { price: 600 },
  'balltrail-brush': { price: 400 }, 'balltrail-embers': { price: 400 }, 'balltrail-petals': { price: 600 }, 'balltrail-gold-thread': { price: 700 },
  'goalburst-ink-bomb': { price: 500 }, 'goalburst-paper-storm': { price: 500 }, 'goalburst-cranes': { price: 700 }, 'goalburst-thunder': { price: 700 },
  'celebration-spin': { price: 300 }, 'celebration-stand-tall': { price: 300 }, 'celebration-showboat': { price: 500 },
};

/** The road's items by level, lowest first. */
export const ROAD: readonly { level: number; id: string }[] = Object.entries(UNLOCKS)
  .flatMap(([id, how]) => how.level !== undefined ? [{ level: how.level, id }] : [])
  .sort((a, b) => a.level - b.level);
const ROAD_LEVEL = new Map(ROAD.map(step => [step.id, step.level] as const));

/** The road level an item is free at, if it is one of the road's. */
export const roadLevel = (id: string) => ROAD_LEVEL.get(id);
/** Whether the road has given item `id` to an account at `level` (its account level, earn.ts levelOf). */
export const onRoadAt = (level: number, id: string) => { const at = ROAD_LEVEL.get(id); return at !== undefined && level >= at; };
/** The road's rewards reached going from level `from` to `to` (a match that crossed levels). */
export const reachedOnRoad = (from: number, to: number) => ROAD.filter(step => step.level > from && step.level <= to);

/** What a regular player is (tests/pace.ts plays one through the rules): online every day, about fifty minutes - six
 *  server-hosted matches, played to a middling finish. A casual player plays three. */
export const REGULAR_DAY = 6, CASUAL_DAY = 3;
/** What a regular player's match brings, on average, with the day's missions and first-match bonus shared over the
 *  day's six (tests/shopPace.test.ts keeps it within a sixth of what tests/pace.ts measures): the shop's "about N
 *  matches" for a goal. */
export const PER_MATCH = { sumi: 85, xp: 40 } as const;
/** What the pace promises a regular player (tests/shopPace.test.ts holds the rules to it). */
export const PACE = {
  /** The road's first fighter, in days of play. */
  firstFighter: 3,
  /** The longest wait between two of the road's rewards, in days, up to the end of the road. */
  roadGap: 4,
  /** Days of a regular player's Sumi that buy any one fighter, at most (Dorado, the dearest). */
  fighterDays: 6,
} as const;
