import {BALL_ID, GOAL_RULES, SHOOT, SPIKE_RULES, onCourt, otherTeam, spikeCourt, type BallEvent, type BallModeId, type BallState, type BallTeam} from './model';
import {stepBall, type BallContact} from './physics';
import {DRILL_RIVAL, DrillRunner, arc, clearsNet, type DrillHost, type DrillId} from './drills';
import {MOVES, jumpArc} from '../moves';
import {VOLLEY, volleyArc} from './volley';
import type {PlayerInput, PlayerState} from '../types';

/**
 * LEARN TO PLAY. The ball modes' how-to-play linked the fighting game's
 * LEARN TO FIGHT (guard, parry, a technique, your ultimate) and showed its defence basics: neither teaches the sport. A
 * new player who opens Goal Rush or Sky Spike learns it here in about a minute, on this device, one short step at a time
 * - each a setup (FREE PLAY's ball machine, drills.ts, and two or three scripted bodies), a line in the device's own keys
 * (the page's: ui/ball/LearnToPlay.ts), a clear check made from the match's own moments, and praise - and it ends in a
 * real match offered on the spot.
 *
 *  - Goal Rush: RUN & BOOST to the ball; PASS to a team-mate; SHOOT their lay-off in; a PERFECT STRIKE off their pass
 *    across; a HEADER off their cross; FIGHT & TACKLE the one running the ball at your goal (the TACKLE drill's first
 *    stage, drills.ts); then SCORE with it, the one you tackled chasing.
 *  - Sky Spike: BUMP a serve; SET a team-mate's bump; the spike approach - jump as it peaks, swing at the top - for a
 *    PERFECT SPIKE (the PERFECT SPIKE drill's set, drills.ts); BLOCK their hitter at the glint; DIVE for a hard drive;
 *    a JUMP SERVE of your own.
 *
 * A step is checked from the moments, never raw keys (a remapped key, a pad or the touch set all count): a PASS is a
 * ball of yours reaching the team-mate, a PERFECT STRIKE the strike event's `perfect`, a BUMP or a SET your swing's
 * touch (the body's own bump does not count: the ball "bumped for you"), a BLOCK the block's event. A try that fails
 * says why (`miss`: EARLY, LATE, NOT PRESSED ...) and the ball comes again a breath later; SKIP STEP passes one over.
 *
 * Data and rules only, as everything under src/game: BallMatch is the host (it runs the lesson on its ball machine's
 * slot, as a drill, and adds the cast's seats), the page draws it.
 */
export type LessonStepId = 'gr-run' | 'gr-pass' | 'gr-shoot' | 'gr-perfect' | 'gr-header' | 'gr-tackle' | 'gr-score'
  | 'ss-bump' | 'ss-set' | 'ss-spike' | 'ss-block' | 'ss-dive' | 'ss-serve';
export interface LessonStepDef {
  id: LessonStepId; title: string;
  /** The drill whose ball machine runs the step (drills.ts), its first balls only (its easiest stage). */
  drill?: DrillId;
  /** The ball rests where the step puts it (no ball comes in): the step is on at once, its line read as you go. */
  rests?: true;
}
export const LESSON: Readonly<Record<BallModeId, readonly LessonStepDef[]>> = {
  'goal-rush': [
    {id: 'gr-run', title: 'RUN & BOOST', rests: true},
    {id: 'gr-pass', title: 'PASS', rests: true},
    {id: 'gr-shoot', title: 'SHOOT', rests: true},
    {id: 'gr-perfect', title: 'PERFECT STRIKE'},
    {id: 'gr-header', title: 'HEADER'},
    {id: 'gr-tackle', title: 'FIGHT & TACKLE', drill: 'gr-tackle'},
    {id: 'gr-score', title: 'SCORE', rests: true},
  ],
  'sky-spike': [
    {id: 'ss-bump', title: 'BUMP'},
    {id: 'ss-set', title: 'SET'},
    {id: 'ss-spike', title: 'PERFECT SPIKE', drill: 'ss-perfect'},
    {id: 'ss-block', title: 'BLOCK'},
    {id: 'ss-dive', title: 'DIVE'},
    {id: 'ss-serve', title: 'JUMP SERVE'},
  ],
};
/** Goal Rush's team-mate in the lesson: the one you pass to and who lays it back, crosses and makes the run. */
export const LESSON_MATE = 'lesson-mate';
/** The bodies the lesson brings to its match (BallMatch.start adds them as bots, the lesson's hands on them: `command`):
 *  Goal Rush's team-mate, and its opponent in the TACKLE drill's carrier's seat (that drill reads it: BallMatch.rival);
 *  Sky Spike's opponent across the net - the server the serves come from, the hitter the block is timed to. */
export const LESSON_CAST: Readonly<Record<BallModeId, readonly {id: string; side: 'mine' | 'theirs'}[]>> = {
  'goal-rush': [{id: LESSON_MATE, side: 'mine'}, {id: DRILL_RIVAL, side: 'theirs'}],
  'sky-spike': [{id: DRILL_RIVAL, side: 'theirs'}],
};

/** Why the last try did not count (the page's note under the line):
 *  boost - reached the ball without boosting; pass - the pass missed the team-mate; wide - the shot missed;
 *  early / late - the PERFECT STRIKE's press; plain - a goal, but not the step's own shot; jump - no jump into it (the
 *  header; the spike off the floor); lock - never went to FIGHT; tackle - the carrier got its shot away; press - the
 *  body bumped it, not your swing; under - it came down untouched; top - a spike on the way up, not at the top; block -
 *  their spike came through; dive - the hard ball got past; float - a serve off the floor, not jumped; time - the ball's
 *  time ran out. */
