import { beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { GLTF, GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FIGHTERS } from '../src/config';
import { MOVES } from '../src/game/moves';
import { bindClips, Fighter } from '../src/render/Fighter';
import { bindFormExtras } from '../src/render/gummy/sunrise';
import { openHandName } from '../src/render/gummy/openHands';
import { GRAND_TIDE_GRAB, GRAND_TIDE_TAKE, grandTideGrab } from '../src/render/gummy/grand-tide';
import type { PlayerState } from '../src/game/types';
import { base, loadRig } from './rigHarness';
import { ORIGINALS } from '../src/originals/roster';
import { LUCY_TIDE } from '../src/originals/lucyTide';

/**
 * Round 6 (GUMMY ULT): the GRAND TIDE's opener is SUNRISE's grab (src/render/gummy/grand-tide.ts). The take whips his right
 * arm out of the crouch; the hand flies open on the stretched forearm to the body it is thrown at, however far - the
 * simulation reaches 11 m (moves.ts) - shuts on them when the confirm says it has them, holds them into his spring, and
 * lets go; a whiff closes on the air and snaps straight back. On his body as the game loads it, SUNRISE and all.
 */
const move = MOVES.gummy.ultimate, contact = move.contacts[0];
let assets: { body: GLTF; form: GLTF; taisei: GLTF };
beforeAll(async () => {
  const def = FIGHTERS.gummy, body = await loadRig(def.model);
  for (const url of def.extraModels ?? []) {
    const clips = bindClips(body.scene, (await loadRig(url)).animations, 'Gummy'), names = new Set(clips.map(c => c.name));
    body.animations = [...body.animations.filter(c => !names.has(c.name)), ...clips];
  }
  const form = await loadRig(def.formModel!);
  await bindFormExtras({ loadAsync: (url: string) => loadRig(url) } as unknown as GLTFLoader, def, body, form, bindClips);
  assets = { body, form, taisei: await loadRig(FIGHTERS.taisei.model) };
}, 120_000);

/** Gummy at the origin facing +z, a Taisei `gap` metres ahead, and the GRAND TIDE thrown at him from 1 s. */
function scene(gap: number, verdict: { confirmed?: boolean; whiffed?: boolean; awakened?: boolean } = {}) {
  const f = new Fighter({ ...base('gummy'), id: 'gummy', ultimate: 100 }, assets.body);
  f.attachForm(assets.form);
  const victim = new Fighter({ ...base('taisei'), id: 'v', z: gap, yaw: Math.PI }, assets.taisei);
  const decided = 1 + contact + 1 / 30;
  const at = (t: number) => {
    const on = 1 + t >= decided;
    victim.update(1 / 60, { ...base('taisei'), id: 'v', z: gap, yaw: Math.PI, action: on && verdict.confirmed ? 'hurt' : 'idle' }, true);
    f.targetPoint = new THREE.Vector3(0, 1.45, gap);
    f.update(1 / 60, { ...base('gummy'), id: 'gummy', awakened: !!verdict.awakened, action: 'ultimate', actionStarted: 1, actionDuration: move.duration,
      actionTime: t / move.duration, target: 'v', ...(on && verdict.confirmed ? { confirmedAt: decided } : {}), ...(on && verdict.whiffed ? { whiffedAt: decided } : {}) } as PlayerState, true);
    const body = LUCY_TIDE && !verdict.awakened ? f : (f as unknown as { awakenedForm: Fighter }).awakenedForm;
    const own = (body.joints.get('Spine2') ?? body.joints.get('Spine1') ?? body.joints.get('Hips'))!.getWorldPosition(new THREE.Vector3());
    return { hand: body.joints.get('RightHand')!.getWorldPosition(new THREE.Vector3()), body, own, chest: new THREE.Vector3(0, 1.1, gap) };
  };
  return { f, victim, at, dispose: () => { f.dispose(); victim.dispose(); } };
}

describe('the grab, as a clock (grandTideGrab)', () => {
  const state = (t: number, over: Partial<PlayerState> = {}) => ({ actionStarted: 1, actionDuration: move.duration, actionTime: t / move.duration, ...over });
  it('leaves GRAND_TIDE_GRAB.out before the contact, fastest as it goes, and is out on the contact', () => {
    expect(grandTideGrab(state(contact - GRAND_TIDE_GRAB.out - .01), contact).reach).toBeUndefined();
    const early = grandTideGrab(state(contact - GRAND_TIDE_GRAB.out * .75), contact).reach!, late = grandTideGrab(state(contact - GRAND_TIDE_GRAB.out * .25), contact).reach!;
    expect(early).toBeGreaterThan(.25); expect(late).toBeGreaterThan(early);
    expect(grandTideGrab(state(contact), contact).reach).toBe(1);
    expect(grandTideGrab(state(contact - .05), contact).open, 'open as it flies').toBe(true);
  });
  it('confirmed: shut on them, on them, until it lets go as he springs', () => {
    const confirmedAt = 1 + contact + .02;
    const held = grandTideGrab(state(contact + .1, { confirmedAt }), contact);
    expect(held).toMatchObject({ reach: 1, open: false, follow: true });
    expect(grandTideGrab(state(contact + GRAND_TIDE_GRAB.release + .01, { confirmedAt }), contact).back).toBeCloseTo(.01, 5);
  });
  it('whiffed: open on the air where they stood, and straight back from the whiff', () => {
    const whiffedAt = 1 + contact + .1;
    expect(grandTideGrab(state(contact + .05, { whiffedAt }), contact)).toMatchObject({ reach: 1, open: true, follow: false });
    expect(grandTideGrab(state(contact + .15, { whiffedAt }), contact).back).toBeCloseTo(.05, 5);
  });
  it('undecided (a client a round trip from the verdict): it waits on the contact, then comes back anyway', () => {
    expect(grandTideGrab(state(contact + GRAND_TIDE_GRAB.wait - .01), contact).reach).toBe(1);
    expect(grandTideGrab(state(contact + GRAND_TIDE_GRAB.wait + .01), contact).back).toBeDefined();
  });
});

describe('SUNRISE\'s arm', () => {
  it.each([3, 9.5])('reaches a body %s m off on the contact and holds it until it lets go', gap => {
    const s = scene(gap, { confirmed: true });
    try {
      let reached = Infinity, held = 0, frames = 0;
      for (let t = 0; t <= contact + GRAND_TIDE_GRAB.release - .03; t += 1 / 60) {
        const { hand, chest } = s.at(t);
        if (t >= contact - 1 / 60) { reached = Math.min(reached, hand.distanceTo(chest)); frames++; if (hand.distanceTo(chest) < .45) held++; }
      }
      expect(reached, 'its hand at their middle').toBeLessThan(.3);
      expect(held / frames, 'and kept there through the grip').toBeGreaterThan(ORIGINALS.gummy ? .8 : .9);
      // Let go: back to him well before the fist is down.
      let back = Infinity;
      for (let t = contact + GRAND_TIDE_GRAB.release; t <= contact + GRAND_TIDE_GRAB.release + .3; t += 1 / 60) { const { hand, own } = s.at(t); back = Math.min(back, hand.distanceTo(own)); }
      expect(back, 'its hand back at him').toBeLessThan(1.6);
    } finally { s.dispose(); }
  });

  it('does not fly while the arm is still drawn back: nothing before the take has whipped it round', () => {
    const s = scene(8, { confirmed: true });
    try {
      for (let t = 0; t < contact - GRAND_TIDE_GRAB.out; t += 1 / 60) { const { hand, own } = s.at(t); expect(hand.distanceTo(own), `at ${t.toFixed(2)} s`).toBeLessThan(1.5); }
    } finally { s.dispose(); }
  });

  it('whiffed, snaps back from the air instead of staying out', () => {
    const s = scene(6, { whiffed: true });
    try {
      let out = 0;
      for (let t = 0; t <= contact + .02; t += 1 / 60) { const { hand, own } = s.at(t); out = Math.max(out, hand.distanceTo(own)); }
      expect(out, 'it went out').toBeGreaterThan(4);
      let home = Infinity;
      for (let t = contact + .05; t <= contact + .25; t += 1 / 60) { const { hand, own } = s.at(t); home = Math.min(home, hand.distanceTo(own)); }
      expect(home, 'and is back').toBeLessThan(1.6);
    } finally { s.dispose(); }
  });

  it.skipIf(!!ORIGINALS.gummy)('flies open and shuts on them: the right hand alone', () => {
    const s = scene(5, { confirmed: true });
    try {
      const sunrise = (s.f as unknown as { awakenedForm: Fighter }).awakenedForm;
      const right = sunrise.model.getObjectByName(openHandName('gummy-g5', 'R'))!, left = sunrise.model.getObjectByName(openHandName('gummy-g5', 'L'))!;
      expect(right && left, 'SUNRISE carries his open hands').toBeTruthy();
      s.at(contact - .03);
      expect(right.visible, 'open as it flies').toBe(true);
      expect(left.visible, 'the left stays a fist').toBe(false);
      s.at(contact + .1);
      expect(right.visible, 'shut on them').toBe(false);
    } finally { s.dispose(); }
  });

});
