import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { MOVES } from '../src/game/moves';
import { castAge, noteRelease, type HeldCast } from '../src/render/signature/castClock';
import { UnsealedEffects } from '../src/render/signature/Unsealed';
import type { Fighter } from '../src/render/Fighter';
import type { AttackSlot, CombatEvent, FighterId, PlayerState } from '../src/game/types';

/** Round 3c: signature effects run on the move's own clock. The simulation
 *  holds a cast (up to 0.35 s of late commands, and impact freezes) by moving
 *  its start on and leaving the held time out of the thrower's action clock;
 *  an effect timed off the cast event's own time drew NIGHTFALL's cleave and
 *  burn up to a third of a second before its damage. */
const player = (props: Partial<PlayerState>): PlayerState => ({ id: 'i', name: 'I', fighter: 'nigo', x: 0, y: 0, z: 0, yaw: 0,
  hp: 1000, maxHp: 1000, stamina: 100, ultimate: 0, action: 'idle', actionStarted: 0, actionDuration: 0, actionTime: 0,
  target: null, alive: true, isBot: false, grounded: true, guarding: false, cooldowns: { light: 0, heavy: 0, special: 0, ultimate: 0 }, ...props });
const cast = (props: Partial<CombatEvent> = {}): CombatEvent => ({ id: 7, kind: 'cast', serverTime: 10, actorId: 'i', fighter: 'nigo', slot: 'ultimate',
  origin: { x: 0, y: 1.05, z: 0 }, endpoint: { x: 0, y: 1.05, z: 20 }, ...props });
function fighter(fighterId: FighterId, slot: AttackSlot, started: number): Fighter {
  const state = player({ fighter: fighterId, action: slot, actionStarted: started, actionDuration: MOVES[fighterId][slot].duration });
  const group = new THREE.Group();
  const handR = new THREE.Vector3(.3, 1.3, .4), handL = new THREE.Vector3(-.3, 1.3, .4);
  return { state, group, handR, handL, bones: new Map(), joints: new Map(), strikePoint: (out: THREE.Vector3) => out.copy(handR),
    chargePosition(out: THREE.Vector3) { return out.copy(handR); }, meleeContactPoint() { return false; } } as unknown as Fighter;
}
/** Advance a fighter's move clock by `dt`, or hold it (the server's hold). */
const step = (f: Fighter, dt: number, held = false) => { if (!held) f.state.actionTime = Math.min(1, f.state.actionTime + dt / f.state.actionDuration); };