export type LessonMiss = 'boost' | 'pass' | 'wide' | 'early' | 'late' | 'plain' | 'jump' | 'lock' | 'tackle' | 'press' | 'under' | 'top' | 'block' | 'dive' | 'float' | 'time';
/** The lesson as every screen sees it (BallView.lesson). Times are the match's own clock. */
export interface LessonView {
  mode: BallModeId;
  /** The step on now (its index in LESSON[mode]); LESSON[mode].length once it is over. */
  index: number;
  step: LessonStepId | null;
  /** intro: the line up, the ball still to come; live: the try under way; retry: a try missed, the ball coming again;
   *  done: the step done, its praise on screen; over: every step done or skipped. */
  state: 'intro' | 'live' | 'retry' | 'done' | 'over';
  /** When the state began. */
  at: number;
  done: LessonStepId[]; skipped: LessonStepId[];
  /** Tries missed on this step, and why the last one was. */
  tries: number; miss: LessonMiss | null;
  /** A two-part step's halves (RUN & BOOST: boosted, reached the ball). */
  parts: boolean[];
  /** The step's praise once it is done: GOOD RUN, PERFECT STRIKE!, STUFF BLOCK! ... */
  praise: string;
  /** VOLLEYBALL (volley.ts): Sky Spike's lesson played by volleyball's rules (`?volleyball`), for its copy. */
  volley?: boolean;
  /** The PERFECT STRIKE's timing cue while the pass comes in: 0 as it leaves the team-mate, 1 the moment to press (the
   *  blow's wind-up and lunge before the ball arrives: `pressAt`), past 1 a moment after; null with no ball coming. */
  cue: number | null;
  /** The PERFECT STRIKE step for a fighter whose SHOOT is not a melee blow (a beam, a projectile: no PERFECT STRIKE can
   *  come off it): a goal struck first time off the pass instead. */
  firstTime?: boolean;
  /** Goal Rush's SPORT mode (football.ts, `?football`): the lesson is played on its rules - possession, PASS, SHOOT, and
   *  its FIRST TIME step in the PERFECT STRIKE's place. */
  sport?: boolean;
  /** SHOOT for a fighter whose heavy launches (Konta, Taisei and a quarter of the roster): their SHOOT pops a ball at
   *  rest straight up, so the step is a SHOOT met as the team-mate's pass arrives (the timing bar: a timed one flies,
   *  strike.ts), the way they score in a match; and SCORE asks for the pass to the team-mate's run. */
  pops?: boolean;
}
/** When to press for a PERFECT STRIKE on a ball coming in (BallMatch PERFECT_STRIKE): the ball's closing speed times
 *  the blow's wind-up (its first contact) before it is this many metres off - the blow's step-in and reach. SHOOT's
 *  quick strike (model.ts SHOOT) is the same blow for every fighter, so this is one number: the middle of the window
 *  every fighter shares on the lesson's own pass (PERFECT_PASS: 1.90 to 3.63 m, twelve ticks wide, the same for all
 *  hundred). (Each fighter's own heavy, its lunge and reach, would put it anywhere from 1.9 to 5.9 m, and a fighter
 *  whose heavy is a beam or a projectile would have no PERFECT STRIKE on SHOOT at all.) */
export const STRIKE_MEET = 2.75;
/** The PERFECT STRIKE's pass: the person stands `from` of a half-length back from the goal they attack (halfway), the
 *  team-mate by its byline plays it back at `speed` m/s along the floor; across the pitch they stand at `x` of its
 *  half-width (the person's, the team-mate's). */
export const PERFECT_PASS = {from: 1, speed: 12, x: [-.08, .1]} as const;
/** The cue's run-up: the bar fills over this long before the moment, s. */
export const CUE_LEAD = .8;
/** Where the ball is when SHOOT should be pressed for a PERFECT STRIKE, m (STRIKE_MEET). */
export function pressAt(closing: number): number {
  return STRIKE_MEET + closing * SHOOT.contact;
}
/** Whether a fighter's SHOOT has a PERFECT STRIKE window on the lesson's pass at all. Every fighter's
 *  (the quick strike is a melee blow whoever throws it), so no step asks for a first-time goal instead (`firstTime`). */
export const strikesPerfect = (_fighter: PlayerState['fighter']) => true;
/** A fighter whose SHOOT pops a ball at rest up instead of shooting it. Nobody's (the quick strike drives
 *  it, and a heavy wound up on the floor shoots: strike.ts), so SHOOT and SCORE are the same step for everyone (`pops`). */
export const launches = (_fighter: PlayerState['fighter']) => false;
/** The HEADER's jump: the cross comes in at `height` m (over a standing body, under a jumping one's head), and a jump
 *  leaving `lead` s before it arrives meets it on the way up (measured: from 0.18 s to 0.02 s before, on Taisei's and
 *  Aqrab's jumps). */
export const HEADER_CROSS = {height: 3, lead: .1} as const;
/** The beats, seconds: the line read before a ball comes in, the praise on screen before the next step, the breath
 *  after a miss, the most a try is given (SCORE's, the person's own serve's), and a goal's moment before the next ball
 *  (BallHud's banner, 2.3 s, and its confetti: a pass coming in under them could not be read). */
export const LESSON_TIMES = {intro: 1.4, beat: 1.3, retry: 1, ball: 8, score: 20, serve: 12, goal: 2.6} as const;
/** The BLOCK step's hitter (BallLesson.plan): its swing goes `swing` s short of the top of its jump (BallBrain's
 *  APEX_SWING), the spike `spike` s after the press - before the air blow's own contact can land, which for a quick
 *  air blow comes inside a fifth of a second (BallBrain's APEX_CONTACT is an average): a swing that lands first spikes
 *  it at the top of the jump, a PERFECT SPIKE through any block but a STUFF BLOCK - at `speed`
 *  m/s, a plain spike's, down through the person's block; the DIVE's at `drive`, past them (a DIG's from: SPIKE_DIG). It
 *  stands `back` m behind where the set peaks: nearer, its body climbing past the ball plays it (CLIMB, the takraw rule). */
const HITTER = {swing: .1, spike: .05, speed: 16, drive: 20, back: 2.1} as const;
/** The lesson's set for their hitter on the volleyball rules peaks this high (m): over a raised hand at the top of
 *  volleyball's jump (volley.ts volleyArc, VOLLEY.air.hand), as a match's set comes down to it. */
const VOLLEY_SET_TOP = 4.2;
/** A press of the person's counts toward a touch of theirs (BUMP, SET) this soon before it, s. */
const PRESSED = .5;
/** A step run by a drill keeps to the drill's first `stage` balls (its easiest), a fresh drill after them. */
const STAGE = 3;

/** What the lesson needs of its match (BallMatch), over a drill's. */
export interface LessonHost extends DrillHost {
  /** A seat's body as the kernel has it now. */
  stateOf(id: string): PlayerState | undefined;
  /** Goal Rush: whether a seat is in the FIGHT stance (locked on an opponent). */
  locked(id: string): boolean;
  /** A body put on a spot, facing, standing still. */
  put(id: string, x: number, z: number, yaw: number): void;
  /** Sky Spike: the person's own serve - the ball hung at their baseline, they behind it - for `seconds` at most. */
  servePerson(seconds: number): void;
}

const flat = (a: {x: number; z: number}, b: {x: number; z: number}) => Math.hypot(a.x - b.x, a.z - b.z);
const yawTo = (from: {x: number; z: number}, to: {x: number; z: number}) => Math.atan2(to.x - from.x, to.z - from.z);
const SWINGS: ReadonlySet<string> = new Set(['light', 'heavy', 'special', 'ultimate', 'area']);
const DOWN: ReadonlySet<string> = new Set(['knockdown', 'launched', 'splat', 'getup', 'defeated', 'stun']);
/** The end of a rally (Sky Spike), whoever won it. */
const RALLY_OVER: ReadonlySet<BallEvent['kind']> = new Set(['point', 'kill', 'ace', 'out', 'touches', 'fault', 'net']);
/** Scratch for reading a ball's flight ahead. */
const probe = {} as BallState, contacts: BallContact[] = [];

