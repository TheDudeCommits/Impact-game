import type { FighterId } from '../game/types';

// (Kuzu's stance and run are his previous ones again: with the clean sprint the renderer lifted his Rush 2 24 cm off the
// floor. Gaku's never-shown stance is his previous one again: measured off the clean one at this size, his knockdown popped
// the head 8 cm. Both bodies measure as they always did.)
const BASE: Partial<Record<FighterId, number>> = {
  kagari: 1.20228,            // Kagari
  'full-beam': 1.05393,    // Full Beam
  tokan: 1.00746,         // Tokan
  aqrab: 1.00866,      // Aqrab
  bellows: 1.03871,       // Bellows
  wataame: 0.99054,        // Wataame
  'gohaku': 1.05527,  // Tongbi (Gohaku)
  kuon: 0.99997,           // Kuon
  'wuming': 1.06904,   // Wuming
  'jinlin': 1.00227, // Emperor Jinlin
  // fix-polish2 (5 November): measured off the stances the clean set replaced, on originals/next (2fbab2443).
  // (aaa-b, 6 November: Shakugo stands in Shakugo's own stance again, flat on his feet: measured off it, so he stands Shakugo's
  // 2.3 m as Impact's same slot does - 0.96236, held from the stance before, stood him 2.17 m.)
  shakugo: 1.02132,         // Shakugo
  pyroclast: 1.04746,         // Pyroclast
  shanxiao: 1.03028,          // Shanxiao
  tancho: 1.02723,
  shiun: 0.99268,          // Shiun
  'shibuichi': 1.01505, // Shibuichi
  rotfalke: 1.03545,          // Rotfalke
  strappado: 1.09027,     // Strappado
  taisei: 0.9821,            // Taisei
  unari: 1.02525,         // Unari
  nigo: 0.9844,          // Nigo
  shirokane: 1.03138,        // Shirokane
  // (Onigawara, flat on his heels now instead of on tiptoe: measured off that stance, so he stands Onigawara's 2.28 m as Impact's
  // same slot does, the roster's giant - the live scale, 0.96392, would have stood him 2.18 m. The lead, 6 November.)
  onigawara: 1.00811,       // Onigawara
  senko: 1.00441,         // Senko
  levin: 1.04704,           // Levin
  lanthorn: 1.00788,       // Lanthorn
  strix: 1.04264,         // Strix
  'madake': 1.00795,    // Madake
  sashigane: 1.00342,         // Sashigane
  'psyche': 1.00158,   // Psyche
  svanhild: 1.01699,         // Svanhild
  shijima: 0.99595,          // Shijima
  ume: 1.0925,          // Ume
  murex: 1.06636,         // Murex
  magatsu: 1.05377,         // Magatsu
  ouga: 1.05318,         // Ouga
  tempo: 1.02096,           // Tempo
  // (Rook, flat on his feet now: no row - measured, he stands Rook's 1.82 m; his live scale, 1.00022, would stand him
  // 1.78 m, 2% short of Impact's same slot.)
  // aaa-b3 (6 November): Tobari's ready stance is Tobari's own again (the clean boxer's guard held his hands over his face): held
  // at the scale the live body measured off the clean one (measured off Tobari's own he would be drawn 4.5% smaller, 1.01115).
  tobari: 1.05848,         // Tobari
  // (Shiden's ready stance is Shiden's own again, the katana held as Shiden holds it: held at the live scale the same way;
  // measured off Shiden's own he would be drawn 3.9% smaller, 1.04739.)
  shiden: 1.09043,         // Shiden
  // aaa-a (6 November, the lead's rule): the bodies whose head, hands and feet aaa-a framed from each rig's own rest
  // (status/aaa-a.md) are fixes, and a fix keeps the size a fighter is drawn at. r1_probe's rest height (the body drawn in its
  // file's rest pose at the scale Fighter gives it) framed with no row, against the same before tonight's fixes (release 33,
  // 399a77978): under 1% apart, no row; further apart, the scale before (the rows below) - unless the framing stood the body
  // flat on heels it had lifted and that size is closer to Impact's same slot (Gorai +10.5%, Jirenga +6.2%, Haldor +3.8%,
  // Bruin +1.6%, Hakushi +1.4%, Kosho +1.2%, Kuzu +1.1%, Gosu +1.0%: each change is the stance's heels coming down, by 1.5 to
  // 33 cm). Buna stands her own 2.0 m (no row).
  akayuri: 1.02934,          // Akayuri (framed +1.4%: her head)
  cardo: 1.34472,           // Cardo (+2.8%: his heels, further from Impact's Cardo)
  hawser: 1.03515,           // Hawser (+1.1%: his head)
  hisame: 1.00007,        // Hisame (+3.4%: her heels, further from Impact's Hisame)
  hikui: 1.04192,           // Hikui (+2.3%: his heels, further from Impact's Hikui)
  kinu: 1.02443,         // Kinu (-2.2%: her head)
  imago: 1.13122,         // Imago (+3.8%: his head)
  ampere: 1.02032,           // Ampere (aaa-a2, framed: -1.6%, his stance's hips rose 2.8 cm off its soles - not a lifted heel set down)
  // Basilissa stands: her scale is the one her old seated stance had, so she stands at her own size.
  basilissa: 0.83487,       // Basilissa (about 1.85 m on foot)
  // Gorai's stance is his clean idle, held at the scale his old one gave him, so he is drawn at his own size.
  gorai: 1.02973,           // Gorai
};
/** The awakened bodies whose own stance was swapped. */
const FORM: Partial<Record<FighterId, number>> = {
  shiun: 0.93778,          // Shiun's awakened body
  'jinlin': 1.01172, // Emperor Jinlin's
  // fix-polish2 (5 November): as above.
  shanxiao: 1.05604,          // Shanxiao's awakened body
  ampere: 1.01302,           // Ampere's
  // aaa-a2 (6 November): awakened bodies whose head and feet were framed, held at the size before (the same rule as above).
  hikui: 1.0419,            // Hikui's (framed +2.3%: his heels, further from Impact's Hikui)
  gorai: 1.27096,          // Gorai's (framed +4.0%: neither near Impact's hybrid Gorai, 34% shorter)
};

/** The model scale Fighter gives the original's own body (not a worn outfit, not a companion), or undefined to measure it. */
export function stanceSize(state: { id?: string; fighter: FighterId }, form: boolean) {
  if (state.id?.endsWith('-spirit')) return undefined;
  return (form ? FORM : BASE)[state.fighter];
}
