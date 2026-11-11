import * as THREE from 'three';
import {CLASH, SPIKE_RULES, ballOf, ballRadius, type BallEvent, type BallModeId, type BallView} from '../../game/ball/model';
import type {GameSnapshot, Vec3} from '../../game/types';
import type {FollowCamera} from '../FollowCamera';
import {inkShown} from './SoundWords';

/** What the moments drive: the renderer's frame answers (GameRenderer's post API). */
export interface MomentFrame {
  impactFrame(strength: number, at?: THREE.Vector3, hold?: number): void;
  chromaticPulse(amount: number): void;
  speedLines(amount: number): void;
  inkFlash(seconds: number): void;
  inkKeep(point: Vec3 | null, radius?: number): void;
  /** The finished picture bumped in toward a world point for a breath (GameRenderer.screenPunch). */
  screenPunch?(amount: number, at?: Vec3): void;
}
/** Each lens on the match this frame and the body it follows: one, or a split screen's two. (A lens is whatever takes a
 *  moment's weight: the follow camera, or Goal Rush's ball cam rig beside it, render/ball/BallChase.ts.) */
export type MomentLenses = () => readonly (readonly [Pick<FollowCamera, 'impact'> | undefined, Vec3 | undefined])[];

/** A peak's size: the paper impact frame's strength, the speed lines' (and for how long), the colour fringe, the INK
 *  FLASH's seconds, the screen punch (the picture bumped in, the lens left where it is), the shake at the
 *  moment's own spot, and whether the lens punches in. `near` keeps the frame, the fringe and the INK FLASH to a viewer
 *  within that many metres of the moment (0: everyone's). */
interface Peak { frame: number; lines: number; linesFor: number; chroma: number; ink: number; zoom: number; shake: number; punch: 0 | 1 | 2; near?: number }
const PEAKS = {
  // ── The ones that may print the whole screen (the quiet rule: `printCause`). ──
  super: {frame: 1, lines: .95, linesFor: .55, chroma: 1, ink: .5, zoom: 1, shake: .85, punch: 2},
  goal: {frame: 1, lines: .9, linesFor: .6, chroma: 1, ink: .55, zoom: 1, shake: .9, punch: 2},
  // A screamer - a goal struck at 110 km/h or more, or a SUPER GOAL - holds the inked page longer.
  screamer: {frame: 1, lines: 1, linesFor: .7, chroma: 1, ink: .72, zoom: 1, shake: 1, punch: 2},
  // A TECHNIQUE DUEL's end (the shot dying on the guard prints the INK FLASH). The shot breaking
  // through holds a breath of the page too, so the goal it scores a moment later keeps that page up instead of striking
  // a second one.
  duelStopped: {frame: 1, lines: .9, linesFor: .5, chroma: 1, ink: .5, zoom: 1, shake: 1, punch: 2},
  duelThrough: {frame: .9, lines: .9, linesFor: .45, chroma: 1, ink: .3, zoom: 1, shake: .85, punch: 2},
  // Sky Spike's point that decides the match or saves a match point - the one point of a match that prints (the
  // kill's old print, which came every rally, a size up).
  decider: {frame: 1, lines: .8, linesFor: .4, chroma: 1, ink: .4, zoom: 1, shake: 0, punch: 0},
  // ── Everything else: short speed lines and a small screen punch at most. No impact frame, no fringe, no
  // INK FLASH, no lens moved; the moment's weight is in the marks it leaves in the world (BallField). ──
  clash: {frame: 0, lines: .6, linesFor: .25, chroma: 0, ink: 0, zoom: .6, shake: 0, punch: 0},
  perfect: {frame: 0, lines: .4, linesFor: .2, chroma: 0, ink: 0, zoom: .5, shake: 0, punch: 0},
  // Goal Rush's PERFECT STRIKE (a ball met just as it arrived): the lines crack and the screen is punched - the
  // shot a player is proud of. The FINAL PUSH: the lines run and the screen breathes in.
  perfectStrike: {frame: 0, lines: .5, linesFor: .22, chroma: 0, ink: 0, zoom: .55, shake: 0, punch: 0, near: 30},
  finalPush: {frame: 0, lines: .5, linesFor: .4, chroma: 0, ink: 0, zoom: .5, shake: 0, punch: 0},
  // A SKY SPIKE struck is a crack on the screen, not a jolt of the lens: it comes every crossing of a rally.
  skySpike: {frame: 0, lines: .5, linesFor: .16, chroma: 0, ink: 0, zoom: .4, shake: 0, punch: 0},
  // The spike slammed into the court - the kill, the ace - is the rally's payoff. (On the screen it
  // is the lines and a punch; the dent it leaves in the court is BallField's.)
  kill: {frame: 0, lines: .5, linesFor: .25, chroma: 0, ink: 0, zoom: .6, shake: 0, punch: 0},
  point: {frame: 0, lines: .35, linesFor: .18, chroma: 0, ink: 0, zoom: .5, shake: 0, punch: 0},
  // A WIPE-OUT (Goal Rush's fights): the screen punched for whoever is near it.
  wipeout: {frame: 0, lines: .45, linesFor: .22, chroma: 0, ink: 0, zoom: .55, shake: 0, punch: 0, near: 22},
  // A power shot (struck at 30 m/s or more) and a BUMP: a small punch.
  power: {frame: 0, lines: .3, linesFor: .14, chroma: 0, ink: 0, zoom: .3, shake: 0, punch: 0, near: 26},
  bump: {frame: 0, lines: .35, linesFor: .16, chroma: 0, ink: 0, zoom: .5, shake: 0, punch: 0, near: 22},
  // A LINK SHOT.
  link: {frame: 0, lines: .5, linesFor: .25, chroma: 0, ink: 0, zoom: .45, shake: 0, punch: 0},
} satisfies Record<string, Peak>;
/** The shake falls off with the viewer's distance from the moment: whole within NEAR metres, a floor of FAR_SHARE of it
 *  at FAR and beyond, so everyone on the pitch feels a goal. */