/** One lesson being run. BallMatch steps it after every tick, asks it for its bodies' commands, and hands it Sky Spike's
 *  machine serves. */
export class BallLesson {
  readonly view: LessonView;
  private seen = 0;
  /** When the last goal went in (the next ball waits for its moment). */
  private goalAt = -Infinity;
  /** The drill running the step (LessonStepDef.drill), and how many of its results have been read. */
  private sub?: DrillRunner;
  private subRead = 0;
  /** A ball is wanted from Sky Spike's machine (it comes at its next serve: `serve`). */
  private want = false;
  /** When the try's ball came in. */
  private fedAt = 0;
  /** The try so far: boosted (RUN & BOOST), the person's last swing (a press, not the body), the person ever in the
   *  FIGHT stance, a swing thrown with the ball still far off (the PERFECT STRIKE's EARLY), the ball nearest the person
   *  so far, the person's strike and whether it left the floor, and the last toucher seen. */
  private boosted = false;
  private swungAt = -Infinity;
  private fought = false;
  private early = false;
  private nearest = Infinity;
  private struck: {at: number; grounded: boolean; perfect: boolean} | null = null;
  private toucher: string | null = null;
  /** SCORE: the team-mate's first-time finish, once a pass of yours has reached them. */
  private finished = false;
  /** The BLOCK step's hitter: when it leaves the floor, when it swings, where it stands, and the machine's own spike if its
   *  swing misses. */
  private hitter = {jump: Infinity, swing: Infinity, hold: 0, x: 0, z: 0, spike: Infinity};
  /** The DIVE step's drive goes this way across the person (-1, 1). */
  private dive = 1;
  private seq = 0;
  constructor(readonly mode: BallModeId, private readonly rng: () => number, sport = false) {
    this.view = {mode, index: 0, step: LESSON[mode][0].id, state: 'intro', at: -1, done: [], skipped: [], tries: 0, miss: null, parts: [], praise: '', cue: null, ...(sport ? {sport: true} : {})};
  }
  private get def(): LessonStepDef | undefined { return LESSON[this.mode][this.view.index]; }
  private rand(a: number, b: number) { return a + (b - a) * this.rng(); }
  /** Every step done or skipped. */
  get over() { return this.view.state === 'over'; }

  // ─── The steps' clock ────────────────────────────────────────────────────────────────────────────────────────────
  /** Every tick: the step's beats, its ball, and the try judged against the match's new moments. */
  step(host: LessonHost) {
    const v = this.view, now = host.now();
    const fresh = host.view.events.filter(e => e.id > this.seen);
    if (fresh.length) this.seen = fresh[fresh.length - 1].id;
    for (const e of fresh) if (e.kind === 'goal' || e.kind === 'own-goal') this.goalAt = e.at;
    if (v.state === 'over') return;
    if (v.at < 0) this.open(host);
    const me = host.person();
    if (!me) return;
    const body = host.stateOf(me.id);
    if (me.swinging) this.swungAt = now;
    if (body?.boost) this.boosted = true;
    if (host.locked(me.id)) this.fought = true;
    if (v.state === 'done') { if (now - v.at >= LESSON_TIMES.beat) this.next(host); return; }
    if (v.state === 'intro' || v.state === 'retry') {
      if (now - v.at >= (v.state === 'intro' ? LESSON_TIMES.intro : LESSON_TIMES.retry)) this.launch(host);
      return;
    }
    if (this.sub) { this.sub.step(host); this.drilled(host, fresh); return; }
    this.judge(host, fresh);
  }
  /** Sky Spike's machine serving (BallMatch.autoServe): the ball the step wants, else the machine stays still. Always
   *  the lesson's (true). */
  serve(host: LessonHost): boolean {
    const v = this.view;
    if (v.state === 'over') return true;
    if (this.sub && v.state === 'live') return this.sub.serve(host);
    // The person's own serve ran out of time: hung again for them.
    if (this.def?.id === 'ss-serve' && v.state === 'live') { this.missed(host, 'time'); return true; }
    if (this.want) { this.want = false; this.machineBall(host); }
    return true;
  }
  /** SKIP STEP: the step passed over at once. */
  skip(host: LessonHost) {
    const v = this.view, def = this.def;
    if (!def || v.state === 'over') return;
    if (v.state !== 'done') v.skipped.push(def.id);
    this.next(host);
  }
  /** END: every step left is skipped. */
  end() {
    const v = this.view;
    for (const s of LESSON[this.mode].slice(v.index)) if (!v.done.includes(s.id) && !v.skipped.includes(s.id)) v.skipped.push(s.id);
    v.index = LESSON[this.mode].length; v.step = null; v.state = 'over'; v.praise = '';
    this.sub = undefined; this.want = false;
  }

