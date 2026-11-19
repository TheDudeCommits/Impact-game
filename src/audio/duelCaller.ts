import MADE from './data/duelCaller.json';
import type { CombatEvent, GameSnapshot, PlayerState } from '../game/types';

/** The Duel's announcer. Before it a Duel said only FIGHT!, VICTORY! and FLAWLESS (main.ts). Now it calls a 1 v 1
 *  Duel's moments - against the CPU, on the couch, online, and the ranked Duel that uses the same page path - on the ball
 *  caller's design (audio/ballCaller.ts):
 *
 *  Who: a designed voice, recorded once one of the anime-style voices made for the game is picked. Its line
 *  book is scripts/originals/duel/caller.json (each moment's lines, 1-3 each, original English with the odd Japanese hype
 *  word; no line quotes or names another work); the takes, when made, are listed by voice and moment in
 *  src/audio/data/duelCaller.json, which this reads. Until then a moment the Rift's announcer has a fitting line for
 *  borrows it (BORROWED: the game's own designed voice, public/assets/audio/survival/announcer-*.m4a), and the rest are
 *  quiet.
 *
 *  How it talks (DuelCaller.say): rarely. Never over itself: a line waits for the last to end (GAP), and only a moment two
 *  priorities bigger cuts it. Never over a fighter's own big line (a move's call, a transformation's name, a win line -
 *  not a cry of pain): the voice says how long the fighters' lines still have (`fighterLine`), and a moment that would
 *  start under one passes. A small moment (under BIG) waits SPACING since the last line began; each moment rests its
 *  `rest` before it is called again and is only called its `chance` of the time: about 4.5 lines a minute over five bot
 *  Duels (DUEL_CALLER). It is on the voice bus, so the game's voice volume
 *  turns it down or off (CombatAudio.announce), and Settings' ANNOUNCER turns it off (setAnnouncer). `?ab=duelcaller`
 *  takes it away: the Duel says FIGHT!, VICTORY! and FLAWLESS as before. */
export type DuelMoment = 'round-1' | 'round-2' | 'round-final' | 'fight' | 'first-strike' | 'counter' | 'punish' | 'parry' | 'deflect'
  | 'guard-break' | 'wall-splat' | 'combo-5' | 'combo-10' | 'combo-15' | 'g-combo' | 'comeback' | 'ko' | 'double-ko' | 'time'
  | 'victory' | 'flawless';
export const DUEL_MOMENTS: readonly DuelMoment[] = ['round-1', 'round-2', 'round-final', 'fight', 'first-strike', 'counter', 'punish', 'parry',
  'deflect', 'guard-break', 'wall-splat', 'combo-5', 'combo-10', 'combo-15', 'g-combo', 'comeback', 'ko', 'double-ko', 'time', 'victory', 'flawless'];

export interface DuelRule { priority: number; chance: number; rest: number }
const rule = (priority: number, chance = 1, rest = 20): DuelRule => ({ priority, chance, rest });
/** priority: what may cut what (two up cuts); chance: the share of moments called; rest: seconds before the moment again.
 *  The round's own calls (its number, FIGHT!, its K.O., the result) every time; the fight's moments all under BIG - so one
 *  of them waits SPACING (20 s) after whatever was said last - and only some of the time, but the round's first blow. A
 *  bot Duel's round runs about a minute, so the round's own calls are three lines a minute by themselves. Measured over
 *  five bot Duels each (scripts/originals/duel/caller_pace.mts, lock combat, whole sets; its chances roll afresh each run):
 *  at level 1 it said 4.6-4.7 lines a minute (3.2 of them the round's), at level 2 4.4-4.5 (2.9), talking 10% of the time,
 *  never more than four lines in any 20 s. (`time`: a Duel has no round clock today; the moment and its lines wait for one.) */
