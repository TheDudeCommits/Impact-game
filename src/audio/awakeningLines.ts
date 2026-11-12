import { awakeningSwapAt } from '../game/awakening';
import type { FighterId } from '../game/types';
import type { AudioCue } from './cueTypes';

export interface AwakeningLine {
  /** The cut (voiceCues.ts; its provenance in public/assets/audio/v2/voice/manifest.json). */
  cue: AudioCue;
  /** The form it names, as the voice manifest's `plays` has it ('awaken: <form>'). */
  form: string;
  /** Seconds from the awaken event to the burst and the swap (awakeningSwapAt). */
  burst: number;
  /** Seconds from the awaken event to the line. */
  line: number;
  /** Seconds into the cut where its words start, measured on the cut as Taisei's and Ouga's are (10 ms frames within 25 dB of
   *  its loudest, after 50 ms below it). */
  words: readonly number[];
  /** Which of `words` says the form's name (or the moment's word), so it can be held to the entry. */
  named: number;
}

/** How long after the burst a line starts: as Taisei's and Ouga's (goldAwakeningTiming.ts), as the blast's tail falls away. */
export const AFTER_BURST = .26;

const after = (fighter: FighterId, cue: AudioCue, form: string, words: readonly number[], named: number, wait = AFTER_BURST): AwakeningLine => {
  const burst = awakeningSwapAt(fighter);
  return { cue, form, burst, line: Math.round((burst + wait) * 1000) / 1000, words, named };
};

