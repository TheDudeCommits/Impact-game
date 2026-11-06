import { beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { FIGHTERS } from '../src/config';
import { MOVES } from '../src/game/moves';
import { Fighter } from '../src/render/Fighter';
import { SecondaryMotion } from '../src/render/SecondaryMotion';
import { loadRig, base } from './rigHarness';
import type { AttackSlot, FighterId } from '../src/game/types';

/** A cast that holds a pose keeps moving.
 *
 *  The blind critic read Grand Tide, Kenzo's and Kuon's ultimates and
 *  Shirokane's seal as statues. The measure (scripts/probe_hold_length.mts): on
 *  every 60 Hz frame of a cast, the largest local turn of any body joint, and
 *  the longest unbroken run of frames under 1.5 degrees before the move's last
 *  blow. Before the held-pose layer: Grand Tide 4.2 s, Kenzo 2.3 s, Kuon
 *  2.2 s, Kosho 1.8 s. The bar: under 0.4 s for a special, 0.8 s for an
 *  ultimate. Whichever body is drawn is measured - Full Swell's for King
 *  Kong Gun. */
const SKIP = /finger|thumb|index|middle|ring|pinky|toe|eye|jaw/i;
const rigs = new Map<string, GLTF>();
const CASES: [FighterId, AttackSlot, number][] = [['gummy', 'ultimate', .8], ['kenzo', 'ultimate', .8], ['kuon', 'ultimate', .8], ['shirokane', 'special', .4]];
beforeAll(async () => {
  for (const [id] of CASES) {
    rigs.set(id, await loadRig(FIGHTERS[id].model));
    if (FIGHTERS[id].formModel) rigs.set(`${id}-form`, await loadRig(FIGHTERS[id].formModel!));
  }
}, 240_000);

function cast(id: FighterId, slot: AttackSlot, dynamics = true) {
  const state = { ...base(id), ultimate: 100 }, move = MOVES[id][slot];
  const body = new Fighter(state, rigs.get(id)!);
  const form = rigs.get(`${id}-form`);
  if (form) body.attachForm(form);
  body.dynamics = dynamics;
  const inner = (body as unknown as { gear4?: Fighter }).gear4;
  if (inner) inner.dynamics = dynamics;
  body.targetPoint = new THREE.Vector3(0, 1.3, 2); body.targetDistance = 2;
  try {
    for (let f = 0; f < 60; f++) body.update(1 / 60, state, true, 1 / 60);
    const drawn = () => inner && inner.group.visible && !body.model.visible ? inner : body;
    let who = drawn(), joints = [...who.joints.values()].filter(j => !SKIP.test(j.name)), previous = joints.map(j => j.quaternion.clone());
    const last = move.contacts[move.contacts.length - 1];
    let run = 0, longest = 0, lifeAtBlow = 0, lifeMax = 0;
    for (let f = 0; f / 60 < last; f++) {
      const t = f / 60;
      body.update(1 / 60, { ...state, action: slot, actionStarted: 2, actionDuration: move.duration, actionTime: t / move.duration }, true, 1 / 60);
      const now = drawn(), evidence = now.motionEvidence();
      lifeMax = Math.max(lifeMax, evidence.life);
      if (Math.abs(t - last) < 1 / 60) lifeAtBlow = evidence.life;
      if (now !== who) { who = now; joints = [...who.joints.values()].filter(j => !SKIP.test(j.name)); previous = joints.map(j => j.quaternion.clone()); run = 0; continue; }
      let step = 0;
      joints.forEach((j, i) => { step = Math.max(step, THREE.MathUtils.radToDeg(previous[i].angleTo(j.quaternion))); previous[i].copy(j.quaternion); });
      if (f > 0 && step < 1.5) { run++; longest = Math.max(longest, run); } else run = 0;
    }
    return { longest: longest / 60, lifeAtBlow, lifeMax };
  } finally { body.dispose(); }
}

describe('a held pose keeps moving', () => {
  it.each(CASES)('%s %s holds no pose longer than the bar before its blow', (id, slot, bar) => {
    const alive = cast(id, slot), still = cast(id, slot, false);
    expect(alive.longest, `${id} ${slot}: ${alive.longest.toFixed(2)} s of one pose`).toBeLessThan(bar);
    // It is the layer that does it: the same cast with the procedural layer
    // off is the clip alone, and that is where the statue was.
    // Round 3d (PACE): and only where there was a statue to break. A cast
    // that no longer holds a pose - Shirokane's seal has 0.62 s to its blow
    // now, not 1.05, and is drawn as one quick sign - leaves it nothing to do.
    if (still.longest >= bar) {
      expect(alive.longest).toBeLessThan(still.longest * .6);
      expect(alive.lifeMax, 'the layer ran').toBeGreaterThan(.5);
    }
    // And it is gone by the blow, so the contact is the clip's.
    expect(alive.lifeAtBlow, 'nothing of the hold rides the drive into contact').toBeLessThan(.05);
  }, 120_000);
});

describe('a charging aura lifts the hair', () => {
  it('raises a chain in the updraft and lets it back down', () => {
    const root = new THREE.Group(), head = new THREE.Bone(), link = new THREE.Bone(), tip = new THREE.Bone();
    head.name = 'Head'; link.name = 'Detail_CLOTH_hair_1'; tip.name = 'Detail_CLOTH_hair_2';
    link.position.set(0, -.01, -.02); tip.position.set(0, -.12, -.02);
    head.add(link); link.add(tip); root.add(head);
    const motion = new SecondaryMotion(root, 'kenzo');
    const tipHeight = () => { root.updateMatrixWorld(true); return tip.getWorldPosition(new THREE.Vector3()).y; };
    for (let i = 0; i < 30; i++) motion.update(1 / 60);
    const rest = tipHeight();
    motion.aura(1);
    let lifted = -Infinity;
    for (let i = 0; i < 60; i++) { motion.update(1 / 60); lifted = Math.max(lifted, tipHeight()); }
    expect(lifted - rest, 'the updraft lifts the chain').toBeGreaterThan(.004);
    motion.aura(0);
    for (let i = 0; i < 120; i++) motion.update(1 / 60);
    expect(Math.abs(tipHeight() - rest), 'and it settles back').toBeLessThan(.003);
  });
});