const NEAR = 6, FAR = 40, FAR_SHARE = .22;
/** A goal struck this fast (km/h, the goal event's value) or faster is a screamer. */
const SCREAMER = 110;
/** A strike this fast (m/s) or faster is a power shot's punch. */
const POWER = 30;
const smooth = (x: number, a: number, b: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** The quiet rule. Over six
 *  filmed bot matches a peak printed the whole screen - the paper impact frame or the INK FLASH - once every 7.6 s:
 *  every clash, PERFECT save and strike, LINK SHOT, kill and wipe-out beside the goals. Now only these may: a goal; a
 *  point that decides the match or saves a match point; a SUPER SHOT as it is struck; a TECHNIQUE DUEL's end. (The
 *  final whistle may by the rule; nothing prints for it yet.) What each is, for an event as its snapshot has the score;
 *  null for everything else. BallMoments.test.ts pins it. */
export type PrintCause = 'goal' | 'decider' | 'super' | 'duel';
/** The only event kinds that may ever print the whole screen. */
export const MAY_PRINT: ReadonlySet<BallEvent['kind']> = new Set<BallEvent['kind']>(['goal', 'own-goal', 'super', 'duel-won', 'kill', 'ace', 'point', 'out', 'touches', 'win']);
export function printCause(e: BallEvent, view: Pick<BallView, 'mode' | 'score' | 'target' | 'practice'>): PrintCause | null {
  switch (e.kind) {
    case 'goal': case 'own-goal': return 'goal';
    case 'super': return 'super';
    case 'duel-won': return 'duel';
    case 'kill': case 'ace': case 'point': case 'out': case 'touches': return spikeDecides(e, view) ? 'decider' : null;
    default: return null;
  }
}
/** Sky Spike's point (its worth in `value`, the score in its snapshot already counting it) that wins the match ('won'),
 *  or that the other side would have won the match with ('saved'; BallMatch `point`: `won`, `matchPoint`); null for any
 *  other point, and in FREE PLAY or Goal Rush. */
