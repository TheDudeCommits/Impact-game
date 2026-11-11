import {describe, expect, it} from 'vitest';
import * as THREE from 'three';
import {BallCam, ballShadowFocus} from './BallCam';
import {BallMoments} from './BallMoments';
import {freshBall} from '../../game/ball/physics';
import {GOAL_RULES, type BallEvent, type BallView} from '../../game/ball/model';
import type {FollowCamera} from '../FollowCamera';
import type {GameSnapshot} from '../../game/types';

const view = (o: Partial<BallView> = {}): BallView => ({
  kind: 'ball', mode: 'goal-rush', phase: 'live', access: 'bots', round: 1, hostId: null, capacity: 6, fillBots: true, startsAt: null, startedAt: 0, endsAt: 240, phaseUntil: 0,
  seats: [], score: {red: 0, blue: 0}, ball: {...freshBall(), held: false}, clock: 200, overtime: false, touchTeam: null, touches: 0, rally: 0, servingTeam: 'red', serverId: null,
  target: 0, fever: false, winner: null, reason: '', mvp: null, events: [], replay: null, rumble: false, charms: [], effects: [], practice: false, best: 0, aim: null, hits: 0, streak: 0, bestStreak: 0, ...o});
const rig = () => ({mode: 'dynamic', keepInView: null, impact: (..._: unknown[]) => {}}) as unknown as FollowCamera;
const run = (cam: BallCam, r: FollowCamera, frames: number, yaw: number, self: THREE.Vector3, ball: THREE.Vector3, v = view()) => { for (let i = 0; i < frames; i++) yaw = cam.steer(r, 1 / 60, yaw, 'dynamic', self, ball, v, 'red'); return yaw; };

describe('the ball cam', () => {
  it('turns the view to the ball, films in the free composition, and keeps the ball in view', () => {
    const cam = new BallCam(), r = rig(), self = new THREE.Vector3(0, 0, 0), ball = new THREE.Vector3(10, 1, 0);
    const yaw = run(cam, r, 120, 0, self, ball);
    expect(yaw).toBeCloseTo(Math.PI / 2, 2);
    expect(r.mode).toBe('free');
    expect(r.keepInView?.toArray()).toEqual([10, 1, 0]);
  });
  it('holds its heading while the ball is overhead or at the feet, rather than whipping round', () => {
    const cam = new BallCam(), r = rig(), self = new THREE.Vector3(0, 0, 0);
    run(cam, r, 60, 0, self, new THREE.Vector3(0, 1, 10));
    const held = run(cam, r, 30, cam.steer(r, 1 / 60, 0, 'dynamic', self, new THREE.Vector3(.5, 6, -.3), view(), 'red'), self, new THREE.Vector3(.5, 6, -.3));
    expect(Math.abs(held)).toBeLessThan(.15);
  });
  it("SPORT's FREE LOOK: the player's heading is the view's, never eased back; BALL LOCK takes up from there", () => {
    const cam = new BallCam(), r = rig(), self = new THREE.Vector3(), ball = new THREE.Vector3(0, 1, 12), v = view({football: true});
    cam.free = true;
    let yaw = run(cam, r, 30, 0, self, ball, v);
    yaw = cam.steer(r, 1 / 60, yaw + 1.2, 'dynamic', self, ball, v, 'red');
    yaw = run(cam, r, 300, yaw, self, ball, v);
    expect(yaw).toBeCloseTo(1.2, 6);
    expect(r.keepInView).toBeNull();
    cam.free = false;
    const next = cam.steer(r, 1 / 60, yaw, 'dynamic', self, ball, v, 'red');
    expect(Math.abs(next - yaw)).toBeLessThan(.1);
    // (SPORT's calm BALL LOCK brings the ball back to its dead zone's edge as the lens sees it, 6.4 m behind the body -
    // not dead centre.)
    const back = run(cam, r, 240, next, self, ball, v);
    expect(Math.abs(back)).toBeLessThan(.85);
  });
  it("SPORT's BALL LOCK is calm: no turn while the ball is well inside the frame, and no faster than its cap", () => {
    const cam = new BallCam(), r = rig(), self = new THREE.Vector3(), v = view({football: true});
    let yaw = run(cam, r, 30, 0, self, new THREE.Vector3(0, 1, 12), v);
    // The ball moved a little across, still inside the frame: the view holds.
    const held = run(cam, r, 60, yaw, self, new THREE.Vector3(3, 1, 12), v);
    expect(Math.abs(held - yaw)).toBeLessThan(1e-6);
    // Behind: it comes round, never faster than the cap.
    let most = 0; yaw = held;
    for (let i = 0; i < 180; i++) { const next = cam.steer(r, 1 / 60, yaw, 'dynamic', self, new THREE.Vector3(0, 1, -12), v, 'red'); most = Math.max(most, Math.abs(Math.atan2(Math.sin(next - yaw), Math.cos(next - yaw))) * 60); yaw = next; }
    expect(most).toBeLessThanOrEqual(1.6 + 1e-6);
  });
  it('lets the player look away for a moment, then comes back to the ball', () => {
    const cam = new BallCam(), r = rig(), self = new THREE.Vector3(), ball = new THREE.Vector3(0, 1, 12);
    let yaw = run(cam, r, 30, 0, self, ball);
    yaw = cam.steer(r, 1 / 60, yaw + .4, 'dynamic', self, ball, view(), 'red');
    expect(yaw).toBeCloseTo(.4, 2);
    yaw = run(cam, r, 20, yaw, self, ball);
    expect(yaw).toBeGreaterThan(.3);
    yaw = run(cam, r, 180, yaw, self, ball);
    expect(Math.abs(yaw)).toBeLessThan(.05);
  });
  it('in the third it attacks, turns a share of the way to the goal so both are in the frame', () => {
    // (Eight metres from the goal it attacks, the player six behind it: laid from the goal line, as the pitch's size goes.)
    const cam = new BallCam(), r = rig(), self = new THREE.Vector3(8, 0, GOAL_RULES.halfZ - 14), ball = new THREE.Vector3(2, .6, GOAL_RULES.halfZ - 8);
    const yaw = run(cam, r, 120, 0, self, ball), toBall = Math.atan2(-6, 6), toGoal = Math.atan2(-8, 14);
    expect(yaw).toBeGreaterThan(toBall + .1);
    expect(yaw).toBeLessThan(toGoal);
    // In its own half it is the ball alone.
    const home = new BallCam();
    expect(run(home, r, 120, 0, new THREE.Vector3(8, 0, -12), new THREE.Vector3(2, .6, -6))).toBeCloseTo(Math.atan2(-6, 6), 2);
  });
  it('steps aside for the camera chosen when it is toggled off, out of play, or with no ball up', () => {
    const cam = new BallCam(), r = rig(), self = new THREE.Vector3();
    cam.pressed(1);
    expect(cam.on).toBe(false);
    expect(cam.steer(r, 1 / 60, .3, 'arena', self, new THREE.Vector3(5, 1, 5), view(), 'red')).toBe(.3);
    expect(r.mode).toBe('arena'); expect(r.keepInView).toBeNull();
    cam.pressed(2); expect(cam.on).toBe(true);
    cam.steer(r, 1 / 60, 0, 'dynamic', self, new THREE.Vector3(5, 1, 5), view({phase: 'over'}), 'red');
    expect(cam.active).toBe(false);
    cam.steer(r, 1 / 60, 0, 'dynamic', self, null, view(), 'red');
    expect(cam.active).toBe(false);
    // A couch that starts again counts its presses from nought: on again.
    cam.pressed(3); cam.pressed(0); expect(cam.on).toBe(true);
  });
  it('centres the shadow box between the player and the ball, never far from the player', () => {
    const out = new THREE.Vector3();
    expect(ballShadowFocus({x: 0, y: 0, z: 0}, {x: 6, y: 3, z: 0}, out).toArray()).toEqual([3, 0, 0]);
    expect(ballShadowFocus({x: 0, y: 0, z: 0}, {x: 0, y: 0, z: 40}, out).z).toBeCloseTo(7, 5);
    expect(ballShadowFocus({x: 1, y: 0, z: 2}, null, out).toArray()).toEqual([1, 0, 2]);
  });
});