  private next(host: LessonHost) {
    const v = this.view;
    v.index++; this.sub = undefined; this.want = false;
    if (v.index >= LESSON[this.mode].length) { v.step = null; v.state = 'over'; v.at = host.now(); v.praise = ''; return; }
    this.open(host);
  }
  /** A step opening: its bodies on their spots, a resting ball where it rests, its line up. */
  private open(host: LessonHost) {
    const v = this.view, def = this.def!, me = host.person();
    v.step = def.id; v.state = 'intro'; v.at = host.now(); v.tries = 0; v.miss = null; v.parts = def.id === 'gr-run' ? [false, false] : []; v.praise = ''; v.cue = null;
    const fighter = me && host.stateOf(me.id)?.fighter;
    // (Goal Rush's SPORT mode, football.ts: no PERFECT STRIKE and no fighter's heavy - its step is FIRST TIME, and SHOOT
    // never pops a ball.)
    if (def.id === 'gr-perfect' && (v.sport || fighter && !strikesPerfect(fighter))) v.firstTime = true; else delete v.firstTime;
    if ((def.id === 'gr-shoot' || def.id === 'gr-score') && fighter && launches(fighter) && !v.sport) v.pops = true; else delete v.pops;
    this.subRead = 0; this.want = false; this.finished = false;
    this.fresh();
    if (!me) return;
    if (this.mode === 'goal-rush') this.goalOpen(host, def.id, me);
    else this.spikeOpen(host, def.id, me);
    if (this.rests) this.launch(host);
  }
  /** The step's ball rests where it is put (LessonStepDef.rests) - SHOOT's, but not for a fighter whose SHOOT pops it. */
  private get rests() { return !!this.def?.rests && !(this.def.id === 'gr-shoot' && this.view.pops); }
  /** The try's ball (or the step's drill) coming in. */
  private launch(host: LessonHost) {
    const v = this.view, def = this.def!;
    // (A goal's moment holds play: the ball comes once it is over - its banner and confetti too, LESSON_TIMES.goal -
    // as a drill's does.)
    if (this.mode === 'goal-rush' && (host.view.phase === 'scored' || host.now() - this.goalAt < LESSON_TIMES.goal)) return;
    // (Again after a miss: everyone back on the step's spots - a lunge at the last ball carried the person off theirs.)
    const again = v.state === 'retry' && !def.drill && !this.rests;
    v.state = 'live'; v.at = host.now(); this.fedAt = host.now();
    this.fresh();
    const me = host.person();
    if (again && me) { if (this.mode === 'goal-rush') this.goalOpen(host, def.id, me); else this.spikeOpen(host, def.id, me); }
    if (def.drill) {
      // A fresh drill after its first balls: the lesson keeps to its easiest stage.
      if (!this.sub || this.sub.view.ball >= STAGE) { this.sub = new DrillRunner(def.drill, this.rng); this.subRead = 0; }
      return;
    }
    if (this.mode === 'goal-rush') { this.goalBall(host, def.id); return; }
    if (def.id === 'ss-serve') { host.servePerson(LESSON_TIMES.serve); return; }
    // Sky Spike: the machine's ball comes at its next serve (a rally still going is ended for it).
    this.want = true;
    if (host.view.phase === 'live') host.serveNow();
  }
  private fresh() { this.boosted = false; this.early = false; this.nearest = Infinity; this.struck = null; this.toucher = null; this.hitter.spike = Infinity; this.hitter.jump = this.hitter.swing = Infinity; }
  /** The step done: its praise, a beat, the next. */
  private passed(host: LessonHost, praise: string) {
    const v = this.view, def = this.def!;
    v.cue = null;
    if (!v.done.includes(def.id)) v.done.push(def.id);
    v.state = 'done'; v.at = host.now(); v.praise = praise; v.miss = null; this.want = false;
  }
  /** The try missed: why, and the ball again a breath later. */
  private missed(host: LessonHost, why: LessonMiss) {
    const v = this.view;
    v.tries++; v.miss = why; v.state = 'retry'; v.at = host.now(); this.want = false; v.cue = null;
  }

