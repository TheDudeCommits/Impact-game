import fs from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { FIGHTERS } from '../src/config';
import { MOVES } from '../src/game/moves';
import contactFrames from '../src/game/data/contactFrames.json';
import type { AttackSlot, FighterId, PlayerState } from '../src/game/types';
import { Fighter } from '../src/render/Fighter';

/** Load a runtime rig with its textures stripped, as the other rig tests do. */
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
const baseState = (fighter: FighterId): PlayerState => ({ id: 'dyn', name: 'D', fighter, x: 0, y: 0, z: 0, yaw: 0,
  hp: 1000, maxHp: 1000, stamina: 100, ultimate: 0, action: 'idle', actionStarted: 0, actionDuration: 0, actionTime: 0,
  target: null, alive: true, isBot: false, grounded: true, guarding: false,
  cooldowns: { light: 0, heavy: 0, special: 0, ultimate: 0 } });

let kenzo: GLTF, gummy: GLTF, koko: GLTF;
beforeAll(async () => {
  [kenzo, gummy] = await Promise.all([loadRig(FIGHTERS.kenzo.model), loadRig(FIGHTERS.gummy.model)]);
  koko = await loadRig(FIGHTERS.koko.model);
}, 120_000);

/** Where the clip is, as a fraction of itself, at a given fraction of a move. */
const swinger = (fighter: Fighter, id: FighterId, slot: AttackSlot) => {
  const state = baseState(id), move = MOVES[id][slot];
  // Round 3d (ULTS): an ultimate's own clip is its cinematic's, which plays
  // once its opener has landed - confirmed from the start here.
  const landed = slot === 'ultimate' && move.confirm ? { confirmedAt: 1 } : {};
  return (t: number) => {
    fighter.update(1 / 60, { ...state, action: slot, actionStarted: 1, actionDuration: move.duration, actionTime: t, ...landed }, true);
    const evidence = fighter.motionEvidence();
    return evidence.clipTime! / fighter.clips.find(c => c.name === evidence.clip)!.duration;
  };
};

