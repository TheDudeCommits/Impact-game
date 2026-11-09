import * as THREE from 'three';
import type {GameSnapshot} from '../../game/types';
import {ballOf, GOAL_RULES, SPIKE_RULES} from '../../game/ball/model';
import {replayClock, REPLAY, type BallReplay} from '../../game/ball/replay';
import {CombatTimeline} from '../CombatTimeline';

/** Seconds of play the page keeps, enough for any replay's window and the celebration before it. */
const KEEP = 9;
/** Pad buttons that skip: A / Cross, and START. */
const PAD_SKIP = [0, 9];

interface Playing { key: string; mode: 'goal-rush' | 'sky-spike'; replay: BallReplay; timeline: CombatTimeline; land: THREE.Vector3; shot: 'chase' | 'close'; fresh: boolean; side: number }

/**
 * The ball modes' replays (game/ball/replay.ts): the page keeps the last few seconds of the match's snapshots, and when
 * the room announces a replay it plays that window again through the same fighters and ball, slowed round the strike
 * that decided it, with its own lens:
 *
 * - Goal Rush: chasing the ball from behind toward the goal it went into, then the goal line's view beside the post
 *   as it arrives.
 * - Sky Spike: the broadcast's side-line view of the rally, then the floor where the ball came down.
 *
 * The live match goes on underneath (the room holds its celebration); the HUD keeps the live score.
 */
export class BallReplayer {
  private frames: GameSnapshot[] = [];
  private playing: Playing | null = null;
  /** A window the page could not play (it joined in the middle of it): not tried again. */
  private refused = '';
  private readonly eye = new THREE.Vector3(); private readonly look = new THREE.Vector3();
  private readonly want = new THREE.Vector3(); private readonly at = new THREE.Vector3();
  private padHeld = false;
  /** Called when the person asks to skip the replay showing now (the page sends the room `ball-skip`). */
  onSkip: () => void = () => {};
  private readonly onKey = (e: KeyboardEvent) => {
    if (!this.playing || e.repeat || !['Space', 'Enter', 'NumpadEnter', 'Escape'].includes(e.code)) return;
    if (e.code === 'Escape') return; // the pause menu keeps Escape
    e.preventDefault(); this.onSkip();
  };

  /** A tap or click anywhere while a replay shows is a vote to skip it (a phone has no Space; its touch controls hide). */
  private readonly onTap = () => { if (this.playing) this.onSkip(); };
  constructor() { if (typeof window === 'object') { window.addEventListener('keydown', this.onKey); window.addEventListener('pointerdown', this.onTap); } }

  /** Every snapshot of a ball match, as it arrives. */
  record(snapshot: GameSnapshot) {
    if (!ballOf(snapshot)) return;
    const last = this.frames.at(-1);
    if (last && snapshot.serverTime <= last.serverTime) {
      // A new match (or a rematch) starts its clock again: what was kept belongs to the old one.
      if (snapshot.serverTime < last.serverTime - 1) this.frames.length = 0; else return;
    }
    this.frames.push({...snapshot, players: snapshot.players.map(p => ({...p, cooldowns: {...p.cooldowns}})), events: []});
    const cut = snapshot.serverTime - KEEP;
    let n = 0; while (n < this.frames.length && this.frames[n].serverTime < cut) n++;
    if (n) this.frames.splice(0, n);
  }

  get active() { return !!this.playing; }

  /** The replay's frame for this moment of the live match (its presented snapshot), or null when none is showing: the
   *  fighters and ball are drawn from it, and `rate` is the pace it plays at (1 is real time). */
  frame(live: GameSnapshot | null | undefined): {snapshot: GameSnapshot; rate: number; replay: BallReplay} | null {
    const view = ballOf(live), r = view?.replay;
    if (!live || !view || !r || view.phase !== 'scored' || live.serverTime < r.at || live.serverTime >= r.until) { this.stop(); return null; }
    const key = `${view.startedAt}:${r.from}:${r.to}`;
    if (this.playing?.key !== key) {
      if (this.refused === key) return null;
      const window = this.frames.filter(f => f.serverTime >= r.from - .2 && f.serverTime <= r.to + .2);
      if (window.length < 6 || window[0].serverTime > r.from + .6 || window.at(-1)!.serverTime < r.to - .6) { this.refused = key; this.stop(); return null; }
      const timeline = new CombatTimeline({delayMs: 0, keep: window.length + 2});
      for (const f of window) timeline.push(f, 0);
      // Where the ball ended up: the goal's mouth, the floor it came down on.
      const end = window.reduce((best, f) => Math.abs(f.serverTime - (r.to - REPLAY.tail)) < Math.abs(best.serverTime - (r.to - REPLAY.tail)) ? f : best, window[0]);
      const b = ballOf(end)!.ball;
      this.padHeld = true; // a press already down when it begins (a jump) is no vote to skip
      this.playing = {key, mode: view.mode, replay: r, timeline, land: new THREE.Vector3(b.x, b.y, b.z), shot: 'chase', fresh: true, side: 0};
    }
    const p = this.playing;
    p.replay = r;
    const {time, rate} = replayClock(r, live.serverTime - r.at);
    const frame = p.timeline.at(time);
    if (!frame) return null;
    this.pollPad();
    return {snapshot: frame.snapshot, rate, replay: r};
  }