  // ─── Goal Rush ────────────────────────────────────────────────────────────────────────────────────────────────────
  private field(team: BallTeam) {
    const R = GOAL_RULES, s = team === 'red' ? 1 : -1;
    return {R, s, X: R.halfX, Z: R.halfZ, atk: s * R.halfZ, own: -s * R.halfZ, face: s > 0 ? 0 : Math.PI, r: R.ballRadius};
  }
  /** Where the step stands everyone: the person, the team-mate and the opponent; and a resting ball. */
  private goalOpen(host: LessonHost, id: LessonStepId, me: {id: string; team: BallTeam}) {
    const {s, X, Z, atk, own, face} = this.field(me.team);
    // The opponent, out of the way until the TACKLE: by the person's own goal, off to one side.
    const parked = () => host.put(DRILL_RIVAL, .78 * X, own + s * 2.6, face + Math.PI);
    switch (id) {
      case 'gr-run':
        host.put(me.id, 0, -s * .5 * Z, face); host.put(LESSON_MATE, -.6 * X, s * .02 * Z, face); parked(); break;
      case 'gr-pass': {
        const at = {x: .25 * X, z: -s * .08 * Z}, mate = {x: -.42 * X, z: s * .3 * Z};
        host.put(me.id, at.x, at.z, yawTo(at, mate)); host.put(LESSON_MATE, mate.x, mate.z, yawTo(mate, at)); parked(); break;
      }
      case 'gr-shoot':
        if (this.view.pops) { this.passSpots(host, me.id, s, X, Z, atk, face); parked(); break; }
        host.put(me.id, 0, atk - s * .45 * Z, face); host.put(LESSON_MATE, -.48 * X, atk - s * .62 * Z, face); parked(); break;
      // (The team-mate up by the byline, the pass coming back at the person from in front: the ball cam looks at it, and a
      // strike met as it arrives goes on at the goal behind them.)
      // (From halfway: the pass is a second and a half long, so the timing bar can be read as it comes.)
      case 'gr-perfect': this.passSpots(host, me.id, s, X, Z, atk, face); parked(); break;
      case 'gr-header': host.put(me.id, 0, atk - s * .32 * Z, face); host.put(LESSON_MATE, .8 * X, atk - s * .2 * Z, face); parked(); break;
      // (The TACKLE drill puts the person and its carrier on their marks with each ball: the team-mate stands aside.)
      case 'gr-tackle': host.put(LESSON_MATE, -.75 * X, own + s * .5 * Z, face); break;
      // (SCORE carries on from the tackle where it stands: the team-mate makes a run up the wing.)
      case 'gr-score': break;
      default: break;
    }
  }
  /** The PERFECT STRIKE's spots (PERFECT_PASS): the person at halfway, the team-mate by the byline a little off the
   *  goal's middle - so the ball cam, looking at the pass as it comes, faces the person at the goal too, and a strike met
   *  as it arrives goes in. */
  private passSpots(host: LessonHost, id: string, s: number, X: number, Z: number, atk: number, face: number) {
    host.put(id, PERFECT_PASS.x[0] * X, atk - s * PERFECT_PASS.from * Z, face);
    host.put(LESSON_MATE, PERFECT_PASS.x[1] * X, atk - s * .08 * Z, face + Math.PI);
  }
  /** The try's ball: at rest where the step needs it, or played in by the team-mate. */
  private goalBall(host: LessonHost, id: LessonStepId) {
    const me = host.person()!, {s, X, Z, atk, R, r} = this.field(me.team), g = R.gravity * (host.ball.grav || 1);
    const at = host.stateOf(me.id) ?? me, mate = host.stateOf(LESSON_MATE) ?? {x: 0, z: 0};
    const rest = (x: number, z: number) => host.feed({ball: {x, y: r * (host.ball.size || 1) + .02, z, vx: 0, vy: 0, vz: 0}, team: me.team});
    switch (id) {
      case 'gr-run': rest(0, s * .42 * Z); break;
      case 'gr-pass': {
        const yaw = yawTo(at, mate);
        rest(at.x + Math.sin(yaw) * 1.6, at.z + Math.cos(yaw) * 1.6); break;
      }
      // The team-mate's lay-off, at rest a run-up in front of the person, the goal beyond it.
      // (3.4 m: from nearer, many fighters' SHOOT lunges past a ball at rest before its blow lands - measured on 34.)
      case 'gr-shoot': if (!this.view.pops) { rest(at.x, at.z + s * 3.4); break; }
      // falls through: a fighter whose SHOOT pops meets the team-mate's pass instead (LessonView.pops).
      case 'gr-perfect': {
        // The team-mate's pass across, firm along the floor into the person's feet (a ball coming in: PERFECT_STRIKE).
        const d = flat(mate, at) || 1, ux = (at.x - mate.x) / d, uz = (at.z - mate.z) / d, speed = PERFECT_PASS.speed;
        host.feed({ball: {x: mate.x + ux * 1.2, y: r + .03, z: mate.z + uz * 1.2, vx: ux * speed, vy: 0, vz: uz * speed, shot: 'tap'}, team: me.team}); break;
      }
      case 'gr-header': {
        // The cross from the byline, to head height a little in front of the person: met only by jumping into it.
        const from = {x: mate.x - Math.sign(mate.x || 1) * 1, y: 1, z: mate.z - s * .5}, k = Math.min(1, .45 / (flat(from, at) || 1));
        host.feed({ball: {...from, ...arc(from, at.x + (from.x - at.x) * k, HEADER_CROSS.height, at.z + (from.z - at.z) * k, 1.05, g, R.drag), shot: 'tap'}, team: me.team}); break;
      }
      case 'gr-score': {
        // Straight on from the tackle, the ball loose by the person: theirs to take. Again (or skipped to): the ball at
        // their feet a little into their own half, the opponent ahead, the team-mate on the wing.
        if (this.view.tries === 0 && flat(at, host.ball) < 8) break;
        const spot = {x: 0, z: -s * .08 * Z};
        host.put(me.id, spot.x, spot.z - s * 1.6, s > 0 ? 0 : Math.PI);
        host.put(DRILL_RIVAL, .1 * X, s * .3 * Z, s > 0 ? Math.PI : 0);
        host.put(LESSON_MATE, -.42 * X, s * .25 * Z, s > 0 ? 0 : Math.PI);
        rest(spot.x, spot.z); break;
      }
      default: void atk; break;
    }
  }
  private judge(host: LessonHost, events: readonly BallEvent[]) {
    const me = host.person(), def = this.def;
    if (!me || !def) return;
    if (this.mode === 'goal-rush') this.goalJudge(host, def.id, me, events);
    else this.spikeJudge(host, def.id, me, events);
  }
  private goalJudge(host: LessonHost, id: LessonStepId, me: {id: string; team: BallTeam; x: number; y: number; z: number}, events: readonly BallEvent[]) {
    const v = this.view, now = host.now(), b = host.ball, mine = (e: BallEvent) => e.actorId === me.id, d = flat(me, b);
    const goal = events.find(e => e.kind === 'goal' || e.kind === 'own-goal');
    const strike = events.find(e => e.kind === 'strike' && mine(e));
    if (strike && !this.struck) this.struck = {at: now, grounded: !!host.stateOf(me.id)?.grounded, perfect: !!strike.perfect};
    const since = now - this.fedAt, touched = b.lastId === me.id;
    switch (id) {
      case 'gr-run': {
        const reached = d < 2.6 || touched;
        if (reached !== v.parts[1] || this.boosted !== v.parts[0]) v.parts = [this.boosted, reached];
        if (reached) { if (this.boosted) this.passed(host, 'GOOD RUN'); else this.missed(host, 'boost'); }
        else if (since > LESSON_TIMES.ball + 2) this.missed(host, 'time');
        return;
      }
      case 'gr-pass': {
        const mate = host.stateOf(LESSON_MATE);
        if (!mate) return;
        if (touched && flat(mate, b) < 2.7 && b.y < 3) {
          // Trapped at the team-mate's feet: theirs now, for the lay-off.
          const yaw = yawTo(mate, me);
          Object.assign(b, {x: mate.x + Math.sin(yaw) * .9, z: mate.z + Math.cos(yaw) * .9, y: GOAL_RULES.ballRadius * (b.size || 1) + .02, vx: 0, vy: 0, vz: 0, sx: 0, sy: 0, sz: 0, lastId: LESSON_MATE, lastTeam: me.team});
          this.passed(host, 'NICE PASS');
          return;
        }
        if (touched && this.toucher !== me.id) { this.toucher = me.id; this.fedAt = now; }
        // Played and gone past them, or come to a stop away from them.
        if (touched && (now - this.fedAt > 2.6 || Math.hypot(b.vx, b.vz) < .6 && now - this.fedAt > .6)) this.missed(host, 'pass');
        else if (since > LESSON_TIMES.ball + 4) this.missed(host, 'time');
        return;
      }
      case 'gr-shoot':
        if (v.pops) this.strikeCue(host, me, d);
        if (goal) { if (goal.kind === 'goal' && mine(goal)) this.passed(host, this.struck?.perfect ? 'PERFECT STRIKE!' : 'GOAL!'); else this.missed(host, 'wide'); return; }
        // (A SHOOT that pops: the pass was not met as it arrived.)
        if (v.pops && strike?.shot === 'pop') { this.missed(host, this.early ? 'early' : 'late'); return; }
        if (this.struck && now - this.struck.at > 2.6) this.missed(host, 'wide');
        else if (v.pops && (touched && !this.struck || since > 5)) this.missed(host, 'late');
        else if (since > LESSON_TIMES.ball) this.missed(host, 'time');
        return;
      case 'gr-perfect': {
        this.strikeCue(host, me, d);
        this.nearest = Math.min(this.nearest, d);
        if (v.firstTime) {
          // (A SHOOT that is no melee blow: a goal off the person's first touch of the pass.)
          if (goal) { if (goal.kind === 'goal' && mine(goal) && this.struck) this.passed(host, 'FIRST-TIME GOAL!'); else this.missed(host, 'wide'); return; }
          if (this.struck && now - this.struck.at > 2.6 || touched && !this.struck) this.missed(host, touched && !this.struck ? 'late' : 'wide');
          else if (since > 5) this.missed(host, 'late');
          return;
        }
        if (this.struck) {
          if (this.struck.perfect) this.passed(host, 'PERFECT STRIKE!');
          else this.missed(host, goal?.kind === 'goal' && mine(goal) ? 'plain' : this.early ? 'early' : 'late');
          return;
        }
        // The ball on the body first (it got there before the blow), or gone by untouched.
        if (touched || this.nearest < 3 && d > this.nearest + 2.5 || since > 3.5) this.missed(host, this.early ? 'early' : 'late');
        return;
      }
      case 'gr-header': {
        const header = events.find(e => e.kind === 'strike' && mine(e) && e.shot === 'header');
        if (header) { this.passed(host, header.perfect ? 'PERFECT HEADER!' : 'HEADER!'); return; }
        // The cue: the moment to leave the floor, the cross's arrival less the jump's lead.
        const closing = d > .1 ? ((b.vx * (me.x - b.x)) + (b.vz * (me.z - b.z))) / d : 0;
        v.cue = !touched && closing > 2 ? Math.round(Math.max(0, Math.min(1.2, 1 - ((d - 1) / closing - HEADER_CROSS.lead) / CUE_LEAD)) * 100) / 100 : null;
        this.nearest = Math.min(this.nearest, d);
        if (this.struck || touched || this.nearest < 3 && d > this.nearest + 2.5 || since > 3.2) this.missed(host, 'jump');
        return;
      }
      case 'gr-score': {
        if (goal) { if (goal.kind === 'goal' && goal.team === me.team) this.passed(host, mine(goal) ? 'GOAL!' : 'WHAT A FINISH!'); else this.missed(host, 'wide'); return; }
        // The team-mate's first-time finish: a ball of yours reaching them on their run.
        const mate = host.stateOf(LESSON_MATE);
        if (mate && !this.finished && touched && flat(mate, b) < 3 && b.y < 2.5) this.finish(host, mate, me.team);
        if (since > LESSON_TIMES.score) this.missed(host, 'time');
        return;
      }
      default: return;
    }
  }
  /** The timing bar for a SHOOT met as the pass arrives (LessonView.cue): how near the moment to press is, by the ball's
   *  closing speed and this fighter's blow (pressAt); and a swing thrown well before it, EARLY. */
  private strikeCue(host: LessonHost, me: {id: string; x: number; z: number}, d: number) {
    const v = this.view, b = host.ball, body = host.stateOf(me.id), closing = d > .1 ? ((b.vx * (me.x - b.x)) + (b.vz * (me.z - b.z))) / d : 0;
    if (this.struck || !body || closing <= 3) { v.cue = null; return; }
    const eta = (d - pressAt(closing)) / closing;
    v.cue = Math.round(Math.max(0, Math.min(1.2, 1 - eta / CUE_LEAD)) * 100) / 100;
    if (host.person()?.swinging && eta > .12) this.early = true;
  }
  /** SCORE: the team-mate strikes a ball of yours first time at the far corner. */
  private finish(host: LessonHost, mate: PlayerState, team: BallTeam) {
    const b = host.ball, {R, atk} = this.field(team), tx = -Math.sign(mate.x || 1) * (R.goalHalfWidth - 1.2), t = flat(b, {x: tx, z: atk}) / 24;
    Object.assign(b, arc(b, tx, 1.3, atk, Math.max(.3, t), R.gravity * (b.grav || 1), R.drag), {lastId: LESSON_MATE, lastTeam: team, shot: 'power', heat: Math.max(b.heat, 1)});
    this.finished = true;
  }

