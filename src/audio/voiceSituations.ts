import type { FighterId } from '../game/types';
import type { AudioCue, CueLayer } from './cueTypes';
import { cueDuration } from './cueTypes';
import { FIGHTER_QUIPS } from './quipCues';
import RIFT_LEVELS from './data/riftLineLevels.json';
import REJECTS from './data/voiceRejects.json';
import CUT_LINES from './data/situationLines.json';
import { applyOriginalSituations } from '../originals/situations';

export type VoiceSituation = 'hurt' | 'hurt-heavy' | 'ko' | 'kill' | 'bell' | 'parry' | 'low' | 'taunt' | 'win' | 'loss';
export const VOICE_SITUATIONS: readonly VoiceSituation[] = ['hurt', 'hurt-heavy', 'ko', 'kill', 'bell', 'parry', 'low', 'taunt', 'win', 'loss'];

/** A line: one of the bank's cues, or one of the fighter's own Rift-boss lines played where it already ships -
 *  `rift:<name>` is /assets/audio/survival/boss-<name>.m4a (its row: public/assets/audio/survival/boss-voices.json). */
export type SituationLine = AudioCue | `rift:${string}`;

export interface SituationRule {
  /** The chance an opportunity is taken. */
  chance: number;
  /** Seconds the kind rests for a fighter after a line of it. */
  rest: number;
  /** Seconds before the same line is said again by that fighter (a cry repeats sooner than a sentence). */
  again: number;
  /** Added to the event's base priority (4 when the local fighter is in it, else 1), as a move's is: efforts 0, a
   *  special's call 1, an ultimate's 2 (voicePlan.ts PRIORITY). */
  priority: number;
  gain: number;
  /** Seconds after its event. */
  delay: number;
  /** CueLayer.yields. Only the knockout cry has none: the body it cuts off has just been knocked out. */
  yields?: 'self' | 'all';
  /** The longest a line of the kind may be, seconds (tests/voiceSituations.test.ts holds LINES to it). */
  longest: number;
}

/** The rules, one row a kind. Changing a number here changes the game and the document's table with it. */
export const SITUATION_RULES: Record<VoiceSituation, SituationRule> = {
  // The commonest event of a match: rationed like a light's effort, under everything, and it never cuts in.
  hurt: { chance: .25, rest: 1.2, again: 4, priority: -1, gain: .7, delay: 0, yields: 'all', longest: .9 },
  'hurt-heavy': { chance: .6, rest: 2.5, again: 6, priority: -.5, gain: .78, delay: 0, yields: 'all', longest: 1.7 },
  // Eleven a royale, the most dramatic moment of each: always, and over the victim's own line.
  ko: { chance: 1, rest: 0, again: 0, priority: 1.5, gain: .9, delay: 0, longest: 2.6 },
  // After the victim's cry, never over the killer's own call (the move that scored it is often still being named).
  kill: { chance: 1, rest: 8, again: 30, priority: 1, gain: .82, delay: .6, yields: 'self', longest: 2.6 },
  bell: { chance: 1, rest: 20, again: 0, priority: 1, gain: .85, delay: 0, yields: 'self', longest: 3.5 },
  // (Every perfect guard: the local player's always spoke, in a gap. A dodge is rationed: DODGE_SHARE.)
  parry: { chance: 1, rest: 20, again: 30, priority: .5, gain: .8, delay: .15, yields: 'self', longest: 2 },
  low: { chance: 1, rest: 0, again: 30, priority: 1, gain: .82, delay: .2, yields: 'self', longest: 3.3 },
  taunt: { chance: 1, rest: 8, again: 0, priority: .5, gain: .82, delay: 0, yields: 'self', longest: 3.5 },
  win: { chance: 1, rest: 0, again: 0, priority: 1, gain: .85, delay: 0, longest: 4 },
  loss: { chance: 1, rest: 0, again: 0, priority: 1, gain: .8, delay: 0, longest: 4 },
};
/** Health, as a share of the fighter's own, at which the `low` line is said; and above which it is armed again (a
 *  knockout's heal in a royale can bring a fighter back up: the next fall is a new moment). */