describe('the clip lands its blow when the move does', () => {
  // Three single-contact melee swings whose clip disagrees with the move about
  // where the blow is. Kenzo's heavy and Signal Fire used to be refused outright -
  // they ask for 0.34x out and 0.33x back, which the old straight-ratio retime
  // rejected - so both played linearly and landed their visible cut half a
  // second away from the damage.
  // Signal Fire used to be the third case; it is a projectile now (round 13),
  // and a throw keeps its own pacing. Spring Tide is the same rig's melee
  // swing with a measured contact that disagrees with the move's. Kenzo's
  // light used to be the first case: measured honestly (round 13, the blade
  // tip at the frame it crosses the facing) its cut is at 0.795 of a clip
  // far longer than the 0.26 s wind-up, so `pace` skips the head of the
  // clip by design and the swing no longer starts at frame zero. Rogue Wave
  // is the same disagreement the other way - 0.18 against a contact at
  // 0.46 - on a clip the pacing plays from its start.
  const cases: [FighterId, 'light' | 'heavy' | 'special' | 'ultimate', () => GLTF][] = [
    // (Round 4b: Gummy's ultimate is no longer drawn by this body past its opener: the SPRING TIDE is SUNRISE's, the
    // form shown from the confirm, on its own take - tests/springTide.test.ts.)
    // (Round 5: nor his heavy: the Bazooka is a take of its own, gummy-r5-moves1.glb, authored on the move's clock, so
    // its blow and the move's already agree - tests/gummyRound5.test.ts.)
    ['kenzo', 'heavy', () => kenzo]];
  for (const [id, slot, rig] of cases) {
    it(`puts ${id}'s ${slot} at full extension on the frame the damage is dealt`, () => {
      const fighter = new Fighter(baseState(id), rig());
      try {
        const move = MOVES[id][slot], fraction = (contactFrames as Record<string, Record<string, number>>)[id][slot];
        // Round 3d (ULTS): Spring Tide's blow is the cinematic's finisher.
        const at = move.contacts[slot === 'ultimate' ? move.contacts.length - 1 : 0] / move.duration;
        const swing = swinger(fighter, id, slot);
        swing(0);
        // At the move's own contact time the clip is at the frame the blow is
        // furthest out. Played straight the two disagree by a fifth of the clip.
        expect(swing(at)).toBeCloseTo(fraction, 2);
        expect(Math.abs(at - fraction), 'and they did not already agree').toBeGreaterThan(.05);
        // It still starts at the start and finishes at the finish, and never
        // runs backwards on the way between them.
        expect(swing(0)).toBeCloseTo(0, 3);
        let previous = 0;
        for (let i = 1; i <= 60; i++) {
          const now = swing(i / 60);
          expect(now, `${id} ${slot} rewound at ${i}/60`).toBeGreaterThanOrEqual(previous - 1e-9);
          expect(now).toBeLessThanOrEqual(1.0001);
          previous = now;
        }
        expect(previous).toBeCloseTo(1, 2);
      } finally { fighter.dispose(); }
    });
  }

  it('never leaves a swing standing still on its way to the blow', () => {
    // The thing a shaped wind-up must not become. Chambering early and holding
    // there left Kenzo's heavy advancing its clip by seven per cent over its
    // first nine hundred milliseconds - on screen, a fighter standing
    // motionless and then blurring, which is what a blind critic reported as
    // "450 ms of a frozen screen".
    const fighter = new Fighter(baseState('kenzo'), kenzo);
    try {
      const move = MOVES.kenzo.heavy, at = move.contacts[0] / move.duration;
      const swing = swinger(fighter, 'kenzo', 'heavy');
      swing(0);
      const step = 1 / 60 / move.duration;
    // Sampled forward only: the drawn clip clock is monotonic within one move,
    // so asking for an earlier time after a later one returns the later value.
      let stalled = 0, worst = 0, previous = swing(0), travel = 0, early = 0, coil = 0;
      for (let t = step; t <= at; t += step) {
        const now = swing(t);
        const moved = Math.abs(now - previous) / step;
        // "Standing still" measured against how fast the clip would run if the
        // wind-up were swept evenly: under a tenth of that is not motion.
        if (moved < .1) { stalled += 1 / 60; worst = Math.max(worst, stalled); } else stalled = 0;
        if (t <= at * .45) early = now;
        if (t <= at * .78) coil = now;
        travel = now;
        previous = now;
      }
      expect(worst, `the swing held still for ${(worst * 1000).toFixed(0)} ms`).toBeLessThan(.22);
      // It draws back first rather than creeping: most of the travel before
      // the blow is already spent by the time the wind-up is half over.
      expect(early / travel, 'the draw-back carries the motion').toBeGreaterThan(.5);
      // And what is left is spent driving, not coasting.
      expect((travel - coil) / travel, 'the drive is a snap').toBeGreaterThan(.2);
    } finally { fighter.dispose(); }
  });

  it('preserves the continuous motion clock for a naturally paced projectile', () => {
    const fighter = new Fighter(baseState('kenzo'), kenzo);
    try {
      const state = baseState('kenzo'), move = MOVES.kenzo.special;
      fighter.update(1/60,{...state,action:'special',actionStarted:1,actionDuration:move.duration,actionTime:0},true);
      const clip=fighter.clips.find(c=>c.name===fighter.motionEvidence().clip)!;
      let previous=0;
      for(let t=0;t<=1;t+=1/120){
        fighter.update(1/120,{...state,action:'special',actionStarted:1,actionDuration:move.duration,actionTime:t},true);
        const now=fighter.motionEvidence().clipTime!/clip.duration;
        expect(now).toBeGreaterThanOrEqual(previous-1e-8);previous=now;
      }
      expect(previous).toBeGreaterThan(.98);
    } finally { fighter.dispose(); }
  });
});

