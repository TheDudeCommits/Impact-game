import { beforeAll, describe, expect, it, vi } from 'vitest';
import { ORIGINALS } from '../src/originals/roster';
import * as THREE from 'three';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { FIGHTERS } from '../src/config';
import { MOVES, RUSH, RUSH_STAGES } from '../src/game/moves';
import { Fighter, bindClips } from '../src/render/Fighter';
import { mirrorClip, sceneJoints, swapSide } from '../src/render/characterMotion';
import { resolveSkeleton } from '../src/render/skeleton';
import { loadRig, base } from './rigHarness';
import type { FighterId, PlayerState } from '../src/game/types';
import contactFrames from '../src/game/data/contactFrames.json';

/** A light rush drawn from hand-built states, the way the combat simulation
 *  sends one: action 'light', `chain` 0..3, a fresh `actionSeq` per press, each
 *  stage cancelled into the next shortly after its blow. Each fighter's own
 *  stage timing, as the simulation sends it (round 3d: read off RUSH rather
 *  than the contract's first template, 0.55/0.22, 0.6/0.24, 0.85/0.38). */
const stagesOf = (id: FighterId): [number, number][] => RUSH[id].map(m => [m.duration, m.contacts[0]]);
const ROSTER: FighterId[] = ['koko', 'kenzo', 'taisei', 'konta', 'shiden', 'gummy', 'ward'];
const rigs = new Map<FighterId, GLTF>();
beforeAll(async () => { for (const id of ROSTER) rigs.set(id, await loadRig(FIGHTERS[id].model)); }, 120_000);

type Frame = { stage: number; f: number; clip: string; time: number; t: number };
function rush(id: FighterId, grounded = true, body = new Fighter(base(id), rigs.get(id)!)) {
  const dt = 1 / 60, frames: Frame[] = [];
  const light = MOVES[id].light;
  const plan = [[light.duration, light.contacts[0]], ...stagesOf(id)];
  const y = grounded ? 0 : 1.5;
  body.targetPoint = new THREE.Vector3(0, 1.3, 2); body.targetDistance = 2;
  for (let f = 0; f < 30; f++) body.update(dt, { ...base(id), y, grounded }, true, dt);
  for (let stage = 0; stage < RUSH_STAGES; stage++) {
    const [duration, contact] = plan[stage];
    const until = stage === RUSH_STAGES - 1 ? duration : Math.min(duration, contact + .12);
    for (let f = 0; f < Math.ceil(until / dt); f++) {
      const state: PlayerState = { ...base(id), y, grounded, action: 'light', chain: stage, actionSeq: 40 + stage,
        actionStarted: 3 + stage, actionDuration: duration, actionTime: Math.min(1, f * dt / duration) };
      body.update(dt, state, true, dt);
      const e = body.motionEvidence();
      frames.push({ stage, f, clip: String(e.clip), time: e.clipTime ?? 0, t: f * dt });
    }
  }
  return { body, frames };
}