export const LOW_HEALTH = .3, LOW_REARM = .6;
/** A dodge is commoner than a perfect guard (any blow through a dash's first frames): a quarter of them speak. */
export const DODGE_SHARE = .25;
/** Seconds after the `low` line a fighter still low and still being hit says it again: the local player's resolve
 *  quip, which this line took over, came back every 90 s, and nothing they used to hear is taken away. */
export const LOW_AGAIN = 90;

type Lines = Partial<Record<VoiceSituation, readonly SituationLine[]>>;

/** Every fighter's lines by situation. Step two of the launch-day voice work: **what was already cut and never played**.
 *  The audit found 106 registered cues no plan reached (victory lines, challenges, match openings, a pain cry) and 138
 *  lines of 17 roster fighters in the Rift's boss bank with their moment named by the pass that cut them (entrance,
 *  rage, hurt, defeat). Each is given here to the situation it was cut for:
 *    a boss's entrance -> bell, or taunt for a second one;  rage (half health) -> low;  hurt -> hurt when it is a short cry,
 *    hurt-heavy when it is a word, low when it is a sentence;  defeat -> ko, or loss when it is longer than a cry may be;
 *    a victory or round-win quip -> win;  a challenge, a match opening or a readiness line -> bell or taunt.
 *  A boss line already re-cut as a roster cue (43 of them: the calls) is not used twice, and no line is in two kinds.
 *  Not used, and still unplayed: a line whose words are not on record (shirokane-resolve, vo-shijima-quip-teamwork), one that
 *  names somebody (vo-akayuri-quip-slow), move names, attack efforts (an effort is not a pain cry), and the older takes the
 *  re-cuts replaced. Longer boss lines than a kind allows are left out (SITUATION_RULES.longest). */
