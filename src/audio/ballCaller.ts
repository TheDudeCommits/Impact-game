import MADE from './data/ballCaller.json';

/** The ball modes' caller: an arena announcer for Goal Rush and Sky Spike.
 *
 *  Who: an original hype caller, a gravel-voiced, high-energy stadium announcer - the Ink Bowl's own voice on its PA - in
 *  English, with now and then a Japanese hype word. Each voice's lines are in public/assets/audio/ball/caller/<voice>/
 *  (its manifest.json holds the archetype, the voice's design and every line's text, by moment), listed by moment in
 *  src/audio/data/ballCaller.json, which this reads. No line
 *  quotes or names another work, and the voice is designed, never a person's.
 *
 *  Until his takes are made, the moments the Rift's announcer already has a fitting line for borrow it (BORROWED: the
 *  game's own designed voice, public/assets/audio/survival/announcer-*.m4a), and the rest are quiet.
 *
 *  How he talks (BallCaller.say): never over himself, never every second. A line waits for the last to end; a moment
 *  two priorities bigger cuts it; a small moment (under BIG) needs SPACING since the last line began; each moment rests
 *  its `rest` before it is called again, and is only called its `chance` of the time. He is on the voice bus, so the
 *  game's voice volume turns him down or off (CombatAudio.announce). */
export type CallerMoment = 'kickoff' | 'serve' | 'goal' | 'goal-power' | 'goal-volley' | 'goal-aerial' | 'goal-curve' | 'goal-long'
  | 'goal-bicycle' | 'super-goal' | 'own-goal' | 'clash' | 'clash-win' | 'save' | 'save-perfect' | 'save-diving' | 'post' | 'crossbar'
  | 'near-miss' | 'overtime' | 'overtime-win' | 'fever' | 'rally' | 'match-point' | 'serve-winner' | 'kill' | 'sky-spike' | 'roll-spike'
  | 'stuff-block' | 'comeback' | 'hat-trick' | 'on-fire' | 'overdrive' | 'super-shot' | 'mvp' | 'win' | 'shutout' | 'loss'
  | 'target' | 'new-record' | 'last-minute' | 'final-seconds'
  /** A LINK SHOT, a TECHNIQUE DUEL's beat and a keeper winning it. */
  | 'link-shot' | 'technique-duel' | 'duel-won'
  /** Goal Rush's TACKLE and TAKEDOWN (FIGHT stance), a fighter wiped out, a boosting BUMP, a save OFF THE LINE; Sky
   *  Spike's PERFECT SPIKE, a DIG and a DIVING DIG; a perfect strike, and a clever set or touch (ballAudio.ts CALLED_TEXT
   *  names the events that call them). */
  | 'tackle' | 'takedown' | 'wipeout' | 'bump' | 'off-the-line' | 'perfect-spike' | 'dig' | 'diving-dig' | 'perfect-strike' | 'clever-touch';

