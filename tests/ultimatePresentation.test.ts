import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { MOVES, WHIFF_RECOVERY } from '../src/game/moves';
import { CombatEffects } from '../src/render/CombatEffects';
import { GauntEffects } from '../src/render/GauntEffects';
import { WardEffects } from '../src/render/WardEffects';
import { beats, landed, ultimateEnd, whiffEnd } from '../src/render/signature/ultimateClock';
import type { Fighter } from '../src/render/Fighter';
import type { CombatEvent, FighterId, PlayerState } from '../src/game/types';

/**
 * Round 3d (ULTS): the presentation follows the confirm. A hit-confirm
 * ultimate's opener is drawn from the cast; its cinematic only once the
 * opener has landed (PlayerState.confirmedAt); one that whiffed is gone with
 * the move, WHIFF_RECOVERY after the miss. The area ultimates mark their
 * blast on the floor from the cast.
 */
const player = (props: Partial<PlayerState>): PlayerState => ({ id: 'a', name: 'A', fighter: 'taisei', x: 0, y: 0, z: 0, yaw: 0, hp: 1000, maxHp: 1000,
  stamina: 100, ultimate: 0, action: 'idle', actionStarted: 0, actionDuration: 0, actionTime: 0, target: null, alive: true, isBot: false, grounded: true,
  guarding: false, cooldowns: { light: 0, heavy: 0, special: 0, ultimate: 0 }, ...props });
function body(state: PlayerState): Fighter {
  const group = new THREE.Group(); group.position.set(state.x, state.y, state.z);
  return { state, group, handR: new THREE.Vector3(.3, 1.3, .4), handL: new THREE.Vector3(-.3, 1.3, .4), bones: new Map(), joints: new Map(),
    chargePosition(out: THREE.Vector3) { return out.set(0, 1.3, .5); }, meleeContactPoint() { return false; }, strikePoint(out: THREE.Vector3) { return out.set(.3, 1.3, .9); } } as unknown as Fighter;
}
/** An ultimate on the move's own clock, `t` seconds in, from `started`. */
const at = (s: PlayerState, t: number) => { s.action = 'ultimate'; s.actionTime = Math.min(1, t / s.actionDuration); };

describe('the ultimate clock the effects read', () => {
  it('says whether the opener has landed, where a whiff ends and how many blows are drawn', () => {
    const move = MOVES.gaunt.ultimate, s = player({ fighter: 'gaunt', action: 'ultimate', actionStarted: 10, actionDuration: move.duration });
    expect(landed(s)).toBe(false); expect(whiffEnd(s)).toBe(Infinity); expect(ultimateEnd(s)).toBe(move.duration);
    expect(beats(s, move), 'the opener alone until the confirm').toBe(1);
    s.confirmedAt = 10 + move.contacts[0];
    expect(landed(s)).toBe(true); expect(beats(s, move)).toBe(move.contacts.length);
    s.confirmedAt = undefined; s.whiffedAt = 10 + move.contacts[0] + .02;
    expect(whiffEnd(s)).toBeCloseTo(move.contacts[0] + .02 + WHIFF_RECOVERY, 9);
    expect(ultimateEnd(s)).toBeCloseTo(move.contacts[0] + .02 + WHIFF_RECOVERY, 9);
    // Freezes are out of the action's clock, and out of the whiff's end on it.
    s.actionFrozen = .1; expect(whiffEnd(s)).toBeCloseTo(move.contacts[0] - .08 + WHIFF_RECOVERY, 9);
    // Other slots, and the area ultimates, draw every blow.
    expect(beats({ ...s, action: 'heavy' }, MOVES.gaunt.heavy)).toBe(MOVES.gaunt.heavy.contacts.length);
    expect(beats({ ...s, fighter: 'taisei', confirmedAt: undefined }, MOVES.taisei.ultimate)).toBe(1);
  });
});