const LINES: Partial<Record<FighterId, Lines>> = {
  shiun: { bell: ['rift:shiun-begin'], taunt: ['rift:shiun-my-sword'], kill: ['rift:shiun-finish'], 'hurt-heavy': ['rift:shiun-careless'], ko: ['rift:shiun-impossible'] },
  shakugo: { bell: ['rift:shakugo-ends'], low: ['rift:shakugo-dance', 'rift:shakugo-annoying'], ko: ['rift:shakugo-careless'] },
  akayuri: { bell: ['vo-akayuri-ready'], taunt: ['vo-akayuri-quip-insult'], win: ['vo-akayuri-victory'] },
  'shibuichi': { win: ['vo-shibuichi-quip-done', 'vo-shibuichi-quip-safe'] },
  tokan: { bell: ['rift:tokan-arara'], taunt: ['rift:tokan-seriously'], low: ['rift:tokan-you-did-it'], hurt: ['rift:tokan-whoa'], ko: ['rift:tokan-really'], win: ['vo-tokan-quip-win'] },
  rotfalke: { bell: ['vo-rotfalke-ready'], win: ['vo-rotfalke-quip-easy'] },
  barrow: { bell: ['vo-barrow-quip-banquet'], taunt: ['vo-barrow-quip-taunt', 'rift:barrow-laugh'], parry: ['rift:barrow-useless'],
    low: ['rift:barrow-laugh2'], 'hurt-heavy': ['rift:barrow-damn'], ko: ['rift:barrow-impossible'] },
  shidare: { kill: ['vo-shidare-finish'], low: ['vo-shidare-quip-interest'], taunt: ['vo-shidare-quip-pride'] },
  aqrab: { parry: ['vo-aqrab-ineffective'], ko: ['vo-aqrab-fool'] },
  oro: { taunt: ['rift:oro-laugh'], hurt: ['rift:oro-hun'] },
  strappado: { bell: ['vo-strappado-quip-execution'] },
  'shakudo': { parry: ['vo-shakudo-too-slow'], win: ['vo-shakudo-quip-finish'] },
  adad: { taunt: ['vo-adad-quip-pride'], parry: ['vo-adad-quip-impressed'] },
  hawser: { bell: ['vo-hawser-strike'] },
  highsun: { win: ['vo-highsun-quip-win'] },
  hisame: { taunt: ['vo-hisame-quip-ready'], win: ['vo-hisame-resolve'] },
  hagure: { taunt: ['vo-hagure-quip-monster'], low: ['vo-hagure-quip-grow'] },
  wataame: { low: ['vo-wataame-quip-rival'] },
  'wuming': { low: ['rift:wuming-laugh', 'rift:wuming-dont-underestimate'], ko: ['rift:wuming-impossible'] },
  'jinlin': { bell: ['rift:jinlin-revenge'], 'hurt-heavy': ['rift:jinlin-curse-you'], ko: ['rift:jinlin-blunder'] },
  vesper: { bell: ['rift:vesper-i-like-you'], taunt: ['rift:vesper-tear-away'], 'hurt-heavy': ['vo-vesper-no'], loss: ['rift:vesper-want-to-know'] },
  irbis: { bell: ['vo-irbis-quip-ready'], taunt: ['rift:irbis-laugh'] },
  hikui: { bell: ['vo-hikui-ready', 'vo-hikui-quip-ready'] },
  unari: { low: ['vo-unari-quip-interested'], win: ['vo-unari-quip-finish'] },
  hakushi: { bell: ['vo-hakushi-quip-ready'], win: ['vo-hakushi-quip-training'] },
  banjaku: { bell: ['rift:banjaku-no-chance'], 'hurt-heavy': ['rift:banjaku-this-power'], ko: ['rift:banjaku-defeated'] },
  kinu: { parry: ['vo-kinu-quip-stay-away'] },
  gosu: { bell: ['vo-gosu-quip-rival'] },
  gorai: { bell: ['rift:gorai-who-am-i'], taunt: ['rift:gorai-kill'], ko: ['rift:gorai-no-choice'] },
  'ovid': { bell: ['vo-ovid-strike'] },
  'rakucho': { bell: ['vo-rakucho-quip-name'], loss: ['vo-rakucho-quip-why'] },
  onigawara: { bell: ['vo-onigawara-quip-ready', 'rift:onigawara-cut-you'], taunt: ['rift:onigawara-fun'], 'hurt-heavy': ['rift:onigawara-what'], ko: ['rift:onigawara-boring'] },
  senko: { bell: ['vo-senko-go', 'rift:senko-troubling'], taunt: ['vo-senko-quip-challenge'], parry: ['rift:senko-too-slow'],
    low: ['rift:senko-too-late', 'rift:senko-that-hurts'], loss: ['rift:senko-overdid'] },
  akagane: { bell: ['rift:akagane-entertain'], taunt: ['rift:akagane-despair'], low: ['rift:akagane-cornered'], ko: ['rift:akagane-wretch'] },
  kubiwa: { kill: ['vo-kubiwa-quip-thanks'], win: ['vo-kubiwa-quip-victory'] },
  lanthorn: { win: ['vo-lanthorn-quip-victory'] },
  imago: { bell: ['rift:imago-begin'], 'hurt-heavy': ['rift:imago-what'], loss: ['rift:imago-checkmate'] },
  'madake': { low: ['vo-madake-quip-fire'] },
  minase: { win: ['vo-minase-quip-victory'] },
  sashigane: { parry: ['vo-sashigane-there'], win: ['vo-sashigane-quip-win'] },
  bonsho: { bell: ['vo-bonsho-quip-play'], loss: ['vo-bonsho-quip-growth'] },
  'psyche': { win: ['vo-psyche-quip-teamwork', 'vo-psyche-quip-thanks'] },
  amagoi: { win: ['vo-amagoi-quip-victory'] },
  yodaka: { bell: ['vo-yodaka-begin'] },
  murex: { low: ['vo-murex-resolve'], ko: ['vo-murex-quip-surprise'], win: ['vo-murex-victory'] },
  magatsu: { bell: ['rift:magatsu-shall-we'], taunt: ['rift:magatsu-come-at-me'], kill: ['rift:magatsu-eyesore'], low: ['rift:magatsu-difference'] },
  torsion: { bell: ['vo-torsion-quip-result'] },
  tancho: { bell: ['vo-tancho-quip-focus'] },
  chohan: { bell: ['vo-chohan-no-time'], taunt: ['vo-chohan-pierce'] },
  tsubute: { bell: ['vo-tsubute-cover'], taunt: ['vo-tsubute-try-this'], hurt: ['vo-tsubute-hurt'], win: ['vo-tsubute-experience'] },
  haldor: { bell: ['rift:haldor-iam'], hurt: ['vo-haldor-gu'], ko: ['rift:haldor-brat'] },
  buna: { bell: ['vo-buna-quip-challenge'] },
  mikage: { bell: ['vo-mikage-quip-challenge'] },
};

