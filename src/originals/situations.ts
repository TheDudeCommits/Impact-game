
type Table = Partial<Record<string, Partial<Record<string, readonly string[]>>>>;

export const ORIGINAL_SITUATIONS_ON = (globalThis as { __IMPACT_BASE_VOICE__?: boolean }).__IMPACT_BASE_VOICE__ !== true;

/** fighter -> kind -> the new lines (cues of src/originals/voices.json). */
export const QUALITY_LINES: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>> = {
  shiun: { 'hurt-heavy': ['vo-shiun-thrown-a'], ko: ['vo-shiun-ko-a'] },          // Shiun: a cry; "...So this is the final barline."
  shakugo: { ko: ['vo-shakugo-ko-a'] },                                             // Shakugo: "I... am the one judged...?!"
  vesper: { bell: ['vo-vesper-bell-a'], taunt: ['vo-vesper-taunt-a'], loss: ['vo-vesper-loss-a'] },   // Vesper: the evening bell, the wings, the crown
  banjaku: { 'hurt-heavy': ['vo-banjaku-thrown-a'], ko: ['vo-banjaku-ko-a'] },          // Banjaku: a cry; "...So the gate crumbles."
  onigawara: { 'hurt-heavy': ['vo-onigawara-thrown-a'], ko: ['vo-onigawara-ko-a'] }, // Onigawara: a roar; "Heh... that was a good fight..."
  akagane: { ko: ['vo-akagane-ko-a'] },                                             // Akagane: "So it is I who returns to the earth..."
  imago: { loss: ['vo-imago-loss-a'] },                                         // Imago: "The board, overturned. I shall learn."
  tokan: { hurt: ['vo-tokan-hurt-a'], ko: ['vo-tokan-ko-a'] },                 // Tokan: "Ow..."; "...Yawn... guess I'll take a nap here..."
  senko: { loss: ['vo-senko-loss-a'] },                                         // Senko: "Well now... somebody faster than light, after all..."
  gorai: { ko: ['vo-gorai-ko-a'] },
  kuzu: { hurt: ['vo-kuzu-hurt-a', 'vo-kuzu-hurt-b'] },                       // Kuzu: a yelp, "ow!"
  bonsho: { hurt: ['vo-bonsho-hurt-a', 'vo-bonsho-hurt-b'], ko: ['vo-bonsho-ko-a'], taunt: ['vo-bonsho-taunt-a'] },   // Bonsho: "The bell... is fading..."; "the bell hasn't stopped ringing yet"
  gosu: { hurt: ['vo-gosu-hurt-a', 'vo-gosu-hurt-b'] },                     // Gosu
  'shibuichi': { hurt: ['vo-shibuichi-hurt-a', 'vo-shibuichi-hurt-b'], ko: ['vo-shibuichi-ko-a'], kill: ['vo-shibuichi-kill-a'],
    taunt: ['vo-shibuichi-taunt-a'], loss: ['vo-shibuichi-loss-a'] },  // Shibuichi: "still things I want to mend"; "I'll fix you up later"; "I'm bad at breaking things"; "forged over too"
  cardo: { hurt: ['vo-cardo-hurt-a', 'vo-cardo-hurt-b'] },                           // Cardo
  shanxiao: { taunt: ['vo-shanxiao-taunt-a'], loss: ['vo-shanxiao-loss-a'] },              // Shanxiao: "you can't hide the sun"; "the sun... is setting"
  ampere: { loss: ['vo-ampere-loss-a'] },                                             // Ampere: "my wiring was still sloppy... next time I'll light it"
  highsun: { hurt: ['vo-highsun-hurt-a', 'vo-highsun-hurt-b'], ko: ['vo-highsun-ko-a'], bell: ['vo-highsun-bell-a'], taunt: ['vo-highsun-taunt-a'],
    loss: ['vo-highsun-loss-a'] },                                                // Highsun: "Sunset... I shall rise tomorrow"; "while the sun is high"; "too bright?"; "clouds, then"
  oyashio: { win: ['vo-oyashio-win-a'], loss: ['vo-oyashio-loss-a'] },                  // Oyashio: "I'll ride the tide home"; "beaten by the tide"
  lanthorn: { hurt: ['vo-lanthorn-hurt-a', 'vo-lanthorn-hurt-b'], ko: ['vo-lanthorn-ko-a'], taunt: ['vo-lanthorn-taunt-a'], loss: ['vo-lanthorn-loss-a'] },   // Lanthorn: "closing early tonight"; "drunk after the first glass?"; "drinks are on me"
  hakushi: { hurt: ['vo-hakushi-hurt-a', 'vo-hakushi-hurt-b'], ko: ['vo-hakushi-ko-a'], taunt: ['vo-hakushi-taunt-a'], loss: ['vo-hakushi-loss-a'] },   // Hakushi: "today's lesson ends here"; "catch the lion by the tail"; "it'll feed the brush"
  kinu: { hurt: ['vo-kinu-hurt-a', 'vo-kinu-hurt-b'], ko: ['vo-kinu-ko-a'], win: ['vo-kinu-win-a'], loss: ['vo-kinu-loss-a'] },   // Kinu: "the thread snapped"; "that knot won't come undone"; "my stitches were loose"
  'ovid': { hurt: ['vo-ovid-hurt-a', 'vo-ovid-hurt-b'], ko: ['vo-ovid-ko-a'], taunt: ['vo-ovid-taunt-a'], win: ['vo-ovid-win-a'],
    loss: ['vo-ovid-loss-a'] },                                             // Ovid: "no more overtime"; "don't get in the way of the cleanup"; "site cleared"; "a rough job for an old guy"
  'madake': { hurt: ['vo-madake-hurt-a', 'vo-madake-hurt-b'], ko: ['vo-madake-ko-a'], win: ['vo-madake-win-a'] },   // Madake: "bamboo, even broken, grows back"; "see the bamboo's grit!"
  minase: { hurt: ['vo-minase-hurt-a', 'vo-minase-hurt-b'], ko: ['vo-minase-ko-a'], bell: ['vo-minase-bell-a'], taunt: ['vo-minase-taunt-a'], loss: ['vo-minase-loss-a'] },   // Minase (was Kanata): "this delivery won't arrive"; "a delivery for you"; "I'm already at the next post station"; "a late delivery"
  mizuhiki: { hurt: ['vo-mizuhiki-hurt-a', 'vo-mizuhiki-hurt-b'], ko: ['vo-mizuhiki-ko-a'], loss: ['vo-mizuhiki-loss-a'] },   // Mizuhiki: "the line, I won't let go"; "I can still tie it again"
  sorayomi: { win: ['vo-sorayomi-win-a'] },                                               // Sorayomi: "clear skies, as forecast, and I'll collect my fee"
  amagoi: { hurt: ['vo-amagoi-hurt-a', 'vo-amagoi-hurt-b'] },                           // Amagoi
  murex: { hurt: ['vo-murex-hurt-a', 'vo-murex-hurt-b'], kill: ['vo-murex-kill-a'], bell: ['vo-murex-bell-a'], parry: ['vo-murex-parry-a'],
    taunt: ['vo-murex-taunt-a'], loss: ['vo-murex-loss-a'] },                   // Murex's pilot: "did I do that?"; "not shaking, I can do this"; "did it stop?"; "next time it really wakes up"; "I can't fight anymore"
  torsion: { hurt: ['vo-torsion-hurt-a', 'vo-torsion-hurt-b'], ko: ['vo-torsion-ko-a'], loss: ['vo-torsion-loss-a'] },   // Torsion: "no way... me?"; "I just wasn't in the mood"
  kusushi: { hurt: ['vo-kusushi-hurt-a', 'vo-kusushi-hurt-b'], loss: ['vo-kusushi-loss-a'] },   // Kusushi: "lost big... that's gambling"
  hinomoto: { hurt: ['vo-hinomoto-hurt-a', 'vo-hinomoto-hurt-b'], loss: ['vo-hinomoto-loss-a'] },   // Hinomoto: "back to ash, then: I shall blaze up again"
  bruin: { hurt: ['vo-bruin-hurt-a', 'vo-bruin-hurt-b'], loss: ['vo-bruin-loss-a'] },   // Bruin: "lost, lost... guess I'll hibernate"
  sashigane: { hurt: ['vo-sashigane-hurt-a', 'vo-sashigane-hurt-b'] },                     // Sashigane
};