describe('a body answers the blow it took', () => {
  const settle = (fighter: Fighter, state: PlayerState, frames = 12) => {
    for (let i = 0; i < frames; i++) fighter.update(1 / 60, { ...state }, true);
  };
  /** The head, because it is the far end of the chain the lean is spread
   *  along: a joint low on the spine barely moves however far the body tips. */
  const chest = (fighter: Fighter) => {
    const bone = fighter.bones.get('head') ?? fighter.bones.get('spine1')!;
    return fighter.group.worldToLocal(bone.getWorldPosition(new THREE.Vector3()));
  };

  /** The lean a hit adds: the same hit on the same body with the procedural
   *  layer on, less the pose with it off. A blow from behind plays a
   *  different stagger clip from one in front (Fighter.reaction), so two
   *  headings can no longer be compared pose to pose; what separates the two
   *  bodies of one pair is the lean alone. */
  const struck = (heading: THREE.Vector3, damage: number) => {
    const state = baseState('kenzo');
    const pose = (dynamics: boolean) => {
      const fighter = new Fighter(baseState('kenzo'), kenzo);
      try {
        fighter.dynamics = dynamics;
        settle(fighter, state);
        fighter.impact(true, 'heavy', 'melee', 0, heading, damage);
        settle(fighter, { ...state, action: 'hurt', actionStarted: 1, actionDuration: .4, actionTime: .2 }, 6);
        return chest(fighter);
      } finally { fighter.dispose(); }
    };
    return pose(true).sub(pose(false));
  };

  it('bends away from where the hit came from, and the other way for the other side', () => {
    // The body faces +z: a blow travelling +z arrived from behind, -z from in front.
    const behind = struck(new THREE.Vector3(0, 0, 1), 90);
    const front = struck(new THREE.Vector3(0, 0, -1), 90);
    // Carried the way the blow travelled - forward from behind, back from in
    // front - which is away from wherever it came from.
    expect(behind.z, `behind ${behind.z.toFixed(3)}`).toBeGreaterThan(.005);
    expect(front.z, `front ${front.z.toFixed(3)}`).toBeLessThan(-.005);
  });

  it('bends further for a heavier blow', () => {
    const jab = struck(new THREE.Vector3(0, 0, -1), 20).length();
    const finisher = struck(new THREE.Vector3(0, 0, -1), 280).length();
    expect(finisher, 'an ultimate is not a jab').toBeGreaterThan(jab * 1.5);
  });

  it('does nothing at all with the procedural layer switched off', () => {
    const state = baseState('kenzo');
    const fighter = new Fighter(baseState('kenzo'), kenzo);
    try {
      fighter.dynamics = false;
      settle(fighter, state);
      const before = chest(fighter);
      fighter.impact(true, 'heavy', 'melee', 0, new THREE.Vector3(0, 0, -1), 280);
      settle(fighter, { ...state, action: 'hurt', actionStarted: 1, actionDuration: .4, actionTime: .2 }, 6);
      // The clip still plays; what does not happen is the extra lean on top.
      const after = chest(fighter);
      const still = after.sub(before).length();
      const other = new Fighter(baseState('kenzo'), kenzo);
      let leaned = 0;
      try {
        settle(other, state);
        const start = chest(other);
        other.impact(true, 'heavy', 'melee', 0, new THREE.Vector3(0, 0, -1), 280);
        settle(other, { ...state, action: 'hurt', actionStarted: 1, actionDuration: .4, actionTime: .2 }, 6);
        leaned = chest(other).sub(start).length();
      } finally { other.dispose(); }
      expect(leaned).toBeGreaterThan(still);
    } finally { fighter.dispose(); }
  });
});