/** Step three: the lines cut for the situations themselves, from the recordings on disk, by the bank's own pipeline
 *  (scripts/voice/situation_batch.py: index a game voice set, choose a window, check it, cut it with register_voice.py's
 *  functions, record it). data/situationLines.json is written from the voice manifest's rows that carry a `situation`,
 *  fighter by fighter as each batch lands; a fighter's cut lines are said beside any given to them above. */
for (const [fighter, kinds] of Object.entries(CUT_LINES as Record<string, Partial<Record<VoiceSituation, string[]>>>)) {
  const lines = (LINES[fighter as FighterId] ??= {}) as Record<VoiceSituation, readonly SituationLine[]>;
  for (const [kind, cues] of Object.entries(kinds) as [VoiceSituation, string[]][]) lines[kind] = [...(lines[kind] ?? []), ...(cues as SituationLine[])];
}
applyOriginalSituations(LINES as Parameters<typeof applyOriginalSituations>[0]);

const REJECTED = new Set((REJECTS as { rejected: { fighter: string; kind: string; line: string }[] }).rejected.map(row => `${row.fighter}|${row.kind}|${row.line}`));
/** `whole`: with nothing turned down (the audition page lists a rejected line too, so it can be taken back). */
const kept = (fighter: FighterId, kind: VoiceSituation, lines: readonly SituationLine[], whole = false) =>
  REJECTED.size && !whole ? lines.filter(line => !REJECTED.has(`${fighter}|${kind}|${line}`)) : lines;

/** The lines given to a fighter for a kind in LINES, and nothing borrowed from another kind. */
export function ownSituationLines(fighter: FighterId, kind: VoiceSituation, whole = false): readonly SituationLine[] {
  return kept(fighter, kind, LINES[fighter]?.[kind] ?? [], whole);
}

/** Where a line that is said in a kind comes from: its own row, or one of the two borrowings below. */
export type LineOrigin = 'own' | 'quip' | 'cry';

/** What a fighter says in a situation, with where each line comes from. Two borrowings, both of the fighter's own lines:
 *  - the two quips every fighter already has (quipCues.ts), which only the local player ever heard: the *advantage* line
 *    is a kill line, and the *resolve* line is said at low health and on a perfect guard - as QuipDirector said them, for
 *    everyone now, beside any line the kind has of its own;
 *  - a heavier cry or a knockout with no line of its own is the next lighter cry (ko <- hurt-heavy <- hurt). */
export function situationSources(fighter: FighterId, kind: VoiceSituation, whole = false): readonly { line: SituationLine; from: LineOrigin }[] {
  const own = ownSituationLines(fighter, kind, whole).map(line => ({ line, from: 'own' as LineOrigin }));
  const quips = FIGHTER_QUIPS[fighter];
  const quip = kind === 'kill' ? quips?.advantage : kind === 'low' || kind === 'parry' ? quips?.resolve : undefined;
  if (quip && !own.some(row => row.line === quip)) return [...own, ...kept(fighter, kind, [quip], whole).map(line => ({ line, from: 'quip' as LineOrigin }))];
  if (own.length) return own;
  const lighter: VoiceSituation | undefined = kind === 'ko' ? 'hurt-heavy' : kind === 'hurt-heavy' ? 'hurt' : undefined;
  if (!lighter) return own;
  return kept(fighter, kind, situationSources(fighter, lighter, whole).map(row => row.line), whole).map(line => ({ line, from: 'cry' as LineOrigin }));
}
/** What a fighter says in a situation: none, and they are silent for it. */
export function situationLines(fighter: FighterId, kind: VoiceSituation): readonly SituationLine[] {
  return situationSources(fighter, kind).map(row => row.line);
}

