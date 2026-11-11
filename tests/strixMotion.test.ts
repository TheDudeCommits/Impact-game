import { afterEach, describe, expect, it } from 'vitest';
import { FIGHTERS } from '../src/config';
import { MOVES } from '../src/game/moves';
import { rushMove } from '../src/game/awakening';
import { COMBO_KEYS, COMBO_SLOT, comboMove } from '../src/game/combos';
import type { PlayerState } from '../src/game/types';
import { AIR_STRING_CLIPS, Fighter } from '../src/render/Fighter';
import { COMBO_CLIPS } from '../src/render/comboClips';
import { base, loadRig } from './rigHarness';

/** Exercise the renderer against the real candidate rig: a missing or wrongly
 * named native take must not silently fall back to another fighter's motion. */
const bodies: Fighter[] = [];
afterEach(() => bodies.splice(0).forEach(body => body.dispose()));
async function draw(state: Partial<PlayerState>, duration: number, contact: number) {
  const rig = await loadRig(FIGHTERS.strix.model), initial = base('strix');
  const body = new Fighter(initial, rig, false); bodies.push(body); body.prepareRush();
  for (let i = 0; i < 20; i++) body.update(1/60, initial, true, 1/60);
  const frames = Math.ceil(contact * 60);
  for (let i = 0; i <= frames; i++) body.update(1/60, {
    ...initial, ...state, actionStarted: 1, actionSeq: 1, actionDuration: duration,
    actionTime: (contact * i / frames) / duration,
  }, true, 1/60);
  return { evidence: body.motionEvidence(), rig };
}

describe('Strix native sword choreography', () => {
  it.each([0, 1, 2])('air stage %i draws the selected blade cut at its measured contact', async stage => {
    const move = stage ? rushMove('strix', stage, false) : MOVES.strix.light;
    const own = AIR_STRING_CLIPS.strix![stage];
    const { evidence } = await draw({ action: 'light', chain: stage, grounded: false, y: 3 }, move.duration, move.contacts[0]);
    expect(evidence.clip).toBe(own.clip);
    expect(evidence.clip).not.toBe(FIGHTERS.strix.clips?.[0]);
    expect(evidence.clipTime).toBeCloseTo(own.from! + (own.to! - own.from!) * own.contact!, 2);
  });
  it.each(COMBO_KEYS)('%s draws its native ender instead of a fallback', async key => {
    const move = comboMove('strix', key)!, own = COMBO_CLIPS.strix![key]!;
    // The ground smash is sampled once it has landed, when the collision and
    // animation clocks resume together. Air-light stages are exercised above.
    const { evidence, rig } = await draw({ action: COMBO_SLOT[key], branch: key }, move.duration, move.contacts[0]);
    expect(evidence.clip).toBe(own.clip);
    const clip = rig.animations.find(clip => clip.name === own.clip)!;
    expect(evidence.clipTime).toBeCloseTo(clip.duration * own.contact!, 2);
  });
});