export interface CallerRule { priority: number; chance: number; rest: number }
const rule = (priority: number, chance = 1, rest = 12): CallerRule => ({ priority, chance, rest });
/** priority: what may cut what (two up cuts); chance: the share of moments called; rest: seconds before the moment again. */
export const CALLER: Readonly<Record<CallerMoment, CallerRule>> = {
  kickoff: rule(5, 1, 20), serve: rule(3, 1, 60),
  goal: rule(8, 1, 0), 'goal-power': rule(8, 1, 0), 'goal-volley': rule(8, 1, 0), 'goal-aerial': rule(8, 1, 0), 'goal-curve': rule(8, 1, 0),
  'goal-long': rule(8, 1, 0), 'goal-bicycle': rule(9, 1, 0), 'super-goal': rule(9, 1, 0), 'own-goal': rule(7, 1, 0),
  clash: rule(6, 1, 8), 'clash-win': rule(4, .5, 8),
  save: rule(4, .7, 10), 'save-perfect': rule(6, 1, 8), 'save-diving': rule(6, 1, 8), post: rule(5, 1, 8), crossbar: rule(5, 1, 8), 'near-miss': rule(3, .5, 14),
  overtime: rule(9, 1, 0), 'overtime-win': rule(10, 1, 0), fever: rule(7, 1, 20), rally: rule(3, .6, 15), 'match-point': rule(7, 1, 10),
  'serve-winner': rule(6, 1, 6), kill: rule(3, .35, 10), 'sky-spike': rule(5, .65, 9), 'roll-spike': rule(6, 1, 9), 'stuff-block': rule(6, 1, 8),
  comeback: rule(7, 1, 30), 'hat-trick': rule(8, 1, 0), 'on-fire': rule(6, 1, 20), overdrive: rule(4, .6, 25), 'super-shot': rule(5, .8, 10),
  mvp: rule(6, 1, 0), win: rule(10, 1, 0), shutout: rule(10, 1, 0), loss: rule(10, 1, 0),
  target: rule(2, 1, 6), 'new-record': rule(3, 1, 8), 'last-minute': rule(4, 1, 0), 'final-seconds': rule(5, 1, 0),
  'link-shot': rule(5, .8, 10), 'technique-duel': rule(6, 1, 8), 'duel-won': rule(8, 1, 0),
  // A bot match has about eleven TACKLEs and ten BUMPs (Goal Rush), sixteen PERFECT SPIKEs and two dozen DIGs,
  // nearly all DIVING (Sky Spike), so those are called some of the time and rest long; a TAKEDOWN (three), a save OFF THE
  // LINE (four) or a perfect strike every time it is free to; a plain wipe-out (a TAKEDOWN's own is the TAKEDOWN's:
  // ballAudio.ts) most times. Over five bot matches each he says 9.3 lines a minute in Goal Rush and 9.4 in Sky
  // Spike, talking a quarter of the time, never more than six lines in any 20 s.
  tackle: rule(4, .5, 14), takedown: rule(6, 1, 10), wipeout: rule(5, .8, 10), bump: rule(3, .45, 16), 'off-the-line': rule(6, 1, 8),
  'perfect-spike': rule(6, .7, 12), dig: rule(2, .25, 20), 'diving-dig': rule(5, .6, 16), 'perfect-strike': rule(6, 1, 8), 'clever-touch': rule(4, .6, 14),
};
/** A moment at this priority or more is never held back by SPACING. */
export const BIG = 5;
/** Seconds between the end of one line and the next; and the least time from one small moment's line to the next. */
export const GAP = .3, SPACING = 4;
/** How loud he is on the voice bus (his lines are levelled with the Rift's announcer, the loudest 400 ms at -13 LUFS). */
export const CALLER_GAIN = .9;
/** How far a queued line may wait behind the one being said (s) before it is dropped as stale. */
const QUEUE = 2.5;

const rift = (id: string) => `/assets/audio/survival/announcer-${id}.m4a`;
/** The moments the Rift's announcer has a fitting line for, borrowed until the caller's own are made. (Not the result: the
 *  finale already has him call the local side's VICTORY, main.ts; the caller's own result lines follow it.) */
export const BORROWED: Readonly<Partial<Record<CallerMoment, readonly string[]>>> = {
  'super-goal': [rift('chain-200'), rift('style-sss')], 'hat-trick': [rift('chain-100')], 'on-fire': [rift('chain-100')],
  clash: [rift('break-it')], overtime: [rift('round-final')], 'match-point': [rift('finish')], 'sky-spike': [rift('style-s')], 'roll-spike': [rift('style-sss')], 'stuff-block': [rift('style-ss')],
  'save-perfect': [rift('flawless')], 'serve-winner': [rift('execution')], 'new-record': [rift('new-record')], target: [rift('style-s'), rift('style-ss')],
};
/** The commentary voices, for Settings' COMMENTARY: the grandfather (the default), the arena caller, or none. Both say
 *  the same lines. */
