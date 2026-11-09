import * as THREE from 'three';
import {CLASH, ballOf, ballRadius, type BallEvent, type BallModeId} from '../../game/ball/model';
import type {GameSnapshot, Vec3} from '../../game/types';
import type {FollowCamera} from '../FollowCamera';

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
  super: {frame: 1, lines: .95, linesFor: .55, chroma: 1, ink: .5, zoom: 1, shake: .85, punch: 2},
  goal: {frame: 1, lines: .9, linesFor: .6, chroma: 1, ink: .55, zoom: 1, shake: .9, punch: 2},
  // A screamer - a goal struck at 110 km/h or more, or a SUPER GOAL - holds the inked page longer.
  screamer: {frame: 1, lines: 1, linesFor: .7, chroma: 1, ink: .72, zoom: 1, shake: 1, punch: 2},
  clash: {frame: .9, lines: .85, linesFor: .4, chroma: 1, ink: 0, zoom: .8, shake: .8, punch: 2},
  perfect: {frame: .7, lines: .5, linesFor: .25, chroma: .95, ink: 0, zoom: .7, shake: .55, punch: 1},
  // A SKY SPIKE struck is a crack on the screen, not a jolt of the lens: it comes every crossing of a rally, so
  // it throws no impact frame (the kill it makes does) and moves no lens.
  skySpike: {frame: 0, lines: .5, linesFor: .16, chroma: 0, ink: 0, zoom: .4, shake: 0, punch: 0},
  // The spike slammed into the court - the kill, the ace - is the rally's payoff: the impact frame, a breath of
  // INK FLASH (the splash it throws up burns through in colour), the screen punched in.
  kill: {frame: .75, lines: .65, linesFor: .3, chroma: .95, ink: .28, zoom: 1, shake: 0, punch: 0},
  point: {frame: 0, lines: .35, linesFor: .18, chroma: 0, ink: 0, zoom: .5, shake: 0, punch: 0},
  // A WIPE-OUT (Goal Rush's fights): printed for whoever is near it; the screen punched for everyone near.
  wipeout: {frame: .8, lines: .6, linesFor: .3, chroma: .95, ink: .22, zoom: .85, shake: .3, punch: 0, near: 22},
  // A power shot (struck at 30 m/s or more) and a BUMP: a small punch, no lens.
  power: {frame: 0, lines: .3, linesFor: .14, chroma: 0, ink: 0, zoom: .3, shake: 0, punch: 0, near: 26},
  bump: {frame: 0, lines: .35, linesFor: .16, chroma: 0, ink: 0, zoom: .5, shake: .2, punch: 0, near: 22},
  // A LINK SHOT, and a TECHNIQUE DUEL's end (the shot dying on the guard prints the INK FLASH).
  link: {frame: .55, lines: .75, linesFor: .35, chroma: 0, ink: 0, zoom: .5, shake: .55, punch: 1},
  duelStopped: {frame: 1, lines: .9, linesFor: .5, chroma: 1, ink: .5, zoom: 1, shake: 1, punch: 2},
  duelThrough: {frame: .9, lines: .9, linesFor: .45, chroma: 1, ink: 0, zoom: 1, shake: .85, punch: 2},
} satisfies Record<string, Peak>;
/** The shake falls off with the viewer's distance from the moment: whole within NEAR metres, a floor of FAR_SHARE of it
 *  at FAR and beyond, so everyone on the pitch feels a goal. */
const NEAR = 6, FAR = 40, FAR_SHARE = .22;
/** A goal struck this fast (km/h, the goal event's value) or faster is a screamer. */
const SCREAMER = 110;
/** A strike this fast (m/s) or faster is a power shot's punch. */
const POWER = 30;
const smooth = (x: number, a: number, b: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

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

  constructor(private readonly frame: MomentFrame, private readonly lenses: MomentLenses, private readonly ball: () => THREE.Vector3 | null) {}

  reset() { this.seen = 0; this.seenAt = -Infinity; this.linesLeft = 0; this.clashAt = Infinity; this.frame.inkKeep(null); }

  /** The presented snapshot's moments (main.ts, beside the ball's sounds): each event once. */
  handle(snapshot: GameSnapshot) {
    const view = ballOf(snapshot);
    if (!view) return;
    this.radius = ballRadius(view.mode); this.mode = view.mode;
    if (snapshot.serverTime < this.seenAt - 1) this.seen = 0;
    this.seenAt = snapshot.serverTime;
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
      case 'super': this.peak(PEAKS.super, at); break;
      case 'goal': case 'own-goal': this.peak(e.text === 'SUPER GOAL' || (e.value ?? 0) >= SCREAMER ? PEAKS.screamer : PEAKS.goal, at); break;
      case 'clash': this.clashAt = e.at + CLASH.hold; this.clashPoint.copy(at); this.shake(.35, at, 0); if (this.clashAt <= now) { this.clashAt = Infinity; this.peak(PEAKS.clash, at); } break;
      case 'save': if (e.text === 'PERFECT SAVE') this.peak(PEAKS.perfect, at); break;
      case 'perfect': this.peak(PEAKS.perfect, at); break;
      case 'strike':
        if (e.text === 'SKY SPIKE' || e.text === 'ROLL SPIKE') this.peak(PEAKS.skySpike, at);
        else if (e.text === 'LINK SHOT') this.peak(PEAKS.link, at);
        else if ((e.value ?? 0) >= POWER) this.peak(PEAKS.power, at);
        break;
      case 'kill': case 'ace': this.peak(PEAKS.kill, at.setY(.4)); break;
      case 'point': this.peak(PEAKS.point, at.setY(.4)); break;
      case 'wipeout': this.peak(PEAKS.wipeout, at); break;
      case 'demo': this.peak(PEAKS.bump, at); break;
      case 'duel': this.shake(.45, at, 1); this.frame.screenPunch?.(.6, at); break;
      case 'duel-won': this.peak(e.text === 'SHOT STOPPED' ? PEAKS.duelStopped : PEAKS.duelThrough, at); break;
      default: break;
    }
  }

  private peak(p: Peak, at: THREE.Vector3) {
    // A near peak is the frame's only for a viewer near it (a wipe-out across the pitch is the ticker's, not the screen's).
    const d = p.near ? this.nearest(at) : 0, near = !p.near || d <= p.near, k = p.near ? 1 - smooth(d, p.near * .5, p.near) * .7 : 1;
    if (near && p.frame > 0) this.frame.impactFrame(p.frame, at);
    if (near && p.chroma > 0) this.frame.chromaticPulse(p.chroma);
    if (p.lines > 0 && near) { this.lines = Math.max(this.linesLeft > 0 ? this.lines : 0, p.lines * k); this.linesLeft = Math.max(this.linesLeft, p.linesFor); this.frame.speedLines(p.lines * k); }
    if (near && p.ink > 0) this.frame.inkFlash(p.ink);
    if (p.zoom > 0 && near) this.frame.screenPunch?.(p.zoom * k, at);
    // Sky Spike's lens stays where its camera puts it: its moments land on the screen.
    if (this.mode !== 'sky-spike' && p.shake > 0) this.shake(p.shake, at, p.punch);
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