describe('the cinematic\'s effects wait for the confirm', () => {
  const smears = (confirm: boolean) => {
    const scene = new THREE.Scene(), fx = new GauntEffects(scene), move = MOVES.gaunt.ultimate;
    const s = player({ id: 'g', fighter: 'gaunt', action: 'ultimate', actionStarted: 1, actionDuration: move.duration }), gaunt = body(s), fighters = new Map([['g', gaunt]]);
    // The smears thrown, one per contact: the effect's own once-a-contact keys.
    const thrown = new Set<number>(), seen = (fx as unknown as { seenContact: Map<string, number> }).seenContact;
    for (let t = 0; t < move.duration; t += 1 / 60) {
      at(s, t);
      if (t >= move.contacts[0]) { if (confirm) s.confirmedAt = 1 + move.contacts[0]; else s.whiffedAt = 1 + move.contacts[0]; }
      if (!confirm && t > move.contacts[0] + WHIFF_RECOVERY) { s.action = 'idle'; s.whiffedAt = undefined; }
      fx.update(1 + t, fighters, 1);
      for (const [, key] of seen) thrown.add(key);
    }
    return thrown.size;
  };
  it('Hound Rampage: the opener\'s smear at the cast, the rampage\'s only once it has landed', () => {
    expect(smears(false), 'whiffed: the opener alone').toBe(1);
    expect(smears(true), 'landed: every blow').toBe(MOVES.gaunt.ultimate.contacts.length);
  });

  it('ROOM: stands for the cinematic when it lands, and closes with a whiff', () => {
    const room = (confirm: boolean, t: number) => {
      const scene = new THREE.Scene(), fx = new WardEffects(scene), move = MOVES.ward.ultimate;
      const s = player({ id: 'l', fighter: 'ward', action: 'ultimate', actionStarted: 1, actionDuration: move.duration }), ward = body(s), fighters = new Map([['l', ward]]);
      fx.handle([{ id: 1, kind: 'cast', serverTime: 1, actorId: 'l', fighter: 'ward', slot: 'ultimate', origin: { x: 0, y: 1, z: 0 }, endpoint: { x: 0, y: 1, z: 3 } }], fighters);
      let open = false;
      for (let clock = 0; clock <= t; clock += 1 / 60) {
        at(s, clock);
        if (clock >= move.contacts[0]) { if (confirm) s.confirmedAt = 1 + move.contacts[0]; else s.whiffedAt = 1 + move.contacts[0]; }
        if (!confirm && clock > move.contacts[0] + WHIFF_RECOVERY) { s.action = 'idle'; s.whiffedAt = undefined; }
        fx.update(1 + clock, fighters, 1);
        open = false; scene.traverse(o => { if (o.name.startsWith('ward-room-') && o.visible) open = true; });
      }
      return open;
    };
    const move = MOVES.ward.ultimate, over = move.contacts[0] + WHIFF_RECOVERY + .45;
    expect(room(false, move.contacts[0] + .2), 'the opener\'s ROOM').toBe(true);
    expect(room(false, over), 'closed with the whiff').toBe(false);
    expect(room(true, over), 'open through the cinematic').toBe(true);
  });
});

describe('the area ultimates mark their blast', () => {
  const marks = (scene: THREE.Scene) => { const out: THREE.Object3D[] = []; scene.traverse(o => { if (o.name === 'ultimate-blast-area' && o.visible && o.scale.x > .01) out.push(o); }); return out; };
  const cast = (fighter: FighterId, time: number): CombatEvent => ({ id: 3, kind: 'cast', serverTime: time, actorId: 'a', fighter, slot: 'ultimate', origin: { x: 0, y: 1.05, z: 0 }, endpoint: { x: 0, y: 1.05, z: 10 } });
  it.each(['taisei', 'konta', 'kagari'] as FighterId[])('%s: a ring of the blast\'s radius where it will land, from the cast until it goes off', fighter => {
    const scene = new THREE.Scene(), fx = new CombatEffects(scene), move = MOVES[fighter].ultimate;
    const s = player({ fighter, action: 'ultimate', actionStarted: 5, actionDuration: move.duration }), fighters = new Map([['a', body(s)]]);
    try {
      fx.handle([cast(fighter, 5)], fighters);
      const due = 5 + move.contacts[0] + 10 / (move.speed ?? 20);
      let seen = 0;
      for (let time = 5; time < due + .6; time += 1 / 60) {
        if (time - 5 >= move.duration) s.action = 'idle'; else at(s, time - 5);
        fx.update(time, 1 / 60, fighters);
        const shown = marks(scene);
        if (time > 5.2 && time < due - .05) {
          expect(shown, `on the floor at ${(time - 5).toFixed(2)}`).toHaveLength(1);
          expect(shown[0].position.z).toBeCloseTo(10, 6); expect(shown[0].position.y).toBeCloseTo(.04, 6);
          expect(shown[0].scale.x, 'the blast\'s radius').toBeCloseTo(move.radius, 6);
          seen++;
        }
        if (time > due + .3) expect(shown, 'gone once it has gone off').toHaveLength(0);
      }
      expect(seen).toBeGreaterThan(30);
    } finally { fx.dispose(); }
  });

  it('takes the ring away when the caster is knocked out of the wind-up, and marks nothing for a hit-confirm ultimate', () => {
    const scene = new THREE.Scene(), fx = new CombatEffects(scene), move = MOVES.taisei.ultimate;
    const s = player({ fighter: 'taisei', action: 'ultimate', actionStarted: 5, actionDuration: move.duration }), fighters = new Map([['a', body(s)]]);
    try {
      fx.handle([cast('taisei', 5)], fighters);
      for (let time = 5; time < 5.5; time += 1 / 60) { at(s, time - 5); fx.update(time, 1 / 60, fighters); }
      expect(marks(scene)).toHaveLength(1);
      s.action = 'hurt';
      for (let time = 5.5; time < 5.9; time += 1 / 60) fx.update(time, 1 / 60, fighters);
      expect(marks(scene), 'the bomb is never thrown').toHaveLength(0);
      const z = player({ fighter: 'kenzo', action: 'ultimate', actionStarted: 7, actionDuration: MOVES.kenzo.ultimate.duration });
      fx.handle([{ ...cast('kenzo', 7), id: 4 }], new Map([['a', body(z)]]));
      fx.update(7.2, 1 / 60, new Map([['a', body(z)]]));
      expect(marks(scene)).toHaveLength(0);
    } finally { fx.dispose(); }
  });
});
