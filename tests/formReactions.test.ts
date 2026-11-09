import { beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { FIGHTERS } from '../src/config';
import { Fighter } from '../src/render/Fighter';
import { loadRig, base } from './rigHarness';
import type { FighterId, PlayerState } from '../src/game/types';

/** What a struck body shows beyond its reaction clip: a transformation's body
 *  flinches with the fighter it replaces, a rush finisher lands heavier than
 *  the stages before it, and a blow from behind is not played as one from in
 *  front. */
const rigs = new Map<string, GLTF>();
beforeAll(async () => {
  for (const id of ['gummy', 'tobari', 'kenzo'] as FighterId[]) {
    rigs.set(id, await loadRig(FIGHTERS[id].model));
    if (FIGHTERS[id].formModel) rigs.set(`${id}-form`, await loadRig(FIGHTERS[id].formModel!));
  }
}, 120_000);
type Inside = { hitFlash: number; hitFreeze: number; reactionEpoch: number; recoil: THREE.Vector3; group: THREE.Group;
  motionEvidence(): ReturnType<Fighter['motionEvidence']>; awakenedForm?: Inside };
const inside = (fighter: Fighter) => fighter as unknown as Inside;
/** A fighter transformed and standing, with its form body showing. */
function transformed(id: FighterId) {
  const body = new Fighter(base(id), rigs.get(id)!);
  body.attachForm(rigs.get(`${id}-form`)!);
  const state: PlayerState = { ...base(id), awakened: true };
  for (let i = 0; i < 10; i++) body.update(1 / 60, state, true);
  return { body, state };
}

describe('a transformation takes the hit with its fighter', () => {
  it('Full Swell flinches, flashes and holds on a blow the fighter takes', () => {
    const { body, state } = transformed('gummy');
    try {
      const form = inside(body).awakenedForm!;
      expect(form.group.visible, 'the form is showing').toBe(true);
      const before = form.reactionEpoch;
      body.impact(true, 'heavy', 'melee', 0, new THREE.Vector3(0, 0, -1), 90, 1.2);
      expect(form.reactionEpoch).toBe(before + 1);
      expect(form.hitFlash).toBeGreaterThan(0);
      expect(form.hitFreeze).toBeGreaterThan(0);
      // And the form plays its own reaction on the blow's snap.
      body.update(1 / 60, { ...state, action: 'hurt', actionStarted: 5, actionDuration: .4, actionTime: 0 }, true);
      expect(form.motionEvidence().action).toBe('hurt');
    } finally { body.dispose(); }
  });

  it('holds the form on the contact of a blow it lands', () => {
    const { body } = transformed('kenzo');
    try {
      body.impact(false, 'heavy', 'melee', 0, new THREE.Vector3(0, 0, 1), 90);
      expect(inside(body).awakenedForm!.hitFreeze).toBeGreaterThan(0);
    } finally { body.dispose(); }
  });

  // (Round 4b: Tobari's is the Guardian still worn as a form; Shirokane's, Shiden's and Akagane's stand behind them.)
  it('leaves a worn Guardian alone: the fighter inside it takes the hit', () => {
    const { body } = transformed('tobari');
    try {
      const form = inside(body).awakenedForm!;
      const before = form.reactionEpoch;
      body.impact(true, 'heavy', 'melee', 0, new THREE.Vector3(0, 0, -1), 90, 1.2);
      expect(form.reactionEpoch).toBe(before);
      expect(inside(body).hitFlash).toBeGreaterThan(0);
    } finally { body.dispose(); }
  });
});

describe('a rush finisher lands heavier than the stages before it', () => {
  it('holds longer, flashes brighter and bends the struck body further', () => {
    const struck = (chain: number) => {
      const body = new Fighter(base('kenzo'), rigs.get('kenzo')!);
      try {
        body.impact(true, 'light', 'melee', 0, new THREE.Vector3(0, 0, -1), 50, 1.2, { chain });
        const i = inside(body);
        return { freeze: i.hitFreeze, flash: i.hitFlash, recoil: i.recoil.length() };
      } finally { body.dispose(); }
    };
    const stage = struck(1), finisher = struck(3);
    expect(finisher.freeze).toBeGreaterThan(stage.freeze);
    expect(finisher.flash).toBeGreaterThan(stage.flash);
    expect(finisher.recoil).toBeGreaterThan(stage.recoil * 1.2);
  });
});

// Round 5 (GUARD): everything about a guard is drawn on its orb (vfx/GuardFx, tests/guardOrb.test.ts).
describe('a blow the guard takes', () => {
  it('does not flash the guarding body: the orb takes that blow, and a landed one still flashes', () => {
    const body = new Fighter(base('kenzo'), rigs.get('kenzo')!);
    try {
      const guarding: PlayerState = { ...base('kenzo'), action: 'guard', guarding: true };
      for (let i = 0; i < 3; i++) body.update(1 / 60, guarding, true);
      // A blocked event carries no reaction; a big blow's would have painted the body white, then the thrower's colour.
      body.impact(true, 'heavy', 'melee', 0, new THREE.Vector3(0, 0, -1), 90, 1.2, { big: true, tint: 0xff4020 });
      expect(inside(body).hitFlash, 'no flash on a guarded blow').toBe(0);
      expect(inside(body).hitFreeze, 'the guard still holds on it').toBeGreaterThan(0);
      body.impact(true, 'heavy', 'melee', 0, new THREE.Vector3(0, 0, -1), 90, 1.2, { reaction: 'hurt' });
      expect(inside(body).hitFlash, 'a landed blow flashes').toBeGreaterThan(0);
    } finally { body.dispose(); }
  });
});

describe('a blow from behind', () => {
  const clipFor = (heading: THREE.Vector3, fromBehind?: boolean) => {
    const body = new Fighter(base('kenzo'), rigs.get('kenzo')!);
    try {
      for (let i = 0; i < 5; i++) body.update(1 / 60, base('kenzo'), true);
      body.impact(true, 'heavy', 'melee', 0, heading, 60, 1.3, fromBehind === undefined ? undefined : { fromBehind });
      body.update(1 / 60, { ...base('kenzo'), action: 'hurt', actionStarted: 5, actionDuration: .4, actionTime: .1 }, true);
      return String(body.motionEvidence().clip);
    } finally { body.dispose(); }
  };
  it('staggers in place rather than whipping the head back into the blow', () => {
    // The body faces +z: a blow travelling +z arrived from behind.
    expect(clipFor(new THREE.Vector3(0, 0, 1))).toMatch(/shake/);
    expect(clipFor(new THREE.Vector3(0, 0, -1))).toBe('Hit 01');
  });
  it('takes the side from the event when the caller has it', () => {
    expect(clipFor(new THREE.Vector3(0, 0, -1), true)).toMatch(/shake/);
    expect(clipFor(new THREE.Vector3(0, 0, 1), false)).toBe('Hit 01');
  });
});