  // ─── Sky Spike ────────────────────────────────────────────────────────────────────────────────────────────────────
  /** Sky Spike's court for the steps: the ball's (LEARN TO PLAY on the volleyball rules is taught on volleyball's
   *  court for three a side, BallMatch), its measures in R; `on` carries a spot laid out on the classic court onto it. */
  private court(team: BallTeam, host?: {readonly ball: BallState}) {
    const C = spikeCourt(host?.ball), R = {...SPIKE_RULES, courtHalfX: C.x, courtHalfZ: C.z}, c = team === 'red' ? -1 : 1;
    return {R, c, face: c < 0 ? 0 : Math.PI, machine: otherTeam(team), on: (x: number, z: number) => onCourt(C, x, z)};
  }
  private spikeOpen(host: LessonHost, id: LessonStepId, me: {id: string; team: BallTeam}) {
    const {R, c, face, on} = this.court(me.team, host);
    const far = (x: number, z: number) => host.put(DRILL_RIVAL, x, -c * z, face + Math.PI);
    switch (id) {
      case 'ss-bump': host.put(me.id, 0, c * on(0, 6.5).z, face); far(0, R.courtHalfZ + .6); break;
      case 'ss-set': host.put(me.id, 0, c * on(0, 4.4).z, face); far(on(-3, 5).x, on(-3, 5).z); break;
      case 'ss-block': {
        const x = this.rand(-2.2, 2.2);
        this.hitter.x = x; this.hitter.z = -c * 3.4;
        host.put(me.id, x, c * 1.05, face); far(x, 3.4); break;
      }
      case 'ss-dive': {
        // (Their hitter on the far side of the court from the way the drive will go, a step further back than the block's.)
        this.dive = this.rng() < .5 ? -1 : 1;
        const x = -this.dive * this.rand(.5, 1.5);
        this.hitter.x = x; this.hitter.z = -c * 3.6;
        host.put(me.id, 0, c * on(0, 6.5).z, face); far(x, 3.6); break;
      }
      default: far(on(3, 6).x, on(3, 6).z); break;
    }
  }
  /** The machine's ball for the step, at its serve. */
  private machineBall(host: LessonHost) {
    const me = host.person(), def = this.def;
    if (!me || !def) return;
    const {R, c, machine, on} = this.court(me.team, host), g = R.gravity * (host.ball.grav || 1), at = host.stateOf(me.id) ?? me, them = host.stateOf(DRILL_RIVAL);
    this.fresh(); this.fedAt = host.now();
    switch (def.id) {
      case 'ss-bump': {
        // A lobbed serve from their baseline, dropping a step or so from the person.
        const from = {x: them?.x ?? 0, y: 2.3, z: -c * (R.courtHalfZ - .3)}, side = this.rng() < .5 ? -1 : 1;
        const tx = Math.max(-R.courtHalfX + 1, Math.min(R.courtHalfX - 1, at.x + side * this.rand(.6, 1.5))), tz = at.z + this.rand(-.8, .8);
        let t = 1.75, vel = arc(from, tx, R.ballRadius, tz, t, g, R.drag);
        for (let i = 0; i < 20 && !clearsNet(from, vel, g); i++) { t *= 1.07; vel = arc(from, tx, R.ballRadius, tz, t, g, R.drag); }
        host.feed({ball: {...from, ...vel, shot: 'serve'}, team: machine, touchTeam: machine, touches: R.touches});
        return;
      }
      case 'ss-set': {
        // A team-mate's bump from the back of the court up to the person: the first touch spent.
        const from = {x: at.x + this.rand(-2, 2) * on(1, 1).x, y: 1.2, z: c * on(0, 9).z};
        host.feed({ball: {...from, ...arc(from, at.x, 1.7, at.z - c * .25, 1.3, g, R.drag), shot: 'bump'}, team: me.team, touchTeam: me.team, touches: 1});
        return;
      }
      case 'ss-block': {
        // Their set, up at the net on their side for the hitter (the glint the page draws on them at the top of their jump).
        // (VOLLEYBALL: the block is the jump, met at its top - the set as high as a hitter's at the top of theirs,
        // so the spike crosses the net where a blocker's hands are: volley.ts VOLLEY.block.)
        // (On volleyball's jump, model.ts VOLLEY_JUMP, the hitter's raised hand at the top is about 3.5 m up.)
        const top = {x: this.hitter.x + this.rand(-.4, .4), y: this.view.volley ? VOLLEY_SET_TOP : 5.1, z: -c * 1.5}, from = {x: top.x + this.rand(-1.5, 1.5), y: 1.6, z: -c * 5};
        const t = 1.05, vel = arc(from, top.x, top.y, top.z, t, g, R.drag);
        host.feed({ball: {...from, ...vel, shot: 'set'}, team: machine, touchTeam: machine, touches: 2});
        this.plan(host, them);
        return;
      }
      case 'ss-dive': {
        // Their set, a little off the net, for the hitter's hard spike to one side of the person (machineSpike).
        const top = {x: this.hitter.x + this.rand(-.3, .3), y: this.view.volley ? VOLLEY_SET_TOP : 5.2, z: -c * 2.3}, from = {x: top.x + this.rand(-1.5, 1.5), y: 1.6, z: -c * 5.6};
        host.feed({ball: {...from, ...arc(from, top.x, top.y, top.z, 1.05, g, R.drag), shot: 'set'}, team: machine, touchTeam: machine, touches: 2});
        this.plan(host, them);
        return;
      }
      default: return;
    }
  }
  /** The BLOCK step's hitter: under where the set peaks, a step back from the net, off the floor so the top of its jump
   *  meets the ball there - the glint the page draws on it - and its swing on the way to the top. The spike itself is the
   *  machine's, as the swing comes through (`machineSpike`): a spike struck from the top of the jump would be a PERFECT
   *  SPIKE, which goes through every block but a STUFF BLOCK - not the first block anyone should have to make. The swing's
   *  own contact finds the ball already sent (BallMatch.sentBy). */
  private plan(host: LessonHost, them: PlayerState | undefined) {
    const now = host.now(), b = host.ball, arcOf = this.view.volley ? volleyArc(them?.fighter ?? 'konta') : jumpArc(them?.fighter ?? 'konta');
    probe.ground = probe.spring = probe.windX = probe.windZ = undefined;
    Object.assign(probe, b); probe.held = false;
    // The moment the set comes down to the hitter's reach at the top of the jump (its feet at the apex, the hand over it).
    const reach = arcOf.apex + (this.view.volley ? VOLLEY.air.hand : 1.9);
    let t = 0, peak = {x: b.x, z: b.z, t: 0};
    for (; t < 2.5; t += 1 / 60) {
      stepBall('sky-spike', probe, 1 / 60, contacts);
      if (probe.vy > 0) peak = {x: probe.x, z: probe.z, t};
      else if (probe.y <= reach) break;
    }
    const contact = Math.max(peak.t + .1, t);
    const c = Math.sign(b.z) || 1;
    // (`back` from it: a body nearer climbs into the ball and plays it before the swing - the
    // third touch's body bump, BallMatch.bodyContacts.)
    this.hitter.x = peak.x; this.hitter.z = peak.z + c * HITTER.back;
    // (Its swing, BallBrain's spike: pressed just short of the top - sooner, the air blow brakes the climb - and the
    // machine's spike just before the air blow's own contact lands.)
    this.hitter.jump = now + Math.max(.15, contact - arcOf.rise);
    this.hitter.swing = this.hitter.jump + Math.max(.05, arcOf.rise - HITTER.swing);
    this.hitter.spike = this.hitter.swing + HITTER.spike;
  }
  private spikeJudge(host: LessonHost, id: LessonStepId, me: {id: string; team: BallTeam}, events: readonly BallEvent[]) {
    const v = this.view, now = host.now(), b = host.ball, mine = (e: BallEvent) => e.actorId === me.id;
    const ended = events.find(e => RALLY_OVER.has(e.kind));
    const strike = events.find(e => e.kind === 'strike' && mine(e));
    if (strike && !this.struck) this.struck = {at: now, grounded: !!host.stateOf(me.id)?.grounded, perfect: !!strike.perfect};
    // A touch of the person's: theirs the moment the ball's last toucher becomes them.
    const touchedNow = b.lastId === me.id && this.toucher !== me.id;
    if (b.lastId !== this.toucher) this.toucher = b.lastId;
    const pressed = now - this.swungAt < PRESSED;
    const since = now - this.fedAt;
    switch (id) {
      case 'ss-bump':
        if (touchedNow) { if (b.shot === 'bump' || b.shot === 'dig' || b.shot === 'set') { if (pressed) this.passed(host, 'GOOD BUMP'); else this.missed(host, 'press'); } else this.missed(host, 'under'); return; }
        if (ended || since > LESSON_TIMES.ball) this.missed(host, 'under');
        return;
      case 'ss-set':
        if (touchedNow) { if (b.shot === 'set' && pressed) this.passed(host, 'NICE SET'); else this.missed(host, pressed ? 'plain' : 'press'); return; }
        if (ended || since > LESSON_TIMES.ball) this.missed(host, 'under');
        return;
      case 'ss-block': {
        const block = events.find(e => (e.kind === 'block' || e.kind === 'perfect' && e.text === 'STUFF BLOCK') && mine(e));
        if (block) { this.passed(host, block.kind === 'perfect' ? 'STUFF BLOCK!' : 'BLOCK!'); return; }
        // Their spike, as the hitter's swing comes through at the top of the jump.
        if (now >= this.hitter.spike && b.lastTeam !== me.team && b.shot === 'set') this.machineSpike(host, me.team);
        if (ended || touchedNow || since > LESSON_TIMES.ball) this.missed(host, 'block');
        return;
      }
      case 'ss-dive': {
        if (now >= this.hitter.spike && b.lastTeam !== me.team && b.shot === 'set') this.machineSpike(host, me.team, true);
        const dig = events.find(e => e.kind === 'dig' && mine(e));
        if (dig) { this.passed(host, dig.text === 'DIVING DIG' ? 'DIVING DIG!' : 'DIG!'); return; }
        if (ended || touchedNow || since > LESSON_TIMES.ball) this.missed(host, 'dive');
        return;
      }
      case 'ss-serve': {
        if (strike && strike.shot === 'serve') {
          if (strike.text === 'JUMP SERVE' || strike.text === 'PERFECT SERVE') this.passed(host, strike.text === 'PERFECT SERVE' ? 'PERFECT SERVE!' : 'JUMP SERVE!');
          else this.missed(host, 'float');
        }
        return;
      }
      default: return;
    }
  }
  /** Their hitter's spike, as its swing comes through (`plan`): down from where the ball hangs into the person's court -
   *  through where they stand at the net (BLOCK), or hard and a dive's reach to one side of them (DIVE). */
  private machineSpike(host: LessonHost, team: BallTeam, wide = false) {
    const {R, on} = this.court(team, host), b = host.ball, me = host.stateOf(host.person()!.id), c = team === 'red' ? -1 : 1, g = R.gravity * (b.grav || 1);
    this.hitter.spike = Infinity;
    if (b.held || !me) return;
    const tx = Math.max(-R.courtHalfX + 1, Math.min(R.courtHalfX - 1, me.x + (wide ? this.dive * this.rand(3, 3.5) : this.rand(-.4, .4))));
    const tz = wide ? c * this.rand(on(0, 5.8).z, on(0, 7.2).z) : c * this.rand(3.5, 4.5);
    let t = flat(b, {x: tx, z: tz}) / (wide ? HITTER.drive : HITTER.speed), vel = arc(b, tx, R.ballRadius, tz, t, g, R.drag);
    for (let i = 0; i < 20 && !clearsNet(b, vel, g); i++) { t *= 1.07; vel = arc(b, tx, R.ballRadius, tz, t, g, R.drag); }
    Object.assign(b, vel, {shot: 'spike', heat: Math.max(b.heat, 1.5), lastId: DRILL_RIVAL, lastTeam: otherTeam(team)});
    host.view.touchTeam = otherTeam(team); host.view.touches = R.touches;
  }