export function spikeDecides(e: BallEvent, view: Pick<BallView, 'mode' | 'score' | 'target' | 'practice'>): 'won' | 'saved' | null {
  if (view.mode !== 'sky-spike' || view.practice || !e.team) return null;
  const target = view.target || SPIKE_RULES.target, cap = Math.max(target, SPIKE_RULES.cap + (target - SPIKE_RULES.target));
  const won = (s: number, o: number) => s >= cap || (s >= target && s - o >= 2);
  const s = view.score[e.team], o = view.score[e.team === 'red' ? 'blue' : 'red'];
  return won(s, o) ? 'won' : won(o + 1, s - (e.value ?? 1)) ? 'saved' : null;
}
/** The print budget: one full-screen print in BUDGET seconds of live play, over a match. The page's well
 *  fills by one print in that time (and holds no more than one); a goal's print, the winning point's and the first
 *  match point saved's are struck whatever is in the well and are owed back, a SUPER SHOT's, a duel's end's and any
 *  later match point saved's only when the well holds a print - so a match never prints more often than the budget
 *  unless its goals alone come faster. (Counted over bot matches, a comeback from 3-10 saved seven match points in a
 *  row, each a print: the room shows a match point saved again once a match, BallMatch `savedShown`, and the page owes
 *  only that one its print.) A print within FOLD seconds of the last is
 *  the same print: no second impact frame or fringe, and its INK FLASH only holds the page that is still up. */
const BUDGET = 20, FOLD = 1;

/**
 * The ball modes' peaks, felt: a SUPER SHOT, a CLASH as it breaks, a goal,
 * a PERFECT save (or a STUFF BLOCK) and a SKY SPIKE each throw the renderer's own tools - the paper impact frame, the
 * speed lines, the colour fringe - and punch every lens in and shake it, more the nearer the moment, for everyone
 * watching rather than only the striker. A SUPER SHOT and a goal also print the INK FLASH: half a second of the frame
 * as a two-tone manga page with the ball still in colour. Client side only: the room's events, each read once.
 *
 * Every peak also punches the finished picture in toward the moment (GameRenderer.screenPunch),
 * which moves no lens. Sky Spike's lens is never shaken by a moment now: its punches are all on the screen. A SKY
 * SPIKE struck (every crossing of a rally) is a crack on the screen without an impact frame; the kill or ace it makes,
 * slammed into the court, throws the impact frame and a breath of INK FLASH. A WIPE-OUT, a screamer goal, a power shot
 * and a BUMP have their own peaks; the near ones (`near`) print only for a viewer near the moment.
 *
 * The quiet rule: only a goal, a point that decides or saves the match, a SUPER SHOT
 * struck and a TECHNIQUE DUEL's end print the whole screen (`printCause`), and no more often than the budget (BUDGET).
 * Every other peak is short speed lines and a small screen punch, and moves no lens.
 *
 * Reduced motion is respected where it is decided: the renderer prints no impact frame, fringe, lines, flash or screen
 * punch under prefers-reduced-motion or the VISUAL EFFECTS levels that turn them off, and the shake is the player's
 * SHAKE setting. Nothing here allocates in a frame.
 */
export class BallMoments {
  private seen = 0;
  private seenAt = -Infinity;
  private linesLeft = 0;
  private lines = 0;
  /** A CLASH's peak waits for the clash to break (CLASH.hold after it begins). */
  private clashAt = Infinity;
  private readonly clashPoint = new THREE.Vector3();
  private readonly at = new THREE.Vector3();
  private radius = .6;
  private mode: BallModeId = 'goal-rush';
  /** The print budget: the prints the page has ink for (one at most; under zero, owed), the match it is
   *  kept for, when the last print was struck and until when its INK FLASH holds the page (the room's clock, s). */
  private well = 0;
  private match = NaN;
  private printedAt = -Infinity;
  private pageUntil = -Infinity;
  private view: BallView | null = null;
  /** Whether this match has had its match point saved printed (the one the budget owes). */
  private saved = false;
  /** For the checks: the full-screen prints struck since the page loaded (a held one is the print before it). */
  prints = 0;

  constructor(private readonly frame: MomentFrame, private readonly lenses: MomentLenses, private readonly ball: () => THREE.Vector3 | null) {}

  reset() { this.seen = 0; this.seenAt = -Infinity; this.linesLeft = 0; this.clashAt = Infinity; this.well = 0; this.match = NaN; this.printedAt = this.pageUntil = -Infinity; this.saved = false; this.frame.inkKeep(null); }

