import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { MOVES } from '../src/game/moves';
import type { PlayerState } from '../src/game/types';
import type { Fighter } from '../src/render/Fighter';
import { APPEAR_HOLD, GoldenTechniques, transmissionHidden } from '../src/render/signature/GoldenTechniques';
import { base } from './rigHarness';

/** Round 3: the Cloudstep body is hidden from the vanish until a
 *  snapshot past the return, and given back whatever interrupts the move. */
const HEAVY = MOVES.taisei.heavy, T = HEAVY.teleport!;
function body(state: PlayerState) {
  const group = new THREE.Group();
  return { state, group, handR: new THREE.Vector3(0, 1.2, .4), handL: new THREE.Vector3(0, 1.2, .4) } as unknown as Fighter;
}
const at = (f: Fighter, seconds: number, action: PlayerState['action'] = 'heavy') => {
  f.state = { ...f.state, action, actionStarted: 1, actionDuration: HEAVY.duration, actionTime: seconds / HEAVY.duration, actionSeq: 3 };
};

describe('Cloudstep on screen', () => {
  it('is gone from the vanish until just after the return', () => {
    expect(transmissionHidden('taisei', 'heavy', T.vanish - .01)).toBe(false);
    expect(transmissionHidden('taisei', 'heavy', T.vanish)).toBe(true);
    expect(transmissionHidden('taisei', 'heavy', T.appear + APPEAR_HOLD - .001)).toBe(true);
    expect(transmissionHidden('taisei', 'heavy', T.appear + APPEAR_HOLD)).toBe(false);
    expect(transmissionHidden('ouga', 'heavy', T.vanish + .05), 'only Taisei').toBe(false);
    // A snapshot interval, so a remote body is never drawn crossing the gap.
    expect(APPEAR_HOLD).toBeGreaterThan(1 / 30);
  });

  it('hides and shows the drawn body on the move\'s own clock', () => {
    const scene = new THREE.Scene(), fx = new GoldenTechniques(scene);
    const taisei = body({ ...base('taisei'), id: 'g' }), fighters = new Map([['g', taisei]]);
    try {
      for (const [seconds, visible] of [[.1, true], [T.vanish + .02, false], [T.appear + .01, false], [T.appear + APPEAR_HOLD + .01, true], [HEAVY.contacts[0], true]] as const) {
        at(taisei, seconds); fx.update(10 + seconds, fighters, 1);
        expect(taisei.group.visible, `${seconds}s`).toBe(visible);
      }
      // Knocked out of it while gone, or reset, the body comes back.
      at(taisei, T.vanish + .05); fx.update(11, fighters, 1);
      expect(taisei.group.visible).toBe(false);
      at(taisei, .1, 'hurt'); fx.update(11.1, fighters, 1);
      expect(taisei.group.visible, 'hit out of it').toBe(true);
      at(taisei, T.vanish + .05); fx.update(12, fighters, 1);
      expect(taisei.group.visible).toBe(false);
      fx.reset();
      expect(taisei.group.visible, 'reset').toBe(true);
    } finally { fx.dispose(); }
  });
});