  /** The lens on the replay, after the match's own camera has placed it for the frame. `ball` is where the ball is drawn. */
  aim(camera: THREE.PerspectiveCamera, ball: THREE.Vector3 | null, time: number, dt: number) {
    const p = this.playing;
    if (!p || !ball) return;
    const r = p.replay, goalRush = p.mode === 'goal-rush';
    let shot: Playing['shot'] = 'chase', fov = 56;
    if (goalRush) {
      const R = GOAL_RULES, gz = r.team === 'red' ? R.halfZ : -R.halfZ, sign = Math.sign(gz);
      const toGoal = Math.hypot(ball.x, ball.z - gz);
      if ((time > r.key + .05 && toGoal < 20) || time > r.to - .75) shot = 'close';
      if (shot === 'chase') {
        // From behind the ball, on its line to the goal, a little above it.
        let dx = ball.x, dz = ball.z - gz; const d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d;
        this.want.set(ball.x + dx * 7.5, 2.6 + ball.y * .35, ball.z + dz * 7.5);
        this.at.set(ball.x + (0 - ball.x) * .2, ball.y + (1.6 - ball.y) * .2, ball.z + (gz - ball.z) * .2);
      } else {
        // Down on the goal line beside the post, on the side the ball comes in from, watching it go in (the goal's
        // burst is seen whole from here, not from inside it).
        const side = p.side || (p.side = ball.x >= 0 ? 1 : -1);
        this.want.set(side * (R.goalHalfWidth + 8), 2.4, gz - sign * 4.6);
        this.at.set(ball.x * .7, Math.max(1, ball.y), ball.z); fov = 54;
      }
      this.want.x = Math.max(-R.halfX + 1.2, Math.min(R.halfX - 1.2, this.want.x));
      if (shot === 'chase') this.want.z = Math.max(-R.halfZ + 1.2, Math.min(R.halfZ - 1.2, this.want.z));
      this.want.y = Math.max(1, Math.min(R.ceiling - 1, this.want.y));
    } else {
      const R = SPIKE_RULES, side = 1;
      if (time > r.key + .04 || time > r.to - .6) shot = 'close';
      if (shot === 'chase') {
        // The broadcast's view from the side line, level with the net, following the ball along the court.
        this.want.set(side * Math.min(R.halfX - 1, R.courtHalfX + 7), 5.2 + ball.y * .25, ball.z * .55);
        this.at.copy(ball); fov = 54;
      } else {
        // Down on the floor past where it came down, looking back at it.
        const zs = Math.sign(p.land.z) || 1;
        this.want.set(Math.max(-R.halfX + 1, Math.min(R.halfX - 1, p.land.x + side * 3.4)), .75, Math.max(-R.halfZ + 1, Math.min(R.halfZ - 1, p.land.z + zs * 4.6)));
        this.at.copy(ball); fov = 52;
      }
    }
    const cut = p.fresh || shot !== p.shot;
    p.fresh = false; p.shot = shot;
    const k = cut ? 1 : 1 - Math.exp(-dt * (shot === 'close' ? 7 : 4.5)), kl = cut ? 1 : 1 - Math.exp(-dt * 9);
    this.eye.lerp(this.want, k); this.look.lerp(this.at, kl);
    if (cut) { this.eye.copy(this.want); this.look.copy(this.at); }
    camera.position.copy(this.eye); camera.up.set(0, 1, 0); camera.lookAt(this.look);
    camera.fov = fov; camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  }

  /** The pad's A or START, pressed (not held) while a replay shows. */
  private pollPad() {
    const pads = typeof navigator === 'object' && navigator.getGamepads ? navigator.getGamepads() : [];
    let held = false;
    for (const pad of pads) if (pad?.connected && PAD_SKIP.some(i => pad.buttons[i]?.pressed)) held = true;
    if (held && !this.padHeld) this.onSkip();
    this.padHeld = held;
  }

  stop() { this.playing = null; }
  clear() { this.frames.length = 0; this.playing = null; this.refused = ''; }
  dispose() { this.clear(); if (typeof window === 'object') { window.removeEventListener('keydown', this.onKey); window.removeEventListener('pointerdown', this.onTap); } }
}