export type CommentaryVoice = 'grandpa' | 'arena';
export type Commentary = CommentaryVoice | 'off';
export const COMMENTARY_OPTIONS: readonly (readonly [Commentary, string, string?])[] = [['grandpa', 'Grandpa', 'Default'], ['arena', 'Arena caller'], ['off', 'Off']];
export const commentaryOf = (value: unknown): Commentary => value === 'arena' || value === 'off' ? value : 'grandpa';
let commentary: Commentary = 'grandpa';
/** The voice picked in Settings (main.ts sets it at boot and on every change). */
export function setCommentary(value: unknown) { commentary = commentaryOf(value); }
export const currentCommentary = () => commentary;
type Made = { voices?: Partial<Record<string, { name?: string; lines: Partial<Record<string, string[]>> }>> };
/** A voice's own lines by moment (ballCaller.json, written by caller.py), or the borrowed ones; none with the commentary off. */
export function callerLines(moment: CallerMoment, voice: Commentary = commentary): readonly string[] {
  if (voice === 'off') return [];
  const own = (MADE as Made).voices?.[voice]?.lines[moment];
  return own?.length ? own : BORROWED[moment] ?? [];
}
/** Every file the chosen voice may say (preloaded with a ball match: a line not yet decoded is skipped, never said late). */
export const callerFiles = () => [...new Set((Object.keys(CALLER) as CallerMoment[]).flatMap(m => callerLines(m)))];
/** Every file any voice may say: the package ships them all, the player switching voices any time. */
export const allCallerFiles = () => [...new Set((['grandpa', 'arena'] as const).flatMap(v => (Object.keys(CALLER) as CallerMoment[]).flatMap(m => callerLines(m, v))))];

export interface CallerVoice { announce(url: string, gain: number, delay?: number): void; sampleSeconds(url: string): number | undefined; preload(urls: readonly string[]): void }

export class BallCaller {
  private busyUntil = -Infinity;
  private lastStart = -Infinity;
  private lastPriority = 0;
  private rested = new Map<CallerMoment, number>();
  private bags = new Map<string, string[]>();
  private last = '';
  private voiceSaid: Commentary = commentary;
  constructor(private readonly voice: CallerVoice, private readonly random: () => number = Math.random, private readonly clock = () => performance.now() / 1000) {}
  /** A match's start: nothing rests from the last one. */
  reset() { this.busyUntil = -Infinity; this.lastStart = -Infinity; this.lastPriority = 0; this.rested.clear(); }
  /** Call `moment`, `delay` seconds from now, if the rules let him; `queue`: wait for the line being said rather than drop
   *  (a follow-up: the MVP after the result). Returns the file said, or nothing. */
  say(moment: CallerMoment, options: { delay?: number; queue?: boolean; /** Lines (their files) not to say this time: a FEVER rally's "every point counts double" when only the side behind's point does. */ avoid?: RegExp } = {}): string | undefined {
    // A voice changed in Settings: its own lines from now on.
    if (this.voiceSaid !== commentary) { this.voiceSaid = commentary; this.bags.clear(); this.voice.preload(callerFiles()); }
    const lines = options.avoid ? callerLines(moment).filter(url => !options.avoid!.test(url)) : callerLines(moment), rules = CALLER[moment];
    if (!lines.length) return;
    const now = this.clock();
    let at = now + Math.max(0, options.delay ?? 0);
    if (at - (this.rested.get(moment) ?? -Infinity) < rules.rest) return;
    if (this.busyUntil + GAP > at) {
      if (rules.priority >= this.lastPriority + 2) { /* cuts the line being said (the voice bus stops his last). */ }
      else if (options.queue && this.busyUntil + GAP - at <= QUEUE) at = this.busyUntil + GAP;
      else return;
    }
    if (rules.priority < BIG && at - this.lastStart < SPACING) return;
    if (rules.chance < 1 && this.random() >= rules.chance) return;
    const url = this.pick(options.avoid ? `${moment}~${options.avoid.source}` : moment, lines), seconds = this.voice.sampleSeconds(url);
    // Not decoded yet: fetched for next time, and this moment passes (a line is never said late).
    if (seconds === undefined) { this.voice.preload([url]); return; }
    this.voice.announce(url, CALLER_GAIN, at - now);
    this.busyUntil = at + seconds; this.lastStart = at; this.lastPriority = rules.priority; this.rested.set(moment, at); this.last = url;
    return url;
  }
  /** Each moment's lines in a shuffled bag, so none comes round again before the others, and never the same twice running. */
  private pick(moment: string, lines: readonly string[]) {
    let bag = this.bags.get(moment);
    if (!bag?.length) {
      bag = [...lines];
      for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(this.random() * (i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]]; }
      if (bag.length > 1 && bag[bag.length - 1] === this.last) [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1], bag[0]];
      this.bags.set(moment, bag);
    }
    return bag.pop()!;
  }
}