  /** The presented snapshot's moments (main.ts, beside the ball's sounds): each event once. */
  handle(snapshot: GameSnapshot) {
    const view = ballOf(snapshot);
    if (!view) return;
    this.radius = ballRadius(view.mode); this.mode = view.mode;
    if (snapshot.serverTime < this.seenAt - 1) this.seen = 0;
    // The budget is a match's: a new one starts with a dry well; live play fills it.
    if (view.startedAt !== this.match || snapshot.serverTime < this.seenAt - 1) { this.match = view.startedAt; this.well = 0; this.printedAt = this.pageUntil = -Infinity; this.saved = false; }
    else if (view.phase === 'live') this.well = Math.min(1, this.well + Math.min(.25, Math.max(0, snapshot.serverTime - this.seenAt)) / BUDGET);
    this.seenAt = snapshot.serverTime; this.view = view;
    for (const e of view.events) {
      if (e.id <= this.seen) continue;
      this.seen = e.id;
      // Only what is happening now: a page that joins late, or hitches, does not replay a backlog.
      if (snapshot.serverTime - e.at > 1) continue;
      this.moment(e, snapshot.serverTime);
    }
    if (this.clashAt <= snapshot.serverTime) { this.clashAt = Infinity; this.peak(PEAKS.clash, this.clashPoint); }
  }

  /** Every frame: the speed lines fed while a peak holds them, and the ball handed to the INK FLASH to keep in colour. */
  update(dt: number) {
    if (this.linesLeft > 0) { this.linesLeft = Math.max(0, this.linesLeft - dt); this.frame.speedLines(this.lines); }
    const ball = this.ball();
    this.frame.inkKeep(ball, this.radius * 2.4);
  }

  private moment(e: BallEvent, now: number) {
    const at = this.at.set(e.x, e.y, e.z);
    switch (e.kind) {
      case 'super': this.print(PEAKS.super, at, now, false); break;
      case 'goal': case 'own-goal': this.print(e.text === 'SUPER GOAL' || (e.value ?? 0) >= SCREAMER ? PEAKS.screamer : PEAKS.goal, at, now, !this.view?.practice); break;
      case 'clash': this.clashAt = e.at + CLASH.hold; this.clashPoint.copy(at); if (this.clashAt <= now) { this.clashAt = Infinity; this.peak(PEAKS.clash, at); } break;
      // (A DIVING SAVE and one OFF THE LINE are as big a moment as a PERFECT SAVE.)
      case 'save': if (e.text === 'PERFECT SAVE' || e.text === 'DIVING SAVE' || e.text === 'OFF THE LINE') this.peak(PEAKS.perfect, at); break;
      case 'fever': if (this.mode === 'goal-rush') this.peak(PEAKS.finalPush, at); break;
      // (Goal Rush's TRAP - 'perfect', the text TRAP, twenty a match - moves nothing on the screen: its mark is
      // BallField's.)
      case 'perfect': if (e.text !== 'TRAP') this.peak(PEAKS.perfect, at); break;
      case 'strike':
        if (e.perfect && this.mode === 'goal-rush') this.peak(PEAKS.perfectStrike, at);
        else if (e.text === 'SKY SPIKE' || e.text === 'ROLL SPIKE') this.peak(PEAKS.skySpike, at);
        else if (e.text === 'LINK SHOT') this.peak(PEAKS.link, at);
        else if ((e.value ?? 0) >= POWER) this.peak(PEAKS.power, at);
        break;
      // (The point that decides the match or saves a match point is the one that prints, however it was won.)
      case 'kill': case 'ace': this.decider(e, at.setY(.4), now, PEAKS.kill); break;
      case 'point': this.decider(e, at.setY(.4), now, PEAKS.point); break;
      case 'out': case 'touches': this.decider(e, at.setY(.4), now, null); break;
      case 'wipeout': this.peak(PEAKS.wipeout, at); break;
      case 'demo': this.peak(PEAKS.bump, at); break;
      case 'duel': this.shake(.45, at, 1); this.frame.screenPunch?.(.6, at); break;
      case 'duel-won': this.print(e.text === 'SHOT STOPPED' ? PEAKS.duelStopped : PEAKS.duelThrough, at, now, false); break;
      default: break;
    }
  }