const RIFT = RIFT_LEVELS as unknown as Record<string, [seconds: number, lufs: number]>;
export const isRift = (line: SituationLine): line is `rift:${string}` => line.startsWith('rift:');
/** Where a line's sound is: the boss bank's own file, or the cue's in the roster bank. */
export const riftUrl = (line: `rift:${string}`) => `/assets/audio/survival/boss-${line.slice(5)}.m4a`;
/** How long a line is, seconds. */
export function lineSeconds(line: SituationLine): number { return isRift(line) ? RIFT[line.slice(5)]?.[0] ?? 0 : cueDuration(line); }
/** The roster's voices are set to -16.5 LUFS at their loudest 400 ms (voicePlan.ts LEVEL); the boss bank was
 *  peak-normalised and sits 5 dB over that at the median (scripts/voice/situation_levels.py measures each line, the
 *  same way). A boss line is brought to the roster's level at playback, so none is the loudest thing in the fight. */
const LEVEL = -16.5;
function trim(line: SituationLine): number {
  const measured = isRift(line) ? RIFT[line.slice(5)]?.[1] : undefined;
  return measured === undefined ? 1 : 10 ** ((LEVEL - measured) / 20);
}

/** One line as the mixer plays it. A situation line is laid down in the 'impact' phase: the speaker's next move line
 *  cuts it (a signature always takes precedence), and no cast cancels it (CombatAudio.cancelOwner). */
export function situationLayer(kind: VoiceSituation, line: SituationLine, speaker: string, delay = 0): CueLayer {
  const rule = SITUATION_RULES[kind], wait = Math.round((rule.delay + delay) * 1000) / 1000;
  return { cue: isRift(line) ? 'swing-a' : line, ...(isRift(line) ? { url: riftUrl(line) } : {}), bus: 'voice', gain: +(rule.gain * trim(line)).toFixed(3),
    voicePriority: rule.priority, phase: 'impact', speaker, ...(wait > 0 ? { delay: wait } : {}), ...(rule.yields ? { yields: rule.yields } : {}) };
}

/** The lines of a room's fighters that are not in the roster bank (the Rift's): CombatAudio fetches and decodes them
 *  as the room loads, with the fighters' own cues, so none is decoded in the fight (today's measurements: an audio
 *  decode is the hitch left in a royale). The bank's cues need no list: a room loads every cue named for its fighters. */
export function situationSamples(fighters: Iterable<string>): string[] {
  const urls = new Set<string>();
  for (const fighter of fighters) for (const kind of VOICE_SITUATIONS) for (const line of situationLines(fighter as FighterId, kind)) if (isRift(line)) urls.add(riftUrl(line));
  return [...urls];
}

/** Every line of every fighter, for the audition page, the document's counts and the tests. */
export function allSituationLines(): { fighter: FighterId; kind: VoiceSituation; line: SituationLine; from: LineOrigin; seconds: number }[] {
  const rows: ReturnType<typeof allSituationLines> = [];
  const fighters = new Set<FighterId>([...Object.keys(LINES), ...Object.keys(FIGHTER_QUIPS)] as FighterId[]);
  for (const fighter of fighters) for (const kind of VOICE_SITUATIONS) for (const { line, from } of situationSources(fighter, kind)) rows.push({ fighter, kind, line, from, seconds: lineSeconds(line) });
  return rows;
}
/** Rows of LINES before the rejections are taken out: what the audition page lists, so a line turned down can be
 *  turned back. */
export function listedSituationLines(): { fighter: FighterId; kind: VoiceSituation; line: SituationLine }[] {
  return (Object.entries(LINES) as [FighterId, Lines][]).flatMap(([fighter, lines]) =>
    (Object.entries(lines) as [VoiceSituation, readonly SituationLine[]][]).flatMap(([kind, list]) => list.map(line => ({ fighter, kind, line }))));
}
export const isRejected = (fighter: string, kind: string, line: string) => REJECTED.has(`${fighter}|${kind}|${line}`);
/** What /voices.html lists: every line of every fighter as it would be said with nothing turned down, and whether it has been. */
export function auditionRows(): { fighter: FighterId; kind: VoiceSituation; line: SituationLine; from: LineOrigin; seconds: number; rejected: boolean }[] {
  const fighters = new Set<FighterId>([...Object.keys(LINES), ...Object.keys(FIGHTER_QUIPS)] as FighterId[]);
  return [...fighters].flatMap(fighter => VOICE_SITUATIONS.flatMap(kind => situationSources(fighter, kind, true).map(({ line, from }) =>
    ({ fighter, kind, line, from, seconds: lineSeconds(line), rejected: isRejected(fighter, kind, line) }))));
}
