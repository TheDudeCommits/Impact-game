import {readFileSync} from 'node:fs';
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

  it("frames LEARN TO PLAY's BLOCK step: their hitter's glint well under the score bug, you clear of the lesson's line", () => {
    // Their hitter at the top of its jump on the far side (feet near five metres up), its glint's flare over its hand to
    // 7.4 m; the set at 5.2 m; you at the net. Where each is on the screen, as a share of the way down from the top edge.
    for (const team of ['red', 'blue'] as const) {
      const s = team === 'red' ? 1 : -1, glint = new THREE.Vector3(.4, 7.4, s * 3.9), set = new THREE.Vector3(.3, 5.2, s * 2), head = new THREE.Vector3(0, 1.9, -s * 1.05), feet = new THREE.Vector3(0, 0, -s * 1.05);
      for (const aspect of [16 / 9, 844 / 390]) {
        const frame = (step: boolean) => {
          const cam = new SpikeCam(), r = rig(), l = new THREE.PerspectiveCamera(50, aspect, .1, 500);
          const lesson = step ? {mode: 'sky-spike', index: 3, step: 'ss-block', state: 'live', at: 0, done: [], skipped: [], tries: 0, miss: null, parts: [], praise: '', cue: null} : undefined;
          for (let i = 0; i < 240; i++) { cam.steer(r, 1 / 60, 0, NaN, true, {x: 0, y: 0, z: feet.z}, set, view({practice: !!step, lesson} as Partial<BallView>), team, aspect); cam.aim(r, l, 0); }
          const down = (v: THREE.Vector3) => (1 - v.clone().project(l).y) / 2;
          return {glint: down(glint), set: down(set), head: down(head), feet: down(feet)};
        };
        const stand = frame(false), step = frame(true);
        // From the stand the flare tops out at the screen's very edge, under the score bug (a match's framing, untouched).
        expect(stand.glint).toBeLessThan(.05);
        // In the step: the flare a fifth of the way down or more, the set in the frame; on a desktop you are over the
        // lesson's line (two thirds down), on a phone on its side under it (it crosses the middle there) and over the meter.
        expect(step.glint).toBeGreaterThan(.18); expect(step.set).toBeGreaterThan(step.glint);
        if (aspect < 2) expect(step.feet).toBeLessThan(.68); else expect(step.head).toBeGreaterThan(.6);
        expect(step.feet).toBeLessThan(.77);
      }
    }
  });
});

/**
 * The COURT-SIDE stand, an option (ballCamChoice.ts; the classic stand's own numbers are held by
 * camDefaults.test.ts). What it must do: stand 5.6 to 7 m up on the court's own heading, as still as the classic stand
 * or stiller, with both halves of the court, the net and a high ball in the frame, the bodies clearly larger; and frame
 * what was placed for the classic stand - the serve's walk-up, LEARN TO PLAY's BLOCK step, a couch split's halves.
 */