  /** Sky Spike's point: the deciders' print (the winning point's and the first match point saved's owed, any later
   *  save's from the well), or its own peak (`otherwise`) when it decides nothing. */
  private decider(e: BallEvent, at: THREE.Vector3, now: number, otherwise: Peak | null) {
    const d = this.view ? spikeDecides(e, this.view) : null;
    if (!d) { if (otherwise) this.peak(otherwise, at); return; }
    this.print(PEAKS.decider, at, now, d === 'won' || !this.saved);
    if (d === 'saved') this.saved = true;
  }

  /** A peak that may print the whole screen (the budget above): struck if it must be (`owed`: a goal, a
   *  decider) or the well holds a print; held if the last print is under FOLD seconds old; otherwise felt without its
   *  print - the lines, the punch and the lens as ever. */
  private print(p: Peak, at: THREE.Vector3, now: number, owed: boolean) {
    if (now - this.printedAt < FOLD) { this.peak(p, at, now < this.pageUntil ? 1 : 0); if (now < this.pageUntil) this.pageUntil = Math.max(this.pageUntil, now + p.ink); return; }
    if (!owed && this.well < 1) { this.peak(p, at, 0); return; }
    if (!this.peak(p, at, 2)) return;
    this.well--; this.printedAt = now; this.pageUntil = now + p.ink; this.prints++;
  }

  /** A peak, felt. `print`: 2 the whole of it, 1 only its INK FLASH (holding a page that is up), 0 none of its
   *  full-screen print. True when it printed for a viewer. */
  private peak(p: Peak, at: THREE.Vector3, print: 0 | 1 | 2 = 2) {
    // A near peak is the frame's only for a viewer near it (a wipe-out across the pitch is the ticker's, not the screen's).
    const d = p.near ? this.nearest(at) : 0, near = !p.near || d <= p.near, k = p.near ? 1 - smooth(d, p.near * .5, p.near) * .7 : 1;
    if (near && print === 2 && p.frame > 0) this.frame.impactFrame(p.frame, at);
    if (near && print === 2 && p.chroma > 0) this.frame.chromaticPulse(p.chroma);
    if (p.lines > 0 && near) { this.lines = Math.max(this.linesLeft > 0 ? this.lines : 0, p.lines * k); this.linesLeft = Math.max(this.linesLeft, p.linesFor); this.frame.speedLines(p.lines * k); }
    // (The sound word up meanwhile burns through the print in its side's colour, SoundWords.inkShown.)
    if (near && print > 0 && p.ink > 0) { this.frame.inkFlash(p.ink); inkShown(p.ink); }
    if (p.zoom > 0 && near) this.frame.screenPunch?.(p.zoom * k, at);
    // Sky Spike's lens stays where its camera puts it: its moments land on the screen.
    if (this.mode !== 'sky-spike' && p.shake > 0) this.shake(p.shake, at, p.punch);
    return near && print === 2 && (p.frame > 0 || p.ink > 0);
  }

  /** How far the nearest viewer's player is from a moment (m, on the floor). */
  private nearest(at: THREE.Vector3) {
    let best = Infinity;
    for (const [rig, body] of this.lenses()) if (rig) best = Math.min(best, body ? Math.hypot(body.x - at.x, body.z - at.z) : NEAR);
    return best;
  }

  /** Every lens shakes, by how near its player is to the moment; the near ones punch in. */
  private shake(weight: number, at: THREE.Vector3, punch: 0 | 1 | 2) {
    if (this.mode === 'sky-spike') return;
    for (const [rig, body] of this.lenses()) {
      if (!rig) continue;
      const d = body ? Math.hypot(body.x - at.x, body.z - at.z) : NEAR;
      const k = FAR_SHARE + (1 - FAR_SHARE) * (1 - smooth(d, NEAR, FAR));
      rig.impact(weight * k, undefined, d < 18 ? punch : punch > 1 ? 1 : 0);
    }
  }
}