export const DUEL_CALLER: Readonly<Record<DuelMoment, DuelRule>> = {
  'round-1': rule(8, 1, 0), 'round-2': rule(8, 1, 0), 'round-final': rule(8, 1, 0), fight: rule(9, 1, 0),
  'first-strike': rule(5, .3, 0), counter: rule(3, .4, 40), punish: rule(3, .4, 40), parry: rule(4, .9, 25), deflect: rule(2, .3, 45),
  'guard-break': rule(4, .8, 30), 'wall-splat': rule(3, .5, 40), 'combo-5': rule(1, .1, 60), 'combo-10': rule(3, .5, 40),
  'combo-15': rule(4, 1, 30), 'g-combo': rule(4, .8, 30), comeback: rule(10, 1, 0), ko: rule(9, 1, 0), 'double-ko': rule(10, 1, 0),
  time: rule(9, 1, 0), victory: rule(10, 1, 0), flawless: rule(10, 1, 0),
};
/** A moment at this priority or more is never held back by SPACING. */
export const BIG = 5;
/** Seconds between the end of one line and the next; and the least time from one small moment's line to the next. */
export const GAP = .3, SPACING = 20;
/** How loud it is on the voice bus: the FIGHT! and VICTORY! it takes over were said at .95 (main.ts). */
export const DUEL_CALLER_GAIN = .95;
/** How far a queued line may wait behind the one being said (s) before it is dropped as stale. */
const QUEUE = 2.5;
/** How far its line may run into a fighter's own that starts after it (s). */
const FIGHTER_OVERLAP = .15;

const rift = (id: string) => `/assets/audio/survival/announcer-${id}.m4a`;
/** The moments the Rift's announcer has a fitting line for, borrowed until the Duel's own voice is recorded. */
export const BORROWED: Readonly<Partial<Record<DuelMoment, readonly string[]>>> = {
  'round-1': [rift('round-1')], 'round-2': [rift('round-2')], 'round-final': [rift('round-final')], fight: [rift('fight')],
  counter: [rift('style-s')], punish: [rift('execution')], parry: [rift('style-ss')], 'guard-break': [rift('broken')],
  'combo-10': [rift('chain-100')], 'combo-15': [rift('style-sss')], 'g-combo': [rift('chain-200')], comeback: [rift('ally-up')],
  ko: [rift('finisher')], victory: [rift('victory')], flawless: [rift('flawless')],
};

let announcer = true;
/** Settings' ANNOUNCER (main.ts sets it at boot and on every change): off, the Duel's announcer says nothing. */
export function setAnnouncer(on: unknown) { announcer = on !== false; }
export const announcerOn = () => announcer;
let voiceChosen = '';
/** The recorded voice the lines come from (duelCaller.json's `voices`; none made yet): its own lines, else the borrowed. */
export function setDuelVoice(voice: string) { voiceChosen = voice; }
type Made = { voice?: string; voices?: Partial<Record<string, { name?: string; lines: Partial<Record<string, string[]>> }>> };
/** A moment's lines: the chosen voice's own (duelCaller.json), else the borrowed; none with the announcer off. */
export function duelCallerLines(moment: DuelMoment, voice = voiceChosen || (MADE as Made).voice || ''): readonly string[] {
  if (!announcer) return [];
  const own = (MADE as Made).voices?.[voice]?.lines[moment];
  return own?.length ? own : BORROWED[moment] ?? [];
}
/** Every file the voice may say (preloaded with a Duel: a line not yet decoded is skipped, never said late). */
export const duelCallerFiles = () => [...new Set(DUEL_MOMENTS.flatMap(m => duelCallerLines(m)))];
/** Every file any voice may say: what a package ships. */
export const allDuelCallerFiles = () => {
  const voices = Object.keys((MADE as Made).voices ?? {});
  return [...new Set([...Object.values(BORROWED).flat(), ...voices.flatMap(v => DUEL_MOMENTS.flatMap(m => (MADE as Made).voices?.[v]?.lines[m] ?? []))])];
};

export interface DuelCallerVoice {
  announce(url: string, gain: number, delay?: number): void; sampleSeconds(url: string): number | undefined; preload(urls: readonly string[]): void;
  takeBack?(owner: string, url?: string): void;
  /** The fighters' own big lines (not their cries), each [start, end] in seconds from now. */
  fighterLines?(): readonly (readonly [number, number])[];
}