describe('a light rush plays a clip per stage', () => {
  it.each(ROSTER)('%s restarts its clip on every stage and keeps it moving', id => {
    const { body, frames } = rush(id);
    try {
      for (let stage = 1; stage < RUSH_STAGES; stage++) {
        const previous = frames.filter(f => f.stage === stage - 1), mine = frames.filter(f => f.stage === stage);
        const last = previous[previous.length - 1], first = mine[0];
        // A new press is a new swing: the same clip starts again from its
        // opening rather than carrying on from the follow-through.
        if (first.clip === last.clip) expect(first.time, `${id} stage ${stage} did not restart ${first.clip}`).toBeLessThan(last.time);
        // Never a frozen pose: the clip advances through the wind-up.
        const contact = stagesOf(id)[stage - 1][1];
        const windUp = mine.filter(f => f.t <= contact);
        let stalls = 0;
        for (let i = 1; i < windUp.length; i++) if (windUp[i].time <= windUp[i - 1].time + 1e-6) stalls++;
        expect(stalls, `${id} stage ${stage} stalled ${stalls} frames of ${windUp.length}`).toBeLessThanOrEqual(1);
      }
    } finally { body.dispose(); }
  }, 60_000);

  it('never plays the same swing twice running where the rig has another', () => {
    // KoKo's body carries Spirit Command (in koko-tr1.glb): on the body alone he commands his spirit on every stage, as
    // he does in the game.
    for (const id of (['koko', 'kenzo', 'taisei', 'konta', 'gummy', 'ward'] as FighterId[]).filter(id => !(id === 'koko' && ORIGINALS.koko))) {
      const { body, frames } = rush(id);
      try {
        const clips = Array.from({ length: RUSH_STAGES }, (_, stage) => frames.find(f => f.stage === stage)!.clip);
        for (let stage = 1; stage < RUSH_STAGES; stage++) expect(clips[stage], `${id}: ${clips.join(' | ')}`).not.toBe(clips[stage - 1]);
      } finally { body.dispose(); }
    }
  }, 60_000);

  it('lands each stage on the contract contact, wherever the clip draws its blow', () => {
    // (Taisei's stage 2 on the floor plays his dream take, 'DZ Rush 2' (Fighter.ts DREAM_STAGES), struck on the stage's own
    // measured contact, contactFrames' rush2.)
    const { body, frames } = rush('taisei');
    try {
      const stage = frames.filter(f => f.stage === 2), contact = RUSH.taisei[1].contacts[0], at = (contactFrames as Record<string, Record<string, number>>).taisei.rush2;
      expect(stage[0].clip).toBe('DZ Rush 2');
      const clip = body.clips.find(c => c.name === 'DZ Rush 2')!;
      const before = [...stage].reverse().find(f => f.t <= contact)!, after = stage.find(f => f.t > contact)!;
      expect(before.time / clip.duration).toBeLessThanOrEqual(at + 1e-3);
      expect(after.time / clip.duration).toBeGreaterThanOrEqual(at - 1e-3);
    } finally { body.dispose(); }
  });

  it('keeps a held blade in hand: an armed fighter never borrows a clip that does not key it, and is never mirrored', () => {
    for (const id of ['kenzo', 'shiden', 'ward'] as FighterId[]) {
      const { body, frames } = rush(id);
      try {
        const light = frames[0].clip;
        const lightClip = body.clips.find(c => c.name === light)!;
        const nodes = (clip: THREE.AnimationClip) => new Set(clip.tracks.map(t => THREE.PropertyBinding.parseTrackName(t.name).nodeName));
        const keyed = nodes(lightClip);
        for (const name of new Set(frames.map(f => f.clip))) {
          expect(name, `${id} mirrored its blade`).not.toMatch(/mirrored/);
          const clip = body.clips.find(c => c.name === name)!;
          const shared = [...keyed].filter(n => nodes(clip).has(n)).length;
          expect(shared / keyed.size, `${id} ${name} keys ${shared} of the light's ${keyed.size} nodes`).toBeGreaterThanOrEqual(.9);
        }
      } finally { body.dispose(); }
    }
  }, 60_000);

  it('uses the air normals for airborne stages only where they are smooth', () => {
    const konta = rush('konta', false), koko = rush('koko', false);
    try {
      // Konta's are the source clips; everyone else's are donated and turn a
      // joint up to sixty degrees a frame, so they keep their grounded stages.
      expect(konta.frames.find(f => f.stage === 1)!.clip).toBe('air Attack 02');
      expect(koko.frames.find(f => f.stage === 1)!.clip).not.toMatch(/air Attack/);
    } finally { konta.body.dispose(); koko.body.dispose(); }
  }, 60_000);


  it('does not restart a swing when the authoritative copy of it arrives', () => {
    const id: FighterId = 'koko', body = new Fighter(base(id), rigs.get(id)!);
    try {
      const dt = 1 / 60;
      for (let f = 0; f < 20; f++) body.update(dt, base(id), true, dt);
      let previous = -1, rewound = 0;
      for (let f = 0; f < 30; f++) {
        // The local copy starts the stage a round trip early; the server's
        // copy of the same press - same input edge - arrives at frame 12 with
        // a later start and a clock 0.06 s behind.
        const late = f >= 12 ? .06 : 0;
        body.update(dt, { ...base(id), action: 'light', chain: 1, actionSeq: 7, actionStarted: 3 + late, actionDuration: .55,
          actionTime: Math.max(0, (f * dt - late) / .55) }, true, dt);
        const time = body.motionEvidence().clipTime ?? 0;
        if (time < previous - 1e-6) rewound++;
        previous = time;
      }
      expect(rewound).toBe(0);
    } finally { body.dispose(); }
  });
});

