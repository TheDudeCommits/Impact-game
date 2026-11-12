import {describe, expect, it} from 'vitest';
import * as THREE from 'three';
import {KEEP, SpikeCam} from './SpikeCam';
import {freshBall} from '../../game/ball/physics';
import {VOLLEY_COURT, type BallView} from '../../game/ball/model';
import type {FollowCamera} from '../FollowCamera';

// Sky Spike on the volleyball rules is filmed from its own stand - bodies about twice the classic stand's height
// on screen, your whole court and the net in the frame - and the classic stand is the classic's. (Higher and further
// back, a body 1.6 times the classic's, the whole rally in the frame without rising. Then closer and lower, for
// volleyball's own jump - bodies bigger still, the crowd a strip high in the frame.)
const view = (o: Partial<BallView> = {}, court = true): BallView => ({
  kind: 'ball', mode: 'sky-spike', phase: 'live', access: 'bots', round: 1, hostId: null, capacity: 6, fillBots: true, startsAt: null, startedAt: 0, endsAt: 0, phaseUntil: 0,
  seats: [], score: {red: 0, blue: 0}, ball: {...freshBall(), held: false, y: 2, ...(court ? {court: VOLLEY_COURT} : {})}, clock: 0, overtime: false, touchTeam: null, touches: 0, rally: 1, servingTeam: 'red', serverId: null,
  target: 11, fever: false, winner: null, reason: '', mvp: null, events: [], replay: null, rumble: false, charms: [], effects: [], practice: false, best: 0, aim: null, hits: 0, streak: 0, bestStreak: 0, ...o});
const rig = () => ({mode: 'dynamic', keepInView: null, sportFov: 14, movementYaw: 0}) as unknown as FollowCamera;
/** The lens after a few seconds of steady play, the player at `self`, at `w` x `h`. */
function filmed(court: boolean, w = 1280, h = 720, o: Partial<BallView> = {}, self = {x: 0, y: 0, z: -4}, ball = new THREE.Vector3(0, 2, -3)) {
  const cam = new SpikeCam(), r = rig(), l = new THREE.PerspectiveCamera(50, w / h, .1, 500);
  for (let i = 0; i < 240; i++) { cam.steer(r, 1 / 60, 0, NaN, true, self, ball, view(o, court), 'red', w / h); cam.aim(r, l, 0); }
  l.updateMatrixWorld();
  const px = (x: number, y: number, z: number) => { const v = new THREE.Vector3(x, y, z).project(l); return {x: (v.x + 1) / 2 * w, y: (1 - v.y) / 2 * h}; };
  return {cam, l, px, tall: (x: number, z: number) => px(x, 0, z).y - px(x, 1.8, z).y};
}

describe('volleyball\'s camera stand', () => {
  it('draws a body over one and a half times as tall as the classic stand does, where it plays', () => {
    const vb = filmed(true), cl = filmed(false);
    // The same parts of each court: your mid-court, your net, their hitter's, their mid-court.
    for (const [x, z] of [[2, -.5], [0, -1], [0, 1.5], [-2, .5]] as const) {
      const v = vb.tall(x, z === -1 || z === 1.5 ? z : z * VOLLEY_COURT.z), c = cl.tall(x, z === -1 || z === 1.5 ? z : z * 10.5);
      expect(v / c, `${x}, ${z}`).toBeGreaterThan(1.5);
    }
    expect(vb.tall(0, -1)).toBeGreaterThan(90);
    expect(vb.tall(0, 1.5)).toBeGreaterThan(80);
  });
  // Volleyball's jump strikes a spike about four metres up (game/ball/model.ts VOLLEY_JUMP), so the frame holds the
  // rally low and close - a spike over either side of the net under the score bug's line, a set's top in the frame, the
  // far wall (and the low crowd strip over it) high in the frame, a set tilting the look up a little at most - and a body
  // stands at least 150 px tall at your mid-court at 720p.
  it('holds a spike over either side under the score bug, a set\'s top in the frame, and bodies at least 150 px tall', () => {
    for (const [w, h] of [[1280, 720], [844, 390]] as const) {
      const {px} = filmed(true, w, h);
      for (const [x, z] of [[-3, -1.2], [0, -1.2], [3, -1.2], [0, 1.2]] as const) expect(px(x, 4, z).y / h, `${w}x${h} ${x},${z}`).toBeGreaterThan(.14);
      expect(px(-3, 5.8, -1.6).y / h).toBeGreaterThan(0);
      expect(px(0, 1.15, VOLLEY_COURT.wallZ).y / h).toBeLessThan(.3);
      expect(px(0, 0, -VOLLEY_COURT.z).y / h).toBeLessThan(1);
    }
    expect(filmed(true).tall(2, -5)).toBeGreaterThan(150);
    expect(filmed(true, 1440, 900).tall(2, -5)).toBeGreaterThan(169);
    expect(filmed(true).tall(0, 1.5)).toBeGreaterThan(113);
    const still = filmed(true).cam.pose().look.y;
    const ours = filmed(true, 1280, 720, {touchTeam: 'red', ball: {...freshBall(), held: false, x: -3, y: 5.8, z: -1.6, vy: 1, shot: 'set', lastTeam: 'red', court: VOLLEY_COURT}}, {x: 0, y: 0, z: -4}, new THREE.Vector3(-3, 5.8, -1.6));
    // (A set's top is kept under the score bug's band - KEEP - the look rising after it, a few metres at most.)
    expect(ours.cam.pose().look.y).toBeLessThanOrEqual(still + 3.2);
    expect(ours.px(-3, 5.8, -1.6).y / 720, String(ours.px(-3, 5.8, -1.6).y)).toBeGreaterThan(KEEP.top - .02);
  });
  it('holds your whole court and the net in the frame, on a screen and on a phone on its side', () => {
    for (const [w, h] of [[1280, 720], [1440, 900], [844, 390]] as const) {
      const {px} = filmed(true, w, h), X = VOLLEY_COURT.x, Z = VOLLEY_COURT.z;
      for (const p of [px(-X, 0, -Z), px(X, 0, -Z), px(-X - 1.4, 2.7, 0), px(X + 1.4, 2.7, 0), px(0, 0, Z)]) {
        expect(p.x, `${w}x${h}`).toBeGreaterThan(0); expect(p.x).toBeLessThan(w);
        expect(p.y, `${w}x${h}`).toBeGreaterThan(0); expect(p.y).toBeLessThan(h);
      }
    }
  });
  it('thins the net it looks through, and leaves the classic stand as it was', () => {
    expect(filmed(true).cam.sheer).toBe(1);
    expect(filmed(false).cam.sheer).toBe(0);
    const cl = filmed(false).l;
    expect(cl.fov).toBeCloseTo(44, 0);
    expect(cl.position.y).toBeCloseTo(13, 0);
  });
});