describe("Sky Spike's court-side stand (an option)", () => {
  const R = {halfX: 7.5, halfZ: 10.5, net: 2.7, post: 1.4};
  const SCREEN = 16 / 9, PHONE = 844 / 390, TOP_BOTTOM = 1920 / 540, SIDE_BY_SIDE = 960 / 1080;
  /** A camera settled on a frame: where a point is in it, as shares of the frame (0, 0 top left), and a body's height. */
  const settled = (style: 'classic' | 'side', aspect: number, o: {team?: 'red' | 'blue'; self?: {x: number; y: number; z: number}; ball?: THREE.Vector3; view?: Partial<BallView>; frames?: number} = {}) => {
    const cam = new SpikeCam(), r = rig(), l = new THREE.PerspectiveCamera(50, aspect, .1, 500), team = o.team ?? 'red', s = team === 'red' ? 1 : -1;
    cam.style = style;
    let yaw = 0;
    for (let i = 0; i < (o.frames ?? 1); i++) { yaw = cam.steer(r, 1 / 60, yaw, NaN, true, o.self ?? {x: 0, y: 0, z: -s * 5}, o.ball ?? new THREE.Vector3(0, 3, 0), view(o.view), team, aspect); cam.aim(r, l, 0); }
    const at = (x: number, y: number, z: number) => { const v = new THREE.Vector3(x, y, z).project(l); return {x: (v.x + 1) / 2, y: (1 - v.y) / 2, front: v.z < 1}; };
    const inside = (x: number, y: number, z: number, margin = 0) => { const p = at(x, y, z); return p.front && p.x >= margin && p.x <= 1 - margin && p.y >= margin && p.y <= 1 - margin; };
    const tall = (x: number, z: number, h = 1.8) => (at(x, 0, z).y - at(x, h, z).y) * 1080;
    return {cam, lens: l, at, inside, tall, yaw};
  };

  it('stands 5.6 to 7 m up behind your own baseline, on the same fixed heading as the classic stand, whichever side you are', () => {
    for (const [team, heading] of [['red', 0], ['blue', Math.PI]] as const) {
      const side = settled('side', SCREEN, {team}), classic = settled('classic', SCREEN, {team}), eye = side.cam.pose().eye;
      expect(eye.y).toBeGreaterThanOrEqual(5.6); expect(eye.y).toBeLessThanOrEqual(7);
      expect(Math.sign(eye.z)).toBe(team === 'red' ? -1 : 1);
      expect(Math.abs(eye.z)).toBeGreaterThan(R.halfZ + 10);
      expect(eye.x).toBe(0);
      expect(Math.abs(wrapped(side.yaw - heading))).toBeLessThan(1e-9);
      expect(wrapped(side.yaw - classic.yaw)).toBeCloseTo(0, 9);
      // Under half the classic stand's height, on a longer lens.
      expect(eye.y).toBeLessThan(classic.cam.pose().eye.y * .55);
      expect(side.cam.pose().fov).toBeLessThan(classic.cam.pose().fov - 8);
    }
  });

  it('holds both halves of the court, the net and a ball nine metres over it in the frame - on a screen, a phone and a wide half', () => {
    for (const aspect of [SCREEN, PHONE, TOP_BOTTOM, 21 / 9]) for (const team of ['red', 'blue'] as const) {
      const f = settled('side', aspect, {team}), what = `aspect ${aspect.toFixed(2)}, ${team}`;
      // The court's four corners (a body standing on a near one is whole), the net's posts and cord, the far baseline's heads.
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) expect(f.inside(sx * R.halfX, 0, sz * R.halfZ, .01), `${what}: corner ${sx},${sz}`).toBe(true);
      for (const sx of [-1, 1]) { expect(f.inside(sx * (R.halfX + R.post), R.net, 0, .02), `${what}: net post`).toBe(true); expect(f.inside(sx * R.halfX, 1.9, R.halfZ * (team === 'red' ? 1 : -1), .02), `${what}: far head`).toBe(true); }
      // A ball nine metres up over the net, and over either baseline at eight.
      expect(f.inside(0, 9, 0), `${what}: a ball at 9 m`).toBe(true);
      for (const sz of [-1, 1]) expect(f.inside(0, 8, sz * R.halfZ), `${what}: a ball at 8 m over a baseline`).toBe(true);
      // A hitter at the top of a jump on either side of the net (feet five metres up), head to foot.
      for (const sz of [-1, 1]) for (const y of [5, 6.9]) expect(f.inside(3, y, sz * 2.5, .01), `${what}: a hitter at the top of a jump`).toBe(true);
    }
  });

  it('keeps the near corners on any narrower screen by opening the lens (16:10, 4:3), never by moving', () => {
    const wide = settled('side', SCREEN);
    for (const aspect of [1.6, 1.5, 4 / 3]) {
      const f = settled('side', aspect);
      for (const sx of [-1, 1]) expect(f.inside(sx * R.halfX, 0, -R.halfZ, .01), `aspect ${aspect.toFixed(2)}`).toBe(true);
      expect(f.cam.pose().eye.toArray()).toEqual(wide.cam.pose().eye.toArray());
      expect(f.cam.pose().fov).toBeGreaterThan(wide.cam.pose().fov);
      // (What it shows from side to side is what the screen's frame shows.)
      expect(f.at(R.halfX, 0, -R.halfZ).x).toBeCloseTo(wide.at(R.halfX, 0, -R.halfZ).x, 3);
    }
  });

  it('shows every body larger than the classic stand does: your own side by 45% or more, the far side by more than a quarter', () => {
    const side = settled('side', SCREEN), classic = settled('classic', SCREEN);
    for (const z of [-9, -7, -5, -3, -1]) expect(side.tall(0, z) / classic.tall(0, z), `own side, z ${z}`).toBeGreaterThan(1.45);
    for (const z of [1, 3, 5, 7, 9]) expect(side.tall(0, z) / classic.tall(0, z), `far side, z ${z}`).toBeGreaterThan(1.28);
    // (At 1080p: a 1.8 m body by its own baseline, at the net, and at the far baseline.)
    expect(side.tall(0, -8)).toBeGreaterThan(170); expect(side.tall(0, -2)).toBeGreaterThan(130); expect(side.tall(0, 8)).toBeGreaterThan(95);
  });

  it('is as still as the classic stand: it never drifts, and its heading holds while the ball crosses over the player', () => {
    const cam = new SpikeCam(), r = rig(), l = lens(), self = {x: 1, y: 0, z: -4}, ball = new THREE.Vector3();
    cam.style = 'side';
    const dir = new THREE.Vector3(), last = new THREE.Vector3(), from = new THREE.Vector3();
    let yaw = 0, most = 0, low = Infinity, high = -Infinity, moved = 0;
    for (let i = 0; i < 900; i++) {
      const t = i / 60;
      // The player from one sideline to the other, a ball looping over them and over the net, up to seven metres.
      self.x = Math.sin(t * .9) * 7.4; self.z = -5 + Math.cos(t * .6) * 4;
      ball.set(self.x + Math.sin(t * 2.1) * 2.5, 3 + Math.abs(Math.sin(t * 1.3)) * 4, -4 + Math.cos(t * 1.7) * 6);
      yaw = cam.steer(r, 1 / 60, yaw, NaN, true, self, ball, view(), 'red', SCREEN);
      cam.aim(r, l, 0);
      l.getWorldDirection(dir);
      if (i > 0) { most = Math.max(most, dir.angleTo(last) * 60); moved = Math.max(moved, l.position.distanceTo(from)); } else from.copy(l.position);
      last.copy(dir);
      low = Math.min(low, yaw); high = Math.max(high, yaw);
    }
    // Not a millimetre, not a hundredth of a degree: the whole court is in the frame from one spot.
    expect(moved).toBeLessThan(1e-9);
    expect(most * 180 / Math.PI).toBeLessThan(.01);
    expect(high - low).toBeLessThan(1e-9);
  });

  it('handles a very high ball as the classic stand does: the look lifts a little after it, no further', () => {
    const rest = settled('side', SCREEN, {frames: 300}), classicRest = settled('classic', SCREEN, {frames: 300});
    for (const y of [10, 14, 20]) {
      const f = settled('side', SCREEN, {ball: new THREE.Vector3(0, y, 0), frames: 600}), c = settled('classic', SCREEN, {ball: new THREE.Vector3(0, y, 0), frames: 600});
      // The frame gives up no more of its foot than the classic's does (shares of the frame's height)...
      const gave = f.at(0, 0, -R.halfZ).y - rest.at(0, 0, -R.halfZ).y, classicGave = c.at(0, 0, -R.halfZ).y - classicRest.at(0, 0, -R.halfZ).y;
      expect(gave, `a ball at ${y} m`).toBeGreaterThan(0); expect(gave, `a ball at ${y} m`).toBeLessThanOrEqual(classicGave + .005);
      // ...your own side stays in it, and the heading never turns.
      expect(f.inside(0, 0, -8)).toBe(true); expect(f.inside(0, 1.9, -1)).toBe(true);
      expect(f.yaw).toBeCloseTo(rest.yaw, 9);
    }
    // A ball the classic frame holds, this frame holds too.
    for (const y of [6, 7, 8, 9]) { const b = new THREE.Vector3(0, y, 0), c = settled('classic', SCREEN, {ball: b, frames: 600}); if (c.inside(0, y, 0)) expect(settled('side', SCREEN, {ball: b, frames: 600}).inside(0, y, 0), `a ball at ${y} m`).toBe(true); }
  });

  it("frames the walk-up: your side's server behind the baseline, a JUMP SERVE's top, and the far side still in the frame", () => {
    const server = {x: 0, y: 0, z: -(R.halfZ + 1.4)};
    for (const aspect of [SCREEN, PHONE, TOP_BOTTOM]) {
      const f = settled('side', aspect, {self: server, ball: new THREE.Vector3(0, 1.75, -R.halfZ - .3), view: {phase: 'kickoff', servingTeam: 'red'}, frames: 300});
      const eye = f.cam.pose().eye;
      // A small step closer and lower (the classic's walk-up is a larger one), never under 5.6 m; the lens opens a little
      // instead, so the server's feet and the glint over a JUMP SERVE's top (7.4 m) share the frame.
      expect(eye.y).toBeGreaterThanOrEqual(5.6); expect(eye.y).toBeLessThan(7); expect(Math.abs(eye.z)).toBeLessThan(R.halfZ + 14);
      for (const x of [-2, 0, 2]) { expect(f.inside(x, 0, server.z, .02), `aspect ${aspect.toFixed(2)}: the server's feet`).toBe(true); expect(f.inside(x, 7.4, server.z + 1, .02), `aspect ${aspect.toFixed(2)}: a JUMP SERVE's glint`).toBe(true); }
      for (const sx of [-1, 1]) expect(f.inside(sx * R.halfX, 1.9, R.halfZ, .01), `aspect ${aspect.toFixed(2)}: the far baseline`).toBe(true);
    }
  });

  it('stays between 5.6 and 7 m up through a serve, a rally, a set, a PERFECT SPIKE and a big point, and moves for them no more than the classic stand', () => {
    const run = (style: 'classic' | 'side') => {
      const cam = new SpikeCam(), r = rig(), l = lens(), self = {x: 0, y: 0, z: -5}, ball = new THREE.Vector3(), events: BallEvent[] = [];
      cam.style = style;
      const at = new THREE.Vector3(), last = new THREE.Vector3(), dir = new THREE.Vector3(), lastDir = new THREE.Vector3();
      let low = Infinity, high = -Infinity, travel = 0, turn = 0, least = Infinity;
      for (let i = 0; i < 780; i++) {
        const t = i / 60, phase = t < 1.5 ? 'kickoff' : t < 9 ? 'live' : t < 11 ? 'scored' : 'kickoff';
        self.x = Math.sin(t * .7) * 6; ball.set(Math.sin(t * 1.1) * 5, 3 + (1 + Math.sin(t * .9)) * 3, Math.cos(t * 1.3) * 8);
        if (i === 200) events.push({id: 1, at: t, kind: 'strike', shot: 'spike', text: 'SKY SPIKE', perfect: true, x: ball.x, y: ball.y, z: ball.z, team: 'red'});
        if (i === 540) events.push({id: 2, at: t, kind: 'kill', x: 3, y: 0, z: 6, team: 'red'});
        cam.steer(r, 1 / 60, 0, NaN, true, self, ball, view({phase, events, rally: 2 + Math.floor(t), score: {red: 10, blue: 9}, touchTeam: 'red', ball: {...freshBall(), held: false, shot: t > 3 && t < 4.5 ? 'set' : 'spike', lastTeam: 'red'}}), 'red', SCREEN);
        cam.aim(r, l, 0);
        at.copy(l.position); l.getWorldDirection(dir);
        if (i > 0) { travel += at.distanceTo(last); turn += dir.angleTo(lastDir); }
        last.copy(at); lastDir.copy(dir); low = Math.min(low, at.y); high = Math.max(high, at.y); least = Math.min(least, l.fov);
      }
      return {low, high, travel, turn, least};
    };
    const side = run('side'), classic = run('classic');
    expect(side.low).toBeGreaterThanOrEqual(5.6); expect(side.high).toBeLessThanOrEqual(7);
    expect(side.travel).toBeLessThan(classic.travel); expect(side.turn).toBeLessThan(classic.turn);
    // (The lens closes for a point and a strike by no larger a share of itself.)
    expect(side.least / 33).toBeGreaterThanOrEqual(classic.least / 44 - .005);
  });

  it("frames LEARN TO PLAY's BLOCK step as the classic stand does: the glint under the score bug, you clear of the lesson's line", () => {
    for (const team of ['red', 'blue'] as const) {
      const s = team === 'red' ? 1 : -1, lesson = {mode: 'sky-spike', index: 3, step: 'ss-block', state: 'live', at: 0, done: [], skipped: [], tries: 0, miss: null, parts: [], praise: '', cue: null};
      for (const aspect of [SCREEN, PHONE]) {
        const f = settled('side', aspect, {team, self: {x: 0, y: 0, z: -s * 1.05}, ball: new THREE.Vector3(.3, 5.2, s * 2), view: {practice: true, lesson} as Partial<BallView>, frames: 240});
        const glint = f.at(.4, 7.4, s * 3.9).y, set = f.at(.3, 5.2, s * 2).y, head = f.at(0, 1.9, -s * 1.05).y, feet = f.at(0, 0, -s * 1.05).y;
        expect(glint).toBeGreaterThan(.18); expect(set).toBeGreaterThan(glint);
        if (aspect < 2) expect(feet).toBeLessThan(.68); else expect(head).toBeGreaterThan(.6);
        expect(feet).toBeLessThan(.77);
      }
    }
  });

  it("gives a couch split's halves each their own: a wide half the screen's frame, a narrow half no less of the near baseline than the classic's", () => {
    // Top and bottom: the same stand and lens as a screen's (the court fills the height either way).
    const wide = settled('side', TOP_BOTTOM), screen = settled('side', SCREEN);
    expect(wide.cam.pose().eye.toArray()).toEqual(screen.cam.pose().eye.toArray()); expect(wide.cam.pose().fov).toBe(screen.cam.pose().fov);
    // Side by side: the lens opens as far as it may; the near baseline it shows is the classic half's, within a stride.
    const narrow = settled('side', SIDE_BY_SIDE), classic = settled('classic', SIDE_BY_SIDE);
    const shown = (f: typeof narrow) => { let x = 0; while (x < 12 && f.inside(x + .25, 0, -R.halfZ)) x += .25; return x; };
    expect(shown(narrow)).toBeGreaterThanOrEqual(shown(classic) - .5);
    expect(narrow.inside(0, 9, 0)).toBe(true); for (const sx of [-1, 1]) expect(narrow.inside(sx * R.halfX, 0, R.halfZ)).toBe(true);
    expect(narrow.tall(0, -5)).toBeGreaterThan(classic.tall(0, -5));
  });

  it("keeps the net and the far court under the banner's place (ui/hud/ballHud.css) on every view the HUD is drawn in, as the classic stand does", () => {
    // (The HUD's own test, ui/hud/ballBanner.test.ts, holds the classic stand to it. From down here the net and the far
    // court sit near the middle of the frame; only a hitter's head at the top of a jump at the net reaches the banner's
    // place, as it reaches under the score bug from the classic stand.)
    const css = readFileSync(new URL('../../ui/hud/ballHud.css', import.meta.url), 'utf8'), rule = css.slice(css.indexOf('{--bh-red'), css.indexOf('@supports'));
    const n = (name: string) => Number(new RegExp(`--bh-${name}:([\\d.]+)[;}]`).exec(rule)![1]), vh = Number(/([\d.]+)vh/.exec(/--bh-u:min\(([^)]+)\)/.exec(rule)![1])![1]) / 100;
    const foot = (n('edge') + n('bug') + n('line-gap') + n('line') + n('banner-gap') + n('banner')) * vh;
    expect(foot).toBeGreaterThan(.2);
    const play: THREE.Vector3[] = [];
    for (const x of [-R.halfX, -R.halfX / 2, 0, R.halfX / 2, R.halfX]) { for (const y of [R.net - 1, R.net, R.net + R.post - 1]) play.push(new THREE.Vector3(x, y, 0)); for (const z of [3, 6, 9, R.halfZ]) play.push(new THREE.Vector3(x, 1.9, z)); }
    for (const aspect of [SCREEN, PHONE, SIDE_BY_SIDE, TOP_BOTTOM]) for (const team of ['red', 'blue'] as const) {
      const s = team === 'red' ? 1 : -1, foe = team === 'red' ? 'blue' : 'red', pts = play.map(p => new THREE.Vector3(p.x, p.y, p.z * s));
      for (const steps of [[{}], [{rally: 12, fever: true}], [{score: {red: 10, blue: 10}, rally: 8}],
        [{events: [{id: 1, at: 0, kind: 'strike', perfect: true, shot: 'spike', x: 0, y: 3, z: 0}]}, {phase: 'scored', rally: 9, score: {red: 10, blue: 10}, events: [{id: 1, at: 0, kind: 'strike', perfect: true, shot: 'spike', x: 0, y: 3, z: 0}, {id: 2, at: 0, kind: 'kill', team, x: 1.5, y: 0, z: s * 6}]}]] as Partial<BallView>[][]) {
        const cam = new SpikeCam(), r = rig(), l = new THREE.PerspectiveCamera(50, aspect, .1, 500);
        cam.style = 'side';
        let top = Infinity;
        for (const step of [{}, ...steps]) for (let i = 0; i < 120; i++) {
          cam.steer(r, 1 / 60, 0, NaN, true, {x: 0, y: 0, z: -s * 4}, new THREE.Vector3(0, 2.5, -s * 5), view({servingTeam: foe, ...step}), team, aspect); cam.aim(r, l, 0);
          for (const p of pts) { const v = p.clone().project(l); if (v.z < 1) top = Math.min(top, (1 - v.y) / 2); }
        }
        expect(top, `aspect ${aspect.toFixed(2)}, ${team}, ${JSON.stringify(steps.at(-1)).slice(0, 40)}`).toBeGreaterThan(foot + .03);
      }
    }
  });

  it('is a cut from one stand to the other when the option changes, and the classic stand comes back to the millimetre', () => {
    const cam = new SpikeCam(), r = rig(), l = lens(), self = {x: 0, y: 0, z: -5}, ball = new THREE.Vector3(0, 3, 0);
    const step = () => { cam.steer(r, 1 / 60, 0, NaN, true, self, ball, view(), 'red', SCREEN); cam.aim(r, l, 0); };
    for (let i = 0; i < 30; i++) step();
    const before = l.position.clone(), beforeFov = l.fov;
    expect(cam.sheer).toBe(0);
    cam.style = 'side'; step();
    expect(l.position.y).toBeCloseTo(7, 9); expect(l.position.z).toBeCloseTo(-24.5, 9); expect(cam.sheer).toBe(1);
    cam.style = 'classic'; step();
    expect(l.position.distanceTo(before)).toBeLessThan(1e-9); expect(l.fov).toBe(beforeFov); expect(cam.sheer).toBe(0);
    // Not filming (Tab's free camera, Goal Rush, the match over), the net is drawn as it is.
    cam.style = 'side'; cam.steer(r, 1 / 60, 0, .7, false, self, ball, view(), 'red', SCREEN);
    expect(cam.sheer).toBe(0);
  });
});