describe('rushClips and rushModel', () => {
  it('plays the clips the config names, and falls back for one it cannot find', () => {
    const id: FighterId = 'gummy', saved = FIGHTERS[id].rushClips;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    FIGHTERS[id].rushClips = ['Punch 02', 'No Such Clip', 'Punch 01'];
    try {
      const { body, frames } = rush(id);
      try {
        const clips = Array.from({ length: RUSH_STAGES }, (_, stage) => frames.find(f => f.stage === stage)!.clip);
        expect(clips[1]).toBe('Punch 02');
        expect(clips[3]).toBe('Punch 01');
        expect(clips[2]).not.toBe('No Such Clip');
        expect(warn).toHaveBeenCalled();
      } finally { body.dispose(); }
    } finally { FIGHTERS[id].rushClips = saved; warn.mockRestore(); }
  });

  it.skipIf(!!ORIGINALS.koko)('binds an animation-only file by bone name and plays its clips as stages', () => {
    const id: FighterId = 'koko', saved = FIGHTERS[id].rushClips;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const donor = rigs.get(id)!.animations.find(c => c.name === 'Iron Nail')!;
    const renamed = new THREE.AnimationClip('Rush Hook', donor.duration, [
      ...donor.tracks.map(t => t.clone()),
      new THREE.QuaternionKeyframeTrack('NoSuchBone.quaternion', [0], [0, 0, 0, 1]),
    ]);
    const nothing = new THREE.AnimationClip('Rush Nothing', 1, [new THREE.QuaternionKeyframeTrack('NoSuchBone.quaternion', [0], [0, 0, 0, 1])]);
    try {
      const bound = bindClips(rigs.get(id)!.scene, [renamed, nothing], id);
      expect(bound.map(c => c.name)).toEqual(['Rush Hook']);
      expect(bound[0].tracks.some(t => t.name.startsWith('NoSuchBone'))).toBe(false);
      FIGHTERS[id].rushClips = ['Rush Hook', 'Rush Hook', 'Rush Hook'];
      const { body, frames } = rush(id, true, new Fighter(base(id), rigs.get(id)!, false, bound));
      try { expect(frames.find(f => f.stage === 1)!.clip).toBe('Rush Hook'); } finally { body.dispose(); }
    } finally { FIGHTERS[id].rushClips = saved; warn.mockRestore(); }
  });

  it('drops the translations of a file exported in other units', () => {
    const id: FighterId = 'koko';
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const names: string[] = []; rigs.get(id)!.scene.traverse(o => { if ((o as THREE.Bone).isBone) names.push(o.name); });
      const hips = resolveSkeleton(names).get('Hips')!;
      const rest = rigs.get(id)!.scene.getObjectByName(hips)!.position;
      const centimetres = new THREE.AnimationClip('Rush Cm', 1, [
        new THREE.VectorKeyframeTrack(`${hips}.position`, [0, 1], [...rest.clone().multiplyScalar(100).toArray(), ...rest.clone().multiplyScalar(100).toArray()]),
        new THREE.QuaternionKeyframeTrack(`${hips}.quaternion`, [0], [0, 0, 0, 1]),
      ]);
      const [bound] = bindClips(rigs.get(id)!.scene, [centimetres], id);
      expect(bound.tracks.map(t => t.name)).toEqual([`${hips}.quaternion`]);
    } finally { warn.mockRestore(); }
  });
});

describe('mirrorClip', () => {
  it('reflects the motion across the midline, onto the other side of the body', () => {
    const id: FighterId = 'koko', gltf = rigs.get(id)!;
    const model = clone(gltf.scene), joints = sceneJoints(model, resolveSkeleton);
    const clip = gltf.animations.find(c => c.name === 'Straight Punch')!;
    const mirrored = mirrorClip(model, clip, joints)!;
    expect(mirrored).toBeDefined();
    const at = (c: THREE.AnimationClip, time: number, joint: string) => {
      const scratch = clone(gltf.scene), mixer = new THREE.AnimationMixer(scratch);
      const action = mixer.clipAction(c).play(); action.time = time; mixer.update(0); scratch.updateMatrixWorld(true);
      return sceneJoints(scratch, resolveSkeleton).get(joint)!.getWorldPosition(new THREE.Vector3());
    };
    const rest = (joint: string) => joints.get(joint)!.getWorldPosition(new THREE.Vector3());
    model.updateMatrixWorld(true);
    const lateral = rest('LeftArm').sub(rest('RightArm')).add(rest('LeftUpLeg')).sub(rest('RightUpLeg')).normalize();
    const centre = rest('LeftArm').add(rest('RightArm')).add(rest('LeftUpLeg')).add(rest('RightUpLeg')).multiplyScalar(.25);
    for (const fraction of [.25, .5, .75]) {
      const right = at(clip, clip.duration * fraction, 'RightHand'), left = at(mirrored, clip.duration * fraction, 'LeftHand');
      const reflected = right.clone().addScaledVector(lateral, -2 * right.clone().sub(centre).dot(lateral));
      expect(reflected.distanceTo(left), `at ${fraction}`).toBeLessThan(.03);
    }
  });


  it('pairs the roster\'s side spellings', () => {
    expect(swapSide('LeftHand')).toBe('RightHand');
    expect(swapSide('DEF_HandL')).toBe('DEF_HandR');
    expect(swapSide('DEF_FingerR001')).toBe('DEF_FingerL001');
    expect(swapSide('l_leg1_sp_joint')).toBe('r_leg1_sp_joint');
    expect(swapSide('DyT_L_waistHem_A1')).toBe('DyT_R_waistHem_A1');
    expect(swapSide('asianimeL01')).toBe('asianimeR01');
    expect(swapSide('thigh_twistl')).toBe('thigh_twistr');
    expect(swapSide('Spine1')).toBeUndefined();
  });
});
