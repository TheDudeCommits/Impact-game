import fs from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { FIGHTERS } from '../src/config';
import type { FighterId, PlayerState } from '../src/game/types';
import { MOVES } from '../src/game/moves';
import { Fighter } from '../src/render/Fighter';

/** A fighter keeps its full run through an attack (tests/castMovement.test.ts, "Held travel
 *  owns translation throughout every attack"), and its legs keep striding under the recovery while it travels - they
 *  stood still from 0.12 s after the blow and the feet skated (Fighter.ts STRIDE_PLANT). */
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
const baseState = (fighter: FighterId): PlayerState => ({ id: 'legs', name: 'L', fighter, x: 0, y: 0, z: 0, yaw: 0,
  hp: 1000, maxHp: 1000, stamina: 100, ultimate: 0, action: 'idle', actionStarted: 0, actionDuration: 0, actionTime: 0,
  target: null, alive: true, isBot: false, grounded: true, guarding: false, cooldowns: { light: 0, heavy: 0, special: 0, ultimate: 0 } });

// (Not Kenzo: his heavy is over 0.46 s after its blow, too soon after the stride's return to measure it.)
const FIGHTERS_TRIED: FighterId[] = ['shirokane', 'konta'];
/** The guard-walk stride table's members now (Fighter.ts GUARD_STRIDE): their Block is a standing pose
 *  carried at 0.99-1.0 of travel without the stride. */
const GUARD_WALKERS: FighterId[] = ['senko', 'kubiwa', 'hinomoto', 'bonsho', 'psyche', 'svanhild', 'shiun', 'magatsu', 'rook', 'asahi', 'shijima'];
const rigs = new Map<FighterId, GLTF>();
beforeAll(async () => { for (const id of [...FIGHTERS_TRIED, ...GUARD_WALKERS]) rigs.set(id, await loadRig(FIGHTERS[id].model)); }, 300_000);
/** How much the foot carrying the weight slides across the ground, as a
 *  fraction of how fast the fighter is travelling.
 *
 *  A planted foot does not move: the ground it is on is not moving. Anything
 *  above zero is the foot skating, and 1 means the feet are simply being
 *  carried along - the legs are decoration and the body is on rails.
 *  Measured on the lower of the two feet, which is the one taking the weight. */
function skateRatio(rig: GLTF, fighter: FighterId, speed: number, seconds = 1.6, action: PlayerState['action'] = 'run') {
  const body = new Fighter(baseState(fighter), rig);
  try {
    const state = baseState(fighter);
    const dt = 1 / 60;
    // Asked of the rig rather than guessed at. `body.joints` is the canonical
    // map the renderer itself resolves, so a rig spelling its ankle
    // `mixamorig:LeftFoot_058` is found here exactly as the game finds it.
    const pick = (canonical: string[], names: string[]) =>
      canonical.map(c => body.joints.get(c)).find(Boolean) ?? names.map(n => body.bones.get(n)).find(Boolean);
    const left = pick(['LeftToeBase', 'LeftFoot'], ['lefttoebase', 'deftoel', 'leftfoot', 'deffootl']);
    const right = pick(['RightToeBase', 'RightFoot'], ['righttoebase', 'deftoer', 'rightfoot', 'deffootr']);
    if (!left || !right) throw new Error(`${fighter} has no feet: ${[...body.bones.keys()].filter(n => n.includes('foot') || n.includes('toe')).join(',')}`);
    let z = 0, previous: THREE.Vector3 | null = null, previousLeft = true;
    const slips: number[] = [];
    // Settle first, so the run is up to speed and the blend has finished.
    for (let i = 0; i < 30; i++) { z += speed * dt; body.update(dt, { ...state, action, z }, true); }
    const steps = Math.round(seconds / dt);
    for (let i = 0; i < steps; i++) {
      z += speed * dt;
      body.update(dt, { ...state, action, z }, true);
      const l = left.getWorldPosition(new THREE.Vector3()), r = right.getWorldPosition(new THREE.Vector3());
      const lower = l.y <= r.y, foot = lower ? l : r;
      if (previous && lower === previousLeft) slips.push(Math.hypot(foot.x - previous.x, foot.z - previous.z) / dt);
      previous = foot; previousLeft = lower;
    }
    slips.sort((a, b) => a - b);
    return slips.length ? slips[Math.floor(slips.length / 2)] / speed : 1;
  } finally { body.dispose(); }
}



/** How far the knee turns over a heavy's recovery (from `from` s after its blow to its end), at `speed` m/s of travel. */
function recoveryKnee(fighter: FighterId, speed: number, from = .3) {
  const body = new Fighter(baseState(fighter), rigs.get(fighter)!);
  try {
    const state = baseState(fighter), move = MOVES[fighter].heavy, dt = 1 / 60, contact = move.contacts[move.contacts.length - 1];
    const knee = body.bones.get('leftleg') ?? body.bones.get('leftupleg') ?? body.bones.get('defshinl');
    expect(knee, `${fighter} has no knee`).toBeDefined();
    let z = 0;
    for (let i = 0; i < 24; i++) { z += speed * dt; body.update(dt, { ...state, action: 'run', z }, true); }
    const frames = Math.round(move.duration / dt), seen: number[] = [];
    for (let i = 0; i <= frames; i++) {
      z += speed * dt;
      const t = i * dt;
      body.update(dt, { ...state, action: 'heavy', actionStarted: 1, actionDuration: move.duration, actionTime: Math.min(1, t / move.duration), z }, true);
      if (t >= contact + from) seen.push(knee!.quaternion.x, knee!.quaternion.y, knee!.quaternion.z, knee!.quaternion.w);
    }
    let travel = 0;
    for (let i = 4; i < seen.length; i += 4) travel += Math.hypot(seen[i] - seen[i - 4], seen[i + 1] - seen[i - 3], seen[i + 2] - seen[i - 2], seen[i + 3] - seen[i - 1]);
    return travel;
  } finally { body.dispose(); }
}

describe('the legs keep running under a recovery the body runs through', () => {
  for (const fighter of FIGHTERS_TRIED) {
    it(`${fighter}'s knees cycle through a heavy's recovery at a run, and stand through one stood still`, () => {
      const still = recoveryKnee(fighter, 0), running = recoveryKnee(fighter, 5);
      expect(running, `standing ${still.toFixed(3)} against running ${running.toFixed(3)}`).toBeGreaterThan(still + .1);
    });
  }
});

describe('a guard walked on a body whose Block is a standing pose has a stride laid under it', () => {
  for (const fighter of GUARD_WALKERS) {
    it(`${fighter}'s guard foot stays down (it was carried at the whole of travel)`, () => {
      const ratio = skateRatio(rigs.get(fighter)!, fighter, 2.2, 3.2, 'guard');
      expect(ratio, `${fighter} guard foot slides at ${(ratio * 100).toFixed(0)}% of travel`).toBeLessThan(fighter === 'shijima' ? .7 : .6);
    });
  }
});

