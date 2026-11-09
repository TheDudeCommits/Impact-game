import * as THREE from 'three';
import {CLASH, ballOf, ballRadius, type BallEvent} from '../../game/ball/model';
import type {GameSnapshot, Vec3} from '../../game/types';
import type {FollowCamera} from '../FollowCamera';

/** What the moments drive: the renderer's frame answers (GameRenderer's post API). */
export interface MomentFrame {
  impactFrame(strength: number, at?: THREE.Vector3, hold?: number): void;
  chromaticPulse(amount: number): void;
  speedLines(amount: number): void;
  inkFlash(seconds: number): void;
  inkKeep(point: Vec3 | null, radius?: number): void;
}
/** Each lens on the match this frame and the body it follows: one, or a split screen's two. */
export type MomentLenses = () => readonly (readonly [FollowCamera | undefined, Vec3 | undefined])[];

/** A peak's size: the paper impact frame's strength, the speed lines' (and for how long), the colour fringe, the INK
 *  FLASH's seconds, the shake at the moment's own spot, and whether the lens punches in. */
interface Peak { frame: number; lines: number; linesFor: number; chroma: number; ink: number; shake: number; punch: 0 | 1 | 2 }
const PEAKS = {
  super: {frame: 1, lines: .95, linesFor: .55, chroma: 1, ink: .5, shake: .85, punch: 2},
  goal: {frame: 1, lines: .9, linesFor: .6, chroma: 1, ink: .55, shake: .9, punch: 2},
  clash: {frame: .9, lines: .85, linesFor: .4, chroma: 1, ink: 0, shake: .8, punch: 2},
  perfect: {frame: .7, lines: .5, linesFor: .25, chroma: .95, ink: 0, shake: .55, punch: 1},
  skySpike: {frame: .6, lines: .7, linesFor: .3, chroma: 0, ink: 0, shake: .6, punch: 1},
  // A LINK SHOT, and a TECHNIQUE DUEL's end (the shot dying on the guard prints the INK FLASH).
  link: {frame: .55, lines: .75, linesFor: .35, chroma: 0, ink: 0, shake: .55, punch: 1},
  duelStopped: {frame: 1, lines: .9, linesFor: .5, chroma: 1, ink: .5, shake: 1, punch: 2},
  duelThrough: {frame: .9, lines: .9, linesFor: .45, chroma: 1, ink: 0, shake: .85, punch: 2},
} satisfies Record<string, Peak>;
/** The shake falls off with the viewer's distance from the moment: whole within NEAR metres, a floor of FAR_SHARE of it
 *  at FAR and beyond, so everyone on the pitch feels a goal. */
const NEAR = 6, FAR = 40, FAR_SHARE = .22;
const smooth = (x: number, a: number, b: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/**
 * The ball modes' peaks, felt: a SUPER SHOT, a CLASH as it breaks, a goal,
 * a PERFECT save (or a STUFF BLOCK) and a SKY SPIKE each throw the renderer's own tools - the paper impact frame, the
 * speed lines, the colour fringe - and punch every lens in and shake it, more the nearer the moment, for everyone
 * watching rather than only the striker. A SUPER SHOT and a goal also print the INK FLASH: half a second of the frame
 * as a two-tone manga page with the ball still in colour. Client side only: the room's events, each read once.
 *
 * Reduced motion is respected where it is decided: the renderer prints no impact frame, fringe, lines or flash under
 * prefers-reduced-motion or the VISUAL EFFECTS levels that turn them off, and the shake is the player's SHAKE setting.
 * Nothing here allocates in a frame.
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

  constructor(private readonly frame: MomentFrame, private readonly lenses: MomentLenses, private readonly ball: () => THREE.Vector3 | null) {}

  reset() { this.seen = 0; this.seenAt = -Infinity; this.linesLeft = 0; this.clashAt = Infinity; this.frame.inkKeep(null); }

  /** The presented snapshot's moments (main.ts, beside the ball's sounds): each event once. */
  handle(snapshot: GameSnapshot) {
    const view = ballOf(snapshot);
    if (!view) return;
    this.radius = ballRadius(view.mode);
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
      case 'goal': case 'own-goal': this.peak(PEAKS.goal, at); break;
      case 'clash': this.clashAt = e.at + CLASH.hold; this.clashPoint.copy(at); this.shake(.35, at, 0); if (this.clashAt <= now) { this.clashAt = Infinity; this.peak(PEAKS.clash, at); } break;
      case 'save': if (e.text === 'PERFECT SAVE') this.peak(PEAKS.perfect, at); break;
      case 'perfect': this.peak(PEAKS.perfect, at); break;
      case 'strike': if (e.text === 'SKY SPIKE') this.peak(PEAKS.skySpike, at); else if (e.text === 'LINK SHOT') this.peak(PEAKS.link, at); break;
      case 'duel': this.shake(.45, at, 1); break;
      case 'duel-won': this.peak(e.text === 'SHOT STOPPED' ? PEAKS.duelStopped : PEAKS.duelThrough, at); break;
      default: break;
    }
  }

  private peak(p: Peak, at: THREE.Vector3) {
    if (p.frame > 0) this.frame.impactFrame(p.frame, at);
    if (p.chroma > 0) this.frame.chromaticPulse(p.chroma);
    if (p.lines > 0) { this.lines = Math.max(this.linesLeft > 0 ? this.lines : 0, p.lines); this.linesLeft = Math.max(this.linesLeft, p.linesFor); this.frame.speedLines(p.lines); }
    if (p.ink > 0) this.frame.inkFlash(p.ink);
    this.shake(p.shake, at, p.punch);
  }

  /** Every lens shakes, by how near its player is to the moment; the near ones punch in. */
  private shake(weight: number, at: THREE.Vector3, punch: 0 | 1 | 2) {
    for (const [rig, body] of this.lenses()) {
      if (!rig) continue;
      const d = body ? Math.hypot(body.x - at.x, body.z - at.z) : NEAR;
      const k = FAR_SHARE + (1 - FAR_SHARE) * (1 - smooth(d, NEAR, FAR));
      rig.impact(weight * k, undefined, d < 18 ? punch : punch > 1 ? 1 : 0);
    }
  }
}