export class DuelCaller {
  private busyUntil = -Infinity;
  private lastStart = -Infinity;
  private lastPriority = 0;
  private rested = new Map<DuelMoment, number>();
  private bags = new Map<DuelMoment, string[]>();
  private last = '';
  /** What it has said, for the measure (caller_pace.mts) and the tests: when, which moment, how long. */
  readonly said: { at: number; moment: DuelMoment; seconds: number; url: string }[] = [];
  constructor(private readonly voice: DuelCallerVoice, private readonly random: () => number = Math.random, private readonly clock = () => performance.now() / 1000) {}
  /** A Duel's start: nothing rests from the last one. */
  reset() { this.busyUntil = -Infinity; this.lastStart = -Infinity; this.lastPriority = 0; this.rested.clear(); this.said.length = 0; }
  /** Call `moment`, `delay` seconds from now, if the rules let it; `queue`: wait for the line being said rather than drop
   *  (FIGHT! behind the round's number, the result behind the K.O.). Returns the file said, or nothing. */
  say(moment: DuelMoment, options: { delay?: number; queue?: boolean } = {}): string | undefined {
    const lines = duelCallerLines(moment), rules = DUEL_CALLER[moment];
    if (!lines.length) return;
    const now = this.clock();
    let at = now + Math.max(0, options.delay ?? 0);
    if (at - (this.rested.get(moment) ?? -Infinity) < rules.rest) return;
    if (this.busyUntil + GAP > at) {
      if (rules.priority >= this.lastPriority + 2) { /* cuts the line being said (the voice bus stops the announcer's last). */ }
      else if (options.queue && this.busyUntil + GAP - at <= QUEUE) at = this.busyUntil + GAP;
      else return;
    }
    // A fighter's own big line is theirs: a moment that would be said over one passes, and the round's own calls (queued)
    // wait for it to end. (Over by its last 0.15 s - the finale's VICTORY! running into the winner's own line - is not over it.)
    const longest = Math.max(...lines.map(url => this.voice.sampleSeconds(url) ?? 1.5));
    for (const [start, end] of this.voice.fighterLines?.() ?? []) {
      if (!(start < at - now + longest - FIGHTER_OVERLAP && end > at - now)) continue;
      if (!options.queue || now + end + GAP - at > QUEUE) return;
      at = now + end + GAP;
    }
    if (rules.priority < BIG && at - this.lastStart < SPACING) return;
    if (rules.chance < 1 && this.random() >= rules.chance) return;
    const url = this.pick(moment, lines), seconds = this.voice.sampleSeconds(url);
    // Not decoded yet: fetched for next time, and this moment passes (a line is never said late).
    if (seconds === undefined) { this.voice.preload([url]); return; }
    this.voice.announce(url, DUEL_CALLER_GAIN, at - now);
    this.busyUntil = at + seconds; this.lastStart = at; this.lastPriority = rules.priority; this.rested.set(moment, at); this.last = url;
    this.said.push({ at, moment, seconds, url });
    return url;
  }
  /** Each moment's lines in a shuffled bag, so none comes round again before the others, and never the same twice running. */
  private pick(moment: DuelMoment, lines: readonly string[]) {
    let bag = this.bags.get(moment);
    if (!bag?.length || bag.some(url => !lines.includes(url))) {
      bag = [...lines];
      for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(this.random() * (i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]]; }
      if (bag.length > 1 && bag[bag.length - 1] === this.last) [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1], bag[0]];
      this.bags.set(moment, bag);
    }
    return bag.pop()!;
  }
}

/** The moments a Duel's frames hold, frame by frame (main.ts, and the measure): the two fighters' events as drawn - a
 *  round's first blow, a counter, a punish, a parry or a shot turned away, a guard broken, a wall splat, a combo of five,
 *  ten or fifteen, a quick G landing in a combo, a K.O. (a comeback's: won from a quarter of the bar or less against
 *  three fifths or more; a double one) - and the round's own: its number, said towards the end of the break before it
 *  (or the first round's countdown). FIGHT! and the result are main.ts's to ask for (its splash beat and its finale). */
