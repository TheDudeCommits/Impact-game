import {describe, expect, it} from 'vitest';
import * as THREE from 'three';
import {SpikeCam} from './SpikeCam';
import {freshBall} from '../../game/ball/physics';
import type {BallEvent, BallView} from '../../game/ball/model';
import type {FollowCamera} from '../FollowCamera';

const view = (o: Partial<BallView> = {}): BallView => ({
  kind: 'ball', mode: 'sky-spike', phase: 'live', access: 'bots', round: 1, hostId: null, capacity: 6, fillBots: true, startsAt: null, startedAt: 0, endsAt: 0, phaseUntil: 0,
  seats: [], score: {red: 0, blue: 0}, ball: {...freshBall(), held: false}, clock: 0, overtime: false, touchTeam: null, touches: 0, rally: 1, servingTeam: 'red', serverId: null,
  target: 11, fever: false, winner: null, reason: '', mvp: null, events: [], replay: null, rumble: false, charms: [], effects: [], practice: false, best: 0, aim: null, hits: 0, streak: 0, bestStreak: 0, ...o});
const rig = () => ({mode: 'dynamic', keepInView: null, sportFov: 14, movementYaw: 0}) as unknown as FollowCamera;
const lens = () => new THREE.PerspectiveCamera(50, 16 / 9, .1, 500);
const wrapped = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