describe('a body turns at a speed a body can turn at', () => {
  it('turns into new travel promptly without snapping in one frame', () => {
    const fighter = new Fighter(baseState('kenzo'), kenzo);
    try {
      const state = baseState('kenzo');
      for (let i = 0; i < 20; i++) fighter.update(1 / 60, { ...state }, true);
      // Three hundred pixels of mouselook in one frame. The body used to be
      // written straight onto it: 0.69 rad in 16 ms is 2400 degrees a second.
      fighter.update(1 / 60, { ...state, yaw: .69 }, true);
      expect(fighter.group.rotation.y, 'the body followed the camera exactly').toBeLessThan(22 / 60 + 1e-6);
      expect(fighter.group.rotation.y, 'and it did turn').toBeGreaterThan(.02);
      let frames = 1;
      while (Math.abs(fighter.group.rotation.y - .69) > .01 && frames < 30) {
        fighter.update(1 / 60, { ...state, yaw: .69 }, true); frames++;
      }
      expect(frames, `it took ${frames} frames to catch up`).toBeLessThanOrEqual(6);
    } finally { fighter.dispose(); }
  });

  it('places a spawn and a round reset outright rather than winding round to it', () => {
    // A round reset writes yaw Math.PI on the same frame it writes the spawn
    // position. Slewing to that would be every fighter visibly pirouetting.
    const fighter = new Fighter(baseState('kenzo'), kenzo);
    try {
      fighter.update(1 / 60, { ...baseState('kenzo'), yaw: Math.PI }, true);
      expect(fighter.group.rotation.y).toBeCloseTo(Math.PI, 6);
      for (let i = 0; i < 20; i++) fighter.update(1 / 60, { ...baseState('kenzo'), yaw: Math.PI }, true);
      // ... and a teleport across the stage is a placement too.
      fighter.update(1 / 60, { ...baseState('kenzo'), x: 40, z: 40, yaw: 0 }, true);
      expect(fighter.group.rotation.y).toBeCloseTo(0, 6);
    } finally { fighter.dispose(); }
  });
});

describe('the legs go where the fighter is going', () => {
  it('uses the same forward stride after turning the body into lateral travel', () => {
    const state = baseState('kenzo');
    const hips = (fighter: Fighter) => fighter.bones.get('hips')!.quaternion.clone();
    const run = (sideways: boolean) => {
      const fighter = new Fighter(baseState('kenzo'), kenzo);
      try {
        let x = 0, z = 0;
        for (let i = 0; i < 40; i++) {
          if (sideways) x += 7.5 / 60; else z += 7.5 / 60;
          fighter.update(1 / 60, { ...state, action: 'run', yaw: sideways ? Math.PI / 2 : 0, x, z }, true);
        }
        expect(fighter.group.rotation.y).toBeCloseTo(sideways ? Math.PI / 2 : 0, 4);
        return hips(fighter);
      } finally { fighter.dispose(); }
    };
    // Rotating the whole body preserves its stride without reverse playback.
    expect(run(true).angleTo(run(false))).toBeLessThan(.02);
  });
});

describe('being hit is visible on the body it lands on', () => {
  /** How fast the reaction clip is actually running, as a multiple of the
   *  rate it was drawn at. A stagger used to be the whole clip stretched
   *  across the reaction's own window - a 0.9-second recoil inside a
   *  0.15-second flinch - which is a recoil at six times speed, gone in two
   *  rendered frames, and on screen is a clean stance with damage numbers
   *  coming off it. */
  const playbackRate = (fighter: Fighter, action: PlayerState['action'], window: number) => {
    fighter.dynamics = false;
    const base = baseState('kenzo');
    for (let i = 0; i < 20; i++) fighter.update(1 / 60, { ...base }, true);
    const struck = { ...base, action, actionStarted: 1, actionDuration: window };
    fighter.impact(true, 'heavy', 'melee', 0, new THREE.Vector3(0, 0, 1), 90);
    let previous: number | null = null, fastest = 0, moved = 0;
    for (let elapsed = 1 / 60; elapsed <= window; elapsed += 1 / 60) {
      fighter.update(1 / 60, { ...struck, actionTime: elapsed / window }, true);
      const evidence = fighter.motionEvidence();
      const now = evidence.clipTime ?? 0;
      // After the snap into the recoil, which is meant to be fast - it is the
      // blow arriving. What must not be fast is everything after it.
      if (previous !== null) {
        if (elapsed > .095) fastest = Math.max(fastest, (now - previous) * 60);
        moved += Math.abs(now - previous);
      }
      previous = now;
    }
    return { fastest, moved };
  };

  for (const kind of ['flinch', 'stun'] as const) {
    it(`plays a ${kind} at the rate it was drawn`, () => {
      const fighter = new Fighter(baseState('kenzo'), kenzo);
      try {
        const { fastest, moved } = playbackRate(fighter, kind, .3);
        expect(moved, 'the recoil was played at all').toBeGreaterThan(.02);
        expect(fastest, `the recoil played out at ${fastest.toFixed(1)} times the rate it was drawn`).toBeLessThan(1.6);
      } finally { fighter.dispose(); }
    });
  }
});

