import {writeFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import * as THREE from 'three';
import {SpikeCam} from './SpikeCam';
import {BallChase, type ChaseFrame} from './BallChase';
import {freshBall} from '../../game/ball/physics';
import type {BallEvent, BallTeam, BallView} from '../../game/ball/model';
import type {FollowCamera} from '../FollowCamera';
import golden from './camDefaults.golden.json';

/**
 * The ball modes' cameras as they are, pinned. A camera players know is not changed under them, so the two camera
 * options are off by default, and with them off the lens must stand, move and frame exactly as it did before the
 * options. These runs were recorded before either option existed (camDefaults.golden.json): a scripted
 * serve, rally and point through Sky Spike's broadcast camera on every aspect it knows, and a scripted run, lob, wall,
 * FIGHT stance and hand-over through Goal Rush's chase rig. Every lens position, turn and field of view is compared, to
 * a hundredth of a millimetre. A change to a default camera's numbers fails here, on purpose; a deliberate one records them
 * (`CAM_GOLDEN=record npx vitest run src/render/ball/camDefaults.test.ts` records the runs again).
 */
const GOLDEN = golden as unknown as Record<string, number[][]>;
const RECORD = process.env.CAM_GOLDEN === 'record', recorded: Record<string, number[][]> = {};
const view = (o: Partial<BallView> = {}): BallView => ({
  kind: 'ball', mode: 'sky-spike', phase: 'live', access: 'bots', round: 1, hostId: null, capacity: 6, fillBots: true, startsAt: null, startedAt: 0, endsAt: 0, phaseUntil: 0,
  seats: [], score: {red: 0, blue: 0}, ball: {...freshBall(), held: false}, clock: 0, overtime: false, touchTeam: null, touches: 0, rally: 1, servingTeam: 'red', serverId: null,
  target: 11, fever: false, winner: null, reason: '', mvp: null, events: [], replay: null, rumble: false, charms: [], effects: [], practice: false, best: 0, aim: null, hits: 0, streak: 0, bestStreak: 0, ...o});
const rig = () => ({mode: 'dynamic', keepInView: null, sportFov: 14, movementYaw: 0}) as unknown as FollowCamera;
const round = (n: number) => Math.round(n * 1e6) / 1e6;
const pose = (l: THREE.PerspectiveCamera) => [l.position.x, l.position.y, l.position.z, l.quaternion.x, l.quaternion.y, l.quaternion.z, l.quaternion.w, l.fov].map(round);

/** Twelve seconds of Sky Spike through one camera: a serve's walk-up, a rally with a set, a PERFECT SPIKE, a block, a
 *  SUPER SHOT and a ball over twelve metres up, the player panning, a kill, the point's beat and the next walk-up - at a
 *  tense score for `tense`, in LEARN TO PLAY's BLOCK step for `lesson`. The lens every half second. */
function spikeRun(cam: SpikeCam, team: BallTeam, aspect: number, o: {tense?: boolean; lesson?: boolean} = {}) {
  const r = rig(), l = new THREE.PerspectiveCamera(50, aspect, .1, 500), s = team === 'red' ? 1 : -1, out: number[][] = [];
  const self = {x: 0, y: 0, z: 0}, ball = new THREE.Vector3(), events: BallEvent[] = [];
  const lesson = o.lesson ? {mode: 'sky-spike', index: 3, step: 'ss-block', state: 'live', at: 0, done: [], skipped: [], tries: 0, miss: null, parts: [], praise: '', cue: null} : undefined;
  let yaw = 0;
  for (let i = 0; i < 720; i++) {
    const t = i / 60, phase = t < 1.5 ? 'kickoff' : t < 9 ? 'live' : t < 10.5 ? 'scored' : 'kickoff';
    self.x = Math.sin(t * .7) * 6; self.z = -s * (5 + 3 * Math.cos(t * .5)); self.y = Math.max(0, Math.sin(t * 2.3)) * 2;
    ball.set(Math.sin(t * 1.1) * 5, 3 + (1 + Math.sin(t * .9)) * 4.7, s * Math.cos(t * 1.3) * 8);
    if (i === 200) events.push({id: 1, at: t, kind: 'strike', shot: 'spike', text: 'SKY SPIKE', perfect: true, x: ball.x, y: ball.y, z: ball.z, team});
    if (i === 300) events.push({id: 2, at: t, kind: 'block', x: ball.x, y: ball.y, z: ball.z, team});
    if (i === 420) events.push({id: 3, at: t, kind: 'super', x: ball.x, y: ball.y, z: ball.z, team});
    if (i === 540) events.push({id: 4, at: t, kind: 'kill', x: 3, y: 0, z: s * 6, team});
    const own = Math.sign(ball.z) === -s, set = t > 3 && t < 4.5;
    const v = view({phase, events, rally: Math.floor(t), touchTeam: own ? team : null, servingTeam: t > 10.5 ? 'blue' : 'red', score: o.tense ? {red: 10, blue: 9} : {red: 2, blue: 1},
      ball: {...freshBall(), held: false, shot: set ? 'set' : 'spike', lastTeam: team}, practice: !!o.lesson, lesson} as Partial<BallView>);
    // (The player pans for a few frames, a second and a half in.)
    yaw = cam.steer(r, 1 / 60, yaw + (i >= 100 && i < 112 ? .02 : 0), NaN, true, self, ball, v, team, aspect);
    cam.aim(r, l, .5);
    if (i % 30 === 29) out.push([...pose(l), round(yaw)]);
  }
  return out;
}

/** Twelve seconds of Goal Rush through one rig: a run upfield with the heading turning, a boost, a lob dropping over the
 *  player, a strike's punch, into a corner by the boards, the FIGHT stance on an opponent and back, and the rig letting
 *  go of the lens and taking it again. The lens every half second. */
function chaseRun(rig: BallChase, aspect: number) {
  const cam = new THREE.PerspectiveCamera(64, aspect, .1, 500), out: number[][] = [];
  const f: ChaseFrame = {self: new THREE.Vector3(), heading: 0, ball: new THREE.Vector3(0, .8, 10), fight: false, mode: 'goal-rush', boosting: false, shake: .5};
  const ball = f.ball as THREE.Vector3, foe = new THREE.Vector3(), lob = new THREE.Vector3();
  for (let i = 0; i < 720; i++) {
    const t = i / 60;
    // Up the pitch on a weave, then out to the right-hand boards and into the corner.
    f.self.set(Math.sin(t * .8) * 5 + (t > 6 ? (t - 6) * 2.2 : 0), Math.max(0, Math.sin(t * 3.1)) * (t > 2 && t < 3 ? 1.6 : 0), -14 + t * 2.6);
    f.boosting = t > 1 && t < 2.2;
    if (t < 3.5) ball.set(Math.sin(t * .5) * 3, .8, f.self.z + 9);
    else if (t < 6) { if (i === 210) { ball.set(f.self.x, 1, f.self.z + 4); lob.set(.4, 16, -1.2); } lob.y -= 13 / 60; ball.addScaledVector(lob, 1 / 60); if (ball.y < .8) { ball.y = .8; lob.y = Math.abs(lob.y) * .55; } }
    else ball.set(f.self.x + 3, .8 + Math.abs(Math.sin(t * 2)) * 2, f.self.z + 5);
    f.fight = t > 8 && t < 9.6;
    foe.set(f.self.x - 2.5, 0, f.self.z + 3.5);
    f.ball = f.fight ? foe : ball;
    const to = f.ball as THREE.Vector3;
    if (Math.hypot(to.x - f.self.x, to.z - f.self.z) > 2.5) f.heading = Math.atan2(to.x - f.self.x, to.z - f.self.z);
    if (i === 400) rig.impact(.8, undefined, 2);
    if (i === 250) rig.impact(.4, undefined, 1);
    // (The follow camera's own frame, wherever it stood: what the rig blends from and to.)
    cam.position.set(f.self.x - 3, 4.5, f.self.z - 7); cam.quaternion.set(-.1, .98, .05, .15).normalize(); cam.fov = 58;
    rig.aim(cam, 1 / 60, !(t > 10.4 && t < 11), f);
    if (i % 30 === 29) out.push(pose(cam));
  }
  return out;
}

const ASPECTS: readonly (readonly [string, number])[] = [['screen', 16 / 9], ['phone', 844 / 390], ['top and bottom', 1920 / 540], ['side by side', 960 / 1080]];
const same = (got: number[][], key: string) => {
  if (RECORD) { recorded[key] = got; return; }
  const want = GOLDEN[key];
  expect(want, key).toBeDefined(); expect(got.length, key).toBe(want.length);
  for (let i = 0; i < want.length; i++) for (let k = 0; k < want[i].length; k++) expect(got[i][k], `${key}, sample ${i}, value ${k}`).toBeCloseTo(want[i][k], 5);
};

describe("the ball modes' default cameras stand exactly as before their options", () => {
  it("Sky Spike's broadcast stand: 13 m up, 10 m behind the baseline, a 44 degree lens, on the court's heading", () => {
    for (const [team, s] of [['red', 1], ['blue', -1]] as const) {
      const cam = new SpikeCam(), r = rig();
      cam.steer(r, 1 / 60, 0, NaN, true, {x: 0, y: 0, z: -s * 5}, new THREE.Vector3(0, 3, 0), view(), team, 16 / 9);
      const p = cam.pose();
      expect(p.eye.toArray().map(round)).toEqual([0, 13, -s * 20.5]);
      expect(p.look.toArray().map(round)).toEqual([0, .3, round(-s * 2)]);
      expect(p.fov).toBe(44);
      if (!RECORD) expect(cam.style).toBe('classic');
    }
  });
  for (const [name, aspect] of ASPECTS) it(`Sky Spike's camera through a serve, a rally and a point (${name})`, () => {
    for (const team of ['red', 'blue'] as const) same(spikeRun(new SpikeCam(), team, aspect), `spike/${name}/${team}`);
  });
  it("Sky Spike's camera at match point, and in LEARN TO PLAY's BLOCK step", () => {
    same(spikeRun(new SpikeCam(), 'red', 16 / 9, {tense: true}), 'spike/match point');
    same(spikeRun(new SpikeCam(), 'red', 16 / 9, {lesson: true}), 'spike/BLOCK step');
    same(spikeRun(new SpikeCam(), 'blue', 844 / 390, {lesson: true}), 'spike/BLOCK step, phone');
  });
  for (const [name, aspect] of ASPECTS) it(`Goal Rush's chase rig through a run, a lob, the boards, a fight and a hand-over (${name})`, () => {
    const rig = new BallChase();
    if (!RECORD) expect(rig.style).toBe('classic');
    same(chaseRun(rig, aspect), `chase/${name}`);
  });
  it.runIf(RECORD)('records the runs', () => {
    writeFileSync(new URL('./camDefaults.golden.json', import.meta.url), JSON.stringify(recorded, null, 0).replace(/\],\[/g, '],\n[').replace(/":\[\[/g, '":[\n[') + '\n');
  });
});