describe("Sky Spike's broadcast camera", () => {
  it('looks across the net from behind your own side, on one heading, whichever side you are', () => {
    for (const [team, heading] of [['red', 0], ['blue', Math.PI]] as const) {
      const cam = new SpikeCam(), r = rig(), l = lens();
      const yaw = cam.steer(r, 1 / 60, 1.2, 1.2, true, {x: 0, y: 0, z: team === 'red' ? -5 : 5}, new THREE.Vector3(0, 3, 0), view(), team, 16 / 9);
      expect(Math.abs(wrapped(yaw - heading))).toBeLessThan(.05);
      expect(r.mode).toBe('free'); expect(r.keepInView).toBeNull();
      cam.aim(r, l, 0);
      // Behind the own baseline, up high, looking along the heading.
      expect(Math.sign(l.position.z)).toBe(team === 'red' ? -1 : 1);
      expect(Math.abs(l.position.z)).toBeGreaterThan(18);
      expect(l.position.y).toBeGreaterThan(10);
      const fwd = new THREE.Vector3(); l.getWorldDirection(fwd);
      expect(Math.abs(wrapped(Math.atan2(fwd.x, fwd.z) - heading))).toBeLessThan(.05);
      expect(r.movementYaw).toBeCloseTo(yaw, 6);
    }
  });

  it('holds still while the ball crosses back and forth over the player, where the ball cam swung round', () => {
    const cam = new SpikeCam(), r = rig(), l = lens(), self = {x: 1, y: 0, z: -4}, ball = new THREE.Vector3();
    const dir = new THREE.Vector3(), last = new THREE.Vector3();
    let yaw = 0, most = 0, low = Infinity, high = -Infinity;
    for (let i = 0; i < 600; i++) {
      const t = i / 60;
      // A ball looping over the player's head, from in front to behind and back, and over the net.
      ball.set(1 + Math.sin(t * 2.1) * 2.5, 3 + Math.abs(Math.sin(t * 1.3)) * 4, -4 + Math.cos(t * 1.7) * 6);
      yaw = cam.steer(r, 1 / 60, yaw, NaN, true, self, ball, view(), 'red', 16 / 9);
      cam.aim(r, l, 0);
      l.getWorldDirection(dir);
      if (i > 0) most = Math.max(most, dir.angleTo(last) * 60);
      last.copy(dir);
      low = Math.min(low, yaw); high = Math.max(high, yaw);
    }
    // Under four degrees a second at its fastest, and a heading that never leaves a few degrees.
    expect(most * 180 / Math.PI).toBeLessThan(4);
    expect(high - low).toBeLessThan(.08);
  });

  it('drifts across only once the play has moved a way, gently and no faster than its cap', () => {
    const cam = new SpikeCam(), r = rig(), l = lens(), ball = new THREE.Vector3(0, 2, -3);
    const at = (x: number, frames: number) => { let fastest = 0, before = 0; for (let i = 0; i < frames; i++) { cam.steer(r, 1 / 60, 0, NaN, true, {x, y: 0, z: -4}, ball, view(), 'red', 16 / 9); cam.aim(r, l, 0); if (i) fastest = Math.max(fastest, Math.abs(l.position.x - before) * 60); before = l.position.x; } return {x: l.position.x, fastest}; };
    const still = at(0, 60).x;
    // A step or so to the side: inside the dead zone, nothing moves.
    expect(at(1.6, 120).x).toBeCloseTo(still, 3);
    // Across the court: it follows, at no more than its speed.
    const moved = at(6, 240);
    expect(moved.x).toBeGreaterThan(still + 1);
    expect(moved.fastest).toBeLessThanOrEqual(2.7);
  });

  it("lets the player pan a little, then comes back to the court's heading", () => {
    const cam = new SpikeCam(), r = rig(), self = {x: 0, y: 0, z: -4}, ball = new THREE.Vector3(0, 3, 0);
    let yaw = cam.steer(r, 1 / 60, 0, NaN, true, self, ball, view(), 'red', 16 / 9);
    yaw = cam.steer(r, 1 / 60, yaw + .3, NaN, true, self, ball, view(), 'red', 16 / 9);
    expect(yaw).toBeGreaterThan(.25);
    // Never further than its bound, however far the mouse goes.
    for (let i = 0; i < 10; i++) yaw = cam.steer(r, 1 / 60, yaw + .3, NaN, true, self, ball, view(), 'red', 16 / 9);
    expect(yaw).toBeLessThan(.5);
    for (let i = 0; i < 360; i++) yaw = cam.steer(r, 1 / 60, yaw, NaN, true, self, ball, view(), 'red', 16 / 9);
    expect(Math.abs(yaw)).toBeLessThan(.05);
  });

  it('punches in for a PERFECT SPIKE and eases back out', () => {
    const cam = new SpikeCam(), r = rig(), l = lens(), self = {x: 0, y: 0, z: -4}, ball = new THREE.Vector3(0, 5, -1);
    for (let i = 0; i < 30; i++) cam.steer(r, 1 / 60, 0, NaN, true, self, ball, view(), 'red', 16 / 9);
    const rest = cam.pose().fov;
    const spike: BallEvent = {id: 1, at: 1, kind: 'strike', shot: 'spike', text: 'SKY SPIKE', perfect: true, x: 0, y: 5, z: -1, team: 'red'};
    // In over a few frames, not on one.
    cam.steer(r, 1 / 60, 0, NaN, true, self, ball, view({events: [spike]}), 'red', 16 / 9);
    expect(cam.pose().fov).toBeGreaterThan(rest - 3);
    for (let i = 0; i < 6; i++) cam.steer(r, 1 / 60, 0, NaN, true, self, ball, view({events: [spike]}), 'red', 16 / 9);
    expect(cam.pose().fov).toBeLessThan(rest - 3);
    for (let i = 0; i < 120; i++) cam.steer(r, 1 / 60, 0, NaN, true, self, ball, view({events: [spike]}), 'red', 16 / 9);
    cam.aim(r, l, 0);
    expect(cam.pose().fov).toBeCloseTo(rest, 1);
  });

  it('closes in, never turning, at match point and DEUCE and as a long rally climbs', () => {
    const settle = (v: BallView) => {
      const cam = new SpikeCam(), r = rig(), l = lens(), self = {x: 0, y: 0, z: -4}, ball = new THREE.Vector3(0, 3, 2);
      let yaw = 0;
      for (let i = 0; i < 240; i++) yaw = cam.steer(r, 1 / 60, yaw, NaN, true, self, ball, v, 'red', 16 / 9);
      cam.aim(r, l, 0);
      return {fov: cam.pose().fov, eye: cam.pose().eye.clone(), yaw};
    };
    expect(SpikeCam.onTheEdge(view({score: {red: 10, blue: 8}}))).toBe(true);
    expect(SpikeCam.onTheEdge(view({score: {red: 10, blue: 10}}))).toBe(true);
    expect(SpikeCam.onTheEdge(view({score: {red: 9, blue: 9}}))).toBe(false);
    expect(SpikeCam.onTheEdge(view({score: {red: 7, blue: 3}}))).toBe(false);
    const calm = settle(view({score: {red: 4, blue: 3}})), edge = settle(view({score: {red: 10, blue: 9}})), long = settle(view({rally: 9}));
    for (const tense of [edge, long]) {
      expect(tense.fov).toBeLessThan(calm.fov - 2);
      expect(Math.abs(tense.eye.z)).toBeLessThan(Math.abs(calm.eye.z) - .5);
      expect(Math.abs(tense.yaw - calm.yaw)).toBeLessThan(1e-6);
    }
  });

  it("steps aside for the ball cam's heading when toggled off, in Goal Rush, and out of play", () => {
    const cam = new SpikeCam(), r = rig(), l = lens(), self = {x: 0, y: 0, z: -4}, ball = new THREE.Vector3(0, 3, 0);
    expect(cam.steer(r, 1 / 60, .3, .7, false, self, ball, view(), 'red', 16 / 9)).toBe(.7);
    expect(cam.active).toBe(false);
    expect(cam.steer(r, 1 / 60, .3, .7, true, self, ball, view({mode: 'goal-rush'}), 'red', 16 / 9)).toBe(.7);
    expect(cam.steer(r, 1 / 60, .3, .7, true, self, ball, view({phase: 'over'}), 'red', 16 / 9)).toBe(.7);
    // Not filming, it leaves the lens alone.
    l.position.set(1, 2, 3); cam.aim(r, l, 0);
    expect(l.position.toArray()).toEqual([1, 2, 3]);
  });
});
