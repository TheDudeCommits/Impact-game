import { describe, expect, it } from 'vitest';
import { ArenaSimulation } from '../src/game/simulation';
import { HITSTOP, MOVES, REWARD_HITSTOP, blowWeight, heftOf } from '../src/game/moves';
import { pulseFor } from '../src/input/rumble';
import { planCombatAudio } from '../src/audio/cuePlan';
import type { CombatEvent, PlayerInput } from '../src/game/types';

/** what a read is worth in the hands. A COUNTER (lock combat: caught in a swing before its
 *  blow) and a PUNISH (caught in the recovery of a swing that found nobody) hold both bodies REWARD_HITSTOP longer, ring a
 *  sharper layer and kick the pad harder; a heavy blow holds its thrower by its weight as well as the struck body. */
function arena() {
  const sim = new ArenaSimulation({ trainingBot: false, lockCombat: true, seed: 3 });
  sim.addPlayer('a', 'kenzo', 'A', false, { x: 0, y: 0, z: 0 });
  sim.addPlayer('b', 'gummy', 'B', false, { x: 0, y: 0, z: 9 });
  let seq = 0;
  const input = (id: string, more: Partial<PlayerInput> = {}) => sim.submitInput(id, { seq: seq++, moveX: 0, moveZ: 0, yaw: 0, ...more });
  input('a'); input('b'); sim.step();
  return { sim, input };
}
/** A's light on B, standing - or, `whiffFirst`, in the recovery of a heavy B threw at nobody. The hit, and each body's
 *  freeze as the blow lands. */
function lightOn(whiffFirst: boolean) {
  const { sim, input } = arena();
  const a = sim.actors.get('a')!, b = sim.actors.get('b')!;
  if (whiffFirst) {
    input('b', { attack: 'heavy' });
    for (let i = 0; i < 120 && !(b.cast && b.cast.nextContact >= b.cast.move.contacts.length && !b.cast.live?.length); i++) { input('b'); sim.step(); }
    expect(b.cast?.slot, 'B is in its heavy\'s recovery').toBe('heavy');
  }
  Object.assign(a.state, { x: 0, z: b.state.z - 1.3 });
  input('a', { attack: 'light', targetId: 'b' });
  let hit: CombatEvent | undefined, thrower = 0, struck = 0;
  for (let i = 0; i < 40 && !hit; i++) {
    input('b'); sim.step();
    hit = sim.snapshot(true).events.find(e => e.kind === 'hit' && e.actorId === 'a');
    if (hit) { thrower = a.hitstopUntil - sim.serverTime; struck = b.hitstopUntil - sim.serverTime; }
  }
  sim.dispose();
  return { hit: hit!, thrower, struck };
}

describe('a read is felt in the hands', () => {
  it('a blow in the recovery of a swing that found nobody is a PUNISH, both bodies held REWARD_HITSTOP longer', () => {
    const plain = lightOn(false), punish = lightOn(true);
    expect(plain.hit.punish).toBeUndefined();
    expect(punish.hit.punish).toBe(true);
    expect(punish.hit.counter).toBeUndefined();
    expect(punish.struck / plain.struck).toBeCloseTo(REWARD_HITSTOP, 1);
    expect(punish.thrower / plain.thrower).toBeCloseTo(REWARD_HITSTOP, 1);
  });
  it('a blow in a swing\'s wind-up is a COUNTER, held as long', () => {
    const { sim, input } = arena();
    const a = sim.actors.get('a')!, b = sim.actors.get('b')!;
    Object.assign(b.state, { z: 1.3 }); b.state.yaw = Math.PI;
    // B winds up a heavy; A's jab lands before its blow.
    input('b', { attack: 'heavy', yaw: Math.PI, targetId: 'a' }); input('a', { attack: 'light', targetId: 'b' });
    let hit: CombatEvent | undefined, struck = 0;
    for (let i = 0; i < 40 && !hit; i++) { input('b', { yaw: Math.PI }); sim.step(); hit = sim.snapshot(true).events.find(e => e.kind === 'hit' && e.actorId === 'a'); if (hit) struck = b.hitstopUntil - sim.serverTime; }
    sim.dispose();
    expect(hit?.counter).toBe(true);
    expect(struck / lightOn(false).struck).toBeCloseTo(REWARD_HITSTOP, 1);
    expect(a).toBeDefined();
  });
  it('a heavy holds its thrower by its weight over a jab\'s; the struck body\'s hold is as it was', () => {
    const sim = new ArenaSimulation({ trainingBot: false, seed: 3 });
    sim.addPlayer('a', 'kenzo', 'A', false, { x: 0, y: 0, z: 0 });
    sim.addPlayer('b', 'taisei', 'B', false, { x: 0, y: 0, z: 1.6 });
    sim.submitInput('a', { seq: 1, moveX: 0, moveZ: 0, yaw: 0, attack: 'heavy', targetId: 'b' });
    const a = sim.actors.get('a')!, b = sim.actors.get('b')!;
    let hit: CombatEvent | undefined, thrower = 0, struck = 0;
    for (let i = 0; i < 120 && !hit; i++) { sim.step(); hit = sim.snapshot(true).events.find(e => e.kind === 'hit' && e.actorId === 'a'); if (hit) { thrower = a.hitstopUntil - sim.serverTime; struck = b.hitstopUntil - sim.serverTime; } }
    sim.dispose();
    const stop = MOVES.kenzo.heavy.hitstop ?? HITSTOP.heavy, heft = heftOf(hit!.damage!), heavier = stop * .6 * heft;
    expect(heft, 'a heavy is heavier than a jab').toBeGreaterThan(.15);
    expect(heftOf(MOVES.kenzo.light.damage), 'a jab is a jab').toBe(0);
    expect(thrower).toBeCloseTo(stop * .6 + heavier, 2);
    expect(struck).toBeCloseTo(stop * blowWeight(hit!.damage!), 2);
  });
  it('rings sharper and kicks harder', () => {
    const blow: CombatEvent = { id: 1, kind: 'hit', actorId: 'me', targetId: 'them', fighter: 'kenzo', slot: 'light', move: MOVES.kenzo.light.name, damage: 40, serverTime: 1, contactIndex: 0 };
    const plain = planCombatAudio(blow), read = planCombatAudio({ ...blow, punish: true }), counter = planCombatAudio({ ...blow, counter: true });
    expect(read.length).toBe(plain.length + 2); expect(counter.length).toBe(plain.length + 2);
    expect(read.some(layer => layer.cue === 'crack')).toBe(true);
    const felt = pulseFor(blow, 'me')!, kicked = pulseFor({ ...blow, counter: true }, 'me')!;
    expect(kicked.weak).toBeGreaterThan(felt.weak); expect(kicked.strong).toBeGreaterThan(felt.strong); expect(kicked.ms).toBeGreaterThan(felt.ms);
  });
});
