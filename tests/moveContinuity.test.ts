import fs from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { FIGHTERS } from '../src/config';
import { ArenaSimulation } from '../src/game/simulation';
import { Prediction } from '../src/game/prediction';
import type { PlayerInput, PlayerState } from '../src/game/types';
import { Fighter } from '../src/render/Fighter';

async function loadRig(path: string) {
  const file = fs.readFileSync(`public${path}`), length = file.readUInt32LE(12);
  const json = JSON.parse(file.subarray(20, 20 + length).toString());
  json.materials = (json.materials ?? []).map((m: { name: string }) => ({ name: m.name }));
  delete json.images; delete json.textures; delete json.samplers;
  const data = Buffer.from(JSON.stringify(json)), padded = Buffer.concat([data, Buffer.alloc((4 - data.length % 4) % 4, 32)]);
  const tail = file.subarray(20 + length), result = Buffer.alloc(20 + padded.length + tail.length);
  result.writeUInt32LE(0x46546c67, 0); result.writeUInt32LE(2, 4); result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(padded.length, 12); result.writeUInt32LE(0x4e4f534a, 16); padded.copy(result, 20); tail.copy(result, 20 + padded.length);
  return new GLTFLoader().parseAsync(result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength), '');
}

let kenzo: GLTF;
beforeAll(async () => { kenzo = await loadRig(FIGHTERS.kenzo.model); }, 120_000);

const base = (): PlayerState => ({ id: 'me', name: 'Me', fighter: 'kenzo', x: 0, y: 0, z: 0, yaw: 0,
  hp: 1000, maxHp: 1000, stamina: 100, ultimate: 0, action: 'idle', actionStarted: 0, actionDuration: 0,
  actionTime: 0, target: null, alive: true, isBot: false, grounded: true, guarding: false,
  cooldowns: { light: 0, heavy: 0, special: 0, ultimate: 0 } });

/** Throw one light with the server six ticks away and record, frame by frame,
 *  where the swing's clip is. */
function swing(latencyTicks: number) {
  const server = new ArenaSimulation({ trainingBot: false });
  server.addPlayer('me', 'kenzo', 'Me', false, { x: 0, y: 0, z: 0 });
  server.addPlayer('them', 'taisei', 'Them', false, { x: 0, y: 0, z: 1.6 });
  const prediction = new Prediction();
  prediction.start('me', server.snapshot(false, true));
  const body = new Fighter({ ...server.getPlayer('me')! }, kenzo);
  const queue: { at: number; input: PlayerInput }[] = [];
  const trace: { clip?: string; time: number; action: string }[] = [];
  let seq = 0, tick = 0;
  try {
    for (let i = 0; i < 70; i++) {
      const input: PlayerInput = { seq: seq++, moveX: 0, moveZ: 0, yaw: 0, attack: i === 5 ? 'light' : undefined };
      prediction.submit(input);
      queue.push({ at: tick + latencyTicks, input });
      tick++;
      while (queue.length && queue[0].at <= tick) server.submitInput('me', queue.shift()!.input);
      server.step();
      if (i % 3 === 2) prediction.reconcile(server.snapshot(false, true));
      const authority = server.getPlayer('me')!;
      const shown: PlayerState = prediction.sample(1 / 60, authority) ?? authority;
      body.update(1 / 60, shown, true);
      const evidence = body.motionEvidence();
      trace.push({ clip: evidence.clip, time: evidence.clipTime ?? 0, action: shown.action });
    }
  } finally { body.dispose(); }
  return trace;
}

const baseState = (): PlayerState => ({ id: 'blend', name: 'B', fighter: 'kenzo', x: 0, y: 0, z: 0, yaw: 0,
  hp: 1000, maxHp: 1000, stamina: 100, ultimate: 0, action: 'idle', actionStarted: 0, actionDuration: 0, actionTime: 0,
  target: null, alive: true, isBot: false, grounded: true, guarding: false,
  cooldowns: { light: 0, heavy: 0, special: 0, ultimate: 0 } });

/** The largest one-frame turn any of the three joints a transition is most
 *  visible on makes, in degrees, on the frame a new action starts. */
