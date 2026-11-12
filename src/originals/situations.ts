
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

export function applyOriginalSituations(lines: Table) {
  if (!ORIGINAL_SITUATIONS_ON) return lines;
  for (const kinds of Object.values(lines)) {
    if (!kinds) continue;
    for (const [kind, list] of Object.entries(kinds)) {
      const own = (list ?? []).filter(line => !line.startsWith('rift:'));
      if (own.length) kinds[kind] = own; else delete kinds[kind];
    }
  }
  for (const [fighter, kinds] of Object.entries(QUALITY_LINES)) {
    const row = (lines[fighter] ??= {});
    for (const [kind, cues] of Object.entries(kinds)) row[kind] = [...new Set([...(row[kind] ?? []), ...cues])];
  }
  return lines;
}