describe('the ball moments', () => {
  const setup = () => {
    const calls: string[] = [], shakes: number[] = [];
    const frame = {impactFrame: () => calls.push('impact'), chromaticPulse: () => calls.push('chroma'), speedLines: () => calls.push('lines'), inkFlash: () => calls.push('ink'), inkKeep: () => {}};
    const lens = {impact: (w: number) => shakes.push(w)} as unknown as FollowCamera;
    const near = new THREE.Vector3(0, 0, 0), far = new THREE.Vector3(0, 0, 45);
    const moments = new BallMoments(frame, () => [[lens, near], [lens, far]], () => null);
    const snap = (events: Partial<BallEvent>[], t = 10) => ({serverTime: t, players: [], ball: view({events: events.map((e, i) => ({id: i + 1, at: t, kind: 'strike', x: 0, y: 1, z: 0, ...e}) as BallEvent)})}) as unknown as GameSnapshot;
    return {calls, shakes, moments, snap};
  };
  it('prints the INK FLASH for a goal and a super shot, and shakes every lens by its distance', () => {
    const {calls, shakes, moments, snap} = setup();
    moments.handle(snap([{kind: 'goal'}]));
    expect(calls).toEqual(expect.arrayContaining(['impact', 'chroma', 'lines', 'ink']));
    expect(shakes).toHaveLength(2);
    expect(shakes[0]).toBeGreaterThan(shakes[1] * 2);
    expect(shakes[1]).toBeGreaterThan(0);
    // Each event once, however many snapshots carry it.
    const before = calls.length; moments.handle(snap([{kind: 'goal'}])); expect(calls.length).toBe(before);
  });
  it('waits for a CLASH to break, and keeps the flash for the big moments only', () => {
    const {calls, moments, snap} = setup();
    moments.handle(snap([{kind: 'clash'}], 10));
    expect(calls).toHaveLength(0);
    // (The quiet rule: a CLASH breaking is felt - the lines - and prints nothing.)
    moments.handle(snap([{kind: 'clash'}], 10.6));
    expect(calls).toContain('lines');
    expect(calls).not.toContain('impact');
    expect(calls).not.toContain('ink');
    moments.handle(snap([{kind: 'clash'}, {kind: 'strike', text: 'SKY SPIKE'}, {kind: 'save', text: 'PERFECT SAVE'}], 11));
    expect(calls).not.toContain('impact');
    expect(calls).not.toContain('ink');
  });
});
