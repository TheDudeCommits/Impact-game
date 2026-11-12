import {describe, expect, it} from 'vitest';
import * as THREE from 'three';
import {KEEP, SpikeCam} from './SpikeCam';
import {freshBall} from '../../game/ball/physics';
import {VOLLEY_COURT, type BallView} from '../../game/ball/model';
import type {FollowCamera} from '../FollowCamera';
import {BallArena} from './BallArena';
import {VOLLEY_GRADE, lookFor} from '../look/stageLooks';
import {setBallArena, setBallCourt} from './arenaChoice';

// On the volleyball rules the stand eases up and out to keep a high ball in the frame with your own fighter, and back;
// the court inside the lines is one pale cool paint and the sunset stays off the play.
const view = (o: Partial<BallView> = {}): BallView => ({
  kind: 'ball', mode: 'sky-spike', phase: 'live', access: 'bots', round: 1, hostId: null, capacity: 6, fillBots: true, startsAt: null, startedAt: 0, endsAt: 0, phaseUntil: 0,
  seats: [], score: {red: 0, blue: 0}, ball: {...freshBall(), held: false, y: 2, court: VOLLEY_COURT}, clock: 0, overtime: false, touchTeam: null, touches: 0, rally: 1, servingTeam: 'red', serverId: null,
  target: 11, fever: false, winner: null, reason: '', mvp: null, events: [], replay: null, rumble: false, charms: [], effects: [], practice: false, best: 0, aim: null, hits: 0, streak: 0, bestStreak: 0, ...o});
const rig = () => ({mode: 'dynamic', keepInView: null, sportFov: 14, movementYaw: 0}) as unknown as FollowCamera;
/** The ball's and the person's feet's height in the frame (shares of it from the top) after `seconds` of play with the
 *  ball at `ball` (rising at `vy`) and the person at `self`; and the look's height. */
function framed(ball: THREE.Vector3, self: THREE.Vector3, w = 1280, h = 720, vy = 0, seconds = 3, cam = new SpikeCam(), o: Partial<BallView> = {}) {
  const r = rig(), l = new THREE.PerspectiveCamera(50, w / h, .1, 500), v = view({ball: {...freshBall(), held: false, x: ball.x, y: ball.y, z: ball.z, vy, court: VOLLEY_COURT}, ...o});
  for (let i = 0; i < seconds * 60; i++) { cam.steer(r, 1 / 60, 0, NaN, true, self, ball, v, 'red', w / h); cam.aim(r, l, 0); }
  l.updateMatrixWorld();
  const y = (p: THREE.Vector3) => (1 - p.clone().project(l).y) / 2;
  return {ball: y(ball), feet: y(self), look: cam.pose().look.y, fov: l.fov, cam};
}

describe('volleyball\'s stand keeps the ball in the frame', () => {
  it('eases up for a high set or a serve: the ball under the score bug\'s band, your feet still in the frame', () => {
    for (const [w, h] of [[1280, 720], [844, 390]] as const) {
      // (A high set on your side, a JUMP SERVE's toss over your own server behind the baseline at the walk-up, a high ball
      // over theirs with you deep.)
      for (const [ball, self, o] of [[new THREE.Vector3(-3, 7.5, -1.6), new THREE.Vector3(0, 0, -5), {}], [new THREE.Vector3(1, 8.5, -8.9), new THREE.Vector3(1, 0, -9.2), {phase: 'kickoff' as const, servingTeam: 'red' as const}], [new THREE.Vector3(2, 8, 3), new THREE.Vector3(-2, 0, -6.5), {}]] as const) {
        const f = framed(ball, self, w, h, 0, 3, new SpikeCam(), o);
        expect(f.ball, `${w}x${h} ball ${ball.toArray()}`).toBeGreaterThan(KEEP.top - .02);
        // (The server's own feet stand behind the baseline, under the stand's frame at the walk-up as they always did.)
        if (!('phase' in o)) expect(f.feet, `${w}x${h} feet ${self.toArray()}`).toBeLessThan(1 - KEEP.bottom + .02);
      }
    }
  });
  it('stands as it did for a ball in reach, and comes back down after a high one', () => {
    const low = framed(new THREE.Vector3(0, 2, -3), new THREE.Vector3(0, 0, -4));
    const cam = framed(new THREE.Vector3(-3, 8, -1.6), new THREE.Vector3(0, 0, -5)).cam;
    expect(framed(new THREE.Vector3(-3, 8, -1.6), new THREE.Vector3(0, 0, -5), 1280, 720, 0, 3, cam).look).toBeGreaterThan(low.look + .5);
    const back = framed(new THREE.Vector3(0, 2, -3), new THREE.Vector3(0, 0, -4), 1280, 720, 0, 4, cam);
    expect(Math.abs(back.look - low.look)).toBeLessThan(.15); expect(Math.abs(back.fov - low.fov)).toBeLessThan(.3);
  });
});

describe('volleyball\'s court and light', () => {
  it('paints the court pale and cool inside the lines, and takes the sunset off the key light and the fighters', () => {
    const paint = new THREE.Color(BallArena.VOLLEY_STAGE.paint), hsl = {h: 0, s: 0, l: 0};
    paint.getHSL(hsl, THREE.SRGBColorSpace);
    expect(hsl.l).toBeGreaterThan(.7); expect(hsl.s).toBeLessThan(.3); expect(hsl.h).toBeGreaterThan(.45); expect(hsl.h).toBeLessThan(.7);
    for (const arena of ['tide-court', 'sky-court', 'ember-rim'] as const) {
      setBallArena(arena); setBallCourt(undefined);
      const classic = lookFor('ball-court');
      setBallCourt(VOLLEY_COURT);
      const vb = lookFor('ball-court');
      const warmth = (c: number) => ((c >> 16) & 255) - (c & 255);
      expect(warmth(vb.key.color), arena).toBeLessThan(warmth(classic.key.color) * (1 - VOLLEY_GRADE.key) + 2);
      expect(vb.toon.midStrength).toBeLessThan(classic.toon.midStrength);
      expect(vb.grade.split).toBeLessThan(classic.grade.split);
    }
    setBallCourt(undefined); setBallArena('sky-court');
  });
});
