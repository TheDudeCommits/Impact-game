import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { FIGHTERS } from '../src/config';
import { MOVES } from '../src/game/moves';
import { characterClips, sceneJoints } from '../src/render/characterMotion';
import { resolveSkeleton } from '../src/render/skeleton';
import { loadRig } from './rigHarness';

/** Kuon's and Magatsu's animation: Kuon's authored techniques keep their names and lengths (characterMotion.ts) and his
 *  feet where they stand, and Magatsu's Flaying Cut and Kuon's Hex Jab hold their stance through the blow. */
const at = (model: THREE.Object3D, clip: THREE.AnimationClip, time: number) => {
  const mixer = new THREE.AnimationMixer(model), action = mixer.clipAction(clip).play();
  action.time = time; mixer.update(0); model.updateMatrixWorld(true);
  return () => { mixer.stopAllAction(); mixer.uncacheRoot(model); };
};
const bone = (model: THREE.Object3D, pattern: RegExp) => {
  let found: THREE.Bone | undefined;
  model.traverse(o => { if (!found && (o as THREE.Bone).isBone && pattern.test(o.name)) found = o as THREE.Bone; });
  if (!found) throw new Error(`no bone ${pattern}`);
  return found;
};
const where = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3());

describe("Kuon's techniques (characterMotion.ts)", async () => {
  const rig = await loadRig(FIGHTERS.kuon.model);
  // The body's own clips with the takes laid over them by name, as FighterLibrary binds them: `_Idle` is the base the
  // techniques are posed from.
  const takes = new Map<string, THREE.AnimationClip>();
  for (const extra of FIGHTERS.kuon.extraModels ?? []) for (const clip of (await loadRig(extra)).animations) takes.set(clip.name, clip);
  const source = rig.animations.map(c => takes.get(c.name) ?? c);
  const model = rig.scene, joints = sceneJoints(model, resolveSkeleton);
  const clips = characterClips(model, source, 'kuon', joints);
  const clip = (slot: string) => clips.find(c => c.name === `Authored kuon ${slot}`)!;
  const height = (() => { const done = at(model, source.find(c => c.name === '_Idle')!, 0); const h = where(bone(model, /^Head$/)).y - where(bone(model, /^LeftFoot$/)).y; done(); return h / .86; })();

  it('keep their names and lengths', () => {
    for (const slot of ['heavy', 'special', 'ultimate'] as const) {
      expect(clip(slot), slot).toBeTruthy();
      expect(clip(slot).duration, slot).toBeCloseTo(MOVES.kuon[slot].duration, 6);
    }
  });

  it('keep his feet where they stand: the dip and the turn are taken in his knees', () => {
    for (const slot of ['heavy', 'special', 'ultimate'] as const) {
      const c = clip(slot);
      let done = at(model, c, 0);
      const start = ['LeftFoot', 'RightFoot'].map(n => where(bone(model, new RegExp(`^${n}$`))));
      done();
      let worst = 0, dipped = 0;
      for (let t = 0; t <= c.duration; t += 1 / 30) {
        done = at(model, c, t);
        ['LeftFoot', 'RightFoot'].forEach((n, i) => { worst = Math.max(worst, where(bone(model, new RegExp(`^${n}$`))).distanceTo(start[i])); });
        dipped = Math.max(dipped, Math.abs(where(bone(model, /^LeftLeg$/)).y - where(bone(model, /^LeftUpLeg$/)).y));
        done();
      }
      expect(worst / height, `${slot}: an ankle off its spot`).toBeLessThan(.01);
    }
  });

  it("make the Void's sign before his face, two fingers up and crossed, the other hand closed at his side", () => {
    const c = clip('ultimate'), sign = MOVES.kuon.ultimate.contacts[0] - .05;
    const done = at(model, c, sign);
    const head = where(bone(model, /^Head$/)), hand = where(bone(model, /^RightHand$/));
    const index = [1, 3].map(i => where(bone(model, new RegExp(`^RightHandIndex${i}`)))), ring = [1, 3].map(i => where(bone(model, new RegExp(`^RightHandRing${i}`))));
    const left = where(bone(model, /^LeftHand$/)), hips = where(bone(model, /^Hips$/));
    done();
    // The hand at his face's height, in front of it and to his right; the index pointing up, the ring curled into the palm.
    expect(Math.abs(hand.y - head.y) / height, 'the hand at his face').toBeLessThan(.12);
    expect((index[1].y - index[0].y) / height, 'the index up').toBeGreaterThan(.025);
    expect(ring[1].distanceTo(hand) / ring[0].distanceTo(hand), 'the ring curled in').toBeLessThan(1.15);
    expect(Math.abs(left.y - hips.y) / height, 'the left hand down at his side').toBeLessThan(.08);
  });

  it("hold Blue and Red out to his sides before Singularity brings them together", () => {
    const c = clip('special');
    // The spread's key, laid on the move's clock by `clocked`: past a quarter of the wind-up.
    const done = at(model, c, MOVES.kuon.special.contacts[0] * .4);
    const apart = where(bone(model, /^RightHand$/)).distanceTo(where(bone(model, /^LeftHand$/)));
    done();
    expect(apart / height, 'hands spread wide').toBeGreaterThan(.6);
  });
});

describe("Magatsu's takes", () => {
  // Magatsu's own body carries his Flaying Cut.
  it('keeps his feet apart under Flaying Cut (they came together and crossed, knees in)', async () => {
    const body = await loadRig(FIGHTERS.magatsu.model);
    const clip = body.animations.find(c => c.name === 'Flaying Cut')!, model = body.scene;
    expect(clip.duration).toBeCloseTo(0.833, 2);
    const height = (() => { const done = at(model, body.animations.find(c => c.name === '_Idle')!, 0); const h = where(bone(model, /^Head$/)).y - where(bone(model, /^LeftFoot$/)).y; done(); return h / .86; })();
    // From the coil (0.4 of the clip) to the follow-through (0.78).
    for (let u = .42; u <= .76; u += .04) {
      const done = at(model, clip, u * clip.duration);
      const apart = where(bone(model, /^LeftFoot$/)).distanceTo(where(bone(model, /^RightFoot$/)));
      done();
      expect(apart / height, `${u.toFixed(2)}: feet apart`).toBeGreaterThan(.16);
    }
  });
});

describe("Kuon's Hex Jab (Rush 1)", () => {
  // Kuon's own rush file carries his Hex Jab.
  it('is thrown with his trunk up over his hips (it dove in bent double, the head down by the fist)', async () => {
    const body = await loadRig(FIGHTERS.kuon.model), take = await loadRig(FIGHTERS.kuon.rushModel!), model = body.scene;
    const clip = take.animations.find(c => c.name === 'Rush 1')!;
    // The stage's contact (contactFrames.json, rush 1) and either side of it.
    for (const u of [.36, .42, .48]) {
      const done = at(model, clip, u * clip.duration);
      const hips = where(bone(model, /^Hips$/)), neck = where(bone(model, /^Neck$/));
      done();
      const trunk = neck.clone().sub(hips), pitch = THREE.MathUtils.radToDeg(Math.atan2(Math.hypot(trunk.x, trunk.z), trunk.y));
      expect(pitch, `${u}: the trunk off upright`).toBeLessThan(32);
    }
  });
});