  // ─── A step run by a drill ─────────────────────────────────────────────────────────────────────────────────────────
  /** The drill's verdicts on its balls, read as the lesson's tries; and why a missed one was missed. */
  private drilled(host: LessonHost, events: readonly BallEvent[]) {
    const sub = this.sub!, me = host.person();
    if (!me) return;
    const strike = events.find(e => e.kind === 'strike' && e.actorId === me.id);
    if (strike && !this.struck) this.struck = {at: host.now(), grounded: !!host.stateOf(me.id)?.grounded, perfect: !!strike.perfect};
    if (sub.view.results.length <= this.subRead) return;
    const hit = sub.view.results[this.subRead++];
    if (hit) { this.passed(host, this.def!.id === 'gr-tackle' ? 'TACKLE!' : 'PERFECT SPIKE!'); return; }
    // (A drill's miss: counted, the drill's own breath before its next ball - the lesson's state stays live.)
    const v = this.view;
    v.tries++; v.miss = this.def!.id === 'gr-tackle' ? (this.fought ? 'tackle' : 'lock') : !this.struck ? 'under' : this.struck.grounded ? 'jump' : 'top';
    this.struck = null;
    // A fresh drill after its first balls: the lesson keeps to its easiest stage.
    if (sub.view.ball >= STAGE) { this.sub = new DrillRunner(this.def!.drill!, this.rng); this.subRead = 0; }
  }