/** Every released fighter cries out when hit, in their own cast voice: three hurt cries for each fighter that had none
 *  (SITUATION_RULES.hurt: under 0.9 s) and two heavy ones (a launch, a knockdown, a wall splat: under 1.7 s) for each
 *  that had no line of its own, at the existing cries' loudness, in the fighter's own preset and chain. Merged as
 *  QUALITY_LINES is (applyOriginalSituations). */
export const CRY_LINES: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>> = {
  kagari: { hurt: ['vo-kagari-hurt-a', 'vo-kagari-hurt-b', 'vo-kagari-hurt-c'], 'hurt-heavy': ['vo-kagari-hurt-heavy-a', 'vo-kagari-hurt-heavy-b'] },
  kuon: { 'hurt-heavy': ['vo-kuon-hurt-heavy-a', 'vo-kuon-hurt-heavy-b'] },
  gaunt: { hurt: ['vo-gaunt-hurt-a', 'vo-gaunt-hurt-b', 'vo-gaunt-hurt-c'], 'hurt-heavy': ['vo-gaunt-hurt-heavy-a', 'vo-gaunt-hurt-heavy-b'] },
  haldor: { 'hurt-heavy': ['vo-haldor-hurt-heavy-a', 'vo-haldor-hurt-heavy-b'] },
  sorrel: { 'hurt-heavy': ['vo-sorrel-hurt-heavy-a', 'vo-sorrel-hurt-heavy-b'] },
  dorado: { hurt: ['vo-dorado-hurt-a', 'vo-dorado-hurt-b', 'vo-dorado-hurt-c'], 'hurt-heavy': ['vo-dorado-hurt-heavy-a', 'vo-dorado-hurt-heavy-b'] },
  shiun: { hurt: ['vo-shiun-hurt-a', 'vo-shiun-hurt-b', 'vo-shiun-hurt-c'] },
  magatsu: { hurt: ['vo-magatsu-hurt-a', 'vo-magatsu-hurt-b', 'vo-magatsu-hurt-c'], 'hurt-heavy': ['vo-magatsu-hurt-heavy-a', 'vo-magatsu-hurt-heavy-b'] },
  vesper: { hurt: ['vo-vesper-hurt-a', 'vo-vesper-hurt-b', 'vo-vesper-hurt-c'] },
  banjaku: { hurt: ['vo-banjaku-hurt-a', 'vo-banjaku-hurt-b', 'vo-banjaku-hurt-c'] },
  ippon: { hurt: ['vo-ippon-hurt-a', 'vo-ippon-hurt-b', 'vo-ippon-hurt-c'], 'hurt-heavy': ['vo-ippon-hurt-heavy-a', 'vo-ippon-hurt-heavy-b'] },
  tobari: { hurt: ['vo-tobari-hurt-a', 'vo-tobari-hurt-b', 'vo-tobari-hurt-c'], 'hurt-heavy': ['vo-tobari-hurt-heavy-a', 'vo-tobari-hurt-heavy-b'] },
  akagane: { hurt: ['vo-akagane-hurt-a', 'vo-akagane-hurt-b', 'vo-akagane-hurt-c'], 'hurt-heavy': ['vo-akagane-hurt-heavy-a', 'vo-akagane-hurt-heavy-b'] },
  rook: { hurt: ['vo-rook-hurt-a', 'vo-rook-hurt-b', 'vo-rook-hurt-c'], 'hurt-heavy': ['vo-rook-hurt-heavy-a', 'vo-rook-hurt-heavy-b'] },
  gaku: { hurt: ['vo-gaku-hurt-a', 'vo-gaku-hurt-b', 'vo-gaku-hurt-c'], 'hurt-heavy': ['vo-gaku-hurt-heavy-a', 'vo-gaku-hurt-heavy-b'] },
  sorayomi: { 'hurt-heavy': ['vo-sorayomi-hurt-heavy-a', 'vo-sorayomi-hurt-heavy-b'] },
  basilissa: { 'hurt-heavy': ['vo-basilissa-hurt-heavy-a', 'vo-basilissa-hurt-heavy-b'] },
  kuzu: { 'hurt-heavy': ['vo-kuzu-hurt-heavy-a', 'vo-kuzu-hurt-heavy-b'] },
  shakugo: { hurt: ['vo-shakugo-hurt-a', 'vo-shakugo-hurt-b', 'vo-shakugo-hurt-c'], 'hurt-heavy': ['vo-shakugo-hurt-heavy-a', 'vo-shakugo-hurt-heavy-b'] },
  buna: { hurt: ['vo-buna-hurt-a', 'vo-buna-hurt-b', 'vo-buna-hurt-c'], 'hurt-heavy': ['vo-buna-hurt-heavy-a', 'vo-buna-hurt-heavy-b'] },
  suzuran: { hurt: ['vo-suzuran-hurt-a', 'vo-suzuran-hurt-b', 'vo-suzuran-hurt-c'], 'hurt-heavy': ['vo-suzuran-hurt-heavy-a', 'vo-suzuran-hurt-heavy-b'] },
  wataame: { hurt: ['vo-wataame-hurt-a', 'vo-wataame-hurt-b', 'vo-wataame-hurt-c'], 'hurt-heavy': ['vo-wataame-hurt-heavy-a', 'vo-wataame-hurt-heavy-b'] },
  kusushi: { 'hurt-heavy': ['vo-kusushi-hurt-heavy-a', 'vo-kusushi-hurt-heavy-b'] },
  sashigane: { 'hurt-heavy': ['vo-sashigane-hurt-heavy-a', 'vo-sashigane-hurt-heavy-b'] },
  gosu: { 'hurt-heavy': ['vo-gosu-hurt-heavy-a', 'vo-gosu-hurt-heavy-b'] },
  hakushi: { 'hurt-heavy': ['vo-hakushi-hurt-heavy-a', 'vo-hakushi-hurt-heavy-b'] },
  tokan: { 'hurt-heavy': ['vo-tokan-hurt-heavy-a', 'vo-tokan-hurt-heavy-b'] },
  ume: { hurt: ['vo-ume-hurt-a', 'vo-ume-hurt-b', 'vo-ume-hurt-c'], 'hurt-heavy': ['vo-ume-hurt-heavy-a', 'vo-ume-hurt-heavy-b'] },
  lanthorn: { 'hurt-heavy': ['vo-lanthorn-hurt-heavy-a', 'vo-lanthorn-hurt-heavy-b'] },
  highsun: { 'hurt-heavy': ['vo-highsun-hurt-heavy-a', 'vo-highsun-hurt-heavy-b'] },
  torsion: { 'hurt-heavy': ['vo-torsion-hurt-heavy-a', 'vo-torsion-hurt-heavy-b'] },
  kubiwa: { hurt: ['vo-kubiwa-hurt-a', 'vo-kubiwa-hurt-b', 'vo-kubiwa-hurt-c'], 'hurt-heavy': ['vo-kubiwa-hurt-heavy-a', 'vo-kubiwa-hurt-heavy-b'] },
  onigawara: { hurt: ['vo-onigawara-hurt-a', 'vo-onigawara-hurt-b', 'vo-onigawara-hurt-c'] },
  minase: { 'hurt-heavy': ['vo-minase-hurt-heavy-a', 'vo-minase-hurt-heavy-b'] },
  shakudo: { hurt: ['vo-shakudo-hurt-a', 'vo-shakudo-hurt-b', 'vo-shakudo-hurt-c'], 'hurt-heavy': ['vo-shakudo-hurt-heavy-a', 'vo-shakudo-hurt-heavy-b'] },
  amagoi: { 'hurt-heavy': ['vo-amagoi-hurt-heavy-a', 'vo-amagoi-hurt-heavy-b'] },
  hinomoto: { 'hurt-heavy': ['vo-hinomoto-hurt-heavy-a', 'vo-hinomoto-hurt-heavy-b'] },
  shidare: { hurt: ['vo-shidare-hurt-a', 'vo-shidare-hurt-b', 'vo-shidare-hurt-c'], 'hurt-heavy': ['vo-shidare-hurt-heavy-a', 'vo-shidare-hurt-heavy-b'] },
  irbis: { hurt: ['vo-irbis-hurt-a', 'vo-irbis-hurt-b', 'vo-irbis-hurt-c'], 'hurt-heavy': ['vo-irbis-hurt-heavy-a', 'vo-irbis-hurt-heavy-b'] },
  shibuichi: { 'hurt-heavy': ['vo-shibuichi-hurt-heavy-a', 'vo-shibuichi-hurt-heavy-b'] },
  rakucho: { hurt: ['vo-rakucho-hurt-a', 'vo-rakucho-hurt-b', 'vo-rakucho-hurt-c'], 'hurt-heavy': ['vo-rakucho-hurt-heavy-a', 'vo-rakucho-hurt-heavy-b'] },
  hisame: { hurt: ['vo-hisame-hurt-a', 'vo-hisame-hurt-b', 'vo-hisame-hurt-c'], 'hurt-heavy': ['vo-hisame-hurt-heavy-a', 'vo-hisame-hurt-heavy-b'] },
  mizuhiki: { 'hurt-heavy': ['vo-mizuhiki-hurt-heavy-a', 'vo-mizuhiki-hurt-heavy-b'] },
  bonsho: { 'hurt-heavy': ['vo-bonsho-hurt-heavy-a', 'vo-bonsho-hurt-heavy-b'] },
  akayuri: { hurt: ['vo-akayuri-hurt-a', 'vo-akayuri-hurt-b', 'vo-akayuri-hurt-c'], 'hurt-heavy': ['vo-akayuri-hurt-heavy-a', 'vo-akayuri-hurt-heavy-b'] },
  madake: { 'hurt-heavy': ['vo-madake-hurt-heavy-a', 'vo-madake-hurt-heavy-b'] },
  rotfalke: { hurt: ['vo-rotfalke-hurt-a', 'vo-rotfalke-hurt-b', 'vo-rotfalke-hurt-c'], 'hurt-heavy': ['vo-rotfalke-hurt-heavy-a', 'vo-rotfalke-hurt-heavy-b'] },
  kinu: { 'hurt-heavy': ['vo-kinu-hurt-heavy-a', 'vo-kinu-hurt-heavy-b'] },
  hawser: { hurt: ['vo-hawser-hurt-a', 'vo-hawser-hurt-b', 'vo-hawser-hurt-c'], 'hurt-heavy': ['vo-hawser-hurt-heavy-a', 'vo-hawser-hurt-heavy-b'] },
  murex: { 'hurt-heavy': ['vo-murex-hurt-heavy-a', 'vo-murex-hurt-heavy-b'] },
  ovid: { 'hurt-heavy': ['vo-ovid-hurt-heavy-a', 'vo-ovid-hurt-heavy-b'] },
  tsubute: { 'hurt-heavy': ['vo-tsubute-hurt-heavy-a', 'vo-tsubute-hurt-heavy-b'] },
  aqrab: { hurt: ['vo-aqrab-hurt-a', 'vo-aqrab-hurt-b', 'vo-aqrab-hurt-c'], 'hurt-heavy': ['vo-aqrab-hurt-heavy-a', 'vo-aqrab-hurt-heavy-b'] },
  aquilo: { hurt: ['vo-aquilo-hurt-a', 'vo-aquilo-hurt-b', 'vo-aquilo-hurt-c'], 'hurt-heavy': ['vo-aquilo-hurt-heavy-a', 'vo-aquilo-hurt-heavy-b'] },
  svanhild: { hurt: ['vo-svanhild-hurt-a', 'vo-svanhild-hurt-b', 'vo-svanhild-hurt-c'], 'hurt-heavy': ['vo-svanhild-hurt-heavy-a', 'vo-svanhild-hurt-heavy-b'] },
};

/** src/audio/voiceSituations.ts LINES, after main's cut lines are merged in and before anything reads it. */
export function applyOriginalSituations(lines: Table) {
  if (!ORIGINAL_SITUATIONS_ON) return lines;
  for (const kinds of Object.values(lines)) {
    if (!kinds) continue;
    for (const [kind, list] of Object.entries(kinds)) {
      const own = (list ?? []).filter(line => !line.startsWith('rift:'));
      if (own.length) kinds[kind] = own; else delete kinds[kind];
    }
  }
  for (const [fighter, kinds] of [...Object.entries(QUALITY_LINES), ...Object.entries(CRY_LINES)]) {
    const row = (lines[fighter] ??= {});
    for (const [kind, cues] of Object.entries(kinds)) row[kind] = [...new Set([...(row[kind] ?? []), ...cues])];
  }
  return lines;
}