describe('a launched body keeps moving all the way down', () => {
  it('never holds one pose through the flight', () => {
    // A heavy launch had no air clip at all - the branch was gated on the hit
    // being an ultimate - so the body held a single pose for a flight that
    // LAUNCH_GRAVITY deliberately makes half again longer than arcade gravity.
    const fighter = new Fighter(baseState('kenzo'), kenzo);
    try {
      fighter.dynamics = false;
      const base = baseState('kenzo');
      for (let i = 0; i < 20; i++) fighter.update(1 / 60, { ...base }, true);
      fighter.impact(true, 'heavy', 'melee', 0, new THREE.Vector3(0, 0, 1), 95);
      const window = 1.4;
      let previous = -1, stalled = 0, worst = 0;
      for (let elapsed = 1 / 60; elapsed <= window; elapsed += 1 / 60) {
        // Airborne throughout, which is what a launch is until it lands.
        fighter.update(1 / 60, { ...base, action: 'launched', grounded: false, y: 2,
          actionStarted: 1, actionDuration: window, actionTime: elapsed / window }, true);
        const now = fighter.motionEvidence().clipTime ?? 0;
        if (previous >= 0 && Math.abs(now - previous) < 1e-4) { stalled += 1 / 60; worst = Math.max(worst, stalled); } else stalled = 0;
        previous = now;
      }
      expect(worst, `the launched body held one pose for ${(worst * 1000).toFixed(0)} ms`).toBeLessThan(.25);
    } finally { fighter.dispose(); }
  });
});

describe('a barrage reads as a barrage', () => {
  it('re-chambers between the blows of a string instead of sweeping through them', () => {
    // KoKo's Hammer! is eight hits over three seconds and the clip used to
    // be swept evenly across all of them: the move that should be the most
    // exciting in the game was the one with no snap in it anywhere.
    const rig = koko, move = MOVES.koko.special;
    expect(move.contacts.length, 'a string').toBeGreaterThan(4);
    const fighter = new Fighter(baseState('koko'), rig);
    try {
      fighter.dynamics = false;
      const state = baseState('koko');
      const at = (t: number) => {
        fighter.update(1 / 60, { ...state, action: 'special', actionStarted: 1,
          actionDuration: move.duration, actionTime: t }, true);
        const evidence = fighter.motionEvidence();
        return (evidence.clipTime ?? 0) / fighter.clips.find(c => c.name === evidence.clip)!.duration;
      };
      at(0);
      // Sampled forward only, as everywhere else: the drawn clip clock does
      // not run backwards inside a move.
      const rates: number[] = [];
      let previous = at(0);
      const step = 1 / 60 / move.duration;
      for (let t = step; t <= 1; t += step) { const now = at(t); rates.push((now - previous) / step); previous = now; }
      // A sweep is one rate throughout. A string of blows is fast, slow, fast:
      // the spread between the quickest and the slowest is the snap.
      const sorted = [...rates].sort((a, b) => a - b);
      const slow = sorted[Math.floor(sorted.length * .2)], quick = sorted[Math.floor(sorted.length * .9)];
      expect(quick / Math.max(.02, slow), 'the string has a beat').toBeGreaterThan(2.5);
      expect(previous, 'and still ends where the clip ends').toBeGreaterThan(.9);
    } finally { fighter.dispose(); }
  }, 120_000);
});