describe('the held cast clock', () => {
  it('takes the server\'s holds out of an effect\'s clock, never gives them back, and pins to the release', () => {
    const f = fighter('nigo', 'ultimate', 10), c: HeldCast = { event: cast() };
    let time = 10;
    for (let i = 0; i < 60; i++) { time += 1 / 60; step(f, 1 / 60); expect(castAge(c, time, f, 3.1)).toBeCloseTo(time - 10, 5); }
    // A stalled charge: 0.3 s of wall time with the move's clock held.
    for (let i = 0; i < 18; i++) { time += 1 / 60; step(f, 1 / 60, true); castAge(c, time, f, 3.1); }
    expect(castAge(c, time, f, 3.1), 'the move is 0.3 s behind the event clock').toBeCloseTo(time - 10 - .3, 5);
    // The clock runs again; the hold stays.
    for (let i = 0; i < 30; i++) { time += 1 / 60; step(f, 1 / 60); }
    expect(castAge(c, time, f, 3.1)).toBeCloseTo(time - 10 - .3, 5);
    // The release arrives when the contact came due (3.1 s of move time): it pins the hold.
    noteRelease([c], { ...cast(), id: 8, kind: 'release', serverTime: 10 + 3.1 + .32 });
    expect(castAge(c, time, f, 3.1), 'a pin behind what was drawn holds still - never a jump back').toBeCloseTo(time - 10 - .3, 5);
    time += .05; step(f, .05);
    expect(castAge(c, time, f, 3.1)).toBeCloseTo(time - 10 - .32, 5);
    // After the move, a different action's clock is not this cast's.
    f.state.action = 'idle'; f.state.actionStarted = time; f.state.actionTime = 0;
    expect(castAge(c, time + 1, f, 3.1)).toBeCloseTo(time + 1 - 10 - .32, 5);
  });

  it('for a predicted fighter, whose clock never holds, waits at the release for the release event and never runs backwards', () => {
    const f = fighter('nigo', 'ultimate', 10), c: HeldCast = { event: cast() };
    let time = 10, last = -1;
    // The server held the cast 0.35 s; the local prediction did not.
    while (time < 13.4) { time += 1 / 60; step(f, 1 / 60); const age = castAge(c, time, f, 3.1, true); expect(age).toBeGreaterThanOrEqual(last); last = age; }
    expect(last, 'held at the release').toBeCloseTo(3.1, 5);
    noteRelease([c], { ...cast(), id: 8, kind: 'release', serverTime: 13.45 });
    time += 1 / 60; const pinned = castAge(c, time, f, 3.1, true);
    expect(pinned, 'no jump back: it holds until the clock catches up').toBeCloseTo(3.1, 5);
    time = 13.6; expect(castAge(c, time, f, 3.1, true)).toBeCloseTo(3.6 - .35, 5);
    // A release that never comes stops the wait after a second.
    const lost: HeldCast = { event: cast({ id: 11 }) };
    expect(castAge(lost, 10 + 3.5, undefined, 3.1, true)).toBeCloseTo(3.1, 5);
    expect(castAge(lost, 10 + 4.3, undefined, 3.1, true)).toBeCloseTo(4.3, 5);
  });

  it('releases go to the latest cast of the same thrower and slot', () => {
    const older: HeldCast = { event: cast({ id: 1, serverTime: 2 }) }, newer: HeldCast = { event: cast({ id: 2, serverTime: 30 }) }, other: HeldCast = { event: cast({ id: 3, serverTime: 30, actorId: 'x' }) };
    noteRelease([older, newer, other], { ...cast(), id: 9, kind: 'release', serverTime: 33.2 });
    expect(newer.releasedAt).toBe(33.2); expect(older.releasedAt).toBeUndefined(); expect(other.releasedAt).toBeUndefined();
  });

  it('draws NIGHTFALL\'s cleave when the held move gets there, not at the nominal time', () => {
    // Round 3d (ULTS): NIGHTFALL is a hit-confirm ultimate - the black wave
    // let go at contact 0 is its opener, and the cleave is its cinematic's,
    // CLEAVE_LEAD (0.1 s) before the finisher, drawn only once it has landed.
    const scene = new THREE.Scene(), fx = new UnsealedEffects(scene), nigo = fighter('nigo', 'ultimate', 10);
    const fighters = new Map([['i', nigo]]), move = MOVES.nigo.ultimate, open = move.contacts[0], cleave = move.contacts[move.contacts.length - 1] - .1;
    // Crescents in the air: the pool's meshes that are showing and full size
    // (the first one waits under the floor, tiny, for the load-time compile).
    const crescent = () => { let n = 0; scene.traverse(o => { if (o.name === 'nightfang-crescent' && o.visible && o.scale.x > .01) n++; }); return n; };
    // The renderer's first frame links the pool's first crescent and lets it
    // be hidden like the rest (Crescents); there is no renderer here.
    scene.traverse(o => { if (o.name.startsWith('nightfang-crescent')) (o.onAfterRender as () => void)(); });
    try {
      fx.handle([cast()]);
      let time = 10;
      const tick = (held = false) => { time += 1 / 60; step(nigo, 1 / 60, held); fx.update(time, 1 / 60, fighters, 1); };
      // The opener lets go, lands and is confirmed.
      while (time < 10 + open) tick();
      fx.handle([{ ...cast(), id: 8, kind: 'release', serverTime: time }]); nigo.state.confirmedAt = time;
      tick(); expect(crescent(), 'the opener\'s black wave').toBeGreaterThan(0);
      // Through the cinematic to 0.4 s short of the cleave, then a 0.3 s stall, then on.
      while (time < 10 + cleave - .4) tick();
      for (let i = 0; i < 18; i++) tick(true);
      // Nominally the cleave starts now; the move is 0.3 s behind.
      while (time < 10 + cleave + .02) tick();
      expect(crescent(), `no cleave yet at ${(cleave + .02).toFixed(2)} s of wall time: the move is 0.3 s short of it`).toBe(0);
      while (time < 10 + cleave + .32) tick();
      expect(crescent(), 'the cleave, once the move reaches it').toBeGreaterThan(0);
    } finally { fx.dispose(); }
  });

  it('draws no cleave for a NIGHTFALL whose opener found nobody', () => {
    const scene = new THREE.Scene(), fx = new UnsealedEffects(scene), nigo = fighter('nigo', 'ultimate', 10);
    const fighters = new Map([['i', nigo]]), move = MOVES.nigo.ultimate, open = move.contacts[0];
    const crescent = () => { let n = 0; scene.traverse(o => { if (o.name === 'nightfang-crescent' && o.visible && o.scale.x > .01) n++; }); return n; };
    scene.traverse(o => { if (o.name.startsWith('nightfang-crescent')) (o.onAfterRender as () => void)(); });
    try {
      fx.handle([cast()]);
      let time = 10, most = 0;
      while (time < 10 + open) { time += 1 / 60; step(nigo, 1 / 60); fx.update(time, 1 / 60, fighters, 1); }
      fx.handle([{ ...cast(), id: 8, kind: 'release', serverTime: time }]); nigo.state.whiffedAt = time;
      // The wave goes out and is gone with the move; nothing follows it.
      while (time < 10 + open + .8) { time += 1 / 60; step(nigo, 1 / 60); fx.update(time, 1 / 60, fighters, 1); }
      nigo.state.action = 'idle'; nigo.state.whiffedAt = undefined;
      while (time < 10 + move.duration + 1) { time += 1 / 60; fx.update(time, 1 / 60, fighters, 1); most = Math.max(most, crescent()); }
      expect(most, 'no cleave after a whiff').toBe(0);
    } finally { fx.dispose(); }
  });
});