export class DuelWatch {
  private round = '';
  private announced = '';
  private struck = false;
  private milestone = new Map<string, number>();
  private low = new Set<string>();
  constructor(private readonly caller: Pick<DuelCaller, 'say'>) {}
  reset() { this.round = ''; this.announced = ''; this.struck = false; this.milestone.clear(); this.low.clear(); }
  frame(snapshot: GameSnapshot): DuelMoment[] {
    const duel = snapshot.duel, players = snapshot.players;
    if (!duel || players.length !== 2) return [];
    const said: DuelMoment[] = [];
    const call = (moment: DuelMoment, options?: { delay?: number; queue?: boolean }) => { if (this.caller.say(moment, options)) said.push(moment); };
    const key = `${duel.set}:${duel.round}`;
    if (key !== this.round) { this.round = key; this.struck = false; this.milestone.clear(); this.low.clear(); }
    // The round's number, once: in the first round's countdown, or towards the end of the break before the next.
    const number: DuelMoment = duel.round >= 3 ? 'round-final' : duel.round === 2 ? 'round-2' : 'round-1';
    const startsAt = duel.phase === 'interval' ? duel.nextRoundAt : snapshot.status === 'waiting' ? snapshot.lobby?.startsAt ?? null : null;
    if (this.announced !== key && startsAt != null && startsAt - snapshot.serverTime <= ROUND_CALL_LEAD && startsAt - snapshot.serverTime > .4) {
      this.announced = key; call(number, { queue: true });
    }
    // Who is low: a quarter of the bar or less against three fifths or more - a K.O. from there is a comeback.
    const [p, q] = players;
    const share = (x: PlayerState) => x.maxHp > 0 ? x.hp / x.maxHp : 0;
    if (share(p) <= .25 && share(q) >= .6 && p.alive) this.low.add(p.id);
    if (share(q) <= .25 && share(p) >= .6 && q.alive) this.low.add(q.id);
    const ids = new Set(players.map(x => x.id));
    const between = (e: CombatEvent) => ids.has(e.actorId) && !!e.targetId && ids.has(e.targetId) && e.actorId !== e.targetId;
    const fallen = snapshot.events.filter(e => e.kind === 'eliminated' && e.targetId && ids.has(e.targetId));
    for (const e of snapshot.events) {
      if (e.kind === 'hit' && between(e)) {
        if (!this.struck) { this.struck = true; call('first-strike'); }
        if (e.areaCombo) call('g-combo');
        else if (e.counter) call('counter');
        else if (e.punish) call('punish');
        const count = e.combo ?? 0, got = this.milestone.get(e.actorId) ?? 0;
        if (count < got) this.milestone.set(e.actorId, 0);
        const reached = count >= 15 ? 15 : count >= 10 ? 10 : count >= 5 ? 5 : 0;
        if (reached > (this.milestone.get(e.actorId) ?? 0)) { this.milestone.set(e.actorId, reached); call(`combo-${reached}` as DuelMoment); }
      } else if (e.kind === 'counter' && ids.has(e.actorId)) call('counter');
      else if (e.kind === 'just-guard' && between(e)) call(e.reason === 'deflect' ? 'deflect' : 'parry');
      else if (e.kind === 'guard-break' && between(e)) call('guard-break');
      else if (e.kind === 'wall-splat' && ids.has(e.actorId)) call('wall-splat');
    }
    if (fallen.length >= 2 || fallen.length === 1 && players.every(x => !x.alive)) call('double-ko', { queue: true });
    else if (fallen.length === 1) {
      const winner = players.find(x => x.id !== fallen[0].targetId);
      call(winner && this.low.has(winner.id) ? 'comeback' : 'ko', { queue: true });
    }
    return said;
  }
}
/** How long before the round's bell its number is said (s): FIGHT! comes on the bell. */
export const ROUND_CALL_LEAD = 1.9;
