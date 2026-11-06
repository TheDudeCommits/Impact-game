import { beforeAll, describe, expect, it } from 'vitest';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { FIGHTERS } from '../src/config';
import { MOVES } from '../src/game/moves';
import { Fighter } from '../src/render/Fighter';
import { loadRig, base } from './rigHarness';
import type { FighterId, PlayerState } from '../src/game/types';

/** Round 4b (COMBAT): the blind critic saw the first blow of a string turn its thrower 53-64 degrees in one frame when
 *  they were not already facing the target (Kenzo, Gummy, Nigo, Konta, LORD ORO). The simulation aims the swing on the tick
 *  it starts; the body drawn turns onto it over three to five sixtieths of a second (Fighter.attackTurn), eased, at any
 *  frame rate - the critic's capture ran at 30 fps, where the old 28 rad/s cap was a whole snap in a frame. */
const bodies = new Map<FighterId, GLTF>();
const ROSTER: FighterId[] = ['kenzo', 'gummy', 'oro'];
beforeAll(async () => { for (const id of ROSTER) bodies.set(id, await loadRig(FIGHTERS[id].model)); }, 120_000);

/** The drawn yaw, frame by frame, of a light thrown at a body `turn` radians off the way the fighter faced. */
function turnOf(id: FighterId, turn: number, fps: number) {
  const s0: PlayerState = { ...base(id), yaw: 0 }, body = new Fighter(s0, bodies.get(id)!, false);
  try {
    for (let i = 0; i < 30; i++) body.update(1 / 60, s0, true, 1 / 60);
    const light = MOVES[id].light, dt = 1 / fps, yaws: number[] = [body.group.rotation.y];
    for (let i = 0; i < Math.round(.3 * fps); i++) {
      body.update(dt, { ...s0, yaw: turn, action: 'light', chain: 0, actionSeq: 7, actionStarted: 3, actionDuration: light.duration, actionTime: Math.min(1, (i + 1) * dt / light.duration) }, true, dt);
      yaws.push(body.group.rotation.y);
    }
    return yaws;
  } finally { body.dispose(); }
}

describe('the first blow\'s turn onto its target', () => {
  it.each(ROSTER)('%s: turns 60 degrees over three to five sixtieths, eased, never in one frame', id => {
    const turn = 60 * Math.PI / 180;
    for (const fps of [60, 30]) {
      const yaws = turnOf(id, turn, fps), steps = yaws.slice(1).map((y, i) => y - yaws[i]);
      // The largest share of the turn any one frame makes: at 30 fps the old cap made the whole of it.
      const most = Math.max(...steps.map(Math.abs));
      expect(most / turn, `${id} at ${fps} fps: ${(most * 180 / Math.PI).toFixed(0)} deg in a frame`).toBeLessThan(fps === 60 ? .35 : .65);
      // And it is done inside a twelfth of a second, well before the blow lands.
      const doneAt = yaws.findIndex(y => Math.abs(y - turn) < .01);
      expect(doneAt, `${id} at ${fps} fps: turned by frame ${doneAt}`).toBeGreaterThan(fps === 60 ? 2 : 1);
      expect(doneAt / fps, `${id} at ${fps} fps`).toBeLessThanOrEqual(.1);
      expect(doneAt / fps).toBeLessThan(MOVES[id].light.contacts[0]);
    }
  }, 60_000);

  it('leaves a turn too small to see alone: it follows the aim as it always did', () => {
    const yaws = turnOf('kenzo', .05, 60);
    expect(Math.abs(yaws[yaws.length - 1] - .05)).toBeLessThan(.01);
  });
});