  // ─── The lesson's hands on its bodies ──────────────────────────────────────────────────────────────────────────────
  /** A command for one of the cast's bodies this tick (BallMatch steps it instead of its bot); undefined: not the
   *  lesson's. */
  command(host: LessonHost, id: string): PlayerInput | undefined {
    if (!LESSON_CAST[this.mode].some(c => c.id === id)) return undefined;
    const me = host.person(), body = host.stateOf(id), b = host.ball;
    const still: PlayerInput = {seq: ++this.seq, moveX: 0, moveZ: 0, yaw: body ? yawTo(body, b) : 0, guard: false, targetId: BALL_ID};
    if (!me || !body) return still;
    const def = this.def, live = this.view.state === 'live';
    // The TACKLE drill's carrier is the drill's.
    if (this.sub && id === DRILL_RIVAL) return this.sub.command(host, id) ?? still;
    const go = (to: {x: number; z: number}, pace: number, stop = .5): PlayerInput => {
      const dx = to.x - body.x, dz = to.z - body.z, d = Math.hypot(dx, dz);
      return d > stop ? {...still, moveX: dx / d * pace, moveZ: dz / d * pace, yaw: Math.atan2(dx, dz)} : still;
    };
    if (this.mode === 'goal-rush' && def?.id === 'gr-score' && live) {
      const {s, X, Z, atk} = this.field(me.team);
      // The team-mate's run up the wing, level with the ball or ahead of it; the opponent jogs after the ball (it never
      // swings: the step is the person's).
      if (id === LESSON_MATE) return this.finished ? still : go({x: -.45 * X, z: Math.max(-Z, Math.min(Z, s > 0 ? Math.max(b.z + 4, atk - s * .55 * Z) : Math.min(b.z - 4, atk - s * .55 * Z)))}, .75, 1);
      if (id === DRILL_RIVAL) return DOWN.has(body.action) || !body.alive ? still : go(b, .42, 1.6);
    }
    // (The PERFECT STRIKE's team-mate, its pass played, steps out of the line of the shot.)
    if (this.mode === 'goal-rush' && (def?.id === 'gr-perfect' || def?.id === 'gr-shoot' && this.view.pops) && live && id === LESSON_MATE) { const {X} = this.field(me.team); return go({x: .75 * X, z: body.z}, 1, .4); }
    if (this.mode === 'sky-spike' && (def?.id === 'ss-block' || def?.id === 'ss-dive') && id === DRILL_RIVAL) return this.hit(host, body, me.id, still, go);
    return still;
  }
  /** The BLOCK step's hitter: to its spot, off the floor on time (held to the top of the jump), and the spike at the
   *  person - so the block's timing is the glint's. */
  private hit(host: LessonHost, body: PlayerState, target: string, still: PlayerInput, go: (to: {x: number; z: number}, pace: number, stop?: number) => PlayerInput): PlayerInput {
    const now = host.now(), h = this.hitter, me = host.stateOf(target);
    const aim = me ? {x: me.x, z: me.z + (Math.sign(me.z) || 1) * 2.5} : {x: 0, z: 0};
    if (now >= h.jump && now < h.jump + 1 / 30 && body.grounded) { h.hold = now + .45; return {...still, yaw: yawTo(body, aim), jump: true, jumpHeld: true}; }
    if (now >= h.swing && now < h.swing + 1 / 30 && !body.grounded) return {...still, yaw: yawTo(body, aim), attack: 'heavy', jumpHeld: now < h.hold};
    if (!body.grounded) return {...still, yaw: yawTo(body, aim), jumpHeld: now < h.hold};
    return Number.isFinite(h.jump) && now < h.jump ? go({x: h.x, z: h.z}, .8, .25) : still;
  }
}