export const AWAKENING_LINES: Partial<Record<FighterId, AwakeningLine>> = {
  // Cardo, Bruin, Aquilo and Svanhild (the voice pass): each one's own line as the magic comes over them.
  cardo: after('cardo', 'vo-cardo-surpass', 'OVERGROWN', [0], 0),
  bruin: after('bruin', 'vo-bruin-awaken', 'WIDE AWAKE', [0], 0),
  aquilo: after('aquilo', 'vo-aquilo-windborne', 'WINDBORNE', [0], 0),
  svanhild: after('svanhild', 'vo-svanhild-valkyrie', 'WHITE PLUMAGE', [0], 0),
  // Native resolve quote; STONE CROWN is a gameplay state.
  'full-beam': after('full-beam','vo-full-beam-embers','LAST WATCH',[.46],0,.15),
  pyroclast: after('pyroclast','vo-pyroclast-cluster-ready','Tephra Storm',[0],0,.06),
  ampere: after('ampere','vo-ampere-wrathful-guardian','LIGHTS ON',[0],0,.12),
  kuzu: after('kuzu','vo-kuzu-overdrive','OFF THE LEASH',[0],0),
  shakugo: after('shakugo','vo-shakugo-magma','NO QUARTER',[0],0),
  'basilissa': after('basilissa','vo-basilissa-empress','STONE CROWN',[0],0),
  // Her recorded weather-science line; gameplay mastery, not a form.
  sorayomi: after('sorayomi','vo-sorayomi-storm-eye','EYE OF THE STORM',[.01],0),
  // Recorded challenge: 'Surpass me.' Unblinking Focus is a gameplay focus state.
  strix: after('strix','vo-strix-surpass-me','Unblinking Focus',[0,.85],1),
  // Kenzo: "鬼面……羅刹ッ！" - "Oni mask... DUNE ONI!", his form by name.
  kenzo: after('kenzo', 'vo-kenzo-dune-oni', 'DUNE ONI', [0, .38, 1.22], 2),
  // Gummy: "にっひひ…サンライズ!" - a laugh, then "SUNRISE!", his form by name.
  gummy: after('gummy', 'vo-gummy-saiko-chiten', 'SUNRISE', [.02, 1.47, 1.96, 2.28], 2),
  // Shirokane: "出番だ、番人さん。" - "You're up, Warden", as his Guardian rises.
  shirokane: after('shirokane', 'vo-shirokane-pinwheel-eye', 'Guardian', [.03], 0),
  // LORD ORO: "時は満ちた……我が刻の始まりだァッ！" - "The time has come... my hour begins!", MIDNIGHT by name.
  oro: after('oro', 'vo-oro-my-hour-begins', 'MIDNIGHT', [.02, .7, 1.31, 1.87, 2.27], 1),
  // Setsu: "行くよ…刹那!" - "Here I go... SETSUNA!". A fifth of a second later than the rest: the lightning that runs
  // through him (sfxPlan.ts, fx-lightning) crests over the burst's tail, and the short call said on it led it by 13 dB in
  // the speech band; once it has crested, by 17.
  setsu: after('setsu', 'vo-setsu-denko-sekka', 'SETSUNA', [.01, .67], 0, AFTER_BURST + .2),
  // Gaku: "もう…笑えない。全部、石にしてやる…これが、狛犬だ。" - "No more laughing. I'll turn it all to stone... this is
  // KOMAINU."
  gaku: after('gaku', 'vo-gaku-arittake', 'KOMAINU', [.01, .58, 1.4, 1.88, 2.25, 2.82, 3.05, 3.82, 4.35], 7),
  // Ward: "手術室は、もう閉じた。" - "The surgery is closed now", as it closes round them both.
  ward: after('ward', 'vo-ward-nigerarenee', 'SCRUBBED IN', [.02], 0),
  // Kosho: "燃えろ…フー・ブルー!" - "Burn... FEU BLEU!", his form by name.
  kosho: after('kosho', 'vo-kosho-feu-bleu', 'FEU BLEU', [.01], 0),
  // Shiden: "来い…雷！" - "Come... thunder!", as his Guardian rises.
  shiden: after('shiden', 'vo-shiden-guardian', 'Guardian', [.02], 0),
  // Tobari: "来い、鴉天狗。……これが、俺の背負った炎だ。" - "Come, crow tengu... this is the fire I carry", as his
  // Guardian rises.
  tobari: after('tobari', 'vo-tobari-power', 'Guardian', [.05, 2.21], 0),
  // Asahi: "燃えろ…夜明けだ！" - "Burn... it's daybreak!", DAYBREAK by name.
  asahi: after('asahi', 'vo-asahi-full-focus', 'DAYBREAK', [.03], 0),
  // KoKo: "お前の番だ……アイアン・ララバイ。" - "Your turn... Iron Lullaby", as his Iron Spirit rises over him.
  koko: after('koko', 'vo-koko-your-turn', 'SLUMBER', [.05, 1.31, 1.93], 2),
  // Kagari: "燃え上がれ…カグツチ!" - "Blaze up... ALL ABLAZE!", his form by name.
  kagari: after('kagari', 'vo-kagari-taimatsu-no-kagari', 'ALL ABLAZE', [.01], 0),
  // Gohaku: "もう…止められません。白猿が、目を覚ます！" - "There's no stopping it now. The white ape wakes!"
  'gohaku': after('gohaku', 'vo-gohaku-kono-chikara', 'Beast', [.01, .1, .49, .66, 1.35, 1.52], 2),
  // Kuon: "天眼…開眼。" - "Heaven's Eye... open", as the TENGAN wake.
  kuon: after('kuon', 'vo-kuon-saikyo', 'TENGAN', [.01], 0),
  // Sorrel: "酒は後だ。……紅の意志を、見せてやる。" - "The drink can wait... I'll show you the crimson will", CRIMSON
  // WILL by name. A fifth of a second later than Taisei's beat, as Setsu's: said on it, the soft opening sat 5 dB over the
  // burst's tail and his will's push in the speech band; once they have crested, 11.
  sorrel: after('sorrel', 'vo-sorrel-senso-owarase', 'CRIMSON WILL', [.02, 1.38], 0, AFTER_BURST + .2),
  // Dorado: "見せてやる……最後の水平線をッ！" - "I'll show you... the last horizon!", LAST HORIZON by name.
  dorado: after('dorado', 'vo-dorado-sea-crown', 'LAST HORIZON', [.01, 1.11], 0),
  // Rook: "これが、ホロウ・クラウンだ。" - "This is the HOLLOW CROWN", his form by name.
  'rook': after('rook', 'vo-rook-tsuyoku', 'HOLLOW CROWN', [.05, .59, .82, 1.09, 1.76], 1),
};