function transitionStep(from: PlayerState['action'], to: PlayerState['action']) {
  const body = new Fighter(baseState(), kenzo);
  try {
    // A fighter watching an opponent, which is the case the fault was worst
    // in: the gaze is up to fifty-two degrees and the lean a third of a
    // radian, and both were captured into the blend and then applied again.
    body.targetPoint = new THREE.Vector3(3.5, 1.5, 4);
    const state = baseState();
    const joints = ['hips', 'spine1', 'head'];
    const capture = () => joints.map(name => body.bones.get(name)!.quaternion.clone());
    let x = 0;
    for (let i = 0; i < 60; i++) { if (from === 'run') x += 6 / 60; body.update(1 / 60, { ...state, action: from, x }, true); }
    const before = capture();
    body.update(1 / 60, { ...state, action: to, x, actionStarted: 9, actionDuration: .9, actionTime: 0 }, true);
    return Math.max(...capture().map((q, i) => THREE.MathUtils.radToDeg(q.angleTo(before[i]))));
  } finally { body.dispose(); }
}

describe('a transition starts from the pose that was drawn', () => {
  // The blend used to be captured off the live bones, which by then held the
  // lean, the landing dip, the foot planting and the gaze as well as the clip
  // - and every one of those was then applied again, in full, on top of the
  // blend. The first frame of a transition carried close to double the
  // intended offset: measured on Nigo, 45, 19 and 30 degrees on the hips,
  // the chest and the head. It is captured off the animation system alone now.
  // The attack case is the heavy rather than the light: Fang Crossing's cut is
  // measured at 0.795 of a clip with 2.5x the wind-up's worth of content
  // (round 13), so `pace` skips the head of the clip by design and the
  // light's first frame is a quarter of the way into the draw - a 14 degree
  // step out of idle that is the skip, not the blend basis this guards.
  // Mirage Draw is paced from its first frame.
  it.each([['run', 'idle'], ['idle', 'guard'], ['idle', 'heavy']] as const)('does not whip on %s to %s', (from, to) => {
    const step = transitionStep(from, to);
    expect(step, `${from} to ${to} turned a joint ${step.toFixed(1)} degrees in one frame`).toBeLessThan(10);
  });
});

describe('a swing is played once, from where it started', () => {
  it('never rewinds its clip while the move is running', () => {
    const trace = swing(6);
    const swinging = trace.filter(f => f.action === 'light');
    expect(swinging.length, 'the swing was drawn').toBeGreaterThan(30);
    // The authoritative copy of this move starts a round trip after the local
    // one, so its `actionStarted` differs by the latency. Reading the clip's
    // clock off that timestamp used to rewind the swing by exactly that much,
    // part way through - a visible hitch on every single attack.
    let worst = 0, previous = -Infinity;
    for (const frame of swinging) {
      if (previous > -Infinity) worst = Math.max(worst, previous - frame.time);
      previous = frame.time;
    }
    expect(worst, `the clip jumped back ${(worst * 1000).toFixed(0)} ms mid-swing`).toBeLessThan(.01);
  });

  it('holds the body through the impact freeze instead of handing it back', () => {
    const trace = swing(6);
    // Nothing in the trace should fall back to the authoritative body while
    // the swing is running: the freeze is computed locally from the same code.
    const drawn = trace.filter(f => f.action === 'light');
    const clips = new Set(drawn.map(f => f.clip));
    expect(clips.size, 'one clip for one swing').toBe(1);
  });

  it('draws every action a fighter can be in without throwing', () => {
    // Everything on this list reaches the same retiming code as an attack
    // does, and a dash, a stagger and a knockdown are not moves - reading the
    // move table with one of those as the key returns undefined. It crashed
    // the render loop on the first dash, and no unit test caught it because
    // they all drive attacks.
    const actions = ['idle', 'run', 'jump', 'dash', 'guard', 'light', 'heavy', 'special', 'ultimate',
      'hurt', 'flinch', 'launched', 'knockdown', 'getup', 'stun', 'splat', 'awaken', 'defeated'] as const;
    const body = new Fighter({ ...base(), fighter: 'kenzo' }, kenzo);
    try {
      for (const action of actions) {
        for (let i = 0; i < 4; i++) {
          expect(() => body.update(1 / 60, { ...base(), fighter: 'kenzo', action,
            actionStarted: 1, actionDuration: .6, actionTime: i / 4, grounded: action !== 'jump' }, true),
            `${action} threw`).not.toThrow();
        }
      }
    } finally { body.dispose(); }
  });
});